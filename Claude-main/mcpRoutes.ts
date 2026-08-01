/**
 * MCP-facing API routes for unattended lyrics-video creation.
 *
 * Architecture note:
 * The website's kinetic typography engine runs entirely in the browser
 * (Canvas + MediaRecorder). This module provides a secure, authenticated
 * API that produces a real H.264 MP4 using ffmpeg (audio + timed burned-in
 * lyrics on a styled background). Full kinetic parity requires either
 * Puppeteer on a persistent host or a Node canvas port — see /mcp/README.md.
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStaticPath from "ffmpeg-static";

const execPromise = promisify(exec);
const FFMPEG_BIN = ffmpegStaticPath || "ffmpeg";

// ---------------------------------------------------------------------------
// Config & constants
// ---------------------------------------------------------------------------

const MCP_API_KEY = process.env.MCP_API_KEY || process.env.VIDEO_API_SECRET || "";
const MAX_AUDIO_BYTES = 40 * 1024 * 1024; // 40 MB for MCP path (safer for serverless)
const MAX_LYRICS_CHARS = 12_000;
const MAX_TITLE_LEN = 120;
const MAX_ARTIST_LEN = 120;
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12; // requests per window per key/IP

const ALLOWED_ASPECT = new Set(["16:9", "9:16", "1:1", "4:5"]);
const ALLOWED_STYLES = new Set([
  "classic", "karaoke", "minimal", "neon", "vaporwave", "cyberpunk",
  "cinematic", "lofi", "suno", "sonauto", "default"
]);

const STYLE_COLORS: Record<string, { bg: string; fg: string; accent: string }> = {
  classic:   { bg: "0x0f172a", fg: "white", accent: "0x38bdf8" },
  karaoke:   { bg: "0x0f172a", fg: "white", accent: "0x38bdf8" },
  minimal:   { bg: "0x111111", fg: "white", accent: "0xaaaaaa" },
  neon:      { bg: "0x000000", fg: "0xfefe00", accent: "0x00ff66" },
  vaporwave: { bg: "0x1a0b2e", fg: "0xff007f", accent: "0x00f0ff" },
  cyberpunk: { bg: "0x000000", fg: "0xfefe00", accent: "0x00ff66" },
  cinematic: { bg: "0x0a0a12", fg: "white", accent: "0xd4af37" },
  lofi:      { bg: "0x1a1a1a", fg: "0xe8d5b7", accent: "0xc4a574" },
  suno:      { bg: "0x101625", fg: "white", accent: "0xf97316" },
  sonauto:   { bg: "0x030712", fg: "white", accent: "0x3b82f6" },
  default:   { bg: "0x0f172a", fg: "white", accent: "0x38bdf8" },
};

const ASPECT_SIZE: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
  "1:1":  { w: 720, h: 720 },
  "4:5":  { w: 720, h: 900 },
};

// ---------------------------------------------------------------------------
// Job store (in-memory; document Redis/Supabase for multi-instance)
// ---------------------------------------------------------------------------

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface McpJob {
  id: string;
  status: JobStatus;
  progress: number;
  videoUrl: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  meta: {
    title: string;
    artist: string;
    style: string;
    aspectRatio: string;
    durationSec?: number;
  };
  // Internal only
  _audioPath?: string;
  _videoPath?: string;
  _workDir?: string;
}

const jobs = new Map<string, McpJob>();

function purgeExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      cleanupJobFiles(job);
      jobs.delete(id);
    }
  }
}

function cleanupJobFiles(job: McpJob) {
  try {
    if (job._workDir && fs.existsSync(job._workDir)) {
      fs.rmSync(job._workDir, { recursive: true, force: true });
    }
  } catch (_) {}
}

setInterval(purgeExpiredJobs, 5 * 60_000).unref?.();

// ---------------------------------------------------------------------------
// Simple rate limiter (per API key / IP)
// ---------------------------------------------------------------------------

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX;
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireMcpAuth(req: Request, res: Response, next: NextFunction) {
  if (!MCP_API_KEY || MCP_API_KEY === "MY_MCP_API_KEY" || MCP_API_KEY.length < 16) {
    return res.status(503).json({
      success: false,
      error: "MCP API is not configured. Set MCP_API_KEY (or VIDEO_API_SECRET) in environment variables."
    });
  }

  const header = req.headers.authorization || "";
  const keyHeader = (req.headers["x-api-key"] as string) || "";
  const token =
    (header.startsWith("Bearer ") ? header.slice(7).trim() : "") ||
    keyHeader.trim();

  if (!token || token !== MCP_API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized. Provide a valid MCP API key." });
  }

  const rateKey = token.slice(0, 12) + ":" + (req.ip || "unknown");
  if (!rateLimit(rateKey)) {
    return res.status(429).json({ success: false, error: "Rate limit exceeded. Try again later." });
  }

  next();
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function parseLyricsInput(raw: unknown): { text: string; lines?: { text: string; start: number; end: number }[] } {
  if (typeof raw === "string") {
    return { text: raw.trim() };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as any;
    if (typeof obj.text === "string") {
      const lines = Array.isArray(obj.lines)
        ? obj.lines
            .filter((l: any) => l && typeof l.text === "string")
            .map((l: any) => ({
              text: String(l.text).trim(),
              start: Number(l.start) || 0,
              end: Number(l.end) || 0
            }))
        : undefined;
      return { text: obj.text.trim(), lines };
    }
  }
  return { text: "" };
}

function escapeDrawtext(s: string): string {
  // ffmpeg drawtext escaping: \, :, ', %
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "%%")
    .replace(/\n/g, " ");
}

function buildAssSubtitles(
  lines: { text: string; start: number; end: number }[],
  w: number,
  h: number,
  style: string
): string {
  const colors = STYLE_COLORS[style] || STYLE_COLORS.default;
  // ASS colour is &HAABBGGRR
  const primary = "&H00FFFFFF";
  const outline = "&H80000000";

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${Math.floor(h * 0.055)},${primary},&H000000FF,${outline},&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,${Math.floor(h * 0.12)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const toAssTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.floor((sec % 1) * 100);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  const events = lines
    .filter((l) => l.text && l.end > l.start)
    .map((l) => {
      const text = l.text.replace(/\n/g, "\\N").replace(/[{}]/g, "");
      return `Dialogue: 0,${toAssTime(l.start)},${toAssTime(l.end)},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return header + events + "\n";
}

function simpleTimedLinesFromPlainText(text: string, durationSec: number): { text: string; start: number; end: number }[] {
  const chunks = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    return [{ text: "♪ Instrumental ♪", start: 0, end: durationSec }];
  }
  // Equal split with small gaps
  const slot = durationSec / chunks.length;
  return chunks.map((t, i) => ({
    text: t,
    start: Number((i * slot).toFixed(2)),
    end: Number(Math.min(durationSec, (i + 1) * slot - 0.15).toFixed(2))
  }));
}

async function probeDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execPromise(
      `"${FFMPEG_BIN}" -i "${audioPath}" -f null - 2>&1 || true`
    );
    const m = stdout.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m) {
      return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
    }
  } catch (_) {}
  return 30;
}

// ---------------------------------------------------------------------------
// Render pipeline (simplified but real MP4)
// ---------------------------------------------------------------------------

async function processJob(job: McpJob, audioBuffer: Buffer, lyricsParsed: ReturnType<typeof parseLyricsInput>) {
  job.status = "processing";
  job.progress = 5;
  job.updatedAt = Date.now();

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `mcp-job-${job.id}-`));
  job._workDir = workDir;
  const audioPath = path.join(workDir, "audio");
  const assPath = path.join(workDir, "lyrics.ass");
  const outPath = path.join(workDir, "output.mp4");
  job._audioPath = audioPath;
  job._videoPath = outPath;

  try {
    // Detect extension-ish from buffer magic is overkill; write as binary
    fs.writeFileSync(audioPath, audioBuffer);
    job.progress = 15;
    job.updatedAt = Date.now();

    const duration = await probeDuration(audioPath);
    job.meta.durationSec = duration;
    job.progress = 25;
    job.updatedAt = Date.now();

    const aspect = job.meta.aspectRatio;
    const size = ASPECT_SIZE[aspect] || ASPECT_SIZE["16:9"];
    const colors = STYLE_COLORS[job.meta.style] || STYLE_COLORS.default;

    let lines = lyricsParsed.lines;
    if (!lines || lines.length === 0) {
      lines = simpleTimedLinesFromPlainText(lyricsParsed.text || "♪ Music ♪", duration);
    }

    // Clamp line ends to duration
    lines = lines.map((l) => ({
      ...l,
      end: Math.min(l.end, duration),
      start: Math.max(0, Math.min(l.start, duration - 0.05))
    }));

    fs.writeFileSync(assPath, buildAssSubtitles(lines, size.w, size.h, job.meta.style));
    job.progress = 40;
    job.updatedAt = Date.now();

    // Title burn-in for first few seconds
    const titleEsc = escapeDrawtext(job.meta.title || "Untitled");
    const artistEsc = escapeDrawtext(job.meta.artist || "Unknown Artist");
    const titleSize = Math.floor(size.h * 0.06);
    const artistSize = Math.floor(size.h * 0.035);

    // Use -vf with ass= for subtitles; quote paths carefully
    const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "'\\''");
    const filterChain = [
      `drawtext=text='${titleEsc}':fontcolor=white:fontsize=${titleSize}:x=(w-text_w)/2:y=h*0.12:enable='lt(t\\,4)'`,
      `drawtext=text='${artistEsc}':fontcolor=0xcccccc:fontsize=${artistSize}:x=(w-text_w)/2:y=h*0.12+${titleSize + 10}:enable='lt(t\\,4)'`,
      `ass='${assEscaped}'`
    ].join(",");

    const cmd = [
      `"${FFMPEG_BIN}"`,
      `-y`,
      `-f lavfi -i "color=c=${colors.bg}:s=${size.w}x${size.h}:d=${duration.toFixed(2)}"`,
      `-i "${audioPath}"`,
      `-vf "${filterChain}"`,
      `-map 0:v -map 1:a`,
      `-c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p`,
      `-c:a aac -b:a 128k -shortest`,
      `-movflags +faststart`,
      `"${outPath}"`
    ].join(" ");

    job.progress = 55;
    job.updatedAt = Date.now();

    console.log(`[MCP Job ${job.id}] ffmpeg starting (${size.w}x${size.h}, ${duration.toFixed(1)}s)`);
    await execPromise(cmd, { maxBuffer: 20 * 1024 * 1024, timeout: 180_000 });

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
      throw new Error("ffmpeg produced an empty or missing output file");
    }

    job.progress = 95;
    job.videoUrl = `/api/mcp/download/${job.id}`;
    job.status = "completed";
    job.progress = 100;
    job.updatedAt = Date.now();
  } catch (err: any) {
    console.error(`[MCP Job ${job.id}] failed:`, err?.message || err);
    job.status = "failed";
    job.error = err?.message || String(err);
    job.progress = 0;
    job.updatedAt = Date.now();
    cleanupJobFiles(job);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES }
});

export function createMcpRouter(): Router {
  const router = Router();

  router.use(requireMcpAuth);

  router.get("/styles", (_req, res) => {
    res.json({
      success: true,
      styles: Array.from(ALLOWED_STYLES),
      aspectRatios: Array.from(ALLOWED_ASPECT),
      note: "These styles map to simplified server-side color themes. Full kinetic templates remain available in the website UI."
    });
  });

  router.post(
    "/create-lyrics-video",
    upload.fields([
      { name: "audio", maxCount: 1 },
      { name: "coverImage", maxCount: 1 }
    ]),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as { [field: string]: { buffer: Buffer; mimetype: string; originalname: string }[] } | undefined;
        const audioFile = files?.audio?.[0];

        if (!audioFile) {
          return res.status(400).json({ success: false, error: "audio file is required (multipart field 'audio')" });
        }

        const mime = (audioFile.mimetype || "").toLowerCase();
        if (!mime.startsWith("audio/") && !mime.includes("mpeg") && !mime.includes("mp4") && !mime.includes("wav") && !mime.includes("ogg") && !mime.includes("webm") && !mime.includes("flac")) {
          return res.status(400).json({ success: false, error: `Unsupported audio type: ${mime}` });
        }

        let lyricsRaw: unknown = req.body.lyrics;
        if (typeof lyricsRaw === "string") {
          try {
            lyricsRaw = JSON.parse(lyricsRaw);
          } catch {
            // plain string lyrics is fine
          }
        }
        const lyricsParsed = parseLyricsInput(lyricsRaw);
        if (!lyricsParsed.text && (!lyricsParsed.lines || lyricsParsed.lines.length === 0)) {
          return res.status(400).json({ success: false, error: "lyrics are required (string or JSON with text/lines)" });
        }
        if (lyricsParsed.text.length > MAX_LYRICS_CHARS) {
          return res.status(400).json({ success: false, error: `lyrics too long (max ${MAX_LYRICS_CHARS} chars)` });
        }

        const title = String(req.body.title || "Untitled").trim().slice(0, MAX_TITLE_LEN);
        const artist = String(req.body.artist || "Unknown Artist").trim().slice(0, MAX_ARTIST_LEN);
        let style = String(req.body.style || req.body.visualStyle || "default").toLowerCase().trim();
        if (!ALLOWED_STYLES.has(style)) style = "default";
        let aspectRatio = String(req.body.aspectRatio || "16:9").trim();
        if (!ALLOWED_ASPECT.has(aspectRatio)) aspectRatio = "16:9";

        const jobId = crypto.randomBytes(12).toString("hex");
        const job: McpJob = {
          id: jobId,
          status: "queued",
          progress: 0,
          videoUrl: null,
          error: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          meta: { title, artist, style, aspectRatio }
        };
        jobs.set(jobId, job);

        // Fire-and-forget processing (single-instance safe)
        setImmediate(() => {
          processJob(job, audioFile.buffer, lyricsParsed).catch((e) => {
            console.error(`[MCP] unhandled processJob error for ${jobId}:`, e);
            job.status = "failed";
            job.error = e?.message || String(e);
            job.updatedAt = Date.now();
          });
        });

        return res.status(202).json({
          success: true,
          jobId,
          status: "queued",
          message: "Job accepted. Poll GET /api/mcp/lyrics-video-status/:jobId"
        });
      } catch (err: any) {
        console.error("[MCP create]", err);
        return res.status(500).json({ success: false, error: err?.message || "Internal error" });
      }
    }
  );

  router.get("/lyrics-video-status/:jobId", (req: Request, res: Response) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found or expired" });
    }
    return res.json({
      success: true,
      status: job.status,
      progress: job.progress,
      videoUrl: job.videoUrl,
      error: job.error,
      meta: job.meta
    });
  });

  // Authenticated download of completed MP4
  router.get("/download/:jobId", (req: Request, res: Response) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.status !== "completed" || !job._videoPath) {
      return res.status(404).json({ success: false, error: "Video not available" });
    }
    if (!fs.existsSync(job._videoPath)) {
      return res.status(410).json({ success: false, error: "Video file expired from temporary storage" });
    }
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="lyrics-${job.id}.mp4"`);
    fs.createReadStream(job._videoPath).pipe(res);
  });

  return router;
}

export function getMcpJobCount() {
  return jobs.size;
}

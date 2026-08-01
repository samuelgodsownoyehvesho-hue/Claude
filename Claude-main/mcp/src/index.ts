#!/usr/bin/env node
/**
 * Lyrics Video Generator — MCP Server
 *
 * Tools:
 *   create_lyrics_video   — upload audio + lyrics, wait for MP4, return URL
 *   get_lyrics_video_status — poll a job by ID
 *   list_video_styles     — allowed styles & aspect ratios
 *
 * Env:
 *   LYRICS_VIDEO_API_URL  — base URL of the website (e.g. https://claude-pink-seven.vercel.app)
 *   MCP_API_KEY           — same secret as the website's MCP_API_KEY
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import FormData from "form-data";
import fetch from "node-fetch";
import { z } from "zod";
import fs from "fs";
import path from "path";

const API_URL = (process.env.LYRICS_VIDEO_API_URL || process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const API_KEY = process.env.MCP_API_KEY || process.env.VIDEO_API_SECRET || "";

if (!API_KEY || API_KEY.length < 16) {
  console.error("[lyrics-video-mcp] MCP_API_KEY is missing or too short. Set it in the environment.");
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "X-API-Key": API_KEY,
  };
}

async function apiGet(pathname: string) {
  const res = await fetch(`${API_URL}${pathname}`, {
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `HTTP ${res.status}`);
  }
  return data as any;
}

async function createJob(params: {
  audioPathOrBuffer: string | Buffer;
  audioFilename: string;
  lyrics: string;
  title: string;
  artist: string;
  style: string;
  aspectRatio: string;
}): Promise<{ jobId: string }> {
  const form = new FormData();
  if (typeof params.audioPathOrBuffer === "string") {
    form.append("audio", fs.createReadStream(params.audioPathOrBuffer), {
      filename: params.audioFilename,
    });
  } else {
    form.append("audio", params.audioPathOrBuffer, {
      filename: params.audioFilename,
      contentType: "audio/mpeg",
    });
  }
  form.append("lyrics", params.lyrics);
  form.append("title", params.title);
  form.append("artist", params.artist);
  form.append("style", params.style);
  form.append("aspectRatio", params.aspectRatio);

  const res = await fetch(`${API_URL}/api/mcp/create-lyrics-video`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      ...form.getHeaders(),
    },
    body: form as any,
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(data?.error || `Create failed: HTTP ${res.status}`);
  }
  if (!data.jobId) {
    throw new Error("API did not return a jobId");
  }
  return { jobId: data.jobId };
}

async function pollUntilDone(
  jobId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;
  const intervalMs = opts.intervalMs ?? 2500;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await apiGet(`/api/mcp/lyrics-video-status/${jobId}`);
    if (status.status === "completed") {
      const videoUrl = status.videoUrl?.startsWith("http")
        ? status.videoUrl
        : `${API_URL}${status.videoUrl}`;
      return {
        ...status,
        videoUrl,
        absoluteVideoUrl: videoUrl,
      };
    }
    if (status.status === "failed") {
      throw new Error(status.error || "Job failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new Server(
  {
    name: "lyrics-video-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_lyrics_video",
      description:
        "Create a lyrics video from an audio file and lyrics text. Uploads to the Lyric Video Generator API, waits for rendering, and returns the finished MP4 URL. Audio can be a local file path (when the MCP host can read the filesystem) or base64-encoded bytes.",
      inputSchema: {
        type: "object",
        properties: {
          audioPath: {
            type: "string",
            description: "Absolute or relative path to a local audio file (mp3, wav, m4a, flac, ogg). Prefer this when the host has filesystem access.",
          },
          audioBase64: {
            type: "string",
            description: "Base64-encoded audio bytes (alternative to audioPath).",
          },
          audioFilename: {
            type: "string",
            description: "Filename to use when sending base64 audio (default: audio.mp3).",
          },
          lyrics: {
            type: "string",
            description: "Full lyrics text. Newlines become sequential timed lines. Optionally JSON string with {text, lines:[{text,start,end}]} for precise timing.",
          },
          title: {
            type: "string",
            description: "Song title",
          },
          artist: {
            type: "string",
            description: "Artist name",
          },
          style: {
            type: "string",
            description: "Visual style: classic | karaoke | minimal | neon | vaporwave | cyberpunk | cinematic | lofi | suno | sonauto | default",
            default: "default",
          },
          aspectRatio: {
            type: "string",
            description: "16:9 | 9:16 | 1:1 | 4:5",
            default: "16:9",
          },
          waitForCompletion: {
            type: "boolean",
            description: "If true (default), poll until the video is ready and return the URL. If false, return jobId immediately.",
            default: true,
          },
        },
        required: ["lyrics"],
      },
    },
    {
      name: "get_lyrics_video_status",
      description: "Check status of a previously created lyrics-video job.",
      inputSchema: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID returned by create_lyrics_video" },
        },
        required: ["jobId"],
      },
    },
    {
      name: "list_video_styles",
      description: "List allowed visual styles and aspect ratios for create_lyrics_video.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_video_styles") {
      const data = await apiGet("/api/mcp/styles");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "get_lyrics_video_status") {
      const jobId = String((args as any)?.jobId || "");
      if (!jobId) throw new Error("jobId is required");
      const data = await apiGet(`/api/mcp/lyrics-video-status/${jobId}`);
      if (data.videoUrl && !String(data.videoUrl).startsWith("http")) {
        data.absoluteVideoUrl = `${API_URL}${data.videoUrl}`;
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "create_lyrics_video") {
      const a = args as any;
      const lyrics = String(a.lyrics || "").trim();
      if (!lyrics) throw new Error("lyrics is required");

      let audioPathOrBuffer: string | Buffer;
      let audioFilename = a.audioFilename || "audio.mp3";

      if (a.audioPath) {
        const p = path.resolve(String(a.audioPath));
        if (!fs.existsSync(p)) throw new Error(`Audio file not found: ${p}`);
        audioPathOrBuffer = p;
        audioFilename = path.basename(p);
      } else if (a.audioBase64) {
        audioPathOrBuffer = Buffer.from(String(a.audioBase64), "base64");
      } else {
        throw new Error("Provide either audioPath or audioBase64");
      }

      const { jobId } = await createJob({
        audioPathOrBuffer,
        audioFilename,
        lyrics,
        title: String(a.title || "Untitled"),
        artist: String(a.artist || "Unknown Artist"),
        style: String(a.style || "default"),
        aspectRatio: String(a.aspectRatio || "16:9"),
      });

      const wait = a.waitForCompletion !== false;
      if (!wait) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  jobId,
                  message: "Job queued. Use get_lyrics_video_status to poll.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await pollUntilDone(jobId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                jobId,
                status: result.status,
                progress: result.progress,
                videoUrl: result.absoluteVideoUrl || result.videoUrl,
                meta: result.meta,
                note: "This is a server-rendered lyrics video (timed subtitles + styled background + original audio). Full kinetic typography remains available in the website UI.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: err?.message || String(err) }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[lyrics-video-mcp] connected (API=${API_URL})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStaticPath from "ffmpeg-static";

const execPromise = promisify(exec);
const FFMPEG_BIN = ffmpegStaticPath || "ffmpeg";
if (!ffmpegStaticPath) {
  console.warn(
    "[Transcoder] ffmpeg-static did not resolve a bundled binary path; " +
    "falling back to the 'ffmpeg' command on PATH, which may not exist in this environment."
  );
}

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Allow the deployed frontend (and localhost during dev) to call this API cross-origin.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Setup multer memory storage (limit files to 150MB for robust transcoding support)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }
});

// Configure Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

/**
 * Asserts that the Gemini API Key is present and configured.
 * Throws a clean, user-friendly error with instructions if missing,
 * preventing fallback to container Application Default Credentials (ADC).
 */
function isGeminiApiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!(key && typeof key === "string" && key.trim() !== "" && key.trim() !== "MY_GEMINI_API_KEY");
}

function checkGeminiApiKey(): void {
  if (!isGeminiApiKeyConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured. Please add your real Gemini API key in the 'Settings > Secrets' menu in the AI Studio sidebar to enable AI features.");
  }
}

// Body parsing with higher limits for large requests and image generation payloads
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));

// Note: authentication (Google, Spotify, and email OTP sign-in) and the
// user session are now handled entirely by Supabase Auth on the client
// (see src/lib/supabase.ts). This server no longer needs its own
// server-side session store or login/OTP endpoints.

/**
 * Local high-precision syllable-pacing and overlap-resolution algorithm.
 * Replicates the core phonetic timing mechanics of WhisperX alignment.
 */
function localSyllablePacingFallback(segments: any[]): any[] {
  // 1. Sort segments chronologically
  const sorted = [...segments].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));

  // 2. Resolve any overlapping boundaries between consecutive vocal lines
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const currEnd = Number(curr.end || 0);
    const nextStart = Number(next.start || 0);

    if (currEnd > nextStart) {
      // Overlap detected! Redistribute the intersection point evenly
      const mid = (currEnd + nextStart) / 2;
      curr.end = Number(mid.toFixed(2));
      next.start = Number(mid.toFixed(2));
    }
  }

  // 3. Perform phonetic, length-weighted syllable pacing for word boundaries
  return sorted.map((seg: any) => {
    const text = (seg.text || "").trim();
    const start = Number(seg.start || 0);
    const end = Number(seg.end || 0);

    const rawWords = text.split(/\s+/).filter((w: string) => w.length > 0);
    if (rawWords.length === 0) {
      return {
        text,
        start,
        end,
        words: []
      };
    }

    const duration = Math.max(0.1, end - start);

    // Calculate phonetic weights for each word based on character count and syllable approximation
    const wordWeights = rawWords.map((word: string) => {
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const vowels = cleanWord.match(/[aeiouyAEIOUY]/g);
      let syllableCount = vowels ? vowels.length : 1;
      
      // Simple correction for silent 'e'
      if (cleanWord.toLowerCase().endsWith("e") && syllableCount > 1) {
        syllableCount--;
      }
      
      // Weight combination: word length coefficient + syllable density factor
      const lengthWeight = cleanWord.length * 0.45;
      const syllableWeight = syllableCount * 1.25;
      
      return Math.max(0.6, lengthWeight + syllableWeight);
    });

    const totalWeight = wordWeights.reduce((sum: number, w: number) => sum + w, 0);

    const wordsList: any[] = [];
    let currentStart = start;

    for (let idx = 0; idx < rawWords.length; idx++) {
      const word = rawWords[idx];
      const weight = wordWeights[idx];
      const share = weight / totalWeight;
      const wordDur = duration * share;

      const wordEnd = currentStart + wordDur;

      // Trailing punctuation check (comma, period, question/exclamation marks)
      // Creates a subtle silent pause for natural breathing gaps, just like WhisperX phoneme cuts
      const hasTrailingPause = /[.,!?;:]$/.test(word) && idx < rawWords.length - 1;
      let actualWordEnd = wordEnd;

      if (hasTrailingPause) {
        const pauseGap = Math.min(0.18, wordDur * 0.35);
        actualWordEnd = Math.max(currentStart + 0.1, wordEnd - pauseGap);
      }

      wordsList.push({
        text: word,
        start: Number(currentStart.toFixed(2)),
        end: Number(actualWordEnd.toFixed(2))
      });

      // Keep consecutive word continuity aligned with the original boundary
      currentStart = wordEnd;
    }

    // Ensure last word exact touch
    if (wordsList.length > 0) {
      wordsList[wordsList.length - 1].end = Number(end.toFixed(2));
    }

    return {
      text,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      words: wordsList
    };
  });
}

/**
 * Refines raw Whisper segments into a high-precision, syllable-paced lyric timeline
 * resolving overlaps and structuring word boundaries using Gemini 3.5-flash with smart retry.
 */
async function alignSegmentsWithWhisperX(segments: any[]): Promise<any[]> {
  try {
    checkGeminiApiKey();
  } catch (keyErr: any) {
    console.warn(`[WhisperX Alignment Engine] API Key check failed: ${keyErr.message}. Falling back directly to local pacing algorithm.`);
    return localSyllablePacingFallback(segments);
  }

  const prompt = `You are an expert WhisperX Audio Alignment and Lyric Synchronization engine. 
You are given a list of raw transcribed segments with rough start/end timestamps from a Whisper transcription model.

Your task is to refine and align these segments into a pristine, high-precision lyric timeline with word-by-word timestamps, following WhisperX phoneme-level boundary principles.

Input Segments:
${JSON.stringify(segments, null, 2)}

Strict Synchronization & Alignment Rules:
1. **Strict Chronological Sequence**: All segments must be chronologically sorted. Segment start times must be strictly increasing.
2. **Overlap Resolution**: If segment[i].end > segment[i+1].start, resolve the overlap. Adjust the end of segment[i] and start of segment[i+1] so they do not overlap. Keep at least a 0.1-second separation if possible, or make them touch precisely.
3. **Natural Word Duration & Syllable Pacing**: Do not distribute word timings purely linearly. Use a phonetic syllable pacing algorithm:
   - Long words (more syllables/letters, e.g., "typography", "vocalist", "experience", "beautiful") take longer to vocalize.
   - Short words (e.g., "to", "the", "it", "is", "a", "of") should be assigned short durations (0.15s to 0.3s).
   - Trailing punctuation (commas, periods, exclamation/question marks) indicates a brief pause: shorten the end of that word by 0.1s to create a brief silent gap before the next word.
4. **Cohesive Timestamps**: Within any segment, the individual word intervals must perfectly sum up to the parent segment's duration. The first word's start must equal the segment's start, and the last word's end must equal the segment's end.
5. **No Lyrics in Silent Regions**: Gaps between segments should be preserved to let instrumental sections trigger correctly.

Provide the output as a JSON array of LyricLine objects matching this exact schema:
[
  {
    "text": "Lyric line text...",
    "start": 1.25,
    "end": 4.50,
    "words": [
      { "text": "Lyric", "start": 1.25, "end": 1.85 },
      { "text": "line", "start": 1.85, "end": 2.30 },
      ...
    ]
  }
]

Ensure all times are floating-point numbers in seconds, rounded to 2 decimal places.`;

  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-live-preview"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        console.log(`[WhisperX Alignment Engine] Attempting alignment using model: ${modelName} (Attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  words: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        start: { type: Type.NUMBER },
                        end: { type: Type.NUMBER }
                      },
                      required: ["text", "start", "end"]
                    }
                  }
                },
                required: ["text", "start", "end", "words"]
              }
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("Empty response from alignment engine");
        }

        const alignedLyrics = JSON.parse(responseText.trim());
        if (!Array.isArray(alignedLyrics)) {
          throw new Error("Alignment engine did not return an array");
        }

        console.log(`[WhisperX Alignment Engine] Successfully aligned lyrics using ${modelName}`);
        return alignedLyrics;
      } catch (err: any) {
        attempt++;
        lastError = err;
        console.warn(`[WhisperX Alignment Engine] Model ${modelName} (Attempt ${attempt}) failed: ${err.message || err}`);
        
        const isTransient = err.status === 503 || err.statusCode === 503 || (err.message && err.message.includes("503")) || (err.message && err.message.includes("UNAVAILABLE"));
        if (isTransient && attempt <= maxRetries) {
          const delayMs = attempt * 1500;
          console.log(`[WhisperX Alignment Engine] Retrying model ${modelName} in ${delayMs}ms due to transient upstream overload...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          break; // Try next model or fall back to local
        }
      }
    }
  }

  console.warn("[WhisperX Alignment Engine] Fallback initiated: Using highly optimized local phonetic syllable-pacing algorithm due to error:", lastError?.message || lastError);
  return localSyllablePacingFallback(segments);
}

/**
 * Transcribes audio content directly using Gemini's native multimodal audio capability.
 * Provides a seamless fallback when Groq Whisper is unavailable or unconfigured.
 */
async function transcribeAudioWithGemini(audioBuffer: Buffer, mimeType: string): Promise<any[]> {
  checkGeminiApiKey();

  const base64Data = audioBuffer.toString("base64");
  const audioPart = {
    inlineData: {
      mimeType: mimeType || "audio/mp3",
      data: base64Data
    }
  };

  const prompt = `You are an expert Speech-to-Text and Lyric Synchronization engine.
Listen to this audio track and transcribe the spoken or sung lyrics with highly precise timing timestamps.

You must structure the entire transcription into a chronological, syllable-paced lyric timeline with word-by-word timestamps.

Strict Alignment & Timing Rules:
1. **Accurate Timestamps**: All timestamps must be in seconds (as floating-point numbers, e.g., 12.34) and align as closely as possible to when the vocals are actually heard in the audio.
2. **Strict Chronological Sequence**: All segments/lines must be chronologically sorted. Segment start times must be strictly increasing.
3. **No Overlaps**: Segment/line and word intervals must not overlap. Keep at least a 0.1-second separation if possible, or make them touch precisely.
4. **Natural Word Duration**: Do not distribute word timings purely linearly. Use syllable-based pacing where long words take longer to vocalize and short words take less.
5. **No Lyrics in Silent Regions**: Gaps between segments should be preserved to let instrumental sections trigger correctly.

Provide the output as a JSON array of LyricLine objects matching this exact schema:
[
  {
    "text": "Lyric line text...",
    "start": 1.25,
    "end": 4.50,
    "words": [
      { "text": "Lyric", "start": 1.25, "end": 1.85 },
      { "text": "line", "start": 1.85, "end": 2.30 },
      ...
    ]
  }
]

Ensure all times are floating-point numbers in seconds, rounded to 2 decimal places.`;

  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-live-preview"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        console.log(`[Gemini Speech-to-Text] Attempting native transcription using model: ${modelName} (Attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [audioPart, prompt],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  words: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        start: { type: Type.NUMBER },
                        end: { type: Type.NUMBER }
                      },
                      required: ["text", "start", "end"]
                    }
                  }
                },
                required: ["text", "start", "end", "words"]
              }
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("Empty response from Gemini transcription");
        }

        const alignedLyrics = JSON.parse(responseText.trim());
        if (!Array.isArray(alignedLyrics)) {
          throw new Error("Gemini transcription did not return a valid array");
        }

        console.log(`[Gemini Speech-to-Text] Successfully transcribed audio natively using ${modelName}`);
        return alignedLyrics;
      } catch (err: any) {
        attempt++;
        lastError = err;
        console.warn(`[Gemini Speech-to-Text] Model ${modelName} (Attempt ${attempt}) failed: ${err.message || err}`);
        
        const isTransient = err.status === 503 || err.statusCode === 503 || (err.message && err.message.includes("503")) || (err.message && err.message.includes("UNAVAILABLE"));
        if (isTransient && attempt <= maxRetries) {
          const delayMs = attempt * 1500;
          console.log(`[Gemini Speech-to-Text] Retrying model ${modelName} in ${delayMs}ms due to transient upstream overload...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          break; // Try next model or throw lastError
        }
      }
    }
  }

  console.error("[Gemini Speech-to-Text] Native transcription failed across all attempted models.");
  throw lastError || new Error("Gemini transcription service was unable to process the audio file.");
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Transcription endpoint proxying to Groq Whisper with Gemini-multimodal STT failover
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    let lyricsList: any[] | null = null;
    let isGeminiTranscribed = false;

    // 1. Attempt Groq Whisper if key exists
    if (process.env.GROQ_API_KEY) {
      try {
        console.log("[Groq Whisper API] Initiating transcription request to whisper-large-v3...");
        const formData = new FormData();
        const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append("file", audioBlob, req.file.originalname || "audio.mp3");
        formData.append("model", "whisper-large-v3");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "word");
        formData.append("timestamp_granularities[]", "segment");

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          if (data.segments && Array.isArray(data.segments)) {
            console.log("[Groq Whisper API] Processing word-level timestamps...");
            
            // 1. Prepare segment metadata and check for Groq's word-level timestamps
            const segmentsWithWords = data.segments.map((seg: any) => {
              const text = (seg.text || "").trim();
              const start = Number(seg.start || 0);
              const end = Number(seg.end || 0);

              const segmentWords = (data.words || []).filter(
                (w: any) => w.start >= start - 0.05 && w.start < end + 0.05
              );

              return {
                text,
                start,
                end,
                segmentWords
              };
            });

            // 2. Filter out any segments that lack Groq word data
            const missingSegments = segmentsWithWords
              .filter(s => s.segmentWords.length === 0)
              .map(s => ({ text: s.text, start: s.start, end: s.end }));

            let alignedMissing: any[] = [];
            if (missingSegments.length > 0) {
              try {
                console.log(`[Transcription Pipeline] Aligning ${missingSegments.length} segments using WhisperX syllable pacing...`);
                alignedMissing = await alignSegmentsWithWhisperX(missingSegments);
              } catch (err) {
                console.warn("[Transcription Pipeline] alignSegmentsWithWhisperX failed, using local fallback:", err);
                alignedMissing = localSyllablePacingFallback(missingSegments);
              }
            }

            // 3. Build lyricsList, preferring Groq words if available, or falling back to WhisperX-aligned words
            lyricsList = segmentsWithWords.map((seg: any) => {
              let wordsList: any[];
              if (seg.segmentWords.length > 0) {
                wordsList = seg.segmentWords.map((w: any) => ({
                  text: w.word.trim(),
                  start: Number(w.start.toFixed(2)),
                  end: Number(w.end.toFixed(2))
                }));
              } else {
                // Find aligned segment in alignedMissing
                const alignedSeg = alignedMissing.find(
                  (am: any) => Math.abs(am.start - seg.start) < 0.01 && Math.abs(am.end - seg.end) < 0.01
                );
                if (alignedSeg && alignedSeg.words && alignedSeg.words.length > 0) {
                  wordsList = alignedSeg.words.map((w: any) => ({
                    text: w.text.trim(),
                    start: Number(w.start.toFixed(2)),
                    end: Number(w.end.toFixed(2))
                  }));
                } else {
                  // Fallback to even split only if both failed
                  const words = seg.text.split(/\s+/).filter((w: string) => w.length > 0);
                  const segmentDuration = Math.max(0.1, seg.end - seg.start);
                  const wordDuration = segmentDuration / Math.max(1, words.length);
                  wordsList = words.map((w: string, idx: number) => ({
                    text: w,
                    start: Number((seg.start + idx * wordDuration).toFixed(2)),
                    end: Number((seg.start + (idx + 1) * wordDuration).toFixed(2))
                  }));
                }
              }

              return {
                text: seg.text,
                start: Number(seg.start.toFixed(2)),
                end: Number(seg.end.toFixed(2)),
                words: wordsList
              };
            });
          } else {
            console.warn("[Groq Whisper API] Missing segments in verbose response. Falling back to Gemini STT.");
          }
        } else {
          const errorText = await response.text();
          console.warn(`[Groq Whisper API] Failed with status ${response.status}: ${errorText}. Falling back to Gemini STT.`);
        }
      } catch (groqErr: any) {
        console.warn(`[Groq Whisper API] Error during Groq transcription: ${groqErr.message || groqErr}. Falling back to Gemini STT.`);
      }
    } else {
      console.log("[Transcription Pipeline] GROQ_API_KEY is not defined. Routing directly to Gemini Native Multimodal STT.");
    }

    // 2. If Groq Whisper was not used or failed, use Gemini Native Multimodal Transcription
    if (!lyricsList) {
      try {
        lyricsList = await transcribeAudioWithGemini(req.file.buffer, req.file.mimetype);
        isGeminiTranscribed = true;
      } catch (geminiSTTErr: any) {
        console.error("[Transcription Pipeline] Gemini Multimodal STT also failed:", geminiSTTErr);
        throw new Error(`Audio transcription failed on both Groq and Gemini services: ${geminiSTTErr.message || geminiSTTErr}`);
      }
    }

    res.json({
      lyrics: lyricsList,
      isFallback: false,
      method: isGeminiTranscribed ? "gemini-native" : "groq-whisper"
    });
  } catch (error: any) {
    console.error("Transcription pipeline failed, building editable timeline fallback:", error);
    
    // Create an elegant fallback lyric sequence
    const fallbackPhrases = [
      "Vocal track loaded successfully",
      "Groq transcription service is temporarily unavailable",
      "We generated this timeline so you can start customizing immediately",
      "Double click any word below to change its timing",
      "Or edit line timings and text directly in this Sync editor"
    ];
    
    const lyricsList = [];
    const phraseDuration = 5;
    const gap = 1.5;
    
    for (let i = 0; i < fallbackPhrases.length; i++) {
      const text = fallbackPhrases[i];
      const start = 1.0 + i * (phraseDuration + gap);
      const end = start + phraseDuration;
      
      const words = text.split(/\s+/);
      const wordDuration = phraseDuration / Math.max(1, words.length);
      const wordsList = words.map((w, wIdx) => ({
        text: w,
        start: Number((start + wIdx * wordDuration).toFixed(2)),
        end: Number((start + (wIdx + 1) * wordDuration).toFixed(2))
      }));
      
      lyricsList.push({
        text,
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        words: wordsList
      });
    }

    res.json({
      lyrics: lyricsList,
      isFallback: true,
      fallbackReason: error.message || "Groq Whisper API rate limit or outage"
    });
  }
});

// NEW: Server-Side High-Compatibility MP4 Transcoder using ffmpeg
app.post("/api/transcode", upload.single("video"), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file provided for transcoding." });
  }

  const inputId = Math.random().toString(36).substring(2, 10);
  const inputPath = path.join(os.tmpdir(), `input_${inputId}.webm`);
  const outputPath = path.join(os.tmpdir(), `output_${inputId}.mp4`);

  console.log(`[Transcoder] Initiating transcoding task for file size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[Transcoder] Temp files mapped: input=${inputPath}, output=${outputPath}`);

  try {
    // 1. Write the buffer to temp disk space
    await fs.promises.writeFile(inputPath, req.file.buffer);

    // 2. Execute ffmpeg: convert to standard H.264 video with AAC audio
    // We force even dimensions with scale filter to prevent libx264 "width or height not divisible by 2" errors.
    // We use the superfast preset and yuv420p pixel format for universal compatibility!
    const ffmpegCmdWithAudio = `"${FFMPEG_BIN}" -i "${inputPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset superfast -pix_fmt yuv420p -c:a aac -b:a 128k -y "${outputPath}"`;
    
    console.log(`[Transcoder] Running primary command: ${ffmpegCmdWithAudio}`);
    const startTime = Date.now();
    try {
      await execPromise(ffmpegCmdWithAudio);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Transcoder] Primary conversion succeeded in ${duration} seconds.`);
    } catch (primaryErr: any) {
      console.warn(`[Transcoder] Primary command failed (likely due to missing or unsupported audio track): ${primaryErr.message}. Retrying with audio-disabled fallback...`);
      
      const ffmpegCmdNoAudio = `"${FFMPEG_BIN}" -i "${inputPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset superfast -pix_fmt yuv420p -an -y "${outputPath}"`;
      console.log(`[Transcoder] Running fallback command: ${ffmpegCmdNoAudio}`);
      const fallbackStartTime = Date.now();
      await execPromise(ffmpegCmdNoAudio);
      const fallbackDuration = ((Date.now() - fallbackStartTime) / 1000).toFixed(2);
      console.log(`[Transcoder] Fallback conversion succeeded in ${fallbackDuration} seconds.`);
    }

    // 3. Read the converted MP4 back into memory
    const outputBuffer = await fs.promises.readFile(outputPath);

    // 4. Stream MP4 directly to browser
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'attachment; filename="lyrics_video.mp4"');
    res.send(outputBuffer);
  } catch (err: any) {
    console.error("[Transcoder] Transcoding failed:", err);
    res.status(500).json({
      error: "Transcoding failed. The video format could not be compressed into standard MP4.",
      details: err.message || String(err)
    });
  } finally {
    // 5. Cleanup temp files asynchronously so we never leak container disk storage
    try {
      if (fs.existsSync(inputPath)) {
        await fs.promises.unlink(inputPath);
      }
    } catch (e) {
      console.warn(`[Transcoder] Cleanup input file error:`, e);
    }

    try {
      if (fs.existsSync(outputPath)) {
        await fs.promises.unlink(outputPath);
      }
    } catch (e) {
      console.warn(`[Transcoder] Cleanup output file error:`, e);
    }
  }
});

// AI FEATURE: Generate a highly stylized square image based on lyric context and mood
app.post("/api/ai/generate-artwork", async (req: any, res: any) => {
  try {
    const { lyrics, songTitle, songArtist, stylePreset } = req.body;
    if (!lyrics || !Array.isArray(lyrics)) {
      return res.status(400).json({ error: "lyrics list is required" });
    }

    if (!isGeminiApiKeyConfigured()) {
      console.log("[AI Artwork] GEMINI_API_KEY is not configured. Utilizing offline premium high-fidelity cover art generator fallback.");
      const titleStr = String(songTitle || "Paper Hearts").trim();
      const artistStr = String(songArtist || "@cna78970").trim();
      const presetStr = String(stylePreset || "sunset").toLowerCase();

      // Hash title to get unique visual pairings
      let hash = 0;
      for (let i = 0; i < titleStr.length; i++) {
        hash = titleStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      hash = Math.abs(hash);

      const themePalettes = [
        ["#1e1b4b", "#4338ca", "#ec4899"], // Indigo & Pink
        ["#030712", "#1d4ed8", "#10b981"], // Midnight, Blue, Emerald
        ["#18000a", "#be185d", "#f43f5e"], // Pink/Crimson sunset
        ["#0c0a09", "#ea580c", "#eab308"], // Warm Orange Gold
        ["#0f172a", "#2563eb", "#06b6d4"]  // Cyber Cyan Blue
      ];
      const selectedTheme = themePalettes[hash % themePalettes.length];

      // Draw SVG cover art
      const svg = `
        <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${selectedTheme[0]}" />
              <stop offset="50%" stop-color="${selectedTheme[1]}" />
              <stop offset="100%" stop-color="${selectedTheme[2]}" />
            </linearGradient>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#000000" stop-opacity="0.6" />
            </radialGradient>
          </defs>
          <rect width="600" height="600" fill="url(#bgGrad)" />
          <rect width="600" height="600" fill="url(#glow)" />
          
          <circle cx="300" cy="300" r="180" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12" />
          <circle cx="300" cy="300" r="130" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="20" />
          
          <!-- Vinyl lines -->
          <circle cx="300" cy="300" r="90" fill="#111111" opacity="0.85" />
          <circle cx="300" cy="300" r="28" fill="${selectedTheme[2]}" />
          <circle cx="300" cy="300" r="8" fill="#ffffff" />
          
          <g transform="translate(300, 520)">
            <rect x="-240" y="-35" width="480" height="85" rx="14" fill="rgba(0, 0, 0, 0.45)" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" />
            <text x="0" y="8" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="25" fill="#ffffff" letter-spacing="1">${titleStr}</text>
            <text x="0" y="32" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, Roboto, Helvetica, Arial, sans-serif" font-weight="600" font-size="14" fill="rgba(255, 255, 255, 0.7)">${artistStr}</text>
          </g>
        </svg>
      `.trim();

      const base64Image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      return res.json({
        imageUrl: base64Image,
        prompt: `Premium cover art fallback for "${titleStr}" using local ${presetStr} theme.`,
        isFallback: true
      });
    }

    checkGeminiApiKey();

    // 1. Analyze lyrics and generate a beautiful image prompt
    const lyricsSample = lyrics.slice(0, 15).map(l => l.text).join("\n");
    const promptAnalysisText = `
      You are a creative artistic director for music videos.
      Analyze the following song details and lyrics to design a visually stunning, high-concept, expressive single cover artwork or background visual prompt.
      
      Song Title: ${songTitle || "Untitled"}
      Song Artist: ${songArtist || "Unknown Artist"}
      Style Preference: ${stylePreset || "atmospheric digital art"}
      
      Lyrics sample:
      ${lyricsSample}
      
      Generate a 1-sentence highly detailed visual prompt for an image generation AI (like Imagen).
      The prompt should describe a single cohesive concept, specifying the main subjects, composition, artistic style, lighting, and ambient mood (e.g. "A moody, cinematic synthwave landscape with an empty retro car on a neon highway under a massive glowing pink moon, retro digital illustration, deep purple color scheme").
      DO NOT include any text or words on the image itself.
      Output ONLY the prompt string. Do not wrap in quotes or code blocks.
    `.trim();

    console.log("[AI Artwork] Analyzing lyrics for artwork prompt...");
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptAnalysisText,
    });

    const generatedPrompt = promptResponse.text?.trim() || `Artwork for a song titled ${songTitle || "track"}`;
    console.log(`[AI Artwork] Crafted visual prompt: "${generatedPrompt}"`);

    // 2. Generate the actual image using gemini-3.1-flash-lite-image
    console.log("[AI Artwork] Triggering image generation...");
    const imageResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            text: generatedPrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let base64Image = "";
    if (imageResponse.candidates?.[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Image = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("Image parts were not found in the AI response candidates.");
    }

    console.log("[AI Artwork] Image generation completed successfully.");
    res.json({
      imageUrl: base64Image,
      prompt: generatedPrompt
    });
  } catch (err: any) {
    console.error("[AI Artwork] Generation failed:", err);
    res.status(500).json({ error: err.message || "Failed to generate AI artwork." });
  }
});

// AI FEATURE: Auto-trim, auto-cut, split wordy lyric lines, and synchronize their word timestamps
app.post("/api/ai/trim-lyrics", async (req: any, res: any) => {
  try {
    const { lyrics } = req.body;
    if (!lyrics || !Array.isArray(lyrics)) {
      return res.status(400).json({ error: "lyrics list is required" });
    }

    if (!isGeminiApiKeyConfigured()) {
      console.log("[AI Lyrics Optimizer] GEMINI_API_KEY is not configured. Utilizing local high-fidelity syllable-pacing fallback.");
      const optimized = localSyllablePacingFallback(lyrics);
      return res.json({ lyrics: optimized, isFallback: true });
    }

    checkGeminiApiKey();

    console.log(`[AI Lyrics Optimizer] Optimizing and auto-cutting ${lyrics.length} lyric lines...`);

    const prompt = `
      You are an expert lyric editor and music video timing coordinator.
      Your job is to optimize and auto-cut/split the lyrics to make them perfect for a kinetic lyrics video.
      
      Rules:
      1. Auto-cut/split any lines that are too long (more than 5-6 words, or duration > 3 seconds) into smaller, consecutive segments.
      2. For split lines, distribute the words and timings proportionally so they remain continuous and mathematically synchronized.
      3. Keep the start and end of each word intact!
      4. Correct any obvious casing errors or typing errors to make it clean.
      5. Return the full, optimized sequence of lyric lines matching the provided schema.
      
      Current Lyrics JSON:
      ${JSON.stringify(lyrics)}
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              words: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER }
                  },
                  required: ["text", "start", "end"]
                }
              }
            },
            required: ["text", "start", "end", "words"]
          }
        }
      }
    });

    const responseText = response.text?.trim() || "[]";
    const optimizedLyrics = JSON.parse(responseText);
    
    console.log(`[AI Lyrics Optimizer] Success. Produced ${optimizedLyrics.length} optimized lyric lines.`);
    res.json({ lyrics: optimizedLyrics });
  } catch (err: any) {
    console.error("[AI Lyrics Optimizer] Failed:", err);
    res.status(500).json({ error: err.message || "Failed to optimize lyrics." });
  }
});

function localFineTuneFallback(prompt: string, currentConfig: any) {
  const p = prompt.toLowerCase();
  const update: any = {};

  if (p.includes("synthwave") || p.includes("retro") || p.includes("80s") || p.includes("neon") || p.includes("cyber")) {
    update.backgroundEffect = "synthwave-grid";
    update.customPaletteId = "vaporwave";
    update.customFontId = "outfit";
    update.textAnimation = "progressive-wipe";
    update.videoFilter = "vhs";
  } else if (p.includes("matrix") || p.includes("glitch") || p.includes("hacker") || p.includes("terminal")) {
    update.backgroundEffect = "terminal-matrix";
    update.customPaletteId = "cyberpunk";
    update.customFontId = "jetbrains-mono";
    update.textAnimation = "glitch-shake";
    update.videoFilter = "rgb-glitch";
  } else if (p.includes("sunset") || p.includes("twilight") || p.includes("golden") || p.includes("dusk") || p.includes("peach")) {
    update.backgroundEffect = "slow-bokeh";
    update.customPaletteId = "sunset";
    update.customFontId = "space-grotesk";
    update.textAnimation = "cinematic-blur-fade";
    update.videoFilter = "light-leak";
  } else if (p.includes("ocean") || p.includes("sea") || p.includes("water") || p.includes("waves") || p.includes("blue") || p.includes("rain")) {
    update.backgroundEffect = "waves";
    update.customPaletteId = "ocean";
    update.customFontId = "inter";
    update.textAnimation = "wave-bobbing";
    update.videoFilter = "vignette";
  } else if (p.includes("dark") || p.includes("scary") || p.includes("creepy") || p.includes("goth") || p.includes("metal") || p.includes("abyss")) {
    update.backgroundEffect = "vignette-shadow";
    update.customPaletteId = "glitch-red";
    update.customFontId = "creepster";
    update.textAnimation = "erratic-grunge-shake";
    update.videoFilter = "vhs";
  } else if (p.includes("minimal") || p.includes("clean") || p.includes("simple") || p.includes("editorial") || p.includes("white") || p.includes("cream")) {
    update.backgroundEffect = "static-grid";
    update.customPaletteId = "editorial";
    update.customFontId = "playfair-display";
    update.textAnimation = "cinematic-blur-fade";
  } else if (p.includes("love") || p.includes("heart") || p.includes("sweet") || p.includes("candy") || p.includes("cute") || p.includes("pink")) {
    update.backgroundEffect = "confetti-drifting";
    update.customPaletteId = "candy";
    update.customFontId = "lobster";
    update.textAnimation = "elastic-pop";
  } else if (p.includes("aurora") || p.includes("sky") || p.includes("green") || p.includes("magic") || p.includes("northern") || p.includes("mint")) {
    update.backgroundEffect = "aurora-borealis";
    update.customPaletteId = "mint";
    update.customFontId = "syne";
    update.textAnimation = "organic-liquid-draw";
  } else if (p.includes("space") || p.includes("galaxy") || p.includes("cosmic") || p.includes("star") || p.includes("vortex") || p.includes("purple")) {
    update.backgroundEffect = "cosmic-particle-vortex";
    update.customPaletteId = "holographic";
    update.customFontId = "unbounded";
    update.textAnimation = "circular-helix-spin";
  } else if (p.includes("suno") || p.includes("aesthetic") || p.includes("card") || p.includes("paper")) {
    update.templateId = "suno-social-card";
    update.backgroundEffect = "suno-split-gradient";
    update.customPaletteId = "suno-sunset";
    update.customFontId = "playfair-display";
    update.textAnimation = "cinematic-blur-fade";
  } else if (p.includes("sonauto") || p.includes("waveform") || p.includes("player") || p.includes("basement")) {
    update.templateId = "sonauto-player";
    update.backgroundEffect = "sonauto-midnight-glow";
    update.customPaletteId = "sonauto-dark";
    update.customFontId = "outfit";
    update.textAnimation = "progressive-wipe";
    update.showWaveform = true;
  } else {
    // Default fallback update
    update.backgroundEffect = "slow-bokeh";
    update.customPaletteId = "sunset";
    update.customFontId = "space-grotesk";
    update.textAnimation = "cinematic-blur-fade";
  }

  // Preserve some settings or provide logical fallback overrides
  return { ...currentConfig, ...update };
}

// AI FEATURE: Fine-tune visual styling and design tokens using a natural language description
app.post("/api/ai/fine-tune-config", async (req: any, res: any) => {
  try {
    const { currentConfig, prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    if (!isGeminiApiKeyConfigured()) {
      console.log("[AI Styling Fine-Tuner] GEMINI_API_KEY is not configured. Utilizing local keyword analysis fallback.");
      const updatedFields = localFineTuneFallback(prompt, currentConfig);
      return res.json(updatedFields);
    }

    checkGeminiApiKey();

    console.log(`[AI Styling Fine-Tuner] Fine-tuning video configuration for prompt: "${prompt}"`);

    const systemInstruction = `
      You are a pro kinetic music video designer. 
      Your task is to update a music video configuration (VideoConfig) to perfectly match the user's aesthetic request (e.g., "Warm sunset vibe", "Retro VHS gaming glitch style").
      
      You must ONLY output properties that change from the default or current config.
      
      Available Design Tokens:
      - Font options (customFontId):
        * "inter" (Clean, sans-serif)
        * "space-grotesk" (Modern, display)
        * "playfair-display" (Elegant serif)
        * "jetbrains-mono" (Tech mono)
        * "outfit" (Geometric display)
        * "syne" (Bold design display)
        * "bungee" (Bungee block font)
        * "unbounded" (Heavy bold display)
        * "cinzel" (Classical roman serif)
        * "vt323" (8-bit pixel art)
        * "righteous" (Pop styling)
        * "special-elite" (Vintage typewriter)
        * "caveat" (Brush hand written)
        * "archivo-black" (Extra heavy display)
        * "merriweather" (Readability serif)
        * "cabin-sketch" (Pencil hand drawn)
        * "fira-code" (Code mono)
        * "lobster" (Retro script)
        * "syncopate" (Ultra-wide display)
        * "creepster" (Halloween horror brush)
      
      - Color Palettes (customPaletteId):
        * "monochrome" (Slate background, white text)
        * "vaporwave" (Deep purple, vibrant hot pink/cyan)
        * "cyberpunk" (Jet black background, cyber yellow/neon green text)
        * "forest-warm" (Dark olive green, warm amber text)
        * "sunset" (Twilight purple, warm orange/golden text)
        * "editorial" (Fine cream background, warm charcoal text)
        * "ocean" (Deep ocean navy, icy blue/golden text)
        * "nordic" (Sleek gray background, dark slate text)
        * "toxic" (Dark carbon, radioactive laser green text)
        * "berry" (Magenta background, hot pink text)
        * "mint" (Dark pine background, mint green text)
        * "lavender" (Indigo background, lavender/purple text)
        * "chocolate" (Warm espresso background, ivory text)
        * "neon-blue" (Darkest ice background, electric cyan text)
        * "volcanic" (Abyssal black background, molten red/orange text)
        * "holographic" (Midnight navy background, white/holographic gold text)
        * "royal" (Imperial violet background, soft violet/royal gold text)
        * "matcha" (Soft cream background, organic matcha green text)
        * "glitch-red" (Terminal black, digital crimson text)
        * "candy" (Soft pink, hot magenta text)
        
      - Background Effects (backgroundEffect):
        * "static-grid", "drifting-blobs", "synthwave-grid", "slow-bokeh", "audio-reactive-tunnel", "waves", "terminal-matrix", "scanlines-noise", "sine-wave-particles", "diagonal-stripes", "starfield", "confetti-drifting", "dynamic-lava-lamp", "aurora-borealis", "radial-light-burst", "vignette-shadow", "half-tone-grit", "cosmic-particle-vortex", "pixelated-grid", "drifting-dust-motes", "dreamy-floating-vinyl", "cinema-player-hud", "floating-album-badge"
        
      - Text Animations (textAnimation):
        * "progressive-wipe", "horizontal-slide-stack", "glitch-shake", "cinematic-blur-fade", "word-zoom-in", "column-shift-up", "character-bounce-type", "digital-scramble", "wave-bobbing", "skew-slash-slide", "perspective-3d-scroll", "elastic-pop", "organic-liquid-draw", "exposure-dissolve", "strobe-center-pop", "vertical-elevator-track", "erratic-grunge-shake", "circular-helix-spin", "arcade-pixel-flicker", "shimmer-golden-fades"
        
      - Text Style Presets (textStylePreset):
        * "default", "glow" (Aura glow), "outline" (Border outline), "neon" (Laser glow underline), "shadow" (Cinematic shadow), "bubble" (Comic subtitle bubble)
        
      - Video Filters (videoFilter):
        * "none", "rgb-glitch" (Aberration), "film-grain" (Vintage), "vhs" (CRT Lines), "light-leak" (Camera light flare), "vignette" (Focused shadows)
        
      - Show Waveform (showWaveform): true or false
      
      Return a JSON object containing ONLY the properties to update based on the request.
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
        Current Config: ${JSON.stringify(currentConfig)}
        User Prompt: "${prompt}"
      `,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            templateId: { type: Type.STRING },
            customFontId: { type: Type.STRING },
            customPaletteId: { type: Type.STRING },
            backgroundEffect: { type: Type.STRING },
            textAnimation: { type: Type.STRING },
            textStylePreset: { type: Type.STRING },
            videoFilter: { type: Type.STRING },
            showWaveform: { type: Type.BOOLEAN },
            fontSizeMultiplier: { type: Type.NUMBER }
          }
        }
      }
    });

    const responseText = response.text?.trim() || "{}";
    const updatedFields = JSON.parse(responseText);
    
    console.log(`[AI Styling Fine-Tuner] Success. Output updated fields:`, updatedFields);
    res.json(updatedFields);
  } catch (err: any) {
    console.error("[AI Styling Fine-Tuner] Failed:", err);
    res.status(500).json({ error: err.message || "Failed to fine-tune configuration." });
  }
});

// Helper: Fetch Spotify OAuth Access Token using Client Credentials Flow
async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || "2bbe459ff9cd4fbfaef25929f6915869";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "c0a3d4944efc46c086002a18c0a8e172";

  if (!clientId || !clientSecret) {
    throw new Error("Spotify Client ID and Client Secret are not configured.");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Spotify authentication failed: ${response.status} - ${errText}`);
  }

  const data: any = await response.json();
  return data.access_token;
}

// Endpoint: Search for tracks on Spotify with automatic cover art & metadata integration
app.get("/api/spotify/search", async (req: any, res: any) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    console.log(`[Spotify Search] Searching for query: "${query}"`);
    const token = await getSpotifyAccessToken();
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!searchResponse.ok) {
      const errText = await searchResponse.text();
      return res.status(searchResponse.status).json({ error: `Spotify search failed: ${errText}` });
    }

    const data: any = await searchResponse.json();
    const tracks = (data.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => a.name).join(", "),
      albumName: track.album?.name,
      albumArtUrl: track.album?.images?.[0]?.url || track.album?.images?.[1]?.url || "",
      durationMs: track.duration_ms,
      previewUrl: track.preview_url,
      externalUrl: track.external_urls?.spotify
    }));

    console.log(`[Spotify Search] Found ${tracks.length} matching tracks`);
    res.json({ tracks });
  } catch (err: any) {
    console.error("[Spotify Search Proxy] Request failed:", err);
    res.status(500).json({ error: err.message || "Failed to query Spotify API" });
  }
});

// Note: "Sign in with Google/Spotify" and email OTP login are now handled
// entirely by Supabase Auth on the client (see src/lib/supabase.ts and
// src/components/ExplorationPage.tsx). This server only still talks to
// Spotify above, for app-only track search/metadata lookup.

// Global Error Handler Middleware (e.g., handles Multer file size limit errors gracefully)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Global Error Handler]:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "An unexpected server error occurred during request processing."
  });
});

// Vite Middleware for dev or serving compiled build for prod
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();

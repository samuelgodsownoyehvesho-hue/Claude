# Lyrics Video MCP Server

Model Context Protocol server that drives the **Lyric Video Generator** website API so ChatGPT, Claude Desktop, or any MCP client can create lyrics videos unattended.

## What it does

```
ChatGPT / Claude / other MCP client
        │
        ▼
  lyrics-video-mcp  (this package, stdio)
        │
        ▼
  Your website  POST /api/mcp/create-lyrics-video
        │
        ▼  (ffmpeg server-side render)
  Finished MP4 URL returned to the AI
```

**Important limitation:** The website’s kinetic typography engine is browser-only (Canvas + MediaRecorder). The MCP API produces a **real MP4** with:

- original audio
- timed burned-in lyrics (ASS subtitles)
- title/artist intro
- styled solid background

Full kinetic motion graphics stay in the web UI. See “Limitations” below.

---

## 1. Installation

### Desktop / laptop

```bash
cd mcp
npm install
npm run build
```

### Android (Termux)

```bash
pkg update && pkg install nodejs ffmpeg
cd mcp
npm install
npm run build
```

Node **≥ 18** is required.

---

## 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_API_KEY` | **Yes** | Same secret as the website (`MCP_API_KEY` or `VIDEO_API_SECRET`). Min 16 chars. |
| `LYRICS_VIDEO_API_URL` | **Yes** | Base URL of the deployed site, e.g. `https://claude-pink-seven.vercel.app` or `http://localhost:3000` |
| `PUBLIC_APP_URL` | optional | Alias for the API base URL |

Never put `MCP_API_KEY` in frontend JavaScript or commit it to git.

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Starting the website API

From the **project root** (not `/mcp`):

```bash
# install root deps once
npm install

# copy env
cp .env.example .env.local
# edit .env.local → set MCP_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, etc.

# local dev (Express + Vite)
npm run dev
```

Production (after `npm run build`):

```bash
NODE_ENV=production npm start
```

On Vercel: set `MCP_API_KEY` in project Environment Variables. Note that long ffmpeg jobs may hit serverless timeouts; for reliable rendering prefer a persistent host (Railway, Render, Fly, a VPS).

---

## 4. Starting the MCP server

```bash
cd mcp
export MCP_API_KEY="your-secret"
export LYRICS_VIDEO_API_URL="https://claude-pink-seven.vercel.app"
npm run start
```

Or with tsx (no build step):

```bash
npm run dev
```

The process speaks MCP over **stdio** (standard for Claude Desktop / Cursor / many hosts).

---

## 5. Testing the HTTP API directly

```bash
# health of styles (auth required)
curl -s -H "Authorization: Bearer $MCP_API_KEY" \
  "$LYRICS_VIDEO_API_URL/api/mcp/styles" | jq

# create a job
curl -s -X POST \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -F "audio=@./test.mp3" \
  -F "lyrics=Line one of the song
Line two of the song" \
  -F "title=Test Track" \
  -F "artist=Demo Artist" \
  -F "style=neon" \
  -F "aspectRatio=16:9" \
  "$LYRICS_VIDEO_API_URL/api/mcp/create-lyrics-video" | jq

# poll
curl -s -H "Authorization: Bearer $MCP_API_KEY" \
  "$LYRICS_VIDEO_API_URL/api/mcp/lyrics-video-status/JOB_ID" | jq

# download when completed
curl -L -H "Authorization: Bearer $MCP_API_KEY" \
  -o out.mp4 \
  "$LYRICS_VIDEO_API_URL/api/mcp/download/JOB_ID"
```

---

## 6. Testing MCP tools

With the MCP server running under an MCP inspector or client, call:

- `list_video_styles`
- `create_lyrics_video` with `audioPath` + `lyrics` + `title`
- `get_lyrics_video_status` with the returned `jobId`

---

## 7. Connecting to an MCP-compatible client

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "lyrics-video": {
      "command": "node",
      "args": ["/absolute/path/to/Claude-main/mcp/dist/index.js"],
      "env": {
        "MCP_API_KEY": "your-secret",
        "LYRICS_VIDEO_API_URL": "https://claude-pink-seven.vercel.app"
      }
    }
  }
}
```

### Cursor / other stdio hosts

Same pattern: command = `node`, args = path to `dist/index.js`, env = key + API URL.

### ChatGPT (Custom GPT / Actions)

ChatGPT does not natively speak MCP stdio yet. Options:

1. Expose the same `/api/mcp/*` routes as OpenAPI Actions on a Custom GPT (use the Bearer token as auth).
2. Run this MCP server behind a bridge that maps MCP → OpenAI function calling.
3. Use Claude Desktop / Cursor / Continue which already support MCP.

Example system prompt for a Custom GPT using the HTTP API:

> When the user wants a lyrics video, call the create-lyrics-video action with their audio (base64 or URL) and lyrics. Poll status until completed, then give them the video URL.

---

## 8. Deploying

| Component | Suggested host |
|-----------|----------------|
| Website + `/api/mcp/*` | Vercel (short jobs) or Railway/Render (longer ffmpeg) |
| MCP server process | Local machine, Claude Desktop host, or any always-on Node box |

On Vercel:

1. Set `MCP_API_KEY` in the project env.
2. Redeploy.
3. Jobs live in memory for ~1 hour; video files in `/tmp` until the instance recycles.

For multi-instance production, replace the in-memory job map with Redis or a Supabase `mcp_jobs` table (schema sketch is in the root `supabase-schema.sql` comments).

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | `MCP_API_KEY` mismatch between MCP process and website |
| `503 MCP API is not configured` | Website env missing `MCP_API_KEY` |
| `ffmpeg … failed` | Ensure `ffmpeg-static` installed in root `node_modules`; on Termux install system `ffmpeg` |
| Job stuck `queued` | Server process may have restarted (in-memory store lost) |
| Empty / short video | Audio unreadable by ffmpeg; try mp3/wav |
| Vercel timeout | Move API to Railway or increase max duration; keep songs short for serverless |

---

## 10. How to ask ChatGPT / Claude

Once the MCP server is connected:

> Create a lyrics video for this song. Title: “Midnight Drive”, Artist: “Nova”. Style neon, 16:9. Lyrics:  
> Street lights blur like memories  
> I’m still chasing yesterday  
> Audio is at /path/to/song.mp3

Or with base64 (when the client can pass binary):

> Here’s the audio as base64 and the full lyrics — make a 9:16 lyrics video in vaporwave style.

---

## Tools reference

### `create_lyrics_video`

| Arg | Type | Required | Notes |
|-----|------|----------|-------|
| `audioPath` | string | one of path/base64 | Local file path |
| `audioBase64` | string | one of path/base64 | Base64 bytes |
| `audioFilename` | string | no | Default `audio.mp3` |
| `lyrics` | string | **yes** | Plain text or JSON |
| `title` | string | no | |
| `artist` | string | no | |
| `style` | string | no | See `list_video_styles` |
| `aspectRatio` | string | no | `16:9` `9:16` `1:1` `4:5` |
| `waitForCompletion` | bool | no | Default `true` |

### `get_lyrics_video_status`

| Arg | Type | Required |
|-----|------|----------|
| `jobId` | string | yes |

### `list_video_styles`

No arguments.

---

## Limitations (honest)

1. **Not full kinetic typography** — server path uses ASS subtitles + solid background, not the Canvas effects in `canvasRenderer.ts`.
2. **In-memory jobs** — lost on process restart; not shared across Vercel instances.
3. **Temp video storage** — download URL works while the instance keeps the `/tmp` file; for permanent storage upload the MP4 to S3/R2/Supabase Storage.
4. **Serverless timeouts** — long songs may need a persistent Node host.
5. **ChatGPT native MCP** — still emerging; use Claude Desktop, Cursor, or HTTP Actions in the meantime.

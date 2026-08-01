<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6249d34f-0731-423a-b86e-4d2f9b717d6f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set up Supabase (Auth + storage — replaces the old Firebase setup):
   - Create a free project at [supabase.com](https://supabase.com)
   - In Project Settings > API, copy the Project URL and anon public key into
     `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - In the SQL Editor, run [supabase-schema.sql](supabase-schema.sql) once to
     create the `profiles` and `projects` tables (with RLS so users can only
     see their own data)
   - Under Authentication > Providers, enable **Google** and **Spotify**,
     each with your own OAuth app credentials from their developer consoles
   - Under Authentication > URL Configuration, add your app's URL (and
     `http://localhost:3000` for local dev) to Site URL / Redirect URLs
   - Email sign-in works out of the box via Supabase's built-in one-time-code
     email login — no extra setup needed
4. Run the app:
   `npm run dev`

## MCP / ChatGPT automation

This project exposes an authenticated API for unattended lyrics-video creation
and ships an MCP server so Claude Desktop, Cursor, and other MCP clients can
drive it.

See **[mcp/README.md](mcp/README.md)** for:

- Installing and running the MCP server (including Termux/Android)
- Environment variables (`MCP_API_KEY`, `LYRICS_VIDEO_API_URL`)
- API endpoints `POST /api/mcp/create-lyrics-video` and status/download
- Connecting to Claude Desktop / ChatGPT Actions
- Limitations (server path is timed-subtitle MP4; full kinetic stays in the UI)

Quick start:

```bash
# website
export MCP_API_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
npm run dev

# separate terminal — MCP
cd mcp && npm install && npm run build
export MCP_API_KEY=...   # same key
export LYRICS_VIDEO_API_URL=http://localhost:3000
npm start
```

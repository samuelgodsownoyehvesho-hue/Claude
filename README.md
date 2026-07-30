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

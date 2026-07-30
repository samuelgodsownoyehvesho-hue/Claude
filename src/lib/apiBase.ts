// Base URL for the Express API (transcription, transcoding, AI styling, Spotify search).
// In production this points at the Railway-hosted backend; in local dev it's empty
// (relative paths), since the Vite dev server proxies /api to the same-origin server.
export const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

import React, { useState } from "react";
import { VideoConfig, ColorPalette, FontOption, Template, LyricLine } from "../types";
import { API_BASE } from "../lib/apiBase";
import { FONTS, PALETTES } from "../templates";
import { 
  Sliders, Palette, Type, HelpCircle, LayoutGrid, 
  Settings2, Sparkles, Activity, Monitor, Smartphone, 
  Square, Eye, Film, Disc, Upload, Loader2, AlertTriangle,
  Search, Music
} from "lucide-react";

interface VisualSettingsProps {
  config: VideoConfig;
  onChangeConfig: (newConfig: Partial<VideoConfig>) => void;
  activeTemplate: Template;
  lyrics: LyricLine[];
}

const ANIMATION_STYLES = [
  { id: "progressive-wipe", name: "Progressive Wipe" },
  { id: "horizontal-slide-stack", name: "KinetiSlide Stack" },
  { id: "glitch-shake", name: "Glitch Shake" },
  { id: "cinematic-blur-fade", name: "Cinematic Blur & Fade" },
  { id: "word-zoom-in", name: "Word Zoom In" },
  { id: "column-shift-up", name: "Column Shift Up" },
  { id: "character-bounce-type", name: "Typewriter Elastic" },
  { id: "digital-scramble", name: "Digital Scramble" },
  { id: "wave-bobbing", name: "Wave Bobbing" },
  { id: "skew-slash-slide", name: "Skew Slash Slide" },
  { id: "perspective-3d-scroll", name: "Space 3D Scroll" },
  { id: "elastic-pop", name: "Elastic Pop" },
  { id: "organic-liquid-draw", name: "Organic Liquid Underlay" },
  { id: "exposure-dissolve", name: "Exposure Dissolve" },
  { id: "strobe-center-pop", name: "Strobe Center Pop" },
  { id: "vertical-elevator-track", name: "Elevator Scroll" },
  { id: "erratic-grunge-shake", name: "Grunge Chaos Shake" },
  { id: "circular-helix-spin", name: "Circular Helix Spin" },
  { id: "arcade-pixel-flicker", name: "Arcade Pixel Flicker" },
  { id: "shimmer-golden-fades", name: "Shimmer Golden Shine" }
];

const BACKGROUND_EFFECTS = [
  { id: "static-grid", name: "Static Grid" },
  { id: "drifting-blobs", name: "Drifting Blobs" },
  { id: "synthwave-grid", name: "Synthwave Grid" },
  { id: "slow-bokeh", name: "Slow Bokeh" },
  { id: "audio-reactive-tunnel", name: "Reactive Tunnel" },
  { id: "waves", name: "Overlapping Waves" },
  { id: "terminal-matrix", name: "Terminal Matrix" },
  { id: "scanlines-noise", name: "Scanlines & Gray Grain" },
  { id: "sine-wave-particles", name: "Sine Wave Particles" },
  { id: "diagonal-stripes", name: "Diagonal Stripes" },
  { id: "starfield", name: "Warp Starfield" },
  { id: "confetti-drifting", name: "Drifting Confetti" },
  { id: "dynamic-lava-lamp", name: "Lava Lamp Blobs" },
  { id: "aurora-borealis", name: "Aurora Borealis" },
  { id: "radial-light-burst", name: "Radial Light Burst" },
  { id: "vignette-shadow", name: "Vignette Shadow" },
  { id: "half-tone-grit", name: "Halftone Dot Screen" },
  { id: "cosmic-particle-vortex", name: "Cosmic Particle Vortex" },
  { id: "pixelated-grid", name: "Pixelated Arcade Grid" },
  { id: "drifting-dust-motes", name: "Drifting Dust Motes" },
  { id: "dreamy-floating-vinyl", name: "CapCut spinning Vinyl" },
  { id: "cinema-player-hud", name: "CapCut Media HUD" },
  { id: "floating-album-badge", name: "TikTok Floating Album" }
];

const TEXT_STYLE_PRESETS = [
  { id: "default", name: "Default Flat", previewClass: "text-slate-100" },
  { id: "glow", name: "Aura Glow", previewClass: "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] font-semibold" },
  { id: "outline", name: "Retro Outline", previewClass: "text-amber-300 [text-shadow:-1.5px_-1.5px_0_#0f172a,1.5px_-1.5px_0_#0f172a,-1.5px_1.5px_0_#0f172a,1.5px_1.5px_0_#0f172a]" },
  { id: "neon", name: "Laser Neon", previewClass: "text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)] underline" },
  { id: "shadow", name: "Cinema Shadow", previewClass: "text-white [text-shadow:2px_3px_5px_rgba(0,0,0,0.8)]" },
  { id: "bubble", name: "Comic Bubble", previewClass: "bg-slate-850 px-2 py-0.5 rounded text-indigo-300 text-[11px] font-bold border border-indigo-500/30" }
];

const VIDEO_FILTERS = [
  { id: "none", name: "No Filter Overlay" },
  { id: "rgb-glitch", name: "RGB Aberration Glitch" },
  { id: "film-grain", name: "80s Film Grain & Scratches" },
  { id: "vhs", name: "Retro CRT VHS Lines" },
  { id: "light-leak", name: "Dreamy Camera Light Leaks" },
  { id: "vignette", name: "Cinema Focused Vignette" }
];

export default function VisualSettings({
  config,
  onChangeConfig,
  activeTemplate,
  lyrics,
}: VisualSettingsProps) {
  const currentPalette = PALETTES.find((p) => p.id === config.customPaletteId) || activeTemplate.palette;
  const currentFont = FONTS.find((f) => f.id === config.customFontId) || activeTemplate.font;

  const currentAspect = config.aspectRatio || "16:9";
  const currentStylePreset = config.textStylePreset || "default";
  const currentFilter = config.videoFilter || "none";

  // AI Feature States
  const [coPilotPrompt, setCoPilotPrompt] = useState("");
  const [isCoPilotLoading, setIsCoPilotLoading] = useState(false);
  const [coPilotError, setCoPilotError] = useState<string | null>(null);

  const [isArtLoading, setIsArtLoading] = useState(false);
  const [artStylePreset, setArtStylePreset] = useState("atmospheric digital art");
  const [artError, setArtError] = useState<string | null>(null);

  // Spotify Search & Autofill States
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [showSpotifySearch, setShowSpotifySearch] = useState(false);

  const handleSpotifySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotifyQuery.trim()) return;

    setIsSpotifyLoading(true);
    setSpotifyError(null);
    try {
      const response = await fetch(`${API_BASE}/api/spotify/search?q=${encodeURIComponent(spotifyQuery)}`);
      if (!response.ok) {
        let errMsg = "Failed to search Spotify";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      setSpotifyResults(data.tracks || []);
      if (!data.tracks || data.tracks.length === 0) {
        setSpotifyError("No tracks found on Spotify matching your query.");
      }
    } catch (err: any) {
      console.error(err);
      setSpotifyError(err.message || "An error occurred while searching Spotify.");
    } finally {
      setIsSpotifyLoading(false);
    }
  };

  const handleSelectSpotifyTrack = (track: any) => {
    onChangeConfig({
      songTitle: track.name,
      songArtist: track.artists,
      albumArtUrl: track.albumArtUrl || config.albumArtUrl
    });
    setShowSpotifySearch(false);
    setSpotifyQuery("");
    setSpotifyResults([]);
    setSpotifyError(null);
  };

  const handleApplyCoPilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coPilotPrompt.trim()) return;

    setIsCoPilotLoading(true);
    setCoPilotError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/fine-tune-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentConfig: config, prompt: coPilotPrompt })
      });

      if (!response.ok) {
        let errMsg = "Failed to fine-tune configuration";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const updatedFields = await response.json();
      onChangeConfig(updatedFields);
      setCoPilotPrompt("");
    } catch (err: any) {
      console.error(err);
      setCoPilotError(err.message || "An error occurred during style tuning.");
    } finally {
      setIsCoPilotLoading(false);
    }
  };

  const handleGenerateArtwork = async () => {
    if (!lyrics || lyrics.length === 0) {
      setArtError("No lyrics available to analyze for artwork generation.");
      return;
    }

    setIsArtLoading(true);
    setArtError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/generate-artwork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics,
          songTitle: config.songTitle,
          songArtist: config.songArtist,
          stylePreset: artStylePreset
        })
      });

      if (!response.ok) {
        let errMsg = "Failed to generate AI artwork";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      onChangeConfig({ albumArtUrl: data.imageUrl });
    } catch (err: any) {
      console.error(err);
      setArtError(err.message || "Failed to generate artwork. Make sure your API key is configured.");
    } finally {
      setIsArtLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 overflow-y-auto shadow-xl" id="styling-settings-sidebar">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <Settings2 className="w-5 h-5 text-indigo-400" />
        <h3 className="text-md font-semibold text-slate-100 font-sans tracking-tight">
          Visual Customization
        </h3>
      </div>

      {/* AI Style Co-Pilot Card */}
      <div className="mb-5 bg-gradient-to-br from-indigo-950/40 to-slate-950/40 border border-indigo-500/20 rounded-xl p-3 animate-fade-in" id="ai-style-copilot">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-indigo-300 tracking-wider uppercase font-mono">AI Style Co-Pilot</span>
        </div>
        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
          Describe the vibe you want, and the AI will auto-adjust fonts, palettes, backgrounds, and animations.
        </p>
        <form onSubmit={handleApplyCoPilot} className="flex gap-1.5">
          <input
            type="text"
            value={coPilotPrompt}
            onChange={(e) => setCoPilotPrompt(e.target.value)}
            placeholder="e.g. moody cyberpunk VHS style..."
            disabled={isCoPilotLoading}
            className="flex-1 text-[11px] bg-slate-950/80 border border-slate-800 focus:border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isCoPilotLoading || !coPilotPrompt.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1"
          >
            {isCoPilotLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "Apply"
            )}
          </button>
        </form>
        {coPilotError && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-md p-2 mt-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
            <span className="flex-1 leading-normal">{coPilotError}</span>
          </div>
        )}
      </div>

      {/* NEW: Aspect Ratio Selector */}
      <div className="mb-5" id="aspect-ratio-selector">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block">
          Video Format Aspect Ratio
        </label>
        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800/60">
          {[
            { id: "16:9", label: "YouTube", desc: "16:9 Landscape", icon: Monitor },
            { id: "9:16", label: "TikTok", desc: "9:16 Vertical", icon: Smartphone },
            { id: "1:1", label: "Instagram", desc: "1:1 Square", icon: Square }
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = currentAspect === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeConfig({ aspectRatio: item.id as any })}
                className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  isSelected 
                    ? "bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 font-semibold" 
                    : "border border-transparent hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
                title={item.desc}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* NEW: Song & Album Metadata Branding */}
      <div className="mb-5 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 animate-fade-in" id="metadata-branding-settings">
        <label className="text-xs font-bold text-slate-300 tracking-wider uppercase font-mono mb-2.5 block flex items-center gap-1.5">
          <Disc className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: "5s" }} />
          Song Branding & Artwork
        </label>

        {/* Spotify Sync Section */}
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/40 pb-2.5">
          <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono flex items-center gap-1">
            <Music className="w-3 h-3 text-emerald-400" />
            Spotify Integration
          </span>
          <button
            type="button"
            onClick={() => setShowSpotifySearch(!showSpotifySearch)}
            className="text-[9px] font-extrabold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded cursor-pointer transition-all flex items-center gap-1"
          >
            <Search className="w-2.5 h-2.5" />
            {showSpotifySearch ? "Close Search" : "Search Spotify"}
          </button>
        </div>

        {/* Spotify Search Dropdown/Panel */}
        {showSpotifySearch && (
          <div className="bg-slate-950 rounded-lg p-2 mb-3.5 border border-emerald-500/10 animate-fade-in space-y-2">
            <form onSubmit={handleSpotifySearch} className="flex gap-1.5">
              <input
                type="text"
                value={spotifyQuery}
                onChange={(e) => setSpotifyQuery(e.target.value)}
                placeholder="Search track, artist..."
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-[11px] rounded px-2 py-1 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={isSpotifyLoading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 shrink-0 animate-pulse-subtle"
              >
                {isSpotifyLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Find
              </button>
            </form>

            {spotifyError && (
              <p className="text-[9px] text-rose-400 leading-snug px-1">{spotifyError}</p>
            )}

            {spotifyResults.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {spotifyResults.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleSelectSpotifyTrack(track)}
                    className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 p-1 rounded-lg flex items-center gap-2 text-left transition-all cursor-pointer group"
                  >
                    {track.albumArtUrl ? (
                      <img
                        src={track.albumArtUrl}
                        className="w-7 h-7 rounded object-cover shrink-0 border border-slate-800"
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Music className="w-3 h-3 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[9.5px] font-bold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {track.name}
                      </p>
                      <p className="text-[8.5px] text-slate-400 truncate">
                        {track.artists}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Title Input */}
        <div className="space-y-1 mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Song Title</span>
          <input
            type="text"
            value={config.songTitle || ""}
            placeholder="e.g., Midnight Memories"
            onChange={(e) => onChangeConfig({ songTitle: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Artist / Album Input */}
        <div className="space-y-1 mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Artist / Album</span>
          <input
            type="text"
            value={config.songArtist || ""}
            placeholder="e.g., The Midnight • Endless Summer"
            onChange={(e) => onChangeConfig({ songArtist: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Display Style */}
        <div className="space-y-1 mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Branding Display Style</span>
          <select
            value={config.metadataStyle || "cinematic-intro"}
            onChange={(e) => onChangeConfig({ metadataStyle: e.target.value as any })}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            <option value="none">None (Hidden)</option>
            <option value="cinematic-intro">Cinematic Intro Title Card</option>
            <option value="spinning-vinyl">TikTok Rotating Vinyl Badge</option>
            <option value="elegant-banner">Now Playing Sleek Bottom Banner</option>
          </select>
        </div>

        {/* Artwork Selector */}
        {config.metadataStyle !== "none" && (
          <div className="space-y-2 pt-1 border-t border-slate-800/40">
            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Album Art Customization</span>
            <div className="flex gap-2.5 items-center">
              {/* Cover Preview & Custom Upload Trigger */}
              <button
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        onChangeConfig({ albumArtUrl: event.target?.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                className="w-12 h-12 bg-slate-950 rounded-lg border border-slate-800 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-500 transition-colors shrink-0"
                title="Click to upload custom album artwork"
              >
                {config.albumArtUrl && config.albumArtUrl.startsWith("data:") ? (
                  <img src={config.albumArtUrl} className="w-full h-full object-cover" alt="Art" referrerPolicy="no-referrer" />
                ) : config.albumArtUrl && config.albumArtUrl.startsWith("linear-gradient") ? (
                  <div className="w-full h-full" style={{ background: config.albumArtUrl }} />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-[7px] text-slate-500 mt-0.5">Upload</span>
                  </div>
                )}
              </button>

              {/* Gradient Art Presets */}
              <div className="flex-1">
                <span className="text-[8px] font-semibold text-slate-500 uppercase block mb-1">Preset Themes</span>
                <div className="flex gap-1">
                  {[
                    { id: "preset-mist", css: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)", label: "Mist" },
                    { id: "preset-sunset", css: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Sunset" },
                    { id: "preset-ocean", css: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", label: "Ocean" },
                    { id: "preset-cyber", css: "linear-gradient(135deg, #f35588 0%, #05dfd7 100%)", label: "Neon" }
                  ].map((preset) => {
                    const isSelected = config.albumArtUrl === preset.css;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onChangeConfig({ albumArtUrl: preset.css })}
                        className={`w-7 h-7 rounded border cursor-pointer transition-all ${
                          isSelected ? "border-indigo-400 scale-105 ring-1 ring-indigo-500/20" : "border-slate-800 hover:border-slate-700"
                        }`}
                        style={{ background: preset.css }}
                        title={`Select ${preset.label} gradient art`}
                      />
                    );
                  })}
                  {config.albumArtUrl && (
                    <button
                      type="button"
                      onClick={() => onChangeConfig({ albumArtUrl: "" })}
                      className="text-[8px] font-bold text-rose-400 hover:text-rose-300 ml-auto bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* AI Cover Art Generator (Optional) */}
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/40 bg-indigo-950/10 p-2.5 rounded-lg border border-indigo-500/10">
              <span className="text-[10px] font-bold text-indigo-300 uppercase font-mono block mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                AI Lyric Cover Art
              </span>
              <p className="text-[9px] text-slate-400 mb-2 leading-relaxed">
                Generate high-concept artwork custom-painted by AI based on your song's lyrics.
              </p>
              <div className="flex gap-1.5">
                <select
                  value={artStylePreset}
                  onChange={(e) => setArtStylePreset(e.target.value)}
                  disabled={isArtLoading}
                  className="flex-1 bg-slate-950 border border-slate-850 text-slate-300 text-[10px] rounded px-1.5 py-1 outline-none cursor-pointer focus:border-indigo-500/40"
                >
                  <option value="atmospheric digital art">Atmospheric Digital Art</option>
                  <option value="cyberpunk synthwave">Cyberpunk Synthwave</option>
                  <option value="watercolor splash">Watercolor Splash</option>
                  <option value="vintage oil painting">Vintage Oil Painting</option>
                  <option value="photorealistic cinematic">Cinematic Photo</option>
                  <option value="dreamy surrealism">Dreamy Surrealism</option>
                  <option value="flat vector minimalism">Vector Minimalist</option>
                </select>
                <button
                  type="button"
                  onClick={handleGenerateArtwork}
                  disabled={isArtLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                >
                  {isArtLoading ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
              {artError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-md p-2 mt-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                  <span className="flex-1 leading-normal">{artError}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1. Kinetic Text Animation Selector */}
      <div className="mb-5" id="animation-style-picker">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block flex items-center justify-between">
          <span>Kinetic Text Animation</span>
          <span className="text-[10px] text-indigo-400">Customized</span>
        </label>
        <select
          value={config.textAnimation}
          onChange={(e) => onChangeConfig({ textAnimation: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
        >
          {ANIMATION_STYLES.map((anim) => (
            <option key={anim.id} value={anim.id}>
              {anim.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Background Effect Selector */}
      <div className="mb-5" id="background-effect-picker">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block">
          Background Scene Effect
        </label>
        <select
          value={config.backgroundEffect}
          onChange={(e) => onChangeConfig({ backgroundEffect: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
        >
          {BACKGROUND_EFFECTS.map((bg) => (
            <option key={bg.id} value={bg.id}>
              {bg.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Typography Font Options */}
      <div className="mb-5" id="font-family-picker">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            Font Family Choice
          </label>
          <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
            {currentFont.category}
          </span>
        </div>
        <select
          value={config.customFontId}
          onChange={(e) => onChangeConfig({ customFontId: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer mb-2.5"
        >
          {FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name} ({font.category})
            </option>
          ))}
        </select>

        {/* Font Size Adjuster */}
        <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/60" id="font-size-adjuster">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium font-sans">Font Scale Scale</span>
            <span className="text-indigo-400 font-mono font-bold">{(config.fontSizeMultiplier * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={config.fontSizeMultiplier}
            onChange={(e) => onChangeConfig({ fontSizeMultiplier: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
          />
        </div>
      </div>

      {/* NEW: CapCut Subtitle Text Design Presets */}
      <div className="mb-5" id="subtitle-style-presets">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          CapCut Text Design Presets
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
          {TEXT_STYLE_PRESETS.map((style) => {
            const isSelected = currentStylePreset === style.id;
            return (
              <button
                key={style.id}
                onClick={() => onChangeConfig({ textStylePreset: style.id as any })}
                className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-[52px] transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-slate-850 border-indigo-500 ring-1 ring-indigo-500/10"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <span className="text-[10px] font-bold text-slate-400">
                  {style.name}
                </span>
                <span className={`text-xs block font-sans truncate ${style.previewClass}`}>
                  Aa Lyrics
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Swatch Color Palette Selection */}
      <div className="mb-5" id="color-palette-picker">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-indigo-400" />
          Mood Color Palette
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1" id="color-palette-swatches">
          {PALETTES.map((pal) => {
            const isSelected = pal.id === config.customPaletteId;
            return (
              <button
                key={pal.id}
                onClick={() => onChangeConfig({ customPaletteId: pal.id })}
                className={`p-2 rounded-lg border text-left flex flex-col gap-1.5 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-slate-850 border-indigo-500 ring-1 ring-indigo-500/20"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <span className="text-[10px] font-bold text-slate-300 truncate w-full">
                  {pal.name}
                </span>
                <div className="flex w-full h-3 rounded overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: pal.bg }} />
                  <div className="flex-1" style={{ backgroundColor: pal.text }} />
                  <div className="flex-1" style={{ backgroundColor: pal.active }} />
                  <div className="flex-1" style={{ backgroundColor: pal.accent }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* NEW: CapCut Cinematic Filters Selector */}
      <div className="mb-5" id="video-filter-picker">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-indigo-400" />
          Cinematic Video Filters
        </label>
        <select
          value={currentFilter}
          onChange={(e) => onChangeConfig({ videoFilter: e.target.value as any })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
        >
          {VIDEO_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Toggles & Extra Settings */}
      <div className="mt-auto pt-3 border-t border-slate-800" id="extra-settings">
        <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2.5 block">
          Auxiliary Visuals
        </label>
        <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Waveform Overlay</span>
              <span className="text-[10px] text-slate-500">Draw organic audio beats</span>
            </div>
          </div>
          <button
            onClick={() => onChangeConfig({ showWaveform: !config.showWaveform })}
            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${
              config.showWaveform ? "bg-emerald-500" : "bg-slate-800"
            }`}
          >
            <div
              className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                config.showWaveform ? "translate-x-4.5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, Pause, RotateCcw, Volume2, Sparkles, HelpCircle, 
  Settings, Layers, Music, Eye, RefreshCw, LayoutTemplate,
  ChevronRight, AlignCenter, Flame, Maximize2, LogOut, AlertTriangle,
  Cloud, CloudOff, Menu, X, Clock, User, ShieldCheck
} from "lucide-react";

import { LyricLine, VideoConfig, Template } from "./types";
import { TEMPLATES, PALETTES, FONTS } from "./templates";
import { drawLyrics, BackgroundState } from "./utils/canvasRenderer";

// Import custom dashboard sub-components
import AudioUploader from "./components/AudioUploader";
import TemplateSelector from "./components/TemplateSelector";
import VisualSettings from "./components/VisualSettings";
import LyricEditor from "./components/LyricEditor";
import ExportPanel from "./components/ExportPanel";
import ExplorationPage from "./components/ExplorationPage";
import {
  supabase,
  saveProjectToCloud,
  loadProjectFromCloud,
  createUserProfileInCloud,
  signOut as supabaseSignOut,
} from "./lib/supabase";

export default function App() {
  // User Session state
  const [session, setSession] = useState<{
    isLoggedIn: boolean;
    provider: "google" | "spotify" | "email" | "phone" | "guest";
    name: string;
    emailOrPhone?: string;
    avatarUrl?: string;
    userId?: string;
  } | null>(() => {
    const saved = localStorage.getItem("lyricsync_session");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const handleStartSession = (newSession: {
    isLoggedIn: boolean;
    provider: "google" | "spotify" | "email" | "phone" | "guest";
    name: string;
    emailOrPhone?: string;
    avatarUrl?: string;
    userId?: string;
  }) => {
    setSession(newSession);
    localStorage.setItem("lyricsync_session", JSON.stringify(newSession));
  };

  // History and Hamburger menu drawer states
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [creationHistory, setCreationHistory] = useState<{
    id: string;
    songTitle: string;
    songArtist: string;
    templateName: string;
    timestamp: string;
    config: VideoConfig;
    lyrics: LyricLine[] | null;
    audioUrl: string | null;
  }[]>(() => {
    const saved = localStorage.getItem("lyricsync_creation_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: "demo-1",
        songTitle: "Midnight Mirage",
        songArtist: "The Midnight",
        templateName: "Apple Fluid Neon",
        timestamp: "Demo Sample",
        config: {
          resolution: "1080p",
          fps: 60,
          templateId: "apple-music-lyrics",
          customFontId: "outfit",
          customPaletteId: "vaporwave",
          backgroundEffect: "dynamic-lava-lamp",
          textAnimation: "cinematic-blur-fade",
          fontSizeMultiplier: 1.05,
          showWaveform: true,
          aspectRatio: "16:9",
          textStylePreset: "default",
          videoFilter: "none",
          songTitle: "Midnight Mirage",
          songArtist: "The Midnight",
          metadataStyle: "cinematic-intro",
          albumArtUrl: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          layoutMode: "kinetic",
        } as any,
        lyrics: [
          { text: "I can see the neon light in your eyes", startTime: 1.2, endTime: 4.8 },
          { text: "Wandering through the static paradise", startTime: 5.0, endTime: 9.5 }
        ],
        audioUrl: null
      }
    ];
  });

  const addToHistory = (songTitle: string, songArtist: string, templateName: string, audioUrl: string | null, configData: any, lyricsData: any) => {
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      songTitle: songTitle || "Untitled Project",
      songArtist: songArtist || "Unknown Artist",
      templateName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + new Date().toLocaleDateString(),
      config: configData,
      lyrics: lyricsData,
      audioUrl
    };
    setCreationHistory(prev => {
      const filtered = prev.filter(item => item.songTitle !== newItem.songTitle);
      const updated = [newItem, ...filtered].slice(0, 15);
      localStorage.setItem("lyricsync_creation_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSignOut = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    supabaseSignOut().catch((err) => console.error("Supabase sign out error:", err));

    setSession(null);
    localStorage.removeItem("lyricsync_session");
    setAudioUrl(null);
    setAudioFile(null);
    setLyrics(null);
    setWaveformPeaks([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setIsFallbackActive(false);
    setFallbackReason("");
    setActiveTab("templates");
  };

  useEffect(() => {
    // Derives a normalized app-level session object from a Supabase auth user,
    // covering Google OAuth, Spotify OAuth, and passwordless email OTP alike.
    const buildSessionFromSupabaseUser = (user: any): {
      isLoggedIn: boolean;
      provider: "google" | "spotify" | "email" | "phone" | "guest";
      name: string;
      emailOrPhone?: string;
      avatarUrl?: string;
      userId?: string;
    } => {
      const rawProvider = user.app_metadata?.provider || "email";
      const provider: "google" | "spotify" | "email" =
        rawProvider === "google" || rawProvider === "spotify" ? rawProvider : "email";

      const meta = user.user_metadata || {};
      const name =
        meta.full_name ||
        meta.name ||
        meta.user_name ||
        (user.email ? user.email.split("@")[0] : "Creator");
      const avatarUrl =
        meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;

      return {
        isLoggedIn: true,
        provider,
        name,
        emailOrPhone: user.email || "",
        avatarUrl,
        userId: user.id,
      };
    };

    // Restore any existing Supabase session on load
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const newSession = buildSessionFromSupabaseUser(data.session.user);
        createUserProfileInCloud(data.session.user.id, {
          name: newSession.name,
          email: newSession.emailOrPhone,
          avatarUrl: newSession.avatarUrl,
          provider: newSession.provider,
        });
        handleStartSession(newSession);
      } else {
        // Fallback: Check local guest sessions only
        const saved = localStorage.getItem("lyricsync_session");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.provider === "guest") {
              setSession(parsed);
            } else {
              setSession(null);
              localStorage.removeItem("lyricsync_session");
            }
          } catch (e) {
            setSession(null);
            localStorage.removeItem("lyricsync_session");
          }
        }
      }
    });

    // Listen for sign-in / sign-out / token refresh events (covers the
    // Google and Spotify OAuth redirect completions automatically)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSupabaseSession) => {
      if (event === "SIGNED_IN" && newSupabaseSession?.user) {
        const newSession = buildSessionFromSupabaseUser(newSupabaseSession.user);
        createUserProfileInCloud(newSupabaseSession.user.id, {
          name: newSession.name,
          email: newSession.emailOrPhone,
          avatarUrl: newSession.avatarUrl,
          provider: newSession.provider,
        });
        handleStartSession(newSession);

        // Re-apply a template that was selected right before an OAuth
        // redirect (Google/Spotify), since that full-page redirect would
        // otherwise have dropped the in-memory selection.
        const pendingTemplateId = localStorage.getItem("lyricsync_pending_template_id");
        if (pendingTemplateId) {
          const template = TEMPLATES.find((t) => t.id === pendingTemplateId);
          if (template) handleSelectTemplate(template);
          localStorage.removeItem("lyricsync_pending_template_id");
        }
      } else if (event === "SIGNED_OUT") {
        setSession((prev) => {
          if (prev?.provider === "guest") return prev;
          localStorage.removeItem("lyricsync_session");
          return null;
        });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Main app state
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [activeTab, setActiveTab] = useState<"templates" | "lyrics" | "style" | "export">("templates");
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");

  // Selected config details
  const [activeTemplate, setActiveTemplate] = useState<Template>(TEMPLATES[0]);
  const [config, setConfig] = useState<VideoConfig>({
    resolution: "1080p",
    fps: 60,
    templateId: TEMPLATES[0].id,
    customFontId: TEMPLATES[0].font.id,
    customPaletteId: TEMPLATES[0].palette.id,
    backgroundEffect: TEMPLATES[0].backgroundEffect,
    textAnimation: TEMPLATES[0].animationStyle,
    fontSizeMultiplier: 1.05,
    showWaveform: true,
    aspectRatio: "16:9",
    textStylePreset: "default",
    videoFilter: "none",
    songTitle: "Midnight Mirage",
    songArtist: "The Midnight • Nocturnal",
    metadataStyle: "cinematic-intro",
    albumArtUrl: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    layoutMode: "kinetic",
  });

  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  // Load saved project from Supabase on login
  useEffect(() => {
    const checkAndLoad = async () => {
      if (session && session.isLoggedIn && session.provider !== "guest" && session.userId) {
        setSyncStatus("syncing");
        try {
          const savedData = await loadProjectFromCloud(session.userId);
          if (savedData) {
            if (savedData.config) setConfig((prev) => ({ ...prev, ...savedData.config }));
            if (savedData.lyrics) setLyrics(savedData.lyrics);
            if (savedData.audioUrl) setAudioUrl(savedData.audioUrl);
            if (savedData.waveformPeaks) setWaveformPeaks(savedData.waveformPeaks);
            setSyncStatus("synced");
            setTimeout(() => setSyncStatus("idle"), 2000);
          } else {
            setSyncStatus("idle");
          }
        } catch (e) {
          setSyncStatus("error");
        }
      }
    };
    checkAndLoad();
  }, [session]);

  // Auto-save changes to Supabase
  useEffect(() => {
    if (!session || !session.isLoggedIn || session.provider === "guest" || !session.userId) return;
    if (!lyrics && !audioUrl) return; // don't sync empty initial state

    const timer = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        await saveProjectToCloud(session.userId as string, {
          config,
          lyrics,
          audioUrl,
          waveformPeaks
        });
        setSyncStatus("synced");
        setTimeout(() => setSyncStatus("idle"), 2500);
      } catch (e) {
        setSyncStatus("error");
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [lyrics, config, audioUrl, waveformPeaks, session]);

  // Refs for audio and live player canvas
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const bgStateRef = useRef<BackgroundState>(new BackgroundState());

  // Set selected template
  const handleSelectTemplate = (template: Template) => {
    setActiveTemplate(template);
    setConfig((prev) => ({
      ...prev,
      templateId: template.id,
      customFontId: template.font.id,
      customPaletteId: template.palette.id,
      backgroundEffect: template.backgroundEffect,
      textAnimation: template.animationStyle,
      layoutMode: template.id === "framed-poster" ? "framed-poster" : template.id === "player-card" ? "player-card" : "kinetic",
    }));
  };

  // Sync state config changes
  const handleChangeConfig = (newConfig: Partial<VideoConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  // Upload/Transcription completion handler
  const handleUploadSuccess = (url: string, file: File, newLyrics: LyricLine[], isFallback?: boolean, reason?: string) => {
    setAudioUrl(url);
    setAudioFile(file);
    setLyrics(newLyrics);
    setIsPlaying(false);
    setCurrentTime(0);
    setIsFallbackActive(!!isFallback);
    setFallbackReason(reason || "");
    
    // Save to creation history
    const songName = file ? file.name.replace(/\.[^/.]+$/, "") : "Synchronized Lyric Video";
    addToHistory(songName, session?.name || "Local Creator", activeTemplate.name, url, config, newLyrics);

    // Switch to lyrics tab immediately
    setActiveTab("lyrics");
  };

  // Volume slider sync
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = volume;
    }
  }, [volume]);

  // Real-time canvas drawing loops for preview player
  const drawPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const w = canvas.width;
      const h = canvas.height;
      const time = audioElementRef.current?.currentTime || currentTime;

      const palette = PALETTES.find((p) => p.id === config.customPaletteId) || activeTemplate.palette;

      // Draw active background
      bgStateRef.current.draw(ctx, time, w, h, config.backgroundEffect, palette, config);

      // Draw active kinetic lyrics overlays
      if (lyrics) {
        drawLyrics(ctx, time, lyrics, w, h, config, activeTemplate, waveformPeaks);
      } else {
        // Welcome placeholder message before track upload
        ctx.fillStyle = `${palette.active}25`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `italic 500 ${Math.floor(w * 0.035)}px 'Space Grotesk', sans-serif`;
        ctx.fillText("Upload audio to generate lyric synchronized visuals", w / 2, h / 2);
      }
    } catch (err) {
      console.error("Error drawing canvas preview:", err);
    }

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(drawPreview);
    }
  };

  // Trigger preview update when status shifts
  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(drawPreview);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      drawPreview(); // Draw once while paused
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, lyrics, config, activeTemplate, currentTime]);

  // HTML Audio listeners
  const handleTimeUpdate = () => {
    if (audioElementRef.current) {
      setCurrentTime(audioElementRef.current.currentTime);
    }
  };

  const handleAudioLoaded = () => {
    if (audioElementRef.current) {
      setDuration(audioElementRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
    }
  };

  const togglePlay = () => {
    if (!audioUrl) return;
    const audio = audioElementRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
    }
    setCurrentTime(time);
    drawPreview();
  };

  const resetProject = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setAudioUrl(null);
    setAudioFile(null);
    setLyrics(null);
    setWaveformPeaks([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setIsFallbackActive(false);
    setFallbackReason("");
    setActiveTab("templates");
  };

  if (!session) {
    return (
      <ExplorationPage
        onStartSession={handleStartSession}
        onApplyTemplate={handleSelectTemplate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white" id="main-workspace-root">
      {/* 1. Header Area */}
      <header className="bg-slate-900/40 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md" id="header-navbar">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Flame className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-md font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
              KINETIC LYRIC VIDEO BUILDER
              <span className="text-[10px] font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full">
                4K PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium font-sans">
              Automated Whisper Transcription • 60FPS Render Pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3" id="header-user-controls">
          <button
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="p-2 px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
            title="View History & Profile"
            id="hamburger-menu-btn"
          >
            <Menu className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-bold hidden sm:inline text-slate-200">Library & Profile</span>
          </button>

          {audioUrl && (
            <button
              onClick={resetProject}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-rose-500/30 hover:bg-rose-500/5 text-slate-300 hover:text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Track
            </button>
          )}

          {/* Cloud Sync Status Badge */}
          {session && session.provider !== "guest" && (
            <div 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                syncStatus === "syncing"
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                  : syncStatus === "synced"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : syncStatus === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-slate-900 border-slate-800 text-slate-500"
              }`}
              title={
                syncStatus === "syncing"
                  ? "Saving workspace to secure Firestore cloud..."
                  : syncStatus === "synced"
                  ? "All workspace changes saved to Cloud"
                  : syncStatus === "error"
                  ? "Cloud sync error"
                  : "Workspace connected to Firestore"
              }
            >
              <Cloud className={`w-3.5 h-3.5 ${syncStatus === "syncing" ? "animate-pulse" : ""}`} />
              <span className="hidden md:inline">
                {syncStatus === "syncing" ? "Saving..." : syncStatus === "synced" ? "Saved" : syncStatus === "error" ? "Offline" : "Synced"}
              </span>
            </div>
          )}

          {/* Connected Creator Profile badge */}
          {session && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800/80" id="session-badge-container">
              <div className="flex items-center gap-2.5 bg-slate-950 border border-slate-800/80 px-3 py-1.5 rounded-xl shadow-inner">
                {session.avatarUrl ? (
                  <img
                    src={session.avatarUrl}
                    alt={session.name}
                    className="w-5 h-5 rounded-md object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-md flex items-center justify-center font-bold text-[10px] text-white">
                    {session.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <span className="text-[11px] font-bold text-slate-200 block truncate max-w-[110px]" title={session.name}>
                    {session.name}
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest block font-bold leading-none mt-0.5">
                    {session.provider}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="p-2 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl cursor-pointer transition-all"
                title="Disconnect Account"
                id="sign-out-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Guest Session Banner Notice */}
      {session && session.provider === "guest" && (
        <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-6 py-2.5 flex items-center justify-between gap-4 text-indigo-200 text-xs z-40 relative shadow-sm" id="guest-session-notice">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>
              <strong>Guest Session Active:</strong> Your creation history and synced lyric timing data will not be persisted when you close this window.
            </span>
          </div>
          <button 
            onClick={handleSignOut}
            className="text-indigo-400 hover:text-indigo-300 font-bold px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg cursor-pointer transition-all text-[10px] uppercase tracking-wider"
          >
            Connect Account
          </button>
        </div>
      )}

      {/* Fallback Banner Notice */}
      {isFallbackActive && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-200 text-xs z-40 relative" id="fallback-banner-notice">
          <div className="flex items-start gap-3.5">
            <span className="p-1.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase font-mono text-[9px] mt-0.5 whitespace-nowrap tracking-wide border border-amber-500/20 shadow-sm shadow-amber-500/5">
              API Fallback Active
            </span>
            <div className="font-sans leading-relaxed">
              <p className="font-semibold text-amber-300">
                The AI transcription service experienced an issue, but we've successfully loaded an editable timeline template for you!
              </p>
              <p className="opacity-80 mt-1">
                You can start customizing, styling, and editing your lyrics right away using the editor tabs without any delay.
              </p>
              {fallbackReason && (
                <p className="font-mono text-[10px] text-amber-400/90 mt-2 bg-slate-950/80 border border-amber-500/10 px-2.5 py-1 rounded-md inline-block max-w-full overflow-x-auto">
                  Reason: {fallbackReason}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={() => setIsFallbackActive(false)}
            className="self-end sm:self-center text-amber-400 hover:text-amber-300 font-bold px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 rounded-lg cursor-pointer transition-all shrink-0 font-mono text-[10px] uppercase tracking-wider shadow-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Dashboard Panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden" id="dashboard-layout">
        {/* Left Side: Dynamic Preview Canvas & Media controls (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-4 h-full" id="left-player-side">
          
          {/* Audio Tag */}
          {audioUrl && (
            <audio
              ref={audioElementRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleAudioLoaded}
              onEnded={handleAudioEnded}
              className="hidden"
              id="hidden-audio-node"
            />
          )}

          {/* Live Preview Container Card */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800/80 p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden flex-1 min-h-[300px] md:min-h-[440px]" id="preview-panel-card">
            {/* Absolute Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2 z-10">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-300 font-sans">
                  Real-time Kinetic Render Preview
                </span>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-950/50 border border-indigo-900 px-2 py-0.5 rounded">
                Previewing {config.aspectRatio || "16:9"} Aspect
              </span>
            </div>

            {/* Live Responsive Canvas Canvas */}
            <div className={`relative flex-1 flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 shadow-inner group max-h-[380px] mx-auto w-full transition-all duration-300 ${config.aspectRatio === "9:16" ? "max-w-[214px] h-[380px] aspect-[9/16]" : config.aspectRatio === "1:1" ? "max-w-[380px] h-[380px] aspect-square" : "max-w-[640px] aspect-video"}`} id="canvas-aspect-wrapper">
              <canvas
                ref={previewCanvasRef}
                width={config.aspectRatio === "9:16" ? 720 : config.aspectRatio === "1:1" ? 1080 : 1280}
                height={config.aspectRatio === "9:16" ? 1280 : config.aspectRatio === "1:1" ? 1080 : 720}
                className="w-full h-full object-contain"
                id="preview-canvas-render-target"
              />
              
              {!audioUrl && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3 animate-bounce">
                    <Music className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">
                    No Audio Loaded
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-normal">
                    Upload your audio track in the right panel to initialize Whisper AI synchronization.
                  </p>
                </div>
              )}
            </div>

            {/* Media playback controller bar */}
            {audioUrl && (
              <div className="mt-4 pt-3 border-t border-slate-800/60 z-10" id="canvas-playback-controls">
                {/* Timeline slider progress scrubber */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-mono text-slate-400 w-10">
                    {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, "0")}
                  </span>
                  
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.05"
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none hover:bg-slate-700 transition-colors"
                  />

                  <span className="text-[10px] font-mono text-slate-400 w-10 text-right">
                    {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  {/* Control buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/10 cursor-pointer transition-all"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>

                    <button
                      onClick={() => handleSeek(0)}
                      className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl cursor-pointer transition-colors"
                      title="Rewind to start"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Volume controls */}
                  <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 px-3 rounded-xl border border-slate-800/40">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-16 accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded appearance-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Tabbed Settings Control Room (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col h-full gap-4" id="right-control-side">
          
          {/* Dynamic control tabs */}
          {lyrics ? (
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 shadow-md" id="control-tabs">
              {(["templates", "lyrics", "style", "export"] as const).map((tab) => {
                const isActive = tab === activeTab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 text-xs py-2 px-2.5 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                      isActive
                        ? "bg-slate-800 text-indigo-400 shadow-sm border border-slate-700/60"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 shadow-md flex items-center justify-center text-xs text-indigo-300 font-semibold gap-1.5" id="control-tab-disabled-placeholder">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Upload Audio to Unlock Sync Room
            </div>
          )}

          {/* Tab Content Canvas Container */}
          <div className="flex-1 min-h-[380px]" id="control-room-tabs-content">
            <AnimatePresence mode="wait">
              {!lyrics ? (
                // 1. Initial State: Upload Panel
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="h-full"
                >
                  <AudioUploader onUploadSuccess={handleUploadSuccess} />
                </motion.div>
              ) : (
                // 2. Tabbed States
                <>
                  {activeTab === "templates" && (
                    <motion.div
                      key="templates"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <TemplateSelector
                        selectedTemplateId={config.templateId}
                        onSelectTemplate={handleSelectTemplate}
                      />
                    </motion.div>
                  )}

                  {activeTab === "lyrics" && (
                    <motion.div
                      key="lyrics"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <LyricEditor
                        lyrics={lyrics}
                        currentTime={currentTime}
                        onUpdateLyrics={setLyrics}
                        onSeek={handleSeek}
                        audioUrl={audioUrl}
                        audioFile={audioFile}
                        onUpdateWaveformPeaks={setWaveformPeaks}
                      />
                    </motion.div>
                  )}

                  {activeTab === "style" && (
                    <motion.div
                      key="style"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <VisualSettings
                        config={config}
                        onChangeConfig={handleChangeConfig}
                        activeTemplate={activeTemplate}
                        lyrics={lyrics || []}
                      />
                    </motion.div>
                  )}

                  {activeTab === "export" && (
                    <motion.div
                      key="export"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <ExportPanel
                        config={config}
                        onChangeConfig={handleChangeConfig}
                        lyrics={lyrics}
                        audioUrl={audioUrl}
                        audioElementRef={audioElementRef}
                        activeTemplate={activeTemplate}
                        waveformPeaks={waveformPeaks}
                      />
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* 9. Hamburger Sliding Sidebar: History & Profile */}
      <AnimatePresence>
        {isHistoryDrawerOpen && session && (
          <div className="fixed inset-0 z-50 flex justify-end" id="history-drawer-overlay">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
 
            {/* Sidebar content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto z-10"
              id="history-drawer-panel"
            >
              {/* Header */}
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Menu className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-extrabold text-white tracking-tight">Creator Space</h3>
                  </div>
                  <button
                    onClick={() => setIsHistoryDrawerOpen(false)}
                    className="p-1.5 bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
 
                {/* Profile Section */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden" id="drawer-profile-section">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center gap-4">
                    {session.avatarUrl ? (
                      <img
                        src={session.avatarUrl}
                        alt={session.name}
                        className="w-14 h-14 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center font-black text-lg text-white ring-2 ring-indigo-500/20 shadow-md">
                        {session.name ? session.name.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-mono text-indigo-400 tracking-wider font-bold uppercase block">
                        Active Creator Profile
                      </span>
                      <h4 className="text-base font-extrabold text-white truncate animate-pulse" title={session.name}>
                        {session.name}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {session.emailOrPhone || "guest@lyricsync.ai"}
                      </p>
                    </div>
                  </div>
 
                  <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Authentication Type</span>
                    <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {session.provider}
                    </span>
                  </div>
                </div>

                {/* Saved Workspace / Project History List */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      Saved & Creation History
                    </h5>
                    <span className="text-[9px] font-mono text-slate-500">{creationHistory.length} items</span>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-[365px] overflow-y-auto pr-1" id="history-items-container">
                    {creationHistory.length === 0 ? (
                      <div className="text-center p-8 bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl">
                        <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-medium">No projects in history yet</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">Upload any audio track to start logging creations.</p>
                      </div>
                    ) : (
                      creationHistory.map((item) => (
                        <div
                          key={item.id}
                          className="group bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 p-3.5 rounded-xl transition-all hover:bg-indigo-500/5 text-left relative flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-mono text-slate-500 block">{item.timestamp}</span>
                              <h6 className="text-xs font-extrabold text-white truncate mt-0.5 group-hover:text-indigo-300 transition-colors">
                                {item.songTitle}
                              </h6>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {item.songArtist}
                              </p>
                            </div>
                            <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                              {item.templateName}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-850 pt-2">
                            <span className="text-[9px] font-mono text-indigo-400 font-semibold">
                              {item.lyrics ? `${item.lyrics.length} synced lines` : "no timing lines"}
                            </span>
                            <button
                              onClick={() => {
                                if (item.lyrics) setLyrics(item.lyrics);
                                if (item.audioUrl) setAudioUrl(item.audioUrl);
                                setConfig(item.config);
                                setIsHistoryDrawerOpen(false);
                              }}
                              className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                            >
                              Load Workspace
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-bold text-xs py-3 rounded-xl cursor-pointer transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

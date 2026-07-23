import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, Sparkles, Flame, ArrowRight, Mail, 
  LogIn, Lock, Check, ShieldAlert, Heart, Users, Compass, Laptop, 
  Video, Radio, Globe, Search, RefreshCw, Key, ShieldCheck, UserCheck, 
  Music, Eye, Sliders, Film, LayoutTemplate
} from "lucide-react";
import { Template } from "../types";
import { TEMPLATES } from "../templates";
import {
  signInWithGoogle,
  signInWithSpotify,
  sendEmailOtp,
  verifyEmailOtp,
  supabase,
  createUserProfileInCloud,
} from "../lib/supabase";

interface ExplorationPageProps {
  onStartSession: (session: {
    isLoggedIn: boolean;
    provider: "google" | "spotify" | "email" | "phone" | "guest";
    name: string;
    emailOrPhone?: string;
    avatarUrl?: string;
    userId?: string;
  }) => void;
  onApplyTemplate: (template: Template) => void;
}

export default function ExplorationPage({ onStartSession, onApplyTemplate }: ExplorationPageProps) {
  // Navigation & filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMethod, setAuthMethod] = useState<"none" | "email">("none");
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);

  // Email form states (Unified Passwordless Flow)
  const [emailStep, setEmailStep] = useState<"email" | "code" | "name">("email");
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [emailName, setEmailName] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Visual effects
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState<number>(0);

  // Get categories
  const categories = ["All", "Claude", "Kinetic", "Social Platform", "Retro", "Standard", "Flow", "Elegant"];

  // Filter templates
  const filteredTemplates = TEMPLATES.filter(t => {
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Animating simulated visualizer for the bento box
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const barsCount = 35;
      const spacing = w / barsCount;

      ctx.fillStyle = "rgba(99, 102, 241, 0.1)"; // faint indigo shadow
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < barsCount; i++) {
        const offset = i * 0.15;
        const amplitude = 0.35 + 0.6 * Math.sin(time * 0.08 + offset) * Math.cos(time * 0.03 - offset * 0.5);
        const barH = Math.max(4, amplitude * h * 0.75);
        const barW = spacing * 0.65;
        const x = i * spacing + (spacing - barW) / 2;
        const y = (h - barH) / 2;

        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, "#f97316"); // orange
        grad.addColorStop(0.5, "#a855f7"); // purple
        grad.addColorStop(1, "#3b82f6"); // blue

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fill();
      }

      time += 0.8;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Handle template card selection
  const handleTemplateClick = (template: Template) => {
    setPendingTemplate(template);
    setShowAuthModal(true);
    setAuthMethod("none");
  };

  // Generic direct session triggers (Guest / Google)
  const loginAsGuest = () => {
    onStartSession({
      isLoggedIn: true,
      provider: "guest",
      name: "Guest Creator",
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=guest-${Date.now()}`
    });
    if (pendingTemplate) {
      onApplyTemplate(pendingTemplate);
    }
  };

  const stashPendingTemplate = () => {
    // OAuth sign-in triggers a full-page redirect, so component state (like
    // pendingTemplate) would otherwise be lost. Stash it so App.tsx can
    // re-apply it once the Supabase session comes back after redirect.
    if (pendingTemplate) {
      localStorage.setItem("lyricsync_pending_template_id", pendingTemplate.id);
    }
  };

  const loginWithGoogle = () => {
    stashPendingTemplate();
    signInWithGoogle();
  };

  const loginWithSpotify = () => {
    stashPendingTemplate();
    signInWithSpotify();
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      setEmailError("Email is required.");
      return;
    }

    setIsAuthLoading(true);
    setEmailError("");
    try {
      const { error } = await sendEmailOtp(email.trim());
      if (error) throw error;

      setEmailStep("code");
      setCooldown(60);
    } catch (err: any) {
      setEmailError(err.message || "Failed to send verification code. Please check details and try again.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setEmailError("Verification code is required.");
      return;
    }

    setIsAuthLoading(true);
    setEmailError("");
    try {
      const { data, error } = await verifyEmailOtp(email.trim(), code.trim());
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("Verification succeeded but no user was returned.");

      const hasName = !!(user.user_metadata?.name || user.user_metadata?.full_name);
      if (!hasName) {
        // First-time signup: ask for a display name before finishing.
        setEmailStep("name");
        return;
      }

      const name = user.user_metadata.name || user.user_metadata.full_name;
      const avatarUrl = user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;

      await createUserProfileInCloud(user.id, {
        name,
        email: user.email,
        avatarUrl,
        provider: "email",
      });

      onStartSession({
        isLoggedIn: true,
        provider: "email",
        name,
        emailOrPhone: user.email || "",
        avatarUrl,
        userId: user.id,
      });
      setShowAuthModal(false);
      if (pendingTemplate) {
        onApplyTemplate(pendingTemplate);
      }
    } catch (err: any) {
      setEmailError(err.message || "Invalid or expired code. Please try again.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFinishSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailName.trim()) {
      setEmailError("Name is required.");
      return;
    }

    setIsAuthLoading(true);
    setEmailError("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) throw new Error("Your session expired. Please try signing in again.");

      const finalName = emailName.trim();
      const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${finalName}`;

      const { error: updateErr } = await supabase.auth.updateUser({
        data: { name: finalName, avatar_url: avatarUrl },
      });
      if (updateErr) throw updateErr;

      await createUserProfileInCloud(user.id, {
        name: finalName,
        email: user.email,
        avatarUrl,
        provider: "email",
      });

      onStartSession({
        isLoggedIn: true,
        provider: "email",
        name: finalName,
        emailOrPhone: user.email || "",
        avatarUrl,
        userId: user.id,
      });
      setShowAuthModal(false);
      if (pendingTemplate) {
        onApplyTemplate(pendingTemplate);
      }
    } catch (err: any) {
      setEmailError(err.message || "Failed to finalize creator account.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col relative overflow-x-hidden selection:bg-indigo-500 selection:text-white" id="exploration-root">
      
      {/* 1. Dynamic Ambient Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[450px] h-[450px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />

      {/* 2. Top Minimal Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-900/60 z-30 relative" id="exploration-navbar">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 via-purple-500 to-orange-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Flame className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-white flex items-center gap-1.5 font-sans">
              LYRICSYNC AI
              <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Studio
              </span>
            </span>
          </div>
        </div>

        <button 
          onClick={() => {
            setPendingTemplate(null);
            setAuthMethod("none");
            setShowAuthModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-lg shadow-indigo-500/10 transition-all border border-indigo-400/20"
          id="nav-login-btn"
        >
          <LogIn className="w-3.5 h-3.5" />
          Connect Creator Account
        </button>
      </header>

      {/* 3. Hero Studio Stage */}
      <section className="max-w-7xl w-full mx-auto px-6 pt-16 pb-12 flex flex-col items-center text-center relative z-20" id="hero-banner-section">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Next-Gen Lyric Video Generator
          </span>

          <h1 className="text-4xl md:text-6xl font-black font-sans text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight leading-tight max-w-4xl">
            Transform Your Audio Into <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-orange-400 font-extrabold">
              Cinematic Lyric Masterpieces
            </span>
          </h1>

          <p className="text-sm md:text-md text-slate-400 max-w-2xl mt-6 leading-relaxed">
            Pioneer syllable-level sync with Whisper AI. Apply professional post-production filters, 
            choose dynamic layouts, and export gorgeous 4K videos in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
            <button
              onClick={() => {
                setPendingTemplate(TEMPLATES[0]);
                setShowAuthModal(true);
              }}
              className="group flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm px-7 py-3.5 rounded-2xl cursor-pointer shadow-xl shadow-indigo-500/10 transition-all transform hover:scale-[1.02]"
              id="hero-start-btn"
            >
              Start Generating Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={loginAsGuest}
              className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-sm px-6 py-3.5 rounded-2xl cursor-pointer transition-colors"
              id="hero-guest-btn"
            >
              Enter as Guest (No Save)
            </button>
          </div>
        </motion.div>
      </section>

      {/* 4. Bento Box Interactive Features Matrix */}
      <section className="max-w-7xl w-full mx-auto px-6 py-12" id="features-bento-grid">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-8 flex items-center gap-2 font-sans">
          <Sliders className="w-5 h-5 text-indigo-400" />
          Pro-Grade Creation Suite
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Card 1: Whisper AI Speech-To-Text (6 Columns) */}
          <div className="md:col-span-6 bg-gradient-to-b from-slate-900/80 to-slate-950/80 rounded-3xl border border-slate-900/80 p-6 flex flex-col justify-between overflow-hidden relative group hover:border-slate-800/80 transition-all">
            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
            
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-sans mb-2">Whisper AI Timing Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                Industry-leading Whisper vocal alignment algorithms map lyrics down to the exact millisecond. Simply upload and watch your pacing align instantly.
              </p>
            </div>

            {/* Interactive alignment timeline simulation */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-900 mt-6 font-mono text-[10px]">
              <div className="flex justify-between text-slate-500 border-b border-slate-900 pb-1.5 mb-2">
                <span>Vocal Segments</span>
                <span className="text-indigo-400 animate-pulse">● Aligned (100%)</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">0:04</span>
                  <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 flex-1">
                    "Searching for a midnight mirage..."
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">0:08</span>
                  <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 flex-1">
                    "Looking through the neon sparks..."
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Audio Waveform Reactivity (6 Columns) */}
          <div className="md:col-span-6 bg-gradient-to-b from-slate-900/80 to-slate-950/80 rounded-3xl border border-slate-900/80 p-6 flex flex-col justify-between overflow-hidden relative group hover:border-slate-800/80 transition-all">
            <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-500/10 transition-colors" />

            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
                <Music className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-sans mb-2">Reacting Waveform Dynamics</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                Extract high-precision peaks directly from the first channel of your audio tracks. Perfect horizontal player seekbars react seamlessly in real-time.
              </p>
            </div>

            {/* Simulated Live Visualizer Canvas */}
            <div className="mt-6 rounded-xl overflow-hidden border border-slate-900 bg-slate-950">
              <canvas 
                ref={visualizerCanvasRef} 
                width={300} 
                height={80} 
                className="w-full h-[80px]"
              />
            </div>
          </div>

          {/* Card 3: Cinematic Filters (4 Columns) */}
          <div className="md:col-span-4 bg-gradient-to-b from-slate-900/80 to-slate-950/80 rounded-3xl border border-slate-900/80 p-6 flex flex-col justify-between hover:border-slate-800/80 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Film className="w-5 h-5" />
              </div>
              <h3 className="text-md font-bold text-slate-100 font-sans mb-2">CapCut Cinematic Filters</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add retro film grain, authentic chromatic aberration glitching, VHS scanlines, soft glow vignettes, and organic light leaks.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-400">Vignette</span>
              <span className="text-[9px] bg-rose-950/20 border border-rose-900/40 px-2 py-1 rounded text-rose-400 font-semibold">CRT Glitch</span>
              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-400">Light Leak</span>
            </div>
          </div>

          {/* Card 4: Layout Mode (4 Columns) */}
          <div className="md:col-span-4 bg-gradient-to-b from-slate-900/80 to-slate-950/80 rounded-3xl border border-slate-900/80 p-6 flex flex-col justify-between hover:border-slate-800/80 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <LayoutTemplate className="w-5 h-5" />
              </div>
              <h3 className="text-md font-bold text-slate-100 font-sans mb-2">Multi-Layout Blueprints</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Switch effortlessly between classic Kinetic typography, sleek Framed Poster art showcases, and minimal Player Card designs.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-400">Kinetic</span>
              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-400">Poster</span>
              <span className="text-[9px] bg-emerald-950/20 border border-emerald-900/40 px-2 py-1 rounded text-emerald-400 font-semibold">Player Card</span>
            </div>
          </div>

          {/* Card 5: High FPS Export (4 Columns) */}
          <div className="md:col-span-4 bg-gradient-to-b from-slate-900/80 to-slate-950/80 rounded-3xl border border-slate-900/80 p-6 flex flex-col justify-between hover:border-slate-800/80 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-md font-bold text-slate-100 font-sans mb-2">WebM & MP4 60FPS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Export and download raw, high-framerate 1080p and portrait videos ready to post to TikTok, YouTube Shorts, and Reels instantly.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-400">1080p WebM</span>
              <span className="text-[9px] bg-purple-950/20 border border-purple-900/40 px-2 py-1 rounded text-purple-400 font-semibold">60 FPS Render</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Master Template Showcase & Gallery */}
      <section className="max-w-7xl w-full mx-auto px-6 py-12" id="template-showcase">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-sans">
              <LayoutTemplate className="w-5 h-5 text-indigo-400" />
              Explore Aesthetic Blueprints
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              Click any style to pre-apply the configuration and launch your workspace instantly.
            </p>
          </div>

          {/* Search inputs */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search blueprints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800/80 rounded-xl py-1.5 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-4 border-b border-slate-900/40 mb-8" id="category-tabs">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-4 py-2 rounded-xl font-semibold capitalize whitespace-nowrap cursor-pointer transition-all ${
                  isSelected
                    ? "bg-slate-800 text-indigo-400 border border-slate-700/60 shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Layout Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="templates-grid">
          {filteredTemplates.map((template) => {
            const pal = template.palette;
            return (
              <motion.div
                key={template.id}
                layoutId={`template-card-${template.id}`}
                className="bg-slate-900/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative group overflow-hidden hover:shadow-2xl transition-all"
              >
                {/* Background Accent glow */}
                <div 
                  className="absolute bottom-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-5 pointer-events-none"
                  style={{ backgroundColor: pal.accent }}
                />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-slate-950 text-slate-400 tracking-wider">
                      {template.category}
                    </span>
                    <div className="flex gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pal.bg }} title="Background" />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pal.text }} title="Text color" />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pal.active }} title="Active lyric" />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pal.accent }} title="Accent color" />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 font-sans group-hover:text-indigo-400 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    {template.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-900/60 flex items-center justify-between">
                  <div className="text-[10px] font-mono text-slate-500">
                    Font: <span className="text-slate-300">{template.font.name}</span>
                  </div>

                  <button
                    onClick={() => handleTemplateClick(template)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 group-hover:text-indigo-300 font-bold bg-indigo-500/5 hover:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/10 cursor-pointer transition-all"
                  >
                    Use Blueprint
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="bg-slate-900/20 border border-slate-900/60 p-12 text-center rounded-2xl max-w-lg mx-auto mt-6">
            <Search className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-300 mb-1">No blueprints found</h4>
            <p className="text-xs text-slate-500">
              Try typing another name or style category. We have many unique layouts.
            </p>
          </div>
        )}
      </section>

      {/* 6. Dynamic Customer Quotes & Social Proof */}
      <section className="max-w-7xl w-full mx-auto px-6 py-12 border-t border-slate-900/40" id="social-proof">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:pr-8">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-2">Creator Love</span>
            <h2 className="text-2xl font-bold tracking-tight text-white font-sans leading-snug">
              Loved by music artists, videographers, and content creators.
            </h2>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Ditch expensive video editing software. Build ready-to-post kinetic videos on a simple web dashboard.
            </p>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-slate-900/30 border border-slate-900/80 p-5 rounded-2xl">
              <div className="flex gap-1 mb-3">
                {Array(5).fill("★").map((star, i) => (
                  <span key={i} className="text-orange-400 text-xs">★</span>
                ))}
              </div>
              <p className="text-xs italic text-slate-300 leading-relaxed">
                "We synced a 4-minute metal track in less than 30 seconds. The character typewriter effect aligned perfectly with the rapid-fire vocals. Absolute game-changer!"
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                  JD
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-200">Julian Darko</span>
                  <span className="text-[10px] text-slate-500">Vocalist & Producer</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-900/80 p-5 rounded-2xl">
              <div className="flex gap-1 mb-3">
                {Array(5).fill("★").map((star, i) => (
                  <span key={i} className="text-orange-400 text-xs">★</span>
                ))}
              </div>
              <p className="text-xs italic text-slate-300 leading-relaxed">
                "I make lyrics videos for TikTok. Moving to LyricSync saved me hours of manually scrubbing keyframes. Highly recommend the Framed Poster template!"
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                  MC
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-200">Mia Croft</span>
                  <span className="text-[10px] text-slate-500">Independent Artist</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-slate-950 py-10 border-t border-slate-900/60 text-center relative z-20" id="exploration-footer">
        <p className="text-[11px] text-slate-600 font-mono">
          LyricSync AI Studio © 2026 • Whisper Speech Recognition Pipeline • Powered by Google AI Studio
        </p>
      </footer>

      {/* 8. Authentication & Connection Drawer Modal Overlay */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            id="auth-modal-backdrop"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 md:p-8 shadow-2xl relative flex flex-col gap-6 overflow-hidden"
              id="auth-modal-container"
            >
              {/* Background ambient blob */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthMethod("none");
                  setEmailError("");
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800/60 hover:border-slate-800 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors text-xs font-mono"
              >
                ×
              </button>

              <>
                {/* Title & info based on target blueprint */}
                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    <Flame className="w-5 h-5 text-indigo-400" />
                    Connect Creator Account
                  </h3>
                  {pendingTemplate ? (
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      You've selected <strong className="text-indigo-400">{pendingTemplate.name}</strong>. Sign in below to start customizing your video project.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1.5 leading-normal">
                      Sign in to unlock persistent database storage, saved timing presets, and unlimited MP4 exports.
                    </p>
                  )}
                </div>

                {/* Main Selector of Auth providers */}
                {authMethod === "none" && (
                  <div className="flex flex-col gap-4 animate-fade-in" id="auth-providers-list">
                    {/* Google Button */}
                    <button
                      onClick={loginWithGoogle}
                      disabled={isAuthLoading}
                      className="flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold py-3 px-4 rounded-xl cursor-pointer transition-all shadow-md"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Continue with Google
                    </button>

                    {/* Spotify Button */}
                    <button
                      onClick={loginWithSpotify}
                      disabled={isAuthLoading}
                      className="flex items-center justify-center gap-3 w-full bg-[#1DB954] hover:bg-[#1ed760] text-slate-950 text-xs font-bold py-3 px-4 rounded-xl cursor-pointer transition-all shadow-md"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.66-.66 13.32 1.56.42.24.6.78.42 1.26zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.72-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.3.421-1.02.599-1.559.3z"/>
                      </svg>
                      Continue with Spotify
                    </button>

                    <button
                      onClick={() => {
                        setAuthMethod("email");
                        setEmailError("");
                      }}
                      className="flex items-center justify-center gap-2.5 w-full bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 text-xs font-bold py-3 px-4 rounded-xl cursor-pointer transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Continue with Email
                    </button>

                    {emailError && (
                      <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-xl text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>{emailError}</span>
                      </div>
                    )}

                    <div className="flex items-center my-1">
                      <div className="flex-1 border-t border-slate-800" />
                      <span className="text-[10px] text-slate-500 font-mono px-3">OR</span>
                      <div className="flex-1 border-t border-slate-800" />
                    </div>

                    <div className="border-t border-slate-800/60 pt-2">
                      <button
                        onClick={loginAsGuest}
                        className="w-full flex items-center justify-between gap-2.5 bg-slate-950 border border-indigo-500/20 hover:border-indigo-500/40 p-3 rounded-xl text-left hover:bg-indigo-500/5 transition-all cursor-pointer"
                      >
                        <div>
                          <span className="text-xs font-bold text-indigo-300 block">Continue as Guest</span>
                          <span className="text-[10px] text-slate-500 leading-normal block">Your creation history won't be saved when you close the tab.</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-indigo-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Email Sign In & Sign Up split tabs view */}
                {authMethod === "email" && (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                      <button 
                        type="button"
                        onClick={() => {
                          setAuthMethod("none");
                          setEmailError("");
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        ← Other options
                      </button>
                      <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                        Email Access
                      </span>
                    </div>

                    {/* Unified passwordless signup/login flow */}
                    <div className="flex flex-col gap-4">
                      {emailStep === "email" && (
                        <form onSubmit={(e) => handleSendCode(e)} className="flex flex-col gap-3.5">
                          <p className="text-slate-400 text-xs">
                            Enter your email to sign in or register instantly. A verification code will be sent to your inbox.
                          </p>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                            <input
                              type="email"
                              required
                              placeholder="e.g. artist@lyricsync.ai"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>

                          {emailError && (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-xl text-xs mt-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                              <span className="break-all">{emailError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isAuthLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all mt-2 flex items-center justify-center gap-2"
                          >
                            {isAuthLoading ? (
                              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <>
                                <ArrowRight className="w-4 h-4" />
                                Continue
                              </>
                            )}
                          </button>
                        </form>
                      )}

                      {emailStep === "code" && (
                        <form onSubmit={handleVerifyCode} className="flex flex-col gap-3.5">
                          <p className="text-slate-400 text-xs">
                            We've sent a 6-digit confirmation code to <strong className="text-indigo-400">{email}</strong>.
                          </p>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">6-Digit Verification Code</label>
                            <input
                              type="text"
                              required
                              maxLength={6}
                              placeholder="Enter 6-digit code"
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-center font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 tracking-widest text-lg font-bold"
                            />
                          </div>

                          {emailError && (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-xl text-xs mt-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                              <span className="break-all">{emailError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isAuthLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all mt-2 flex items-center justify-center gap-2"
                          >
                            {isAuthLoading ? (
                              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4" />
                                Verify & Continue
                              </>
                            )}
                          </button>

                          <div className="flex items-center justify-between text-xs mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEmailStep("email");
                                setCode("");
                                setEmailError("");
                              }}
                              className="text-slate-400 hover:text-slate-200 transition-all font-semibold"
                            >
                              Back
                            </button>

                            <button
                              type="button"
                              disabled={cooldown > 0 || isAuthLoading}
                              onClick={() => handleSendCode()}
                              className={`transition-all font-semibold ${
                                cooldown > 0 ? "text-slate-600 cursor-not-allowed" : "text-indigo-400 hover:text-indigo-300 cursor-pointer"
                              }`}
                            >
                              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                            </button>
                          </div>
                        </form>
                      )}

                      {emailStep === "name" && (
                        <form onSubmit={handleFinishSignUp} className="flex flex-col gap-3.5">
                          <p className="text-slate-400 text-xs">
                            Welcome! Since this is your first time here, what should we call you?
                          </p>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Creator Display Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. DJ Sonic"
                              value={emailName}
                              onChange={(e) => setEmailName(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>

                          {emailError && (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-xl text-xs mt-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                              <span className="break-all">{emailError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isAuthLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all mt-2 flex items-center justify-center gap-2"
                          >
                            {isAuthLoading ? (
                              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4" />
                                Finish Setup & Enter
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div id="recaptcha-container" className="hidden"></div>
    </div>
  );
}

import { ColorPalette, FontOption, Template } from "./types";

export const FONTS: FontOption[] = [
  { id: "inter", name: "Inter", family: "'Inter', sans-serif", category: "sans" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', sans-serif", category: "display" },
  { id: "playfair-display", name: "Playfair Display", family: "'Playfair Display', serif", category: "serif" },
  { id: "jetbrains-mono", name: "JetBrains Mono", family: "'JetBrains Mono', monospace", category: "mono" },
  { id: "outfit", name: "Outfit", family: "'Outfit', sans-serif", category: "display" },
  { id: "syne", name: "Syne", family: "'Syne', sans-serif", category: "display" },
  { id: "bungee", name: "Bungee Block", family: "'Bungee', sans-serif", category: "display" },
  { id: "unbounded", name: "Unbounded Bold", family: "'Unbounded', sans-serif", category: "display" },
  { id: "cinzel", name: "Cinzel Classical", family: "'Cinzel', serif", category: "serif" },
  { id: "vt323", name: "VT323 Pixel", family: "'VT323', monospace", category: "mono" },
  { id: "righteous", name: "Righteous Pop", family: "'Righteous', sans-serif", category: "display" },
  { id: "special-elite", name: "Special Elite", family: "'Special Elite', monospace", category: "handwritten" },
  { id: "caveat", name: "Caveat Brush", family: "'Caveat', cursive", category: "handwritten" },
  { id: "archivo-black", name: "Archivo Black", family: "'Archivo Black', sans-serif", category: "display" },
  { id: "merriweather", name: "Merriweather", family: "'Merriweather', serif", category: "serif" },
  { id: "cabin-sketch", name: "Cabin Sketch", family: "'Cabin Sketch', cursive", category: "handwritten" },
  { id: "fira-code", name: "Fira Code", family: "'Fira Code', monospace", category: "mono" },
  { id: "lobster", name: "Lobster Script", family: "'Lobster', cursive", category: "handwritten" },
  { id: "syncopate", name: "Syncopate Wide", family: "'Syncopate', sans-serif", category: "display" },
  { id: "creepster", name: "Creepster Horror", family: "'Creepster', cursive", category: "display" }
];

export const PALETTES: ColorPalette[] = [
  { id: "monochrome", name: "Monochrome Slate", bg: "#0f172a", text: "#64748b", active: "#f8fafc", accent: "#38bdf8" },
  { id: "vaporwave", name: "Vaporwave Retro", bg: "#1a0b2e", text: "#9d4edd", active: "#ff007f", accent: "#00f0ff", gradient: ["#1a0b2e", "#240046"] },
  { id: "cyberpunk", name: "Cyberpunk Edge", bg: "#000000", text: "#7c7c7c", active: "#fefe00", accent: "#00ff66" },
  { id: "forest-warm", name: "Forest Amber", bg: "#141e17", text: "#6b8273", active: "#f5d061", accent: "#8eb69b" },
  { id: "sunset", name: "Golden Sunset", bg: "#1c0a13", text: "#d946ef", active: "#f97316", accent: "#facc15", gradient: ["#1c0a13", "#3b0764"] },
  { id: "editorial", name: "Editorial Cream", bg: "#fdfbf7", text: "#878682", active: "#1c1c1a", accent: "#9a3412" },
  { id: "ocean", name: "Deep Ocean", bg: "#021526", text: "#03346e", active: "#6eacda", accent: "#e2f1af" },
  { id: "nordic", name: "Nordic Minimal", bg: "#eceff1", text: "#90a4ae", active: "#263238", accent: "#00838f" },
  { id: "toxic", name: "Toxic Sludge", bg: "#070c0e", text: "#1b4d3e", active: "#39ff14", accent: "#00ff66" },
  { id: "berry", name: "Wild Berry", bg: "#2d0014", text: "#80003c", active: "#ff4d6d", accent: "#ff85a1" },
  { id: "mint", name: "Mint Fresh", bg: "#0b1c1e", text: "#336b68", active: "#a7f3d0", accent: "#059669" },
  { id: "lavender", name: "Soft Lavender", bg: "#1e1b4b", text: "#6366f1", active: "#e0e7ff", accent: "#c084fc" },
  { id: "chocolate", name: "Cafe Mocha", bg: "#1c1917", text: "#a8a29e", active: "#f5f5f4", accent: "#d97706" },
  { id: "neon-blue", name: "Electric Ice", bg: "#010a15", text: "#103460", active: "#00d2ff", accent: "#00ffaa" },
  { id: "volcanic", name: "Volcanic Magma", bg: "#110000", text: "#660000", active: "#ff3700", accent: "#ffaa00" },
  { id: "holographic", name: "Holo Prism", bg: "#0d0f1a", text: "#4c5372", active: "#ffffff", accent: "#d4af37", gradient: ["#0d0f1a", "#1b1e36"] },
  { id: "royal", name: "Royal Purple", bg: "#12001c", text: "#5c3384", active: "#f0b6ff", accent: "#ffcf33" },
  { id: "matcha", name: "Matcha Latte", bg: "#fafaf0", text: "#828c74", active: "#465922", accent: "#bf812d" },
  { id: "glitch-red", name: "Digital Blood", bg: "#050505", text: "#551010", active: "#ff0033", accent: "#ffffff" },
  { id: "candy", name: "Cotton Candy", bg: "#fff0f5", text: "#db7093", active: "#ff1493", accent: "#1e90ff" },
  { id: "suno-sunset", name: "Suno Sunset Glow", bg: "#101625", text: "#94a3b8", active: "#ffffff", accent: "#f97316", gradient: ["#1e40af", "#ea580c"] },
  { id: "sonauto-dark", name: "Sonauto Midnight", bg: "#030712", text: "#9ca3af", active: "#ffffff", accent: "#3b82f6", gradient: ["#02040a", "#0d1326"] },
  { id: "twilight-glow", name: "Twilight Glow", bg: "#1e1b4b", text: "#e2e8f0", active: "#ffffff", accent: "#fb923c", gradient: ["#3b82f6", "#fb923c"] },
  { id: "vapor-glitch", name: "Vapor Glitch", bg: "#120136", text: "#03c6c7", active: "#ff007f", accent: "#00f6ff" },
  { id: "y2k-neon", name: "Y2K Neon", bg: "#04051a", text: "#390099", active: "#ff0054", accent: "#9e0059" },
  { id: "brat-lofi", name: "Brat Lofi", bg: "#8ace00", text: "#000000", active: "#000000", accent: "#ffffff" },
  { id: "retro-poster", name: "Retro Poster", bg: "#fff2e6", text: "#594d40", active: "#bf360c", accent: "#e65100" }
];

export const TEMPLATES: Template[] = [
  {
    id: "classic-karaoke",
    name: "Classic Karaoke",
    category: "Standard",
    description: "Classic subtitles with active word colored in a progressive gradient wipe matching the playhead.",
    palette: PALETTES[0],
    font: FONTS[0],
    animationStyle: "progressive-wipe",
    backgroundEffect: "static-grid"
  },
  {
    id: "kinetislide",
    name: "KinetiSlide Stack",
    category: "Kinetic",
    description: "Words slide in from left, stack horizontally, and exit cleanly when the segment finishes.",
    palette: PALETTES[12],
    font: FONTS[1],
    animationStyle: "horizontal-slide-stack",
    backgroundEffect: "drifting-blobs"
  },
  {
    id: "neo-vaporwave",
    name: "Neo-Vaporwave Neon",
    category: "Retro",
    description: "Glowing neon aesthetics, retro synthwave grids, and fast digital glitch overlays.",
    palette: PALETTES[1],
    font: FONTS[4],
    animationStyle: "glitch-shake",
    backgroundEffect: "synthwave-grid"
  },
  {
    id: "editorial-serif",
    name: "Editorial Serif",
    category: "Elegant",
    description: "Sophisticated serif typography with smooth cinematic blur-to-focus fades.",
    palette: PALETTES[5],
    font: FONTS[2],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "slow-bokeh"
  },
  {
    id: "bold-scale",
    name: "Bold Zoom",
    category: "Kinetic",
    description: "Massive, high-impact display lettering with staggered dynamic zooming transitions.",
    palette: PALETTES[2],
    font: FONTS[13],
    animationStyle: "word-zoom-in",
    backgroundEffect: "audio-reactive-tunnel"
  },
  {
    id: "split-slide",
    name: "Column Scroll",
    category: "Layouts",
    description: "A three-column vertical lyric wall displaying preceding, current, and upcoming lines.",
    palette: PALETTES[6],
    font: FONTS[4],
    animationStyle: "column-shift-up",
    backgroundEffect: "waves"
  },
  {
    id: "typewriter-elastic",
    name: "Typewriter Spring",
    category: "Typing",
    description: "Monospaced character printing with elastic-spring bounding animations.",
    palette: PALETTES[11],
    font: FONTS[3],
    animationStyle: "character-bounce-type",
    backgroundEffect: "terminal-matrix"
  },
  {
    id: "cyberpunk-grid",
    name: "Cyberpunk Digital",
    category: "Retro",
    description: "Terminal layout with vertical scanlines and cybernetic code stream reactions.",
    palette: PALETTES[8],
    font: FONTS[16],
    animationStyle: "digital-scramble",
    backgroundEffect: "scanlines-noise"
  },
  {
    id: "wave-floating",
    name: "Liquid Wave",
    category: "Flow",
    description: "Words flow upwards on gentle sine-wave curved paths resembling water droplets.",
    palette: PALETTES[6],
    font: FONTS[17],
    animationStyle: "wave-bobbing",
    backgroundEffect: "sine-wave-particles"
  },
  {
    id: "skewed-angular",
    name: "Speed Slash",
    category: "Action",
    description: "Italicised heavy weights rotated diagonally, cutting fast across high-contrast stripes.",
    palette: PALETTES[14],
    font: FONTS[7],
    animationStyle: "skew-slash-slide",
    backgroundEffect: "diagonal-stripes"
  },
  {
    id: "star-wars",
    name: "Space Perspective",
    category: "3D",
    description: "Classic perspective scroll, receding into deep space cosmic background starfields.",
    palette: PALETTES[4],
    font: FONTS[5],
    animationStyle: "perspective-3d-scroll",
    backgroundEffect: "starfield"
  },
  {
    id: "bounce-pop",
    name: "Elastic Bubble",
    category: "Kinetic",
    description: "Playful bouncing text with energetic popping and jelly-like squeeze transitions.",
    palette: PALETTES[19],
    font: FONTS[10],
    animationStyle: "elastic-pop",
    backgroundEffect: "confetti-drifting"
  },
  {
    id: "chameleon",
    name: "Fluid Chameleon",
    category: "Flow",
    description: "Liquid blob colors shifting dynamically with seamless, smooth spectrum gradients.",
    palette: PALETTES[17],
    font: FONTS[11],
    animationStyle: "organic-liquid-draw",
    backgroundEffect: "dynamic-lava-lamp"
  },
  {
    id: "blur-dissolve",
    name: "Dreamy Dissolve",
    category: "Elegant",
    description: "Ethereal, high-exposure words emerging and disappearing into soft pastel color clouds.",
    palette: PALETTES[15],
    font: FONTS[18],
    animationStyle: "exposure-dissolve",
    backgroundEffect: "aurora-borealis"
  },
  {
    id: "strobe-flash",
    name: "Strobe Impact",
    category: "Action",
    description: "High-octane central flash presenting single-word frames at lightning speeds.",
    palette: PALETTES[18],
    font: FONTS[13],
    animationStyle: "strobe-center-pop",
    backgroundEffect: "radial-light-burst"
  },
  {
    id: "elevator",
    name: "Vertical Stack",
    category: "Layouts",
    description: "Minimal stack layout where the current lyric line steps onto a vertical track.",
    palette: PALETTES[12],
    font: FONTS[4],
    animationStyle: "vertical-elevator-track",
    backgroundEffect: "vignette-shadow"
  },
  {
    id: "chaos-punk",
    name: "Grunge Chaos",
    category: "Action",
    description: "Hand-crafted rebellious feel with randomized character positions, shaking, and rotations.",
    palette: PALETTES[18],
    font: FONTS[15],
    animationStyle: "erratic-grunge-shake",
    backgroundEffect: "half-tone-grit"
  },
  {
    id: "circular-orbit",
    name: "Orbital Helix",
    category: "3D",
    description: "Letters spiraling along an ellipse, orbiting around a centralized visual solar core.",
    palette: PALETTES[13],
    font: FONTS[1],
    animationStyle: "circular-helix-spin",
    backgroundEffect: "cosmic-particle-vortex"
  },
  {
    id: "retro-lcd",
    name: "Retro Arcade",
    category: "Retro",
    description: "Classic 8-bit text display overlayed with scanlines and arcade tube glass warping.",
    palette: PALETTES[8],
    font: FONTS[9],
    animationStyle: "arcade-pixel-flicker",
    backgroundEffect: "pixelated-grid"
  },
  {
    id: "golden-hour",
    name: "Golden Hour Warmth",
    category: "Elegant",
    description: "Elegant warm gradients with shimmering gold flakes and delicate radial flares.",
    palette: PALETTES[4],
    font: FONTS[8],
    animationStyle: "shimmer-golden-fades",
    backgroundEffect: "drifting-dust-motes"
  },
  {
    id: "capcut-aesthetic-card",
    name: "CapCut Aesthetic Card",
    category: "CapCut Pro",
    description: "Sleek floating vinyl record spinning with a translucent centered card overlay and glowing highlight lyrics.",
    palette: PALETTES[1],
    font: FONTS[4],
    animationStyle: "progressive-wipe",
    backgroundEffect: "dreamy-floating-vinyl"
  },
  {
    id: "cinema-music-player",
    name: "Cinema Music Player",
    category: "CapCut Pro",
    description: "Modern cinema layout centered above an active media hud with a dynamic progress bar and playback buttons.",
    palette: PALETTES[0],
    font: FONTS[1],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "cinema-player-hud"
  },
  {
    id: "tiktok-floating-badges",
    name: "TikTok Floating Badges",
    category: "CapCut Pro",
    description: "Dual top capsule badges ('Overview' and 'Lyrics'), a small floating album badge, and clean outline-style lyrics.",
    palette: PALETTES[4],
    font: FONTS[8],
    animationStyle: "word-zoom-in",
    backgroundEffect: "floating-album-badge"
  },
  {
    id: "suno-social-card",
    name: "Suno Aesthetic",
    category: "Social Platform",
    description: "Elegant Suno-inspired card layout featuring central album artwork framed by an ambient split-gradient background.",
    palette: { id: "suno-sunset", name: "Suno Sunset Glow", bg: "#101625", text: "#94a3b8", active: "#ffffff", accent: "#f97316", gradient: ["#1e40af", "#ea580c"] },
    font: FONTS[2], // Playfair Display (serif)
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "suno-split-gradient"
  },
  {
    id: "sonauto-player",
    name: "Sonauto Waveform Player",
    category: "Social Platform",
    description: "Sleek Sonauto-inspired player with a central active waveform, bottom player seekbar, and deep midnight radial background.",
    palette: { id: "sonauto-dark", name: "Sonauto Midnight", bg: "#030712", text: "#9ca3af", active: "#ffffff", accent: "#3b82f6", gradient: ["#02040a", "#0d1326"] },
    font: FONTS[4], // Outfit
    animationStyle: "progressive-wipe",
    backgroundEffect: "sonauto-midnight-glow"
  },
  {
    id: "framed-poster",
    name: "Framed Poster",
    category: "poster",
    description: "Title, artist, and framed artwork with lyrics below, on a soft glowing gradient background.",
    palette: PALETTES.find(p => p.id === "twilight-glow")!,
    font: FONTS[2], // playfair-display
    animationStyle: "fade",
    backgroundEffect: "none"
  },
  {
    id: "player-card",
    name: "Player Card",
    category: "player",
    description: "Waveform player with multi-line synced lyrics, dark minimal background.",
    palette: PALETTES.find(p => p.id === "monochrome")!,
    font: FONTS[0], // inter
    animationStyle: "fade",
    backgroundEffect: "none"
  },
  {
    id: "sleek-minimal",
    name: "Sleek Minimal",
    category: "Standard",
    description: "Ultra-thin modern typography centered with subtle progress spacers and clean transitions.",
    palette: PALETTES[0],
    font: FONTS[0],
    animationStyle: "fade",
    backgroundEffect: "static-grid"
  },
  {
    id: "neon-horizon",
    name: "Neon Horizon Grid",
    category: "Retro",
    description: "Vivid neon blue glow over a perspective wireframe grid, perfect for synthwave and electronic tracks.",
    palette: PALETTES[13],
    font: FONTS[4],
    animationStyle: "glitch-shake",
    backgroundEffect: "synthwave-grid"
  },
  {
    id: "acid-rave",
    name: "Acid Rave High Contrast",
    category: "Action",
    description: "Extreme high-contrast toxic green aesthetics with dynamic word jumps.",
    palette: PALETTES[8],
    font: FONTS[7],
    animationStyle: "strobe-center-pop",
    backgroundEffect: "scanlines-noise"
  },
  {
    id: "retro-typewriter",
    name: "Vintage Ticker",
    category: "Typing",
    description: "Traditional terminal monospaced typing effect with cursor ticks.",
    palette: PALETTES[11],
    font: FONTS[3],
    animationStyle: "character-bounce-type",
    backgroundEffect: "terminal-matrix"
  },
  {
    id: "bold-poster",
    name: "Bold Album Poster",
    category: "poster",
    description: "Oversized bold display typography framing a floating vinyl disc on warm amber gradient colors.",
    palette: PALETTES[4],
    font: FONTS[1],
    animationStyle: "word-zoom-in",
    backgroundEffect: "drifting-blobs"
  },
  {
    id: "luxury-velvet",
    name: "Luxury Velvet Serif",
    category: "Elegant",
    description: "Sophisticated golden text on a rich twilight purple canvas with silky bokeh trails.",
    palette: PALETTES[16],
    font: FONTS[2],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "slow-bokeh"
  },
  {
    id: "tokyo-drift",
    name: "Tokyo Drift Laser",
    category: "Action",
    description: "Aggressive italicised display fonts paired with flashing electronic background beams.",
    palette: PALETTES[13],
    font: FONTS[7],
    animationStyle: "skew-slash-slide",
    backgroundEffect: "diagonal-stripes"
  },
  {
    id: "sublime-pastel",
    name: "Sublime Pastel Cloud",
    category: "Elegant",
    description: "Dreamy soft-colored background with elegant fluid fade-in animations.",
    palette: PALETTES[15],
    font: FONTS[11],
    animationStyle: "exposure-dissolve",
    backgroundEffect: "aurora-borealis"
  },
  {
    id: "hyperkinetic",
    name: "Hyperkinetic Camera",
    category: "Kinetic",
    description: "Active words scale with extreme elastic zoom effects and high contrast colors.",
    palette: PALETTES[2],
    font: FONTS[13],
    animationStyle: "word-zoom-in",
    backgroundEffect: "audio-reactive-tunnel"
  },
  {
    id: "lofi-sunset",
    name: "Lofi Sunset Glow",
    category: "Retro",
    description: "Chill vaporwave colors with soft dust motes, giving an authentic vintage VHS tape vibe.",
    palette: PALETTES[4],
    font: FONTS[1],
    animationStyle: "fade",
    backgroundEffect: "drifting-dust-motes"
  },
  {
    id: "spotify-classic-player",
    name: "Spotify Classic Style",
    category: "CapCut Pro",
    description: "Immersive representation of Spotify's iconic active-line music player lyric UI.",
    palette: PALETTES[10],
    font: FONTS[0],
    animationStyle: "progressive-wipe",
    backgroundEffect: "vignette-shadow"
  },
  {
    id: "apple-music-lyrics",
    name: "Apple Fluid Neon",
    category: "CapCut Pro",
    description: "Luminous, high-blur dynamic neon background with large high-impact left-aligned lyrics.",
    palette: PALETTES[1],
    font: FONTS[4],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "dynamic-lava-lamp"
  },
  {
    id: "retro-vhs",
    name: "CRT VHS Glitch",
    category: "Retro",
    description: "Retro tracking lines, analog date stamp, and active glitch vibrations.",
    palette: PALETTES[2],
    font: FONTS[9],
    animationStyle: "glitch-shake",
    backgroundEffect: "scanlines-noise"
  },
  {
    id: "glitch-tech",
    name: "Glitch Tech Terminal",
    category: "Typing",
    description: "Hacker-themed green on black matrix display with random character scramble fades.",
    palette: PALETTES[8],
    font: FONTS[16],
    animationStyle: "digital-scramble",
    backgroundEffect: "terminal-matrix"
  },
  {
    id: "vintage-editorial",
    name: "Vintage Editorial",
    category: "Elegant",
    description: "Classic high-end serif typography on textured ivory backgrounds, ideal for acoustic and jazz vibes.",
    palette: PALETTES[5],
    font: FONTS[8],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "none"
  },
  {
    id: "indie-rocker",
    name: "Indie Rock Scribble",
    category: "Action",
    description: "Drawn scribble overlays with bouncy erratic letter shake-ups.",
    palette: PALETTES[18],
    font: FONTS[15],
    animationStyle: "erratic-grunge-shake",
    backgroundEffect: "half-tone-grit"
  },
  {
    id: "synthwave-dream",
    name: "Synthwave Horizon",
    category: "Retro",
    description: "Glowing neon wireframes sliding past a giant glowing sunset vector.",
    palette: PALETTES[1],
    font: FONTS[19],
    animationStyle: "word-zoom-in",
    backgroundEffect: "synthwave-grid"
  },
  {
    id: "vogue-display",
    name: "Vogue High Fashion",
    category: "Elegant",
    description: "Sleek display fonts with extra tracking and elegant progressive fades.",
    palette: PALETTES[11],
    font: FONTS[18],
    animationStyle: "fade",
    backgroundEffect: "slow-bokeh"
  },
  {
    id: "tiktok-rapid-fire",
    name: "TikTok Rapid Burst",
    category: "Kinetic",
    description: "Fast single-word popping centered exactly at eye level with elastic scale bounce.",
    palette: PALETTES[14],
    font: FONTS[13],
    animationStyle: "elastic-pop",
    backgroundEffect: "radial-light-burst"
  },
  {
    id: "dynamic-equalizer",
    name: "Dynamic Equalizer",
    category: "Standard",
    description: "Lyrics framed cleanly inside an active, glowing audio spectrum wave visualization.",
    palette: PALETTES[3],
    font: FONTS[1],
    animationStyle: "progressive-wipe",
    backgroundEffect: "sine-wave-particles"
  },
  {
    id: "modern-minimalist",
    name: "Modern Minimalist",
    category: "Signature",
    description: "Ultra-clean sans-serif type with a confident progressive wipe over a bare, distraction-free canvas.",
    palette: PALETTES.find(p => p.id === "nordic")!,
    font: FONTS.find(f => f.id === "space-grotesk")!,
    animationStyle: "progressive-wipe",
    backgroundEffect: "none"
  },
  {
    id: "cinematic-gold",
    name: "Cinematic Gold",
    category: "Signature",
    description: "Warm, high-end shimmer lettering drifting through soft golden dust — award-season polish.",
    palette: PALETTES.find(p => p.id === "sunset")!,
    font: FONTS.find(f => f.id === "playfair-display")!,
    animationStyle: "shimmer-golden-fades",
    backgroundEffect: "drifting-dust-motes"
  },
  {
    id: "editorial-elegance",
    name: "Editorial Elegance",
    category: "Signature",
    description: "Magazine-grade serif typography dissolving gracefully through soft exposure light.",
    palette: PALETTES.find(p => p.id === "editorial")!,
    font: FONTS.find(f => f.id === "merriweather")!,
    animationStyle: "exposure-dissolve",
    backgroundEffect: "slow-bokeh"
  },
  {
    id: "studio-monochrome",
    name: "Studio Monochrome",
    category: "Signature",
    description: "Precision grid backdrop with a crisp, architectural progressive line wipe.",
    palette: PALETTES.find(p => p.id === "monochrome")!,
    font: FONTS.find(f => f.id === "inter")!,
    animationStyle: "progressive-wipe",
    backgroundEffect: "static-grid"
  },
  {
    id: "velvet-noir",
    name: "Velvet Noir",
    category: "Signature",
    description: "Deep royal tones and classical serif lettering emerging through a cinematic blur-to-focus reveal.",
    palette: PALETTES.find(p => p.id === "royal")!,
    font: FONTS.find(f => f.id === "cinzel")!,
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "vignette-shadow"
  },
  {
    id: "ocean-breeze-pro",
    name: "Ocean Breeze Pro",
    category: "Signature",
    description: "Calm ocean-toned palette with a bright active-word highlight drifting through gentle aurora light.",
    palette: PALETTES.find(p => p.id === "ocean")!,
    font: FONTS.find(f => f.id === "outfit")!,
    animationStyle: "word-pop-highlight",
    backgroundEffect: "aurora-borealis"
  },
  {
    id: "matcha-zen",
    name: "Matcha Zen",
    category: "Signature",
    description: "Soft, tea-house serif calm — gentle dissolve transitions over a quiet bokeh haze.",
    palette: PALETTES.find(p => p.id === "matcha")!,
    font: FONTS.find(f => f.id === "merriweather")!,
    animationStyle: "exposure-dissolve",
    backgroundEffect: "slow-bokeh"
  },
  {
    id: "forest-executive",
    name: "Forest Executive",
    category: "Signature",
    description: "Grounded amber-and-forest tones with clean sans type on a bare, boardroom-ready canvas.",
    palette: PALETTES.find(p => p.id === "forest-warm")!,
    font: FONTS.find(f => f.id === "inter")!,
    animationStyle: "progressive-wipe",
    backgroundEffect: "none"
  },
  {
    id: "twilight-premiere",
    name: "Twilight Premiere",
    category: "Signature",
    description: "Rich indigo-to-orange twilight tones with a slow cinematic blur reveal, like a festival premiere title card.",
    palette: PALETTES.find(p => p.id === "twilight-glow")!,
    font: FONTS.find(f => f.id === "space-grotesk")!,
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "aurora-borealis"
  },
  {
    id: "champagne-gala",
    name: "Champagne Gala",
    category: "Signature",
    description: "Soft lavender-and-gold formalwear aesthetic with shimmering golden fades for a black-tie finish.",
    palette: PALETTES.find(p => p.id === "lavender")!,
    font: FONTS.find(f => f.id === "playfair-display")!,
    animationStyle: "shimmer-golden-fades",
    backgroundEffect: "drifting-dust-motes"
  },
  {
    id: "controlled-chaos",
    name: "Controlled Chaos",
    category: "Signature",
    description: "2026's defining lyric-video look: bold black-and-neon typography cut through with frequent chromatic-aberration glitch and scanline grain — high-contrast and impossible to miss.",
    palette: PALETTES.find(p => p.id === "cyberpunk")!,
    font: FONTS.find(f => f.id === "space-grotesk")!,
    animationStyle: "glitch-shake",
    backgroundEffect: "scanlines-noise"
  },
  {
    id: "zine-collage-warmth",
    name: "Zine Collage Warmth",
    category: "Trending",
    description: "2026's mixed-media comeback: warm cream tones, a hand-cut scrapbook font, and grainy halftone paper texture with playful bouncing letters — human and charming instead of glossy and perfect.",
    palette: PALETTES.find(p => p.id === "retro-poster")!,
    font: FONTS.find(f => f.id === "cabin-sketch")!,
    animationStyle: "character-bounce-type",
    backgroundEffect: "half-tone-grit"
  },
  {
    id: "corporate-clean",
    name: "Corporate Clean",
    category: "Professional",
    description: "Boardroom-ready minimalism: crisp sans typography with a subtle, confident word highlight.",
    palette: PALETTES.find(p => p.id === "editorial")!,
    font: FONTS[0],
    animationStyle: "word-pop-highlight",
    backgroundEffect: "none"
  },
  {
    id: "cinematic-trailer",
    name: "Cinematic Trailer",
    category: "Professional",
    description: "Widescreen, high-contrast type with a slow blur-to-focus reveal, like a film trailer title card.",
    palette: PALETTES.find(p => p.id === "monochrome")!,
    font: FONTS[13],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "vignette-shadow"
  },
  {
    id: "executive-briefing",
    name: "Executive Briefing",
    category: "Professional",
    description: "Clean geometric sans on a quiet grid backdrop, with a precise progressive line wipe.",
    palette: PALETTES.find(p => p.id === "nordic")!,
    font: FONTS[1],
    animationStyle: "progressive-wipe",
    backgroundEffect: "static-grid"
  },
  {
    id: "luxury-brand-serif",
    name: "Luxury Brand Serif",
    category: "Professional",
    description: "High-fashion serif lettering dissolving in and out through soft, expensive-looking bokeh light.",
    palette: PALETTES.find(p => p.id === "royal")!,
    font: FONTS[2],
    animationStyle: "exposure-dissolve",
    backgroundEffect: "slow-bokeh"
  },
  {
    id: "tech-product-launch",
    name: "Tech Product Launch",
    category: "Professional",
    description: "Bold modern display type zooming in with punch, over a sleek audio-reactive tunnel.",
    palette: PALETTES.find(p => p.id === "ocean")!,
    font: FONTS[7],
    animationStyle: "word-zoom-in",
    backgroundEffect: "audio-reactive-tunnel"
  },
  {
    id: "documentary-feature",
    name: "Documentary Feature",
    category: "Professional",
    description: "Warm, editorial serif type with a slow cinematic fade, drifting dust motes for texture.",
    palette: PALETTES.find(p => p.id === "forest-warm")!,
    font: FONTS[14],
    animationStyle: "cinematic-blur-fade",
    backgroundEffect: "drifting-dust-motes"
  },
  {
    id: "podcast-studio",
    name: "Podcast Studio",
    category: "Professional",
    description: "Three-line conversational scroll in a warm mocha tone, built for talk and interview content.",
    palette: PALETTES.find(p => p.id === "chocolate")!,
    font: FONTS[4],
    animationStyle: "column-shift-up",
    backgroundEffect: "vignette-shadow"
  },
  {
    id: "broadcast-lower-third",
    name: "Broadcast Lower Third",
    category: "Professional",
    description: "Wide-tracked news-style caption with a sharp progressive wipe, like a live TV chyron.",
    palette: PALETTES.find(p => p.id === "twilight-glow")!,
    font: FONTS[18],
    animationStyle: "progressive-wipe",
    backgroundEffect: "static-grid"
  },
  {
    id: "wedding-elegance",
    name: "Wedding Elegance",
    category: "Professional",
    description: "Soft lavender tones with a graceful handwritten drift, suited to intimate, romantic edits.",
    palette: PALETTES.find(p => p.id === "lavender")!,
    font: FONTS[12],
    animationStyle: "handwritten-drift",
    backgroundEffect: "aurora-borealis"
  },
  {
    id: "award-show-gala",
    name: "Award Show Gala",
    category: "Professional",
    description: "Gold shimmer classical lettering for red-carpet, award-season, and gala-style reveals.",
    palette: PALETTES.find(p => p.id === "holographic")!,
    font: FONTS[8],
    animationStyle: "shimmer-golden-fades",
    backgroundEffect: "drifting-dust-motes"
  }
];

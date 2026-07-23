export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface LyricLine {
  text: string;
  start: number;
  end: number;
  words: Word[];
}

export interface ColorPalette {
  id: string;
  name: string;
  bg: string;
  text: string;
  active: string;
  accent: string;
  gradient?: string[];
}

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: 'sans' | 'serif' | 'mono' | 'display' | 'handwritten';
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  palette: ColorPalette;
  font: FontOption;
  animationStyle: string;
  backgroundEffect: string;
}

export interface VideoConfig {
  resolution: '360p' | '480p' | '540p' | '720p' | '1080p' | '4k';
  fps: 30 | 60;
  templateId: string;
  customFontId: string;
  customPaletteId: string;
  backgroundEffect: string;
  textAnimation: string;
  fontSizeMultiplier: number;
  showWaveform: boolean;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  textStylePreset?: 'default' | 'glow' | 'outline' | 'neon' | 'shadow' | 'bubble';
  videoFilter?: 'none' | 'rgb-glitch' | 'film-grain' | 'vhs' | 'light-leak' | 'vignette';
  songTitle?: string;
  songArtist?: string;
  songAlbum?: string;
  albumArtUrl?: string;
  metadataStyle?: 'none' | 'cinematic-intro' | 'spinning-vinyl' | 'elegant-banner';
  layoutMode?: 'kinetic' | 'framed-poster' | 'player-card';
}

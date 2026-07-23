import { LyricLine, VideoConfig, Template, ColorPalette, FontOption } from "../types";
import { PALETTES, FONTS } from "../templates";

// Helper to draw CapCut cinematic video filters as post-process overlays
export function applyVideoFilter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: VideoConfig,
  time: number
) {
  const filter = config.videoFilter || 'none';
  if (filter === 'none') return;

  ctx.save();

  switch (filter) {
    case 'vignette': {
      const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.7)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'vhs': {
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1.5);
      }
      
      const glitchY = (time * 160) % h;
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.fillRect(0, glitchY, w, 20);
      
      if (Math.random() < 0.1) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.03)";
        ctx.fillRect((Math.random() - 0.5) * 6, 0, w, h);
        ctx.fillStyle = "rgba(255, 0, 0, 0.02)";
        ctx.fillRect((Math.random() - 0.5) * 6, 0, w, h);
      }
      break;
    }

    case 'film-grain': {
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      for (let i = 0; i < 15; i++) {
        const gx = Math.random() * w;
        const gy = Math.random() * h;
        const gs = Math.random() * 2 + 1;
        ctx.fillRect(gx, gy, gs, gs);
      }

      if (Math.random() < 0.2) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = Math.random() * 0.7 + 0.3;
        const sx = Math.random() * w;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + (Math.random() - 0.5) * 6, h);
        ctx.stroke();
      }
      break;
    }

    case 'light-leak': {
      ctx.globalCompositeOperation = 'screen';
      
      const lx1 = w * 0.3 + Math.sin(time * 0.4) * w * 0.15;
      const ly1 = h * 0.3 + Math.cos(time * 0.3) * h * 0.15;
      const lr1 = Math.min(w, h) * 0.5;
      
      const grad1 = ctx.createRadialGradient(lx1, ly1, 0, lx1, ly1, lr1);
      grad1.addColorStop(0, "rgba(255, 80, 150, 0.18)");
      grad1.addColorStop(0.4, "rgba(255, 150, 40, 0.07)");
      grad1.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.arc(lx1, ly1, lr1, 0, Math.PI * 2);
      ctx.fill();

      const lx2 = w * 0.7 + Math.cos(time * 0.5) * w * 0.15;
      const ly2 = h * 0.6 + Math.sin(time * 0.4) * h * 0.15;
      const lr2 = Math.min(w, h) * 0.55;
      
      const grad2 = ctx.createRadialGradient(lx2, ly2, 0, lx2, ly2, lr2);
      grad2.addColorStop(0, "rgba(0, 150, 255, 0.15)");
      grad2.addColorStop(0.5, "rgba(180, 50, 255, 0.06)");
      grad2.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.arc(lx2, ly2, lr2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'rgb-glitch': {
      if (Math.random() < 0.08) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fillRect(0, 0, w, h);
      }
      
      if (Math.random() < 0.04) {
        const blockY = Math.random() * h;
        const blockH = Math.random() * 60 + 15;
        const shiftX = (Math.random() - 0.5) * 15;
        ctx.drawImage(ctx.canvas, 0, blockY, w, blockH, shiftX, blockY, w, blockH);
      }
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

// Master sub-render helper to draw styled text presets (Neon, Outline, Bubble backdrop, Shadows)
export function renderStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  palette: ColorPalette,
  config: VideoConfig,
  isActiveWord: boolean = false,
  originalFillText?: (text: string, x: number, y: number) => void
) {
  const preset = config.textStylePreset || 'default';
  ctx.save();

  const drawFill = (t: string, px: number, py: number) => {
    if (originalFillText) {
      originalFillText.call(ctx, t, px, py);
    } else {
      ctx.fillText(t, px, py);
    }
  };

  switch (preset) {
    case 'glow': {
      ctx.shadowColor = isActiveWord ? palette.accent : palette.text;
      ctx.shadowBlur = 15;
      ctx.fillStyle = isActiveWord ? palette.active : `${palette.text}c0`;
      drawFill(text, x, y);
      break;
    }
    case 'outline': {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = palette.bg === '#000000' || palette.bg === '#050505' ? "#1e293b" : "#020617";
      ctx.lineWidth = 6;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = isActiveWord ? palette.active : `${palette.text}d0`;
      drawFill(text, x, y);
      break;
    }
    case 'neon': {
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.strokeText(text, x, y);
      
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeText(text, x, y);

      ctx.fillStyle = "#ffffff";
      drawFill(text, x, y);
      break;
    }
    case 'shadow': {
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = isActiveWord ? palette.active : `${palette.text}cc`;
      drawFill(text, x, y);
      break;
    }
    case 'bubble': {
      const textWidth = ctx.measureText(text).width;
      const paddingX = 14;
      const paddingY = 6;
      const fontSizeStr = ctx.font.match(/\d+px/)?.[0] || "32px";
      const fontSize = parseInt(fontSizeStr) || 32;

      ctx.fillStyle = isActiveWord ? `${palette.accent}25` : "rgba(15, 23, 42, 0.35)";
      ctx.strokeStyle = isActiveWord ? palette.accent : `${palette.text}30`;
      ctx.lineWidth = 1.5;

      const rectW = textWidth + paddingX * 2;
      const rectH = fontSize + paddingY * 2;
      const rx = x - rectW / 2;
      const ry = y - fontSize / 2 - paddingY;
      const radius = 8;

      ctx.beginPath();
      ctx.roundRect?.(rx, ry, rectW, rectH, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isActiveWord ? palette.active : `${palette.text}cc`;
      drawFill(text, x, y);
      break;
    }
    case 'default':
    default: {
      ctx.fillStyle = isActiveWord ? palette.active : `${palette.text}cc`;
      drawFill(text, x, y);
      break;
    }
  }

  ctx.restore();
}

// Class to manage persistent background particle/animation states
export class BackgroundState {
  private particles: any[] = [];
  private lastTime: number = 0;
  private width: number = 0;
  private height: number = 0;
  private seedRandom: number = 0.5;
  private currentEffectType: string = "";

  constructor() {
    this.reset();
  }

  private reset() {
    this.particles = [];
    this.lastTime = 0;
    this.currentEffectType = "";
  }

  private initParticles(type: string, w: number, h: number) {
    this.width = w;
    this.height = h;
    this.particles = [];

    if (type === "drifting-blobs") {
      for (let i = 0; i < 5; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          radius: Math.random() * 200 + 150,
          color: i % 2 === 0 ? "rgba(236, 72, 153, 0.15)" : "rgba(14, 165, 233, 0.15)"
        });
      }
    } else if (type === "slow-bokeh") {
      for (let i = 0; i < 25; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: -(Math.random() * 10 + 5),
          radius: Math.random() * 30 + 10,
          alpha: Math.random() * 0.4 + 0.1,
          pulseSpeed: Math.random() * 0.02 + 0.01,
          pulsePhase: Math.random() * Math.PI
        });
      }
    } else if (type === "terminal-matrix") {
      const columns = Math.floor(w / 20);
      for (let i = 0; i < columns; i++) {
        this.particles.push({
          x: i * 20,
          y: Math.random() * -h,
          vy: Math.random() * 150 + 100,
          chars: Array.from({ length: 15 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 93)))
        });
      }
    } else if (type === "sine-wave-particles") {
      for (let i = 0; i < 80; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: Math.random() * 50 + 20,
          amplitude: Math.random() * 40 + 10,
          frequency: Math.random() * 0.005 + 0.002,
          phase: Math.random() * Math.PI * 2,
          radius: Math.random() * 4 + 1
        });
      }
    } else if (type === "starfield") {
      for (let i = 0; i < 150; i++) {
        this.particles.push({
          x: (Math.random() - 0.5) * w,
          y: (Math.random() - 0.5) * h,
          z: Math.random() * w,
          color: `hsl(${Math.random() * 360}, 50%, 90%)`
        });
      }
    } else if (type === "confetti-drifting") {
      for (let i = 0; i < 40; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * -h,
          vy: Math.random() * 80 + 60,
          vx: (Math.random() - 0.5) * 30,
          w: Math.random() * 12 + 6,
          h: Math.random() * 16 + 8,
          rotation: Math.random() * Math.PI,
          rSpeed: (Math.random() - 0.5) * 3,
          color: `hsl(${Math.random() * 360}, 80%, 65%)`
        });
      }
    } else if (type === "cosmic-particle-vortex") {
      for (let i = 0; i < 120; i++) {
        this.particles.push({
          angle: Math.random() * Math.PI * 2,
          radius: Math.random() * (Math.min(w, h) * 0.45),
          speed: (Math.random() * 0.5 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
          size: Math.random() * 3 + 1,
          color: `hsl(${(i * 3) % 360}, 75%, 70%)`
        });
      }
    } else if (type === "drifting-dust-motes" || type === "dreamy-floating-vinyl" || type === "cinema-player-hud" || type === "floating-album-badge" || type === "suno-split-gradient" || type === "sonauto-midnight-glow") {
      for (let i = 0; i < 40; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 15,
          vy: -(Math.random() * 20 + 10),
          size: Math.random() * 5 + 1.5,
          opacity: Math.random() * 0.6 + 0.1
        });
      }
    }
  }

  // Draw background effect
  public draw(
    ctx: CanvasRenderingContext2D,
    time: number,
    w: number,
    h: number,
    effectType: string,
    palette: ColorPalette,
    config?: VideoConfig
  ) {
    if (
      this.width !== w ||
      this.height !== h ||
      this.particles.length === 0 ||
      this.currentEffectType !== effectType
    ) {
      this.currentEffectType = effectType;
      this.initParticles(effectType, w, h);
    }

    const dt = this.lastTime === 0 ? 0 : Math.min(time - this.lastTime, 0.1);
    this.lastTime = time;

    // Fill primary background
    if (palette.gradient && palette.gradient.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, palette.gradient[0]);
      grad.addColorStop(1, palette.gradient[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = palette.bg;
    }
    ctx.fillRect(0, 0, w, h);

    // Apply specific effect
    switch (effectType) {
      case "static-grid": {
        ctx.strokeStyle = `${palette.text}20`;
        ctx.lineWidth = 1;
        const gridGap = 60;
        for (let x = 0; x < w; x += gridGap) {
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += gridGap) {
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        break;
      }

      case "drifting-blobs": {
        ctx.save();
        // Optimized: replaced slow, crash-prone canvas blur filters with native hardware-accelerated radial gradients
        for (const p of this.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (p.x - p.radius < 0 || p.x + p.radius > w) p.vx *= -1;
          if (p.y - p.radius < 0 || p.y + p.radius > h) p.vy *= -1;

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.8, p.color.replace(/[\d.]+\)$/, "0.05)"));
          grad.addColorStop(1, "rgba(0,0,0,0)");
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "synthwave-grid": {
        // Draw deep horizon sunset background glow
        const sunGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6);
        sunGrad.addColorStop(0, `${palette.active}25`);
        sunGrad.addColorStop(1, "transparent");
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, w, h);

        // Draw sun at center
        const sunRadius = Math.min(w, h) * 0.18;
        const sunY = h * 0.45;
        const sunX = w / 2;
        const gSun = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
        gSun.addColorStop(0, palette.active);
        gSun.addColorStop(0.5, palette.accent);
        gSun.addColorStop(1, palette.bg);
        
        ctx.fillStyle = gSun;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, Math.PI, 0, false);
        ctx.fill();

        // Sun horizontal laser cutouts
        ctx.fillStyle = palette.bg;
        for (let i = sunY; i < sunY + sunRadius; i += 12) {
          const thickness = (i - sunY) / 3;
          ctx.fillRect(sunX - sunRadius - 10, i, sunRadius * 2 + 20, thickness);
        }

        // 3D Perspective grid
        ctx.strokeStyle = `${palette.accent}60`;
        ctx.lineWidth = 2;
        const horizon = h * 0.55;
        const gridCount = 20;

        // Vanishing perspective vertical lines
        for (let i = 0; i <= gridCount; i++) {
          const ratio = i / gridCount;
          const xStart = w * ratio;
          ctx.beginPath();
          ctx.moveTo(w / 2 + (ratio - 0.5) * w * 0.1, horizon);
          ctx.lineTo((ratio - 0.5) * w * 3 + w / 2, h);
          ctx.stroke();
        }

        // Horizontal moving lines
        const speed = 100; // grid speed
        const cycle = 4.0; // time cycle
        const gridOffset = (time * speed) % 80;

        for (let y = horizon; y < h; y += 30) {
          // Perspective spacing
          const normalizedY = (y - horizon) / (h - horizon);
          const progressiveY = horizon + Math.pow(normalizedY, 1.8) * (h - horizon) + gridOffset * normalizedY;
          if (progressiveY > h) continue;
          ctx.strokeStyle = `${palette.accent}${Math.floor((normalizedY) * 99)}`;
          ctx.beginPath();
          ctx.moveTo(0, progressiveY);
          ctx.lineTo(w, progressiveY);
          ctx.stroke();
        }
        break;
      }

      case "slow-bokeh": {
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.pulsePhase += p.pulseSpeed;
          if (p.y + p.radius < 0) {
            p.y = h + p.radius;
            p.x = Math.random() * w;
          }

          const currentAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.05;
          ctx.fillStyle = `${palette.active}${Math.floor(Math.max(0, currentAlpha) * 255).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "audio-reactive-tunnel": {
        ctx.strokeStyle = `${palette.accent}30`;
        ctx.lineWidth = 3;
        const centerX = w / 2;
        const centerY = h / 2;
        const maxRadius = Math.max(w, h) * 0.8;
        const rippleCount = 8;
        const speedMultiplier = 120;
        const offset = (time * speedMultiplier) % (maxRadius / rippleCount);

        for (let i = 0; i < rippleCount; i++) {
          const r = i * (maxRadius / rippleCount) + offset;
          const alpha = 1 - r / maxRadius;
          ctx.strokeStyle = `${palette.accent}${Math.floor(alpha * 120).toString(16).padStart(2, '0')}`;
          
          // Draw reactive octagon/circle
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case "waves": {
        ctx.save();
        ctx.strokeStyle = `${palette.accent}40`;
        ctx.lineWidth = 4;
        
        const waveCount = 3;
        for (let j = 0; j < waveCount; j++) {
          ctx.beginPath();
          const amp = 30 + j * 15;
          const freq = 0.003 - j * 0.0008;
          const shift = time * 2 + j * Math.PI * 0.4;
          const baseline = h * 0.75 + j * 20;

          ctx.moveTo(0, baseline);
          for (let x = 0; x <= w; x += 10) {
            const y = baseline + Math.sin(x * freq + shift) * amp;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `${j % 2 === 0 ? palette.accent : palette.text}50`;
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case "terminal-matrix": {
        ctx.font = "14px 'JetBrains Mono', monospace";
        ctx.fillStyle = `${palette.accent}bd`;
        for (const p of this.particles) {
          p.y += p.vy * dt;
          if (p.y > h + 300) {
            p.y = -300;
            p.x = Math.random() * w;
          }

          // Render dropping character column
          for (let i = 0; i < p.chars.length; i++) {
            const charY = p.y - i * 20;
            if (charY < 0 || charY > h) continue;

            const alpha = 1 - i / p.chars.length;
            ctx.fillStyle = `${i === 0 ? "#ffffff" : palette.accent}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
            
            // Randomly swap chars
            if (Math.random() < 0.03) {
              p.chars[i] = String.fromCharCode(33 + Math.floor(Math.random() * 93));
            }
            ctx.fillText(p.chars[i], p.x, charY);
          }
        }
        break;
      }

      case "scanlines-noise": {
        // Subtle digital grey grain noise
        ctx.fillStyle = `${palette.text}06`;
        for (let i = 0; i < 15; i++) {
          const noiseSize = Math.random() * 200 + 100;
          ctx.fillRect(Math.random() * w, Math.random() * h, noiseSize, noiseSize);
        }

        // Horizontal scanlines overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 4) {
          ctx.fillRect(0, y, w, 1.5);
        }

        // Dynamic screen flicker
        if (Math.random() < 0.02) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }

      case "sine-wave-particles": {
        ctx.fillStyle = `${palette.accent}cc`;
        for (const p of this.particles) {
          p.x += p.speed * dt;
          if (p.x > w) {
            p.x = -10;
            p.y = Math.random() * h;
          }
          const y = p.y + Math.sin(p.x * p.frequency + p.phase) * p.amplitude;
          ctx.beginPath();
          ctx.arc(p.x, y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "diagonal-stripes": {
        ctx.save();
        ctx.fillStyle = `${palette.text}0d`;
        const stripeWidth = 140;
        const spacing = 100;
        const offset = (time * 40) % (stripeWidth + spacing);

        ctx.translate(offset, 0);
        for (let x = -stripeWidth * 2 - w; x < w * 2; x += stripeWidth + spacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + stripeWidth, 0);
          ctx.lineTo(x + stripeWidth - h * 0.5, h);
          ctx.lineTo(x - h * 0.5, h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "starfield": {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        for (const p of this.particles) {
          p.z -= 150 * dt;
          if (p.z <= 0) {
            p.z = w;
            p.x = (Math.random() - 0.5) * w;
            p.y = (Math.random() - 0.5) * h;
          }

          const k = 128 / p.z;
          const px = p.x * k;
          const py = p.y * k;
          const r = Math.max(0.2, (1 - p.z / w) * 5);

          if (px > -w / 2 && px < w / 2 && py > -h / 2 && py < h / 2) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        break;
      }

      case "confetti-drifting": {
        ctx.save();
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          p.rotation += p.rSpeed * dt;

          if (p.y > h + 50) {
            p.y = -50;
            p.x = Math.random() * w;
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        ctx.restore();
        break;
      }

      case "dynamic-lava-lamp": {
        ctx.save();
        // Native GPU-optimized radial gradients for soft, buttery-smooth lava lamp blobs
        const count = 4;
        for (let i = 0; i < count; i++) {
          const x = w / 2 + Math.sin(time * 0.4 + i * Math.PI * 0.5) * w * 0.35;
          const y = h / 2 + Math.cos(time * 0.35 + i * Math.PI * 0.3) * h * 0.25;
          const r = (Math.min(w, h) * 0.25 + Math.sin(time * 0.8 + i) * 30) * 1.5;

          const baseColor = i % 2 === 0 ? palette.accent : palette.active;
          const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, `${baseColor}2c`);
          grad.addColorStop(0.5, `${baseColor}10`);
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "aurora-borealis": {
        ctx.save();
        // Hardware-accelerated linear gradients to fade ribbon edges organically instead of slow filter blurs
        const ribbonCount = 2;
        for (let r = 0; r < ribbonCount; r++) {
          const grad = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.7);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(0.3, `${palette.accent}20`);
          grad.addColorStop(0.5, `${palette.active}1e`);
          grad.addColorStop(0.7, `${palette.accent}20`);
          grad.addColorStop(1, "rgba(0,0,0,0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, h * 0.1);
          for (let x = 0; x <= w; x += 50) {
            const waveY = h * 0.25 + Math.sin(x * 0.002 + time * 0.3 + r * Math.PI) * h * 0.12;
            ctx.lineTo(x, waveY);
          }
          ctx.lineTo(w, h * 0.7);
          for (let x = w; x >= 0; x -= 50) {
            const waveY2 = h * 0.45 + Math.sin(x * 0.0025 + time * 0.25 + r * Math.PI) * h * 0.12;
            ctx.lineTo(x, waveY2);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "radial-light-burst": {
        ctx.save();
        const rays = 36;
        const centerX = w / 2;
        const centerY = h / 2;
        const outerRadius = Math.max(w, h) * 0.9;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.05);

        ctx.fillStyle = `${palette.accent}04`;
        for (let i = 0; i < rays; i++) {
          const angle = (i * Math.PI * 2) / rays;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle - 0.05) * outerRadius, Math.sin(angle - 0.05) * outerRadius);
          ctx.lineTo(Math.cos(angle + 0.05) * outerRadius, Math.sin(angle + 0.05) * outerRadius);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "vignette-shadow": {
        // Central light spotlight gradient
        const spotGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, Math.max(w, h) * 0.65);
        spotGrad.addColorStop(0, "transparent");
        spotGrad.addColorStop(1, "rgba(0, 0, 0, 0.75)");
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case "half-tone-grit": {
        ctx.fillStyle = `${palette.text}05`;
        const dotGap = 20;
        const dotSize = 2.5;
        for (let x = dotGap / 2; x < w; x += dotGap) {
          for (let y = dotGap / 2; y < h; y += dotGap) {
            ctx.beginPath();
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case "cosmic-particle-vortex": {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        for (const p of this.particles) {
          p.angle += p.speed * dt * 0.3;
          const x = Math.cos(p.angle) * p.radius;
          const y = Math.sin(p.angle) * p.radius;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "pixelated-grid": {
        ctx.fillStyle = `${palette.accent}0d`;
        const cellSize = 16;
        for (let y = 0; y < h; y += cellSize) {
          ctx.fillRect(0, y, w, 1);
        }
        for (let x = 0; x < w; x += cellSize) {
          ctx.fillRect(x, 0, 1, h);
        }

        // Draw arcade vertical glass glare lines
        const glareX = (time * 200) % (w * 3) - w;
        const glareGrad = ctx.createLinearGradient(glareX, 0, glareX + 200, 0);
        glareGrad.addColorStop(0, "transparent");
        glareGrad.addColorStop(0.5, "rgba(255,255,255,0.03)");
        glareGrad.addColorStop(1, "transparent");
        ctx.fillStyle = glareGrad;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case "drifting-dust-motes": {
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;

          if (p.y < -10) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
          if (p.x < -10 || p.x > w + 10) {
            p.vx *= -1;
          }

          ctx.fillStyle = `${palette.active}${Math.floor(p.opacity * 255).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "dreamy-floating-vinyl": {
        // Draw elegant particles first
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10 || p.x > w + 10) p.vx *= -1;

          ctx.fillStyle = `${palette.active}${Math.floor(p.opacity * 130).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        // 1. Spinning Vinyl Record in top left/center depending on layout width
        const isPortrait = h > w;
        const recordX = isPortrait ? w * 0.5 : w * 0.16;
        const recordY = isPortrait ? h * 0.15 : h * 0.22;
        const recordRadius = Math.min(w, h) * (isPortrait ? 0.09 : 0.075);

        ctx.translate(recordX, recordY);
        ctx.rotate(time * 1.5); // spin speed

        // Draw Vinyl body
        ctx.fillStyle = "#121212";
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow

        // Concentric Vinyl groove lines
        ctx.strokeStyle = "#282828";
        ctx.lineWidth = 1.5;
        for (let r = recordRadius * 0.4; r < recordRadius * 0.95; r += 6) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Center sticker
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(0, 0, recordRadius * 0.32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, recordRadius * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Vinyl reflection shiny sweep
        const reflectionGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, recordRadius);
        reflectionGrad.addColorStop(0, "rgba(255,255,255,0.0)");
        reflectionGrad.addColorStop(0.5, "rgba(255,255,255,0.12)");
        reflectionGrad.addColorStop(1, "rgba(255,255,255,0.0)");
        
        ctx.fillStyle = reflectionGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, recordRadius, -0.4, 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, recordRadius, Math.PI - 0.4, Math.PI + 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Music is playing text
        ctx.save();
        ctx.fillStyle = `${palette.active}b0`;
        ctx.font = `italic 500 ${Math.floor(Math.min(w, h) * 0.026)}px 'Space Grotesk', sans-serif`;
        ctx.textAlign = isPortrait ? "center" : "left";
        const labelX = isPortrait ? w * 0.5 : w * 0.16 + recordRadius + 15;
        const labelY = isPortrait ? recordY + recordRadius + 22 : recordY + 4;
        ctx.fillText("Music is playing...", labelX, labelY);

        // Flashing green dot
        ctx.fillStyle = (time % 1.2 > 0.6) ? "#10b981" : "#047857";
        ctx.beginPath();
        const dotOffset = isPortrait ? 60 : ctx.measureText("Music is playing...").width + 12;
        ctx.arc(labelX + dotOffset, labelY - 1, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Beautiful Centered Translucent Glassmorphism Card Outline
        ctx.save();
        const cardW = w * (isPortrait ? 0.86 : 0.62);
        const cardH = h * (isPortrait ? 0.48 : 0.48);
        const cardX = w / 2 - cardW / 2;
        const cardY = h / 2 - cardH / 2 + (isPortrait ? h * 0.06 : h * 0.02);
        const cardRadius = 18;

        // Draw translucent body
        ctx.fillStyle = "rgba(15, 23, 42, 0.45)"; // Deep slate backing
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 25;
        
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }

      case "cinema-player-hud": {
        // Draw elegant particles first
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10 || p.x > w + 10) p.vx *= -1;

          ctx.fillStyle = `${palette.active}${Math.floor(p.opacity * 130).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        const isPortrait = h > w;
        
        // Let's draw a nice dark cinematic horizontal frame or top/bottom bars if widescreen
        if (!isPortrait) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.fillRect(0, h * 0.78, w, h * 0.22);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.78);
          ctx.lineTo(w, h * 0.78);
          ctx.stroke();
        }

        // 1. HUD dimensions
        const hudY = h * (isPortrait ? 0.82 : 0.86);
        const seekW = w * (isPortrait ? 0.80 : 0.60);
        const seekX = w / 2 - seekW / 2;
        
        // Loop time over 180s (3 minutes)
        const songDuration = 180;
        const currentSongTime = time % songDuration;
        const progress = currentSongTime / songDuration;

        // Draw track bar line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(seekX, hudY);
        ctx.lineTo(seekX + seekW, hudY);
        ctx.stroke();

        // Draw active track progress line
        ctx.strokeStyle = palette.accent;
        ctx.beginPath();
        ctx.moveTo(seekX, hudY);
        ctx.lineTo(seekX + seekW * progress, hudY);
        ctx.stroke();

        // Draw progress thumb circle
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(seekX + seekW * progress, hudY, 6, 0, Math.PI * 2);
        ctx.fill();

        // 2. Playback timers
        ctx.fillStyle = `${palette.active}a0`;
        ctx.font = `500 ${Math.floor(Math.min(w, h) * 0.024)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "left";
        
        const minElapsed = Math.floor(currentSongTime / 60).toString().padStart(2, "0");
        const secElapsed = Math.floor(currentSongTime % 60).toString().padStart(2, "0");
        ctx.fillText(`${minElapsed}:${secElapsed}`, seekX, hudY + 18);

        ctx.textAlign = "right";
        ctx.fillText("03:00", seekX + seekW, hudY + 18);

        // 3. Media controls buttons
        const controlY = hudY + (isPortrait ? 42 : 38);
        const spacing = Math.min(w, h) * (isPortrait ? 0.08 : 0.05);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Shuffle icon
        ctx.fillStyle = `${palette.active}80`;
        ctx.font = `600 ${Math.floor(Math.min(w, h) * 0.028)}px sans-serif`;
        ctx.fillText("⇄", w / 2 - spacing * 2, controlY);

        // Skip back ⏮
        ctx.fillText("⏮", w / 2 - spacing, controlY);

        // Play/Pause button container
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(w / 2, controlY, isPortrait ? 18 : 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `600 ${Math.floor(Math.min(w, h) * (isPortrait ? 0.026 : 0.022))}px sans-serif`;
        ctx.fillText(time % 4 === 0 ? "❚❚" : "▶", w / 2 + (time % 4 !== 0 ? 1 : 0), controlY);

        // Skip next ⏭
        ctx.fillStyle = `${palette.active}80`;
        ctx.fillText("⏭", w / 2 + spacing, controlY);

        // Repeat icon ↻
        ctx.fillText("↻", w / 2 + spacing * 2, controlY);

        ctx.restore();
        break;
      }

      case "floating-album-badge": {
        // Draw elegant particles first
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10 || p.x > w + 10) p.vx *= -1;

          ctx.fillStyle = `${palette.active}${Math.floor(p.opacity * 130).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        const isPortrait = h > w;

        // 1. Dual capsule buttons at top ("Overview" and "Lyrics")
        const tabY = h * 0.08;
        const btnW = Math.min(w, h) * 0.16;
        const btnH = Math.min(w, h) * 0.052;
        const btnRadius = btnH / 2;

        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = `600 ${Math.floor(Math.min(w, h) * 0.024)}px 'Space Grotesk', sans-serif`;

        // Overview Button (Inactive capsule background)
        const ovX = w / 2 - btnW / 2 - 10;
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(ovX - btnW / 2, tabY - btnH / 2, btnW, btnH, btnRadius);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = `${palette.active}70`;
        ctx.fillText("Overview", ovX, tabY);

        // Lyrics Button (Active capsule background)
        const lyX = w / 2 + btnW / 2 + 10;
        ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
        ctx.strokeStyle = `${palette.accent}60`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(lyX - btnW / 2, tabY - btnH / 2, btnW, btnH, btnRadius);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.fillText("Lyrics", lyX, tabY);

        // 2. Floating album cover art in top right
        const albumSize = Math.min(w, h) * 0.12;
        const albumX = w * 0.84 - albumSize / 2;
        const albumY = tabY - albumSize / 2;
        const albumRadius = 8;

        // Draw shadow backing
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#1e1b4b"; // Dark deep purple
        ctx.beginPath();
        ctx.roundRect(albumX, albumY, albumSize, albumSize, albumRadius);
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow

        // Draw a gorgeous abstract sunset inside
        const imgGrad = ctx.createLinearGradient(albumX, albumY, albumX + albumSize, albumY + albumSize);
        imgGrad.addColorStop(0, palette.active);
        imgGrad.addColorStop(1, palette.accent);
        ctx.fillStyle = imgGrad;
        ctx.beginPath();
        ctx.roundRect(albumX + 3, albumY + 3, albumSize - 6, albumSize - 6, albumRadius - 2);
        ctx.fill();

        // Draw a small record sticker overlapping
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.beginPath();
        ctx.arc(albumX + albumSize / 2, albumY + albumSize / 2, albumSize * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(albumX + albumSize / 2, albumY + albumSize / 2, albumSize * 0.06, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }

      case "suno-split-gradient": {
        // Horizontal split linear gradient
        const sunoGrad = ctx.createLinearGradient(0, 0, w, 0);
        if (palette.gradient && palette.gradient.length >= 2) {
          sunoGrad.addColorStop(0, palette.gradient[0]);
          sunoGrad.addColorStop(1, palette.gradient[1]);
        } else {
          sunoGrad.addColorStop(0, "#1e40af"); // Indigo
          sunoGrad.addColorStop(1, "#ea580c"); // Orange
        }
        ctx.fillStyle = sunoGrad;
        ctx.fillRect(0, 0, w, h);

        // Ambient particles
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10 || p.x > w + 10) p.vx *= -1;

          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.16})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        const isPortrait = h > w;
        
        // 1. Dynamic Song Info at top center
        const titleY = h * 0.13;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font = `600 ${Math.floor(Math.min(w, h) * 0.054)}px 'Playfair Display', serif`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 10;
        ctx.fillText(config?.songTitle || "Paper Hearts", w / 2, titleY);

        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = `500 ${Math.floor(Math.min(w, h) * 0.025)}px 'Inter', sans-serif`;
        ctx.shadowBlur = 5;
        ctx.fillText(`by ${config?.songArtist || "@cna78970"}`, w / 2, titleY + Math.min(w, h) * 0.05);
        ctx.restore();

        // 2. Centered Rounded Card with drop shadow
        ctx.save();
        const cardSize = Math.min(w, h) * (isPortrait ? 0.42 : 0.32);
        const cardX = w / 2 - cardSize / 2;
        const cardY = h / 2 - cardSize / 2 - (isPortrait ? h * 0.02 : h * 0.04);
        const cardRadius = 24;

        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardSize, cardSize, cardRadius);
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Clip and draw album artwork
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardSize, cardSize, cardRadius);
        ctx.clip();

        if (config && config.albumArtUrl && config.albumArtUrl.startsWith("data:")) {
          if (!(window as any).__albumArtImages) {
            (window as any).__albumArtImages = new Map();
          }
          let img = (window as any).__albumArtImages.get(config.albumArtUrl);
          if (!img) {
            img = new Image();
            img.src = config.albumArtUrl;
            img.onload = () => { (img as any).__loaded = true; };
            (window as any).__albumArtImages.set(config.albumArtUrl, img);
          }
          if ((img as any).__loaded || img.complete) {
            ctx.drawImage(img, cardX, cardY, cardSize, cardSize);
          } else {
            const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardSize, cardY + cardSize);
            grad.addColorStop(0, palette.accent);
            grad.addColorStop(1, palette.active);
            ctx.fillStyle = grad;
            ctx.fillRect(cardX, cardY, cardSize, cardSize);
          }
        } else if (config && config.albumArtUrl && config.albumArtUrl.startsWith("linear-gradient")) {
          const colors = config.albumArtUrl.match(/#[0-9a-fA-F]{6}/g) || [palette.accent, palette.active];
          const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardSize, cardY + cardSize);
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[1] || colors[0]);
          ctx.fillStyle = grad;
          ctx.fillRect(cardX, cardY, cardSize, cardSize);
        } else {
          const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardSize, cardY + cardSize);
          grad.addColorStop(0, palette.accent);
          grad.addColorStop(1, palette.active);
          ctx.fillStyle = grad;
          ctx.fillRect(cardX, cardY, cardSize, cardSize);
        }

        ctx.restore();

        // 3. Made With Suno visual indicator at bottom
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = `600 ${Math.floor(Math.min(w, h) * 0.022)}px 'Inter', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("MADE WITH SUNO", w / 2, h - 22);
        ctx.restore();
        break;
      }

      case "sonauto-midnight-glow": {
        // Deep midnight gradient background
        const sonautoGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
        sonautoGrad.addColorStop(0, `${palette.accent}20`); // Subtle soft central glow
        sonautoGrad.addColorStop(1, palette.bg);
        ctx.fillStyle = sonautoGrad;
        ctx.fillRect(0, 0, w, h);

        // Ambient particles
        for (const p of this.particles) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10 || p.x > w + 10) p.vx *= -1;

          ctx.fillStyle = `${palette.accent}${Math.floor(p.opacity * 90).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        const isPortrait = h > w;

        // 1. Watermark logo "Sonauto" at top center
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `${palette.active}50`;
        ctx.font = `600 ${Math.floor(Math.min(w, h) * 0.024)}px 'Outfit', sans-serif`;
        ctx.fillText("♫ SONAUTO", w / 2, h * 0.08);

        // 2. Centered metadata
        const metaY = h * 0.16;
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.floor(Math.min(w, h) * 0.052)}px 'Outfit', sans-serif`;
        ctx.fillText(config?.songTitle || "Basement Dreams", w / 2, metaY);

        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = `500 ${Math.floor(Math.min(w, h) * 0.026)}px 'Outfit', sans-serif`;
        ctx.fillText(`by ${config?.songArtist || "user56951c81"}`, w / 2, metaY + Math.min(w, h) * 0.045);
        ctx.restore();

        // 3. Central active glowing waveform
        const centerY = h * 0.44;
        ctx.save();
        ctx.strokeStyle = `${palette.active}dd`;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        const waveW = w * (isPortrait ? 0.75 : 0.5);
        const waveX = w / 2 - waveW / 2;
        const barCount = 35;
        const barW = waveW / barCount;
        for (let i = 0; i < barCount; i++) {
          const waveValue = Math.sin(time * 8 + i * 0.3) * Math.cos(time * 3 + i * 0.1) * 0.5 + 0.5;
          const barH = 5 + waveValue * 48;
          const x = waveX + i * barW + barW / 2;
          ctx.moveTo(x, centerY - barH / 2);
          ctx.lineTo(x, centerY + barH / 2);
        }
        ctx.stroke();
        ctx.restore();

        // 4. Seekbar at bottom
        const seekY = h * (isPortrait ? 0.83 : 0.85);
        const seekW = w * (isPortrait ? 0.80 : 0.55);
        const seekX = w / 2 - seekW / 2;
        const currentSongTime = time % 180;
        const progress = currentSongTime / 180;

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(seekX, seekY);
        ctx.lineTo(seekX + seekW, seekY);
        ctx.stroke();

        ctx.strokeStyle = palette.accent;
        ctx.beginPath();
        ctx.moveTo(seekX, seekY);
        ctx.lineTo(seekX + seekW * progress, seekY);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(seekX + seekW * progress, seekY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = `500 ${Math.floor(Math.min(w, h) * 0.024)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "left";
        const elapsedMin = Math.floor(currentSongTime / 60).toString().padStart(2, "0");
        const elapsedSec = Math.floor(currentSongTime % 60).toString().padStart(2, "0");
        ctx.fillText(`${elapsedMin}:${elapsedSec}`, seekX, seekY + 18);

        ctx.textAlign = "right";
        ctx.fillText("03:00", seekX + seekW, seekY + 18);
        ctx.restore();
        break;
      }

      default:
        break;
    }
  }
}

const bgState = new BackgroundState();

// Helper to wrap text into array of lines based on canvas width
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function getEnrichedLines(lines: LyricLine[]): LyricLine[] {
  if (lines.length === 0) {
    return [{
      text: "♪ Instrumental ♪",
      start: 0,
      end: 999999,
      words: [{ text: "♪ Instrumental ♪", start: 0, end: 999999 }]
    }];
  }

  // Deep-clone each line so we NEVER mutate the caller's original objects
  const sortedLines = [...lines]
    .sort((a, b) => a.start - b.start)
    .map(l => ({ ...l, words: l.words ? l.words.map(w => ({ ...w })) : [] }));

  for (let i = 0; i < sortedLines.length - 1; i++) {
    if (sortedLines[i].end > sortedLines[i + 1].start) {
      sortedLines[i].end = sortedLines[i + 1].start;
      sortedLines[i].words = sortedLines[i].words.map(w => {
        if (w.start >= sortedLines[i].end) {
          return { ...w, start: Math.max(sortedLines[i].start, sortedLines[i].end - 0.15), end: sortedLines[i].end };
        }
        if (w.end > sortedLines[i].end) {
          return { ...w, end: sortedLines[i].end };
        }
        return w;
      });
    }
  }

  const enriched: LyricLine[] = [];
  
  // 1. Intro (before first vocal start, minimum 1.5 seconds)
  if (sortedLines[0].start >= 1.5) {
    enriched.push({
      text: "♪ Instrumental ♪",
      start: 0,
      end: sortedLines[0].start,
      words: [{ text: "♪ Instrumental ♪", start: 0, end: sortedLines[0].start }]
    });
  }

  // 2. Body lines & breaks
  for (let i = 0; i < sortedLines.length; i++) {
    enriched.push(sortedLines[i]);
    
    if (i < sortedLines.length - 1) {
      const gap = sortedLines[i+1].start - sortedLines[i].end;
      if (gap >= 2.0) {
        enriched.push({
          text: "♪ Instrumental ♪",
          start: sortedLines[i].end,
          end: sortedLines[i+1].start,
          words: [{ text: "♪ Instrumental ♪", start: sortedLines[i].end, end: sortedLines[i+1].start }]
        });
      }
    }
  }

  // 3. Outro (after last vocal end)
  const lastEnd = sortedLines[sortedLines.length - 1].end;
  enriched.push({
    text: "♪ Instrumental ♪",
    start: lastEnd,
    end: 999999,
    words: [{ text: "♪ Instrumental ♪", start: lastEnd, end: 999999 }]
  });

  return enriched;
}

let _enrichedCache: { sourceLines: LyricLine[]; result: LyricLine[] } | null = null;

function getEnrichedLinesCached(lines: LyricLine[]): LyricLine[] {
  if (_enrichedCache && _enrichedCache.sourceLines === lines) {
    return _enrichedCache.result;
  }
  const result = getEnrichedLines(lines);
  _enrichedCache = { sourceLines: lines, result };
  return result;
}

let _albumArtCache: { url: string; image: HTMLImageElement } | null = null;

function getAlbumArtImageCached(url: string): HTMLImageElement {
  if (_albumArtCache && _albumArtCache.url === url) {
    return _albumArtCache.image;
  }
  const img = new Image();
  img.src = url;
  _albumArtCache = { url, image: img };
  return img;
}

export function drawFramedPosterLayout(
  ctx: CanvasRenderingContext2D,
  time: number,
  lines: LyricLine[],
  w: number,
  h: number,
  config: VideoConfig,
  template: Template
) {
  const palette = PALETTES.find(p => p.id === config.customPaletteId) || template.palette;
  const font = FONTS.find(f => f.id === config.customFontId) || template.font;

  // 1. Fill background with diagonal linear gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (palette.gradient && palette.gradient.length >= 2) {
    grad.addColorStop(0, palette.gradient[0]);
    grad.addColorStop(1, palette.gradient[1]);
  } else {
    grad.addColorStop(0, palette.bg);
    grad.addColorStop(1, "#000000");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. Draw config.songTitle and config.songArtist near the top
  const titleSize = Math.floor(h * 0.07);
  const artistSize = Math.floor(titleSize * 0.40);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titleY = h * 0.12;
  const artistY = titleY + titleSize * 0.9;

  ctx.font = `bold ${titleSize}px ${font.family}`;
  ctx.fillStyle = palette.active;
  ctx.fillText(config.songTitle || "Untitled", w / 2, titleY);

  ctx.font = `500 ${artistSize}px ${font.family}`;
  ctx.fillStyle = palette.text;
  ctx.fillText(config.songArtist || "Unknown Artist", w / 2, artistY);

  // 3. Draw album art rounded portrait rect
  let artworkWidth = Math.min(w * 0.45, h * 0.38);
  let artworkHeight = artworkWidth * 1.25; // 4:5 aspect ratio

  let artworkY = artistY + artistSize * 1.5;
  let lyricY = artworkY + artworkHeight + Math.min(w, h) * 0.08;

  if (!config.albumArtUrl) {
    lyricY = h * 0.55;
  } else {
    const artX = (w - artworkWidth) / 2;
    const artY = artworkY;

    // Draw shadow first
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(artX, artY, artworkWidth, artworkHeight, 24);
    ctx.fill();
    ctx.restore();

    // Draw image clipped
    const albumArtImage = getAlbumArtImageCached(config.albumArtUrl);
    if (albumArtImage && albumArtImage.complete && albumArtImage.naturalWidth !== 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artworkWidth, artworkHeight, 24);
      ctx.clip();
      ctx.drawImage(albumArtImage, artX, artY, artworkWidth, artworkHeight);
      ctx.restore();
    } else {
      // Draw placeholder gradient
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artworkWidth, artworkHeight, 24);
      ctx.clip();
      const artGrad = ctx.createLinearGradient(artX, artY, artX, artY + artworkHeight);
      artGrad.addColorStop(0, "#312e81");
      artGrad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = artGrad;
      ctx.fill();
      ctx.restore();
    }
  }

  // 4. Draw active lyric line
  const enrichedLines = getEnrichedLinesCached(lines);
  const activeLineIndex = enrichedLines.findIndex(l => time >= l.start && time <= l.end);
  const activeLine = activeLineIndex !== -1 ? enrichedLines[activeLineIndex] : null;

  if (activeLine && activeLine.text) {
    let baseSize = Math.floor(Math.min(w, h) * 0.055) * config.fontSizeMultiplier;
    const fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxTextWidth = w * 0.85;
    ctx.font = `bold ${baseSize}px ${fontFamily}`;
    const measuredWidth = ctx.measureText(activeLine.text).width;
    if (measuredWidth > maxTextWidth) {
      const scaleFactor = maxTextWidth / measuredWidth;
      baseSize = Math.floor(baseSize * scaleFactor);
    }
    baseSize = Math.max(baseSize, Math.floor(Math.min(w, h) * 0.02));

    ctx.font = `bold ${baseSize}px ${fontFamily}`;
    ctx.fillStyle = palette.active;
    ctx.fillText(activeLine.text, w / 2, lyricY);
  }

  // 5. Draw app branding at the bottom
  ctx.font = `500 ${Math.floor(Math.min(w, h) * 0.03)}px 'Inter', sans-serif`;
  ctx.fillStyle = `${palette.text}99`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Made with LyricSync AI", w / 2, h * 0.95);

  // 6. Apply post-process video filters
  applyVideoFilter(ctx, w, h, config, time);
}

export function drawPlayerCardLayout(
  ctx: CanvasRenderingContext2D,
  time: number,
  lines: LyricLine[],
  w: number,
  h: number,
  config: VideoConfig,
  template: Template,
  waveformPeaks?: number[]
) {
  const palette = PALETTES.find(p => p.id === config.customPaletteId) || template.palette;
  const font = FONTS.find(f => f.id === config.customFontId) || template.font;

  // 1. Fill background solid
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // 2. Draw config.songTitle and config.songArtist near the top-center
  const titleSize = Math.floor(h * 0.06);
  const artistSize = Math.floor(titleSize * 0.45);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `bold ${titleSize}px ${font.family}`;
  ctx.fillStyle = palette.active;
  ctx.fillText(config.songTitle || "Untitled", w / 2, h * 0.12);

  ctx.font = `500 ${artistSize}px ${font.family}`;
  ctx.fillStyle = palette.text;
  ctx.fillText(config.songArtist || "Unknown Artist", w / 2, h * 0.12 + titleSize * 0.9);

  // 3. Draw horizontal waveform visualization 1/3 down the canvas
  const enrichedLines = getEnrichedLinesCached(lines);
  const totalDuration = lines.length > 0 ? lines[lines.length - 1].end : 100;

  const peaks = (waveformPeaks && waveformPeaks.length > 0)
    ? waveformPeaks
    : Array.from({ length: 100 }, (_, i) => 0.15 + 0.7 * Math.abs(Math.sin(i * 0.15) * Math.cos(i * 0.05)));

  const waveformY = h / 3;
  const waveformWidth = w * 0.85;
  const waveformStartX = (w - waveformWidth) / 2;
  const maxBarHeight = h * 0.12;
  const barCount = peaks.length;
  const spacing = waveformWidth / barCount;
  const barWidth = Math.max(1.5, spacing * 0.7);

  const progress = Math.min(1, Math.max(0, time / totalDuration));
  const activeBarIndex = Math.floor(progress * barCount);

  for (let i = 0; i < barCount; i++) {
    const peak = peaks[i];
    const barHeight = peak * maxBarHeight;
    const x = waveformStartX + i * spacing + (spacing - barWidth) / 2;
    const y = waveformY - barHeight / 2;

    if (i <= activeBarIndex) {
      ctx.fillStyle = palette.active;
    } else {
      ctx.fillStyle = `${palette.text}59`; // 35% opacity
    }

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
    ctx.fill();
  }

  // 4. Draw stacked lyric lines below the waveform
  const activeIndex = enrichedLines.findIndex(l => time >= l.start && time <= l.end);
  const currentLine = activeIndex !== -1 ? enrichedLines[activeIndex] : null;
  const prevLine = activeIndex > 0 ? enrichedLines[activeIndex - 1] : null;
  const nextLine = (activeIndex !== -1 && activeIndex < enrichedLines.length - 1) ? enrichedLines[activeIndex + 1] : null;

  const startY = h * 0.55;
  const lineSpacing = h * 0.10;

  // Previous line
  if (prevLine) {
    let prevSize = Math.floor(h * 0.038) * config.fontSizeMultiplier;
    ctx.font = `italic 500 ${prevSize}px ${font.family}`;
    ctx.fillStyle = `${palette.text}70`;
    
    const maxW = w * 0.85;
    const measured = ctx.measureText(prevLine.text).width;
    if (measured > maxW) {
      prevSize = Math.floor(prevSize * (maxW / measured));
      ctx.font = `italic 500 ${prevSize}px ${font.family}`;
    }
    ctx.fillText(prevLine.text, w / 2, startY);
  }

  // Current line
  if (currentLine) {
    let currSize = Math.floor(h * 0.05) * config.fontSizeMultiplier;
    ctx.font = `bold ${currSize}px ${font.family}`;
    ctx.fillStyle = palette.active;
    
    const maxW = w * 0.85;
    const measured = ctx.measureText(currentLine.text).width;
    if (measured > maxW) {
      currSize = Math.floor(currSize * (maxW / measured));
      ctx.font = `bold ${currSize}px ${font.family}`;
    }
    ctx.fillText(currentLine.text, w / 2, startY + lineSpacing);
  }

  // Next line
  if (nextLine) {
    let nextSize = Math.floor(h * 0.038) * config.fontSizeMultiplier;
    ctx.font = `italic 500 ${nextSize}px ${font.family}`;
    ctx.fillStyle = `${palette.text}70`;
    
    const maxW = w * 0.85;
    const measured = ctx.measureText(nextLine.text).width;
    if (measured > maxW) {
      nextSize = Math.floor(nextSize * (maxW / measured));
      ctx.font = `italic 500 ${nextSize}px ${font.family}`;
    }
    ctx.fillText(nextLine.text, w / 2, startY + 2 * lineSpacing);
  }

  // 5. Apply post-process video filters
  applyVideoFilter(ctx, w, h, config, time);
}

// Master Kinetic Lyric Drawing Handler
export function drawLyrics(
  ctx: CanvasRenderingContext2D,
  time: number,
  lines: LyricLine[],
  w: number,
  h: number,
  config: VideoConfig,
  template: Template,
  waveformPeaks?: number[]
) {
  if (config.layoutMode === "framed-poster") {
    return drawFramedPosterLayout(ctx, time, lines, w, h, config, template);
  }
  if (config.layoutMode === "player-card") {
    return drawPlayerCardLayout(ctx, time, lines, w, h, config, template, waveformPeaks);
  }

  // Enrich original vocal timeline with instrumental placeholders to show "Instrumental" correctly
  const enrichedLines = getEnrichedLinesCached(lines);

  // Find currently active lyric line in the enriched list
  const activeLineIndex = enrichedLines.findIndex(l => time >= l.start && time <= l.end);
  const activeLine = activeLineIndex !== -1 ? enrichedLines[activeLineIndex] : null;

  const palette = PALETTES.find(p => p.id === config.customPaletteId) || template.palette;
  const font = FONTS.find(f => f.id === config.customFontId) || template.font;

  // Let's set the text sizing dynamically
  let baseSize = Math.floor(Math.min(w, h) * 0.055) * config.fontSizeMultiplier;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!activeLine) {
    const isSuno = config.backgroundEffect === "suno-split-gradient";
    const isSonauto = config.backgroundEffect === "sonauto-midnight-glow";
    if (config.showWaveform && !isSuno && !isSonauto) {
      drawSubtleWaveform(ctx, time, w, h, palette);
    }
    if (!isSuno && !isSonauto) {
      drawSongBranding(ctx, time, w, h, config, font, palette);
    }
    applyVideoFilter(ctx, w, h, config, time);
    return;
  }

  const maxTextWidth = w * 0.85; // 85% of canvas width, leaves padding

  ctx.font = `bold ${baseSize}px ${font.family}`;
  const measuredWidth = ctx.measureText(activeLine.text).width;
  if (measuredWidth > maxTextWidth) {
    const scaleFactor = maxTextWidth / measuredWidth;
    baseSize = Math.floor(baseSize * scaleFactor);
  }
  baseSize = Math.max(baseSize, Math.floor(Math.min(w, h) * 0.02));

  // Set selected font family
  ctx.font = `bold ${baseSize}px ${font.family}`;

  // Overwrite ctx.fillText to intercept and apply our style presets automatically!
  const originalFillText = ctx.fillText;
  ctx.fillText = function (text: string, x: number, y: number) {
    const isTranslucent = ctx.fillStyle && typeof ctx.fillStyle === "string" && (
      ctx.fillStyle.includes("rgba") ||
      ctx.fillStyle.endsWith("40") ||
      ctx.fillStyle.endsWith("60") ||
      ctx.fillStyle.endsWith("70") ||
      ctx.fillStyle.endsWith("ab") ||
      ctx.fillStyle.includes("0.35") ||
      ctx.fillStyle.includes("0.70") ||
      ctx.fillStyle.includes("0.40") ||
      ctx.fillStyle.includes("/60") ||
      ctx.fillStyle.includes("/40") ||
      ctx.fillStyle.includes("/70")
    );
    if (isTranslucent) {
      originalFillText.call(ctx, text, x, y);
    } else {
      renderStyledText(ctx, text, x, y, palette, config, true, originalFillText);
    }
  };

  const isSuno = config.backgroundEffect === "suno-split-gradient";
  const isSonauto = config.backgroundEffect === "sonauto-midnight-glow";
  
  ctx.save();
  if (isSuno) {
    ctx.translate(0, h * 0.28);
  } else if (isSonauto) {
    ctx.translate(0, h * 0.18);
  }

  try {
    // Execute custom typography animations based on selection
    switch (config.textAnimation) {
    case "progressive-wipe": {
      drawProgressiveWipe(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "horizontal-slide-stack": {
      drawHorizontalSlideStack(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "glitch-shake": {
      drawGlitchShake(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "cinematic-blur-fade": {
      drawCinematicBlurFade(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "word-zoom-in": {
      drawWordZoomIn(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "column-shift-up": {
      drawColumnShiftUp(ctx, time, enrichedLines, activeLineIndex, w, h, baseSize, palette, font.family);
      break;
    }

    case "character-bounce-type": {
      drawCharacterBounceType(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "digital-scramble": {
      drawDigitalScramble(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "wave-bobbing": {
      drawWaveBobbing(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "skew-slash-slide": {
      drawSkewSlashSlide(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "perspective-3d-scroll": {
      drawPerspective3DScroll(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "elastic-pop": {
      drawElasticPop(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "organic-liquid-draw": {
      drawOrganicLiquidDraw(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "exposure-dissolve": {
      drawExposureDissolve(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "strobe-center-pop": {
      drawStrobeCenterPop(ctx, time, activeLine, w, h, baseSize, palette, font.family);
      break;
    }

    case "vertical-elevator-track": {
      drawColumnShiftUp(ctx, time, enrichedLines, activeLineIndex, w, h, baseSize * 0.9, palette, font.family);
      break;
    }

    case "erratic-grunge-shake": {
      drawErraticGrungeShake(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "circular-helix-spin": {
      drawCircularHelixSpin(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "arcade-pixel-flicker": {
      drawArcadePixelFlicker(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "shimmer-golden-fades": {
      drawShimmerGoldenFades(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "chromatic-glitch": {
      drawChromaticGlitch(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "word-pop-highlight": {
      drawWordPopHighlight(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "handwritten-drift": {
      drawHandwrittenDrift(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    case "lofi-scratch": {
      drawLofiScratch(ctx, time, activeLine, w, h, baseSize, palette);
      break;
    }

    default:
      // Fallback simple centered draw
      ctx.fillStyle = palette.active;
      ctx.fillText(activeLine.text, w / 2, h / 2);
      break;
    }
  } finally {
    ctx.fillText = originalFillText;
    ctx.restore();
  }

  // Draw bottom visualizer if toggled on
  if (config.showWaveform && !isSuno && !isSonauto) {
    drawSubtleWaveform(ctx, time, w, h, palette);
  }

  // Draw Branding Overlay
  if (!isSuno && !isSonauto) {
    drawSongBranding(ctx, time, w, h, config, font, palette);
  }

  // Apply CapCut-style cinematic filters (vignette, light leak, vhs scanlines, film grain, rgb glitch)
  applyVideoFilter(ctx, w, h, config, time);
}

// Draw Song & Album Metadata/Branding Overlays
function drawSongBranding(
  ctx: CanvasRenderingContext2D,
  time: number,
  w: number,
  h: number,
  config: VideoConfig,
  font: FontOption,
  palette: ColorPalette
) {
  const style = config.metadataStyle || "none";
  if (style === "none") return;

  const title = (config.songTitle || "Midnight Mirage").trim();
  const artist = (config.songArtist || "The Midnight • Nocturnal").trim();

  ctx.save();

  // Helper to draw a circle for rotating album art (either an image or gradient)
  const drawAlbumArtCircle = (cx: number, cy: number, radius: number, rotation: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    if (config.albumArtUrl && config.albumArtUrl.startsWith("data:")) {
      if (!(window as any).__albumArtImages) {
        (window as any).__albumArtImages = new Map();
      }
      let img = (window as any).__albumArtImages.get(config.albumArtUrl);
      if (!img) {
        img = new Image();
        img.src = config.albumArtUrl;
        img.onload = () => {
          (img as any).__loaded = true;
        };
        (window as any).__albumArtImages.set(config.albumArtUrl, img);
      }

      if ((img as any).__loaded || img.complete) {
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
      } else {
        const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
        grad.addColorStop(0, palette.accent);
        grad.addColorStop(1, palette.active);
        ctx.fillStyle = grad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
    } else if (config.albumArtUrl && config.albumArtUrl.startsWith("linear-gradient")) {
      const colors = config.albumArtUrl.match(/#[0-9a-fA-F]{6}/g) || [palette.accent, palette.active];
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1] || colors[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    } else {
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      
      const diskGrad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
      diskGrad.addColorStop(0, "#222222");
      diskGrad.addColorStop(0.8, "#111111");
      diskGrad.addColorStop(1, "#000000");
      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let r = radius * 0.4; r < radius * 0.9; r += radius * 0.15) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      const labelGrad = ctx.createLinearGradient(-radius * 0.35, -radius * 0.35, radius * 0.35, radius * 0.35);
      labelGrad.addColorStop(0, palette.active);
      labelGrad.addColorStop(1, palette.accent);
      ctx.fillStyle = labelGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  if (style === "cinematic-intro") {
    const startFadeIn = 0;
    const endFadeIn = 1.0;
    const startFadeOut = 3.5;
    const endFadeOut = 4.8;

    if (time >= startFadeIn && time <= endFadeOut) {
      let opacity = 1.0;
      if (time < endFadeIn) {
        opacity = (time - startFadeIn) / (endFadeIn - startFadeIn);
      } else if (time > startFadeOut) {
        opacity = 1.0 - (time - startFadeOut) / (endFadeOut - startFadeOut);
      }
      opacity = Math.max(0, Math.min(1, opacity));

      ctx.globalAlpha = opacity;

      const introVignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.8);
      introVignette.addColorStop(0, "rgba(10, 15, 30, 0.0)");
      introVignette.addColorStop(1, `rgba(5, 5, 10, ${0.75 * opacity})`);
      ctx.fillStyle = introVignette;
      ctx.fillRect(0, 0, w, h);

      const isPortrait = h > w;
      const centerY = isPortrait ? h * 0.42 : h * 0.45;

      const titleSize = Math.floor(Math.min(w, h) * 0.052);
      ctx.font = `bold ${titleSize}px ${font.family}`;
      ctx.fillStyle = palette.active;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;
      ctx.fillText(title, w / 2, centerY);

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      const lineY = centerY + titleSize * 0.9;
      const lineWidth = Math.min(w * 0.55, ctx.measureText(title).width * 1.1 + 40);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * opacity})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w / 2 - lineWidth / 2, lineY);
      ctx.lineTo(w / 2 + lineWidth / 2, lineY);
      ctx.stroke();

      const artistSize = Math.floor(Math.min(w, h) * 0.024);
      ctx.font = `500 ${artistSize}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = `${palette.active}dd`;
      ctx.fillText(artist.toUpperCase(), w / 2, lineY + artistSize * 1.1);

      if (config.albumArtUrl) {
        const artSize = Math.floor(Math.min(w, h) * 0.12);
        const artY = centerY - titleSize * 1.6;
        drawAlbumArtCircle(w / 2, artY, artSize / 2, 0);
      }
    }
  }

  else if (style === "spinning-vinyl") {
    const isPortrait = h > w;
    const isSquare = w === h;
    
    let cardW = Math.min(w, h) * 0.46;
    let cardH = Math.min(w, h) * 0.11;
    let cardX = w * 0.05;
    let cardY = h * 0.05;

    if (isPortrait) {
      cardW = w * 0.72;
      cardH = h * 0.06;
      cardX = w * 0.14;
      cardY = h * 0.08;
    } else if (isSquare) {
      cardW = w * 0.48;
      cardH = h * 0.09;
      cardX = w * 0.06;
      cardY = h * 0.06;
    }

    cardW = Math.max(180, cardW);
    cardH = Math.max(45, cardH);

    ctx.fillStyle = "rgba(10, 15, 30, 0.45)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardH / 2);
    ctx.fill();
    ctx.stroke();

    const diskRadius = cardH * 0.41;
    const diskX = cardX + cardH * 0.5;
    const diskY = cardY + cardH * 0.5;
    const rotationSpeed = (Math.PI * 2) * (time / 6.0);
    drawAlbumArtCircle(diskX, diskY, diskRadius, rotationSpeed);

    const textLeft = diskX + diskRadius + 10;
    const textMaxWidth = cardX + cardW - textLeft - 10;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const titleSize = Math.floor(cardH * 0.28);
    ctx.font = `bold ${titleSize}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = palette.active;
    
    let dispTitle = title;
    if (ctx.measureText(dispTitle).width > textMaxWidth) {
      while (ctx.measureText(dispTitle + "...").width > textMaxWidth && dispTitle.length > 2) {
        dispTitle = dispTitle.substring(0, dispTitle.length - 1);
      }
      dispTitle += "...";
    }
    ctx.fillText(dispTitle, textLeft, cardY + cardH * 0.32);

    const artistSize = Math.floor(cardH * 0.20);
    ctx.font = `500 ${artistSize}px 'Inter', sans-serif`;
    ctx.fillStyle = `${palette.active}aa`;
    
    let dispArtist = artist;
    if (ctx.measureText(dispArtist).width > textMaxWidth) {
      while (ctx.measureText(dispArtist + "...").width > textMaxWidth && dispArtist.length > 2) {
        dispArtist = dispArtist.substring(0, dispArtist.length - 1);
      }
      dispArtist += "...";
    }
    ctx.fillText(dispArtist, textLeft, cardY + cardH * 0.68);
  }

  else if (style === "elegant-banner") {
    const bannerH = Math.floor(h * 0.06);
    const bannerY = h - bannerH;

    ctx.fillStyle = "rgba(10, 15, 30, 0.7)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.fillRect(0, bannerY, w, bannerH);
    ctx.beginPath();
    ctx.moveTo(0, bannerY);
    ctx.lineTo(w, bannerY);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const infoText = `NOW PLAYING: ${title.toUpperCase()}  •  ${artist.toUpperCase()}`;
    const infoSize = Math.floor(bannerH * 0.35);
    ctx.font = `600 ${infoSize}px 'Fira Code', 'JetBrains Mono', monospace`;
    ctx.fillStyle = palette.active;

    const textW = ctx.measureText(infoText).width;
    ctx.fillText(infoText, w / 2, bannerY + bannerH / 2);

    const drawMicroEq = (x: number) => {
      ctx.save();
      ctx.fillStyle = palette.accent;
      const barW = 3;
      const barSpacing = 2.5;
      const barsCount = 3;
      const startX = x - ((barW + barSpacing) * barsCount) / 2;
      for (let i = 0; i < barsCount; i++) {
        const wave = Math.sin(time * 12 + i * 1.5) * 0.5 + 0.5;
        const barH = 4 + wave * 10;
        ctx.fillRect(startX + i * (barW + barSpacing), bannerY + bannerH / 2 - barH / 2, barW, barH);
      }
      ctx.restore();
    };

    drawMicroEq(w / 2 - textW / 2 - 20);
    drawMicroEq(w / 2 + textW / 2 + 20);
  }

  ctx.restore();
}

// Draw a elegant bottom waveform
function drawSubtleWaveform(
  ctx: CanvasRenderingContext2D,
  time: number,
  w: number,
  h: number,
  palette: ColorPalette
) {
  ctx.save();
  ctx.strokeStyle = `${palette.accent}80`;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  
  const barCount = 40;
  const centerY = h * 0.92;
  const maxBarH = h * 0.05;
  const gap = w / barCount;

  for (let i = 0; i < barCount; i++) {
    // Generate reactive simulated waveform heights
    const offset = i * 0.2 + time * 8;
    const waveValue = Math.sin(offset) * 0.4 + Math.cos(offset * 2.3) * 0.4 + Math.sin(offset * 4.1) * 0.2;
    const barHeight = Math.max(3, Math.abs(waveValue) * maxBarH);
    const x = i * gap + gap / 2;

    ctx.beginPath();
    ctx.moveTo(x, centerY - barHeight / 2);
    ctx.lineTo(x, centerY + barHeight / 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 1. Progressive Wipe Draw
function drawProgressiveWipe(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const lineDuration = line.end - line.start;
  const lineElapsed = time - line.start;
  const progress = Math.max(0, Math.min(1, lineElapsed / lineDuration));

  // Render original base inactive text
  ctx.fillStyle = `${palette.text}70`;
  ctx.fillText(text, w / 2, h / 2);

  // Render clipping wipe overlay for active portion
  ctx.save();
  const textWidth = ctx.measureText(text).width;
  const wipeX = w / 2 - textWidth / 2;
  const wipeWidth = textWidth * progress;

  ctx.beginPath();
  ctx.rect(wipeX, h / 2 - size, wipeWidth, size * 2);
  ctx.clip();

  ctx.fillStyle = palette.active;
  ctx.fillText(text, w / 2, h / 2);
  ctx.restore();
}

// 2. Horizontal slide stack
function drawHorizontalSlideStack(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const words = line.words;
  if (!words || words.length === 0) return;

  ctx.save();
  
  // First calculate overall text structure
  let totalWidth = 0;
  const wordWidths = words.map(wd => {
    const wdWidth = ctx.measureText(wd.text + " ").width;
    totalWidth += wdWidth;
    return wdWidth;
  });

  let startX = w / 2 - totalWidth / 2;
  const centerY = h / 2;

  words.forEach((wd, idx) => {
    const isPast = time >= wd.start;
    const isActive = time >= wd.start && time <= wd.end;
    const wdWidth = wordWidths[idx];

    ctx.save();
    if (isActive) {
      // Small scale pop on activation
      const wordProgress = (time - wd.start) / (wd.end - wd.start);
      const scale = 1.0 + Math.max(0, Math.sin(wordProgress * Math.PI) * 0.15);
      
      ctx.translate(startX + wdWidth / 2, centerY);
      ctx.scale(scale, scale);
      ctx.fillStyle = palette.active;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 10;
      ctx.fillText(wd.text, 0, 0);
    } else {
      ctx.fillStyle = isPast ? `${palette.active}ab` : `${palette.text}60`;
      ctx.fillText(wd.text, startX + wdWidth / 2, centerY);
    }
    ctx.restore();

    startX += wdWidth;
  });

  ctx.restore();
}

// 3. Glitch Shake
function drawGlitchShake(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const centerY = h / 2;
  const centerX = w / 2;

  // Let's create an intermittent glitch cycle
  const isGlitched = Math.floor(time * 15) % 8 === 0;

  if (isGlitched) {
    ctx.save();
    const shiftX = (Math.random() - 0.5) * 15;
    const shiftY = (Math.random() - 0.5) * 10;

    // Cyan glitch offset shadow
    ctx.fillStyle = palette.accent;
    ctx.fillText(text, centerX + shiftX, centerY + shiftY);

    // Red glitch offset shadow
    ctx.fillStyle = "#ff0055";
    ctx.fillText(text, centerX - shiftX, centerY - shiftY);

    // Main active text
    ctx.fillStyle = palette.active;
    ctx.fillText(text, centerX + (Math.random() - 0.5) * 4, centerY);
    ctx.restore();
  } else {
    ctx.fillStyle = palette.active;
    ctx.fillText(text, centerX, centerY);
  }
}

// 4. Cinematic Blur-Fade
function drawCinematicBlurFade(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const lineDuration = line.end - line.start;
  const lineElapsed = time - line.start;

  let alpha = 1;
  let blur = 0;
  let scale = 1.0;

  // Entrance transition (first 0.4s)
  if (lineElapsed < 0.4) {
    const t = lineElapsed / 0.4;
    alpha = t;
    blur = (1 - t) * 20;
    scale = 1.15 - t * 0.15;
  } 
  // Exit transition (last 0.4s)
  else if (line.end - time < 0.4) {
    const t = (line.end - time) / 0.4;
    alpha = t;
    blur = (1 - t) * 20;
    scale = 1.0 + (1 - t) * 0.15;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0) {
    // Optimized: Cap blur to a safe 6px max to prevent GPU bottlenecks, and completely bypass on mobile devices to prevent tab crashes
    const isMobileCheck = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobileCheck) {
      ctx.filter = `blur(${Math.min(6, Math.floor(blur))}px)`;
    }
  }
  
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = palette.active;
  ctx.fillText(line.text, 0, 0);
  ctx.restore();
}

// 5. Word Zoom In
function drawWordZoomIn(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const words = line.words;
  if (!words || words.length === 0) return;

  // Render inactive baseline line of text
  ctx.fillStyle = `${palette.text}40`;
  ctx.fillText(line.text, w / 2, h / 2);

  // Find active word
  const activeWord = words.find(wd => time >= wd.start && time <= wd.end);
  if (!activeWord) return;

  // Draw active zooming word overlay
  const wordIdx = words.indexOf(activeWord);
  
  // Measure lengths to find correct horizontal position
  let leadingWidth = 0;
  const leadingText = words.slice(0, wordIdx).map(w => w.text).join(" ") + (wordIdx > 0 ? " " : "");
  const fullText = line.text;

  const totalWidth = ctx.measureText(fullText).width;
  const leadWidth = ctx.measureText(leadingText).width;
  const activeWordWidth = ctx.measureText(activeWord.text).width;

  const wordX = w / 2 - totalWidth / 2 + leadWidth + activeWordWidth / 2;

  // Elastic zoom math
  const elapsed = time - activeWord.start;
  const dur = activeWord.end - activeWord.start;
  const t = Math.min(1, elapsed / 0.25); // first 0.25s of word
  const scale = 2.0 - 1.0 * Math.sin(t * Math.PI * 0.5); // bounce curve

  ctx.save();
  ctx.translate(wordX, h / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.active;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 15;
  ctx.fillText(activeWord.text, 0, 0);
  ctx.restore();
}

// 6. Column Shift Up
function drawColumnShiftUp(
  ctx: CanvasRenderingContext2D,
  time: number,
  lines: LyricLine[],
  activeIndex: number,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette,
  fontFamily?: string
) {
  const activeLine = lines[activeIndex];
  const centerY = h / 2;
  const stepY = size * 1.5;

  // Transition scroll offset
  const transitionDur = 0.35;
  let scrollOffset = 0;
  if (time - activeLine.start < transitionDur) {
    const t = (time - activeLine.start) / transitionDur;
    // Ease cubic-out
    scrollOffset = (1 - Math.pow(1 - t, 3)) * stepY - stepY;
  }

  const renderLine = (lineIdx: number, posY: number, active: boolean) => {
    if (lineIdx < 0 || lineIdx >= lines.length) return;
    const line = lines[lineIdx];

    ctx.save();
    if (active) {
      ctx.fillStyle = palette.active;
      ctx.font = `bold ${size * 1.05}px ${fontFamily || "sans-serif"}`;
    } else {
      ctx.fillStyle = `${palette.text}60`;
      ctx.font = `bold ${size * 0.85}px ${fontFamily || "sans-serif"}`;
    }
    ctx.fillText(line.text, w / 2, posY + scrollOffset);
    ctx.restore();
  };

  // Draw previous 2 lines
  renderLine(activeIndex - 2, centerY - stepY * 2, false);
  renderLine(activeIndex - 1, centerY - stepY, false);

  // Draw current line
  renderLine(activeIndex, centerY, true);

  // Draw next 2 lines
  renderLine(activeIndex + 1, centerY + stepY, false);
  renderLine(activeIndex + 2, centerY + stepY * 2, false);
}

// 7. Character Bounce Type
function drawCharacterBounceType(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const chars = text.split("");
  const duration = line.end - line.start;
  const elapsed = time - line.start;

  // Let's divide duration across characters
  const charProgress = elapsed / duration;
  const charCountToDraw = Math.floor(chars.length * charProgress);

  let startX = w / 2 - ctx.measureText(text).width / 2;
  const centerY = h / 2;

  chars.forEach((char, idx) => {
    const charWidth = ctx.measureText(char).width;
    const hasTyped = idx <= charCountToDraw;

    if (hasTyped) {
      ctx.save();
      
      // Animation pop when typed
      let offsetYSprung = 0;
      if (idx === charCountToDraw) {
        const bouncePhase = ((elapsed / duration) * chars.length) % 1;
        offsetYSprung = -15 * Math.sin(bouncePhase * Math.PI);
      }

      ctx.fillStyle = palette.active;
      ctx.fillText(char, startX + charWidth / 2, centerY + offsetYSprung);
      ctx.restore();
    } else {
      ctx.fillStyle = `${palette.text}20`;
      ctx.fillText(char, startX + charWidth / 2, centerY);
    }
    startX += charWidth;
  });
}

// 8. Digital Scramble
function drawDigitalScramble(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const words = line.words;
  if (!words || words.length === 0) {
    ctx.fillStyle = palette.active;
    ctx.fillText(line.text, w / 2, h / 2);
    return;
  }

  // Draw active scrambling word overlay
  let totalWidth = 0;
  const wordWidths = words.map(wd => {
    const wdWidth = ctx.measureText(wd.text + " ").width;
    totalWidth += wdWidth;
    return wdWidth;
  });

  let startX = w / 2 - totalWidth / 2;
  const centerY = h / 2;

  words.forEach((wd, idx) => {
    const wdWidth = wordWidths[idx];
    const isPast = time >= wd.start;
    const isActive = time >= wd.start && time <= wd.end;

    if (isActive) {
      // Scramble letters randomly
      const rawText = wd.text;
      const scrambledText = rawText.split("").map((char, charIdx) => {
        if (Math.random() < 0.3) {
          const scrambleChars = "01$#@%&ZX!/?=";
          return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }
        return char;
      }).join("");

      ctx.fillStyle = palette.accent;
      ctx.fillText(scrambledText, startX + wdWidth / 2, centerY);
    } else {
      ctx.fillStyle = isPast ? palette.active : `${palette.text}40`;
      ctx.fillText(wd.text, startX + wdWidth / 2, centerY);
    }

    startX += wdWidth;
  });
}

// 9. Wave Bobbing
function drawWaveBobbing(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const words = line.words;
  if (!words || words.length === 0) {
    ctx.fillStyle = palette.active;
    ctx.fillText(line.text, w / 2, h / 2);
    return;
  }

  let totalWidth = 0;
  const wordWidths = words.map(wd => {
    const wdWidth = ctx.measureText(wd.text + " ").width;
    totalWidth += wdWidth;
    return wdWidth;
  });

  let startX = w / 2 - totalWidth / 2;
  const centerY = h / 2;

  words.forEach((wd, idx) => {
    const wdWidth = wordWidths[idx];
    const isPast = time >= wd.start;
    const isActive = time >= wd.start && time <= wd.end;

    // Bobbing offset
    const phase = time * 5 + idx * 0.8;
    const bobY = Math.sin(phase) * 12;

    ctx.save();
    ctx.fillStyle = isActive ? palette.active : (isPast ? `${palette.active}b3` : `${palette.text}40`);
    if (isActive) {
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 10;
    }
    ctx.fillText(wd.text, startX + wdWidth / 2, centerY + bobY);
    ctx.restore();

    startX += wdWidth;
  });
}

// 10. Skew Slash Slide
function drawSkewSlashSlide(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const lineElapsed = time - line.start;
  const lineDuration = line.end - line.start;

  let slideX = 0;
  if (lineElapsed < 0.25) {
    const t = lineElapsed / 0.25;
    // Fast cubic out
    slideX = (1 - Math.pow(1 - t, 3)) * w * 0.6 - w * 0.6;
  } else if (line.end - time < 0.2) {
    const t = (line.end - time) / 0.2;
    // Fast cubic in
    slideX = w * 0.6 - t * w * 0.6;
  }

  ctx.save();
  ctx.translate(w / 2 + slideX, h / 2);
  ctx.transform(1, 0, -0.25, 1, 0, 0); // Apply skewed slant

  // Draw slash trail shadow
  ctx.fillStyle = `${palette.accent}40`;
  ctx.fillText(line.text, -12, 10);

  ctx.fillStyle = palette.active;
  ctx.fillText(line.text, 0, 0);
  ctx.restore();
}

// 11. Perspective 3D Scroll
function drawPerspective3DScroll(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const elapsed = time - line.start;
  const duration = line.end - line.start;
  const progress = elapsed / duration;

  // Classic scrolling up perspective
  const startY = h * 0.8;
  const endY = h * 0.25;
  const currentY = startY + progress * (endY - startY);

  // Depth scaling
  const normalizedY = (currentY - h * 0.25) / (h * 0.55); // 0 (top) to 1 (bottom)
  const perspectiveScale = 0.35 + normalizedY * 1.25;
  const alpha = Math.min(1, normalizedY * 2.5);

  ctx.save();
  ctx.translate(w / 2, currentY);
  ctx.scale(perspectiveScale, perspectiveScale);
  ctx.fillStyle = palette.active;
  ctx.globalAlpha = alpha;
  
  // Custom font size based on scale
  ctx.fillText(line.text, 0, 0);
  ctx.restore();
}

// 12. Elastic Pop
function drawElasticPop(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const elapsed = time - line.start;
  let scale = 1.0;

  if (elapsed < 0.4) {
    // Back elastic easing math
    const t = elapsed / 0.4;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    scale = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.active;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 12;
  ctx.fillText(line.text, 0, 0);
  ctx.restore();
}

// 13. Organic Liquid Draw
function drawOrganicLiquidDraw(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const elapsed = time - line.start;
  const progress = Math.min(1, elapsed / 0.5);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  // Draw liquid bubble under text
  ctx.fillStyle = `${palette.accent}20`;
  const liquidRadius = ctx.measureText(text).width * 0.55;
  ctx.beginPath();
  ctx.arc(0, 0, liquidRadius * progress, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.active;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// 14. Exposure Dissolve
function drawExposureDissolve(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const elapsed = time - line.start;
  const duration = line.end - line.start;

  let brightness = 0;
  let alpha = 1;

  if (elapsed < 0.3) {
    const t = elapsed / 0.3;
    brightness = (1 - t) * 80;
  } else if (line.end - time < 0.3) {
    const t = (line.end - time) / 0.3;
    alpha = t;
    brightness = (1 - t) * 120;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = brightness;

  ctx.fillStyle = palette.active;
  ctx.fillText(line.text, w / 2, h / 2);
  ctx.restore();
}

// 15. Strobe Center Pop (One Word at a Time)
function drawStrobeCenterPop(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette,
  fontFamily?: string
) {
  const words = line.words;
  if (!words || words.length === 0) {
    ctx.fillStyle = palette.active;
    ctx.fillText(line.text, w / 2, h / 2);
    return;
  }

  const activeWord = words.find(wd => time >= wd.start && time <= wd.end) || words[0];
  const elapsed = time - activeWord.start;

  ctx.save();
  
  // Radial flashing flare
  const flareRadius = size * 1.5 * Math.max(0, 1 - elapsed * 4);
  if (flareRadius > 0) {
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, flareRadius);
    grad.addColorStop(0, `${palette.active}50`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w/2, h/2, flareRadius, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle = palette.active;
  ctx.font = `bold ${size * 1.4}px ${fontFamily || "sans-serif"}`;
  ctx.fillText(activeWord.text.toUpperCase(), w / 2, h / 2);
  ctx.restore();
}

// 16. Erratic Grunge Shake
function drawErraticGrungeShake(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const chars = text.split("");
  let startX = w / 2 - ctx.measureText(text).width / 2;
  const centerY = h / 2;

  chars.forEach((char, idx) => {
    const charWidth = ctx.measureText(char).width;
    const randomRot = (Math.random() - 0.5) * 0.15;
    const shakeY = (Math.random() - 0.5) * 10;
    const shakeX = (Math.random() - 0.5) * 8;

    ctx.save();
    ctx.translate(startX + charWidth / 2 + shakeX, centerY + shakeY);
    ctx.rotate(randomRot);

    ctx.fillStyle = palette.active;
    ctx.fillText(char, 0, 0);
    ctx.restore();

    startX += charWidth;
  });
}

// 17. Circular Helix Spin
function drawCircularHelixSpin(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const chars = text.split("");
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = Math.min(w, h) * 0.22;

  chars.forEach((char, idx) => {
    // Distribute characters around circle
    const baseAngle = (idx / chars.length) * Math.PI * 1.6 - Math.PI * 0.8;
    const rotationSpeed = time * 0.5;
    const finalAngle = baseAngle + rotationSpeed;

    const x = centerX + Math.cos(finalAngle) * radius;
    const y = centerY + Math.sin(finalAngle) * radius * 0.65; // oval perspective

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(finalAngle + Math.PI / 2);
    ctx.fillStyle = palette.active;
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });
}

// 18. Arcade Pixel Flicker
function drawArcadePixelFlicker(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  ctx.save();
  // Flickering simulation
  const flicker = Math.random() < 0.08 ? 0.3 : 1;
  ctx.globalAlpha = flicker;

  ctx.fillStyle = palette.active;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 12;
  ctx.fillText(line.text, w / 2, h / 2);
  ctx.restore();
}

// 19. Shimmer Golden Fades
function drawShimmerGoldenFades(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const centerY = h / 2;
  const centerX = w / 2;

  ctx.save();
  
  // Create gorgeous golden shifting linear gradient
  const textWidth = ctx.measureText(text).width;
  const shift = (time * 180) % (textWidth * 2) - textWidth;
  const grad = ctx.createLinearGradient(centerX - textWidth/2 + shift, 0, centerX + textWidth/2 + shift, 0);
  
  grad.addColorStop(0, "#d4af37"); // Gold
  grad.addColorStop(0.3, "#f3e5ab"); // Soft gold shine
  grad.addColorStop(0.5, "#ffffff"); // Highlight white shine
  grad.addColorStop(0.7, "#f3e5ab");
  grad.addColorStop(1, "#d4af37");

  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(212, 175, 55, 0.4)";
  ctx.shadowBlur = 15;
  ctx.fillText(text, centerX, centerY);
  
  ctx.restore();
}

// 20. Chromatic Glitch Aberration
function drawChromaticGlitch(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const centerY = h / 2;
  const centerX = w / 2;

  const offsetAmount = Math.sin(time * 30) * Math.cos(time * 45) * 4;
  const isGlitched = Math.floor(time * 12) % 6 === 0;

  ctx.save();
  if (isGlitched) {
    ctx.fillStyle = "#ff0000";
    ctx.fillText(text, centerX - offsetAmount - 2, centerY + (Math.random() - 0.5) * 2);

    ctx.fillStyle = "#00ffff";
    ctx.fillText(text, centerX + offsetAmount + 2, centerY + (Math.random() - 0.5) * 2);

    ctx.fillStyle = palette.active;
    ctx.fillText(text, centerX + (Math.random() - 0.5) * 2, centerY);
  } else {
    ctx.fillStyle = palette.active;
    ctx.fillText(text, centerX, centerY);
  }
  ctx.restore();
}

// 21. Word Pop Highlight
function drawWordPopHighlight(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const words = line.words;
  if (!words || words.length === 0) {
    ctx.fillStyle = palette.active;
    ctx.fillText(line.text, w / 2, h / 2);
    return;
  }

  let totalWidth = 0;
  const wordWidths = words.map(wd => {
    const wdWidth = ctx.measureText(wd.text + " ").width;
    totalWidth += wdWidth;
    return wdWidth;
  });

  let startX = w / 2 - totalWidth / 2;
  const centerY = h / 2;

  words.forEach((wd, idx) => {
    const isPast = time >= wd.start;
    const isActive = time >= wd.start && time <= wd.end;
    const wdWidth = wordWidths[idx];

    ctx.save();
    if (isActive) {
      const elapsed = time - wd.start;
      const wordProgress = elapsed / (wd.end - wd.start);
      const scale = 1.0 + Math.max(0, Math.sin(wordProgress * Math.PI) * 0.25);
      
      const pulseRadius = (wdWidth * 0.5) * (1.0 + elapsed * 1.5);
      if (elapsed < 0.4) {
        ctx.save();
        ctx.strokeStyle = `${palette.accent}${Math.floor((1 - elapsed * 2.5) * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(startX + wdWidth / 2, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.translate(startX + wdWidth / 2, centerY);
      ctx.scale(scale, scale);
      ctx.fillStyle = palette.active;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 15;
      ctx.fillText(wd.text, 0, 0);
    } else {
      ctx.fillStyle = isPast ? `${palette.active}90` : `${palette.text}50`;
      ctx.fillText(wd.text, startX + wdWidth / 2, centerY);
    }
    ctx.restore();

    startX += wdWidth;
  });
}

// 22. Handwritten Drift
function drawHandwrittenDrift(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const centerY = h / 2;
  const centerX = w / 2;

  const driftX = Math.sin(time * 1.5) * 15;
  const driftY = Math.cos(time * 1.2) * 10;
  const driftRot = Math.sin(time * 0.8) * 0.05;

  ctx.save();
  ctx.translate(centerX + driftX, centerY + driftY);
  ctx.rotate(driftRot);
  ctx.fillStyle = palette.active;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// 23. Lofi Scratch
function drawLofiScratch(
  ctx: CanvasRenderingContext2D,
  time: number,
  line: LyricLine,
  w: number,
  h: number,
  size: number,
  palette: ColorPalette
) {
  const text = line.text;
  const chars = text.split("");
  let startX = w / 2 - ctx.measureText(text).width / 2;
  const centerY = h / 2;

  chars.forEach((char, idx) => {
    const charWidth = ctx.measureText(char).width;
    const seed = Math.sin(time * 60 + idx);
    const jitterX = seed * 1.5;
    const jitterY = Math.cos(time * 50 + idx) * 1.5;
    const jitterRot = seed * 0.04;

    ctx.save();
    ctx.translate(startX + charWidth / 2 + jitterX, centerY + jitterY);
    ctx.rotate(jitterRot);
    ctx.fillStyle = palette.active;
    
    if (Math.sin(time * 20 + idx) > 0.8) {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1;
      ctx.strokeText(char, 0, 0);
    } else {
      ctx.fillText(char, 0, 0);
    }
    ctx.restore();

    startX += charWidth;
  });
}

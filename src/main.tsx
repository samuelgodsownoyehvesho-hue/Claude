import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill for CanvasRenderingContext2D.roundRect to support older or headless browser engines
if (typeof window !== "undefined" && typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: any
  ) {
    let radii: number[] = [0, 0, 0, 0];
    if (typeof r === "number") {
      radii = [r, r, r, r];
    } else if (Array.isArray(r)) {
      if (r.length === 1) radii = [r[0], r[0], r[0], r[0]];
      else if (r.length === 2) radii = [r[0], r[1], r[0], r[1]];
      else if (r.length === 3) radii = [r[0], r[1], r[2], r[1]];
      else if (r.length >= 4) radii = [r[0], r[1], r[2], r[3]];
    }
    
    this.beginPath();
    this.moveTo(x + radii[0], y);
    this.lineTo(x + w - radii[1], y);
    this.quadraticCurveTo(x + w, y, x + w, y + radii[1]);
    this.lineTo(x + w, y + h - radii[2]);
    this.quadraticCurveTo(x + w, y + h, x + w - radii[2], y + h);
    this.lineTo(x + radii[3], y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radii[3]);
    this.lineTo(x, y + radii[0]);
    this.quadraticCurveTo(x, y, x + radii[0], y);
    this.closePath();
    return this;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

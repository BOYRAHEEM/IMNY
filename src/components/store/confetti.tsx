"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#c8f24a", "#8b5cf6", "#14120f", "#c8f24a", "#8b5cf6"];
const DURATION = 4200;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  wobble: number;
  color: string;
  round: boolean;
};

/**
 * One burst of confetti over the page. Fires once per `onceKey` (remembered
 * in localStorage), so reopening the order link later doesn't replay it.
 * Skipped entirely for visitors who prefer reduced motion.
 */
export function Confetti({ onceKey }: { onceKey?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    // Early exits leave an empty canvas that ignores taps; harmless.
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = onceKey ? `imny-confetti:${onceKey}` : null;
    try {
      if (key && window.localStorage.getItem(key)) return;
    } catch {
      // Storage blocked: celebrate anyway.
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = w < 640 ? 110 : 180;
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      // Two cannons in the bottom corners, aimed up and inwards.
      const left = i % 2 === 0;
      const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
      const speed = (0.55 + Math.random() * 0.5) * Math.max(h, 520) * 0.028;
      return {
        x: left ? -10 : w + 10,
        y: h * 0.85,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        wobble: Math.random() * Math.PI * 2,
        color: COLORS[i % COLORS.length],
        round: Math.random() < 0.25,
      };
    });

    let frame = 0;
    let saved = false;
    const start = performance.now();
    const tick = (now: number) => {
      if (key && !saved) {
        // Remembered only once it actually plays (dev mode mounts effects twice).
        saved = true;
        try {
          window.localStorage.setItem(key, "1");
        } catch {}
      }
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = t > DURATION - 900 ? Math.max(0, (DURATION - t) / 900) : 1;
      for (const p of pieces) {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.32;
        p.wobble += 0.12;
        p.x += p.vx + Math.sin(p.wobble) * 0.6;
        p.y += p.vy;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Flip effect: squash the height as the piece "turns".
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.wobble));
        }
        ctx.restore();
      }
      if (t < DURATION) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [onceKey]);

  if (done) return null;
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}

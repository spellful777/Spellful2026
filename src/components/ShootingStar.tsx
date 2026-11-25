/**
 * ShootingStar — canvas-based realistic meteor animation.
 *
 * Technique:
 *   - requestAnimationFrame loop drives a head along a straight diagonal path.
 *   - Each frame the head's position is pushed onto a trail buffer.
 *   - The trail is drawn as a series of line segments whose width and opacity
 *     taper from the head (bright, wide) toward the tail (transparent, thin).
 *   - A small radial glow is composited at the head position.
 *   - Phases: ENTER (head fades in) → TRAVEL → EXIT (head dims, trail dissolves).
 *
 * Constraints:
 *   - Pointer-events none, z-index 0, behind all content.
 *   - Respects prefers-reduced-motion (no animation at all).
 *   - Cleans up RAF + timers on unmount.
 *   - No external libraries.
 */
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

interface ShootingStarProps {
  /** Delay in ms before the first shot fires (default 800) */
  initialDelay?: number;
  /** Min ms between replays (default 30000) */
  replayMin?: number;
  /** Max ms between replays (default 60000) */
  replayMax?: number;
}

// ─── Trail sample ─────────────────────────────────────────────────────────────
interface Sample {
  x: number;
  y: number;
  t: number; // timestamp ms
}

// ─── Animation constants ──────────────────────────────────────────────────────
const TRAIL_DURATION_MS = 320;   // how long a sample stays in the trail
const HEAD_RADIUS       = 2.2;   // px — bright leading dot
const TRAIL_MAX_WIDTH   = 2.0;   // px — widest part of trail (just behind head)
const TRAVEL_DURATION   = 680;   // ms — head travels across the path
const ENTER_DURATION    = 80;    // ms — head fades in
const EXIT_DURATION     = 180;   // ms — head dims; trail dissolves after

export default function ShootingStar({
  initialDelay = 800,
  replayMin    = 30000,
  replayMax    = 60000,
}: ShootingStarProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef     = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Core animation ──────────────────────────────────────────────────────────
  function runMeteor() {
    const canvas = canvasRef.current;
    if (!canvas || !mountedRef.current) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    const ctx = context;

    const W = canvas.width;
    const H = canvas.height;

    // Pick a random start in the upper-left quadrant, end in the lower-right.
    // Angle is naturally diagonal (roughly 25–40°).
    const startX = W * (0.05 + Math.random() * 0.25);
    const startY = H * (0.04 + Math.random() * 0.18);
    const travelX = W * (0.45 + Math.random() * 0.25);
    const travelY = H * (0.18 + Math.random() * 0.14);
    const endX   = startX + travelX;
    const endY   = startY + travelY;

    const trail: Sample[] = [];
    const startTime = performance.now();
    const totalDuration = ENTER_DURATION + TRAVEL_DURATION + EXIT_DURATION;

    function frame(now: number) {
      if (!mountedRef.current) return;
      const elapsed = now - startTime;

      // ── Phase progress ──────────────────────────────────────────────────────
      // travelProgress: 0→1 over TRAVEL_DURATION (clamped)
      const travelElapsed  = Math.max(0, elapsed - ENTER_DURATION);
      const travelProgress = Math.min(1, travelElapsed / TRAVEL_DURATION);

      // headAlpha: 0→1 during ENTER, 1 during TRAVEL, 1→0 during EXIT
      let headAlpha: number;
      if (elapsed < ENTER_DURATION) {
        headAlpha = elapsed / ENTER_DURATION;
      } else if (elapsed < ENTER_DURATION + TRAVEL_DURATION) {
        headAlpha = 1;
      } else {
        const exitElapsed = elapsed - ENTER_DURATION - TRAVEL_DURATION;
        headAlpha = Math.max(0, 1 - exitElapsed / EXIT_DURATION);
      }

      // ── Head position ───────────────────────────────────────────────────────
      // Use a very slight ease-in-out so it doesn't look like a UI slide,
      // but keep it close to linear so it reads as a real meteor.
      const t  = travelProgress;
      const et = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // gentle ease-in-out
      const hx = startX + (endX - startX) * et;
      const hy = startY + (endY - startY) * et;

      // Record sample
      trail.push({ x: hx, y: hy, t: now });

      // Prune old samples
      const cutoff = now - TRAIL_DURATION_MS;
      while (trail.length > 1 && trail[0].t < cutoff) trail.shift();

      // ── Draw ────────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Trail — draw segments from oldest to newest
      if (trail.length >= 2) {
        for (let i = 1; i < trail.length; i++) {
          const prev = trail[i - 1];
          const curr = trail[i];

          // Age of this segment's midpoint (0 = fresh, 1 = about to expire)
          const midAge = 1 - ((now - (prev.t + curr.t) / 2) / TRAIL_DURATION_MS);
          const segAlpha = Math.max(0, midAge);

          // Width tapers: widest near head (high i), thinnest at tail (low i)
          const widthFrac = i / (trail.length - 1);
          const lineWidth = TRAIL_MAX_WIDTH * widthFrac * segAlpha;

          if (lineWidth < 0.05) continue;

          ctx.save();
          ctx.globalAlpha = segAlpha * 0.9;
          ctx.strokeStyle = `rgba(230, 225, 255, 1)`;
          ctx.lineWidth   = lineWidth;
          ctx.lineCap     = 'round';
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();

          // Soft outer glow on the freshest quarter of the trail
          if (widthFrac > 0.75) {
            ctx.globalAlpha = segAlpha * 0.18;
            ctx.strokeStyle = `rgba(200, 190, 255, 1)`;
            ctx.lineWidth   = lineWidth * 3.5;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Head glow (drawn on top of trail)
      if (headAlpha > 0.01) {
        // Outer bloom
        const bloom = ctx.createRadialGradient(hx, hy, 0, hx, hy, HEAD_RADIUS * 6);
        bloom.addColorStop(0,   `rgba(210, 205, 255, ${headAlpha * 0.35})`);
        bloom.addColorStop(0.5, `rgba(200, 195, 255, ${headAlpha * 0.12})`);
        bloom.addColorStop(1,   `rgba(180, 175, 240, 0)`);
        ctx.save();
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(hx, hy, HEAD_RADIUS * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Inner bright core
        const core = ctx.createRadialGradient(hx, hy, 0, hx, hy, HEAD_RADIUS);
        core.addColorStop(0,   `rgba(255, 255, 255, ${headAlpha})`);
        core.addColorStop(0.6, `rgba(240, 238, 255, ${headAlpha * 0.8})`);
        core.addColorStop(1,   `rgba(220, 215, 255, 0)`);
        ctx.save();
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(hx, hy, HEAD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Continue or finish ──────────────────────────────────────────────────
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        // Final clear after trail fully dissolves
        timerRef.current = setTimeout(() => {
          ctx.clearRect(0, 0, W, H);
        }, TRAIL_DURATION_MS + 50);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }

  // ── Scheduler ───────────────────────────────────────────────────────────────
  function scheduleNext(min: number, max: number) {
    if (!mountedRef.current) return;
    const delay = min + Math.random() * (max - min);
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      runMeteor();
      // Schedule the next one after this meteor's total visible time + buffer
      const visibleMs = ENTER_DURATION + TRAVEL_DURATION + EXIT_DURATION + TRAIL_DURATION_MS + 200;
      timerRef.current = setTimeout(() => scheduleNext(min, max), visibleMs);
    }, delay);
  }

  // ── Canvas resize ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // First shot
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      runMeteor();
      const visibleMs = ENTER_DURATION + TRAVEL_DURATION + EXIT_DURATION + TRAIL_DURATION_MS + 200;
      timerRef.current = setTimeout(() => scheduleNext(replayMin, replayMax), visibleMs);
    }, initialDelay);

    return () => {
      ro.disconnect();
      if (rafRef.current)   cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}

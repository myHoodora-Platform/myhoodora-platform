"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SEASON_PALETTES,
  SEASON_PARTICLES,
  type Season,
} from "@myhoodora/api-contract/seasons";
import { useSeason } from "./use-season";

/** How long the moving part plays after the app opens; then only the still decoration stays. */
const PLAY_MS = 8_000;

/**
 * The season's look over the signed-in app (plan WP-D): a string of lights under the header, a few
 * sparkles, or a fireworks burst. Never covers or blocks anything (pointer-events: none), stops after a
 * few seconds, honours "reduce motion" and the person's Festive effects switch.
 */
export function SeasonLayer() {
  const { season, effects, reducedMotion } = useSeason();
  if (!season || !effects || season.effect === "none") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-16 z-30 lg:top-[72px] print:hidden"
    >
      <style>{CSS}</style>
      {season.effect === "lights" && (
        <Lights season={season} still={reducedMotion} />
      )}
      {season.effect === "sparkle" && !reducedMotion && (
        <Sparkles season={season} />
      )}
      {season.effect === "fireworks" && !reducedMotion && (
        <Fireworks season={season} />
      )}
      {season.effect !== "lights" && <Lights season={season} still small />}
    </div>
  );
}

const CSS = `
@keyframes mh-twinkle { 0%, 100% { opacity: 1; filter: brightness(1.15); } 50% { opacity: .35; filter: brightness(.8); } }
@keyframes mh-float { 0% { transform: translateY(0) scale(.6); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(70vh) scale(1); opacity: 0; } }
.mh-bulb { animation: mh-twinkle 1.6s ease-in-out infinite; }
.mh-spark { position: absolute; top: -12px; animation: mh-float linear forwards; }
@media (prefers-reduced-motion: reduce) { .mh-bulb, .mh-spark { animation: none !important; } }
`;

/** A wire with bulbs, draped in shallow loops across the width. */
function Lights({
  season,
  still,
  small,
}: {
  season: Season;
  still?: boolean;
  small?: boolean;
}) {
  const colours = SEASON_PALETTES[season.accent];
  const n = small ? 18 : 28;
  const [playing, setPlaying] = useState(!still);
  useEffect(() => {
    if (still) return;
    const id = setTimeout(() => setPlaying(false), PLAY_MS * 2);
    return () => clearTimeout(id);
  }, [still]);
  return (
    <svg
      viewBox={`0 0 ${n * 40} 30`}
      preserveAspectRatio="none"
      className={small ? "h-3 w-full opacity-80" : "h-5 w-full"}
    >
      <path
        d={Array.from(
          { length: n },
          (_, i) =>
            `${i === 0 ? "M" : "Q"} ${i === 0 ? "0 4" : `${i * 40 - 20} 14 ${i * 40} 4`}`,
        ).join(" ")}
        fill="none"
        stroke="#3e4a3d"
        strokeWidth="1.5"
      />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${i * 40 + 20} 10)`}>
          <rect x="-2" y="-2" width="4" height="4" fill="#3e4a3d" />
          <ellipse
            cx="0"
            cy="8"
            rx="4.5"
            ry="7"
            fill={colours[i % colours.length]}
            className={playing ? "mh-bulb" : undefined}
            style={
              playing ? { animationDelay: `${(i % 5) * 0.32}s` } : undefined
            }
          />
        </g>
      ))}
    </svg>
  );
}

function Sparkles({ season }: { season: Season }) {
  const [on, setOn] = useState(true);
  const colours = SEASON_PALETTES[season.accent];
  const sparks = useMemo(
    () =>
      Array.from({ length: SEASON_PARTICLES[season.intensity] }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        size: 6 + ((i * 7) % 8),
        delay: (i % 8) * 0.45,
        duration: 4.5 + ((i * 13) % 30) / 10,
        colour: colours[i % colours.length]!,
      })),
    [season.intensity, colours],
  );
  useEffect(() => {
    const id = setTimeout(() => setOn(false), PLAY_MS + 4_000);
    return () => clearTimeout(id);
  }, []);
  if (!on) return null;
  return (
    <div className="absolute inset-x-0 top-0 h-[70vh] overflow-hidden">
      {sparks.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 10 10"
          className="mh-spark"
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          <path
            d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
            fill={s.colour}
          />
        </svg>
      ))}
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  colour: string;
}

/** A few bursts when the app opens, and a big one when the countdown reaches zero. A plain canvas: no library. */
function Fireworks({ season }: { season: Season }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [bursting, setBursting] = useState(true);

  // Midnight: another round.
  useEffect(() => {
    if (!season.countdownTo) return;
    const wait = Date.parse(season.countdownTo) - Date.now();
    if (wait <= 0 || wait > 2 ** 31 - 1) return;
    const id = setTimeout(() => setBursting(true), wait);
    return () => clearTimeout(id);
  }, [season.countdownTo]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!bursting || !el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = window.innerWidth * dpr;
    el.height = window.innerHeight * 0.7 * dpr;
    ctx.scale(dpr, dpr);
    const colours = SEASON_PALETTES[season.accent];
    const per = Math.round(SEASON_PARTICLES[season.intensity] * 2.5);
    const particles: Particle[] = [];
    const started = performance.now();
    let lastBurst = 0;
    let frame = 0;
    const burst = () => {
      const x = window.innerWidth * (0.15 + Math.random() * 0.7);
      const y = window.innerHeight * (0.1 + Math.random() * 0.25);
      const colour = colours[Math.floor(Math.random() * colours.length)]!;
      for (let i = 0; i < per; i++) {
        const a = (i / per) * Math.PI * 2;
        const speed = 1.6 + Math.random() * 1.8;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1,
          colour,
        });
      }
    };
    const draw = (t: number) => {
      const elapsed = t - started;
      if (elapsed < PLAY_MS - 2_000 && t - lastBurst > 700) {
        burst();
        lastBurst = t;
      }
      ctx.clearRect(0, 0, el.width, el.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.035;
        p.vx *= 0.985;
        p.life -= 0.012;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = particles.length - 1; i >= 0; i--)
        if (particles[i]!.life <= 0) particles.splice(i, 1);
      if (elapsed < PLAY_MS || particles.length)
        frame = requestAnimationFrame(draw);
      else setBursting(false);
    };
    frame = requestAnimationFrame(draw); // Paused by the browser while the tab is hidden.
    return () => cancelAnimationFrame(frame);
  }, [bursting, season.accent, season.intensity]);

  if (!bursting) return null;
  return (
    <canvas ref={canvas} className="absolute inset-x-0 top-0 h-[70vh] w-full" />
  );
}

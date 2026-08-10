import { itemOf } from './inventory';
import { screenFading } from './hud';
import { gameOverUp } from './gameover';

// ══ CRUMBS ══════════════════════════════════════════════════════════════════
//
// *"make animations … for eating. eating just use the sounds and make crumbs
//  fly out of bottom of screen"*   (2026-08-10)
//
// The sounds already exist — `ct/audio.ts` alternates its two bite recordings
// off `mealsEaten()` and is untouched. This is only the picture: when an EAT
// lands, a half-second burst of small pixel crumbs arcs up from the bottom
// edge of the frame and falls back out of it. Your mouth is below the frame;
// the crumbs are what escapes it.
//
// A DRINK DOES NOT CRUMB. `crumbsFor` reads the item's own declared verb and
// does nothing for `drink` — the shake, the soda and the coffee stay
// visual-less, deliberately: a droplet burst from the bottom of the screen
// reads as crumbs (or worse) at 24 texels, so drinks keep the bite sound and
// nothing else.
//
// THE CRUMBS ARE THE FOOD'S OWN COLOUR, sampled at play time from the item's
// 24 x 24 icon — the icons were already painted from "the palette of the thing
// it is", so a pie sheds pie and the fries shed fries. An item with no icon
// sheds honest crumb-brown.
//
// Screen-space, in the fatigue vignette's grammar: its own full-viewport
// canvas (getElementById-or-create), `pointer-events:none`, z 8 — under every
// panel, note and fade — blocking nothing, and cleared instantly on any fade,
// sleep cut or game over. `Math.random` throughout: play time, never the
// seeded build stream (GOTCHAS §2).

/** CSS px per texel — the bag's own scale. */
const SCALE = 3;
/** texels/s² of gravity — tuned so a burst is up and gone in under a second */
const GRAV = 260;

interface Crumb { x: number; y: number; vx: number; vy: number; s: number; c: string }

let cv: HTMLCanvasElement | null = null;
let W = 0, H = 0;
let crumbs: Crumb[] = [];
let raf = 0;
let last = 0;

function canvas(): HTMLCanvasElement | null {
  try {
    let c = document.getElementById('ct-crumb-fx') as HTMLCanvasElement | null;
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'ct-crumb-fx';
      c.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:8;'
        + 'image-rendering:pixelated;';
      document.body.appendChild(c);
    }
    W = Math.ceil(window.innerWidth / SCALE);
    H = Math.ceil(window.innerHeight / SCALE);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    c.style.width = `${W * SCALE}px`;
    c.style.height = `${H * SCALE}px`;
    cv = c;
    return c;
  } catch { return null; }       // no DOM, no crumbs — the meal still healed
}

/** neutral crumb-brown, for an item with no icon to sample */
const PLAIN = ['#7a5a3a', '#8a6a44', '#5c4630', '#a8865a'];

/**
 * A handful of the item's own colours, read off its icon painter. Drawn into a
 * throwaway 24 x 24 canvas and point-sampled — cheap, once per meal, and the
 * palette can never drift from the art because it IS the art.
 */
function palette(id: string): string[] {
  const icon = itemOf(id).icon;
  if (!icon) return PLAIN;
  try {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const g = c.getContext('2d');
    if (!g) return PLAIN;
    icon(g);
    const d = g.getImageData(0, 0, 24, 24).data;
    const out: string[] = [];
    for (let tries = 0; tries < 80 && out.length < 6; tries++) {
      const i = Math.floor(Math.random() * 576) * 4;
      if (d[i + 3] < 200) continue;
      out.push(`rgb(${d[i]},${d[i + 1]},${d[i + 2]})`);
    }
    return out.length ? out : PLAIN;
  } catch { return PLAIN; }
}

/**
 * One meal's burst. Called by `ct/food.ts` the moment a meal lands; reads the
 * item's declared verb itself so the caller stays one line and a drink is a
 * no-op here rather than a decision there.
 */
export function crumbsFor(id: string): void {
  if (itemOf(id).use?.verb !== 'eat') return;    // a drink does not crumb
  if (screenFading() || gameOverUp()) return;    // nothing flies behind a fade
  if (!canvas()) return;
  const pal = palette(id);
  const n = 22 + Math.floor(Math.random() * 9);
  for (let i = 0; i < n; i++) {
    crumbs.push({
      // out of the mouth, which is below the middle of the bottom edge
      x: W * (0.36 + Math.random() * 0.28),
      y: H + 1 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 80,
      vy: -(85 + Math.random() * 90),
      s: Math.random() < 0.3 ? 2 : 1,
      c: pal[Math.floor(Math.random() * pal.length)],
    });
  }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
}

/** Everything gone, instantly — the fatigue overlay's cleanup rule. */
function abort(): void {
  crumbs = [];
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  cv?.getContext('2d')?.clearRect(0, 0, W, H);
}

function step(): void {
  raf = 0;
  if (screenFading() || gameOverUp()) { abort(); return; }
  const g = cv?.getContext('2d');
  if (!g) { abort(); return; }
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  g.clearRect(0, 0, W, H);
  const live: Crumb[] = [];
  for (const p of crumbs) {
    p.vy += GRAV * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // falling and back under the bottom edge: out of the world it came from
    if (p.vy > 0 && p.y > H + 4) continue;
    g.fillStyle = p.c;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    live.push(p);
  }
  crumbs = live;
  if (crumbs.length) raf = requestAnimationFrame(step);
  else g.clearRect(0, 0, W, H);
}

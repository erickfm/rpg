// ══ HIT BY A CAR ════════════════════════════════════════════════════════════
//
// *"make cars hit you and cause damage, should be a consistent amount of
//  damage but on game start two cars hitting you should always kill you and
//  end your game."*   (2026-08-08)
//
// ── THE NUMBER IS 85, AND IT IS THE SAME 85 EVERY TIME ──────────────────────
//
// "Consistent" = one flat number, never scaled by speed or by what hit you.
// The binding constraint is "ON GAME START two cars hitting you should ALWAYS
// kill you" — his words scope it to creation, and creation is where the bound
// lives now that the stat ceiling is gone (*"i dont want an upper ceiling on
// the points"*, 2026-08-15). Max health is 60 + 4×(STR+CON) (`ct/stats.ts`);
// the biggest CREATION body is the 30-point pool dumped into the pair, three
// stats at the floor of 1, STR+CON = 27 → 168 health. Two hits must finish
// that one too, so the hit is ≥ 84; 85 takes it with a dollar to spare
// (168 − 85 − 85 < 0, and 0 is the end, `ct/gameover.ts`), while a STR 1
// CON 1 build dies to a single bumper — fair, for jaywalking in a body built
// entirely out of INT. It WAS 70, sized against the old capped maximum of
// 140. A body TRAINED past creation can now out-health two bumpers — that is
// the ceiling's removal being real, not this file forgetting its rule.
//
// ── ONE HIT, NOT SIXTY A SECOND ─────────────────────────────────────────────
//
// A car crossing the spot you stand on is box overlap for twenty-odd
// consecutive frames, and "two cars kill you" means nothing if one car is
// sixty hits. So a hit buys ~2 s of invulnerability: long enough for the car
// that hit you to finish driving through where you stood — it does not stop,
// which is period-correct — and short enough that walking straight back into
// the lane is immediately consequential again.
//
// ⚠ A LEAF, and it never polls the world. `ct/traffic.ts` owns the boxes and
// the speeds and calls in with one vehicle's frame facts; this owns what a
// hit COSTS. Imports are `ct/health.ts` (a leaf), the cause line on
// `ct/gameover.ts`, and the PlayerRef type — no cycle can close through here
// (GOTCHAS §28: nothing imports this but traffic).

import type { PlayerRef } from './ctx';
import { damage, health } from './health';
import { setCauseOfDeath } from './gameover';

/** the flat cost of being hit — see the header for why it is exactly 85 */
export const HIT_DAMAGE = 85;
/** no second hit inside this window — "two hits" must mean two events */
const INVULN_MS = 2000;
/** below this the car is creeping to a stop against you and `fp.ts`'s box
 *  push is the whole of the event — a nudge, not a hit. 1.0, down from a
 *  first-cut 2.0 that quietly swallowed real hits: a car braking hard from
 *  8.5 m/s can reach you at walking pace, and a bumper that arrives still
 *  rolling is a hit however much speed the driver managed to shed. */
const MIN_SPEED = 1.0;
/** how far he is thrown, metres. A touch, not a ragdoll: mostly along the
 *  car's own travel, partly away from its body, so he lands beside the lane
 *  rather than under the rear axle. */
const THROW = 1.4;

let lastHit = -Infinity;

// ── the flash ────────────────────────────────────────────────────────────────
// One red beat over the whole screen, gone in half a second. Drawn as DOM the
// way every screen wash here is (the night tint, the shared fade) — no gore,
// just the classic '97 "you have been hit" frame.
let flashDiv: HTMLDivElement | null = null;
function flash(): void {
  if (!flashDiv) {
    flashDiv = document.createElement('div');
    // z 30: over the HUD (11–20), under the OSD (40) and the death card (60)
    flashDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;'
      + 'background:radial-gradient(ellipse at center,'
      + 'rgba(214,40,24,0.42) 0%,rgba(122,8,4,0.88) 100%);opacity:0;';
    document.body.appendChild(flashDiv);
  }
  flashDiv.style.transition = 'none';
  flashDiv.style.opacity = '0.9';
  void flashDiv.offsetHeight;              // commit the peak before the decay
  flashDiv.style.transition = 'opacity 480ms ease-out';
  flashDiv.style.opacity = '0';
}

// ── the jolt ────────────────────────────────────────────────────────────────
// A quarter-second decaying shake of the whole screen — body transform, so
// the world and the HUD lurch together, which is what an impact does to a
// head. Cleared to '' at the end, always: a leftover transform on <body>
// would quietly re-anchor every position:fixed element in the game.
// Math.random is the runtime dice stream, same as fatigue's pct roll — never
// `ct/rng.ts`'s seeded world grain (GOTCHAS §2).
let joltToken = 0;
function jolt(): void {
  const token = ++joltToken;
  const t0 = performance.now();
  const DUR = 280, AMP = 7;
  const step = () => {
    if (token !== joltToken) return;       // a newer hit owns the shake now
    const k = (performance.now() - t0) / DUR;
    if (k >= 1) { document.body.style.transform = ''; return; }
    const a = AMP * (1 - k);
    document.body.style.transform =
      `translate(${((Math.random() * 2 - 1) * a).toFixed(1)}px,`
      + `${((Math.random() * 2 - 1) * a).toFixed(1)}px)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export interface CarHitInfo {
  player: PlayerRef;
  /** the vehicle's speed along its route, m/s */
  spd: number;
  /** its unit heading in the ground plane */
  hx: number; hz: number;
  /** its centre */
  cx: number; cz: number;
}

/**
 * A moving vehicle's box has reached the player. `ct/traffic.ts` calls this
 * on raw overlap and this decides whether it was a HIT: fast enough, outside
 * the invulnerability window, and the run still live.
 */
export function carHit(o: CarHitInfo): void {
  if (o.spd < MIN_SPEED) return;
  if (health() <= 0) return;               // the run is already over
  const now = performance.now();
  if (now - lastHit < INVULN_MS) return;
  lastHit = now;

  // thrown first, so if this is the killing hit the card comes up with him
  // already clear of the wheels. `jumpTo` keeps his yaw and his floor; the
  // collision system owns wherever he lands next frame.
  const px = o.player.x(), pz = o.player.z();
  let ax = px - o.cx, az = pz - o.cz;
  const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  let dx = o.hx + ax * 0.8, dz = o.hz + az * 0.8;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  o.player.jumpTo(px + dx * THROW, pz + dz * THROW, o.player.yaw(), o.player.gy());

  flash();
  jolt();
  setCauseOfDeath('HIT BY A CAR');
  damage(HIT_DAMAGE);
}

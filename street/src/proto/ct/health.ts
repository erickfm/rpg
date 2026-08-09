// ══ HEALTH ══════════════════════════════════════════════════════════════════
//
// *"lets track the following stats (health, current cash on hand) put them on
//  a hud overlay pls."*   (2026-08-08)
//
// The player's condition, as one number. Nothing in the world damages him
// today, so it sits at full — the ask is to TRACK it, and this module is the
// place a future fall, fight or bad burger will call into. The verbs below are
// the whole API; no damage source is invented here.
//
// ⚠ A LEAF. It imports ONLY `ct/stats.ts` — itself a pure leaf that imports
// nothing, and whose header forbids it ever gaining an import — so no cycle
// can close through here. That discipline matters for the reason GOTCHAS §28
// gives: `ct/hud.ts` draws this on the stats strip, `ct/hud.ts` is imported
// by half the world, and a module in an import cycle can be silently dropped
// from the built bundle. The save slice therefore lives in `ct/save.ts`'s
// `builtins` — the same arrangement the purse, the drawer, the wardrobe and
// the body already have — rather than being registered from here, which
// would import `save` and close the loop `hud → health → save → inventory →
// hud`.
//
// NEW GAME needs no line anywhere: health lives only in the `ct-save` blob,
// which `ct/newgame.ts` already wipes whole, and the reload puts `hp` back at
// its declared default. That is the rule its own table states.
import { maxHealthNow, onStatsChange } from './stats';

// ── THE MAXIMUM IS THE BODY'S, NOT THIS MODULE'S ────────────────────────────
//
// *"health is derived from str and con"* (2026-08-08) — so the ceiling is
// `ct/stats.ts`'s `maxHealthFor(STR, CON)`: 60 + 4×(STR+CON), which is the
// old flat 100 exactly when both sit at the average 5, so the HUD bar tells
// the same truth it told before stats existed. When the ceiling MOVES — the
// creation spec, a season at the gym — the rule below is FULL STAYS FULL: a
// whole man is still whole in his new body, a hurt one keeps his wounds (a
// bench press is not a bandage), and anyone over a lowered ceiling is
// clamped down to it.

let hp = maxHealthNow();          // full, and the default — a new life starts whole
let lastMax = hp;

/** who repaints when the number moves — the HUD's stats strip, today. */
const WATCH: (() => void)[] = [];

export function maxHealth(): number { return maxHealthNow(); }
export function health(): number { return hp; }

onStatsChange(() => {
  const m = maxHealthNow();
  if (m === lastMax) return;                     // INT, CHA, DEX — not our stats
  hp = hp === lastMax ? m : Math.min(hp, m);
  lastMax = m;
  for (const f of WATCH) f();                    // the BAR moved even if hp did not
});

/**
 * The one writer. Clamped to 0…maxHealth() and kept to whole points — a
 * health readout with cents is a bug report waiting to happen. Everything
 * else (`damage`, `heal`, the save's restore) goes through here, so the clamp
 * and the change signal cannot be forgotten by a caller.
 */
export function setHealth(v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) return;
  const next = Math.max(0, Math.min(maxHealthNow(), Math.round(v)));
  if (next === hp) return;
  hp = next;
  for (const f of WATCH) f();
}

export function damage(n: number): void { setHealth(hp - n); }
export function heal(n: number): void { setHealth(hp + n); }

export function onHealthChange(fn: () => void): void { WATCH.push(fn); }

// Test affordance, same shape and reason as `__hud`/`__inv`: the state is a
// module local with one setter, and a console or a probe has no other door.
if (typeof window !== 'undefined') {
  (window as unknown as { __health: unknown }).__health = {
    get: health, max: maxHealth, set: setHealth, damage, heal,
  };
}

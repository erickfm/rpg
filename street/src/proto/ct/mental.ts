// ══ MENTAL ══════════════════════════════════════════════════════════════════
//
// *"lets get two health bars, one physical one mental."*   (2026-08-15)
//
// The second bar. `ct/health.ts` stays the PHYSICAL bar exactly as it was —
// same module, same max (60 + 4×(STR+CON)), same game-over at zero — and this
// is its mental twin: how he is holding up inside. Worn down by work and by
// every day the rent goes unpaid; refilled by television, tapes, confession,
// a cigarette and a semester of night school. The verbs are the whole API; no
// cause lives here, the same discipline health keeps.
//
// A FLAT 0…100, not derived from stats. Health's ceiling is the body's
// (STR/CON); no stat in `ct/stats.ts` claims the mind's resilience, and
// inventing "mental = f(INT, CHA)" would be a rule nobody asked for. If a stat
// ever earns it, `maxMental` is the one function to change.
//
// ⚠ A LEAF, like health, and for health's exact reason: `ct/hud.ts` draws this
// on the stats strip, `ct/hud.ts` is imported by half the world, and a module
// in an import cycle can be silently dropped from the built bundle. So this
// imports NOTHING, and the save slice lives in `ct/save.ts`'s `builtins`
// beside health's rather than being registered from here.
//
// WHAT EMPTY MEANS is not this module's business either — `ct/spirits.ts`
// watches for zero and runs the breakdown, the way `ct/gameover.ts` watches
// health for zero. NEW GAME needs no line anywhere: mental lives only in the
// `ct-save` blob, which `ct/newgame.ts` wipes whole, and the reload puts it
// back at its declared default — full.

const MAX = 100;

let mp = MAX;                     // full, and the default — a new life starts sound

/** who repaints when the number moves — the HUD's stats strip, today. */
const WATCH: (() => void)[] = [];

export function maxMental(): number { return MAX; }
export function mental(): number { return mp; }

/**
 * The one writer. Clamped to 0…MAX and kept to whole points, health's own
 * rule — everything else (`mentalDamage`, `mentalHeal`, `mentalFull`, the
 * save's restore) goes through here, so the clamp and the change signal
 * cannot be forgotten by a caller.
 */
export function setMental(v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) return;
  const next = Math.max(0, Math.min(MAX, Math.round(v)));
  if (next === mp) return;
  mp = next;
  for (const f of WATCH) f();
}

export function mentalDamage(n: number): void { setMental(mp - n); }
export function mentalHeal(n: number): void { setMental(mp + n); }
/** *"school fills mental to full always."* — the college calls this. */
export function mentalFull(): void { setMental(MAX); }

export function onMentalChange(fn: () => void): void { WATCH.push(fn); }

// Test affordance, same shape and reason as `__health`: the state is a module
// local with one setter, and a console or a probe has no other door.
if (typeof window !== 'undefined') {
  (window as unknown as { __mental: unknown }).__mental = {
    get: mental, max: maxMental, set: setMental,
    damage: mentalDamage, heal: mentalHeal,
  };
}

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
// ⚠ A LEAF. It imports NOTHING, exactly like `ct/wardrobe.ts` and `ct/body.ts`
// and for the same reason (GOTCHAS §28): `ct/hud.ts` draws this on the stats
// strip, `ct/hud.ts` is imported by half the world, and a module in an import
// cycle can be silently dropped from the built bundle. The save slice
// therefore lives in `ct/save.ts`'s `builtins` — the same arrangement the
// purse, the drawer, the wardrobe and the body already have — rather than
// being registered from here, which would import `save` and close the loop
// `hud → health → save → inventory → hud`.
//
// NEW GAME needs no line anywhere: health lives only in the `ct-save` blob,
// which `ct/newgame.ts` already wipes whole, and the reload puts `hp` back at
// its declared default. That is the rule its own table states.

/** Full, and also the default — a new life starts whole. */
const HP_MAX = 100;

let hp = HP_MAX;

/** who repaints when the number moves — the HUD's stats strip, today. */
const WATCH: (() => void)[] = [];

export function maxHealth(): number { return HP_MAX; }
export function health(): number { return hp; }

/**
 * The one writer. Clamped to 0…HP_MAX and kept to whole points — a health
 * readout with cents is a bug report waiting to happen. Everything else
 * (`damage`, `heal`, the save's restore) goes through here, so the clamp and
 * the change signal cannot be forgotten by a caller.
 */
export function setHealth(v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) return;
  const next = Math.max(0, Math.min(HP_MAX, Math.round(v)));
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

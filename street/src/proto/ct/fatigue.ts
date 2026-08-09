import { BUILD, ORDER as FRAME, type CtxBuild } from './ctx';
import { screenFade, screenFading, hudNote, panelUp } from './hud';
import { defineItem, mBox, mCyl, mOf } from './inventory';
import { COFFEE } from './goods';
import { registerSlice, flush } from './save';
import { health, maxHealth, setHealth } from './health';
import { APT_X0, APT_Z0, ST0 } from './apartment';

// ══ STAYING AWAKE, AND WHAT IT COSTS TO LOSE ════════════════════════════════
//
// *"you can stay awake only for 24 straight hours. if you're awake for longer
//  you pass out and wake up wherever you slept but with some amount of money
//  lost, its a percentage between 1-10%."*   (2026-08-08)
//
// and, the same day, the extension:
//
// *"coffee can keep you going for 6 extra hours, caffeine pills can keep you
//  going for 8 extra hours, cocaine can keep you going for 12 extra hours."*
//
// ── HOW THIS MODULE KNOWS YOU SLEPT, WITHOUT OWNING ANY BED ────────────────
//
// The two sleeps in this world — the bed in 301 (`ct/apartment.ts`) and a night
// at the hotel (`ct/int-hotel.ts`) — are both the same gesture: a snap
// `ctx.clock.advance(mins, { overSeconds: 0 })` inside a `screenFade`'s `mid`,
// run while the screen is at opacity 1. Neither publishes a "slept" event, and
// neither is a file this module may edit (the apartment is trunk). So sleep is
// OBSERVED rather than reported: a per-frame hook watches `totalMin`, and a
// jump of more than `JUMP_MIN` in one frame while `screenFading()` is true can
// only be a sleep cut. The same trick `ct/audio.ts` used for door sounds —
// watch the world move instead of asking its owners to call you.
//
// The one other snap in the world is `ct/save.ts` restoring the clock at boot,
// and it happens with NO fade up — so "big jump, no fade" is ignored: it is
// time the character did not live through.
//
//   normal frame      delta ≤ 0.05 game-min (main.ts clamps dt to 0.05 s and a
//                     game minute is one real second)
//   sleep cut         delta = the whole night, behind a black screen
//   save restore      delta = the whole save, no fade
//
// ⚠ IF A THIRD KIND OF SNAP-BEHIND-A-FADE IS EVER BUILT (a bus ride, a jail
// stint), it will read as sleep here. That may even be right — you doze on a
// bus — but whoever builds it should know this module is watching.

/** The hard limit, before stimulants: 24 game-hours awake. */
const BASE_MIN = 24 * 60;
/** A one-frame clock delta above this is a jump, not passage — 10× the
 *  biggest honest frame (0.05 game-min) and far below the smallest night. */
const JUMP_MIN = 0.5;

// ── THE STIMULANT TABLE — the one copy, keyed by inventory id ──────────────
//
// Hours of extra waking each dose buys, exactly as he priced them. COFFEE is
// the item `ct/goods.ts` already sells at the burger barn, the diner and the
// bodega's coffee corner — a carried paper cup, so drinking it is a bag verb
// like everything else. PILLS and COCAINE are declared below and their sellers
// (the bodega shelf, the skeevy guy in the long alley) sell these ids.
export const STIMULANT_HOURS: Record<string, number> = {
  COFFEE: 6,
  PILLS: 8,
  COCAINE: 12,
};

/**
 * ── WHERE YOU WAKE UP WHEN YOU HAVE NEVER SLEPT ───────────────────────────
 *
 * The bed in 301, which is home. The numbers are the sleep spot's own in
 * `ct/apartment.ts` — `AX(-2.6), AZI(4.2)`, third floor — expressed through
 * the module's exported origin so they cannot drift from the building:
 * `AX(lx) = APT_X0 + lx`, and the spot's `ok()` gates on `2 * ST`. Yaw π/2
 * faces +x, into the room, the way you'd stand up off that side of the bed.
 */
const FLAT_BED = { x: APT_X0 - 2.6, z: APT_Z0 + 4.2, yaw: Math.PI / 2, gy: 2 * ST0 };

// ── state ──────────────────────────────────────────────────────────────────
/** continuous game-minutes awake — the thing sleeping resets */
let awakeMin = 0;
/** stimulant extension, in game-minutes. ADDITIVE — two coffees are twelve
 *  hours, because "keep you going for 6 extra hours" reads as fuel, and each
 *  further dose already costs money. Cleared by sleep: it wears off when you
 *  finally go down, it does not bank. */
let boostMin = 0;
/** where he last slept — captured at the moment of the sleep cut, so it is
 *  the spot he was standing on when the screen went black: beside the bed in
 *  301, or at the hotel desk. Null until the first sleep. */
let slept: { x: number; z: number; yaw: number; gy: number } | null = null;

let lastMin: number | null = null;
let warn4 = false, warn1 = false;
let passing = false;

function limitMin(): number { return BASE_MIN + boostMin; }

/** One dose. The item's `use.act` calls this; the bag consumes the item. */
function dose(id: string, line: string): void {
  const h = STIMULANT_HOURS[id];
  if (!h) return;
  boostMin += h * 60;
  hudNote(line, 3500);
  flush();
}

// ── the two carried stimulants that did not exist yet ──────────────────────
//
// Declared here beside their effects, the way `ct/goods.ts` declares food
// beside the shops — the sellers only need the id strings. Real 1997 sizes:
// a 16-count blister pack of caffeine pills, a thumb-sized ziplock.

export const PILLS = defineItem({
  id: 'PILLS', name: 'caffeine pills', stack: 4,
  thick: 0.018,
  blurb: 'WAKE-UP 200mg, 16 to the card. the label says not to operate machinery.',
  icon: (g) => {
    const box = (c: string, x: number, y: number, w: number, h: number) => {
      g.fillStyle = c; g.fillRect(x, y, w, h);
    };
    box('#e8d84a', 4, 5, 16, 14);                    // the yellow card
    box('#c8b83a', 4, 5, 16, 2);
    box('#3a2a52', 5, 8, 14, 4);                     // WAKE-UP printed band
    // the blister bubbles, two rows of four
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++)
      box('#f4f0e4', 6 + c * 3.5, 13 + r * 3.5, 2, 2);
  },
  // THE CARD, 55 x 4 x 80 mm, printed side up.
  model: () => mOf(
    mBox(0.055, 0.004, 0.080, '#e8d84a', 0, 0.002, 0),
    mBox(0.048, 0.005, 0.020, '#3a2a52', 0, 0.003, -0.020),
  ),
  use: {
    verb: 'take',
    act: () => { dose('PILLS', 'you swallow two, dry. call it eight more hours.'); },
  },
});

export const COCAINE = defineItem({
  id: 'COCAINE', name: 'bag of cocaine', stack: 4,
  thick: 0.010,
  blurb: 'a thumb-sized ziplock, mostly powder. he swore it was practically pure.',
  icon: (g) => {
    const box = (c: string, x: number, y: number, w: number, h: number) => {
      g.fillStyle = c; g.fillRect(x, y, w, h);
    };
    box('#d8d4c8', 7, 4, 10, 16);                    // the bag
    box('#c0bcb0', 7, 4, 10, 2);                     // the zip strip
    box('#f4f2ea', 9, 12, 6, 7);                     // the powder settled low
    box('#e8e6dc', 9, 12, 6, 2);
  },
  // THE ZIPLOCK FLAT ON THE FLOOR, 40 x 8 x 50 mm, powder lump inside.
  model: () => mOf(
    mBox(0.040, 0.006, 0.050, '#d8d4c8', 0, 0.003, 0),
    mBox(0.026, 0.008, 0.030, '#f4f2ea', 0, 0.004, 0.006),
  ),
  use: {
    verb: 'take',
    act: () => { dose('COCAINE', 'your heart slams awake. twelve more hours, easy.'); },
  },
});

// ── the pass-out ────────────────────────────────────────────────────────────

function passOut(ctx: CtxBuild): void {
  if (passing || screenFading()) return;
  // Never mid-air, never out of a seat, never behind a panel — a teleport in
  // any of those states is a fight with the rig or a panel left pointing at a
  // counter three hundred metres away. He goes down the moment he is standing
  // on his own feet with the screen his own, which is seconds at most.
  if (ctx.player.seated() || ctx.player.airborne() || panelUp()) return;
  passing = true;

  const wake = slept ?? FLAT_BED;
  // *"its a percentage between 1-10%"* — a whole percent, 1…10, rolled at the
  // moment you go down. Runtime `Math.random`, never `ct/rng.ts`'s seeded
  // stream: that one is the world's build grain (GOTCHAS §2) and this is dice.
  const pct = 1 + Math.floor(Math.random() * 10);
  let lost = 0;

  // EIGHT HOURS OUT COLD — the same span every sleep in this world now is
  // (*"you always just sleep 8 hours"*, 2026-08-09, and the bed and the hotel
  // both follow it). This used to snap to the next 07:00 like the old bed;
  // a body that collapses does not keep the bed's appointments, it is simply
  // gone for eight hours, and one rule everywhere beats two.
  const mins = 8 * 60;

  // Slower than the bed's 140/90/170 on purpose: that cut is chosen, this one
  // happens TO you, and a heavier fall reads as one. The hold stays above the
  // 90 ms floor `ct/apartment.ts` documents (the renderer needs a frame to
  // draw the advanced world before the screen comes back up).
  void screenFade({
    mid: () => {
      // CASH ON HAND ONLY — the purse the HUD shows, never `purse.account`.
      // You were rolled while you were out cold; whatever is in the bank was
      // out of reach, which makes the bank worth something. Rounded to cents:
      // cash × pct is the loss in cents exactly.
      lost = Math.round(ctx.purse.cash * pct) / 100;
      ctx.purse.cash = Math.round((ctx.purse.cash - lost) * 100) / 100;
      ctx.refreshWallet();
      // *"if you fall asleep from staying up too long you lose 10% of health
      // too"* (2026-08-08) — a flat tenth of MAX, so it costs the same whether
      // you went down healthy or hurt. FLOORED AT 1 HP: nothing else about
      // death exists in this world yet, and his spec is a mugging, not an
      // ending — going through `setHealth` directly so the floor is this
      // module's own line, easy to delete if he ever wants tiredness lethal.
      setHealth(Math.max(1, health() - Math.ceil(maxHealth() * 0.10)));
      ctx.player.jumpTo(wake.x, wake.z, wake.yaw, wake.gy);
      ctx.clock.advance(mins, { overSeconds: 0 });
      awakeMin = 0; boostMin = 0; warn4 = warn1 = false;
      slept = { ...wake };
    },
    outMs: 520, holdMs: 140, inMs: 620,
  }).then(() => {
    passing = false;
    // One HUD line, no panel — waking must never trap input. The note fades
    // on its own and Escape owes nothing.
    hudNote(lost > 0
      ? `you blacked out. somebody went through your pockets — $${lost.toFixed(2)} gone.`
      : 'you blacked out. at least your pockets were already empty.', 6500);
    flush();
  });
}

// ── persistence ─────────────────────────────────────────────────────────────
//
// The `ct/save.ts` pattern, additive, the way health was wired: a slice beside
// the state, restored EXACTLY (never max'd against the fresh value — the rule
// the tenancy slice paid for). New game needs no entry: the wipe of `ct-save`
// is total and the reload puts these module locals back at 0/0/null, which is
// a fresh start that has never slept and wakes, if it must, in 301.
registerSlice<{
  awakeMin: number; boostMin: number;
  slept: { x: number; z: number; yaw: number; gy: number } | null;
}>('fatigue', {
  capture: () => ({ awakeMin, boostMin, slept: slept ? { ...slept } : null }),
  restore: (v) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.awakeMin === 'number' && Number.isFinite(v.awakeMin) && v.awakeMin >= 0) awakeMin = v.awakeMin;
    if (typeof v.boostMin === 'number' && Number.isFinite(v.boostMin) && v.boostMin >= 0) boostMin = v.boostMin;
    const s = v.slept;
    if (s && typeof s === 'object'
      && [s.x, s.z, s.yaw, s.gy].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      slept = { x: s.x, z: s.z, yaw: s.yaw, gy: s.gy };
    }
  },
});

// ── registration ────────────────────────────────────────────────────────────

/** Late in the second band, before `ct/save.ts` (99) goes looking for slices.
 *  Constructs no THREE object, so the seeded stream and every tree stand
 *  still (GOTCHAS §2) — items above only DECLARE builders, called at drop. */
export const ORDER = BUILD.INTERIOR + 10;      // 90

export function register(ctx: CtxBuild): void {
  // COFFEE already exists and already sells; it just could not be drunk.
  // `defineItem` returns the object it stores, so this is the one def the bag
  // reads — no second declaration, no load-order race with its sellers.
  COFFEE.use = {
    verb: 'drink',
    act: () => { dose('COFFEE', 'burnt or not, it works. six more hours in you.'); },
  };

  ctx.onFrame(() => {
    const t = ctx.clock.now().totalMin;
    if (lastMin === null) { lastMin = t; return; }
    const d = t - lastMin;
    lastMin = t;
    if (d <= 0) return;

    if (d > JUMP_MIN) {
      if (screenFading()) {
        // A sleep cut — the bed, the hotel, or this module's own pass-out.
        // Reset the stretch and remember where he was standing when the
        // screen went black: that is where "wherever you slept" is.
        awakeMin = 0; boostMin = 0; warn4 = warn1 = false;
        slept = {
          x: ctx.player.x(), z: ctx.player.z(),
          yaw: ctx.player.yaw(), gy: ctx.player.gy(),
        };
        // *"you can heal by sleeping"* (2026-08-08) — a proper night in a bed
        // restores him in full, the classic shape. NOT the pass-out: `passing`
        // is still up while its own clock snap crosses this hook (it clears
        // after the fade-in), and collapsing in the street already costs a
        // tenth of max — it would be absurd for the mugging to also be a cure.
        if (!passing) setHealth(maxHealth());
        flush();
      }
      return;      // no fade: the save restore's snap — time he never lived
    }

    awakeMin += d;
    const left = limitMin() - awakeMin;

    // The warnings re-arm when a stimulant buys the margin back, so a coffee
    // at hour 21 means the yawning starts again at hour 26, not never.
    if (left > 240) warn4 = false;
    if (left > 60) warn1 = false;
    if (left <= 60 && !warn1) {
      warn1 = warn4 = true;
      hudNote('you can barely keep your eyes open. find a bed.', 4500);
    } else if (left <= 240 && !warn4) {
      warn4 = true;
      hudNote("you can't stop yawning. you need sleep soon.", 4000);
    }

    if (left <= 0) passOut(ctx);
  }, FRAME.LATE);
}

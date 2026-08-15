import { BUILD, ORDER as FRAME, type CtxBuild } from './ctx';
import { screenFade, screenFading, hudNote, panelUp } from './hud';
import { gameOverUp } from './gameover';
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
//
// ── AND THE THIRD KIND ARRIVED: THE SHIFT ──────────────────────────────────
//
// *"then if were in we can always work. but you also can work yourself to
//  death/passing out."*   (2026-08-11)
//
// It was already built and this module was already misreading it. A shift in
// `ct/jobs.ts` is a `screenFade` with the clock snapped in the middle — the
// same gesture as the bed, to the millisecond — so EIGHT HOURS BEHIND THE
// GRILL RESET THE AWAKE WINDOW TO ZERO AND HEALED YOU TO FULL. Work was the
// best sleep in town, and "work yourself to passing out" was unreachable by
// construction: the punch clock cured the very thing it was supposed to cause.
//
// The observer cannot tell the two apart by watching — both are a big jump
// behind a fade — so the shift DECLARES ITSELF: `ct/jobs.ts` calls
// `workStretch()` before it starts its fade, and the jump that follows is
// charged as time on your feet instead of credited as a night. That is the
// one exception to "observed rather than reported" in this module, and it
// earns it: the two events are indistinguishable from outside, and guessing
// wrong is the difference between a job and a bed.

/** The hard limit, before stimulants: 24 game-hours awake. */
const BASE_MIN = 24 * 60;

/**
 * ── WHAT AN HOUR OF WORK COSTS THE BODY ────────────────────────────────────
 *
 * More than an hour of standing about, which is the whole of *"you can work
 * yourself to death/passing out"*: if a shift only cost what loitering cost,
 * the job would be a slow way to reach a limit you would hit anyway. At 1.5
 * the arithmetic lands where the sentence points —
 *
 *   a plain 24 h window  = 16 hours of work, if you spend it ALL working
 *   one 8 h shift        = 12 h of the window, so the FIRST one is free
 *   the second shift     = capped by what is left, and the floor arrives
 *                          somewhere inside it — you go down ON SHIFT
 *   a coffee (+6 h)      = 4 more hours of work, half a shift, $1-ish
 *
 * FIRST-PASS NUMBER, and the one most worth arguing about: 1.5 makes a double
 * shift the thing that breaks you, which is the shape of the ask. Raise it to
 * punish work harder, drop it toward 1.0 to make the job merely tiring.
 *
 * ⚠ SUPERSEDED IN ONE PARTICULAR (2026-08-15): *"working two shifts for sure
 * has you blinking and sleepy but you have an ingame hour to get home to
 * sleep or to buy caffeine."* Under raw 1.5 arithmetic two full shifts are
 * EXACTLY the whole window — the second stretch got capped short and you went
 * down AT the clock, hour nowhere. So the double shift is now a DECLARED
 * outcome rather than an emergent one: `workMinutesLeft` guarantees the body
 * can stand through the first two shifts' worth of work, and the moment the
 * cumulative shift time crosses two shifts, the margin is SET to exactly
 * `GRACE_MIN` — blinking and sleepy for sure, one ingame hour on the meter.
 * The rate still governs everything either side of that moment: idle drain,
 * partial shifts, and the third punch that puts you on the floor.
 */
const WORK_RATE = 1.5;
/** the grace after the second shift, game-minutes — *"you have an ingame hour
 *  to get home to sleep or to buy caffeine"* (2026-08-15). One hour of margin
 *  is also exactly the band `blinkStep` blinks in, so the whole grace is
 *  spent blinking and sleepy, which is the other half of the same sentence. */
const GRACE_MIN = 60;
/** two shifts' worth of time on the clock, game-minutes — 2 × the 8-hour
 *  shift `ct/jobs.ts` advertises (`SHIFT_HOURS`). NOT imported from there:
 *  `ct/jobs.ts` imports this module, and a load-time read back across that
 *  cycle is the exact TDZ landmine `flatBed` below documents. */
const TWO_SHIFTS_MIN = 2 * 8 * 60;
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
 *
 * ⚠ A FUNCTION, NOT A CONST, AND THAT IS LOAD-ORDER LOAD-BEARING. As a
 * top-level const this read `APT_X0` the instant this module's body ran, which
 * was fine only while nothing imported this module before `ct/apartment.ts`
 * had finished initialising. `ct/jobs.ts` now imports this module (the punch
 * clock asks the body how much it has left), eleven interiors import
 * `ct/jobs.ts`, and that new edge was enough to run this body inside the
 * trunk's — `Cannot access 'APT_X0' before initialization`, world dead at
 * boot. Read at CALL time and the coupling to the trunk cannot exist at load
 * time at all; the numbers are still the apartment's own, never copied.
 */
const flatBed = () =>
  ({ x: APT_X0 - 2.6, z: APT_Z0 + 4.2, yaw: Math.PI / 2, gy: 2 * ST0 });

// ── state ──────────────────────────────────────────────────────────────────
/** WEAR on the body since the last sleep, in game-minutes — the thing sleeping
 *  resets. An idle minute costs one; a minute on shift costs `WORK_RATE`, so
 *  this is no longer literally "minutes awake" and the gauges read it as a
 *  fraction of `limitMin()` rather than as a clock. */
let awakeMin = 0;
/** game-minutes spent ON SHIFT since the last sleep — the counter the
 *  two-shift guarantee reads. Distinct from `awakeMin`: this one is literal
 *  clock time behind the grill, unweighted by `WORK_RATE`. Reset by every
 *  sleep, the pass-out included. */
let workedMin = 0;
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
let passing = false;

/** game-minutes of the NEXT clock jump that are a shift and not a night —
 *  armed by `workStretch` an instant before `ct/jobs.ts` starts its fade, and
 *  spent by the observer when the jump lands. Deliberately NOT saved: it is
 *  alive only for the ~400 ms of one fade, and a save cannot land inside one. */
let workPending = 0;
/** how the notes name the employer you are currently on the clock for —
 *  'the barn', 'the diner'. Set with the stretch, read once by the collapse so
 *  it can say where you fell, cleared by the collapse and by any real sleep. */
let workAt: string | null = null;

function limitMin(): number { return BASE_MIN + boostMin; }

/**
 * ── WHAT `ct/jobs.ts` ASKS, AND WHAT IT IS TOLD ────────────────────────────
 *
 * `workMinutesLeft()` is the punch clock's half of the deal: how many minutes
 * of WORK the body has left in it, which is the wear margin divided by what
 * work costs. The clock caps the stretch it hands out with this, so a shift
 * ends the moment the body does rather than paying you for eight hours you
 * could not have stood through — and the collapse then fires on the very next
 * frame, out of the observer's ordinary `left <= 0`, with the player standing
 * at the clock, no fade of its own left running and no panel up.
 *
 * NEVER NEGATIVE, and never a reason for the clock to REFUSE — *"if were in
 * we can always work"*. Two minutes left means a two-minute stretch and then
 * the floor, which is the joke working exactly as written.
 *
 * AND NEVER SHORT OF THE SECOND SHIFT (2026-08-15): *"working two shifts for
 * sure has you blinking and sleepy"* presumes you can WORK the two shifts, so
 * the body always answers for at least whatever remains of the first
 * `TWO_SHIFTS_MIN` on the clock — the wear cap only starts cutting stretches
 * short from the third punch on, where "work yourself to passing out" still
 * lives (after the double, ~40 minutes are left in you and then the floor).
 */
export function workMinutesLeft(): number {
  const byWear = Math.max(0, (limitMin() - awakeMin) / WORK_RATE);
  return Math.max(byWear, TWO_SHIFTS_MIN - workedMin);
}

/** Declare a stretch about to be snapped through behind a fade. Call it BEFORE
 *  starting that fade; the observer charges the jump as time on your feet. */
export function workStretch(mins: number, at: string): void {
  if (!(mins > 0)) return;
  workPending += mins;
  workAt = at;
}

// ══ THE BODY AS THE GAUGE — vignette and blinks, no text ═══════════════════
//
// *"as the player gets more sleepy, dont make it that theres text on screen
//  make it so theres a vignette on screen getting darker, closing in until
//  you pass out. maybe lots of blinking before the true end"*   (2026-08-09)
//
// That KILLS the two HUD warning lines this module shipped with ("you can't
// stop yawning…", "you can barely keep your eyes open…") — the body tells you
// now. Two screen-space DOM layers, built the way `ct/hud.ts` builds the fade
// and the night wash (getElementById-or-create, fixed, inset 0,
// pointer-events none — they swallow NOTHING, so Escape owes them nothing):
//
//   the VIGNETTE, z 7 — a CSS radial-gradient, and that is a stated choice:
//   the no-gradients rule is world texture grammar (`glowT`'s domain, paint on
//   meshes); this is a screen-space effect like the fade div, which is exactly
//   as smooth. It sits with the night wash (5), UNDER every piece of HUD
//   chrome — the highlight (9), the watch (11), the stamp (12), the note
//   (13), the panel backdrop (14) — because it is the state of his eyes, not
//   a panel.
//
//   the LIDS, z 17 — two black bands closing from the top and bottom edges to
//   meet at the middle, which is what a blink IS. Over the prompt (16) and the
//   note (13) deliberately: eyes shut see no HUD. Under the fade (20) and far
//   under the GAME OVER card (60), and a blink never STARTS while a panel, a
//   fade or the card is up — `panelUp() || screenFading() || gameOverUp()` —
//   and aborts instantly if one arrives mid-blink, so it can never read as
//   the UI breaking.
//
// Driven per frame off the same margin the pass-out reads, so a stimulant
// that buys hours back visibly pushes the rim out and stills the blinking —
// the dose reading as relief is the whole feedback loop now.

let vigDiv: HTMLDivElement | null = null;
let lidDiv: HTMLDivElement | null = null;
let vigLast = -1;
/** the blink in progress, in wall-clock ms measured from `Frame.t` seconds */
let blink: { t0: number; down: number; hold: number; up: number } | null = null;
/** wall-clock second the next involuntary blink fires; 0 = re-seed the grace */
let nextBlink = 0;

function overlay(id: string, z: number): HTMLDivElement | null {
  try {
    let d = document.getElementById(id) as HTMLDivElement | null;
    if (!d) {
      d = document.createElement('div');
      d.id = id;
      d.style.cssText = `position:fixed;inset:0;opacity:0;pointer-events:none;z-index:${z};`;
      document.body.appendChild(d);
    }
    return d;
  } catch { return null; }        // no DOM, no gauge — the world still runs
}

/**
 * The rim, from how far through the awake window he is (0…1).
 *
 * Nothing at all until TWO-THIRDS of the window is spent (hour 16 of a plain
 * 24), then a soft dark ring that deepens and closes over the last third —
 * eased quadratically, so it arrives as a suspicion and finishes as a tunnel.
 * At t = 1 the clear centre is still 38% of the screen and the edge alpha
 * 0.85: CLOSING IN, NEVER CLOSED — the last of the dark is the pass-out's
 * own fade, not this.
 */
function drawVignette(frac: number): void {
  const t = Math.min(1, Math.max(0, (frac - 2 / 3) * 3));
  const e = t * t;
  if (Math.abs(e - vigLast) < 0.004) return;     // only touch style on change
  vigLast = e;
  vigDiv ??= overlay('ct-vignette', 7);
  if (!vigDiv) return;
  if (e <= 0) { vigDiv.style.opacity = '0'; return; }
  const hole = 95 - 57 * e;                      // 95% clear -> 38% clear
  const alpha = 0.85 * e;
  vigDiv.style.background =
    `radial-gradient(ellipse at center, rgba(0,0,0,0) ${hole.toFixed(1)}%, rgba(0,0,0,${alpha.toFixed(3)}) 100%)`;
  vigDiv.style.opacity = '1';
}

/** both lids, 0 open … 1 met in the middle. */
function setLids(c: number): void {
  lidDiv ??= overlay('ct-lids', 17);
  if (!lidDiv) return;
  if (c <= 0) { lidDiv.style.opacity = '0'; return; }
  const h = Math.min(1, c) * 50;
  const lo = h.toFixed(2), hi = (100 - h).toFixed(2);
  lidDiv.style.background =
    `linear-gradient(#000 ${lo}%, transparent ${lo}%, transparent ${hi}%, #000 ${hi}%)`;
  lidDiv.style.opacity = '1';
}

/**
 * ── BLINKING BEFORE THE TRUE END — the last hour of margin ────────────────
 *
 * Fast lid-down, slower lid-up, which is what an involuntary blink is. Rare
 * and quick when the hour begins; longer and closer together as the collapse
 * nears, so the pass-out arrives as the blink that doesn't open:
 *
 *   60 min left   ~every 10 s,  90 / 40 / 200 ms  (down / held shut / up)
 *    0 min left   ~every 2.5 s, 90 / 180 / 460 ms
 *
 * with ±30% jitter on the gap, because a metronome is a mechanism and a body
 * is not. Driven piecewise per frame off `Frame.t` — no setTimeout to leak,
 * nothing to cancel except by writing the state null.
 */
function blinkStep(t: number, leftMin: number): void {
  if (blink) {
    const gated = screenFading() || panelUp() || gameOverUp();
    const ms = (t - blink.t0) * 1000;
    const { down, hold, up } = blink;
    if (gated || ms >= down + hold + up) { blink = null; setLids(0); return; }
    const c = ms < down ? ms / down
      : ms < down + hold ? 1
      : 1 - (ms - down - hold) / up;
    setLids(c);
    return;
  }
  if (leftMin > 60 || passing) { nextBlink = 0; return; }
  if (screenFading() || panelUp() || gameOverUp()) { nextBlink = Math.max(nextBlink, t + 1.5); return; }
  if (nextBlink === 0) { nextBlink = t + 4 + Math.random() * 4; return; }   // the grace
  if (t < nextBlink) return;
  const u = 1 - Math.max(0, leftMin) / 60;
  blink = { t0: t, down: 90, hold: 40 + 140 * u, up: 200 + 260 * u };
  nextBlink = t + (10 - 7.5 * u) * (0.7 + Math.random() * 0.6);
}

/** Sleep, pass-out and the wipe all owe an instantly clear screen. */
function clearApproach(): void {
  blink = null;
  nextBlink = 0;
  vigLast = -1;
  setLids(0);
  if (vigDiv) vigDiv.style.opacity = '0';
}

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

  // WHERE YOU FELL, read before the fade clears it. Non-null only when the
  // stretch that finished you was a shift, which is the whole difference
  // between "you stayed up too long" and "you worked yourself into the floor".
  const fell = workAt;
  const wake = slept ?? flatBed();
  // Was *"a percentage between 1-10%"* (2026-08-08); raised at his word —
  // *"make passing out a little bit more punishing (higher percentage of
  // funds lost)"* (2026-08-15) — to a whole percent, 10…20, rolled at the
  // moment you go down. Runtime `Math.random`, never `ct/rng.ts`'s seeded
  // stream: that one is the world's build grain (GOTCHAS §2) and this is dice.
  const pct = 10 + Math.floor(Math.random() * 11);
  let lost = 0;

  // EIGHT HOURS OUT COLD — the same span every sleep in this world now is
  // (*"you always just sleep 8 hours"*, 2026-08-09, and the bed and the hotel
  // both follow it). This used to snap to the next 07:00 like the old bed;
  // a body that collapses does not keep the bed's appointments, it is simply
  // gone for eight hours, and one rule everywhere beats two.
  const mins = 8 * 60;

  // REBALANCED against the bed's 500/150/650 (*"make sleep animation a little
  // longer"*, 2026-08-09): when bedtime became a slow drift, a 520 ms fall
  // here stopped reading harsher than it. So the collapse is now the SLAM —
  // down in 140 ms, the exact grammar of the blinks above (their lids drop in
  // 90) arriving as the one that doesn't open — then the longest dead black
  // and the slowest rise in the game, because coming to is slower than waking.
  // Chosen 140 / happens-to-you 880: the distinction lives in the ATTACK now,
  // not the total. The hold stays above the 90 ms floor `ct/apartment.ts`
  // documents (the renderer needs a frame to draw the advanced world).
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
      awakeMin = 0; boostMin = 0; workedMin = 0;
      workPending = 0; workAt = null;   // the shift ended the hard way
      slept = { ...wake };
      clearApproach();      // he wakes with open eyes and a clear rim
    },
    outMs: 140, holdMs: 260, inMs: 880,
  }).then(() => {
    passing = false;
    // One HUD line, no panel — waking must never trap input. The note fades
    // on its own and Escape owes nothing. The work wording is the same
    // sentence with the cause named: you did not drift off, you dropped, and
    // the pockets they went through had a shift's wages in them an hour ago.
    const how = fell ? `you went down on the floor of ${fell}.` : 'you blacked out.';
    hudNote(lost > 0
      ? `${how} somebody went through your pockets — $${lost.toFixed(2)} gone.`
      : `${how} at least your pockets were already empty.`, 6500);
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
  awakeMin: number; boostMin: number; workedMin?: number;
  slept: { x: number; z: number; yaw: number; gy: number } | null;
}>('fatigue', {
  capture: () => ({ awakeMin, boostMin, workedMin, slept: slept ? { ...slept } : null }),
  restore: (v) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.awakeMin === 'number' && Number.isFinite(v.awakeMin) && v.awakeMin >= 0) awakeMin = v.awakeMin;
    if (typeof v.boostMin === 'number' && Number.isFinite(v.boostMin) && v.boostMin >= 0) boostMin = v.boostMin;
    // optional: saves from before the two-shift guarantee simply restart the
    // count, which errs toward letting him work — the forgiving direction
    if (typeof v.workedMin === 'number' && Number.isFinite(v.workedMin) && v.workedMin >= 0) workedMin = v.workedMin;
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

  ctx.onFrame((f) => {
    const t = ctx.clock.now().totalMin;
    if (lastMin === null) { lastMin = t; return; }
    const d = t - lastMin;
    lastMin = t;
    if (d <= 0) return;

    if (d > JUMP_MIN) {
      if (screenFading()) {
        // ── A SHIFT, DECLARED — see the header. Charged, not credited ──────
        // You lived every minute of it, on your feet, and it cost you MORE
        // than the minutes: no reset, no heal, no new sleep spot, and the rim
        // is redrawn here so it has already closed in by the time the screen
        // comes back up. `left <= 0` is left to the next ordinary frame —
        // `passOut` would refuse anyway while this fade is still running.
        if (workPending > 0) {
          const worked = Math.min(d, workPending);
          workPending -= worked;
          const before = workedMin;
          workedMin += worked;
          awakeMin += worked * WORK_RATE;
          // ── THE DOUBLE SHIFT, EXACTLY AS PROMISED (2026-08-15) ───────────
          // *"working two shifts for sure has you blinking and sleepy but you
          // have an ingame hour to get home to sleep or to buy caffeine."*
          // The stretch that carries the clock past two shifts SETS the margin
          // to `GRACE_MIN` — both directions, deliberately: below it and the
          // hour would be a lie, above it and the blinking would be a maybe.
          // Idle drain is one game-minute per game-minute, so the hour on the
          // meter is the hour on the street clock, to the minute. A dose in
          // that hour grows `limitMin()` and the margin with it, so caffeine
          // clears the state exactly as the sentence says; sleep resets all
          // of it. Fires only at the crossing, once per waking — the third
          // shift gets no such mercy and ends on the floor.
          if (before < TWO_SHIFTS_MIN && workedMin >= TWO_SHIFTS_MIN) {
            awakeMin = limitMin() - GRACE_MIN;
          }
          drawVignette(awakeMin / limitMin());
          flush();
          return;
        }
        // A sleep cut — the bed, the hotel, or this module's own pass-out.
        // Reset the stretch and remember where he was standing when the
        // screen went black: that is where "wherever you slept" is.
        awakeMin = 0; boostMin = 0; workedMin = 0;
        // whatever was on the clock is over — you are not on shift in your bed
        workPending = 0; workAt = null;
        clearApproach();
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

    // The body is the gauge — no text. A dose that buys hours back drops
    // `awakeMin / limitMin()` in the same frame, so the rim visibly recedes
    // and the blinking stills the moment the coffee lands.
    drawVignette(awakeMin / limitMin());
    blinkStep(f.t, left);

    if (left <= 0) passOut(ctx);
  }, FRAME.LATE);
}

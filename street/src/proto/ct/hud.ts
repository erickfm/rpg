import * as THREE from 'three';
import { SHA, DIRTY, AT } from 'virtual:build-stamp';

// ── the sky the clock drags around, the watch, and the wallet ─────────────
//
// Everything the player sees that is NOT in the scene graph: the day/night
// colour curves, the fullscreen night wash, the wrist-and-watch close-up, the
// bifold wallet, and the [E] prompt. All DOM + 2D canvas.
//
// The HUD draws FROM game state but owns none of it — the sim loop in
// crosstown.ts keeps the clock, and the purse is handed in. The only state
// here is presentational: is the wallet out, which minute is on the LCD.

/** The player's pockets — the wallet is a view onto this, nothing more. */
export interface Purse {
  cash: number;
  inv: Record<string, number>;
  /**
   * What the BANK has, as opposed to what is in your pocket.
   *
   * Optional because `crosstown.ts` builds the purse and is desk-owned, so this
   * cannot be given a default there without a coordination step; `ct/atm.ts`
   * seeds it on first use instead. Everything else about it is ordinary.
   *
   * It has to be a separate number from `cash` or the ATM has nothing to do:
   * withdrawing money moves it from here to there, and a machine whose balance
   * IS your cash can only ever tell you what your own wallet already says.
   */
  account?: number;
  /** is your bank card in the wallet? Optional, defaults to yes. */
  card?: boolean;
  /**
   * THE PIN THE CARD IS ENROLLED WITH. `undefined` until the first visit to a
   * cash machine sets it.
   *
   * *"also the first time you go to the atm it saves your pin."*
   *
   * Here rather than in `ct/atm.ts` because it is a property of the CARD, not of
   * one screen — it belongs beside `card` and `account` for the same reason
   * `account` does, and `ct/atm.ts:140` recorded the compromise it was waiting
   * for someone to be in this file to undo (item 216).
   *
   * The behaviour that has to hold is the one the cash figure already has: the
   * ATM, the wallet and the bank's loan desk all read ONE `purse.cash`, and a
   * PIN that forgot itself on a different schedule from the money it guards
   * would read as a bug. It now lives and dies with the purse, exactly as the
   * cash does.
   *
   * Optional for the same reason `account` is: `crosstown.ts` builds the purse
   * and is desk-owned, so this cannot be given a default there without a
   * coordination step. `undefined` is not a sentinel needing a comment — it IS
   * "this card has never been used", which is the state the machine's
   * `CHOOSE A PIN` screen exists for.
   */
  pin?: string;
}

export interface Hud {
  /** sky colour at hour h. A SHARED colour, rewritten in place every call. */
  skyAt: (h: number) => THREE.Color;
  /** how dark the night wash sits at hour h (0 by day … 0.34 deep night) */
  nightAt: (h: number) => number;
  /** drive the night wash */
  setNight: (v: number) => void;
  /** look down → the watch slides up. Only repaints when the minute turns. */
  watch: (want: boolean, mins: number) => void;
  /** The frame-rate readout, toggled with F. `null` hides it.
   *
   *  The user: *"i get awful performance drops in my room not sure why. can we
   *  also get an fps counter?"* — so it reports the WORST frame in the window
   *  as well as the mean, because a mean hides a drop, which is the whole
   *  subject. Off by default and toggled rather than pinned to a corner: he had
   *  the standing HUD text removed, and a number nailed to the screen forever
   *  is that same complaint in a new coat. */
  setFps: (text: string | null) => void;
  /** right-click: flip the wallet out / away */
  toggleWallet: () => void;
  /** put the wallet away. `ct/inventory.ts` calls this when the POCKETS open:
   *  both are held objects centred at the bottom of the frame, so two out at
   *  once would be one drawn over the other. One thing in your hands at a time. */
  closeWallet: () => void;
  /** repaint the wallet if it happens to be open (after a buy, after feeding) */
  refreshWallet: () => void;
  /** the [E] hint under the crosshair; null hides it */
  prompt: (text: string | null) => void;
  /**
   * A line that says what just HAPPENED, and then goes away.
   *
   * Distinct from `prompt`, which says what you COULD do and is rewritten every
   * frame from whatever you are looking at — a result posted into it would be
   * gone on the next frame. Pocketing something, dropping it, and being refused
   * because your pockets are full all need to survive looking away.
   *
   * It sits above the prompt so the two never fight for the same line, and it
   * fades rather than cutting, because at the bottom of the screen a hard
   * disappearance reads as a glitch.
   */
  note: (text: string, ms?: number) => void;
  /**
   * FADE THE SCREEN TO BLACK, do something, and fade back.
   *
   * *"when the player goes to sleep i want the screen to fade to black"* — and
   * it is deliberately NOT a sleep verb. It is a screen fade with a callback in
   * the middle, because passing out, a cut to somewhere else and the bus all
   * want exactly this, and `ct/apartment.ts` owns the sleeping.
   *
   *     await ctx.hud.fade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) });
   *
   * `mid` runs WHILE THE SCREEN IS BLACK, never before the fade starts. That
   * ordering is the whole thing: advance the clock first and the fade-in shows
   * a room that has already changed, which reads as a loading screen rather
   * than as sleeping. And black is HELD for a beat between the two halves — a
   * fade straight from black back to bright is a blink, not a night.
   *
   * Nothing moves or interacts while it runs. Keys already HELD when it starts
   * are released as well as blocked, so walking into your own bed does not walk
   * you across the room in the dark.
   *
   * Resolves when the screen is back. A second call while one is running is
   * ignored and returns the one in flight — two overlapping fades would fight
   * over the same opacity.
   */
  fade: (o?: { mid?: () => void; outMs?: number; holdMs?: number; inMs?: number }) => Promise<void>;
  /** is a fade running right now? For anything that must not act mid-cut. */
  fading: () => boolean;
  /**
   * Outline whatever the `[E]` would act on, in screen space.
   *
   * *"i want to be able to interact with things a lot easier and for them to
   * have a little outline highlighted for the selection of it."*
   *
   * Takes a screen-space rectangle in CSS pixels, or null to clear. The caller
   * projects, because the camera is not the HUD's business — but the DRAWING is,
   * which is why this lives here and not in the world: an outline that is part
   * of the scene has to fight depth, night grading and the fog, and this world
   * is unlit MeshBasicMaterial where a world-space outline would either be
   * occluded by the thing it is outlining or float in front of everything.
   *
   * Deliberately a thin hard-edged box and not a glow: 8–32 px/m, no lighting,
   * no bloom anywhere in the world. Two nested 1 px strokes — dark outside,
   * pale inside — so it reads against both the brick and the sky, which is the
   * same trick the citizens' rim light uses.
   */
  highlight: (rect: { x: number; y: number; w: number; h: number } | null) => void;
}

// ── what the screen layer lets other modules PLUG IN ──────────────────────
//
// This file used to `import { slots, POCKETS, closePockets, refreshPockets,
// bindHud } from './inventory'`, and that had to go the moment the pockets
// wanted anything back out of here: `ct/hud.ts` and `ct/inventory.ts` would
// have imported each other, and BOTH are collected by `ct/world.ts`'s eager
// glob. GOTCHAS §28 is exactly that — a module in an import cycle can resolve
// to an undefined namespace at collection time and be silently dropped, in the
// BUILT BUNDLE ONLY, which is the worst way round.
//
// So the dependency runs one way now: the screen kit knows nothing about
// pockets, and anything that wants to appear on the screen registers itself.
// The kit is a kit; it should not have a list of its customers.

/** what the wallet prints beside your things: "2/6 pockets" */
let pocketInfo: (() => { used: number; max: number }) | null = null;
export function setPocketInfo(fn: () => { used: number; max: number }): void { pocketInfo = fn; }

/** things held in the player's hands that must go away when something else
 *  comes out. Registered rather than named, so the kit needs no list. */
const HELD_CLOSERS: (() => void)[] = [];
export function registerHeldObject(close: () => void): void { HELD_CLOSERS.push(close); }
function closeHeld(): void { for (const c of HELD_CLOSERS) c(); }

/** ONE SIGNAL FOR "THE PURSE CHANGED", which every view listens to. Everything
 *  in the world that spends or earns already calls `ctx.refreshWallet()`, so a
 *  second view costs those callers nothing. */
const PURSE_WATCH: (() => void)[] = [];
export function onPurseChange(fn: () => void): void { PURSE_WATCH.push(fn); }

/** post a line on the transient strip from anywhere. */
export function hudNote(text: string, ms?: number): void { LIVE?.note(text, ms); }

// ── holding the player still ──────────────────────────────────────────────
//
// `src/main.ts` owns the input Set and `src/proto/fp.ts` owns the rig, and BOTH
// ARE DESK-OWNED. So this does not reach into either: it takes the events
// before they get there.
//
//   · a CAPTURE listener on `window` runs before main.ts's own listeners,
//     which are on `window` (keydown/keyup/mouseup) and `document`
//     (mousemove) in the bubble phase. `stopImmediatePropagation()` there and
//     the key never reaches the Set.
//   · KEYUP AND MOUSEUP ARE DELIBERATELY LEFT ALONE. Swallowing a release
//     while blocking the press is how you strand a key in the Set held-down
//     forever — the player would wake up walking.
//   · and a press already held when the lock goes on is in the Set ALREADY, so
//     blocking new ones does nothing for it. Those get a synthetic keyup,
//     which is main.ts's own documented way of clearing one.
//
// Shared by the fade and by every panel, because "the world is frozen behind
// it" is the same requirement in both and two implementations of it would drift.
const HELD_KEYS = ['w', 'a', 's', 'd', 'c', 'e', 'shift', ' ',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
// `click` IS IN THIS LIST AND IT HAS TO BE. `main.ts:30` re-takes pointer lock
// on the CANVAS'S CLICK EVENT, not on mousedown — so swallowing mousedown, as
// this list did, blocked the button press and let the click sail past to grab
// the pointer anyway. On a screen-space panel that costs nothing and hid the
// bug for months; on a diegetic one it is fatal, because a locked pointer stops
// reporting clientX/clientY, so the first click on a machine froze the cursor
// and every click after it missed. One click worked, then the surface went
// dead — measured, not guessed, by watching `document.pointerLockElement` flip
// on exactly the click that broke it.
//
// The gate's contract is that the world behind a panel hears NOTHING, and a
// click reaching the world to seize the mouse is the world hearing something.
const BLOCKED = ['keydown', 'mousedown', 'click', 'mousemove', 'wheel'];
// `wheel` on `window` is PASSIVE BY DEFAULT — the browser assumes a root-level
// wheel listener is a scroll observer and refuses its `preventDefault`, with a
// console warning per event. So every registration here is explicit about it.
// Found by a check that counts console errors; without that it would have been
// a silent line in a log nobody reads.
const CAP = { capture: true, passive: false } as const;
const swallow = (e: Event) => { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); };

/** Let go of anything the player is holding down. */
function releaseHeld(): void {
  for (const k of HELD_KEYS) window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
  window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));   // and the wallet's right button
}

/**
 * Freeze the world. Returns the undo — always call it, on every exit path.
 *
 * **ESCAPE IS NEVER SWALLOWED**, by this or by anything else in this file, and
 * that is not a nicety — it is the difference between a modal and a trap. C
 * found the user's *"pressing e doesnt get me out of it"* on a casino slot
 * stool: sitting opened a panel, the panel's gate ate every keydown, and so
 * neither `E` nor `Escape` ever reached the world. **Both of that night's fixes
 * — a state-exit for standing up, and the first Escape binding this world has
 * ever had — were downstream of a swallowed event and neither could be
 * reached.** A fix below the layer that eats the input is not a fix.
 *
 * So the cancel key is exempt at the swallow itself, in the one place every
 * blocker in this file goes through.
 */
const isCancel = (e: Event) => e.type === 'keydown' && (e as KeyboardEvent).key.toLowerCase() === 'escape';

function blockInput(): () => void {
  releaseHeld();
  const guard = (e: Event) => {
    if (isCancel(e)) { closePanels(); return; }     // always a way out
    swallow(e);
  };
  for (const k of BLOCKED) window.addEventListener(k, guard, CAP);
  return () => { for (const k of BLOCKED) window.removeEventListener(k, guard, true); };
}

// ── `[E]` OPENS A MACHINE AND `[E]` CLOSES IT — so one physical key drives ──
// both edges of a toggle, and the press that does one must never be read as
// the press that does the other.
//
// THE BOUNCE IS REAL IN BOTH DIRECTIONS, and neither is theoretical:
//
//   · CLOSING. `crosstown.ts:2038` reads `E` as an edge off a held-keys Set,
//     once per rendered frame. Closing tears the gate down, so the auto-repeat
//     `keydown`s of a key the player is STILL HOLDING land in the world and
//     re-open the machine he just left.
//   · OPENING. The gate goes up while the opening `E` is still down, and this
//     file now reads `E` at the gate as "close" — so holding `E` for much over
//     the system's repeat delay would open a machine and immediately shut it.
//
// `dismissedAt` in `makePanel` does not cover either. It is 500 ms, the same
// order as a typical auto-repeat delay, so it is a race rather than a rule; it
// guards only the panel's own `open()`, while the spot's `act()` — which may
// also SEAT the player — runs regardless.
//
// THE RULE INSTEAD: THE KEY MUST BE PHYSICALLY RELEASED BEFORE IT ACTS AGAIN.
// While latched, every `keydown` for that key is swallowed at capture and the
// real `keyup` disarms it. A timer cannot substitute — `down` → 90 ms → `up`
// is how the checks drive `[E]`, so a latch that expired on a clock would pass
// every check and still fail a human leaning on the key.
let latchedKey: string | null = null;
let latchTimer = 0;

/** Is this key held down FOR REAL, right now? */
const physical = new Set<string>();
function trackPhysical(e: Event): void {
  // SYNTHETIC RELEASES DO NOT COUNT. `releaseHeld()` fires a `keyup` for every
  // key in `HELD_KEYS` to clear main.ts's Set, but the player's finger is still
  // on the button — believing that keyup is how the open-side latch would miss
  // the very case it exists for. Real input is trusted; ours is not.
  if (!(e as KeyboardEvent).isTrusted) return;
  const k = (e as KeyboardEvent).key?.toLowerCase();
  if (!k) return;
  if (e.type === 'keydown') physical.add(k); else physical.delete(k);
}
if (typeof window !== 'undefined') {
  // Registered at module load, which puts it AHEAD of every gate in capture
  // order — listeners on one target in one phase run in registration order, and
  // the gate stops propagation. It only ever records; it never swallows.
  const OBS = { capture: true, passive: true } as const;
  window.addEventListener('keydown', trackPhysical, OBS);
  window.addEventListener('keyup', trackPhysical, OBS);
}

function latchSeen(e: Event): void {
  if (!latchedKey || (e as KeyboardEvent).key?.toLowerCase() !== latchedKey) return;
  // ONLY A REAL RELEASE DISARMS THIS, and that guard is the whole latch.
  //
  // `releaseHeld()` fires a synthetic `keyup` for every key in `HELD_KEYS` — `e`
  // among them — and it runs immediately AFTER the open-side latch is armed. So
  // without this line the latch disarmed itself microseconds after arming, the
  // first auto-repeat sailed through, and a machine opened with a normal human
  // press shut itself again. Measured, not reasoned: `__hud.latched()` read
  // `null` one frame after an open that had just called `latch('e')`.
  if (!(e as KeyboardEvent).isTrusted) return;
  // THE RELEASE IS NEVER SWALLOWED — see the note on `HELD_KEYS`: eat a keyup
  // and you strand the key down forever, and the player wakes up walking.
  if (e.type === 'keyup') { unlatch(); return; }
  swallow(e);
}

function unlatch(): void {
  if (!latchedKey) return;
  latchedKey = null;
  clearTimeout(latchTimer);
  window.removeEventListener('keydown', latchSeen, true);
  window.removeEventListener('keyup', latchSeen, true);
}

/**
 * Hold `k` inert until the player lets go of it.
 *
 * The timeout is a LEAK STOP and not the mechanism: if the window loses focus
 * between the press and the release, the `keyup` is delivered to somebody else
 * and never arrives, which would otherwise leave `E` dead for the rest of the
 * session. It is long enough that no held key reaches it in normal play.
 */
function latch(k: string): void {
  unlatch();
  latchedKey = k;
  window.addEventListener('keydown', latchSeen, CAP);
  window.addEventListener('keyup', latchSeen, CAP);
  latchTimer = window.setTimeout(unlatch, 2000) as unknown as number;
}

/** The key that leaves a machine. `[E]` got you in; `[E]` gets you out. */
const EXIT_KEY = 'e';
/**
 * WHAT THE CAPTION MAY HONESTLY PROMISE, given what the panel is doing: the bare
 * key name, for testing whether a hand-written hint already mentions it, and the
 * player-facing stamp, for drawing.
 *
 * THE STAMP IS BRACKETED BECAUSE `[E]` IS ALREADY HOW THIS WORLD NAMES THAT KEY.
 * `hud.prompt` writes `[E] <label>` over every spot the player can use, so the
 * caption and the prompt are now the same affordance said the same way.
 *
 * The first cut printed a bare `E` and it read badly — judged by looking at it,
 * not by reasoning about it. The slots strip came out as
 * `SPACE spin · B bet · M max · I insert $5 · C cash out · E`, where every other
 * token is a key AND a verb and the last one was neither; it scans as a list
 * that got cut off rather than as the way out. Hence the bracket and the verb.
 */
const exitKey = (spec: PanelSpec): string => (spec.typing?.() ? 'ESC' : 'E');
const exitStamp = (spec: PanelSpec): string => `[${exitKey(spec)}]`;

// ══ THE PANEL FRAMEWORK ═══════════════════════════════════════════════════
//
// THREE full-screen interfaces are being built at once — the slots machine
// (builder L), the ATM, and the pockets — by three people. Three panels built
// three times is three different-looking UIs in one small hand-made world, and
// that is the kind of thing this user spots in one screenshot.
//
// So the cabinet is built ONCE, here, and published. A caller supplies the
// SCREEN — what is inside the glass — and gets everything around it for free
// and identical to everyone else's:
//
//     const atm = makePanel({
//       id: 'ct-atm', w: 260, h: 180, chrome: 'machine',
//       title: 'FIRST FEDERAL',
//       hint: () => 'ESC  step back',
//       draw: (g, w, h) => { …the amber screen… },
//       key: (k) => { …one keystroke… },
//     });
//     atm.open();
//
// What the framework owes you, all of it the same for all three:
//
//   · OPEN AND CLOSE, and ONE AT A TIME — opening any panel puts away every
//     other, including the wallet and the pockets. Two cabinets held up at once
//     is one drawn over the other.
//   · THE WORLD FROZEN BEHIND IT. You cannot walk, look, interact or open
//     anything else while a panel is up, and a key you were already holding is
//     released rather than merely blocked.
//   · A CLEAN EXIT. ESC always closes, from every panel, without the caller
//     writing a line — a player who cannot find the way out of a machine is
//     the worst failure available to an interface like this.
//   · ONE BEZEL AND ONE TYPEFACE, so the three read as coming from the same
//     machine shop.
//
// What is YOURS: everything inside the glass. The framework never draws in
// your screen area and never interprets a key you have handled.

// ══ DIEGETIC SCREENS ══════════════════════════════════════════════════════
//
// *"this doesnt look integrated. i want when i hit e here to adjust my position
// and perspective and lock it to be looking at the atm and for the screen on the
// literal atm be the overlay that i can use my mouse to click through."*
//
// The panel framework above draws a machine in SCREEN SPACE — a canvas at
// `position:fixed`, centred, over a dimmed world. That is the thing in his
// screenshot, and it is the last survivor of *"i never want there to be menus
// popping up unless they are embedded to look as if they are in the actual
// game"*: item 0c took the framework's beige chrome off the ATM, which stopped
// it looking like a dialog, but it was still a rectangle floating in front of
// the camera rather than a screen on an object.
//
// A DIEGETIC panel is the same panel with its canvas hung on a MESH instead.
// Everything the framework already guarantees — one at a time, the world frozen,
// ESC always closes, `release` undoes the way in, the dismiss lockout — is
// unchanged and uncopied; only where the pixels land, and where the mouse comes
// from, are different. That is why this lives inside `makePanel` rather than in
// a module of its own: a second implementation of "a modal you cannot escape
// from" is exactly the thing this project has been burned by, and there is now
// only ever going to be one.
//
// THIS IS THE TEMPLATE. Slots, blackjack and the library PC each already draw a
// complete self-contained fascia into a `chrome:'none'` panel; each becomes
// diegetic by naming the mesh its picture belongs on and nothing else.

/** The surface a panel is painted onto, and how the player is put in front of it. */
export interface ScreenSurface {
  /**
   * The mesh whose face IS this screen, resolved at open time rather than at
   * build time — the world is assembled in pieces and a module usually cannot
   * see the object it belongs to when it registers. Return `null` and the panel
   * falls back to the screen-space cabinet, which is what makes this safe to
   * adopt: a surface that cannot be found is a worse-looking panel, not a
   * broken one.
   */
  mesh: () => THREE.Object3D | null;
  /** how far the eye settles off the face, in metres along its normal */
  standoff?: number;
  /** the field of view to lean in to. Narrower reads as leaning closer. */
  fov?: number;
  /** is there something pressable at this canvas pixel? Drives the cursor. */
  hot?: (x: number, y: number) => boolean;
  /** a click landed at this canvas pixel */
  click?: (x: number, y: number) => void;
  /**
   * WHICH material slot is the screen, when the mesh carries several.
   *
   * `THREE.Mesh.material` is legally `Material | Material[]` — a box whose six
   * faces are painted separately is an array, and that is the ordinary way to
   * build a cabinet with a screen on one face. Leave this unset for the normal
   * single-material case; set it to the slot index when the face you mean is
   * one of many. See `screenSlot` for what happens when it is unset on a mesh
   * that needs it.
   */
  materialIndex?: number;
}

/**
 * The material a diegetic panel should borrow, or `null` to fall back to the
 * screen-space cabinet.
 *
 * WHY THIS EXISTS (item 150). This used to be a bare cast —
 * `mesh.material as THREE.MeshBasicMaterial` — which is a lie whenever the mesh
 * is multi-material, and it did not fail politely. `Mesh.material` being an
 * ARRAY means `mat.color` is `undefined`, so `mat.color.getHex()` threw
 * **TypeError: Cannot read properties of undefined (reading 'getHex')** out of
 * `open()` — and it threw AFTER `gateUp(true)`, i.e. after the player's feet
 * were already frozen. Reproduced on all three diegetic panels in this world
 * (`ct-atm`, `ct-letter`, `ct-loan`) by wrapping their screen material in a
 * one-element array, which changes nothing about how they render:
 * `scripts/probes/w90-item150-multimat-repro.mjs`.
 *
 * There was a quieter half too: `mat.map` on an array is **`Array.prototype.map`,
 * a function**, so `savedMap` captured a function and `close()` then assigned it
 * back — writing an own `map` property onto the array — before throwing again on
 * `mat.color.setHex`. A panel that cannot be closed cleanly is the worst bug
 * this project ships, and this one arrived through a cast.
 *
 * THE RULE: pick the slot the caller named; take slot 0 only when there is
 * nothing to be ambiguous ABOUT; otherwise say which mesh needs a
 * `materialIndex` and degrade. **Guessing a slot would paint the panel onto the
 * wrong face of a box** — a visible bug that is hard to trace back to here —
 * whereas degrading gives the player the screen-space cabinet that panel would
 * have had anyway, which is exactly the failure mode `mesh()` returning `null`
 * is already documented to produce.
 */
function screenSlot(
  mesh: THREE.Object3D,
  surface: ScreenSurface | undefined,
  panelId: string,
): THREE.MeshBasicMaterial | null {
  const m = (mesh as THREE.Mesh).material as
    THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[] | undefined;
  const name = mesh.name || '(unnamed)';
  if (!m) {
    console.error(`[panel ${panelId}] mesh ${name} has no material; using the screen-space cabinet.`);
    return null;
  }
  let pick: THREE.MeshBasicMaterial | undefined;
  if (!Array.isArray(m)) {
    pick = m;
  } else {
    const i = surface?.materialIndex;
    if (i !== undefined) {
      if (!Number.isInteger(i) || i < 0 || i >= m.length) {
        console.error(`[panel ${panelId}] mesh ${name} has ${m.length} material slot(s) `
          + `but surface.materialIndex is ${i}; using the screen-space cabinet.`);
        return null;
      }
      pick = m[i];
    } else if (m.length === 1) {
      // Not a guess: with one slot there is only one face to be wrong about.
      pick = m[0];
    } else {
      console.error(`[panel ${panelId}] mesh ${name} carries ${m.length} materials and the `
        + `surface does not say which slot is the screen. Add `
        + `\`materialIndex\` to its \`surface\` spec. Using the screen-space cabinet.`);
      return null;
    }
  }
  // A MATERIAL THIS CODE CANNOT ACTUALLY BORROW IS ALSO A DEGRADE, NOT A THROW.
  // The two things it goes on to touch are `.map` and `.color`; a material type
  // that has neither (a depth or shadow material, say) would reproduce the
  // original crash one level further in.
  if (!pick || !(pick as THREE.MeshBasicMaterial).color) {
    console.error(`[panel ${panelId}] mesh ${name}'s screen material has no colour to borrow `
      + `(type ${pick ? (pick as THREE.Material).type : 'undefined'}); using the screen-space cabinet.`);
    return null;
  }
  return pick;
}

/**
 * The view half, implemented by `crosstown.ts` — which owns the camera, the rig
 * and the frame loop, none of which this file can see.
 *
 * Registered rather than imported because the dependency runs the other way:
 * every module already imports the HUD, and the HUD importing the world back
 * would be a cycle. Same shape as `setPocketInfo` above.
 */
export interface ScreenFocus {
  /**
   * Ease the eye onto this face, lock the look, and freeze the feet. `escape`
   * is the way back OUT and the focus controller must call it if it loses the
   * lock for any reason it did not initiate — a rig-level Escape, a fade, a
   * teleport. **A locked camera whose panel stayed open is a view you cannot
   * leave**, which is the worst bug this project ships, so the controller is
   * required to report the loss rather than to sit there hoping.
   */
  enter: (o: { mesh: THREE.Object3D; standoff: number; fov: number; escape: () => void }) => void;
  /**
   * Give the view, the look and the feet back.
   *
   * **Returns whether it put the player back in a CHAIR THEY ALREADY HELD**
   * before the screen opened — see `close()`'s `seatedAtOpen` block, which is
   * the only caller and which must not stand them up again on top of it.
   *
   * A boolean rather than nothing, because the two files know different halves
   * of the question and neither can answer it alone. This one knows the player
   * was seated when the panel opened; only the focus controller knows whether
   * that seat was the player's own or one the screen took for itself, because
   * only it called `rig.sit` and watched it early-return. Item 206 is exactly
   * the cost of guessing: `leave()` re-seated the chair and this file stood the
   * player straight back up, so fixing either side alone measured 9/13.
   */
  leave: () => boolean;
  /** where on the focused face is this client-space pointer? `null` = off it */
  pick: (clientX: number, clientY: number) => { u: number; v: number } | null;
}
let FOCUS: ScreenFocus | null = null;
export function setScreenFocus(f: ScreenFocus | null): void { FOCUS = f; }
/** is the world's focus controller wired up at all? */
export function screenFocusReady(): boolean { return FOCUS !== null; }

/** The shared look. Three authors picking three greys is the thing this stops. */
export const UI = {
  /** moulded beige-grey plastic, the colour of every machine made in 1997 */
  case: '#8e8a80', caseHi: '#a5a199', caseLo: '#6b6860', caseEdge: '#4a4842',
  /** the recess the screen sits in */
  well: '#2a2b2e', wellLo: '#1a1b1d',
  /** canvas duck, for the panels you HOLD rather than stand at */
  cloth: '#7a7360', clothHi: '#8a8370', clothLo: '#5f5947',
  /** type */
  ink: '#e8e2d0', dim: '#9a927e', shout: '#f0ead6',
  /** the two screen phosphors this world's machines come in */
  amber: '#e0a63c', amberDim: '#8a6620', green: '#9cab8b', greenDark: '#1c2a1c',
  /** one type scale. `px` is canvas pixels; panels are drawn at 1 px = 1 texel */
  font: (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px ui-monospace, Menlo, monospace`,
} as const;

export interface PanelSpec {
  /** DOM id. Also what `__hud.panel()` reports, so make it recognisable. */
  id: string;
  /** the SCREEN's size in canvas pixels — the bezel is added around it */
  w: number; h: number;
  /** css pixels per canvas pixel. 2 unless the art needs otherwise. */
  scale?: number;
  /**
   * moulded plastic (a machine you stand at), canvas (a thing you hold), or
   * `'none'` — no bezel, no screws, no title stamp, no caption band. Draws
   * ONLY what `draw()` paints, full-bleed.
   *
   * `'none'` is for a caller whose `draw()` ALREADY renders a complete,
   * self-contained fascia — the slot machine's cabinet, the blackjack felt
   * and rail, the ATM's buttons and CRT recess, the library terminal's own
   * monitor bezel all fill their own canvas edge to edge. For those, the
   * framework's plastic case was a SECOND cabinet drawn around a picture of a
   * first one — exactly the *"i never want there to be menus popping up
   * unless they are embedded to look as if they are in the actual game"* law
   * item 0c is named for. `'none'` retires the second cabinet; the caller's
   * own fascia is the only frame the player ever sees.
   *
   * The one thing every panel promises — a caption showing how to leave —
   * still happens: `'none'` prints `hint()` and `ESC` in plain, unboxed text
   * over the bottom edge of the caller's own screen, because a machine that
   * hands you no way out is the worst bug this project ships (see the
   * framework's own rules), and it costs nothing else the design law is
   * against — no beige plastic, no title bar, no floating box.
   */
  chrome?: 'machine' | 'cloth' | 'none';
  /**
   * Override the shared `UI.case*` plastic for THIS panel only. Every other
   * 'machine' panel (slots, blackjack, pockets) keeps the one moulded-beige
   * look on purpose — one bezel, one shop — so this is not a styling knob,
   * it is an escape hatch for the one caller whose screen has to match an
   * object drawn somewhere else in the world rather than an in-house look.
   * Falls back to `UI.case`/`caseHi`/`caseLo`/`caseEdge` for anything unset.
   */
  caseTint?: { body?: string; hi?: string; lo?: string; edge?: string };
  /** stamped into the bezel above the screen. Keep it short and shouty. */
  title?: string;
  /** the caption strip along the bottom. Say how to leave. */
  hint?: () => string;
  /** paint the screen. Origin is the screen's top left; `w`/`h` are yours. */
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  /** a keystroke, already lower-cased. ESC and `[E]` are handled for you. */
  key?: (k: string, e: KeyboardEvent) => void;
  /**
   * "I AM EATING TEXT RIGHT NOW, SO `E` IS A LETTER AND NOT THE EXIT."
   *
   * `[E]` closes every machine view by default — the user's instruction, and
   * the key that opened it is the key that should shut it. That is wrong for
   * exactly one thing in this world: a field you TYPE into. The library
   * terminal's catalogue is one (`library-pc.ts:377` takes any single
   * character), and a framework that stole `e` from it would make *Emma*,
   * *Frankenstein* and *The Republic* unsearchable while ejecting the player
   * out of the machine mid-word.
   *
   * So a panel that consumes text says so, per FRAME rather than once, because
   * the terminal only types on one of its three screens. While this returns
   * true, `e` is passed to `key()` like any other letter and **ESC is the way
   * out** — which is the whole reason the framework keeps Escape as well as
   * `[E]`. The caption follows this automatically, so it cannot advertise a
   * key that will not work.
   *
   * Omit it and `[E]` closes, which is what every machine wants.
   */
  typing?: () => boolean;
  /** the wheel: +1 forward, −1 back */
  wheel?: (dir: 1 | -1) => void;
  onOpen?: () => void;
  onClose?: () => void;
  /**
   * UNDO WHATEVER PUT THE PLAYER HERE. Called on EVERY close, before `onClose`,
   * including the Escape the framework handles for you and the automatic close
   * when another panel opens.
   *
   * If your panel is opened by SITTING DOWN — a slot stool, a blackjack chair,
   * a desk — this is where you stand them up. **A panel that is entered from a
   * state and does not leave it is a trap**, and it is the trap the user hit:
   * the stool seated him, the panel swallowed his keys, and closing the panel
   * left him seated with nothing offered.
   *
   * `openedFromSeat` on `open()` is the structural half — see there.
   */
  release?: () => void;
  /**
   * PAINT THIS PANEL ONTO AN OBJECT IN THE WORLD instead of over the camera.
   * See `ScreenSurface`. Omit it and nothing changes — this is additive, and
   * every existing panel keeps the screen-space cabinet it has today.
   */
  surface?: ScreenSurface;
}

export interface Panel {
  /**
   * Bring it up. `release` undoes whatever put the player here and is called on
   * EVERY close — pass it when the undo depends on how you opened it (a stool
   * seated them; the same panel opened from a doorway did not). A standing
   * `release` on the spec covers the simple case.
   */
  open: (o?: { release?: () => void }) => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  /** redraw the screen. Call it whenever your own state changes. */
  repaint: () => void;
}

const BEZEL = 14, CAPTION = 18, TITLE_H = 14;
let livePanel: { spec: PanelSpec; close: () => void } | null = null;
/**
 * THE POINTER LOCK THE PANEL SYSTEM TOOK, AND OWES BACK.
 *
 * The user, item 277: *"when i exit overlays my mouse stops working as well."*
 * Opening a diegetic panel calls `exitPointerLock()` — correct, you cannot click
 * a screen with a pointer the browser has hidden and pinned to the middle of the
 * canvas. **The half that was missing is the other one:** the entire source
 * holds exactly one `requestPointerLock` (`main.ts:32`) and it hangs off a canvas
 * CLICK, so nothing gave the lock back and the player had to work out for
 * himself that he must click the world to get his camera back.
 *
 * MODULE-LEVEL, NOT PER PANEL, and that is the whole design. `open()` calls
 * `closePanels()` before it raises anything, so a panel closing is routinely a
 * panel being REPLACED — and the debt is owed by the SYSTEM, not by whichever
 * cabinet happened to be up when the pointer was taken. Held per panel, a
 * diegetic panel replaced by a screen-space one either re-locks the pointer
 * underneath the new cabinet (measured: leg 10 of `scripts/pointer-returns.mjs`
 * fails exactly this way) or drops the debt on the floor and leaves the mouse
 * dead once the replacement closes. One slot, handed on, does neither.
 *
 * THE ELEMENT, NOT A BOOLEAN: this file has no idea which canvas the renderer
 * owns and should not learn. `document.pointerLockElement` names it at the
 * moment we take it, so giving it back is a call on the very thing that was
 * locked — derived from the browser rather than a second copy of something
 * `main.ts` owns (BUILDER-BRIEF §8).
 *
 * NULL MEANS "HE NEVER GAVE US ONE" — a player who has not clicked into the
 * world, or a sandboxed artifact iframe where locking is refused outright. That
 * case must never re-lock: seizing a pointer the player never surrendered is a
 * worse bug than the one this fixes.
 */
let pendingLock: Element | null = null;
/**
 * Non-zero while a panel is CLEARING THE WAY for itself.
 *
 * `open()`'s prologue closes whatever is up before raising the new cabinet, so
 * a `close()` running inside it is a hand-over rather than an exit. The pointer
 * must NOT come back there: the player is not returning to the world, he is
 * being shown a different screen. Without this the swap re-locks between the two
 * and the pointer ends up hidden under the incoming cabinet.
 */
let raising = 0;
let gateOn = false;
let backdrop: HTMLDivElement | null = null;

// One capture-phase gate for every panel. It HANDLES first and swallows after,
// so a panel's own keys work while the world behind it hears nothing. Keyup and
// mouseup are absent from this list on purpose — see `releaseHeld`.
//
// IT IS ALSO THE ONLY BLOCKER A PANEL INSTALLS, and that took a bug to learn.
// The first version called `blockInput()` as well, for the freeze — and since
// both are capture listeners on `window`, they fire in REGISTRATION ORDER, so
// the plain swallow ran first and `stopImmediatePropagation()`d the gate out of
// existence. The ATM opened, drew perfectly, and answered no key at all,
// including ESC: a cabinet you could not use and could not leave. The gate
// swallows exactly what `blockInput` does, so the freeze is already in here.
// ── the pointer, while a screen is up ─────────────────────────────────────
//
// The world plays under pointer lock: there is no cursor, and the mouse turns
// your head. A screen you are meant to click needs the exact opposite, so the
// lock is dropped on the way in and the arrow comes back. `main.ts` re-takes it
// on `mousedown`, which never reaches it — the gate swallows mousedown in the
// capture phase — so this needs no cooperation from that file and no flag it
// could get out of step with.
let cursorShape: string | null = null;
function cursorAs(shape: string): void {
  if (shape === cursorShape) return;
  cursorShape = shape;
  document.body.style.cursor = shape;
}

// *"the mouse cursor should be like a lil hand almost like win98 cursor"*.
//
// PIXEL-DRAWN, not a font glyph and not the browser's `pointer` — the whole
// world is 1997 pixel art and the one place a modern OS cursor would appear is
// the moment the player is closest to the screen and looking hardest at it.
//
// TWO of them, which is what Windows 98 actually did and what makes `hot`
// worth having: the arrow everywhere, the pointing hand over something that
// will do something if you click it. So the cursor answers "is this a control"
// before the player commits, and a hand over a dead key would be the machine
// lying about itself.
//
// 16 x 16 at 2x = 32 x 32, which is the size browsers are safe to honour; over
// that Chrome starts refusing the image and falls back, so the art is authored
// to fit rather than scaled up and hoped for. `pointer`/`default` are named as
// the fallback after the url for exactly that case.
const ARROW_ART = [
  'X               ',
  'XX              ',
  'X.X             ',
  'X..X            ',
  'X...X           ',
  'X....X          ',
  'X.....X         ',
  'X......X        ',
  'X.......X       ',
  'X........X      ',
  'X.....XXXX      ',
  'X..X..X         ',
  'X.X X..X        ',
  'XX   X..X       ',
  'X     X..X      ',
  '       XX       ',
];
const HAND_ART = [
  '    XX          ',
  '   X..X         ',
  '   X..X         ',
  '   X..X         ',
  '   X..X         ',
  '   X..XXX       ',
  '   X..X..XX     ',
  'XX X..X..X.X    ',
  'X.XX..X..X.X    ',
  'X..X.......X    ',
  'X..........X    ',
  ' X.........X    ',
  ' X.........X    ',
  '  X........X    ',
  '  X.......X     ',
  '   XXXXXXX      ',
];
/** `X` is the black outline, `.` the white fill, a space transparent. */
function cursorUrl(art: string[]): string {
  const S = 2, N = 16;
  const c = document.createElement('canvas');
  c.width = N * S; c.height = N * S;
  const g = c.getContext('2d')!;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ch = art[y]?.[x] ?? ' ';
      if (ch === ' ') continue;
      g.fillStyle = ch === 'X' ? '#000000' : '#ffffff';
      g.fillRect(x * S, y * S, S, S);
    }
  }
  return c.toDataURL('image/png');
}
/** Built once, on first use — `document` exists by then, and a module-load-time
 *  canvas would run in every harness that only imports this file for `UI`. */
let ARROW_URL: string | null = null;
let HAND_URL: string | null = null;
/**
 * hovering something pressable, or not
 *
 * THE TWO HOTSPOTS BELOW ARE IN THE PIXELS OF THE 32 x 32 PNG, NOT THE 16 x 16
 * SOURCE GRID — they are already doubled, and the obvious "bug" of a
 * source-grid coordinate left undoubled is not present. Verified against the
 * raster rather than reasoned about, by `scripts/probes/w60-cursor-hotspot.mjs`,
 * which parses this file, re-rasterises both cursors the way `cursorUrl` does
 * and marks the declared hotspot pixel:
 *
 *   · the arrow's point is source cell (0,0)   = PNG px x 0…1,  y 0…1  → `0 0` lands on it
 *   · the hand's fingertip is cells x 4…5, y 0 = PNG px x 8…11, y 0…1  → `9 0` lands on it
 *
 * And end to end, by `scripts/probes/w60-cursor-lands.mjs`: at the ATM's PIN
 * pad the cursor turns into the hand within **0.33 texels** of the drawn edge
 * of a key horizontally and 0.31 vertically, and a click 2 px inside that edge
 * enters a digit. So where the pointer POINTS and where the click LANDS agree.
 *
 * Do not "correct" either number without re-running those two. A cursor is one
 * of the few things in this project that cannot be photographed — a CSS cursor
 * is composited by the browser and never appears in a page screenshot — so the
 * raster and the hit-test are the whole of the available evidence.
 */
function cursorHand(over: boolean): void {
  if (over) {
    HAND_URL ??= cursorUrl(HAND_ART);
    cursorAs(`url(${HAND_URL}) 9 0, pointer`);      // hotspot: the fingertip
  } else {
    ARROW_URL ??= cursorUrl(ARROW_ART);
    cursorAs(`url(${ARROW_URL}) 0 0, default`);     // hotspot: the point
  }
}
/** give the page its own cursor back */
function cursorRelease(): void { cursorShape = null; document.body.style.cursor = ''; }

/**
 * Where on the live diegetic screen is this pointer, in the caller's OWN canvas
 * pixels? `null` when there is no such screen or the ray misses it.
 *
 * Canvas pixels rather than UV on purpose: a machine hit-tests against the
 * layout it drew, and it drew in canvas pixels. Handing it a 0…1 pair would
 * make every caller multiply by its own width to get back to the coordinates it
 * already had — and the slots machine's `BET ONE`/`MAX BET`/`SPIN` are laid out
 * exactly the same way the ATM's soft keys are, so this seam is what lets the
 * next machine answer for its own buttons instead of registering rectangles
 * with the framework.
 *
 * UV's origin is bottom-left and a canvas's is top-left, hence the flip on v.
 * Verified against the real mesh rather than assumed: on the ATM screen, u runs
 * 0→1 as world z runs +0.31→−0.31, which with the face looking down +x is left
 * to right from the player's eye, and v = 1 is the top edge.
 */
function surfaceHit(e: MouseEvent): { x: number; y: number } | null {
  const p = livePanel;
  if (!p?.spec.surface || !FOCUS) return null;
  const uv = FOCUS.pick(e.clientX, e.clientY);
  return uv ? { x: uv.u * p.spec.w, y: (1 - uv.v) * p.spec.h } : null;
}

function gate(e: Event): void {
  const p = livePanel;
  // A DESYNCED GATE IS A TRAP. If the gate is somehow installed with no panel
  // behind it — a caller threw mid-open, two panels raced, a close half ran —
  // the world is frozen and nothing can unfreeze it. So the cancel key tears
  // the whole apparatus down rather than being swallowed by a listener that has
  // nothing to close. This costs one branch and removes a class of stuck.
  if (!p) {
    if (isCancel(e)) { gateUp(false); backdropUp(false); }
    return;
  }
  if (e.type === 'keydown') {
    const k = (e as KeyboardEvent).key.toLowerCase();
    // A KEY STILL HELD FROM THE PRESS THAT GOT US HERE DOES NOTHING. Checked
    // here as well as in `latchSeen` so the outcome cannot depend on which of
    // two capture listeners the browser runs first — both mean "swallow it".
    if (k === latchedKey) { swallow(e); return; }
    // ESC ALWAYS CLOSES, from every panel, whatever the caller does. A player
    // who cannot get out of a machine is stuck in the world, and no individual
    // author should be able to forget this. It stays even though `[E]` is now
    // the advertised exit: a second way out costs nothing, and this project's
    // worst bug is a view you cannot leave.
    if (k === 'escape') { p.close(); latch(k); }
    // …AND `[E]`, WHICH IS THE ONE THE PLAYER IS TOLD ABOUT. The user: *"instead
    // of getting out of the atm view or the slots or literally whatever.
    // instread of using esc for that lets make it e."* It belongs here, in the
    // one gate every machine already goes through, rather than in each machine
    // — the ATM, the slots, blackjack, the bank desk, the letters and the
    // pockets all get it from this line and none of them had to be edited.
    // `typing` is the single exception; see `PanelSpec.typing`.
    else if (k === EXIT_KEY && !p.spec.typing?.()) { p.close(); latch(k); }
    else p.spec.key?.(k, e as KeyboardEvent);
  } else if (e.type === 'wheel') {
    p.spec.wheel?.((e as WheelEvent).deltaY > 0 ? 1 : -1);
  } else if (e.type === 'mousemove') {
    // THE POINTER IS A POINTER AGAIN while a screen is up. These events are
    // still swallowed below, so the world neither turns its head nor takes
    // pointer lock back — they are read on the way past and go no further.
    const h = surfaceHit(e as MouseEvent);
    cursorHand(!!h && !!p.spec.surface?.hot?.(h.x, h.y));
  } else if (e.type === 'mousedown') {
    const h = surfaceHit(e as MouseEvent);
    if (h) p.spec.surface?.click?.(h.x, h.y);
  }
  swallow(e);
}

function gateUp(on: boolean): void {
  if (on === gateOn) return;
  gateOn = on;
  for (const k of BLOCKED) {
    if (on) window.addEventListener(k, gate, CAP);
    else window.removeEventListener(k, gate, true);
  }
}

function backdropUp(on: boolean): void {
  if (!backdrop) {
    backdrop = document.getElementById('ct-panelback') as HTMLDivElement | null;
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'ct-panelback';
      // Not black — the world is still there, you have just stopped looking at
      // it. A vignette rather than a flat wash so the middle of the screen,
      // where the cabinet is, stays the brightest thing.
      backdrop.style.cssText = 'position:fixed;inset:0;z-index:14;pointer-events:none;opacity:0;'
        + 'transition:opacity .18s linear;background:radial-gradient(ellipse at center,'
        + 'rgba(4,6,10,.42) 0%,rgba(4,6,10,.72) 100%);';
      document.body.appendChild(backdrop);
    }
  }
  backdrop.style.opacity = on ? '1' : '0';
}

/**
 * EVERY PANEL EVER BUILT, so a guard can open all of them rather than the ones
 * whoever wrote the guard happened to know about.
 *
 * There are five callers now — the slots, blackjack, the ATM, the pockets and
 * M's loan desk — and the trap this file just fixed was in the one nobody had
 * checked. A guard that enumerates panels by hand tests the panels its author
 * remembered; this one cannot miss a new one, because registering IS how a panel
 * comes into existence.
 */
const ALL_PANELS: { id: string; panel: Panel }[] = [];
export function everyPanel(): { id: string; panel: Panel }[] { return ALL_PANELS.slice(); }

/** Put away whatever cabinet is up. Called on every open, and by the HUD when
 *  the wallet or the pockets come out. */
export function closePanels(): void { livePanel?.close(); }
/** Which panel is up, if any. */
export function panelUp(): string | null { return livePanel ? livePanel.spec.id : null; }

/**
 * Build a panel. See `PanelSpec` — you draw the screen, this draws the machine.
 */
export function makePanel(spec: PanelSpec): Panel {
  const scale = spec.scale ?? 2;
  const chrome = spec.chrome ?? 'machine';
  // FRAMELESS: no bezel, no title band, no caption band — the caller's own
  // `draw()` fills the whole canvas. See `PanelSpec.chrome`.
  const frameless = chrome === 'none';
  const titleH = !frameless && spec.title ? TITLE_H : 0;
  const bezel = frameless ? 0 : BEZEL;
  const captionH = frameless ? 0 : CAPTION;
  const CW = spec.w + bezel * 2;
  const CH = spec.h + bezel * 2 + titleH + captionH;
  const SX = bezel, SY = bezel + titleH;

  let wrap = document.getElementById(spec.id) as HTMLDivElement | null;
  let cv: HTMLCanvasElement;
  let cap: HTMLDivElement | null = null;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = spec.id;
    // A FRAMELESS PANEL DOES NOT GROW INTO VIEW. The pop-scale-in and the drop
    // shadow are what make the machine/cloth chrome read as a card laid over
    // the game; a screen the player is looking dead-on already does not swell
    // toward them when it lights up, so frameless panels only cross-fade.
    wrap.style.cssText = 'position:fixed;left:50%;top:50%;z-index:15;pointer-events:none;'
      + (frameless
        ? 'transform:translate(-50%,-50%);opacity:0;transition:opacity .22s linear;'
        : 'transform:translate(-50%,-50%) scale(.94);opacity:0;'
          + 'transition:opacity .16s linear, transform .16s ease-out;');
    cv = document.createElement('canvas');
    cv.style.cssText = `width:${CW * scale}px;height:${CH * scale}px;image-rendering:pixelated;display:block;`
      + (frameless ? '' : 'filter:drop-shadow(0 6px 14px rgba(0,0,0,.65));');
    wrap.appendChild(cv);
    if (frameless) {
      // THE ONE THING EVERY PANEL STILL OWES YOU: how to leave. Printed
      // OUTSIDE the canvas rather than over it — a frameless caller's `draw()`
      // fills the WHOLE screen, corners included (the library terminal's own
      // taskbar clock sits bottom-right, exactly where a baked-in ESC hint
      // collided with it, measured on the first screenshot of this). A
      // caption below the glass can never fight content the caller owns, the
      // same reasoning that keeps `ct-note`/`ct-prompt` off the 3-D scene.
      cap = document.createElement('div');
      // ── THE CAPTION'S WIDTH BUDGET ────────────────────────────────────────
      //
      // It is `CAP_W` = the panel's own glass, in CSS pixels: **a caption may
      // never be wider than the thing it captions.** Stated here, once, and
      // derived from `CW * scale` rather than typed — the same rule BUILDER-BRIEF
      // §8 applies to textures applies to a line of chrome.
      //
      // WHAT IT REPLACES WAS NOT "NO LIMIT", WHICH IS WHY THIS WAS INVISIBLE.
      // `wrap` is `position:fixed; left:50%` with no `right`, so an auto-width
      // child got SHRINK-TO-FIT against an available width of exactly HALF the
      // viewport. The limit was therefore `50vw` and nothing to do with the
      // panel: measured on the ATM's PIN screen, the 64-character caption is
      // 487.6 px, so it stayed on one line down to a 976 px window and wrapped
      // to two below it — at 800×600 the box clamped to 400 px and broke in
      // half. A budget that moves with the window is the kind a caller cannot
      // design against, and item 216 is queued behind four more tenants
      // (mail 155, library PC 157, loan 185, slots 208) that would all inherit
      // it. `width` rather than `max-width` because only an explicit width takes
      // the shrink-to-fit rule out of play; `max-width:92vw` then keeps it on
      // screen in a window narrower than the glass, wrapping instead of
      // overhanging.
      //
      // Published on `dataset.budget` so a check reads the number the code uses
      // instead of a second copy of it.
      const CAP_W = CW * scale;
      cap.dataset.budget = String(CAP_W);
      cap.style.cssText = `text-align:center;margin-top:8px;width:${CAP_W}px;max-width:92vw;`
        + 'box-sizing:border-box;font:13px/1.4 ui-monospace,Menlo,monospace;'
        + 'color:rgba(232,226,208,.85);text-shadow:0 1px 3px rgba(0,0,0,.85);letter-spacing:.3px;';
      wrap.appendChild(cap);
    }
    document.body.appendChild(wrap);
  } else {
    cv = wrap.firstChild as HTMLCanvasElement;
    cap = wrap.lastChild !== cv ? (wrap.lastChild as HTMLDivElement) : null;
  }
  cv.width = CW; cv.height = CH;

  let open = false;
  /** how to undo whatever put the player in front of this panel */
  let exit: (() => void) | null = null;
  /** were they sitting down when it came up? then closing it stands them up */
  let seatedAtOpen = false;
  /**
   * The mesh this panel is painted onto right now, or `null` when it is the
   * ordinary screen-space cabinet. Resolved on EVERY open rather than cached at
   * build time: modules register long before the object they belong to exists,
   * and interiors are rebuilt as the player moves between them, so a reference
   * kept from last time can name a mesh no longer in the scene.
   */
  let onMesh: THREE.Object3D | null = null;
  /**
   * The panel's own canvas, hung in the scene graph. ONE texture, made once and
   * reused: `CanvasTexture` is a view onto the canvas rather than a copy of it,
   * so every `repaint()` this panel already does becomes a live update to the
   * object in the world for the cost of a `needsUpdate` flag.
   *
   * NEAREST filtering, no mipmaps — the whole world is pixel art and a screen
   * that resampled smoothly would be the one soft object in it.
   */
  let tex: THREE.CanvasTexture | null = null;
  /** what the mesh was showing before we borrowed it, to be put back exactly */
  let savedMap: THREE.Texture | null = null;
  let savedColor = 0xffffff;
  /**
   * WHICH material we borrowed, remembered rather than re-derived on close.
   * Re-resolving it would re-read `mesh.material`, and the whole reason this
   * exists is that that value is not guaranteed to be what it was at open.
   */
  let borrowed: THREE.MeshBasicMaterial | null = null;

  const paint = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, CW, CH);
    // the canvas IS the texture when this panel is hung on a mesh, so every
    // repaint the caller already makes is a live screen in the world
    if (tex) tex.needsUpdate = true;

    if (frameless) {
      // NO CASE, NO SCREWS, NO TITLE, NO RECESS, NO CAPTION BAND — the
      // caller's own `draw()` IS the fascia, full-bleed. See `PanelSpec.chrome`.
      g.save();
      g.beginPath(); g.rect(0, 0, spec.w, spec.h); g.clip();
      try { spec.draw(g, spec.w, spec.h); }
      catch (e) { console.error(`[panel ${spec.id}] draw threw:`, e); }
      g.restore();

      // THE ONE THING EVERY PANEL STILL OWES YOU: how to leave — in `cap`,
      // below the glass, never on it. See why at `cap`'s creation above.
      if (cap) {
        const label = spec.hint?.() ?? '';
        // A caller's own hint sometimes already says how to leave —
        // `library-pc.ts` prints 'ESC step back' itself, because it also
        // uses TAB for a second, narrower kind of "back" and wanted the two
        // told apart. Appending a second ESC there would just repeat it.
        // THE CAPTION IS DERIVED FROM THE RULE, never typed beside it, so it
        // cannot promise a key the gate will not honour: `E` normally, `ESC`
        // on a panel that is eating text and has therefore given `e` up.
        // The dedupe tests the BARE KEY, not the decorated stamp: a caller that
        // already wrote its own `ESC step back` must not be given a second one.
        const key = exitKey(spec);
        const way = `${exitStamp(spec)} leave`;
        cap.textContent = !label ? way
          : new RegExp(`\\b${key}\\b`, 'i').test(label) ? label
            : `${label}   ·   ${way}`;
      }
      return;
    }

    const machine = chrome === 'machine';
    const tint = spec.caseTint;
    const body = machine ? (tint?.body ?? UI.case) : UI.cloth;
    const hi = machine ? (tint?.hi ?? UI.caseHi) : UI.clothHi;
    const lo = machine ? (tint?.lo ?? UI.caseLo) : UI.clothLo;
    const edge = machine ? (tint?.edge ?? UI.caseEdge) : UI.caseEdge;

    g.fillStyle = edge; g.fillRect(0, 0, CW, CH);
    g.fillStyle = body; g.fillRect(1, 1, CW - 2, CH - 2);
    g.fillStyle = hi; g.fillRect(1, 1, CW - 2, 2);                 // moulding catches the light
    g.fillStyle = lo; g.fillRect(1, CH - 4, CW - 2, 3);

    if (machine) {
      // four screws, because a machine has fixings and a menu does not
      g.fillStyle = lo;
      for (const [sx, sy] of [[5, 5], [CW - 8, 5], [5, CH - 8], [CW - 8, CH - 8]]) {
        g.fillRect(sx, sy, 3, 3);
        g.fillStyle = edge; g.fillRect(sx, sy + 1, 3, 1);
        g.fillStyle = lo;
      }
    } else {
      g.strokeStyle = 'rgba(222,210,180,0.20)'; g.setLineDash([3, 3]);
      g.strokeRect(4.5, 4.5, CW - 9, CH - 9); g.setLineDash([]);   // stitching
    }

    if (spec.title) {
      g.fillStyle = machine ? edge : UI.clothLo;
      g.font = UI.font(9, true); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(spec.title, CW / 2, BEZEL + 9);
      g.fillStyle = machine ? hi : UI.clothHi;
      g.fillText(spec.title, CW / 2, BEZEL + 8);                   // stamped, not printed
    }

    // the screen sits in a recess, and the recess is what makes it read as set
    // INTO the machine rather than stuck onto it
    g.fillStyle = UI.wellLo; g.fillRect(SX - 3, SY - 3, spec.w + 6, spec.h + 6);
    g.fillStyle = UI.well; g.fillRect(SX - 2, SY - 2, spec.w + 4, spec.h + 4);

    g.save();
    g.beginPath(); g.rect(SX, SY, spec.w, spec.h); g.clip();
    g.translate(SX, SY);
    try { spec.draw(g, spec.w, spec.h); }
    catch (e) { console.error(`[panel ${spec.id}] draw threw:`, e); }
    g.restore();

    // the caption strip: how to leave, always, on every panel
    const cy = SY + spec.h + 5;
    g.fillStyle = machine ? lo : UI.clothLo;
    g.fillRect(SX, cy, spec.w, CAPTION - 6);
    g.fillStyle = UI.dim; g.font = UI.font(7); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(spec.hint ? spec.hint() : '', SX + 4, cy + 9);
    g.textAlign = 'right';
    g.fillStyle = UI.ink;
    g.fillText(exitStamp(spec), SX + spec.w - 4, cy + 9);
  };

  // WHAT THE PLAYER PRESSED ESCAPE ON, and when. A caller that re-opens its
  // panel from a per-frame hook — which is the natural way to write "the slots
  // screen is up while you are sitting at the slots" — would otherwise re-open
  // it the same frame the player closed it, and Escape would do nothing
  // FOREVER while looking like it was handled. The latch is short: long enough
  // that the re-open loses the race, short enough that deliberately opening it
  // again a moment later still works.
  let dismissedAt = -1e9;
  const DISMISS_LOCKOUT = 500;

  const api: Panel = {
    isOpen: () => open,
    repaint: () => { if (open) paint(); },
    open: (o) => {
      if (open) return;
      // A PANEL THE PLAYER JUST DISMISSED DOES NOT COME STRAIGHT BACK. See
      // `dismissedAt` — without this, Escape is a no-op against any caller
      // that opens from a frame hook, and the player is trapped by a modal
      // that technically closes.
      if (performance.now() - dismissedAt < DISMISS_LOCKOUT) return;
      // ONE THING IN YOUR HANDS AT A TIME, and that includes the two held
      // objects that predate this framework. The wallet and the pockets sit at
      // the bottom of the same frame a cabinet fills; stepping up to a machine
      // with your wallet still out is not a state this world should have.
      // CLEARING THE WAY IS NOT AN EXIT. Everything in here can close something,
      // and a close that happens because a new cabinet is coming up is a
      // hand-over: the player is not being returned to the world, he is being
      // shown a different screen. `raising` is what lets `close()` tell the two
      // apart, so the pointer is not handed back between them and re-taken
      // underneath the incoming panel. See `pendingLock`.
      raising++;
      try {
        closePanels();
        LIVE?.closeWallet();
        closeHeld();
      } finally { raising--; }
      open = true;
      // THE WAY OUT IS RECORDED AT THE MOMENT THE WAY IN HAPPENS. `release` on
      // the spec is the standing one; `open({ release })` is for a caller whose
      // undo depends on HOW it was opened — a stool knows it seated you, the
      // same panel opened from a doorway did not.
      exit = o?.release ?? spec.release ?? null;
      // AND THE STRUCTURAL HALF, which needs no caller to remember anything:
      // if the player is SEATED when a panel comes up, closing it stands them
      // back up. A `release` a caller has to pass is a `release` one of five
      // callers will forget, and the one that forgets traps the player —
      // *"the framework should not be able to open a panel that cannot be
      // closed."*
      //
      // It reaches for `__ct.stand()`, which is an entry-point TEST affordance,
      // and I would rather it did not: the right shape is `ctx.stand()` beside
      // `ctx.seat()`, and that is `ct/ctx.ts`, which is DESK-OWNED. Asked for in
      // `notes/BLOCKED-K.md`. Until then this is the only lever that makes the
      // guarantee unconditional, and an unconditional guarantee is the whole
      // point — the alternative is a comment telling five builders to be
      // careful.
      seatedAtOpen = !!(window as unknown as { __ct?: { seated?: () => unknown } }).__ct?.seated?.();
      livePanel = { spec, close: () => api.close() };
      // THE `[E]` THAT OPENED THIS MUST NOT ALSO CLOSE IT. The player is almost
      // certainly still holding the key that got him here, and it auto-repeats;
      // the gate below now reads `E` as "leave", so without this a machine
      // opened with a normal human press would shut itself a few hundred
      // milliseconds later. Armed only when the key is REALLY down, so opening
      // by any other route leaves `[E]` live immediately.
      if (physical.has(EXIT_KEY)) latch(EXIT_KEY);
      releaseHeld();                     // let go of anything already held down
      gateUp(true);                      // …and the gate is the freeze, see above
      // DIEGETIC OR NOT IS DECIDED HERE, per open, and it degrades rather than
      // fails: a surface whose mesh cannot be found, or a world that never
      // registered a focus controller (the prototype harnesses do not), simply
      // gets the screen-space cabinet it would have got anyway.
      //
      // ⚠ AND NOTHING FROM HERE TO THE END OF `open()` MAY THROW PAST THIS
      // POINT. `gateUp(true)` on the line above is the freeze: it raises the
      // gate and captures input for a panel that has not been shown yet. A
      // throw between there and the end therefore leaves the player **frozen,
      // with input captured, looking at the world, and NO PANEL VISIBLE** —
      // recoverable only by Escape, and indistinguishable from a hang. That is
      // §11 territory ("a view you cannot leave"), and it is a strictly worse
      // failure than the wrong picture on a screen.
      //
      // Item 150 arrived exactly this way and the row understated it: the
      // report was "it throws on a multi-material mesh", but the consequence
      // was the freeze, because the throw site sat after the gate and outside
      // any `try`.
      //
      // BOTH CALLS IN HERE ARE CALLER CODE. `spec.surface.mesh()` is written by
      // whichever module owns the machine, and `FOCUS.enter()` below by
      // `crosstown.ts`. Neither is this file's to trust, so neither is allowed
      // to freeze the world — every failure lands on the screen-space cabinet,
      // which is the same place a null `mesh()` has always landed.
      try {
        onMesh = spec.surface && FOCUS ? spec.surface.mesh() : null;
        // AND THE MATERIAL HAS TO BE BORROWABLE, not just the mesh findable —
        // resolved HERE, before `backdropUp` and `paint` commit to a layout,
        // because `screenSlot` returning null must land in exactly the same
        // place a null `mesh()` does. Item 150: this used to be a cast further
        // down that threw out of `open()` with the movement gate already up.
        borrowed = onMesh ? screenSlot(onMesh, spec.surface, spec.id) : null;
        if (!borrowed) onMesh = null;
      } catch (err) {
        console.error(`[panel ${spec.id}] resolving the diegetic surface threw; `
          + `using the screen-space cabinet:`, err);
        onMesh = null; borrowed = null;
      }
      // The vignette says "you have stopped looking at the world". A screen you
      // are genuinely standing in front of has not stopped being in the world,
      // and dimming it is the exact tell the user's screenshot is pointing at.
      backdropUp(!onMesh);
      paint();
      if (onMesh) {
       // `saved` gates the undo below: without it a throw BEFORE the two saves
       // would restore `savedMap`/`savedColor` left over from the last panel,
       // and paint some other machine's face onto this one.
       let saved = false;
       try {
        // HANG THE CANVAS ON THE OBJECT. The mesh keeps its geometry, its rake
        // and its place in the wall; only what it is showing changes, and it is
        // put back exactly on close.
        const mat = borrowed!;   // resolved and null-checked above
        if (!tex) {
          tex = new THREE.CanvasTexture(cv);
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.generateMipmaps = false;
          tex.colorSpace = THREE.SRGBColorSpace;
        }
        tex.needsUpdate = true;
        savedMap = mat.map ?? null;
        savedColor = mat.color.getHex();
        saved = true;
        mat.map = tex;
        // A LIT CRT IS NOT DIMMED BY THE EVENING. Whatever tint the material
        // carries belongs to the cabinet, not to the picture on its tube, and
        // multiplying the live interface by it would drag the thing the player
        // is reading down with the night wash. Put back on close.
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        // ONLY THE CAPTION SURVIVES ON THE GLASS OF THE MONITOR — moved to the
        // bottom of the frame, where `ct-prompt` already lives, so it reads as
        // the world's own prompt line rather than as chrome. The canvas itself
        // is in the scene now and must not also be drawn over the camera; but
        // "how do I leave" is the one thing every panel still owes the player,
        // and a diegetic screen that swallowed it would be the exact trap this
        // framework exists to prevent.
        cv.style.display = 'none';
        wrap!.style.top = 'auto';
        wrap!.style.bottom = '7%';
        wrap!.style.transform = 'translate(-50%,0)';
        wrap!.style.opacity = '1';
        // GIVE THE MOUSE BACK. You cannot click a screen with a pointer the
        // browser has hidden and pinned to the middle of the canvas.
        //
        // REMEMBERED BEFORE IT IS RELEASED, because after the call
        // `document.pointerLockElement` is null and the answer is gone. `close()`
        // hands it back — see `pendingLock`.
        //
        // ONLY IF THERE IS ONE TO RECORD. A second diegetic panel opening over
        // the first finds the pointer ALREADY released, and `?? null` here would
        // overwrite a real debt with nothing — the mouse would then stay dead
        // after the replacement closed, which is the user's complaint reached by
        // a different road.
        if (document.pointerLockElement) pendingLock = document.pointerLockElement;
        try { document.exitPointerLock?.(); } catch { /* never locked */ }
        cursorHand(false);
        // THE WAY OUT, handed to the controller at the moment the way in
        // happens. If it ever loses the lock without being asked to, it closes
        // this panel rather than leaving a locked camera over an open one.
        FOCUS!.enter({
          mesh: onMesh,
          standoff: spec.surface!.standoff ?? 0.55,
          fov: spec.surface!.fov ?? 60,
          escape: () => api.close(),
        });
       } catch (err) {
        // THE HANG FAILED HALFWAY. Put the mesh back, undo the diegetic layout,
        // and show the cabinet — the panel the player asked for still appears,
        // which is the whole difference between a degraded feature and a freeze.
        console.error(`[panel ${spec.id}] hanging it on the mesh threw; `
          + `using the screen-space cabinet:`, err);
        try {
          if (saved && borrowed) {
            borrowed.map = savedMap;
            borrowed.color.setHex(savedColor);
            borrowed.needsUpdate = true;
          }
        } catch { /* best effort: the cabinet still has to come up */ }
        onMesh = null; borrowed = null;
        backdropUp(true);
        cv.style.display = '';
        wrap!.style.top = '50%';
        wrap!.style.bottom = 'auto';
        wrap!.style.opacity = '1';
        wrap!.style.transform = frameless ? 'translate(-50%,-50%)' : 'translate(-50%,-50%) scale(1)';
       }
      } else {
        wrap!.style.opacity = '1';
        if (!frameless) wrap!.style.transform = 'translate(-50%,-50%) scale(1)';
      }
      spec.onOpen?.();
    },
    close: () => {
      if (!open) return;
      open = false;
      // DID THE FOCUS CONTROLLER GIVE THE PLAYER THEIR OWN CHAIR BACK? Item
      // 206. Set by `FOCUS.leave()` below, read by the `seatedAtOpen` block at
      // the foot of this function. `false` for a screen-space panel, which has
      // no focus controller and so restored nothing.
      let keptTheirChair = false;
      dismissedAt = performance.now();
      wrap!.style.opacity = '0';
      if (!frameless) wrap!.style.transform = 'translate(-50%,-50%) scale(.94)';
      // GIVE THE VIEW BACK FIRST, and outside the `livePanel === spec` guard
      // below: that guard exists because another panel may already have taken
      // the gate over, and a camera still locked to a screen the player has
      // left is precisely the trap this must never allow. Wrapped because a
      // controller that throws must not be able to abandon the lock.
      if (onMesh) {
        // GIVE THE MESH ITS OWN FACE BACK, and do it before anything that can
        // throw. A machine left wearing a frozen copy of the last thing it
        // said is the visible half of this failing; a camera left locked is
        // the half that traps somebody.
        onMesh = null;
        cursorRelease();
        try {
          // THE SLOT WE BORROWED, not whatever `mesh.material` is now. Item 150:
          // re-casting `mesh.material` here threw `setHex of undefined` on any
          // multi-material mesh, which is how a panel left a machine wearing a
          // frozen copy of the last thing it said.
          const mat = borrowed;
          if (mat) {
            mat.map = savedMap;
            mat.color.setHex(savedColor);
            mat.needsUpdate = true;
          }
        } catch (err) { console.error(`[panel ${spec.id}] could not restore the surface:`, err); }
        borrowed = null;
        // and put the caption back where every other panel's lives
        cv.style.display = '';
        wrap!.style.top = '50%';
        wrap!.style.bottom = 'auto';
        wrap!.style.transform = frameless ? 'translate(-50%,-50%)' : 'translate(-50%,-50%) scale(.94)';
        try { keptTheirChair = FOCUS?.leave() === true; } catch (err) { console.error(`[panel ${spec.id}] leaving the screen threw:`, err); }
      }
      if (livePanel && livePanel.spec === spec) {
        livePanel = null;
        gateUp(false);
        backdropUp(false);
      }
      // ── GIVE THE POINTER BACK, the other half of the release in `open()` ──
      //
      // Item 277. Placed HERE, immediately after the gate comes down and before
      // any caller code runs, for three reasons:
      //
      //  · `gateUp(false)` has just stopped swallowing clicks, so the world is
      //    ready to be looked at again; re-locking any earlier would fight the
      //    gate that exists to keep the world from hearing anything.
      //  · It is ahead of `undo()`, `stand()` and `onClose()`, all of which are
      //    CALLER code that can throw. Those three are individually wrapped
      //    precisely because a caller must not be able to leave the player
      //    trapped — and a dead mouse is exactly that trap in a quieter form.
      //  · Every exit path in this world funnels through `close()`: `[E]`,
      //    Escape, the ATM's own farewell timeout, and closing while seated.
      //    Putting the re-lock on the one path they share is why it cannot be
      //    forgotten by one of them, which is how the release came to have no
      //    partner in the first place.
      //
      // BOTH GUARDS ARE LOAD-BEARING AND THEY CATCH DIFFERENT THINGS.
      //
      // `!livePanel` — some other cabinet already took the gate over while this
      //   one was closing. Handing the pointer back would pin it under an
      //   interface the player is being asked to read.
      // `!raising`  — a new cabinet is being raised RIGHT NOW, inside `open()`'s
      //   prologue, and has not claimed `livePanel` yet. This is the one that
      //   was missing: without it, closing a diegetic panel to open a
      //   SCREEN-SPACE one re-locks in the gap between the two, and the pointer
      //   ends up hidden and pinned under the incoming cabinet. Measured — it is
      //   leg 10 of `scripts/pointer-returns.mjs`, which failed on the first cut
      //   of this fix and is why the debt moved to a module-level slot.
      //
      // The debt is NOT cleared when it is not paid: `pendingLock` survives the
      // hand-over so whichever cabinet is last to close gives the pointer back.
      //
      // `isConnected`, because interiors are rebuilt as the player moves and a
      // canvas detached from the document cannot take a lock; asking anyway
      // throws where nobody is listening.
      if (pendingLock && !livePanel && !raising && pendingLock.isConnected) {
        const el = pendingLock as HTMLElement; pendingLock = null;
        // A SANDBOXED IFRAME REFUSES THE LOCK, and the artifact falls back to
        // drag-look. Failing to re-lock there is correct and must stay silent.
        //
        // ⚠ THE SYNCHRONOUS `catch` ALONE IS NOT ENOUGH, AND `main.ts:32` HAS
        // THE SAME HOLE. Measured in a frame sandboxed without
        // `allow-pointer-lock` (`scripts/probes/w109-lock-returns-promise.mjs`):
        // `requestPointerLock()` returns a **Promise** and throws NOTHING
        // synchronously, so `try { … } catch {}` catches nothing and the
        // rejection surfaces as an UNCAUGHT pageerror —
        //
        //     try/catch only        2 errors, one of them PAGEERROR: Failed to
        //                           execute 'requestPointerLock' … Blocked
        //     try/catch + .catch()  1 error, the browser's own console note
        //
        // — every single time an overlay closed in the published artifact. This
        // is `close()`, the callback that un-traps the player, so an uncaught
        // throw here is §11 territory rather than a log line. The older DOM
        // signature returns `undefined`, hence the `typeof` test rather than an
        // assumption either way.
        try {
          const r = el.requestPointerLock?.() as unknown as Promise<void> | undefined;
          if (r && typeof r.catch === 'function') r.catch(() => { /* refused: drag-look still works */ });
        } catch { /* sandboxed iframe: drag-look still works */ }
      }
      // RELEASE BEFORE onClose, and inside a try, because THIS is the callback
      // that un-traps the player. A caller whose release throws must not be
      // able to leave the world frozen behind a closed panel — that is exactly
      // the shape of the bug this exists to prevent, one layer up.
      const undo = exit; exit = null;
      try { undo?.(); } catch (err) { console.error(`[panel ${spec.id}] release threw:`, err); }
      // ── THE STRUCTURAL STAND-UP, AND THE ONE CASE IT MUST NOT FIRE IN ─────
      //
      // The guarantee above still stands: a panel opened from a seat cannot
      // leave the player somewhere a forgetful `release` stranded them.
      //
      // But it was firing on the player's OWN chair too, and that is item 206:
      // *"you sit and its the loan process as an integrated overlay."* Sitting
      // down, reading the form, closing it and finding yourself standing up is
      // not that. `FOCUS.leave()` had already put the chair back by the time
      // this ran — three lines later this stood them up again, which is why
      // fixing `crosstown.ts` alone was inert and measured 9/13
      // (`scripts/probes/w107-seat-keeps-you.mjs`, and it is 13/13 with both).
      //
      // ⚠ THE GUARANTEE IS NOT WEAKENED, because the case being skipped is the
      // one where the player is provably not stranded: they are back on a seat
      // THEY chose and walked to, whose own `[E]`/`[ESC]` contract stood them
      // up before any panel existed. Everything else — a machine that seated
      // you, a screen-space panel with no focus controller at all — still
      // stands you up exactly as before.
      if (seatedAtOpen) {
        seatedAtOpen = false;
        try {
          const ct = (window as unknown as { __ct?: { seated?: () => unknown; stand?: () => void } }).__ct;
          if (!keptTheirChair && ct?.seated?.()) ct.stand?.();
        } catch (err) { console.error(`[panel ${spec.id}] could not stand the player up:`, err); }
      }
      try { spec.onClose?.(); } catch (err) { console.error(`[panel ${spec.id}] onClose threw:`, err); }
    },
    toggle: () => (open ? api.close() : api.open()),
  };
  ALL_PANELS.push({ id: spec.id, panel: api });
  return api;
}

/**
 * The live HUD, for the one thing a world module legitimately needs from the
 * screen layer: `screenFade`.
 *
 * `ct/ctx.ts` is DESK-OWNED and does not carry the HUD, and asking for a field
 * on it would block a user request on a coordination step. So the screen
 * publishes its own verb the same way `ct/inventory.ts` publishes `takeable` —
 * the kit does the work, the caller states intent, and nobody edits anybody
 * else's file:
 *
 *     import { screenFade } from './hud';
 *     act: () => screenFade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) }),
 */
let LIVE: Hud | null = null;
export function screenFade(o?: { mid?: () => void; outMs?: number; holdMs?: number; inMs?: number }): Promise<void> {
  // No HUD means no screen to fade, and the caller's `mid` must still happen —
  // a sleep that silently did not pass the night because a screen effect was
  // missing would be the effect breaking the gameplay it was added to dress.
  if (!LIVE) { o?.mid?.(); return Promise.resolve(); }
  return LIVE.fade(o);
}
/** is the screen mid-cut? Anything that must not fire during one asks here. */
export function screenFading(): boolean { return LIVE ? LIVE.fading() : false; }

export function makeHud(purse: Purse): Hud {
  let watchShown = -1;
  let walletOpen = false;
  /** The F readout's own element, created on first use so a world that never
   *  toggles it adds nothing to the DOM at all. */
  let fpsDiv: HTMLDivElement | null = null;
  const SKY_STOPS: [number, string][] = [
    [0, '#0d1018'], [5, '#0d1018'], [6.5, '#4a5464'], [8, '#7d8894'], [10, '#8a97a2'],
    [16.5, '#8a97a2'], [18.5, '#8f7f74'], [20, '#3a3f52'], [21.5, '#0d1018'], [24, '#0d1018'],
  ];
  // Night wash. Peak was 0.34, which read as a dim evening rather than night;
  // 0.58 lets the sodium streetlamps actually be the light source they were
  // built to be. Dusk ramps harder too, so the turn feels like nightfall.
  const NIGHT_STOPS: [number, number][] = [
    [0, 0.58], [5, 0.58], [7, 0.18], [8.5, 0], [17.5, 0], [19, 0.20], [20, 0.40], [21.5, 0.58], [24, 0.58],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color(), skyNow = new THREE.Color();
  const skyAt = (h: number): THREE.Color => {
    let i = 0;
    while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1][0] < h) i++;
    const [h0, s0] = SKY_STOPS[i], [h1, s1] = SKY_STOPS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    return skyNow.copy(cA.set(s0)).lerp(cB.set(s1), t);
  };
  const nightAt = (h: number): number => {
    let i = 0;
    while (i < NIGHT_STOPS.length - 2 && NIGHT_STOPS[i + 1][0] < h) i++;
    const [h0, v0] = NIGHT_STOPS[i], [h1, v1] = NIGHT_STOPS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    return v0 + (v1 - v0) * t;
  };
  let nightDiv = document.getElementById('ct-night') as HTMLDivElement | null;
  if (!nightDiv) {
    nightDiv = document.createElement('div');
    nightDiv.id = 'ct-night';
    nightDiv.style.cssText = 'position:fixed;inset:0;background:#0a1024;opacity:0;pointer-events:none;z-index:5;transition:opacity .5s linear;';
    document.body.appendChild(nightDiv);
  }
  // the player's own clothing — one place to swap later (a real wardrobe).
  // `sleeve` is the forearm covering (a sweater here); a tee would just leave
  // the forearm as `skin`. The first-person hands (watch + wallet) read from it.
  const player = { skin: '#c9946a', skinHi: '#d8a67d', skinLo: '#a87a54', sleeve: '#3f4a5c', cuff: '#333c4a' };
  // ── THE ARM, AND THE FOUR NUMBERS THAT HOLD IT IN PLACE ──────────────────
  //
  // *"for the watch i would like the rest of the arm (to the left) rendered as
  // well. should be simple. just a continuation of the arm."*
  //
  // It is simple, and it was previously impossible to do safely because the
  // scale was HIDDEN. The canvas was 176 px wide and displayed at a literal
  // `width:484px`; 484/176 = 2.75 is the size of a watch pixel on screen and it
  // appeared in neither number. Widen the canvas and every pixel silently
  // shrinks. `left: calc(46% + 77px)` carried the same problem — the 77 is
  // `(176-120)/2 x 2.75`, the compensation for the last time this canvas grew,
  // and nothing said so.
  //
  // So the scale is named, and the two positioning numbers are DERIVED from it.
  const WATCH_S = 2.75;                    // CSS px per canvas px
  /** the wrist-and-fist, unchanged: the wrist ends at x 104 and the hand needs
   *  72 px beyond it. Every pixel of what the user already has is in here. */
  const WATCH_HAND = 176;
  /**
   * The forearm added to the LEFT, in canvas px. Nothing is drawn to the right.
   *
   * DERIVED FROM THE ONE THING IT HAS TO DO — reach the edge of the frame. The
   * canvas's left edge lands at `0.46V - 165 - WATCH_S x WATCH_ARM` for a
   * viewport `V` wide (the `46%`, the two halves of `translateX(-50%)`, and the
   * `left` compensation below all fold into that), so
   *
   *     WATCH_ARM >= (0.46 V - 165) / 2.75      →  1280: 155   1920: 262
   *                                                2560: 369   3840: 583
   *
   * 600 covers every viewport up to 3840 with room over. It costs a 776 x 72
   * canvas — 224 kB, repainted once a minute — and anything past the frame edge
   * is simply clipped by the viewport, which is what "runs off the edge" means.
   * Overflow to the LEFT never produces a scrollbar; the probe asserts it.
   */
  const WATCH_ARM = 600;
  const WATCH_W = WATCH_ARM + WATCH_HAND;
  // GROWING LEFT MOVES TWO THINGS, AND BOTH ARE CANCELLED HERE. The element is
  // centred by `translateX(-50%)` and rotated about its own middle, so adding
  // `WATCH_ARM` canvas px on the left would (a) slide everything right by half
  // the added width and (b) swing the watch UP, because the fist would suddenly
  // be a metre from the pivot instead of a hand's breadth. (b) is the one that
  // is easy to miss: it is silent in the CSS and it moves the exact thing the
  // user said not to move.
  //
  //   · `left` gives back `WATCH_ARM x WATCH_S / 2`, which is (a) exactly.
  //   · `transform-origin` pins the pivot to where the element's middle USED to
  //     be. Only the left side grew, so that point is a fixed `WATCH_HAND/2`
  //     canvas px in from the RIGHT edge — hence `calc(100% - …)`, which stays
  //     true whatever `WATCH_ARM` becomes.
  //
  // Work the algebra through and every term in `x` and `y` cancels: a pixel that
  // existed before lands on the same screen pixel after. That is checked rather
  // than argued — `scripts/probes/w57-watch.mjs` reads the LCD's bounding box
  // off the live element both ways round.
  //
  // WHERE THE ARM SITS, IN TWO NAMES. Both of these were bare literals buried in
  // CSS strings (a `46%` with three comments pointing at it, and a `translateY(0)`
  // that read as "no offset" rather than "the number you nudge"). They are the
  // two numbers the user actually moves, so they are the two that are named.
  //
  // *"can we move the watch arm thing as a whole over to the left a little
  // bit?"* (2026-08-02) took it 52 → 46. *"mmove the limb up and to the left
  // more pls"* (2026-08-04) took it 46 → 42 and lifted it for the first time.
  // *"also move full limb more up and left"* (same day) took it 42 → 38, and
  // *"whole limb a little to the left"* takes it 38 → 35.
  const WATCH_X = 35;      // % of viewport width, the wrapper's `left` anchor
  /**
   * Upward nudge, in % of the LIMB's height (198 px = 72 canvas px x WATCH_S),
   * applied as px — see WATCH_LIMB_H. Was an unnamed `translateY(0)`.
   *
   * THERE IS A CEILING ON THIS. The limb has to leave the frame through the
   * BOTTOM edge; if it lifts clear it exits through the left edge instead and
   * the hand floats in the middle of the road. The tilt drops the far (left)
   * end, so the deepest visible point of the limb's underside is where it
   * crosses the left edge of the screen, and the ceiling is
   *
   *     LIFT_max = 99/cos T - 85 + (WATCH_X/100 x V + 77) x tan T     [px]
   *
   * for tilt T and viewport width V. ALL THREE OF THE PLACEMENT NUMBERS ARE IN
   * IT, which is the whole reason it is written down: WATCH_LIFT spends the
   * budget, WATCH_X shrinks it (each point drags the far end's crossing point
   * toward the corner), and WATCH_TILT — being the term the far end's drop is
   * proportional to — BUYS it. Rotating the limb further CCW makes it legal to
   * lift higher, which is why *"rotate full limb ccw a bit"* cost nothing here.
   *
   * It rises monotonically with T — the derivative, 99 sinT/cos²T + x_o sec²T,
   * is positive for every T in range — so there is no angle at which rotating
   * further CCW starts costing headroom instead of buying it.
   *
   * At 35 / T=16 that is 169 px on a 1280 viewport, 205 px at 1920, 242 px at
   * 2560. THE NARROWEST VIEWPORT BINDS, so only the 1280 column is worth
   * quoting. The history, all at 1280: 42/12/5° spent 24 of 67; 38/22/5° spent
   * 44 of 63; 35/22/5° spent 44 of 60 and left it nearly out; 35/22/8° spent 44
   * of 89; 35/22/12° spent 44 of 128; 35/22/16° spends 44 of 169. **That leaves
   * ~125 px — 63 points of WATCH_LIFT, or 34 of WATCH_X, trading against each
   * other at 3.7 px per point of WATCH_X.** THIS CONSTRAINT IS NO LONGER THE
   * ONE TO WORRY ABOUT: three rotations have taken it from nearly spent to
   * three times the budget it started with, and the limits that now bite are
   * the two written up under WATCH_TILT.
   */
  const WATCH_LIFT = 22;
  /**
   * THE LIMB'S OWN HEIGHT, AND THE CANVAS'S, WHICH ARE NO LONGER THE SAME NUMBER.
   *
   * Everything drawn here is positioned against the LIMB: 72 canvas px, the
   * band at y 6…72. That number never changes and no drawing coordinate below
   * moved. The CANVAS is now taller, and the extra rows sit BELOW the limb, as
   * bleed for things that stick out past its underside.
   *
   * WHY THERE HAS TO BE ANY. *"the watch band overhang is not symetrical on the
   * limb. the bottom has no overhang."* (2026-08-04). It never had one: the
   * strap ran y 0…72 against a limb at 6…72, so it stood 6 px proud at the top
   * and stopped flush at the bottom — because the bottom WAS the canvas edge,
   * and for most of this arm's life that edge was under the frame where nobody
   * could see it. WATCH_LIFT put it on screen and the asymmetry with it.
   *
   * THE THREE COMPENSATIONS, so growing the canvas moves nothing:
   *   · `bottom` pays back the added height, or the whole arm rides up by it;
   *   · `transform-origin`'s y is pinned in px to the limb's middle — `50%` of
   *     a taller element is a different, lower pivot;
   *   · WATCH_LIFT is applied in px off the LIMB's height, not as a `%` of the
   *     element — otherwise every canvas change silently re-tunes the lift and
   *     the ceiling derived above stops meaning what it says.
   */
  const WATCH_LIMB_H = 72;
  /** px the strap stands proud of the limb — now on BOTH long edges, was 6/0. */
  const STRAP_OVER = 6;
  /**
   * The thumb, in fist-local canvas px — see where it is drawn for the why.
   * *"thumb needs to be more to the right and bigger"* (2026-08-04): 104 → 126,
   * 30 → 44 wide, 8 → 13 deep. It now ends at x 170, which is 2 px short of the
   * dark end strip and 6 short of the fist's far edge — deliberate, so the fist
   * still turns its own corner there instead of the thumb becoming the end of
   * the hand. THUMB_X + THUMB_W should stay under 172 for that reason.
   */
  const THUMB_X = 126, THUMB_W = 44, THUMB_D = 13;
  /**
   * HOW FAR ALONG THE ARM THE WATCH SITS, in canvas px, applied as a translate
   * to the whole assembly — strap, case, bezel, LCD and both text lines.
   * *"watch a little to the right on the arm"* (2026-08-04): 0 → 8.
   *
   * IT CANNOT GO MUCH FURTHER. The assembly's widest part is the CASE, not the
   * strap: case x 32…88, strap x 38…82, and the fist begins at x 104. So the
   * case has 16 px of room and the strap 22, and the case is what runs out —
   * **WATCH_POS 16 puts the case's right edge exactly on the fist**, and past
   * that the strap paints over the hand it is supposed to be strapped behind.
   * At 8 the case clears the fist by 8 px (22 on screen) and the strap by 14.
   * One more nudge this size is the last one.
   */
  const WATCH_POS = 8;
  /** width of the dark cap at the limb's far end, grown inward from x 176. */
  const STRIP_W = 12;
  /** chamfer leg on the fist's corners, in texels — cut or filled, see below. */
  const FIST_ROUND = 3;
  const WATCH_H = WATCH_LIMB_H + Math.max(STRAP_OVER, THUMB_D);
  const WATCH_BOTTOM = (-(14 + (WATCH_H - WATCH_LIMB_H) * WATCH_S)).toFixed(2);
  const WATCH_LIFT_PX = (WATCH_LIFT / 100 * WATCH_LIMB_H * WATCH_S).toFixed(2);
  /**
   * THE LIMB'S TILT, IN DEGREES COUNTER-CLOCKWISE ON SCREEN. Written positive
   * and negated at use, because CSS `rotate()` is positive-CLOCKWISE and the
   * arm has only ever gone the other way — a bare `-5deg` in three places made
   * "more counter-clockwise" read as "smaller", which is how a sign gets flipped.
   * *"rotate full limb ccw a bit"* (2026-08-04): 5 → 8, then *"rotate the limb
   * a bit more ccw"*: 8 → 12, then *"more ccw rotation on the full limb"*:
   * 12 → 16. Three asks running, all the same direction, none walked back.
   *
   * THE LIFT CEILING IS NOT WHAT STOPS THIS — see WATCH_LIFT, it only ever buys
   * headroom. TWO OTHER THINGS DO, and neither is reached at 16:
   *
   *   · **~22.5° at V=1280 the limb stops touching the LEFT edge of the frame.**
   *     The top edge of the band leaves through the left edge today (screen
   *     x -223 at 16°) while the underside leaves through the bottom (x 436).
   *     Solve `y_o cos T + 82.5 = x_o sin T` and past that root the whole
   *     cross-section exits through the BOTTOM instead, so the arm stops
   *     reading as reaching in from the left of the frame and starts rising out
   *     of the floor. It is a look, not a break, but it is a different look.
   *   · **the LCD tilts with it.** 16° is about where a real wrist sits when
   *     you turn it to read; past ~20° the digits start to read as a watch
   *     sliding off the arm rather than one being looked at.
   *
   * The hand end rises and the far end drops, both about the pinned pivot. That
   * is the ONLY thing this does — rotation is applied to the finished element,
   * so nothing inside the canvas moves relative to anything else in it, and the
   * case's 8 px clearance from the fist is untouched by it.
   *
   * ONE CONSTANT FOR BOTH STATES NOW. The shown state was `-5deg` and the
   * initial CSS `-6deg`, so the arm rotated by a degree the first time it was
   * ever raised — invisible, because that transition also slid it 300 px up the
   * screen. There is no reason for the hidden state to differ: it is the same
   * arm, parked off-frame. Both read WATCH_TILT.
   */
  const WATCH_TILT = 16;
  const WATCH_SHOWN = `translateX(-50%) translateY(-${WATCH_LIFT_PX}px) rotate(-${WATCH_TILT}deg)`;
  const WATCH_HIDDEN = `translateX(-50%) translateY(140%) rotate(-${WATCH_TILT}deg)`;
  const WATCH_LEFT = (77 - WATCH_ARM * WATCH_S / 2).toFixed(2);
  const WATCH_PIVOT = (WATCH_HAND * WATCH_S / 2).toFixed(2);
  const WATCH_CSS = `width:${WATCH_W * WATCH_S}px;height:${WATCH_H * WATCH_S}px;image-rendering:pixelated;display:block;`;
  const WRAP_CSS = 'position:fixed;'
    + `left:calc(${WATCH_X}% + ${WATCH_LEFT}px);bottom:${WATCH_BOTTOM}px;z-index:11;pointer-events:none;`
    + `transform-origin:calc(100% - ${WATCH_PIVOT}px) ${WATCH_LIMB_H * WATCH_S / 2}px;`
    + `transform:${WATCH_HIDDEN};transition:transform .18s ease-out;`;
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    watchWrap.style.cssText = WRAP_CSS;
    watchCv = document.createElement('canvas');
    watchCv.width = WATCH_W; watchCv.height = WATCH_H;
    watchCv.style.cssText = WATCH_CSS;
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    // A HUD BUILT OVER AN EXISTING ONE MUST NOT KEEP THE OLD GEOMETRY. This
    // branch used to resize the canvas and leave the wrapper's `left`, its
    // pivot and the canvas's displayed size at whatever the previous build set
    // — so a rebuild would have shown the new arm at the old scale, in the old
    // place, which is three bugs that only appear on the second build.
    watchWrap.style.cssText = WRAP_CSS;
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = WATCH_W; watchCv.height = WATCH_H;
    watchCv.style.cssText = WATCH_CSS;
  }
  // the wrist-and-watch close-up (the good one — arm version was reverted)
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    g.clearRect(0, 0, WATCH_W, WATCH_H);
    // ── THE FOREARM ───────────────────────────────────────────────────────
    //
    // STEP 2 of an incremental rebuild (an all-at-once redraw was rejected, and
    // an earlier arm was tried and reverted — so this adds LENGTH and changes
    // nothing else). Step 1 ran the wrist off the left edge of its own canvas;
    // the canvas simply ended there, which is the stub the user is looking at.
    //
    // ONE BAND, the same skin tone and the same y 6…72 as the wrist, so there is
    // no seam to see: the wrist below is drawn by the identical `fillRect` it
    // always was, just further along the same band.
    g.fillStyle = '#c9946a'; g.fillRect(0, 6, WATCH_ARM, 66);
    // AND IT IS FLAT. *"for the arm shape i dont want two colors just the one
    // skin tone on that rectangle"* (2026-08-04). There WAS a "recede" gradient
    // here — `rgba(0,0,0,0.18)` ramped over the 240 canvas px nearest the wrist,
    // meant to read as the limb going back out of the light. It did not: it read
    // as a second colour on the rectangle, which is the one thing he asked not to
    // see. Removed, along with its `RECEDE` constant. One `fillRect`, one tone.
    //
    // THE WHOLE LIMB IS ONE FLAT TONE, AND HE CHOSE IT THAT WAY. Forearm, wrist
    // and fist are three `fillRect`s of `#c9946a` with NOTHING painted over them
    // — no gradient, no highlight, no shadow — except the single dark strip at
    // the far end of the fist, which he asked for by itself and which is
    // documented where it is drawn. FOUR things were deliberately removed to get
    // here and none of them is missing:
    //
    //   · the recede gradient above, `rgba(0,0,0,0.18)` over 240 px;
    //   · `rgba(255,255,255,0.12)` at the far end of the WRIST (x 94…104);
    //   · `rgba(255,255,255,0.12)` at the FIST's right edge (x 166…176);
    //   · `rgba(0,0,0,0.10)`, the wrist's shadow on the FIST (x 104…108) — this
    //     one later came back, unchanged but MOVED to x 172…176, on his own ask.
    //
    // The last three were the old "light from the right" pass; they predate the
    // arm and were fine on a short stub, but on a full limb they read as stripes
    // across it. *"arm has two colors on the right side"* took the wrist's.
    // THE FIST'S TWO WERE TAKEN, PUT BACK, AND TAKEN AGAIN — he was shown both
    // and picked uniform: *"right so i just wanted the strip on the arm gone not
    // the full limb"*, then, on seeing them restored, *"nah go back the other
    // unicolor"* (2026-08-04). Uniform is the settled answer, not an overshoot.
    //
    // So: do not reintroduce shading, a taper, an outline or a crease, and do not
    // "restore" the fist's modelling because it looks unfinished next to the
    // watch. Every attempt to make this limb more has been rejected. Shapes are
    // untouched and approved; it is only ever the colour count he objected to.
    // EVERYTHING BELOW IS THE OLD DRAWING, MOVED — not redrawn. The wrist, the
    // fist, the strap, the case and the LCD keep their own coordinates and their
    // own order; the translate is the whole of the change, so the thing the user
    // said he liked cannot have drifted by a pixel.
    g.save();
    g.translate(WATCH_ARM, 0);
    g.fillStyle = '#c9946a'; g.fillRect(0, 6, 104, 66);          // wrist, cut by the frame
    // ── THE FIST ──────────────────────────────────────────────────────────
    //
    // *"it actually should be really minimal considering it would be the top of
    // the fist. no fingers would actually show so i kinda expect a square larger
    // in width than the wrist attached to the right side of the wrist."*
    //
    // ONE BOX, and that is the whole design. He worked out the anatomy himself
    // and he is right: from this camera you are looking down at the BACK of a
    // closed fist, the fingers are curled underneath and out of sight, and the
    // back of a fist really is just a slab. Minimal is the CORRECT answer here,
    // not a cheap one — no fingers, no knuckles, no taper, no thumb.
    //
    // 72 px against the wrist's 66, so it is "larger in width than the wrist"
    // as asked, with the extra reading as the swell of the hand above the wrist.
    // Cut by the bottom of the frame like the wrist, for the same reason.
    //
    // Drawn BEFORE the strap and the case so it can never overlap them; it butts
    // at x 104 where the wrist ends, and the strap lives at 38…82.
    g.fillStyle = '#c9946a'; g.fillRect(104, 0, 72, 72);
    // ── AND ITS CORNERS ───────────────────────────────────────────────────
    //
    // *"make the corners rounded on the fist here. just like cut the corner
    // where it makes sense or fill the corner where it makes sense"*
    // (2026-08-04). HIS INSTRUCTION IS ALSO THE RULE, and it resolves to one
    // line: OUTSIDE corners get cut, INSIDE corners get filled. There are four
    // on the fist and they are not treated alike —
    //
    //   · far TOP (176, 0) — outside, the knuckle end. CUT.
    //   · far BOTTOM (176, 72) — outside, the same end underneath. CUT.
    //   · join TOP (104, 6) — INSIDE. The fist stands 6 px proud of the wrist
    //     here, and a hand does not step off a wrist at a right angle; the
    //     swell runs into it. FILLED, which is the corner he meant by "fill
    //     where it makes sense".
    //   · join BOTTOM (104, 72) — LEFT ALONE. THUMB_BACK's wedge already ramps
    //     out of this exact corner, so it is the one that is already solved.
    //     Chamfering it would cut into the ramp's apex and undo item 316.
    //
    // FIST_ROUND is the leg length in texels for all three — 3 is 8 px on
    // screen, a chamfer on a 198 px fist and not a rounded blob. STEPPED ROWS,
    // like the wedge and for the same reason: `arcTo` antialiases, and at 2.75x
    // pixelated every blended pixel becomes a block of half-transparent skin,
    // which is a second tone on a limb where one flat tone is the whole point.
    //
    // The fill goes here, with the skin. The two CUTS are made at the very end
    // of the fist's drawing, AFTER the dark strip, so the strip is cut by the
    // same texels and cannot hang past the silhouette into empty air.
    for (let k = 0; k < FIST_ROUND; k++) {
      const w = FIST_ROUND - k;
      g.fillRect(104 - w, 5 - k, w, 1);                  // join top, filled
    }
    // ── THE THUMB ─────────────────────────────────────────────────────────
    //
    // *"also add a thumb to the fist"* (2026-08-04). This OVERRIDES the note
    // above, which says no thumb — that note is his own earlier reasoning and
    // his later words outrank it. Nothing else about the fist changes.
    //
    // ONE RECT, THE SAME FLAT `#c9946a`, and that is deliberate. This limb was
    // redrawn from reference twice today and thrown out both times (*"wow the
    // arm looks soooo bad"*, *"this is absolutely awful"*) and reverted; the
    // three shading strips were removed on his ask; uniform was picked over
    // modelled when he was shown both. So the thumb gets no outline, no crease,
    // no taper, no second tone. It reads by SILHOUETTE or not at all, which is
    // the same way the fist itself reads.
    //
    // WHY UNDER THE FIST, AT THE WRIST END. The fist fills y 0…72 and the canvas
    // ceiling is y 0, so the top edge has no room; the only free space is the
    // bleed BELOW the limb (the rows STRAP_OVER opened). That is also the right
    // place anatomically for the view he described — looking down at the back of
    // a closed fist, the thumb is folded across the near side, at the base of
    // the hand. So the underside runs flat along y 72, drops THUMB_D for
    // THUMB_W, and comes back up before the fist's far corner.
    //
    // IT STARTED AT THE WRIST JOIN AND HALF THIS SIZE, and *"thumb needs to be
    // more to the right and bigger"* moved it out to the middle of the fist:
    // 44 x 13 canvas px, 121 x 36 on screen against a 198 px fist. Widen with
    // THUMB_W, deepen with THUMB_D (the canvas follows it, and the wrapper
    // compensations above absorb that — the limb does not move), or slide it
    // with THUMB_X — one number each.
    g.fillStyle = '#c9946a'; g.fillRect(THUMB_X, WATCH_LIMB_H, THUMB_W, THUMB_D);
    // ── AND THE WEDGE THAT JOINS IT TO THE WRIST ──────────────────────────
    //
    // *"add triangle connecting left corner of thumb to wrist"* (2026-08-04).
    // The thumb began at a hard vertical step, which read as a rectangle stuck
    // under the hand rather than part of it. This ramps the underside down into
    // it: three vertices, all in fist-local canvas px —
    //
    //     (THUMB_X - THUMB_BACK, 72)   the apex, back along the limb's underside
    //     (THUMB_X, 72)                the thumb's upper-left corner
    //     (THUMB_X, 72 + THUMB_D)      the thumb's lower-left corner
    //
    // THE APEX LANDS ON x 104, WHICH IS THE WRIST'S OWN END — the exact seam
    // where the wrist stops and the fist begins. That is the landmark he named,
    // and it is as far back as the wedge can go: the strap's lower overhang now
    // occupies x 46…90 in this same band, so a longer ramp would run under the
    // watch and be painted over by it. Shorten with THUMB_BACK; do not lengthen
    // it past 36 without moving the strap.
    //
    // STEPPED ROWS, NOT A PATH FILL, AND THAT IS THE POINT. `fill()` on a
    // diagonal antialiases, and this canvas is blown up 2.75x with
    // `image-rendering:pixelated` — every blended edge pixel would become a
    // 2.75 px block of half-transparent skin against the road. That is a second
    // tone on a limb where the one flat tone is the thing he chose. One
    // `fillRect` per row gives hard pixels and exactly `#c9946a`, and matches
    // how every other shape on this arm is drawn.
    const THUMB_BACK = 22;
    for (let d = 0; d < THUMB_D; d++) {
      const x0 = Math.round(THUMB_X - THUMB_BACK * (1 - d / THUMB_D));
      g.fillRect(x0, WATCH_LIMB_H + d, THUMB_X - x0, 1);
    }
    // ── THE ONE DARK STRIP ────────────────────────────────────────────────
    //
    // *"ok now ad the dark strip to the end of the limb"* (2026-08-04). THE END
    // OF THE LIMB IS ITS FAR EDGE — x 172…176, the outer edge of the fist, where
    // the limb stops. Not the wrist/fist join at x 104 where the removed strip
    // used to sit, and not x 0, which is not an end at all: that side runs off
    // the frame. Full height of the limb at that end, y 0…72, matching the fist.
    //
    // The strip he means is the one taken out three commits ago, so it is that
    // strip: the identical `rgba(0,0,0,0.10)` at the identical width, moved
    // rather than reinvented. IT IS THE ONLY OVERLAY ON THE SKIN — everything
    // left of it stays one flat `#c9946a`.
    //
    // *"increase the width of the darker shaded region at the end of the limb"*
    // (2026-08-04): STRIP_W 4 → 12, grown INWARD, since the outer edge is the
    // end of the limb and that is where he put it. Alpha is untouched at 0.10 —
    // he said wider, not darker.
    //
    // IT STOPS AT THE LIMB'S UNDERSIDE, AND THAT WAS DECIDED BY LOOKING. At
    // STRIP_W 12 the cap reaches back past x 170 where the thumb ends, so it
    // stands directly above the thumb's last 6 px, and there were two answers:
    // wrap the cap down over that much thumb, or stop dead at y 72 and leave the
    // thumb light. IT SHIPPED WRAPPED — the argument being that a light thumb
    // hanging out from under a dark cap reads as an unfinished edge — AND HE
    // LOOKED AND SAID NO: *"remove the dark at the end of the thumb"*
    // (2026-08-04). He said the thumb, not the strip, so the cap itself is
    // untouched at 12 and 0.10.
    //
    // SO THE HARD EDGE AT y 72 IS THE APPROVED LOOK, not an oversight. Do not
    // blend it, feather it, or split the difference by shortening the cap to 6
    // so it stops short of the thumb — that would be undoing the width he asked
    // for to fix an edge he has already accepted.
    //
    // ROOM LEFT: nothing stops the cap now until the fist's own start at x 104
    // (STRIP_W 72), or the watch case, whose right edge is at x 96 with
    // WATCH_POS 8 (STRIP_W 80). Neither is close; 12 is an eighth of the way.
    const STRIP_X = 176 - STRIP_W;
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(STRIP_X, 0, STRIP_W, WATCH_LIMB_H);
    // THE TWO CUT CORNERS, LAST, so they take the strip with them. `clearRect`
    // rather than a skin-coloured overdraw: the fist's far corners sit over
    // nothing (the wrist band stops at x 104, the thumb at x 170), so clearing
    // is what actually shortens the silhouette — and because the dark strip has
    // already been laid down over x 164…176, the same texels remove skin and
    // strip together. The strip therefore follows the new corners for free and
    // can never overhang them, which is the thing to watch on his most recent
    // approval. It loses 6 of its 864 texels to this.
    for (let k = 0; k < FIST_ROUND; k++) {
      const w = FIST_ROUND - k;
      g.clearRect(176 - w, k, w, 1);                       // far top, cut
      g.clearRect(176 - w, WATCH_LIMB_H - 1 - k, w, 1);    // far bottom, cut
    }
    // ── THE STRAP, AND ITS OVERHANG ───────────────────────────────────────
    //
    // *"the watch band overhang is not symetrical on the limb. the bottom has
    // no overhang."* (2026-08-04). It was `fillRect(38, 0, 44, 72)` against a
    // limb at y 6…72: 6 px proud at the top, 0 at the bottom. Both edges are
    // now STRAP_OVER, measured off the limb's own band rather than off the
    // canvas — which is why the canvas grew, above.
    //
    // Matched to the top rather than split, because the top overhang is the one
    // he has looked at for two days without objecting; the ask is for the
    // bottom to have what the top has. A 3/3 split at the strap's original 72
    // height would be `6 - 3` and `66 + 6` here, one line, if he wants it.
    // ── AND WHERE ALONG THE ARM IT ALL SITS ───────────────────────────────
    //
    // *"watch a little to the right on the arm"* (2026-08-04). Strap, case,
    // bezel, LCD and both lines of text are ONE object and slide together, so
    // this is a translate, not five edited literals: every number below is the
    // one that was approved, untouched, exactly as the WATCH_ARM translate
    // above left the wrist and fist untouched when the forearm was added.
    // WATCH_POS is the only thing to change next time.
    const STRAP_Y = 6 - STRAP_OVER, STRAP_H = 66 + STRAP_OVER * 2;
    g.save();
    g.translate(WATCH_POS, 0);
    g.fillStyle = '#26282e'; g.fillRect(38, STRAP_Y, 44, STRAP_H);          // strap
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(38, STRAP_Y, 4, STRAP_H);
    g.fillStyle = '#3a3d45'; g.fillRect(32, 14, 56, 42);         // case
    g.fillStyle = '#14161a'; g.fillRect(35, 17, 50, 36);
    g.fillStyle = '#9cab8b'; g.fillRect(38, 21, 44, 23);         // LCD
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m2 = String(mins % 60).padStart(2, '0');
    g.fillStyle = '#1c2a1c'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillText(`${hh}:${m2}`, 60, 38);
    g.fillStyle = '#8a8d95'; g.font = '5px monospace';
    g.fillText('CROSSTOWN QUARTZ', 60, 50);
    g.restore();
    g.restore();
  };
  const WALLET_W = 180, WALLET_H = 140;
  let walletWrap = document.getElementById('ct-wallet') as HTMLDivElement | null;
  let walletCv: HTMLCanvasElement;
  if (!walletWrap) {
    walletWrap = document.createElement('div');
    walletWrap.id = 'ct-wallet';
    walletWrap.style.cssText = 'position:fixed;left:50%;bottom:-8px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(150%) rotate(2deg);transition:transform .18s ease-out;';
    walletCv = document.createElement('canvas');
    walletCv.width = WALLET_W; walletCv.height = WALLET_H;
    walletCv.style.cssText = 'width:340px;height:264px;image-rendering:pixelated;display:block;';
    walletWrap.appendChild(walletCv);
    document.body.appendChild(walletWrap);
  } else {
    walletCv = walletWrap.firstChild as HTMLCanvasElement;
    walletCv.width = WALLET_W; walletCv.height = WALLET_H;
  }
  // first-person: an open bifold held in front of you in both hands — not a
  // corner menu. Thumbs grip the near edge; left leaf is your ID + pockets,
  // right leaf the cash. Slides up into view like the watch.
  const drawWallet = () => {
    const g = walletCv.getContext('2d')!;
    g.clearRect(0, 0, WALLET_W, WALLET_H);
    const { skin, skinHi, skinLo } = player;
    const wx = 20, wy = 16, ww = 140, wh = 104;
    g.fillStyle = '#2e2116'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);  // edge shadow
    g.fillStyle = '#4a3626'; g.fillRect(wx, wy, ww, wh);                  // leather
    g.fillStyle = '#5a4230'; g.fillRect(wx, wy, ww, 4);                   // top sheen
    g.fillStyle = '#2e2116'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);      // centre fold
    g.strokeStyle = 'rgba(222,210,180,0.22)'; g.setLineDash([3, 3]);
    g.strokeRect(wx + 4.5, wy + 4.5, ww - 9, wh - 9); g.setLineDash([]);
    // right leaf — bills + cash total
    const rx = wx + ww / 2 + 8;
    g.fillStyle = '#587a4a'; g.fillRect(rx + 2, wy + 8, 52, 8);
    g.fillStyle = '#6a8a5a'; g.fillRect(rx, wy + 12, 56, 34);
    g.fillStyle = '#7a9a68'; g.fillRect(rx, wy + 12, 56, 3);
    g.fillStyle = '#24301c'; g.font = 'bold 13px monospace'; g.textAlign = 'center';
    g.fillText(`$${purse.cash.toFixed(2)}`, rx + 28, wy + 34);
    // left leaf — ID card over your pockets (item list)
    const lx = wx + 9;
    g.fillStyle = '#c9b48a'; g.fillRect(lx, wy + 8, 54, 20);
    g.fillStyle = '#8a7a58'; g.fillRect(lx + 2, wy + 10, 18, 16);
    g.fillStyle = '#6a5a3c'; g.fillRect(lx + 23, wy + 12, 28, 2); g.fillRect(lx + 23, wy + 16, 24, 2); g.fillRect(lx + 23, wy + 20, 20, 2);
    // How full you are, ABOVE the list rather than under it. The pockets have
    // been finite since `ct/inventory.ts` landed, and a limit the player only
    // meets by being refused is a limit that reads as a bug — so it goes on the
    // face of the thing whose whole job is to list them. Above, because the list
    // grows downward and the bottom of the wallet is where the world's own
    // caption bar sits: a line under six items would be printed behind it.
    g.textAlign = 'left';
    g.fillStyle = '#9a927e'; g.font = '6px monospace';
    const pi = pocketInfo?.();
    if (pi) g.fillText(`${pi.used}/${pi.max} pockets`, lx, wy + 36);
    g.fillStyle = '#e8e2d0'; g.font = '7px monospace';
    let iy = wy + 47;
    for (const [k, n] of Object.entries(purse.inv)) { if (n > 0) { g.fillText(`${k} x${n}`, lx, iy); iy += 10; } }
    if (iy === wy + 47) { g.fillStyle = '#9a927e'; g.fillText('(empty pockets)', lx, iy); }
    // thumbs gripping the near corners
    const thumb = (tx: number) => {
      g.fillStyle = skin; g.fillRect(tx, wy + wh - 22, 26, 34);
      g.fillStyle = skinHi; g.fillRect(tx, wy + wh - 22, 26, 3);
      g.fillStyle = skinLo; g.fillRect(tx, wy + wh + 8, 26, 4);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(tx + 7, wy + wh - 14, 12, 14); // nail
    };
    thumb(wx - 8); thumb(wx + ww - 18);
  };
  /**
   * ── THE LAYER THE [E] PROMPT LIVES ON ────────────────────────────────────
   *
   * *"also the e dialog should always be above anything else. never behind"*
   * (2026-08-04). It was on **10**, and this file's whole stack is:
   *
   *      5  the night wash
   *      9  the selection outline
   *     11  the watch, the wallet
   *     12  the build stamp
   *  → 13  THE NOTE            (was 10 — below for why it is not 16)
   *     14  the panel backdrop
   *     15  the panel
   *  → 16  THE [E] PROMPT      (was 10)
   *     20  the fade, the fps counter
   *
   * TWO THINGS ACTUALLY COVERED IT, not one, and they are different bugs that
   * happen to share a number:
   *
   *   · THE WATCH. `bottom:-14px` on a 198 px element puts its top ~184 px up
   *     the screen and the prompt sits at 88, so the fist lands right across
   *     the prompt's row. The case that matters is SEATED — the
   *     seated prompt is unconditional (`crosstown.ts` never lets the exit
   *     label leave the screen, deliberately), so sit down, look at the time,
   *     and *"[E] stand up"* goes behind your own arm. That is the "a panel you
   *     cannot close" family: the label naming the way out, hidden.
   *   · THE WALLET. 340 x 264 at `left:50%`, `bottom:-8px` — it covers the
   *     prompt's position outright. And `toggleWallet` calls `closePanels()`,
   *     so it is NOT a panel: `panelUp()` is null the whole time it is open and
   *     the prompt stays visible underneath it rather than being suppressed.
   *
   * THE OVERLAP IS NOT A FUNCTION OF WHERE THE ARM IS TUNED TO SIT. The element
   * is `bottom:-14px` and 198 px tall in every version of it this file has ever
   * shipped, so it crosses the prompt's row at 88 whatever the drop and the tilt
   * are — which is why this layering stays correct across the arm being retuned,
   * reverted, and reverted again. Do not re-derive it from today's numbers.
   *
   * ABOVE THE PANEL TOO, at 16 rather than 13, even though `prompt()` already
   * refuses to draw while `panelUp()`. Two guards that agree cost nothing; a
   * z-order that quietly depends on a `display:none` somewhere else is how this
   * comes back.
   *
   * THE ONE THING STILL ABOVE IT IS THE FADE, AND IT IS NOT AN EXCEPTION TO HIS
   * RULE — see `prompt()`, which now hides while `fading`. The prompt is never
   * behind the black because it is not there: a caption reading *"[E] the bed"*
   * floating over a sleep cut is not the fix he asked for.
   */
  const Z_PROMPT = 16, Z_NOTE = 13;
  let promptDiv = document.getElementById('ct-prompt') as HTMLDivElement | null;
  if (!promptDiv) {
    promptDiv = document.createElement('div');
    promptDiv.id = 'ct-prompt';
    promptDiv.style.cssText = `position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:${Z_PROMPT};`
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.5);'
      + 'padding:5px 12px;border-radius:5px;pointer-events:none;display:none;letter-spacing:.4px;';
    document.body.appendChild(promptDiv);
  }
  // the transient line — what just happened, above the [E] prompt. It has the
  // SAME bug and gets a DIFFERENT number, which is the point. It sits 30 px
  // higher over the identical stretch of arm and wallet, so leaving it on 10
  // would fix the caption and leave the line above it sunk behind the same two
  // objects. But it does not get 16: unlike the prompt it has no `panelUp()`
  // guard, so 16 would start painting *"you bought a coffee"* over the open
  // bodega panel — a regression nobody asked for, bought with a fix nobody
  // needed. 13 clears the watch, the wallet and the build stamp and stops below
  // the panel backdrop, which is exactly where it already was relative to panels.
  let noteDiv = document.getElementById('ct-note') as HTMLDivElement | null;
  if (!noteDiv) {
    noteDiv = document.createElement('div');
    noteDiv.id = 'ct-note';
    noteDiv.style.cssText = `position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:${Z_NOTE};`
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#e8e2d0;text-shadow:0 1px 3px rgba(0,0,0,.95);'
      + 'pointer-events:none;opacity:0;transition:opacity .35s linear;letter-spacing:.3px;'
      + 'max-width:70vw;text-align:center;';
    document.body.appendChild(noteDiv);
  }
  // AND SET IT ON THE ELEMENTS THAT ALREADY EXIST. Both blocks above only style
  // the div they create, so a HUD built over a live one — every HMR save Erick
  // is watching, and every second `makeHud` — would have reused the old node
  // carrying `z-index:10`. The watch's own rebuild branch has a comment about
  // exactly this: "three bugs that only appear on the second build". A z-order
  // fix that does not survive a hot reload is not a fix on his screen.
  promptDiv.style.zIndex = String(Z_PROMPT);
  noteDiv.style.zIndex = String(Z_NOTE);
  let noteTimer = 0;

  // ── the selection outline ───────────────────────────────────────────────
  //
  // One absolutely-positioned div with two borders rather than a canvas: a rect
  // is all this ever draws, the browser antialiases nothing on a 1 px border, and
  // it costs no per-frame paint — only a transform when the selection moves.
  let hiDiv = document.getElementById('ct-hi') as HTMLDivElement | null;
  if (!hiDiv) {
    hiDiv = document.createElement('div');
    hiDiv.id = 'ct-hi';
    // dark 1 px outside, pale 1 px inside — legible against brick AND sky, the
    // same two-tone trick the citizen sprites use for their rim light.
    hiDiv.style.cssText = 'position:fixed;z-index:9;pointer-events:none;display:none;'
      + 'border:1px solid rgba(255,255,255,.85);outline:1px solid rgba(0,0,0,.55);'
      + 'outline-offset:0;box-sizing:border-box;';
    document.body.appendChild(hiDiv);
  }

  // ── the fade ────────────────────────────────────────────────────────────
  //
  // Above EVERYTHING, including the HUD: z-index 20 against the night wash's 5,
  // the held objects' 11 and the build stamp's 12. You are asleep — a watch
  // floating over the black would say otherwise, and a screenshot taken mid-cut
  // should show nothing, which is also the honest thing for a screenshot to do.
  //
  // `pointer-events: none` so it cannot steal pointer lock on the way past.
  let fadeDiv = document.getElementById('ct-fade') as HTMLDivElement | null;
  if (!fadeDiv) {
    fadeDiv = document.createElement('div');
    fadeDiv.id = 'ct-fade';
    fadeDiv.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:20;';
    document.body.appendChild(fadeDiv);
  }
  let fading: Promise<void> | null = null;

  const lockInput = blockInput;

  // ── the build stamp ─────────────────────────────────────────────────────
  // Twice this project has lost work to feedback given against a stale build:
  // a bug is reported, it was fixed twenty minutes earlier, and somebody goes
  // hunting for it. This makes a screenshot self-dating — whoever reads it can
  // `git show` exactly what was on screen. A trailing `+` means the tree had
  // uncommitted edits when the bundle was served, so the sha alone will not
  // reproduce it.
  //
  // Set once and never touched again: it must survive a screenshot, so it does
  // not fade, move, or hide. Dim enough to ignore while playing, legible when
  // you go looking for it.
  let stampDiv = document.getElementById('ct-stamp') as HTMLDivElement | null;
  if (!stampDiv) {
    stampDiv = document.createElement('div');
    stampDiv.id = 'ct-stamp';
    stampDiv.style.cssText = 'position:fixed;right:6px;bottom:5px;z-index:12;pointer-events:none;'
      + 'font:10px/1 ui-monospace,Menlo,monospace;color:rgba(232,226,208,.5);'
      + 'text-shadow:0 1px 2px rgba(0,0,0,.9);letter-spacing:.5px;';
    document.body.appendChild(stampDiv);
  }
  {
    const t = new Date(AT), p2 = (n: number) => String(n).padStart(2, '0');
    stampDiv.textContent = `${SHA}${DIRTY ? '+' : ''} ${p2(t.getHours())}:${p2(t.getMinutes())}`;
  }

  const hud: Hud = {
    skyAt, nightAt,
    // The wash is now a THIN cool cast, not the darkness itself. It used to
    // carry the whole night at 0.58, which flattened contrast: every surface
    // lost the same light, so the gaps between lamps were as bright as the
    // pools under them. ct/props.ts darkens the actual materials instead, and
    // this just tints what is left. nightAt() is unchanged — it is still the
    // canonical "how night is it" curve that drives the lamps.
    setNight: (v) => { nightDiv!.style.opacity = String(v * 0.28); },
    watch: (want, mins) => {
      watchWrap!.style.transform = want ? WATCH_SHOWN : WATCH_HIDDEN;
      if (want && mins !== watchShown) { drawWatch(mins); watchShown = mins; }
    },
    setFps: (text: string | null) => {
      if (text === null) { if (fpsDiv) fpsDiv.style.display = 'none'; return; }
      if (!fpsDiv) {
        fpsDiv = document.createElement('div');
        // Top-LEFT, deliberately. The watch is bottom-centre, the wallet
        // bottom-centre, the prompt bottom-centre and the caption under the
        // panel glass — the top-left corner is the one place nothing else in
        // this world ever draws, so the readout cannot cover something the
        // player is trying to read while diagnosing a stutter.
        fpsDiv.style.cssText = 'position:fixed;left:10px;top:8px;z-index:20;pointer-events:none;'
          + 'font:11px ui-monospace,monospace;color:#9cab8b;background:rgba(10,14,12,0.55);'
          + 'padding:3px 7px;border-radius:3px;letter-spacing:.5px;white-space:pre;';
        document.body.appendChild(fpsDiv);
      }
      fpsDiv.style.display = 'block';
      fpsDiv.textContent = text;
    },
    toggleWallet: () => {
      walletOpen = !walletOpen;
      if (walletOpen) { closePanels(); closeHeld(); drawWallet(); }
      walletWrap!.style.transform = walletOpen
        ? 'translateX(-50%) translateY(0) rotate(2deg)'
        : 'translateX(-50%) translateY(150%) rotate(2deg)';
    },
    closeWallet: () => {
      if (!walletOpen) return;
      walletOpen = false;
      walletWrap!.style.transform = 'translateX(-50%) translateY(150%) rotate(2deg)';
    },
    // ONE SIGNAL, BOTH VIEWS. Everything in the world that changes the purse
    // already calls this — the bodega counter, the ATM, feeding the birds — so
    // the pockets panel refreshes off the same call rather than needing every
    // one of those callers to learn that a second view exists.
    refreshWallet: () => { if (walletOpen) drawWallet(); for (const f of PURSE_WATCH) f(); },
    prompt: (text) => {
      // THE DOUBLE CAPTION. `crosstown.ts`'s per-frame loop calls this every
      // frame from whatever the player is standing on or seated at — it does
      // not know a panel is up, and never has: item 0c gave frameless panels
      // (atm, slots, blackjack, library-pc) their OWN caption line, a plain
      // DOM div anchored just above the panel canvas's bottom edge, but never
      // silenced this one. While SEATED the two land almost exactly on top of
      // each other — measured on the built slots panel, `[E] stand up]` at
      // y 603.8-632.0 versus the panel's own caption at y 610.9-629.1, a
      // near-total overlap — because both are captions that read "how do I
      // leave", one owned by the world and one by the machine. `panelUp()` is
      // this same module's own registry of what is open; nothing outside
      // hud.ts needs to know the fix happened.
      // AND IT CLEARS THE TEXT, NOT JUST THE DISPLAY. Hiding without clearing
      // left the last caption in `textContent` indefinitely: worker eightyeight
      // measured `[E] into the HOUSE OF DETENTION` still readable **40 m from
      // the jail door**, after a real `w` nudge, with the element hidden.
      //
      // That is an instrument bug, and it contaminated instruments — 77 scripts
      // read this element and 16 of them never look at `display`, so every one
      // could report that the world was offering an interaction it was not.
      // It cost eightyeight an hour of "making a correct world look
      // impossible".
      //
      // Fixed HERE rather than in the readers deliberately: one line repairs
      // all 77, where patching the 16 leaves the next reader to be written
      // holding exactly the same loaded gun. Checked before changing it that
      // nothing depends on the stale value — the only `#ct-prompt` mentions
      // anywhere in `src/` outside this block are three comments.
      // …AND IT SILENCES ITSELF DURING A FADE, for `always above anything else.
      // never behind`. The fade is z 20 and stays there: it is the screen going
      // away, not a thing drawn over the prompt, and a *"[E] the bed"* hanging
      // in the black while you sleep would be a worse bug than the one being
      // fixed. So the prompt is not put behind the black — it is not there at
      // all, and the per-frame loop brings it straight back when the cut ends.
      // `fading` spans the whole out/hold/in, so this covers the middle where
      // the world changes under it.
      if (text === null || panelUp() || fading) {
        promptDiv!.style.display = 'none';
        promptDiv!.textContent = '';
        return;
      }
      promptDiv!.textContent = text;
      promptDiv!.style.display = 'block';
    },
    fading: () => fading !== null,
    // WAIT FOR THE TRANSITION TO SAY IT IS DONE, not for a timer that thinks
    // it knows when. GOTCHAS §30 is about render-loop time, and a CSS
    // transition looks like the exception — it advances on the compositor's own
    // clock, so surely a matching `setTimeout` measures the same thing. It does
    // not, because the transition does not START until a frame is served: I set
    // the opacity in a `requestAnimationFrame` so that 0 lands before 1, and on
    // a loaded machine that frame is late. Timing the middle from t0 therefore
    // ran the world change at **opacity 0.842** — a caller's clock jumping in
    // full view of the player, which is the exact fault this whole feature is
    // dressing. Under the check's own load, 21 samples arrived where 120 were
    // due; the fade was fine and the schedule was fiction.
    //
    // `transitionend` is the event. The timeout beside it is a FALLBACK, not
    // the schedule: if the tab is hidden or the event is dropped, a fade that
    // never finishes would leave the screen black and the player locked out,
    // which is far worse than one that ends early.
    fade: (o = {}) => {
      if (fading) return fading;                 // two fades would fight one opacity
      const outMs = o.outMs ?? 850, holdMs = o.holdMs ?? 750, inMs = o.inMs ?? 1000;
      const unlock = lockInput();
      const settled = (ms: number, then: () => void) => {
        let called = false;
        const fin = () => {
          if (called) return;
          called = true;
          fadeDiv!.removeEventListener('transitionend', onEnd);
          clearTimeout(bail);
          then();
        };
        const onEnd = (e: TransitionEvent) => { if (e.propertyName === 'opacity') fin(); };
        fadeDiv!.addEventListener('transitionend', onEnd);
        const bail = setTimeout(fin, ms + 1500) as unknown as number;
      };
      fading = new Promise<void>((done) => {
        fadeDiv!.style.transition = `opacity ${outMs}ms ease-in`;
        // a frame's grace so the browser has the 0 before it is given the 1;
        // setting both in one tick is a cut, not a fade
        requestAnimationFrame(() => { fadeDiv!.style.opacity = '1'; });
        settled(outMs, () => {
          // BLACK. Everything that changes the world happens in here.
          try { o.mid?.(); } catch (e) { console.error('[hud.fade] mid threw:', e); }
          setTimeout(() => {
            fadeDiv!.style.transition = `opacity ${inMs}ms ease-out`;
            fadeDiv!.style.opacity = '0';
            settled(inMs, () => { unlock(); fading = null; done(); });
          }, holdMs);
        });
      });
      return fading;
    },
    note: (text, ms = 2400) => {
      noteDiv!.textContent = text;
      noteDiv!.style.opacity = '1';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { noteDiv!.style.opacity = '0'; }, ms) as unknown as number;
    },
    highlight: (rect) => {
      if (!rect) { hiDiv!.style.display = 'none'; return; }
      // Clamped to a sane on-screen size. An outline is a hint about WHICH thing
      // is selected, so at two metres it should frame the door and not the
      // viewport — without a ceiling a spot you are standing inside projects to
      // something larger than the screen and reads as a bug rather than a
      // selection.
      const w = Math.max(28, Math.min(rect.w, 520));
      const h = Math.max(28, Math.min(rect.h, 520));
      hiDiv!.style.left = `${Math.round(rect.x - w / 2)}px`;
      hiDiv!.style.top = `${Math.round(rect.y - h / 2)}px`;
      hiDiv!.style.width = `${Math.round(w)}px`;
      hiDiv!.style.height = `${Math.round(h)}px`;
      hiDiv!.style.display = 'block';
    },
  };
  LIVE = hud;
  // Test affordance, same shape and same reason as `__ct` and `__inv`: a fade
  // is a promise over CSS time and there is no other way to start one, or to
  // ask whether one is running, from outside. `scripts/K-sleep-fade.mjs` reads
  // the OPACITY off the element rather than this flag — a boolean going true is
  // not the same claim as the screen actually being black.
  // ── `__hud` OWNS THE CHROME OVER THE WORLD, AND NOTHING IN THE WORLD ──────
  //
  // Item 249: *"`window.__hud` VERSUS `window.__ct` IS UNDOCUMENTED and cost
  // ninety three probe detours."* Reaching for the wrong one does not throw — it
  // hands you `undefined`, and a probe then reasons from it.
  //
  // The split, in one line each:
  //   `__hud`  which cabinet is up, closing it, the fade, the keypress latch.
  //   `__ct`   the WORLD — the rig, the scene, colliders, floors, spots, seats,
  //            doors, rooms, the clock. Published by `crosstown.ts`.
  // Each MACHINE has its own besides: `__atm`, `__slots`, `__blackjack`,
  // `__librarypc`, `__inv`, `__rent`. **There are eleven surfaces, not two** —
  // measured, with the full map, in `notes/BUILDER-BRIEF.md` §4a, and
  // re-enumerable from the running world with
  // `scripts/probes/w119-249-test-surfaces.mjs`.
  //
  // NOTHING ABOUT THE PLAYER GOES HERE. `__hud` deliberately does not know where
  // he is standing and `__ct` deliberately does not know a panel is open; a
  // probe that drives a machine needs both, plus the machine's own.
  (window as unknown as { __hud: unknown }).__hud = {
    fade: (o?: Parameters<Hud['fade']>[0]) => hud.fade(o),
    fading: () => hud.fading(),
    /** which cabinet is up, by its DOM id, or null */
    panel: () => panelUp(),
    closePanels: () => closePanels(),
    /** every panel in the world, so a guard cannot miss one. See `everyPanel`. */
    panels: () => everyPanel().map((q) => q.id),
    /** test affordance: what the latch believes is physically held, and what it
     *  is currently holding inert. A latch nobody can read is a latch nobody can
     *  prove — and the open-side arm is invisible from outside without it. */
    held: () => [...physical],
    latched: () => latchedKey,
    openPanel: (id: string) => {
      const q = everyPanel().find((r) => r.id === id);
      if (!q) return false;
      q.panel.open();
      return true;
    },
  };
  return hud;
}

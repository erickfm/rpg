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
const BLOCKED = ['keydown', 'mousedown', 'mousemove', 'wheel'];
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

/** Freeze the world. Returns the undo — always call it, on every exit path. */
function blockInput(): () => void {
  releaseHeld();
  for (const k of BLOCKED) window.addEventListener(k, swallow, CAP);
  return () => { for (const k of BLOCKED) window.removeEventListener(k, swallow, true); };
}

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
  /** moulded plastic (a machine you stand at) or canvas (a thing you hold) */
  chrome?: 'machine' | 'cloth';
  /** stamped into the bezel above the screen. Keep it short and shouty. */
  title?: string;
  /** the caption strip along the bottom. Say how to leave. */
  hint?: () => string;
  /** paint the screen. Origin is the screen's top left; `w`/`h` are yours. */
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  /** a keystroke, already lower-cased. ESC is handled for you. */
  key?: (k: string, e: KeyboardEvent) => void;
  /** the wheel: +1 forward, −1 back */
  wheel?: (dir: 1 | -1) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface Panel {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  /** redraw the screen. Call it whenever your own state changes. */
  repaint: () => void;
}

const BEZEL = 14, CAPTION = 18, TITLE_H = 14;
let livePanel: { spec: PanelSpec; close: () => void } | null = null;
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
function gate(e: Event): void {
  const p = livePanel;
  if (!p) return;
  if (e.type === 'keydown') {
    const k = (e as KeyboardEvent).key.toLowerCase();
    // ESC ALWAYS CLOSES, from every panel, whatever the caller does. A player
    // who cannot get out of a machine is stuck in the world, and no individual
    // author should be able to forget this.
    if (k === 'escape') p.close();
    else p.spec.key?.(k, e as KeyboardEvent);
  } else if (e.type === 'wheel') {
    p.spec.wheel?.((e as WheelEvent).deltaY > 0 ? 1 : -1);
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
  const titleH = spec.title ? TITLE_H : 0;
  const CW = spec.w + BEZEL * 2;
  const CH = spec.h + BEZEL * 2 + titleH + CAPTION;
  const SX = BEZEL, SY = BEZEL + titleH;

  let wrap = document.getElementById(spec.id) as HTMLDivElement | null;
  let cv: HTMLCanvasElement;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = spec.id;
    wrap.style.cssText = 'position:fixed;left:50%;top:50%;z-index:15;pointer-events:none;'
      + 'transform:translate(-50%,-50%) scale(.94);opacity:0;'
      + 'transition:opacity .16s linear, transform .16s ease-out;';
    cv = document.createElement('canvas');
    cv.style.cssText = `width:${CW * scale}px;height:${CH * scale}px;image-rendering:pixelated;display:block;`
      + 'filter:drop-shadow(0 6px 14px rgba(0,0,0,.65));';
    wrap.appendChild(cv);
    document.body.appendChild(wrap);
  } else {
    cv = wrap.firstChild as HTMLCanvasElement;
  }
  cv.width = CW; cv.height = CH;

  let open = false;

  const paint = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, CW, CH);
    const machine = chrome === 'machine';
    const body = machine ? UI.case : UI.cloth;
    const hi = machine ? UI.caseHi : UI.clothHi;
    const lo = machine ? UI.caseLo : UI.clothLo;

    g.fillStyle = UI.caseEdge; g.fillRect(0, 0, CW, CH);
    g.fillStyle = body; g.fillRect(1, 1, CW - 2, CH - 2);
    g.fillStyle = hi; g.fillRect(1, 1, CW - 2, 2);                 // moulding catches the light
    g.fillStyle = lo; g.fillRect(1, CH - 4, CW - 2, 3);

    if (machine) {
      // four screws, because a machine has fixings and a menu does not
      g.fillStyle = UI.caseLo;
      for (const [sx, sy] of [[5, 5], [CW - 8, 5], [5, CH - 8], [CW - 8, CH - 8]]) {
        g.fillRect(sx, sy, 3, 3);
        g.fillStyle = UI.caseEdge; g.fillRect(sx, sy + 1, 3, 1);
        g.fillStyle = UI.caseLo;
      }
    } else {
      g.strokeStyle = 'rgba(222,210,180,0.20)'; g.setLineDash([3, 3]);
      g.strokeRect(4.5, 4.5, CW - 9, CH - 9); g.setLineDash([]);   // stitching
    }

    if (spec.title) {
      g.fillStyle = machine ? UI.caseEdge : UI.clothLo;
      g.font = UI.font(9, true); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(spec.title, CW / 2, BEZEL + 9);
      g.fillStyle = machine ? UI.caseHi : UI.clothHi;
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
    g.fillStyle = machine ? UI.caseLo : UI.clothLo;
    g.fillRect(SX, cy, spec.w, CAPTION - 6);
    g.fillStyle = UI.dim; g.font = UI.font(7); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(spec.hint ? spec.hint() : '', SX + 4, cy + 9);
    g.textAlign = 'right';
    g.fillStyle = UI.ink;
    g.fillText('ESC', SX + spec.w - 4, cy + 9);
  };

  const api: Panel = {
    isOpen: () => open,
    repaint: () => { if (open) paint(); },
    open: () => {
      if (open) return;
      // ONE THING IN YOUR HANDS AT A TIME, and that includes the two held
      // objects that predate this framework. The wallet and the pockets sit at
      // the bottom of the same frame a cabinet fills; stepping up to a machine
      // with your wallet still out is not a state this world should have.
      closePanels();
      LIVE?.closeWallet();
      closeHeld();
      open = true;
      livePanel = { spec, close: () => api.close() };
      releaseHeld();                     // let go of anything already held down
      gateUp(true);                      // …and the gate is the freeze, see above
      backdropUp(true);
      paint();
      wrap!.style.opacity = '1';
      wrap!.style.transform = 'translate(-50%,-50%) scale(1)';
      spec.onOpen?.();
    },
    close: () => {
      if (!open) return;
      open = false;
      wrap!.style.opacity = '0';
      wrap!.style.transform = 'translate(-50%,-50%) scale(.94)';
      if (livePanel && livePanel.spec === spec) {
        livePanel = null;
        gateUp(false);
        backdropUp(false);
      }
      spec.onClose?.();
    },
    toggle: () => (open ? api.close() : api.open()),
  };
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
  /** canvas width. 176 rather than 120 since the fist arrived: the wrist ends at
   *  x 104 and the hand needs 72 px beyond it. Height is unchanged — the arm is
   *  cut by the bottom of the frame, which is what makes it read as YOUR arm. */
  const WATCH_W = 176;
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    // WIDER CANVAS, SAME WATCH POSITION. The canvas grew 120 -> 176 to make room
    // for the hand; the element is centred with translateX(-50%), so growing it
    // to the right would have slid the watch 77 px to the LEFT. `left` moves the
    // same 77 px the other way to cancel it exactly, so the watch face lands
    // where it has always landed and only the hand is new.
    watchWrap.style.cssText = 'position:fixed;left:calc(52% + 77px);bottom:-14px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(140%) rotate(-6deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = WATCH_W; watchCv.height = 72;
    watchCv.style.cssText = 'width:484px;height:198px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = WATCH_W; watchCv.height = 72;
  }
  // the wrist-and-watch close-up (the good one — arm version was reverted)
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    g.clearRect(0, 0, WATCH_W, 72);
    // STEP 1 of an incremental rebuild (an all-at-once redraw was rejected).
    // Only change so far: the forearm runs OFF THE LEFT EDGE instead of
    // floating with a gap either side. A limb cut by the frame reads as your
    // own arm; a band with air around it reads as a disembodied cuff.
    g.fillStyle = '#c9946a'; g.fillRect(0, 6, 104, 66);          // wrist, cut by the frame
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 6, 10, 66);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(94, 6, 10, 66);
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
    // …and the same two-tone shading the wrist carries, light coming from the
    // right, so it reads as one limb and not as a glove: the identical rgba
    // values, not a matched-by-eye pair.
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(166, 0, 10, 72);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(104, 0, 4, 72);   // the wrist's shadow on it
    g.fillStyle = '#26282e'; g.fillRect(38, 0, 44, 72);          // strap
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(38, 0, 4, 72);
    g.fillStyle = '#3a3d45'; g.fillRect(32, 14, 56, 42);         // case
    g.fillStyle = '#14161a'; g.fillRect(35, 17, 50, 36);
    g.fillStyle = '#9cab8b'; g.fillRect(38, 21, 44, 23);         // LCD
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m2 = String(mins % 60).padStart(2, '0');
    g.fillStyle = '#1c2a1c'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillText(`${hh}:${m2}`, 60, 38);
    g.fillStyle = '#8a8d95'; g.font = '5px monospace';
    g.fillText('CROSSTOWN QUARTZ', 60, 50);
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
  let promptDiv = document.getElementById('ct-prompt') as HTMLDivElement | null;
  if (!promptDiv) {
    promptDiv = document.createElement('div');
    promptDiv.id = 'ct-prompt';
    promptDiv.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:10;'
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.5);'
      + 'padding:5px 12px;border-radius:5px;pointer-events:none;display:none;letter-spacing:.4px;';
    document.body.appendChild(promptDiv);
  }
  // the transient line — what just happened, above the [E] prompt
  let noteDiv = document.getElementById('ct-note') as HTMLDivElement | null;
  if (!noteDiv) {
    noteDiv = document.createElement('div');
    noteDiv.id = 'ct-note';
    noteDiv.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:10;'
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#e8e2d0;text-shadow:0 1px 3px rgba(0,0,0,.95);'
      + 'pointer-events:none;opacity:0;transition:opacity .35s linear;letter-spacing:.3px;'
      + 'max-width:70vw;text-align:center;';
    document.body.appendChild(noteDiv);
  }
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
      watchWrap!.style.transform = want
        ? 'translateX(-50%) translateY(0) rotate(-5deg)'
        : 'translateX(-50%) translateY(140%) rotate(-5deg)';
      if (want && mins !== watchShown) { drawWatch(mins); watchShown = mins; }
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
      if (text === null) { promptDiv!.style.display = 'none'; return; }
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
  (window as unknown as { __hud: unknown }).__hud = {
    fade: (o?: Parameters<Hud['fade']>[0]) => hud.fade(o),
    fading: () => hud.fading(),
    /** which cabinet is up, by its DOM id, or null */
    panel: () => panelUp(),
    closePanels: () => closePanels(),
  };
  return hud;
}

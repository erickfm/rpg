import * as THREE from 'three';
import { makePanel, type Panel } from './hud';
import {
  SLOTS, cycle, showing, worn, wornIndex, wear, onWardrobeChange, type Slot,
} from './wardrobe';

// ── THE MIRROR IN 301, AND THE PERSON IN IT ────────────────────────────────
//
// *"ok lets add an interactable for the mirror where the view goes into the
//  mirror and really you just see yourself with click and drag options to
//  change your outfit."*   (2026-08-04)
//
// **"THE VIEW GOES INTO THE MIRROR" IS A PANEL, NOT A REFLECTION.** Nothing in
// CROSSTOWN reflects; the glass on the wall is a PAINTED cold copy of the room,
// the way the dead TV and the window glazing are, and a live render-to-texture
// here would be the only real reflection in the world. So `[E]` eases the eye
// onto the glass — `PanelSpec.surface`, the same mechanism the wall calendar
// uses — and the panel's canvas is hung on the mirror's own mesh. The picture
// you get is the glass you were already looking at, with you painted into it.
//
// WHY THE PANEL IS A TALL NARROW STRIP, so nobody "fixes" it. The glass is
// 0.42 x 1.60 m — Erick asked for full length twice. A screen is 16:9. Fitting
// 1.60 m of height into the frame puts the 0.42 m of width at about an eighth
// of the screen, and no standoff or fov changes that ratio: it is the mirror's
// own proportion. A full-length mirror IS a tall narrow thing and this reads as
// one. Everything the panel offers is therefore laid out VERTICALLY, down the
// body, and nothing is put beside it.
//
// ── HOW YOU CHANGE CLOTHES: YOU TOUCH THE PART OF YOURSELF YOU MEAN ────────
//
// *"with click and drag options"*. There is no menu, no swatch rail and no list
// — *"i never want there to be menus popping up unless they are embedded to
// look as if they are in the actual game"* is the standing law of this project,
// and a wardrobe list floating over a mirror would be the plainest violation of
// it yet built.
//
// So the CONTROLS ARE THE BODY. Six zones, one per slot, laid over the reflection
// where that garment actually is — the crown is the hat, the face is the
// glasses, the torso is the top, the wrist is the watch, the legs are the
// bottoms, the feet are the shoes. Drag left or right across one and it scrubs
// through that slot's rack; a click without a drag steps one forward. Both, so
// neither a player who drags nor one who clicks finds nothing happens.

/**
 * THE PAINTED GLASS'S PALETTE — the room in 301, gone cold.
 *
 * Exported because `ct/apartment.ts` paints the WALL plate (the mirror you see
 * from across the room, 20 x 64 texels, which Erick has approved through three
 * iterations today and which is not touched by this file) and this module
 * paints the PANEL at eight times that density. Two paintings of one surface
 * that must not drift apart in colour: BUILDER-BRIEF §8, import rather than
 * retype. The geometry of each stays its own, because a 20-texel field and a
 * 160-texel one are not the same drawing.
 */
export const GLASS = {
  /** the room's wall, cooled */
  wall: '#98a3ac',
  /** its ceiling */
  ceil: '#7b848d',
  /** its floorboards — a full-length glass is mostly floor */
  boards: '#4a3a2b',
  /** where wall meets floor */
  skirt: '#33281d',
  /** the silvering, gone at the corners and worst along the bottom edge */
  rot: 'rgba(58,52,46,0.34)',
  /** the two sheen rakes that are what read as glass at this size */
  rakeNear: 'rgba(255,255,255,0.20)',
  rakeFar: 'rgba(255,255,255,0.11)',
} as const;

// ── THE DESIGN GRID ────────────────────────────────────────────────────────
//
// 40 x 152 units over 0.42 x 1.60 m, so a unit is SQUARE on the glass (0.0105 m
// each way) and the figure cannot come out stretched by the plane it is mapped
// onto. Everything below is in these units and lands on whole pixels through
// `u()`, exactly like `drawCalendar` — so the panel is crisp at any scale and
// the layout cannot re-arrange when the scale changes.
const MW = 40, MH = 152;
/** canvas pixels per design unit. 4 → a 160 x 608 canvas. */
const S = 4;
const PW = MW * S, PH = MH * S;

// The figure, head to floor. One block of numbers because every one of them is
// read by both the painter and the hit-test, and a zone that disagrees with the
// body it is drawn over is a control that does nothing where you can see it.
const CX = 20;              // the centre line
const HEAD_T = 12, HEAD_B = 30, HEAD_HW = 7;
const EYE_Y = 20;
const NECK_B = 35;
const SHOULDER = 34, WAIST = 76, TORSO_HW = 12;
const ARM_T = 36, ARM_B = 78, ARM_W = 6;    // arms hang at CX ± (TORSO_HW…+ARM_W)
const HAND_B = 88;
const HIP_B = 92;
const LEG_B = 138, LEG_HW = 4, LEG_GAP = 3;  // legs at CX ± (LEG_GAP … +2*LEG_HW)
const FOOT_B = 146;
const FLOOR = 146;          // where the reflected boards take over
const BAND_T = 146;         // the caption strip along the bottom of the glass
/** the wrist the watch is on: the figure's own left, our right of centre */
const WRIST_T = 68, WRIST_B = 80;

const SKIN = '#c9946a', SKIN_LO = '#a87a54', SKIN_HI = '#d8a67d';
const INK = '#efe8d6';

/** A zone of the reflection you can put a hand on. Rects are design units. */
interface Zone { slot: Slot; x0: number; y0: number; x1: number; y1: number }

/**
 * WHICH PART OF YOU IS WHICH CONTROL.
 *
 * ORDER MATTERS AND THE WATCH IS FIRST. The wrist sits inside the sleeve of the
 * top, so the two rects overlap by design — you are pointing at a watch that is
 * ON an arm that is IN a jacket. First match wins, so the smaller, more
 * specific thing is listed first. Everything else is disjoint.
 */
const ZONES: readonly Zone[] = [
  { slot: 'watch', x0: 0, y0: WRIST_T, x1: CX - TORSO_HW + 1, y1: WRIST_B },
  { slot: 'hat', x0: 6, y0: 0, x1: 34, y1: HEAD_T + 4 },
  { slot: 'glasses', x0: 8, y0: HEAD_T + 4, x1: 32, y1: NECK_B - 2 },
  { slot: 'top', x0: 0, y0: NECK_B - 2, x1: MW, y1: WAIST },
  { slot: 'bottom', x0: 2, y0: WAIST, x1: 38, y1: LEG_B - 4 },
  { slot: 'shoes', x0: 0, y0: LEG_B - 4, x1: MW, y1: BAND_T },
];

/** The slot under this CANVAS pixel, or null. */
function zoneAt(px: number, py: number): Slot | null {
  const x = px / S, y = py / S;
  for (const z of ZONES) {
    if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) return z.slot;
  }
  return null;
}

function zoneOf(slot: Slot): Zone {
  return ZONES.find((z) => z.slot === slot) as Zone;
}

// ── THE PAINTER ────────────────────────────────────────────────────────────

function paint(g: CanvasRenderingContext2D, W: number, H: number, hover: Slot | null): void {
  const s = W / MW;
  const u = (v: number) => Math.round(v * s);
  /** every rect in this file goes through here: whole pixels, always. A single
   *  fractional edge antialiases, and an antialiased edge on a pixelated blow-up
   *  is a second tone on a surface that is meant to have one. */
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(u(x), u(y), u(x + w) - u(x), u(y + h) - u(y));
  };
  const text = (str: string, cx: number, cy: number, size: number, fill: string) => {
    g.fillStyle = fill;
    g.font = `bold ${u(size)}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(str, u(cx), u(cy));
  };

  // ── the glass: the room behind you, cold, with the boards running away ──
  box(0, 0, MW, MH, GLASS.wall);
  box(0, 0, MW, 10, GLASS.ceil);
  box(0, FLOOR - 32, MW, MH - FLOOR + 32, GLASS.boards);
  box(0, FLOOR - 34, MW, 2, GLASS.skirt);
  g.fillStyle = 'rgba(0,0,0,0.20)';                        // board joints
  for (const y of [FLOOR - 26, FLOOR - 18, FLOOR - 8, FLOOR + 4]) g.fillRect(0, u(y), W, u(1) || 1);

  // ── the person ─────────────────────────────────────────────────────────
  const top = worn('top');
  const bottom = showing('bottom');
  const shoes = worn('shoes');
  const hat = worn('hat');
  const specs = worn('glasses');
  const watch = worn('watch');

  // SKIN FIRST, ALL OF IT. Every garment below is painted OVER a complete body,
  // so an empty slot needs no special case anywhere — it simply leaves what is
  // underneath showing, and what is underneath is you.
  box(CX - HEAD_HW, HEAD_T, HEAD_HW * 2, HEAD_B - HEAD_T, SKIN);          // head
  box(CX - 3, HEAD_B - 1, 6, NECK_B - HEAD_B + 1, SKIN_LO);               // neck, in its own shadow
  box(CX - TORSO_HW + 1, SHOULDER, (TORSO_HW - 1) * 2, WAIST - SHOULDER, SKIN);
  for (const sgn of [-1, 1]) {                                            // arms and hands
    const ax = sgn < 0 ? CX - TORSO_HW - ARM_W + 1 : CX + TORSO_HW - 1;
    box(ax, ARM_T, ARM_W, HAND_B - ARM_T, SKIN);
  }
  box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, HIP_B - WAIST, SKIN); // hips
  for (const sgn of [-1, 1]) {                                            // legs
    const lx = sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP;
    box(lx, HIP_B, LEG_HW * 2, LEG_B - HIP_B, SKIN);
  }
  // hair, as one shape — this world draws a haircut as a silhouette and not as
  // strands (see `ct/citizens.ts`, which paints five views the same way)
  box(CX - HEAD_HW, HEAD_T - 2, HEAD_HW * 2, 7, '#3a2c22');
  box(CX - HEAD_HW - 1, HEAD_T + 1, 1, 8, '#3a2c22');
  box(CX + HEAD_HW, HEAD_T + 1, 1, 8, '#3a2c22');
  // the face, at the scale it can carry: two eyes and a mouth, nothing else
  box(CX - 4, EYE_Y, 2, 2, '#2a2016');
  box(CX + 2, EYE_Y, 2, 2, '#2a2016');
  box(CX - 2, EYE_Y + 6, 4, 1, '#8a5c46');

  // ── THE UNDERWEAR, WHICH IS NOT A GARMENT ──────────────────────────────
  //
  // *"maximum naked must include white undies."* It is drawn HERE, under
  // everything, whenever the slot is empty — so there is no index, no option
  // and no code path that produces a bare body. See `ct/wardrobe.ts`'s header.
  box(CX - TORSO_HW + 1, WAIST - 16, (TORSO_HW - 1) * 2, HIP_B - WAIST + 16, '#e9e6de');
  box(CX - TORSO_HW + 1, HIP_B - 3, (TORSO_HW - 1) * 2, 3, '#d3cfc4');      // its own shadow
  if (top.kind === 'vest') {                                                // the vest, when nothing is over it
    box(CX - 8, SHOULDER + 4, 16, WAIST - SHOULDER - 4, '#e9e6de');
    box(CX - 8, SHOULDER, 4, 6, '#e9e6de');
    box(CX + 4, SHOULDER, 4, 6, '#e9e6de');
    box(CX + 6, SHOULDER + 4, 2, WAIST - SHOULDER - 4, '#d3cfc4');
  }

  // ── the bottom half ────────────────────────────────────────────────────
  const hemOf = (leg: number) => (leg >= 3 ? LEG_B - 2 : leg === 2 ? 116 : 104);
  if (bottom.kind === 'trousers') {
    const hem = hemOf(bottom.leg ?? 3);
    box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, HIP_B - WAIST + 2, bottom.cloth);
    box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, 3, bottom.trim);       // waistband
    for (const sgn of [-1, 1]) {
      const lx = sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP;
      box(lx, HIP_B, LEG_HW * 2, hem - HIP_B, bottom.cloth);
      if (bottom.id === 'track') box(sgn < 0 ? lx : lx + LEG_HW * 2 - 1, HIP_B, 1, hem - HIP_B, bottom.trim);
      box(lx, hem - 2, LEG_HW * 2, 2, bottom.trim);
    }
  } else if (bottom.kind === 'skirt' || bottom.kind === 'dress') {
    // A SKIRT IS A CONE, and this world draws a cone as three stepped bands —
    // the same way `ct/citizens.ts` flares its dress over the hips. Not a path:
    // an antialiased diagonal here would be the only soft edge on the glass.
    const hem = bottom.kind === 'dress' ? 118 : 114;
    const top0 = bottom.kind === 'dress' ? SHOULDER + 2 : WAIST;
    const bands = 4;
    for (let b = 0; b < bands; b++) {
      const y0 = top0 + ((hem - top0) * b) / bands;
      const y1 = top0 + ((hem - top0) * (b + 1)) / bands;
      const hw = TORSO_HW - 1 + b * 2;
      box(CX - hw, y0, hw * 2, y1 - y0, bottom.cloth);
    }
    box(CX - TORSO_HW - bands * 2 + 1, hem - 2, (TORSO_HW + bands * 2 - 1) * 2, 2, bottom.trim);
  }

  // ── the top half ───────────────────────────────────────────────────────
  if (top.kind !== 'vest') {
    const hem = WAIST + (top.hem ?? 2);
    box(CX - TORSO_HW, SHOULDER - 1, TORSO_HW * 2, hem - SHOULDER + 1, top.cloth);
    // rim light and shade, 2 units, exactly the citizens' treatment — it is
    // what stops a torso reading as a flat coloured slab
    box(CX - TORSO_HW, SHOULDER - 1, 2, hem - SHOULDER + 1, 'rgba(255,255,255,0.10)');
    box(CX + TORSO_HW - 2, SHOULDER - 1, 2, hem - SHOULDER + 1, 'rgba(0,0,0,0.16)');
    box(CX - TORSO_HW, SHOULDER - 1, TORSO_HW * 2, 2, top.trim);             // collar
    const sleeveB = top.sleeve === 2 ? ARM_B - 2 : ARM_T + 12;
    for (const sgn of [-1, 1]) {
      const ax = sgn < 0 ? CX - TORSO_HW - ARM_W + 1 : CX + TORSO_HW - 1;
      box(ax, ARM_T - 2, ARM_W, sleeveB - ARM_T + 2, top.cloth);
      box(ax, sleeveB - 2, ARM_W, 2, top.trim);                              // the cuff
    }
    if (top.kind === 'jacket') {
      box(CX - 1, SHOULDER + 1, 1, hem - SHOULDER - 1, 'rgba(0,0,0,0.22)');  // the front
      box(CX - 6, SHOULDER + 1, 5, 6, top.trim);                             // lapels
      box(CX + 1, SHOULDER + 1, 5, 6, top.trim);
    }
    if (top.kind === 'sweater') box(CX - TORSO_HW, hem - 3, TORSO_HW * 2, 3, top.trim);  // ribbed welt
  }

  // ── the watch, on the wrist, on the arm the hud raises ──────────────────
  if (watch.kind !== 'none') {
    const ax = CX - TORSO_HW - ARM_W + 1;
    box(ax - 1, WRIST_T + 2, ARM_W + 2, 8, watch.cloth);
    box(ax - 1, WRIST_T + 4, ARM_W + 2, 4, watch.trim);
    box(ax, WRIST_T + 5, ARM_W, 2, watch.kind === 'digital' ? '#9cab8b' : '#e6e0cc');
  }

  // ── shoes ──────────────────────────────────────────────────────────────
  for (const sgn of [-1, 1]) {
    const lx = sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP;
    if (shoes.kind === 'sneaker') {
      box(lx - 1, LEG_B - 4, LEG_HW * 2 + 2, FOOT_B - LEG_B + 2, shoes.cloth);
      box(lx - 1, FOOT_B - 2, LEG_HW * 2 + 2, 2, shoes.trim);
      box(lx - 1, LEG_B - 1, LEG_HW * 2 + 2, 1, shoes.trim);
    } else if (shoes.kind === 'sandal') {
      box(lx - 1, FOOT_B - 3, LEG_HW * 2 + 2, 3, shoes.cloth);
      box(lx, LEG_B, LEG_HW * 2, 1, shoes.trim);
      box(lx, LEG_B + 3, LEG_HW * 2, 1, shoes.trim);
    } else if (shoes.kind === 'boot') {
      box(lx - 1, LEG_B - 12, LEG_HW * 2 + 2, FOOT_B - LEG_B + 12, shoes.cloth);
      box(lx - 1, FOOT_B - 2, LEG_HW * 2 + 2, 2, shoes.trim);
    } else {
      box(lx - 1, LEG_B, LEG_HW * 2 + 2, FOOT_B - LEG_B, SKIN_HI);            // bare
    }
  }

  // ── the hat ────────────────────────────────────────────────────────────
  if (hat.kind === 'cap') {
    box(CX - HEAD_HW - 1, HEAD_T - 4, HEAD_HW * 2 + 2, 7, hat.cloth);
    box(CX - HEAD_HW - 3, HEAD_T + 2, HEAD_HW * 2 + 6, 2, hat.trim);          // the peak, seen head-on
    box(CX - 1, HEAD_T - 5, 2, 2, hat.trim);                                  // the button
  } else if (hat.kind === 'sun') {
    box(CX - HEAD_HW, HEAD_T - 6, HEAD_HW * 2, 8, hat.cloth);                 // crown
    box(CX - 13, HEAD_T + 1, 26, 3, hat.cloth);                               // brim
    box(CX - 13, HEAD_T + 3, 26, 1, 'rgba(0,0,0,0.20)');
    box(CX - HEAD_HW, HEAD_T - 1, HEAD_HW * 2, 2, hat.trim);                  // the band
  }

  // ── glasses ────────────────────────────────────────────────────────────
  if (specs.kind !== 'none') {
    for (const sgn of [-1, 1]) {
      const gx = sgn < 0 ? CX - 6 : CX + 1;
      box(gx, EYE_Y - 1, 5, 4, specs.cloth);
      box(gx, EYE_Y - 2, 5, 1, specs.trim);
      box(gx, EYE_Y + 3, 5, 1, specs.trim);
      box(sgn < 0 ? gx - 1 : gx + 5, EYE_Y - 1, 1, 4, specs.trim);
    }
    box(CX - 1, EYE_Y, 2, 1, specs.trim);                                     // the bridge
    box(CX - HEAD_HW - 1, EYE_Y, 2, 1, specs.trim);                           // the arms
    box(CX + HEAD_HW - 1, EYE_Y, 2, 1, specs.trim);
  }

  // ── THE GLASS ITSELF, OVER THE TOP OF ALL OF IT ────────────────────────
  //
  // The rakes and the rot are drawn LAST because they are on the near face of
  // the glass and you are behind it: a sheen that the reflection painted over
  // would read as a stripe on the room instead of a mark on the mirror.
  g.fillStyle = GLASS.rakeNear;
  for (let y = 0; y < H; y++) g.fillRect(Math.round(y * 0.22), y, u(4), 1);
  g.fillStyle = GLASS.rakeFar;
  for (let y = 0; y < H; y++) g.fillRect(u(18) + Math.round(y * 0.22), y, u(2), 1);
  for (const [x, y, w, h] of [[0, 0, 4, 12], [36, 8, 4, 10], [0, 62, 2, 16],
                              [38, 104, 2, 14], [0, 138, 8, 12], [30, 145, 10, 7]]) {
    box(x, y, w, h, GLASS.rot);
  }

  // ── AND WHAT YOUR HAND IS ON ───────────────────────────────────────────
  //
  // Only ever the hovered slot: a mirror with six labelled boxes drawn on it is
  // the menu this design exists to avoid. Hover one and you get a bracket round
  // it, an arrow at each edge of the glass saying which way it scrubs, and the
  // garment's name in the strip along the bottom.
  if (hover) {
    const z = zoneOf(hover);
    const cy = (z.y0 + z.y1) / 2;
    g.fillStyle = 'rgba(240,232,214,0.10)';
    g.fillRect(u(z.x0), u(z.y0), u(z.x1) - u(z.x0), u(z.y1) - u(z.y0));
    for (const y of [z.y0, z.y1 - 1]) box(z.x0, y, z.x1 - z.x0, 1, 'rgba(240,232,214,0.55)');
    // the two arrows, stepped rather than drawn as triangles for the reason the
    // skirt's bands are stepped: nothing on this glass may be antialiased
    for (let k = 0; k < 4; k++) {
      box(1 + k, cy - (3 - k), 1, (3 - k) * 2 + 1, INK);
      box(MW - 2 - k, cy - (3 - k), 1, (3 - k) * 2 + 1, INK);
    }
  }
  box(0, BAND_T, MW, MH - BAND_T, 'rgba(12,14,18,0.72)');
  if (hover) {
    text(showing(hover).name, CX, BAND_T + 3.2, 4.2, INK);
  } else {
    text('DRAG TO DRESS', CX, BAND_T + 3.2, 4.2, 'rgba(239,232,214,0.62)');
  }
}

// ── THE PANEL ──────────────────────────────────────────────────────────────

/**
 * Build the mirror's view. `mesh` is resolved at OPEN time — `ct/apartment.ts`
 * rebuilds its interiors as the player moves, so a reference captured at build
 * time can outlive the object it names (`ScreenSurface.mesh` says so, and the
 * degrade path is the screen-space cabinet rather than a crash).
 *
 * Returns the opener to hand straight to `ctx.spot({ act })`.
 */
export function mirrorPanel(mesh: () => THREE.Object3D | null, o: {
  standoff: number; fov: number;
}): () => void {
  let panel: Panel | null = null;
  let hover: Slot | null = null;
  /** the drag in progress: which slot, where it started, and what was on then */
  let drag: { slot: Slot; x0: number; i0: number; last: number; moved: boolean } | null = null;
  /**
   * How far you drag to change one garment, in canvas pixels.
   *
   * 20 of the 160 across the glass, so a drag from one edge to the other steps
   * eight — more than any rack holds, i.e. every option in a slot is reachable
   * in one gesture without lifting the button. Smaller and a twitch changes
   * your trousers; larger and the longest rack needs two drags.
   */
  const STEP = 20;

  const repaint = () => panel?.repaint();

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-mirror', w: PW, h: PH, chrome: 'none', scale: 1,
        // `chrome:'none'` for the calendar's reason and more so: this canvas IS
        // the mirror's glass, edge to edge. A framework bezel would be a beige
        // plastic case drawn inside a wooden mirror frame.
        hint: () => 'drag across yourself to change what you are wearing',
        draw: (g, w, h) => paint(g, w, h, hover),
        wheel: (d) => { if (hover) { cycle(hover, d); repaint(); } },
        key: (k) => {
          // THE KEYBOARD DOES EVERYTHING THE MOUSE DOES. A panel that can only
          // be worked with a pointer is one a player with a trackpad, a
          // touchscreen or a stuck mouse cannot leave a state in — and Escape
          // and `[E]` are the framework's, so nothing here can eat the way out.
          const i = hover ? SLOTS.indexOf(hover) : -1;
          if (k === 'arrowdown') hover = SLOTS[(i + 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowup') hover = SLOTS[(i - 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowright') { if (hover) cycle(hover, 1); }
          else if (k === 'arrowleft') { if (hover) cycle(hover, -1); }
          else return;
          repaint();
        },
        surface: {
          mesh,
          standoff: o.standoff,
          fov: o.fov,
          hot: (x, y) => zoneAt(x, y) !== null,
          move: (x, y) => {
            if (drag) {
              // SCRUB. Measured from where the button went down and from the
              // index it went down ON, not incrementally — an incremental
              // version drifts, and dragging back to where you started must put
              // back what you started in. `last` is the step count already
              // applied, so a mousemove that has not crossed a step boundary
              // does nothing at all: `wear` writes to storage and wakes the hud.
              const steps = Math.round((x - drag.x0) / STEP);
              if (steps !== 0) drag.moved = true;
              if (steps !== drag.last) {
                drag.last = steps;
                wear(drag.slot, drag.i0 + steps);
                repaint();
              }
              return;
            }
            const z = zoneAt(x, y);
            if (z !== hover) { hover = z; repaint(); }
          },
          click: (x, y) => {
            const z = zoneAt(x, y);
            if (!z) return;
            hover = z;
            // `showing` rather than `wornIndex`: while a dress is on, the
            // bottoms slot is the dress, and a drag that started from the
            // trousers still in the drawer would jump.
            const i0 = showing(z) === worn(z) ? wornIndex(z) : -1;
            drag = { slot: z, x0: x, i0, last: 0, moved: false };
            repaint();
          },
          // THE BUTTON CAME UP — anywhere, including off the glass, which is
          // where a drag that runs out of mirror ends. A click is a drag that
          // never moved, so the two gestures cost one branch between them and
          // neither can swallow the other.
          up: () => {
            const d = drag;
            drag = null;
            if (!d) return;
            if (!d.moved) { cycle(d.slot, 1); repaint(); }
          },
        },
        // NOTHING IS REMEMBERED ACROSS OPENINGS except the clothes, which are
        // the point. The hand starts on nothing, so walking up to the mirror
        // never shows a bracket round a part of you that you last touched an
        // hour ago and cannot remember choosing.
        onOpen: () => { hover = null; drag = null; },
        onClose: () => { drag = null; },
      });
      // and if something else dresses the player — a shop, a laundrette, a
      // debug hook — the glass follows without that thing knowing it exists
      onWardrobeChange(() => { if (panel?.isOpen()) panel.repaint(); });
    }
    panel.open();
  };
  return open;
}

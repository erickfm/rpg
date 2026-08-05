import * as THREE from 'three';
import { makePanel, type Panel } from './hud';
import { dither } from './paint';
import type { Purse } from './hud';
import { drawerStock, drawerTake, drawerPut, give, roomFor } from './inventory';
/** THE BAG YOU WEAR IS THE BAG YOU OPEN — one fact, read from the wardrobe and
 *  never copied. `bagCapacity()` is 0 when the slot is empty, so the carousel
 *  that will offer the bag has one question to ask and no second table to
 *  disagree with. Declared here now so the container work lands on it. */
export { bagCapacity, bagWorn } from './wardrobe';

// ══ LOOKING INTO THE DRESSER DRAWER ════════════════════════════════════════
//
// *"we need to figure out inventories. so user inventory, bag inventory, anmd
//  dresser inventory. i would like it to be diagetic but it seems it will be
//  tricky to have little icons for items with hover desc. and also somehow make
//  it diagetic? maybe no icons, maybe just categories. so in the dresser we
//  have a bunch of squares and each is a stack of that category? idk. idk if
//  theres anyway to diagetic this"*   (2026-08-04)
//
// **THIS IS A PROTOTYPE OF THE IDEA, NOT A SYSTEM.** One drawer. Not the bag,
// not the pockets, and deliberately not unified with either — a drawer, a bag
// and your pockets are three different objects and the fact that they behave
// differently is what makes this a place rather than a menu.
//
// ── THE TWO THINGS HE IS WORRIED ABOUT, AND THE ANSWER TO BOTH ─────────────
//
// **"little icons"** — the wardrobe spent this whole session learning that the
// failures were SCALE. A garment at 4.2% of the frame was unreadable and no
// amount of redrawing fixed it; at 62% it worked. A grid of item icons is that
// same mistake with a different subject, so there is no grid here. There are
// **three objects, each about a third of the frame**, lying in a drawer.
//
// **"hover desc"** — the reason you want a tooltip is that the thing is too
// small to read. **So you pick it up.** Bringing an object to your eye makes it
// half the screen, and half the screen is legible without a word of text.
// Examining IS holding, it is the same verb the mirror uses, and it needs no
// overlay — which matters, because *"nothing drawn over the world"* has been
// enforced five times today and the mirror's own caption was deleted for it.
//
// **"a bunch of squares and each is a stack"** is right and is what multiples
// do here: four packs of socks are drawn as one pile with its edges offset, not
// as four separate things. One big shape beats four small ones.
//
// ── AND CAPACITY IS PHYSICAL ───────────────────────────────────────────────
//
// No slot count, no weight, no number anywhere. `LAY` lays the stacks along the
// drawer and stops when it runs out of floor; what fits, fits. The drawer is
// 0.58 x 0.17 m of real timber and that is the whole of the rule.

/** the drawer's inside, in metres — the box `ct/apartment.ts` builds */
export const DRAWER_W = 0.58, DRAWER_D = 0.17;
/** texels per metre on the lining. 400 → a 232 x 68 canvas. */
const LINING_PPM = 400;
/** how close the eye gets, and how much of the frame the drawer then fills */
export const DRAWER_STANDOFF = 0.68, DRAWER_FOV = 34;

export function liningCanvas(): { w: number; h: number } {
  return { w: Math.round(DRAWER_W * LINING_PPM), h: Math.round(DRAWER_D * LINING_PPM) };
}

/** the world texture's own repaint, so a take or a put is visible from the
 *  room and not only through the panel. Set when the texture is built. */
let refreshWorld: (() => void) | null = null;

/**
 * THE DRAWER AS IT LOOKS FROM THE ROOM — paper, and the things lying on it.
 *
 * *"the diagetic overlay doesnt even exist? or i cant see it?"*  (2026-08-05)
 *
 * **A SECOND BUG, INDEPENDENT OF THE CAMERA.** This texture was built from an
 * EMPTY canvas — a placeholder, on the reasoning that the panel would paint
 * over it. It does, but only while the panel is open: the rest of the time
 * `MeshBasicMaterial` ignores alpha it was never told to respect, so an
 * untouched canvas renders BLACK. The drawer has been a black slab in the
 * corner of the room this whole time, and no camera fix could have shown him
 * anything else.
 *
 * So the world texture paints THE SAME PICTURE the panel does. The drawer
 * genuinely has socks in it when you walk past, `[E]` only brings you closer to
 * them, and there is one drawing rather than a real one and a blank.
 */
export function paintLiningWorld(g: CanvasRenderingContext2D, W: number, H: number): void {
  paintLining(g, W, H);
  const st = drawerStock();
  LAY(W, H, st.length).forEach((r, i) => {
    for (let d = Math.min(3, st[i].n) - 1; d > 0; d--) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(r.x + d * 2, r.y + d * 2, r.w, r.h);
    }
    paintItemTop(g, r.x, r.y, r.w, r.h, st[i].id);
  });
}

/** Register the world texture's repaint. `ct/apartment.ts` owns the texture;
 *  this file owns when it is stale. */
export function onLiningChange(fn: () => void): void { refreshWorld = fn; }

/**
 * THE LINING — shelf paper, going yellow, laid in a drawer that has been in
 * this flat longer than the tenant has.
 *
 * Sampled from the street rather than invented: `#e8e4d8` is the world's paper
 * and `#c9a45e` its tan, both among the six most-used values in the game.
 */
function paintLining(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.fillStyle = '#d8cfb4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9a45e';                                   // its printed check
  for (let x = 0; x < W; x += Math.round(W / 14)) g.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += Math.round(W / 14)) g.fillRect(0, y, W, 1);
  g.fillStyle = 'rgba(90,74,52,0.20)';                       // where it is dirty
  g.fillRect(0, 0, W, Math.round(H * 0.10));
  g.fillRect(0, H - Math.round(H * 0.12), W, Math.round(H * 0.12));
  dither(g, W, H, Math.round((W * H) / 260));
}

/**
 * ONE OBJECT, SEEN FROM ABOVE, in a `w x h` box.
 *
 * Everything in a drawer is a rectangle from this angle — that is what a drawer
 * IS — so what tells two things apart is proportion, colour and ONE printed
 * detail apiece. No outlines, no shading: flat shapes, the way the whole world
 * is drawn, and legible because they are big rather than because they are
 * detailed.
 *
 * ⚠ NOT `ItemDef.icon`. That painter is a 24 x 24 pocket icon drawn for the
 * wallet, and blowing it up to a third of the screen is exactly the "small
 * thing enlarged" this view exists to avoid. The id is shared; the drawing is
 * not, because a thing lying in a drawer and a thing listed in a wallet are
 * two different pictures of it.
 */
function paintItemTop(g: CanvasRenderingContext2D, x: number, y: number,
                      w: number, h: number, id: string): void {
  const b = (fx: number, fy: number, fw: number, fh: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x + fx * w), Math.round(y + fy * h),
      Math.max(1, Math.round(fw * w)), Math.max(1, Math.round(fh * h)));
  };
  switch (id) {
    case 'SOCKS':                                            // a banded pack, soft
      b(0, 0.10, 1, 0.80, '#e4e0d4');
      b(0, 0.10, 1, 0.10, '#cfcabc');
      b(0.10, 0.34, 0.80, 0.10, '#8a3a2e');                  // the band round them
      b(0.10, 0.52, 0.80, 0.06, '#2c4a7a');
      break;
    case 'VHS':                                              // a tape, label up
      b(0, 0.06, 1, 0.88, '#241f1a');
      b(0.08, 0.14, 0.84, 0.34, '#e8e4d8');                  // the label
      b(0.14, 0.24, 0.50, 0.06, '#7d7668');                  // written on, unreadably
      b(0.14, 0.34, 0.34, 0.06, '#7d7668');
      b(0.10, 0.64, 0.80, 0.20, '#3a3d42');                  // the shutter
      break;
    case 'CHEQUES':                                          // a book, pale green
      b(0.06, 0.10, 0.88, 0.80, '#b8c4a8');
      b(0.06, 0.10, 0.88, 0.12, '#8a9a7a');                  // the stub edge
      b(0.16, 0.40, 0.60, 0.05, '#7d8a70');
      b(0.16, 0.54, 0.44, 0.05, '#7d8a70');
      break;
    default:                                                 // an honest parcel
      b(0.06, 0.10, 0.88, 0.80, '#8a7a52');
      b(0.06, 0.44, 0.88, 0.10, '#6b5c3e');
  }
}

/**
 * WHERE THE STACKS LIE, and the whole of what "capacity" means here.
 *
 * Along the drawer, left to right, each one square-ish and as tall as the
 * drawer's inside allows. It stops when the next stack would not fit — the
 * drawer holds what fits in it and nothing counts anything.
 */
function LAY(W: number, H: number, n: number) {
  const pad = Math.round(H * 0.10);
  const size = Math.min(Math.round((W - pad) / Math.max(1, n)) - pad, H - pad * 2);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let x = pad;
  for (let i = 0; i < n && x + size <= W - pad; i++) {
    out.push({ x, y: Math.round((H - size) / 2), w: size, h: size });
    x += size + pad;
  }
  return out;
}

/**
 * HOW BIG A THING IS WHEN YOU HOLD IT UP, in metres, and how far above the
 * drawer it hangs.
 *
 * **THIS IS THE ANSWER TO "hover desc" AND THE NUMBERS ARE THE ARGUMENT.** The
 * eye sits `DRAWER_STANDOFF` (0.68 m) above the lining; a thing lifted 0.22 m
 * off it is 0.46 m from the eye, and 0.22 m across through a 34° lens is then
 * **78% of the frame's height**. The same object lying in the drawer is 32%.
 * You do not need a tooltip to read three quarters of a screen.
 *
 * 0.22 rather than 0.30 of lift on purpose: at 0.30 it measured 95% and the
 * thing was clipping the top and bottom of the frame, which reads as a texture
 * bug rather than as an object being held.
 */
const HOLD_M = 0.22, HOLD_UP = 0.22;


export function drawerPanel(o: {
  scene: THREE.Scene;
  /** the lining plane, resolved at open time — interiors are rebuilt */
  mesh: () => THREE.Object3D | null;
  purse: Purse;
  refreshWallet: () => void;
}): () => void {
  const { w: LW, h: LH } = liningCanvas();
  let panel: Panel | null = null;
  /** what he has picked up to look at. `null` = it is all still lying down,
   *  which is the state the drawer opens in. */
  let held: string | null = null;
  const repaint = () => panel?.repaint();

  const stacks = () => drawerStock();
  const cellAt = (x: number, y: number): string | null => {
    const st = stacks();
    const lay = LAY(LW, LH, st.length);
    for (let i = 0; i < lay.length; i++) {
      const r = lay[i];
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return st[i].id;
    }
    return null;
  };

  // ── THE THING IN YOUR HAND IS A REAL OBJECT IN THE ROOM ──────────────────
  //
  // A quad hanging over the drawer, facing up at an eye that is looking down —
  // not a picture drawn over the view. Built on first use and parked invisible
  // after, because most of the time nobody has picked anything up.
  let hand: THREE.Mesh | null = null;
  let handCv: HTMLCanvasElement | null = null;
  let handTex: THREE.CanvasTexture | null = null;
  const showHand = (id: string | null) => {
    const m = o.mesh();
    if (!id || !m) { if (hand) hand.visible = false; return; }
    if (!hand) {
      handCv = document.createElement('canvas');
      handCv.width = 128; handCv.height = 128;
      handTex = new THREE.CanvasTexture(handCv);
      handTex.magFilter = THREE.NearestFilter; handTex.minFilter = THREE.NearestFilter;
      hand = new THREE.Mesh(new THREE.PlaneGeometry(HOLD_M, HOLD_M),
        new THREE.MeshBasicMaterial({ map: handTex, transparent: true }));
      hand.rotation.x = -Math.PI / 2;          // face up, at the eye looking down
      hand.renderOrder = 5;
      o.scene.add(hand);
    }
    const g = handCv!.getContext('2d');
    if (g) {
      g.clearRect(0, 0, 128, 128);
      paintItemTop(g, 2, 2, 124, 124, id);
      handTex!.needsUpdate = true;
    }
    m.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
    hand.position.set(c.x, c.y + HOLD_UP, c.z);
    hand.visible = true;
  };

  const paint = (g: CanvasRenderingContext2D, W: number, H: number) => {
    paintLining(g, W, H);
    const st = stacks();
    LAY(W, H, st.length).forEach((r, i) => {
      const { id, n } = st[i];
      // A STACK IS ONE SHAPE WITH ITS EDGES SHOWING, which is his own instinct:
      // four packs of socks are a pile, not four pictures of a pack. Two offset
      // shadows under the top one say "more than one" at a glance, and cost two
      // rects rather than four more objects to read.
      for (let d = Math.min(3, n) - 1; d > 0; d--) {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(r.x + d * 2, r.y + d * 2, r.w, r.h);
      }
      // THE ONE HE IS HOLDING IS NOT ALSO LYING IN THE DRAWER. Its pile loses
      // the top layer while it is in his hand, so the count on the lining and
      // the thing over it always add up.
      if (held === id && n <= 1) return;
      paintItemTop(g, r.x, r.y, r.w, r.h, id);
    });
  };

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-drawer', w: LW, h: LH, chrome: 'none', scale: 1,
        // NO CAPTION — `PanelSpec.silent`, the same as the mirror and for the
        // same instruction: *"nothing drawn over the world"*. Escape and `[E]`
        // both close it, as they close every panel in this world.
        silent: true,
        draw: paint,
        surface: {
          mesh: o.mesh,
          standoff: DRAWER_STANDOFF,
          fov: DRAWER_FOV,
          hot: (x, y) => !!held || !!cellAt(x, y),
          click: (x, y) => {
            if (held) {
              // ── WHAT YOU DO WITH A THING IN YOUR HAND ────────────────────
              //
              // It hangs on the view axis, so it projects to the MIDDLE of the
              // screen — and the ray through the middle of the screen lands on
              // the middle of the lining. So *"did he click the thing he is
              // holding"* is *"was the click near the lining's centre"*, with
              // no second hit-test and no second mesh to raycast.
              //
              // ON IT: into your pockets. ANYWHERE ELSE: back in the drawer.
              const onIt = Math.hypot(x - LW / 2, y - LH / 2) < LH * 0.45;
              if (onIt && roomFor(o.purse, held) > 0 && drawerTake(held)) {
                // through the same `give` the whole world uses, and it cannot
                // eat the thing: if the pockets refuse it, it goes back down.
                if (give(o.purse, held, 1) < 1) drawerPut(held);
                else o.refreshWallet();
                // and the DRAWER ITSELF changes, not just this view of it
                refreshWorld?.();
              }
              held = null;
              showHand(null);
              repaint();
              return;
            }
            const id = cellAt(x, y);
            if (!id) return;
            held = id;
            showHand(id);
            repaint();
          },
        },
        // NOTHING SURVIVES A CLOSE. Escape mid-examine puts it back down,
        // because it was never taken out: `held` is a way of LOOKING at a
        // stack, not a fourth container something could be lost in.
        onOpen: () => { held = null; showHand(null); },
        onClose: () => { held = null; showHand(null); },
      });
    }
    panel.open();
  };
  return open;
}

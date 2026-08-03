import * as THREE from 'three';

/**
 * THE ATM's FACE, DECLARED ONCE — READ BY THE THING THAT PAINTS IT AND THE
 * THING THAT LISTENS TO IT.
 *
 * The user, 2026-08-02: *"for the atm why do we not use the number button at
 * the bottom?"*
 *
 * He is looking at a real twelve-key pad, in 3-D, immediately below the tube —
 * and a SECOND keypad drawn in phosphor on the tube above it, which is the one
 * the mouse could actually press. The machine grew two keypads because the two
 * halves of it could not talk:
 *
 *   · `ct/bank.ts` builds the cabinet and paints the physical pad. Its layout
 *     was twelve literals inside a closure — `kw = px(0.072)`, `k0x = W/2 - …` —
 *     visible to nothing.
 *   · `ct/atm.ts` runs the interface and hit-tests the pointer, and could not
 *     see those numbers, so it drew a pad it COULD hit-test onto the CRT and
 *     said so in its own comment: *"the prettier answer … queued as a
 *     follow-up"*.
 *
 * **AND THE OBVIOUS FIX IS A TRAP.** `ct/bank.ts:8` already imports `openAtm`
 * from `ct/atm.ts`, so publishing the layout FROM `bank.ts` and importing it
 * INTO `atm.ts` closes an import cycle — and GOTCHAS §28 records that a module
 * in a cycle can be dropped **from the built bundle only**. Dev would look
 * perfect and the ATM would not exist in the published artifact. `w41`'s
 * handoff hit the same wall trying to share `ATM_PALETTE` and stopped there.
 *
 * So this is the third module. **It imports neither of them** — only `three` —
 * and both import it. There is no cycle to close.
 *
 * WHAT LIVES HERE is everything both halves have to agree about exactly:
 * the fascia's metrics, the pad's grid, and the one piece of plumbing that
 * lets a pointer over a physical key reach the interface at all.
 */

// ── the fascia, in metres ─────────────────────────────────────────────────
//
// HOISTED OUT OF `ct/bank.ts`, where these were `M_W` / `M_TOP` / `D_TOP` and
// friends. The prose explaining WHY each number is what it is stays in
// `ct/bank.ts` beside the cabinet it describes — this is the declaration, that
// is the argument. Two of them are rulings and are recorded there as such:
// the body tone, and `bot: 0.75`, which the user gave twice.
//
// Heights are metres ABOVE THE PAVEMENT — world y is `KERB_H` plus these.
// Depths are metres BEHIND THE FACADE PLANE; the top of each panel sits deeper
// than its bottom, so every face tilts up toward you.
export const ATM_FACE = {
  /** across the frontage — every panel is this wide */
  w: 0.62,
  top: 1.58, screenBot: 1.16, keysBot: 1.04, bot: 0.75,
  dTop: 0.15, dScreenBot: 0.09, dKeysBot: 0.01, dBot: 0.15,
} as const;

/** the slant length of a panel — its height ON ITS OWN FACE, not in world y */
export function panelLen(dy: number, dd: number): number { return Math.hypot(dy, dd); }

/** the CRT panel's own height, along the rake */
export const SCREEN_H = panelLen(ATM_FACE.top - ATM_FACE.screenBot,
                                 ATM_FACE.dTop - ATM_FACE.dScreenBot);
/** the keypad shelf's own height, along its (much flatter) rake */
export const KEYS_H = panelLen(ATM_FACE.screenBot - ATM_FACE.keysBot,
                               ATM_FACE.dScreenBot - ATM_FACE.dKeysBot);

// ── the twelve keys ───────────────────────────────────────────────────────

/** the key faces, in reading order: across, then down. Twelve, three per row. */
export const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'ENT'] as const;
export const PAD_COLS = 3, PAD_ROWS = 4;

/** a key face, in metres. The size the player sees; it is not derived. */
const KEY_W = 0.072, KEY_H = 0.026;
/** the gap between columns, in metres. Also not derived — it is a look. */
const GAP_X = 0.022;

// THE VERTICAL PITCH *IS* DERIVED, AND THAT IS A FIX, NOT A TIDY-UP.
//
// It used to be a typed 0.012 gap with a typed 0.012 top inset, which asks for
//     0.012 + 4 x 0.026 + 3 x 0.012 = 0.152 m
// of shelf. The shelf is 0.1442 m. So the bottom row — `CLR 0 ENT` — ran 8 mm
// off the bottom edge of its own panel and was CLIPPED, which you can see in
// any frame of the machine: three and a bit rows of keys. Nothing checked it,
// because a keypad is not masonry and nothing sweeps it (BUILDER-BRIEF §7b).
//
// So the gap answers to the panel instead of the other way round: four key
// faces at the size they have always been, and the slack shared equally by the
// three gaps and the two margins. The keys do not change size or spacing
// across, and the pad is now centred on its shelf in both axes.
const GAP_Y = (KEYS_H - PAD_ROWS * KEY_H) / (PAD_ROWS + 1);
const GRID_W = PAD_COLS * KEY_W + (PAD_COLS - 1) * GAP_X;
const X0 = (ATM_FACE.w - GRID_W) / 2;

/** A key's rectangle as a FRACTION of the keypad panel — origin top-left, `u`
 *  to the player's right, `v` downward. Fractions rather than metres because
 *  both callers work in their own pixels: the painter in texels, the interface
 *  in the panel's own UV. One shape, two scales, no second copy of the grid. */
export interface PadCell { u: number; v: number; w: number; h: number }

const CELLS: PadCell[] = PAD_KEYS.map((_, i) => ({
  u: (X0 + (i % PAD_COLS) * (KEY_W + GAP_X)) / ATM_FACE.w,
  v: (GAP_Y + Math.floor(i / PAD_COLS) * (KEY_H + GAP_Y)) / KEYS_H,
  w: KEY_W / ATM_FACE.w,
  h: KEY_H / KEYS_H,
}));

/** every key's rectangle, in the same order as `PAD_KEYS` */
export function padCells(): readonly PadCell[] { return CELLS; }

/** which key is at this point on the keypad panel, in panel fractions?
 *  `null` off every key — the shelf between them is not a button. */
export function padKeyAtUV(u: number, v: number): string | null {
  for (let i = 0; i < CELLS.length; i++) {
    const c = CELLS[i];
    if (u >= c.u && u <= c.u + c.w && v >= c.v && v <= c.v + c.h) return PAD_KEYS[i];
  }
  return null;
}

// ── reaching the physical keys with a pointer ─────────────────────────────
//
// THE PANEL FRAMEWORK PICKS EXACTLY ONE MESH. `ct/hud.ts` hangs the live canvas
// on the mesh `surface.mesh()` names and `crosstown.ts` raycasts that same mesh,
// handing back the hit in that canvas's own pixels. The keypad is a DIFFERENT
// mesh at a DIFFERENT rake, so a pointer over it hits nothing the framework
// knows about and `hot`/`click` are never called. That is the whole reason the
// pad ended up drawn on the tube.
//
// The right home for this is a second pickable in `ScreenSurface` — one field
// in `ct/hud.ts` and one line in `crosstown.ts`. **`ct/hud.ts` is item 143 and
// another builder is holding it**, and BUILDER-BRIEF §9 says do not edit a file
// outside your item. So the machine extends its own reach instead, and the
// follow-up to hoist this into the framework is in the handoff note.
//
// `Object3D.raycast` IS THE SUPPORTED SEAM — three.js calls it per object and
// takes whatever it pushes; item 138 leans on the same mechanism from the other
// direction, to prune. The CRT mesh answers for the keypad too: its own face
// first, and only if the ray missed it does it ask the shelf.
//
// THE KEYPAD'S HIT COMES BACK AS CANVAS ROWS BELOW THE TUBE, and that is a real
// coordinate space rather than a sentinel. The panel canvas is 300 px across
// 0.62 m of face — 484 px/m — so the shelf, measured in those same pixels, is
// `H * KEYS_H / SCREEN_H` ≈ 70 rows tall. Extending the canvas space downward
// puts the physical pad at the scale and the place it physically is. Nothing is
// ever PAINTED there — the tube is only `H` tall — so the strip is hit-test
// only, and `ct/atm.ts` says so where it reads it.
export const PAD_V_SCALE = KEYS_H / SCREEN_H;

// A SCENE-WIDE RAYCAST MUST NOT SEE THIS. `crosstown.ts`'s spot selection and
// `canSee` traverse everything, and a CRT that reports hits from a mesh 20 cm
// below itself would offer and occlude in the wrong place. The delegation is
// live only while the machine is focused, which is the only time anything picks
// the screen at all. `ct/atm.ts` raises it on open and drops it on close — and
// on close it must drop even if the close threw, so it is cleared in `onClose`.
let padLive = false;
export function setPadPickable(on: boolean): void { padLive = on; }
/** for a harness: is the delegation up right now? */
export function padPickable(): boolean { return padLive; }

/**
 * Make `screen` answer for `keys` as well, while the machine is focused.
 * Called once, by whoever built the pair.
 */
export function linkPadPick(screen: THREE.Mesh, keys: THREE.Mesh): void {
  const base = THREE.Mesh.prototype.raycast;
  screen.raycast = function (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
    const n = intersects.length;
    base.call(this, raycaster, intersects);
    // The tube itself was hit, or nobody is standing at the machine. Either way
    // the shelf is not this ray's business.
    if (!padLive || intersects.length > n) return;
    const shelf: THREE.Intersection[] = [];
    base.call(keys, raycaster, shelf);
    for (const h of shelf) {
      if (!h.uv) continue;
      // the panel's v runs 0 at its BOTTOM edge; distance from the top is 1 - v
      h.uv = new THREE.Vector2(h.uv.x, -(1 - h.uv.y) * PAD_V_SCALE);
      intersects.push(h);
    }
  };
}

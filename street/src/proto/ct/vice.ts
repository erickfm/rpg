import * as THREE from 'three';
import { pixTex, dither, declareSurface, slabTex } from './paint';
import { facadeTex, masonry, SHOP_BAND_H, SHOP_MULT } from './tex-world';
import { type BldSpec } from './civic';
import { type AABB } from '../fp';

// SEVENS and HOTEL ORPHEUS — the two buildings at the far end of the side
// street, and the ONLY TWO IN THE WORLD THAT ARE LIGHT SOURCES rather than lit
// surfaces. That sentence is the whole design and everything below serves it.
//
// They were split out of ct/street.ts for the same reason the library and the
// church went into ct/civic.ts: they share no vocabulary with the shopfront
// system. A barber and a deli are a brick box with a painted band and that is
// right for them. Built out of those parts, a casino and a hotel came out
// wearing a barber's clothes, which is what the user was looking at when they
// said "these building are meant to be some of the most insane".
//
// street.ts owns WHERE they stand — the NORTH2 roster and the cursor that walks
// it. This file owns what they look like.
//
// ── HOW A LIGHT SOURCE IS BUILT IN A WORLD WITH NO LIGHTS ─────────────────
//
// Everything here is unlit MeshBasicMaterial, so nothing actually emits. Three
// mechanisms do the work instead, and none of them needed a change to a file I
// do not own:
//
//  1. `props.dimWorld` grades the whole block down after dark, and it SKIPS any
//     material flagged `transparent`. So every bulb, tube and spill here is
//     transparent, which means the street falls away around them at night while
//     they hold their brightness. They do not get brighter; everything else
//     gets darker, and that reads as light.
//  2. `fog: false` on the lit parts only. The far end of the side street
//     dissolves into haze at 40 m, so neon that refuses to is read as neon —
//     the same reasoning the rooftop pylon already carried. The structure it is
//     mounted on DOES take fog, so the signs hang in the murk.
//  3. The night curve is read, not written. `scene.background` carries the sky
//     colour and the sim updates it every frame; its luminance runs from ~0.30
//     at noon to ~0.011 after 22:00 (measured, not guessed). A `mesh.onBefore
//     Render` hook reads it and drives the chase, the tube brightness and the
//     pavement spill from it. That is a read of a value that is already there —
//     no new export, no signature change, and in particular NO edit to
//     ct/props.ts, which the desk asked to be consulted about.
//
// Worth recording why `props.lit` is NOT used for the spill even though the
// brief suggested it: `lit()` registers an object to CATCH lamplight and take
// amber from the nearest lamp head. It is for things standing in the street,
// which is the opposite problem. A casino does not catch light.
//
// ── AND IT IS STILL 1997, AND PAST IT ─────────────────────────────────────
//
// Refitted in 1984 and losing money since. That is a specific look and it is
// mostly subtraction: grime streaking down from the gold, one dead bulb in the
// chase that never lights, one glazing panel replaced in a bronze that does not
// match, and a VACANCY sign that has been on for a long time.
/**
 * WHERE THE PAINTED ENTRANCE IS. World x of the door on each of the two side-
 * street facades, and the only place either number is written down.
 *
 * It used to be written twice: once here as the `u` fraction the band painter
 * strokes the gold portal at, and once in each room's `DoorDecl.face.x`. Two
 * authorings of one fact, which is the class of defect that already produced
 * three false-passing checks in scripts/G-*.mjs — a coupling that is silent when
 * it breaks. Walk up to the facade and the prompt comes from a metre to your
 * left, and nothing fails.
 *
 * The obvious fix is the other direction — have the painter ask ct/doors.ts for
 * the declaration. That one is NOT safe yet, and the reason is worth keeping:
 * vice.ts paints during buildStreet, which runs before any `int-*.ts` module is
 * evaluated, so `doorPointFor` here would read the glob mid-initialisation —
 * exactly the module-order hazard A traced in 709ddfed. This direction has no
 * cycle at all: both rooms already import `tube` from this file, so vice.ts is
 * already upstream of them. When doors.ts is split so its lookup globs nothing,
 * this can invert and the rooms become the authority.
 */
export const VICE_DOOR_X: Record<string, number> = {
  'SEVENS': 51.29,
  'HOTEL ORPHEUS': 39.51,
};

/**
 * That world x as the band texture's u. Side-street buildings put the facade on
 * the box's -z face and that face's u runs from HIGH x to low x, so texel 0 is
 * the EAST end of the building — hence `x1 - doorX` and not `doorX - x0`.
 */
const doorUOf = (b: BldSpec, x0: number) => {
  const doorX = VICE_DOOR_X[b.nm];
  // Loud on a missing key, because the silent version is genuinely nasty: an
  // unmapped name gives `undefined`, so `doorU` is NaN, `Math.round(NaN * W)` is
  // NaN, and every `fillRect` for the entrance draws NOTHING. You would get a
  // facade with no door painted on it, no error anywhere, and an [E] prompt
  // coming off blank panelling.
  //
  // It cannot fire today — `VICE` holds exactly the two names this map has — so
  // this is for whoever adds a third. `placeShell` dispatches with
  // `nm === 'SEVENS' ? sevensBand : orpheusBand`, so a new building falls to
  // the hotel painter by default and would hit exactly this.
  if (doorX === undefined) throw new Error(`ct/vice.ts: no VICE_DOOR_X for "${b.nm}" — add its door x beside the other two`);
  return (x0 + b.w - doorX) / b.w;
};

/**
 * Neon drawn as a TUBE, not a stripe: three passes over one letterform — the
 * dark glass casing, the phosphor glow through it, and the hot core. A painted
 * stripe is one colour; a tube is all three at once.
 *
 * Exported because ct/int-casino.ts uses it too. The user asked that walking in
 * from that facade should feel like the same building, and the surest way to
 * guarantee ONE signage hand is for both sides to run the same painter rather
 * than to keep two that merely resemble each other.
 */
/**
 * Paint ONE layer with hard texel edges.
 *
 * Canvas 2D anti-aliases text and there is no flag that turns it off, so a
 * glyph arrives as a field of part-alpha pixels. `NearestFilter` — which this
 * world sets on every texture — then faithfully preserves those intermediates
 * as fat soft texels, which is the blur the user reported on the marquee: "in a
 * world where every other letter is hard texels".
 *
 * It was NOT the two obvious causes and both were checked first. `pixTex`
 * already sets `magFilter = NearestFilter` and `minFilter =
 * NearestMipmapNearestFilter`, and the canvas is not undersized — 96 texels
 * across a 6.0 m sign is 16 px/m, the block's own density. The softness is
 * baked into the texture before filtering ever sees it.
 *
 * Painting into an offscreen canvas and snapping alpha to 0 or 255 before
 * compositing gives a glyph made of whole texels. One layer at a time, because
 * thresholding the finished composite would only harden the outer edge and
 * leave the casing/tube/core boundaries inside the letter still blended.
 *
 * The COLOUR has to be flattened too, and measuring is what showed it. Snapping
 * alpha alone took one line of the marquee from 262 distinct colours to 45, not
 * to the four it is drawn with: `getImageData` hands back premultiplied values,
 * so a pixel the anti-aliaser wrote at alpha 60 reads as a darkened RGB, and
 * promoting its alpha to 255 keeps that darkening as a fringe of near-colours.
 * A layer is one colour by construction, so it is written back flat.
 */
/**
 * HOW FAR AN ENTRANCE LEAF STANDS OPEN — one number, for the whole world.
 *
 * The user, twice, about two different buildings: *"jail interior front door
 * also looks bad and doesnt match outside"* and *"inside door of the church is
 * still mismatched from the doors outside."* And once more, about the library,
 * in the words that name the fault exactly: *"the door reads as SHUT-BUT-OPEN —
 * the leaf is swung in with a dark void behind it"* (quoted at
 * `ct/int-pawn.ts:177`).
 *
 * IT WAS NEVER ONE BUILDING'S BUG. Measured in the built world by
 * `scripts/probes/w65-leaf-angles.mjs`, every interior front door in CROSSTOWN
 * stood ajar while its street face was shut, at SIX different angles nobody
 * ever chose together:
 *
 *     bank 31.5°   casino 31.5°   church 31.5°   jail 31.5°
 *     hotel 28.6°  library 48.7°  pawn 77.3°  ·  the kit's leaf 48.7°
 *
 * `int-jail.ts`'s own comment said its 0.55 was *"the casino's and the bank's"*
 * — copied from a convention, not chosen for the jail. That is one mistake
 * authored eight times, which is the shape `DoorDecl.leaf` already exists to
 * stop: *"a single-leaf room door in a double-door building becomes IMPOSSIBLE
 * rather than something a builder has to remember."*
 *
 * THE STREET FACE IS THE TRUTH, and that is a decision rather than a
 * measurement: the player sees the exterior first, from further away and more
 * often, and nine of the twelve shopfronts have no door GEOMETRY at all — the
 * door is painted into the facade, shut, and cannot be anything else. The two
 * buildings that DO hang real leaves on the street (the jail, the bodega) hang
 * them shut. So `0` is not a taste call; it is the only value that can agree
 * with what is already outside.
 *
 * `leafPair` takes NO angle argument because of this. A caller that cannot pass
 * one cannot copy the wrong one, which is the whole reason the eight above
 * agree on nothing.
 */
// Typed `number`, not left to infer the literal `0`: every consumer does real
// trigonometry with it (`ct/int-jail.ts` places its pull handles along the leaf
// with `cos`/`sin`), and a literal type invites a reader — or a linter — to
// treat those as dead arithmetic and simplify them away. Then the day this
// value changes, the handles stay where a shut door put them.
export const LEAF_AJAR: number = 0;

/**
 * THE DARK BEHIND A SHUT DOOR — one plane across the whole opening, behind the
 * leaves.
 *
 * A DOOR THAT SHUTS NEEDS SOMETHING BEHIND IT, and until the leaves shut,
 * nothing did. Worker sixty measured it and filed it: *"the interior doorway
 * opens onto nothing. Beyond the jambs there is no mesh at all, so the gap
 * between the ajar leaves shows a flat pale void … whichever way that goes,
 * the opening wants something behind it."* (`notes/w60-jail-door-state.md`.)
 *
 * It was ALREADY VISIBLE in the first frames of the shut doors: `gap` is
 * documented as *"the shadow line between the leaves"*, and with the leaves
 * swung apart it never had to be one — but a shut pair leaves that 2·gap strip
 * standing open onto the void, so the jail's and the church's meeting stiles
 * photographed as a bright grey-white slit down the middle of the door. The
 * 0.06 m above the leaves (`DH - 0.06`) is the same hole lying down.
 *
 * So the gap gets what it always claimed to be. Nobody's leaf width changes —
 * that would be *"folding two rooms into one helper is not a licence to quietly
 * change one of their leaf widths by a centimetre"*, which `leafPair` already
 * refuses to do.
 *
 * The hotel is the proof this is the right object: it is the one room that
 * already had a centre mullion (`ct/int-hotel.ts`, a 0.05 m brass box), and it
 * is the one room whose shut doors photographed with no slit at all.
 *
 * 0.012 m behind the leaf plane: far enough that no depth test has to break a
 * tie (GOTCHAS 6, and `notes/w59-jail-door.md` is what two coplanar opaque
 * faces cost), near enough to stay inside the reveal.
 */
export function doorRebate(
  put: (m: THREE.Mesh, x: number, y: number, z: number) => unknown,
  dAt: number, DW: number, DH: number, zFace: number, behind = 0.012,
): void {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH),
    // DoubleSide because two of the six doors this serves hang their leaves on
    // the OUTER face of the shell rather than the inner one, so which side of
    // this plane the player stands on is not a fact this function is told.
    // A flat colour has no handedness, so GOTCHAS 10's mirror does not apply.
    new THREE.MeshBasicMaterial({ color: 0x15151a, side: THREE.DoubleSide }));
  put(m, dAt, DH / 2, zFace + behind);
}

/**
 * A PAIR OF DOOR LEAVES, and the MIRROR APPLIED ONCE TO A WHOLE LEAF.
 *
 * The user: *"the LEFT leaf is reversed"* on the SEVENS entrance. Measured the
 * four things that must agree per leaf, one at a time, and three of them were
 * already right — which is exactly why a mirrored leaf is hard to see:
 *
 *   HINGE EDGE  right — `hx = dAt + sx * DW / 2`, each leaf on its own outer jamb
 *   SWING       right — both centres offset toward the middle and into the room
 *                       by the same `sin(open)`, so neither sweeps the frame,
 *                       the wall or the other leaf
 *   FACE        right — the plane normal after `rotation.y` is `(sin t, 0, cos t)`
 *                       and both come out +z, toward the street
 *   HANDLE      WRONG on one leaf
 *
 * The pull is drawn at the +u edge of the leaf texture. A `PlaneGeometry` puts
 * u = 1 at local +x, and after `rotation.y = -sx * open` the local +x axis maps
 * to world `(cos open, 0, -sin open)` — a POSITIVE x component for BOTH leaves.
 * So the +u edge always lies on the +x side, while the free edge is the side
 * away from the hinge, which is `-sx`. Those agree only when `sx = -1`. For the
 * other leaf, u = 1 landed exactly ON the hinge: measured, the handle edge sat
 * 0 m from the hinge and the blank edge sat `LW * cos(open)` away from it.
 *
 * THE FIX IS ONE RULE, NOT A FLIPPED SIGN: `scale.x = -sx` mirrors the ENTIRE
 * leaf — geometry, texture, handle, face — once, for the leaf that needs it. A
 * hand-flip on the handle alone is how you get three of four right, which is the
 * state this was already in. GOTCHAS 41: verify BOTH sides of anything mirrored.
 *
 * It is here, in the shared file, because the hotel's pair was authored by the
 * same hand with the same arithmetic and had the same fault. One rule, one place,
 * two buildings — the same reason `tube` and `hardLayer` live here.
 *
 * `zFace` is the z of the door plane; the leaves hang just inside it. `gap` is
 * the shadow line between the leaves, per building.
 *
 * THE SWING IS `LEAF_AJAR` AND IS NOT A PARAMETER — see its declaration above
 * for the eight disagreeing angles that cost.
 */
export function leafPair(
  put: (m: THREE.Mesh, x: number, y: number, z: number) => unknown,
  mat: THREE.Material, dAt: number, DW: number, DH: number,
  zFace: number, who: string, gap: number,
): void {
  const open = LEAF_AJAR;
  // the shadow line `gap` promises, and the dark over the head — see doorRebate
  doorRebate(put, dAt, DW, DH, zFace);
  // `gap` is the shadow line between the two leaves, and it comes IN rather than
  // being fixed here: the casino was built at 0.03 and the hotel at 0.04, and
  // folding two rooms into one helper is not a licence to quietly change one of
  // their leaf widths by a centimetre.
  const LW = DW / 2 - gap;
  for (const sx of [-1, 1] as const) {
    const hx = dAt + sx * DW / 2;                    // hinge on its own outer jamb
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(LW, DH - 0.06), mat);
    leaf.rotation.y = -sx * open;
    leaf.scale.x = -sx;                              // THE ONE MIRROR, whole leaf
    const cx = hx - sx * Math.cos(open) * LW / 2;
    put(leaf, cx, (DH - 0.06) / 2, zFace - Math.sin(open) * LW / 2);

    // A leaf that looks right at rest can still be wrong, and this is the
    // property the bug broke: the HANDLE edge must be the FREE edge, i.e.
    // farther from the hinge than the leaf's other edge. Derived from the same
    // numbers rather than eyeballed, and it throws rather than warning, because
    // a warning in a build is a check nobody watches (GOTCHAS 27).
    const uDir = leaf.scale.x * Math.cos(leaf.rotation.y);      // world x of local +x
    const handleX = cx + uDir * LW / 2;
    const blankX = cx - uDir * LW / 2;
    if (Math.abs(handleX - hx) <= Math.abs(blankX - hx)) {
      throw new Error(`[${who}] door leaf sx=${sx}: the handle is on the HINGE edge `
        + `(handle ${Math.abs(handleX - hx).toFixed(3)} m from the hinge, blank edge `
        + `${Math.abs(blankX - hx).toFixed(3)} m). The leaf mirror is inverted.`);
    }
  }
}

export function hardLayer(
  g: CanvasRenderingContext2D, colour: string, paint: (h: CanvasRenderingContext2D) => void,
) {
  const w = g.canvas.width, h = g.canvas.height;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const o = off.getContext('2d')!;
  paint(o);
  const d = o.getImageData(0, 0, w, h);
  const px = d.data;
  const hex = colour.replace('#', '');
  const cr = parseInt(hex.slice(0, 2), 16), cg = parseInt(hex.slice(2, 4), 16), cb = parseInt(hex.slice(4, 6), 16);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] >= 128) { px[i] = cr; px[i + 1] = cg; px[i + 2] = cb; px[i + 3] = 255; }
    else px[i + 3] = 0;
  }
  o.putImageData(d, 0, 0);
  g.drawImage(off, 0, 0);
}

export function tube(
  g: CanvasRenderingContext2D, s: string, x: number, y: number,
  px: number, col: string, core = '#fff6e0', casing = '#1e1a24',
) {
  const setup = (h: CanvasRenderingContext2D) => {
    h.font = `bold ${px}px monospace`;
    h.textAlign = 'center'; h.textBaseline = 'middle';
    h.lineJoin = 'round'; h.lineCap = 'round';
  };
  hardLayer(g, casing, (h) => {
    setup(h); h.strokeStyle = casing; h.lineWidth = Math.max(3, px * 0.30); h.strokeText(s, x, y);
  });
  hardLayer(g, col, (h) => {
    setup(h); h.strokeStyle = col; h.lineWidth = Math.max(2, px * 0.17); h.strokeText(s, x, y);
  });
  hardLayer(g, core, (h) => { setup(h); h.fillStyle = core; h.fillText(s, x, y); });
}

/**
 * ── TEXT THAT CANNOT OVERFLOW ITS SIGN, AND THROWS WHEN IT WOULD ──────────
 *
 * `SEVENS` on the facade read `EVEN`, and that is the user's THIRD complaint
 * about this frontage. The cause is one line: the cap height was taken from the
 * panel's HEIGHT — `H * 0.30` on a 92 x 103 canvas — and the panel is TALLER
 * THAN IT IS WIDE. Measured, bold monospace inks 0.602 px of advance per
 * character plus 0.62 px for the last glyph, so six letters at 31 px ink 112
 * texels into a 92-texel canvas: 10 texels fall off each end, and at that size
 * ten texels is very nearly a whole letter. The building's own name was
 * unreadable and nothing in the code said so.
 *
 * Tightening the tracking does NOT rescue it, and that was worth measuring
 * before designing around it: the INK of a bold monospace glyph is 0.62 px
 * against an advance of 0.602 px (scripts/probes/w46-glyph-ink.mjs), so the
 * letters already touch and there is no slack to take out. On a sign this wide
 * the size has to come from the width the sign actually has.
 *
 * So the size is DERIVED, never chosen. Measure the whole string once at a
 * reference size, scale linearly to the width available, and the string fits by
 * construction — at any length, including whatever copy somebody writes next.
 *
 * `tube` STROKES before it fills, at `lineWidth = 0.30 * px`, which puts
 * 0.15 * px of casing OUTSIDE the ink at each end. That is in the arithmetic,
 * because leaving it out is how a "fitted" string still loses its casing.
 *
 * AND IT THROWS RATHER THAN SHRINKING FOREVER. The second half of this item was
 * the marquee's `$2 BLACKJACK  24 HRS`, filed as clipped and MEASURED NOT TO BE
 * — 72.2 texels inside a 96-texel canvas, 12 texels of margin each side. It is
 * not clipped, it is under-resolved: twenty characters at 6 px cap height gives
 * a 3.6-texel glyph, and `hardLayer`'s alpha>=128 snap then keeps or drops each
 * 1-texel stem more or less at random. Illegible and clipped look identical
 * from the street, and a fitter that silently shrinks would have turned defect 1
 * into defect 2. `minPx` is the floor below which a string is mush; crossing it
 * means the copy is too long for the sign, which is a thing a person must fix,
 * so it is an error and not a smaller number.
 */
const FIT_REF = 100;         // metrics are linear in font size; measure once, scale

/** the largest bold-monospace size at which `s` inks inside `targetW` texels */
export function fitPx(
  g: CanvasRenderingContext2D, s: string, targetW: number, strokeFrac = 0.30,
): number {
  const prev = g.font;
  g.font = `bold ${FIT_REF}px monospace`;
  const m = g.measureText(s);
  const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  g.font = prev;
  return Math.floor((targetW * FIT_REF) / (ink + strokeFrac * FIT_REF));
}

/** `tube`, sized to fill `targetW` exactly. Throws if that would be illegible. */
export function fitTube(
  g: CanvasRenderingContext2D, s: string, cx: number, cy: number, targetW: number,
  col: string, core?: string, casing?: string, minPx = 8, maxPx = 999,
): number {
  const px = Math.min(maxPx, fitPx(g, s, targetW, 0.30));
  if (px < minPx) {
    throw new Error(`ct/vice.ts: "${s}" (${s.length} chars) fits ${targetW} texels only at `
      + `${px} px, under the ${minPx} px this world can still read. Shorten the copy or `
      + `give the sign more width — do not draw it small.`);
  }
  tube(g, s, cx, cy, px, col, core, casing);
  return px;
}

/** flat changeable copy — plastic letters on a marquee, not neon. Same rule. */
export function fitFlat(
  g: CanvasRenderingContext2D, s: string, cx: number, cy: number, targetW: number,
  col: string, minPx = 8, maxPx = 999,
): number {
  const px = Math.min(maxPx, fitPx(g, s, targetW, 0));
  if (px < minPx) {
    throw new Error(`ct/vice.ts: marquee copy "${s}" fits ${targetW} texels only at ${px} px, `
      + `under the ${minPx} px this world can still read. Shorten it.`);
  }
  hardLayer(g, col, (h) => {
    h.font = `bold ${px}px monospace`;
    h.textAlign = 'center'; h.textBaseline = 'middle'; h.fillStyle = col;
    h.fillText(s, cx, cy);
  });
  return px;
}

/**
 * WIDE-TRACKED CAPS, drawn one letter at a time.
 *
 * A category line — CASINO over SEVENS — is short, and a short word set solid
 * leaves a sign looking half-used. Real signs letterspace it across the full
 * width instead of growing it, because the eye reads the CATEGORY as subordinate
 * to the NAME however wide it is set. Per-character placement is the only way
 * to get it: canvas has no letter-spacing that survives `hardLayer`.
 */
export function track(
  g: CanvasRenderingContext2D, s: string, cx: number, cy: number,
  span: number, px: number, col: string,
) {
  const n = s.length;
  const pitch = n > 1 ? span / (n - 1) : 0;
  hardLayer(g, col, (h) => {
    h.font = `bold ${px}px monospace`;
    h.textAlign = 'center'; h.textBaseline = 'middle'; h.fillStyle = col;
    for (let i = 0; i < n; i++) h.fillText(s[i], cx + (i - (n - 1) / 2) * pitch, cy);
  });
}

export function buildVice(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  solid: (b: AABB) => AABB;
  KERB_H: number;
}) {
  const { scene, flat, solid, KERB_H } = o;

  const GOLD = '#d8a83a', GOLD_D = '#8a6a22', RED = '#8e1f2a', RED_D = '#5a1520';
  const BRONZE = '#6a5638', GLASS_LIT = '#e8c88a';

  // ── the night driver ──────────────────────────────────────────────────
  //
  // One hook, attached to a mesh that is always drawn with these buildings, and
  // guarded on the renderer's own frame counter so it runs once per frame no
  // matter how many meshes carry it.
  type Tick = (night: number, t: number) => void;
  const ticks: Tick[] = [];
  let lastFrame = -1;
  const driver = (renderer: THREE.WebGLRenderer, sc: THREE.Scene) => {
    const f = renderer.info.render.frame;
    if (f === lastFrame) return;
    lastFrame = f;
    // ASK, do not infer. `props.ts` publishes what it already computes on
    // `scene.userData` (`de492304`), so this reads the number instead of
    // guessing it from the sky.
    //
    // The guess was wrong in exactly the weather the brief cares about. It read
    // `scene.background` luminance, and props lerps the sky toward RAIN_SKY when
    // it rains — so a downpour LIFTED the value and the night factor fell 1.000
    // → 0.865, putting 12.5% LESS glow on wet asphalt. Backwards, against a brief
    // whose governing sentence is "throwing colour onto wet asphalt".
    //
    //   23:00 dry night   background 0.0053   published night 1.000
    //   00:00 WET night   background 0.0476   published night 1.000   ← 9x lift,
    //                                                                   no move
    //
    // The fallback is the old sky read, kept deliberately: these two buildings
    // are the only light sources in the world, and if the publisher ever goes
    // away they should degrade to a slightly wrong glow rather than to no glow
    // at all. It is not dead code, it is the failure mode I want.
    const pub = (sc.userData as { nightFactor?: number } | undefined)?.nightFactor;
    let night: number;
    if (typeof pub === 'number') {
      night = Math.max(0, Math.min(1, pub));
    } else {
      const bg = sc.background as THREE.Color | null;
      // luminance → night, calibrated off the real sky curve: 0.30 at noon,
      // 0.24 at 18:00, 0.06 at 20:00, 0.011 by 22:00
      const lum = bg ? 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b : 0;
      night = Math.max(0, Math.min(1, (0.20 - lum) / 0.16));
    }
    const t = performance.now() / 1000;
    for (const fn of ticks) fn(night, t);
  };

  // ── the neon vocabulary: TUBES, not stripes ───────────────────────────
  //
  // A painted stripe is one colour. A tube is three things at once: the dark
  // glass casing, the phosphor glow through it, and the hot core with a
  // highlight where the glass catches the light. Drawn as three passes over the
  // same letterform — a thick dark stroke, a mid stroke in the neon colour, a
  // thin near-white fill — which is what separates neon from a painted sign.
  const tubeText = tube;

  /** a run of bulb sockets, evenly spaced, as texel centres */
  const sockets = (from: number, to: number, pitch: number) => {
    const n = Math.max(2, Math.round((to - from) / pitch));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  };

  // grime: vertical streaks weeping down from whatever is above them. The one
  // mark that says "and nobody has washed it since 1984".
  const grime = (g: CanvasRenderingContext2D, W: number, y0: number, h: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = Math.round(((i * 37) % W));
      const len = 3 + ((i * 13) % Math.max(4, h));
      g.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.20)' : 'rgba(0,0,0,0.12)';
      g.fillRect(x, y0, 1, len);
    }
  };

  // ═══ a FLANK is not a colour ═══════════════════════════════════════════
  //
  // The user, twice: "this looks bad because the front of the bank doesnt match
  // the side fix this". Every shell on the block got its own masonry on the
  // sides and returns; these two did not, because they were split into this file
  // before that work landed and it did not travel with them. What was here was
  // `endM` — one flat 0x53382e on three faces of both boxes, against a painted
  // facade. D measured 12 such faces and could not fix them: this file is mine.
  //
  // Same hand as `facadeTex` deliberately — `masonry` at the block's px/m, real
  // courses, weathered from the top — so a flank reads as the same building seen
  // from the side rather than as a different, cheaper one. `baseY` is what keeps
  // the courses of the upper box continuous with the band below it, so the
  // brick does not restart at the shopfront line.
  const flankTex = (brick: string, wM: number, hM: number, baseY: number) => {
    const s = masonry(wM, hM, baseY);
    const W = s.W, H = s.H;
    return s.paint((g) => {
      g.fillStyle = brick; g.fillRect(0, 0, W, H);
      s.courses(g);
      // A flank weathers from the parapet down — rain carries the soot off the
      // roof and it never reaches the bottom third. Without this the wall reads
      // as new brick, which on this pair is the wrong century.
      const soot = Math.max(1, Math.round(H * 0.42));
      for (let y = 0; y < soot; y++) {
        g.fillStyle = `rgba(28,22,18,${(0.30 * (1 - y / soot)).toFixed(3)})`;
        g.fillRect(0, y, W, 1);
      }
      grime(g, W, Math.round(H * 0.10), Math.max(4, Math.round(H * 0.34)), Math.max(8, Math.round(W / 6)));
      dither(g, W, H, 260);
    });
  };

  // ═══ the casino's shopfront band ═══════════════════════════════════════
  //
  // The entrance is drawn where VICE_DOOR_X says it is, which is the same number
  // ct/int-casino.ts's [E] spot stands at because that file reads it from here.
  const sevensBand = (b: BldSpec, x0: number) => {
    const s = masonry(b.w, SHOP_BAND_H, 0, SHOP_MULT);
    const { W, H } = s;
    const yOf = (wy: number) => Math.round(((SHOP_BAND_H - wy) / SHOP_BAND_H) * H);
    const doorU = doorUOf(b, x0);
    return s.paint((g) => {
      // the 1984 refit: polished red panelling, not brick
      g.fillStyle = RED_D; g.fillRect(0, 0, W, H);
      g.fillStyle = RED; g.fillRect(0, yOf(3.9), W, yOf(0.55) - yOf(3.9));
      // vertical joints in the panelling
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let x = 0; x < W; x += 24) g.fillRect(x, yOf(3.9), 1, yOf(0.55) - yOf(3.9));
      // black granite base — the one honestly expensive material left
      g.fillStyle = '#1b1a1e'; g.fillRect(0, yOf(0.55), W, H - yOf(0.55));
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, yOf(0.55), W, 1);

      // ── the glazing: MIRRORED bronze, deliberately ──
      //
      // Not "lit from within so you see a lobby": you cannot see into this one,
      // and that is the point — it is why ct/int-casino.ts has no window in its
      // front wall. A casino does not let you see the floor from the street and
      // it does not let the floor see out. Bronzed mirror glass, 1984's
      // favourite material, reflecting the sky and the street rather than
      // showing anything behind it.
      const gy0 = yOf(3.25), gy1 = yOf(0.6);
      const bays = 7;
      for (let i = 0; i < bays; i++) {
        const x0 = Math.round(4 + (i * (W - 8)) / bays), x1 = Math.round(4 + ((i + 1) * (W - 8)) / bays);
        // the mismatched replacement panel: bay 4 was broken and the glass that
        // came back is greener and flatter than the rest of the run
        const swap = i === 4;
        const top = swap ? '#5c6a52' : '#7a6234';
        const bot = swap ? '#3c4636' : '#4a3a20';
        for (let y = gy0; y < gy1; y++) {
          const k = (y - gy0) / (gy1 - gy0);
          g.fillStyle = k < 0.42 ? top : bot;
          g.fillRect(x0, y, x1 - x0, 1);
        }
        // the sky, raked across the top of every pane — what makes mirror glass
        // read as mirror rather than as brown paint
        g.fillStyle = swap ? 'rgba(200,215,205,0.30)' : 'rgba(215,205,175,0.34)';
        for (let j = 0; j < 9; j++) g.fillRect(x0 + 1 + j, gy0 + 2 + j, Math.max(2, (x1 - x0) - 10 - j), 1);
        // bronze mullion
        g.fillStyle = BRONZE; g.fillRect(x1 - 2, gy0 - 2, 3, gy1 - gy0 + 4);
      }
      g.fillStyle = BRONZE;
      g.fillRect(2, gy0 - 3, W - 4, 3); g.fillRect(2, gy1, W - 4, 3);
      g.fillRect(2, gy0 - 3, 3, gy1 - gy0 + 6); g.fillRect(W - 5, gy0 - 3, 3, gy1 - gy0 + 6);

      // ── the entrance: gold portal, doors set back in a reveal ──
      const dc = Math.round(doorU * W), dw = s.at(1.5);
      g.fillStyle = '#141118'; g.fillRect(dc - dw, gy0 - 3, dw * 2, H - (gy0 - 3));
      // the reveal, so the doors are IN something
      g.fillStyle = GOLD_D; g.fillRect(dc - dw - 4, gy0 - 6, dw * 2 + 8, 5);
      g.fillStyle = GOLD; g.fillRect(dc - dw - 4, gy0 - 6, dw * 2 + 8, 2);
      for (const sx of [-1, 1]) {
        g.fillStyle = GOLD_D; g.fillRect(dc + sx * dw - (sx > 0 ? 4 : 0), gy0 - 6, 4, H - gy0 + 6);
        g.fillStyle = GOLD; g.fillRect(dc + sx * dw - (sx > 0 ? 3 : 0), gy0 - 6, 2, H - gy0 + 6);
      }
      // two leaves of bronzed glass with long gold pulls
      for (const sx of [-1, 1]) {
        const lx = dc + sx * (dw * 0.5) - dw * 0.42;
        g.fillStyle = '#3a3020'; g.fillRect(lx, gy0, Math.round(dw * 0.84), gy1 - gy0 + s.at(0.4));
        g.fillStyle = 'rgba(232,200,138,0.16)'; g.fillRect(lx + 1, gy0 + 1, Math.round(dw * 0.84) - 2, 10);
        g.fillStyle = GOLD; g.fillRect(lx + (sx > 0 ? 2 : Math.round(dw * 0.84) - 4), gy0 + 12, 2, s.at(1.0));
      }

      // ── the fascia over the glazing, and the grime on it ──
      const fy = yOf(4.2), fy1 = yOf(3.3);
      g.fillStyle = GOLD_D; g.fillRect(0, fy, W, fy1 - fy);
      g.fillStyle = GOLD; g.fillRect(0, fy + 2, W, Math.max(2, (fy1 - fy) - 6));
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(0, fy + 2, W, 1);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, fy1 - 3, W, 3);
      // a row of small bulbs along the fascia — repetition is the vocabulary
      for (const bx of sockets(6, W - 6, 9)) {
        g.fillStyle = '#f6e2a2'; g.fillRect(Math.round(bx) - 1, fy + 5, 3, 3);
        g.fillStyle = 'rgba(246,226,162,0.30)'; g.fillRect(Math.round(bx) - 2, fy + 4, 5, 5);
      }
      grime(g, W, fy1, s.at(1.6), 42);
      grime(g, W, yOf(0.62), s.at(0.5), 18);
      dither(g, W, H, 320);
    });
  };

  // ═══ the hotel's shopfront band ════════════════════════════════════════
  //
  // The opposite decision to the casino's glass, and for the same reason it is
  // the right one: you SHOULD see the lobby. ct/int-hotel.ts has a window in
  // its front wall, the room behind it is warm, and a hotel wants you to see
  // that there is somewhere to sit. Entrance from VICE_DOOR_X, as the casino's.
  const orpheusBand = (b: BldSpec, x0: number) => {
    const s = masonry(b.w, SHOP_BAND_H, 0, SHOP_MULT);
    const { W, H } = s;
    const yOf = (wy: number) => Math.round(((SHOP_BAND_H - wy) / SHOP_BAND_H) * H);
    const doorU = doorUOf(b, x0);
    return s.paint((g) => {
      // rusticated stone base — this building is older than its refit and the
      // ground floor is the part that still says so
      g.fillStyle = '#6e685c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7a7466';
      for (let y = yOf(4.2); y < yOf(0.4); y += 11) g.fillRect(0, y, W, 9);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = yOf(4.2); y < yOf(0.4); y += 11) g.fillRect(0, y + 9, W, 2);
      g.fillStyle = '#4e4a42'; g.fillRect(0, yOf(0.4), W, H - yOf(0.4));

      // ── the lobby, seen through the glass ──
      const gy0 = yOf(3.3), gy1 = yOf(0.7);
      const bays = 6;
      for (let i = 0; i < bays; i++) {
        const x0 = Math.round(5 + (i * (W - 10)) / bays), x1 = Math.round(5 + ((i + 1) * (W - 10)) / bays);
        // warm interior, brighter deep in the room than at the glass
        for (let y = gy0; y < gy1; y++) {
          const k = (y - gy0) / (gy1 - gy0);
          g.fillStyle = k < 0.30 ? '#c8a468' : k < 0.72 ? GLASS_LIT : '#8a6c44';
          g.fillRect(x0, y, x1 - x0, 1);
        }
        // the reflection of the street ON the glass, over the top third — glass
        // is both a window and a mirror and drawing only one of them is what
        // makes a shopfront read as a hole
        g.fillStyle = 'rgba(150,170,180,0.26)';
        for (let j = 0; j < 7; j++) g.fillRect(x0 + 1, gy0 + 1 + j * 2, Math.max(2, (x1 - x0) - 4 - j * 2), 1);
        // silhouettes: a chair, a palm, the desk, somebody at it
        g.fillStyle = 'rgba(58,42,30,0.72)';
        if (i === 1) { g.fillRect(x0 + 4, gy1 - 14, 8, 14); g.fillRect(x0 + 3, gy1 - 18, 4, 5); }
        if (i === 2) { g.fillRect(x0 + 6, gy1 - 22, 3, 22); g.fillRect(x0 + 2, gy1 - 26, 11, 6); }
        if (i === 4) { g.fillRect(x0 + 2, gy1 - 12, x1 - x0 - 6, 12); }
        if (i === 4) { g.fillRect(x0 + 8, gy1 - 20, 5, 9); }
        g.fillStyle = BRONZE; g.fillRect(x1 - 2, gy0 - 2, 3, gy1 - gy0 + 4);
      }
      g.fillStyle = BRONZE;
      g.fillRect(3, gy0 - 3, W - 6, 3); g.fillRect(3, gy1, W - 6, 3);

      // ── the entrance: a revolving door in a stone case ──
      const dc = Math.round(doorU * W), dw = s.at(1.35);
      g.fillStyle = '#8a8478'; g.fillRect(dc - dw - 5, gy0 - 8, dw * 2 + 10, H - gy0 + 8);
      g.fillStyle = '#9a9488'; g.fillRect(dc - dw - 5, gy0 - 8, dw * 2 + 10, 3);
      g.fillStyle = '#141118'; g.fillRect(dc - dw, gy0 - 2, dw * 2, H - gy0 + 2);
      // the drum, and the two leaves you can see edge-on inside it
      g.fillStyle = '#3a3428'; g.fillRect(dc - dw + 2, gy0, dw * 2 - 4, gy1 - gy0 + s.at(0.5));
      g.fillStyle = 'rgba(232,200,138,0.30)'; g.fillRect(dc - dw + 3, gy0 + 1, dw * 2 - 6, gy1 - gy0 - 2);
      g.fillStyle = BRONZE;
      g.fillRect(dc - 1, gy0, 3, gy1 - gy0 + s.at(0.5));
      g.fillRect(dc - dw + 2, gy0, 2, gy1 - gy0 + s.at(0.5));
      g.fillRect(dc + dw - 4, gy0, 2, gy1 - gy0 + s.at(0.5));
      // brass kick plate, worn through in the middle where every shoe hits it
      g.fillStyle = '#8a7434'; g.fillRect(dc - dw + 2, yOf(0.45), dw * 2 - 4, s.at(0.3));
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(dc - 6, yOf(0.45), 12, s.at(0.3));

      grime(g, W, yOf(3.3), s.at(1.2), 30);
      grime(g, W, yOf(0.42), s.at(0.4), 14);
      dither(g, W, H, 300);
    });
  };

  // ── the shell ─────────────────────────────────────────────────────────
  const spans: Record<string, [number, number]> = {};
  // HOW DEEP A BUILDING IS — "all buildings need to be much deeper otherwise it
  // looks like a fake building", the user, twice, routed here by 4734d631f.
  //
  // Both shells were BoxGeometry(w, h, 3.4) while every building street.ts places
  // gets `depthOf()`, 14 … 23.5 m. Same split as the flanks: these two left
  // ct/street.ts before that work and did not travel with it.
  //
  // 14.0 is not a taste pick. Three things already agreed on it and none of them
  // was the shell:
  //   · the COLLIDER below already claimed `zc + 1.7 + 8`, so 8 m of solid
  //     nothing stood behind a 3.4 m building. You were stopped by a wall that
  //     was not there. Filling that volume is the fix for both faults at once.
  //   · the neighbour west of the hotel (x 22.4…33.5) has its back wall on
  //     z = -82, and 14 m from this frontage lands exactly there, so the block
  //     gets one rear line instead of a notch.
  //   · 14 is the floor of `depthOf`'s own range, so these two are the shallowest
  //     buildings on the street rather than outliers in the other direction.
  //
  // The FRONT does not move: the facade stays on z = -96, which is what the
  // portal, the declared door and the [E] spot are all keyed to. Only the back
  // goes back.
  const DEP = 14.0;
  const placeShell = (x0: number, zc: number, b: BldSpec) => {
    const cx = x0 + b.w / 2;
    // front face stays at zc - 1.7; the box grows backwards from there
    const zMid = zc - 1.7 + DEP / 2;
    const gh = SHOP_BAND_H;
    const h = 3.4 + b.floors * 2.4;
    spans[b.nm] = [x0, x0 + b.w];
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    // BoxGeometry face order is [+x, -x, +y, -y, +z, -z], so the facade is index
    // 5 and 0/1/4 are the two flanks and the back — exactly the three D measured
    // as flat brown on each box. The +-x faces span the DEPTH, the +z face spans
    // the WIDTH; painting both from one texture is how you get brick that
    // stretches on one pair of faces and not the other.
    const xt = flat(flankTex(b.brick, DEP, h, gh));
    const zt = flat(flankTex(b.brick, b.w, h, gh));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, DEP),
      [xt, xt, roofM, roofM, zt, facade]);
    wall.position.set(cx, h / 2 + gh, zMid);
    scene.add(wall);
    const bandM = flat(b.nm === 'SEVENS' ? sevensBand(b, x0) : orpheusBand(b, x0));
    const xs = flat(flankTex(b.brick, DEP, gh, 0));
    const zs = flat(flankTex(b.brick, b.w, gh, 0));
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w, gh, DEP),
      [xs, xs, roofM, roofM, zs, bandM]);
    shop.position.set(cx, gh / 2, zMid);
    scene.add(shop);
    // the collider now ENDS where the building ends, instead of 8 m past it
    solid({ minX: x0, maxX: x0 + b.w, minZ: zc - 1.7 - 0.3, maxZ: zc - 1.7 + DEP });
  };

  // ── shared material factories ─────────────────────────────────────────
  //
// STALE UNTIL 2026-08-02 — `dimWorld` no longer skips `transparent`. `props.ts:414` is now `isGlass = m.blending === AdditiveBlending`, so ONLY additive is excluded and an ordinary translucent material IS graded. This comment's old claim misrouted a queue item onto the wrong mechanism; the reasoning around it may still be sound, the RULE is not. 
  // Everything lit is `transparent` so dimWorld leaves it alone, and
  // `fog: false` so it burns through 40 m of haze. FrontSide, never
  // DoubleSide: a transparent double-sided plane puts both faces in the sorted
  // pass and the far one can paint over the near one, which is exactly the bug
  // that made the old HOTEL sign read backwards.
  const neon = (t: THREE.Texture) => new THREE.MeshBasicMaterial({
    map: t, transparent: true, alphaTest: 0.35, fog: false, side: THREE.FrontSide });
  const glowM = (col: number, op: number) => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: op, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending });
  const steel = new THREE.MeshBasicMaterial({ color: 0x35323a });
  const boardM = new THREE.MeshBasicMaterial({ color: 0x24222a, side: THREE.DoubleSide });
  const goldM = new THREE.MeshBasicMaterial({ color: 0xb98f30 });

  // Declared, not left for a tool to guess at. `soft` is the radial falloff that
  // every spill and haze sheet on these two buildings maps, and those four faces
  // were turning up in the seam audit's brick-candidate list at ~6 px/m against
  // declared-16 walls — a ratio that means nothing, because a surface that ADDS
  // light to what is behind it is not masonry and cannot be. `declareSurface` is
  // the module that knows saying so, which is the pattern that already settled
  // `masonry`, `selfLit` and `mod`.
  const soft = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  /** a flat additive pool on the ground — GOTCHAS §3, top-down, never a board */
  const spill = (x: number, z: number, w: number, d: number, y: number, col: number, day: number, nite: number) => {
    const m = new THREE.MeshBasicMaterial({ map: soft, color: col, transparent: true,
      opacity: day, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    scene.add(p);
    ticks.push((n) => { m.opacity = day + (nite - day) * n; });
    return p;
  };

  const placeSigns = (sideSpans: Record<string, [number, number]>) => {
    const casino = sideSpans['SEVENS'], hotel = sideSpans['HOTEL ORPHEUS'];
    const FACE_Z0 = -96.0;

    // ── the chase, shared by both buildings ─────────────────────────────
    //
    // Hoisted out of the casino so the hotel's porte-cochère runs off the SAME
    // sequence. That is the point of the pair: two buildings blinking in step
    // read as one lit block at the end of the street, and two blinking out of
    // step read as two separate mistakes.
    //
    // Bulbs are FIXED sockets and the chase is which of them are alight, so the
    // light runs and the sockets do not — a scrolling texture would carry the
    // dead bulb along with it, and a dead bulb is a fixed socket. Bulb i belongs
    // to class `i % PHASES`, so the whole installation animates in PHASES colour
    // writes a frame however many bulbs there are, plus one class that never
    // lights.
    //
    // ═══ FLAIR IS TIMING AND PATTERN, NOT DETAIL PER BULB ═══════════════
    //
    // The user, on the finished facade: *"add more flair to the bulbs
    // themselves instead"*. At 8 px/m a bulb is one or two texels across, so
    // there is no detail to add TO a bulb — the only thing a sign at this
    // resolution can vary is what the light DOES, and that is also the only
    // thing a real marquee varies. What stood here did exactly one thing from
    // the day it was built: every third socket alight, marching one step at
    // 6 Hz, forever, on both buildings.
    //
    // So the chase became a PROGRAM on the same clock, the same materials and
    // the same draw cost — a mode only changes which classes are lit this
    // frame:
    //
    //   chase   a two-socket comet running along every run
    //   alt     odd and even sockets trading at 5 Hz — the shimmer
    //   flash   every socket on both buildings on and off together, four times
    //   back    the comet, running the other way
    //   on      everything held lit
    //
    // PHASES MUST BE EVEN or `alt` cannot work: a bulb's parity is
    // `(i % PHASES) % 2`, and that equals `i % 2` only for even PHASES — at
    // PHASES 3 the odds and evens do not separate at all and the mode reads as
    // a stutter. Six also holds `chase` at the SAME 1/3 duty the three-phase
    // version had (COMET 2 of 6), so the building did not get darker in order
    // to get livelier; the light is simply gathered into a travelling pair
    // instead of spread as an even stipple.
    //
    // The dud classes are untouched and still never light, including through
    // `flash` and `on` — that is the whole point of a dud, and `deadEvery` is
    // 23 / 19 / 17 at the three runs that use it, all coprime with 6, so no
    // dud rate collapses onto a single phase class.
    const PHASES = 6, COMET = 2;
    const chaseOn = new THREE.Color(0xfff2c0), chaseOff = new THREE.Color(0x6a5a3a);
    const phaseM = Array.from({ length: PHASES }, () => new THREE.MeshBasicMaterial({
      color: 0x6a5a3a, transparent: true, fog: false }));
    const deadM = new THREE.MeshBasicMaterial({ color: 0x4a453e, transparent: true, fog: false });
    const bulbGeo = new THREE.SphereGeometry(0.075, 6, 4);
    let bulbN = 0;
    /** hang a run of bulbs on the shared chase; every Nth socket is a dud */
    const bulbRun = (pts: [number, number, number][], deadEvery = 0) => {
      for (const [bx, by, bz] of pts) {
        const i = bulbN++;
        const dud = deadEvery > 0 && i % deadEvery === 0;
        const m = new THREE.Mesh(bulbGeo, dud ? deadM : phaseM[i % PHASES]);
        m.position.set(bx, by, bz);
        scene.add(m);
      }
    };
    // The loop, as DATA rather than as branching — 13.2 s end to end. Long
    // enough that it does not read as a blink pattern, short enough that
    // someone crossing the road in front of it sees the whole thing once.
    type ChaseMode = 'chase' | 'alt' | 'flash' | 'back' | 'on';
    const PROGRAM: [ChaseMode, number][] = [
      ['chase', 3.6], ['alt', 1.6], ['chase', 2.4],
      ['flash', 1.6], ['back', 3.2], ['on', 0.8],
    ];
    const LOOP = PROGRAM.reduce((a, [, s]) => a + s, 0);
    const CHASE_HZ = 7, ALT_HZ = 5, FLASH_HZ = 5;   // 5 Hz over 1.6 s = four blinks
    ticks.push((n, t) => {
      let u = t % LOOP;
      let mode: ChaseMode = PROGRAM[PROGRAM.length - 1][0];
      for (const [md, dur] of PROGRAM) { if (u < dur) { mode = md; break; } u -= dur; }
      // The comet steps off the GLOBAL clock, never off `u`, so coming back to
      // `chase` after a flash picks the run up where it left off rather than
      // snapping to socket 0 — a visible jolt across every run in the world at
      // once. `flash` is the one mode that wants `u`: a blink has to start on
      // its own beat, not wherever the global second happens to be.
      const run = Math.floor(t * CHASE_HZ);
      for (let i = 0; i < PHASES; i++) {
        const on = mode === 'on' ? true
          : mode === 'flash' ? Math.floor(u * FLASH_HZ) % 2 === 0
          : mode === 'alt' ? (i & 1) === (Math.floor(t * ALT_HZ) & 1)
          : ((((mode === 'back' ? i + run : i - run) % PHASES) + PHASES) % PHASES) < COMET;
        phaseM[i].color.copy(on ? chaseOn : chaseOff);
        phaseM[i].opacity = on ? 1 : 0.55 + 0.30 * n;
      }
    });

    // ── a neon tube, run vertically up a facade ─────────────────────────
    //
    // The buildings were lit at the ground and dark above it, which is a lit
    // SHOPFRONT, not a lit building — and the brief is that these two are the
    // only light sources in the world. A tube up the full height turns the
    // whole elevation into the sign. Dull glass by day, burning at night, on
    // the same night factor as everything else.
    const tubeTex = (col: string) => {
      const t = pixTex(8, 16, (g) => {
        g.fillStyle = '#151119'; g.fillRect(0, 0, 8, 16);
        g.fillStyle = col; g.fillRect(2, 0, 4, 16);
        g.fillStyle = '#fff6e0'; g.fillRect(3, 0, 1, 16);
        g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(5, 0, 1, 16);
      });
      t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    // `z` and `w` default to the facade, which is every caller but one: the
    // blade's leading edge stands 1.35 m proud of the wall and is 0.34 m across,
    // and it needs the same tube rather than one that merely resembles it —
    // same reason `tube` and `leafPair` are shared. Defaulted, so the three
    // facade calls read exactly as they did before this parameter existed.
    const riser = (x: number, y0: number, y1: number, col: string,
      z = FACE_Z0 - 0.07, w = 0.22) => {
      const t = tubeTex(col);
      t.repeat.set(1, Math.max(1, Math.round((y1 - y0) / 1.2)));
      const m = new THREE.MeshBasicMaterial({
        map: t, transparent: true, opacity: 0.4, fog: false, side: THREE.FrontSide });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), m);
      q.rotation.y = Math.PI;                  // face the road, not the brick
      q.position.set(x, (y0 + y1) / 2, z);
      scene.add(q);
      ticks.push((n) => { m.opacity = 0.34 + 0.66 * n; });
    };

    const FACE_Z = -96.0;                        // the facade plane
    let driverHost: THREE.Mesh | null = null;

    // ── the canopy datum, hoisted, because it is now ONE canopy ────────────
    //
    // The user: *"make it a combo orpheus hotel and casino."* A combined
    // property is read from the pavement at STREET level long before anyone
    // gets close enough to read a sign — a hotel and a casino that share a
    // building share one canopy line, and that is the whole tell. So the
    // porte-cochère's section and the marquee's are no longer private to their
    // own blocks: the "one property" run at the bottom of this function fills
    // the gaps between them from the SAME numbers, which is what makes it come
    // out flush rather than nearly flush. (BUILDER-BRIEF §8 — the alternative
    // is typing 4.3 and 4.78 a second time and finding out later.)
    const PC_W = 7.8, PC_Y0 = 4.3, PC_Y1 = 4.78, PC_Z1 = -98.05;
    const MQ_W = 6.0, MQ_Y0 = 3.7, MQ_Y1 = 5.35;
    const HOTEL_DOOR_X = VICE_DOOR_X['HOTEL ORPHEUS'], CASINO_DOOR_X = VICE_DOOR_X['SEVENS'];

    /**
     * The canopy fascia, at a DECLARED density rather than a remembered canvas.
     *
     * BUILDER-BRIEF §7b: a texture's density comes from the face it lands on.
     * This band is painted for four different lengths (three link runs and the
     * porte-cochère itself), so the canvas is derived from the run — 24 px/m
     * both ways — and every socket comes out the same size along the whole
     * 23.55 m. A fixed 112 x 14 canvas reused for a 2.16 m run would have drawn
     * those sockets at 52 px/m next to the porte-cochère's 14.
     */
    const FASCIA_PPM = 24;
    const canopyFascia = (lenM: number) => {
      const w = Math.max(8, Math.round(lenM * FASCIA_PPM));
      const h = Math.round((PC_Y1 - PC_Y0) * FASCIA_PPM);
      return declareSurface(pixTex(w, h, (g) => {
        g.fillStyle = '#4a3a20'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#7a5f26'; g.fillRect(0, 1, w, h - 3);
        g.fillStyle = GOLD_D; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 2, w, 2);
        g.fillStyle = GOLD; g.fillRect(0, 1, w, 1);
        // the socket run along the bottom of the fascia, on the texel grid, at
        // one pitch for the whole property — 0.38 m, the porte-cochère's own
        for (let x = Math.round(0.19 * FASCIA_PPM); x < w; x += Math.round(0.38 * FASCIA_PPM)) {
          g.fillStyle = '#4e3f22'; g.fillRect(x - 2, h - 8, 5, 5);
          g.fillStyle = '#f6e2a2'; g.fillRect(x - 1, h - 7, 3, 3);
        }
        grime(g, w, 1, Math.round(w / 14), 22);
      }), 'detail');
    };

    // ═══ THE CASINO ═════════════════════════════════════════════════════
    if (casino) {
      const cxm = (casino[0] + casino[1]) / 2;
      const DOOR_X = 51.29;                      // == ct/int-casino.ts's [E] spot

      // ── the skinned elevation, and the ONE place its extent is written ──
      //
      // 4.35 and 17.2 were typed out twice in this function — once by the skin
      // painter and once by the crown/party bulb runs — and this change needs a
      // third reader, so they are hoisted instead. Two authorings of one fact is
      // the class of coupling that is silent when it breaks; see the VICE_DOOR_X
      // note at the top of this file for the last time it cost something here.
      const SKIN_Y0 = 4.35, SKIN_Y1 = 17.2;      // top of the shop band, roofline
      // Where the name board sits on that skin, as FRACTIONS of the canvas —
      // because the painter works in texels and the tubes work in metres, and a
      // fraction is the only form both can read. The riser tubes break around
      // this band: running a neon stripe straight down through the middle of the
      // building's name is what the centre riser was doing, and it read as a
      // scratch across the sign rather than as light on a wall.
      const NAME_T = 0.30, NAME_B = 0.69;
      const skinY = (f: number) => SKIN_Y1 - f * (SKIN_Y1 - SKIN_Y0);

      // ── the marquee ──────────────────────────────────────────────────
      //
      // 6 m wide, projecting 1.7 m over the pavement, its soffit at 3.7 m so
      // you walk under it — the eye is at 1.62. No collider: it is entirely
      // overhead, and an unnecessary box on this pavement would close a 1 m
      // walking lane (GOTCHAS §8/§9).
      // MQ_W/MQ_Y0/MQ_Y1 are hoisted to the top of placeSigns now — the "one
      // property" canopy run has to butt this marquee exactly.
      const MQ_Z1 = FACE_Z - 1.7;
      const mqCz = (FACE_Z + MQ_Z1) / 2, mqD = FACE_Z - MQ_Z1;

      // the fascia artwork: changeable copy, the way a real marquee carries it
      //
      // ── WHY THIS CANVAS DOUBLED, AND WHY THAT IS NOT THE SOFT DIRECTION ──
      //
      // The second line was filed as clipped — `$1 BLACKJA`. Measured, it is
      // not: 72.2 texels of advance inside a 96-texel canvas, 12 texels of
      // clear margin at each end (scripts/probes/w46-does-the-copy-fit.mjs).
      // The whole string is on the sign. You cannot READ it, which from the
      // pavement is indistinguishable from a truncation and is what the user
      // actually saw.
      //
      // The cause is density, not width. 96 texels over 6.0 m is 16 px/m, so
      // twenty characters at 6 px cap height gave a 3.6-texel glyph whose stems
      // are one texel — and `hardLayer` snapping alpha at 128 then keeps or
      // drops each of those stems depending on where the anti-aliaser happened
      // to land it. Half a letterform survives. That is the mush in his frame.
      //
      // Doubled to 192 x 52, EXACTLY 2x in both axes, which puts this at 32 px/m
      // — the family the rest of the signage on this pair already lives in
      // (the blade art is 35 px/m, the rooftop board 27). The name panel stays
      // at the block's 8 px/m because `masonry` owns that canvas.
      //
      // Doubling a canvas is normally the SOFT direction and it is not here:
      // every glyph still goes through `hardLayer`, so a letter edge is still a
      // texel edge — there are simply twice as many texels to put the edge on.
      // The line went from a 3.6-texel glyph to a 7-texel one.
      const FW = 192, FH = 52;
      const fasciaT = pixTex(FW, FH, (g) => {
        g.fillStyle = '#1a1620'; g.fillRect(0, 0, FW, FH);
        g.fillStyle = GOLD_D; g.fillRect(0, 0, FW, 6); g.fillRect(0, FH - 6, FW, 6);
        g.fillStyle = GOLD; g.fillRect(0, 2, FW, 2); g.fillRect(0, FH - 4, FW, 2);
        // the headline in neon, the small print in plastic — a real marquee is
        // exactly this pair, and drawing both in tube would flatten the hierarchy
        fitTube(g, 'LOOSEST SLOTS', FW / 2, 19, FW - 20, '#f2b83a');
        fitFlat(g, '$2 BLACKJACK  24 HRS', FW / 2, 39, FW - 20, '#e8e0c8');
        grime(g, FW, 6, 12, 28);
      });
      const fasciaM = neon(fasciaT);
      const mqBody = new THREE.MeshBasicMaterial({ color: 0x2a2028 });
      // index 5 is the -z face. On this street that is the one facing the
      // road; index 4 (+z) points back at the building. placeShell already
      // hangs the facade on 5 for the same reason, and getting it wrong here
      // hid the marquee's copy against the brick where nobody could read it.
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(MQ_W, MQ_Y1 - MQ_Y0, mqD),
        [mqBody, mqBody, mqBody, mqBody, mqBody, fasciaM]);
      marquee.position.set(DOOR_X, (MQ_Y0 + MQ_Y1) / 2, mqCz);
      scene.add(marquee);
      driverHost = marquee;

      // the soffit: the brightest surface on the building, and the reason the
      // pavement under it is worth standing on
      const soffitT = pixTex(64, 24, (g) => {
        g.fillStyle = '#f4e0aa'; g.fillRect(0, 0, 64, 24);
        g.fillStyle = '#e8cf90';
        for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 24);
        for (let y = 0; y < 24; y += 8) g.fillRect(0, y, 64, 1);
        g.fillStyle = '#fff6d8';
        for (let x = 4; x < 64; x += 8) for (let y = 4; y < 24; y += 8) g.fillRect(x - 1, y - 1, 3, 3);
        dither(g, 64, 24, 30);
      });
      const soffit = new THREE.Mesh(new THREE.PlaneGeometry(MQ_W - 0.1, mqD - 0.08),
        new THREE.MeshBasicMaterial({ map: soffitT, transparent: true, fog: false }));
      soffit.rotation.x = Math.PI / 2;
      soffit.position.set(DOOR_X, MQ_Y0 + 0.01, mqCz);
      scene.add(soffit);

      // ── the chase ────────────────────────────────────────────────────
      //
      // Bulbs are FIXED sockets and the chase is which of them are alight, so
      // the light runs and the sockets do not — a scrolling texture would carry
      // the dead bulb along with it, and a dead bulb is a fixed socket.
      //
      // Four shared materials do the whole thing: three phase classes that take
      // turns, and a fourth that never lights. Bulb i belongs to class i % 3,
      // so animating the chase is three colour writes a frame however many
      // bulbs there are.

      // round the front fascia and both returns, at both top and bottom edges
      const ring: [number, number, number][] = [];
      for (const y of [MQ_Y0 + 0.12, MQ_Y1 - 0.12]) {
        for (const bx of sockets(DOOR_X - MQ_W / 2 + 0.18, DOOR_X + MQ_W / 2 - 0.18, 0.36)) {
          ring.push([bx, y, MQ_Z1 - 0.02]);
        }
        for (const sx of [-1, 1]) {
          for (const bz of sockets(MQ_Z1 + 0.2, FACE_Z - 0.15, 0.4)) {
            ring.push([DOOR_X + sx * (MQ_W / 2 - 0.02), y, bz]);
          }
        }
      }
      // the dead one: 1984 refit, and nobody has been up the ladder since
      const DEAD = 11;
      bulbRun(ring);
      // the dead one: 1984 refit, and nobody has been up the ladder since. It is
      // placed by hand rather than by a modulo, so it is a specific socket on a
      // specific corner of the marquee and it never moves.
      const dud = new THREE.Mesh(bulbGeo, deadM);
      dud.position.set(...ring[DEAD]);
      scene.add(dud);
      // and the marquee's own glow, sitting in the air under the soffit
      const mqGlow = new THREE.Mesh(new THREE.PlaneGeometry(MQ_W + 1.4, mqD + 1.2),
        glowM(0xffd98a, 0.18));
      mqGlow.rotation.x = Math.PI / 2;
      mqGlow.position.set(DOOR_X, MQ_Y0 - 0.5, mqCz);
      scene.add(mqGlow);
      ticks.push((n) => { (mqGlow.material as THREE.MeshBasicMaterial).opacity = 0.10 + 0.30 * n; });

      // ═══ THE BLADE IS GONE — AND THE SKYLINE MARK IS NOT ═══════════════
      //
      // The user, on the now-legible facade: *"casino sign still a lil janky.
      // maybe we get rid of the one on the side here? add more flair to the
      // bulbs themselves instead?"*
      //
      // He phrased it as a question, so it was answered with a frame before it
      // was answered with a deletion — `scripts/probes/w51-frontage-without-
      // blade.mjs` hides the blade at runtime and shoots three stations. The
      // verdict from his own station is not close: the blade stood edge-on to
      // the road, so what it showed him was its 0.34 m cabinet laid down the
      // left third of the elevation, cutting the parapet run in half and
      // occluding the west chevron outright. Off, the frontage reads as one lit
      // rectangle — CASINO, the framed name, 777 between two chevrons, the
      // marquee — which is the composition item 97 built and the blade was
      // standing in front of.
      //
      // THE COST, MEASURED RATHER THAN ASSUMED. The worry was that this is the
      // tallest thing on the building and the only thing that reads from down
      // the street. It is NOT the tallest thing: the blade topped out at 21.4 m
      // and the rooftop board tops out at 26.0 m, 4.6 m above it, and that board
      // carries SEVENS in bulb-outlined letters on both faces. The skyline mark
      // was never the blade's job — the comment on the pylon below has said so
      // all along ("the blade below it does a different job"). So the long view
      // keeps its vertical, and what it loses is a second SEVENS three metres
      // from the first, competing with HOTEL ORPHEUS' blade for the same corner.
      //
      // Item 97 gave this blade a lit leading edge and that fix was correct —
      // it is why the black bar stopped being a black bar. Removing the object
      // does not retire the idiom: `riser`'s `z`/`w` parameters and the leading
      // edge treatment stay, and the rooftop board still uses both.
      //
      // ITEM 121 IS STILL LIVE. It gives HOTEL ORPHEUS' blade the same
      // leading-edge fix. ORPHEUS is a different building on a different
      // frontage, the user has not commented on it, and its blade does not
      // duplicate a name already painted two metres away — so nothing here
      // cancels it.

      // ── the blank wall the 1984 refit made ───────────────────────────
      //
      // SEVENS had four storeys of ordinary sash windows above its
      // marquee, which is the single thing most at odds with what it is
      // supposed to be. Casinos do not have windows — that is the whole point
      // of a casino, and it is why ct/int-casino.ts has no daylight in it. A
      // room with no clock behind a facade full of windows is two buildings.
      //
      // So the refit did what these refits did: boarded and skinned the
      // elevation, and painted the house's name on the slab it made. The
      // windows are still under there. You can see where they were — the paint
      // sank a little into every reveal and the ghosts came back through, which
      // is the detail that makes this read as a building that was CHANGED
      // rather than as a building that was drawn flat.
      {
        const y0 = SKIN_Y0, y1 = SKIN_Y1;
        const sk = masonry(casino[1] - casino[0], y1 - y0, y0, 1);
        const { W, H } = sk;
        const skin = sk.paint((g) => {
          g.fillStyle = '#6e1a24'; g.fillRect(0, 0, W, H);
          // the skin is panels, and they do not quite match
          for (let x = 0; x < W; x += 11) {
            g.fillStyle = (x / 11) % 3 === 1 ? '#741d27' : '#6a1822';
            g.fillRect(x, 0, 10, H);
          }
          g.fillStyle = 'rgba(0,0,0,0.20)';
          for (let x = 0; x < W; x += 11) g.fillRect(x + 10, 0, 1, H);
          // the ghosts of the windows underneath, four storeys of them
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 5; c++) {
              const gx = Math.round(6 + c * ((W - 12) / 5)), gy = Math.round(7 + r * ((H - 12) / 4));
              const gw = Math.round(W / 12), gh = Math.round(H / 11);
              g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(gx, gy, gw, gh);
              g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(gx, gy, gw, 1);
              g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(gx, gy + gh - 1, gw, 1);
            }
          }
          // ═══ AND THE SIGN ACROSS IT — A COMPOSITION, NOT A CAPTION ═══════
          //
          // The user, third time on this facade: "sevens casino front looks so
          // messed up. take influence from vegas thanks."
          //
          // TWO SEPARATE THINGS WERE WRONG AND ONLY ONE OF THEM IS TASTE.
          //
          // The defect: the name read `EVEN`. `H * 0.30` is a cap height taken
          // from the panel's HEIGHT, and this panel is 11.55 m wide by 12.85 m
          // tall — taller than it is wide. Six letters at 31 px ink 112 texels
          // into a 92-texel canvas and ten texels fell off each end, which at
          // that size is very nearly a whole letter at each end. The note above
          // this line was RIGHT that fewer, bigger letters beat a bigger texture,
          // and it is kept; it simply never checked the resulting width against
          // the panel. `fitTube` now derives the size from the width the sign
          // has, so the word fills the frontage instead of overrunning it, and
          // it is 21 px rather than 31 — smaller letters, and four more of them.
          // You could read four before. You can read six now.
          //
          // The taste: everything else here was one caption and one small mark
          // floating in eight metres of empty maroon, which is what he means by
          // "so messed up" and by "vegas". A Vegas front is DENSITY and
          // HIERARCHY — a dominant name, a category over it, a mark under it,
          // rules and bulb runs holding the whole elevation, and no dead wall.
          // So the field is divided top to bottom and every band does a job:
          //
          //   texel   0..4    cornice rule, under the real crown bulbs at 17.38 m
          //           6..12   a painted socket run across the full frontage
          //          14..25   CASINO, letterspaced wide — what the building IS
          //          27..29   the double rule that separates it from the name
          //          31..70   THE NAME BOARD: an inset lit panel, gold framed,
          //                   sockets top and bottom, SEVENS filling it
          //          72..74   rule
          //          76..94   777 in a starburst — the mark, now big enough to be one
          //
          // Below texel 95 the marquee stands in front of the middle 6 m of this
          // panel (measured: marquee top 5.35 m maps to texel 95.0), so nothing
          // that has to be read is put down there.
          //
          // It is all texel work in the hand this file already uses — tube for
          // anything that lights, flat hardLayer for anything that does not,
          // every rule and socket on a whole-texel boundary. No new geometry
          // carries any of it.
          const rule = (ry: number, h = 3) => {
            g.fillStyle = GOLD_D; g.fillRect(0, ry, W, h);
            g.fillStyle = GOLD; g.fillRect(0, ry + 1, W, 1);
          };
          /** painted sockets — the density a real bulb run gives, at no draw calls */
          const socketRow = (sy: number, x0s: number, x1s: number, pitch: number) => {
            for (let x = x0s; x <= x1s; x += pitch) {
              const rx = Math.round(x);
              g.fillStyle = '#4e3f22'; g.fillRect(rx - 1, sy - 1, 3, 3);
              g.fillStyle = '#f6e2a2'; g.fillRect(rx, sy, 1, 1);
            }
          };

          rule(1);
          socketRow(9, 4, W - 4, 5.4);
          // ORPHEUS OVER CASINO, NOT CASINO OVER SEVENS — the category line and
          // the name board have swapped jobs, and that swap is the whole of the
          // user's ask on this elevation. *"make it a combo orpheus hotel and
          // casino"*: the property is ORPHEUS and this wing is its CASINO, so
          // the subordinate line carries the house name and the dominant board
          // carries what the wing IS. SEVENS is gone as an address.
          //
          // 'HOTEL ORPHEUS' does not fit here and that is a resolution fact, not
          // taste: this canvas is 92 texels for 11.55 m (8 px/m), the tracked
          // span is W*0.66 = 61, and 13 letters is a 5.1-texel pitch under a
          // 6-texel glyph — the letters would overlap. 7 letters sit at 10.2.
          // The word HOTEL is carried by the hotel wing's own fascia and by the
          // pylon, which are the two places it can be read.
          track(g, 'ORPHEUS', W / 2, 19, Math.round(W * 0.66), 10, '#e0b84e');
          rule(27);

          // the name board: the name stops being paint on a wall and becomes a
          // sign bolted to one, which is the single biggest change in the read
          {
            const by = Math.round(H * NAME_T), bh = Math.round(H * NAME_B) - by;
            g.fillStyle = '#2c0c12'; g.fillRect(0, by, W, bh);
            g.fillStyle = GOLD_D; g.fillRect(0, by, W, 2); g.fillRect(0, by + bh - 2, W, 2);
            g.fillStyle = '#12060a'; g.fillRect(2, by + 4, W - 4, bh - 8);
            socketRow(by + 3, 4, W - 4, 5.4);
            socketRow(by + bh - 3, 4, W - 4, 5.4);
            // W - 8 leaves the sockets clear at both ends; the fitter puts the
            // casing inside that, so the S at each end keeps its glass
            // CASINO, six letters exactly as SEVENS was, so `fitTube` derives
            // the same cap height from the same W - 8 and nothing about the
            // board's proportion changes with the rename.
            fitTube(g, 'CASINO', Math.round(W / 2), by + Math.round(bh / 2) + 1, W - 8,
              '#e8b93a', '#f7e6b0', '#3a1016');
          }
          rule(72);

          // The house's mark. This was a spade first and it came out looking
          // like a bird — a suit symbol needs curves and there are not enough
          // texels here to spend on them. Three sevens need none: they are
          // letterforms, they survive any resolution, and nothing else in the
          // world says SLOT MACHINE that fast. Drawn in the red tube rather than
          // the gold so it reads as a separate sign bolted on afterwards.
          //
          // It was at 0.13 H and the item is right that it "sits small and lost".
          // It is now fitted to 0.52 W — four times the area — and the wings
          // either side of it carry the blade's chevron, because a mark alone in
          // the middle of a wall is a sticker and a mark with furniture around
          // it is a sign.
          //
          // A STARBURST WAS TRIED HERE FIRST AND IS NOT WHAT SHIPPED. Twenty
          // rays from the middle of the mark: at 8 px/m every ray inside the
          // 777's own ink is invisible, the vertical ones run out of band before
          // they clear it, and what survived was four gold specks that read as
          // damage rather than as light. The chevron is a shape 8 px/m can
          // actually hold, which a ray is not.
          //
          // It was chosen because `bladeArt` ran the same chevron down the
          // blade, so the two marks were the same hand by construction rather
          // than by resemblance. THE BLADE IS GONE (item 132) and `bladeArt`
          // with it, so that argument no longer holds — but the chevron does,
          // on its own merits, and it is now the only place this motif lives.
          // Recorded rather than quietly dropped: the reason a thing was drawn
          // outliving the thing it referred to is how a comment starts lying.
          {
            const scy = 85;
            for (const wcx of [Math.round(W * 0.11), Math.round(W * 0.89)]) {
              for (let k = 0; k < 3; k++) {
                const cy = 72 + k * 9;
                g.fillStyle = k % 2 ? '#f2b83a' : '#f6e2a2';
                for (let j = 0; j < 8; j++) {
                  g.fillRect(wcx - j, cy + j, 2, 2);
                  g.fillRect(wcx + j - 1, cy + j, 2, 2);
                }
              }
            }
            fitTube(g, '777', Math.round(W / 2), scy, Math.round(W * 0.52),
              '#ff4a3a', '#ffd8c0', '#3a1016');
          }

          grime(g, W, Math.round(H * 0.02), Math.round(H * 0.4), 90);
          dither(g, W, H, 700);
        });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(casino[1] - casino[0], y1 - y0), flat(skin));
        panel.rotation.y = Math.PI;                 // face the road
        panel.position.set(cxm, (y0 + y1) / 2, FACE_Z0 - 0.03);
        scene.add(panel);
      }

      // ── the whole elevation, not just the shopfront ──────────────────
      //
      // This is what the user was actually looking at when they said "so low
      // effort and boring": a lit ground floor under four storeys of dark
      // brick. A downtown casino outlines the BUILDING. So the roofline and
      // both party edges carry the same chase as the marquee, and three tubes
      // run the full height between them.
      //
      // The vocabulary here is excess and repetition, which is exactly what a
      // pixel world is good at — one bulb is a dot, ninety bulbs on a rhythm is
      // a casino.
      {
        const CROWN = SKIN_Y1, BASE = SKIN_Y0;           // roofline, top of band
        const x0 = casino[0] + 0.28, x1 = casino[1] - 0.28;
        const crown: [number, number, number][] = [];
        for (const bx of sockets(x0, x1, 0.42)) crown.push([bx, CROWN + 0.18, FACE_Z0 - 0.16]);
        for (const bx of [x0, x1]) {
          for (const by of sockets(BASE, CROWN, 0.52)) crown.push([bx, by, FACE_Z0 - 0.16]);
        }
        bulbRun(crown, 23);                              // roughly one dud in every 23

        // ── THE TUBES BREAK AROUND THE NAME, AND THEY MOVED TO THE EDGES ──
        //
        // They were at `cxm`, `x0 + 2.6` and `x1 - 2.6`, which is the middle of
        // the elevation — i.e. straight down the middle of SEVENS and through
        // the 777. On a wall with nothing on it that is a rhythm; on a wall
        // carrying the building's name it is a scratch. Both readings were true
        // at different times: the tubes were authored when this was a blank
        // maroon slab, and the sign has since grown into the space they used.
        //
        // So they do the two things a real installation does. They PAIR at the
        // party edges — gold outside, red inside, over the bulb column that is
        // already there — which turns each corner into one lit vertical instead
        // of three separate ones. And they BREAK at the name board, running the
        // parapet above it and the base below it, so the sign sits on a lit wall
        // rather than behind a set of bars.
        //
        // THE EAST PAIR CAME BACK TO THE CORNER. It was set 1.35/2.05 m in
        // rather than 0.55/1.25 for one reason: the blade cabinet stood at
        // `casino[1] - 0.95` and occluded anything nearer that corner. The
        // blade is gone (see the tombstone above), so the reason is gone, and
        // what is left without this is a building whose two lit corners sit at
        // different insets for no cause a viewer can see. Both pairs are now at
        // 0.55/1.25 and the elevation is symmetrical, which is what it was
        // drawn to be.
        const TOP = skinY(NAME_T), BOT = skinY(NAME_B);
        const pairs: [number, string][] = [
          [x0 + 0.55, '#f2b83a'], [x0 + 1.25, '#ff4a3a'],
          [x1 - 1.25, '#ff4a3a'], [x1 - 0.55, '#f2b83a'],
        ];
        for (const [rx, col] of pairs) {
          riser(rx, TOP, CROWN, col);                    // the parapet, above the sign
          riser(rx, BASE, BOT, col);                     // the base, below it
        }
      }

      // ── the entrance, in three dimensions ────────────────────────────
      // The band paints the portal; these are the parts that have to stand off
      // the wall for it to read as a way in rather than as a picture of one.
      for (const sx of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.3, 0.34), goldM);
        jamb.position.set(DOOR_X + sx * 1.52, 1.65, FACE_Z - 0.17);
        scene.add(jamb);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.34), goldM);
      head.position.set(DOOR_X, 3.4, FACE_Z - 0.17);
      scene.add(head);
      // brass threshold, and the runner over it
      //
      // The one surface this module lays on the GROUND that is not an additive
      // spill, so it is the one that should soak. It did not: dry and at 15:00 it
      // measured luminance 0.053 either way while the pavement under it went -20%
      // and the road -78% — the never-registered fault b209275c found in the road
      // centre lines.
      //
      // Registered through `scene.userData.registerWet`, which is `ctx.wet`
      // itself (`a768f333` moved it to ct/tex-ground.ts so it is published before
      // buildStreet, and therefore before this). One registry, not a copy of its
      // curve.
      //
      // I tried this once before and REVERTED it: the wet lerp pulls a colour
      // toward WET, and anything darker than WET came out LIGHTER — this runner
      // went +116% and read as a pale grey mat in front of the doors. `e24c959a`
      // clamps per channel so wet can only darken. Safe now, and only now.
      //
      // Nothing in this file tints this material, which is the other condition on
      // the export: registering hands its colour to updateRain every frame, so a
      // module that also paints it would fight for it. Every other ground surface
      // here is an additive spill driven by my own ticks and must NOT be given
      // away.
      // slabTex, not a flat colour: this is the exact item 0a case, "the
      // casino's red entrance runner, #7a2028" the wet-comment above already
      // names by colour — a flat quad on the ground beside grained pavement.
      // `.color` stays 0x7a2028 so registerWet's base-colour capture below is
      // unaffected; the map only adds grain the wet lerp tints on top of.
      const sillTex = slabTex({ wMeters: 3.0, dMeters: 1.5, base: '#7a2028', joint: 0, grain: 0.08 });
      const sillM = new THREE.MeshBasicMaterial({ color: 0x7a2028, map: sillTex });
      (scene.userData as { registerWet?: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial })
        .registerWet?.(sillM);
      const sill = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), sillM);
      sill.rotation.x = -Math.PI / 2;
      sill.position.set(DOOR_X, KERB_H + 0.012, FACE_Z - 0.9);
      scene.add(sill);

      // ── and what it throws on the ground ─────────────────────────────
      spill(DOOR_X, FACE_Z - 1.4, 8.5, 4.0, KERB_H + 0.03, 0xffcf7a, 0.05, 0.70);
      spill(DOOR_X, -99.4, 12.5, 6.8, 0.05, 0xffb85a, 0.03, 0.58);
      // The third pool was the BLADE's — a 4.0 x 3.4 m red wash at x 56.05, the
      // foot of a sign that is no longer there. A spill is the ground's account
      // of what is lit above it, so it goes with the thing that cast it;
      // leaving it would be a red pool thrown by nothing, which is the same
      // fault as the blade's own unlit face wearing the opposite sign.
    }

    // ═══ THE HOTEL ══════════════════════════════════════════════════════
    if (hotel) {
      const DOOR_X = 39.51;                      // == ct/int-hotel.ts's [E] spot

      // ── the porte-cochère ────────────────────────────────────────────
      //
      // 7.8 m across, projecting 2.05 m to the kerb line at z = -98, its
      // underside at 4.3 m. You walk under it.
      //
      // The two columns are the only thing here that touches the pavement, and
      // the pavement is 2 m wide with the building collider eating down to
      // z = -96.3, so there is about 1 m of walkable band. Each column is
      // 0.3 m, standing at z = -97.85 with its collider ending at -97.7: that
      // leaves 0.68 m of clear band between column and building for a 0.72 m
      // capsule to pass through, and the road side is open. Walked, not
      // eyeballed (GOTCHAS §9).
      // PC_W/PC_Y0/PC_Y1/PC_Z1 are hoisted to the top of placeSigns now.
      const pcCz = (FACE_Z + PC_Z1) / 2, pcD = FACE_Z - PC_Z1;
      // THE FASCIA IS THE PROPERTY'S, NOT THIS BUILDING'S, and that is the
      // change. It was its own grey-green painter — deliberately quieter than
      // the casino, "the older building still pretending to be respectable".
      // That reasoning was right while these were two addresses; the user has
      // now asked for one, and a canopy that changes material halfway along its
      // own length is the single clearest way to say they are still two.
      const pcFasciaM = flat(canopyFascia(PC_W));
      const pcBody = new THREE.MeshBasicMaterial({ color: 0x3f3a34 });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(PC_W, PC_Y1 - PC_Y0, pcD),
        [pcBody, pcBody, pcBody, pcBody, pcBody, pcFasciaM]);
      canopy.position.set(DOOR_X, (PC_Y0 + PC_Y1) / 2, pcCz);
      scene.add(canopy);
      if (!driverHost) driverHost = canopy;

      // lit from beneath: a warm panel and a row of recessed downlights
      const underT = pixTex(64, 20, (g) => {
        g.fillStyle = '#d8c49a'; g.fillRect(0, 0, 64, 20);
        g.fillStyle = '#c0ac86';
        for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 20);
        g.fillStyle = '#fff4d2';
        for (let x = 8; x < 64; x += 16) { g.fillRect(x - 3, 8, 7, 5); }
        g.fillStyle = 'rgba(255,244,210,0.35)';
        for (let x = 8; x < 64; x += 16) { g.fillRect(x - 5, 6, 11, 9); }
        dither(g, 64, 20, 24);
      });
      const under = new THREE.Mesh(new THREE.PlaneGeometry(PC_W - 0.12, pcD - 0.1),
        new THREE.MeshBasicMaterial({ map: underT, transparent: true, fog: false }));
      under.rotation.x = Math.PI / 2;
      under.position.set(DOOR_X, PC_Y0 + 0.01, pcCz);
      scene.add(under);
      const pcGlow = new THREE.Mesh(new THREE.PlaneGeometry(PC_W + 1.2, pcD + 1.0), glowM(0xffe0a8, 0.16));
      pcGlow.rotation.x = Math.PI / 2;
      pcGlow.position.set(DOOR_X, PC_Y0 - 0.7, pcCz);
      scene.add(pcGlow);
      ticks.push((n) => { (pcGlow.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.26 * n; });

      // the columns, and the collider that has to be walked
      for (const sx of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, PC_Y0 - KERB_H, 0.3),
          new THREE.MeshBasicMaterial({ color: 0x4a453c }));
        const cx0 = DOOR_X + sx * 2.9;
        col.position.set(cx0, KERB_H + (PC_Y0 - KERB_H) / 2, -97.85);
        scene.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), goldM);
        cap.position.set(cx0, PC_Y0 - 0.06, -97.85);
        scene.add(cap);
        solid({ minX: cx0 - 0.15, maxX: cx0 + 0.15, minZ: -98.0, maxZ: -97.7 });
      }

      // ── the porte-cochère runs the same chase as the marquee ─────────
      //
      // Same sequence, deliberately. The two buildings blinking in step read as
      // one lit block at the end of the street; out of step they read as two
      // separate mistakes.
      {
        const ring: [number, number, number][] = [];
        for (const by of [PC_Y0 + 0.1, PC_Y1 - 0.08]) {
          for (const bx of sockets(DOOR_X - PC_W / 2 + 0.2, DOOR_X + PC_W / 2 - 0.2, 0.38)) {
            ring.push([bx, by, PC_Z1 - 0.03]);
          }
        }
        bulbRun(ring, 19);
      }

      // ── and the elevation above it ───────────────────────────────────
      //
      // Quieter than the casino on purpose. The hotel is the older building and
      // the one still pretending to be respectable, so it gets a cornice line
      // and two tubes rather than a full outline — but it is still LIT, which
      // is the point. A dark hotel beside a lit casino reads as derelict.
      {
        const CROWN = 19.6, BASE = 4.9;
        const x0 = hotel[0] + 0.3, x1 = hotel[1] - 0.3;
        const crown: [number, number, number][] = [];
        for (const bx of sockets(x0, x1, 0.5)) crown.push([bx, CROWN + 0.16, FACE_Z0 - 0.16]);
        bulbRun(crown, 17);
        riser(x0 + 1.1, BASE, CROWN, '#5ad2ea');
        riser(x1 - 1.1, BASE, CROWN, '#5ad2ea');
      }

      // ── ORPHEUS in applied letters on the fascia ─────────────────────
      //
      // Individual plaques standing 0.07 m off the fascia, one per letter, not
      // a word painted on a band. That is what "applied" means and the
      // difference is the shadow line down the side of every letter.
      const LETTERS = 'ORPHEUS';
      const lw = 0.62, lgap = 0.10;
      const total = LETTERS.length * lw + (LETTERS.length - 1) * lgap;
      LETTERS.split('').forEach((ch, i) => {
        // A plane's normal is +z, which on this street points INTO the
        // building, so each plaque is turned to face the road. Two things then
        // follow and the first one cost me a redraw:
        //
        //  · the GLYPH needs no mirroring. Turned through PI, the plane's u
        //    runs from high x to low x, and a viewer facing the building has
        //    low x on their right — so u already increases to screen-right.
        //  · the WORD does. Letters are laid out DESCENDING in x, because on
        //    this street screen-right IS descending x. Laid out ascending, every
        //    letter was correct and ORPHEUS read backwards.
        const t = pixTex(16, 20, (g) => {
          g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 16, 20);
          tubeText(g, ch, 8, 10, 17, '#ffd98a', '#fff8e4', '#6a5220');
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, 0.72), neon(t));
        m.rotation.y = Math.PI;
        m.position.set(DOOR_X + total / 2 - lw / 2 - i * (lw + lgap), (PC_Y0 + PC_Y1) / 2, PC_Z1 - 0.07);
        scene.add(m);
      });

      // ── the blade sign, redrawn as tubes ─────────────────────────────
      //
      // The old one was flat cyan letters on a dark plane — a stripe, not a
      // tube. Same position and same size; the artwork is what changes, plus a
      // VACANCY sign under it that has been on for a long time.
      // Full height, and that is the whole point of it. The user's sentence was
      // "theyre a casino and hotel right next to each other", and what makes
      // that an image rather than two buildings is TWO BLADES side by side —
      // SEVENS burning red at 46.4 and ORPHEUS burning cyan at 44.35, two metres
      // apart, both running from the canopy to above the roofline. The old
      // blade said HOTEL in five letters over seven metres and was the smaller
      // sign on a bigger building than the casino.
      const hx = hotel[1] - 1.1;
      const HB_Y0 = 5.0, HB_Y1 = 19.2, HB_YC = (HB_Y0 + HB_Y1) / 2;
      // 1.2 m deep, to match the casino's 1.35. At 0.6 it was the same height
      // as the SEVENS blade and half its width, which from down the street read as
      // the hotel standing behind the casino rather than beside it.
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.26, HB_Y1 - HB_Y0, 1.2), boardM);
      mast.position.set(hx, HB_YC, -96.95);
      scene.add(mast);
      for (const y of [6.4, 10.2, 14.0, 17.8]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.86), steel);
        arm.position.set(hx, y, -96.38);
        scene.add(arm);
        const stay = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), steel);
        stay.position.set(hx, y + 0.46, -96.38);
        stay.rotation.x = 0.69;
        scene.add(stay);
      }
      const hotelArt = () => pixTex(40, 250, (g) => {
        g.fillStyle = '#17141c'; g.fillRect(0, 0, 40, 250);
        g.fillStyle = '#3a3630'; g.fillRect(0, 0, 40, 3); g.fillRect(0, 247, 40, 3);
        g.fillRect(0, 0, 3, 250); g.fillRect(37, 0, 3, 250);
        // HOTEL small at the head, ORPHEUS at full size under it — the way a
        // hotel blade is actually set, with the category over the name
        'HOTEL'.split('').forEach((ch, i) => tubeText(g, ch, 20, 16 + i * 15, 13, '#ff5a8a'));
        g.fillStyle = '#3a3630'; g.fillRect(7, 92, 26, 2);
        'ORPHEUS'.split('').forEach((ch, i) => tubeText(g, ch, 20, 110 + i * 20, 26, '#5ad2ea'));
      });
      for (const s of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1.1, HB_Y1 - HB_Y0), neon(hotelArt()));
        face.position.set(hx + s * 0.15, HB_YC, -96.95);
        face.rotation.y = s * Math.PI / 2;
        scene.add(face);
      }
      // VACANCY, hung under the blade. Pink neon, and the NO has been dark for
      // long enough that the tube behind it has gone grey.
      const vacT = () => pixTex(34, 20, (g) => {
        g.fillStyle = '#17141c'; g.fillRect(0, 0, 34, 20);
        tubeText(g, 'NO', 9, 10, 11, '#4a4640', '#6a6660', '#241f22');
        tubeText(g, 'VACANCY', 22, 10, 8, '#ff6a9a');
      });
      const vacM: THREE.MeshBasicMaterial[] = [];
      for (const s of [-1, 1]) {
        const mat = neon(vacT());
        const v = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.56), mat);
        v.position.set(hx + s * 0.14, 4.5, -96.75);
        v.rotation.y = s * Math.PI / 2;
        scene.add(v);
        vacM.push(mat);
      }
      // It has a bad ballast. Not a clean blink — a long steady burn with an
      // occasional stutter, which is what a tube on its way out actually does
      // and what separates "broken" from "animated".
      ticks.push((n, t) => {
        const ph = t % 4.2;
        const flick = ph > 3.86 && ph < 3.94 ? 0.25 : ph > 4.02 && ph < 4.07 ? 0.4 : 1;
        for (const m of vacM) m.opacity = (0.35 + 0.65 * n) * flick;
      });

      // ── rooms that are occupied ──────────────────────────────────────
      //
      // Eight warm windows on the upper facade, out of the thirty the brick
      // carries. A hotel with every window dark is a derelict hotel; a hotel
      // with every window lit is a full one. Eight is losing money.
      const winT = pixTex(12, 16, (g) => {
        g.fillStyle = '#e0b878'; g.fillRect(0, 0, 12, 16);
        g.fillStyle = '#c89a58'; g.fillRect(0, 0, 12, 3);
        g.fillStyle = 'rgba(60,40,24,0.55)'; g.fillRect(3, 7, 6, 9);
      });
      const LIT: [number, number][] = [
        [-3.8, 6.4], [1.1, 6.4], [3.6, 8.8], [-1.3, 11.2],
        [3.6, 13.6], [-3.8, 13.6], [1.1, 16.0], [-1.3, 18.4],
      ];
      const winM = new THREE.MeshBasicMaterial({ map: winT, transparent: true, fog: false, opacity: 0.5 });
      for (const [dx, wy] of LIT) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95), winM);
        w.rotation.y = Math.PI;                  // face the road, not the brick
        w.position.set(DOOR_X + dx, wy, FACE_Z - 0.04);
        scene.add(w);
      }
      ticks.push((n) => { winM.opacity = 0.16 + 0.74 * n; });

      spill(DOOR_X, -97.4, 9.5, 4.6, KERB_H + 0.026, 0xffd28a, 0.05, 0.58);
      spill(DOOR_X, -99.7, 12.5, 6.6, 0.045, 0xffc070, 0.03, 0.50);
      spill(hx, -97.0, 3.6, 3.0, KERB_H + 0.024, 0x6ad0ea, 0.03, 0.34);
    }

    // ═══ what the pair look like from the BLOCK ════════════════════════
    //
    // The view this whole build exists for is the one you get standing at the
    // corner and looking 45 m down the side street, and at that range every
    // individual bulb is sub-pixel. The signs still burn through — they are
    // `fog: false` — but they read as a thin bright sliver, because the AIR
    // around them does not do anything. Real neon at that distance is mostly
    // the glow it puts into the haze above itself.
    //
    // So: one soft additive sheet standing over the pair, facing back down the
    // street at the viewer, dark by day and up at night. It is the cheapest
    // possible version of light pollution and it is what makes the far end of
    // the street read as somewhere rather than as a wall with a sign on it.
    //
    // Kept deliberately weak and very soft-edged. The failure mode here is a
    // glowing rectangle hanging in the sky, so it is a radial falloff with no
    // hard edge anywhere near the frame, and it sits BEHIND the roofline of
    // both buildings so the silhouette still cuts it.
    if (casino && hotel) {
      const gx = (hotel[0] + casino[1]) / 2;
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(26, 17), glowM(0xff9a5a, 0));
      haze.rotation.y = -Math.PI / 2;            // faces -x, back down the street
      haze.position.set(gx, 15.5, -95.4);
      scene.add(haze);
      const hazeM = haze.material as THREE.MeshBasicMaterial;
      hazeM.map = soft;
      // a second, tighter and warmer one down at marquee height, which is what
      // puts colour in the air over the road rather than over the roofs
      const low = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), glowM(0xffb060, 0));
      low.rotation.y = -Math.PI / 2;
      low.position.set(gx, 5.2, -98.6);
      scene.add(low);
      const lowM = low.material as THREE.MeshBasicMaterial;
      lowM.map = soft;
      ticks.push((n) => { hazeM.opacity = 0.30 * n; lowM.opacity = 0.22 * n; });
    }

    // ═══ ONE PROPERTY: the canopy that runs the whole 23.55 m ══════════
    //
    // The user: *"make it a combo orpheus hotel and casino. connect them
    // internally and outside."* The inside half is `PARTY` in ct/interior.ts.
    // THIS is the outside half, and it is deliberately the cheapest true thing
    // rather than a facade rewrite.
    //
    // Two adjacent buildings read as one ESTABLISHMENT when something crosses
    // the party line at the height a person's eye is at. Signs do not do it —
    // both of these already had signs and both read as separate addresses in
    // every shot. A canopy does: a hotel and a casino that share a building
    // share one soffit you walk under from end to end, and the break in it is
    // exactly what says "two addresses".
    //
    // So the porte-cochère (7.8 m, over the hotel door) and the marquee (6.0 m,
    // over the casino door) are joined up. Three runs fill what is left, at the
    // porte-cochère's own section, from the same hoisted constants:
    //
    //   33.45 ─── PORTE-COCHÈRE ─── 43.41 ─ link ─ 48.29 ─ MARQUEE ─ 54.29 ─┐
    //     └ link ┘                                                     link ─┘ 57.00
    //
    // The marquee is 0.6 m lower and 0.57 m taller than the canopy, so it stands
    // THROUGH the run rather than in line with it — which is what a real
    // entrance marquee does, and it means nothing here has to move.
    //
    // NO COLLIDER, deliberately. The soffit is at 4.30 m and the eye is at 1.62;
    // a box on this pavement would close the walking lane the porte-cochère's
    // own columns were carefully sized around (GOTCHAS §8/§9). Nothing this
    // block adds touches the ground.
    if (casino && hotel) {
      const pcCz = (FACE_Z + PC_Z1) / 2, pcD = FACE_Z - PC_Z1;
      const under = new THREE.MeshBasicMaterial({ color: 0xd8c49a });
      const body = new THREE.MeshBasicMaterial({ color: 0x4a3a20 });
      const run = (x0: number, x1: number) => {
        const len = x1 - x0;
        if (len < 0.25) return;                  // nothing worth building
        const cxr = (x0 + x1) / 2;
        const fascia = flat(canopyFascia(len));
        const box = new THREE.Mesh(new THREE.BoxGeometry(len, PC_Y1 - PC_Y0, pcD),
          [body, body, body, under, body, fascia]);
        box.position.set(cxr, (PC_Y0 + PC_Y1) / 2, pcCz);
        scene.add(box);
        // the bulb run along the front bottom edge, on the SAME chase as the
        // marquee and the porte-cochère — two runs blinking out of step read as
        // two buildings, which is the thing this whole block is undoing
        bulbRun(sockets(x0 + 0.19, x1 - 0.19, 0.38).map((bx) =>
          [bx, PC_Y0 + 0.12, PC_Z1 - 0.03] as [number, number, number]), 23);
        // and what it throws down onto the pavement, so the lit band is
        // continuous on the ground too
        // 0.34 at night, not 0.20. G-vice-walk's ground-spill check requires
        // EVERY sheet on this pair to reach 0.25 after dark, and caught these
        // three at 0.20 — a real find rather than a threshold to loosen: a
        // stretch of canopy that throws visibly less light than the two
        // entrances either side of it reads as the canopy being a different
        // building's, which is the whole thing this run exists to undo. 0.34 is
        // the dimmest sheet the pair already had.
        spill(cxr, PC_Z1 + 0.5, len, 3.0, KERB_H + 0.012, 0xffd8a0, 0.03, 0.34);
      };
      run(hotel[0], HOTEL_DOOR_X - PC_W / 2);
      run(HOTEL_DOOR_X + PC_W / 2, CASINO_DOOR_X - MQ_W / 2);
      run(CASINO_DOOR_X + MQ_W / 2, casino[1]);
      void MQ_Y0; void MQ_Y1;
    }

    // ═══ the rooftop pylon — kept, and still the skyline mark ═══════════
    //
    // Unchanged from the version street.ts carried, comment and all. It is the
    // thing you pick out of the haze from the far end of the block, it has been
    // verified once, and the blade below it does a different job.
    const neonOld = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, fog: false, side: THREE.FrontSide });
    const twoSided = (
      tw: number, th: number, draw: (g: CanvasRenderingContext2D) => void,
      w: number, h: number, x: number, y: number, z: number, gap: number,
    ) => {
      for (const s of [-1, 1]) {
        const t = pixTex(tw, th, draw);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), neonOld(t));
        m.position.set(x + s * gap, y, z);
        m.rotation.y = s * Math.PI / 2;
        scene.add(m);
      }
    };
    if (casino) {
      const cxm = (casino[0] + casino[1]) / 2, top = SHOP_BAND_H + 3.4 + 4 * 2.4;
      const ROOF = top, BOT = ROOF + 2.2;
      for (const s of [-1, 1]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.2, BOT - ROOF, 0.2), steel);
        upright.position.set(cxm, (ROOF + BOT) / 2, -94.3 + s * 1.2);
        scene.add(upright);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.78, 0.13), steel);
        brace.position.set(cxm, ROOF + 1.1, -94.3 + s * 1.75);
        brace.rotation.x = -s * 0.657;
        scene.add(brace);
      }
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.8), steel);
      tie.position.set(cxm, BOT - 0.2, -94.3);
      scene.add(tie);
      // THE CABINET'S RETURNS ARE PAINTED METAL, NOT BOARD BLACK — and this is
      // the DAYLIGHT half of the fix, which three rounds of bulbs could not be.
      //
      // The board's art is on its two ±x faces. From the user's own station
      // (x 53.6, z −103.2, looking down −z) you are square onto its 0.5 m −z
      // RETURN, so the only thing this sign ever shows the street is that edge.
      // In `boardM` it is #24222a against a pale grey sky: at noon, with every
      // socket on it unlit, that is a black wedge over the middle of the
      // frontage and there is nothing left to say it is a sign at all. The row
      // is right that it is WORSE BY DAY, and that is exactly why more bulbs
      // was never going to answer it — bulbs are the night half, and the night
      // half was already done (`notes/archive/w51-…`).
      //
      // So the returns get their own material instead of the art faces'. A real
      // rooftop sign is a painted sheet-metal box with dark faces; this is that
      // box, and by day it now reads as a lit-side-on cabinet with a top rail
      // rather than a hole in the sky. No geometry is added or moved — the same
      // BoxGeometry, with its six face groups given three materials — so the
      // silhouette the user framed is unchanged and only its VALUE changes.
      //
      // DERIVED, NOT PICKED. Both are the sign's own gold `#e8c25a` (the riser
      // and the lettering, below) scaled down to a painted rather than lit
      // value: 45% for the returns, 58% for the top cap, which is the one face
      // the sky actually falls on. Nothing here is a new colour in this world.
      const goldMul = (f: number) => (
        ((Math.round(0xe8 * f) << 16) | (Math.round(0xc2 * f) << 8) | Math.round(0x5a * f)) >>> 0);
      const boardTrim = new THREE.MeshBasicMaterial({ color: goldMul(0.45) });
      const boardCap = new THREE.MeshBasicMaterial({ color: goldMul(0.58) });
      // BoxGeometry's groups are +x, −x, +y, −y, +z, −z. Only the ±x pair keeps
      // `boardM`, because the artwork planes sit just off them and that black is
      // what the lettering is drawn against.
      //
      // THE SOFFIT (−y) IS IN THE TRIM TOO, AND IT IS THE FACE THAT MATTERS.
      // First cut left it black on the reasoning that its two bulb runs already
      // dressed it — which is the night argument again. Measured from the
      // geometry: the board's near edge is z −97.9 at y 19.4, and his eye is
      // z −103.2 at y ~1.7, so he is 5.3 m out and ~18 m below it. At that angle
      // the 0.5 × 7.2 m UNDERSIDE is most of what he can see of this object and
      // the 0.5 × 6.6 m front return is the sliver. Repainting the return and
      // leaving the soffit black moved almost nothing in the after-frame — which
      // is what the frame showed, and why this line changed after looking rather
      // than before.
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.6, 7.2),
        [boardM, boardM, boardCap, boardTrim, boardTrim, boardTrim]);
      frame.position.set(cxm, BOT + 3.3, -94.3);
      scene.add(frame);
      // THE SAME DEAD LEADING EDGE AS THE BLADE, AND THE SAME ANSWER.
      //
      // Measured, this board is 0.5 x 6.6 x 7.2 m with its art on the two +/-x
      // faces, so from the road you get a 0.5 m wide, 6.6 m tall strip of unlit
      // #24222a standing in the sky over the middle of the frontage — the second
      // black bar in the user's frame, and the thinner one. It is one object
      // with one cause, so it takes one fix, here rather than in a second idiom.
      // The dud rate is left off: this board was refit last and its lamps still
      // all work, which is the reading that makes the marquee's dud mean
      // something.
      {
        const fz = -94.3 - 3.6;                  // the -z face of that 7.2 m box
        const edge: [number, number, number][] = sockets(BOT + 0.5, BOT + 6.1, 0.5)
          .map((by) => [cxm, by, fz - 0.11]);
        bulbRun(edge);
        riser(cxm, BOT + 0.35, BOT + 6.25, '#e8c25a', fz - 0.03, 0.42);
        // AND THE SOFFIT, which is the OTHER face you can see from the street.
        // Lighting the front edge alone left a second dark slab: this board is
        // 7.2 m deep and stands at 19.4 m, so from the pavement you are looking
        // steeply UP at its underside — 0.5 x 7.2 m of the same unlit boardM,
        // receding away from the lit edge and reading as a black shaft hanging
        // off it. Caught in the after-frame, not reasoned about; a leading edge
        // is obvious and a soffit only shows from below.
        //
        // A rooftop sign this size is outlined in bulbs on every edge it has,
        // so the underside gets the two long ones and the slab becomes the gap
        // between two running lines.
        for (const sx of [-0.19, 0.19]) {
          bulbRun(sockets(fz + 0.35, -94.3 + 3.25, 0.62)
            .map((bz) => [cxm + sx, BOT + 0.06, bz]));
        }
      }
      // THE BLADE, RE-SET FOR A SHORTER NAME AND SHARPENED.
      //
      // Two faults, and the rename is the chance to close the second:
      //  - it read GOLDEN over ACES at 15 px on a 92 x 74 canvas over a
      //    6.8 x 6.2 m board. SEVENS is one word, so it gets the height both
      //    lines had, at 34 px.
      //  - "casino text is a bit too blurry". The canvas was 13.5 px/m and the
      //    text was drawn with plain fillText, which ANTIALIASES — grey fringe
      //    texels on every letter, in a world that is nearest-filtered
      //    throughout. Doubled to 184 x 148 (27 px/m) and every glyph now goes
      //    through `hardLayer`, which snaps alpha to 0 or 255 and flattens the
      //    colour, so a letter edge is a texel edge. That painter exists in this
      //    file already and is what the marquee lettering uses; the blade was
      //    the one sign in the pair still drawing soft.
      twoSided(184, 148, (g) => {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        hardLayer(g, '#e8c25a', (h) => {
          h.textAlign = 'center'; h.textBaseline = 'middle';
          // ORPHEUS, and the second line names the combination. This is the
          // SKYLINE mark — the thing you pick out of the haze from the far end
          // of the block — so it is the one sign that has to say what the whole
          // property is rather than what one wing sells. TEXT ONLY: the board,
          // the pylon and its bulb run are untouched, because item 121 owns the
          // decision about this sign's GEOMETRY and a rename must not pre-empt
          // it. 7 letters at 34 px monospace advance 143 texels of a 184 canvas,
          // centred at 92, so it clears the edge bulb runs at 4..10 / 174..180.
          h.font = 'bold 34px monospace';
          h.fillText('ORPHEUS', 92, 58);
        });
        hardLayer(g, '#e8574a', (h) => {
          h.textAlign = 'center'; h.textBaseline = 'middle';
          h.font = 'bold 15px monospace';
          h.fillText('HOTEL & CASINO', 92, 108);
        });
        // the bulb run round the edge, on the texel grid
        g.fillStyle = '#f2d98a';
        for (let x = 6; x < 184; x += 16) { g.fillRect(x, 4, 8, 6); g.fillRect(x, 138, 8, 6); }
        for (let y = 12; y < 140; y += 16) { g.fillRect(4, y, 6, 8); g.fillRect(174, y, 6, 8); }
      }, 6.8, 6.2, cxm, BOT + 3.3, -94.3, 0.26);
    }

    // hang the one frame hook on the marquee — the biggest thing that is always
    // drawn with these two buildings
    if (driverHost) {
      driverHost.onBeforeRender = (renderer, sc) => driver(renderer as THREE.WebGLRenderer, sc as THREE.Scene);
    }
  };

  return { placeShell, placeSigns, VICE: ['SEVENS', 'HOTEL ORPHEUS'] as const };
}

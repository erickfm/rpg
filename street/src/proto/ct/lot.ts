import * as THREE from 'three';
import type { Seat } from './ctx';
import type { AABB } from '../fp';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { FACE } from './rng';
import { makeCar, type CarKind } from './cars';
import { citizenSprite } from './citizens';

// ── THE USED CAR LOT ──────────────────────────────────────────────────────
//
// From the user: "turn hardware and cafe into a used car lot". Same
// relationship to ct/street.ts that ct/civic.ts has — this module owns no
// state, takes what it needs from the caller, and hands back a PLACER. The
// roster decides where the lot goes; the lot decides what a lot is.
//
// WHY IT LOOKS LIKE THIS. A 1997 used car lot is one of the loudest things
// you can put on a street, and the brief is to lean on that, because E is
// building a park at the other end of the same block. Two open lots facing
// each other invites the comparison, so every choice here is made AGAINST the
// park:
//
//     park                        lot
//     green                       asphalt, patched and oil-stained
//     quiet                       bunting, banners, a floodlight
//     civic — it is a gift        commercial — everything has a price on it
//     open to the street          fenced, with one gate
//     things grow                 nothing here grows
//
// The single most identifying thing about the typology is not the cars, which
// any street has: it is the PENNANT BUNTING. Triangular plastic flags on a
// sagging line are what tell you, from the far end of the block and at a
// glance, that this is a lot and not a car park. They get the most care here.
//
// COORDINATION — three rules, and they are why this file is shorter than it
// looks:
//   · CARS BELONG TO BUILDER H. `makeCar` comes from ct/cars.ts and the stock
//     is H's fleet, unmodified. Nothing in here builds a vehicle. A car on
//     blocks, or one with its hood up, would be a good addition to the LOT —
//     but it is a car, so it is H's to make and must be asked for.
//   · SEATS ARE BUILDER F's. Nothing here implements sitting.
//   · THE ROSTER IS BUILDER D's. This module never decides its own z.
//
// WHAT THIS FILE DOES NOT BUILD. ct/street.ts's `openSite` owns the SITE —
// the ground, the neighbours' newly exposed party walls, the rear elevation,
// and a low boundary wall along the street with its middle left open. All of
// that, and every collider for it, is D's and already there. This file builds
// only what makes the site a CAR LOT, and takes the site as a parameter.
//
// That split is not bookkeeping. The first version of this module laid its
// own asphalt at KERB_H, which is exactly coplanar with the site's ground —
// two coplanar tops z-fight (GOTCHAS §6) — and drew its own fence and its own
// perimeter colliders on top of D's. Everything below either sits ABOVE the
// site (the chain-link rides on the low wall, the way a real lot does it) or
// stands ON it (the stock, the office, the signs).

/** The open site this fills, as ct/street.ts's `openSite` hands it back.
 *  Declared structurally rather than imported because `Site` is local to
 *  buildStreet — same shape, so it matches by structure. */
export interface LotSite {
  minX: number; maxX: number; minZ: number; maxZ: number; y: number;
}

/** Everything this module makes solid — the office, the sign poles and the
 *  stock. The site's own boundary and back are D's and already registered. */
export const LOT = {
  live: false,
  colliders: [] as AABB[],
  /** Where the lot actually IS, in world metres, filled in by `placeLot`.
   *
   *  Published because the alternative is a remembered coordinate, and a
   *  remembered coordinate has now misrouted the same finding twice: a
   *  whole-world checker was pointed at `30 60 -105 -90` as "the car lot" and
   *  reported thirteen faults against this file. That box holds none of this
   *  module — the office board is at x 26.07, z 2.6 — and the thirteen belong
   *  to a neon module ten blocks away.
   *
   *  Nothing here decides where the lot goes; D's `openSite` does. This is a
   *  read-back of what it was handed, so a tool can ask instead of guess:
   *
   *      import { LOT } from './lot';
   *      LOT.bounds   // → { minX, maxX, minZ, maxZ } once LOT.live */
  bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
};

/** `openSite` leaves the middle of the street edge open as the gate, as a
 *  fraction of the frontage taken off each end. Must match the `gate` it is
 *  called with, or the chain-link crosses the mouth. */
const SITE_GATE = 0.3;

// SITE + 1: the park is built before the lot, and that is not cosmetic. One
// seeded rnd() stream feeds tree heights and pigeons, so swapping these two
// repaints 71 textures (GOTCHAS §2). Alphabetical order would put the lot
// first — this is the tiebreak being made explicit rather than accidental.
export const ORDER = BUILD.SITE + 1;

/**
 * The world loader's entry point — see `ct/world.ts`. A NEW export beside
 * `buildLot`, which is unchanged.
 *
 * It does BOTH halves. `buildLot` only prepares the module; `placeLot(site)`
 * is what fills the site, and calling the first without the second leaves you
 * walking into a blank brick wall — which is what the lot looked like on the
 * first attempt at wiring it. Behind one entry point that mistake is not
 * available to make.
 */
export function register(ctx: CtxBuild) {
  const site = ctx.site('lot');
  if (!site) { console.warn('[lot] the block has no site named "lot" — nothing built'); return; }
  const lot = buildLot({
    scene: ctx.scene, flat: ctx.flat, wet: ctx.wet, KERB_H: ctx.KERB_H, obstacle: ctx.obstacle,
    onFrame: (fn, order) => ctx.onFrame((f) => fn({ night: f.night, px: f.px, pz: f.pz, dt: f.dt }), order),
    seat: ctx.seat,
  });
  lot.placeLot(site);
}

export function buildLot(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  /** register a ground material for the rain's wet-look tint, if the caller
   *  has the registry at this point — asphalt should darken like the road */
  wet?: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  KERB_H: number;
  /** register a solid box, if the caller has a registry at this point */
  obstacle?: (b: AABB) => AABB;
  /** per-frame hook, if the caller has one. Only used to bring the floodlight
   *  up after dark — a lot lights itself at night because that is when it is
   *  trying hardest, and without this the pole was a prop that did nothing. */
  onFrame?: (fn: (f: { night: number; px: number; pz: number; dt: number }) => void, order?: number) => void;
  /** register a sittable seat, if the caller has F's registry at this point.
   *  Threaded in like `obstacle` and `onFrame` rather than imported, so this
   *  module still builds standalone for the shot scripts. */
  seat?: (s: Seat) => void;
}) {
  const { scene, flat, KERB_H } = o;
  // ── the decals the world's grader correctly will not touch ─────────────
  // props.ts's dimWorld skips any material with `transparent: true`, and that
  // is RIGHT: it owns glass, and blending a graded colour through a pane is
  // its business, not a caller's. But an oil stain and a faded bay line are
  // genuinely translucent — they have to blend to be stains at all — so they
  // fall in the same gap, and they are painted ON asphalt that does darken.
  // Measured at 23:00 the ground reaches 0.22 while an untouched decal sits at
  // 0.68, which is an oil slick that gets BRIGHTER relative to the tarmac as
  // the sun goes down.
  //
  // So this module dims its own. Only the handful that are genuinely
  // translucent go in the list; everything alpha-cut is the world's job now,
  // and the two additive glows must never be in here — they are lights, and
  // dimming a light at night is backwards.
  const decals: { m: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  const decal = <T extends THREE.MeshBasicMaterial>(m: T): T => {
    decals.push({ m, base: m.color.clone() });
    return m;
  };
  const colliders: AABB[] = LOT.colliders;
  const solid = (b: AABB) => { colliders.push(b); o.obstacle?.(b); return b; };
  const wet = o.wet ?? ((m: THREE.MeshBasicMaterial) => m);

  // ── the surface ────────────────────────────────────────────────────────
  // Not a car park's clean seal coat. This is asphalt that has been patched
  // in squares of a slightly different black, cracked along the joints, and
  // dripped on under every bay for twenty years. The faded bay lines are the
  // only geometry on it and they are half gone.
  const padT = pixTex(64, 64, (g) => {
    g.fillStyle = '#3c3e43'; g.fillRect(0, 0, 64, 64);
    // patches: rectangles of a different mix, with a hard cold-joint edge
    for (const [px, py, pw, ph, c] of [
      [4, 8, 22, 15, '#34363b'], [38, 30, 20, 18, '#44464a'],
      [10, 44, 16, 12, '#383a3f'], [30, 2, 14, 10, '#40424700'.slice(0, 7)],
    ] as [number, number, number, number, string][]) {
      g.fillStyle = c; g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(px, py, pw, 1); g.fillRect(px, py, 1, ph);
    }
    // cracks — thin, and they wander rather than running straight
    g.fillStyle = 'rgba(0,0,0,0.42)';
    for (const [sx, sy, dx] of [[6, 0, 1], [29, 6, -1], [52, 18, 1], [18, 34, 1]] as [number, number, number][]) {
      let x = sx;
      for (let y = sy; y < 64; y += 2) { g.fillRect(x, y, 1, 2); if ((y >> 1) % 3 === 0) x += dx; }
    }
    // oil, where a car has stood a long time
    g.fillStyle = 'rgba(0,0,0,0.26)';
    for (const [ox, oy] of [[14, 20], [45, 40], [24, 54]] as [number, number][]) {
      g.fillRect(ox, oy, 6, 4); g.fillRect(ox + 1, oy - 1, 4, 6);
    }
    dither(g, 64, 64, 620);
  });

  // ── chain link ─────────────────────────────────────────────────────────
  // Drawn as texels. A stroked diagonal antialiases into grey mush and then
  // NearestFilter magnifies the mush — the same failure the door numerals
  // had. One texel wide, and the tile wraps on 24 so the diamonds are
  // continuous across every panel.
  const linkT = pixTex(24, 24, (g) => {
    g.clearRect(0, 0, 24, 24);
    // Galvanised wire in daylight, not white. At full brightness the mesh
    // was the lightest thing in frame and read as a screen over the block
    // rather than as something you see through.
    // TWO texels of wire, not one. A one-texel diagonal at 0.3 m per tile is
    // sub-pixel from the pavement, alphaTest drops it, and the fence simply
    // is not there from across the street — which is exactly what the user
    // saw: banners hanging in mid-air over a lot with no fence. Doubling the
    // wire doubles the covered fraction so enough of it survives the test to
    // read as a screen at distance, and up close it is still a wire diamond
    // and not a grey haze.
    g.fillStyle = '#7c848d';
    for (let i = 0; i < 24; i++) for (const off of [0, 8, 16]) {
      for (const w of [0, 1]) {
        g.fillRect(((i + off + w) % 24), i, 1, 1);
        g.fillRect((((off - i + w) % 24) + 24) % 24, i, 1, 1);
      }
    }
  });
  linkT.wrapS = linkT.wrapT = THREE.RepeatWrapping;
  const MESH_M = 0.3;   // one tile of diamonds per 0.3 m
  const linkPanel = (w: number, h: number) => {
    const t = linkT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / MESH_M, h / MESH_M);
    t.needsUpdate = true;
    // alphaTest WITHOUT `transparent: true`, and that is the whole point.
    //
    // A cut-out does not need blending — the fragment is discarded, not mixed
    // — so `transparent` buys nothing here and costs two things. It moves the
    // mesh into the sorted transparent queue, and, the one that showed: it
    // puts the material on props.ts's SKIP LIST. `dimWorld` deliberately
    // leaves transparent materials alone, which is right for glass and wrong
    // for a fence, so every alpha-cut prop in this lot was standing at full
    // daylight brightness at midnight while the buildings behind it went dark.
    //
    // I reported that twice as a props.ts problem. It is not: the flag was
    // mine and it was never needed. Dropping it lets the world's own grading
    // pick these up, on the same curve as everything else, with no special
    // case anywhere.
    return new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide });
  };
  const postM = new THREE.MeshBasicMaterial({ color: 0x6e747b });

  // ── pennant bunting ────────────────────────────────────────────────────
  // The thing that says "lot". Alternating red / white / yellow / blue
  // triangles on a line, sun-bleached on the upper half because they have
  // hung there all summer. Alpha outside the triangles, so the sky shows
  // through between them — that gap is what makes them read as flags rather
  // than as a painted band.
  const pennantT = pixTex(64, 20, (g) => {
    g.clearRect(0, 0, 64, 20);
    // TWO colours, not four. Four competed with the banners, the pole sign
    // and the starbursts, all of which are already loud; red-and-white is the
    // classic and it reads as one object from the far end of the block
    // instead of as confetti.
    const cols = ['#c0392f', '#dcd7c8', '#c0392f', '#dcd7c8'];
    // The line goes at the BOTTOM of the canvas and the flags taper UPWARD
    // from it, which comes out as line-on-top and points hanging DOWN once
    // the texture is on the plane. Drawn the intuitive way round it rendered
    // upside down — flags standing point-up ON the string like bunting sat on
    // a shelf. Verified by looking, not by reasoning about flipY.
    g.fillStyle = '#6a6258'; g.fillRect(0, 19, 64, 1);            // the line itself
    for (let i = 0; i < 4; i++) {
      const x0 = i * 16;
      g.fillStyle = cols[i];
      for (let row = 18; row >= 1; row--) {                       // a triangle, texel by texel
        const inset = Math.floor((18 - row) * 0.42);
        const w = 14 - inset * 2;
        if (w <= 0) break;
        g.fillRect(x0 + 1 + inset, row, w, 1);
      }
      g.fillStyle = 'rgba(255,255,255,0.16)';                     // bleached up by the string
      g.fillRect(x0 + 1, 16, 14, 3);
    }
    dither(g, 64, 20, 40);
  });

  // ── the office ─────────────────────────────────────────────────────────
  const cabinT = pixTex(32, 24, (g) => {
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 0, 32, 24);            // painted ply
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 3; y < 24; y += 5) g.fillRect(0, y, 32, 1);      // lap boards
    g.fillStyle = 'rgba(120,100,80,0.22)'; g.fillRect(2, 17, 28, 7); // weathered skirt
    dither(g, 32, 24, 60);
  });
  // The office is now the thing you drive TOWARD, at the far end of the aisle,
  // so its front is the most-looked-at face in the lot and it was carrying 32
  // by 24 texels for a 4.6 m wall — 7 per metre, which by GOTCHAS §4 cannot
  // hold a blind slat, let alone what is behind it. At 64 by 40 it can.
  const cabinWinT = pixTex(64, 40, (g) => {
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 0, 64, 40);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 5; y < 40; y += 8) g.fillRect(0, y, 64, 1);      // lap boards
    g.fillStyle = 'rgba(120,100,80,0.22)'; g.fillRect(3, 30, 58, 10);
    const WX = 8, WY = 8, WW = 48, WH = 20;
    g.fillStyle = '#33404b'; g.fillRect(WX, WY, WW, WH);          // the glass

    // What is BEHIND the glass, painted before the blinds go over it, so the
    // blinds read as being in front of a room rather than as stripes on a
    // dark rectangle. A desk end-on, a chair, a filing cabinet, and the lamp.
    g.fillStyle = '#3d3128'; g.fillRect(WX + 24, WY + 11, 18, 9);   // desk
    g.fillStyle = '#2b2f36'; g.fillRect(WX + 20, WY + 12, 4, 8);    // chair back
    g.fillStyle = '#4a4f57'; g.fillRect(WX + 3, WY + 6, 7, 14);     // filing cabinet
    g.fillStyle = '#5a6068';
    for (let d = 0; d < 3; d++) g.fillRect(WX + 4, WY + 8 + d * 4, 5, 1);
    // THE DESK LIGHT, ON. A stepped pool rather than a gradient — this world
    // is nearest-filtered and a soft falloff turns to mush, the same lesson
    // the ceiling lamps in the walk-up taught.
    g.fillStyle = 'rgba(232,196,110,0.18)'; g.fillRect(WX + 20, WY + 5, 26, 15);
    g.fillStyle = 'rgba(238,206,126,0.30)'; g.fillRect(WX + 24, WY + 7, 18, 11);
    g.fillStyle = 'rgba(246,222,150,0.46)'; g.fillRect(WX + 28, WY + 8, 10, 8);
    g.fillStyle = '#f6e6b4'; g.fillRect(WX + 31, WY + 8, 4, 2);     // the shade itself
    g.fillStyle = '#8d7a48'; g.fillRect(WX + 32, WY + 10, 1, 3);    // its stem

    // VERTICAL BLINDS, half-drawn and hanging badly, which is the only state
    // a lot office's blinds are ever in. Drawn as 2-texel slats with a 1-texel
    // gap: at this density a slat is two pixels wide on screen and reads; at
    // the old density it would have been a third of one.
    for (let x = WX + 1; x < WX + WW - 1; x += 3) {
      const open = x > WX + 30 && x < WX + 40;                     // a gap, pulled aside
      if (open) continue;
      const skew = (x % 9 === 1) ? 1 : 0;                          // one slat turned
      g.fillStyle = skew ? 'rgba(226,222,206,0.60)' : 'rgba(214,210,194,0.88)';
      g.fillRect(x, WY + 1, 2, WH - 2);
    }
    g.fillStyle = '#8d8878'; g.fillRect(WX, WY, WW, 2);            // the blind track
    g.fillStyle = '#6a6258';                                        // window frame
    g.fillRect(WX - 1, WY - 1, WW + 2, 2); g.fillRect(WX - 1, WY + WH - 1, WW + 2, 2);
    g.fillRect(WX - 1, WY, 2, WH); g.fillRect(WX + WW - 1, WY, 2, WH);
    dither(g, 64, 40, 50);
  });
  // The window AC unit's grille. Horizontal louvres and a rusted seam where it
  // has sat in the same hole through several winters.
  const acT = pixTex(20, 16, (g) => {
    g.fillStyle = '#b9b4a6'; g.fillRect(0, 0, 20, 16);
    g.fillStyle = '#6a675e';
    for (let y = 3; y < 14; y += 2) g.fillRect(2, y, 16, 1);
    g.fillStyle = 'rgba(120,72,40,0.45)'; g.fillRect(0, 14, 20, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 20, 2);
    dither(g, 20, 16, 40);
  });

  // Hand-lettered, because a lot's sign is painted by whoever owned the
  // brush. Letters are stamped as texel blocks — at this density a font
  // renders as grey mush and the whole point of a sign is that it is read.
  const GLYPH: Record<string, number[]> = {
    A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001], B: [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
    C: [0b01111, 0b10000, 0b10000, 0b10000, 0b01111], D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
    E: [0b11111, 0b10000, 0b11110, 0b10000, 0b11111], F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
    G: [0b01111, 0b10000, 0b10011, 0b10001, 0b01111], H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001],
    I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111], J: [0b00111, 0b00010, 0b00010, 0b10010, 0b01100],
    K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001],
    L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111], M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001],
    N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001], O: [0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
    P: [0b11110, 0b10001, 0b11110, 0b10000, 0b10000], Q: [0b01110, 0b10001, 0b10101, 0b10010, 0b01101],
    R: [0b11110, 0b10001, 0b11110, 0b10010, 0b10001], S: [0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
    T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100], U: [0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    V: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100], W: [0b10001, 0b10001, 0b10101, 0b11011, 0b10001],
    X: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001], Y: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
    Z: [0b11111, 0b00010, 0b00100, 0b01000, 0b11111], '-': [0, 0, 0b01110, 0, 0],
    '0': [0b01110, 0b10001, 0b10001, 0b10001, 0b01110], '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b01110],
    '2': [0b11110, 0b00001, 0b01110, 0b10000, 0b11111], '3': [0b11110, 0b00001, 0b01110, 0b00001, 0b11110],
    '4': [0b10010, 0b10010, 0b11111, 0b00010, 0b00010], '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b11110],
    '6': [0b01110, 0b10000, 0b11110, 0b10001, 0b01110], '7': [0b11111, 0b00010, 0b00100, 0b01000, 0b01000],
    '8': [0b01110, 0b10001, 0b01110, 0b10001, 0b01110], '9': [0b01110, 0b10001, 0b01111, 0b00001, 0b01110],
    $: [0b01111, 0b10100, 0b01110, 0b00101, 0b11110],
    ' ': [0, 0, 0, 0, 0], "'": [0b00100, 0b00100, 0, 0, 0],
  };
  const stamp = (g: CanvasRenderingContext2D, s: string, x0: number, y0: number, px: number, ink: string) => {
    g.fillStyle = ink;
    for (let i = 0; i < s.length; i++) {
      // A glyph this table does not have used to draw as a SPACE, which is
      // how "BUY HERE PAY HERE" shipped reading "BUY ERE AY ERE" — the two
      // most common letters in the copy were the two it was missing, and a
      // silent blank is indistinguishable from good kerning. Draw a solid
      // block instead: still wrong, but wrong in a way that is impossible to
      // miss in the first screenshot.
      const rows = GLYPH[s[i]] ?? [0b11111, 0b11111, 0b11111, 0b11111, 0b11111];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        if (rows[r] & (1 << (4 - c))) g.fillRect(x0 + (i * 6 + c) * px, y0 + r * px, px, px);
      }
    }
  };
  const bannerT = (words: string, bg: string, ink: string) => {
    const W = words.length * 6 * 2 + 8;
    return pixTex(W, 22, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, W, 22);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 20, W, 2);
      stamp(g, words, 4, 6, 2, ink);
      dither(g, W, 22, 40);
    });
  };

  let placed = false;

  /** Fill an open site with a car lot. The site comes from ct/street.ts's
   *  `openSite`; this module never decides where it is or how big it is. */
  const placeLot = (site: LotSite) => {
    if (placed) return;
    placed = true;
    LOT.live = true;
    LOT.bounds = { minX: site.minX, maxX: site.maxX, minZ: site.minZ, maxZ: site.maxZ };
    // Everything this module adds gets stamped, and the mark is taken here.
    // All 51 scene.add calls in this file are inside placeLot and placeLot is
    // synchronous, so children from `mark` to the end are exactly ours.
    const mark = scene.children.length;
    const X0 = site.minX, X1 = site.maxX;          // street edge, back
    const zS = site.minZ, zN = site.maxZ;          // south and north ends
    const Y = site.y;
    const span = zN - zS;

    // ── THE PLAN ─────────────────────────────────────────────────────────
    // The user described this layout, so it is theirs and not an invention: a
    // drive aisle straight in from the street running to the BACK, stock
    // flanking it left and right, and the office across the far end.
    //
    // It is one decision and it fixes one problem. What makes 23.2 m of depth
    // READ is that you look ALONG something. The old plan was rows parallel to
    // the street, so the depth was hidden BEHIND the first row and invisible
    // from the pavement — from outside the fence it was a wall of cars with a
    // flat lot somewhere behind it. An aisle turns the same metres into a
    // recession you can see the whole length of from the kerb.
    //
    // And it gives the office a job. At the front corner it was a hut you
    // walked past. At the far end facing back down the aisle it is what you
    // drive TOWARD, it watches the whole lot, and the depth has a reason.
    const zMid = (zS + zN) / 2;
    const AISLE_HW = 3.4;                 // 6.8 m: two cars can pass
    const BAY_PITCH = 2.7;                // along the aisle, per bay
    const OFF_D = 3.0, OFF_W = 4.6, OFF_H = 2.7;
    const OFF_X = X1 - OFF_D / 2 - 1.1;   // across the back, off the rear fence
    const BAY_X0 = X0 + 2.4;              // first bay, back from the street line
    const BAY_X1 = OFF_X - OFF_D / 2 - 1.6;
    const BAYS = Math.max(1, Math.floor((BAY_X1 - BAY_X0) / BAY_PITCH));
    const bayX = (i: number) => BAY_X0 + i * BAY_PITCH;
    // Herringbone. Bays square to the aisle need a three-point turn to get
    // out; angled ones you nose straight out and drive away, which is why any
    // lot with an aisle parks like this. Nose-out toward the aisle, so the
    // windshield — and the price written on it — faces whoever walks down it.
    const HERR = 0.55;
    const NORTH_Z = zMid + AISLE_HW + 2.6, SOUTH_Z = zMid - AISLE_HW - 2.6;

    // ── the two things the site does not have ────────────────────────────
    // Oil, and faded bays. The site's ground is a clean surface because it
    // serves the park too; what makes it a LOT is twenty years of cars
    // standing in the same places. Decals a few mm above it, never coplanar.
    const oilT = pixTex(32, 32, (g) => {
      g.clearRect(0, 0, 32, 32);
      g.fillStyle = 'rgba(12,12,14,0.34)';
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const dx = (x - 16) / 15, dy = (y - 16) / 12;
        if (dx * dx + dy * dy <= 1 && ((x * 7 + y * 13) % 11) > 2) g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = 'rgba(8,8,10,0.30)';
      for (let i = 0; i < 14; i++) g.fillRect(10 + (i * 5) % 13, 11 + (i * 7) % 11, 2, 2);
    });
    const oilM = decal(new THREE.MeshBasicMaterial({ map: oilT, transparent: true, depthWrite: false }));
    const bayM = decal(new THREE.MeshBasicMaterial({ color: 0xb8b09a, transparent: true, opacity: 0.26 }));
    // A bay line and an oil stain at every place a car stands, both sides of
    // the aisle. Drawn from the SAME plan the stock is placed from, so a bay
    // can never end up somewhere no car ever parks — which is what happened
    // when the two were written out separately.
    for (const [side, bz] of [[1, NORTH_Z], [-1, SOUTH_Z]] as [number, number][]) {
      for (let i = 0; i <= BAYS; i++) {
        const bx = bayX(i) - BAY_PITCH / 2 + (side < 0 ? BAY_PITCH / 2 : 0);
        const bay = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 5.0), bayM);
        bay.rotation.x = -Math.PI / 2;
        bay.rotation.z = side > 0 ? HERR : -HERR;
        bay.position.set(bx, Y + 0.006, bz);
        scene.add(bay);
        if (i < BAYS && (i * 3 + (side > 0 ? 0 : 1)) % 4 !== 2) {
          const oil = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), oilM);
          oil.rotation.x = -Math.PI / 2;
          oil.position.set(bx + BAY_PITCH / 2, Y + 0.004, bz - side * 0.5);
          scene.add(oil);
        }
      }
    }

    // ── the frontage fence ───────────────────────────────────────────────
    // The user: *"the banners float because there is nothing behind them …
    // build the FENCE first, then hang banners on it"*. They were right, and
    // the reason is worth writing down: a chain-link fence at 15 m is not read
    // from its mesh. The mesh is sub-pixel at that range whatever you do to
    // it. It is read from its FRAMEWORK — posts, top rail, bottom rail, the
    // barbed arms against the sky — and this had a top rail and posts every
    // 2.6 m and nothing else, so there was nothing left to see.
    //
    // So the framework comes first and the mesh fills it in, which is also the
    // order it is built in reality. It rides on the site's own low wall, and
    // it stops where that wall stops, so the mouth stays open by construction
    // rather than by a number kept in two places.
    const MESH_TOP = 2.05;
    const wallTop = Y + 0.62;
    const POST_PITCH = 2.4;
    const runs: [number, number][] = [
      [zS + 0.3, zS + span * SITE_GATE],
      [zN - span * SITE_GATE, zN - 0.3],
    ];
    const FENCE_X = X0 + 0.18;
    for (const [rz0, rz1] of runs) {
      const len = rz1 - rz0, h = MESH_TOP - wallTop;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, h), linkPanel(len, h));
      mesh.position.set(FENCE_X, wallTop + h / 2, (rz0 + rz1) / 2);
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      // top rail and bottom rail. The bottom one is the tension rail sitting
      // on the wall, and it is what stops the fence reading as mesh floating
      // above a kerb.
      for (const [ry, t] of [[MESH_TOP, 0.07], [wallTop + 0.04, 0.05]] as [number, number][]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), postM);
        rail.position.set(FENCE_X, ry, (rz0 + rz1) / 2);
        scene.add(rail);
      }
      const n = Math.max(1, Math.round(len / POST_PITCH));
      for (let i = 0; i <= n; i++) {
        const pz = rz0 + len * (i / n);
        // terminal posts are fatter than line posts, which is true and is also
        // what puts a visible full stop at each side of the opening
        const term = i === 0 || i === n;
        const w = term ? 0.12 : 0.085;
        const post = new THREE.Mesh(new THREE.BoxGeometry(w, MESH_TOP - Y + 0.08, w), postM);
        post.position.set(FENCE_X, Y + (MESH_TOP - Y + 0.08) / 2, pz);
        scene.add(post);
        // BARBED ARMS, leaning INTO the lot. Three strands on a raked arm is
        // the most legible thing on the whole fence from across the street —
        // it is a hard silhouette against sky where the mesh is nothing — and
        // it is what a lot with stock on it actually has. Inward, not out:
        // nothing this module builds may lean over the walk.
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), postM);
        arm.position.set(FENCE_X + 0.10, MESH_TOP + 0.18, pz);
        arm.rotation.z = -0.52;
        scene.add(arm);
      }
      for (let k = 0; k < 3; k++) {
        const wire = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, len), postM);
        wire.position.set(FENCE_X + 0.06 + k * 0.07, MESH_TOP + 0.10 + k * 0.13, (rz0 + rz1) / 2);
        scene.add(wire);
      }
    }

    // ── the rolling gate ─────────────────────────────────────────────────
    // A lot this size does not have a swing gate; it has a CANTILEVER ROLLER
    // that runs on a track along the inside of the fence. By day it is parked
    // open against the fence with the chain and padlock hanging off the
    // catch, which is the detail that says it gets shut every night. The
    // frame is the giveaway: a top and bottom rail with a diagonal brace and
    // a counterweight tail sticking out past the last upright.
    const gz0 = zN - span * SITE_GATE, gz1 = zS + span * SITE_GATE;   // the mouth
    {
      const GH = 1.9, GL = 5.6;                       // leaf height and length
      const gx = X0 + 0.44;                           // inboard of the fence line
      // Parked open means parked CLEAR. At gz0 + 1.4 the leaf's south end sat
      // 1.4 m inside its own opening and its collider ate that much of the
      // gap — a gate that blocks the gateway it is holding open. Half a leaf
      // plus a little puts the whole thing north of the mouth, which is where
      // a cantilever actually sits when it is rolled back.
      const gc = gz0 + GL / 2 + 0.3;
      const frameM = postM;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GL, GH - 0.16), linkPanel(GL, GH - 0.16));
      mesh.position.set(gx, Y + 0.08 + (GH - 0.16) / 2, gc);
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      const bar = (w: number, h: number, d: number, bx: number, by: number, bz: number, rz = 0) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameM);
        m.position.set(bx, by, bz); if (rz) m.rotation.x = rz;
        scene.add(m);
      };
      bar(0.07, 0.07, GL, gx, Y + GH, gc);                     // top rail
      bar(0.07, 0.07, GL, gx, Y + 0.08, gc);                   // bottom rail, the track runner
      for (const o of [-GL / 2, -GL / 6, GL / 6, GL / 2]) bar(0.06, GH, 0.06, gx, Y + GH / 2, gc + o);
      // the diagonal brace, which is what makes it read as a gate and not a
      // fence panel that happens to be standing in the wrong place
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, Math.hypot(GL, GH) - 0.3, 0.05), frameM);
      brace.position.set(gx, Y + GH / 2, gc);
      brace.rotation.x = Math.atan2(GL, GH);
      scene.add(brace);
      // the counterweight tail past the last upright — cantilever rollers are
      // held up by the tail, not by a wheel on the ground
      bar(0.07, 0.07, 1.7, gx, Y + GH, gc + GL / 2 + 0.85);
      bar(0.06, GH * 0.55, 0.06, gx, Y + GH - GH * 0.28, gc + GL / 2 + 0.8);
      // the track the roller runs on, in the ground along the fence
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, GL + 2.6),
        new THREE.MeshBasicMaterial({ color: 0x54585e }));
      track.position.set(gx, Y + 0.02, gc + 0.4);
      scene.add(track);
      solid({ minX: gx - 0.12, maxX: gx + 0.12, minZ: gc - GL / 2, maxZ: gc + GL / 2 });
      // the chain and padlock, hanging off the catch post at the open end
      const chainM = new THREE.MeshBasicMaterial({ color: 0x8a9098 });
      const cpx = X0 + 0.22, cpz = gz0 - 0.1;
      const catchPost = new THREE.Mesh(new THREE.BoxGeometry(0.09, GH + 0.1, 0.09), frameM);
      catchPost.position.set(cpx, Y + (GH + 0.1) / 2, cpz);
      scene.add(catchPost);
      for (let i2 = 0; i2 < 7; i2++) {                 // links, hanging in a slack curve
        const t2 = i2 / 6;
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 4, 7), chainM);
        link.rotation.y = i2 % 2 ? 0 : Math.PI / 2;
        link.position.set(cpx + 0.06, Y + 1.24 - t2 * 0.52 - 0.10 * Math.sin(t2 * Math.PI),
          cpz + 0.05 + t2 * 0.16);
        scene.add(link);
      }
      const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x8a7440 }));
      lockBody.position.set(cpx + 0.06, Y + 0.66, cpz + 0.22);
      scene.add(lockBody);
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 4, 8), chainM);
      shackle.position.set(cpx + 0.06, Y + 0.72, cpz + 0.22);
      scene.add(shackle);
    }

    // ── bunting ──────────────────────────────────────────────────────────
    // The flags hang from their OWN poles, clear above everything else, which
    // is both how it is really done and the answer to "what is holding that
    // up". Each swag is four short segments following a parabola, because the
    // SAG is the whole read: strung level it is a painted stripe, and only the
    // dip between poles says plastic on a string.
    const PEN_M = 1.6;                               // one tile of four flags
    const POLE_H = 3.1, SAG = 0.62;
    const buntSeg = (za: number, ya: number, zb: number, yb: number) => {
      const t = pennantT.clone();
      t.wrapS = THREE.RepeatWrapping;
      const len = Math.hypot(zb - za, yb - ya);
      t.repeat.set(len / PEN_M, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.62),
        new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide }));
      m.position.set(FENCE_X, (ya + yb) / 2, (za + zb) / 2);
      m.rotation.y = Math.PI / 2;
      m.rotation.z = Math.atan2(yb - ya, zb - za);
      scene.add(m);
    };
    const SWAGS = 3, SEGS = 4;
    for (let i = 0; i <= SWAGS; i++) {
      const pz = zN - (span / SWAGS) * i;
      const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, POLE_H, 6), postM);
      bp.position.set(FENCE_X, Y + POLE_H / 2, pz);
      scene.add(bp);
    }
    for (let i = 0; i < SWAGS; i++) {
      const a = zN - (span / SWAGS) * i, b = zN - (span / SWAGS) * (i + 1);
      const yAt = (u: number) => Y + POLE_H - SAG * 4 * u * (1 - u);
      for (let sg = 0; sg < SEGS; sg++) {
        const u0 = sg / SEGS, u1 = (sg + 1) / SEGS;
        buntSeg(a + (b - a) * u0, yAt(u0), a + (b - a) * u1, yAt(u1));
      }
    }

    // ── the office ───────────────────────────────────────────────────────
    // ACROSS THE BACK, square on the aisle, so it faces you the whole way in
    // and whoever is inside watches the entire lot through one window. At the
    // front corner it was a hut you walked past on your way to the cars.
    const CW = OFF_W, CD = OFF_D, CH = OFF_H;
    const cx = OFF_X, cz = zMid;
    const cabM = flat(cabinT), cabWinM = flat(cabinWinT);
    const roofM = new THREE.MeshBasicMaterial({ color: 0x5a5f66 });
    // Face 0 is +x and face 1 is -x. The window used to be on 0, which put it
    // on the BACK of the cabin looking at a brick flank, while the door, the
    // step and the name board were all on the front. Everything is on -x now.
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(CD, CH, CW),
      [cabM, cabWinM, roofM, roofM, cabM, cabM]);
    cabin.position.set(cx, Y + CH / 2, cz);
    scene.add(cabin);
    solid({ minX: cx - CD / 2, maxX: cx + CD / 2, minZ: cz - CW / 2, maxZ: cz + CW / 2 });
    // a step up to the door, because a portable sits on blocks
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.0), new THREE.MeshBasicMaterial({ color: 0x8b867e }));
    step.position.set(cx - CD / 2 - 0.35, Y + 0.11, cz - 1.2);
    scene.add(step);
    // the hand-lettered board over the window
    // 9 characters at 6 texels each and 2 px per texel is 108 px — the board
    // was 80 and clipped the name to "CROSSTO". Size the canvas from the
    // string rather than guessing at it.
    const BOARD_W = 'CROSSTOWN'.length * 6 * 2 + 8;
    const boardT = pixTex(BOARD_W, 26, (g) => {
      g.fillStyle = '#25406b'; g.fillRect(0, 0, BOARD_W, 26);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, BOARD_W, 2);
      stamp(g, 'CROSSTOWN', 4, 4, 2, '#e8dcb8');
      stamp(g, 'AUTO SALES', 4, 16, 1, '#d8a72e');
      dither(g, BOARD_W, 26, 30);
    });
    // ABOVE the glass, not across it. The window's top texel row puts it at
    // 2.16 m and the board was centred at 2.05 with 0.85 of height, so it lay
    // over the top quarter of the window — invisible until the blinds went in
    // and gave the glass something to be covered up. Both numbers now come
    // off the same texture: window top at (1 - WY/40) * CH.
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.46), flat(boardT));
    board.position.set(cx - CD / 2 - 0.03, Y + 2.42, cz);
    board.rotation.y = -Math.PI / 2;
    scene.add(board);

    // THE WINDOW AC UNIT. Half in and half out of a hole cut through the wall
    // beside the window, which is the only way one was ever fitted to a
    // portable, and it drips on the step below it. Face 1 is -x, the front.
    const acM = flat(acT), acCase = new THREE.MeshBasicMaterial({ color: 0xa9a496 });
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.40, 0.50),
      [acCase, acM, acCase, acCase, acCase, acCase]);
    // Clear of the glass: the window runs to cz + 1.725, so the unit sits in
    // the strip of wall outboard of it rather than through the pane.
    ac.position.set(cx - CD / 2 - 0.13, Y + 1.45, cz + 1.99);
    scene.add(ac);
    // the bracket under it, because nothing holds up 30 kg of steel but angle
    // iron and hope
    for (const bz of [-0.2, 0.2]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.04), postM);
      br.position.set(cx - CD / 2 - 0.17, Y + 1.23, cz + 1.99 + bz);
      br.rotation.z = 0.42;
      scene.add(br);
    }
    // the rust streak it has run down the wall for years
    const dripM = decal(new THREE.MeshBasicMaterial({ color: 0x8a6a44, transparent: true, opacity: 0.30 }));
    const drip = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.1), dripM);
    drip.position.set(cx - CD / 2 - 0.02, Y + 0.70, cz + 1.99);
    drip.rotation.y = -Math.PI / 2;
    scene.add(drip);

    // THE SATELLITE DISH, on the roof edge and aimed at nothing in particular.
    // A dish reads from three things and none of them is the dish: the ELLIPSE
    // it makes when it is not pointed at you, the stalk, and the LNB arm
    // sticking out of the middle of it. Drawn as a shallow spherical cap so
    // the ellipse is real geometry and holds up from every angle.
    {
      const dishM = new THREE.MeshBasicMaterial({ color: 0xd8d4c6, side: THREE.DoubleSide });
      const dz = cz - CW / 2 + 0.7, dx = cx - CD / 2 + 0.45;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), postM);
      mast.position.set(dx, Y + CH + 0.31, dz);
      scene.add(mast);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.7), dishM);
      dish.position.set(dx, Y + CH + 0.66, dz);
      dish.rotation.x = -Math.PI / 2 + 0.55;      // tilted up at the sky
      dish.rotation.z = -0.5;
      scene.add(dish);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.34), postM);
      arm.position.set(dx - 0.16, Y + CH + 0.70, dz - 0.10);
      arm.rotation.y = 0.5; arm.rotation.x = 0.5;
      scene.add(arm);
      const lnb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.11),
        new THREE.MeshBasicMaterial({ color: 0x6a6258 }));
      lnb.position.set(dx - 0.29, Y + CH + 0.80, dz - 0.18);
      scene.add(lnb);
    }

    // ── the salesman ─────────────────────────────────────────────────────
    // The office comment has always said "whoever is inside watches you come
    // in". Nobody was inside. He is out on the apron by the step instead,
    // turned down the aisle, which is better — you see him the moment you are
    // through the gate and he has seen you first.
    //
    // ONE CALL to H's citizenSprite, per notes/CITIZEN-STYLE.md: he gets the
    // same 5-view atlas and 8-angle turn every citizen on the street gets. The
    // note exists because four people in this world are cardboard from being
    // hand-drawn as single-view planes, and a lot salesman on a billboard
    // quad would have been the fifth.
    //
    // 1997, and dressed by the same person who chose the bunting: a loud
    // jacket over cheap slacks, broad build, and the stride wound right down
    // because he is not going anywhere — he is standing at his door.
    const salesman = citizenSprite(
      // `coat`, not `dress` — `dress` is a dress, and the first cut put the
      // lot's salesman in one. The Look fields are not adjectives, they name
      // actual garments the atlas paints; read shots/citizen-range.png before
      // picking one rather than guessing from the word.
      { jacket: '#8c4a2c', pants: '#3c4048', skin: '#d8a878', hair: '#3a2e26',
        fit: 'coat', cut: 'short', build: 1, stride: 1 },
      { facing: -Math.PI / 2, h: 1.02, w: 1.04 },
    );
    salesman.mesh.position.set(cx - CD / 2 - 1.25, Y, cz - 1.05);
    scene.add(salesman.mesh);
    o.onFrame?.((f) => salesman.update(f.px, f.pz, f.dt));

    // ── the pole sign ────────────────────────────────────────────────────
    // Taller than the building next to it, which is the point: a lot has no
    // building worth seeing, so the sign IS the building. Read from four
    // blocks away, which is why the phone number is set larger than the name
    // — the name is decoration, the number is the entire business.
    //
    // It stands INSIDE the fence. A real one would be out over the pavement,
    // but nothing may encroach the walk, so it goes just east of the line and
    // gets its height instead.
    // BESIDE the opening, not in it. It stood 1.4 m inside the mouth, which
    // put a 0.48 m concrete pole squarely in the lane a car has to drive down
    // — the walk test stopped dead on it. North of the mouth's edge it is
    // still the first thing you see from the kerb and nothing has to drive
    // round it.
    const px = X0 + 0.90, pz = zN - span * SITE_GATE + 0.95;
    const POLE_H2 = 15.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, POLE_H2, 8), postM);
    pole.position.set(px, Y + POLE_H2 / 2, pz);
    scene.add(pole);
    solid({ minX: px - 0.24, maxX: px + 0.24, minZ: pz - 0.24, maxZ: pz + 0.24 });
    const signT = pixTex(72, 96, (g) => {
      g.fillStyle = '#c0392f'; g.fillRect(0, 0, 72, 96);
      g.fillStyle = '#f2ead0'; g.fillRect(3, 3, 66, 90);
      g.fillStyle = '#c0392f'; g.fillRect(6, 6, 60, 30);
      stamp(g, 'CROSSTOWN', 3, 10, 1, '#f2ead0');
      stamp(g, 'AUTO SALES', 3, 20, 1, '#e0a81c');
      g.fillStyle = '#25406b'; g.fillRect(6, 40, 60, 14);
      stamp(g, 'USED CARS', 9, 44, 1, '#f2ead0');
      // the number, deliberately too big for the cabinet — the one thing on
      // the sign anybody was ever meant to act on
      g.fillStyle = '#2a2118'; g.fillRect(6, 58, 60, 32);
      stamp(g, '555', 12, 62, 3, '#e0a81c');
      stamp(g, '0199', 8, 76, 3, '#e0a81c');
      dither(g, 72, 96, 50);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), flat(signT));
    sign.position.set(px + 0.02, Y + POLE_H2 - 1.9, pz);
    sign.rotation.y = -Math.PI / 2;
    scene.add(sign);
    // a small arrow cabinet under it, pointing at the mouth
    const arrowT = pixTex(40, 16, (g) => {
      g.fillStyle = '#e0a81c'; g.fillRect(0, 0, 40, 16);
      g.fillStyle = '#2a2118'; g.fillRect(0, 0, 40, 2); g.fillRect(0, 14, 40, 2);
      for (let i2 = 0; i2 < 7; i2++) g.fillRect(6 + i2 * 2, 8 - i2, 2, 1 + i2 * 2);
      dither(g, 40, 16, 16);
    });
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), flat(arrowT));
    arrow.position.set(px + 0.02, Y + POLE_H2 - 4.1, pz);
    arrow.rotation.y = -Math.PI / 2;
    scene.add(arrow);

    // ── vinyl banners, zip-tied to the chain-link ────────────────────────
    // Cheap vinyl does not hang flat. It is punched with grommets, zip-tied
    // at four or five points, and it SAGS between every tie — that scalloped
    // bottom edge is the whole read, and a rectangle pinned taut reads as a
    // shopfront fascia instead. Drawn into the texture with alpha: the tie
    // points are straight and the cloth falls away between them.
    // `ghost` paints the BACK of the sheet. A vinyl banner is printed on one
    // face; the reverse is the blank stock with the ink showing dimly through
    // it, so the back is the same artwork washed out and knocked back — never
    // the same crisp colour. The seam audit found these 12 faces reading
    // mirrored from inside the lot, and the mirroring is RIGHT for single-ply
    // vinyl — what was wrong is that the back was as saturated as the front,
    // which is what made a correct reversal look like a mistake.
    // NOTE ON `ghost` AND MIRRORING, because getting one right broke the
    // other: the back of a printed sheet is BOTH washed out AND reversed.
    // Turning the back plane round to face into the lot fixed the saturation
    // and quietly un-reversed the text — the ghost read "NO CREDIT NO PROBLEM"
    // forwards, which is a sheet printed on both sides, not a sheet seen from
    // behind. The texture is flipped on its own U axis to put it back.
    const bannerT2 = (words: string, bg: string, ink: string, ghost = false) => {
      const W = Math.max(64, words.length * 6 * 2 + 14), H = 30;
      const TIES = Math.max(2, Math.round(W / 46));
      return pixTex(W, H, (g) => {
        g.clearRect(0, 0, W, H);
        for (let x = 0; x < W; x++) {
          // a scallop per bay between ties, plus a slow overall droop
          const u = (x / W) * TIES;
          const sag = 3.2 * Math.sin((u % 1) * Math.PI) + 1.4 * Math.sin((x / W) * Math.PI);
          const top = 1 + 0.8 * Math.sin((u % 1) * Math.PI);
          g.fillStyle = bg;
          g.fillRect(x, Math.round(top), 1, Math.round(H - 6 - top + sag));
        }
        g.fillStyle = 'rgba(0,0,0,0.20)';
        for (let x = 0; x < W; x++) {
          const u = (x / W) * TIES;
          const sag = 3.2 * Math.sin((u % 1) * Math.PI) + 1.4 * Math.sin((x / W) * Math.PI);
          g.fillRect(x, Math.round(H - 7 + sag), 1, 2);           // shadowed lower hem
        }
        stamp(g, words, 7, 10, 2, ink);
        if (ghost) { g.fillStyle = 'rgba(228,226,216,0.72)'; g.fillRect(0, 0, W, H); }
        g.fillStyle = '#d8d4c8';                                   // the zip ties
        for (let t2 = 0; t2 <= TIES; t2++) {
          const x = Math.round((t2 / TIES) * (W - 3));
          g.fillRect(x, 0, 3, 4);
        }
        dither(g, W, H, 30);
      });
    };
    const banners: [string, string, string, number][] = [
      ['BUY HERE PAY HERE', '#c0392f', '#f2ead0', 0.16],
      ['NO CREDIT NO PROBLEM', '#25406b', '#f2ead0', 0.40],
      ['99 DOWN WE FINANCE', '#e0a81c', '#2a2118', 0.63],
      ['SE HABLA ESPANOL', '#2f7a4a', '#f2ead0', 0.85],
    ];
    for (const [words, bg, ink, at] of banners) {
      const w = words.length * 0.17 + 0.5;
      const y = MESH_TOP - 0.06 - 0.31, z = zN - span * at;
      // TWO sheets, not one DoubleSide plane, because the two faces are not
      // the same picture. DoubleSide can only ever show one texture from both
      // sides; printed vinyl has ink on the front and a ghost of it on the
      // back. The front looks at the street, the back looks into the lot, and
      // the reversal comes for free from the orientation rather than from a
      // second mirrored canvas.
      //
      // On the street face of the mesh with its top edge just under the top
      // rail, which is where a grommeted banner is cable-tied. Hung at a
      // height picked by eye before, which is how it ended up floating clear
      // of a fence it was supposed to be attached to.
      for (const [gh, dx, ry] of [[false, -0.055, -Math.PI / 2], [true, -0.045, Math.PI / 2]] as
        [boolean, number, number][]) {
        const bt = bannerT2(words, bg, ink, gh);
        if (gh) { bt.wrapS = THREE.RepeatWrapping; bt.repeat.x = -1; bt.offset.x = 1; }
        const b = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.62),
          new THREE.MeshBasicMaterial({ map: bt, alphaTest: 0.35 }));
        b.position.set(FENCE_X + dx, y, z);
        b.rotation.y = ry;
        scene.add(b);
      }
    }

    // ── the back wall ────────────────────────────────────────────────────
    // The queue said to check this once the layout changed, and the answer was
    // no: with the office at the far end, the back wall is now the thing you
    // look at for the entire 23 m walk down the aisle, and it was 13.8 m of
    // blank brick. The office helps at the bottom of it and nothing helps
    // above that.
    //
    // The wall is D's and I am not touching it. What goes ON it is mine, and
    // what a wall like this really carries is two layers from two different
    // decades, which is also what explains why an empty lot has a four-storey
    // brick face at the back of it in the first place:
    //
    //   1. a GHOST SIGN from whoever was there before the demolition, painted
    //      straight onto brick and eaten by fifty years of weather
    //   2. the lot's OWN vinyl banner, strung across it last year
    //
    // Both hang 8 cm proud. GOTCHAS §6 — coplanar surfaces must abut, never
    // overlap, and a painted sign 1 cm off a brick wall is a z-fight.
    const BW_X = X1 - 0.08;

    // THE GHOST SIGN. Letters are the easy half; the ERODING is what makes it
    // fifty years old rather than badly printed. Paint fails from the top down
    // and along the weather side, because that is where the rain runs, so the
    // survival chance is a function of height and a deterministic hash — not
    // uniform noise, which reads as dither rather than as decay.
    const GW = 168, GH2 = 66;
    const ghostT = pixTex(GW, GH2, (g) => {
      g.clearRect(0, 0, GW, GH2);
      const ink = (x: number, y: number, w: number, h: number) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          const t = yy / GH2;                             // 0 top, 1 bottom
          const hash = ((xx * 73856093) ^ (yy * 19349663)) >>> 0;
          const wear = 0.30 + 0.62 * t - 0.22 * (xx / GW);   // top and left go first
          if ((hash % 100) / 100 > wear) continue;
          g.fillStyle = (hash % 7) ? 'rgba(226,218,198,0.50)' : 'rgba(238,232,214,0.62)';
          g.fillRect(xx, yy, 1, 1);
        }
      };
      const line = (txt: string, y: number, px: number) => {
        const w = (txt.length - 1) * 6 * px + 5 * px;
        const x0 = Math.round((GW - w) / 2);
        for (let i = 0; i < txt.length; i++) {
          const rows = GLYPH[txt[i]] ?? GLYPH[' '];
          for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            if (rows[r] & (1 << (4 - c))) ink(x0 + (i * 6 + c) * px, y + r * px, px, px);
          }
        }
      };
      ink(10, 3, GW - 20, 2);                             // the painted rule above
      line('MERCER BROS', 9, 2);
      line('DRY GOODS', 25, 2);
      ink(30, 40, GW - 60, 1);
      line('WHOLESALE AND RETAIL', 45, 1);
      ink(10, 58, GW - 20, 2);                            // and below
    });
    const ghost = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 5.5),
      decal(new THREE.MeshBasicMaterial({ map: ghostT, transparent: true, depthWrite: false })));
    ghost.position.set(BW_X, Y + 9.2, zMid);
    ghost.rotation.y = -Math.PI / 2;
    scene.add(ghost);

    // THE LOT'S OWN BANNER, above the office and below the ghost sign, in the
    // same red the flag and the price cards use. Same sagging vinyl as the
    // ones on the fence, at the scale the far end of the aisle needs.
    // STACKED, both centred on the aisle. Side by side they ended up 0.18 m
    // apart and read as one long strip with a colour change in the middle —
    // two banners have to be separated by more than the eye needs to see a
    // gap, and above a doorway the gap that reads is vertical.
    for (const [words, bg, ink2, hy, hgt] of [
      ['WE FINANCE ANYONE', '#c0392f', '#f2ead0', 4.85, 1.15],
      ['CALL 555 0199', '#25406b', '#e0a81c', 3.55, 0.90],
    ] as [string, string, string, number, number][]) {
      // Same two-sheet treatment. These hang on a wall, so the back is never
      // seen — but a banner whose back only exists when someone might look at
      // it is a banner that will be wrong the day the wall comes down.
      for (const [gh, dx, ry] of [[false, -0.02, -Math.PI / 2], [true, 0.0, Math.PI / 2]] as
        [boolean, number, number][]) {
        const bt2 = bannerT2(words, bg, ink2, gh);
        if (gh) { bt2.wrapS = THREE.RepeatWrapping; bt2.repeat.x = -1; bt2.offset.x = 1; }
        const b2 = new THREE.Mesh(new THREE.PlaneGeometry(words.length * 0.32 + 0.6, hgt),
          new THREE.MeshBasicMaterial({ map: bt2, alphaTest: 0.35 }));
        b2.position.set(BW_X + dx, Y + hy, zMid);
        b2.rotation.y = ry;
        scene.add(b2);
      }
    }

    // ── the stock ────────────────────────────────────────────────────────
    // H's fleet, angled at the street so you read the whole row at once —
    // which is the entire reason a lot parks its cars crooked. Each one gets
    // a price card taped inside the windshield.
    // Size the card from the string, the same lesson the office board taught:
    // four digits at 6 texels and 2 px per texel is 48 px, and on a 26 px
    // canvas that clipped to a blank card with a sliver of the first digit.
    // ── what is written on the glass ─────────────────────────────────────
    // The windshield price is the ICON of this whole typology, and it has a
    // vocabulary. A real lot mixes three treatments and leaves some cars
    // blank, because the blank ones are the ones that came in this week.
    //
    // SOAPED NUMBERS. Written straight on the glass with a paint pen by
    // somebody standing in a lot, so they must not be typeset: every glyph
    // gets a deterministic wobble in baseline and a fat three-texel stroke
    // with a bitten edge. Straight and even reads as signage; wonky reads as
    // a hand. That is the whole difference.
    const soapT = (price: string) => {
      const px = 3, W = price.length * 6 * px + 10, H = 5 * px + 12;
      return pixTex(W, H, (g) => {
        g.clearRect(0, 0, W, H);
        for (let i = 0; i < price.length; i++) {
          const rows = GLYPH[price[i]] ?? GLYPH[' '];
          const jy = ((i * 7) % 3) - 1, jx = ((i * 11) % 3) - 1;   // the wobble
          for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            if (!(rows[r] & (1 << (4 - c)))) continue;
            g.fillStyle = ((r * 3 + c + i) % 6) ? 'rgba(244,247,250,0.94)' : 'rgba(222,230,238,0.66)';
            g.fillRect(5 + (i * 6 + c) * px + jx, 6 + r * px + jy, px, px);
          }
        }
      });
    };
    // STARBURST CARD. The sunburst outline is the other half of the icon —
    // a hard-edged star, not a soft glow, so the points are drawn as a square
    // wave in angle rather than tapered.
    const burstT = (price: string) => {
      const N = 56, C = N / 2;
      return pixTex(N, N, (g) => {
        g.clearRect(0, 0, N, N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
          const spike = Math.cos(a * 11) > 0 ? 1 : 0;
          if (d <= C * (0.68 + 0.30 * spike)) { g.fillStyle = '#e0a81c'; g.fillRect(x, y, 1, 1); }
        }
        g.fillStyle = '#f2ead0';
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          if (dx * dx + dy * dy <= (C * 0.60) ** 2) g.fillRect(x, y, 1, 1);
        }
        // 1 px per texel, not 2: the inner disc is only C*1.2 across and a
        // five-character price at 2 px is 60 px against a 34 px disc, so it
        // spilled under the spikes. Centred off the string length.
        stamp(g, price, C - price.length * 3, C - 3, 1, '#c0392f');
      });
    };
    // SLOGAN CARD. Small, propped in the corner of the glass.
    const slogT = (words: string, bg: string, ink: string) => {
      const W = words.length * 6 * 2 + 8;
      return pixTex(W, 18, (g) => {
        g.fillStyle = bg; g.fillRect(0, 0, W, 18);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 16, W, 2);
        stamp(g, words, 4, 4, 2, ink);
      });
    };
    // SOLD, across the glass at an angle, on the one that has gone.
    const soldT = () => {
      const W = 4 * 6 * 3 + 12;
      return pixTex(W, 26, (g) => {
        g.fillStyle = '#c0392f'; g.fillRect(0, 0, W, 26);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, W, 2);
        stamp(g, 'SOLD', 6, 5, 3, '#f2ead0');
      });
    };

    // Prices are 1997 and cheap, and they end in 95 or 99 far more often than
    // they end in a round number, because that is what a lot writes.
    type Treat = 'soap' | 'burst' | 'card' | 'slip' | 'sold' | 'bare';
    interface Unit { kind: CarKind; col: number; price?: string; treat: Treat; slog?: string }
    // Treatments in an authored order rather than a random one: a lot has a
    // FRONT — the carded, priced, polished end that faces the street — and a
    // back, where the older stock and the ones not for sale sit. Reading down
    // this list is reading from the pavement to the back fence.
    const STOCK: Unit[] = [
      { kind: 'sedan', col: 1, price: '$1995', treat: 'soap' },
      { kind: 'pickup', col: 3, price: '$2495', treat: 'burst', slog: 'RUNS GREAT' },
      { kind: 'hatch', col: 0, price: '$899', treat: 'soap' },
      { kind: 'van', col: 4, price: '$1295', treat: 'card', slog: 'AS IS' },
      { kind: 'sedan', col: 5, price: '$2295', treat: 'burst', slog: '1 OWNER' },
      { kind: 'hatch', col: 2, price: '$795', treat: 'slip' },
      { kind: 'pickup', col: 0, price: '$3495', treat: 'soap' },
      { kind: 'sedan', col: 3, treat: 'sold' },
      { kind: 'van', col: 1, price: '$1495', treat: 'card', slog: 'AS IS' },
      { kind: 'hatch', col: 5, price: '$695', treat: 'soap' },
      { kind: 'sedan', col: 2, price: '$1795', treat: 'burst' },
      { kind: 'pickup', col: 4, treat: 'bare' },
      { kind: 'sedan', col: 0, price: '$999', treat: 'slip' },
      { kind: 'hatch', col: 3, treat: 'bare' },
      { kind: 'van', col: 2, treat: 'bare' },
      { kind: 'sedan', col: 4, price: '$2795', treat: 'card', slog: 'RUNS GREAT' },
    ];
    // THE FTC BUYERS GUIDE. Required in the side window of every used car
    // offered for sale in the United States since 1985, which makes its
    // ABSENCE the thing that looks wrong to anyone who was ever on a lot —
    // and makes it the most authentic detail available here. It is a small
    // portrait sticker: black masthead, the two big AS-IS / WARRANTY boxes,
    // and the yellow band across the lower half.
    //
    // At 0.20 m across it is four texels of text, so it is drawn as the
    // PATTERN rather than as words — masthead, two boxes, yellow band, rule
    // lines. That silhouette is what the eye recognises; the wording is not
    // legible on a real one from outside the glass either.
    const guideT = pixTex(20, 26, (g) => {
      g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, 20, 26);
      g.fillStyle = '#1a1a1c'; g.fillRect(0, 0, 20, 4);            // masthead
      g.fillStyle = '#f2f0e8'; g.fillRect(2, 1, 16, 2);
      g.fillStyle = '#1a1a1c';
      g.fillRect(2, 6, 7, 5); g.fillRect(11, 6, 7, 5);             // the two boxes
      g.fillStyle = '#f2f0e8'; g.fillRect(3, 7, 5, 3); g.fillRect(12, 7, 5, 3);
      g.fillStyle = '#1a1a1c'; g.fillRect(3, 8, 2, 2);             // one ticked
      g.fillStyle = '#e8c81e'; g.fillRect(0, 13, 20, 7);           // the yellow band
      g.fillStyle = 'rgba(0,0,0,0.55)';
      for (let y = 14; y < 19; y += 2) g.fillRect(2, y, 16, 1);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let y = 21; y < 26; y += 2) g.fillRect(2, y, 15, 1);
      g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(0, 0, 20, 1);  // tape sheen
    });
    const guideM = new THREE.MeshBasicMaterial({ map: guideT, side: THREE.DoubleSide });
    /** Tape one inside the front door window, on whatever car this is.
     *
     *  The first cut put it at a fixed (x, y, z) and it hung in mid-air off
     *  the rear quarter of a sedan, where there is no glass at all. The
     *  greenhouse is not the same shape on the four kinds and it is H's to
     *  change, so guessing its numbers is guessing twice. Instead: find the
     *  lofted cabin in the car H just handed back — it is the one mesh with a
     *  three-material array — and read the window off its own bounding box.
     *  Beltline is box.min.y, the flank is box.max.x, the cabin front is
     *  box.min.z. A sticker sits low in the front door glass, which is
     *  0.15 m up and 0.35 m back of the cabin's nose on every one of them. */
    const buyersGuide = (g0: THREE.Group) => {
      let cabin: THREE.Mesh | null = null;
      g0.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && Array.isArray((o as THREE.Mesh).material)
          && ((o as THREE.Mesh).material as THREE.Material[]).length === 3) cabin = o as THREE.Mesh;
      });
      if (!cabin) return;                      // no greenhouse, no window, no sticker
      const c = cabin as THREE.Mesh;
      c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox!;
      // BOTH flanks. A real one is in a single window, but sixteen cars are
      // parked nose-out in rows and you walk the aisle down one side of them,
      // so a sticker in the far window is a sticker nobody ever sees — which
      // is exactly what the first pass shipped. Two is cheap; invisible is not.
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.22), guideM);
        // +6 mm proud of the flank: the glass tapers inward with height, so a
        // sticker flush at the beltline would sink into it further up.
        m.position.set(sx * (bb.max.x + 0.006), bb.min.y + 0.15, bb.min.z + 0.35);
        m.rotation.y = sx * Math.PI / 2;
        g0.add(m);
      }
    };
    // Balloons on the antennas. Lot dressing tied ON to the car, not a change
    // to it — H's fleet is untouched. Two of them have been up a week and are
    // down to a wrinkled bag, which is what sells the rest as recent.
    const balloonM = [
      new THREE.MeshBasicMaterial({ color: 0xc0392f }),
      new THREE.MeshBasicMaterial({ color: 0xe0a81c }),
      new THREE.MeshBasicMaterial({ color: 0x2f5f9c }),
    ];
    const stringM = new THREE.MeshBasicMaterial({ color: 0xd8d4c8 });
    const balloon = (g0: THREE.Group, ci: number, dead: boolean) => {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.5, 0.015), stringM);
      rod.position.set(-0.72, 1.35, -0.55);
      rod.rotation.z = 0.12;
      g0.add(rod);
      const b = new THREE.Mesh(new THREE.SphereGeometry(dead ? 0.075 : 0.13, 7, 5), balloonM[ci % 3]);
      b.scale.set(dead ? 1.5 : 0.92, dead ? 0.42 : 1.12, dead ? 0.9 : 0.92);
      b.position.set(-0.75, dead ? 1.44 : 1.72, -0.56);
      g0.add(b);
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.01, dead ? 0.12 : 0.3, 0.01), stringM);
      str.position.set(-0.74, dead ? 1.53 : 1.48, -0.56);
      g0.add(str);
    };

    /** hang a thing on the windshield of a car group, in the car's own frame */
    const onGlass = (g0: THREE.Group, t: THREE.Texture, w: number, h: number,
                     y: number, z: number, rz = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide }));
      m.position.set(0, y, z);
      m.rotation.y = Math.PI;
      m.rotation.z = rz;
      g0.add(m);
    };
    // Bay list, straight off THE PLAN: every place a car stands, both flanks,
    // street end first so the near bays fill before the far ones.
    const BAY: { x: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < BAYS; i++) {
      BAY.push({ x: bayX(i), z: NORTH_Z, yaw: HERR });
      BAY.push({ x: bayX(i) + BAY_PITCH / 2, z: SOUTH_Z, yaw: -HERR });
    }
    // and the two back corners, either side of the office, turned to face
    // down the aisle — the cars you only see once you are all the way in.
    for (const sgn of [1, -1]) for (let k = 0; k < 2; k++) {
      BAY.push({ x: OFF_X - 0.4 - k * 2.8, z: zMid + sgn * (OFF_W / 2 + 2.4), yaw: sgn > 0 ? 1.15 : -1.15 });
    }

    let n = 0;
    for (let b = 0; b < BAY.length && n < STOCK.length; b++) {
      // one empty bay in the near half, where a car sold this morning. The
      // bay line and the oil stain are still there; the car is not.
      if (b === 3) continue;
      const { x, z, yaw } = BAY[b];
      const it = STOCK[n];
      n++;
      const g0 = new THREE.Group();
      g0.add(makeCar(it.kind, it.col));
      buyersGuide(g0);                                  // every car, by law
      if (n % 3 === 1) balloon(g0, n, n === 4 || n === 13);
      switch (it.treat) {
        case 'soap':
          onGlass(g0, soapT(it.price!), 1.05, 0.34, 1.06, -0.92);
          break;
        case 'burst':
          onGlass(g0, burstT(it.price!), 0.44, 0.44, 1.02, -0.94);
          if (it.slog) onGlass(g0, slogT(it.slog, '#f2ead0', '#25406b'), 0.52, 0.13, 0.78, -1.00, 0.07);
          break;
        case 'card':
          onGlass(g0, soapT(it.price!), 0.92, 0.30, 1.08, -0.92);
          if (it.slog) onGlass(g0, slogT(it.slog, '#c0392f', '#f2ead0'), 0.50, 0.13, 0.80, -1.00);
          break;
        case 'slip':
          onGlass(g0, burstT(it.price!), 0.40, 0.40, 0.78, -0.96, 0.42);
          break;
        case 'sold':
          onGlass(g0, soldT(), 0.86, 0.20, 1.00, -0.92, 0.22);
          break;
        case 'bare': break;
      }
      g0.position.set(x, Y, z);
      g0.rotation.y = yaw;
      scene.add(g0);
      // The box has to stay OUT of the aisle or the aisle is not an aisle.
      // A 1.8 x 4.6 car at 0.55 rad has a 3.9 x 4.9 bounding box, which from
      // NORTH_Z would reach 0.5 m past the aisle edge, so this is deliberately
      // tighter than the true footprint: you can brush a wing, and in exchange
      // the 6.8 m you can see down stays 6.8 m you can walk down.
      solid({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 2.0, maxZ: z + 2.0 });
    }

    // ── the yard ─────────────────────────────────────────────────────────
    // The last of the sleaze list: a flagpole, weeds, and cones. All three are
    // about the GROUND, which is the half of a lot nobody draws — the asphalt
    // has been there twenty years and things have been growing out of it and
    // getting left on it for most of them.

    // WEEDS. Only where a car has never driven: hard against the fence, along
    // the perimeter, and in the seam where the asphalt meets a wall. Weeds in
    // the middle of a live drive aisle is the tell that they were scattered
    // rather than placed, so the aisle band is excluded outright.
    const weedT = pixTex(12, 14, (g) => {
      g.clearRect(0, 0, 12, 14);
      for (let b = 0; b < 7; b++) {
        const bx = 2 + ((b * 5) % 9), lean = ((b * 7) % 5) - 2, hgt = 6 + ((b * 11) % 7);
        g.fillStyle = b % 3 === 0 ? '#6e7a3a' : (b % 3 === 1 ? '#57682e' : '#7d8646');
        for (let k = 0; k < hgt; k++) {
          const px2 = bx + Math.round((lean * k) / hgt);
          g.fillRect(px2, 13 - k, 1, 1);
          if (k > hgt - 3) g.fillRect(px2 + (b % 2 ? 1 : -1), 13 - k, 1, 1);
        }
      }
    });
    const weedM = new THREE.MeshBasicMaterial({ map: weedT, alphaTest: 0.4, side: THREE.DoubleSide });
    const weed = (wx: number, wz: number, sc: number) => {
      // Two crossed quads, not one. A single plane vanishes edge-on, and a
      // tuft of grass that disappears when you walk past it is worse than no
      // tuft at all — the same reason the bunting is not a billboard.
      for (const ry of [0, Math.PI / 2]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.30 * sc, 0.35 * sc), weedM);
        m.position.set(wx, Y + 0.175 * sc, wz);
        m.rotation.y = ry;
        scene.add(m);
      }
    };
    for (let i = 0; i < 26; i++) {
      const h = (i * 2654435761) >>> 0;
      const edge = i % 4;
      let wx: number, wz: number;
      if (edge === 0) { wx = FENCE_X + 0.30 + ((h >>> 3) % 40) / 100; wz = zS + 0.6 + ((h >>> 9) % 2100) / 100; }
      else if (edge === 1) { wx = X0 + 1.0 + ((h >>> 5) % 2100) / 100; wz = zN - 0.5 - ((h >>> 11) % 60) / 100; }
      else if (edge === 2) { wx = X0 + 1.0 + ((h >>> 7) % 2100) / 100; wz = zS + 0.5 + ((h >>> 13) % 60) / 100; }
      else { wx = X1 - 0.5 - ((h >>> 15) % 60) / 100; wz = zS + 0.8 + ((h >>> 17) % 2100) / 100; }
      if (edge === 0 && wz > zMid - AISLE_HW - 0.4 && wz < zMid + AISLE_HW + 0.4) continue;  // not in the gateway
      weed(wx, wz, 0.7 + ((h >>> 19) % 60) / 100);
    }

    // THE FLAGPOLE, at the front corner where a lot puts one, south of the
    // entrance so it does not crowd the pole sign at the other side. The flag
    // is the dealer's own — the same red and the same star as the price cards
    // and the flyer, because a lot buys one set of colours and uses it on
    // everything.
    {
      const fpx = X0 + 1.2, fpz = zS + span * SITE_GATE - 2.2, FPH = 7.0;
      const poleWhite = new THREE.MeshBasicMaterial({ color: 0xd6d2c6 });
      const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, FPH, 8), poleWhite);
      fp.position.set(fpx, Y + FPH / 2, fpz);
      scene.add(fp);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xd8b040 }));
      finial.position.set(fpx, Y + FPH + 0.09, fpz);
      scene.add(finial);
      solid({ minX: fpx - 0.22, maxX: fpx + 0.22, minZ: fpz - 0.22, maxZ: fpz + 0.22 });
      const flagT = pixTex(28, 18, (g) => {
        g.fillStyle = '#c0392f'; g.fillRect(0, 0, 28, 18);
        g.fillStyle = '#f2ead0';
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.6 : 6.2;
          const px2 = 11 + Math.cos(a) * r, py2 = 9 + Math.sin(a) * r;
          if (i === 0) g.beginPath(), g.moveTo(px2, py2); else g.lineTo(px2, py2);
        }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, 28, 2); g.fillRect(0, 16, 28, 2);
        dither(g, 28, 18, 22);
      });
      // ONE plane with a ripple pushed into its vertices, not three panels in
      // a row. Three panels each got the WHOLE texture, so the flag flew with
      // three stars on it — a tiled texture is not a bent one. Displacing a
      // segmented plane keeps one star and still puts a bend in the cloth,
      // which is the only thing separating a flag from a painted sign bolted
      // to a mast.
      const FLAG_W = 1.5, FLAG_H = 0.92;
      const flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, 6, 1);
      const pa = flagGeo.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const u = pa.getX(i) / FLAG_W + 0.5;             // 0 at the mast, 1 at the fly
        pa.setZ(i, Math.sin(u * Math.PI * 1.6) * 0.10 * u);
        pa.setY(i, pa.getY(i) - u * 0.06);               // the fly droops a little
      }
      pa.needsUpdate = true;
      flagGeo.computeVertexNormals();
      const flag = new THREE.Mesh(flagGeo,
        new THREE.MeshBasicMaterial({ map: flagT, side: THREE.DoubleSide }));
      flag.position.set(fpx + 0.03, Y + FPH - 0.72, fpz + 0.06 + FLAG_W / 2);
      flag.rotation.y = -Math.PI / 2;
      scene.add(flag);
    }

    // TRAFFIC CONES, which on a lot are never coning anything off — they are
    // holding a space, or they have been there since a delivery. One at each
    // side of the gateway and one lying on its side, because one always is.
    const coneM = new THREE.MeshBasicMaterial({ color: 0xd4551f });
    const cuffM = new THREE.MeshBasicMaterial({ color: 0xe8e2d2 });
    const cone = (kx: number, kz: number, tipped = false) => {
      const g0 = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 8), coneM);
      body.position.y = 0.30; g0.add(body);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.132, 0.09, 8), cuffM);
      cuff.position.y = 0.34; g0.add(cuff);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.34), coneM);
      base.position.y = 0.022; g0.add(base);
      if (tipped) { g0.rotation.z = Math.PI / 2 - 0.12; g0.position.set(kx, Y + 0.17, kz); }
      else g0.position.set(kx, Y, kz);
      scene.add(g0);
    };
    cone(FENCE_X + 1.15, zMid - AISLE_HW - 0.35);
    cone(FENCE_X + 1.15, zMid + AISLE_HW + 0.35);
    cone(X0 + 4.2, zMid + AISLE_HW + 0.55, true);

    // ── the things that make it look TRIED ───────────────────────────────
    // A tidy lot reads as a car park. What says business is the clutter round
    // the edges: a board dragged out to the gate every morning, tyres nobody
    // has taken to the tip, a hose left coiled by the office door, and oil
    // where cars have stood for years.

    // the sandwich board, at the mouth where it would be dragged out
    // The canvas is sized from the LONGEST line and the aspect is taken from
    // the face it lands on (0.62 wide by 0.86 tall), not chosen. Picking 52 px
    // by eye is what shipped "TODA / ONLY / NO CREDI" — a 5-char line at 2 px
    // per texel needs 58, and a 9-char line at 1 px needs 53. Same clipping
    // that has now bitten the office board and the price cards; the rule is
    // that no canvas here gets a number typed into it directly.
    const BW = 62, BH = 86;
    const wOf = (t: string, px: number) => (t.length - 1) * 6 * px + 5 * px;
    const mid = (g: CanvasRenderingContext2D, t: string, y: number, px: number, ink: string) =>
      stamp(g, t, Math.round((BW - wOf(t, px)) / 2), y, px, ink);
    const boardFaceT = pixTex(BW, BH, (g) => {
      g.fillStyle = '#e8e2cc'; g.fillRect(0, 0, BW, BH);
      g.fillStyle = '#2a2118'; g.fillRect(0, 0, BW, 3); g.fillRect(0, BH - 3, BW, 3);
      mid(g, 'TODAY', 10, 2, '#c0392f');
      mid(g, 'ONLY', 26, 2, '#c0392f');
      g.fillStyle = '#c0392f'; g.fillRect(8, 44, BW - 16, 2);
      mid(g, 'NO CREDIT', 52, 1, '#25406b');
      mid(g, 'NO PROBLEM', 62, 1, '#25406b');
      mid(g, 'WE FINANCE', 74, 1, '#2a2118');
      dither(g, BW, BH, 30);
    });
    const boardEdgeM = new THREE.MeshBasicMaterial({ color: 0x6b5033 });
    // Dragged out to the SOUTH side of the opening. In the middle of it, it
    // was the second thing blocking the lane; a board is put where it is seen
    // from the pavement and where nobody has to steer around it.
    const sandZ = zS + span * SITE_GATE + 0.45;
    for (const lean of [0.18, -0.18]) {
      // the box is 0.04 thick in X, so its LARGE faces are +-x — indices 0
      // and 1. Put the lettering on 4/5 and it lands on two 4 cm edges and
      // the board comes back blank, which is exactly what happened.
      const leaf2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.86, 0.62),
        [flat(boardFaceT), flat(boardFaceT), boardEdgeM, boardEdgeM, boardEdgeM, boardEdgeM]);
      leaf2.position.set(X0 + 1.5 + lean * 0.5, Y + 0.44, sandZ);
      leaf2.rotation.z = lean;
      scene.add(leaf2);
    }
    solid({ minX: X0 + 1.2, maxX: X0 + 1.8, minZ: sandZ - 0.4, maxZ: sandZ + 0.4 });

    // tyre stacks. Rubber is not black — it is a very dark warm grey, and a
    // stack reads by the gaps between the treads, so each one is its own ring
    // with a sliver of shadow under it.
    // A TORUS, not a cylinder. The hole is the entire read — stacked cylinders
    // came back as black oil drums, because a tyre seen from above is a ring
    // and a drum is a disc. Low segments so it stays faceted like the rest of
    // the geometry, and not black: rubber in daylight is a dark warm grey.
    const tyreM = new THREE.MeshBasicMaterial({ color: 0x333335 });
    const tyreGeo = new THREE.TorusGeometry(0.23, 0.10, 5, 12);
    const tyreStack = (tx: number, tz: number, n: number, spin: number) => {
      for (let i = 0; i < n; i++) {
        const t = new THREE.Mesh(tyreGeo, tyreM);
        t.rotation.x = Math.PI / 2;                       // lying flat
        t.rotation.z = spin + i * 0.5;                    // never stacked square
        t.position.set(tx + (i % 2 ? 0.03 : -0.02), Y + 0.10 + i * 0.185, tz + (i % 3 ? -0.02 : 0.03));
        scene.add(t);
      }
      solid({ minX: tx - 0.36, maxX: tx + 0.36, minZ: tz - 0.36, maxZ: tz + 0.36 });
    };
    tyreStack(X1 - 1.0, zN - 2.2, 4, 0.3);
    tyreStack(X1 - 1.7, zN - 2.6, 3, 1.1);
    tyreStack(X1 - 0.9, zS + 3.4, 5, 0.7);

    // ── somewhere to wait while they run your credit ─────────────────────
    // The lot had nothing to sit on, which is not a period detail — waiting is
    // the entire buy-here-pay-here experience. Two moulded plastic stacking
    // chairs against the office wall, one blue and one orange, because nobody
    // ever bought a matching pair; one square to the wall and one shoved round
    // at an angle by whoever sat in it last. They face OUT at the stock, which
    // is what you look at while you wait.
    //
    // They get NO collider on purpose. A chair you cannot walk into is a chair
    // whose own box holds you further away than the seat's trigger radius —
    // the mistake park.ts documents on its benches — and 4 kg of plastic is
    // not something you brace against anyway.
    const chair = (chx: number, chz: number, spin: number, col: number) => {
      const m = new THREE.MeshBasicMaterial({ color: col });
      const legM = new THREE.MeshBasicMaterial({ color: 0x8d8d92 });
      const g0 = new THREE.Group();
      const pan = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.46), m);
      pan.position.y = 0.44; g0.add(pan);
      // The back is on +z and the chair therefore faces -z, which is what
      // yaw 0 means to ctx.seat. Built the other way round first — back on
      // +x — and the seat sat you square across the arms of your own chair.
      // A chair's model and its seat pose have to agree on which way is front.
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.06), m);
      back.position.set(0, 0.66, 0.20); back.rotation.x = 0.12; g0.add(back);
      for (const lx of [-0.17, 0.17]) for (const lz of [-0.19, 0.19]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.03), legM);
        leg.position.set(lx, 0.22, lz); g0.add(leg);
      }
      g0.position.set(chx, Y, chz); g0.rotation.y = spin;
      scene.add(g0);
    };
    // Beside the office door, against its front wall, facing back down the
    // aisle — which is now the view. Both chair and approach have to sit on
    // open asphalt: the first placement put them inside a solid box, the seat
    // registered, the prompt appeared, and you could never walk to it, which
    // is GOTCHAS §8 exactly. scripts/seatcheck.mjs is what catches that.
    const chX = cx - CD / 2 - 0.55;
    chair(chX, cz + 1.15, -Math.PI / 2, 0x2f5f9c);
    chair(chX - 0.10, cz + 1.95, -Math.PI / 2 - 0.30, 0xc4622a);

    // SITTABLE. F's ctx.seat does the sitting, the standing and the prompt —
    // all this owes it is where the pan is and which way you end up facing,
    // which for a chair against the office wall is OUT at the stock. The
    // approach is a stride in front, because the trigger has to be reachable
    // from the asphalt and not from inside the cabin.
    o.seat?.({ x: chX, z: cz + 1.15, yaw: -Math.PI / 2, h: 0.46,
      approach: { x: chX - 0.85, z: cz + 1.15 } });
    o.seat?.({ x: chX - 0.10, z: cz + 1.95, yaw: -Math.PI / 2 - 0.30, h: 0.46,
      approach: { x: chX - 0.95, z: cz + 1.95 } });
    // and the three-high tyre stack, which is 0.56 of rubber and is exactly
    // what gets sat on when both chairs are taken. The five-high and the
    // four-high are too tall to be furniture, so they stay scenery.
    o.seat?.({ x: X1 - 1.7, z: zN - 2.6, yaw: -Math.PI / 2, h: 0.58,
      approach: { x: X1 - 2.6, z: zN - 2.6 }, label: 'sit on the tyres' });

    // a hose, coiled where it was dropped by the office door
    const hoseM = new THREE.MeshBasicMaterial({ color: 0x2f5a3a });
    for (let i = 0; i < 3; i++) {
      const r = 0.34 - i * 0.07;
      const coil = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 4, 14), hoseM);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(cx - CD / 2 - 0.75, Y + 0.035 + i * 0.055, cz + 1.5 + i * 0.03);
      scene.add(coil);
    }
    // and a bucket beside it, because somebody washes these
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.28, 10),
      new THREE.MeshBasicMaterial({ color: 0x9a5a2c }));
    bucket.position.set(cx - CD / 2 - 1.15, Y + 0.14, cz + 1.9);
    scene.add(bucket);

    // more oil, in the places cars stand rather than on a grid — by the gate
    // where they idle, and at the back where the ones that do not run sit
    for (const [ox, oz, sc] of [
      [X0 + 1.9, zN - span * SITE_GATE + 1.4, 1.5],
      [X0 + 5.2, zS + 3.0, 1.9],
      [X1 - 2.6, zN - 4.4, 1.2],
    ] as [number, number, number][]) {
      const oil = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * sc, 0.95 * sc), oilM);
      oil.rotation.x = -Math.PI / 2;
      oil.rotation.z = ox * 1.7;
      oil.position.set(ox, Y + 0.004, oz);
      scene.add(oil);
    }

    // ── the floodlight ───────────────────────────────────────────────────
    // One pole at the back corner. A lot is lit after dark because that is
    // when it is trying hardest — the park has nothing like this.
    const fx = X1 - 1.2, fz = zS + 2.4;
    const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6.2, 8), postM);
    fpole.position.set(fx, Y + 3.1, fz);
    scene.add(fpole);
    solid({ minX: fx - 0.2, maxX: fx + 0.2, minZ: fz - 0.2, maxZ: fz + 0.2 });
    // AIMED AT THE AISLE. It used to throw its pool into the back-south
    // corner, which was reasonable when the stock was in rows across the lot
    // and is pointless now that everything anybody looks at is the aisle and
    // the office at the end of it. A floodlight lighting a corner nobody walks
    // into is the night-time version of a pole with a box on it.
    //
    // The pole cannot move — every metre beside the aisle is a parking bay —
    // so the head SWINGS instead, and the head, lens, halo and pool all take
    // their bearing from the same two points rather than each being nudged
    // until it looked right.
    const AIM_X = X0 + 15.0, AIM_Z = zMid + 0.6;             // where it points
    const aim = Math.atan2(AIM_Z - fz, -(AIM_X - fx));       // 0 = pointing -x
    const off = (d: number): [number, number] => [fx + d * -Math.cos(aim), fz + d * Math.sin(aim)];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), new THREE.MeshBasicMaterial({ color: 0x4a4f56 }));
    const [hx, hz] = off(0.3);
    head.position.set(hx, Y + 6.05, hz);
    head.rotation.y = aim;
    head.rotation.z = 0.34;
    scene.add(head);
    const lensT = pixTex(16, 12, (g) => {
      g.fillStyle = '#f2ead0'; g.fillRect(0, 0, 16, 12);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = 2; x < 16; x += 4) g.fillRect(x, 0, 1, 12);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 16, 2);
    });
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), flat(lensT));
    const [lx, lz] = off(0.52);
    lens.position.set(lx, Y + 5.94, lz);
    lens.rotation.y = -Math.PI / 2 + aim;
    lens.rotation.z = 0.34;
    scene.add(lens);
    // It has to LIGHT something, or it is a pole with a box on it. A stepped
    // halo at the lens and a pool thrown across the asphalt — both stepped
    // into hard rings rather than blurred, because nothing else in this world
    // is a smooth gradient. Both fade in with the night.
    const stepDisc = (n: number, R: number) => pixTex(n, n, (g) => {
      const C = n / 2;
      const disc = (r: number, fill: string) => {
        g.fillStyle = fill;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
        }
      };
      disc(R, 'rgba(255,236,186,0.07)');
      disc(R * 0.74, 'rgba(255,240,198,0.11)');
      disc(R * 0.52, 'rgba(255,244,212,0.17)');
      disc(R * 0.32, 'rgba(255,248,226,0.24)');
      disc(R * 0.16, 'rgba(255,252,238,0.32)');
    });
    const haloM = new THREE.MeshBasicMaterial({
      map: stepDisc(24, 11), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), haloM);
    const [ax, az] = off(0.62);
    halo.position.set(ax, Y + 5.9, az);
    scene.add(halo);
    const poolM = new THREE.MeshBasicMaterial({
      map: stepDisc(32, 15), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xb9a882,
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 9.0), poolM);
    pool.rotation.x = -Math.PI / 2;
    pool.rotation.z = -aim;
    pool.position.set(AIM_X, Y + 0.012, AIM_Z);
    scene.add(pool);
    o.onFrame?.((f) => {
      haloM.opacity = 0.95 * f.night;
      poolM.opacity = 0.62 * f.night;
      // 0.47 is not invented: it is the factor the world's own grader was
      // measured applying to this lot's opaque surfaces between 13:00 and
      // 23:00 (0.415 to 0.221). Matching it means the decals sit at the same
      // relative brightness on the asphalt after dark as they do at noon,
      // which is the only thing a stain has to do.
      const k = 1 - 0.47 * f.night;
      for (const d of decals) d.m.color.copy(d.base).multiplyScalar(k);
    });

    // NOTHING here registers the perimeter. The site's low wall, its flanks
    // and its back are ct/street.ts's and are already solid; the chain-link
    // above the wall needs no box of its own because the wall under it
    // already stops you. What this module makes solid is only what it put
    // there: the office, the two poles, and the stock.

    // ── say what is ours ─────────────────────────────────────────────────
    // `userData.mod = 'lot'` on every object this module put in the scene.
    //
    // Same move props.ts made with `userData.selfLit`, and for the same
    // reason: from outside the scene graph you cannot tell whose a mesh is,
    // so a whole-world checker has to be handed a BOX, and a box is a
    // remembered coordinate. That has now misrouted the same finding three
    // times — thirteen faults filed against this file from `30 60 -105 -90`,
    // which holds none of it. They are a neon module's, ten blocks away.
    //
    // With this, a checker can select by author instead of by geography and
    // the question "whose is this" stops being a guess:
    //
    //     o.traverse(n => { if (n.userData.mod === 'lot') … })
    //
    // Cheap and total — one field, set once at build, on everything.
    for (let i = mark; i < scene.children.length; i++) {
      scene.children[i].traverse((n) => { n.userData.mod = 'lot'; });
    }
  };

  return { placeLot, colliders, LOT };
}

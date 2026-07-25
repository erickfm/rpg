import * as THREE from 'three';
import type { AABB } from '../fp';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { FACE } from './rng';
import { makeCar, type CarKind } from './cars';

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
export const LOT = { live: false, colliders: [] as AABB[] };

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
    onFrame: (fn, order) => ctx.onFrame((f) => fn({ night: f.night }), order),
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
  onFrame?: (fn: (f: { night: number }) => void, order?: number) => void;
}) {
  const { scene, flat, KERB_H } = o;
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
    g.fillStyle = '#7c848d';
    for (let i = 0; i < 24; i++) for (const off of [0, 8, 16]) {
      g.fillRect((i + off) % 24, i, 1, 1);
      g.fillRect((((off - i) % 24) + 24) % 24, i, 1, 1);
    }
  });
  linkT.wrapS = linkT.wrapT = THREE.RepeatWrapping;
  const MESH_M = 0.3;   // one tile of diamonds per 0.3 m
  const linkPanel = (w: number, h: number) => {
    const t = linkT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / MESH_M, h / MESH_M);
    t.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
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
  const cabinWinT = pixTex(32, 24, (g) => {
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 0, 32, 24);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 3; y < 24; y += 5) g.fillRect(0, y, 32, 1);
    g.fillStyle = '#3a4650'; g.fillRect(4, 5, 24, 12);            // the big window
    g.fillStyle = 'rgba(200,215,225,0.20)'; g.fillRect(5, 6, 9, 10);
    g.fillStyle = '#2a2118'; g.fillRect(16, 11, 10, 6);           // a desk, inside
    g.fillStyle = '#c9a45e'; g.fillRect(18, 9, 5, 2);             // and a lamp on it
    g.fillStyle = '#6a6258'; g.fillRect(4, 5, 24, 1); g.fillRect(4, 16, 24, 1);
    dither(g, 32, 24, 50);
  });

  // Hand-lettered, because a lot's sign is painted by whoever owned the
  // brush. Letters are stamped as texel blocks — at this density a font
  // renders as grey mush and the whole point of a sign is that it is read.
  const GLYPH: Record<string, number[]> = {
    A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001], B: [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
    C: [0b01111, 0b10000, 0b10000, 0b10000, 0b01111], D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
    E: [0b11111, 0b10000, 0b11110, 0b10000, 0b11111], F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
    I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111], K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001],
    L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111], M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001],
    N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001], O: [0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
    R: [0b11110, 0b10001, 0b11110, 0b10010, 0b10001], S: [0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
    T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100], U: [0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    W: [0b10001, 0b10001, 0b10101, 0b11011, 0b10001], Y: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
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
      const rows = GLYPH[s[i]] ?? GLYPH[' '];
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
    const X0 = site.minX, X1 = site.maxX;          // street edge, back
    const zS = site.minZ, zN = site.maxZ;          // south and north ends
    const Y = site.y;
    const span = zN - zS;

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
    const oilM = new THREE.MeshBasicMaterial({ map: oilT, transparent: true, depthWrite: false });
    const bayM = new THREE.MeshBasicMaterial({ color: 0xb8b09a, transparent: true, opacity: 0.26 });
    for (let i = 0; i < 8; i++) {
      const bz = zN - 3.6 - i * 2.6;
      if (bz < zS + 1.6) break;
      const bay = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 4.2), bayM);
      bay.rotation.x = -Math.PI / 2;
      bay.rotation.z = Math.PI / 2 - 0.5;           // the angle the stock parks at
      bay.position.set(X0 + 3.0, Y + 0.006, bz);
      scene.add(bay);
      if (i % 2 === 0) {
        const oil = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), oilM);
        oil.rotation.x = -Math.PI / 2;
        oil.position.set(X0 + 3.0, Y + 0.004, bz - 0.5);
        scene.add(oil);
      }
    }

    // ── chain-link, ON the site's low wall ───────────────────────────────
    // A concrete kerb-wall with mesh above it is how a lot really closes its
    // frontage, so this adds only the half the site does not have. It stops
    // where the site's wall stops, which leaves the gate open by
    // construction rather than by a number kept in two places.
    const MESH_TOP = 1.75;
    const wallTop = Y + 0.62;
    const runs: [number, number][] = [
      [zS + 0.3, zS + span * SITE_GATE],
      [zN - span * SITE_GATE, zN - 0.3],
    ];
    for (const [rz0, rz1] of runs) {
      const len = rz1 - rz0, h = MESH_TOP - wallTop;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, h), linkPanel(len, h));
      mesh.position.set(X0 + 0.18, wallTop + h / 2, (rz0 + rz1) / 2);
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), postM);
      rail.position.set(X0 + 0.18, MESH_TOP, (rz0 + rz1) / 2);
      scene.add(rail);
      const n = Math.max(1, Math.round(len / 2.6));
      for (let i = 0; i <= n; i++) {
        const pz = rz0 + len * (i / n);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, MESH_TOP - Y, 0.07), postM);
        post.position.set(X0 + 0.18, Y + (MESH_TOP - Y) / 2, pz);
        scene.add(post);
      }
    }

    // ── bunting ──────────────────────────────────────────────────────────
    // The flags hang from their OWN poles, clear above everything else, which
    // is both how it is really done and the answer to "what is holding that
    // up". Each swag is four short segments following a parabola, because the
    // SAG is the whole read: strung level it is a painted stripe, and only the
    // dip between poles says plastic on a string.
    const FX = X0 + 0.18;
    const PEN_M = 1.6;                               // one tile of four flags
    const POLE_H = 3.1, SAG = 0.62;
    const buntSeg = (za: number, ya: number, zb: number, yb: number) => {
      const t = pennantT.clone();
      t.wrapS = THREE.RepeatWrapping;
      const len = Math.hypot(zb - za, yb - ya);
      t.repeat.set(len / PEN_M, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.62),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
      m.position.set(FX, (ya + yb) / 2, (za + zb) / 2);
      m.rotation.y = Math.PI / 2;
      m.rotation.z = Math.atan2(yb - ya, zb - za);
      scene.add(m);
    };
    const BAYS = 3, SEGS = 4;
    for (let i = 0; i <= BAYS; i++) {
      const pz = zN - (span / BAYS) * i;
      const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, POLE_H, 6), postM);
      bp.position.set(FX, Y + POLE_H / 2, pz);
      scene.add(bp);
    }
    for (let i = 0; i < BAYS; i++) {
      const a = zN - (span / BAYS) * i, b = zN - (span / BAYS) * (i + 1);
      const yAt = (u: number) => Y + POLE_H - SAG * 4 * u * (1 - u);
      for (let sg = 0; sg < SEGS; sg++) {
        const u0 = sg / SEGS, u1 = (sg + 1) / SEGS;
        buntSeg(a + (b - a) * u0, yAt(u0), a + (b - a) * u1, yAt(u1));
      }
    }

    // ── the office ───────────────────────────────────────────────────────
    // A portable cabin set back at the north end, turned to face the gate so
    // whoever is inside watches you come in.
    const CW = 4.6, CD = 3.0, CH = 2.7;
    const cx = X0 + Math.min(5.6, (X1 - X0) * 0.30), cz = zN - 3.4;
    const cabM = flat(cabinT), cabWinM = flat(cabinWinT);
    const roofM = new THREE.MeshBasicMaterial({ color: 0x5a5f66 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(CD, CH, CW),
      [cabWinM, cabM, roofM, roofM, cabM, cabM]);
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
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.85), flat(boardT));
    board.position.set(cx - CD / 2 - 0.03, Y + 2.05, cz);
    board.rotation.y = -Math.PI / 2;
    scene.add(board);

    // ── the pole sign ────────────────────────────────────────────────────
    // Out at the street line by the gate, high enough to be read from down
    // the block. This is the lot's answer to the park's trees.
    const px = X0 + 0.9, pz = zN - span * SITE_GATE - 1.1;   // just north of the mouth
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5.4, 8), postM);
    pole.position.set(px, Y + 2.7, pz);
    scene.add(pole);
    solid({ minX: px - 0.2, maxX: px + 0.2, minZ: pz - 0.2, maxZ: pz + 0.2 });
    const signT = pixTex(60, 44, (g) => {
      g.fillStyle = '#c0392f'; g.fillRect(0, 0, 60, 44);
      g.fillStyle = '#e8dcb8'; g.fillRect(2, 2, 56, 40);
      g.fillStyle = '#c0392f'; g.fillRect(4, 4, 52, 36);
      stamp(g, 'USED', 12, 8, 2, '#e8dcb8');
      stamp(g, 'CARS', 12, 21, 2, '#d8a72e');
      dither(g, 60, 44, 40);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.25), flat(signT));
    sign.position.set(px + 0.02, Y + 4.6, pz);
    sign.rotation.y = -Math.PI / 2;
    scene.add(sign);

    // ── banners on the fence ─────────────────────────────────────────────
    // Cheap vinyl, cable-tied on. Three of them, spaced down the frontage.
    const banners: [string, string, string, number][] = [
      ['AS-IS', '#c0392f', '#e8dcb8', 0.30],
      ['EZ CREDIT', '#25406b', '#e8dcb8', 0.52],
      ['NO MONEY DOWN', '#d8a72e', '#2a2118', 0.78],
    ];
    for (const [words, bg, ink, at] of banners) {
      const t = bannerT(words, bg, ink);
      const w = words.length * 0.24 + 0.3;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.46), flat(t));
      b.position.set(FX - 0.05, Y + 1.34, zN - span * at);
      b.rotation.y = -Math.PI / 2;
      scene.add(b);
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
    /** hang a thing on the windshield of a car group, in the car's own frame */
    const onGlass = (g0: THREE.Group, t: THREE.Texture, w: number, h: number,
                     y: number, z: number, rz = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
      m.position.set(0, y, z);
      m.rotation.y = Math.PI;
      m.rotation.z = rz;
      g0.add(m);
    };
    const ANGLE = Math.PI / 2 - 0.5;
    // ROWS ARE DERIVED FROM THE DEPTH, not hardcoded. The site went from 8 m
    // to 24 and the whole point of the depth is rows RECEDING — you should see
    // cars behind cars, and the back of the lot should be a different place
    // from the street edge. At 5.5 m per row a car angled at 45 degrees plus
    // its aisle fits, and the count falls out of whatever depth D sets.
    const DEPTH = X1 - X0;
    const ROW_PITCH = 5.5;
    const ROWS = Math.max(1, Math.min(4, Math.floor((DEPTH - 2.2) / ROW_PITCH)));
    const PER_ROW = Math.max(2, Math.floor((span - 4.0) / 3.4));
    let n = 0;
    for (let r = 0; r < ROWS && n < STOCK.length; r++) {
      const x = X0 + 2.8 + r * ROW_PITCH;
      // every other row is nudged half a bay down the frontage, so you look
      // BETWEEN the cars in front rather than at their backs
      const stagger = (r % 2) * 1.7;
      for (let k = 0; k < PER_ROW && n < STOCK.length; k++) {
        const it = STOCK[n];
        const z = zN - 3.6 - stagger - k * 3.4;
        if (z < zS + 2.2) break;
        n++;
        const g0 = new THREE.Group();
        g0.add(makeCar(it.kind, it.col));
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
        g0.rotation.y = ANGLE;
        scene.add(g0);
        solid({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 1.5, maxZ: z + 1.5 });
      }
    }

    // ── the things that make it look TRIED ───────────────────────────────
    // A tidy lot reads as a car park. What says business is the clutter round
    // the edges: a board dragged out to the gate every morning, tyres nobody
    // has taken to the tip, a hose left coiled by the office door, and oil
    // where cars have stood for years.

    // the sandwich board, at the mouth where it would be dragged out
    const boardFaceT = pixTex(52, 40, (g) => {
      g.fillStyle = '#e8e2cc'; g.fillRect(0, 0, 52, 40);
      g.fillStyle = '#2a2118'; g.fillRect(0, 0, 52, 2); g.fillRect(0, 38, 52, 2);
      stamp(g, 'TODAY', 5, 6, 2, '#c0392f');
      stamp(g, 'ONLY', 9, 18, 2, '#c0392f');
      stamp(g, 'NO CREDIT', 3, 30, 1, '#25406b');
      dither(g, 52, 40, 30);
    });
    const boardEdgeM = new THREE.MeshBasicMaterial({ color: 0x6b5033 });
    const sandZ = zN - span * SITE_GATE - 2.4;
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
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), new THREE.MeshBasicMaterial({ color: 0x4a4f56 }));
    head.position.set(fx - 0.3, Y + 6.05, fz);
    head.rotation.z = 0.34;
    scene.add(head);
    const lensT = pixTex(16, 12, (g) => {
      g.fillStyle = '#f2ead0'; g.fillRect(0, 0, 16, 12);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = 2; x < 16; x += 4) g.fillRect(x, 0, 1, 12);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 16, 2);
    });
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), flat(lensT));
    lens.position.set(fx - 0.52, Y + 5.94, fz);
    lens.rotation.y = -Math.PI / 2;
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
    halo.position.set(fx - 0.62, Y + 5.9, fz);
    scene.add(halo);
    const poolM = new THREE.MeshBasicMaterial({
      map: stepDisc(32, 15), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xb9a882,
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 11.5), poolM);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(fx - 3.6, Y + 0.012, fz + 2.2);
    scene.add(pool);
    o.onFrame?.((f) => {
      haloM.opacity = 0.95 * f.night;
      poolM.opacity = 0.62 * f.night;
    });

    // NOTHING here registers the perimeter. The site's low wall, its flanks
    // and its back are ct/street.ts's and are already solid; the chain-link
    // above the wall needs no box of its own because the wall under it
    // already stops you. What this module makes solid is only what it put
    // there: the office, the two poles, and the stock.
  };

  return { placeLot, colliders, LOT };
}

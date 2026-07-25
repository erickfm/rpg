import * as THREE from 'three';
import type { AABB } from '../fp';
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
    const cols = ['#c0392f', '#dcd7c8', '#d8a72e', '#2f5f9c'];
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
      bay.position.set(X0 + 3.2, Y + 0.006, bz);
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
    const cx = X0 + 5.6, cz = zN - 3.4;
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
    const priceT = (n: string) => {
      const W = n.length * 6 * 2 + 6;
      return pixTex(W, 20, (g) => {
        g.fillStyle = '#e8e2cc'; g.fillRect(0, 0, W, 20);
        g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(0, 18, W, 2);
        g.fillStyle = '#c0392f'; g.fillRect(0, 0, W, 3);          // a red header strip
        stamp(g, n, 3, 6, 2, '#c0392f');
        g.fillStyle = '#2a2118'; g.fillRect(3, 17, W - 6, 1);
      });
    };
    const STOCK: [CarKind, number, string][] = [
      ['sedan', 1, '1495'], ['pickup', 3, '2295'], ['hatch', 0, '995'],
      ['van', 4, '1795'], ['sedan', 5, '1195'], ['hatch', 2, '895'],
      ['pickup', 0, '2795'],
    ];
    // NOSE OUT. A lot angles its stock so the front three-quarter faces the
    // pavement — that is the view that sells a car, and it is why lots park
    // crooked at all. At -0.52 the whole row faced INTO the lot and every
    // windshield, and so every price card, was turned away from the street.
    const ANGLE = Math.PI / 2 - 0.5;
    for (let i = 0; i < STOCK.length; i++) {
      const [kind, col, price] = STOCK[i];
      const row = i < 4 ? 0 : 1;
      const k = i < 4 ? i : i - 4;
      const z = zN - 5.6 - k * 3.3 - row * 1.4;
      if (z < zS + 2.2) break;
      const x = X0 + (row === 0 ? 2.9 : 6.4);
      const g0 = new THREE.Group();
      g0.add(makeCar(kind, col));
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), flat(priceT(price)));
      card.position.set(0, 1.02, -0.80);     // proud of the windshield, facing front
      card.rotation.y = Math.PI;
      g0.add(card);
      g0.position.set(x, Y, z);
      g0.rotation.y = ANGLE;
      scene.add(g0);
      // a car is solid, and the box follows the car rather than the row
      solid({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 1.5, maxZ: z + 1.5 });
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

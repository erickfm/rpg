import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';
import { walkTex } from './tex-ground';
import { weedTuft } from './weeds';
import { ROAD_HALF, FACE } from './rng';
import type { CtxBuild } from './ctx';

// ══ THE NORTH END OPENS, AND THE STREET RUNS OUT TO A FREEWAY ═════════════
//
// *"extend this street out so theres an on ramp to a high way out of town"*
// (2026-08-07). The street dead-ended at z 14.2 against a 2 x FACE brick cap
// — `ct/street.ts`'s "cross building closing the north end". That cap is gone;
// this module is what you see through the hole it left.
//
// ── the shape of it, north from the block ─────────────────────────────────
//
//   z 14.2      the block's building line. Nothing stands across it any more.
//   z 19.8      THE ROAD CLOSURE, across the carriageway and the EAST walk:
//               jersey barriers, chain link, ROAD CLOSED, NO PEDESTRIANS.
//   z 20-34     the roadway carries on and LIFTS, straight up the middle of
//               the street, on embankment and then on piers.
//   z 34-48     it swings east on a banked 14 m curve.
//   x 14-38     the deck runs east at 15 % to 8.5 m and merges.
//   z 52-68     ROUTE 97, elevated on hammerhead piers, running out of town.
//
//   x -7…-5     AND THE WEST FOOTWAY GOES THE WHOLE WAY, z 14.2 → 57.6,
//               fenced from the ramp, and ends under the viaduct deck.
//
// ── HOW HE IS KEPT IN, AND WHY IT IS NOT A WALL ACROSS THE STREET ────────
//
// The first cut of this closed the whole section at z 18 and he could see the
// freeway and never reach it. That is not the ask: he said extend the street
// OUT to an on-ramp OUT OF TOWN, and being stopped six metres short of it is
// the thing looked at, not the thing arrived at.
//
// So the closure is now what a closed road actually is — it shuts the
// CARRIAGEWAY, and the footway walks past it. Four boxes hold the player, and
// between them they are a closed pen with one way in:
//
//   · west fence      x -7.45…-7.05   z 14.2 … 58.4   (the building line)
//   · road closure    x -5.00… 7.40   z 19.5 … 20.1   (the ramp mouth)
//   · ramp fence      x -5.00…-4.70   z 19.5 … 58.4   (footway | ramp)
//   · end closure     x -7.45…-4.70   z 57.6 … 58.2   (under the deck)
//
// Nothing else on the route is new ground: everywhere else north of 14.2 was
// already sealed by the car lot's north flank (x 7…30.2) and the bank's own
// shell, and those did not move.
//
// ── THE 2 m LANE IS UNTOUCHED, THE WHOLE 43 m ────────────────────────────
//
// The footway is x -7…-5, which is the same 2.0 m section it has through the
// block. Both fences put their FACE on a line the walk already ended at and
// their BODY outside it — the west one at -7.05 (west of FACE), the ramp one
// at -5.00 (east of the kerb, standing in the closed roadway). The clear span
// between them is 2.000 m by construction, not by tuning.

export const ORDER = 90;   // dead last: this creates textures, and every
                           // texture painted after a new one is re-grained
                           // (GOTCHAS §31). Built after everything, it regrains
                           // nothing.

// ── the survey ────────────────────────────────────────────────────────────
const Z_BLOCK = 14.2;      // the block's north building line
const Z_BAR = 19.8;        // the road closure, at the ramp mouth
const Z_END = 57.6;        // where the footway stops, under the viaduct deck
const WALK_X0 = -FACE;     // the footway, and it is the block's own section
const WALK_X1 = -ROAD_HALF;
const KERB = 0.14;

// ── WHY THE RAMP CLIMBS STRAIGHT BEFORE IT TURNS ─────────────────────────
//
// From inside the block you are looking down a 14 m slot between two rows of
// five-storey walls. Anything that swings east leaves that slot within twenty
// metres and is never seen from the street at all — the first cut turned at
// z 24 and from the player's own viewpoint the ramp was simply not there.
// What a narrow slot shows is a thing going STRAIGHT AWAY from you and a thing
// crossing HIGH above it, so the ramp lifts dead ahead for 14 m, and the
// mainline crosses over the top of the slot at 8.5 m.
const RAMP_Z0 = 20.0;      // where the ramp deck picks the roadway up
const S1 = 14.0;           // straight up the middle of the street, z 20 → 34
const R_ARC = 14.0;        // then the banked curve east
const ARC = (Math.PI / 2) * R_ARC;
const S2 = S1 + ARC;
const S3 = S2 + 24.0;      // and east to the merge
const RISE_S = 2.0;        // flat for 2 m, then it climbs
const DECK_Y = 8.5;        // the freeway's road surface
const RAMP_HW = 4.2;       // deck half-width
const DECK_T = 0.5;
// The deck's first metre. NOT 0.03: `crosstown.ts` lays the street's centre
// line as a plane at y 0.03 and it runs to z 36, straight under here, and two
// coplanar surfaces z-fight (GOTCHAS §6).
const DECK_Y0 = 0.07;
// ~15 %, steeper than a real ramp, and it is the right lie. The rise has to
// happen INSIDE the fog (FOG_FAR is 100 and the block's own end is at 14): at
// a true 6 % the deck is still at knee height where the haze takes it and the
// whole thing reads as a flat plate, which is exactly what the first cut did.
const GRADE = (DECK_Y - DECK_Y0) / (S3 - RISE_S);

// The mainline. Its south edge is where the ramp's north deck edge lands —
// `RAMP_Z0 + S1 + R_ARC + RAMP_HW` — so the two abut rather than overlap
// (GOTCHAS §6), and both are stated once here.
const VIA_Z0 = RAMP_Z0 + S1 + R_ARC + RAMP_HW;   // 52.2
const VIA_Z1 = VIA_Z0 + 16;                      // 68.2
// x IS BOUNDED BY THE REGION CULL, not by taste. `crosstown.ts` classifies a
// top-level child as street geometry — hideable while the player is in the
// interior belt — only if its bounding SPHERE's east extent is under
// REGION_X = 100, and it errs towards keeping. A viaduct 148 m long centred at
// x 14 has a 74 m sphere radius and lands at 88.4; the wasteland plane under it
// was worse at 106.8, i.e. permanently drawn behind a wall you cannot see past.
// Both are sized to clear it now.
const VIA_X0 = -60, VIA_X1 = 80;                 // and how far it runs in x
const VIA_T = 1.0;
const GIRDER_H = 1.7;      // the edge beam. THE SILHOUETTE IS THIS DEEP, not
                           // the slab — a 1 m plate on sticks reads as an
                           // awning at 40 m, and did.

interface Sample { x: number; z: number; y: number; yaw: number; bank: number }

/** The ramp's centreline at arclength `s`. One function; the deck, the
 *  barriers, the embankment and the piers are all sampled off it, so they
 *  cannot drift apart. */
function at(s: number): Sample {
  let x: number, z: number, yaw: number;
  if (s <= S1) { x = 0; z = RAMP_Z0 + s; yaw = 0; }
  else if (s <= S2) {
    const t = (s - S1) / R_ARC;                  // 0 … π/2
    x = R_ARC - R_ARC * Math.cos(t);
    z = RAMP_Z0 + S1 + R_ARC * Math.sin(t);
    yaw = t;
  } else { x = R_ARC + (s - S2); z = RAMP_Z0 + S1 + R_ARC; yaw = Math.PI / 2; }
  const y = DECK_Y0 + Math.max(0, s - RISE_S) * GRADE;
  // banked INTO the turn, eased over 4 m either side of the arc. `rotation.z`
  // is applied inside the yawed group, so it turns about the deck's own
  // longitudinal axis; positive lifts local +x, which at yaw 0 is world +x —
  // the outside of a right-hand curve.
  let bank = 0;
  if (s > S1 - 4 && s < S2 + 4) {
    const e = Math.min(1, Math.min(s - (S1 - 4), (S2 + 4) - s) / 4);
    bank = 0.11 * Math.max(0, e);
  }
  return { x, z, y, yaw, bank };
}

// ── paint ─────────────────────────────────────────────────────────────────

const concreteTex = (tone = '#8d8a84', grit = '#7a776f') => declareSurface(pixTex(32, 32, (g) => {
  g.fillStyle = tone; g.fillRect(0, 0, 32, 32);
  g.fillStyle = grit;
  for (let i = 0; i < 26; i++) g.fillRect((i * 13) % 32, (i * 7) % 32, 2, 1);
  g.fillStyle = 'rgba(0,0,0,0.14)';
  for (let i = 0; i < 5; i++) g.fillRect(0, (i * 11) % 32, 32, 1);   // form-board joints
  dither(g, 32, 32, 90);
}), 'detail');

const rampTopTex = () => {
  const t = declareSurface(pixTex(64, 64, (g) => {
    g.fillStyle = '#3c3f44'; g.fillRect(0, 0, 64, 64);
    dither(g, 64, 64, 700);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(2, 0, 2, 64);
    g.fillStyle = '#c9c3ad';                       // the edge line
    g.fillRect(60, 0, 2, 64);
  }), 'ground');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1.6);
  return t;
};

/** A green highway guide sign, painted at 8 px/m. */
function guideSignTex(): THREE.Texture {
  const W = 400, H = 208;
  return declareSurface(pixTex(W, H, (g) => {
    g.fillStyle = '#0d5a2e'; g.fillRect(0, 0, W, H);
    // the white border, inset, as they are
    g.strokeStyle = '#e8eee6'; g.lineWidth = 5;
    g.strokeRect(9, 9, W - 18, H - 18);
    g.fillStyle = '#e8eee6';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 40px sans-serif';
    g.fillText('NORTH', 92, 52);
    // the route shield: a plain white marker with the number in it
    g.fillStyle = '#e8eee6';
    g.beginPath();
    g.moveTo(196, 22); g.lineTo(268, 22); g.lineTo(268, 66);
    g.lineTo(232, 90); g.lineTo(196, 66); g.closePath(); g.fill();
    g.fillStyle = '#14171b'; g.font = 'bold 44px sans-serif';
    g.fillText('97', 232, 52);
    // the place you leave town for
    g.fillStyle = '#e8eee6'; g.font = 'bold 46px sans-serif';
    g.fillText('PORT ELDRIDGE', 176, 148);
    // and the arrow up-and-right, which is what the ramp does
    g.strokeStyle = '#e8eee6'; g.lineWidth = 11; g.lineCap = 'round';
    g.beginPath(); g.moveTo(336, 168); g.lineTo(336, 92); g.stroke();
    g.beginPath();
    g.moveTo(336, 78); g.lineTo(362, 112); g.lineTo(310, 112); g.closePath();
    g.fillStyle = '#e8eee6'; g.fill();
  }), 'sign');
}

/** Black on white, the way a regulatory sign is. */
function regSignTex(lines: string[]): THREE.Texture {
  const W = 128, H = 160;
  return declareSurface(pixTex(W, H, (g) => {
    g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12);
    // the crossed-out walker: a slug of a figure inside a red ring
    g.strokeStyle = '#b52a26'; g.lineWidth = 8;
    g.beginPath(); g.arc(64, 54, 30, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1a1a1a';
    g.beginPath(); g.arc(64, 40, 6, 0, Math.PI * 2); g.fill();
    g.fillRect(60, 48, 9, 18);
    g.fillRect(52, 66, 8, 14); g.fillRect(69, 64, 8, 16);
    g.strokeStyle = '#b52a26'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(43, 76); g.lineTo(85, 32); g.stroke();
    g.fillStyle = '#1a1a1a';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 15px sans-serif';
    lines.forEach((l, i) => g.fillText(l, 64, 108 + i * 20));
  }), 'sign');
}

/** The orange-and-white board a city closes a road with. */
function closedBoardTex(): THREE.Texture {
  const W = 256, H = 72;
  return declareSurface(pixTex(W, H, (g) => {
    g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d4692a';
    for (let i = -4; i < 20; i++) {              // the diagonal stripes
      g.beginPath();
      g.moveTo(i * 22, H); g.lineTo(i * 22 + 24, H); g.lineTo(i * 22 + 60, 0); g.lineTo(i * 22 + 36, 0);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(233,230,220,0.94)'; g.fillRect(20, 20, W - 40, 34);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 26px sans-serif';
    g.fillText('ROAD CLOSED', W / 2, 38);
  }), 'sign');
}

/** The yellow diamond. */
function mergeSignTex(): THREE.Texture {
  const S = 128;
  return declareSurface(pixTex(S, S, (g) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#d8b524';
    g.beginPath(); g.moveTo(64, 3); g.lineTo(125, 64); g.lineTo(64, 125); g.lineTo(3, 64);
    g.closePath(); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 100); g.lineTo(64, 46); g.stroke();     // the through lane
    g.beginPath(); g.moveTo(92, 100); g.lineTo(92, 74); g.lineTo(66, 50); g.stroke();
  }), 'sign');
}

/** Chain link: a cut-out sheet, so you see the wasteland through it. */
function chainLinkTex(): THREE.Texture {
  // ONE DIAMOND PER TILE, DRAWN AS PIXELS. Two earlier cuts came out as a
  // chequerboard of half-metre squares, for two compounding reasons, and both
  // are worth naming because the next fence in this world will hit them:
  //
  //  · `lineWidth = 1` strokes on a 16 px sheet antialias into a solid grey
  //    grid — a canvas stroke is not a pixel.
  //  · `pixTex` returns NearestMipmapNearest, and a cut-out that is 12 % opaque
  //    averages to alpha 0.12 one mip down. `alphaTest` then keeps or rejects
  //    WHOLE TILES depending on where the mip's texels happened to land. A
  //    cut-out finer than its filter kernel cannot be mipmapped; it has to be
  //    point-sampled and allowed to alias.
  const N = 16;
  const t = declareSurface(pixTex(N, N, (g) => {
    g.clearRect(0, 0, N, N);
    g.fillStyle = 'rgba(190,194,198,0.98)';
    for (let k = 0; k < N; k++) {
      g.fillRect(k, k, 1, 1);
      g.fillRect(N - 1 - k, k, 1, 1);
    }
  }), 'detail');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/** the tile's real size on the wall — one diamond of mesh */
const LINK_M = 0.50;

export function register(ctx: CtxBuild): void {
  const { scene, flat, wet, obstacle } = ctx;

  const concreteM = flat(concreteTex());
  const barrierM = flat(concreteTex('#8e8a82', '#7c786f'));
  const pierM = flat(concreteTex('#4e4c47', '#413f3b'));
  const steelM = new THREE.MeshBasicMaterial({ color: 0x5a6068 });
  const deckTop = flat(rampTopTex());
  const deckSide = new THREE.MeshBasicMaterial({ color: 0x53514c });
  const linkT = chainLinkTex();

  const add = (m: THREE.Object3D) => { scene.add(m); return m; };
  const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[],
    x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    return add(m);
  };

  // ── 1. the ground the whole thing stands on ─────────────────────────────
  //
  // Wet gravel and dirt, laid 2 cm BELOW the road so the two never fight
  // (GOTCHAS §6). The block's own asphalt already runs to z 36 and its centre
  // line with it, so the roadway needs nothing added — this is the wasteland
  // either side of it and everything past it.
  {
    const t = declareSurface(pixTex(64, 64, (g) => {
      g.fillStyle = '#3f3d38'; g.fillRect(0, 0, 64, 64);
      dither(g, 64, 64, 1100);
      g.fillStyle = 'rgba(90,88,78,0.5)';
      for (let i = 0; i < 40; i++) g.fillRect((i * 29) % 64, (i * 17) % 64, 3, 2);
      g.fillStyle = 'rgba(20,22,20,0.35)';
      for (let i = 0; i < 14; i++) g.fillRect((i * 41) % 64, (i * 23) % 64, 6, 4);
    }), 'ground');
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 16);
    const g0 = new THREE.Mesh(new THREE.PlaneGeometry(150, 88), wet(flat(t)));
    g0.rotation.x = -Math.PI / 2;
    g0.position.set(8, -0.02, 56);
    add(g0);
  }

  // ── 2. the walks run on — the west one all the way ──────────────────────
  //
  // `ct/tex-ground.ts` lays them to z 16.5. These carry on from there on the
  // same `walkTex` sheet and in the same KERB_H + 0.04 box, so the joint at
  // 16.5 is a slab joint and not a change of material.
  //
  // NOTHING REGISTERS A GROUND HEIGHT FOR THEM AND NOTHING NEEDS TO.
  // `crosstown.ts`'s `groundPick` already ends in
  // `Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0`, which
  // is a rule about x alone and answers for every z. So the slab I lay and the
  // height he stands on are the same 0.14 by construction — a `ctx.ground`
  // registration here would be a SECOND statement of it, and two statements of
  // one height is how you get a walk you sink into (GOTCHAS §7).
  const walkDark = new THREE.MeshBasicMaterial({ color: 0x605d56 });
  const walkSlab = (x0: number, x1: number, z0: number, z1: number) => {
    const h = KERB + 0.04;
    const top = wet(flat(walkTex(x0, x1, z0, z1)));
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0),
      [walkDark, walkDark, top, walkDark, walkDark, walkDark]);
    m.position.set((x0 + x1) / 2, h / 2 - 0.04, (z0 + z1) / 2);
    add(m);
  };
  // the east walk stops at the closure; the west one is the way out of town.
  // Laid in 14 m lengths because `walkTex` paints a sheet per region and one
  // 42 m sheet would stretch its slab joints along z.
  walkSlab(ROAD_HALF + 0.1, FACE, 16.5, Z_BAR + 0.7);
  for (let z = 16.5; z < Z_END + 0.6; z += 14) {
    walkSlab(WALK_X0, WALK_X1 - 0.1, z, Math.min(z + 14, Z_END + 0.6));
  }

  // ── 3. the sides close, so the corridor is exactly the street ───────────
  //
  // The cap building sealed x -7…7 and the car lot's north flank seals 7…30.2
  // (ct/street.ts, the FLANK_T note). With the cap gone the flank's plane is
  // single-sided and faces INTO the lot, so from out here it is invisible: this
  // is the wall for its back. West of the street the bank's own shell is a box
  // and needs nothing.
  {
    const bw = 23.2, h = 12.4;
    const t = declareSurface(pixTex(64, 48, (g) => {
      g.fillStyle = '#6b4034'; g.fillRect(0, 0, 64, 48);
      g.fillStyle = 'rgba(0,0,0,0.13)';
      for (let r = 0; r < 24; r++) g.fillRect(0, r * 2 + 1, 64, 1);
      g.fillStyle = 'rgba(214,198,170,0.10)'; g.fillRect(0, 0, 64, 3);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 22; i++) g.fillRect((i * 19) % 64, 0, 2, 8 + (i % 6) * 5);
      dither(g, 64, 48, 260);
    }), 'brick');
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(bw, h), flat(t));
    p.position.set(FACE + bw / 2, h / 2, Z_BLOCK + 0.05);
    add(p);
  }

  // ── 4. chain link down both sides — the edge of town ────────────────────
  //
  // Face on the building line, body outside it. The 2 m walk keeps every
  // millimetre it has through the block.
  const linkMat = (wM: number, hM: number) => {
    const t = linkT.clone();
    t.repeat.set(wM / LINK_M, hM / LINK_M); t.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.25, side: THREE.DoubleSide });
  };
  /** One run of chain link along z, on a given x. Posts, top rail, weeds. */
  const fenceRun = (fx: number, zA: number, zB: number, H: number, weedX: number) => {
    const len = zB - zA;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, H), linkMat(len, H));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(fx, H / 2 + KERB * 0.5, (zA + zB) / 2);
    add(mesh);
    for (let z = zA; z <= zB + 0.01; z += 2.6) box(0.09, H, 0.09, steelM, fx, H / 2 + KERB * 0.5, z);
    box(0.07, 0.07, len, steelM, fx, H + KERB * 0.5 - 0.06, (zA + zB) / 2);
    for (let i = 0; i * 2.9 < len - 1.5; i++) {
      add(weedTuft({ x: weedX + (i % 3) * 0.18, z: zA + 1.2 + i * 2.9, y: 0,
        scale: 0.9 + (i % 4) * 0.16, seed: i * 7 + Math.round(fx) }));
    }
  };
  // WEST — the building line, and it runs the whole way out
  fenceRun(-7.22, Z_BLOCK, Z_END + 0.6, 2.4, -7.42);
  obstacle({ minX: -7.45, maxX: -7.05, minZ: Z_BLOCK, maxZ: Z_END + 0.8 });
  // EAST — only as far as the closure; past it the ramp swings over this line
  fenceRun(7.22, Z_BLOCK, Z_BAR + 0.6, 2.4, 7.42);
  obstacle({ minX: 7.05, maxX: 7.45, minZ: Z_BLOCK, maxZ: Z_BAR + 0.8 });

  // ── 4b. THE FENCE THAT KEEPS HIM OFF THE RAMP ───────────────────────────
  //
  // This is the one that matters. Between the footway and a rising carriageway
  // there has to be something for 38 m, and it has to be continuous — the ramp
  // deck is at knee height at z 22 and at eye height by z 34, so a gap anywhere
  // along it is a place to step up onto a road.
  //
  // ITS FACE IS THE KERB LINE, x -5.00, and its body stands in the CLOSED
  // roadway east of it. The footway keeps -7…-5 entire.
  {
    const H = 2.2, zA = Z_BAR - 0.3, zB = Z_END + 0.6;
    box(0.30, 0.34, zB - zA, concreteM, -4.85, 0.17, (zA + zB) / 2);   // its kerb
    fenceRun(-4.85, zA, zB, H, -4.62);
    obstacle({ minX: -5.00, maxX: -4.70, minZ: zA, maxZ: zB });
  }

  // ── 5. THE ROAD CLOSURE, AT THE RAMP MOUTH ──────────────────────────────
  //
  // ACROSS THE CARRIAGEWAY AND THE EAST WALK ONLY — x -5.00 to 7.40. It stops
  // at the west kerb line, and the footway walks past its end. That is what a
  // closed road looks like and it is the whole reason he can get out of town
  // on foot at all.
  const BAR_X0 = WALK_X1, BAR_X1 = 7.4;
  {
    const BH = 0.85, BW = 0.36, N = 6, pitch = (BAR_X1 - BAR_X0) / N;
    for (let i = 0; i < N; i++) {
      const x0 = BAR_X0 + i * pitch, len = pitch - 0.08;
      const onWalk = Math.abs(x0 + len / 2) > ROAD_HALF;
      const base = onWalk ? KERB : 0;
      // the profile: a wide foot and a narrower top, which is what reads as a
      // jersey barrier rather than a kerbstone laid on end
      box(len, BH * 0.42, BW, barrierM, x0 + len / 2, base + BH * 0.21, Z_BAR);
      box(len, BH * 0.58, BW * 0.6, barrierM, x0 + len / 2, base + BH * 0.42 + BH * 0.29, Z_BAR);
      // the reflector the city bolts on the end of each one
      box(0.08, 0.14, 0.03, new THREE.MeshBasicMaterial({ color: 0xd8a53a }),
        x0 + 0.12, base + BH * 0.78, Z_BAR - BW * 0.32);
    }
    // the fence panel behind the barriers
    const PH = 2.1, PW = BAR_X1 - BAR_X0, PX = (BAR_X0 + BAR_X1) / 2;
    const pm = new THREE.MeshBasicMaterial({ map: linkT.clone(), alphaTest: 0.25, side: THREE.DoubleSide });
    pm.map!.repeat.set(PW / LINK_M, PH / LINK_M); pm.map!.needsUpdate = true;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), pm);
    panel.position.set(PX, PH / 2 + 0.05, Z_BAR + 0.34);
    add(panel);
    for (let x = BAR_X0; x <= BAR_X1 + 0.01; x += pitch) box(0.1, PH, 0.1, steelM, x, PH / 2 + 0.05, Z_BAR + 0.34);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.07, 0.07), steelM);
    rail.position.set(PX, PH + 0.02, Z_BAR + 0.34); add(rail);

    // ROAD CLOSED, hung on the barriers in the middle of the carriageway
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9),
      new THREE.MeshBasicMaterial({ map: closedBoardTex(), side: THREE.DoubleSide }));
    bd.position.set(0.3, 1.42, Z_BAR - 0.24);
    bd.rotation.y = Math.PI;                       // painted face turned south
    add(bd);
    box(0.09, 1.5, 0.09, steelM, -1.1, 0.75, Z_BAR - 0.24);
    box(0.09, 1.5, 0.09, steelM, 1.7, 0.75, Z_BAR - 0.24);

    // NO PEDESTRIANS, on the east walk where a person would actually try
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.22),
      new THREE.MeshBasicMaterial({ map: regSignTex(['NO', 'PEDESTRIANS']), side: THREE.DoubleSide }));
    sg.position.set(5.95, KERB + 2.15, Z_BAR - 0.5);
    sg.rotation.y = Math.PI;
    add(sg);
    box(0.09, 2.6, 0.09, steelM, 5.95, KERB + 1.3, Z_BAR - 0.5);

    // COLLISION. It reaches the WEST KERB LINE and stops there — it must not
    // round up into the footway or the way out of town closes itself. It abuts
    // the ramp fence's own box at exactly x -5.00, so there is no seam between
    // them for a 0.36 m body to find.
    obstacle({ minX: BAR_X0, maxX: BAR_X1 - 0.1, minZ: Z_BAR - 0.19, maxZ: Z_BAR + 0.5 });
  }

  // ── 5b. THE END OF THE FOOTWAY, UNDER THE DECK ──────────────────────────
  //
  // 38 m out, standing between the viaduct's two girders with ROUTE 97 seven
  // metres over your head, the pavement runs into the pier line and stops.
  // Chain link across it, one barrier, and a sign that says so.
  {
    const H = 2.3, W = WALK_X1 - 0.15 - (WALK_X0 - 0.25);
    const CX = (WALK_X0 - 0.25 + WALK_X1 - 0.15) / 2;
    const pm = new THREE.MeshBasicMaterial({ map: linkT.clone(), alphaTest: 0.25, side: THREE.DoubleSide });
    pm.map!.repeat.set(W / LINK_M, H / LINK_M); pm.map!.needsUpdate = true;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), pm);
    panel.position.set(CX, KERB + H / 2, Z_END + 0.15);
    add(panel);
    for (const x of [WALK_X0 - 0.2, CX, WALK_X1 - 0.2]) box(0.1, H, 0.1, steelM, x, KERB + H / 2, Z_END + 0.15);
    const rl = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, 0.07), steelM);
    rl.position.set(CX, KERB + H - 0.04, Z_END + 0.15); add(rl);
    // the barrier in front of it, so the stop has weight
    box(W - 0.3, 0.36, 0.34, barrierM, CX, KERB + 0.18, Z_END - 0.15);
    box(W - 0.3, 0.50, 0.22, barrierM, CX, KERB + 0.61, Z_END - 0.15);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.08),
      new THREE.MeshBasicMaterial({ map: regSignTex(['SIDEWALK', 'ENDS']), side: THREE.DoubleSide }));
    // NORTH OF THE STOP LINE, and hard against the ramp fence. It stood on a
    // post at z 57.18 in the middle of the footway — 6 cm SOUTH of where the
    // closure brings a 0.36 m body to rest, so he walked through the post. A
    // prop the player can reach needs a collider or needs to be out of reach;
    // this one is out of reach, which costs nothing.
    sg.position.set(WALK_X1 - 0.42, KERB + 1.85, Z_END + 0.02);
    sg.rotation.y = Math.PI;
    add(sg);
    box(0.09, 2.2, 0.09, steelM, WALK_X1 - 0.42, KERB + 1.1, Z_END + 0.07);
    // reaches the ramp fence's own box at -4.70, so the pen has no seam
    obstacle({ minX: WALK_X0 - 0.45, maxX: -4.70, minZ: Z_END, maxZ: Z_END + 0.6 });
  }

  // ── 6. the guide sign, cantilevered over the roadway ────────────────────
  //
  // North of the closure so it reads as belonging to the ramp and not to the
  // street, and high enough that it clears the barrier from every eye height.
  {
    const MX = 7.0, MH = 7.4;
    box(0.30, MH, 0.30, steelM, MX, MH / 2, 22.0);                 // the mast
    const armLen = 6.6;
    box(armLen, 0.26, 0.26, steelM, MX - armLen / 2, MH - 0.55, 22.0);
    box(0.18, 0.18, 0.18, steelM, MX - armLen, MH - 0.55, 22.0);
    // the brace back down to the mast, which is what makes it read as 1997
    // steel and not a floating shelf
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, Math.hypot(armLen * 0.7, 1.9)), steelM);
    br.position.set(MX - armLen * 0.35, MH - 1.5, 22.0);
    br.rotation.y = Math.PI / 2;
    br.rotation.x = Math.atan2(1.9, armLen * 0.7);
    add(br);
    const panelW = 5.6, panelH = 2.9;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.12),
      [steelM, steelM, steelM, steelM,
        new THREE.MeshBasicMaterial({ map: guideSignTex() }), steelM]);
    sign.position.set(MX - armLen * 0.62, MH - 2.15, 21.88);
    sign.rotation.y = Math.PI;                     // the painted face is -z
    add(sign);

    // MERGE, on the shoulder where the ramp lane picks up
    const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: mergeSignTex(), alphaTest: 0.4, side: THREE.DoubleSide }));
    mg.position.set(5.6, 2.35, 27.5);
    mg.rotation.y = Math.PI;
    add(mg);
    box(0.08, 2.0, 0.08, steelM, 5.6, 1.0, 27.5);
  }

  // ── 7. THE RAMP: deck, barriers, embankment, piers ──────────────────────
  //
  // Sampled off `at()` every 2.5 m. Each step is a group yawed to the path
  // heading with the deck banked inside it about its own axis, so the deck,
  // both barriers and the embankment under them roll together and the curve
  // reads as banked rather than as a flat plate bent sideways.
  const DS = 2.5;
  const steps = Math.ceil(S3 / DS);
  const deckMats = [deckSide, deckSide, deckTop, deckSide, deckSide, deckSide];
  for (let i = 0; i < steps; i++) {
    const s = i * DS, p = at(s + DS / 2);
    const segLen = DS + 0.06;                      // a hair long: segments abut
    const grp = new THREE.Group();
    grp.position.set(p.x, p.y, p.z);
    grp.rotation.y = p.yaw;
    add(grp);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(RAMP_HW * 2, DECK_T, segLen), deckMats);
    deck.position.y = -DECK_T / 2;
    deck.rotation.z = p.bank;
    grp.add(deck);

    // the barriers, on the deck edges and banked with it. The NORTH edge
    // (local -x once the deck is heading east) opens over the last 22 m — that
    // gap IS the merge.
    for (const sgn of [1, -1]) {
      if (sgn < 0 && s > S3 - 22) continue;
      const b = new THREE.Group();
      b.rotation.z = p.bank;
      const bx = sgn * (RAMP_HW - 0.22);
      const lo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, segLen), barrierM);
      lo.position.set(bx, 0.18, 0);
      const hi = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, segLen), barrierM);
      hi.position.set(bx, 0.62, 0);
      b.add(lo); b.add(hi);
      grp.add(b);
    }

    // embankment while it is low, piers once it is not
    if (p.y > 0.18 && p.y < 2.2) {
      const h = p.y - DECK_T;
      if (h > 0.02) {
        const emb = new THREE.Mesh(new THREE.BoxGeometry(RAMP_HW * 2 - 0.9, h + 0.2, segLen), concreteM);
        emb.position.y = -DECK_T - h / 2 - 0.1;
        grp.add(emb);
      }
    }
  }
  // the piers, every 8 m of arclength once the deck is off the embankment
  for (let s = 21; s < S3 - 2; s += 8) {
    const p = at(s);
    const h = p.y - DECK_T;
    if (h < 1.7) continue;
    box(1.35, h, 1.35, pierM, p.x, h / 2, p.z, p.yaw);
    box(2.1, 0.42, 2.1, pierM, p.x, h + 0.21, p.z, p.yaw);        // the cap
  }
  // the abutment where the ramp leaves the ground, so it does not simply
  // taper into the dirt
  box(RAMP_HW * 2 + 0.6, 0.5, 1.2, concreteM, at(6).x, 0.25, at(6).z);

  // ── 8. ROUTE 97, ELEVATED, RUNNING OUT OF TOWN ──────────────────────────
  {
    const cz = (VIA_Z0 + VIA_Z1) / 2, cx = (VIA_X0 + VIA_X1) / 2;
    const len = VIA_X1 - VIA_X0, wid = VIA_Z1 - VIA_Z0;
    const topT = rampTopTex(); topT.repeat.set(34, 3);
    const dm = [deckSide, deckSide, flat(topT), deckSide, deckSide, deckSide];
    box(len, VIA_T, wid, dm, cx, DECK_Y - VIA_T / 2, cz);

    // THE EDGE GIRDERS ARE THE STRUCTURE YOU ACTUALLY SEE. A 1 m slab on
    // sticks, read at 40 m through haze, is an awning; a deep fascia beam under
    // each edge is an elevated highway. The web is darker than the parapet
    // above it, which is what separates the two bands at that distance.
    const webM = flat(concreteTex('#4a4843', '#3d3b37'));
    for (const gz of [VIA_Z0 + 0.5, VIA_Z1 - 0.5]) {
      box(len, GIRDER_H, 1.0, webM, cx, DECK_Y - VIA_T - GIRDER_H / 2, gz);
    }
    // the underside between them, dark and stained, so you are not looking at a
    // bright grey ceiling from the street
    const und = new THREE.Mesh(new THREE.PlaneGeometry(len, wid - 1.6),
      new THREE.MeshBasicMaterial({ color: 0x36342f }));
    und.rotation.x = Math.PI / 2;
    und.position.set(cx, DECK_Y - VIA_T - 0.02, cz);
    add(und);

    // the parapets. The south one opens where the ramp comes in.
    const parapet = (x0: number, x1: number, z: number) => {
      box(x1 - x0, 0.40, 0.40, barrierM, (x0 + x1) / 2, DECK_Y + 0.20, z);
      box(x1 - x0, 0.68, 0.26, barrierM, (x0 + x1) / 2, DECK_Y + 0.74, z);
    };
    const MERGE_X0 = R_ARC + (S3 - S2) - 14, MERGE_X1 = R_ARC + (S3 - S2) + 4;
    parapet(VIA_X0, MERGE_X0, VIA_Z0 + 0.25);
    parapet(MERGE_X1, VIA_X1, VIA_Z0 + 0.25);
    parapet(VIA_X0, VIA_X1, VIA_Z1 - 0.25);
    // and the median, which is what makes it two carriageways
    box(len, 0.78, 0.32, barrierM, cx, DECK_Y + 0.39, cz);

    // hammerhead piers: one stem, one cap beam under the girders
    for (let x = VIA_X0 + 8; x < VIA_X1 - 4; x += 12) {
      const capY = DECK_Y - VIA_T - GIRDER_H;
      const stemH = capY - 1.05;
      box(2.6, stemH, 3.2, pierM, x, stemH / 2, cz);
      box(3.0, 1.05, wid - 1.2, pierM, x, stemH + 0.525, cz);
    }
  }

  // ── 9. highway lighting: davit masts, for the silhouette ────────────────
  for (const [lx, lz, ly] of [[6.2, 31, 9.5], [6.2, 43, 11.5], [-20, 54, 13.5],
    [30, 54, 13.5]] as [number, number, number][]) {
    box(0.26, ly, 0.26, steelM, lx, ly / 2, lz);
    box(2.2, 0.18, 0.18, steelM, lx - 1.0, ly - 0.1, lz);
    const head = box(0.9, 0.14, 0.42, new THREE.MeshBasicMaterial({ color: 0x8a8f96 }),
      lx - 2.0, ly - 0.22, lz);
    head.rotation.z = -0.14;
  }
}

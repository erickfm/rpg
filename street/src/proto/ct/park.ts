import * as THREE from 'three';
import type { AABB } from '../fp';
import { pixTex, dither } from './paint';

// What stands IN the park. `ct/street.ts` owns the SITE — the ground, the two
// party walls the gap exposed, the rear elevation and the low boundary along
// the street line — and hands the extents over; this file owns everything you
// find once you are inside. Same split `ct/civic.ts` already has with the
// library and the church.
//
// This is the first thing on the block that is not a building, and that is
// the whole opportunity: everything else here is a wall you walk past. So the
// job is not "decorate 30 m of grass", it is to make a place you walk INTO —
// which means an edge you cross, and somewhere to walk once you are over it.
//
// The hand is the library's, which the user liked: municipal, once cared
// about, not cared for since. Nothing here is pretty. The paths are the
// cheapest surface a parks department could lay, they go where people
// actually walk, and where they do not, the grass is worn through to dirt
// anyway.

export interface Site { minX: number; maxX: number; minZ: number; maxZ: number; y: number }

// A local LCG, because `rnd()` in ct/rng.ts is the ONE seeded stream and its
// order is load-bearing for every tree height and pigeon in the world
// (GOTCHAS §2). Nothing in here may draw from it.
const clcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

const PATH = '#7d7565', PATH_D = '#6c6455', PATH_L = '#8d8574';
const DIRT = '#6b5d47', DIRT_D = '#5e5240';

export function buildPark(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  /** register a ground material for the rain's wet-look tint, if the caller has one */
  wet?: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  KERB_H: number;
  site: Site;
  /** the opening in the street-line boundary, in z. Defaults to the middle
   *  28% — which is what `openSite`'s `gate: 0.36` leaves either side. If D
   *  changes that fraction, this is the number that has to follow it. */
  gate?: [number, number];
  obstacle?: (b: AABB) => AABB;
}) {
  const { scene, flat, KERB_H, site } = o;
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); o.obstacle?.(b); return b; };
  const wet = o.wet ?? ((m: THREE.MeshBasicMaterial) => m);

  const W = site.maxZ - site.minZ;                 // the frontage, 30 m
  const [gz0, gz1] = o.gate ?? [site.minZ + W * 0.36, site.maxZ - W * 0.36];
  const gateMid = (gz0 + gz1) / 2;

  // How far back you can actually GET, which is not how far back the park
  // goes: `crosstown.ts` clamps the player at x = -13.4 and the rear wall
  // stands at -14.0. Every path is laid inside the reachable part, because a
  // path you cannot walk to the end of is worse than no path. See
  // notes/BLOCKED-E.md — when the bound moves, this moves with it.
  const REACH = -13.4;
  const backX = Math.max(site.minX + 0.6, REACH + 0.9);

  // ── surfaces ─────────────────────────────────────────────────────────────
  //
  // Everything laid on the grass is a flat DECAL 6 mm above it, the way the
  // tree pits in ct/props.ts are — never a billboard, which would stand up on
  // end the moment you looked down at it (GOTCHAS §3). 6 mm because two
  // coplanar surfaces z-fight (§6) and this world has been bitten by that at
  // the corner roads, the sidewalk and the chamfer.
  const LIFT = 0.006;
  // 32 px/m, the ground art's density, and the canvas is sized from the
  // surface's real metres so the texels stay square whatever shape it is.
  const surfaceTex = (wM: number, dM: number, kind: 'path' | 'dirt') => {
    const PW = Math.max(8, Math.round(wM * 32)), PH = Math.max(8, Math.round(dM * 32));
    return pixTex(PW, PH, (g) => {
      const r = clcg(kind === 'path' ? 0x51c0de : 0x2b7f31);
      g.fillStyle = kind === 'path' ? PATH : DIRT;
      g.fillRect(0, 0, PW, PH);
      // the aggregate: hoggin is gravel rolled into clay, so it reads as
      // speckle at two scales rather than as a flat colour
      for (let i = 0; i < Math.round(PW * PH * 0.02); i++) {
        const k = r();
        g.fillStyle = kind === 'path'
          ? (k > 0.72 ? PATH_L : k > 0.34 ? PATH_D : PATH)
          : (k > 0.6 ? DIRT_D : DIRT);
        g.fillRect(Math.floor(r() * PW), Math.floor(r() * PH), 1 + Math.floor(r() * 2), 1);
      }
      // …and the edges go first: grass creeps in from both sides in patches
      g.fillStyle = 'rgba(96,104,78,0.55)';
      for (let i = 0; i < Math.round(PH * 0.5); i++) {
        const y = Math.floor(r() * PH), d = 1 + Math.floor(r() * 4);
        if (r() < 0.5) g.fillRect(0, y, d, 1 + Math.floor(r() * 3));
        else g.fillRect(PW - d, y, d, 1 + Math.floor(r() * 3));
      }
      if (kind === 'path') {                        // a patch of asphalt, once
        g.fillStyle = '#4c4a48';
        const ax = Math.round(PW * 0.2), ay = Math.round(PH * 0.42);
        g.fillRect(ax, ay, Math.round(PW * 0.55), Math.round(PH * 0.06));
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(ax, ay, Math.round(PW * 0.55), 2);
      }
      dither(g, PW, PH, Math.round(wM * dM * 8));
    });
  };
  /** a flat run of surface, laid in the x/z plane */
  const lay = (x0: number, x1: number, z0: number, z1: number, kind: 'path' | 'dirt') => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wet(flat(surfaceTex(w, d, kind))));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, KERB_H + LIFT, (z0 + z1) / 2);
    scene.add(m);
    return m;
  };

  // ── the paths ────────────────────────────────────────────────────────────
  //
  // A T, not a curve. Municipal paths go somewhere: in from the gate, then
  // along the park to both ends. A path that meanders decoratively is a
  // landscape-architecture path and this is not that kind of park — and a
  // curve at this depth would only read as a wobble anyway.
  const SPINE_W = 1.6, ENTRY_W = 1.9;
  lay(site.maxX, backX + SPINE_W / 2, gateMid - ENTRY_W / 2, gateMid + ENTRY_W / 2, 'path');
  lay(backX - SPINE_W / 2, backX + SPINE_W / 2, site.minZ + 2.4, site.maxZ - 2.4, 'path');

  // ── the desire lines ─────────────────────────────────────────────────────
  //
  // Where the path does not go and people do. Both corners of the T are cut,
  // because nobody has ever walked a right angle they could avoid, and there
  // is a diagonal from the gate to each end — which is the shortest line
  // between the two things anyone is actually crossing this park to reach.
  const worn = (x0: number, z0: number, x1: number, z1: number, w = 0.75) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), wet(flat(surfaceTex(w, len, 'dirt'))));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(dx, dz);
    m.position.set((x0 + x1) / 2, KERB_H + LIFT * 0.5, (z0 + z1) / 2);
    scene.add(m);
  };
  for (const s of [-1, 1]) {
    const zEnd = s < 0 ? site.minZ + 3.6 : site.maxZ - 3.6;
    worn(site.maxX - 0.6, gateMid + s * 1.0, backX, zEnd, 0.8);   // the diagonal
    worn(backX + 1.2, gateMid + s * 1.1, backX, gateMid + s * 3.4, 0.62);   // the cut corner
  }

  // ── the fence ────────────────────────────────────────────────────────────
  //
  // street.ts puts a 0.62 m boundary wall along the street line with the gate
  // left open in the middle. That is an edge but it is not a room: you read a
  // low wall as something to sit on, and an iron fence as something you are
  // inside. So the railings stand ON that wall and the gate gets piers.
  //
  // COUPLING: the wall's height and thickness are street.ts's, not published,
  // and read off here as 0.62 / 0.36. If D changes them these follow.
  const WALL_H = 0.62, WALL_T = 0.36, RAIL_H = 0.95;
  const railTex = (lenM: number) => {
    const RW = Math.max(16, Math.round(lenM * 12)), RH = Math.round(RAIL_H * 12);
    return pixTex(RW, RH, (g) => {
      g.clearRect(0, 0, RW, RH);
      g.fillStyle = '#3a3f39';
      const pitch = Math.max(3, Math.round(0.17 * 12));
      for (let x = 2; x < RW; x += pitch) g.fillRect(x, 2, 2, RH - 3);
      g.fillRect(0, 0, RW, 2);                      // top rail
      g.fillRect(0, RH - 4, RW, 2);                 // bottom rail
      g.fillStyle = '#4a5049';                      // and the rust that follows
      for (let x = 2; x < RW; x += pitch * 3) g.fillRect(x, RH - 10, 2, 7);
    });
  };
  const railM = (lenM: number) => new THREE.MeshBasicMaterial({
    map: railTex(lenM), alphaTest: 0.5, side: THREE.DoubleSide, transparent: true,
  });
  const RAIL_X = site.maxX - WALL_T / 2;
  for (const [rz0, rz1] of [[site.minZ + 0.3, gz0], [gz1, site.maxZ - 0.3]] as [number, number][]) {
    const len = rz1 - rz0;
    if (len <= 0.2) continue;
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(len, RAIL_H), railM(len));
    rail.rotation.y = Math.PI / 2;
    rail.position.set(RAIL_X, KERB_H + WALL_H + RAIL_H / 2, (rz0 + rz1) / 2);
    scene.add(rail);
  }
  // the gate piers. Brick, not stone — this is a parks department, not a
  // civic architect, and the library is 90 m away being the other thing.
  const pierT = pixTex(16, 40, (g) => {
    const r = clcg(0x7ac91e);
    g.fillStyle = '#7a4a3a'; g.fillRect(0, 0, 16, 40);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 40; y += 5) g.fillRect(0, y, 16, 1);
    for (let y = 0; y < 40; y += 10) for (let x = (y % 20) ? 0 : 4; x < 16; x += 9) g.fillRect(x, y, 1, 5);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 14; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 40), 2, 1);
    g.fillStyle = '#8a7a62'; g.fillRect(0, 0, 16, 3);            // coping
  });
  const pierM = flat(pierT);
  const capM = new THREE.MeshBasicMaterial({ color: 0x8a7a62 });
  for (const gz of [gz0, gz1]) {
    const px = site.maxX - 0.28, dir = gz === gz0 ? -1 : 1;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.62, 0.56), pierM);
    pier.position.set(px, KERB_H + 0.81, gz + dir * 0.28);
    scene.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.7), capM);
    cap.position.set(px, KERB_H + 1.69, gz + dir * 0.28);
    scene.add(cap);
    solid({ minX: px - 0.28, maxX: px + 0.28, minZ: gz + dir * 0.28 - 0.28, maxZ: gz + dir * 0.28 + 0.28 });
    // the leaf, standing open against the railing the way a park gate does
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.15), railM(1.2));
    leaf.rotation.y = Math.PI / 2;
    leaf.position.set(px - 0.62, KERB_H + 0.6, gz + dir * 0.86);
    scene.add(leaf);
  }

  return { colliders };
}

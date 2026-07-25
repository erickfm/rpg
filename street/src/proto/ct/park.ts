import * as THREE from 'three';
import type { AABB } from '../fp';
import type { CtxBuild } from './ctx';
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

// Takes the build context the whole world is given, plus the site extents
// ct/street.ts published. The entry point already holds both — it reads
// `street.park` for the floor height — so wiring this is one line there and
// nothing has to be threaded through street.ts.
export function buildPark(ctx: CtxBuild, site: Site, gate?: [number, number]) {
  const { scene, flat, wet, KERB_H, obstacle } = ctx;
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); obstacle(b); return b; };

  const W = site.maxZ - site.minZ;                 // the frontage, 30 m
  // the opening in the street-line boundary. Defaults to the middle 28% —
  // what `openSite`'s `gate: 0.36` leaves either side. If D changes that
  // fraction this is the number that has to follow it.
  const [gz0, gz1] = gate ?? [site.minZ + W * 0.36, site.maxZ - W * 0.36];
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

  // ── what you find once you are in ────────────────────────────────────────
  //
  // Four things, and all of them face INTO the park rather than out at the
  // traffic. A bench turned to the street is a bus stop; a bench turned to
  // the path is a park. That is most of the difference between this and the
  // 30 m of pavement outside it.
  const woodM = new THREE.MeshBasicMaterial({ color: 0x5c4a33 });
  const woodM2 = new THREE.MeshBasicMaterial({ color: 0x51402c });
  const ironM = new THREE.MeshBasicMaterial({ color: 0x39403a });
  const concM = new THREE.MeshBasicMaterial({ color: 0x8a8478 });

  // Benches: heavy cast ends and slatted seat and back, the pattern every
  // parks department in America bolted down and never replaced. They stand
  // along the spine, facing it, which is the only thing there is to look at.
  //
  // SITTABLE, through `ctx.seat` — the user's *"for every seat in the game i
  // want to be able to sit down"*, and F's registration means this needs
  // nothing from the desk. The seat pan is 0.45 above the park floor, and the
  // trigger sits on the seat with the approach out on the path, because the
  // bench's own collider would otherwise keep you further away than `r`.
  const bench = (z: number, faceEast: boolean) => {
    const bx = backX + (faceEast ? 1.45 : -1.45);
    const yaw = faceEast ? Math.PI / 2 : -Math.PI / 2;
    const y0 = KERB_H;
    for (const dz of [-0.78, 0.78]) {                 // the two cast ends
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.1), ironM);
      end.position.set(bx, y0 + 0.22, z + dz);
      scene.add(end);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.1), ironM);
      arm.position.set(bx, y0 + 0.66, z + dz);
      scene.add(arm);
    }
    for (let i = 0; i < 3; i++) {                     // the seat slats
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 1.7), i % 2 ? woodM2 : woodM);
      sl.position.set(bx - 0.21 + i * 0.2, y0 + 0.45, z);
      scene.add(sl);
    }
    for (let i = 0; i < 2; i++) {                     // …and the back
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 1.7), i % 2 ? woodM2 : woodM);
      sl.position.set(bx + (faceEast ? -0.26 : 0.26), y0 + 0.62 + i * 0.19, z);
      scene.add(sl);
    }
    solid({ minX: bx - 0.34, maxX: bx + 0.34, minZ: z - 0.88, maxZ: z + 0.88 });
    ctx.seat({
      x: bx, z, yaw, h: 0.45,
      approach: { x: backX + (faceEast ? 0.1 : -0.1), z },
      label: 'sit on the bench',
    });
  };
  bench(gateMid + 5.2, true);
  bench(gateMid - 5.2, true);
  bench(site.maxZ - 5.0, false);

  // The drinking fountain. Municipal, chipped, and it has not worked in
  // years — which is the same sentence as the library, and on purpose.
  const fx = backX + 1.3, fz = gateMid - 1.6;
  const fPed = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.86, 0.34), concM);
  fPed.position.set(fx, KERB_H + 0.43, fz);
  scene.add(fPed);
  const fBowl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.44), concM);
  fBowl.position.set(fx, KERB_H + 0.93, fz);
  scene.add(fBowl);
  const fBasin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0x4e5a52 }));
  fBasin.position.set(fx, KERB_H + 1.0, fz);
  scene.add(fBasin);
  const fSpout = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), ironM);
  fSpout.position.set(fx + 0.15, KERB_H + 1.05, fz);
  scene.add(fSpout);
  solid({ minX: fx - 0.3, maxX: fx + 0.3, minZ: fz - 0.28, maxZ: fz + 0.28 });

  // The bin, by the gate where the litter actually is
  const binX = backX + 2.6, binZ = gateMid + 1.9;
  const binT = pixTex(8, 14, (g) => {
    g.fillStyle = '#333a2b'; g.fillRect(0, 0, 8, 14);
    g.fillStyle = '#4e5340';
    for (const x of [1, 3, 5]) g.fillRect(x, 2, 1, 10);
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 10, 8, 1);
    g.fillStyle = '#2b3226'; g.fillRect(0, 0, 8, 2); g.fillRect(0, 12, 8, 2);
  });
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.46), flat(binT));
  bin.position.set(binX, KERB_H + 0.4, binZ);
  scene.add(bin);
  solid({ minX: binX - 0.26, maxX: binX + 0.26, minZ: binZ - 0.26, maxZ: binZ + 0.26 });

  // Planting along the back, against the rear elevation. It is the one thing
  // that stops the wall being a wall — and at this depth the wall is most of
  // what you see, so it earns its place. Overgrown, because nobody prunes it.
  const shrubT = pixTex(16, 16, (g) => {
    const r = clcg(0x3ea77c);
    g.fillStyle = '#3f5232'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 90; i++) {
      const k = r();
      g.fillStyle = k > 0.62 ? '#4e6440' : k > 0.3 ? '#374a2c' : '#2b3a23';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
    }
  });
  const shrubM = flat(shrubT);
  const rb = clcg(0x11d0ee);
  for (let z = site.minZ + 1.6; z < site.maxZ - 1.4; z += 2.1) {
    if (Math.abs(z - gateMid) < 3.4) continue;         // keep the entry clear
    const h = 1.3 + rb() * 0.9, w = 1.1 + rb() * 0.6;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5 + rb() * 0.5), shrubM);
    sh.position.set(site.minX + 0.75, KERB_H + h / 2, z);
    scene.add(sh);
    solid({ minX: site.minX, maxX: site.minX + 1.4, minZ: z - 0.8, maxZ: z + 0.8 });
  }

  return { colliders };
}

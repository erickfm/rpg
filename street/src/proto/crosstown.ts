import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, type AABB } from './fp';

// ═══════════════════════════════════════════════════════════════════════════
// CROSSTOWN '97 — the small world. One hand-authored street.
//
// Scoped down on purpose: no streaming, no procedural grid. This is the
// original narrow street, finished properly — closed at both ends by cross
// buildings half-swallowed in fog, upgraded with the 8-angle citizens and
// the painted car fleet from the milestone. We grow it from here, together,
// block by deliberate block.
// ═══════════════════════════════════════════════════════════════════════════
import { L, ROAD_HALF, WALK, FACE, PARK_X, DRIVE_X, FOG_NEAR, FOG_FAR, rnd } from './ct/rng';
import { pixTex, dither } from './ct/paint';
import {
  facadeTex, shopfrontTex, asphaltTex, walkTex, treeSprite, treePitTex,
  resGroundTex, hydrantSprite, pigeonSprite, payphoneTex,
} from './ct/tex-world';
import { CAR_COLORS, type CarKind, makeCar } from './ct/cars';
import { buildBodega } from './ct/bodega';
import { buildStreet } from './ct/street';
import { FW, FH, type Fit, citizenAtlas, viewFor } from './ct/citizens';

// ═══════════════════════════════ the world ════════════════════════════════

export function makeCrosstown(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(88, 1, 0.1, 220);
  scene.background = new THREE.Color(0x8a97a2);
  scene.fog = new THREE.Fog(0x8a97a2, FOG_NEAR, FOG_FAR);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1), new THREE.HemisphereLight(0xd8dce0, 0x6a6258, 0.5));

  const flat = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m });

  // ground: the main street, and a side street it turns into at the south
  // end (the corner). Same road width, same kerbs, fog owns the far end.
  const SIDE_Z0 = -98, SIDE_Z1 = -108;  // side-street road band
  const SIDE_X1 = 55;                   // side street runs east to here
  // wet-look plumbing: horizontal ground surfaces darken + cool toward WET as
  // the rain comes in (everything is unlit, so we tint the map materials).
  const wetMats: { m: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  const WET = new THREE.Color(0x5a626e);
  const wet = (m: THREE.MeshBasicMaterial) => { wetMats.push({ m, base: m.color.clone() }); return m; };
  // the two road planes ABUT at z = -98 — never overlap, never z-fight
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 36 - SIDE_Z0), wet(flat(asphaltTex())));
  road.rotation.x = -Math.PI / 2; road.position.z = (36 + SIDE_Z0) / 2;
  scene.add(road);
  const sideRoad = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_X1 + 7, 10), wet(flat(asphaltTex(SIDE_X1 + 7, 10))));
  sideRoad.rotation.x = -Math.PI / 2;
  sideRoad.position.set((SIDE_X1 - 7) / 2, 0, (SIDE_Z0 + SIDE_Z1) / 2);
  scene.add(sideRoad);
  // raised sidewalks with a visible curb face
  const KERB_H = 0.14;
  const kerbFaceM = new THREE.MeshBasicMaterial({ color: 0x97928a });
  const walkDarkM = new THREE.MeshBasicMaterial({ color: 0x6a675f });
  for (const s of [-1, 1]) {
    const zBot = s > 0 ? SIDE_Z0 : SIDE_Z1 - 2; // west walk wraps the corner
    const len = 16.5 - zBot;
    const topM = wet(flat(walkTex(WALK, len)));
    const mats = s > 0
      // east walk: -x face is the kerb, and its south END (-z, at z=-98) is
      // also a kerb so the raised edge WRAPS the corner instead of showing a
      // dark unfinished notch where the side-street north walk picks up
      ? [walkDarkM, kerbFaceM, topM, walkDarkM, walkDarkM, kerbFaceM]
      : [kerbFaceM, walkDarkM, topM, walkDarkM, walkDarkM, walkDarkM]; // +x face is the kerb
    const walk = new THREE.Mesh(new THREE.BoxGeometry(WALK, KERB_H + 0.04, len), mats);
    walk.position.set(s * (ROAD_HALF + WALK / 2), (KERB_H + 0.04) / 2 - 0.04, (16.5 + zBot) / 2);
    scene.add(walk);
  }
  // side-street walks: north (in front of the corner shops), south, east end
  {
    const north = new THREE.Mesh(new THREE.BoxGeometry(50, KERB_H + 0.04, 2),
      [walkDarkM, walkDarkM, wet(flat(walkTex(50, 2))), walkDarkM, walkDarkM, kerbFaceM]);
    north.position.set(32, (KERB_H + 0.04) / 2 - 0.04, SIDE_Z0 + 1);
    scene.add(north);
    // starts at x=-5 (not -7) so it ABUTS the wrapped west walk instead of
    // overlapping it in the SW corner square (two coplanar tops = z-fighting)
    const south = new THREE.Mesh(new THREE.BoxGeometry(62, KERB_H + 0.04, 2),
      [walkDarkM, walkDarkM, wet(flat(walkTex(62, 2))), walkDarkM, kerbFaceM, walkDarkM]);
    south.position.set(26, (KERB_H + 0.04) / 2 - 0.04, SIDE_Z1 - 1);
    scene.add(south);
    const east = new THREE.Mesh(new THREE.BoxGeometry(2, KERB_H + 0.04, 12),
      [walkDarkM, kerbFaceM, wet(flat(walkTex(2, 12))), walkDarkM, walkDarkM, walkDarkM]);
    east.position.set(SIDE_X1 + 1, (KERB_H + 0.04) / 2 - 0.04, (SIDE_Z0 + SIDE_Z1) / 2 - 1);
    scene.add(east);
  }
  const sidewalkY = KERB_H; // prop base height on the walks
  const lineT = pixTex(8, 32, (g) => { g.fillStyle = '#b8a24e'; g.fillRect(2, 0, 4, 18); });
  lineT.wrapS = lineT.wrapT = THREE.RepeatWrapping;
  lineT.repeat.set(1, 38);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 36 - SIDE_Z0), new THREE.MeshBasicMaterial({ map: lineT, alphaTest: 0.5 }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.03, (36 + SIDE_Z0) / 2);
  const lineT2 = lineT.clone();
  lineT2.repeat.set(1, 22);
  lineT2.needsUpdate = true;
  const line2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 48), new THREE.MeshBasicMaterial({ map: lineT2, alphaTest: 0.5 }));
  line2.rotation.x = -Math.PI / 2;
  line2.rotation.z = Math.PI / 2;
  line2.position.set(30, 0.032, (SIDE_Z0 + SIDE_Z1) / 2);
  scene.add(line2);
  scene.add(line);

  // buildings — every one a specific place, laid by hand end to end.
  // West carries the walk-up (No. 227, res facade, entrance at z=-31) and
  // the alley; nothing on the street is filler.
  const AZ0 = -37, AZ1 = -43.5; // the alley gap in the left wall
  const boards: { m: THREE.Mesh }[] = [];
  buildStreet({ scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1 });
  // ── No. 227 — the player's walk-up ──────────────────────────────────────
  // Four stories, a switchback stair, your place (301) on the third floor,
  // and the hermit across the hall at 302. The interior is parked far east
  // of the street, past the fog, in the same scene; the doors teleport.
  const APT_X = 200, APT_Z = -20, ST = 2.7;
  const AX = (lx: number) => APT_X + lx, AZI = (lz: number) => APT_Z + lz;
  let lastGy = 0; // last ground height — this is what picks the active floor
  const mkCap = (): AABB => ({ minX: 999, maxX: 999, minZ: 999, maxZ: 999 });
  const stairCap = mkCap();       // no stairs above floor 3
  const underStairA = mkCap();    // lobby: dead space under the flights
  const underStairB = mkCap();
  const aptDoorCap = mkCap();     // 301's doorway only opens on floor 3
  const setCap = (c: AABB, on: boolean, x0: number, x1: number, z0: number, z1: number) => {
    if (on) { c.minX = x0; c.maxX = x1; c.minZ = z0; c.maxZ = z1; }
    else { c.minX = c.maxX = c.minZ = c.maxZ = 999; }
  };
  let hermit!: THREE.Mesh;
  const sevColliders: AABB[] = [];
  {
    const texM = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    // tired beige stripes; the tile is one 2.7 m story so baseboards land on
    // every floor of the full-height walls
    const wallpaperT = pixTex(64, 64, (g) => {
      g.fillStyle = '#7e7460'; g.fillRect(0, 0, 64, 64); // dim halls — one bare bulb's worth
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64);
      g.fillStyle = 'rgba(0,0,0,0.14)';
      for (let x = 6; x < 64; x += 8) g.fillRect(x, 0, 1, 64);
      dither(g, 64, 64, 90);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, 64, 5);  // ceiling shadow each storey
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 5, 64, 4);
      g.fillStyle = '#3e3024'; g.fillRect(0, 58, 64, 6);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 58, 64, 1);
    });
    const roomWallT = pixTex(64, 64, (g) => {
      g.fillStyle = '#8a95a0'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
      dither(g, 64, 64, 80);
      g.fillStyle = '#3c3428'; g.fillRect(0, 58, 64, 6);
    });
    const carpetT = pixTex(64, 64, (g) => {
      g.fillStyle = '#663832'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 40; i++) g.fillRect(Math.floor(Math.random() * 62), Math.floor(Math.random() * 62), 3, 2);
      g.fillStyle = 'rgba(200,170,120,0.15)';
      for (let y = 8; y < 64; y += 16) for (let x = (y % 32) ? 2 : 10; x < 60; x += 16) { g.fillRect(x, y, 5, 1); g.fillRect(x + 2, y - 2, 1, 5); }
      dither(g, 64, 64, 130);
    });
    const woodFloorT = pixTex(64, 64, (g) => {
      g.fillStyle = '#7a5c3c'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 1);
      for (let y = 0; y < 64; y += 8) g.fillRect(((y * 13) % 56), y + 1, 1, 7);
      dither(g, 64, 64, 110);
    });
    const ceilT = pixTex(32, 32, (g) => {
      g.fillStyle = '#6e6a60'; g.fillRect(0, 0, 32, 32);
      dither(g, 32, 32, 60);
    });
    const H = 3 * ST + 2.55; // top-floor ceiling height
    const wallMesh = (w: number, h: number, cx: number, cy: number, cz: number, ry: number, tex = wallpaperT) => {
      const t = tex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 2.7, h / 2.7);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), texM(t));
      m.position.set(cx, cy, cz);
      m.rotation.y = ry;
      scene.add(m);
      return m;
    };
    const floorMesh = (y: number, w: number, d: number, cx: number, cz: number, tex = carpetT) => {
      const t = tex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 1.8, d / 1.8);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), texM(t));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, y, cz);
      scene.add(m);
      return m;
    };
    // hall + stairwell shell. West wall leaves 301's doorway gap on floor 3.
    wallMesh(3.1, H, AX(0), H / 2, AZI(1.55), Math.PI / 2);
    wallMesh(9.3, H, AX(0), H / 2, AZI(8.55), Math.PI / 2);
    wallMesh(0.8, 2 * ST, AX(0), ST, AZI(3.5), Math.PI / 2);
    wallMesh(0.8, H - 2 * ST - 2.1, AX(0), (H + 2 * ST + 2.1) / 2, AZI(3.5), Math.PI / 2);
    wallMesh(13.2, H, AX(2.4), H / 2, AZI(6.6), -Math.PI / 2);
    wallMesh(2.4, H, AX(1.2), H / 2, AZI(0), 0);
    wallMesh(2.4, H, AX(1.2), H / 2, AZI(13.2), Math.PI);
    sevColliders.push(
      { minX: AX(-0.15), maxX: AX(0), minZ: AZI(0), maxZ: AZI(3.1) },
      { minX: AX(-0.15), maxX: AX(0), minZ: AZI(3.9), maxZ: AZI(13.2) },
      { minX: AX(2.4), maxX: AX(2.55), minZ: AZI(0), maxZ: AZI(13.2) },
      { minX: AX(0), maxX: AX(2.4), minZ: AZI(-0.15), maxZ: AZI(0) },
      { minX: AX(0), maxX: AX(2.4), minZ: AZI(13.2), maxZ: AZI(13.35) },
      { minX: AX(1.16), maxX: AX(1.24), minZ: AZI(8.4), maxZ: AZI(11.0) }, // centre banister
      { minX: AX(2.25), maxX: AX(2.4), minZ: AZI(3.05), maxZ: AZI(3.95) }, // 302's doorway (and the hermit in it)
      stairCap, underStairA, underStairB, aptDoorCap,
    );
    // floors, ceilings
    for (let f = 0; f < 4; f++) {
      floorMesh(f * ST + 0.006, 2.4, 8.4, AX(1.2), AZI(4.2));
      if (f < 3) floorMesh(f * ST + 2.55, 2.4, 8.4, AX(1.2), AZI(4.2), ceilT);
    }
    floorMesh(H, 2.4, 13.2, AX(1.2), AZI(6.6), ceilT);
    // the switchback: steeper now — 8 treads over a 2.6 m run (~28°), wood
    // grain on top, painted risers, a generous half landing
    const treadTopT = pixTex(32, 16, (g) => {
      g.fillStyle = '#6a5038'; g.fillRect(0, 0, 32, 16);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 4; y < 16; y += 4) g.fillRect(0, y, 32, 1);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(10, 4, 12, 12); // worn centre
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 0, 32, 2); // nosing
      dither(g, 32, 16, 40);
    });
    const riserT = pixTex(32, 12, (g) => {
      g.fillStyle = '#54402c'; g.fillRect(0, 0, 32, 12);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 32, 2);
      dither(g, 32, 12, 24);
    });
    const darkWoodM = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    const treadMats = [darkWoodM, darkWoodM, texM(treadTopT), darkWoodM, texM(riserT), texM(riserT)];
    const railM = new THREE.MeshBasicMaterial({ color: 0x3a2c20 });
    const landMats = [darkWoodM, darkWoodM, texM(woodFloorT.clone()), darkWoodM, darkWoodM, darkWoodM];
    for (let f = 0; f < 3; f++) {
      for (let i = 0; i < 8; i++) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.36), treadMats);
        a.position.set(AX(0.6), f * ST + (i + 0.5) * (1.35 / 8), AZI(8.4 + (i + 0.5) * (2.6 / 8)));
        scene.add(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.36), treadMats);
        b.position.set(AX(1.8), f * ST + 1.35 + (i + 0.5) * (1.35 / 8), AZI(11.0 - (i + 0.5) * (2.6 / 8)));
        scene.add(b);
      }
      const land = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.2), landMats);
      land.position.set(AX(1.2), f * ST + 1.35 - 0.07, AZI(12.1));
      scene.add(land);
      // solid sloped undersides — the flights read as built, not floating
      const slope = Math.atan2(1.35, 2.6);
      const underA2 = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, 2.95), darkWoodM);
      underA2.position.set(AX(0.6), f * ST + 0.56, AZI(9.7));
      underA2.rotation.x = -slope;
      scene.add(underA2);
      const underB2 = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, 2.95), darkWoodM);
      underB2.position.set(AX(1.8), f * ST + 1.9, AZI(9.7));
      underB2.rotation.x = slope;
      scene.add(underB2);
      // handrails ride the centre divider, one per flight
      const hrA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 2.85), railM);
      hrA.position.set(AX(1.11), f * ST + 1.5, AZI(9.7));
      hrA.rotation.x = -slope;
      scene.add(hrA);
      const hrB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 2.85), railM);
      hrB.position.set(AX(1.29), f * ST + 2.85, AZI(9.7));
      hrB.rotation.x = slope;
      scene.add(hrB);
    }
    // one solid core wall between the up and down flights — no floating
    // diagonal rails, treads butt into something real
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3 * ST + 1.5, 2.6), new THREE.MeshBasicMaterial({ color: 0x685e50 }));
    divider.position.set(AX(1.2), (3 * ST + 1.5) / 2, AZI(9.7));
    scene.add(divider);
    // lobby: dead space boxed in under the stairs
    const underM = new THREE.MeshBasicMaterial({ color: 0x1a1b21 });
    const uA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 4.8), underM);
    uA.position.set(AX(1.8), 0.65, AZI(10.8));
    scene.add(uA);
    const uB = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 2.2), underM);
    uB.position.set(AX(0.6), 0.65, AZI(12.1));
    scene.add(uB);
    // doors up the floors — 301 is a real opening; 302 is the hermit's
    const doorTexN = (num: string) => pixTex(32, 64, (g) => {
      g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#5c4430'; g.fillRect(3, 3, 26, 61);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(7, 16, 18, 16); g.fillRect(7, 38, 18, 20);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(7, 16, 18, 2); g.fillRect(7, 38, 18, 2);
      g.fillStyle = '#c9b45e'; g.fillRect(24, 33, 3, 3);
      dither(g, 32, 64, 40);
      g.fillStyle = '#d8d4c8'; g.fillRect(7, 5, 18, 9); // plate painted after the grime
      g.fillStyle = '#26221c'; g.font = 'bold 8px monospace'; g.textAlign = 'center';
      g.fillText(num, 16, 12);
    });
    const doorPlane = (num: string, wx: number, baseY: number, wz: number, ry: number) => {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), texM(doorTexN(num)));
      d.position.set(wx, baseY + 1.05, wz);
      d.rotation.y = ry;
      scene.add(d);
    };
    for (let f = 0; f < 4; f++) {
      if (f !== 2) {
        doorPlane(`${f + 1}01`, AX(0.02), f * ST, AZI(3.5), Math.PI / 2);
        doorPlane(`${f + 1}02`, AX(2.38), f * ST, AZI(3.5), -Math.PI / 2);
      }
    }
    // 302 ajar: dark slice of his place, the door swung inward, him in it
    const recess = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), new THREE.MeshBasicMaterial({ color: 0x0c0d10 }));
    recess.position.set(AX(2.39), 2 * ST + 1.05, AZI(3.5));
    recess.rotation.y = -Math.PI / 2;
    scene.add(recess);
    const leafGeo = new THREE.PlaneGeometry(0.95, 2.1);
    leafGeo.translate(0.475, 0, 0);
    const leaf = new THREE.Mesh(leafGeo, texM(doorTexN('302')));
    leaf.position.set(AX(2.44), 2 * ST + 1.05, AZI(3.06));
    leaf.rotation.y = -Math.PI / 2 + 0.85;
    scene.add(leaf);
    // the hermit — a big quiet man; you only ever catch him at his door
    const hermitT = pixTex(44, 64, (g) => {
      g.fillStyle = '#4a3c30'; g.fillRect(11, 61, 9, 3); g.fillRect(24, 61, 9, 3);
      g.fillStyle = '#4a4a52'; g.fillRect(9, 43, 11, 19); g.fillRect(24, 43, 11, 19);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(9, 43, 11, 3); g.fillRect(24, 43, 11, 3);
      g.fillStyle = '#d8d4c8';
      g.beginPath(); g.ellipse(22, 32, 16, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(6, 32, 32, 12);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(6, 39, 32, 5);
      g.fillStyle = '#c9946a';
      g.fillRect(2, 25, 6, 15); g.fillRect(36, 25, 6, 15);
      g.fillStyle = '#c9946a'; g.fillRect(15, 8, 14, 13);
      g.fillRect(13, 15, 18, 7); // jowls
      g.fillStyle = '#3a3226'; g.fillRect(13, 7, 18, 3); g.fillRect(12, 8, 3, 5); g.fillRect(29, 8, 3, 5);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(14, 19, 16, 3);
      g.fillStyle = '#241a12'; g.fillRect(18, 12, 2, 2); g.fillRect(25, 12, 2, 2);
      dither(g, 44, 64, 26);
    });
    hermit = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.96), new THREE.MeshBasicMaterial({ map: hermitT, alphaTest: 0.5, side: THREE.DoubleSide }));
    hermit.position.set(AX(2.3), 2 * ST + 0.98, AZI(3.5));
    hermit.rotation.y = -Math.PI / 2;
    scene.add(hermit);
    // bare-bulb glows in the hall and on the half landings
    const glowT = pixTex(32, 32, (g) => {
      const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      gr.addColorStop(0, 'rgba(255,225,170,0.85)');
      gr.addColorStop(1, 'rgba(255,225,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    });
    const glowMat = new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let f = 0; f < 4; f++) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), glowMat);
      gl.position.set(AX(1.2), f * ST + 2.3, AZI(3.5));
      boards.push({ m: gl });
      scene.add(gl);
      if (f < 3) {
        const g2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), glowMat);
        g2.position.set(AX(1.2), f * ST + 1.35 + 1.95, AZI(12.5));
        boards.push({ m: g2 });
        scene.add(g2);
      }
    }
    // lobby dressing: mailboxes and the front door
    const mailT = pixTex(48, 32, (g) => {
      g.fillStyle = '#2c2620'; g.fillRect(0, 0, 48, 32);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = '#8a7a4e'; g.fillRect(3 + c * 11, 3 + r * 9, 9, 7);
        g.fillStyle = '#5e5236'; g.fillRect(4 + c * 11, 6 + r * 9, 7, 1);
      }
    });
    const mail = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), texM(mailT));
    mail.position.set(AX(2.38), 1.4, AZI(1.3));
    mail.rotation.y = -Math.PI / 2;
    scene.add(mail);
    const frontDoorT = pixTex(32, 64, (g) => {
      g.fillStyle = '#2c3c2e'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#3e5240'; g.fillRect(3, 3, 26, 58);
      g.fillStyle = '#141820'; g.fillRect(7, 8, 18, 20);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 10; i < 28; i += 4) g.fillRect(7, i, 18, 1);
      g.fillStyle = '#c9b45e'; g.fillRect(24, 36, 3, 3);
      dither(g, 32, 64, 40);
    });
    const lobbyDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), texM(frontDoorT));
    lobbyDoor.position.set(AX(1.2), 1.05, AZI(0.02));
    scene.add(lobbyDoor);
    // 301 — your place: wood floor, a bed, the window with the city in it
    wallMesh(3.5, 2.55, AX(-3.2), 2 * ST + 1.275, AZI(3.75), Math.PI / 2, roomWallT);
    wallMesh(3.2, 2.55, AX(-1.6), 2 * ST + 1.275, AZI(2), 0, roomWallT);
    wallMesh(3.2, 2.55, AX(-1.6), 2 * ST + 1.275, AZI(5.5), Math.PI, roomWallT);
    floorMesh(2 * ST + 0.007, 3.2, 3.5, AX(-1.6), AZI(3.75), woodFloorT);
    floorMesh(2 * ST + 2.55, 3.2, 3.5, AX(-1.6), AZI(3.75), ceilT);
    const winT = pixTex(32, 32, (g) => {
      g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#b8c4cc'; g.fillRect(3, 3, 26, 26);
      g.fillStyle = 'rgba(90,110,130,0.6)'; g.fillRect(3, 18, 26, 11); // rooftops below
      g.fillStyle = '#3a2c22'; g.fillRect(15, 3, 2, 26); g.fillRect(3, 15, 26, 2);
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), texM(winT));
    win.position.set(AX(-3.18), 2 * ST + 1.5, AZI(3.75));
    win.rotation.y = Math.PI / 2;
    scene.add(win);
    const bedM = new THREE.MeshBasicMaterial({ color: 0xb8b4a8 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 2.0), bedM);
    bed.position.set(AX(-2.52), 2 * ST + 0.19, AZI(4.45));
    scene.add(bed);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.1, 1.25), new THREE.MeshBasicMaterial({ color: 0x5a3a3a }));
    blanket.position.set(AX(-2.52), 2 * ST + 0.42, AZI(4.8));
    scene.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.38), new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }));
    pillow.position.set(AX(-2.52), 2 * ST + 0.44, AZI(3.68));
    scene.add(pillow);
    const dresser = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.5), new THREE.MeshBasicMaterial({ color: 0x4a3626 }));
    dresser.position.set(AX(-1.17), 2 * ST + 0.375, AZI(2.27));
    scene.add(dresser);
    const tvT = pixTex(32, 24, (g) => {
      g.fillStyle = '#26262c'; g.fillRect(0, 0, 32, 24);
      g.fillStyle = '#101820'; g.fillRect(3, 3, 22, 18);
      g.fillStyle = 'rgba(160,200,220,0.25)'; g.fillRect(5, 5, 7, 6);
    });
    const tv = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.42), [new THREE.MeshBasicMaterial({ color: 0x26262c }), new THREE.MeshBasicMaterial({ color: 0x26262c }), new THREE.MeshBasicMaterial({ color: 0x26262c }), new THREE.MeshBasicMaterial({ color: 0x26262c }), texM(tvT), new THREE.MeshBasicMaterial({ color: 0x26262c })]);
    tv.position.set(AX(-1.17), 2 * ST + 0.95, AZI(2.27));
    scene.add(tv);
    sevColliders.push(
      { minX: AX(-3.35), maxX: AX(-3.2), minZ: AZI(2), maxZ: AZI(5.5) },
      { minX: AX(-3.2), maxX: AX(0), minZ: AZI(1.85), maxZ: AZI(2) },
      { minX: AX(-3.2), maxX: AX(0), minZ: AZI(5.5), maxZ: AZI(5.65) },
      { minX: AX(-3.1), maxX: AX(-1.94), minZ: AZI(3.45), maxZ: AZI(5.45) },
      { minX: AX(-1.5), maxX: AX(-0.84), minZ: AZI(2.0), maxZ: AZI(2.52) },
    );
    // street side: a plain walk-up entrance — recessed double door, transom
    // with the address number, buzzer panel, stone stoop. No nameplate.
    // East wall, across the street from the alley and a bit north of it.
    const DOOR_Z = -44;
    const recessS = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.75), new THREE.MeshBasicMaterial({ color: 0x14151a }));
    recessS.position.set(FACE - 0.02, sidewalkY + 1.375, DOOR_Z);
    recessS.rotation.y = -Math.PI / 2;
    scene.add(recessS);
    const doubleDoorT = pixTex(48, 64, (g) => {
      g.fillStyle = '#22301f'; g.fillRect(0, 0, 48, 64);
      for (const ox of [2, 25]) {
        g.fillStyle = '#3a4c34'; g.fillRect(ox, 2, 21, 62);
        g.fillStyle = '#16202a'; g.fillRect(ox + 3, 6, 15, 26);   // glass pane
        g.fillStyle = 'rgba(200,215,225,0.25)'; g.fillRect(ox + 4, 7, 5, 24);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(ox + 3, 38, 15, 20); // lower panel
      }
      g.fillStyle = '#c9b45e'; g.fillRect(21, 34, 2, 4); g.fillRect(25, 34, 2, 4); // handles
      dither(g, 48, 64, 40);
    });
    const streetDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.15), texM(doubleDoorT));
    streetDoor.position.set(FACE - 0.05, sidewalkY + 1.075, DOOR_Z);
    streetDoor.rotation.y = -Math.PI / 2;
    scene.add(streetDoor);
    const transomT = pixTex(48, 16, (g) => {
      g.fillStyle = '#161c24'; g.fillRect(0, 0, 48, 16);
      g.fillStyle = 'rgba(200,215,225,0.14)'; g.fillRect(2, 2, 44, 12);
      g.fillStyle = '#d9b95c'; g.font = 'bold 10px monospace'; g.textAlign = 'center';
      g.fillText('227', 24, 12);
    });
    const transom = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.45), texM(transomT));
    transom.position.set(FACE - 0.05, sidewalkY + 2.42, DOOR_Z);
    transom.rotation.y = -Math.PI / 2;
    scene.add(transom);
    const buzzerT = pixTex(12, 24, (g) => {
      g.fillStyle = '#8a8d95'; g.fillRect(0, 0, 12, 24);
      g.fillStyle = '#26282e';
      for (let y = 3; y < 21; y += 5) { g.fillRect(3, y, 2, 2); g.fillRect(7, y, 2, 2); }
    });
    const buzzer = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.36), texM(buzzerT));
    buzzer.position.set(FACE - 0.04, sidewalkY + 1.35, DOOR_Z + 0.95);
    buzzer.rotation.y = -Math.PI / 2;
    scene.add(buzzer);
    // brass plaque with the house name
    const plaqueT = pixTex(64, 16, (g) => {
      g.fillStyle = '#8a7a4e'; g.fillRect(0, 0, 64, 16);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, 64, 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 14, 64, 2);
      g.fillStyle = '#3a3222'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
      g.fillText('THE WHITMORE', 32, 11);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.21), texM(plaqueT));
    plaque.position.set(FACE - 0.04, sidewalkY + 1.95, DOOR_Z - 0.95);
    plaque.rotation.y = -Math.PI / 2;
    scene.add(plaque);
    const stoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 1.7), new THREE.MeshBasicMaterial({ color: 0x97928a }));
    stoop.position.set(FACE - 0.275, sidewalkY + 0.075, DOOR_Z);
    scene.add(stoop);
  }
  // multi-floor ground: pick the floor candidate nearest the last height —
  // that one closure is what makes stacked floors work with a 2D walker
  const aptGround = (wx: number, wz: number): number => {
    const lx = wx - APT_X, lz = wz - APT_Z;
    let rel = 0;
    if (lx >= 0 && lz > 8.4) {
      if (lz > 11.0) rel = 1.35;
      else {
        const t = (lz - 8.4) / 2.6;
        rel = lx < 1.2 ? t * 1.35 : 2.7 - t * 1.35;
      }
    }
    let best = lastGy, bd = Infinity;
    for (let f = 0; f < 4; f++) {
      const h = rel + f * ST;
      if (h > 3 * ST + 0.01) continue;  // nothing above floor 3
      if (h > lastGy + 0.6) continue;   // no stepping up half a storey
      const d = Math.abs(h - lastGy);
      if (d < bd) { bd = d; best = h; }
    }
    lastGy = best;
    return best;
  };

  // ── the clock, the sky it drags around, and the watch ───────────────────
  let totalMin = 13 * 60 + 20; // one real second = one game minute
  let watchShown = -1;
  let hermitForce = -1;
  // pockets: some cash and a box of cereal to start
  let cash = 14.5;
  const inv: Record<string, number> = { CEREAL: 3 };
  let walletOpen = false;
  let rmbHeld = false;
  let feedHeld = false;
  const hermitIn = (hAbs: number): boolean => {
    const h = hAbs % 24;
    const chance = h >= 12 && h < 18 ? 0.7 : h >= 8 && h < 22 ? 0.22 : 0.04;
    return ((((hAbs + 7) * 2654435761) >>> 0) % 1000) < chance * 1000;
  };
  const SKY_STOPS: [number, string][] = [
    [0, '#131722'], [5, '#131722'], [6.5, '#4a5464'], [8, '#7d8894'], [10, '#8a97a2'],
    [16.5, '#8a97a2'], [18.5, '#8f7f74'], [20, '#3a3f52'], [21.5, '#131722'], [24, '#131722'],
  ];
  const NIGHT_STOPS: [number, number][] = [
    [0, 0.34], [5, 0.34], [7, 0.1], [8.5, 0], [17.5, 0], [19, 0.12], [20, 0.24], [21.5, 0.34], [24, 0.34],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color(), skyNow = new THREE.Color();
  const skyAt = (h: number): THREE.Color => {
    let i = 0;
    while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1][0] < h) i++;
    const [h0, s0] = SKY_STOPS[i], [h1, s1] = SKY_STOPS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    return skyNow.copy(cA.set(s0)).lerp(cB.set(s1), t);
  };
  const nightAt = (h: number): number => {
    let i = 0;
    while (i < NIGHT_STOPS.length - 2 && NIGHT_STOPS[i + 1][0] < h) i++;
    const [h0, v0] = NIGHT_STOPS[i], [h1, v1] = NIGHT_STOPS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    return v0 + (v1 - v0) * t;
  };
  let nightDiv = document.getElementById('ct-night') as HTMLDivElement | null;
  if (!nightDiv) {
    nightDiv = document.createElement('div');
    nightDiv.id = 'ct-night';
    nightDiv.style.cssText = 'position:fixed;inset:0;background:#0a1024;opacity:0;pointer-events:none;z-index:5;transition:opacity .5s linear;';
    document.body.appendChild(nightDiv);
  }
  // the player's own clothing — one place to swap later (a real wardrobe).
  // `sleeve` is the forearm covering (a sweater here); a tee would just leave
  // the forearm as `skin`. The first-person hands (watch + wallet) read from it.
  const player = { skin: '#c9946a', skinHi: '#d8a67d', skinLo: '#a87a54', sleeve: '#3f4a5c', cuff: '#333c4a' };
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    watchWrap.style.cssText = 'position:fixed;left:52%;bottom:-14px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(140%) rotate(-6deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = 120; watchCv.height = 72;
    watchCv.style.cssText = 'width:330px;height:198px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = 120; watchCv.height = 72;
  }
  // the wrist-and-watch close-up (the good one — arm version was reverted)
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    g.clearRect(0, 0, 120, 72);
    g.fillStyle = '#c9946a'; g.fillRect(16, 6, 88, 66);          // wrist
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(16, 6, 10, 66);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(94, 6, 10, 66);
    g.fillStyle = '#26282e'; g.fillRect(38, 0, 44, 72);          // strap
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(38, 0, 4, 72);
    g.fillStyle = '#3a3d45'; g.fillRect(32, 14, 56, 42);         // case
    g.fillStyle = '#14161a'; g.fillRect(35, 17, 50, 36);
    g.fillStyle = '#9cab8b'; g.fillRect(38, 21, 44, 23);         // LCD
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m2 = String(mins % 60).padStart(2, '0');
    g.fillStyle = '#1c2a1c'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillText(`${hh}:${m2}`, 60, 38);
    g.fillStyle = '#8a8d95'; g.font = '5px monospace';
    g.fillText('CROSSTOWN QUARTZ', 60, 50);
  };
  const WALLET_W = 180, WALLET_H = 140;
  let walletWrap = document.getElementById('ct-wallet') as HTMLDivElement | null;
  let walletCv: HTMLCanvasElement;
  if (!walletWrap) {
    walletWrap = document.createElement('div');
    walletWrap.id = 'ct-wallet';
    walletWrap.style.cssText = 'position:fixed;left:50%;bottom:-8px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(150%) rotate(2deg);transition:transform .18s ease-out;';
    walletCv = document.createElement('canvas');
    walletCv.width = WALLET_W; walletCv.height = WALLET_H;
    walletCv.style.cssText = 'width:340px;height:264px;image-rendering:pixelated;display:block;';
    walletWrap.appendChild(walletCv);
    document.body.appendChild(walletWrap);
  } else {
    walletCv = walletWrap.firstChild as HTMLCanvasElement;
    walletCv.width = WALLET_W; walletCv.height = WALLET_H;
  }
  // first-person: an open bifold held in front of you in both hands — not a
  // corner menu. Thumbs grip the near edge; left leaf is your ID + pockets,
  // right leaf the cash. Slides up into view like the watch.
  const drawWallet = () => {
    const g = walletCv.getContext('2d')!;
    g.clearRect(0, 0, WALLET_W, WALLET_H);
    const { skin, skinHi, skinLo } = player;
    const wx = 20, wy = 16, ww = 140, wh = 104;
    g.fillStyle = '#2e2116'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);  // edge shadow
    g.fillStyle = '#4a3626'; g.fillRect(wx, wy, ww, wh);                  // leather
    g.fillStyle = '#5a4230'; g.fillRect(wx, wy, ww, 4);                   // top sheen
    g.fillStyle = '#2e2116'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);      // centre fold
    g.strokeStyle = 'rgba(222,210,180,0.22)'; g.setLineDash([3, 3]);
    g.strokeRect(wx + 4.5, wy + 4.5, ww - 9, wh - 9); g.setLineDash([]);
    // right leaf — bills + cash total
    const rx = wx + ww / 2 + 8;
    g.fillStyle = '#587a4a'; g.fillRect(rx + 2, wy + 8, 52, 8);
    g.fillStyle = '#6a8a5a'; g.fillRect(rx, wy + 12, 56, 34);
    g.fillStyle = '#7a9a68'; g.fillRect(rx, wy + 12, 56, 3);
    g.fillStyle = '#24301c'; g.font = 'bold 13px monospace'; g.textAlign = 'center';
    g.fillText(`$${cash.toFixed(2)}`, rx + 28, wy + 34);
    // left leaf — ID card over your pockets (item list)
    const lx = wx + 9;
    g.fillStyle = '#c9b48a'; g.fillRect(lx, wy + 8, 54, 20);
    g.fillStyle = '#8a7a58'; g.fillRect(lx + 2, wy + 10, 18, 16);
    g.fillStyle = '#6a5a3c'; g.fillRect(lx + 23, wy + 12, 28, 2); g.fillRect(lx + 23, wy + 16, 24, 2); g.fillRect(lx + 23, wy + 20, 20, 2);
    g.fillStyle = '#e8e2d0'; g.font = '7px monospace'; g.textAlign = 'left';
    let iy = wy + 42;
    for (const [k, n] of Object.entries(inv)) { if (n > 0) { g.fillText(`${k} x${n}`, lx, iy); iy += 10; } }
    if (iy === wy + 42) { g.fillStyle = '#9a927e'; g.fillText('(empty pockets)', lx, iy); }
    // thumbs gripping the near corners
    const thumb = (tx: number) => {
      g.fillStyle = skin; g.fillRect(tx, wy + wh - 22, 26, 34);
      g.fillStyle = skinHi; g.fillRect(tx, wy + wh - 22, 26, 3);
      g.fillStyle = skinLo; g.fillRect(tx, wy + wh + 8, 26, 4);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(tx + 7, wy + wh - 14, 12, 14); // nail
    };
    thumb(wx - 8); thumb(wx + ww - 18);
  };
  let promptDiv = document.getElementById('ct-prompt') as HTMLDivElement | null;
  if (!promptDiv) {
    promptDiv = document.createElement('div');
    promptDiv.id = 'ct-prompt';
    promptDiv.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:10;'
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.5);'
      + 'padding:5px 12px;border-radius:5px;pointer-events:none;display:none;letter-spacing:.4px;';
    document.body.appendChild(promptDiv);
  }

  // ── the bodega interior — one bright little room off the corner ─────────
  const bodegaColliders = buildBodega(scene);

  // ── weather: some hours it rains ────────────────────────────────────────
  const RAIN_N = 500;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 30;
    rainPos[i * 3 + 1] = Math.random() * 14;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
  const rainT = pixTex(8, 16, (g) => {
    g.fillStyle = 'rgba(214,222,232,0.8)'; g.fillRect(3, 1, 2, 13);
  });
  const rainM = new THREE.PointsMaterial({ map: rainT, size: 0.3, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.Points(rainGeo, rainM);
  rain.visible = false;
  scene.add(rain);
  let rainLevel = 0;
  const RAIN_SKY = new THREE.Color('#5a626e');
  const rainAt = (h: number) => ((Math.imul(h, 2246822519) >>> 0) % 100) < 22;

  // billboard sprites: trees, hydrant, pigeons
  function board(tex: THREE.Texture, w: number, h: number, x: number, z: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.set(x, 0, z);
    boards.push({ m });
    scene.add(m);
    return m;
  }
  const propColliders: AABB[] = [];
  // solid props the citizens must steer AROUND (never walk/phase through) —
  // trees, lamp poles, the hydrant, the payphone, and the cars
  const citAvoid: AABB[] = [];
  const obstacle = (b: AABB) => { propColliders.push(b); citAvoid.push(b); return b; };

  // street trees — the sprite cutouts are back (they belong here): fixed
  // crown texels, trunk-only variation, planted in dirt pits, and only the
  // trunk is solid so the sidewalk stays walkable. The bed hugs the KERB side
  // (a 1×2-slab strip) so the building half of the 2 m walk is a clear lane
  // you can always slip past on — no more full-width tree blocking the path.
  const TREE_PX = 0.05; // world units per texel
  const pitT = treePitTex();
  // a 0.8 m planting strip flush against the kerb (x 5.0–5.8). The player
  // RADIUS is 0.42 and the building wall's collider already reaches x≈6.28,
  // so the trunk collider must be tight and kerb-hugging to leave a real lane:
  // trunk to 5.48 + 0.42 = walkable from x≈5.9, wall from x≈6.28 → ~0.4 m clear.
  const pitGeo = new THREE.PlaneGeometry(0.8, 2.0);
  const pitMat = new THREE.MeshBasicMaterial({ map: pitT });
  let treeIdx = 0;
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * (ROAD_HALF + 0.4);               // kerb-side; pit road-edge sits on the kerb
    const pz2 = Math.round(z - 0.5) + 0.5;          // snapped to the 1 m slab grid
    const H = 80 + Math.floor(rnd() * 28);          // 4.0 – 5.4 m, trunk-only variation
    const tree = board(treeSprite(treeIdx % 2, H), 32 * TREE_PX, H * TREE_PX, tx, pz2);
    tree.position.y = sidewalkY;
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(tx, sidewalkY + 0.006, pz2);
    scene.add(pit);
    obstacle({ minX: tx - 0.08, maxX: tx + 0.08, minZ: pz2 - 0.12, maxZ: pz2 + 0.12 });
    treeIdx++;
  }

  // ── streetlamps: sodium-vapor heads on bishop-crook poles. Dark cast iron
  //    by day; at dusk the lens warms up and an amber halo pools over the wet
  //    asphalt. Opacity is driven off the same night curve as the sky. ──────
  const nightLit: { mat: THREE.MeshBasicMaterial; base: number }[] = [];
  const lampGlowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,198,120,0.90)');
    gr.addColorStop(0.5, 'rgba(255,178,96,0.30)');
    gr.addColorStop(1, 'rgba(255,178,96,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const lampPoolT = pixTex(48, 48, (g) => {
    const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,190,110,0.55)');
    gr.addColorStop(0.55, 'rgba(255,180,100,0.15)');
    gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  });
  const poleM = new THREE.MeshBasicMaterial({ color: 0x24291f });   // dark cast iron
  const poleHi = new THREE.MeshBasicMaterial({ color: 0x323826 });
  const lensM = new THREE.MeshBasicMaterial({ color: 0x3a3324 });   // shared: dark glass by day, warms at night
  const lensDay = new THREE.Color(0x3a3324), lensLit = new THREE.Color(0xffcc82);
  const LAMP_H = 5.0;
  const makeLamp = (s: number, z: number) => {
    const bx = s * (ROAD_HALF + 0.55);          // just inside the kerb
    const reach = 1.25;                         // crook arm reaches over the road
    const headX = bx - s * reach;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), poleHi);
    base.position.set(bx, sidewalkY + 0.25, z); scene.add(base);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, LAMP_H, 0.14), poleM);
    pole.position.set(bx, sidewalkY + LAMP_H / 2, z); scene.add(pole);
    // clean L crook: vertical pole + one horizontal arm (no diagonal strut) +
    // a lamp head that hangs DOWN off the arm's far end
    const arm = new THREE.Mesh(new THREE.BoxGeometry(reach, 0.12, 0.12), poleM);
    arm.position.set(bx - s * reach / 2, sidewalkY + LAMP_H - 0.05, z); scene.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.32), poleHi);
    head.position.set(headX, sidewalkY + LAMP_H - 0.16, z); scene.add(head);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.24), lensM);
    lens.position.set(headX, sidewalkY + LAMP_H - 0.31, z); scene.add(lens);
    obstacle({ minX: bx - 0.2, maxX: bx + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: lampGlowT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(headX, sidewalkY + LAMP_H - 0.22, z);
    boards.push({ m: halo }); scene.add(halo);
    nightLit.push({ mat: halo.material as THREE.MeshBasicMaterial, base: 1.0 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: lampPoolT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(headX, 0.02, z); scene.add(pool);
    nightLit.push({ mat: pool.material as THREE.MeshBasicMaterial, base: 0.85 });
  };
  // staggered down the block, kept clear of the tree pits (every 14 m at −2,−16…)
  [[-1, -9], [1, -23], [-1, -37], [1, -51], [-1, -65], [1, -79]].forEach(([s, z]) => makeLamp(s, z));
  // two more lighting the corner turn
  makeLamp(-1, -93);
  makeLamp(1, -93);

  // hydrant on the right sidewalk — hard against the kerb like the trees, with
  // a tight collider, so it doesn't block the building-side walking lane
  const hyX = ROAD_HALF + 0.35, hyZ = -6;
  const hyd = board(hydrantSprite(), 0.8, 1.2, hyX, hyZ);
  hyd.position.y = sidewalkY;
  obstacle({ minX: hyX - 0.18, maxX: hyX + 0.18, minZ: hyZ - 0.18, maxZ: hyZ + 0.18 });
  // pigeons peck along the kerb — most spook when you walk up; the odd bold
  // one holds its ground until you all but step on it
  interface Pigeon {
    m: THREE.Mesh; x: number; z: number; y: number;
    vx: number; vy: number; vz: number;
    state: 'peck' | 'fly'; bold: boolean; t: number; ph: number;
  }
  const pigeons: Pigeon[] = [];
  const pigeonT = pigeonSprite();
  for (let i = 0; i < 4; i++) {
    const x = -(ROAD_HALF + 0.5 + rnd() * 1.2), z = -20 - rnd() * 4;
    const b = board(pigeonT, 0.42, 0.42, x, z);
    pigeons.push({ m: b, x, z, y: 0, vx: 0, vy: 0, vz: 0, state: 'peck', bold: rnd() < 0.18, t: 0, ph: i * 2.4 });
  }
  // scattered cereal draws them in and holds them there
  const crumbT = pixTex(32, 32, (g) => {
    g.fillStyle = '#d9c9a0';
    for (let i = 0; i < 42; i++) g.fillRect(Math.floor(Math.random() * 30), Math.floor(Math.random() * 30), 2, 2);
  });
  const crumbMat = new THREE.MeshBasicMaterial({ map: crumbT, alphaTest: 0.5, side: THREE.DoubleSide });
  let crumbs: { x: number; z: number; y: number; t: number; m: THREE.Mesh } | null = null;

  // payphone against the left wall
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.9), flat(payphoneTex()));
  phone.position.set(-(FACE - 0.55), sidewalkY + 1.15, -11);
  scene.add(phone);
  obstacle({ minX: -(FACE - 0.05), maxX: -(FACE - 1.05), minZ: -11.55, maxZ: -10.45 });

  // parked cars — a mixed fleet in the parking lanes
  const parked: [CarKind, number, number, number, number][] = [
    ['sedan', 1, PARK_X, -15, 0.02],
    ['pickup', 3, -PARK_X, -34, Math.PI - 0.03],
    ['hatch', 5, PARK_X, -58, -0.02],
    ['van', 2, -PARK_X, -76, Math.PI + 0.02],
  ];
  const carColliders: AABB[] = [];
  const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
  parked.forEach(([kind, ci, x, z, ry]) => {
    const car = makeCar(kind, ci);
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    scene.add(car);
    const cb = { minX: x - 1.05, maxX: x + 1.05, minZ: z - carHalf[kind], maxZ: z + carHalf[kind] };
    carColliders.push(cb); citAvoid.push(cb);
  });
  // traffic: one car on the block at a time, entering from a foggy end,
  // driving through, and leaving. Usually a plain car — the taxi is a rare
  // sight, maybe one pass in seven.
  const traffic = [
    makeCar('sedan', 2), makeCar('hatch', 4), makeCar('van', 5), makeCar('sedan', 3),
    makeCar('sedan', 0, true), // the taxi, last in the pool
  ];
  traffic.forEach((c) => { c.visible = false; scene.add(c); });
  let cruiser = traffic[0];
  let cruiseDir = -1;
  let cruiseWait = 5; // gap between cars
  const cruiserBox: AABB = { minX: 999, maxX: 999, minZ: 999, maxZ: 999 };
  citAvoid.push(cruiserBox); // the moving car, too — its box follows it each frame

  // 8-angle citizens walking the block — no two the same size or style
  interface Outfit { j: string; p: string; s: string; h: string; fit: Fit; acc: string; hs: number; ws: number }
  const OUTFITS: Outfit[] = [
    { j: '#3a4a63', p: '#2b2f36', s: '#c9946a', h: '#241a10', fit: 'plain', acc: '', hs: 1.0, ws: 1.0 },
    { j: '#7a3a34', p: '#3f4650', s: '#b8845a', h: '#101010', fit: 'cap', acc: '#8a3a2e', hs: 1.08, ws: 1.04 },
    { j: '#3f5a46', p: '#3f5a46', s: '#d9a97c', h: '#8c5a2e', fit: 'dress', acc: '', hs: 0.94, ws: 0.96 },
    { j: '#5c5266', p: '#2b2f36', s: '#c9946a', h: '#3a2c20', fit: 'hoodie', acc: '', hs: 1.12, ws: 1.08 },
    { j: '#6a5a3a', p: '#23262c', s: '#b8845a', h: '#d9c25a', fit: 'plain', acc: '', hs: 0.9, ws: 0.94 },
    { j: '#37505e', p: '#2b2f36', s: '#d9a97c', h: '#1c1410', fit: 'cap', acc: '#2c4a7a', hs: 1.02, ws: 1.0 },
    { j: '#6e3a5a', p: '#6e3a5a', s: '#e0b088', h: '#4a2c18', fit: 'dress', acc: '', hs: 1.05, ws: 0.98 },
    { j: '#2f4a4a', p: '#3f4650', s: '#b8845a', h: '#5a3a24', fit: 'hoodie', acc: '', hs: 0.96, ws: 1.06 },
  ];
  interface Citizen { mesh: THREE.Mesh; tex: THREE.Texture; lane: number; home: number; z: number; dir: number; sp: number; ph: number; box: AABB; stuck: number; ghost: boolean; anim: number }
  const citizens: Citizen[] = [];
  // a quiet block: four out on the street at a time, one of each fit
  const CAST = [OUTFITS[0], OUTFITS[1], OUTFITS[2], OUTFITS[3]];
  CAST.forEach((o, i) => {
    const tex = citizenAtlas(o.j, o.p, o.s, o.h, o.fit, o.acc);
    tex.repeat.set(1 / 5, 1 / 2);
    const geo = new THREE.PlaneGeometry(0.95, 1.9);
    geo.translate(0, 0.95, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.scale.set(o.ws, o.hs, 1);
    // home lanes sit in the clear strip between the kerb props and the wall
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 1.05 + (i % 3) * 0.17);
    const z = 2 - i * 23; // spread thin over the whole block
    mesh.position.set(lane, sidewalkY, z);
    scene.add(mesh);
    const box: AABB = { minX: lane - 0.3, maxX: lane + 0.3, minZ: z - 0.3, maxZ: z + 0.3 };
    propColliders.push(box); // people are solid — the box follows them
    citizens.push({ mesh, tex, lane, home: lane, z, dir: i % 2 ? 1 : -1, sp: 0.85 + (i % 4) * 0.3, ph: i * 1.3, box, stuck: 0, ghost: false, anim: i * 1.3 });
  });

  const colliders: AABB[] = [
    { minX: FACE - 0.3, maxX: FACE + 8, minZ: -96, maxZ: 20 },              // right wall (stops at the corner)
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: -112, maxZ: AZ1 },          // left wall south of alley, wraps the corner
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: AZ0, maxZ: 20 },            // left wall north of alley
    { minX: 6.8, maxX: SIDE_X1 + 2, minZ: -96.3, maxZ: -92 },               // corner shops, north of the side street
    { minX: -7, maxX: SIDE_X1 + 2, minZ: -113, maxZ: -109.7 },              // south side of the side street
    { minX: SIDE_X1 + 1.7, maxX: SIDE_X1 + 9, minZ: -112, maxZ: -92 },      // east end of the side street
    { minX: 7.5, maxX: 9.7, minZ: -96.9, maxZ: -96.2 },                     // bodega fruit crates
    { minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 }, // alley end wall
    { minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 },        // dumpster
    ...propColliders,
    ...carColliders,
    ...sevColliders,
    ...bodegaColliders,
    cruiserBox,
  ];
  const rig = new FPRig(cam, { x: -1.4, z: 9, yaw: 0 }, {
    bounds: { minX: -FACE - 6.4, maxX: 260, minZ: -110.6, maxZ: 13 },
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    groundY: (x, z) => {
      if (x > 230) { lastGy = 0; return 0; }  // bodega interior, flat
      if (x > 100) return aptGround(x, z);
      if (z < SIDE_Z0 + 2) { // the corner and the side street
        if (z > SIDE_Z0) lastGy = Math.abs(x) > ROAD_HALF ? KERB_H : 0;
        else if (z < SIDE_Z1) lastGy = KERB_H;
        else lastGy = x > SIDE_X1 || x < -ROAD_HALF ? KERB_H : 0;
        return lastGy;
      }
      lastGy = Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0;
      return lastGy;
    },
  });

  // debug/tour hook
  // E is one key for the whole world: doors, buying, feeding the birds
  interface Spot { x: number; z: number; r: number; label: () => string; ok: () => boolean; act: () => void }
  const jumpTo = (x: number, z: number, yaw: number, gy: number) => {
    rig.pos.set(x, rig.pos.y, z);
    rig.yaw = yaw;
    lastGy = gy;
  };
  const SPOTS: Spot[] = [
    {
      x: FACE - 0.45, z: -44, r: 1.05,
      ok: () => rig.pos.x < 100 && lastGy < 1,
      label: () => 'enter THE WHITMORE',
      act: () => jumpTo(AX(1.2), AZI(1.3), Math.PI, 0),
    },
    {
      x: AX(1.2), z: AZI(0.4), r: 0.95,
      ok: () => rig.pos.x > 100 && rig.pos.x < 230 && lastGy < 0.5,
      label: () => 'out to the street',
      act: () => jumpTo(FACE - 1.1, -44, -Math.PI / 2, KERB_H),
    },
    {
      x: 8.7, z: -96.85, r: 1.1,
      ok: () => rig.pos.x < 100,
      label: () => 'into the BODEGA',
      act: () => jumpTo(241.3, -17, Math.PI / 2, 0),
    },
    {
      x: 240.5, z: -17, r: 1.0,
      ok: () => rig.pos.x > 230,
      label: () => 'out to the street',
      // step out onto the north side-street walk, facing OUT across the street —
      // clear of the corner wall + fruit crates, and well outside the re-enter
      // trigger radius so you can't get sucked straight back in (the old bug)
      act: () => jumpTo(11, -97.3, 0, KERB_H),
    },
    {
      x: 242.2, z: -17.5, r: 1.0,
      ok: () => rig.pos.x > 230,
      label: () => cash >= 2.5 ? 'buy cereal — $2.50' : 'cereal $2.50 — you’re short',
      act: () => { if (cash >= 2.5) { cash -= 2.5; inv.CEREAL = (inv.CEREAL ?? 0) + 1; if (walletOpen) drawWallet(); } },
    },
    {
      x: 246.9, z: -14.6, r: 1.0,
      ok: () => rig.pos.x > 230,
      label: () => cash >= 1.25 ? 'buy soda — $1.25' : 'soda $1.25 — you’re short',
      act: () => { if (cash >= 1.25) { cash -= 1.25; inv.SODA = (inv.SODA ?? 0) + 1; if (walletOpen) drawWallet(); } },
    },
  ];

  (window as any).__ct = {
    warp: (x: number, z: number, yaw?: number, gy?: number, pitch?: number) => {
      rig.pos.set(x, rig.pos.y, z);
      if (yaw !== undefined) rig.yaw = yaw;
      if (gy !== undefined) lastGy = gy;
      if (pitch !== undefined) rig.pitch = pitch;
    },
    clock: (h: number, m = 0) => { totalMin = h * 60 + m; },
    hermit: (v: boolean | null) => { hermitForce = v === null ? -1 : v ? 1 : 0; },
    atlases: () => citizens.map((c) => (c.tex.image as HTMLCanvasElement).toDataURL()),
    pos: () => [rig.pos.x, rig.pos.y, rig.pos.z, lastGy],
    scene: () => scene,   // test affordance: structural fingerprinting (scripts/scenedump.mjs)
  };

  return {
    key: 'crosstown', name: 'CROSSTOWN ’97',
    feel: 'The small world — one hand-made street. We grow it from here.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.NoToneMapping;
      r.shadowMap.enabled = false;
    },
    update(dt, t, input) {
      rig.update(dt, input);
      const px = rig.pos.x, pz = rig.pos.z;

      // the clock: one real second is one game minute
      totalMin += dt;
      const clockMin = totalMin % 1440;
      const hourF = clockMin / 60;
      const skyCol = skyAt(hourF);
      if (rainLevel > 0.01) skyCol.lerp(RAIN_SKY, rainLevel * 0.5); // rain flattens the light
      (scene.background as THREE.Color).copy(skyCol);
      scene.fog!.color.copy(skyNow);
      nightDiv!.style.opacity = String(nightAt(hourF));
      // streetlamps warm up on the same night curve (0 by day, full at deep night)
      const lampNight = THREE.MathUtils.clamp((nightAt(hourF) - 0.03) / 0.28, 0, 1);
      for (const g of nightLit) g.mat.opacity = g.base * lampNight;
      lensM.color.copy(lensDay).lerp(lensLit, lampNight);
      // the hermit keeps his own hours — mostly afternoons
      hermit.visible = hermitForce === -1 ? hermitIn(Math.floor(totalMin / 60)) : hermitForce === 1;
      // look down: your watch
      const wantWatch = rig.pitch < -0.95;
      watchWrap!.style.transform = wantWatch
        ? 'translateX(-50%) translateY(0) rotate(-5deg)'
        : 'translateX(-50%) translateY(140%) rotate(-5deg)';
      const mins = Math.floor(clockMin);
      if (wantWatch && mins !== watchShown) { drawWatch(mins); watchShown = mins; }
      // right-click: flip the wallet out / away
      const rmb = input.keys.has('rmb');
      if (rmb && !rmbHeld) {
        walletOpen = !walletOpen;
        if (walletOpen) drawWallet();
        walletWrap!.style.transform = walletOpen ? 'translateX(-50%) translateY(0) rotate(2deg)' : 'translateX(-50%) translateY(150%) rotate(2deg)';
      }
      rmbHeld = rmb;
      // E: nearest live spot wins; with nothing near, E feeds the birds
      let active: Spot | null = null;
      for (const s of SPOTS) {
        if (s.ok() && Math.hypot(px - s.x, pz - s.z) < s.r) { active = s; break; }
      }
      if (active) {
        promptDiv!.textContent = `[E] ${active.label()}`;
        promptDiv!.style.display = 'block';
      } else {
        promptDiv!.style.display = 'none';
      }
      // E dispatch (edge-triggered)
      const feedDown = input.keys.has('e');
      if (feedDown && !feedHeld) {
        if (active) {
          active.act();
        } else if ((inv.CEREAL ?? 0) > 0 && px < 100) {
          inv.CEREAL--;
          const cx2 = px + Math.sin(rig.yaw) * 1.3, cz2 = pz - Math.cos(rig.yaw) * 1.3;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), crumbMat);
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = rnd() * Math.PI;
          m.position.set(cx2, lastGy + 0.012, cz2);
          scene.add(m);
          if (crumbs) scene.remove(crumbs.m);
          crumbs = { x: cx2, z: cz2, y: lastGy, t: 35, m };
          if (walletOpen) drawWallet();
        }
      }
      feedHeld = feedDown;
      // weather: the rain comes and goes by the hour
      const wantRain = rainAt(Math.floor(totalMin / 60)) && px < 100 ? 1 : 0;
      rainLevel += (wantRain - rainLevel) * Math.min(1, dt * 0.6);
      if (px > 100) rainLevel = 0; // it NEVER rains indoors — cut, don't fade
      // the ground darkens + cools as it wets down (roads and walks)
      for (const w of wetMats) w.m.color.copy(w.base).lerp(WET, rainLevel * 0.8);
      rain.visible = rainLevel > 0.02;
      if (rain.visible) {
        rainM.opacity = 0.55 * rainLevel;
        rain.position.set(px, 0, pz);
        const rp = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < RAIN_N; i++) {
          let ry = rp.getY(i) - dt * 13;
          if (ry < 0) ry += 14;
          rp.setY(i, ry);
        }
        rp.needsUpdate = true;
      }

      // floor-aware stair guards (2D colliders, so they follow the floor)
      setCap(stairCap, lastGy > 3 * ST - 0.12, AX(0), AX(1.2), AZI(8.4), AZI(13.2));
      const onLobby = px > 100 && lastGy < 0.6;
      setCap(underStairA, onLobby, AX(1.2), AX(2.4), AZI(8.4), AZI(13.2));
      setCap(underStairB, onLobby, AX(0), AX(1.2), AZI(11.0), AZI(13.2));
      setCap(aptDoorCap, Math.abs(lastGy - 2 * ST) > 0.4, AX(-0.15), AX(0.05), AZI(3.1), AZI(3.9));


      // billboards face the player
      for (const b of boards) {
        b.m.rotation.y = Math.atan2(px - b.m.position.x, pz - b.m.position.z);
      }
      // citizens: ping-pong the block, show the correct painted angle. They are
      // SOLID and politely halt a step short of you — but if held up against you
      // for a beat (stuck timer), they give up and squeeze through, going
      // non-solid only until they're clear, then solid again. So they never
      // wall you in for good, and never become permanently uncollidable.
      // is a citizen's footprint clear of every solid PROP (trees, cars, …)?
      // (the player isn't in this set — people phase the player, never props)
      const clearAt = (x: number, z: number) =>
        !citAvoid.some((a) => x + 0.28 > a.minX && x - 0.28 < a.maxX && z + 0.28 > a.minZ && z - 0.28 < a.maxZ);
      for (const c of citizens) {
        const dist = Math.hypot(px - c.lane, pz - c.z);
        if (dist < 1.05) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
        if (!c.ghost && c.stuck > 1.4) c.ghost = true;       // fed up → push past YOU
        if (c.ghost && dist > 1.4) { c.ghost = false; c.stuck = 0; } // clear → solid again
        const holding = dist < 1.0 && !c.ghost;              // standing a step short of you
        let moving = !holding;
        if (moving) {
          const s = Math.sign(c.home);
          const nz = c.z + c.dir * c.sp * dt;
          if (clearAt(c.lane, nz)) {
            c.z = nz;
            c.lane += (c.home - c.lane) * Math.min(1, dt * 2); // ease back to home lane
          } else {
            // a solid prop is ahead — step laterally to go AROUND it (never through)
            let target: number | null = null;
            for (const off of [0.45, 0.8, -0.45, 1.15]) {
              const x = c.home + off * s;
              if (Math.abs(x) >= ROAD_HALF + 0.55 && Math.abs(x) <= FACE - 0.35 && clearAt(x, nz)) { target = x; break; }
            }
            if (target !== null) {
              c.lane += (target - c.lane) * Math.min(1, dt * 5);
              if (clearAt(c.lane, c.z + c.dir * c.sp * dt * 0.5)) c.z += c.dir * c.sp * dt * 0.5;
            } else { c.dir *= -1; moving = false; }  // boxed in — turn back
          }
        }
        if (c.z < -L + 4) { c.z = -L + 4; c.dir = 1; }
        if (c.z > 10) { c.z = 10; c.dir = -1; }
        if (c.ghost) {
          c.box.minX = c.box.maxX = 1e5; c.box.minZ = c.box.maxZ = 1e5; // slip past you
        } else {
          c.box.minX = c.lane - 0.3; c.box.maxX = c.lane + 0.3;
          c.box.minZ = c.z - 0.3; c.box.maxZ = c.z + 0.3;
        }
        c.mesh.position.set(c.lane, sidewalkY, c.z);
        c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
        const facing = Math.atan2(0, c.dir); // 0 for +z, π for -z... atan2(0,-1)=π ✓
        const camAng = Math.atan2(px - c.lane, pz - c.z);
        const [col, mirror] = viewFor(camAng - facing);
        // feet only stride while actually walking; stand still (feet together)
        // when halted, so a stopped person isn't marching in place
        if (moving) c.anim += dt * 5 * c.sp;
        const row = moving ? Math.floor(c.anim) % 2 : 0;
        c.tex.repeat.x = mirror ? -1 / 5 : 1 / 5;
        c.tex.offset.x = mirror ? (col + 1) / 5 : col / 5;
        c.tex.offset.y = row === 0 ? 0.5 : 0;
      }
      // traffic: one car at a time drives through, entering from whichever
      // end the player can't see into
      if (cruiseWait > 0) {
        cruiseWait -= dt;
        if (cruiseWait <= 0) {
          cruiser = traffic[rnd() < 0.15 ? traffic.length - 1 : Math.floor(rnd() * (traffic.length - 1))];
          cruiseDir = pz < -L / 2 ? -1 : 1; // enter from the end farther from the player
          cruiser.position.set(cruiseDir === -1 ? DRIVE_X : -DRIVE_X, 0, cruiseDir === -1 ? 8 : -L + 6);
          cruiser.rotation.y = cruiseDir === -1 ? 0 : Math.PI;
          cruiser.visible = true;
        }
      } else {
        cruiser.position.z += cruiseDir * 8.5 * dt;
        const endZ = cruiseDir === -1 ? -L + 6 : 8;
        if (cruiseDir === -1 ? cruiser.position.z < endZ : cruiser.position.z > endZ) {
          if (Math.abs(pz - endZ) > 25) {
            cruiser.visible = false; // slips around the corner in the fog
            cruiseWait = 18 + rnd() * 24;
          } else {
            // the player is watching this corner — turn around, don't vanish
            cruiseDir = -cruiseDir;
            cruiser.position.x = cruiseDir === -1 ? DRIVE_X : -DRIVE_X;
            cruiser.rotation.y = cruiseDir === -1 ? 0 : Math.PI;
          }
        }
      }
      // its collider follows (parked far away while no car is out)
      if (cruiser.visible) {
        cruiserBox.minX = cruiser.position.x - 1.05;
        cruiserBox.maxX = cruiser.position.x + 1.05;
        cruiserBox.minZ = cruiser.position.z - 2.5;
        cruiserBox.maxZ = cruiser.position.z + 2.5;
      } else {
        cruiserBox.minX = cruiserBox.maxX = cruiserBox.minZ = cruiserBox.maxZ = 999;
      }
      // pigeons: peck, chase scattered cereal, spook when approached
      if (crumbs) {
        crumbs.t -= dt;
        if (crumbs.t <= 0) { scene.remove(crumbs.m); crumbs = null; }
      }
      for (const pg of pigeons) {
        if (pg.state === 'peck') {
          const cd = crumbs ? Math.hypot(crumbs.x - pg.x, crumbs.z - pg.z) : Infinity;
          if (crumbs && cd > 1.1 && cd < 9) { // cereal pulls them in
            const a = Math.atan2(crumbs.x - pg.x, crumbs.z - pg.z);
            pg.x += Math.sin(a) * 1.5 * dt; pg.z += Math.cos(a) * 1.5 * dt;
          }
          const d = Math.hypot(px - pg.x, pz - pg.z);
          const spookAt = cd < 1.4 ? 0.5 : pg.bold ? 0.7 : 3.5; // feeding birds let you get close
          if (d < spookAt) {
            pg.state = 'fly'; pg.t = 0;
            const a = Math.atan2(pg.x - px, pg.z - pz) + (rnd() - 0.5) * 0.8;
            pg.vx = Math.sin(a) * 3.2; pg.vz = Math.cos(a) * 3.2; pg.vy = 2.6;
          }
          const pgy = Math.abs(pg.x) > ROAD_HALF && Math.abs(pg.x) < FACE + 0.3 ? KERB_H : 0;
          pg.m.position.set(pg.x, pgy + Math.max(0, Math.sin(t * 6 + pg.ph)) * 0.06, pg.z);
        } else {
          pg.t += dt;
          pg.x += pg.vx * dt; pg.z += pg.vz * dt;
          pg.vy = Math.min(pg.vy + dt * 1.5, 3.4);
          pg.y += pg.vy * dt;
          if (Math.abs(pg.x) > FACE - 0.6) { pg.x = Math.sign(pg.x) * (FACE - 0.6); pg.vx = 0; } // climb the wall, don't pass it
          pg.m.position.set(pg.x, sidewalkY + pg.y + Math.sin(t * 24) * 0.05, pg.z);
          if (pg.t > 4) {
            // settle somewhere new down the block, away from the player
            pg.state = 'peck'; pg.y = 0; pg.bold = rnd() < 0.18;
            pg.x = (rnd() < 0.5 ? -1 : 1) * (ROAD_HALF + 0.4 + rnd() * 1.4);
            pg.z = -8 - rnd() * (L - 20);
            if (Math.hypot(px - pg.x, pz - pg.z) < 8) {
              pg.z = Math.max(-L + 6, Math.min(2, pz > -L / 2 ? pz - 25 : pz + 25));
            }
          }
        }
      }
    },
  };
}

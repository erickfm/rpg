import * as THREE from 'three';
import type { AABB } from '../fp';
import { pixTex, dither } from './paint';
import { ENTRANCE } from './tex-world';
import { FACE } from './rng';
import type { CtxBuild } from './ctx';

// ── No. 227 — the player's walk-up ────────────────────────────────────────
// Four stories, a switchback stair, your place (301) on the third floor,
// and the hermit across the hall at 302. The interior is parked far east
// of the street, past the fog, in the same scene; the doors teleport.
//
// This module owns `lastGy` — the player's current floor height. It is not a
// plain value but a floor PICKER with hysteresis: with four floors stacked
// over one 2D walker, "which storey am I on" can only be answered by the
// height you were at last frame. Everything outside that needs to move the
// player between floors (the warp hook, the street's own groundY, the door
// jumps) goes through setGy so there is exactly one writer of record.

export interface Apartment {
  /** local → world helpers; the door spots outside are placed with these */
  AX: (lx: number) => number;
  AZI: (lz: number) => number;
  /** storey height */
  ST: number;
  /** hall/stair/room walls, plus the floor-aware caps updated by updateCaps */
  colliders: AABB[];
  /** the floor picker: world x/z → ground height, with hysteresis */
  ground: (wx: number, wz: number) => number;
  /** current floor height */
  gy: () => number;
  /** set it and hand it back, so callers can `return setGy(…)` */
  setGy: (v: number) => number;
  /** per-frame: stair guards that follow the floor you're standing on */
  updateCaps: (px: number) => void;
  /** per-frame: he keeps his own hours — mostly afternoons */
  updateHermit: (hAbs: number) => void;
  /** debug hook: force him in (true) / out (false) / back on schedule (null) */
  forceHermit: (v: boolean | null) => void;
}

export function buildApartment(ctx: CtxBuild): Apartment {
  const { scene, boards, sidewalkY } = ctx;
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
    // ── street side: the walk-up's front door ────────────────────────────
    // The building carries NO name. It never gets a nameplate: the gold 227
    // on the transom is the only identification it has, the way plenty of
    // real walk-ups are. (It briefly wore a brass plaque — THE WHITMORE,
    // then THE SYCAMORE — and both are gone. Don't put one back.)
    //
    // This is a composition, not a pile of props. tex-world's ENTRANCE owns
    // the numbers: it reserves a 4 m span in the middle of the residential
    // ground floor that no window may enter, paints a narrow limestone
    // doorcase and the dark doorway into it, and lays the window rhythm out
    // symmetrically either side. Everything below is measured off those same
    // constants, so nothing can drift back on top of anything else.
    //
    // Layout, either side of the door centreline:
    //   0.000 … 0.875   the doorway opening (painted dark by resGroundTex)
    //   0.875 … 1.250   the limestone doorcase jamb
    //   1.250 …         brick; the buzzer panel is centred at 1.55
    //   2.000           edge of the reserved span; the first window starts a
    //                   further 1.375 m out, so 1.7 m of clear brick past the
    //                   buzzer's outer end
    //
    // Depth: ONE plane for all the door furniture, 2 cm proud of the brick.
    // Everything used to sit at its own depth (0.02/0.04/0.05), which is why
    // the old plaque vanished behind the door leaf and the buzzer detached
    // from the wall at grazing angles.
    const DOOR_Z = -44;              // = the residential building's centre z
    const FRONT = FACE - 0.02;       // the entrance's single depth plane
    const { OPEN_W, OPEN_BOT, OPEN_TOP, FURN_C } = ENTRANCE;
    const REVEAL = 0.125;            // dark margin of opening around the door
    const LEAF_W = OPEN_W - REVEAL * 2;         // 1.50
    const DOOR_TOP = 2.30, BAR = 0.08, TRANSOM_H = 0.45;
    const hang = (m: THREE.Mesh, y: number, z: number) => {
      m.position.set(FRONT, y, z);
      m.rotation.y = -Math.PI / 2;
      scene.add(m);
    };
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
    // the leaf runs from the threshold to DOOR_TOP; its bottom centimetre is
    // buried in the stoop so the two can never part and show a hairline
    const streetDoor = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_W, DOOR_TOP - OPEN_BOT), texM(doubleDoorT));
    hang(streetDoor, (OPEN_BOT + DOOR_TOP) / 2, DOOR_Z);
    const transomT = pixTex(48, 14, (g) => {
      g.fillStyle = '#161c24'; g.fillRect(0, 0, 48, 14);
      g.fillStyle = 'rgba(200,215,225,0.14)'; g.fillRect(2, 2, 44, 10);
      g.fillStyle = '#d9b95c'; g.font = 'bold 9px monospace'; g.textAlign = 'center';
      g.fillText('227', 24, 11);
    });
    const transom = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_W, TRANSOM_H), texM(transomT));
    hang(transom, DOOR_TOP + BAR + TRANSOM_H / 2, DOOR_Z);
    // the buzzer panel — the only thing on the brick beside the doorcase now
    // that the nameplate is gone: 0.30 m clear of the stone, 1.7 m clear of
    // the nearest window. Nothing hangs on the other side; a walk-up with a
    // buzzer on one jamb and bare brick on the other is the ordinary case.
    const FURNITURE_Y = 1.72;
    const buzzerT = pixTex(16, 32, (g) => {
      g.fillStyle = '#8a8d95'; g.fillRect(0, 0, 16, 32);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 0, 16, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 31, 16, 1);
      g.fillStyle = '#6e727a'; g.fillRect(2, 3, 12, 26);
      g.fillStyle = '#26282e';
      for (let y = 5; y < 27; y += 6) { g.fillRect(4, y, 3, 3); g.fillRect(9, y, 3, 3); }
      dither(g, 16, 32, 18);
    });
    const buzzer = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.48), texM(buzzerT));
    hang(buzzer, FURNITURE_Y, DOOR_Z + FURN_C);
    // the stoop: one worn step, wider than the opening so it reads as built
    // out of the wall. Its top IS the threshold — the door stands on it —
    // and its base sinks 2 cm into the walk so no seam can open up there.
    const STOOP_TOP = OPEN_BOT + 0.01, STOOP_BASE = sidewalkY - 0.02;
    const STOOP_D = 0.55, STOOP_W = OPEN_W + 0.2;
    const stoopTreadT = pixTex(18, 62, (g) => {
      g.fillStyle = '#948f87'; g.fillRect(0, 0, 18, 62);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, 2, 62);   // nosing catches the sky
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(14, 0, 4, 62);        // shadow at the threshold
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(5, 12, 9, 38);        // worn centre, walked hollow
      dither(g, 18, 62, 150);
    });
    const stoopRiserT = pixTex(62, 6, (g) => {
      g.fillStyle = '#8b867e'; g.fillRect(0, 0, 62, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 62, 1);   // top arris
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 5, 62, 1);         // grime at the walk
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(12, 2, 3, 3); g.fillRect(44, 3, 4, 2); // chips
      dither(g, 62, 6, 30);
    });
    const stoopEndT = pixTex(18, 6, (g) => {
      g.fillStyle = '#8b867e'; g.fillRect(0, 0, 18, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 18, 1);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 5, 18, 1);
      dither(g, 18, 6, 12);
    });
    // solid box, so front faces only — texM's DoubleSide is for the planes
    const flatOf = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t });
    const stoopBuriedM = new THREE.MeshBasicMaterial({ color: 0x8b867e });
    const stoopEndM = flatOf(stoopEndT);
    const stoop = new THREE.Mesh(
      new THREE.BoxGeometry(STOOP_D, STOOP_TOP - STOOP_BASE, STOOP_W),
      // [+x buried, -x riser, +y tread, -y buried, +z end, -z end]
      [stoopBuriedM, flatOf(stoopRiserT), flatOf(stoopTreadT), stoopBuriedM, stoopEndM, stoopEndM],
    );
    // 0.40 m of it stands proud of the wall, the rest is buried in the brick
    stoop.position.set(FACE + 0.15 - STOOP_D / 2, (STOOP_TOP + STOOP_BASE) / 2, DOOR_Z);
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

  // he keeps his own hours — mostly afternoons, rarely at night
  let hermitForce = -1;
  const hermitIn = (hAbs: number): boolean => {
    const h = hAbs % 24;
    const chance = h >= 12 && h < 18 ? 0.7 : h >= 8 && h < 22 ? 0.22 : 0.04;
    return ((((hAbs + 7) * 2654435761) >>> 0) % 1000) < chance * 1000;
  };

  // floor-aware stair guards (2D colliders, so they follow the floor)
  const updateCaps = (px: number) => {
    setCap(stairCap, lastGy > 3 * ST - 0.12, AX(0), AX(1.2), AZI(8.4), AZI(13.2));
    const onLobby = px > 100 && lastGy < 0.6;
    setCap(underStairA, onLobby, AX(1.2), AX(2.4), AZI(8.4), AZI(13.2));
    setCap(underStairB, onLobby, AX(0), AX(1.2), AZI(11.0), AZI(13.2));
    setCap(aptDoorCap, Math.abs(lastGy - 2 * ST) > 0.4, AX(-0.15), AX(0.05), AZI(3.1), AZI(3.9));
  };

  return {
    AX, AZI, ST,
    colliders: sevColliders,
    ground: aptGround,
    gy: () => lastGy,
    setGy: (v) => (lastGy = v),
    updateCaps,
    updateHermit: (hAbs) => { hermit.visible = hermitForce === -1 ? hermitIn(hAbs) : hermitForce === 1; },
    forceHermit: (v) => { hermitForce = v === null ? -1 : v ? 1 : 0; },
  };
}

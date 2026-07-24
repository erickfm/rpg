import * as THREE from 'three';
import type { AABB } from '../fp';
import { pixTex, dither } from './paint';
import { ENTRANCE } from './tex-world';
import { citizenAtlas, viewFor } from './citizens';
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

// A 4×5 texel numeral, stamped rather than typed. Canvas text antialiases —
// at the sizes this world paints at, 'bold 8px monospace' lands half a texel
// off the grid and comes out as grey mush, which NearestFilter then magnifies
// into smear. Anything meant to be READ at this texel density has to be drawn
// as texels. Bit 3 is the leftmost column of each row.
const DIGIT: Record<string, number[]> = {
  '0': [0b1111, 0b1001, 0b1001, 0b1001, 0b1111],
  '1': [0b0010, 0b0110, 0b0010, 0b0010, 0b0111],
  '2': [0b1111, 0b0001, 0b1111, 0b1000, 0b1111],
  '3': [0b1111, 0b0001, 0b0111, 0b0001, 0b1111],
  '4': [0b1001, 0b1001, 0b1111, 0b0001, 0b0001],
  '5': [0b1111, 0b1000, 0b1111, 0b0001, 0b1111],
  '6': [0b1111, 0b1000, 0b1111, 0b1001, 0b1111],
  '7': [0b1111, 0b0001, 0b0010, 0b0010, 0b0010],
  '8': [0b1111, 0b1001, 0b1111, 0b1001, 0b1111],
  '9': [0b1111, 0b1001, 0b1111, 0b0001, 0b1111],
};
/** stamp digits at a 5-texel pitch (4 wide, 1 apart) from the top-left texel */
function stampNum(g: CanvasRenderingContext2D, num: string, x0: number, y0: number, ink: string) {
  g.fillStyle = ink;
  for (let i = 0; i < num.length; i++) {
    const rows = DIGIT[num[i]] ?? [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 4; c++) {
        if (rows[r] & (1 << (3 - c))) g.fillRect(x0 + i * 5 + c, y0 + r, 1, 1);
      }
    }
  }
}

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
  // ── the top landing ──────────────────────────────────────────────────────
  // At floor 3 the shaft's west half is where flight A WOULD carry on up to a
  // fourth floor that does not exist, so it was open void. The hall floor
  // stopped dead at the stairwell and the picker's best offer over there was
  // flight A, a storey and a half below: step past AZI(8.4) and you dropped
  // 2.6 m. A collider hid it, which is its own kind of wrong — the floor
  // visibly ended and something you could not see stopped you.
  //
  // So floor the first NIB_D of that half at floor-3 level and put a real
  // railing on its edge. NIB_D is bounded by HEADROOM, not by taste: flight A
  // climbs directly underneath, and at 1.2 m deep the far end still clears
  // the flight below by about 2.0 m. Deepen it and you start clipping the
  // heads of people walking up.
  //
  // The landing geometry, the floor-picker and the guard collider all read
  // these three numbers. They must not drift apart — that is the whole bug.
  const NIB_D = 1.2;              // how far the landing reaches into the shaft
  const NIB_Z1 = 8.4 + NIB_D;     // its open edge: the railing stands here
  const TOP_Y = 3 * ST;           // floor 3
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
  let hermitTex!: THREE.Texture;
  // he stands in his doorway on the east wall, so he faces WEST into the
  // hall. Same convention the street citizens use for `facing`: 0 is +z.
  const HERMIT_FACING = -Math.PI / 2;
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
    // It stops 1.0 m above floor 3 — high enough to be the balustrade at the
    // head of the stairs, low enough that it is not a slab left standing in
    // the shaft — and it wears the hall's own wallpaper under a timber cap,
    // so it reads as a plastered core wall instead of a bare grey panel.
    const CORE_H = TOP_Y + 1.0;
    const coreT = wallpaperT.clone();
    coreT.wrapS = coreT.wrapT = THREE.RepeatWrapping;
    coreT.repeat.set(2.6 / 2.7, CORE_H / 2.7);
    coreT.needsUpdate = true;
    const coreFaceM = texM(coreT);
    const coreEdgeM = new THREE.MeshBasicMaterial({ color: 0x6e6558 });
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.12, CORE_H, 2.6),
      [coreFaceM, coreFaceM, coreEdgeM, coreEdgeM, coreEdgeM, coreEdgeM]);
    divider.position.set(AX(1.2), CORE_H / 2, AZI(9.7));
    scene.add(divider);
    const coreCap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 2.6), railM);
    coreCap.position.set(AX(1.2), CORE_H + 0.035, AZI(9.7));
    scene.add(coreCap);
    // ── the top landing itself ───────────────────────────────────────────
    // Carpet on top to match the hall it continues, a ceiling on the
    // underside because you walk up flight A directly beneath it, and a
    // timber fascia on the open edges so it reads as built rather than as a
    // floating shelf.
    const nibTop = carpetT.clone();
    nibTop.wrapS = nibTop.wrapT = THREE.RepeatWrapping;
    nibTop.repeat.set(1.2 / 1.8, NIB_D / 1.8);
    nibTop.needsUpdate = true;
    const nibUnder = ceilT.clone();
    nibUnder.wrapS = nibUnder.wrapT = THREE.RepeatWrapping;
    nibUnder.repeat.set(1.2 / 1.8, NIB_D / 1.8);
    nibUnder.needsUpdate = true;
    const nib = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, NIB_D),
      [darkWoodM, darkWoodM, texM(nibTop), texM(nibUnder), darkWoodM, darkWoodM]);
    nib.position.set(AX(0.6), TOP_Y + 0.006 - 0.06, AZI(8.4 + NIB_D / 2));
    scene.add(nib);
    // the guard: a railing you can SEE, standing exactly where the stairCap
    // collider starts, so nothing invisible ever stops you
    const railCap2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.09), railM);
    railCap2.position.set(AX(0.6), TOP_Y + 0.95, AZI(NIB_Z1));
    scene.add(railCap2);
    const railLow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.06), railM);
    railLow.position.set(AX(0.6), TOP_Y + 0.48, AZI(NIB_Z1));
    scene.add(railLow);
    for (const lx of [0.08, 0.6, 1.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.07), railM);
      post.position.set(AX(lx), TOP_Y + 0.475, AZI(NIB_Z1));
      scene.add(post);
    }
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
      // The number plate: screwed-on BRASS, fixed after the grime. It used to
      // be a near-white rectangle — brighter than anything else indoors, so it
      // pulled the eye off the door it labels — carrying canvas text that
      // smeared. Brass sits in the same muted register as the hall, and the
      // numerals are stamped texel by texel so they stay sharp.
      // Centred on the door: plate x 7…24, numerals 9…22, both about x = 16.
      g.fillStyle = '#8a7440'; g.fillRect(7, 4, 18, 9);
      g.fillStyle = '#a89056'; g.fillRect(7, 4, 18, 1);   // lit top edge
      g.fillStyle = '#5e4e28'; g.fillRect(7, 12, 18, 1);  // shadow under it
      g.fillStyle = '#6a5a30';                            // four fixing screws
      g.fillRect(8, 5, 1, 1); g.fillRect(23, 5, 1, 1);
      g.fillRect(8, 11, 1, 1); g.fillRect(23, 11, 1, 1);
      stampNum(g, num, 9, 6, '#2e2616');
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
    // the hermit — a big quiet man; you only ever catch him at his door.
    //
    // He gets exactly what everyone on the street gets: the 5-view × 2-frame
    // citizen atlas, billboarded, with the far four angles done by mirroring.
    // He used to be a bespoke single cutout pinned at one fixed rotation, so
    // he stayed dead-on to you no matter where you stood in the hall — the
    // one figure in the world that did not turn.
    //
    // Same palette he always wore: pale undershirt, dark work trousers.
    // Scaled up off the standard citizen plane because he is a big man, and
    // parked on the feet-together frame because he never walks anywhere.
    hermitTex = citizenAtlas('#d8d4c8', '#4a4a52', '#c9946a', '#3a3226', 'plain');
    hermitTex.repeat.set(1 / 5, 1 / 2);
    const hermitGeo = new THREE.PlaneGeometry(0.95, 1.9);
    hermitGeo.translate(0, 0.95, 0);       // origin at his feet, like the citizens
    hermit = new THREE.Mesh(hermitGeo, new THREE.MeshBasicMaterial({ map: hermitTex, alphaTest: 0.5, side: THREE.DoubleSide }));
    hermit.scale.set(1.2, 1.1, 1);
    hermit.position.set(AX(2.28), 2 * ST, AZI(3.5));
    boards.push({ m: hermit });            // the sim loop turns him to face you
    scene.add(hermit);
    // ── the hall lights ──────────────────────────────────────────────────
    // A period flush-mount: bronze ceiling rose, shallow ribbed opal dome
    // under it. There used to be no fixture at all here — just a bare
    // additive gradient billboard — so the light read as a smudge on the
    // ceiling rather than a thing screwed to it.
    //
    // Two rules, both learned off the old one:
    //  1. NOTHING in this world is a smooth gradient. Every other surface is
    //     hard-edged and nearest-filtered, so the glow is stepped into hard
    //     concentric discs with a broken outer edge, not blurred.
    //  2. The glow is a HALO around the fixture, not the light itself — it
    //     is small and faint. The dome is what you actually read as lit,
    //     and it is lit by being painted bright (everything is MeshBasic).
    //
    // The dome's texture runs rim (v=1, top of canvas) to pole (v=0, bottom),
    // because SphereGeometry puts v=1 at thetaStart — so the bands read as
    // turned glass when you stand under it and look up.
    const opalT = pixTex(16, 12, (g) => {
      const bands = ['#9a8f74', '#b8ac8c', '#d2c5a2', '#e8dcba', '#f6efd6', '#fdf8e8'];
      for (let y = 0; y < 12; y++) { g.fillStyle = bands[Math.floor(y / 2)]; g.fillRect(0, y, 16, 1); }
      g.fillStyle = 'rgba(0,0,0,0.10)';                       // ribs, like a real shade
      for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 12);
      dither(g, 16, 12, 14);
    });
    const glowT = pixTex(24, 24, (g) => {
      const C = 12;
      const disc = (r: number, fill: string) => {
        g.fillStyle = fill;
        for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
        }
      };
      disc(11, 'rgba(255,226,168,0.07)');                     // hard steps, no gradient
      disc(8.5, 'rgba(255,230,178,0.11)');
      disc(6.2, 'rgba(255,236,194,0.16)');
      disc(4.2, 'rgba(255,242,210,0.22)');
      disc(2.4, 'rgba(255,248,228,0.30)');
      g.fillStyle = 'rgba(255,228,172,0.09)';                 // falloff breaks into texels
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, rr = 8.5 + Math.random() * 4.5;
        const x = Math.floor(C + Math.cos(a) * rr), y = Math.floor(C + Math.sin(a) * rr);
        if (x >= 0 && y >= 0 && x < 24 && y < 24) g.fillRect(x, y, 1, 1);
      }
    });
    const glowMat = new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    // the pool the fixture throws on the ceiling around itself — same stepped
    // disc laid flat and dimmed, so the ceiling reads as lit near the lamp
    // instead of the lamp being a bright dot on a dead grey slab
    const spillMat = new THREE.MeshBasicMaterial({
      map: glowT, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x707070, side: THREE.DoubleSide,
    });
    // the dome is open at the rim, so it is DoubleSide — you see the inside
    // of the far wall of the shade when you look up into it
    const opalM = new THREE.MeshBasicMaterial({ map: opalT, side: THREE.DoubleSide });
    const roseSideM = new THREE.MeshBasicMaterial({ color: 0x6a5a42 });
    const roseCapM = new THREE.MeshBasicMaterial({ color: 0x4a3f2e });
    const domeGeo = new THREE.SphereGeometry(0.19, 10, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    domeGeo.scale(1, 0.55, 1);                                // shallow, not a half ball
    const roseGeo = new THREE.CylinderGeometry(0.21, 0.20, 0.05, 10);
    // ceilY is the ceiling it hangs from; the rose is wider than the dome's
    // rim so the open edge is capped and never shows as a hole
    const ceilingLamp = (ceilY: number, wz: number, halo: number) => {
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(halo * 2.4, halo * 2.4), spillMat);
      spill.rotation.x = Math.PI / 2;                        // laid flat, seen from below
      spill.position.set(AX(1.2), ceilY - 0.02, wz);
      scene.add(spill);
      const rose = new THREE.Mesh(roseGeo, [roseSideM, roseCapM, roseCapM]);
      rose.position.set(AX(1.2), ceilY - 0.025, wz);
      scene.add(rose);
      const dome = new THREE.Mesh(domeGeo, opalM);
      dome.position.set(AX(1.2), ceilY - 0.05, wz);
      scene.add(dome);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(halo, halo), glowMat);
      gl.position.set(AX(1.2), ceilY - 0.12, wz);
      boards.push({ m: gl });
      scene.add(gl);
    };
    for (let f = 0; f < 4; f++) {
      ceilingLamp(f * ST + 2.55, AZI(3.5), 0.6);              // hall, under that floor's ceiling
      // the half landings hang theirs off whatever is genuinely above them:
      // the underside of the next landing up, or — at the top of the shaft,
      // where there is no next landing — the building's top ceiling
      if (f < 3) ceilingLamp(f < 2 ? (f + 1) * ST + 1.35 - 0.14 : H, AZI(12.5), 0.52);
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
    const consider = (h: number) => {
      if (h > lastGy + 0.6) return;     // no stepping up half a storey
      const d = Math.abs(h - lastGy);
      if (d < bd) { bd = d; best = h; }
    };
    for (let f = 0; f < 4; f++) {
      const h = rel + f * ST;
      if (h > 3 * ST + 0.01) continue;  // nothing above floor 3
      consider(h);
    }
    // The top landing is the one surface that is NOT a repeat of the storey
    // pattern: it exists only at floor 3, only over the shaft's west half,
    // and only for the first NIB_D of it. Every other candidate is rel+f*ST,
    // and over there the best of those is flight A a storey and a half down —
    // which is exactly the 2.6 m drop this closes. Offered as a candidate
    // rather than special-cased, so the hysteresis still arbitrates: walking
    // DOWN the east flight never sees it, because it is west-half only.
    if (lx >= 0 && lx < 1.2 && lz > 8.4 && lz <= NIB_Z1) consider(TOP_Y);
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
    // the guard starts at the railing, not at the stairwell mouth: the first
    // NIB_D of the west half is the top landing now and you may stand on it
    setCap(stairCap, lastGy > 3 * ST - 0.12, AX(0), AX(1.2), AZI(NIB_Z1), AZI(13.2));
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
    updateHermit: (hAbs) => {
      hermit.visible = hermitForce === -1 ? hermitIn(hAbs) : hermitForce === 1;
      if (!hermit.visible) return;
      // The billboard pass in the sim loop has already turned him to face the
      // player, so his own yaw IS the angle to the camera — no need for the
      // player's position here, which is why this still takes only the hour.
      // (It runs a frame behind the billboard pass. On a man who does not
      // move, one frame of lag is not a thing you can see.)
      const [col, mirror] = viewFor(hermit.rotation.y - HERMIT_FACING);
      hermitTex.repeat.x = mirror ? -1 / 5 : 1 / 5;
      hermitTex.offset.x = mirror ? (col + 1) / 5 : col / 5;
      hermitTex.offset.y = 0.5;            // standing still: feet together
    },
    forceHermit: (v) => { hermitForce = v === null ? -1 : v ? 1 : 0; },
  };
}

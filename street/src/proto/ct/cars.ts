import * as THREE from 'three';
import { pixTex, dither } from './paint';

// ---- the fleet: sedan / hatch / pickup / van, welded greenhouses ---------
// front is -z. The slab carries doors + arches; the greenhouse is ONE
// BufferGeometry loft (windshield, roof, rear glass, trapezoid side windows
// all share vertices — no gaps, ever). Era bonus: trapezoid side-window UVs
// shear the texture exactly like affine mapping used to.

export const CAR_COLORS = ['#7a8a5c', '#8a5a5a', '#5a6a8a', '#8a825a', '#6a5a7a', '#4a5a52'];
export type CarKind = 'sedan' | 'hatch' | 'pickup' | 'van';

/** The body side, rocker to beltline. `arches` are wheel-arch centres in metres
 *  RELATIVE TO THIS FACE'S OWN CENTRE — the pickup's slab stops behind the cab,
 *  so its face is no longer centred on the vehicle and only the front arch
 *  belongs on it (the rear one is painted on the bed skin). */
function bodySideTex(body: string, len: number, wheelZ: number, taxi: boolean,
  arches: number[] = [-wheelZ, wheelZ]): THREE.Texture {
  return pixTex(96, 20, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 96, 20);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, 96, 3);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 16, 96, 4);
    if (taxi) { // checker band instead of chrome
      for (let x = 0; x < 96; x += 6) {
        g.fillStyle = (x / 6) % 2 ? '#141416' : '#e8e4d8';
        g.fillRect(x, 6, 6, 4);
      }
    } else {
      g.fillStyle = '#d8dade'; g.fillRect(0, 8, 96, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(38, 2, 1, 15); g.fillRect(62, 2, 1, 15);
    g.fillStyle = '#1a1c20';
    g.fillRect(41, 11, 4, 2); g.fillRect(65, 11, 4, 2);
    // wheel arches at the true wheel positions
    g.fillStyle = '#0a0b0e';
    for (const wz of arches) {
      const ax = Math.round(((wz + len / 2) / len) * 96);
      g.beginPath(); g.arc(ax, 20, 10, Math.PI, 0); g.fill();
    }
    dither(g, 96, 20, 120);
  });
}
function cabinSideTex(windows: number): THREE.Texture {
  return pixTex(96, 16, (g) => {
    g.fillStyle = '#141820'; g.fillRect(0, 0, 96, 16);
    const w = Math.floor((96 - 10 - (windows - 1) * 5) / windows);
    let x = 5;
    for (let k = 0; k < windows; k++) {
      g.fillStyle = '#2e3c4e';
      g.fillRect(x, 2, w, 12);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(x + 2, 3, 4, 11);
      x += w + 5;
    }
    g.fillStyle = '#d8dade'; g.fillRect(0, 14, 96, 1);
  });
}
function carFrontTex(body: string): THREE.Texture {
  return pixTex(48, 16, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 16);
    g.fillStyle = '#d8dade'; g.fillRect(0, 12, 48, 3);
    g.fillStyle = '#1a1c20'; g.fillRect(14, 4, 20, 5);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    for (let x = 15; x < 33; x += 3) g.fillRect(x, 4, 1, 5);
    g.fillStyle = '#e8e4c0';
    g.fillRect(4, 4, 7, 5); g.fillRect(37, 4, 7, 5);
    dither(g, 48, 16, 40);
  });
}
function carRearTex(body: string): THREE.Texture {
  return pixTex(48, 16, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 16);
    g.fillStyle = '#d8dade'; g.fillRect(0, 12, 48, 3);
    g.fillStyle = '#8a1c1c';
    g.fillRect(3, 4, 9, 4); g.fillRect(36, 4, 9, 4);
    g.fillStyle = '#c9c4b0'; g.fillRect(19, 5, 10, 5);
    dither(g, 48, 16, 40);
  });
}
function panelTopTex(body: string, seamAt: number): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(4, 4, 40, 12);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, seamAt, 48, 1);
    dither(g, 48, 48, 70);
  });
}
function hubcapTex(): THREE.Texture {
  return pixTex(16, 16, (g) => {
    g.fillStyle = '#17181c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#8a8a92';
    g.beginPath(); g.arc(8, 8, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3a40';
    for (const [x, y] of [[8, 5], [5, 9], [11, 9], [8, 11]]) g.fillRect(x - 1, y - 1, 2, 2);
  });
}

// the welded greenhouse: base rect (y0) lofted to inset roof rect (y1).
// mats: [glassFront+Rear, roof, sides] via groups. DoubleSide everywhere.
function loftCabin(
  wBase: number, wRoof: number, y0: number, y1: number,
  zbf: number, zbr: number, zrf: number, zrr: number,
  glassM: THREE.Material, roofM: THREE.Material, sideM: THREE.Material,
): THREE.Mesh {
  const b0 = [-wBase, y0, zbf], b1 = [wBase, y0, zbf], b2 = [wBase, y0, zbr], b3 = [-wBase, y0, zbr];
  const t0 = [-wRoof, y1, zrf], t1 = [wRoof, y1, zrf], t2 = [wRoof, y1, zrr], t3 = [-wRoof, y1, zrr];
  const verts: number[] = [];
  const uvs: number[] = [];
  const uOf = (z: number) => (z - zbf) / (zbr - zbf);
  const push = (p: number[], u: number, v: number) => { verts.push(p[0], p[1], p[2]); uvs.push(u, v); };
  const quad = (a: number[], b: number[], c: number[], d: number[], uv: [number, number][]) => {
    push(a, ...uv[0]); push(b, ...uv[1]); push(c, ...uv[2]);
    push(a, ...uv[0]); push(c, ...uv[2]); push(d, ...uv[3]);
  };
  const geo = new THREE.BufferGeometry();
  // group 0: windshield + rear glass
  quad(b0, b1, t1, t0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  quad(b2, b3, t3, t2, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // group 1: roof
  quad(t0, t1, t2, t3, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // group 2: sides — u follows each vertex's own z (trapezoid shear)
  quad(b0, t0, t3, b3, [[uOf(zbf), 0], [uOf(zrf), 1], [uOf(zrr), 1], [uOf(zbr), 0]]);
  quad(b1, t1, t2, b2, [[uOf(zbf), 0], [uOf(zrf), 1], [uOf(zrr), 1], [uOf(zbr), 0]]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.addGroup(0, 12, 0);
  geo.addGroup(12, 6, 1);
  geo.addGroup(18, 12, 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, [glassM, roofM, sideM]);
}

// ═══════════════════════════════ the bus ══════════════════════════════════
//
// A 30-foot city transit bus. The RTS — the American city bus of this era —
// was built in 30/35/40 ft lengths at 96 or 102 in wide; the 30 is the only
// one that clears the parked cars on a street this narrow, so that is what
// runs this route. Period details, not invented: sliding PLUG doors front
// and rear, a roller destination sign (electronic signs existed by '97 but
// rollsigns were still everywhere), and a painted livery band — full vinyl
// wraps came later. Flat-sided rather than the RTS's famous curved panels:
// at 21 px/m a curve reads as noise, so the curve is implied in the paint.
//
// Doors are on LOCAL +x. The traffic system flips the bus 180° to run the
// other way, which swings local +x to the other side of the road — so the
// doors face the kerb in BOTH directions without any special-casing.
const BUS_LEN = 9.1, BUS_HW = 1.1, BUS_H = 2.35, BUS_Y0 = 0.5;
const BUS_AXLE_F = -2.9, BUS_AXLE_R = 2.6;
const BUS_PX = 21;   // px per metre, matching the cars' 96 px / 4.5 m

function busSideTex(doors: boolean, body: string, band: string, open = false): THREE.Texture {
  const W = Math.round(BUS_LEN * BUS_PX), H = Math.round(BUS_H * BUS_PX);
  return pixTex(W, H, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, W, 3);   // roof edge
    // window band
    const wy0 = 8, wy1 = 26;
    g.fillStyle = '#1b2028'; g.fillRect(4, wy0 - 1, W - 8, wy1 - wy0 + 2);
    for (let x = 6; x < W - 6; x += 13) {
      g.fillStyle = '#33465a'; g.fillRect(x, wy0, 10, wy1 - wy0);
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x + 1, wy0 + 1, 3, wy1 - wy0 - 2);
    }
    // livery band under the glass, then the darker skirt
    g.fillStyle = band; g.fillRect(0, 30, W, 6);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 30, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 40, W, H - 40);
    // wheel arches at the real axle positions
    g.fillStyle = '#0a0b0e';
    for (const wz of [BUS_AXLE_F, BUS_AXLE_R]) {
      const ax = Math.round(((wz + BUS_LEN / 2) / BUS_LEN) * W);
      g.beginPath(); g.arc(ax, H, 10, Math.PI, 0); g.fill();
    }
    if (doors) {
      // sliding plug doors: front single leaf behind the front axle, rear
      // double leaf ahead of the rear axle. Glazed nearly to the floor.
      for (const [wz, wide] of [[-2.35, 0.95], [1.5, 1.25]] as [number, number][]) {
        const dx = Math.round(((wz + BUS_LEN / 2) / BUS_LEN) * W);
        const dw = Math.round(wide * BUS_PX);
        g.fillStyle = '#20262e'; g.fillRect(dx, 5, dw, 34);
        if (open) {
          // leaves slid back against the jambs, dark saloon and step well
          // showing between them — this is what sells a bus that has stopped
          g.fillStyle = '#0b0d10'; g.fillRect(dx + 2, 7, dw - 4, 31);
          g.fillStyle = '#1d232b'; g.fillRect(dx + 3, 30, dw - 6, 8);   // step well
          const leaf = Math.max(2, Math.round(dw * 0.22));
          for (const lx of [dx + 1, dx + dw - leaf - 1]) {
            g.fillStyle = '#39485c'; g.fillRect(lx, 8, leaf, 28);
            g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(lx + 1, 9, 1, 26);
          }
        } else {
          g.fillStyle = '#39485c'; g.fillRect(dx + 2, 8, dw - 4, 28);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(dx + 3, 9, 2, 26);
          g.fillStyle = '#20262e'; g.fillRect(dx + Math.round(dw / 2) - 1, 5, 2, 34); // leaf split
        }
        g.fillStyle = '#c9c4b4'; g.fillRect(dx, 5, dw, 1); g.fillRect(dx, 38, dw, 1);
      }
    }
    dither(g, W, H, 90);
  });
}

function busFrontTex(body: string, band: string): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#1b2028'; g.fillRect(3, 9, 42, 20);   // windshield
    g.fillStyle = '#33465a'; g.fillRect(5, 11, 38, 16);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(6, 12, 10, 14);
    g.fillStyle = band; g.fillRect(0, 31, 48, 5);
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(0, 40, 48, 8);   // bumper shadow
    g.fillStyle = '#e8e4c0'; g.fillRect(4, 37, 8, 5); g.fillRect(36, 37, 8, 5); // headlights
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 43, 48, 3);            // bumper
    dither(g, 48, 48, 40);
  });
}

function busRearTex(body: string, band: string): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#1b2028'; g.fillRect(6, 8, 36, 15);   // rear window
    g.fillStyle = '#2c3a4a'; g.fillRect(8, 10, 32, 11);
    g.fillStyle = band; g.fillRect(0, 31, 48, 5);
    g.fillStyle = 'rgba(0,0,0,0.35)';                    // engine grille
    for (let y = 26; y < 30; y += 2) g.fillRect(10, y, 28, 1);
    g.fillStyle = '#8a1c1c'; g.fillRect(3, 37, 8, 6); g.fillRect(37, 37, 8, 6);
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 44, 48, 3);
    dither(g, 48, 48, 40);
  });
}

function busRoofTex(body: string): THREE.Texture {
  return pixTex(32, 96, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 32, 96);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(8, 10, 16, 12);   // roof hatches
    g.fillRect(8, 62, 16, 14);   // a/c hump
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(8, 10, 16, 1); g.fillRect(8, 62, 16, 1);
    dither(g, 32, 96, 50);
  });
}

// the roller sign: a linen roll behind glass, lit from inside
function busRollTex(): THREE.Texture {
  const t = pixTex(80, 14, (g) => {
    g.fillStyle = '#0e0f12'; g.fillRect(0, 0, 80, 14);
    g.fillStyle = '#141519'; g.fillRect(1, 1, 78, 12);
    g.fillStyle = '#d8b048';
    g.font = 'bold 9px monospace';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('42', 4, 7);
    g.font = 'bold 8px monospace';
    g.fillText('CROSSTOWN', 20, 7);
  });
  // 0.26 m tall and carrying LETTERS — the thinnest detailed face on the fleet,
  // so it gets the rest of the §4 prescription even though it has no dither:
  // no mip chain, nothing for the roller text to crawl through at a glance.
  t.minFilter = THREE.NearestFilter;
  return t;
}

/** the block's bus — a Group shaped like the cars so the traffic pool can
 *  drive it without knowing what it is */
export function makeBus(): THREE.Group {
  const body = '#b9b2a2';          // municipal cream, weathered
  const band = '#3f5a52';          // muted transit-authority green
  const flatT = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  darkM.userData.noLight = true;
  const g = new THREE.Group();

  // one tall slab carries the whole body; the paint does the shaping
  const sideDoors = flatT(busSideTex(true, body, band));
  const sideOpen = flatT(busSideTex(true, body, band, true));
  const sidePlain = flatT(busSideTex(false, body, band));
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_HW * 2, BUS_H, BUS_LEN),
    [sideDoors, sidePlain, flatT(busRoofTex(body)), darkM,
      flatT(busRearTex(body, band)), flatT(busFrontTex(body, band))],
  );
  shell.position.y = BUS_Y0 + BUS_H / 2;
  g.add(shell);

  // roof cap, slightly inset — breaks the silhouette so it isn't one brick
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_HW * 2 - 0.16, 0.12, BUS_LEN - 0.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(body).multiplyScalar(0.94) }),
  );
  cap.position.set(0, BUS_Y0 + BUS_H + 0.05, 0);
  g.add(cap);

  // the roller sign, above the windshield
  const roll = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.06), flatT(busRollTex()));
  roll.position.set(0, BUS_Y0 + BUS_H - 0.30, -BUS_LEN / 2 - 0.02);
  g.add(roll);

  // wheels: front axle well forward, rear axle set back, as on a real bus
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatT(hubcapTex());
  const busFront: THREE.Mesh[] = [];
  for (const wx of [-BUS_HW + 0.06, BUS_HW - 0.06]) for (const wz of [BUS_AXLE_F, BUS_AXLE_R]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 10), [tireM, capM, capM]);
    // YZX: the steer angle must turn the wheel about its own VERTICAL, after
    // the cylinder has been laid on its side — with the default XYZ order the
    // Y rotation would apply first and steer about the tilted axle instead.
    // At steer 0 this is the same matrix as the plain rotation.z it replaces.
    w.rotation.order = 'YZX';
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(wx, 0.44, wz);
    g.add(w);
    if (wz === BUS_AXLE_F) busFront.push(w);
  }
  g.userData.wheelbase = BUS_AXLE_R - BUS_AXLE_F;   // 5.5 m
  g.userData.steer = (a: number) => { for (const w of busFront) w.rotation.y = a; };
  g.userData.halfLen = BUS_LEN / 2;   // the traffic collider is longer for this one
  g.userData.laneX = 1.35;            // hugs the centre line to clear parked cars
  g.userData.speed = 6.4;             // and it is slower than the cars
  // the kerb-side door panel swaps to a leaves-open version while it stands
  // at the stop. Front door is at local z = -2.35, which is what the sim
  // lines up with the flag pole.
  g.userData.doorZ = -2.35;
  let shown = false;
  g.userData.setDoors = (open: boolean) => {
    if (open === shown) return;
    shown = open;
    (shell.material as THREE.Material[])[0] = open ? sideOpen : sideDoors;
  };
  return g;
}

export function makeCar(kind: CarKind, colorIdx: number, taxi = false): THREE.Group {
  const body = taxi ? '#c9a12e' : CAR_COLORS[colorIdx % CAR_COLORS.length];
  const flatT = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });
  const bodyM = new THREE.MeshBasicMaterial({ color: new THREE.Color(body) });
  const glassM = new THREE.MeshBasicMaterial({ color: 0x1c2836, side: THREE.DoubleSide });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  // Dark glass under a sodium lamp stays dark glass; rubber stays black.
  // Flag them so the lamplight registry skips them outright — a warmed
  // greenhouse reads as a brown slab, which is not a lighting effect.
  glassM.userData.noLight = true;
  darkM.userData.noLight = true;
  const g = new THREE.Group();

  const spec = {
    sedan: { len: 4.5, wheelZ: 1.45 },
    hatch: { len: 3.8, wheelZ: 1.2 },
    pickup: { len: 4.9, wheelZ: 1.65 },
    van: { len: 4.6, wheelZ: 1.5 },
  }[kind];
  const half = spec.len / 2;

  // ── the body slab: rocker to beltline ───────────────────────────────────
  //
  // On the PICKUP it STOPS at the back of the cab. It used to run the whole
  // length, and that one fact is why two separate requests for a deeper bed
  // failed to land: the tub's floor was nested INSIDE this solid box (floor top
  // 0.645 against a slab top of 0.84), so what you actually saw as the bed
  // floor was this slab's top face — plain body colour, 0.13 m below the rail.
  // Lowering the buried floor from 0.77 to 0.62 moved a surface nobody could
  // see. A bed floor has to sit BELOW the beltline, so the body cannot be solid
  // there; the bed is built as a real open tub below.
  const BED_Z0 = 0.55;                                  // bed front, behind the cab
  const ROCKER = 0.34, BELT = 0.84;                     // the slab's own extent
  const slabLen = kind === 'pickup' ? half + BED_Z0 : spec.len;
  const slabZ = kind === 'pickup' ? (BED_Z0 - half) / 2 : 0;
  const sideT = flatT(bodySideTex(body, slabLen, spec.wheelZ, taxi,
    // only the front arch is on the cab body once the slab is short
    kind === 'pickup' ? [-spec.wheelZ - slabZ] : [-spec.wheelZ, spec.wheelZ]));
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, BELT - ROCKER, slabLen),
    [sideT, sideT, bodyM, darkM, flatT(carRearTex(body)), flatT(carFrontTex(body))],
  );
  slab.position.set(0, (ROCKER + BELT) / 2, slabZ);
  g.add(slab);

  const roofM = flatT(panelTopTex(body, 24));
  const hoodM = (seam: number) => [bodyM, bodyM, flatT(panelTopTex(body, seam)), bodyM, bodyM, bodyM];

  if (kind === 'sedan') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, half - 0.9), hoodM(40));
    hood.position.set(0, 0.89, -(half + 0.95) / 2 + 0.02);
    g.add(hood);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, half - 1.32), hoodM(8));
    trunk.position.set(0, 0.885, (half + 1.35) / 2);
    g.add(trunk);
    g.add(loftCabin(0.81, 0.74, 0.84, 1.46, -1.0, 1.4, -0.35, 0.9, glassM, roofM, flatT(cabinSideTex(2))));
  } else if (kind === 'hatch') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, half - 0.75), hoodM(40));
    hood.position.set(0, 0.89, -(half + 0.8) / 2 + 0.02);
    g.add(hood);
    // no trunk: the rear glass slopes all the way to the tail
    g.add(loftCabin(0.81, 0.72, 0.84, 1.44, -0.85, half - 0.15, -0.25, half - 0.95, glassM, roofM, flatT(cabinSideTex(2))));
  } else if (kind === 'pickup') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.5), hoodM(40));
    hood.position.set(0, 0.89, -half + 0.85);
    g.add(hood);
    // short cab, near-vertical rear window
    g.add(loftCabin(0.85, 0.74, 0.84, 1.5, -1.0, 0.45, -0.45, 0.32, glassM, roofM, flatT(cabinSideTex(1))));
    // ── THE BED: a real open tub, floor BELOW the beltline ────────────────
    //
    // Rebuilt rather than nudged, because the bed has now been asked about
    // twice and the reason both previous passes failed is structural, not a
    // number: the slab ran solid through here, so the tub's floor was inside
    // it and the visible "floor" was the slab's body-coloured top face, 0.13 m
    // under the rail. Now the slab stops at the cab (see above) and the bed is
    // a genuine box: skin, floor, headboard, tailgate.
    //
    //   rail top   0.97   unchanged — a real pickup's rail sits near the base
    //                     of the cab glass, and a playtest already rejected it
    //                     standing proud of the beltline
    //   floor top  0.50   so the inside is 0.47 m deep, which is a 1997
    //                     half-ton bed, and lands just above the axle line
    //   skin       0.34 … 0.97 — the outer wall now spans rocker to rail, so
    //                     it carries the body side art the slab used to
    const RAIL_T = 0.97;
    const FLOOR_T = 0.50;               // the floor's TOP surface
    const WALL_T = 0.16, GATE_T = 0.10;
    const HW = 0.9;                     // body half-width — the slab is 1.8 wide
    const SKIN_H = RAIL_T - ROCKER;     // 0.63 m of outer wall
    const wallLen = (half - GATE_T) - BED_Z0;
    const bedMidZ = BED_Z0 + wallLen / 2;
    // Painted at the same texel density as the cab slab beside it (that face is
    // 96 texels over slabLen, and 20 over its 0.5 m), so the bed's paint is not
    // finer or coarser than the cab's.
    const PPM_X = 96 / slabLen, PPM_Y = 40;
    const skinW = Math.round(wallLen * PPM_X), skinH = Math.round(SKIN_H * PPM_Y);
    const yRow = (worldY: number) => Math.round((RAIL_T - worldY) * PPM_Y);
    const bedSkinT = pixTex(skinW, skinH, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, skinW, skinH);
      // the same three lines the cab slab carries, at the same WORLD heights,
      // so they run on across the seam instead of stepping at it
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, skinW, 2);        // rail cap
      g2.fillStyle = 'rgba(255,255,255,0.18)'; g2.fillRect(0, yRow(0.84), skinW, 3); // beltline
      g2.fillStyle = '#d8dade'; g2.fillRect(0, yRow(0.64), skinW, 1);              // chrome strip
      g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(0, yRow(0.44), skinW, skinH - yRow(0.44)); // rocker
      // the rear wheel arch, which used to be painted on the slab. Same texel
      // radius as the slab's, so it is the same ellipse in world space.
      g2.fillStyle = '#0a0b0e';
      const ax = Math.round(((spec.wheelZ - bedMidZ + wallLen / 2) / wallLen) * skinW);
      g2.beginPath(); g2.ellipse(ax, skinH, 10, 10, 0, Math.PI, 0); g2.fill();
    });
    bedSkinT.minFilter = THREE.NearestFilter;   // GOTCHAS §4 — see the liner below
    // The tailgate IS the back of the truck now, so it carries the tail lights
    // and the step bumper. Painted symmetrically and, unlike before, nothing is
    // coplanar with it — the slab's rear face is 1.8 m forward, behind the
    // headboard. The asymmetric lights the user saw were two symmetric painted
    // lights inside a z-fight, not a texture fault (GOTCHAS §6).
    const gateW = Math.round(HW * 2 * PPM_X), gateH = skinH;
    const bedRearT = pixTex(gateW, gateH, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, gateW, gateH);
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, gateW, 2);        // rail cap
      g2.fillStyle = 'rgba(0,0,0,0.3)';                                           // latch
      g2.fillRect(Math.round(gateW * 0.42), yRow(0.72), Math.round(gateW * 0.16), 3);
      const lw = Math.max(3, Math.round(gateW * 0.17)), lh = 4;
      g2.fillStyle = '#8a1c1c';
      g2.fillRect(Math.round(gateW * 0.07), yRow(0.58), lw, lh);
      g2.fillRect(gateW - Math.round(gateW * 0.07) - lw, yRow(0.58), lw, lh);
      g2.fillStyle = '#d8dade'; g2.fillRect(0, yRow(0.44), gateW, 3);             // step bumper
    });
    bedRearT.minFilter = THREE.NearestFilter;
    const bodyC = new THREE.Color(body);
    const outM = flatT(bedSkinT);
    const rimM = new THREE.MeshBasicMaterial({ color: bodyC.clone().multiplyScalar(1.16) });
    // ── the liner: NEAR-BLACK, and that is the point ───────────────────────
    //
    // It used to be the body colour scaled by 0.6, which on this palette is
    // #6d6646 against a #8a825a body — to the eye, the same green, which is
    // most of why the bed read as a pressed dish. Nothing in this world casts
    // a shadow, so the darkness of a cavity has to be PAINTED or it does not
    // exist. Flagged noLight for the same reason the glass is: a sodium lamp
    // warming the inside of a bed to amber is not a lighting effect.
    const linerM = new THREE.MeshBasicMaterial({ color: 0x16171a });
    linerM.userData.noLight = true;
    // ribs front-to-back, deliberately COARSE: this is a near-horizontal face
    // read at a grazing angle, which is the tailgate's own problem (GOTCHAS
    // §4). Wide bands, no dither, NearestFilter.
    const inW = HW * 2 - WALL_T * 2;
    const floorT = pixTex(Math.round(inW * 16), Math.round(wallLen * 16), (g2) => {
      const W = Math.round(inW * 16), H = Math.round(wallLen * 16);
      g2.fillStyle = '#16171a'; g2.fillRect(0, 0, W, H);
      for (let x = 2; x < W; x += 8) {                     // 0.25 m ribs
        g2.fillStyle = 'rgba(255,255,255,0.07)'; g2.fillRect(x, 0, 3, H);
        g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(x + 3, 0, 1, H);
      }
    });
    floorT.minFilter = THREE.NearestFilter;
    const floorM = flatT(floorT);
    floorM.userData.noLight = true;
    const floor2 = new THREE.Mesh(
      new THREE.BoxGeometry(inW, 0.05, wallLen),
      [linerM, linerM, floorM, darkM, linerM, linerM]);
    floor2.position.set(0, FLOOR_T - 0.025, bedMidZ);
    g.add(floor2);
    // side walls: outer face flush with the slab's own side plane at ±0.9 (they
    // used to stand at ±0.85, a 5 cm step in the body line), inner face liner
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_T, SKIN_H, wallLen),
        s < 0 ? [linerM, outM, rimM, darkM, linerM, linerM] : [outM, linerM, rimM, darkM, linerM, linerM],
      );
      wall.position.set(s * (HW - WALL_T / 2), (ROCKER + RAIL_T) / 2, bedMidZ);
      g.add(wall);
    }
    // headboard, sealed against the back of the cab. Sits BETWEEN the walls so
    // its sides are not coplanar with their outer faces (GOTCHAS §6).
    const head = new THREE.Mesh(new THREE.BoxGeometry(inW, SKIN_H, 0.1),
      [linerM, linerM, rimM, darkM, linerM, linerM]);
    head.position.set(0, (ROCKER + RAIL_T) / 2, BED_Z0 + 0.05);
    g.add(head);
    // tailgate closes the end: the walls stop at half - GATE_T so the two ABUT
    // instead of overlapping
    const gate = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, SKIN_H, GATE_T),
      [outM, outM, rimM, darkM, flatT(bedRearT), linerM]);
    gate.position.set(0, (ROCKER + RAIL_T) / 2, half - GATE_T / 2);
    g.add(gate);
  } else { // van
    // tall box greenhouse, stub hood, near-vertical everything
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.8), hoodM(40));
    hood.position.set(0, 0.89, -half + 0.5);
    g.add(hood);
    g.add(loftCabin(0.85, 0.8, 0.84, 1.78, -half + 0.85, half - 0.1, -half + 1.35, half - 0.2, glassM, roofM, flatT(cabinSideTex(3))));
  }

  if (taxi) {
    const signT = pixTex(32, 12, (g2) => {
      g2.fillStyle = '#141416'; g2.fillRect(0, 0, 32, 12);
      g2.fillStyle = '#f2c94a'; g2.font = 'bold 8px monospace';
      g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText('TAXI', 16, 7);
    });
    signT.minFilter = THREE.NearestFilter;   // 0.18 m tall with letters on it — see busRollTex
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.24), flatT(signT));
    sign.position.set(0, 1.55, -0.1);
    g.add(sign);
  }

  // wheels
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatT(hubcapTex());
  const front: THREE.Mesh[] = [];
  for (const wx of [-0.82, 0.82]) for (const wz of [spec.wheelZ, -spec.wheelZ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), [tireM, capM, capM]);
    // see makeBus: YZX so steering turns the wheel about its own vertical.
    // Front is -z (the whole model is built nose-first, see the file header).
    w.rotation.order = 'YZX';
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(wx, 0.34, wz);
    g.add(w);
    if (wz === -spec.wheelZ) front.push(w);
  }
  g.userData.wheelbase = spec.wheelZ * 2;
  g.userData.steer = (a: number) => { for (const w of front) w.rotation.y = a; };
  return g;
}

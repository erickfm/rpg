import * as THREE from 'three';
import { pixTex, dither } from './paint';

// ---- the fleet: sedan / hatch / pickup / van, welded greenhouses ---------
// front is -z. The slab carries doors + arches; the greenhouse is ONE
// BufferGeometry loft (windshield, roof, rear glass, trapezoid side windows
// all share vertices — no gaps, ever). Era bonus: trapezoid side-window UVs
// shear the texture exactly like affine mapping used to.

export const CAR_COLORS = ['#7a8a5c', '#8a5a5a', '#5a6a8a', '#8a825a', '#6a5a7a', '#4a5a52'];
export type CarKind = 'sedan' | 'hatch' | 'pickup' | 'van';

function bodySideTex(body: string, len: number, wheelZ: number, taxi: boolean): THREE.Texture {
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
    for (const wz of [-wheelZ, wheelZ]) {
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

export function makeCar(kind: CarKind, colorIdx: number, taxi = false): THREE.Group {
  const body = taxi ? '#c9a12e' : CAR_COLORS[colorIdx % CAR_COLORS.length];
  const flatT = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });
  const bodyM = new THREE.MeshBasicMaterial({ color: new THREE.Color(body) });
  const glassM = new THREE.MeshBasicMaterial({ color: 0x1c2836, side: THREE.DoubleSide });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  const g = new THREE.Group();

  const spec = {
    sedan: { len: 4.5, wheelZ: 1.45 },
    hatch: { len: 3.8, wheelZ: 1.2 },
    pickup: { len: 4.9, wheelZ: 1.65 },
    van: { len: 4.6, wheelZ: 1.5 },
  }[kind];
  const half = spec.len / 2;

  // slab
  const sideT = flatT(bodySideTex(body, spec.len, spec.wheelZ, taxi));
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, spec.len),
    [sideT, sideT, bodyM, darkM, flatT(carRearTex(body)), flatT(carFrontTex(body))],
  );
  slab.position.y = 0.59;
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
    // the bed is a real open tub: thick walls flush with the slab, a dark
    // floor you can see over the rails, headboard sealed against the cab.
    // Outer faces carry body paint with highlight/shadow so edges read.
    const bedSideT = pixTex(96, 10, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, 96, 10);
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, 96, 2);
      g2.fillStyle = 'rgba(0,0,0,0.25)'; g2.fillRect(0, 8, 96, 2);
      dither(g2, 96, 10, 30);
    });
    const bedRearT = pixTex(48, 10, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, 48, 10);
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, 48, 2);
      g2.fillStyle = 'rgba(0,0,0,0.3)'; g2.fillRect(18, 4, 12, 3); // tailgate latch
      dither(g2, 48, 10, 20);
    });
    const bodyC = new THREE.Color(body);
    const outM = flatT(bedSideT);
    const rimM = new THREE.MeshBasicMaterial({ color: bodyC.clone().multiplyScalar(1.16) });
    const inM = new THREE.MeshBasicMaterial({ color: bodyC.clone().multiplyScalar(0.6) });
    const bedFloorT = pixTex(32, 48, (g2) => {
      g2.fillStyle = '#17181c'; g2.fillRect(0, 0, 32, 48);
      g2.fillStyle = 'rgba(255,255,255,0.1)';
      for (let y = 4; y < 46; y += 7) g2.fillRect(0, y, 32, 2); // corrugations
      dither(g2, 32, 48, 30);
    });
    // tub is recessed inside the body (a rim of slab shows around it) and
    // rides low — rails only just above the beltline
    const wallLen = half - 0.65;
    const floor2 = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.05, wallLen), [inM, inM, flatT(bedFloorT), darkM, inM, inM]);
    floor2.position.set(0, 0.845, 0.55 + wallLen / 2);
    g.add(floor2);
    for (const s of [-1, 1]) {
      const railWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.24, wallLen),
        s < 0 ? [inM, outM, rimM, darkM, inM, inM] : [outM, inM, rimM, darkM, inM, inM],
      );
      railWall.position.set(s * 0.66, 0.96, 0.55 + wallLen / 2);
      g.add(railWall);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.24, 0.1), [outM, outM, rimM, darkM, inM, inM]);
    head.position.set(0, 0.96, 0.5);
    g.add(head);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.24, 0.1), [outM, outM, rimM, darkM, flatT(bedRearT), inM]);
    gate.position.set(0, 0.96, half - 0.05);
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
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.24), flatT(signT));
    sign.position.set(0, 1.55, -0.1);
    g.add(sign);
  }

  // wheels
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  const capM = flatT(hubcapTex());
  for (const wx of [-0.82, 0.82]) for (const wz of [spec.wheelZ, -spec.wheelZ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), [tireM, capM, capM]);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.34, wz);
    g.add(w);
  }
  return g;
}

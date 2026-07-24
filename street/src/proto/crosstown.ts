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

const L = 96;          // street length into -z
const ROAD_HALF = 5.0; // road: parking lane + travel lane each side, tight
const WALK = 2.0;      // sidewalk width
const FACE = ROAD_HALF + WALK; // building faces at ±7
const PARK_X = 3.9;    // parking lane centre
const DRIVE_X = 1.5;   // travel lane centre
const FOG_NEAR = 9, FOG_FAR = 60;

let seed = 9797 >>> 0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---- texel painting -------------------------------------------------------

function pixTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}

function dither(g: CanvasRenderingContext2D, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    g.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1);
  }
}

function facadeTex(brick: string, floors: number): THREE.Texture {
  const W = 96, H = 32 + floors * 28;
  return pixTex(W, H, (g) => {
    g.fillStyle = brick;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1);
    for (let y = 0; y < H; y += 10) for (let x = (y % 20) ? 0 : 4; x < W; x += 9) g.fillRect(x, y, 1, 5);
    g.fillStyle = '#8a7a62';
    g.fillRect(0, 0, W, 6);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 6, W, 2);
    for (let f = 0; f < floors; f++) {
      const y = 14 + f * 28;
      for (let c = 0; c < 4; c++) {
        const x = 8 + c * 22;
        const lit = ((f * 7 + c * 3) % 5) === 0;
        g.fillStyle = '#1a1c22';
        g.fillRect(x - 1, y - 1, 14, 18);
        g.fillStyle = lit ? '#c9a45e' : '#2e3a46';
        g.fillRect(x, y, 12, 16);
        if (!lit) { g.fillStyle = '#48586a'; g.fillRect(x + 7, y, 3, 16); }
        else { g.fillStyle = '#8a6a3a'; g.fillRect(x, y + 10, 12, 6); }
        g.fillStyle = '#9a8a72';
        g.fillRect(x - 1, y + 17, 14, 2);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let k = 0; k < 5; k++) {
      g.fillRect(Math.floor(Math.random() * W), 0, 2, Math.floor(H * Math.random()));
    }
    dither(g, W, H, 500);
  });
}

function shopfrontTex(brick: string, name: string, awning: string): THREE.Texture {
  return pixTex(96, 40, (g) => {
    g.fillStyle = brick; g.fillRect(0, 0, 96, 40);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < 40; y += 5) g.fillRect(0, y, 96, 1);
    g.fillStyle = awning;
    g.fillRect(4, 2, 88, 10);
    g.fillStyle = '#f2ead0';
    g.font = 'bold 8px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, 48, 7);
    g.fillStyle = '#141820';
    g.fillRect(6, 14, 84, 24);
    g.fillStyle = '#3a3020';
    g.fillRect(8, 16, 80, 20);
    g.fillStyle = '#c9a45e';
    g.fillRect(10, 22, 30, 12);
    g.fillStyle = '#5a6a7a';
    g.fillRect(58, 16, 6, 20);
    g.fillStyle = '#2a3440';
    g.fillRect(46, 16, 3, 22);
    dither(g, 96, 40, 260);
  });
}

function asphaltTex(): THREE.Texture {
  const t = pixTex(64, 64, (g) => {
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 64, 64);
    dither(g, 64, 64, 900);
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.moveTo(4, 60); g.lineTo(30, 30); g.lineTo(28, 8); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.random() * 60, Math.random() * 60, 4, 3);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 30);
  return t;
}

function walkTex(): THREE.Texture {
  const t = pixTex(64, 64, (g) => {
    g.fillStyle = '#84817a'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 64, 2); g.fillRect(0, 32, 64, 2);
    g.fillRect(0, 0, 2, 64); g.fillRect(32, 0, 2, 64);
    dither(g, 64, 64, 500);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 40);
  return t;
}

function treeSprite(k: number, H = 96): THREE.Texture {
  return pixTex(64, H, (g) => {
    g.fillStyle = '#4a3626'; g.fillRect(28, 58, 8, H - 58);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(28, 58, 2, H - 58);
    const greens = k === 1 ? ['#425c2e', '#364c26', '#527038'] : ['#2e5a30', '#25482a', '#3f7038'];
    const blobs: [number, number, number][] = [[32, 34, 26], [18, 44, 16], [46, 42, 15], [26, 22, 14], [42, 24, 12], [32, 40, 18]];
    blobs.forEach(([x, y, r], i) => {
      g.fillStyle = greens[i % 3];
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    });
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 24;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(200,220,140,0.45)' : 'rgba(10,25,10,0.45)';
      g.fillRect(Math.floor(32 + Math.cos(a) * rr), Math.floor(34 + Math.sin(a) * rr * 0.9), 2, 2);
    }
  });
}

function treePitTex(): THREE.Texture {
  return pixTex(32, 32, (g) => {
    g.fillStyle = '#77776e'; g.fillRect(0, 0, 32, 32);  // concrete rim
    g.fillStyle = '#3e2f20'; g.fillRect(3, 3, 26, 26);  // soil
    for (let i = 0; i < 70; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#4a3826' : '#30241a';
      g.fillRect(3 + Math.floor(Math.random() * 25), 3 + Math.floor(Math.random() * 25), 2, 1);
    }
  });
}

function hydrantSprite(): THREE.Texture {
  return pixTex(32, 48, (g) => {
    g.fillStyle = '#8a2c22';
    g.fillRect(12, 14, 8, 30);
    g.fillRect(8, 22, 16, 6);
    g.fillStyle = '#a83a2e';
    g.fillRect(12, 14, 3, 30);
    g.fillRect(11, 10, 10, 6);
    g.fillStyle = '#6a2018';
    g.fillRect(13, 44, 7, 2);
    dither(g, 32, 48, 60);
  });
}

function pigeonSprite(): THREE.Texture {
  return pixTex(24, 24, (g) => {
    g.fillStyle = '#6a6e78';
    g.beginPath(); g.arc(12, 15, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4e58';
    g.beginPath(); g.arc(17, 10, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a45e';
    g.fillRect(20, 10, 3, 1);
    g.fillStyle = '#3a3e46';
    g.fillRect(6, 13, 6, 4);
  });
}

function payphoneTex(): THREE.Texture {
  return pixTex(32, 64, (g) => {
    g.fillStyle = '#2c4a7a'; g.fillRect(0, 0, 32, 12);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText('PHONE', 16, 9);
    g.fillStyle = '#8a8e94'; g.fillRect(2, 12, 28, 52);
    g.fillStyle = '#141820'; g.fillRect(6, 16, 20, 26);
    g.fillStyle = '#1c1e24'; g.fillRect(10, 46, 12, 14);
    dither(g, 32, 64, 60);
  });
}

// ---- painted car fleet ----------------------------------------------------

// ---- the fleet: sedan / hatch / pickup / van, welded greenhouses ---------
// front is -z. The slab carries doors + arches; the greenhouse is ONE
// BufferGeometry loft (windshield, roof, rear glass, trapezoid side windows
// all share vertices — no gaps, ever). Era bonus: trapezoid side-window UVs
// shear the texture exactly like affine mapping used to.

const CAR_COLORS = ['#7a8a5c', '#8a5a5a', '#5a6a8a', '#8a825a', '#6a5a7a', '#4a5a52'];
type CarKind = 'sedan' | 'hatch' | 'pickup' | 'van';

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

function makeCar(kind: CarKind, colorIdx: number, taxi = false): THREE.Group {
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
    // the bed is one solid box, walls flush with the body slab; the open top
    // is painted — dark corrugated floor inset in a body-colored rim — so
    // there are no loose rails and nothing to gap
    const bedLen = half - 0.45;
    const bedTopT = pixTex(48, 96, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, 48, 96);
      g2.fillStyle = '#17181c'; g2.fillRect(5, 6, 38, 84);
      g2.fillStyle = 'rgba(255,255,255,0.10)';
      for (let y = 10; y < 90; y += 8) g2.fillRect(5, y, 38, 2);
      dither(g2, 48, 96, 60);
    });
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
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.36, bedLen),
      [flatT(bedSideT), flatT(bedSideT), flatT(bedTopT), darkM, flatT(bedRearT), darkM],
    );
    bed.position.set(0, 1.02, 0.45 + bedLen / 2);
    g.add(bed);
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

// ---- 8-angle citizens (kept from the milestone — the good stuff) ---------

const FW = 32, FH = 64;
type Fit = 'plain' | 'cap' | 'dress' | 'hoodie';
function citizenAtlas(jacket: string, pants: string, skin: string, hair: string, style: Fit = 'plain', accent = '#8a3a2e'): THREE.Texture {
  return pixTex(FW * 5, FH * 2, (g) => {
    for (let view = 0; view < 5; view++) {
      for (let frame = 0; frame < 2; frame++) {
        const ox = view * FW, oy = frame * FH;
        const cx = ox + FW / 2;
        const stride = frame === 0 ? 0 : 3;
        g.fillStyle = style === 'dress' ? skin : pants; // dresses show legs
        if (view === 2) {
          g.fillRect(cx - 2 - stride, oy + 38, 4, 21);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(cx - 2 + stride, oy + 38, 4, 21);
        } else {
          g.fillRect(cx - 5 - stride, oy + 38, 4, 21);
          g.fillRect(cx + 1 + stride, oy + 38, 4, 21);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(cx + 1 + stride, oy + 38, 4, 21);
        }
        g.fillStyle = '#16161a';
        g.fillRect(cx - 6 - stride, oy + 57, 6, 3);
        g.fillRect(cx + stride, oy + 57, 6, 3);
        g.fillStyle = jacket;
        g.fillRect(cx - 7, oy + 20, 14, 19);
        if (view < 4) {
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - 7, oy + 20, 4, 19);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 3, oy + 20, 4, 19);
        } else {
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 7, oy + 20, 14, 19);
        }
        if (view === 0) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(cx - 1, oy + 21, 1, 17); }
        if (view === 4) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(cx - 6, oy + 24, 12, 2); }
        if (style === 'dress') { // flared skirt over the hips
          g.fillStyle = jacket;
          g.fillRect(cx - 7, oy + 32, 14, 6);
          g.fillRect(cx - 8, oy + 36, 16, 7);
        }
        g.fillStyle = jacket;
        if (view === 2) {
          g.fillRect(cx - 2, oy + 21, 4, 15);
          g.fillStyle = skin; g.fillRect(cx - 2, oy + 36, 4, 3);
        } else {
          g.fillRect(cx - 10, oy + 21, 3, 15);
          g.fillRect(cx + 7, oy + 21, 3, 15);
          g.fillStyle = skin;
          g.fillRect(cx - 10, oy + 36, 3, 3); g.fillRect(cx + 7, oy + 36, 3, 3);
        }
        g.fillStyle = skin;
        g.fillRect(cx - 5, oy + 8, 10, 12);
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(cx - 5, oy + 8, 3, 12);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 2, oy + 8, 3, 12);
        g.fillStyle = hair;
        if (view === 4) { g.fillRect(cx - 6, oy + 5, 12, 14); }
        else if (view === 3) { g.fillRect(cx - 6, oy + 5, 12, 9); g.fillRect(cx + 1, oy + 5, 5, 13); }
        else { g.fillRect(cx - 6, oy + 5, 12, 5); g.fillRect(cx - 6, oy + 8, 2, 4); }
        if (style === 'cap') { // ball cap over the hair
          g.fillStyle = accent;
          g.fillRect(cx - 6, oy + 4, 12, 5);
          if (view <= 1) g.fillRect(cx - 7, oy + 8, 14, 2);
          else if (view === 2) g.fillRect(cx - 9, oy + 8, 8, 2); // brim points forward
        } else if (style === 'hoodie') {
          g.fillStyle = jacket;
          if (view === 4) g.fillRect(cx - 7, oy + 4, 14, 16); // hood covers the back of the head, meets the sweater
          else if (view === 3) { // 3/4 back: hood wraps the turned side too
            g.fillRect(cx - 7, oy + 4, 14, 4);
            g.fillRect(cx - 7, oy + 6, 2, 14);
            g.fillRect(cx + 1, oy + 4, 6, 16);
            g.fillRect(cx - 7, oy + 18, 14, 2);
          } else if (view === 2) { // profile: rim above the nose, hood over crown and back
            g.fillRect(cx - 7, oy + 4, 14, 4);
            g.fillRect(cx - 7, oy + 6, 2, 6);
            g.fillRect(cx + 1, oy + 4, 6, 16);
            g.fillRect(cx - 7, oy + 18, 14, 2);
          } else {
            g.fillRect(cx - 7, oy + 4, 14, 4);
            g.fillRect(cx - 7, oy + 6, 2, 14); g.fillRect(cx + 5, oy + 6, 2, 14); // hood rim, down to the shoulders
            g.fillRect(cx - 7, oy + 18, 14, 2); // cowl bunched at the neck
          }
          if (view <= 1) {
            g.fillStyle = '#e8e4d8';
            g.fillRect(cx - 2, oy + 21, 1, 5); g.fillRect(cx + 1, oy + 21, 1, 5); // drawstrings
          }
        }
        g.fillStyle = '#241a12';
        if (view === 0) { g.fillRect(cx - 3, oy + 13, 2, 2); g.fillRect(cx + 2, oy + 13, 2, 2); }
        else if (view === 1) { g.fillRect(cx - 4, oy + 13, 2, 2); g.fillRect(cx + 1, oy + 13, 2, 2); }
        else if (view === 2) { g.fillRect(cx - 4, oy + 13, 2, 2); g.fillStyle = skin; g.fillRect(cx - 7, oy + 14, 2, 3); }
        if (view <= 1) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - 2, oy + 17, 5, 1); }
      }
    }
  });
}

function viewFor(rel: number): [number, boolean] {
  const sector = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
  const cols = [0, 1, 2, 3, 4, 3, 2, 1];
  return [cols[sector], sector > 4];
}

// ═══════════════════════════════ the world ════════════════════════════════

export function makeCrosstown(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(88, 1, 0.1, 220);
  scene.background = new THREE.Color(0x8a97a2);
  scene.fog = new THREE.Fog(0x8a97a2, FOG_NEAR, FOG_FAR);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1), new THREE.HemisphereLight(0xd8dce0, 0x6a6258, 0.5));

  const flat = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m });

  // ground: road wide enough for a parked lane + travel lane each side
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, L + 44), flat(asphaltTex()));
  road.rotation.x = -Math.PI / 2; road.position.z = -L / 2 + 14;
  scene.add(road);
  // raised sidewalks with a visible curb face
  const KERB_H = 0.14;
  const kerbFaceM = new THREE.MeshBasicMaterial({ color: 0x97928a });
  const walkTopM = flat(walkTex());
  const walkDarkM = new THREE.MeshBasicMaterial({ color: 0x6a675f });
  for (const s of [-1, 1]) {
    const mats = s > 0
      ? [walkDarkM, kerbFaceM, walkTopM, walkDarkM, walkDarkM, walkDarkM]  // -x face is the kerb
      : [kerbFaceM, walkDarkM, walkTopM, walkDarkM, walkDarkM, walkDarkM]; // +x face is the kerb
    const walk = new THREE.Mesh(new THREE.BoxGeometry(WALK, KERB_H + 0.04, L + 44), mats);
    walk.position.set(s * (ROAD_HALF + WALK / 2), (KERB_H + 0.04) / 2 - 0.04, -L / 2 + 14);
    scene.add(walk);
  }
  const sidewalkY = KERB_H; // prop base height on the walks
  const lineT = pixTex(8, 32, (g) => { g.fillStyle = '#b8a24e'; g.fillRect(2, 0, 4, 18); });
  lineT.wrapS = lineT.wrapT = THREE.RepeatWrapping;
  lineT.repeat.set(1, 40);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, L + 44), new THREE.MeshBasicMaterial({ map: lineT, alphaTest: 0.5 }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.03, -L / 2 + 14);
  scene.add(line);

  // buildings — the original hand-laid street
  const bricks = ['#6b4034', '#7a4a3a', '#5c4436', '#835444'];
  const shops: [string, string][] = [['GROCERY', '#8a2c22'], ['LAUNDRY', '#2c4a7a'], ['PIZZA', '#2e6a34'], ['MUSIC', '#6a2c6a'], ['DINER', '#8a5a22'], ['BOOKS', '#3a5a5a']];
  const AZ0 = -37, AZ1 = -43.5; // the alley gap in the left wall
  let bi = 0;
  for (const side of [-1, 1]) {
    let z = 14.2;
    while (z > -L - 2) {
      let w = 9 + (bi % 3) * 3;
      // the alley mouth: end the last building flush with the corner, skip
      // the gap, and resume flush on the far side — no sky slits
      if (side === -1 && z > AZ1 + 0.1) {
        if (z <= AZ0 + 0.1) { z = AZ1; continue; }
        if (z - w < AZ0) w = z - AZ0;
      }
      const floors = 3 + ((bi * 7) % 3);
      const h = 3.4 + floors * 2.4;
      const cz = z - w / 2;
      const brick = bricks[bi % bricks.length];
      const facade = flat(facadeTex(brick, floors));
      const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
      const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
      const mats = side < 0
        ? [facade, endM, roofM, roofM, endM, endM]
        : [endM, facade, roofM, roofM, endM, endM];
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, w), mats);
      wall.position.set(side * (FACE + 1.7), h / 2 + 3.2, cz);
      scene.add(wall);
      const [nm, col] = shops[bi % shops.length];
      const shopM = flat(shopfrontTex(brick, nm, col));
      const shopMats = side < 0
        ? [shopM, endM, roofM, roofM, endM, endM]
        : [endM, shopM, roofM, roofM, endM, endM];
      const shop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, w), shopMats);
      shop.position.set(side * (FACE + 1.7), 1.6, cz);
      scene.add(shop);
      z = cz - w / 2 + 0.05; // slight overlap — no sky slits between buildings
      bi++;
    }
  }

  // billboard registry (declared early — the alley adds to it too)
  interface Board { m: THREE.Mesh }
  const boards: Board[] = [];

  // cross buildings closing both ends — the street is a place, not a plane
  for (const [ez, brick] of [[16.5, '#5c4436'], [-L - 4.5, '#6b4034']] as [number, string][]) {
    const facade = flat(facadeTex(brick, 4));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const facing = ez > 0
      ? [endM, endM, roofM, roofM, endM, facade]   // faces -z (toward street)
      : [endM, endM, roofM, roofM, facade, endM];  // faces +z
    const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 13.6, 6), facing);
    wall.position.set(0, 6.8, ez);
    scene.add(wall);
  }

  // ── the alley: a dark cut in the left wall with a dumpster ──────────────
  {
    const alleyFloorT = pixTex(64, 64, (g) => {
      g.fillStyle = '#2e3034'; g.fillRect(0, 0, 64, 64);
      dither(g, 64, 64, 700);
      // stains + a drain
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(20, 40, 12, 6, 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(46, 14, 8, 5, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#17181c'; g.fillRect(30, 28, 8, 8);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(30, 31, 8, 1); g.fillRect(30, 34, 8, 1);
    });
    const floorA = new THREE.Mesh(new THREE.PlaneGeometry(6.6, AZ0 - AZ1), new THREE.MeshBasicMaterial({ map: alleyFloorT }));
    floorA.rotation.x = -Math.PI / 2;
    floorA.position.set(-FACE - 3.3, 0.005, (AZ0 + AZ1) / 2);
    scene.add(floorA);
    // bare-brick end wall (no shop, one grimy window)
    const bareBrickT = pixTex(64, 96, (g) => {
      g.fillStyle = '#5a3a30'; g.fillRect(0, 0, 64, 96);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < 96; y += 5) g.fillRect(0, y, 64, 1);
      for (let y = 0; y < 96; y += 10) for (let x = (y % 20) ? 0 : 4; x < 64; x += 9) g.fillRect(x, y, 1, 5);
      g.fillStyle = '#1a1c22'; g.fillRect(24, 22, 16, 18);
      g.fillStyle = '#3a4450'; g.fillRect(26, 24, 12, 14);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 4; k++) g.fillRect(Math.floor(Math.random() * 60), 0, 2, Math.floor(96 * Math.random()));
      dither(g, 64, 96, 400);
    });
    const endWallM = new THREE.MeshBasicMaterial({ color: 0x3d2a24 });
    const alleyEnd = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 12.8, 7),
      [new THREE.MeshBasicMaterial({ map: bareBrickT }), endWallM, endWallM, endWallM, endWallM, endWallM],
    );
    alleyEnd.position.set(-FACE - 6.9, 6.4, (AZ0 + AZ1) / 2);
    scene.add(alleyEnd);
    // the alley's long sides — plain brick, no gaps back to the sky
    const alleySideT = pixTex(64, 64, (g) => {
      g.fillStyle = '#54382e'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < 64; y += 5) g.fillRect(0, y, 64, 1);
      for (let y = 0; y < 64; y += 10) for (let x = (y % 20) ? 0 : 4; x < 64; x += 9) g.fillRect(x, y, 1, 5);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, 64, 2);
    });
    alleySideT.wrapS = alleySideT.wrapT = THREE.RepeatWrapping;
    alleySideT.repeat.set(3, 6);
    const alleySideM = new THREE.MeshBasicMaterial({ map: alleySideT, side: THREE.DoubleSide });
    for (const [az, ry] of [[AZ0 - 0.02, Math.PI], [AZ1 + 0.02, 0]] as [number, number][]) {
      const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 12.8), alleySideM);
      sideWall.position.set(-FACE - 3.5, 6.4, az);
      sideWall.rotation.y = ry;
      scene.add(sideWall);
    }
    // the dumpster: ribbed tub with fork pockets, stencil on the long faces
    // only, lid hinged on the wall side and propped open onto the wall
    const dumpFrontT = pixTex(96, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 96, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 96, 3);            // top lip
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 6; x < 96; x += 12) g.fillRect(x, 3, 2, 41);                   // ribs
      g.fillStyle = '#14161a'; g.fillRect(8, 38, 24, 7); g.fillRect(64, 38, 24, 7); // fork pockets
      g.fillStyle = 'rgba(122,66,40,0.55)';
      g.fillRect(38, 36, 16, 10); g.fillRect(82, 16, 12, 14);                     // rust
      g.fillStyle = '#c9c4b0'; g.font = 'bold 9px monospace';
      g.textAlign = 'center'; g.fillText('CITY WASTE', 48, 20);
      dither(g, 96, 48, 160);
    });
    const dumpSideT = pixTex(48, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 48, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 48, 3);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 5; x < 48; x += 12) g.fillRect(x, 3, 2, 41);
      g.fillStyle = 'rgba(122,66,40,0.5)'; g.fillRect(10, 34, 14, 12);
      dither(g, 48, 48, 90);
    });
    const dumpFrontM = new THREE.MeshBasicMaterial({ map: dumpFrontT });
    const dumpSideM = new THREE.MeshBasicMaterial({ map: dumpSideT });
    const dumpInsideM = new THREE.MeshBasicMaterial({ color: 0x101114 });
    const dump = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.05),
      [dumpSideM, dumpSideM, dumpInsideM, dumpInsideM, dumpFrontM, dumpFrontM],
    );
    dump.position.set(-11.2, 0.69, AZ0 - 1.15);
    scene.add(dump);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.06, 1.12), new THREE.MeshBasicMaterial({ color: 0x24482f }));
    lid.geometry.translate(0, 0.03, -0.56); // pivot runs along its hinge edge
    lid.position.set(-11.2, 1.24, AZ0 - 0.625);
    lid.rotation.x = 0.5;
    scene.add(lid);
    for (const [wx, wz] of [[-12.15, AZ0 - 0.78], [-10.25, AZ0 - 0.78], [-12.15, AZ0 - 1.52], [-10.25, AZ0 - 1.52]]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), new THREE.MeshBasicMaterial({ color: 0x0e0f12 }));
      wheel.position.set(wx, 0.09, wz);
      scene.add(wheel);
    }
    // trash bags: faceted low-poly lumps, vertex-lit from above so the
    // facets read even in flat shading
    function trashBag(r: number, tone: number): THREE.Mesh {
      const geo = new THREE.IcosahedronGeometry(r, 0).toNonIndexed();
      const pos = geo.getAttribute('position');
      const col: number[] = [];
      for (let f = 0; f < pos.count / 3; f++) {
        const avgY = (pos.getY(f * 3) + pos.getY(f * 3 + 1) + pos.getY(f * 3 + 2)) / (3 * r);
        const b = tone + avgY * 0.05 + ((f * 37) % 5) * 0.012;
        for (let v = 0; v < 3; v++) col.push(b, b * 1.06, b * 1.28);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const bag = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
      bag.scale.y = 0.66;
      return bag;
    }
    const bagSpots: [number, number, number, number, number][] = [
      [-9.45, AZ0 - 1.25, 0.34, 0.11, 0.7],
      [-8.85, AZ0 - 1.0, 0.27, 0.09, 2.1],
      [-9.15, AZ0 - 0.62, 0.22, 0.13, 4.0],
    ];
    for (const [bx, bz, r, tone, yaw] of bagSpots) {
      const bag = trashBag(r, tone);
      bag.position.set(bx, r * 0.55, bz);
      bag.rotation.y = yaw;
      scene.add(bag);
    }
    // knot on the biggest bag, and one more bag heaped over the dumpster rim
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), new THREE.MeshBasicMaterial({ color: 0x2e3038 }));
    knot.position.set(-9.45, 0.44, AZ0 - 1.25);
    scene.add(knot);
    const rimBag = trashBag(0.3, 0.12);
    rimBag.position.set(-10.55, 1.18, AZ0 - 1.15);
    scene.add(rimBag);
    const cardboard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), new THREE.MeshBasicMaterial({ color: 0x8a7248 }));
    cardboard.position.set(-12.9, 0.6, AZ1 + 1.4);
    cardboard.rotation.x = 0.18;
    scene.add(cardboard);
  }

  // ── THE SEVILLE — the player's walk-up ──────────────────────────────────
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
      g.fillStyle = '#a89a80'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = 6; x < 64; x += 8) g.fillRect(x, 0, 1, 64);
      dither(g, 64, 64, 90);
      g.fillStyle = '#4a3a2c'; g.fillRect(0, 58, 64, 6);
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 58, 64, 1);
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
      g.fillStyle = '#8f8a80'; g.fillRect(0, 0, 32, 32);
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
      { minX: AX(1.16), maxX: AX(1.24), minZ: AZI(8.4), maxZ: AZI(11.8) }, // centre banister
      stairCap, underStairA, underStairB, aptDoorCap,
    );
    // floors, ceilings
    for (let f = 0; f < 4; f++) {
      floorMesh(f * ST + 0.006, 2.4, 8.4, AX(1.2), AZI(4.2));
      if (f < 3) floorMesh(f * ST + 2.55, 2.4, 8.4, AX(1.2), AZI(4.2), ceilT);
    }
    floorMesh(H, 2.4, 13.2, AX(1.2), AZI(6.6), ceilT);
    // the switchback: 8 treads up, half landing, 8 treads back
    const treadM = new THREE.MeshBasicMaterial({ color: 0x6a5038 });
    const railM = new THREE.MeshBasicMaterial({ color: 0x3a2c20 });
    for (let f = 0; f < 3; f++) {
      for (let i = 0; i < 8; i++) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.45), treadM);
        a.position.set(AX(0.6), f * ST + (i + 0.5) * (1.35 / 8), AZI(8.4 + (i + 0.5) * (3.4 / 8)));
        scene.add(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.45), treadM);
        b.position.set(AX(1.8), f * ST + 1.35 + (i + 0.5) * (1.35 / 8), AZI(11.8 - (i + 0.5) * (3.4 / 8)));
        scene.add(b);
      }
      const land = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 1.4), treadM);
      land.position.set(AX(1.2), f * ST + 1.35 - 0.07, AZI(12.5));
      scene.add(land);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 3.4), railM);
      rail.position.set(AX(1.2), f * ST + 1.1, AZI(10.1));
      rail.rotation.x = -0.38; // follows the flights, roughly
      scene.add(rail);
    }
    // lobby: dead space boxed in under the stairs
    const underM = new THREE.MeshBasicMaterial({ color: 0x1a1b21 });
    const uA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 4.8), underM);
    uA.position.set(AX(1.8), 0.65, AZI(10.8));
    scene.add(uA);
    const uB = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 1.4), underM);
    uB.position.set(AX(0.6), 0.65, AZI(12.5));
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
      g.fillStyle = '#d8d4c8'; g.fillRect(10, 6, 12, 7);
      g.fillStyle = '#26221c'; g.font = 'bold 6px monospace'; g.textAlign = 'center';
      g.fillText(num, 16, 12);
      dither(g, 32, 64, 40);
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
    // street side: the building's door, stoop and nameplate on the west wall
    const recessS = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.3), new THREE.MeshBasicMaterial({ color: 0x14151a }));
    recessS.position.set(-FACE + 0.02, sidewalkY + 1.15, -31);
    recessS.rotation.y = Math.PI / 2;
    scene.add(recessS);
    const streetDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.15), texM(frontDoorT));
    streetDoor.position.set(-FACE + 0.04, sidewalkY + 1.075, -31);
    streetDoor.rotation.y = Math.PI / 2;
    scene.add(streetDoor);
    const sevSignT = pixTex(64, 16, (g) => {
      g.fillStyle = '#1c2c1e'; g.fillRect(0, 0, 64, 16);
      g.fillStyle = '#d8cfa0'; g.font = 'bold 8px monospace'; g.textAlign = 'center';
      g.fillText('THE SEVILLE', 32, 11);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 64, 1);
    });
    const sevSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), texM(sevSignT));
    sevSign.position.set(-FACE + 0.03, sidewalkY + 2.62, -31);
    sevSign.rotation.y = Math.PI / 2;
    scene.add(sevSign);
    const stoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 1.5), new THREE.MeshBasicMaterial({ color: 0x97928a }));
    stoop.position.set(-FACE + 0.275, sidewalkY + 0.075, -31);
    scene.add(stoop);
  }
  // multi-floor ground: pick the floor candidate nearest the last height —
  // that one closure is what makes stacked floors work with a 2D walker
  const aptGround = (wx: number, wz: number): number => {
    const lx = wx - APT_X, lz = wz - APT_Z;
    let rel = 0;
    if (lx >= 0 && lz > 8.4) {
      if (lz > 11.8) rel = 1.35;
      else {
        const t = (lz - 8.4) / 3.4;
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
  let doorCd = 0;
  let hermitForce = -1;
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
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    watchWrap.style.cssText = 'position:fixed;left:50%;bottom:-10px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(140%) rotate(-5deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = 120; watchCv.height = 72;
    watchCv.style.cssText = 'width:330px;height:198px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
  }
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

  // trees on the sidewalks — one crown size, only the trunks vary, each in a
  // square dirt pit cut into the walk
  const TREE_PX = 0.05; // world units per texel — fixed, so taller never means bigger
  const pitT = treePitTex();
  const pitGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const pitMat = new THREE.MeshBasicMaterial({ map: pitT });
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * (ROAD_HALF + 0.9);
    const H = 92 + Math.floor(rnd() * 36);    // 4.6 – 6.4 tall via trunk length alone
    const tree = board(treeSprite(Math.abs(Math.round(z / 14)) % 2, H), 64 * TREE_PX, H * TREE_PX, tx, z);
    tree.position.y = sidewalkY;
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(tx, sidewalkY + 0.006, z);
    scene.add(pit);
    propColliders.push({ minX: tx - 0.3, maxX: tx + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  }
  // hydrant on the right sidewalk
  const hyX = ROAD_HALF + 0.8, hyZ = -6;
  const hyd = board(hydrantSprite(), 0.8, 1.2, hyX, hyZ);
  hyd.position.y = sidewalkY;
  propColliders.push({ minX: hyX - 0.35, maxX: hyX + 0.35, minZ: hyZ - 0.35, maxZ: hyZ + 0.35 });
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
    pigeons.push({ m: b, x, z, y: 0, vx: 0, vy: 0, vz: 0, state: 'peck', bold: rnd() < 0.3, t: 0, ph: i * 2.4 });
  }

  // payphone against the left wall
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.9), flat(payphoneTex()));
  phone.position.set(-(FACE - 0.55), sidewalkY + 1.15, -11);
  scene.add(phone);
  propColliders.push({ minX: -(FACE - 0.05), maxX: -(FACE - 1.05), minZ: -11.55, maxZ: -10.45 });

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
    carColliders.push({ minX: x - 1.05, maxX: x + 1.05, minZ: z - carHalf[kind], maxZ: z + carHalf[kind] });
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
  interface Citizen { mesh: THREE.Mesh; tex: THREE.Texture; lane: number; z: number; dir: number; sp: number; ph: number }
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
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 0.6 + (i % 3) * 0.5);
    const z = 2 - i * 23; // spread thin over the whole block
    mesh.position.set(lane, sidewalkY, z);
    scene.add(mesh);
    citizens.push({ mesh, tex, lane, z, dir: i % 2 ? 1 : -1, sp: 0.85 + (i % 4) * 0.3, ph: i * 1.3 });
  });

  const colliders: AABB[] = [
    { minX: FACE - 0.3, maxX: FACE + 8, minZ: -L - 10, maxZ: 20 },          // right wall
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: -L - 10, maxZ: AZ1 },       // left wall south of alley
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: AZ0, maxZ: 20 },            // left wall north of alley
    { minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 }, // alley end wall
    { minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 },        // dumpster
    ...propColliders,
    ...carColliders,
    ...sevColliders,
    cruiserBox,
  ];
  const rig = new FPRig(cam, { x: -1.4, z: 9, yaw: 0 }, {
    bounds: { minX: -FACE - 6.4, maxX: AX(2.4), minZ: -L - 0.5, maxZ: 13 },
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    groundY: (x, z) => {
      if (x > 100) return aptGround(x, z);
      lastGy = Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0;
      return lastGy;
    },
  });

  // debug/tour hook
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
      (scene.background as THREE.Color).copy(skyAt(hourF));
      scene.fog!.color.copy(skyNow);
      nightDiv!.style.opacity = String(nightAt(hourF));
      // the hermit keeps his own hours — mostly afternoons
      hermit.visible = hermitForce === -1 ? hermitIn(Math.floor(totalMin / 60)) : hermitForce === 1;
      // look down: your watch
      const wantWatch = rig.pitch < -0.95;
      watchWrap!.style.transform = wantWatch
        ? 'translateX(-50%) translateY(0) rotate(-5deg)'
        : 'translateX(-50%) translateY(140%) rotate(-5deg)';
      const mins = Math.floor(clockMin);
      if (wantWatch && mins !== watchShown) { drawWatch(mins); watchShown = mins; }

      // floor-aware stair guards (2D colliders, so they follow the floor)
      setCap(stairCap, lastGy > 3 * ST - 0.12, AX(0), AX(1.2), AZI(8.4), AZI(13.2));
      const onLobby = px > 100 && lastGy < 0.6;
      setCap(underStairA, onLobby, AX(1.2), AX(2.4), AZI(8.4), AZI(13.2));
      setCap(underStairB, onLobby, AX(0), AX(1.2), AZI(11.8), AZI(13.2));
      setCap(aptDoorCap, Math.abs(lastGy - 2 * ST) > 0.4, AX(-0.15), AX(0.05), AZI(3.1), AZI(3.9));

      // the building doors swap you between the street and the lobby
      doorCd = Math.max(0, doorCd - dt);
      if (doorCd === 0) {
        if (px < 100 && Math.abs(px - (-FACE + 0.45)) < 0.75 && Math.abs(pz + 31) < 0.8) {
          rig.pos.set(AX(1.2), rig.pos.y, AZI(1.3));
          rig.yaw = Math.PI; lastGy = 0; doorCd = 1;
        } else if (px > 100 && lastGy < 0.5 && Math.abs(px - AX(1.2)) < 0.7 && pz < AZI(0.75)) {
          rig.pos.set(-FACE + 1.1, rig.pos.y, -31);
          rig.yaw = Math.PI / 2; lastGy = KERB_H; doorCd = 1;
        }
      }

      // billboards face the player
      for (const b of boards) {
        b.m.rotation.y = Math.atan2(px - b.m.position.x, pz - b.m.position.z);
      }
      // citizens: ping-pong the block, show the correct painted angle
      for (const c of citizens) {
        c.z += c.dir * c.sp * dt;
        if (c.z < -L + 4) { c.z = -L + 4; c.dir = 1; }
        if (c.z > 10) { c.z = 10; c.dir = -1; }
        c.mesh.position.set(c.lane, sidewalkY, c.z);
        c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
        const facing = Math.atan2(0, c.dir); // 0 for +z, π for -z... atan2(0,-1)=π ✓
        const camAng = Math.atan2(px - c.lane, pz - c.z);
        const [col, mirror] = viewFor(camAng - facing);
        const row = Math.floor(t * 5 * c.sp + c.ph) % 2;
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
      // pigeons: peck the kerb, spook when approached (unless bold)
      for (const pg of pigeons) {
        if (pg.state === 'peck') {
          const d = Math.hypot(px - pg.x, pz - pg.z);
          if (d < (pg.bold ? 0.7 : 2.4)) {
            pg.state = 'fly'; pg.t = 0;
            const a = Math.atan2(pg.x - px, pg.z - pz) + (rnd() - 0.5) * 0.8;
            pg.vx = Math.sin(a) * 3.2; pg.vz = Math.cos(a) * 3.2; pg.vy = 2.6;
          }
          pg.m.position.set(pg.x, sidewalkY + Math.max(0, Math.sin(t * 6 + pg.ph)) * 0.06, pg.z);
        } else {
          pg.t += dt;
          pg.x += pg.vx * dt; pg.z += pg.vz * dt;
          pg.vy = Math.min(pg.vy + dt * 1.5, 3.4);
          pg.y += pg.vy * dt;
          if (Math.abs(pg.x) > FACE - 0.6) { pg.x = Math.sign(pg.x) * (FACE - 0.6); pg.vx = 0; } // climb the wall, don't pass it
          pg.m.position.set(pg.x, sidewalkY + pg.y + Math.sin(t * 24) * 0.05, pg.z);
          if (pg.t > 4) {
            // settle somewhere new down the block, away from the player
            pg.state = 'peck'; pg.y = 0; pg.bold = rnd() < 0.3;
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

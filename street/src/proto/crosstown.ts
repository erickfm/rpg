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

// facades are ~8 px/m wide so brick size and window rhythm stay constant
// no matter how wide the building is
function facadeTex(brick: string, floors: number, wMeters = 12): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8)), H = 32 + floors * 28;
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
    const cols = Math.max(2, Math.floor((W - 10) / 22));
    for (let f = 0; f < floors; f++) {
      const y = 14 + f * 28;
      for (let c = 0; c < cols; c++) {
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

function shopfrontTex(brick: string, name: string, awning: string, wMeters = 12): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8));
  return pixTex(W, 40, (g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, 40);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < 40; y += 5) g.fillRect(0, y, W, 1);
    // sign band caps at ~12 m so wide buildings don't wear a mile of awning
    const bandW = Math.min(W - 8, 96), bandX = Math.round((W - bandW) / 2);
    g.fillStyle = awning;
    g.fillRect(bandX, 2, bandW, 10);
    g.fillStyle = '#f2ead0';
    g.font = 'bold 8px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, W / 2, 7);
    g.fillStyle = '#141820';
    g.fillRect(6, 14, W - 12, 24);
    g.fillStyle = '#3a3020';
    g.fillRect(8, 16, W - 16, 20);
    g.fillStyle = '#c9a45e';
    g.fillRect(10, 22, Math.round(W * 0.31), 12);
    g.fillStyle = '#5a6a7a';
    g.fillRect(Math.round(W * 0.6), 16, 6, 20);
    g.fillStyle = '#2a3440';
    g.fillRect(Math.round(W * 0.48), 16, 3, 22);
    dither(g, W, 40, 260);
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

// faceted canopy blob — vertex-lit from above so the facets read even in
// flat shading (same trick as the alley trash bags)
function canopyBlob(r: number, base: THREE.Color, squash: number, seed: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, 0).toNonIndexed();
  const pos = geo.getAttribute('position');
  const col: number[] = [];
  for (let f = 0; f < pos.count / 3; f++) {
    const avgY = (pos.getY(f * 3) + pos.getY(f * 3 + 1) + pos.getY(f * 3 + 2)) / (3 * r);
    const v = 0.68 + avgY * 0.24 + (((f + seed) * 37) % 5) * 0.04;
    for (let k = 0; k < 3; k++) col.push(base.r * v, base.g * v, base.b * v);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  m.scale.y = squash;
  return m;
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

// residential ground floor — brick continues to the street, two barred
// windows, no shop band (the walk-up's own face)
function resGroundTex(brick: string, wMeters = 12): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8));
  return pixTex(W, 32, (g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, 32);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 32; y += 5) g.fillRect(0, y, W, 1);
    for (let y = 0; y < 32; y += 10) for (let x = (y % 20) ? 0 : 4; x < W; x += 9) g.fillRect(x, y, 1, 5);
    for (let wx = 14; wx < W - 24; wx += 30) {
      g.fillStyle = '#141820'; g.fillRect(wx, 8, 16, 14);
      g.fillStyle = '#3a4450'; g.fillRect(wx + 1, 9, 14, 12);
      g.fillStyle = '#1a1c22';
      for (let bx = wx + 2; bx < wx + 15; bx += 4) g.fillRect(bx, 9, 1, 12);
    }
    dither(g, W, 32, 80);
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
          // the hood is the same cloth as the sweater: same fill AND the same
          // highlight/shadow overlays, so the color reads identical
          if (view === 4) { // dead back: hood swallows the head
            g.fillRect(cx - 7, oy + 4, 14, 16);
            g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 7, oy + 4, 14, 16);
          } else if (view === 3) { // 3/4 back: hood covers everything, no face
            g.fillRect(cx - 7, oy + 4, 14, 16);
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - 7, oy + 4, 4, 16);
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 3, oy + 4, 4, 16);
          } else if (view === 2) { // profile: hood over the whole head, one sliver of face in the opening
            g.fillRect(cx - 7, oy + 4, 14, 16);
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - 7, oy + 4, 2, 16);
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 3, oy + 4, 4, 16);
            g.fillStyle = skin; g.fillRect(cx - 6, oy + 12, 4, 6);
          } else { // front views: rim frames the face, cowl at the neck
            g.fillRect(cx - 7, oy + 4, 14, 4);
            g.fillRect(cx - 7, oy + 6, 2, 14); g.fillRect(cx + 5, oy + 6, 2, 14);
            g.fillRect(cx - 7, oy + 18, 14, 2);
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - 7, oy + 4, 2, 16);
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 5, oy + 4, 2, 16);
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

  // ground: the main street, and a side street it turns into at the south
  // end (the corner). Same road width, same kerbs, fog owns the far end.
  const SIDE_Z0 = -98, SIDE_Z1 = -108;  // side-street road band
  const SIDE_X1 = 55;                   // side street runs east to here
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, L + 44), flat(asphaltTex()));
  road.rotation.x = -Math.PI / 2; road.position.z = -L / 2 + 14;
  scene.add(road);
  const sideRoad = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_X1 + 7, 10), flat(asphaltTex()));
  sideRoad.rotation.x = -Math.PI / 2;
  sideRoad.position.set((SIDE_X1 - 7) / 2, 0.008, (SIDE_Z0 + SIDE_Z1) / 2);
  scene.add(sideRoad);
  // raised sidewalks with a visible curb face
  const KERB_H = 0.14;
  const kerbFaceM = new THREE.MeshBasicMaterial({ color: 0x97928a });
  const walkTopM = flat(walkTex());
  const walkDarkM = new THREE.MeshBasicMaterial({ color: 0x6a675f });
  for (const s of [-1, 1]) {
    const mats = s > 0
      ? [walkDarkM, kerbFaceM, walkTopM, walkDarkM, walkDarkM, walkDarkM]  // -x face is the kerb
      : [kerbFaceM, walkDarkM, walkTopM, walkDarkM, walkDarkM, walkDarkM]; // +x face is the kerb
    const zBot = s > 0 ? SIDE_Z0 : SIDE_Z1 - 2; // west walk wraps the corner
    const len = 16.5 - zBot;
    const walk = new THREE.Mesh(new THREE.BoxGeometry(WALK, KERB_H + 0.04, len), mats);
    walk.position.set(s * (ROAD_HALF + WALK / 2), (KERB_H + 0.04) / 2 - 0.04, (16.5 + zBot) / 2);
    scene.add(walk);
  }
  // side-street walks: north (in front of the corner shops), south, east end
  {
    const north = new THREE.Mesh(new THREE.BoxGeometry(50, KERB_H + 0.04, 2),
      [walkDarkM, walkDarkM, walkTopM, walkDarkM, walkDarkM, kerbFaceM]);
    north.position.set(32, (KERB_H + 0.04) / 2 - 0.04, SIDE_Z0 + 1);
    scene.add(north);
    const south = new THREE.Mesh(new THREE.BoxGeometry(64, KERB_H + 0.04, 2),
      [walkDarkM, walkDarkM, walkTopM, walkDarkM, kerbFaceM, walkDarkM]);
    south.position.set(25, (KERB_H + 0.04) / 2 - 0.04, SIDE_Z1 - 1);
    scene.add(south);
    const east = new THREE.Mesh(new THREE.BoxGeometry(2, KERB_H + 0.04, 12),
      [walkDarkM, kerbFaceM, walkTopM, walkDarkM, walkDarkM, walkDarkM]);
    east.position.set(SIDE_X1 + 1, (KERB_H + 0.04) / 2 - 0.04, (SIDE_Z0 + SIDE_Z1) / 2 - 1);
    scene.add(east);
  }
  const sidewalkY = KERB_H; // prop base height on the walks
  const lineT = pixTex(8, 32, (g) => { g.fillStyle = '#b8a24e'; g.fillRect(2, 0, 4, 18); });
  lineT.wrapS = lineT.wrapT = THREE.RepeatWrapping;
  lineT.repeat.set(1, 40);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, L + 44), new THREE.MeshBasicMaterial({ map: lineT, alphaTest: 0.5 }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.03, -L / 2 + 14);
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
  interface BldSpec { nm: string; col: string; w: number; brick: string; floors: number; res?: boolean }
  const WEST: (BldSpec | 'alley')[] = [
    { nm: 'DINER', col: '#8a5a22', w: 12, brick: '#6b4034', floors: 4 },
    { nm: 'LAUNDRY', col: '#2c4a7a', w: 11, brick: '#7a4a3a', floors: 3 },
    { nm: 'PIZZA', col: '#2e6a34', w: 10.2, brick: '#5c4436', floors: 4 },
    { nm: 'PAWN', col: '#8a6a22', w: 18, brick: '#835444', floors: 5 },
    'alley',
    { nm: 'MUSIC', col: '#6a2c6a', w: 12.5, brick: '#6b4034', floors: 4 },
    { nm: 'BARBER', col: '#8a2c22', w: 12, brick: '#5c4436', floors: 4 },
    { nm: 'GROCERY', col: '#2e5a3c', w: 18, brick: '#835444', floors: 5 },
    { nm: 'HOTEL', col: '#6a4a2c', w: 12, brick: '#7a4a3a', floors: 5 },
  ];
  const EAST: BldSpec[] = [
    { nm: 'BOOKS', col: '#3a5a5a', w: 13, brick: '#5c4436', floors: 4 },
    { nm: 'HARDWARE', col: '#5a5a2c', w: 12.2, brick: '#6b4034', floors: 3 },
    { nm: 'CAFE', col: '#6a3a22', w: 11, brick: '#835444', floors: 4 },
    { nm: 'ARCADE', col: '#3a2c6a', w: 13, brick: '#7a4a3a', floors: 5 },
    { nm: '', col: '', w: 18, brick: '#835444', floors: 5, res: true }, // No. 227 — home, across from the alley, a bit off
    { nm: 'LIQUOR', col: '#8a2c42', w: 11, brick: '#5c4436', floors: 3 },
    { nm: 'DELI', col: '#2e6a5a', w: 10, brick: '#6b4034', floors: 3 },
    { nm: 'CINEMA', col: '#2c3c7a', w: 12, brick: '#7a4a3a', floors: 5 },
    { nm: 'BODEGA', col: '#b8342a', w: 10, brick: '#6b4034', floors: 3 }, // the corner store
  ];
  // the corner: shops lining the side street the main drag turns into
  const NORTH2: BldSpec[] = [
    { nm: 'FLOWERS', col: '#4a7a52', w: 12, brick: '#835444', floors: 3 },
    { nm: 'TAILOR', col: '#5a4a7a', w: 11, brick: '#5c4436', floors: 4 },
    { nm: 'CHOP SUEY', col: '#8a3a2e', w: 13, brick: '#6b4034', floors: 3 },
    { nm: 'OPTICIAN', col: '#2c5a6a', w: 12, brick: '#7a4a3a', floors: 4 },
  ];
  const SOUTH2: BldSpec[] = [
    { nm: 'GARAGE', col: '#5a5f66', w: 13, brick: '#5c4436', floors: 3 },
    { nm: 'THRIFT', col: '#7a5a2c', w: 12, brick: '#835444', floors: 4 },
    { nm: 'MISSION', col: '#6a5a4a', w: 14, brick: '#6b4034', floors: 3 },
    { nm: 'BILLIARDS', col: '#2c5a3a', w: 13, brick: '#7a4a3a', floors: 4 },
    { nm: 'SMOKES', col: '#8a6a22', w: 12, brick: '#5c4436', floors: 3 },
  ];
  const placeBld = (side: number, z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = side < 0
      ? [facade, endM, roofM, roofM, endM, endM]
      : [endM, facade, roofM, roofM, endM, endM];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, b.w + 0.05), mats);
    wall.position.set(side * (FACE + 1.7), h / 2 + 3.2, cz);
    scene.add(wall);
    const shopM = flat(b.res ? resGroundTex(b.brick, b.w) : shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = side < 0
      ? [shopM, endM, roofM, roofM, endM, endM]
      : [endM, shopM, roofM, roofM, endM, endM];
    const shop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, b.w + 0.05), shopMats);
    shop.position.set(side * (FACE + 1.7), 1.6, cz);
    scene.add(shop);
  };
  let zw = 14.2;
  for (const b of WEST) {
    if (b === 'alley') { zw = AZ1; continue; }
    placeBld(-1, zw, b);
    zw -= b.w;
  }
  let ze = 14.2;
  for (const b of EAST) { placeBld(1, ze, b); ze -= b.w; }
  // side-street rosters run along x; facade on the street-facing z side
  const placeBldZ = (x0: number, zc: number, b: BldSpec, facing: 1 | -1) => {
    const cx = x0 + b.w / 2;
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = facing > 0
      ? [endM, endM, roofM, roofM, facade, endM]
      : [endM, endM, roofM, roofM, endM, facade];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.05, h, 3.4), mats);
    wall.position.set(cx, h / 2 + 3.2, zc);
    scene.add(wall);
    const shopM = flat(shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = facing > 0
      ? [endM, endM, roofM, roofM, shopM, endM]
      : [endM, endM, roofM, roofM, endM, shopM];
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.05, 3.2, 3.4), shopMats);
    shop.position.set(cx, 1.6, zc);
    scene.add(shop);
  };
  let xn = 10.45; // east of the bodega — the corner belongs to it
  for (const b of NORTH2) { placeBldZ(xn, -94.3, b, -1); xn += b.w; }
  let xs = -7;
  for (const b of SOUTH2) { placeBldZ(xs, -111.7, b, 1); xs += b.w; }
  // the bodega wraps the corner: second shopfront on its side-street face,
  // striped awning, neon OPEN, fruit crates out front
  {
    const bodegaSouthM = flat(shopfrontTex('#6b4034', 'BODEGA', '#b8342a', 3.4));
    const southFront = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), bodegaSouthM);
    southFront.position.set(FACE + 1.7, 1.6, -96.1);
    southFront.rotation.y = Math.PI;
    scene.add(southFront);
    // brick + windows continue on the side-street face above the shop
    const southUp = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 10.6), flat(facadeTex('#6b4034', 3, 3.4)));
    southUp.position.set(FACE + 1.7, 3.2 + 5.3, -96.1);
    southUp.rotation.y = Math.PI;
    scene.add(southUp);
    const awnT = pixTex(48, 12, (g) => {
      for (let x = 0; x < 48; x += 8) {
        g.fillStyle = (x / 8) % 2 ? '#b8342a' : '#d8d0c0';
        g.fillRect(x, 0, 8, 12);
      }
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 9, 48, 3);
    });
    const awnM = new THREE.MeshBasicMaterial({ map: awnT, side: THREE.DoubleSide });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.9), awnM);
    awn.position.set(FACE + 1.7, 2.62, -96.45);
    awn.rotation.x = 0.18;
    scene.add(awn);
    const openT = pixTex(24, 12, (g) => {
      g.fillStyle = '#141416'; g.fillRect(0, 0, 24, 12);
      g.fillStyle = '#e8574a'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
      g.fillText('OPEN', 12, 9);
    });
    const open = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), flat(openT));
    open.position.set(FACE + 0.6, 2.0, -96.14);
    open.rotation.y = Math.PI;
    scene.add(open);
    const crateT = pixTex(24, 16, (g) => {
      g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 5, 24, 1); g.fillRect(0, 11, 24, 1);
    });
    const fruitTop = (c1: string, c2: string) => pixTex(24, 24, (g) => {
      g.fillStyle = '#6a4a26'; g.fillRect(0, 0, 24, 24);
      for (let i = 0; i < 24; i++) {
        g.fillStyle = i % 2 ? c1 : c2;
        g.beginPath(); g.arc(3 + (i % 6) * 4, 4 + Math.floor(i / 6) * 5, 2, 0, Math.PI * 2); g.fill();
      }
    });
    const crateM = flat(crateT);
    for (const [cxx, czz, top] of [
      [7.9, -96.6, fruitTop('#d88a2a', '#c9762a')],
      [9.3, -96.55, fruitTop('#8a3a2e', '#a84a36')],
    ] as [number, number, THREE.Texture][]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.55), [crateM, crateM, flat(top), crateM, crateM, crateM]);
      crate.position.set(cxx, sidewalkY + 0.2, czz);
      scene.add(crate);
    }
  }
  // south-west corner building closes the side street's west end
  placeBld(-1, -98, { nm: 'RADIO', col: '#3a4a7a', w: 12, brick: '#835444', floors: 4 });
  // east cross building — the side street disappears into the fog toward it
  {
    const eEnd = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const eRoof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const eWall = new THREE.Mesh(
      new THREE.BoxGeometry(6, 13.6, 24),
      [eEnd, flat(facadeTex('#5c4436', 4, 22)), eRoof, eRoof, eEnd, eEnd],
    );
    eWall.position.set(SIDE_X1 + 5, 6.8, (SIDE_Z0 + SIDE_Z1) / 2);
    scene.add(eWall);
  }

  // billboard registry (declared early — the alley adds to it too)
  interface Board { m: THREE.Mesh }
  const boards: Board[] = [];

  // cross building closing the north end; the south end turns the corner now
  {
    const facade = flat(facadeTex('#5c4436', 4, 30));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 13.6, 6), [endM, endM, roofM, roofM, endM, facade]);
    wall.position.set(0, 6.8, 16.5);
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
    // bare-brick end wall (no shop, one grimy window) — same brick course
    // density as the street facades (~11.7 px/m, 5 px courses)
    const bareBrickT = pixTex(80, 150, (g) => {
      g.fillStyle = '#5a3a30'; g.fillRect(0, 0, 80, 150);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < 150; y += 5) g.fillRect(0, y, 80, 1);
      for (let y = 0; y < 150; y += 10) for (let x = (y % 20) ? 0 : 4; x < 80; x += 9) g.fillRect(x, y, 1, 5);
      g.fillStyle = '#1a1c22'; g.fillRect(30, 35, 20, 28);
      g.fillStyle = '#3a4450'; g.fillRect(32, 37, 16, 24);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 4; k++) g.fillRect(Math.floor(Math.random() * 76), 0, 2, Math.floor(150 * Math.random()));
      dither(g, 80, 150, 700);
    });
    const endWallM = new THREE.MeshBasicMaterial({ color: 0x3d2a24 });
    const alleyEnd = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 12.8, 7),
      [new THREE.MeshBasicMaterial({ map: bareBrickT }), endWallM, endWallM, endWallM, endWallM, endWallM],
    );
    alleyEnd.position.set(-FACE - 6.9, 6.4, (AZ0 + AZ1) / 2);
    scene.add(alleyEnd);
    // the alley's long sides — plain brick. The tile is exactly 7 bricks ×
    // 12 courses so it wraps with no seam, and no baked edge highlights.
    const alleySideT = pixTex(63, 60, (g) => {
      g.fillStyle = '#54382e'; g.fillRect(0, 0, 63, 60);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < 60; y += 5) g.fillRect(0, y, 63, 1);
      for (let y = 0; y < 60; y += 10) for (let x = (y % 20) ? 0 : 4; x < 63; x += 9) g.fillRect(x, y, 1, 5);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 26; i++) g.fillRect(((i * 23) % 61), ((i * 13) % 57), 2, 1); // worn faces
    });
    alleySideT.wrapS = alleySideT.wrapT = THREE.RepeatWrapping;
    alleySideT.repeat.set(1.3, 2.36); // ≈ facade brick course size
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
    // trash bags: chunky low-segment lumps wearing a PAINTED plastic
    // texture — dithered wrinkle sheens, dark base — same brush as the
    // rest of the world
    const bagT = pixTex(48, 32, (g) => {
      g.fillStyle = '#1e2026'; g.fillRect(0, 0, 48, 32);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (let i = 0; i < 7; i++) {
        g.fillRect((i * 11) % 30, 3 + i * 4 + (i % 3), 14 + ((i * 5) % 12), 1); // wrinkles
      }
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(6, 1, 22, 2); // sky sheen up top
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 26, 48, 6);      // sitting shadow
      dither(g, 48, 32, 70);
    });
    const bagM = new THREE.MeshBasicMaterial({ map: bagT });
    function trashBag(r: number): THREE.Mesh {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 4), bagM);
      bag.scale.y = 0.62;
      return bag;
    }
    const bagSpots: [number, number, number, number][] = [
      [-9.45, AZ0 - 1.25, 0.34, 0.7],
      [-8.85, AZ0 - 1.0, 0.27, 2.1],
      [-9.15, AZ0 - 0.62, 0.22, 4.0],
    ];
    for (const [bx, bz, r, yaw] of bagSpots) {
      const bag = trashBag(r);
      bag.position.set(bx, r * 0.55, bz);
      bag.rotation.y = yaw;
      scene.add(bag);
    }
    // knot on the biggest bag, and one more bag heaped over the dumpster rim
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), new THREE.MeshBasicMaterial({ color: 0x2e3038 }));
    knot.position.set(-9.45, 0.44, AZ0 - 1.25);
    scene.add(knot);
    const rimBag = trashBag(0.3);
    rimBag.position.set(-10.55, 1.18, AZ0 - 1.15);
    scene.add(rimBag);
    // the saddest cat on the block, in a cardboard box
    const cardM = new THREE.MeshBasicMaterial({ color: 0xa8845a });
    const cardDark = new THREE.MeshBasicMaterial({ color: 0x8a6a44 });
    const catBox = new THREE.Group();
    const bfloor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.55), cardDark);
    bfloor.position.y = 0.02;
    catBox.add(bfloor);
    for (const [wx2, wz2, ww, wd] of [[0, -0.26, 0.55, 0.04], [0, 0.26, 0.55, 0.04], [-0.26, 0, 0.04, 0.55], [0.26, 0, 0.04, 0.55]] as [number, number, number, number][]) {
      const wallB = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.3, wd), cardM);
      wallB.position.set(wx2, 0.17, wz2);
      catBox.add(wallB);
    }
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.28), cardM);
    flap.position.set(0, 0.33, -0.38);
    flap.rotation.x = -0.5; // one flap hangs open
    catBox.add(flap);
    catBox.position.set(-10.5, 0, AZ1 + 0.75);
    catBox.rotation.y = 0.4;
    scene.add(catBox);
    const catT = pixTex(24, 24, (g) => {
      g.fillStyle = '#7a7e86';
      g.fillRect(7, 10, 10, 10);                     // hunched body
      g.fillRect(8, 4, 8, 8);                        // head
      g.fillStyle = '#6a6e76';
      g.fillRect(7, 3, 3, 3); g.fillRect(14, 3, 3, 3); // ears, drooped
      g.fillStyle = '#141416';
      g.fillRect(9, 8, 2, 3); g.fillRect(13, 8, 2, 3); // big sad eyes
      g.fillStyle = '#4a4e56'; g.fillRect(11, 11, 2, 1); // little nose
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(8, 12, 8, 1); // downturned mouth
      g.fillStyle = '#6a6e76'; g.fillRect(6, 18, 12, 2); // tail curled round
    });
    const cat = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: catT, alphaTest: 0.5, side: THREE.DoubleSide }));
    cat.geometry.translate(0, 0.17, 0);
    cat.position.set(-10.5, 0.05, AZ1 + 0.75);
    boards.push({ m: cat });
    scene.add(cat);
    // plywood sheet leaning back against the south wall, feet kicked out
    const cardboard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), new THREE.MeshBasicMaterial({ color: 0x8a7248 }));
    cardboard.position.set(-12.9, 0.6, AZ1 + 0.26);
    cardboard.rotation.x = -0.35;
    scene.add(cardboard);
    // graffiti — sprayed at the same chunky texel size as the shop signs:
    // tiny canvas, pixel-doubled outline, a couple of drips
    const tagTex = (word: string, ink: string, outline: string) => pixTex(40, 14, (g) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 9px monospace';
      g.fillStyle = outline;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
        g.fillText(word, 20 + ox, 7 + oy);
      }
      g.fillStyle = ink;
      g.fillText(word, 20, 7);
      g.fillRect(12, 10, 1, 3); g.fillRect(27, 11, 1, 2); // drips
    });
    const tag = (t: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    tag(tagTex('REZO', '#a8485e', '#d8d4c8'), 1.9, 0.66, -9.6, 1.5, AZ0 - 0.05, Math.PI);
    tag(tagTex('SNAK', '#4a8a7e', '#16181c'), 1.6, 0.56, -11.6, 1.1, AZ1 + 0.05, 0);
    tag(tagTex('KOBRA', '#d8d4c8', '#7a3026'), 1.5, 0.52, -FACE - 6.27, 1.7, AZ0 - 2.3, Math.PI / 2);
  }

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
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 2.7), railM);
      rail.position.set(AX(1.2), f * ST + 1.15, AZI(9.7));
      rail.rotation.x = -0.48; // follows the steeper flights
      scene.add(rail);
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
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    watchWrap.style.cssText = 'position:fixed;left:52%;bottom:-14px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(140%) rotate(-6deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = 120; watchCv.height = 170;
    watchCv.style.cssText = 'width:312px;height:442px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = 120; watchCv.height = 170;
  }
  // the whole left arm comes up: curled hand, wrist with the watch, forearm
  // into a jacket cuff at the bottom of the screen
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    g.clearRect(0, 0, 120, 170);
    const skin = '#c9946a';
    g.fillStyle = skin;                                     // forearm
    g.beginPath();
    g.moveTo(24, 170); g.lineTo(30, 96); g.lineTo(90, 96); g.lineTo(96, 170);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(28, 96, 8, 74);
    g.fillStyle = '#3a4a63'; g.fillRect(18, 148, 84, 22);   // jacket cuff
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(18, 148, 84, 4);
    g.fillStyle = skin; g.fillRect(30, 60, 60, 38);         // wrist
    g.beginPath(); g.ellipse(60, 38, 33, 25, 0, 0, Math.PI * 2); g.fill(); // curled hand
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 4; i++) g.fillRect(36 + i * 14, 20, 2, 11); // knuckles
    g.fillStyle = skin;
    g.beginPath(); g.ellipse(29, 48, 10, 14, 0.5, 0, Math.PI * 2); g.fill(); // thumb
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(30, 60, 8, 38);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(84, 60, 6, 38);
    g.fillStyle = '#26282e'; g.fillRect(28, 62, 64, 34);    // strap
    g.fillStyle = '#3a3d45'; g.fillRect(32, 60, 56, 38);    // case
    g.fillStyle = '#14161a'; g.fillRect(35, 63, 50, 32);
    g.fillStyle = '#9cab8b'; g.fillRect(38, 67, 44, 21);    // LCD
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m2 = String(mins % 60).padStart(2, '0');
    g.fillStyle = '#1c2a1c'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillText(`${hh}:${m2}`, 60, 82);
    g.fillStyle = '#8a8d95'; g.font = '5px monospace';
    g.fillText('CROSSTOWN QUARTZ', 60, 93);
  };
  let walletWrap = document.getElementById('ct-wallet') as HTMLDivElement | null;
  let walletCv: HTMLCanvasElement;
  if (!walletWrap) {
    walletWrap = document.createElement('div');
    walletWrap.id = 'ct-wallet';
    walletWrap.style.cssText = 'position:fixed;left:16px;bottom:-6px;z-index:11;pointer-events:none;transform:translateY(130%) rotate(3deg);transition:transform .18s ease-out;';
    walletCv = document.createElement('canvas');
    walletCv.width = 150; walletCv.height = 110;
    walletCv.style.cssText = 'width:300px;height:220px;image-rendering:pixelated;display:block;';
    walletWrap.appendChild(walletCv);
    document.body.appendChild(walletWrap);
  } else {
    walletCv = walletWrap.firstChild as HTMLCanvasElement;
  }
  const drawWallet = () => {
    const g = walletCv.getContext('2d')!;
    g.clearRect(0, 0, 150, 110);
    g.fillStyle = '#6a8a5a'; g.fillRect(16, 8, 70, 14);      // bills peeking out
    g.fillStyle = '#587a4a'; g.fillRect(22, 4, 58, 12);
    g.fillStyle = '#4a3626'; g.fillRect(4, 18, 142, 88);     // leather bifold
    g.fillStyle = '#3a2a1c'; g.fillRect(4, 18, 142, 8);
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.setLineDash([3, 3]);
    g.strokeRect(8.5, 22.5, 133, 79); g.setLineDash([]);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 15px monospace'; g.textAlign = 'center';
    g.fillText(`$${cash.toFixed(2)}`, 75, 50);
    g.font = '9px monospace'; g.fillStyle = '#c9c4b0';
    let iy = 70;
    for (const [k, n] of Object.entries(inv)) {
      if (n > 0) { g.fillText(`${k} ×${n}`, 75, iy); iy += 12; }
    }
    if (iy === 70) g.fillText('(empty pockets)', 75, iy);
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
  const bodegaColliders: AABB[] = [];
  {
    const texM2 = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    const linoT = pixTex(32, 32, (g) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#8a8578' : '#b0a996';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
      dither(g, 32, 32, 50);
    });
    linoT.wrapS = linoT.wrapT = THREE.RepeatWrapping;
    linoT.repeat.set(6, 6);
    const bfloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), texM2(linoT));
    bfloor.rotation.x = -Math.PI / 2;
    bfloor.position.set(244, 0.005, -15);
    scene.add(bfloor);
    const plasterT = pixTex(32, 54, (g) => {
      g.fillStyle = '#9aa88e'; g.fillRect(0, 0, 32, 54);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 46, 32, 8); // scuffed base
      dither(g, 32, 54, 60);
    });
    const bWall = (w: number, cx: number, cz: number, ry: number) => {
      const t = plasterT.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 2.7, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.7), texM2(t));
      m.position.set(cx, 1.35, cz);
      m.rotation.y = ry;
      scene.add(m);
    };
    bWall(8, 244, -19, 0);
    bWall(8, 244, -11, Math.PI);
    bWall(8, 240, -15, Math.PI / 2);
    bWall(8, 248, -15, -Math.PI / 2);
    const bCeil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0xb0aa9c, side: THREE.DoubleSide }));
    bCeil.rotation.x = -Math.PI / 2;
    bCeil.position.set(244, 2.7, -15);
    scene.add(bCeil);
    // interior door back to the street, on the west wall
    const bDoorT = pixTex(32, 64, (g) => {
      g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#8a97a2'; g.fillRect(4, 4, 24, 40); // daylight in the glass
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 24, 24, 2);
      g.fillStyle = '#c9b45e'; g.fillRect(25, 34, 3, 3);
    });
    const bDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), texM2(bDoorT));
    bDoor.position.set(240.02, 1.05, -17);
    bDoor.rotation.y = Math.PI / 2;
    scene.add(bDoor);
    // stocked shelves — two gondolas up the middle
    const shelfT = pixTex(64, 32, (g) => {
      g.fillStyle = '#5a4632'; g.fillRect(0, 0, 64, 32);
      const cols = ['#b8342a', '#d8a02a', '#2c6a8a', '#4a7a3a', '#d8d0c0', '#8a3a6a'];
      for (const sy of [2, 13, 24]) {
        g.fillStyle = '#3a2c20'; g.fillRect(0, sy + 8, 64, 2);
        for (let x = 2; x < 62; x += 5) {
          g.fillStyle = cols[(x / 5 + sy) % 6 | 0];
          g.fillRect(x, sy, 4, 8);
        }
      }
      dither(g, 64, 32, 40);
    });
    const shelfM = texM2(shelfT);
    const shelfEndM = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    for (const gz of [-16.2, -13.9]) {
      const gond = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.35, 0.8), [shelfEndM, shelfEndM, shelfEndM, shelfEndM, shelfM, shelfM]);
      gond.position.set(243.6, 0.675, gz);
      scene.add(gond);
      bodegaColliders.push({ minX: 242, maxX: 245.2, minZ: gz - 0.4, maxZ: gz + 0.4 });
    }
    // the cooler hums along the east wall
    const coolerT = pixTex(96, 48, (g) => {
      g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, 96, 48);
      for (let d = 0; d < 3; d++) {
        const x = 4 + d * 30;
        g.fillStyle = '#16242e'; g.fillRect(x, 4, 26, 40);
        g.fillStyle = 'rgba(160,200,220,0.25)'; g.fillRect(x + 2, 6, 8, 36);
        for (let r = 0; r < 3; r++) for (let b = 0; b < 4; b++) {
          g.fillStyle = ['#b8342a', '#2c6a8a', '#d8a02a', '#4a7a3a'][(r + b + d) % 4];
          g.fillRect(x + 3 + b * 6, 12 + r * 10, 4, 7);
        }
      }
      dither(g, 96, 48, 30);
    });
    const cooler = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 2.0, 5),
      [new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }), texM2(coolerT), new THREE.MeshBasicMaterial({ color: 0xb8b4a8 }), shelfEndM, shelfEndM, shelfEndM],
    );
    cooler.position.set(247.6, 1.0, -14.6);
    scene.add(cooler);
    bodegaColliders.push({ minX: 247.2, maxX: 248, minZ: -17.2, maxZ: -12 });
    // counter, register, and the man himself
    const counterT = pixTex(64, 24, (g) => {
      g.fillStyle = '#6a5038'; g.fillRect(0, 0, 64, 24);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 6; y < 24; y += 8) g.fillRect(0, y, 64, 1);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 64, 2);
    });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.7), [shelfEndM, shelfEndM, texM2(counterT), shelfEndM, texM2(counterT), shelfEndM]);
    counter.position.set(242.2, 0.475, -18.15);
    scene.add(counter);
    bodegaColliders.push({ minX: 240.9, maxX: 243.5, minZ: -18.5, maxZ: -17.8 });
    const reg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.35), new THREE.MeshBasicMaterial({ color: 0x2a2c32 }));
    reg.position.set(242.9, 1.11, -18.2);
    scene.add(reg);
    const keeperT = pixTex(40, 64, (g) => {
      g.fillStyle = '#4a4a52'; g.fillRect(10, 44, 8, 18); g.fillRect(22, 44, 8, 18); // slacks
      g.fillStyle = '#8a95a0'; g.fillRect(8, 22, 24, 24);                            // shirt
      g.fillStyle = '#d8d4c8'; g.fillRect(12, 26, 16, 20);                           // apron
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(12, 26, 16, 2);
      g.fillStyle = '#c9946a'; g.fillRect(3, 24, 5, 13); g.fillRect(32, 24, 5, 13);  // arms
      g.fillStyle = '#b8845a'; g.fillRect(14, 8, 12, 13);                            // head
      g.fillStyle = '#241a12'; g.fillRect(13, 6, 14, 4);                             // hair
      g.fillStyle = '#241a12'; g.fillRect(16, 13, 2, 2); g.fillRect(22, 13, 2, 2);   // eyes
      g.fillStyle = '#3a2c20'; g.fillRect(15, 17, 10, 2);                            // moustache
      dither(g, 40, 64, 20);
    });
    const keeper = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.92), new THREE.MeshBasicMaterial({ map: keeperT, alphaTest: 0.5, side: THREE.DoubleSide }));
    keeper.position.set(242.2, 0.96, -18.68);
    scene.add(keeper);
    bodegaColliders.push(
      { minX: 239.8, maxX: 240, minZ: -19.2, maxZ: -10.8 },
      { minX: 248, maxX: 248.2, minZ: -19.2, maxZ: -10.8 },
      { minX: 239.8, maxX: 248.2, minZ: -19.2, maxZ: -19 },
      { minX: 239.8, maxX: 248.2, minZ: -11, maxZ: -10.8 },
    );
    // warm bulb glow over the aisle
    const bulbT = pixTex(32, 32, (g) => {
      const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      gr.addColorStop(0, 'rgba(255,235,190,0.8)');
      gr.addColorStop(1, 'rgba(255,235,190,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    });
    const bulbM = new THREE.MeshBasicMaterial({ map: bulbT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const gz of [-17.5, -13.5]) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), bulbM);
      gl.position.set(244, 2.45, gz);
      gl.rotation.x = Math.PI / 2;
      scene.add(gl);
    }
  }

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
  const rainM = new THREE.PointsMaterial({ map: rainT, size: 0.5, transparent: true, opacity: 0, depthWrite: false });
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

  // street trees — real low-poly geometry: a leaning 5-sided trunk with
  // 2-3 faceted canopy blobs, planted in a square dirt pit. No billboards.
  const pitT = treePitTex();
  const pitGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const pitMat = new THREE.MeshBasicMaterial({ map: pitT });
  const barkM = new THREE.MeshBasicMaterial({ color: 0x4a3626 });
  const TREE_GREENS = [new THREE.Color('#3e6a36'), new THREE.Color('#52642e')];
  let treeIdx = 0;
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * (ROAD_HALF + 0.9);
    const tree = new THREE.Group();
    const trunkH = 1.8 + rnd() * 0.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, trunkH, 5), barkM);
    trunk.position.y = trunkH / 2;
    tree.add(trunk);
    const green = TREE_GREENS[treeIdx % 2];
    const c0 = canopyBlob(0.9 + rnd() * 0.3, green, 0.82, treeIdx);
    c0.position.y = trunkH + 0.5;
    tree.add(c0);
    const c1 = canopyBlob(0.55 + rnd() * 0.2, green, 0.75, treeIdx + 3);
    c1.position.set(0.45 + rnd() * 0.2, trunkH + 0.15, (rnd() - 0.5) * 0.5);
    tree.add(c1);
    const c2 = canopyBlob(0.45 + rnd() * 0.2, green, 0.7, treeIdx + 5);
    c2.position.set(-(0.4 + rnd() * 0.2), trunkH + 0.3, (rnd() - 0.5) * 0.5);
    tree.add(c2);
    tree.rotation.y = rnd() * Math.PI * 2;
    tree.rotation.z = (rnd() - 0.5) * 0.14; // a little lean
    tree.position.set(tx, sidewalkY, z);
    scene.add(tree);
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(tx, sidewalkY + 0.006, z);
    scene.add(pit);
    propColliders.push({ minX: tx - 0.3, maxX: tx + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    treeIdx++;
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
  interface Citizen { mesh: THREE.Mesh; tex: THREE.Texture; lane: number; z: number; dir: number; sp: number; ph: number; box: AABB }
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
    const box: AABB = { minX: lane - 0.3, maxX: lane + 0.3, minZ: z - 0.3, maxZ: z + 0.3 };
    propColliders.push(box); // people are solid — the box follows them
    citizens.push({ mesh, tex, lane, z, dir: i % 2 ? 1 : -1, sp: 0.85 + (i % 4) * 0.3, ph: i * 1.3, box });
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
      act: () => jumpTo(8.7, -97.2, 0, KERB_H),
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
        walletWrap!.style.transform = walletOpen ? 'translateY(0) rotate(3deg)' : 'translateY(130%) rotate(3deg)';
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
      // citizens: ping-pong the block, show the correct painted angle.
      // They stop a step short of you (solid, but never trap you).
      for (const c of citizens) {
        if (Math.hypot(px - c.lane, pz - c.z) > 1.0) c.z += c.dir * c.sp * dt;
        if (c.z < -L + 4) { c.z = -L + 4; c.dir = 1; }
        if (c.z > 10) { c.z = 10; c.dir = -1; }
        c.box.minX = c.lane - 0.3; c.box.maxX = c.lane + 0.3;
        c.box.minZ = c.z - 0.3; c.box.maxZ = c.z + 0.3;
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

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

function treeSprite(k: number): THREE.Texture {
  return pixTex(64, 96, (g) => {
    g.fillStyle = '#4a3626'; g.fillRect(28, 58, 8, 38);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(28, 58, 2, 38);
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
    g.add(loftCabin(0.81, 0.74, 0.84, 1.5, -1.0, 0.45, -0.45, 0.32, glassM, roofM, flatT(cabinSideTex(1))));
    // open bed: floor + side rails + tailgate
    const bedFloorM = new THREE.MeshBasicMaterial({ color: 0x2a2c30 });
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, half - 0.75), bedFloorM);
    bedFloor.position.set(0, 0.86, (half + 0.7) / 2);
    g.add(bedFloor);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, half - 0.75), bodyM);
      rail.position.set(s * 0.85, 1.0, (half + 0.7) / 2);
      g.add(rail);
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.32, 0.08), bodyM);
    gate.position.set(0, 1.0, half - 0.06);
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
          if (view === 4) g.fillRect(cx - 7, oy + 4, 14, 15); // hood covers the back of the head
          else {
            g.fillRect(cx - 7, oy + 4, 14, 4);
            g.fillRect(cx - 7, oy + 6, 2, 12); g.fillRect(cx + 5, oy + 6, 2, 12); // hood rim
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
      const w = 9 + (bi % 3) * 3;
      // leave the alley mouth open: skip ahead if this building would overlap it
      if (side === -1 && z > AZ1 && z - w <= AZ0) z = AZ1;
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
    // the dumpster
    const dumpsterT = pixTex(96, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 96, 48);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 0; x < 96; x += 12) g.fillRect(x, 0, 2, 48);        // ribs
      g.fillStyle = 'rgba(122,66,40,0.55)';
      g.fillRect(8, 34, 18, 12); g.fillRect(66, 30, 14, 16);           // rust
      g.fillStyle = '#c9c4b0'; g.font = 'bold 9px monospace';
      g.textAlign = 'center'; g.fillText('CITY WASTE', 48, 22);
      dither(g, 96, 48, 200);
    });
    const dumpM = new THREE.MeshBasicMaterial({ map: dumpsterT });
    const dump = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.15, 1.05), dumpM);
    dump.position.set(-11.2, 0.65, AZ0 - 1.15);
    scene.add(dump);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 1.05), new THREE.MeshBasicMaterial({ color: 0x24482f }));
    lid.position.set(-11.2, 1.28, AZ0 - 1.35);
    lid.rotation.x = -0.28; // propped open a crack
    scene.add(lid);
    for (const wx of [-12.2, -10.2]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0x0e0f12 }));
      wheel.position.set(wx, 0.08, AZ0 - 1.15);
      scene.add(wheel);
    }
    // trash bags sprite + a leaning flattened box
    const trashT = pixTex(48, 32, (g) => {
      g.fillStyle = '#1c1e24';
      g.beginPath(); g.arc(14, 22, 10, 0, Math.PI * 2); g.arc(30, 24, 8, 0, Math.PI * 2); g.arc(24, 14, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath(); g.arc(11, 18, 4, 0, Math.PI * 2); g.arc(27, 11, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a3428'; g.fillRect(20, 4, 3, 4);
    });
    const trash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.05), new THREE.MeshBasicMaterial({ map: trashT, alphaTest: 0.5, side: THREE.DoubleSide }));
    trash.geometry.translate(0, 0.52, 0);
    trash.position.set(-9.4, 0, AZ0 - 1.2);
    boards.push({ m: trash });
    scene.add(trash);
    const cardboard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), new THREE.MeshBasicMaterial({ color: 0x8a7248 }));
    cardboard.position.set(-12.9, 0.6, AZ1 + 1.4);
    cardboard.rotation.x = 0.18;
    scene.add(cardboard);
  }

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

  // trees on the sidewalks — taller, and no two the same height
  const treeTexes = [treeSprite(0), treeSprite(1)];
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * (ROAD_HALF + 0.9);
    const th = 4.4 + rnd() * 1.8;             // 4.4 – 6.2 tall
    const tw = th * (0.62 + rnd() * 0.1);     // keep proportions
    const tree = board(treeTexes[Math.abs(Math.round(z / 14)) % 2], tw, th, tx, z);
    tree.position.y = sidewalkY;
    propColliders.push({ minX: tx - 0.3, maxX: tx + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  }
  // hydrant on the right sidewalk
  const hyX = ROAD_HALF + 0.8, hyZ = -6;
  const hyd = board(hydrantSprite(), 0.8, 1.2, hyX, hyZ);
  hyd.position.y = sidewalkY;
  propColliders.push({ minX: hyX - 0.35, maxX: hyX + 0.35, minZ: hyZ - 0.35, maxZ: hyZ + 0.35 });
  // pigeons peck along the kerb
  const pigeons: THREE.Mesh[] = [];
  const pigeonT = pigeonSprite();
  for (let i = 0; i < 4; i++) {
    const b = board(pigeonT, 0.42, 0.42, -(ROAD_HALF + 0.5 + rnd() * 1.2), -20 - rnd() * 4);
    pigeons.push(b);
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
  // the cruiser is the neighborhood taxi; its collider moves with it
  const cruiser = makeCar('sedan', 0, true);
  cruiser.position.set(DRIVE_X, 0, 8);
  scene.add(cruiser);
  let cruiseDir = -1;
  const cruiserBox: AABB = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

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
  OUTFITS.forEach((o, i) => {
    const tex = citizenAtlas(o.j, o.p, o.s, o.h, o.fit, o.acc);
    tex.repeat.set(1 / 5, 1 / 2);
    const geo = new THREE.PlaneGeometry(0.95, 1.9);
    geo.translate(0, 0.95, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.scale.set(o.ws, o.hs, 1);
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 0.6 + (i % 3) * 0.5);
    mesh.position.set(lane, sidewalkY, 4 - i * 11);
    scene.add(mesh);
    citizens.push({ mesh, tex, lane, z: 4 - i * 11, dir: i % 2 ? 1 : -1, sp: 0.85 + (i % 4) * 0.3, ph: i * 1.3 });
  });

  const colliders: AABB[] = [
    { minX: FACE - 0.3, maxX: FACE + 8, minZ: -L - 10, maxZ: 20 },          // right wall
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: -L - 10, maxZ: AZ1 },       // left wall south of alley
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: AZ0, maxZ: 20 },            // left wall north of alley
    { minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 }, // alley end wall
    { minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 },        // dumpster
    ...propColliders,
    ...carColliders,
    cruiserBox,
  ];
  const rig = new FPRig(cam, { x: -1.4, z: 9, yaw: 0 }, {
    bounds: { minX: -FACE - 6.4, maxX: 6.7, minZ: -L - 0.5, maxZ: 13 },
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    groundY: (x) => (Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0),
  });

  // debug/tour hook
  (window as any).__ct = {
    warp: (x: number, z: number, yaw?: number) => { rig.pos.set(x, rig.pos.y, z); if (yaw !== undefined) rig.yaw = yaw; },
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
      // the cruiser rolls the travel lanes end to end, keeping right
      cruiser.position.z += cruiseDir * 8.5 * dt;
      if (cruiser.position.z < -L + 6) { cruiseDir = 1; cruiser.position.x = -DRIVE_X; cruiser.rotation.y = Math.PI; }
      if (cruiser.position.z > 8) { cruiseDir = -1; cruiser.position.x = DRIVE_X; cruiser.rotation.y = 0; }
      // its collider follows
      cruiserBox.minX = cruiser.position.x - 1.05;
      cruiserBox.maxX = cruiser.position.x + 1.05;
      cruiserBox.minZ = cruiser.position.z - 2.4;
      cruiserBox.maxZ = cruiser.position.z + 2.4;
      // pigeons hop on the kerb
      pigeons.forEach((pg, i) => {
        pg.position.y = sidewalkY + Math.max(0, Math.sin(t * 6 + i * 2.4)) * 0.06;
      });
    },
  };
}

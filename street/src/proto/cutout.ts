import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, skyTex, type AABB } from './fp';

// Studio B, variation 2 — POP-UP THEATER. The construction rule: everything
// is a flat painted cutout. Buildings are stage flats with painted windows
// and painted shadows; trees, people, lamps and clouds are billboards that
// always turn to face you; the car is two crossed cutouts like a paper toy;
// a painted skyline backdrop closes the street. No lights — all shading is
// painted into the cardboard.

const L = 90;
const FACE = 6.6;

let seed = 616 >>> 0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const INK = '#33291f';

function flatMat(tex: THREE.Texture, alpha = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, ...(alpha ? { alphaTest: 0.5 } : {}) });
}

// bottom-anchored painted cutout
function cutout(tex: THREE.Texture, w: number, h: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  return new THREE.Mesh(geo, flatMat(tex, true));
}

// ---- painters ------------------------------------------------------------

function facadeTex(base: string, trimC: string, floors: number, wide: number): THREE.Texture {
  const W = 256, H = 64 + floors * 84 + 46;
  return canvas(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const top = 40; // sky-alpha margin for the roofline cutout
    // body
    g.fillStyle = base;
    g.fillRect(10, top, W - 20, H - top);
    // irregular painted roofline + chimney
    g.fillRect(30, top - 18, 40, 20);
    g.fillRect(W - 80, top - 26, 34, 28);
    g.strokeStyle = INK; g.lineWidth = 5;
    g.strokeRect(10, top, W - 20, H - top);
    g.strokeRect(30, top - 18, 40, 20);
    g.strokeRect(W - 80, top - 26, 34, 28);
    // painted cornice band
    g.fillStyle = trimC;
    g.fillRect(10, top + 4, W - 20, 14);
    // windows with painted glass, curtains, and drop shadows
    const cols = wide;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = 24 + c * ((W - 48) / cols) + 4;
        const y = top + 34 + f * 84;
        const ww = (W - 48) / cols - 14, wh = 56;
        // painted shadow under sill
        g.fillStyle = 'rgba(40,30,20,0.25)';
        g.fillRect(x - 2, y + wh + 4, ww + 8, 7);
        // frame + glass
        g.fillStyle = '#fdf6e8';
        g.fillRect(x - 5, y - 5, ww + 10, wh + 10);
        g.fillStyle = '#5a7a9c';
        g.fillRect(x, y, ww, wh);
        // painted reflection stroke
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x + 6, y + wh - 8); g.lineTo(x + ww - 8, y + 8); g.stroke();
        // some windows get curtains or a plant
        const roll = (f * 7 + c * 13) % 5;
        if (roll === 0) {
          g.fillStyle = '#e88a7a';
          g.fillRect(x, y, ww * 0.3, wh);
          g.fillRect(x + ww * 0.7, y, ww * 0.3, wh);
        } else if (roll === 1) {
          g.fillStyle = '#5a9a5a';
          g.beginPath(); g.arc(x + ww / 2, y + wh - 8, 9, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = INK; g.lineWidth = 4;
        g.strokeRect(x - 5, y - 5, ww + 10, wh + 10);
        g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh); g.stroke();
      }
    }
    // door + painted awning at street level
    const dy = H - 74;
    g.fillStyle = trimC;
    g.fillRect(W / 2 - 30, dy, 60, 74);
    g.strokeStyle = INK; g.lineWidth = 5;
    g.strokeRect(W / 2 - 30, dy, 60, 74);
    g.fillStyle = '#7a5236';
    g.fillRect(W / 2 - 20, dy + 12, 40, 62);
    g.strokeRect(W / 2 - 20, dy + 12, 40, 62);
    // scalloped awning
    g.fillStyle = '#e86a5a';
    g.fillRect(W / 2 - 44, dy - 16, 88, 14);
    for (let k = 0; k < 4; k++) {
      g.beginPath(); g.arc(W / 2 - 33 + k * 22, dy - 2, 11, 0, Math.PI); g.fill();
    }
    g.strokeStyle = INK; g.lineWidth = 4;
    g.strokeRect(W / 2 - 44, dy - 16, 88, 14);
  });
}

function treeTex(): THREE.Texture {
  return canvas(128, 160, (g) => {
    g.clearRect(0, 0, 128, 160);
    g.strokeStyle = INK; g.lineWidth = 5;
    // trunk
    g.fillStyle = '#9a6a48';
    g.beginPath();
    g.moveTo(56, 160); g.lineTo(60, 96); g.lineTo(68, 96); g.lineTo(74, 160); g.closePath();
    g.fill(); g.stroke();
    // cloud of foliage: overlapping painted circles
    const puffs: [number, number, number, string][] = [
      [64, 64, 42, '#6ec46a'], [36, 82, 28, '#5ab060'], [94, 80, 26, '#5ab060'],
      [50, 44, 24, '#84d078'], [82, 48, 22, '#84d078'],
    ];
    for (const [x, y, r, c] of puffs) {
      g.fillStyle = c;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2);
    for (const [x, y, r] of puffs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
    g.stroke();
    // painted fruit dots
    g.fillStyle = '#e86a5a';
    for (const [x, y] of [[48, 70], [78, 58], [64, 88]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  });
}

function personTex(shirt: string, skin: string, hair: string): THREE.Texture {
  return canvas(64, 128, (g) => {
    g.clearRect(0, 0, 64, 128);
    g.strokeStyle = INK; g.lineWidth = 4;
    // legs
    g.fillStyle = '#4a5a8c';
    g.fillRect(22, 78, 8, 40); g.fillRect(34, 78, 8, 40);
    g.strokeRect(22, 78, 8, 40); g.strokeRect(34, 78, 8, 40);
    // body
    g.fillStyle = shirt;
    g.beginPath();
    g.moveTo(18, 46); g.quadraticCurveTo(32, 38, 46, 46);
    g.lineTo(44, 84); g.lineTo(20, 84); g.closePath();
    g.fill(); g.stroke();
    // arms
    g.fillStyle = shirt;
    g.fillRect(12, 50, 7, 26); g.fillRect(45, 50, 7, 26);
    g.strokeRect(12, 50, 7, 26); g.strokeRect(45, 50, 7, 26);
    // head
    g.fillStyle = skin;
    g.beginPath(); g.arc(32, 28, 15, 0, Math.PI * 2); g.fill(); g.stroke();
    // hair cap
    g.fillStyle = hair;
    g.beginPath(); g.arc(32, 24, 15, Math.PI, 0); g.fill();
    // face
    g.fillStyle = INK;
    g.beginPath(); g.arc(27, 28, 2, 0, Math.PI * 2); g.arc(38, 28, 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(32, 33, 5, 0.2, Math.PI - 0.2); g.stroke();
    // shoes
    g.fillStyle = INK;
    g.fillRect(19, 116, 13, 7); g.fillRect(33, 116, 13, 7);
  });
}

function lampTex(): THREE.Texture {
  return canvas(48, 160, (g) => {
    g.clearRect(0, 0, 48, 160);
    g.strokeStyle = INK; g.lineWidth = 4;
    g.fillStyle = '#f5ead2';
    g.fillRect(20, 30, 8, 130);
    g.strokeRect(20, 30, 8, 130);
    g.fillStyle = '#ffe9a0';
    g.beginPath(); g.arc(24, 20, 14, 0, Math.PI * 2); g.fill(); g.stroke();
    // painted glow rays
    g.strokeStyle = '#f5c86a'; g.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(24 + Math.cos(a) * 17, 20 + Math.sin(a) * 17);
      g.lineTo(24 + Math.cos(a) * 22, 20 + Math.sin(a) * 22);
      g.stroke();
    }
  });
}

function carSideTex(body: string): THREE.Texture {
  return canvas(192, 80, (g) => {
    g.clearRect(0, 0, 192, 80);
    g.strokeStyle = INK; g.lineWidth = 5;
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(12, 62); g.lineTo(14, 40); g.quadraticCurveTo(20, 32, 48, 30);
    g.quadraticCurveTo(60, 12, 96, 12); g.quadraticCurveTo(130, 12, 140, 30);
    g.quadraticCurveTo(172, 32, 178, 42); g.lineTo(180, 62); g.closePath();
    g.fill(); g.stroke();
    // windows
    g.fillStyle = '#a8d8ea';
    g.beginPath();
    g.moveTo(66, 30); g.quadraticCurveTo(72, 17, 94, 17); g.lineTo(94, 30); g.closePath();
    g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(100, 17); g.quadraticCurveTo(124, 17, 132, 30); g.lineTo(100, 30); g.closePath();
    g.fill(); g.stroke();
    // wheels
    for (const wx of [50, 146]) {
      g.fillStyle = '#3a3a46';
      g.beginPath(); g.arc(wx, 62, 15, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#fdf6e8';
      g.beginPath(); g.arc(wx, 62, 6, 0, Math.PI * 2); g.fill();
    }
  });
}

function carFrontTex(body: string): THREE.Texture {
  return canvas(96, 80, (g) => {
    g.clearRect(0, 0, 96, 80);
    g.strokeStyle = INK; g.lineWidth = 5;
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(10, 64); g.lineTo(12, 38); g.quadraticCurveTo(48, 26, 84, 38); g.lineTo(86, 64); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#a8d8ea';
    g.fillRect(26, 30, 44, 12); g.strokeRect(26, 30, 44, 12);
    g.fillStyle = '#ffe9a0';
    g.beginPath(); g.arc(22, 52, 6, 0, Math.PI * 2); g.arc(74, 52, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.arc(22, 52, 6, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(74, 52, 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = INK;
    g.beginPath(); g.arc(30, 46, 2.5, 0, Math.PI * 2); g.arc(66, 46, 2.5, 0, Math.PI * 2); g.fill(); // little rivets
    for (const wx of [18, 78]) { g.fillRect(wx - 6, 62, 12, 12); }
  });
}

function cloudTex(): THREE.Texture {
  return canvas(128, 64, (g) => {
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = '#ffffff';
    g.strokeStyle = INK; g.lineWidth = 4;
    const puffs: [number, number, number][] = [[36, 42, 18], [64, 34, 22], [94, 42, 16]];
    g.beginPath();
    for (const [x, y, r] of puffs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
    g.fill(); g.stroke();
  });
}

function backdropTex(): THREE.Texture {
  return canvas(512, 256, (g) => {
    // painted sky
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#a8d8f0'); grd.addColorStop(1, '#f5e6d2');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
    // painted sun with rays
    g.fillStyle = '#ffe9a0';
    g.beginPath(); g.arc(390, 60, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f5c86a'; g.lineWidth = 5;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(390 + Math.cos(a) * 38, 60 + Math.sin(a) * 38);
      g.lineTo(390 + Math.cos(a) * 50, 60 + Math.sin(a) * 50);
      g.stroke();
    }
    // painted distant skyline, two depths
    g.fillStyle = '#b8cade';
    for (let x = 0; x < 512; x += 54) {
      const h = 60 + ((x * 7) % 50);
      g.fillRect(x, 256 - h - 40, 44, h + 40);
    }
    g.fillStyle = '#8fa8c4';
    g.strokeStyle = INK; g.lineWidth = 4;
    for (let x = 20; x < 512; x += 74) {
      const h = 90 + ((x * 13) % 60);
      g.fillRect(x, 256 - h, 58, h);
      g.strokeRect(x, 256 - h, 58, h);
      // painted windows
      g.fillStyle = '#f5e6a8';
      for (let wy = 256 - h + 12; wy < 240; wy += 22) {
        for (let wx = x + 8; wx < x + 50; wx += 16) g.fillRect(wx, wy, 8, 10);
      }
      g.fillStyle = '#8fa8c4';
    }
  });
}

// ---------------------------------------------------------------------------

export function makeCutout(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(85, 1, 0.1, 300);
  scene.background = skyTex([[0, '#a8d8f0'], [0.8, '#e8f2f7'], [1, '#f5e6d2']]);
  // no fog — theater air is perfectly clear

  // painted ground: one long canvas
  const groundTex = canvas(256, 256, (g) => {
    g.fillStyle = '#d9cdb4'; g.fillRect(0, 0, 256, 256);          // sidewalk paper
    g.fillStyle = '#a8a4b8'; g.fillRect(58, 0, 140, 256);          // road
    g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(58, 0); g.lineTo(58, 256); g.moveTo(198, 0); g.lineTo(198, 256); g.stroke();
    g.fillStyle = '#fdf6e8';
    for (let y = 10; y < 256; y += 64) g.fillRect(124, y, 8, 34);  // dashes
    // painted pavement cracks
    g.strokeStyle = 'rgba(51,41,31,0.25)'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.moveTo(Math.random() * 50, Math.random() * 256);
      g.lineTo(Math.random() * 40 + 8, Math.random() * 256);
      g.stroke();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(1, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16.5, L + 40), new THREE.MeshBasicMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.rotation.z = Math.PI / 2 * 0; // keep axis: texture x across street
  ground.position.z = -L / 2 + 12;
  scene.add(ground);
  // paper margins beyond the flats
  const margin = new THREE.Mesh(new THREE.PlaneGeometry(60, L + 60), new THREE.MeshBasicMaterial({ color: 0xe8dcc4 }));
  margin.rotation.x = -Math.PI / 2;
  margin.position.set(0, -0.02, -L / 2 + 12);
  scene.add(margin);

  // building flats along both walls
  const bases = ['#f2a08a', '#7cc8bc', '#f5d88a', '#a8b4f0', '#f2b8cc', '#b8dc9a'];
  const trims = ['#fdf6e8', '#fdf6e8', '#fdf6e8', '#fdf6e8', '#fdf6e8', '#fdf6e8'];
  let bi = 0;
  for (const side of [-1, 1]) {
    let z = 12;
    while (z > -L) {
      const w = 8 + (bi % 3) * 2;
      const floors = 2 + ((bi * 3) % 3);
      const h = 4.6 + floors * 2.6;
      const cz = z - w / 2;
      const tex = facadeTex(bases[bi % bases.length], trims[bi % trims.length], floors, Math.max(2, Math.floor(w / 2.6)));
      const flat = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flatMat(tex, true));
      flat.rotation.y = -side * Math.PI / 2;
      flat.position.set(side * FACE, h / 2 - 0.4, cz);
      scene.add(flat);
      // a second depth layer: painted side-return flap angled slightly (pop-up fold)
      const foldTex = canvas(32, 128, (g) => {
        g.fillStyle = bases[bi % bases.length]; g.fillRect(0, 0, 32, 128);
        g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(0, 0, 32, 128);
        g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(0, 0, 32, 128);
      });
      const fold = new THREE.Mesh(new THREE.PlaneGeometry(1.4, h * 0.92), flatMat(foldTex));
      fold.rotation.y = -side * Math.PI / 2 + side * 0.9;
      fold.position.set(side * (FACE + 0.55), h / 2 - 0.45, cz - w / 2 + 0.1);
      scene.add(fold);
      z = cz - w / 2 - 0.9;
      bi++;
    }
  }

  // backdrop flat closing the street — the painted horizon
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: backdropTex() }));
  backdrop.position.set(0, 9.9, -L - 4);
  scene.add(backdrop);

  // billboards: trees, lamps, clouds — all face the camera
  const billboards: { m: THREE.Object3D }[] = [];
  const treeT = treeTex();
  for (let z = 0; z > -L + 6; z -= 12) {
    const s = Math.round(z / 12) % 2 === 0 ? 1 : -1;
    if (Math.round(z / 12) % 3 === 2) {
      const lamp = cutout(lampTex(), 1.4, 4.6);
      lamp.position.set(s * 4.9, 0, z);
      billboards.push({ m: lamp });
      scene.add(lamp);
    } else {
      const tree = cutout(treeT, 3.4, 4.3);
      tree.position.set(s * 4.9, 0, z);
      billboards.push({ m: tree });
      scene.add(tree);
      // painted shadow ellipse
      const sh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 18), new THREE.MeshBasicMaterial({ color: 0x33291f, transparent: true, opacity: 0.18 }));
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(s * 4.9, 0.01, z);
      sh.scale.x = 1.5;
      scene.add(sh);
    }
  }
  const cloudT = cloudTex();
  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), flatMat(cloudT, true));
    cl.position.set(-16 + i * 8, 14 + (i % 2) * 3, -30 - i * 14);
    clouds.push(cl);
    billboards.push({ m: cl });
    scene.add(cl);
  }

  // the car: two crossed painted cutouts — a standing paper toy
  function paperCar(body: string, x: number, z: number, ry: number): void {
    const g = new THREE.Group();
    const sideC = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.85), flatMat(carSideTex(body), true));
    sideC.position.y = 0.925;
    const frontC = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.85), flatMat(carFrontTex(body), true));
    frontC.rotation.y = Math.PI / 2;
    frontC.position.y = 0.925;
    g.add(sideC, frontC);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({ color: 0x33291f, transparent: true, opacity: 0.18 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.012;
    sh.scale.set(2.3, 1.1, 1);
    g.add(sh);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  paperCar('#e86a5a', 2.9, -13, 0.5);
  paperCar('#7ca8e8', -2.9, -49, -0.4);

  // people billboards with waddle
  const walkers: { m: THREE.Mesh; lane: number; z: number; dir: number; sp: number; ph: number }[] = [];
  const casts: [string, string, string][] = [
    ['#e86a5a', '#f5d1b0', '#5a3a24'], ['#7cc8bc', '#e0b494', '#33291f'],
    ['#f5d88a', '#f5d1b0', '#8a5a2e'], ['#a8b4f0', '#d9a586', '#2e2018'],
    ['#b8dc9a', '#f5d1b0', '#d9c25a'], ['#f2b8cc', '#e0b494', '#3a2c20'],
  ];
  casts.forEach(([sh, sk, hr], i) => {
    const p = cutout(personTex(sh, sk, hr), 1.05, 2.1);
    const lane = (i % 2 ? 1 : -1) * (5.0 + (i % 3) * 0.5);
    p.position.set(lane, 0, 4 - i * 13);
    scene.add(p);
    walkers.push({ m: p, lane, z: 4 - i * 13, dir: i % 2 ? 1 : -1, sp: 0.9 + (i % 3) * 0.3, ph: i * 1.7 });
    const shd = new THREE.Mesh(new THREE.CircleGeometry(0.4, 14), new THREE.MeshBasicMaterial({ color: 0x33291f, transparent: true, opacity: 0.16 }));
    shd.rotation.x = -Math.PI / 2;
    shd.name = `pshadow${i}`;
    shd.position.set(lane, 0.01, 4 - i * 13);
    scene.add(shd);
  });

  const colliders: AABB[] = [
    { minX: FACE - 0.2, maxX: FACE + 6, minZ: -L - 10, maxZ: 20 },
    { minX: -FACE - 6, maxX: -FACE + 0.2, minZ: -L - 10, maxZ: 20 },
    { minX: 1.7, maxX: 4.1, minZ: -15.2, maxZ: -10.8 },
    { minX: -4.1, maxX: -1.7, minZ: -51.2, maxZ: -46.8 },
  ];
  const rig = new FPRig(cam, { x: -1.2, z: 9, yaw: 0 }, { bounds: { minX: -6.2, maxX: 6.2, minZ: -L + 6, maxZ: 11 }, colliders, speed: 3.4, bob: 0.04 });

  return {
    key: 'cutout', name: 'B·2 — Pop-Up Theater',
    feel: 'Studio B, variation 2 — painted cardboard: stage flats, billboard cutouts, a backdrop horizon.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.NoToneMapping; // painted colors, straight from the can
      r.shadowMap.enabled = false;
    },
    update(dt, t, input) {
      rig.update(dt, input);
      // billboards pivot to face the camera
      for (const b of billboards) {
        b.m.rotation.y = Math.atan2(cam.position.x - b.m.position.x, cam.position.z - b.m.position.z);
      }
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        w.z += w.dir * w.sp * dt;
        if (w.z < -L + 8) { w.z = -L + 8; w.dir = 1; }
        if (w.z > 10) { w.z = 10; w.dir = -1; }
        w.m.position.set(w.lane, Math.abs(Math.sin(t * 5 * w.sp + w.ph)) * 0.09, w.z);
        w.m.rotation.y = Math.atan2(cam.position.x - w.lane, cam.position.z - w.z);
        w.m.rotation.z = Math.sin(t * 5 * w.sp + w.ph) * 0.08; // paper-puppet waddle
        const shd = scene.getObjectByName(`pshadow${i}`);
        if (shd) shd.position.set(w.lane, 0.01, w.z);
      }
      // clouds drift like they're on rails
      clouds.forEach((cl, i) => {
        cl.position.x += dt * (0.3 + i * 0.05);
        if (cl.position.x > 24) cl.position.x = -24;
      });
    },
  };
}

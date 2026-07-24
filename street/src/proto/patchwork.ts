import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, skyTex, makeEnv, sagPoints, tube, type AABB } from './fp';

// Studio F, variation 2 — SCRAPYARD. The construction rule: nothing is one
// piece. Every wall is hand-assembled from hundreds of overlapping scraps —
// weathered planks, rusted sheet metal, corrugated panels — each nailed on at
// a slightly wrong angle. Corrugated roofs weighted with tires, plastic-sheet
// windows, a patched car with a roof-rack spare, rope and wire everywhere,
// dust hanging in warm afternoon light. One blue tarp sings against the rust.

const L = 94;
const FACE = 6.4;

let seed = 7272 >>> 0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plankTex(base: string): THREE.Texture {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 64, 64);
    // grain
    g.strokeStyle = 'rgba(30,20,12,0.35)';
    for (let i = 0; i < 7; i++) {
      g.lineWidth = 1 + Math.random();
      g.beginPath();
      g.moveTo(0, 6 + i * 9 + Math.random() * 3);
      g.bezierCurveTo(20, 4 + i * 9, 44, 10 + i * 9, 64, 6 + i * 9);
      g.stroke();
    }
    // nail heads
    g.fillStyle = 'rgba(20,14,8,0.7)';
    g.fillRect(6, 6, 3, 3); g.fillRect(55, 6, 3, 3); g.fillRect(6, 55, 3, 3); g.fillRect(55, 55, 3, 3);
  });
}

function rustTex(): THREE.Texture {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#8a5a3a'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) {
      const c = ['#a86a3a', '#6b4228', '#9a4a2a', '#7a5a44'][Math.floor(Math.random() * 4)];
      g.fillStyle = c;
      g.beginPath();
      g.arc(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,220,180,0.15)';
    g.fillRect(0, 0, 64, 8);
  });
}

function corrugatedTex(base: string): THREE.Texture {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, 0, 3, 64);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 5, 0, 3, 64);
    }
    // rust drips from top
    g.fillStyle = 'rgba(122,66,40,0.5)';
    for (let i = 0; i < 4; i++) {
      const x = Math.random() * 60;
      g.fillRect(x, 0, 3, 10 + Math.random() * 26);
    }
  });
}

function signTex(text: string): THREE.Texture {
  return canvasTex(128, 48, (g) => {
    g.fillStyle = '#d9cba8'; g.fillRect(0, 0, 128, 48);
    g.fillStyle = 'rgba(90,60,40,0.3)';
    g.fillRect(0, 40, 128, 8);
    g.fillStyle = '#3a2c1c';
    g.font = 'bold 22px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // hand-painted wobble: draw twice slightly offset
    g.fillText(text, 64, 23);
    g.fillStyle = 'rgba(58,44,28,0.5)';
    g.fillText(text, 65, 25);
  });
}

const std = (c: number, rough = 0.9, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

export function makePatchwork(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(87, 1, 0.1, 300);
  scene.background = skyTex([[0, '#b8a88a'], [0.6, '#d9c4a0'], [1, '#e8d0a8']]);
  scene.fog = new THREE.Fog(0xd4bf9c, 22, 130);

  const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
  sun.position.set(-34, 30, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.far = 200;
  sun.shadow.bias = -0.0005;
  scene.add(sun, new THREE.HemisphereLight(0xd9c8a8, 0x5a4a38, 0.7), new THREE.AmbientLight(0xd0bc98, 0.4));

  // shared scrap materials
  const scrapMats: THREE.MeshStandardMaterial[] = [
    new THREE.MeshStandardMaterial({ map: plankTex('#8a6a4a'), roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: plankTex('#6b5236'), roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: plankTex('#9a8262'), roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: rustTex(), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: corrugatedTex('#7a828a'), roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ map: plankTex('#5c6b5a'), roughness: 0.95 }), // old green paint
  ];
  const corrRoof = new THREE.MeshStandardMaterial({ map: corrugatedTex('#6b7078'), roughness: 0.8 });
  const corrRust = new THREE.MeshStandardMaterial({ map: corrugatedTex('#8a5a3a'), roughness: 0.85 });
  const tarp = std(0x2e6ba8, 0.75); // THE blue tarp
  const frameM = std(0x3a2c1c, 0.9);
  const plasticM = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.6, transparent: true, opacity: 0.45 });

  // dirt ground with plank walkways
  const dirtT = canvasTex(128, 128, (g) => {
    g.fillStyle = '#9a8264'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = ['#8a7254', '#a8906e', '#7a6448'][Math.floor(Math.random() * 3)];
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    g.fillStyle = 'rgba(70,55,40,0.4)';
    g.beginPath(); g.ellipse(40, 90, 20, 9, 0.4, 0, Math.PI * 2); g.fill();
  });
  dirtT.wrapS = dirtT.wrapT = THREE.RepeatWrapping;
  dirtT.repeat.set(4, 30);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, L + 40), new THREE.MeshStandardMaterial({ map: dirtT, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -L / 2 + 12; ground.receiveShadow = true;
  scene.add(ground);
  // wheel ruts down the road
  for (const rx of [-1.3, 1.3]) {
    const rut = new THREE.Mesh(new THREE.PlaneGeometry(0.7, L + 30), std(0x7a6448, 1));
    rut.rotation.x = -Math.PI / 2;
    rut.position.set(rx, 0.01, -L / 2 + 12);
    rut.receiveShadow = true;
    scene.add(rut);
  }
  // plank walkways + puddles
  for (let z = 6; z > -L; z -= 7) {
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), scrapMats[Math.floor(rnd() * 3)]);
      pl.position.set(s * 5.1, 0.06, z + rnd() * 2);
      pl.rotation.y = (rnd() - 0.5) * 0.2;
      pl.castShadow = true; pl.receiveShadow = true;
      scene.add(pl);
    }
  }
  for (let i = 0; i < 5; i++) {
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.6, 14), std(0x4a4438, 0.15, 0.4));
    pud.rotation.x = -Math.PI / 2;
    pud.position.set((rnd() - 0.5) * 6, 0.02, -rnd() * L);
    pud.scale.x = 1.6;
    scene.add(pud);
  }

  // scrap-assembled buildings
  const colliders: AABB[] = [
    { minX: FACE - 0.4, maxX: FACE + 8, minZ: -L - 10, maxZ: 20 },
    { minX: -FACE - 8, maxX: -FACE + 0.4, minZ: -L - 10, maxZ: 20 },
  ];
  let bi = 0;
  for (const side of [-1, 1]) {
    let z = 12;
    while (z > -L) {
      const w = 8 + (bi % 3) * 2.5;
      const h = 6.5 + ((bi * 5) % 4) * 1.6;
      const cz = z - w / 2;
      // dark backing wall (the gaps between scraps read as shadow)
      const backing = new THREE.Mesh(new THREE.BoxGeometry(2.8, h, w), std(0x241c12, 1));
      backing.position.set(side * (FACE + 1.5), h / 2, cz);
      backing.castShadow = true; backing.receiveShadow = true;
      scene.add(backing);
      // corner posts + beams
      for (const pz of [cz - w / 2 + 0.15, cz + w / 2 - 0.15]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.6, 0.22), frameM);
        post.position.set(side * (FACE - 0.05), (h + 0.6) / 2, pz);
        post.rotation.z = (rnd() - 0.5) * 0.03;
        post.castShadow = true;
        scene.add(post);
      }
      // window openings to skip (1-2 per building)
      const wins: [number, number][] = [];
      const nWins = 1 + (bi % 2);
      for (let k = 0; k < nWins; k++) {
        wins.push([1.8 + rnd() * (h - 4), cz - w / 2 + 1.5 + rnd() * (w - 3)]);
      }
      // the scrap skin: overlapping panels in a jittered grid
      const cellH = 1.05, cellW = 1.35;
      for (let gy = 0; gy < Math.ceil(h / cellH); gy++) {
        for (let gz = 0; gz < Math.ceil(w / cellW); gz++) {
          const py = 0.5 + gy * cellH + (rnd() - 0.5) * 0.15;
          const pz = cz - w / 2 + 0.5 + gz * cellW + (rnd() - 0.5) * 0.18;
          // skip if inside a window opening
          if (wins.some(([wy, wz]) => Math.abs(py - wy) < 0.85 && Math.abs(pz - wz) < 1.0)) continue;
          const pw = cellW * (1.0 + rnd() * 0.35);
          const ph = cellH * (1.0 + rnd() * 0.3);
          const mat = bi === 2 && gy > Math.ceil(h / cellH) - 3 && gz < 3 ? tarp : scrapMats[Math.floor(rnd() * scrapMats.length)];
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, ph, pw), mat);
          panel.position.set(side * (FACE - 0.12 - rnd() * 0.1), py, pz);
          panel.rotation.x = (rnd() - 0.5) * 0.06;
          panel.rotation.y = (rnd() - 0.5) * 0.08;
          panel.rotation.z = (rnd() - 0.5) * 0.09;
          panel.castShadow = true; panel.receiveShadow = true;
          scene.add(panel);
        }
      }
      // window frames + plastic sheet
      for (const [wy, wz] of wins) {
        for (const [dx, dy, bw, bh] of [[0, 0.8, 1.7, 0.14], [0, -0.8, 1.7, 0.14], [-0.85, 0, 0.14, 1.6], [0.85, 0, 0.14, 1.6]] as [number, number, number, number][]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, bh, bw), frameM);
          b.position.set(side * (FACE - 0.1), wy + dy, wz + dx);
          b.rotation.z = (rnd() - 0.5) * 0.04;
          b.castShadow = true;
          scene.add(b);
        }
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), plasticM);
        sheet.rotation.y = -side * Math.PI / 2;
        sheet.position.set(side * (FACE - 0.14), wy, wz);
        scene.add(sheet);
      }
      // corrugated roof sheets, tilted, overhanging, weighted with tires
      const nSheets = Math.ceil(w / 2.4);
      for (let k = 0; k < nSheets; k++) {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 2.7), k % 3 === 2 ? corrRust : corrRoof);
        sheet.position.set(side * (FACE + 1.4), h + 0.25 + (rnd() - 0.5) * 0.16, cz - w / 2 + 1.1 + k * 2.4);
        sheet.rotation.z = -side * (0.07 + rnd() * 0.08);
        sheet.rotation.y = (rnd() - 0.5) * 0.05;
        sheet.castShadow = true;
        scene.add(sheet);
      }
      for (let k = 0; k < 2; k++) {
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 8, 16), std(0x1c1c20, 0.9));
        tire.rotation.x = Math.PI / 2 + (rnd() - 0.5) * 0.3;
        tire.position.set(side * (FACE + 1 + rnd()), h + 0.45, cz - w / 4 + k * (w / 2));
        tire.castShadow = true;
        scene.add(tire);
      }
      // hand-painted shop sign, hung tilted
      if (bi % 2 === 0) {
        const names = ['CAFÉ', 'TOOLS', 'TAILOR', 'RADIO FIX'];
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.9), new THREE.MeshStandardMaterial({ map: signTex(names[(bi / 2) % names.length | 0]), roughness: 0.9 }));
        sign.position.set(side * (FACE - 0.4), 3.4, cz);
        sign.rotation.x = (rnd() - 0.5) * 0.1;
        sign.rotation.y = -side * 0.06;
        sign.castShadow = true;
        scene.add(sign);
        // rope hangers
        for (const hz of [cz - 0.7, cz + 0.7]) {
          scene.add(tube([new THREE.Vector3(side * (FACE - 0.1), 4.3, hz), new THREE.Vector3(side * (FACE - 0.4), 3.75, hz)], 0.015, frameM));
        }
      }
      z = cz - w / 2 - 1;
      bi++;
    }
  }

  // wires and rope crisscrossing overhead, one string of rag-flags
  const wireM = std(0x241c12, 0.8);
  for (const czz of [-10, -30, -52, -74]) {
    const pts = sagPoints(new THREE.Vector3(-FACE, 6.4 + rnd() * 1.8, czz), new THREE.Vector3(FACE, 6.2 + rnd() * 2, czz + 1.5), 0.9);
    scene.add(tube(pts, 0.02, wireM));
    if (czz === -30) {
      for (let k = 3; k < pts.length - 3; k += 2) {
        const rag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.42, 0.5),
          new THREE.MeshStandardMaterial({ color: [0xb0604a, 0xd9c49a, 0x5c6b5a, 0x2e6ba8][k % 4], roughness: 0.95, side: THREE.DoubleSide }),
        );
        rag.position.copy(pts[k]).add(new THREE.Vector3(0, -0.27, 0));
        rag.name = `rag${k}`;
        rag.castShadow = true;
        scene.add(rag);
      }
    }
  }

  // the patched car: sedan silhouette, every panel from a different donor
  const carG = new THREE.Group();
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.66, 4.2), std(0x6b6b5c, 0.7));
    base.position.y = 0.62; base.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.1), std(0x7a7264, 0.75));
    cab.position.set(0, 1.22, -0.1); cab.castShadow = true;
    carG.add(base, cab);
    // mismatched patch plates
    const patchCols = [0xb0604a, 0x5c6b5a, 0x8a5a3a, 0x2e6ba8, 0x9a8262];
    for (let i = 0; i < 9; i++) {
      const pw = 0.4 + rnd() * 0.5, ph = 0.25 + rnd() * 0.3;
      const onSide = rnd() < 0.7;
      const mat2 = i === 0 ? new THREE.MeshStandardMaterial({ map: rustTex(), roughness: 0.85 }) : std(patchCols[i % patchCols.length], 0.8);
      const patch = new THREE.Mesh(new THREE.BoxGeometry(onSide ? 0.04 : pw, onSide ? ph : 0.04, onSide ? pw : ph), mat2);
      if (onSide) patch.position.set((rnd() < 0.5 ? -1 : 1) * 0.97, 0.5 + rnd() * 0.4, (rnd() - 0.5) * 3.6);
      else patch.position.set((rnd() - 0.5) * 1.5, 0.97, (rnd() - 0.5) * 3.4);
      patch.rotation.z = (rnd() - 0.5) * 0.1;
      carG.add(patch);
    }
    // windshield: plastic sheet tied on
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), plasticM);
    shield.rotation.x = -0.4;
    shield.position.set(0, 1.15, -1.15);
    carG.add(shield);
    // roof rack from sticks + spare tire
    for (const rz of [-0.8, 0.6]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), frameM);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.56, rz);
      carG.add(bar);
    }
    const spare = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.14, 8, 16), std(0x1c1c20, 0.9));
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.72, -0.1);
    carG.add(spare);
    // wheels — one whitewall donor
    for (let i = 0; i < 4; i++) {
      const wx = i % 2 ? 0.95 : -0.95, wz = i < 2 ? 1.4 : -1.4;
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.14, 8, 16), std(0x1c1c20, 0.9));
      tire.rotation.y = Math.PI / 2;
      tire.position.set(wx, 0.38, wz);
      tire.castShadow = true;
      carG.add(tire);
      if (i === 1) {
        const ww = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 14), std(0xd9d4c4, 0.7));
        ww.rotation.y = Math.PI / 2;
        ww.position.set(wx + 0.1, 0.38, wz);
        carG.add(ww);
      }
    }
  }
  carG.position.set(2.7, 0, -15);
  carG.rotation.y = 0.07;
  scene.add(carG);
  colliders.push({ minX: 1.6, maxX: 3.8, minZ: -17.3, maxZ: -12.7 });

  // barrel fire drum + crates + a lean-to
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 14), new THREE.MeshStandardMaterial({ map: rustTex(), roughness: 0.85 }));
  drum.position.set(-4.4, 0.5, -34);
  drum.castShadow = true;
  scene.add(drum);
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), scrapMats[i % 3]);
    crate.position.set(-4.6 + rnd() * 0.7, 0.35 + (i === 2 ? 0.7 : 0), -37 - rnd());
    crate.rotation.y = rnd();
    crate.castShadow = true;
    scene.add(crate);
  }
  colliders.push({ minX: -5.3, maxX: -3.8, minZ: -38.6, maxZ: -33.4 });

  // dust motes in the warm light
  const dustN = 260;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dp[i * 3] = (rnd() - 0.5) * 12;
    dp[i * 3 + 1] = 0.3 + rnd() * 6;
    dp[i * 3 + 2] = 8 - rnd() * (L + 8);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xf5e0b8, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }));
  scene.add(dust);

  // walkers: layered patched clothes
  interface Walker { g: THREE.Group; legL: THREE.Group; legR: THREE.Group; lane: number; z: number; dir: number; sp: number; ph: number }
  function person(coat: number, pants: number, skin: number, patchC: number): Walker['g'] & any {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.66, 0.28), std(coat, 0.95));
    torso.position.y = 1.05;
    g.add(torso);
    // sewn patches
    for (let i = 0; i < 2; i++) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), std(patchC, 0.95));
      patch.position.set((rnd() - 0.5) * 0.3, 0.9 + rnd() * 0.3, -0.145);
      g.add(patch);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), std(skin, 0.8));
    head.scale.set(0.9, 1.05, 0.95);
    head.position.y = 1.55;
    g.add(head);
    // knit cap
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, 1.3), std(coat === 0x5c6b5a ? 0xb0604a : 0x5c6b5a, 0.95));
    cap.position.y = 1.6;
    g.add(cap);
    const limb = (x: number, y: number, len: number, mat: THREE.Material) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, len - 0.14, 4, 8), mat);
      seg.position.y = -len / 2;
      pivot.add(seg);
      g.add(pivot);
      return pivot;
    };
    const armL = limb(-0.31, 1.32, 0.6, std(coat, 0.95));
    const armR = limb(0.31, 1.32, 0.6, std(coat, 0.95));
    const legL = limb(-0.13, 0.75, 0.75, std(pants, 0.95));
    const legR = limb(0.13, 0.75, 0.75, std(pants, 0.95));
    g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    return Object.assign(g, { armL, armR, legL, legR });
  }
  const walkers: (Walker & { armL: THREE.Group; armR: THREE.Group })[] = [];
  const folks: [number, number, number, number][] = [
    [0x5c6b5a, 0x4a4438, 0xd9a97c, 0xb0604a],
    [0x8a5a3a, 0x3a342c, 0xc98a5e, 0x2e6ba8],
    [0x6b5236, 0x4a4438, 0xf2c9a0, 0x9a8262],
    [0x4a5261, 0x3a342c, 0xd9a97c, 0xd9c49a],
    [0x7a5a52, 0x44403a, 0xc98a5e, 0x5c6b5a],
  ];
  folks.forEach(([c, p, s, pc], i) => {
    const g = person(c, p, s, pc);
    const lane = (i % 2 ? 1 : -1) * (4.9 + (i % 3) * 0.4);
    g.position.set(lane, 0.05, 4 - i * 15);
    scene.add(g);
    walkers.push({ g, legL: g.legL, legR: g.legR, armL: g.armL, armR: g.armR, lane, z: 4 - i * 15, dir: i % 2 ? 1 : -1, sp: 0.85 + (i % 3) * 0.3, ph: i * 2.1 });
  });

  const rig = new FPRig(cam, { x: -1.2, z: 9, yaw: 0 }, { bounds: { minX: -6.0, maxX: 6.0, minZ: -L + 4, maxZ: 12 }, colliders, speed: 3.2, bob: 0.05 });

  return {
    key: 'patchwork', name: 'F·2 — Scrapyard',
    feel: 'Studio F, variation 2 — nothing is one piece: a street nailed together from scraps.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
      r.shadowMap.enabled = true;
      scene.environment = makeEnv(r, '#b8a88a', '#e8d0a8', '#5a4a38');
      scene.environmentIntensity = 0.4;
    },
    update(dt, t, input) {
      rig.update(dt, input);
      for (const w of walkers) {
        w.z += w.dir * w.sp * dt;
        if (w.z < -L + 6) { w.z = -L + 6; w.dir = 1; }
        if (w.z > 10) { w.z = 10; w.dir = -1; }
        const s2 = Math.sin(t * 5.2 * w.sp + w.ph);
        w.g.position.set(w.lane, 0.05 + Math.abs(s2) * 0.04, w.z);
        w.g.rotation.y = w.dir < 0 ? 0 : Math.PI;
        w.legL.rotation.x = s2 * 0.5;
        w.legR.rotation.x = -s2 * 0.5;
        w.armL.rotation.x = -s2 * 0.4;
        w.armR.rotation.x = s2 * 0.4;
      }
      // rag flags flutter
      scene.traverse((o) => {
        if (o.name.startsWith('rag')) {
          o.rotation.x = Math.sin(t * 2.2 + o.position.z) * 0.3;
          o.rotation.y = Math.sin(t * 1.4 + o.position.z * 2) * 0.15;
        }
      });
      // dust drifts
      const p = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < dustN; i++) {
        p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * 0.0012);
        let y = p.getY(i) + Math.cos(t * 0.4 + i * 2) * 0.0008;
        if (y > 6.5) y = 0.3;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    },
  };
}

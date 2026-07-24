import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, skyTex, makeEnv, type AABB } from './fp';

// Studio B, variation 1 — BLOB STREET. The construction rule: no boxes, no
// planes, no straight edges. Every single thing is fused from spheres —
// buildings are stacked melting blobs with drips at the eaves, trees are blob
// clusters on bent stalks, the car is a blob mass, people are blob stacks.
// The whole street sits in its own melt-pools.

const L = 92;
const FACE = 6.4;

let seed = 515 >>> 0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const soft = (c: number, rough = 0.34) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.02 });

function blob(mat: THREE.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// a hanging drip: teardrop lathe
function drip(mat: THREE.Material, len: number): THREE.Mesh {
  const pts = [
    [0, 0], [0.05, -len * 0.15], [0.11, -len * 0.45], [0.09, -len * 0.75], [0.03, -len * 0.95], [0, -len],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mat);
  m.castShadow = true;
  return m;
}

export function makeMelt(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(86, 1, 0.1, 300);
  scene.background = skyTex([[0, '#8fc7ee'], [0.6, '#cde9f7'], [1, '#fdeee4']]);
  scene.fog = new THREE.Fog(0xd8ecf5, 38, 160);

  const sun = new THREE.DirectionalLight(0xfff2dc, 1.75);
  sun.position.set(-24, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -65; sc.right = 65; sc.top = 65; sc.bottom = -65; sc.far = 200;
  sun.shadow.bias = -0.0004;
  scene.add(sun, new THREE.HemisphereLight(0xc5e6f5, 0xe0b9a0, 0.85), new THREE.AmbientLight(0xdcecf5, 0.35));

  // ground: two soft tones; the road itself is a long flattened blob
  const groundM = soft(0xf0e4d2, 0.7);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, L + 44), groundM);
  ground.rotation.x = -Math.PI / 2; ground.position.z = -L / 2 + 12; ground.receiveShadow = true;
  scene.add(ground);
  const roadBlob = blob(soft(0x8a94b0, 0.5), 1, 0, -3.7, -L / 2 + 12, 4.6, 3.75, (L + 44) / 2);
  roadBlob.receiveShadow = true;
  scene.add(roadBlob);
  // dashes: little white blobs down the middle
  for (let z = 8; z > -L; z -= 5) {
    scene.add(blob(soft(0xfdf6ea, 0.5), 0.34, 0, 0.06, z, 1, 0.16, 2.2));
  }

  // breathing registries
  const breathers: { m: THREE.Mesh; base: THREE.Vector3; ph: number; amp: number }[] = [];
  const drips: { m: THREE.Mesh; ph: number }[] = [];

  // buildings: stacked fused blobs sitting in their own melt pools
  const palette = [0xf28d7e, 0x63c6ba, 0xf5d178, 0x9aa8ec, 0xf2a9c4, 0xa8d98a];
  let bi = 0;
  for (const side of [-1, 1]) {
    let z = 12;
    while (z > -L) {
      const w = 7 + (bi % 3) * 1.8;
      const h = 8 + ((bi * 5) % 4) * 2.2;
      const cz = z - w / 2;
      const c = palette[bi % palette.length];
      const mat = soft(c);
      const cx = side * (FACE + w * 0.28);
      const r = w * 0.42;
      // vertical stack of fused blobs — radii taper, deep overlap
      const nStack = 3 + (bi % 2);
      for (let k = 0; k < nStack; k++) {
        const u = k / (nStack - 1);
        const br = r * (1 - u * 0.22);
        const by = 0.4 + u * (h - r * 0.8);
        const b = blob(mat, br, cx + Math.sin(k * 2.1 + bi) * 0.3, by, cz + Math.cos(k * 1.7 + bi) * 0.3, 1.06, 0.85, w / (r * 2) + 0.15);
        scene.add(b);
      }
      // crown blob (slightly different tone, like a melted cap)
      const capMat = soft(0xfdf3e6, 0.42);
      const cap = blob(capMat, r * 0.72, cx, h + 0.3, cz, 1.15, 0.5, w / (r * 2) + 0.2);
      scene.add(cap);
      // drips hanging off the street-facing eave
      for (let d = 0; d < 3; d++) {
        const dp = drip(capMat, 0.8 + rnd() * 1.4);
        dp.position.set(side * (FACE - 0.15), h + 0.25, cz - w / 2 + (d + 0.5) * (w / 3));
        drips.push({ m: dp, ph: bi * 2 + d });
        scene.add(dp);
      }
      // melt pool the building sits in — oozes onto the pavement
      const pool = blob(mat, r * 1.15, cx - side * 0.8, -r * 0.92, cz, 1.5, 1, w / (r * 2) + 0.5);
      pool.receiveShadow = true;
      scene.add(pool);
      // windows: dark blobs pressed into the middle band
      const winMat = soft(0x37405c, 0.25);
      const rows = Math.max(1, Math.floor((h - 3) / 2.6));
      const cols = Math.max(2, Math.floor(w / 2.6));
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
        const wy = 2.4 + rr * 2.6;
        if (wy > h - 1.6) continue;
        const wz = cz - w / 2 + (cc + 0.5) * (w / cols);
        const win = blob(winMat, 0.52, side * (FACE - 0.28), wy, wz, 0.4, 1.05, 0.8);
        win.castShadow = false;
        scene.add(win);
        // gooey lintel blob above each window
        const lintel = blob(mat, 0.3, side * (FACE - 0.2), wy + 0.85, wz, 0.5, 0.45, 1.3);
        lintel.castShadow = false;
        scene.add(lintel);
      }
      // door: taller pressed blob + step blob
      const door = blob(soft(0x7a5a44, 0.5), 0.7, side * (FACE - 0.25), 1.0, cz + w * 0.26, 0.4, 1.5, 0.9);
      scene.add(door);
      scene.add(blob(soft(0xfdf3e6, 0.5), 0.5, side * (FACE - 0.6), 0.12, cz + w * 0.26, 1.2, 0.25, 1.3));
      z = cz - w / 2 - 1.1;
      bi++;
    }
  }

  // blob trees on bent stalks — THE tree made of blobs
  for (let z = 0; z > -L + 8; z -= 13) {
    const s = Math.round(z / 13) % 2 === 0 ? 1 : -1;
    const bend = (rnd() - 0.5) * 0.8;
    const pts = [
      new THREE.Vector3(s * 4.9, 0, z),
      new THREE.Vector3(s * 4.9 + bend * 0.4, 1.1, z),
      new THREE.Vector3(s * 4.9 + bend, 2.2, z + bend * 0.3),
    ];
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.22, 10, false), soft(0x9a6a48, 0.6));
    trunk.castShadow = true;
    scene.add(trunk);
    const top = pts[2];
    const leafMat = soft([0x7cc46a, 0x5ab86a, 0x8fd35a][Math.abs(Math.round(z)) % 3], 0.4);
    const cluster = [
      [0, 0.7, 0, 1.0], [0.7, 0.3, 0.3, 0.72], [-0.6, 0.4, -0.3, 0.66], [0.1, 1.35, -0.2, 0.6], [-0.3, 0.2, 0.55, 0.55],
    ];
    for (const [ox, oy, oz, br] of cluster) {
      const b = blob(leafMat, br, top.x + ox, top.y + oy, top.z + oz);
      breathers.push({ m: b, base: b.scale.clone(), ph: z + ox * 3, amp: 0.03 });
      scene.add(b);
    }
    // a couple of fruit blobs
    for (let f = 0; f < 2; f++) {
      scene.add(blob(soft(0xf28d7e, 0.3), 0.13, top.x + (rnd() - 0.5) * 1.4, top.y + rnd() * 0.9, top.z + (rnd() - 0.5) * 1.2));
    }
    // melt pool at the base
    scene.add(blob(soft(0xd9e6c9, 0.55), 0.7, s * 4.9, -0.55, z, 1.6, 0.18, 1.6));
  }

  // lamps: drooping stalks with glowing blobs, dripping light
  for (let z = -6; z > -L + 8; z -= 26) {
    const s = Math.round(z / 26) % 2 === 0 ? -1 : 1;
    const pts = [
      new THREE.Vector3(s * 4.6, 0, z),
      new THREE.Vector3(s * 4.6, 2.4, z),
      new THREE.Vector3(s * 4.6 - s * 0.8, 3.3, z),
      new THREE.Vector3(s * 4.6 - s * 1.3, 3.1, z),
    ];
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.09, 8, false), soft(0xfdf3e6, 0.45));
    stalk.castShadow = true;
    scene.add(stalk);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffe9a8, emissiveIntensity: 0.4, roughness: 0.3 });
    const g = blob(glowMat, 0.38, s * 4.6 - s * 1.3, 2.85, z, 1, 1.15, 1);
    breathers.push({ m: g, base: g.scale.clone(), ph: z, amp: 0.05 });
    scene.add(g);
    const dp = drip(glowMat, 0.5);
    dp.position.set(s * 4.6 - s * 1.3, 2.55, z);
    drips.push({ m: dp, ph: z * 1.3 });
    scene.add(dp);
  }

  // THE CAR — one fused blob mass at the kerb
  const carG = new THREE.Group();
  {
    const bodyM = soft(0x63b6d9, 0.22);
    carG.add(blob(bodyM, 1.05, 0, 0.78, 0, 1.0, 0.62, 2.05));   // main mass
    carG.add(blob(soft(0xfdf3e6, 0.3), 0.82, 0, 1.35, 0.15, 0.92, 0.6, 1.15)); // cabin
    carG.add(blob(soft(0x37405c, 0.15), 0.55, 0, 1.32, -0.72, 0.75, 0.42, 0.5)); // windshield blob
    const wheelM = soft(0x3a3a46, 0.5);
    for (const wx of [-0.85, 0.85]) for (const wz of [1.25, -1.25]) {
      carG.add(blob(wheelM, 0.42, wx, 0.34, wz, 0.6, 0.85, 1));
    }
    for (const s of [-0.4, 0.4]) carG.add(blob(soft(0xfff2c0, 0.25), 0.14, s, 0.85, -1.95));
    // the car's own melt pool
    const pool = blob(soft(0x63b6d9, 0.4), 1.2, 0, -0.24, 0, 1.5, 0.22, 2.1);
    pool.receiveShadow = true;
    carG.add(pool);
  }
  carG.position.set(2.9, 0.06, -14);
  carG.rotation.y = 0.05;
  scene.add(carG);
  // a second one down the street
  const car2 = carG.clone();
  car2.position.set(-2.9, 0.06, -52);
  car2.rotation.y = Math.PI - 0.04;
  car2.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.color.getHex() === 0x63b6d9) o.material = soft(0xf2a9c4, o.material.roughness); });
  scene.add(car2);

  // people: bouncing blob stacks
  function blobPerson(shirt: number, skin: number): THREE.Group {
    const g = new THREE.Group();
    const sM = soft(shirt, 0.4);
    g.add(blob(sM, 0.42, 0, 0.62, 0, 1, 1.15, 0.85));          // body
    g.add(blob(soft(skin, 0.35), 0.3, 0, 1.42, 0, 1, 1.05, 1)); // head
    g.add(blob(sM, 0.14, -0.42, 0.72, 0, 1, 1.5, 1));           // arms
    g.add(blob(sM, 0.14, 0.42, 0.72, 0, 1, 1.5, 1));
    g.add(blob(soft(0x37405c, 0.4), 0.18, -0.15, 0.1, 0.05, 1.1, 0.5, 1.4)); // feet
    g.add(blob(soft(0x37405c, 0.4), 0.18, 0.15, 0.1, 0.05, 1.1, 0.5, 1.4));
    return g;
  }
  const walkers: { g: THREE.Group; lane: number; z: number; dir: number; sp: number; ph: number }[] = [];
  const looks: [number, number][] = [
    [0xf28d7e, 0xf5d1b0], [0x63c6ba, 0xe0b494], [0xf5d178, 0xf5d1b0],
    [0x9aa8ec, 0xd9a586], [0xa8d98a, 0xf5d1b0], [0xf2a9c4, 0xe0b494],
  ];
  looks.forEach(([sh, sk], i) => {
    const g = blobPerson(sh, sk);
    const lane = (i % 2 ? 1 : -1) * (5.0 + (i % 3) * 0.45);
    g.position.set(lane, 0.05, 4 - i * 13);
    scene.add(g);
    walkers.push({ g, lane, z: 4 - i * 13, dir: i % 2 ? 1 : -1, sp: 0.9 + (i % 3) * 0.3, ph: i * 1.9 });
  });

  const colliders: AABB[] = [
    { minX: FACE - 0.6, maxX: FACE + 9, minZ: -L - 10, maxZ: 20 },
    { minX: -FACE - 9, maxX: -FACE + 0.6, minZ: -L - 10, maxZ: 20 },
    { minX: 1.6, maxX: 4.2, minZ: -16.4, maxZ: -11.6 },
    { minX: -4.2, maxX: -1.6, minZ: -54.4, maxZ: -49.6 },
  ];
  const rig = new FPRig(cam, { x: -1.3, z: 9, yaw: 0 }, { bounds: { minX: -6.1, maxX: 6.1, minZ: -L + 4, maxZ: 11 }, colliders, speed: 3.4, bob: 0.05 });

  return {
    key: 'melt', name: 'B·1 — Blob Street',
    feel: 'Studio B, variation 1 — no boxes exist: everything is fused blobs, and it all melts a little.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
      r.shadowMap.enabled = true;
      scene.environment = makeEnv(r, '#8fc7ee', '#fdeee4', '#e0b9a0');
      scene.environmentIntensity = 0.7;
    },
    update(dt, t, input) {
      rig.update(dt, input);
      for (const w of walkers) {
        w.z += w.dir * w.sp * dt;
        if (w.z < -L + 6) { w.z = -L + 6; w.dir = 1; }
        if (w.z > 10) { w.z = 10; w.dir = -1; }
        const b = Math.sin(t * 5.5 * w.sp + w.ph);
        w.g.position.set(w.lane, 0.05 + Math.abs(b) * 0.14, w.z);
        w.g.rotation.y = w.dir < 0 ? 0 : Math.PI;
        w.g.scale.y = 1 + b * 0.06;
        w.g.scale.x = 1 - b * 0.04;
      }
      // the world breathes
      for (const br of breathers) {
        const s2 = 1 + Math.sin(t * 1.3 + br.ph) * br.amp;
        br.m.scale.set(br.base.x * s2, br.base.y * (2 - s2), br.base.z * s2);
      }
      // drips slowly stretch and rebound
      for (const d of drips) {
        d.m.scale.y = 1 + Math.max(0, Math.sin(t * 0.7 + d.ph)) * 0.35;
      }
    },
  };
}

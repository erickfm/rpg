import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, skyTex, makeEnv, sagPoints, type AABB } from './fp';

// Studio B — TOYBOX (restored: the original moulded-plastic kit, now the
// Tabletown finalist). Extruded rounded blocks with bevelled rims, lathe
// lamps, capsule minifigs, profile-extruded cars, balloon cart.

const L = 96;
const FACE = 6.2;

const gloss = (c: number, rough = 0.42) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.04 });

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x, y + r);
  s.lineTo(x, y + h - r); s.quadraticCurveTo(x, y + h, x + r, y + h);
  s.lineTo(x + w - r, y + h); s.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  s.lineTo(x + w, y + r); s.quadraticCurveTo(x + w, y, x + w - r, y);
  s.lineTo(x + r, y); s.quadraticCurveTo(x, y, x, y + r);
  return s;
}

function toyBlock(w: number, h: number, d: number, c: number, rough = 0.45): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, Math.min(w, d) * 0.18), {
    depth: h, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 3, curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, gloss(c, rough));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function toyPane(mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRect(1.15, 1.45, 0.34), {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, curveSegments: 6,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  return m;
}

function latheLamp(globeMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const profile = [
    [0.0, 0], [0.3, 0], [0.32, 0.1], [0.14, 0.28], [0.1, 1.4], [0.08, 2.9], [0.16, 3.15], [0.1, 3.35], [0.0, 3.4],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const post = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), gloss(0xfff4e0, 0.5));
  post.castShadow = true;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), globeMat);
  globe.position.y = 3.75;
  g.add(post, globe);
  return g;
}

function toyCar(c: number, roofC: number): THREE.Group {
  const g = new THREE.Group();
  const p = new THREE.Shape();
  p.moveTo(-1.7, 0.3);
  p.lineTo(-1.7, 0.62); p.quadraticCurveTo(-1.68, 0.86, -1.3, 0.9);
  p.lineTo(-0.85, 0.95); p.quadraticCurveTo(-0.6, 1.55, 0.05, 1.58);
  p.quadraticCurveTo(0.7, 1.55, 0.95, 1.0);
  p.lineTo(1.6, 0.92); p.quadraticCurveTo(1.72, 0.85, 1.7, 0.6);
  p.lineTo(1.7, 0.3);
  p.closePath();
  const geo = new THREE.ExtrudeGeometry(p, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -0.95);
  geo.rotateY(Math.PI / 2);
  const body = new THREE.Mesh(geo, gloss(c, 0.28));
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 1.75, 14, 1, false, 0, Math.PI), gloss(0xbfe9fb, 0.15));
  glass.rotation.z = Math.PI / 2; glass.rotation.y = Math.PI / 2;
  glass.position.set(0, 1.02, -0.1);
  glass.scale.set(1, 1, 0.8);
  g.add(glass);
  const roof = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), gloss(roofC, 0.35));
  roof.position.set(0, 1.28, -0.05);
  roof.scale.set(1.05, 0.6, 1.15);
  roof.castShadow = true;
  g.add(roof);
  for (const wx of [-0.98, 0.98]) for (const wz of [1.05, -1.05]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.2, 12, 20), gloss(0x2b2b30, 0.75));
    tire.rotation.y = Math.PI / 2;
    tire.position.set(wx, 0.45, wz);
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), gloss(0xfff4e0, 0.35));
    hub.scale.x = 0.5;
    hub.position.set(wx, 0.45, wz);
    g.add(tire, hub);
  }
  for (const s of [-0.5, 0.5]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xfff3c2, emissiveIntensity: 0.3, roughness: 0.3 }));
    eye.position.set(s, 0.75, -1.86);
    g.add(eye);
  }
  return g;
}

interface Fig { g: THREE.Group; armL: THREE.Group; armR: THREE.Group; lane: number; z: number; dir: number; sp: number; ph: number }
function minifig(shirt: number, skin: number, hair: number): { g: THREE.Group; armL: THREE.Group; armR: THREE.Group } {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 14), gloss(shirt, 0.5));
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), gloss(skin, 0.4));
  head.position.y = 1.42;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 18, 12, 0, Math.PI * 2, 0, 1.45), gloss(hair, 0.6));
  hairCap.position.y = 1.46;
  g.add(body, head, hairCap);
  const eyeM = gloss(0x24242a, 0.3);
  for (const ex of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), eyeM);
    eye.position.set(ex, 1.45, -0.245);
    g.add(eye);
  }
  const mkArm = (s: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.34, 1.05, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 10), gloss(shirt, 0.5));
    arm.position.y = -0.26;
    pivot.add(arm);
    g.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 10), gloss(0x3a5a8c, 0.6));
    leg.position.set(s * 0.14, 0.28, 0);
    g.add(leg);
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return { g, armL, armR };
}

function build(night: boolean): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(86, 1, 0.1, 300);
  if (night) {
    scene.background = skyTex([[0, '#101a3e'], [0.6, '#22305e'], [1, '#39498a']]);
    scene.fog = new THREE.Fog(0x252f5c, 26, 145);
  } else {
    scene.background = skyTex([[0, '#8fd0f8'], [0.65, '#cdedfc'], [1, '#f0faff']]);
    scene.fog = new THREE.Fog(0xd8f0fb, 42, 175);
  }

  const sun = new THREE.DirectionalLight(night ? 0x9ab0e8 : 0xfff0d0, night ? 0.5 : 1.85);
  sun.position.set(night ? 24 : -26, 42, night ? -14 : 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.far = 200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  if (night) scene.add(new THREE.HemisphereLight(0x4a5a9a, 0x2a2438, 0.65), new THREE.AmbientLight(0x3a4470, 0.6));
  else scene.add(new THREE.HemisphereLight(0xbfe9fb, 0xe8c9a0, 0.9), new THREE.AmbientLight(0xd8f0fb, 0.35));

  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, L + 40), gloss(night ? 0x3c445c : 0x6b7684, 0.8));
  road.rotation.x = -Math.PI / 2; road.position.z = -L / 2 + 14; road.receiveShadow = true;
  scene.add(road);
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.26, L + 40), gloss(night ? 0x8a86a0 : 0xf7ecd9, 0.7));
    walk.position.set(s * 5.65, 0.13, -L / 2 + 14);
    walk.receiveShadow = true;
    scene.add(walk);
    const curbProfile = new THREE.Shape();
    curbProfile.moveTo(0, 0); curbProfile.lineTo(0.24, 0); curbProfile.quadraticCurveTo(0.24, 0.26, 0, 0.26); curbProfile.closePath();
    const curbGeo = new THREE.ExtrudeGeometry(curbProfile, { depth: L + 40, bevelEnabled: false, curveSegments: 6 });
    const curb = new THREE.Mesh(curbGeo, gloss(night ? 0x767290 : 0xe8dcc2, 0.7));
    curb.rotation.y = s > 0 ? Math.PI : 0;
    curb.position.set(s * 4.5, 0, s > 0 ? -L / 2 + 14 + (L + 40) / 2 : -L / 2 + 14 - (L + 40) / 2);
    curb.receiveShadow = true;
    scene.add(curb);
  }
  for (let z = 8; z > -L; z -= 5.5) {
    const dash = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.6, 4, 8), gloss(night ? 0xb8b4d0 : 0xfff6d8, 0.6));
    dash.rotation.x = Math.PI / 2;
    dash.scale.y = 0.18;
    dash.position.set(0, 0.03, z);
    scene.add(dash);
  }
  for (let k = -2; k <= 2; k++) {
    const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 2.0, 4, 10), gloss(0xffffff, 0.6));
    stripe.rotation.z = Math.PI / 2; stripe.rotation.y = Math.PI / 2;
    stripe.scale.y = 0.06;
    stripe.position.set(k * 1.5, 0.02, 1.5);
    scene.add(stripe);
  }

  const dayPane = gloss(0x9adcf5, 0.3);
  const litPane = new THREE.MeshStandardMaterial({ color: 0x9a7a4a, emissive: 0xffd98e, emissiveIntensity: 0.85, roughness: 0.4 });
  const darkPane = gloss(0x2c3452, 0.35);

  const palette = [0xff7a66, 0x35c1b5, 0xffcf4d, 0x7f96e8, 0xff9ec2, 0x8fd35a];
  const trim = 0xfff4e0;
  let bi = 0;
  for (const side of [-1, 1]) {
    let z = 12;
    while (z > -L) {
      const w = 7.5 + (bi % 3) * 1.6;
      const h = 6.5 + ((bi * 5) % 4) * 1.7;
      const cz = z - w / 2;
      const c = palette[bi % palette.length];
      const x = side * (FACE + 1.9);
      const block = toyBlock(4, h, w, c);
      block.position.set(x, 0, cz);
      scene.add(block);
      const roofKind = bi % 4;
      if (roofKind === 0) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(2.2, w * 0.3), 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), gloss(trim, 0.4));
        dome.position.set(x, h + 0.15, cz);
        dome.castShadow = true;
        scene.add(dome);
      } else if (roofKind === 1) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.9, 16), gloss(palette[(bi + 3) % palette.length], 0.5));
        cone.position.set(x, h + 1.05, cz);
        cone.castShadow = true;
        scene.add(cone);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), gloss(trim, 0.4));
        knob.position.set(x, h + 2.1, cz);
        scene.add(knob);
      } else if (roofKind === 2) {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.5, 16), gloss(trim, 0.5));
        turret.position.set(x, h + 0.85, cz - w * 0.22);
        turret.castShadow = true;
        scene.add(turret);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gloss(palette[(bi + 2) % palette.length], 0.45));
        cap.position.set(x, h + 1.6, cz - w * 0.22);
        cap.castShadow = true;
        scene.add(cap);
      }
      const rows = Math.max(1, Math.floor((h - 2.4) / 2.4));
      const cols = Math.max(2, Math.floor(w / 2.5));
      for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
        const wy = 2.3 + r * 2.4;
        if (wy > h - 1.1) continue;
        const wz = cz - w / 2 + (cc + 0.5) * (w / cols);
        const lit = night && ((bi * 13 + r * 7 + cc * 5) % 5) < 2;
        const pane = toyPane(night ? (lit ? litPane : darkPane) : dayPane);
        pane.rotation.y = -side * Math.PI / 2;
        pane.position.set(side * (FACE - 0.02), wy, wz);
        scene.add(pane);
      }
      const arch = new THREE.Shape();
      arch.moveTo(-0.65, 0); arch.lineTo(-0.65, 1.1); arch.quadraticCurveTo(-0.65, 1.85, 0, 1.85);
      arch.quadraticCurveTo(0.65, 1.85, 0.65, 1.1); arch.lineTo(0.65, 0); arch.closePath();
      const doorGeo = new THREE.ExtrudeGeometry(arch, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8 });
      const door = new THREE.Mesh(doorGeo, gloss(trim, 0.5));
      door.rotation.y = -side * Math.PI / 2;
      door.position.set(side * (FACE - 0.02), 0.2, cz + w * 0.28);
      scene.add(door);
      const doorInner = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.1, bevelEnabled: false, curveSegments: 8 }), gloss(0x7a5236, 0.6));
      doorInner.scale.set(0.78, 0.82, 1);
      doorInner.rotation.y = -side * Math.PI / 2;
      doorInner.position.set(side * (FACE - 0.12), 0.2, cz + w * 0.28);
      scene.add(doorInner);
      if (bi % 3 === 0) {
        const awn = new THREE.Group();
        const ac = palette[(bi + 2) % palette.length];
        for (let k = 0; k < 4; k++) {
          const scallop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI), gloss(k % 2 ? 0xffffff : ac, 0.55));
          scallop.rotation.x = Math.PI / 2;
          scallop.position.set(0, 0, (k - 1.5) * 0.62);
          awn.add(scallop);
        }
        const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 12, 1, false, 0, Math.PI / 2.2), gloss(ac, 0.55));
        canopy.rotation.z = Math.PI / 2;
        canopy.position.set(-side * 0.1, 0.5, 0);
        awn.add(canopy);
        awn.rotation.y = side > 0 ? Math.PI : 0;
        awn.position.set(side * (FACE - 0.5), 2.25, cz + w * 0.28);
        scene.add(awn);
      }
      z = cz - w / 2 - 0.7;
      bi++;
    }
  }

  const globeDay = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffedb5, emissiveIntensity: 0.22, roughness: 0.3 });
  const globeNight = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe4a0, emissiveIntensity: 1.5, roughness: 0.3 });
  for (let z = 4; z > -L + 10; z -= 16) {
    for (const s of [-1, 1]) {
      if ((Math.round(z / 16) + (s > 0 ? 1 : 0)) % 2 === 0) {
        const lamp = latheLamp(night ? globeNight : globeDay);
        lamp.position.set(s * 4.9, 0.26, z);
        scene.add(lamp);
        if (night) {
          const pl = new THREE.PointLight(0xffdf9a, 15, 14, 1.7);
          pl.position.set(s * 4.9, 4.0, z);
          scene.add(pl);
        }
      } else {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 12), gloss(0x9a6a42, 0.7));
        trunk.position.set(s * 4.9, 1.0, z);
        trunk.castShadow = true;
        scene.add(trunk);
        for (let k = 0; k < 3; k++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.85 - k * 0.16, 16, 12), gloss(night ? (k === 1 ? 0x3a7a5c : 0x2f6b4e) : (k === 1 ? 0x6fcf7e : 0x59c26a), 0.6));
          puff.position.set(s * 4.9 + Math.sin(k * 2.4) * 0.4, 2.3 + k * 0.65, z + Math.cos(k * 2.4) * 0.35);
          puff.castShadow = true;
          scene.add(puff);
        }
        for (let f = 0; f < 5; f++) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), gloss([0xff9ec2, 0xffcf4d, 0xff7a66][f % 3], 0.5));
          bloom.position.set(s * 4.9 + Math.sin(f * 1.26) * 0.55, 0.32, z + Math.cos(f * 1.26) * 0.55);
          scene.add(bloom);
        }
      }
    }
  }

  const cart = new THREE.Group();
  cart.add(toyBlock(1.3, 1.0, 0.9, 0xffffff, 0.5));
  const cartRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 12, 1, false, 0, Math.PI), gloss(0xff7a66, 0.55));
  cartRoof.rotation.z = Math.PI / 2;
  cartRoof.position.y = 1.55;
  cart.add(cartRoof);
  for (const wx of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 10, 16), gloss(0x3a5a8c, 0.6));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(wx, 0.22, 0.5);
    cart.add(wheel);
  }
  const balloons: THREE.Group[] = [];
  [0xff5a6e, 0xffcf4d, 0x35c1b5, 0x7f96e8, 0xff9ec2].forEach((bc, i) => {
    const bg = new THREE.Group();
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4), gloss(0xffffff, 0.8));
    string.position.y = 0.8;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), gloss(bc, 0.25));
    ball.scale.y = 1.15;
    ball.position.y = 1.75;
    ball.castShadow = true;
    bg.add(string, ball);
    bg.position.set((i - 2) * 0.22, 1.1, -0.2 + (i % 2) * 0.3);
    cart.add(bg);
    balloons.push(bg);
  });
  cart.position.set(-4.5, 0.26, -33);
  cart.rotation.y = 0.4;
  scene.add(cart);

  const car = toyCar(night ? 0xd9b23a : 0xe84a4a, 0xfff4e0);
  car.position.set(2.95, 0.12, -14);
  car.rotation.y = 0.04;
  scene.add(car);
  const car2 = toyCar(night ? 0x466bb0 : 0x7f96e8, 0xffffff);
  car2.position.set(-2.95, 0.12, -56);
  car2.rotation.y = Math.PI - 0.05;
  scene.add(car2);

  let fireflies: THREE.Points | null = null;
  let flPhase: Float32Array | null = null;
  if (night) {
    const moon = new THREE.Mesh(new THREE.CircleGeometry(3.4, 26), new THREE.MeshBasicMaterial({ color: 0xf5f0dc, fog: false }));
    moon.position.set(9, 30, -150);
    scene.add(moon);
    const starGeo = new THREE.BufferGeometry();
    const spts = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      spts[i * 3] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 200 - 100;
      spts[i * 3 + 1] = 24 + Math.abs(Math.sin(i * 78.233) * 43758.5453 % 1) * 50;
      spts[i * 3 + 2] = -20 - Math.abs(Math.sin(i * 39.425) * 43758.5453 % 1) * 150;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(spts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.28, fog: false })));
    const bulbCols = [0xff5a6e, 0xffcf4d, 0x35c1b5, 0x7f96e8, 0xff9ec2];
    for (const czz of [-6, -30, -54, -78]) {
      const pts = sagPoints(new THREE.Vector3(-FACE, 6.4, czz), new THREE.Vector3(FACE, 6.4, czz + 1), 1.0, 20);
      pts.forEach((p2, i) => {
        if (i % 2 === 0) {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: bulbCols[(i / 2) % 5 | 0], emissive: bulbCols[(i / 2) % 5 | 0], emissiveIntensity: 1.6, roughness: 0.4 }));
          bulb.position.copy(p2);
          scene.add(bulb);
        }
      });
      const curve = new THREE.CatmullRomCurve3(pts);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.012, 4, false), gloss(0x2a2a3a, 0.8));
      scene.add(wire);
    }
    const fn = 44;
    const fgeo = new THREE.BufferGeometry();
    const fp = new Float32Array(fn * 3);
    flPhase = new Float32Array(fn);
    for (let i = 0; i < fn; i++) {
      fp[i * 3] = (i % 2 ? 1 : -1) * (3.5 + (i * 7 % 20) / 10);
      fp[i * 3 + 1] = 0.6 + (i * 13 % 20) / 8;
      fp[i * 3 + 2] = 4 - (i * 29 % 88);
      flPhase[i] = i * 0.77;
    }
    fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fireflies = new THREE.Points(fgeo, new THREE.PointsMaterial({ color: 0xd9ff8a, size: 0.14, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(fireflies);
  }

  const walkers: Fig[] = [];
  const looks: [number, number, number][] = night
    ? [[0x8a7ab8, 0xf2c9a0, 0x5a3a24], [0x466bb0, 0xd9a97c, 0x20160e], [0xb05a70, 0xf2c9a0, 0x8c5a2e], [0x3a8a80, 0xc98a5e, 0x2e2018]]
    : [[0xff9ec2, 0xf2c9a0, 0x5a3a24], [0x35c1b5, 0xd9a97c, 0x20160e], [0xffcf4d, 0xf2c9a0, 0x8c5a2e], [0x7f96e8, 0xc98a5e, 0x2e2018], [0x8fd35a, 0xf2c9a0, 0xd9c25a], [0xff7a66, 0xd9a97c, 0x3a2c20]];
  looks.forEach(([sh, sk, hr], i) => {
    const { g, armL, armR } = minifig(sh, sk, hr);
    const lane = (i % 2 ? 1 : -1) * (5.3 + (i % 3) * 0.4);
    g.position.set(lane, 0.3, 4 - i * 14);
    scene.add(g);
    if (night && i === 0) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), gloss(0x9a6a42, 0.7));
      stick.position.set(0, -0.4, -0.1);
      stick.rotation.x = 0.5;
      const glowBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe8a0, emissiveIntensity: 2, roughness: 0.4 }));
      glowBall.position.set(0, -0.72, -0.32);
      armR.add(stick, glowBall);
      armR.rotation.x = -0.7;
      const pl = new THREE.PointLight(0xffdf9a, 6, 6, 1.8);
      pl.position.set(0, -0.7, -0.35);
      armR.add(pl);
    }
    walkers.push({ g, armL, armR, lane, z: 4 - i * 14, dir: i % 2 ? 1 : -1, sp: (night ? 0.8 : 1.0) + (i % 3) * 0.3, ph: i * 1.7 });
  });

  const colliders: AABB[] = [
    { minX: FACE, maxX: FACE + 8, minZ: -L - 10, maxZ: 20 },
    { minX: -FACE - 8, maxX: -FACE, minZ: -L - 10, maxZ: 20 },
    { minX: 1.7, maxX: 4.2, minZ: -16, maxZ: -12 },
    { minX: -4.2, maxX: -1.7, minZ: -58, maxZ: -54 },
    { minX: -5.4, maxX: -3.6, minZ: -34, maxZ: -32 },
  ];
  const rig = new FPRig(cam, { x: -1.2, z: 9, yaw: 0 }, { bounds: { minX: -6.5, maxX: 6.5, minZ: -L + 4, maxZ: 12 }, colliders, speed: 3.6, bob: 0.05 });

  return {
    key: night ? 'toybox-night' : 'toybox-day',
    name: night ? 'Tabletown — After Bedtime' : 'Tabletown (Studio B)',
    feel: night
      ? 'Studio B — the playset after dark: fairy lights, lit windows, fireflies.'
      : 'Studio B finalist — the moulded playset: bevelled blocks, dome roofs, a balloon cart.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = night ? 1.2 : 1.12;
      r.shadowMap.enabled = true;
      scene.environment = night ? makeEnv(r, '#39498a', '#22305e', '#101a3e') : makeEnv(r, '#bfe9fb', '#fff2d8', '#e8c9a0');
      scene.environmentIntensity = night ? 0.5 : 0.65;
    },
    update(dt, t, input) {
      rig.update(dt, input);
      for (const w of walkers) {
        w.z += w.dir * w.sp * dt;
        if (w.z < -L + 6) { w.z = -L + 6; w.dir = 1; }
        if (w.z > 10) { w.z = 10; w.dir = -1; }
        const swing = Math.sin(t * 6 * w.sp + w.ph);
        w.g.position.set(w.lane, 0.3 + Math.abs(swing) * 0.09, w.z);
        w.g.rotation.y = w.dir < 0 ? 0 : Math.PI;
        w.g.rotation.z = swing * 0.06;
        if (!(night && w === walkers[0])) {
          w.armL.rotation.x = swing * 0.7;
          w.armR.rotation.x = -swing * 0.7;
        } else {
          w.armL.rotation.x = swing * 0.7;
        }
      }
      balloons.forEach((b, i) => {
        b.rotation.x = Math.sin(t * 0.9 + i * 1.3) * 0.09;
        b.rotation.z = Math.cos(t * 0.7 + i * 0.9) * 0.09;
      });
      if (fireflies && flPhase) {
        const p = fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < flPhase.length; i++) {
          p.setX(i, p.getX(i) + Math.sin(t * 0.6 + flPhase[i]) * 0.004);
          p.setY(i, p.getY(i) + Math.cos(t * 0.8 + flPhase[i] * 2) * 0.003);
        }
        p.needsUpdate = true;
        (fireflies.material as THREE.PointsMaterial).opacity = 0.55 + Math.sin(t * 2.2) * 0.35;
      }
    },
  };
}

export const makeToyboxDay = () => build(false);
export const makeToyboxNight = () => build(true);

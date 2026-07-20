import * as THREE from 'three';
import type { PropDef } from '../world/city';
import { mulberry32 } from '../core/rng';

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
const POLE = lambert(0x3a3d42);
const WOOD = lambert(0x6a533f);
const METAL = lambert(0x8a8e96);
const FLAT_GREEN = new THREE.MeshPhongMaterial({ color: 0x5a8c46, flatShading: true });
// Tree foliage gets its own two materials so the season system can recolor every
// tree at once (planter bushes keep the fixed greens above).
const TREE_A = new THREE.MeshPhongMaterial({ color: 0x5a8c46, flatShading: true });
const TREE_B = new THREE.MeshPhongMaterial({ color: 0x6fa053, flatShading: true });

/** Repaint every tree's leaves — the season layer drives this. */
export function setTreeFoliage(a: number, b: number): void {
  TREE_A.color.setHex(a);
  TREE_B.color.setHex(b);
}

export interface PropBuild {
  group: THREE.Group;
  /** streetlight bulbs & lamps that main dims by time of day */
  lamps: THREE.PointLight[];
  bulbs: THREE.Mesh[];
}

export function buildProp(p: PropDef): PropBuild {
  const g = new THREE.Group();
  const lamps: THREE.PointLight[] = [];
  const bulbs: THREE.Mesh[] = [];

  switch (p.kind) {
    case 'streetlight': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 8), POLE);
      pole.position.y = 3.2;
      pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), POLE);
      arm.position.set(0, 6.3, -1.0);
      const headMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.22, 1.1),
        new THREE.MeshLambertMaterial({ color: 0x2c2e33 })
      );
      headMesh.position.set(0, 6.18, -1.9);
      const bulb = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.08, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xffdf9c })
      );
      bulb.position.set(0, 6.05, -1.9);
      bulbs.push(bulb);
      const light = new THREE.PointLight(0xffc978, 0, 26, 2);
      light.position.set(0, 5.8, -1.9);
      lamps.push(light);
      g.add(pole, arm, headMesh, bulb, light);
      break;
    }
    case 'powerpole': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 8.4, 7), WOOD);
      pole.position.y = 4.2;
      pole.castShadow = true;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), WOOD);
      cross.position.y = 7.6;
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.12), WOOD);
      cross2.position.y = 6.9;
      g.add(pole, cross, cross2);
      break;
    }
    case 'tree': {
      const rng = mulberry32((p.x * 73 + p.z * 131) >>> 0 || 7);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 7), WOOD);
      trunk.position.y = 0.8;
      trunk.castShadow = true;
      g.add(trunk);
      const blobs = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < blobs; i++) {
        const r = 1.1 + rng() * 0.9;
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r, 0),
          rng() < 0.5 ? TREE_A : TREE_B
        );
        blob.position.set((rng() - 0.5) * 1.4, 2.1 + i * 0.9 + rng() * 0.4, (rng() - 0.5) * 1.4);
        blob.castShadow = true;
        g.add(blob);
      }
      break;
    }
    case 'hydrant': {
      const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.8, 8), lambert(0xb03030));
      bodyMesh.position.y = 0.4;
      bodyMesh.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 8), lambert(0xb03030));
      cap.position.y = 0.9;
      g.add(bodyMesh, cap);
      break;
    }
    case 'bench': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.55), WOOD);
      seat.position.y = 0.5;
      seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), WOOD);
      back.position.set(0, 0.85, -0.26);
      for (const sx of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.55), METAL);
        leg.position.set(sx, 0.25, 0);
        g.add(leg);
      }
      g.add(seat, back);
      break;
    }
    case 'dumpster': {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.4, 1.6), lambert(0x3c6a4a));
      bin.position.y = 0.8;
      bin.castShadow = true;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.12, 1.65), lambert(0x2f523a));
      lid.position.set(0, 1.55, 0);
      lid.rotation.x = -0.12;
      g.add(bin, lid);
      break;
    }
    case 'pump': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 2.0), lambert(0xa8a296));
      base.position.y = 0.1;
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.6), lambert(0xd84040));
      bodyMesh.position.y = 1.0;
      bodyMesh.castShadow = true;
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.04), lambert(0xe8e4d8));
      face.position.set(0, 1.35, 0.32);
      g.add(base, bodyMesh, face);
      break;
    }
    case 'canopy': {
      for (const [cx, cz] of [
        [-2.2, -3.4],
        [2.2, -3.4],
        [-2.2, 3.4],
        [2.2, 3.4],
      ]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.6, 8), METAL);
        col.position.set(cx, 2.3, cz);
        col.castShadow = true;
        g.add(col);
      }
      const slab = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 9.6), lambert(0xe8e4da));
      slab.position.y = 4.85;
      slab.castShadow = true;
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 9.7), lambert(0xc83c3c));
      band.position.y = 4.5;
      // under-canopy light
      const glow = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff2cf }));
      glow.position.y = 4.24;
      bulbs.push(glow);
      const light = new THREE.PointLight(0xfff0c0, 0, 18, 2);
      light.position.y = 3.8;
      lamps.push(light);
      g.add(slab, band, glow, light);
      break;
    }
    case 'planter': {
      const potMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 2.2), lambert(0x9a948a));
      potMesh.position.y = 0.35;
      potMesh.castShadow = true;
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), FLAT_GREEN);
      bush.position.y = 1.15;
      bush.castShadow = true;
      g.add(potMesh, bush);
      break;
    }
    case 'fountain': {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.2, 0.7, 14), lambert(0xa8a296));
      rim.position.y = 0.35;
      rim.castShadow = true;
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(2.7, 2.7, 0.5, 14),
        new THREE.MeshLambertMaterial({ color: 0x4a90b8 })
      );
      water.position.y = 0.5;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.6, 10), lambert(0x9a948a));
      spire.position.y = 1.3;
      g.add(rim, water, spire);
      break;
    }
    case 'payphone': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), METAL);
      post.position.y = 0.7;
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.28), lambert(0x2f5aa8));
      bodyMesh.position.y = 1.5;
      bodyMesh.castShadow = true;
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.36), lambert(0x24478a));
      hood.position.y = 1.94;
      const handset = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), lambert(0x16181c));
      handset.position.set(-0.28, 1.5, 0.05);
      g.add(post, bodyMesh, hood, handset);
      break;
    }
    case 'atm': {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.7), lambert(0x2c5a4a));
      cabinet.position.y = 1.0;
      cabinet.castShadow = true;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ color: 0x2a6ad0 }));
      screen.position.set(0, 1.45, 0.36);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.05), lambert(0x14161c));
      slot.position.set(0, 1.1, 0.36);
      const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.04), lambert(0x1c1c22));
      keypad.position.set(0, 0.85, 0.36);
      g.add(cabinet, screen, slot, keypad);
      break;
    }
    case 'newsbox': {
      // a curbside newspaper vending box
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.6), lambert(0x2f5aa8));
      body.position.y = 1.05;
      body.castShadow = true;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.4), METAL);
      legs.position.y = 0.28;
      // the display window with the day's front page peeking out
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.04), new THREE.MeshBasicMaterial({ color: 0xe8e2d0 }));
      window.position.set(0, 1.2, 0.31);
      const headline = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.02), lambert(0x2a2a30));
      headline.position.set(0, 1.32, 0.33);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), lambert(0x16181c));
      handle.position.set(0, 0.86, 0.31);
      g.add(body, legs, window, headline, handle);
      break;
    }
    case 'mailbox': {
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.5), lambert(0x2f5aa8));
      bodyMesh.position.y = 1.0;
      bodyMesh.castShadow = true;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), METAL);
      legs.position.y = 0.35;
      g.add(bodyMesh, legs);
      break;
    }
  }

  g.position.set(p.x, 0, p.z);
  if (p.rot) g.rotation.y = p.rot;
  return { group: g, lamps, bulbs };
}

/** Sagging wire between two pole tops. */
export function makeWire(a: THREE.Vector3, b: THREE.Vector3): THREE.Line {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= a.distanceTo(b) * 0.06;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1c1c20 }));
}

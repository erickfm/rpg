import * as THREE from 'three';
import type { CarKind } from '../world/city';

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
const GLASS = new THREE.MeshLambertMaterial({ color: 0x1d2c38 });
const CHROME = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
const TIRE = new THREE.MeshLambertMaterial({ color: 0x16181c });
const HUB = new THREE.MeshLambertMaterial({ color: 0x9a9ea6 });

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function wheel(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), TIRE);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), HUB);
  hub.rotation.z = Math.PI / 2;
  g.add(tire, hub);
  g.position.set(x, 0.38, z);
  return g;
}

/**
 * Boxy 90s cars. Local −z is forward (rot 0 drives north).
 * Length runs along z, width along x.
 */
export function makeCar(kind: CarKind, color: number): THREE.Group {
  const g = new THREE.Group();
  const body = lambert(color);

  const spec: Record<CarKind, { len: number; cabLen: number; cabOff: number; bed?: boolean }> = {
    sedan: { len: 4.6, cabLen: 2.2, cabOff: 0.15 },
    hatch: { len: 3.8, cabLen: 2.0, cabOff: 0.5 },
    wagon: { len: 4.9, cabLen: 3.0, cabOff: 0.55 },
    pickup: { len: 4.9, cabLen: 1.6, cabOff: -0.7, bed: true },
  };
  const s = spec[kind];

  // lower body
  g.add(box(1.9, 0.55, s.len, body, 0, 0.62, 0));
  // cabin with glass band
  const cabH = 0.62;
  const cab = box(1.7, cabH, s.cabLen, body, 0, 1.2, s.cabOff);
  g.add(cab);
  const glassLen = s.cabLen - 0.28;
  g.add(box(1.72, cabH - 0.24, glassLen, GLASS, 0, 1.22, s.cabOff));
  if (s.bed) {
    // pickup bed rails
    g.add(box(1.9, 0.3, 2.4, body, 0, 1.0, 1.15));
  }
  // bumpers
  g.add(box(1.95, 0.22, 0.24, CHROME, 0, 0.42, -s.len / 2 - 0.06));
  g.add(box(1.95, 0.22, 0.24, CHROME, 0, 0.42, s.len / 2 + 0.06));
  // lights
  const headMat = new THREE.MeshLambertMaterial({ color: 0xf5efc8, emissive: 0x8a8462 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xa02020, emissive: 0x4a0808 });
  for (const sx of [-0.62, 0.62]) {
    g.add(box(0.34, 0.18, 0.06, headMat, sx, 0.72, -s.len / 2 - 0.02));
    g.add(box(0.34, 0.18, 0.06, tailMat, sx, 0.72, s.len / 2 + 0.02));
  }
  // wheels
  const axle = s.len / 2 - 0.85;
  for (const [wx, wz] of [
    [-0.85, -axle],
    [0.85, -axle],
    [-0.85, axle],
    [0.85, axle],
  ]) {
    g.add(wheel(wx, wz));
  }
  return g;
}

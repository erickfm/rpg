import * as THREE from 'three';
import type { SceneCtx } from './scene';

interface Key {
  m: number;
  sky: number;
  sun: number;
  hemi: number;
  lamp: number;
}

const KEYS: Key[] = [
  { m: 0,    sky: 0x101838, sun: 0.08, hemi: 0.3,  lamp: 1.6 },
  { m: 300,  sky: 0x101838, sun: 0.08, hemi: 0.3,  lamp: 1.6 },
  { m: 420,  sky: 0xff9e6b, sun: 1.4,  hemi: 0.65, lamp: 0.6 },
  { m: 510,  sky: 0x87ceeb, sun: 2.4,  hemi: 1.0,  lamp: 0 },
  { m: 1050, sky: 0x87ceeb, sun: 2.4,  hemi: 1.0,  lamp: 0 },
  { m: 1170, sky: 0xff8c5a, sun: 1.1,  hemi: 0.55, lamp: 0.8 },
  { m: 1290, sky: 0x101838, sun: 0.08, hemi: 0.3,  lamp: 1.6 },
  { m: 1440, sky: 0x101838, sun: 0.08, hemi: 0.3,  lamp: 1.6 },
];

const skyA = new THREE.Color();
const skyB = new THREE.Color();

export function applyTimeOfDay(ctx: SceneCtx, minute: number): void {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (minute >= KEYS[i].m && minute <= KEYS[i + 1].m) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const t = b.m === a.m ? 0 : (minute - a.m) / (b.m - a.m);
  const sky = skyA.setHex(a.sky).lerp(skyB.setHex(b.sky), t);
  ctx.scene.background = sky;
  (ctx.scene.fog as THREE.Fog).color.copy(sky);
  ctx.sun.intensity = THREE.MathUtils.lerp(a.sun, b.sun, t);
  ctx.hemi.intensity = THREE.MathUtils.lerp(a.hemi, b.hemi, t);
  // physically-based point lights need candela-scale numbers
  const lampIntensity = THREE.MathUtils.lerp(a.lamp, b.lamp, t) * 130;
  for (const lamp of ctx.lamps) lamp.intensity = lampIntensity;
}

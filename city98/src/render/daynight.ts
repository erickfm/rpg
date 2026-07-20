import * as THREE from 'three';
import type { SceneCtx } from './scene';

interface Key {
  m: number;
  sky: number;
  fog: number;
  sun: number;
  sunColor: number;
  hemi: number;
  lamp: number;
  windows: number;
}

const KEYS: Key[] = [
  { m: 0,    sky: 0x0d1526, fog: 0x0d1526, sun: 0.06, sunColor: 0x8090c0, hemi: 0.34, lamp: 1.5, windows: 0.8 },
  { m: 290,  sky: 0x0d1526, fog: 0x0d1526, sun: 0.06, sunColor: 0x8090c0, hemi: 0.34, lamp: 1.5, windows: 0.8 },
  { m: 380,  sky: 0xe8956a, fog: 0xd8a888, sun: 1.0,  sunColor: 0xffc890, hemi: 0.72, lamp: 0.8, windows: 0.35 },
  { m: 480,  sky: 0x8fc0e8, fog: 0x9cc0dd, sun: 2.2,  sunColor: 0xfff0da, hemi: 0.95, lamp: 0,   windows: 0 },
  { m: 1020, sky: 0x8fc0e8, fog: 0x9cc0dd, sun: 2.2,  sunColor: 0xfff0da, hemi: 0.95, lamp: 0,   windows: 0 },
  { m: 1150, sky: 0xe07a4e, fog: 0xcf9070, sun: 1.0,  sunColor: 0xffa050, hemi: 0.68, lamp: 0.7, windows: 0.6 },
  { m: 1260, sky: 0x101a30, fog: 0x101a30, sun: 0.06, sunColor: 0x8090c0, hemi: 0.36, lamp: 1.5, windows: 0.8 },
  { m: 1440, sky: 0x0d1526, fog: 0x0d1526, sun: 0.06, sunColor: 0x8090c0, hemi: 0.34, lamp: 1.5, windows: 0.8 },
];

const colA = new THREE.Color();
const colB = new THREE.Color();

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

  ctx.scene.background = colA.setHex(a.sky).lerp(colB.setHex(b.sky), t);
  (ctx.scene.fog as THREE.Fog).color.setHex(a.fog).lerp(colB.setHex(b.fog), t);
  ctx.sun.intensity = THREE.MathUtils.lerp(a.sun, b.sun, t);
  ctx.sun.color.setHex(a.sunColor).lerp(colB.setHex(b.sunColor), t);
  ctx.hemi.intensity = THREE.MathUtils.lerp(a.hemi, b.hemi, t);

  const lamp = THREE.MathUtils.lerp(a.lamp, b.lamp, t);
  for (const l of ctx.lamps) l.intensity = lamp * 140;
  for (const bulb of ctx.bulbs) bulb.visible = lamp > 0.15;

  const windows = THREE.MathUtils.lerp(a.windows, b.windows, t);
  for (const m of ctx.nightMats) m.emissiveIntensity = windows;
}

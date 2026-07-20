import * as THREE from 'three';
import type { Season } from '../core/calendar';
import type { SceneCtx } from './scene';
import { setTreeFoliage } from './props';

interface SeasonStyle {
  foliageA: number;
  foliageB: number;
  tint: number; // pulled into the sky + fog
  tintAmt: number;
  snow: boolean;
}

const STYLE: Record<Season, SeasonStyle> = {
  autumn: { foliageA: 0xc8792f, foliageB: 0x9c4a28, tint: 0xd8934a, tintAmt: 0.12, snow: false },
  winter: { foliageA: 0xbcc6c0, foliageB: 0x93a49a, tint: 0xcdd8e6, tintAmt: 0.2, snow: true },
  spring: { foliageA: 0x74c24f, foliageB: 0x9bd873, tint: 0xc2e6a2, tintAmt: 0.08, snow: false },
  summer: { foliageA: 0x4f8c3c, foliageB: 0x6fa74a, tint: 0xf2ecc4, tintAmt: 0.06, snow: false },
};

const tintCol = new THREE.Color();

/** Nudge the world toward the current season: leaf color + a sky/fog wash.
 *  Call each frame AFTER applyTimeOfDay (which resets sky/fog) and before gloom. */
export function applySeason(ctx: SceneCtx, season: Season): void {
  const s = STYLE[season];
  setTreeFoliage(s.foliageA, s.foliageB);
  tintCol.setHex(s.tint);
  if (ctx.scene.background instanceof THREE.Color) ctx.scene.background.lerp(tintCol, s.tintAmt);
  (ctx.scene.fog as THREE.Fog).color.lerp(tintCol, s.tintAmt);
}

export function seasonHasSnow(season: Season): boolean {
  return STYLE[season].snow;
}

const SNOW_COUNT = 2600;
const SNOW_AREA = 70; // half-extent around the camera
const SNOW_TOP = 34;

/** A camera-following snow volume of drifting flakes, toggled on in winter. */
export class SnowFx {
  private points: THREE.Points;
  private vel: Float32Array;
  private drift: Float32Array;

  constructor(scene: THREE.Scene) {
    const pos = new Float32Array(SNOW_COUNT * 3);
    this.vel = new Float32Array(SNOW_COUNT);
    this.drift = new Float32Array(SNOW_COUNT);
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * SNOW_AREA;
      pos[i * 3 + 1] = Math.random() * SNOW_TOP;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * SNOW_AREA;
      this.vel[i] = 2.5 + Math.random() * 3.5;
      this.drift[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xf4f8ff,
      size: 0.15,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  update(dt: number, active: boolean, cam: THREE.Vector3, now: number): void {
    this.points.visible = active;
    if (!active) return;
    const pos = this.points.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3 + 1] -= this.vel[i] * dt;
      pos[i * 3] += Math.sin(now * 0.6 + this.drift[i]) * dt * 0.8;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = cam.x + (Math.random() * 2 - 1) * SNOW_AREA;
        pos[i * 3 + 1] = SNOW_TOP;
        pos[i * 3 + 2] = cam.z + (Math.random() * 2 - 1) * SNOW_AREA;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

import * as THREE from 'three';
import type { Weather } from '../core/weather';
import type { SceneCtx } from './scene';

const RAIN_COUNT = 6000;
const AREA = 90; // rain box half-extent around the camera
const TOP = 40;
const FALL = 55; // units/sec

/**
 * A camera-following rain volume plus lightning. Streaks are vertical line
 * segments recycled as they fall below ground; the whole box tracks the
 * camera so the player is always in the storm.
 */
export class WeatherFx {
  private rain: THREE.LineSegments;
  private velocities: Float32Array;
  private flash: THREE.PointLight;
  private flashUntil = 0;
  private nextBolt = 0;

  constructor(scene: THREE.Scene) {
    const positions = new Float32Array(RAIN_COUNT * 6);
    this.velocities = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = (Math.random() * 2 - 1) * AREA;
      const y = Math.random() * TOP;
      const z = (Math.random() * 2 - 1) * AREA;
      const len = 0.5 + Math.random() * 0.8;
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y + len;
      positions[i * 6 + 5] = z;
      this.velocities[i] = 0.85 + Math.random() * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xaac4dd,
      transparent: true,
      opacity: 0.4,
    });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    this.flash = new THREE.PointLight(0xdfe8ff, 0, 400, 1.2);
    this.flash.position.set(0, 120, 0);
    scene.add(this.flash);
  }

  update(dt: number, weather: Weather, cam: THREE.Vector3, now: number): void {
    const raining = weather.intensity > 0.02;
    this.rain.visible = raining;
    (this.rain.material as THREE.LineBasicMaterial).opacity = 0.15 + weather.intensity * 0.4;

    if (raining) {
      const pos = this.rain.geometry.attributes.position.array as Float32Array;
      const drop = FALL * dt;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const v = this.velocities[i];
        const dy = drop * v;
        pos[i * 6 + 1] -= dy;
        pos[i * 6 + 4] -= dy;
        if (pos[i * 6 + 1] < 0) {
          // recycle to the top near the camera
          const x = cam.x + (Math.random() * 2 - 1) * AREA;
          const z = cam.z + (Math.random() * 2 - 1) * AREA;
          const len = 0.5 + Math.random() * 0.8;
          pos[i * 6] = x;
          pos[i * 6 + 1] = TOP;
          pos[i * 6 + 2] = z;
          pos[i * 6 + 3] = x;
          pos[i * 6 + 4] = TOP + len;
          pos[i * 6 + 5] = z;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // lightning during storms
    if (weather.sky === 'storm') {
      if (now > this.nextBolt) {
        this.flashUntil = now + 0.14;
        this.nextBolt = now + 4 + Math.random() * 9;
        this.flash.position.set(cam.x + (Math.random() * 2 - 1) * 60, 120, cam.z + (Math.random() * 2 - 1) * 60);
      }
    }
    this.flash.intensity = now < this.flashUntil ? 900 : 0;
  }

  hasFlash(): boolean {
    return this.flash.intensity > 0;
  }
}

/** Tint the whole scene greyer/darker as gloom rises (called after day/night). */
export function applyGloom(ctx: SceneCtx, weather: Weather): void {
  if (weather.gloom <= 0) return;
  const g = weather.gloom;
  const grey = new THREE.Color(0x5a636e);
  if (ctx.scene.background instanceof THREE.Color) {
    ctx.scene.background.lerp(grey, g * 0.85);
  }
  (ctx.scene.fog as THREE.Fog).color.lerp(grey, g * 0.85);
  (ctx.scene.fog as THREE.Fog).far = THREE.MathUtils.lerp(320, 150, g);
  ctx.sun.intensity *= 1 - g * 0.7;
  ctx.hemi.intensity *= 1 - g * 0.45;
}

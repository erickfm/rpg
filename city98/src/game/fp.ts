import * as THREE from 'three';
import { resolveCollision, type Aabb } from '../world/city';

export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.35;

export interface MoveKeys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

/** Simple pointer-lock first-person controller with head bob. */
export class FpControls {
  x: number;
  z: number;
  yaw: number; // 0 faces −z (north); positive turns left
  pitch = 0;
  private bobPhase = 0;
  private bobAmp = 0;

  constructor(x: number, z: number, yaw: number) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0023;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0023));
  }

  /** Returns the speed moved this frame (world units/second). */
  move(dt: number, keys: MoveKeys, speedMult: number, colliders: Aabb[]): number {
    let fx = 0;
    let fz = 0;
    if (keys.forward) fz += 1;
    if (keys.back) fz -= 1;
    if (keys.left) fx -= 1;
    if (keys.right) fx += 1;
    const len = Math.hypot(fx, fz);
    let speed = 0;
    if (len > 0) {
      speed = (keys.sprint ? 8.4 : 4.6) * speedMult;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // forward is −z rotated by yaw
      const wx = (fz * -sin + fx * cos) / len;
      const wz = (fz * -cos - fx * sin) / len;
      this.x += wx * speed * dt;
      this.z += wz * speed * dt;
      [this.x, this.z] = resolveCollision(this.x, this.z, PLAYER_RADIUS, colliders);
      this.bobPhase += speed * dt * 1.7;
      this.bobAmp = Math.min(1, this.bobAmp + dt * 6);
    } else {
      this.bobAmp = Math.max(0, this.bobAmp - dt * 6);
    }
    return speed;
  }

  forwardDir(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  applyCamera(camera: THREE.PerspectiveCamera): void {
    const bob = Math.sin(this.bobPhase) * 0.05 * this.bobAmp;
    camera.position.set(this.x, EYE_HEIGHT + bob, this.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(this.pitch, this.yaw, 0);
  }
}

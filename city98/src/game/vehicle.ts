import { resolveCollision, type Aabb } from '../world/city';

export interface DriveInput {
  throttle: boolean;
  reverse: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

const MAX_REV = -7;
const BRAKE = 26;
const DRAG = 0.7; // per-second proportional coast-down
const STEER_RATE = 1.7;

/** Arcade-kinematic boxy car. Heading 0 faces −z (north). */
export class Vehicle {
  x: number;
  z: number;
  heading: number;
  speed = 0;
  top = 26;
  accel = 11;

  constructor(x: number, z: number, heading: number) {
    this.x = x;
    this.z = z;
    this.heading = heading;
  }

  setPerformance(top: number, accel: number): void {
    this.top = top;
    this.accel = accel;
  }

  update(dt: number, input: DriveInput, colliders: Aabb[]): void {
    if (input.throttle) this.speed = Math.min(this.top, this.speed + this.accel * dt);
    else if (input.reverse) this.speed = Math.max(MAX_REV, this.speed - this.accel * 0.8 * dt);
    else this.speed *= Math.max(0, 1 - DRAG * dt);
    if (input.brake) {
      this.speed =
        this.speed > 0 ? Math.max(0, this.speed - BRAKE * dt) : Math.min(0, this.speed + BRAKE * dt);
    }
    if (Math.abs(this.speed) < 0.05 && !input.throttle && !input.reverse) this.speed = 0;

    // steering authority ramps with speed, flips in reverse
    const authority = Math.min(1, Math.abs(this.speed) / 9);
    const dir = this.speed >= 0 ? 1 : -1;
    if (input.left) this.heading += STEER_RATE * authority * dir * dt;
    if (input.right) this.heading -= STEER_RATE * authority * dir * dt;

    const nx = this.x - Math.sin(this.heading) * this.speed * dt;
    const nz = this.z - Math.cos(this.heading) * this.speed * dt;
    const [rx, rz] = resolveCollision(nx, nz, 1.35, colliders);
    const blocked = Math.hypot(rx - nx, rz - nz) > 0.01;
    this.x = rx;
    this.z = rz;
    if (blocked) this.speed *= 0.25; // crunch
  }
}

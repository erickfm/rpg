import * as THREE from 'three';
import type { Input } from './types';

// Harness-level utilities shared by every take: the first-person rig (the one
// fixed constraint — you are on foot, wide FOV, on this street) plus a couple
// of math/env helpers. Everything VISUAL lives per-world; nothing here decides
// how a world looks.

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

export interface FPOpts {
  height?: number;
  speed?: number;
  run?: number;
  bob?: number;
  bounds: AABB;
  colliders?: AABB[];
  /** ground elevation under (x, z) — lets worlds have kerbs/steps */
  groundY?: (x: number, z: number) => number;
}

// Player collision capsule. 0.42 made bodies feel fractionally too wide to
// slip past things — with a citizen's own ±0.30 box that needed 0.72 m of
// clearance to pass a person. Only ever reduce this: every lane in the world
// (the 2 m walk past a tree, the alley mouth, doorways) was tuned against the
// old value, so a smaller radius can only make gaps easier, never trap you.
const RADIUS = 0.36;   // was 0.42

export class FPRig {
  yaw: number;
  pitch = 0;
  readonly pos: THREE.Vector3;
  private cam: THREE.PerspectiveCamera;
  private height: number;
  private speed: number;
  private run: number;
  private bob: number;
  private bounds: AABB;
  private colliders: AABB[];
  private groundY?: (x: number, z: number) => number;
  private airY = 0;   // height above the ground while jumping
  private vy = 0;
  private jumpHeld = false; // holding the key doesn't re-jump; release first
  private crouchT = 0; // 0 standing, 1 crouched — eased so the camera dips smoothly
  private bobT = 0;
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(cam: THREE.PerspectiveCamera, spawn: { x: number; z: number; yaw: number }, o: FPOpts) {
    this.cam = cam;
    this.yaw = spawn.yaw;
    this.height = o.height ?? 1.62;
    this.speed = o.speed ?? 3.2;
    // DEBUG: sprint cranked up for getting around the world fast while we
    // build it. Shipping value was 6.4 (2x walk) -- restore that before this
    // is treated as a real movement feel.
    this.run = o.run ?? 42.0;   // was: o.run ?? 6.4
    this.bob = o.bob ?? 0.035;
    this.bounds = o.bounds;
    this.colliders = o.colliders ?? [];
    this.groundY = o.groundY;
    this.pos = new THREE.Vector3(spawn.x, this.height, spawn.z);
    cam.position.copy(this.pos);
  }

  private blocked(x: number, z: number): boolean {
    for (const c of this.colliders) {
      if (x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS) return true;
    }
    return false;
  }

  update(dt: number, input: Input) {
    // mouse deltas accumulate only while pointer-locked OR dragging — apply either way.
    // convention: fwd = (sin yaw, 0, -cos yaw), so mouse-right = yaw INCREASES.
    if (input.mouseDX !== 0 || input.mouseDY !== 0) {
      this.yaw += input.mouseDX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * 0.0022, -1.3, 1.3);
    }
    if (input.keys.has('arrowleft')) this.yaw -= dt * 1.7;
    if (input.keys.has('arrowright')) this.yaw += dt * 1.7;
    if (input.keys.has('arrowup')) this.pitch = Math.min(1.3, this.pitch + dt * 1.2);
    if (input.keys.has('arrowdown')) this.pitch = Math.max(-1.3, this.pitch - dt * 1.2);

    this.fwd.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const mv = new THREE.Vector3();
    if (input.keys.has('w')) mv.add(this.fwd);
    if (input.keys.has('s')) mv.sub(this.fwd);
    if (input.keys.has('a')) mv.sub(this.right);
    if (input.keys.has('d')) mv.add(this.right);
    // hold C to crouch: low camera, slow steps
    this.crouchT += ((input.keys.has('c') ? 1 : 0) - this.crouchT) * Math.min(1, dt * 9);
    const moving = mv.lengthSq() > 0;
    if (moving) {
      const sp = (input.keys.has('shift') ? this.run : this.speed) * (1 - 0.55 * this.crouchT);
      mv.normalize().multiplyScalar(sp * dt);
      const nx = THREE.MathUtils.clamp(this.pos.x + mv.x, this.bounds.minX, this.bounds.maxX);
      if (!this.blocked(nx, this.pos.z)) this.pos.x = nx;
      const nz = THREE.MathUtils.clamp(this.pos.z + mv.z, this.bounds.minZ, this.bounds.maxZ);
      if (!this.blocked(this.pos.x, nz)) this.pos.z = nz;
      this.bobT += dt * (input.keys.has('shift') ? 11 : 7.5);
    }
    // a modest hop
    const jumpDown = input.keys.has(' ');
    if (jumpDown && !this.jumpHeld && this.airY === 0 && this.vy === 0) this.vy = 3.6;
    this.jumpHeld = jumpDown;
    if (this.vy !== 0 || this.airY > 0) {
      this.vy -= 11 * dt;
      this.airY = Math.max(0, this.airY + this.vy * dt);
      if (this.airY === 0 && this.vy < 0) this.vy = 0;
    }
    const gy = this.groundY ? this.groundY(this.pos.x, this.pos.z) : 0;
    const grounded = this.airY === 0;
    const y = this.height - this.crouchT * 0.68 + gy + this.airY + (moving && grounded ? Math.sin(this.bobT) * this.bob : 0);
    this.cam.position.set(this.pos.x, y, this.pos.z);
    this.look.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.cam.lookAt(this.cam.position.x + this.look.x, y + this.look.y, this.cam.position.z + this.look.z);
  }
}

// vertical gradient sky texture from color stops (top -> bottom)
export function skyTex(stops: [number, string][]): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 512;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 512);
  for (const [at, col] of stops) grd.addColorStop(at, col);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// soft environment reflections baked from three colors — makes metal/gloss live
export function makeEnv(renderer: THREE.WebGLRenderer, top: string, mid: string, bot: string): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 64;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, top); grd.addColorStop(0.5, mid); grd.addColorStop(1, bot);
  g.fillStyle = grd; g.fillRect(0, 0, 8, 64);
  const equi = new THREE.CanvasTexture(cv);
  equi.mapping = THREE.EquirectangularReflectionMapping;
  equi.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(equi).texture;
  equi.dispose(); pmrem.dispose();
  return env;
}

// points along a sagging line between two anchors (for wires, laundry, lights)
export function sagPoints(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 16): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return pts;
}

export function tube(pts: THREE.Vector3[], radius: number, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, radius, 5, false), mat);
}

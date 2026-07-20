import * as THREE from 'three';

/**
 * A fireworks show over the city: bursts of additive points that rocket out,
 * arc under gravity, and fade. A rolling buffer recycles spent sparks, so a
 * single Points object carries every burst. Toggled on for holiday nights.
 */

const MAX = 2200;
const GRAVITY = 4.5;
const BURST_MIN = 110;
const BURST_MAX = 170;
const PALETTE = [0xff5050, 0x54ff86, 0x5aa6ff, 0xffd24a, 0xff74e0, 0xf4f4f4];

export class Fireworks {
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private base: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private head = 0;
  private spawnIn = 0.4;

  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.base = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  private burst(cx: number, cz: number): void {
    const base = new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    const ox = cx + (Math.random() * 2 - 1) * 48;
    const oz = cz + (Math.random() * 2 - 1) * 48;
    const oy = 17 + Math.random() * 16;
    const speed = 5 + Math.random() * 4;
    const n = BURST_MIN + Math.floor(Math.random() * (BURST_MAX - BURST_MIN));
    for (let k = 0; k < n; k++) {
      // random direction on a sphere
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const sp = speed * (0.5 + Math.random() * 0.5);
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      this.pos[i * 3] = ox;
      this.pos[i * 3 + 1] = oy;
      this.pos[i * 3 + 2] = oz;
      this.vel[i * 3] = Math.cos(th) * r * sp;
      this.vel[i * 3 + 1] = u * sp;
      this.vel[i * 3 + 2] = Math.sin(th) * r * sp;
      const l = 1.1 + Math.random() * 1.1;
      this.life[i] = l;
      this.maxLife[i] = l;
      this.base[i * 3] = base.r;
      this.base[i * 3 + 1] = base.g;
      this.base[i * 3 + 2] = base.b;
      this.col[i * 3] = base.r;
      this.col[i * 3 + 1] = base.g;
      this.col[i * 3 + 2] = base.b;
    }
  }

  update(dt: number, active: boolean, cam: THREE.Vector3): void {
    this.points.visible = active;
    if (active) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        this.burst(cam.x, cam.z);
        if (Math.random() < 0.5) this.burst(cam.x, cam.z); // frequent doubles
        this.spawnIn = 0.35 + Math.random() * 0.7;
      }
    }
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= GRAVITY * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i]; // fade from the stored base as it dies
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

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

/** How far your eye sits above the seat pan. Standing eye is 1.62; on a
 *  0.45 m bench this puts you at 1.17, on a 0.71 m stool at 1.43. */
export const SIT_EYE = 0.72;

/** Where a seat puts you. Modules describe seats through `ctx.seat()`; this is
 *  what the rig is actually handed. */
export interface SeatPose {
  /** the seat itself — where your body goes */
  x: number; z: number;
  /** which way you face once you are on it */
  yaw: number;
  /** the seat pan's height above the floor it stands on */
  h: number;
}

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
  // ── sitting ──
  //
  // The seat you are on, and the spot you were standing on when you sat. Both
  // live here because the rig is the only thing that owns where the body is —
  // and because "stand up" has to be safe, which it is BY CONSTRUCTION: the
  // place you get up into is the exact place you got up FROM, and you were
  // demonstrably standing there a moment ago. That is why `standFrom` is a
  // stored position rather than an offset from the seat, which would have to
  // guess at a clear direction and would sooner or later guess into a table.
  private seat: SeatPose | null = null;
  private standFrom: { x: number; z: number } | null = null;
  // the last place we were standing legally, and the backstop for a wedge the
  // axis pushes cannot solve. Seeded to spawn, which is always clear.
  private lastGood = { x: 0, z: 0 };
  private stuckT = 0;   // seconds spent illegal and not making progress
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
    this.lastGood = { x: spawn.x, z: spawn.z };
    cam.position.copy(this.pos);
  }

  /** are you sitting on something right now */
  get seated(): boolean { return this.seat !== null; }
  /** the seat you are on, so a caller can tell WHICH one to offer standing up */
  get seatedOn(): SeatPose | null { return this.seat; }

  /** Take a seat. Remembers where you were standing so `stand()` can undo it. */
  sit(pose: SeatPose): void {
    if (this.seat) return;
    this.standFrom = { x: this.pos.x, z: this.pos.z };
    this.seat = pose;
    this.pos.x = pose.x; this.pos.z = pose.z;
    this.yaw = pose.yaw;
    // cancel anything mid-flight, or you land after standing up
    this.airY = 0; this.vy = 0; this.jumpHeld = false;
  }

  /**
   * Get up, back onto the spot you sat down from.
   *
   * The fallback below should never run — you were standing on `standFrom`
   * when you sat, and nothing in this world moves a collider afterwards. It is
   * here because "you got up inside the table" is the failure mode this
   * mechanic will be judged on, and a seat registered with a bad approach by
   * some future builder would otherwise strand the player with no way out.
   */
  stand(): void {
    if (!this.seat) return;
    const seat = this.seat;
    let to = this.standFrom;
    if (!to || this.blocked(to.x, to.z)) {
      to = null;
      // step out along the way the seat faces, then try around the clock
      for (let ring = 0.7; ring <= 1.4 && !to; ring += 0.35) {
        for (let i = 0; i < 12 && !to; i++) {
          const a = seat.yaw + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6);
          const cx = seat.x + Math.sin(a) * ring, cz = seat.z - Math.cos(a) * ring;
          if (!this.blocked(cx, cz)) to = { x: cx, z: cz };
        }
      }
    }
    if (to) { this.pos.x = to.x; this.pos.z = to.z; }
    this.seat = null;
    this.standFrom = null;
  }

  private blocked(x: number, z: number): boolean {
    for (const c of this.colliders) {
      if (x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS) return true;
    }
    return false;
  }

  // ── getting unstuck ───────────────────────────────────────────────────────
  //
  // `blocked()` is a pure boolean reject: it refuses a move into a collider.
  // That is correct and it is not enough. It only ever asks about the position
  // you are trying to reach, never the one you are in — so the moment you end
  // up INSIDE something, every direction is refused too and you are stuck for
  // good. The user: *"im literally stuck here"*, wedged between two parked
  // cars, with no input that could help.
  //
  // There are several ways in and they are not all preventable: a gap that
  // is passable one axis at a time but not diagonally, a collider that moves
  // or is added under you, a teleport onto furniture. So rather than chase
  // the causes, the rig gains a way to express "you are somewhere illegal,
  // leave" — and then normal movement resumes on its own, because the reject
  // test starts passing again.

  /** How far, and which way, to push a point out of one box. Smallest of the
   *  four axis escapes, which for an AABB is the minimum translation. */
  private escapeFrom(c: AABB, x: number, z: number): { dx: number; dz: number; d: number } | null {
    const left = x - (c.minX - RADIUS);     // push -x by this
    const right = (c.maxX + RADIUS) - x;    // push +x
    const back = z - (c.minZ - RADIUS);     // push -z
    const front = (c.maxZ + RADIUS) - z;    // push +z
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) return null;   // not inside
    const d = Math.min(left, right, back, front);
    if (d === left) return { dx: -left, dz: 0, d };
    if (d === right) return { dx: right, dz: 0, d };
    if (d === back) return { dx: 0, dz: -back, d };
    return { dx: 0, dz: front, d };
  }

  /**
   * If the CURRENT position is inside anything, walk it back out.
   *
   * Bounded on purpose, three ways. It moves at `UNSTICK_SPEED` rather than
   * teleporting, so a player resting legally against a wall is never shoved
   * and a real overlap resolves over a few frames instead of one lurch. It
   * runs a fixed number of passes, so overlapping boxes cannot loop forever.
   * And if it still cannot find air, it falls back to the last place the
   * player stood legally — being moved a metre is bad, being stuck is worse.
   */
  private unstick(dt: number): void {
    const UNSTICK_SPEED = 3.0;              // m/s, comparable to walking
    const PASSES = 4;                       // ample for a corner of two boxes
    const PATIENCE = 0.45;                  // s of getting nowhere before we give up and jump

    let x = this.pos.x, z = this.pos.z;
    let pushX = 0, pushZ = 0;
    for (let pass = 0; pass < PASSES; pass++) {
      // SUM the escapes from everything we are inside, rather than resolving
      // the deepest one. A corner of two boxes then gives a diagonal push,
      // which is right — and a symmetric wedge gives very nearly zero, which
      // is also right: there IS no way out sideways, and pretending otherwise
      // just oscillates. Fourteen traps did exactly that, pushed left into the
      // right-hand box and right into the left-hand one, for ever.
      let sx = 0, sz = 0, any = false;
      for (const c of this.colliders) {
        const e = this.escapeFrom(c, x, z);
        if (e) { sx += e.dx; sz += e.dz; any = true; }
      }
      if (!any) break;
      if (Math.abs(sx) < 1e-6 && Math.abs(sz) < 1e-6) break;   // wedged: the timer below owns it
      x += sx; z += sz;
      pushX += sx; pushZ += sz;
    }

    const needed = this.blocked(this.pos.x, this.pos.z);
    if (!needed) {
      // legal: remember it, and forget any accumulated frustration
      this.lastGood.x = this.pos.x; this.lastGood.z = this.pos.z;
      this.stuckT = 0;
      return;
    }

    this.stuckT += dt;
    const len = Math.hypot(pushX, pushZ);
    if (len > 1e-6) {
      // ease out rather than snap, and never further than the overlap itself,
      // so a player resting legally against a wall is never shoved
      const step = Math.min(len, UNSTICK_SPEED * dt);
      this.pos.x += (pushX / len) * step;
      this.pos.z += (pushZ / len) * step;
    }

    // Getting nowhere for PATIENCE seconds — a symmetric wedge, or a push that
    // keeps cancelling. Go back to the last place we know was legal. Being
    // moved a couple of metres is a bad outcome; being stuck for ever is the
    // one the user actually hit.
    if (this.stuckT > PATIENCE && !this.blocked(this.lastGood.x, this.lastGood.z)) {
      this.pos.x = this.lastGood.x;
      this.pos.z = this.lastGood.z;
      this.stuckT = 0;
    }
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

    // ── seated: you can look, and that is all ──
    //
    // Placed after the look block and before everything else, so turning your
    // head still works while walking, jumping, crouching and the bob do not.
    // Nothing below this point runs, which is the point: there is exactly one
    // early return rather than a `seated` check threaded through the movement
    // code, where one missed branch would let you shuffle off the stool.
    if (this.seat) {
      this.crouchT += (0 - this.crouchT) * Math.min(1, dt * 9);
      const sgy = this.groundY ? this.groundY(this.pos.x, this.pos.z) : 0;
      const sy = sgy + this.seat.h + SIT_EYE;
      this.cam.position.set(this.pos.x, sy, this.pos.z);
      this.look.set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      this.cam.lookAt(this.cam.position.x + this.look.x, sy + this.look.y, this.cam.position.z + this.look.z);
      return;
    }

    // Before anything else: if we are inside something, get out. Runs ahead
    // of movement so the step that follows starts from a legal position, and
    // after the seated return above — a seat deliberately puts you inside your
    // own chair, and shoving you off it would be the cure killing the patient.
    this.unstick(dt);

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
    // A SNAPPIER jump: a little more height, noticeably less hang.
    //
    // 3.6 / 11 gave a 0.589 m apex over 0.655 s in the air, and the float at
    // the top was the part that felt wrong. 4.0 / 13 is a 0.615 m apex over
    // 0.615 s — 4% higher, 6% quicker. Both changes are tiny and they only
    // work together: more velocity alone floats worse, stronger gravity alone
    // makes the hop feel stunted.
    if (jumpDown && !this.jumpHeld && this.airY === 0 && this.vy === 0) this.vy = 4.0;
    this.jumpHeld = jumpDown;
    if (this.vy !== 0 || this.airY > 0) {
      this.vy -= 13 * dt;
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

// ── which [E] you are actually offering ───────────────────────────────────
//
// *"in general i want to be able to interact with things a lot easier … the
// door for instance to my apt should be easy to open and close when looking at
// or by the door frame or the door itself."*
//
// The old rule was ONE line and it was proximity only:
//
//     if (d < s.r && d < best) { active = s; best = d; }
//
// so a spot was offered when you stood on its tile and never because you were
// looking straight at it, and with two live candidates the nearer in METRES
// won even if you were facing the other one. That is what made doors feel like
// they had one magic square in front of them.
//
// THREE CHANGES, and the third is what makes a highlight honest.
//
// **Either, not both.** A spot is a candidate if you are NEAR it *or* if you
// are LOOKING at it from a sensible distance. Standing beside a door without
// facing it still works — that is the "or by the door frame" half — and so does
// facing it from across the landing.
//
// **The look test is angular, and it widens with closeness.** A door two metres
// away subtends a lot of screen; the same door at six metres is a thumbnail. A
// fixed cone would make far things unselectable and near things impossible to
// look away from, so the tolerance is `atan(r / d)` — the angle the spot's own
// radius actually covers from where you stand — with a floor so a small spot up
// close is not a pin-prick, and a ceiling so it never swallows the screen.
//
// **The winner is the one nearest the CENTRE OF THE SCREEN, not the nearest in
// metres.** This is the part the highlight depends on: whatever is outlined has
// to be the thing that fires, and a player reads "selected" as "the thing I am
// looking at". Proximity only decides it among things you are not looking at.
export interface Pickable { x: number; z: number; r: number; ok: () => boolean }

export interface PickView { x: number; z: number; yaw: number; pitch: number }

/** Angular half-width, in radians, that counts as "looking at" a spot of
 *  radius `r` seen from `d` metres. Measured rather than guessed: at the
 *  apartment door (r 1.2) this gives 31° at 2 m and 11° at 6 m. */
export function lookTolerance(r: number, d: number): number {
  const raw = Math.atan2(r, Math.max(0.35, d));
  return Math.min(0.62, Math.max(0.20, raw));      // ~11.5° … ~35.5°
}

/**
 * Choose the spot an `[E]` should act on, and say WHY it won, so the caller can
 * outline exactly what it is about to fire.
 *
 * `reach` is how far the look test may act — beyond it you must be inside the
 * spot's own radius. 6 m is a room's width; further than that and you would be
 * offering doors through walls, which this cannot see (there is no occlusion
 * test here, and adding one is the obvious next step if it ever bites).
 */
export function pickSpot<T extends Pickable>(
  spots: readonly T[], view: PickView, reach = 6,
): { spot: T; looked: boolean; offAxis: number; dist: number } | null {
  let best: { spot: T; looked: boolean; offAxis: number; dist: number } | null = null;
  let bestKey = Infinity;
  const fx = Math.sin(view.yaw), fz = -Math.cos(view.yaw);
  for (const s of spots) {
    if (!s.ok()) continue;
    const dx = s.x - view.x, dz = s.z - view.z;
    const d = Math.hypot(dx, dz);
    const near = d < s.r;
    // angle between where you face and where the spot is, on the ground plane
    const offAxis = d < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
    const looked = d < reach && offAxis < lookTolerance(s.r, d);
    if (!near && !looked) continue;
    // SCREEN CENTRE FIRST. A spot you are looking at beats one you are merely
    // standing in, and between two you are looking at, the more centred wins.
    // Distance is the tiebreak, not the rule.
    // NEAR BEATS LOOKED, ALWAYS, and distance orders the near set.
    //
    // My first ordering made `looked` dominant and it was wrong twice over. A
    // door you were STANDING IN stopped being offered because something across
    // the street was nearer the centre of the screen — measured, at the No. 227
    // frame — and it would have broken `seats-walk`'s standing assertion, which
    // is that standing ON a seat offers THAT seat and not the one 0.67 m away.
    // That check exists because the bug it guards shipped once already
    // (`098269aa`), and a new pick that quietly re-opens it is worse than no new
    // pick at all.
    //
    // So proximity keeps exactly its old semantics among near candidates —
    // nearest in metres wins — and looking only decides things when nothing is
    // near, where "nearest the centre of the screen" is the whole point.
    const key = near ? d : 10 + offAxis;
    if (key < bestKey) { bestKey = key; best = { spot: s, looked, offAxis, dist: d }; }
  }
  return best;
}

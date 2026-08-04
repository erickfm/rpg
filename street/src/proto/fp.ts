import * as THREE from 'three';
import type { Input } from './types';

// Harness-level utilities shared by every take: the first-person rig (the one
// fixed constraint — you are on foot, wide FOV, on this street) plus a couple
// of math/env helpers. Everything VISUAL lives per-world; nothing here decides
// how a world looks.

// `minY`/`maxY` are OPT-IN, and that is what makes this safe to add. Every
// collider in the world today is registered through `ctx.obstacle`/`solid` as
// a plain `{minX,maxX,minZ,maxZ}` with no height at all, and `blocked()`
// below preserves that: a collider with `maxY` undefined is still a wall
// extruded to infinite height, exactly as it always was, whatever height the
// player is at. Only a collider that explicitly sets `maxY` gets the new
// behaviour — the floor picker may stand you on `maxY` when you are already
// above it, and horizontal movement stops treating it as a wall once you are.
// `minY` is reserved for the mirror case (an overhang you can walk under) and
// is not consumed anywhere yet — nothing needs headroom today, so nothing
// implements it; a real user report is worth more than a guessed mechanism.
// `rot` is OPT-IN for the same reason and in the same way. Without it a box is
// axis-aligned, exactly as every box in this world has always been, and the
// four tests below take a branch that is bit-for-bit the old arithmetic. With
// it, `minX/maxX/minZ/maxZ` describe the box IN ITS OWN FRAME and the box is
// turned by `rot` radians about its own centre — so `rot: 0` is the identity
// and not merely "close to" the old behaviour.
//
// The angle is the SAME convention as `mesh.rotation.y` (three.js `Ry`), so a
// collider for a mesh can take the mesh's own yaw instead of a second number
// derived by hand — which is the step that has gone wrong here before
// (`BAY.yawAlong`'s own comment, ct/bodega-corner.ts).
//
// WHY THIS EXISTS: *"whats going on with the collision geometry here? we should
// fix this so its not just a bunch of separate rectangles and its just made
// properly."* An AABB cannot be diagonal, so the bodega's 45-degree chamfer was
// a staircase of 8 abutting bands — and a staircase is not merely ugly, it is
// FELT: walking the cut with the wall at your shoulder, the collision surface
// stepped 83 mm in and out and the slide ratcheted 267 mm (measured, before and
// after, scripts/probes/w24-chamfer-walk.mjs). More, smaller boxes cannot fix
// that; only a box that is actually at 45 degrees can.
export type AABB = {
  minX: number; maxX: number; minZ: number; maxZ: number;
  minY?: number; maxY?: number;
  /** yaw about the box's own centre, `mesh.rotation.y` convention. Absent or 0
   *  means axis-aligned — the old behaviour, exactly. */
  rot?: number;
};

/** A world point in the box's OWN frame, so the plain min/max tests below work
 *  unchanged on a turned box. Identity — the same object arithmetic, not an
 *  approximation of it — when `rot` is absent or zero, which is every collider
 *  in the world but one.
 *
 *  three.js's `Ry(t)` sends local (x, z) to (x cos t + z sin t, -x sin t +
 *  z cos t); this is its inverse, `Ry(-t)`, applied about the centre. */
function inFrame(c: AABB, x: number, z: number): { x: number; z: number } {
  if (!c.rot) return { x, z };
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const s = Math.sin(c.rot), k = Math.cos(c.rot);
  const dx = x - cx, dz = z - cz;
  return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
}

/** The mirror of `inFrame` for a DIRECTION (no centre offset): a push worked
 *  out in the box's frame, turned back into world axes. */
function outOfFrame(c: AABB, dx: number, dz: number): { dx: number; dz: number } {
  if (!c.rot) return { dx, dz };
  const s = Math.sin(c.rot), k = Math.cos(c.rot);
  return { dx: dx * k + dz * s, dz: -dx * s + dz * k };
}

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
export const RADIUS = 0.36;   // was 0.42
// (export added for ct/debug-collision.ts — the collision-view toggle draws the
// player's own footprint at the SAME radius blocked() actually collides with,
// rather than a second hand-typed number that could drift from it. Bounded
// desk exception for this feature; nothing else in this file changed.)

// How far above/below a collider's `maxY` still counts as "at" it, for the
// stand-on-top mechanic. Has to absorb one frame of `lastWorldY` lag (see its
// own comment) plus ordinary floating-point slop without flickering the
// player on and off the surface; 0.08 m is comfortably more than either and
// still tight enough that you cannot stand on a roof from a metre below it.
const TOP_EPS = 0.08;

/**
 * HOW FAR THE FLOOR HAS TO DROP IN ONE FRAME BEFORE IT COUNTS AS A FALL, in
 * metres. **THIS IS THE ONE NUMBER TO TURN.**
 *
 * The user, 2026-08-02: *"i think just make all drops falls then we can work
 * back from there."* (`FEATURE-REQUESTS.md:2715`, item 130.) So it is **0**:
 * every drop, kerbs included, at any height. It exists as a named constant
 * rather than as a literal because *"work back from there"* says out loud that
 * he expects to tune it by feel, and tuning must be one number rather than a
 * re-implementation.
 *
 * ── WHAT 0 COSTS, MEASURED, so the next value is a choice and not a guess ──
 *
 * `groundPick` is a CONTINUOUS function, not a set of steps: `ct/civic.ts:98`
 * and `ct/apartment.ts` both ramp a flight of stairs deliberately — *"the picker
 * does not know about treads. It walks you up a smooth ramp at the flight's own
 * gradient"* — and the road has a crown. So at 0, **walking down any slope drops
 * the floor every single frame**, `airY` never returns to 0, and the two things
 * that read `airY === 0` in `update()` both switch off: **head bob, and the
 * jump gate.** You cannot hop while walking downhill.
 *
 * That is not a defect in the rule, it is the rule's price, and these are the
 * two numbers that price it (`scripts/probes/w101-descend-walk.mjs`, walking
 * rather than warping, 3 runs each):
 *
 *     the walk-up ramp, the steepest slope you can walk   0.040 m per frame
 *     the kerb, the shallowest discrete step in the world 0.140 m
 *
 * **Any value strictly between 0.040 and 0.140 makes every real step fall while
 * leaving every slope underfoot.** 0.06 is the middle of that gap. It is not set
 * here because he asked for 0 first and this is his call, not mine.
 *
 * The desk's ruling also flagged a risk — *"a staircase is a sequence of small
 * drops and could become a bouncing descent"* — and **that cannot happen**, for
 * the reason above: a staircase is not a sequence of drops to this code, it is a
 * ramp. Measured on the walk-up: 0 bounces in 3 runs, biggest mid-descent rise
 * 0.000 m.
 */
const FALL_MIN_DROP = 0;

/** How far your eye sits above the seat pan. Standing eye is 1.62; on a
 *  0.45 m bench this puts you at 1.17, on a 0.71 m stool at 1.43. */
export const SIT_EYE = 0.72;

/** HOW FAR UP AND DOWN YOU CAN LOOK, radians off the horizon. 1.3 rad = 74.48°,
 *  so you can never quite look at your own feet — the last 15.5° is the neck
 *  you do not have.
 *
 *  EXPORTED BECAUSE SOMETHING OUTSIDE MEASURES BACK FROM IT. `crosstown.ts`
 *  raises the wristwatch a couple of degrees off the bottom of this range
 *  (*"to look at your watch you need to look straight down (couple deg of
 *  tolerance)"*, 2026-08-03), and that gate has to be `PITCH_LIMIT` minus the
 *  tolerance rather than a second hand-typed 1.3 — otherwise the day this
 *  clamp moves, the watch silently stops being reachable at all, or opens
 *  wide. BUILDER-BRIEF §8. It was three literals in this file alone before
 *  this line existed. */
export const PITCH_LIMIT = 1.3;

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
  // The floor height PLUS airY, as of the end of last frame's update() — i.e.
  // roughly where your feet actually are right now. Read at the TOP of this
  // frame, before anything moves, so every collision test this frame uses one
  // consistent, already-settled number rather than a value still changing
  // under it. One frame of lag (≤16 ms) is not observable; recomputing it
  // mid-frame, after `groundY` and `airY` have already changed for THIS
  // frame, would be circular — the floor pick below needs to know whether you
  // are already above a collider's top, which is exactly the question
  // blocked() is asking a few lines earlier in the same frame.
  private lastWorldY = 0;
  // ── what was holding you up at the end of last frame ──────────────────────
  //
  // `support` is the floor height the camera actually stood on — `gy` AFTER the
  // collider-top pick below, not the raw terrain. It is what lets the step-off
  // convert a floor that dropped away into a real fall (see the block that
  // reads it in update()).
  //
  // IT USED TO BE PAIRED WITH A `heldByTop` FLAG and it no longer is. That flag
  // said "a collider top put you here rather than the terrain", and gating the
  // fall on it meant only car roofs, beds, rails and boot lids could start one —
  // every kerb, stoop, stair and storey change stayed instant. The user's ruling
  // (FEATURE-REQUESTS.md:2715) removed that distinction outright:
  // *"i think just make all drops falls then we can work back from there."*
  // Where the source of the floor came from is now nobody's business; only how
  // far it fell is, and that is `FALL_MIN_DROP`.
  private support = 0;
  // Where you were standing, so the step-off can tell "the floor fell away from
  // under my feet" (a fall) from "I was moved somewhere the floor is lower" (a
  // teleport — `__ct.warp`, a door, a seat exit). Without this a probe that
  // warps off a car roof is handed a phantom 1.4 m fall.
  private lastX = 0;
  private lastZ = 0;
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
    // THE ESCAPE HATCH, AT THE LOWEST LEVEL THIS FILE CAN REACH.
    //
    // The user: *"i cant get up, ANYTHING i do, once i sit down to watch tv."*
    // Not just E — everything. So the polled `input.keys` path cannot be
    // trusted to carry the way out: `ct/hud.ts`'s `blockInput` swallows keydown
    // in the CAPTURE phase with `stopImmediatePropagation`, and anything that
    // leaves that gate up (a panel that does not close, a fade that does not
    // resolve) takes the whole input set with it, including the escape binding
    // in the seated block below.
    //
    // So this listens for itself, in capture, and sets a flag the update loop
    // honours. It is deliberately dumb: no state of its own beyond one boolean,
    // nothing to get stuck in, and it costs a comparison per keypress.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.seat) this.forceUp = true;
    }, true);
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
    this.lastWorldY = this.groundY ? this.groundY(spawn.x, spawn.z) : 0;
    // Spawn standing on the terrain, never on a top: a stale `support` from
    // before the rig existed is exactly the phantom fall `lastX`/`lastZ` guard.
    this.support = this.lastWorldY;
    this.lastX = spawn.x; this.lastZ = spawn.z;
    cam.position.copy(this.pos);
  }

  /** are you sitting on something right now */
  /** set by the capture-phase Escape listener; consumed by update(). */
  private forceUp = false;
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
    // A chair is not a surface you stepped off — RE-BASE whatever was holding
    // you up onto where you now are, so standing back up cannot read it as a
    // floor that dropped away.
    //
    // This used to be `heldByTop = false`, which was enough while only collider
    // tops could start a fall. It is not any more: under item 130 the terrain
    // starts one too, and sitting MOVES you (`pose.x/z`), so a stale `support`
    // from wherever you were standing is now a phantom fall waiting for you to
    // get up. Re-basing `support` is the same protection stated in the terms
    // the rule actually uses.
    this.support = this.groundY ? this.groundY(this.pos.x, this.pos.z) : 0;
    this.lastX = this.pos.x; this.lastZ = this.pos.z;
  }

  /**
   * Get up, back onto the spot you sat down from.
   *
   * The fallback below should never run — you were standing on `standFrom`
   * when you sat, and nothing in this world moves a collider afterwards. It is
   * here because "you got up inside the table" is the failure mode this
   * mechanic will be judged on, and a seat registered with a bad approach by
   * some future builder would otherwise strand the player with no way out.
   *
   * `forceUp` IS CLEARED HERE, UNCONDITIONALLY, EVEN WHEN ALREADY STANDING.
   * This is the fix for "you cannot sit at blackjack after standing up from
   * the slots" (queue item 0f). Escape has TWO independent ways to end up
   * here: `ct/hud.ts`'s panel `close()` calls `__ct.stand()` synchronously
   * the moment a seat-opened panel shuts, and — same keydown, capture phase,
   * registered on the same `window` — this class's OWN Escape listener
   * (line ~99) sets `forceUp`, a flag meant to be consumed by the `if
   * (this.seat)` branch of `update()` on the NEXT frame as a fallback in case
   * the panel path fails. When the panel path succeeds FIRST (it does, every
   * time — capture listeners run in registration order and hud.ts's `gate`
   * fires after this class's own, since the rig is constructed before any
   * panel ever opens), `this.seat` is already `null` by the time `update()`
   * runs, so the `if (this.seat)` branch that resets `forceUp` never
   * executes — `forceUp` is stranded at `true`. It sits there inert until
   * the player next sits down ANYWHERE, at which point `update()`'s very
   * first seated frame reads the stale flag and calls `stand()` again,
   * un-seating them one frame after they sat — invisible to the player
   * (`seated` reads false a moment later either way) but indistinguishable
   * from the seat simply not working. Clearing the flag on every `stand()`,
   * not only the one `update()` performs for itself, means whichever of the
   * two paths gets there first also cleans up after the other.
   */
  stand(): void {
    this.forceUp = false;
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
    // Getting up MOVES you, by up to the 1.4 m search ring above. Re-base the
    // step-off state on where you now are, or the first frame back on your feet
    // compares this spot's floor against the one you sat down from — which
    // under item 130 is a fall out of a chair rather than a no-op.
    this.support = this.groundY ? this.groundY(this.pos.x, this.pos.z) : 0;
    this.lastX = this.pos.x; this.lastZ = this.pos.z;
  }

  /**
   * `atY`, WHEN GIVEN, is where your feet actually are right now (see
   * `lastWorldY`). A collider with a real `maxY` stops blocking once you are
   * at or above it — you are standing ON it, not walking INTO it — but ONLY
   * for a caller that supplies `atY`. Every caller that omits it (`stand()`,
   * both call sites below) gets EXACTLY the old behaviour: every collider is
   * a wall at every height, which is the only safe default for "can I get up
   * here" — standing up should never plant you on a car roof.
   *
   * A collider with no `maxY` at all is unaffected either way: the `c.maxY
   * !== undefined` guard means it blocks at every height, exactly as every
   * collider in the world always has.
   */
  private blocked(x: number, z: number, atY?: number): boolean {
    for (const c of this.colliders) {
      // The RADIUS padding is applied in the BOX's frame, not the world's. It
      // was always a square Minkowski sum standing in for the player's circle
      // (see ct/debug-collision.ts's player-box comment); on a turned box the
      // square turns with it, which is the same approximation and no worse —
      // and against a 45-degree wall it is what makes the stop distance a
      // constant instead of sawing with the wall's angle.
      const q = inFrame(c, x, z);
      if (q.x > c.minX - RADIUS && q.x < c.maxX + RADIUS && q.z > c.minZ - RADIUS && q.z < c.maxZ + RADIUS) {
        if (c.maxY !== undefined && atY !== undefined && atY >= c.maxY - TOP_EPS) continue;
        return true;
      }
    }
    return false;
  }

  /** The highest standable collider top under (x, z) that you are ALREADY at
   *  or above — never a jump-cut ceiling teleport. `atY` is `lastWorldY` (see
   *  its own comment): you only ever get credit for height you already had
   *  a moment ago, which is what makes this "land on it" rather than "walk up
   *  to it and pop on top". No RADIUS padding here, unlike `blocked()` — that
   *  padding stops your BODY colliding with the box's sides, but a roof does
   *  not extend past its own edges, so padding it would let you stand on thin
   *  air past the corner. */
  private standTop(x: number, z: number, atY: number): number | null {
    let best: number | null = null;
    for (const c of this.colliders) {
      if (c.maxY === undefined) continue;
      const q = inFrame(c, x, z);
      if (q.x < c.minX || q.x > c.maxX || q.z < c.minZ || q.z > c.maxZ) continue;
      if (atY < c.maxY - TOP_EPS) continue;
      if (best === null || c.maxY > best) best = c.maxY;
    }
    return best;
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
   *  four axis escapes, which for an AABB is the minimum translation.
   *  `atY`, when given, exempts a collider you are already standing on top of
   *  — otherwise every frame spent on a car roof would read as "wedged" and
   *  `unstick` would shove you back off the edge you just landed on. */
  private escapeFrom(c: AABB, x: number, z: number, atY?: number): { dx: number; dz: number; d: number } | null {
    if (c.maxY !== undefined && atY !== undefined && atY >= c.maxY - TOP_EPS) return null;
    // Worked out in the box's own frame — the minimum translation out of a
    // TURNED box is along one of ITS axes, not the world's — then turned back
    // into world axes on the way out. `d`, a length, is frame-independent.
    const q = inFrame(c, x, z);
    const left = q.x - (c.minX - RADIUS);     // push -x by this
    const right = (c.maxX + RADIUS) - q.x;    // push +x
    const back = q.z - (c.minZ - RADIUS);     // push -z
    const front = (c.maxZ + RADIUS) - q.z;    // push +z
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) return null;   // not inside
    const d = Math.min(left, right, back, front);
    let dx = 0, dz = 0;
    if (d === left) dx = -left;
    else if (d === right) dx = right;
    else if (d === back) dz = -back;
    else dz = front;
    const w = outOfFrame(c, dx, dz);
    return { dx: w.dx, dz: w.dz, d };
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
  private unstick(dt: number, atY?: number): void {
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
        const e = this.escapeFrom(c, x, z, atY);
        if (e) { sx += e.dx; sz += e.dz; any = true; }
      }
      if (!any) break;
      if (Math.abs(sx) < 1e-6 && Math.abs(sz) < 1e-6) break;   // wedged: the timer below owns it
      x += sx; z += sz;
      pushX += sx; pushZ += sz;
    }

    const needed = this.blocked(this.pos.x, this.pos.z, atY);
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
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * 0.0022, -PITCH_LIMIT, PITCH_LIMIT);
    }
    if (input.keys.has('arrowleft')) this.yaw -= dt * 1.7;
    if (input.keys.has('arrowright')) this.yaw += dt * 1.7;
    if (input.keys.has('arrowup')) this.pitch = Math.min(PITCH_LIMIT, this.pitch + dt * 1.2);
    if (input.keys.has('arrowdown')) this.pitch = Math.max(-PITCH_LIMIT, this.pitch - dt * 1.2);

    // ── seated: you can look, and that is all ──
    //
    // Placed after the look block and before everything else, so turning your
    // head still works while walking, jumping, crouching and the bob do not.
    // Nothing below this point runs, which is the point: there is exactly one
    // early return rather than a `seated` check threaded through the movement
    // code, where one missed branch would let you shuffle off the stool.
    if (this.seat) {
      // THE ESCAPE HATCH. This world had no cancel, back or escape binding of
      // any kind — E was the only interaction key there is — so a seated state
      // had exactly one way out, and the first time it failed the player was
      // trapped and had to ask. A state with one exit is a trap.
      //
      // Escape also drops pointer lock, which is the right shape: it is the
      // key you press when you want out of whatever you are in.
      if (input.keys.has('escape') || this.forceUp) { this.forceUp = false; this.stand(); return; }
      this.crouchT += (0 - this.crouchT) * Math.min(1, dt * 9);
      const sgy = this.groundY ? this.groundY(this.pos.x, this.pos.z) : 0;
      this.lastWorldY = sgy;   // keep it live while seated, or standing up stale-reads it
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

    // Where your feet actually are, as of the moment the LAST frame ended —
    // see `lastWorldY`'s own comment for why this is one frame stale rather
    // than recomputed live, and why that is fine. Read once and reused for
    // every collision test this frame, including the floor pick at the
    // bottom, so they all agree on the same "am I up there" answer.
    const atY = this.lastWorldY;

    // Before anything else: if we are inside something, get out. Runs ahead
    // of movement so the step that follows starts from a legal position, and
    // after the seated return above — a seat deliberately puts you inside your
    // own chair, and shoving you off it would be the cure killing the patient.
    this.unstick(dt, atY);

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
      if (!this.blocked(nx, this.pos.z, atY)) this.pos.x = nx;
      const nz = THREE.MathUtils.clamp(this.pos.z + mv.z, this.bounds.minZ, this.bounds.maxZ);
      if (!this.blocked(this.pos.x, nz, atY)) this.pos.z = nz;
      this.bobT += dt * (input.keys.has('shift') ? 11 : 7.5);
    }
    // a modest hop
    const jumpDown = input.keys.has(' ');
    // A SNAPPIER jump: a little more height, noticeably less hang.
    //
    // EVERY FIGURE IN THE TUNING HISTORY BELOW IS ANALYTIC — v0^2/2g for the
    // apex and 2*v0/g for the hang — AND THE WORLD REACHES NONE OF THEM. They
    // are kept because the COMPARISONS between them are what the tuning was
    // about and those still hold; they are labelled so nobody tunes a surface
    // height against a number that does not exist. What the world actually does
    // is the paragraph after them.
    //
    //   3.6 / 11  ->  0.589 m apex, 0.655 s hang   (analytic)
    //   4.0 / 13  ->  0.615 m apex, 0.615 s hang   (analytic) — 4% higher, 6% quicker
    //   4.0 / 14  ->  0.571 m apex, 0.571 s hang   (analytic) — 7% lower, 7% quicker fall
    //
    // The float at the top was the part that felt wrong at 3.6 / 11. Both
    // changes are tiny and they only work together: more velocity alone floats
    // worse, stronger gravity alone makes the hop feel stunted. The last row is
    // the user's ask, "make gravity a tiny bit stronger" — gravity only, 13 ->
    // 14, jump velocity left at 4.0.
    //
    // WHAT THE HOP ACTUALLY REACHES: 0.475 m to about 0.538 m, depending on
    // frame rate.
    //
    // The loop below is semi-implicit (symplectic) Euler and decrements `vy`
    // BEFORE integrating position, so each step advances the height by the
    // velocity it will have at the END of that step, not the start. Summing to
    // the sign change costs exactly one half-step of the initial velocity:
    //
    //   apex(dt) = v0^2/(2g) - v0*dt/2  =  0.5714 - 2*dt      (v0 = 4, g = 14)
    //
    // So 0.571 m is the dt -> 0 LIMIT, approached from below and never attained.
    // `src/main.ts:107` clamps dt to 0.05 s, which puts a HARD FLOOR under the
    // hop at 0.475 m — an exact reachable value, not a noise band.
    //
    // Measured, `scripts/probes/w25-jump-apex.mjs` against the built bundle:
    // 0.4750 m at the clamp (20 fps) rising to 0.5383 m at 62 fps, every hop
    // within 0.008 m of that formula evaluated on the frames that produced it.
    // A 60 Hz display therefore sees ~0.538 m; only a much faster one
    // approaches 0.55.
    //
    // Measure it with an instrument that waits for the hop to END, not for a
    // constant: at the clamp the hop needs ~12 physics steps, and under load
    // those can span well over a second of wall clock, so a fixed window closes
    // mid-ascent. That produced a 0.1632 m "apex" here — below a floor the
    // physics cannot go under, which is how you know it was the instrument
    // (GOTCHAS §30). `scripts/jump-walk.mjs` still uses a fixed 1100 ms wait
    // and is exposed to the same truncation.
    //
    // Still verified against scripts/jump-walk.mjs's whole spot list (pavement,
    // kerb edge, road, stoop, ground floor, stairs, upstairs): every apex lands
    // in its required 0.45-0.8 m band — note the band's floor is only 0.025 m
    // below the clamped apex — and every spot lands back on the floor it left.
    if (jumpDown && !this.jumpHeld && this.airY === 0 && this.vy === 0) this.vy = 4.0;
    this.jumpHeld = jumpDown;
    if (this.vy !== 0 || this.airY > 0) {
      this.vy -= 14 * dt;
      this.airY = Math.max(0, this.airY + this.vy * dt);
      if (this.airY === 0 && this.vy < 0) this.vy = 0;
    }
    let gy = this.groundY ? this.groundY(this.pos.x, this.pos.z) : 0;
    // Stand on a collider's top when you are already up there — see
    // `standTop`'s own comment. Only raises the floor, never lowers it: a
    // standable top under the terrain (there is no such case today, but
    // nothing here assumes there cannot be) must not sink you into the
    // ground.
    // (`const terrain = gy` used to be taken here, purely to set `heldByTop`
    // below. Item 130 deleted that flag, and an unread local is how a reader
    // concludes a distinction still matters when it does not.)
    const top = this.standTop(this.pos.x, this.pos.z, atY);
    if (top !== null && top > gy) gy = top;

    // ── STEPPING OFF A SURFACE IS A FALL, NOT THE FLOOR MOVING ───────────────
    //
    // The user: *"when i jump off of stuff i teleport straight down."*
    //
    // `airY` is height ABOVE THE GROUND, and world Y is `gy + airY`. So the
    // instant you clear the edge of the pickup's cab roof, `gy` goes 1.415 ->
    // 0.000 in ONE frame while `airY` is still 0, and the camera goes with it.
    // **There was no fall to have: the player was never falling, the floor moved
    // out from under him and took him along.** Measured before this block
    // existed, walking off the bed floor: a single frame swallowed 0.514 m of a
    // 0.590 m descent — 87% of it — against a gravity budget of 0.035 m for the
    // first clamped frame (g*dt^2, g = 14, dt clamped to 0.05 in main.ts:107).
    //
    // THE FIX IS TO KEEP THE HEIGHT YOU HAD AND LET GRAVITY TAKE IT. Adding the
    // lost floor to `airY` leaves world Y (`gy + airY`) exactly where it was, so
    // nothing moves this frame; `airY` is now positive, so the integrator above
    // runs next frame and brings you down at the same 14 m/s^2 a jump uses.
    // Both halves of the item come out of that one line, because the player is
    // now genuinely IN THE AIR: the jump gate above is `airY === 0 && vy === 0`,
    // which used to be true the instant you stepped off — handing you a fresh
    // 4.0 m/s jump in mid-air (measured: the camera rose 0.310 m after leaving
    // the bed). With `airY` positive it is false, and the second jump is gone.
    //
    // ONLY DROPS, NEVER RISES — deliberately asymmetric. A rise is a LANDING,
    // and landing already works: `standTop` credits a top only once your feet
    // are within TOP_EPS of it, so the pop is bounded by that 0.08 m and settles
    // as `airY` runs out. Subtracting on the way up would re-time every climb in
    // scripts/w21-roof-climb.mjs for no defect anyone has reported.
    //
    // ── EVERY DROP, NOT JUST THE ONES OFF A CAR ────────────────────────────
    //
    // This block used to carry `this.heldByTop &&`, so it ran only when a
    // COLLIDER TOP had been holding you up — the pickup's five tops and the
    // sedan's two, and nothing else in the world (`probes/w50-tops.mjs`). Every
    // kerb, stoop, stair and storey change is `groundY` terrain, so all of them
    // stayed instant. Item 112 chose that on purpose and said so; item 130 is
    // the user overruling it: *"i think just make all drops falls then we can
    // work back from there."*
    //
    // So the gate is now the height alone, against `FALL_MIN_DROP` — read its
    // comment before changing it, including what 0 costs and the two measured
    // numbers that bound the next value.
    //
    // AND ONLY IF YOU WALKED THERE — unchanged, and now carrying much more
    // weight than it used to. `this.run` is 42 m/s, so the most any legal frame
    // can carry you is `run * dt`, derived here rather than typed so it still
    // holds if the speed is retuned. Anything further is a teleport
    // (`__ct.warp`, a door, a seat exit), where the floor changing is the point
    // and a fall would be a phantom. **With the collider-top gate gone this is
    // the ONLY thing standing between a warp and a fabricated fall**, and every
    // warp in the world now passes through terrain the picker answers for.
    const walked = Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ);
    const dropped = this.support - gy;
    if (dropped > FALL_MIN_DROP && walked <= this.run * dt + 1e-3) {
      this.airY += dropped;
    }
    this.support = gy;
    this.lastX = this.pos.x; this.lastZ = this.pos.z;

    const grounded = this.airY === 0;
    const y = this.height - this.crouchT * 0.68 + gy + this.airY + (moving && grounded ? Math.sin(this.bobT) * this.bob : 0);
    this.cam.position.set(this.pos.x, y, this.pos.z);
    this.look.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.cam.lookAt(this.cam.position.x + this.look.x, y + this.look.y, this.cam.position.z + this.look.z);
    // Settle what "where your feet are" means for NEXT frame — see
    // `lastWorldY`'s own comment. gy already includes any collider top just
    // picked above, so standing still on a roof keeps reading atY >= maxY
    // and the surface holds you, frame after frame.
    this.lastWorldY = gy + this.airY;
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
export interface Pickable {
  x: number; z: number; r: number; ok: () => boolean;
  /** HOW MUCH THIS SPOT MATTERS when two of them are equally selectable.
   *
   *  **THE USER DECIDED THIS, 2026-08-03: *"just make the door high rank pls."***
   *  The way out of a room outranks the furniture in it. Default 0; `WAY_OUT`
   *  is the one non-zero value anything declares today.
   *
   *  IT ORDERS **WITHIN** A TIER, NEVER ACROSS ONE, and that boundary is the
   *  whole design. Worker onehundredsixteen measured a cross-tier rank — the
   *  obvious strong form — and it made things WORSE: a ranked door sitting in
   *  tier 3 (touched, aimed away) started stealing the press from a bed the
   *  player was squarely aimed at, so `[E]` on the bed opened the door instead.
   *  A rank that can beat AIM is not "the door is important", it is "the door is
   *  the only thing in the room".
   *
   *  AND `onIt` STILL COMES FIRST inside tier 1 — see the key below. A spot
   *  whose centre is inside your own capsule is something you are standing in,
   *  and the user's own guard rail on this same request is that *standing right
   *  at a piece of furniture and looking straight at it must still offer that
   *  furniture*. Rank orders what you are NEAR; it does not overrule what you
   *  are IN. */
  rank?: number;
}

/** The rank a way OUT carries — a door, a threshold, a street entrance.
 *
 *  One named constant rather than a `1` typed at each door, because the point
 *  of item 291 is that this is a PROPERTY OF DOORS and not a fix for flat 301:
 *  every room has a way out and the next room will need it too. Anything that
 *  gets you from one place to another declares this; furniture declares
 *  nothing and gets 0.
 *
 *  The value is deliberately the smallest one that works. Rank is compared, not
 *  summed, so there is nothing to gain from a bigger number and a scale that
 *  invites tuning is a scale somebody will tune. */
export const WAY_OUT = 1;

export interface PickView { x: number; z: number; yaw: number; pitch: number }

/** Angular half-width, in radians, that counts as "looking at" a spot of
 *  radius `r` seen from `d` metres.
 *
 *  ⚠ THE NUMBERS THAT USED TO BE HERE WERE `atan2(r, d)` — the value BEFORE the
 *  clamp — and reading them as the function's output is the single mistake this
 *  row has cost the most (`notes/ninetytwo-item98-the-plateau-is-the-clamp.md`).
 *  The real, clamped output at the apartment door (r 1.2) is **25.0° at 2 m**
 *  (`raw` would be 31.0°, the ceiling wins) and **11.3° at 6 m** (`raw` wins,
 *  the ceiling is not in play). See `LOOK_CEILING`. */
/** How far outside its registered radius a SEATED player can still reach a spot
 *  — and the radius of the outer ring the debug volume overlay draws. Those two
 *  are all it does now; see `pickSpot` below, where the standing aim-free test
 *  is `TOUCH_MARGIN` and the aimed test carries no margin term at all.
 *
 *  DOCSTRING CORRECTED 2026-08-03 (item 223). It used to read "how far OUTSIDE
 *  its own registered radius a spot still counts as *standing at it*", which
 *  was true until the aim-free pass was cut to `TOUCH_MARGIN` on the user's
 *  *"i feel like i select stuff without even looking at it"*. The sentence
 *  outlived the predicate, and `crosstown.ts` repeated it to every harness
 *  through `__ct.reachMargin()`: `casinodoor.mjs` predicted a 3.11 m trigger
 *  band on that authority and the world gave 2.13 m. Five harness call sites
 *  are still comparing against this constant where the world uses the other one.
 *
 *  THE VALUE IS UNCHANGED AND SO IS EVERY PREDICATE. MEASURED, not chosen: the
 *  tightest case a player must reach is the No. 227 entry at r 1.05, and the
 *  door frame stands 1.15 m from it because the facade cushion pushes you off
 *  the wall — so anything under 0.10 fails the user's own example. 0.60 clears
 *  it and is still under half the sacred 2 m walk, so it cannot make two spots
 *  across a pavement both live. */
export const REACH_MARGIN = 0.6;

/** How far outside its radius a spot is still "being touched" — the only case
 *  that is offered WITHOUT the player aiming at it. A quarter of REACH_MARGIN,
 *  and set by the user's own example: the No. 227 spot has r 1.05 with its door
 *  frame 1.15 m away, so 0.15 is the smallest value that keeps *"standing
 *  beside it, not looking"* working. See the note in `pickSpot`. */
export const TOUCH_MARGIN = 0.15;

/** **HOW MUCH OF ITS OWN REACH AN INTERACTABLE ACTUALLY GETS, WORLD-WIDE.**
 *  Multiplies the two AIM-FREE reaches below and nothing else — 1.0 is the
 *  behaviour every number in this file was written against.
 *
 *  ⚠ THE USER ASKED FOR THIS BY NAME, 2026-08-03: *"with the radius for all
 *  these things a bit less."* He is describing a feel — that interactables grab
 *  him from further away than he is standing — not a figure, so it was walked
 *  rather than computed (item 309, `scripts/probes/w134-reach-band.mjs`). Every
 *  figure below is the distance at which the live prompt actually changed while
 *  walking at the thing, not a prediction:
 *
 *      how far out it was still offered with the eyes 90° off it:
 *                              trim 1.00   trim 0.80        aimed
 *    a bodega counter (r1.00)     1.14 m      0.81 m       2.4 m, unmoved
 *    No. 227's entry  (r1.05)     0.87 m      0.53 m       2.4 m, unmoved
 *    a park bench     (r0.75)     0.81 m      0.70 m       2.4 m, unmoved
 *    301's own door   (r0.95)     0.97 m      0.21 m       2.4 m, unmoved
 *
 *  (Those are lower than `(r + TOUCH_MARGIN) * trim` predicts, because the
 *  prompt names the WINNER: at 90° off, a neighbouring spot takes the offer
 *  before this one's own reach runs out. That is the number the player feels,
 *  which is why it is the one recorded.)
 *
 *  **THE AIMED COLUMN IS THE POINT.** It does not move, because the trim is not
 *  applied to it — so nothing became harder to select, it became harder to
 *  select BY ACCIDENT, which is the complaint. You still take a door from 2.4 m
 *  by looking at it; you no longer take it from 1.10 m by standing near it.
 *
 *  **IT IS NOT A KNOB FOR THE AIMED TIER AND MUST NOT BECOME ONE.** `looked`
 *  carries no margin term at all and reaches 6 m; capping it collapses the aimed
 *  reach onto the proximity radius and kills selection at 3 and 5 m, which is
 *  the half of the feature the user asked for by name and which
 *  `D-look-selects` exists to hold. Two builders have now tried it.
 *
 *  ⚠ WHAT IT COSTS, STATED RATHER THAN HIDDEN. `TOUCH_MARGIN`'s own derivation
 *  above is the No. 227 entry: r 1.05 with its door frame 1.15 m away, so
 *  1.05 + 0.15 = 1.20 was the SMALLEST reach that kept *"standing beside it,
 *  not looking"* working there. Trimmed, that spot reaches 0.96 m and the
 *  frame no longer sits inside it — **at No. 227 you must now glance at the
 *  door.** That is a real regression against an older request of his, it is
 *  reported rather than papered over, and it is the price of the newer one.
 *  Walked at the frame: aimed at the door it is still offered from 2.4 m in;
 *  aimed 90° away it drops from 0.87 m to 0.53 m. */
export const REACH_TRIM = 0.80;

/** The radius of the disc inside which a spot counts as **under your feet** —
 *  `pickSpot`'s tier-1 `onIt`, which wins with no aim test at all and is the
 *  only thing in the resolver that outranks `rank`.
 *
 *  IT WAS `RADIUS` ITSELF, THE PLAYER'S COLLISION CAPSULE, AND THAT COUPLING IS
 *  WHY IT IS SPELLED OUT HERE. `RADIUS` is a movement constant — every lane in
 *  the world was tuned against it and its own comment says *"only ever reduce
 *  this"* — so trimming the resolver by editing it would have moved the 2 m
 *  sidewalk lane, the alley mouth and every doorway to fix a prompt. Two
 *  separate facts had one number.
 *
 *  Trimmed by `REACH_TRIM` for the reason above: 0.36 -> 0.288. That is the
 *  disc that owned flat 301's south wall — the door's stand-point sits 0.46 m
 *  off it, and a 0.36 m disc about that point covers every square of floor a
 *  person stands on to read what is hung there. */
export const ON_IT = RADIUS * REACH_TRIM;

/** The look cone's CEILING, in radians — the widest half-angle that can ever
 *  count as "looking at" something, whatever the spot's radius or distance.
 *
 *  **THE USER CHOSE THIS NUMBER, 2026-08-03: 25°.** It is the one constant in
 *  this file that is a judgement rather than a measurement, because his two
 *  complaints pull on it in opposite directions and both are real:
 *
 *    35.5° -> *"i feel like i select stuff without even looking at it"*
 *    15.0° -> the dead ring: a door beside you is dead until you line up on it
 *
 *  Four builders released this row while it was a builder's call to make. It was
 *  put to him with both numbers and he picked the middle. **Do not re-tune it
 *  without him.**
 *
 *  EXPORTED BECAUSE TWO WORKERS RETYPED IT AND BOTH GOT IT WRONG. The clamp used
 *  to be two bare literals on the return line, and `atan2(r, d)` — the value
 *  BEFORE the clamp — was mistaken for the function's output twice, which cost
 *  this row a release and inverted its premise
 *  (`notes/ninetytwo-item98-the-plateau-is-the-clamp.md` §2). Anything that needs
 *  the ceiling imports it. */
export const LOOK_CEILING = 25 * Math.PI / 180;      // 0.4363 rad

/** The look cone's FLOOR, in radians (~11.46°) — so a small spot far away is not
 *  a pin-prick. UNCHANGED by the 25° decision: the floor governs distant, small
 *  spots, where nobody has complained in either direction, and the measured edge
 *  tracks `raw` to 0.28° out there already. Only the ceiling moved. */
export const LOOK_FLOOR = 0.20;

export function lookTolerance(r: number, d: number): number {
  const raw = Math.atan2(r, Math.max(0.35, d));
  // THE CEILING CAME DOWN FROM 35.5° TO 15°, on the user's report: *"i think
  // the selection options are a bit to wide. i feel like i select stuff without
  // even looking at it."*
  //
  // 35.5° is most of peripheral vision. Anything in that arc could win, so the
  // prompt had stopped meaning *this is what you are looking at* and started
  // meaning *something is near you* — and since the outline went behind the
  // debug flag, the prompt is the only selection feedback there is.
  //
  // MEASURED, scripts/D-offer-rate.mjs, identical routes before and after:
  //
  //   median off-axis angle of whatever won the prompt   10.8° -> 5.2°
  //   winners more than 15° off his aim                    48% -> 43%
  //   something offered at all, over 264 sampled stations  32% -> 32%
  //
  // SO THIS IS HALF THE FIX AND THE NUMBERS SAY WHICH HALF. The median halved,
  // which is the cone doing its job. The 43% residue and the unchanged 32% are
  // NOT the cone: they are the proximity rule, which ignores aim entirely by
  // design — `near = d < r + REACH_MARGIN`. That is why the worst sample is a
  // spot 180° BEHIND the player. Tightening the cone cannot touch those, and
  // narrowing REACH_MARGIN would break the thing he asked for first (a door you
  // are standing at opens without looking at it). The desk already named the
  // shape of the remaining work: keep proximity generous only for what you are
  // touching, and require real aim beyond that. Not done here.
  //
  // The walk rate he asked for is reported too — 0.25 -> 0.26 offers per 10 m —
  // but it rests on 5 and 6 offers over ~200 m and one offer moves it 20%, so
  // it is printed and not leant on. The aim distribution is the same complaint
  // measured where the data is.
  //
  // ONLY THE CONE MOVED. `REACH_MARGIN` is untouched, because proximity does
  // the other half of his original request — a door you are standing at opens
  // whether or not you are looking at it — and `D-walk`'s four-way door test
  // still passes on all four, including standing beside it NOT looking.
  // ── AND THE CEILING WENT BACK UP, 14.90° -> 25.00°, ON THE USER'S OWN
  // DECISION (item 98, 2026-08-03). See `LOOK_CEILING` above.
  //
  // WHY THE CEILING AND NOTHING ELSE. Four workers refused this row against four
  // different prescriptions — cap the aim-tier reach, switch to a `sin` form,
  // widen the corridor — and every one of them was measured wrong before it was
  // implemented. What was finally measured right is that **there are not two
  // regimes; there is one predicate sitting on its own ceiling.** At r = 1.05 the
  // world's edge reads 15° flat from 1.5 m to 4.0 m and only tracks `raw` past
  // 4.5 m, because `raw` does not fall under the ceiling until d = r/tan(ceil).
  // So below that distance the ceiling IS the answer, and above it the ceiling is
  // not in play at all — which is exactly why moving it is safe for the far
  // corridor `D-look-selects` holds, and why nothing else needed to move.
  //
  // WHAT IT BUYS, measured on this tree before and after (probes/w114-*):
  //   the dead ring — distances where the cone covers LESS than the spot's own
  //   radius, i.e. you can stand beside the door frame and get nothing —
  //   shrank from 1.20-3.90 m to 1.20-2.30 m. r/tan(25°) = 2.25 m, derived.
  //
  // WHAT IT COSTS: the aim-free proximity tier is untouched, so the "180° behind
  // him" winners in `D-offer-rate`'s tail are unchanged — they were never the
  // cone (see the note at `touching`, below). Only the aimed tier widened.
  return Math.min(LOOK_CEILING, Math.max(LOOK_FLOOR, raw));   // ~11.5° … 25.0°
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
  /** LINE OF SIGHT. A candidate that fails this cannot win, however near or
   *  however centred. *"an [E] target must be VISIBLE from where the player
   *  stands"* — and 'ever' was doing the work in that sentence, so it is a
   *  filter on the candidate list rather than a tiebreak.
   *
   *  It is supplied by the caller because only the caller has the scene. A
   *  proximity test alone cannot tell inside from outside, which is how the
   *  thrift offered itself through its own shopfront and the bed through the
   *  bed. */
  visible?: (s: T) => boolean,
  /** SEATED: a different rule, because a chair is a different body.
   *
   *  *"you sit and its the loan process as an integrated overlay"* and, of the
   *  library terminal, *"like the atm too. intergrated overlay."* A PC is a
   *  thing you SIT at, and until this existed **no seat in this world could
   *  carry an interaction you use while sitting on it** — `ct/int-bank.ts:1414`
   *  wrote that limit down after walking into it, and it is why the loan is
   *  transacted standing up in a room that has a chair for you.
   *
   *  Two changes, and both of them are removals rather than additions:
   *
   *  · **AIM DECIDES, PROXIMITY DOES NOT.** The aim-free `touching` pass exists
   *    so *"a door you are standing at opens without looking at it"* — it is
   *    about your FEET, and a seated player's feet are not going anywhere. Worse,
   *    it is exactly what made the seated case unusable in the first place: the
   *    thing nearest a sitting man is the chair he is sitting on, at d 0, and
   *    `offAxis + d * 0.02` handed it every contest before he could aim at
   *    anything. So tiers 1 and 3 are switched off and only tier 2 — AIMED AT —
   *    can win.
   *
   *  · **REACH SHRINKS TO ARM'S LENGTH.** Standing, `looked` runs to the
   *    caller's `reach` (6 m, a room's width), because pointing across a room at
   *    a door and opening it is a feature asked for by name. From a chair it is
   *    a bug: you cannot cross the room without getting up, so a spot you can
   *    SEE from a seat is not a spot you can USE from it. The bound is
   *    `s.r + RADIUS + REACH_MARGIN` — **not a new constant**: `REACH_MARGIN` is
   *    the one this file's own comment (see `REACH_MARGIN` above, and the note at
   *    `looked` below) has always said means *how far outside its radius a spot
   *    can be selected when you ARE looking at it*, and `RADIUS` is the player's
   *    own collision capsule, already imported at the top of this file. Standing
   *    deliberately does not apply the margin; sitting is the case where it is
   *    the right question.
   *
   *  · **AND THE GAP IS BETWEEN TWO BODIES, NOT FROM A POINT (item 289).** The
   *    first cut of this bound was `d < s.r + REACH_MARGIN`, which measures the
   *    span from the player's *centre* to the spot's edge and so silently
   *    charges the seated player 0.36 m of his own chest for every reach. That
   *    is the same error tier 1 below already had and already fixed: `onIt`
   *    was `d < 1e-4` until it was measured to be false in the world, and it is
   *    `d < RADIUS` now *because the player has a body*. The seated bound has to
   *    say it too, so the quantity being compared to `REACH_MARGIN` is the real
   *    gap `d - s.r - RADIUS` — surface to surface.
   *
   *  Derived against the user's own case rather than tuned: the client chair
   *  sits at (4.40, 2.62) and THE APPLICATION FORM at (3.75, 1.925) —
   *  `ct/int-bank.ts:1191-1197` — so 0.952 m against the form's own
   *  `0.70 + 0.36 + 0.60 = 1.66`. It clears by 0.71 m rather than by a hair,
   *  which matters: GOTCHAS 72, a margin the world can absorb is the only kind
   *  worth writing down.
   *
   *  **THE LOAN OFFICER IS WHY THE POINT FORM WAS WRONG.** She is two rows down
   *  the same file at r 1.0 and 1.67 m from the chair. Against the point form's
   *  1.60 she missed by **7 cm**, and this docstring used to record that as
   *  *"also the right answer"* — sit in the chair the user asked for, face the
   *  woman across the desk square on, and the world offered to stand you up.
   *  It is not the right answer: `ct/int-bank.ts:1183-1189` builds the whole
   *  interaction out of reaching both — *"you read the form, then you look up
   *  and hand it over"* — and the user asked for that chair by name (*"you sit
   *  and its the loan process as an integrated overlay"*). Against the
   *  body-to-body form she is inside 1.96 and clears by 0.29 m. **Nothing about
   *  the officer moved to achieve that**; the rule was 7 cm short of a room that
   *  was already built right.
   *
   *  **STANDING UP IS NOT DEMOTED INTO THIS CONTEST.** It cannot be — a view you
   *  cannot leave is the worst bug this project ships (BUILDER-BRIEF §11). The
   *  caller keeps standing up as the FALLBACK when this returns null, and
   *  Escape stands you up unconditionally at every level (`update()`'s seated
   *  branch, and this class's own capture-phase listener above it) whatever this
   *  function says. This can only ever add an option; it can never take one
   *  away. */
  opts?: { seated?: boolean },
): { spot: T; looked: boolean; offAxis: number; dist: number } | null {
  // THREE TIERS, NOT ONE KEY — and the middle one is the whole of this
  // function's history, because THIS KNOB HAS A USER COMPLAINT AT BOTH ENDS.
  //
  //   tier 1  STANDING IN IT, OR TOUCHING AND AIMED AT   onIt, then rank, then distance
  //   tier 2  AIMED AT                rank, then screen centre with distance breaking ties
  //   tier 3  TOUCHING, AIMED AWAY    rank, then distance
  //
  // (`rank` arrived with item 291 and orders WITHIN a tier only — see the note
  // above the keys below, and `Pickable.rank`.)
  //
  // END ONE — *"i dont want to be so far from the bed and the option is still
  // to sit on the bed and watch tv"*. This used to be a single
  // `offAxis + d*0.02` key for every candidate, so a touched-but-facing-away
  // spot could lose to a merely-aimed-at one: standing exactly ON the
  // apartment door's stand-point but facing the bed, the bed won
  // (scripts/w9-reach-repro.mjs). `fa5c32e01` answered it by splitting near
  // from looked and letting near win OUTRIGHT.
  //
  // END TWO — *"i dont want sit on bed and watch tv to be the main option if
  // im facing the door to leave"*, which is that same outright win read back
  // from the other side. In flat 301 the bed seat (r0.70) and the door spot
  // (r0.95) stand 1.27 m apart while their touch circles reach 0.85 m and
  // 1.10 m, so THE CIRCLES OVERLAP over most of the floor between them. Both
  // are `near` there, the near tier ranked by distance alone, and the bed won
  // no matter how squarely you were aimed at the door — 10 of 19 standable
  // cells, scripts/probes/w40-301-grid.mjs. Two spots 1.27 m apart is not an
  // accident of that room either; a seat and the door it faces are close
  // together everywhere in this world.
  //
  // RESTORING LOOKED-OVER-NEAR JUST RETURNS END ONE, so the near tier stays
  // and grows a facing gate instead: it keeps its unconditional win while you
  // are not plainly pointed at something else, and yields when you are. The
  // gate is `looked` itself — the SAME `lookTolerance` cone the rest of the
  // resolver uses, not a second angle constant that could drift away from it.
  //
  // WHAT PROTECTS END ONE IS TIER 1, via `onIt` — THE SPOT'S CENTRE IS INSIDE
  // YOUR OWN BODY, so which way you are facing is not a question the geometry
  // can answer, and the spot is unbeatable. You cannot look away from something
  // you are standing in.
  //
  // I FIRST WROTE THIS AS `d < 1e-4` — the existing degenerate-offAxis clause
  // below — reasoning that a spot you stand on has offAxis 0 by construction so
  // it is always `looked` and therefore always tier 1. THAT REASONING IS FALSE
  // IN THE WORLD, because the rig's `unstick` nudges you off the exact point:
  // warping onto the 301 door's own stand-point lands you 0.060 m away, not
  // 1e-4, and the clause never fires. Measured, not assumed — it cost
  // `seats-walk` 46 seats (115/219 -> 69/219, every one of them "sat at X but
  // the seat is at Y"), because that check stations the player at yaw 0 and
  // never faces the seat, so an aimed-at seat across the room took the press.
  // That is the wrong-bench bug `seats-walk` was written for, shipped once
  // already at `098269aa`, and a new pick that quietly re-opens it is worse
  // than no new pick at all.
  //
  // So the threshold is the PLAYER'S OWN COLLISION CAPSULE, `RADIUS`, which is
  // the honest form of what `d < 1e-4` was reaching for and is imported from
  // the top of this file rather than retyped. Inside it you are standing in the
  // thing; outside it, aim decides. That single constant is what holds w9's
  // repro and `seats-walk`'s standing assertion at one end while END TWO is
  // fixed at the other, and it is why the two complaints do not have to trade.
  //
  // AND TIER 3 IS STILL A TIER — *"standing beside it, not looking"* keeps
  // working, because a touched spot with nothing aimed-at to lose to still
  // wins. Measured at the case w9's note names as the reason for the outright
  // win, the No. 227 frame: at 0.00 m and at the 1.15 m facade-cushion
  // stand-off, over 16 headings, `enter No. 227` is the ONLY candidate in
  // every pose — nothing near it, nothing looked, nothing across the street
  // (scripts/probes/w40-227-frame.mjs). Demoting it costs nothing there
  // because there is nothing to be demoted below.
  //
  // ── AND RANK ORDERS EACH TIER, AHEAD OF THAT TIER'S OWN KEY (item 291) ──────
  //
  // *"just make the door high rank pls."* The way out of a room outranks the
  // furniture in it. `Pickable.rank` above carries the derivation; what matters
  // here is the SHAPE, because two of the three obvious shapes are wrong and
  // both were measured wrong rather than argued wrong:
  //
  //   · RANK ACROSS TIERS — a ranked door beats an aimed-at bed. Measured by
  //     worker onehundredsixteen: `[E]` on the bed you are looking at opened the
  //     door instead. Rank must never beat AIM.
  //   · RANK ABOVE `onIt` — a ranked door beats the calendar you are standing
  //     nose-to-nose with. That is the user's own guard rail on this request.
  //
  // So the comparison inside a tier is LEXICOGRAPHIC, most significant first:
  //
  //   tier 1   onIt  >  rank  >  distance
  //   tier 2   rank  >  offAxis + d*0.02
  //   tier 3   rank  >  distance
  //
  // Rank is a small integer and the keys are metres/radians, so they are
  // compared as a PAIR rather than folded into one number with a magic
  // multiplier — a weight big enough to dominate is a weight that silently
  // becomes a tier, which is the first mistake above wearing a disguise.
  const better = (rank: number, key: number, bRank: number, bKey: number) =>
    (rank !== bRank ? rank > bRank : key < bKey);
  let bestNearLooked: { spot: T; looked: boolean; offAxis: number; dist: number } | null = null;
  let bestNearLookedKey = Infinity, bestNearLookedRank = -Infinity, bestNearLookedOnIt = false;
  let bestLooked: { spot: T; looked: boolean; offAxis: number; dist: number } | null = null;
  let bestLookedKey = Infinity, bestLookedRank = -Infinity;
  let bestNearOnly: { spot: T; looked: boolean; offAxis: number; dist: number } | null = null;
  let bestNearOnlyKey = Infinity, bestNearOnlyRank = -Infinity;
  const fx = Math.sin(view.yaw), fz = -Math.cos(view.yaw);
  for (const s of spots) {
    if (!s.ok()) continue;
    const dx = s.x - view.x, dz = s.z - view.z;
    const d = Math.hypot(dx, dz);
    // Wider than the registered radius: *"easier in general. Widen the
    // volumes."* Every radius in the world was sized when proximity was the
    // only way in, so each is really "the circle I must stand in", and they are
    // tight enough that the No. 227 door could not be reached from its frame.
    // AIM-FREE PROXIMITY IS NOW ONLY FOR WHAT YOU ARE TOUCHING.
    //
    // This was `d < s.r + REACH_MARGIN` — 0.6 m of slack, and no reference to
    // where the player was pointing at all. Tightening the look cone from 35.5°
    // to 15° halved the median off-axis angle but left 43% of winners more than
    // 15° off his aim, and the worst sample in 264 was a spot **180° behind
    // him**. Those were never the cone: they were this line. *"i feel like i
    // select stuff without even looking at it."*
    //
    // So proximity keeps its aim-free pass only within TOUCH_MARGIN, which is a
    // quarter of the old slack, and everything further away has to be aimed at.
    // The value is not chosen, it is the user's own earlier example run
    // backwards: the No. 227 spot has r 1.05 and the door frame stands 1.15 m
    // from it, because the facade cushion pushes you off the wall — so anything
    // under 0.10 fails *"standing beside it, not looking"*, which he asked for
    // first and which must keep working. 0.15 clears that by 0.05 m and is the
    // smallest value that does.
    //
    // REACH_MARGIN is NOT gone: it still sets how far outside its radius a spot
    // can be selected when you ARE looking at it, which is what made doors easy
    // to open at a distance. What changed is that the slack now costs a glance.
    //
    // ── AND ALL OF IT IS TRIMMED BY `REACH_TRIM` NOW (item 309) ─────────────
    // *"with the radius for all these things a bit less."* The margin's own
    // derivation is unchanged and still says what the smallest UNTRIMMED value
    // was; the trim is a separate, later, world-wide decision and it is applied
    // here rather than by editing the margin so the two can be read apart. See
    // `REACH_TRIM` for the walked numbers and for what it costs at No. 227.
    const touching = d < (s.r + TOUCH_MARGIN) * REACH_TRIM;
    // angle between where you face and where the spot is, on the ground plane
    const offAxis = d < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
    // UNCHANGED: looking still reaches as far as it ever did. I briefly added a
    // clause here capping `looked` at `s.r + REACH_MARGIN`, which collapses the
    // aimed reach back onto the proximity radius and would have killed
    // selection at 3 and 5 m — the half of the feature he asked for by name and
    // that D-look-selects exists to hold. Narrowing the AIM-FREE pass is the
    // job; narrowing the aimed one is the opposite of the job.
    //
    // SEATED IS THE ONE CASE THAT DOES APPLY IT, and it is an `&&` on top of the
    // standing test rather than a replacement for it, so the seated reach can
    // only ever be SHORTER than the standing one. See `opts.seated` above.
    //
    // `+ RADIUS` IS THE PLAYER'S OWN BODY AND IT IS NOT A TUNING KNOB (item
    // 289). `d` runs from the seat pose — the player's CENTRE — to the spot's
    // centre, so the span a seated arm actually has to cross is `d - s.r -
    // RADIUS`, and comparing `d - s.r` to REACH_MARGIN charges him the width of
    // his own chest. That cost the bank's loan officer by 7 cm: 1.67 m against
    // an r of 1.0, so a gap of 0.67 m that is really 0.31 m of air. Same lesson
    // as `onIt` forty lines down, which was `d < 1e-4` until the world proved
    // the player is not a point. See the derivation in `opts.seated` above.
    const seated = opts?.seated === true;
    const looked = d < reach && offAxis < lookTolerance(s.r, d)
      && (!seated || d < s.r + RADIUS + REACH_MARGIN);
    // Seated, the aim-free pass is off entirely: `near` is what hands a sitting
    // player the chair he is already in. `opts` absent -> this line is
    // `near = touching`, exactly as it was, so nothing about a standing player's
    // selection moves by so much as a float.
    const near = seated ? false : touching;
    if (!near && !looked) continue;
    // WIDE AND VISIBLE, not narrow and blind. The volumes stay generous and the
    // look-at stays forgiving; sight is what gates them. Tested last because it
    // is the expensive one — a raycast per candidate, only for candidates that
    // have already passed the cheap tests.
    if (visible && !visible(s)) continue;
    // NEAR STILL BEATS LOOKED — but only while you are not plainly aimed at
    // something else, which is the facing gate the tier comment above sets out.
    // Ordering inside each tier is unchanged from what it has always been:
    // touching ranks by distance, aimed-at ranks by screen centre with distance
    // as the tiebreak.
    //
    // Making `looked` dominant OUTRIGHT — the obvious swing back, and the thing
    // to keep resisting — was wrong twice over. A door you were STANDING IN
    // stopped being offered because something else was nearer the centre of the
    // screen, and it broke `seats-walk`'s standing assertion, which is that
    // standing ON a seat offers THAT seat and not the one 0.67 m away. That
    // check exists because the bug it guards shipped once already (`098269aa`),
    // and a new pick that quietly re-opens it is worse than no new pick at all.
    // Both of those are poses where you are standing ON the spot, so both land
    // in tier 1 here and neither is reachable by anything in tiers 2 or 3.
    // THE SPOT'S CENTRE IS INSIDE YOUR OWN BODY. Not "very close" — inside the
    // capsule `blocked()` collides with, so no heading points away from it in
    // any meaningful sense. See the tier comment for why this is `RADIUS` and
    // not the degenerate `d < 1e-4` I tried first.
    //
    // ⚠ `ON_IT`, NOT `RADIUS`, SINCE ITEM 309. It is still derived from the
    // player's capsule and still means the same thing; what changed is that the
    // resolver's copy of it can be trimmed without moving the player's body.
    // The user asked for less reach on the interactables, not a narrower man.
    const onIt = d < ON_IT;
    const entry = { spot: s, looked, offAxis, dist: d };
    const rank = s.rank ?? 0;
    if (near && (looked || onIt)) {
      // `onIt` FIRST, and it is the only place in this function where rank is
      // outranked by something else. A spot you are standing IN is not competing
      // for your attention; it is under your feet. Among two spots you are
      // standing in — which the world does contain, wherever two stand-points
      // are closer than `2 * ON_IT` — rank then decides, and that is the case
      // `scripts/standpoint-overlap.mjs` exists to keep rare.
      if (bestNearLooked === null
        || (onIt !== bestNearLookedOnIt
          ? onIt
          : better(rank, d, bestNearLookedRank, bestNearLookedKey))) {
        bestNearLookedKey = d; bestNearLookedRank = rank;
        bestNearLookedOnIt = onIt; bestNearLooked = entry;
      }
    } else if (looked) {
      const key = offAxis + d * 0.02;
      if (better(rank, key, bestLookedRank, bestLookedKey)) {
        bestLookedKey = key; bestLookedRank = rank; bestLooked = entry;
      }
    } else {
      if (better(rank, d, bestNearOnlyRank, bestNearOnlyKey)) {
        bestNearOnlyKey = d; bestNearOnlyRank = rank; bestNearOnly = entry;
      }
    }
  }
  // touching-and-aimed-at, then aimed-at, then touching-but-aimed-away.
  return bestNearLooked ?? bestLooked ?? bestNearOnly;
}

/**
 * The selection outline — the SAME object the prompt names, contoured.
 *
 * Three reports on this, each a different fault, and the last two share a root:
 *
 *   1. *"this outline is not around the object"* — it was a screen-space
 *      rectangle, an axis-aligned crop marker enclosing wall and window.
 *   2. *"the door isnt high lighted?"* — a prompt with NO outline at all, which
 *      is the worst disagreement because the player cannot tell whether the
 *      feature is broken or the thing is not interactable.
 *   3. *"the highlight is not the CONTOUR of the full bed but simply the frame"*
 *      — the mattress, duvet and pillows standing outside the outline.
 *
 * **2 and 3 are the same bug.** The outliner resolved a single CHILD MESH and
 * traced that: for the bed it found the frame, for the door it found nothing at
 * all. The prompt and the highlight were agreeing on the SPOT and disagreeing
 * about what the OBJECT is. So the object is resolved once, as a whole, and both
 * the "which" and the "what" now come from the same place.
 *
 * Two rules fall out of that and are enforced below rather than hoped for:
 *
 * · **Every descendant is outlined**, so a bed outlines as a bed — frame,
 *   mattress and pillows — rather than as a crate around one.
 * · **A prompt ALWAYS draws something.** If no mesh can be resolved, a box at
 *   the spot is drawn instead. A highlight that is merely the wrong shape can be
 *   improved; one that is absent tells the player the feature is broken.
 *
 * Edge lines rather than an inverted hull: this world is blocky and unlit, so
 * `EdgesGeometry` gives the object's real hard edges, and `LineBasicMaterial` is
 * 1 px everywhere — constant screen thickness by construction rather than by
 * correcting for distance, which is the hull's real difficulty.
 */
export class SpotOutline {
  private group: THREE.Group | null = null;
  private shown: object | null = null;
  private mat = new THREE.LineBasicMaterial({
    color: 0xfff3c4, depthTest: false, transparent: true, opacity: 0.95,
  });

  /** DEBUG VIEW: the spot's own trigger VOLUME, which is what this always drew.
   *
   *  Four user reports killed it as a player feature and the diagnosis was the
   *  same for all four — *"the highlight is a wireframe CUBE sitting on the
   *  floorboards, nowhere near the door it is offering"*. It was never outlining
   *  the object; it was drawing the `ctx.spot()` proximity volume, because a
   *  spot carries a position and a radius and never carried the thing.
   *
   *  His ruling: *"get rid of outline unless debug is true, we'll probably want
   *  that for debug."* Which is exactly right, and it is why this code stays:
   *  **what made it a bad player feature is what makes it a good debug view.**
   *  Seeing where every `[E]` volume actually sits, how big it is, and which one
   *  you are standing in is the fastest way to diagnose "the prompt did not come
   *  up" or "I got the wrong thing" — the two complaints this whole item began
   *  with.
   *
   *  So it now draws the volume HONESTLY: a cylinder of the spot's real radius,
   *  not a cube, because the test is `hypot(dx, dz) < r + REACH_MARGIN` and a
   *  box would misreport the corners. The wider reach ring is drawn too, since
   *  that margin is the thing that made doors reachable and is worth seeing.
   */
  private volume(spot: Pickable): THREE.Group {
    const g = new THREE.Group();
    const ring = (r: number, y: number, h: number, colour: number, op: number) => {
      const eg = new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r, h, 16, 1, true), 1);
      const ln = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
        color: colour, depthTest: false, transparent: true, opacity: op,
      }));
      ln.renderOrder = 999;
      ln.position.set(spot.x, y, spot.z);
      g.add(ln);
    };
    ring(spot.r, 0.9, 1.8, 0xfff3c4, 0.95);                       // the registered radius
    ring(spot.r + REACH_MARGIN, 0.06, 0.02, 0x7fd4ff, 0.55);      // the reach margin, on the floor
    return g;
  }

  private clear(scene: THREE.Object3D): void {
    if (this.group) {
      scene.remove(this.group);
      this.group.traverse((o) => { const l = o as THREE.LineSegments; if (l.isLineSegments) l.geometry.dispose(); });
      this.group = null;
    }
    this.shown = null;
  }

  /** Draw the spot's trigger volume, or clear when null. DEBUG ONLY — the
   *  caller passes null in normal play, which is the shipped behaviour. */
  show(scene: THREE.Object3D, spot: (Pickable & object) | null): void {
    if (!spot) { if (this.shown) this.clear(scene); return; }
    if (spot === this.shown) return;
    this.clear(scene);
    const g = this.volume(spot);
    scene.add(g);
    this.group = g;
    this.shown = spot;
  }

  /** For the audit: a debug volume is drawn for every live spot, always. */
  resolves(_spot: Pickable & object): boolean { return true; }
}

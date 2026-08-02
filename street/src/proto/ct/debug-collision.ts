import * as THREE from 'three';
import type { AABB } from '../fp';
import { trapAgainst } from './gap';

// ── the collision debug overlay ─────────────────────────────────────────────
//
// *"can we implement a debug mode where i press a toggle to view collision?"*
//
// Every one of the costliest bugs of the last week was INVISIBLE collision:
// two thirds of the jail site was solid building, the thrift keeper stood 5 cm
// inside her own back wall, and a parked-car gap once produced *"im literally
// stuck here"* — a slot a player could walk into and not out of. Every one of
// those would have been obvious at a glance with the colliders drawn. This is
// that glance.
//
// It draws exactly what `window.__ct.colliders()` already returns — the real
// array the movement code in `fp.ts` is blocked by, not a redrawn copy of it —
// so there is no way for the overlay to disagree with what actually stops you.
// Wireframe, on purpose: a solid fill would hide the very thing you are trying
// to compare the box against.
//
// OFF BY DEFAULT AND TRULY OFF. `update()` below does nothing at all — no
// group, no geometry, no scene.add — until the first call with `on: true`.
// Toggled from `crosstown.ts`'s own frame loop (bounded exception, see
// notes/debug-collision.md); nothing here reaches into movement, collision
// resolution, `unstick()` or `pickSpot`.
//
// GEOMETRY AND MATERIALS ARE LAZY, NOT MODULE-LEVEL, AND THAT IS LOAD-BEARING
// — not just tidiness. `ct/rng.ts` (GOTCHAS §2) and the fingerprint harness
// (GOTCHAS §31) both warn that three.js burns FOUR `Math.random()` calls per
// object in `generateUUID`, and that this module is imported unconditionally
// by `crosstown.ts` at the top of the file — before a single tree or texture
// is built. A `const UNIT = new THREE.EdgesGeometry(...)` at module scope
// would therefore steal draws from the ONE shared seeded stream on every load
// of the game, whether or not a single player ever presses V, and reshuffle
// every tree height, pigeon position and paint-noise pattern downstream of it.
// Measured: with that shape, `npm run fp before`/`after` disagreed on
// textures/structure/tints/places with IDENTICAL object counts, purely from
// this file being imported. Building lazily on first real use — which only
// happens once a player actually turns the overlay on — closes that; the
// fingerprint is IDENTICAL bit-for-bit with the overlay never toggled.

/** Box height drawn for a collider with no `maxY` of its own — still most of
 *  them: item 1 (BUILDER-BRIEF, notes/w13-collider-volume.md) made `AABB.maxY`
 *  possible, but only ONE collider in the world sets it so far (the pickup's
 *  bed floor). Every other box is still a wall at every height a player can
 *  stand at, so this is still not a measurement of anything real for those —
 *  just tall enough to read as a wall rather than a curb. A collider that DOES
 *  carry `maxY` is drawn at its own real height instead, below. */
const BOX_H = 2.4;

/** A corridor under this reads red. Matches `ct/gap.ts`'s own `PASSABLE`
 *  (0.95 m — comfortably past the 0.72 m player) rather than inventing a
 *  second number: `trapAgainst` below is the SAME function the parked-car
 *  draw is constrained by, so the overlay cannot disagree with the rule that
 *  is actually enforced at build time. */

let unitGeo: THREE.EdgesGeometry | null = null;
let okMat: THREE.LineBasicMaterial | null = null;
let trapMat: THREE.LineBasicMaterial | null = null;
let playerMat: THREE.LineBasicMaterial | null = null;

/** Built on the FIRST call, ever, across every ColliderDebug instance — see
 *  the note above on why this cannot be module-level `const`. */
function shared() {
  if (!unitGeo) {
    unitGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    okMat = new THREE.LineBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.85, depthTest: false });
    trapMat = new THREE.LineBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.95, depthTest: false });
    playerMat = new THREE.LineBasicMaterial({ color: 0x40c4ff, transparent: true, opacity: 0.95, depthTest: false });
  }
  return { unitGeo: unitGeo!, okMat: okMat!, trapMat: trapMat!, playerMat: playerMat! };
}

export class ColliderDebug {
  private group: THREE.Group | null = null;
  private boxes: THREE.LineSegments[] = [];
  private playerBox: THREE.LineSegments | null = null;
  private builtFor = -1; // collider count the pool was sized for; -1 = not built

  private build(scene: THREE.Scene, n: number): void {
    this.teardown(scene);
    const { unitGeo, okMat, playerMat } = shared();
    const g = new THREE.Group();
    g.renderOrder = 999; // never let the overlay occlude, or get occluded oddly, against unlit flats
    for (let i = 0; i < n; i++) {
      const ls = new THREE.LineSegments(unitGeo, okMat);
      ls.renderOrder = 999;
      g.add(ls);
      this.boxes.push(ls);
    }
    const p = new THREE.LineSegments(unitGeo, playerMat);
    p.renderOrder = 999;
    g.add(p);
    this.playerBox = p;
    scene.add(g);
    this.group = g;
    this.builtFor = n;
  }

  /** Tear down completely: the "truly off" half of the contract. The shared
   *  geometry and materials from `shared()` are left alone — once built (on
   *  the first `on: true`, ever) they are never disposed, because they are
   *  the one small allocation the WHOLE overlay costs, made at most once, no
   *  matter how many times it is toggled or how many instances exist. */
  private teardown(scene: THREE.Scene): void {
    if (this.group) scene.remove(this.group);
    this.group = null;
    this.boxes = [];
    this.playerBox = null;
    this.builtFor = -1;
  }

  /**
   * Draw every live collider as a wireframe box, red where it forms a
   * corridor trap against a neighbour, plus the player's own collision
   * footprint. Call every frame; with `on: false` (or before ever calling
   * this at all) it costs nothing — no draw calls, no scene objects, no
   * `__ct` noise.
   *
   * `floorY` anchors the box height. It is the player's OWN current floor —
   * reuse whatever the caller already reads for the frame (`apt.gy()` in
   * `crosstown.ts`), never a per-collider lookup: this file has no mandate to
   * call into the floor picker (GOTCHAS §7 — that hysteresis has exactly one
   * writer and this is not it), and every collider currently reachable is on
   * the floor the player is already standing on.
   */
  update(scene: THREE.Scene, colliders: AABB[], floorY: number,
    player: { x: number; z: number; radius: number }, on: boolean): void {
    if (!on) { if (this.group) this.teardown(scene); return; }
    if (this.builtFor !== colliders.length) this.build(scene, colliders.length);
    const { okMat, trapMat } = shared();
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const sx = Math.max(0.05, c.maxX - c.minX);
      const sz = Math.max(0.05, c.maxZ - c.minZ);
      // A collider with a real `maxY` (item 1) is drawn at its OWN height
      // above `floorY`, not the generic wall height — the whole point of
      // giving one a top is that it stops being a wall at every height, and
      // the debug view should say so rather than keep drawing it as one.
      const h = c.maxY !== undefined ? Math.max(0.05, c.maxY) : BOX_H;
      const b = this.boxes[i];
      b.position.set((c.minX + c.maxX) / 2, floorY + h / 2, (c.minZ + c.maxZ) / 2);
      b.scale.set(sx, h, sz);
      b.material = trapAgainst(c, colliders) ? trapMat : okMat;
    }
    // the player's own capsule. blocked() (fp.ts) expands every collider by
    // RADIUS on X and Z independently — a SQUARE Minkowski sum, not a circle
    // — so a cube of side 2*RADIUS is the honest shape, not an approximation.
    const d = player.radius * 2;
    this.playerBox!.position.set(player.x, floorY + d / 2, player.z);
    this.playerBox!.scale.set(d, d, d);
  }
}

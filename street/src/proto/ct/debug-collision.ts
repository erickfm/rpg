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
 *  possible, and the vehicle fleet (`ct/cars.ts`) and 301's furniture
 *  (`ct/apartment.ts`) now use it, but every other box is still a wall at
 *  every height a player can stand at. For those this is not a measurement of
 *  anything real — just tall enough to read as a wall rather than a curb. A
 *  collider that DOES carry `maxY` is drawn to its own real top instead,
 *  below.
 *
 *  ⚠ THE TRAP, WRITTEN DOWN BECAUSE IT ALREADY CAUGHT SOMEONE: `AABB.maxY` is
 *  an ABSOLUTE WORLD Y, not a height above anything. `BOX_H` here IS a height.
 *  They are not interchangeable and they only looked interchangeable for as
 *  long as every capped collider sat at street level, where the floor is ~0.
 *  See the note at the `h` computation in `update()`. */
const BOX_H = 2.4;

/** A corridor under this reads red. Matches `ct/gap.ts`'s own `PASSABLE`
 *  (0.95 m — comfortably past the 0.72 m player) rather than inventing a
 *  second number: `trapAgainst` below is the SAME function the parked-car
 *  draw is constrained by, so the overlay cannot disagree with the rule that
 *  is actually enforced at build time. */

let unitGeo: THREE.EdgesGeometry | null = null;
let okMat: THREE.LineBasicMaterial | null = null;
let trapMat: THREE.LineBasicMaterial | null = null;
let actorMat: THREE.LineBasicMaterial | null = null;
let playerMat: THREE.LineBasicMaterial | null = null;

/** Built on the FIRST call, ever, across every ColliderDebug instance — see
 *  the note above on why this cannot be module-level `const`. */
function shared() {
  if (!unitGeo) {
    unitGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    okMat = new THREE.LineBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.85, depthTest: false });
    trapMat = new THREE.LineBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.95, depthTest: false });
    // A MOVING ACTOR — a citizen or a vehicle. Amber, so it reads as "solid,
    // but it is a person and it will walk on", distinct from both the green of
    // static geometry and the red of a trap. It is deliberately NOT hidden:
    // these boxes really do stop the player, and an overlay that drew only
    // some of what blocks you would be lying in the other direction.
    actorMat = new THREE.LineBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9, depthTest: false });
    playerMat = new THREE.LineBasicMaterial({ color: 0x40c4ff, transparent: true, opacity: 0.95, depthTest: false });
  }
  return { unitGeo: unitGeo!, okMat: okMat!, trapMat: trapMat!, actorMat: actorMat!, playerMat: playerMat! };
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
   *
   * It is also what converts a capped collider's ABSOLUTE `maxY` into the
   * height this file actually draws with — see the note at `h` below, and do
   * not drop the subtraction.
   */
  update(scene: THREE.Scene, colliders: AABB[], floorY: number,
    player: { x: number; z: number; radius: number }, on: boolean,
    actors?: ReadonlySet<AABB>): void {
    if (!on) { if (this.group) this.teardown(scene); return; }
    if (this.builtFor !== colliders.length) this.build(scene, colliders.length);
    const { okMat, trapMat, actorMat } = shared();
    // A PEDESTRIAN IS NOT A TRAP, AND THE OVERLAY USED TO SAY IT WAS.
    //
    // `ct/crowd.ts:168` puts every citizen's box into the same array through
    // `ctx.solid`, and traffic does the same for vehicles, so `trapAgainst`
    // was measuring corridors against things that walk away. On the east walk
    // that painted standing red the whole length of the lane — the citizen
    // lane is x 6.00 +/- 0.25 (`ct/crowd-net.ts:87`) and the block faces are at
    // 6.70/6.88, which is 0.45-0.63 m and well under the 0.95 m that reads red.
    //
    // It cost a real queue item: a builder's red-dump read one of those moving
    // boxes out of the array and wrote it down as a static prop, and the desk
    // queued a trap that does not exist. The overlay is the user's own tool for
    // finding bugs, so red has to mean something he can act on.
    //
    // So actors are drawn (they DO stop you) but never scored: they are neither
    // a trap candidate nor a wall that can form one. The filter is by object
    // IDENTITY against the set the entry point builds at the two registration
    // hooks — not a guess from a box's size, which would have caught real
    // 0.5 x 0.5 furniture too.
    const statics = actors && actors.size
      ? colliders.filter((c) => !actors.has(c))
      : colliders;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const sx = Math.max(0.05, c.maxX - c.minX);
      const sz = Math.max(0.05, c.maxZ - c.minZ);
      // A collider with a real `maxY` (item 1) is drawn at its OWN height
      // above `floorY`, not the generic wall height — the whole point of
      // giving one a top is that it stops being a wall at every height, and
      // the debug view should say so rather than keep drawing it as one.
      //
      // ⚠ `maxY` IS AN ABSOLUTE WORLD Y, NOT A HEIGHT. This line read
      // `Math.max(0.05, c.maxY)` until 2026-08-04 and so drew the world
      // coordinate as if it were a height above `floorY`. It went unnoticed
      // for as long as the only capped colliders were car roofs and the
      // pickup's bed, all of which sit on the street where `floorY` is ~0 and
      // the two numbers coincide. The moment 301's furniture got tops
      // (`ct/apartment.ts`, commit e3055f58) the coincidence broke: a bed
      // whose top is world Y 5.86 on a third storey was drawn as a 5.86 m
      // tower from the flat's floor, and the user — *"i hit v and i see
      // collision go all the way up but then i can jump on the bed. doesnt
      // make sense to me"* — was looking at a box that disagreed with the
      // thing that stopped him. That is the ONE promise this overlay makes
      // (see the header: it "cannot disagree with what actually stops you"),
      // so subtract `floorY` and keep it subtracted.
      //
      // `fp.ts` is the authority on the semantics and it is unambiguous:
      // `standTop` returns `c.maxY` straight out as the world height it
      // plants your feet at (`fp.ts:414`), and `blocked` compares it against
      // `atY`, world feet Y (`fp.ts:392`). Absolute, both times.
      //
      // The clamp is not cosmetic either: a top at or BELOW the player's own
      // floor — another storey's furniture still live in the array — would
      // otherwise scale the box negative and draw it inside out. 5 cm of
      // wireframe on the floor is the honest picture of "this does not stop
      // you up here".
      const h = c.maxY !== undefined ? Math.max(0.05, c.maxY - floorY) : BOX_H;
      const b = this.boxes[i];
      // A TURNED collider (`AABB.rot`, item 36) is drawn TURNED. Its min/max
      // are extents in its own frame and `rot` spins it about its own centre —
      // which is the same centre either way, so only the rotation is new. The
      // whole contract of this overlay is that it cannot disagree with what
      // actually stops you; drawing the bodega's chamfer as an axis-aligned box
      // would have put a wireframe across the pavement it leaves walkable and
      // none along the wall you actually collide with.
      b.position.set((c.minX + c.maxX) / 2, floorY + h / 2, (c.minZ + c.maxZ) / 2);
      b.rotation.y = c.rot ?? 0;
      b.scale.set(sx, h, sz);
      b.material = actors?.has(c) ? actorMat
        : trapAgainst(c, statics) ? trapMat : okMat;
    }
    // the player's own capsule. blocked() (fp.ts) expands every collider by
    // RADIUS on X and Z independently — a SQUARE Minkowski sum, not a circle
    // — so a cube of side 2*RADIUS is the honest shape, not an approximation.
    const d = player.radius * 2;
    this.playerBox!.position.set(player.x, floorY + d / 2, player.z);
    this.playerBox!.scale.set(d, d, d);
  }
}

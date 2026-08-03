/**
 * WHERE THERE IS ACTUALLY A FLOOR — the scene's answer, not the picker's.
 *
 * Hoisted for item 226 from `scripts/w75-site-contained.mjs:137-207`, which item
 * 215 wrote and validated. It is copied here rather than left in place because
 * `interiors-walk.mjs` now needs the identical predicate and BUILDER-BRIEF §8
 * forbids a second hand-typed copy. **`w75-site-contained.mjs` still holds its
 * own inline original** — pointing it at this module is a one-line change to a
 * registered check that is currently and CORRECTLY red at the lot, which item
 * 226 does not name, so it is filed as a follow-up rather than done here
 * (BUILDER-BRIEF §9).
 *
 * WHY NOT `groundAt()`. `groundPick` (`crosstown.ts:1263`) falls all the way
 * through to `return put(... ? KERB_H : 0)` — it NEVER returns null, so it names
 * a height for every point in R², void included. A containment check built on it
 * is green over a hole by construction.
 *
 * WHY EIGHT CORNERS. A floor is a `PlaneGeometry` rotated -90° about X, so its
 * LOCAL bounding box is flat in Z and only the TRANSFORMED one is flat in Y.
 * Pushing all eight corners through `matrixWorld` is what makes the rotation
 * irrelevant, and it is why this needs to know nothing about how any particular
 * module builds its ground.
 */

/** a body has width; a centre 0.25 m past the last polygon is still on it */
export const EDGE = 0.25;
/** how far a floor may sit below/above the height the picker names before it is
 *  a different storey — the walk-up's flats are 2.7 m apart, so this separates
 *  them without splitting a dais from its own nave */
export const FLOOR_LO = 0.9, FLOOR_HI = 1.2;

/** every floor-shaped mesh in the scene, in world coordinates */
export async function sampleFloors(page) {
  return page.evaluate(() => {
    const out = [];
    window.__ct.scene().updateMatrixWorld(true);
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      let mnx = Infinity, mny = Infinity, mnz = Infinity;
      let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
      const e = o.matrixWorld.elements;
      for (let i = 0; i < 8; i++) {
        const vx = i & 1 ? bb.max.x : bb.min.x;
        const vy = i & 2 ? bb.max.y : bb.min.y;
        const vz = i & 4 ? bb.max.z : bb.min.z;
        const X = e[0] * vx + e[4] * vy + e[8] * vz + e[12];
        const Y = e[1] * vx + e[5] * vy + e[9] * vz + e[13];
        const Z = e[2] * vx + e[6] * vy + e[10] * vz + e[14];
        mnx = Math.min(mnx, X); mxx = Math.max(mxx, X);
        mny = Math.min(mny, Y); mxy = Math.max(mxy, Y);
        mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
      }
      if (mxy - mny > 0.6) return;                    // thin in Y
      if (mxx - mnx < 1 || mxz - mnz < 1) return;     // and a metre across
      out.push({ minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz, y: mxy });
    });
    return out;
  });
}

/** `(x, z, gy) => boolean` — is there a floor mesh under this point, at the
 *  storey the picker names there */
export function makeHasFloor(floors) {
  return (x, z, gy) => floors.some((fl) =>
    x >= fl.minX - EDGE && x <= fl.maxX + EDGE
    && z >= fl.minZ - EDGE && z <= fl.maxZ + EDGE
    && fl.y >= gy - FLOOR_LO && fl.y <= gy + FLOOR_HI);
}

/**
 * THE PREDICATE MUST SELF-TEST ON BOTH SIGNS BEFORE ANYTHING IS WALKED.
 *
 * A "no floor here" predicate that finds no floors anywhere goes red on a sealed
 * world; one that finds a floor everywhere goes green on a hole. Both are
 * silent, and this repo has shipped both shapes. Returns `[]` when it is sound,
 * or a list of reasons the caller must refuse to produce a verdict on.
 *
 * The negative control is 60 m south of the world's own south clamp (-110.6,
 * `crosstown.ts:1216`): a point the player provably cannot reach and that
 * provably has nothing on it.
 */
export async function selfTestFloors(page, floors, hasFloor, minMeshes = 100) {
  const bad = [];
  if (floors.length < minMeshes) {
    bad.push(`only ${floors.length} floor-shaped meshes in the whole scene (want >= ${minMeshes})`);
  }
  const at = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  if (!hasFloor(0, 0, await at(0, 0))) {
    bad.push('the middle of the road reads as VOID — the predicate finds no floors');
  }
  if (hasFloor(0, -170, await at(0, -170))) {
    bad.push('a point 60 m past the world clamp reads as FLOORED — the predicate cannot say no');
  }
  return bad;
}

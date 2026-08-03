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


/* ────────────────────────────────────────────────────────────────────────────
 * THE SECOND PREDICATE: A RAYCAST. Hoisted for item 238 from
 * `scripts/world-contained.mjs:104-224` (item 230), verbatim.
 *
 * WHY BOTH PREDICATES NOW LIVE IN ONE FILE. Item 238 ran them over one shared
 * point set of 731,322 cells and they DISAGREE — the boxes over-claim, badly.
 * The numbers, and the reasoning for which one wins, are in
 * `scripts/probes/w91-floor-predicate-reconcile.mjs`. **The raycast is
 * authoritative.** `makeHasFloor` above is kept only because two registered
 * checks still call it; its over-claim is documented at its own definition.
 * Keeping both here means the next person comparing them cannot accidentally
 * compare two different vintages of the same idea.
 *
 * A downward ray at fixed (x, z) is a point-in-triangle test on the XZ plane,
 * so vertical surfaces drop out for free: a wall's triangles project to a
 * zero-area line and can never be stood on, with nobody writing a rule about
 * what a wall looks like. Triangle-major rather than point-major, so the cost
 * is O(scene) not O(scene x cells).
 *
 * `drop` is the mutation hook for --selftest: with the big flat street-level
 * meshes removed the road MUST read void, or the predicate cannot fail.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function sweepFloorsRay(page, opts = {}) {
  const GRID = opts.GRID ?? 0.5;
  const LO = opts.FLOOR_LO ?? FLOOR_LO;
  const HI = opts.FLOOR_HI ?? FLOOR_HI;
  const drop = opts.drop ?? false;
  return page.evaluate(([GRID, FLOOR_LO, FLOOR_HI, drop]) => {
  const ct = window.__ct;
  const B = ct.bounds();
  const scene = ct.scene();
  scene.updateMatrixWorld(true);

  const x0 = Math.floor(B.minX / GRID) * GRID, x1 = Math.ceil(B.maxX / GRID) * GRID;
  const z0 = Math.floor(B.minZ / GRID) * GRID, z1 = Math.ceil(B.maxZ / GRID) * GRID;
  const NX = Math.round((x1 - x0) / GRID) + 1, NZ = Math.round((z1 - z0) / GRID) + 1;
  const at = (i, j) => i * NZ + j;
  const cx = (i) => x0 + i * GRID, cz = (j) => z0 + j * GRID;

  // gy FIRST, and it is the ONLY thing the picker is asked. It centres the band
  // below; it never decides anything.
  const gy = new Float32Array(NX * NZ);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) gy[at(i, j)] = ct.groundAt(cx(i), cz(j));

  // ── rasterise every triangle in the scene ───────────────────────────────
  const floor = new Uint8Array(NX * NZ);      // any surface inside the band
  const topY = new Float32Array(NX * NZ).fill(-Infinity);
  let meshes = 0, tris = 0, hits = 0, dropped = 0;
  const A = [0, 0, 0], C = [0, 0, 0], D = [0, 0, 0];

  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // `visible` IS NOT CONSULTED — GOTCHAS 79. The region cull hides every
    // interior you are not standing in and everything west of REGION_X, and a
    // floor does not stop being a floor when the camera is not looking at it.
    // Filtering on it here would examine almost nothing and report green.
    // --selftest's mutation. IT IS GEOMETRIC, NOT BY NAME: the first version
    // dropped meshes whose `name` contained "ground"/"road"/"pave" and removed
    // exactly ZERO of them, because almost nothing in this scene is named. It
    // reported "the road still reads floored with its own ground removed" —
    // which was true, and about nothing. A mutation that mutates nothing is the
    // empty-set certificate this project keeps paying for (item 224), so the
    // count is asserted below.
    if (drop) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb0 = o.geometry.boundingBox;
      if (bb0) {
        const e0 = o.matrixWorld.elements;
        let ax = Infinity, ay = Infinity, az = Infinity, bx = -Infinity, by = -Infinity, bz = -Infinity;
        for (let i = 0; i < 8; i++) {
          const vx = i & 1 ? bb0.max.x : bb0.min.x, vy = i & 2 ? bb0.max.y : bb0.min.y, vz = i & 4 ? bb0.max.z : bb0.min.z;
          const X = e0[0] * vx + e0[4] * vy + e0[8] * vz + e0[12];
          const Y = e0[1] * vx + e0[5] * vy + e0[9] * vz + e0[13];
          const Z = e0[2] * vx + e0[6] * vy + e0[10] * vz + e0[14];
          ax = Math.min(ax, X); bx = Math.max(bx, X); ay = Math.min(ay, Y);
          by = Math.max(by, Y); az = Math.min(az, Z); bz = Math.max(bz, Z);
        }
        // FLAT AND AT STREET LEVEL. The size test that was here (">5 m across
        // in both axes") left the 0.5 m road centre-line plane behind, and the
        // sentinel went on reading floored off a lane marking. Drop anything
        // thin and near the ground, whatever its footprint.
        if (by - ay < 0.6 && by > -0.5 && by < 0.5) { dropped++; return; }
      }
    }
    const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (!pos) return;
    meshes++;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    const e = o.matrixWorld.elements;
    const xf = (k, out) => {
      const vx = pos.getX(k), vy = pos.getY(k), vz = pos.getZ(k);
      out[0] = e[0] * vx + e[4] * vy + e[8] * vz + e[12];
      out[1] = e[1] * vx + e[5] * vy + e[9] * vz + e[13];
      out[2] = e[2] * vx + e[6] * vy + e[10] * vz + e[14];
    };
    for (let t = 0; t + 2 < n; t += 3) {
      xf(idx ? idx.getX(t) : t, A);
      xf(idx ? idx.getX(t + 1) : t + 1, C);
      xf(idx ? idx.getX(t + 2) : t + 2, D);
      tris++;
      // XZ projection. A vertical face projects to a segment, area 0, and is
      // skipped by the degeneracy guard below — which is exactly right: you
      // cannot stand on a wall.
      const ax = A[0], az = A[2], bx = C[0], bz = C[2], dx = D[0], dz = D[2];
      const det = (bx - ax) * (dz - az) - (dx - ax) * (bz - az);
      if (!(Math.abs(det) > 1e-9)) continue;
      let mnx = Math.min(ax, bx, dx), mxx = Math.max(ax, bx, dx);
      let mnz = Math.min(az, bz, dz), mxz = Math.max(az, bz, dz);
      if (mxx < x0 || mnx > x1 || mxz < z0 || mnz > z1) continue;
      const i0 = Math.max(0, Math.ceil((mnx - x0) / GRID)), i1 = Math.min(NX - 1, Math.floor((mxx - x0) / GRID));
      const j0 = Math.max(0, Math.ceil((mnz - z0) / GRID)), j1 = Math.min(NZ - 1, Math.floor((mxz - z0) / GRID));
      for (let i = i0; i <= i1; i++) {
        const px = cx(i);
        for (let j = j0; j <= j1; j++) {
          const pz = cz(j);
          // barycentric, normalised by det so the tolerance is relative to the
          // triangle rather than to the world scale
          const w0 = ((bx - px) * (dz - pz) - (dx - px) * (bz - pz)) / det;
          const w1 = ((dx - px) * (az - pz) - (ax - px) * (dz - pz)) / det;
          const w2 = 1 - w0 - w1;
          const EPS = -1e-6;
          if (w0 < EPS || w1 < EPS || w2 < EPS) continue;
          const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
          const k = at(i, j);
          hits++;
          if (y > topY[k]) topY[k] = y;
          if (y >= gy[k] - FLOOR_LO && y <= gy[k] + FLOOR_HI) floor[k] = 1;
        }
      }
    }
  });

  return {
    B, x0, z0, NX, NZ, GRID, meshes, tris, hits, dropped,
    floor: Array.from(floor),
    gy: Array.from(gy, (v) => +v.toFixed(3)),
  };

  }, [GRID, LO, HI, drop]);
}

/** `(x, z) => boolean` off a `sweepFloorsRay` result — nearest cell, false
 *  outside the swept rectangle */
export function makeFloorAtRay(sweep) {
  const { x0, z0, NX, NZ, GRID } = sweep;
  return (x, z) => {
    const i = Math.round((x - x0) / GRID), j = Math.round((z - z0) / GRID);
    return i >= 0 && i < NX && j >= 0 && j < NZ ? sweep.floor[i * NZ + j] === 1 : false;
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * THE RAYCAST AS AN EXACT POINT QUERY — for walks, which do not land on cells.
 *
 * `makeFloorAtRay` snaps to the nearest 0.5 m cell, which is right for a world
 * sweep and WRONG for a walk: worker eightytwo's doubt on item 238 was that
 * "a 6-point spread would not reliably step in a 0.36 m gap", and a 0.5 m grid
 * has exactly that problem — a 0.30 m gap need not contain a multiple of 0.5,
 * so it can fall between two samples entirely. Measured at the party-wall
 * doorway: ONE grid column lands inside it, and only by luck of phase.
 *
 * So a caller that asks about arbitrary points gets arbitrary precision. The
 * triangle index is built ONCE and left in the page; each query is one round
 * trip against it rather than a re-traverse of 7870 meshes.
 *
 * Signature is `(x, z, gy) => Promise<boolean>`, deliberately the same shape as
 * `makeHasFloor`'s so it is a drop-in for the AABB predicate it replaces.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function installRayFloorQuery(page, opts = {}) {
  const LO = opts.FLOOR_LO ?? FLOOR_LO;
  const HI = opts.FLOOR_HI ?? FLOOR_HI;
  const BUCKET = opts.BUCKET ?? 4;
  const built = await page.evaluate(([LO, HI, BUCKET]) => {
    const scene = window.__ct.scene();
    scene.updateMatrixWorld(true);
    const index = new Map();
    let tris = 0, meshes = 0;
    const key = (i, j) => i * 100003 + j;
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
      if (!pos) return;
      // `visible` IS NOT CONSULTED — GOTCHAS 79. The region cull hides every
      // interior you are not standing in; a floor does not stop being a floor
      // because the camera is elsewhere.
      meshes++;
      const idx = o.geometry.getIndex();
      const n = idx ? idx.count : pos.count;
      const e = o.matrixWorld.elements;
      const xf = (k) => {
        const vx = pos.getX(k), vy = pos.getY(k), vz = pos.getZ(k);
        return [e[0] * vx + e[4] * vy + e[8] * vz + e[12],
          e[1] * vx + e[5] * vy + e[9] * vz + e[13],
          e[2] * vx + e[6] * vy + e[10] * vz + e[14]];
      };
      for (let t = 0; t + 2 < n; t += 3) {
        const A = xf(idx ? idx.getX(t) : t);
        const C = xf(idx ? idx.getX(t + 1) : t + 1);
        const D = xf(idx ? idx.getX(t + 2) : t + 2);
        // A VERTICAL FACE PROJECTS TO A ZERO-AREA LINE and is dropped here.
        // That is the property worth having: you cannot stand on a wall, and
        // nobody had to write down what a wall looks like.
        const det = (C[0] - A[0]) * (D[2] - A[2]) - (D[0] - A[0]) * (C[2] - A[2]);
        if (!(Math.abs(det) > 1e-9)) continue;
        const tri = [A, C, D, det];
        tris++;
        const i0 = Math.floor(Math.min(A[0], C[0], D[0]) / BUCKET);
        const i1 = Math.floor(Math.max(A[0], C[0], D[0]) / BUCKET);
        const j0 = Math.floor(Math.min(A[2], C[2], D[2]) / BUCKET);
        const j1 = Math.floor(Math.max(A[2], C[2], D[2]) / BUCKET);
        // A triangle spanning a huge area would be pasted into thousands of
        // buckets; those are rare and go in a spill list that is always checked.
        if ((i1 - i0 + 1) * (j1 - j0 + 1) > 256) {
          if (!index.has('spill')) index.set('spill', []);
          index.get('spill').push(tri);
          continue;
        }
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const k = key(i, j);
          if (!index.has(k)) index.set(k, []);
          index.get(k).push(tri);
        }
      }
    });
    const hit = (list, x, z, gy) => {
      if (!list) return false;
      for (const [A, C, D, det] of list) {
        const w0 = ((C[0] - x) * (D[2] - z) - (D[0] - x) * (C[2] - z)) / det;
        const w1 = ((D[0] - x) * (A[2] - z) - (A[0] - x) * (D[2] - z)) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
        if (y >= gy - LO && y <= gy + HI) return true;
      }
      return false;
    };
    window.__ctFloorRay = (x, z, gy) => {
      if (gy === undefined || gy === null) gy = window.__ct.groundAt(x, z);
      return hit(index.get(key(Math.floor(x / BUCKET), Math.floor(z / BUCKET))), x, z, gy)
        || hit(index.get('spill'), x, z, gy);
    };
    return { tris, meshes, buckets: index.size, spill: (index.get('spill') || []).length };
  }, [LO, HI, BUCKET]);
  const query = (x, z, gy) => page.evaluate(
    ([x, z, gy]) => window.__ctFloorRay(x, z, gy), [x, z, gy ?? null]);
  return { query, ...built };
}

/**
 * THE EXACT QUERY SELF-TESTS ON BOTH SIGNS, same controls as everything else
 * here. Returns `[]` when sound, or the reasons it must not be believed.
 */
export async function selfTestRayQuery(page, query, tris, minTris = 10000) {
  const bad = [];
  if (tris < minTris) bad.push(`only ${tris} triangles indexed (want >= ${minTris}) — nothing was read`);
  // Plain carriageway 30 m south: clear of the road centre-line plane and of
  // the pooled traffic meshes parked at the origin, both of which make (0, 0)
  // a sentinel that cannot go void. (world-contained.mjs:69-80.)
  if (!await query(3.2, -30.3)) bad.push('the road at (3.2, -30.3) reads as VOID — the query finds no floors');
  if (await query(0, -170)) bad.push('a point 60 m past the world clamp reads as FLOORED — the query cannot say no');
  return bad;
}

import * as THREE from 'three';
import type { AABB } from '../fp';
import { rnd } from './rng';
import { treeSprite, TREE_W, treePitTex } from './tex-world';
import { type CarKind, makeCar } from './cars';
import type { CtxBuild } from './ctx';
import { nudgeClear } from './gap';

// ── THE SIDE STREET'S FURNITURE ────────────────────────────────────────────
//
// The side street had the road, the kerb, the gutter pan, the slabs and the
// buildings — and nothing standing on it at all. No trees, no parked cars.
// That is what "it stops being a real street about 15 m in" was: not missing
// geometry, missing FURNITURE.
//
// The numbers are not new. Every one is the main street's own convention
// rotated 90°, because the two streets are built to the same section:
//
//                    main street            side street (this file)
//   walk             x 5.0 … 7.0            z -98.0 … -96.0  (north)
//   facade           x = 7.0 (FACE)         z = -96.0        ( = collider + 0.3)
//   tree trunk       x = ±(ROAD_HALF+0.4)   z = SIDE_Z0 + 0.4
//   parked car       |x| = 3.93 off centre  |z-MID| = 3.93
//
// so the clear walking lane past a tree comes out at the same 0.5 m it is on
// the main street, and a parked car's collider stops 0.33 m short of the
// travel lane exactly as it does there. Neither was tuned here; both fall out
// of using the same offsets.
//
// DENSITY FALLS OFF, it does not stop. Fully detailed for 40 m and then
// abruptly bare reads worse than a street that thins out, so the gaps GROW
// with x — 8, 10, 12 m between trees, 11 then 13 between parked cars — and the
// last 13 m before the fog is deliberately empty.
//
// ── what is NOT here, and why ─────────────────────────────────────────────
//
// The lamps and the catch basins belong to builder B and cannot be done from
// this file:
//
// · LAMPS. The bishop-crook geometry is inline in ct/props.ts, and more to the
//   point the lamplight registry (`lampHeads`) is private to it. A lamp built
//   out here would be a dark post that lights nothing — worse than no lamp. It
//   needs props.ts to expose a lamp factory, which is a desk operation.
// · CATCH BASINS. ct/tex-ground.ts places them at the two junction low points
//   where the gutters actually run to. Putting more down the side street means
//   deciding where that pan drains, which is that module's business.
//
// Both are flagged in notes/feat-traffic.md rather than drive-by edited.

const TREE_PX = 0.05;                 // world units per texel, as in ct/props.ts

export interface SideStreetOpts {
  /** the junction: main street's south end / side street's north kerb */
  SIDE_Z0: number;
  /** the side street's south kerb */
  SIDE_Z1: number;
  /** lamplight registry — anything standing in the street catches it */
  lit: (root: THREE.Object3D) => void;
}

/** Tree sprite indices to paint with. treeSprite() hashes on the index, so
 *  starting well clear of the main street's run (it uses 0…6) guarantees these
 *  are different trees rather than the same seven repainted — and leaves room
 *  for ct/props.ts to plant more without colliding. */
const TREE_IDX0 = 40;

export function buildSideStreet(ctx: CtxBuild, o: SideStreetOpts) {
  const { scene, obstacle, sidewalkY, boards } = ctx;
  /** everything solid THIS module puts on the side street, so the parked cars
   *  below can be kept out of the dangerous-gap band against the trees above */
  const mine: AABB[] = [];
  const MID_Z = (o.SIDE_Z0 + o.SIDE_Z1) / 2;      // the centre line, z = -103

  // ── street trees, in dirt pits, thinning eastward ──────────────────────
  //
  // Same 0.8 × 1.0 pit as the main street, turned 90° with the geometry
  // untouched so its texels stay square (GOTCHAS §5) rather than stretching
  // 0.8 m of texture across 1.0 m of ground.
  const pitGeo = new THREE.PlaneGeometry(0.8, 1.0);
  const pitMat = new THREE.MeshBasicMaterial({ map: treePitTex() });
  let treeIdx = TREE_IDX0;
  // Gaps grow: 8, 10, 12 — and nothing in the last stretch before the fog.
  //
  // The first one starts at 13, not 11, because the bodega's fruit crates sit
  // at x 9.74…11.26 on this same 2 m walk. A tree at 11 leaves a 0.24 m band
  // of standable positions between crate and trunk against the main street's
  // 0.50 m — i.e. it closes the walk, and the bodega's [E] spot is 2 m west of
  // it (GOTCHAS §8, §9). East of the crates the lane is the standard 0.50 m.
  const TREES: [number, 1 | -1][] = [[13, 1], [21, -1], [31, 1], [43, -1]];
  for (const [x0, side] of TREES) {
    // the pit sits on the 1 m slab grid, same phase the walk sheet uses
    const px = Math.round(x0 - 0.5) + 0.5;
    const tz = side > 0 ? o.SIDE_Z0 + 0.4 : o.SIDE_Z1 - 0.4;   // kerb-side
    // rnd() drawn per tree, exactly as ct/props.ts does it, and appended at
    // the END of the world's build so no existing tree height moves
    const H = 90 + Math.floor(rnd() * 24);
    const geo = new THREE.PlaneGeometry(TREE_W * TREE_PX, H * TREE_PX);
    geo.translate(0, (H * TREE_PX) / 2, 0);
    const tree = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: treeSprite(treeIdx, H), alphaTest: 0.5, side: THREE.DoubleSide,
    }));
    tree.position.set(px, sidewalkY, tz);
    scene.add(tree);
    boards.push({ m: tree });        // a tree is a billboard: it turns to face you
    o.lit(tree);
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.rotation.z = Math.PI / 2;        // 1.0 m along the street, 0.8 across
    pit.position.set(px, sidewalkY + 0.006, tz);
    scene.add(pit);
    // only the TRUNK is solid, so the walk stays passable
    mine.push(obstacle({ minX: px - 0.12, maxX: px + 0.12, minZ: tz - 0.08, maxZ: tz + 0.08 }));
    treeIdx++;
  }

  // ── parked cars, thinning eastward ──────────────────────────────────────
  //
  // Parked facing the way their side of the road runs: the north half is the
  // eastbound lane so cars there face east, the south half faces west — the
  // same rule the main street's east kerb follows by facing south.
  const PARK_SNUG = 3.93;              // off the centre line, as on the main street
  const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
  // kind, colour, which kerb (+1 north), roughly where. Gaps 11 then 13, and
  // the far end left bare.
  const PARKED: [CarKind, number, 1 | -1, number][] = [
    ['pickup', 0, 1, 15],
    ['sedan', 4, -1, 26],
    ['hatch', 2, 1, 39],
  ];
  for (const [kind, ci, side, x0] of PARKED) {
    // how well each is parked is DRAWN, not placed — same spread as the main
    // street's, off the seeded stream so it is stable within a session
    const gap = rnd() * 0.17;
    const z = MID_Z + side * (PARK_SNUG - gap);
    const xDrawn = x0 + (rnd() - 0.5) * 2.4;     // and they don't sit on a rhythm
    // Same rule as the main street's, along x because this street runs east:
    // the drawn spot stands unless it makes a 0.40–0.95 m corridor against a
    // tree trunk or another car, and then it takes the nearest legal one. The
    // trees above are the ones that bite — a trunk on the walk and a car in the
    // road leave a slot straddling the kerb line (ct/gap.ts).
    const box = (xx: number) => ({
      minX: xx - carHalf[kind], maxX: xx + carHalf[kind], minZ: z - 1.05, maxZ: z + 1.05,
    });
    const fit = nudgeClear(xDrawn, box, mine);
    if (!fit.ok) console.warn(`[side street] ${kind} at x=${xDrawn.toFixed(2)} leaves a trap-band gap`);
    const x = fit.at;
    const car = makeCar(kind, ci);
    car.position.set(x, 0, z);
    // east is yaw -π/2 (the models are built nose-first down -z)
    car.rotation.y = (side > 0 ? -1 : 1) * Math.PI / 2 + (rnd() - 0.5) * 0.06;
    scene.add(car);
    o.lit(car);
    // the body's long axis runs along X out here, so the collider is the main
    // street's box with its extents swapped
    mine.push(obstacle(box(x)));
  }
}

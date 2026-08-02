import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';
import { WALK, FACE } from './rng';
import {
  facadeTex, shopfrontTex, shopInteriorTex, masonry,
  SHOP_BAND_H, SHOP_MULT, HI, reveal, proud, glazed, mullions,
} from './tex-world';
import { walkTex } from './tex-ground';
import { type BldSpec } from './civic';
import type { AABB } from '../fp';

/** THE BODEGA'S CANTED CORNER, split out of `ct/street.ts`.
 *
 *  Second cut of the split my queue file asks for — *"`ct/street.ts` should be
 *  split (buildings / alley / corner) so more than one builder can work the
 *  block"*. The alley went first; this is the corner, and it is the piece the
 *  user sends feedback about most often: the canted bay, the door in the cut
 *  face, the awning, the produce crates, the OPEN neon.
 *
 *  **A MOVE, not a rewrite.** Every line stood in `street.ts` in this order and
 *  nothing was re-tuned on the way. The call site is unchanged for the reason
 *  the alley's is: paint order decides the grain of every texture created after
 *  it (GOTCHAS §31), and the seeded `rnd()` stream decides every tree height and
 *  pigeon downstream (GOTCHAS §2). Proved with `npm run fp`, dist against dist.
 *
 *  What it closes over is passed in, not imported, so the dependency stays
 *  one-way and this file never reaches back into `street.ts`.
 *
 *  ── the plan, kept with the code that builds it ────────────────────────────
 *
 *  The shell is a rectangle with the south-west corner triangle taken out, so
 *  it is built as two boxes plus the canted bay and a roof cap:
 *
 *         z=-86  ┌──────────────┐  BX1 = FACE+3.4
 *                │      R1      │
 *      z=-94.2   ├───────┬──────┤
 *                │  cut  │  R2  │
 *         z=-96  └╲______┴──────┘
 *                  ╲ canted bay, A→B
 *                BX0 = FACE
 */
/** The canted bay's geometry, in world coordinates, filled in when the corner
 *  is built. `null` before that — read it from a module that runs after
 *  `buildStreet`, which every interior does.
 *
 *  This exists so nothing has to hand-type the cut. See the block that assigns
 *  it for why that matters here specifically. */
export let BAY: {
  a: { x: number; z: number };
  b: { x: number; z: number };
  cut: number;
  faceWidth: number;
  centre: { x: number; z: number };
  normal: { x: number; z: number };
  tangent: { x: number; z: number };
  yawAlong: number;
  shell: { x0: number; x1: number; z0: number; z1: number };
  doorWidth: number;
} | null = null;

export function buildBodegaCorner(c: {
  scene: THREE.Scene;
  /** BODEGA's roster entry. The roster is `ct/street.ts`'s to read; this only
   *  needs the building it is the corner of. */
  bod: BldSpec;
  /** where the bodega's frontage starts on the main street's east run */
  bodegaZ0: number;
  KERB_H: number;
  sidewalkY: number;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  solid: (b: AABB) => AABB;
  /** the shell material set, which binds this build's `flat` */
  shellMats: (
    fi: number, facade: THREE.Material, dx: number, dy: number, dz: number,
    brick: string, baseY: number, cope: boolean, roofM: THREE.Material,
  ) => THREE.Material[];
}) {
  const { scene, bod, bodegaZ0, KERB_H, sidewalkY, flat, wet, solid, shellMats } = c;
    const BX0 = FACE, BX1 = FACE + 3.4;
    const BZ0 = bodegaZ0, BZ1 = bodegaZ0 - bod.w;    // -86 … -96
    // Cut back exactly one sidewalk width along each face. That is not an
    // arbitrary number: the walk is WALK m deep on both streets, so the
    // corner they share is a WALK × WALK square, and cutting back WALK makes
    // the canted face exactly as wide as that square's diagonal. The bay, the
    // door on its centre line, and the kerb corner in front then all sit on
    // one 45° axis instead of reading off-kilter against each other.
    const CHF = WALK;
    const CFW = CHF * Math.SQRT2;                    // 2.55 m of canted bay

  // ── what this bay IS, published rather than reported ──────────────────────
  //
  // `ct/int-bodega.ts` carries the comment *"D reported the geometry: the cut
  // face runs A (7, −94) to B (9, −96)"* and a hand-derived `cut: 2.0`. Both
  // are correct today and both were typed out of a note, which is the defect
  // this project has now hit six times — GOTCHAS §20, *"aim from the source,
  // not from memory"*, after a stale diner z, a hand-typed room offset and a
  // hand-typed DZ. The user's live request is that the INTERIOR MATCH this cut,
  // so the interior is about to depend on these numbers harder than anything
  // has yet, and the bay has already been re-cut once.
  //
  // So it is published. GOTCHAS §22 names the pattern approvingly — *"if your
  // module can publish its own footprint, `ct/lot.ts` exports `LOT.bounds`, do
  // that instead of writing coordinates into a document"*. Same idea, one level
  // down: an interior that reads this cannot drift from the exterior, and if
  // the corner is ever re-cut the mismatch becomes a compile-time fact rather
  // than a screenshot somebody has to notice.
  BAY = {
    // the cut face, in WORLD coordinates and in the order you meet them walking
    // the frontage: A on the main street's east face, B on the side street's
    // north face. NOT "left/right" — those are the terms that make mirroring
    // gettable-wrong (GOTCHAS §33).
    a: { x: BX0, z: BZ1 + CHF },
    b: { x: BX0 + CHF, z: BZ1 },
    /** how far the corner is cut back along EACH wall. One sidewalk width, so
     *  the bay, its door and the kerb corner share a 45° axis. */
    cut: CHF,
    /** the canted face's own width — `cut * √2`, the diagonal of the square the
     *  two walks share. This is the number an interior's chamfer wants. */
    faceWidth: CFW,
    /** midpoint of the cut face, which is the door's centre line */
    centre: { x: BX0 + CHF / 2, z: BZ1 + CHF / 2 },
    /** outward normal of the cut face: south-west, away from the crossing */
    normal: { x: -Math.SQRT1_2, z: -Math.SQRT1_2 },
    // ALONG the face, a → b. Published beside the normal because publishing
    // only the normal is what let the last consumer transpose the two axes.
    //
    // The auditor sent B's soldier course back to OPEN for exactly that: *"the
    // band extends 0.42 m ALONG the face and 2.60 m PERPENDICULAR to it — B's
    // two numbers, swapped"*, with the diagnosis *"walking finds where a
    // surface is; it says nothing about which way an object faces. A position
    // check and an orientation check are different instruments."* The offset
    // was found by walking into the wall and was right; the orientation had to
    // be derived by hand from the corner, and the hand got it 90° out.
    //
    // Orthogonal to `normal` by construction — `dot(tangent, normal)` is
    // −0.5 + 0.5 = 0 — so anything laid on this face can take one axis from
    // each and cannot swap them.
    tangent: { x: Math.SQRT1_2, z: -Math.SQRT1_2 },
    /** `rotation.y` for a GROUND DECAL whose local +x should run along the
     *  face. A plane turned `rotation.x = −π/2` lies in the ground with local
     *  +x → world +x and local +y → world −z; `rotation.y = θ` then sends +x to
     *  (cos θ, 0, −sin θ), so θ = π/4 puts it on `tangent` above. Published as
     *  the number rather than the derivation, because the derivation is the
     *  step that went wrong. */
    yawAlong: Math.PI / 4,
    /** the shell the cut is taken out of, before the triangle is removed */
    shell: { x0: BX0, x1: BX1, z0: BZ1, z1: BZ0 },
    /** clear width of the door opening in the cut face */
    doorWidth: 1.3,
  };
    const SHOP = SHOP_BAND_H, BH = 3.4 + bod.floors * 2.4, TOP = SHOP + BH;
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    // ── the corner's footprint FOLLOWS THE CUT, and now it does so with ONE
    //    TURNED BOX rather than a staircase ────────────────────────────────
    //
    // *"whats going on with the collision geometry here? we should fix this so
    //  its not just a bunch of separate rectangles and its just made properly."*
    //
    // The shell is the rectangle BX0…BX1 × BZ1…BZ0 minus the triangle the
    // chamfer takes out of its south-west corner — the void is x ≥ BX0,
    // z ≤ BZ1 + CHF and x + z ≤ BX0 + BZ1 + CHF. An AABB could not be diagonal,
    // so this used to be EIGHT abutting bands of BAND = 0.25, each starting at
    // the most permissive x in its band. That was not merely ugly. Measured
    // (scripts/probes/w24-chamfer-walk.mjs): walking straight into the cut at
    // stations along it, the surface you actually stop against stepped between
    // 0.343 m and 0.425 m — an 83 mm staircase you feel as a ratchet when you
    // walk the diagonal with the wall at your shoulder. More, smaller bands
    // would have made it finer and never flat.
    //
    // `AABB.rot` (fp.ts) is what fixes it, and the corner is now exactly three
    // boxes, none of them an approximation of the cut:
    {
      // 1. THE CANTED WALL ITSELF, turned onto the cut. Local +x runs a → b and
      //    local +z is the INWARD normal, so the face sits on the box's own
      //    local minZ and the player's radius pads perpendicular to the wall —
      //    which is what makes the stop distance a constant instead of sawing.
      //
      //    Its yaw is `BAY.yawAlong`, taken from the bay this file already
      //    publishes rather than derived a second time by hand: `rot` uses the
      //    `mesh.rotation.y` convention, which is the convention `yawAlong` is
      //    documented in, and its own comment records that hand-deriving this
      //    corner's orientation is the step that came out 90° wrong before.
      //
      //    DEPTH IS DERIVED, NOT CHOSEN: CFW / 2 is the height of the cut
      //    triangle from its hypotenuse to the right-angle corner at
      //    (BX0 + CHF, BZ1 + CHF), so a CFW × CFW/2 rectangle laid on the face
      //    is the smallest one that contains the whole cut triangle. It spills
      //    past the triangle's two legs, and that spill is harmless BY
      //    CONSTRUCTION rather than by luck: its four corners are (BX0, BZ1+CHF),
      //    (BX0+CHF, BZ1), (BX0+CHF/2, BZ1+1.5·CHF) and (BX0+1.5·CHF, BZ1+CHF/2),
      //    every one of them inside the shell BX0…BX1 × BZ1…BZ0 and inside the
      //    two boxes below. No spill reaches walkable ground.
      const cx = BX0 + CHF * 0.75, cz = BZ1 + CHF * 0.75;   // the rectangle's centre
      solid({
        minX: cx - CFW / 2, maxX: cx + CFW / 2,             // along the face
        minZ: cz - CFW / 4, maxZ: cz + CFW / 4,             // into the building
        rot: BAY.yawAlong,
      });
      // 2. The brick pier that closes the cut on the side street — R2's own
      //    footprint, run east through the block. This is the part of the band
      //    z ∈ [BZ1, BZ1+CHF] that lies EAST of the cut triangle, and it is a
      //    plain rectangle: it never needed to be part of a staircase at all.
      //
      //    IT RUNS NORTH AS FAR AS THE TURNED BOX DOES, to BZ1 + 1.5·CHF rather
      //    than stopping on the cut band at BZ1 + CHF. Two reasons, and the
      //    first is the load-bearing one. `ct/gap.ts` clears a candidate
      //    corridor only when a filler spans it ACROSS, one box at a time; with
      //    the pier stopping at BZ1+CHF, the 0.4 m of masonry between the turned
      //    box's north-east corner and the wing shopfront's face at BX1 was
      //    filled by the pier and the north block BETWEEN them, neither of them
      //    spanning it alone — so the V overlay painted the chamfer red for a
      //    slot that is solid brick and that no player can stand in. Running the
      //    pier the full depth of the wall it closes against makes it one
      //    spanning filler and the false trap goes away. Second: every metre it
      //    gains is north of BZ1 + CHF and east of BX0 + CHF, which is inside
      //    the north block already — it cannot take walkable ground.
      solid({ minX: BX0 + CHF, maxX: BX1 + 8, minZ: BZ1, maxZ: BZ1 + CHF * 1.5 });
      // 3. …and the rest of the block, north of the cut, at full width.
      solid({ minX: BX0 - 0.3, maxX: BX1 + 8, minZ: BZ1 + CHF, maxZ: BZ0 });
    }
    // The corner used to carry its own brick painter, because facadeTex once
    // floored its canvas at 64 px and would have painted a 2 m bay three times
    // finer than the elevation beside it. That clamp is gone and the density
    // now comes from ct/tex-world.ts's masonry() like every other wall, so the
    // local copy is deleted rather than corrected — a painter that derives its
    // own px/m is the defect, however carefully it derives it.
    // R1 — the block north of the cut, full depth, street shopfront on -x
    {
      const d = BZ0 - (BZ1 + CHF), cz = (BZ0 + BZ1 + CHF) / 2;
      const facade = flat(facadeTex(bod.brick, bod.floors, d));
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, BH, d),
        shellMats(1, facade, 3.4, BH, d, bod.brick, SHOP, true, roofM));
      wall.position.set((BX0 + BX1) / 2, SHOP + BH / 2, cz);
      scene.add(wall);
      const shopM = flat(shopfrontTex(bod.brick, bod.nm, bod.col, d));
      const shop = new THREE.Mesh(new THREE.BoxGeometry(3.4, SHOP, d),
        shellMats(1, shopM, 3.4, SHOP, d, bod.brick, 0, false, roofM));
      shop.position.set((BX0 + BX1) / 2, SHOP / 2, cz);
      scene.add(shop);
    }
    // R2 — the brick pier that closes the cut on the side street
    {
      const w = BX1 - (BX0 + CHF);
      const pier = flat(facadeTex(bod.brick, bod.floors, w, TOP, 0, 1, SHOP + 2.4));
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, TOP, CHF),
        shellMats(5, pier, w, TOP, CHF, bod.brick, 0, true, roofM));
      p.position.set((BX0 + CHF + BX1) / 2, TOP / 2, BZ1 + CHF / 2);
      scene.add(p);
    }
    // the canted bay itself: local +z is the outward normal, pointing
    // south-west across the intersection; local +x runs along the face
    const bay = new THREE.Group();
    bay.position.set(BX0 + CHF / 2, 0, BZ1 + CHF / 2);
    bay.rotation.y = -Math.PI * 0.75;
    scene.add(bay);
    const bayUp = new THREE.Mesh(new THREE.PlaneGeometry(CFW, BH), flat(facadeTex(bod.brick, bod.floors, CFW, BH, SHOP, 1)));
    bayUp.position.set(0, SHOP + BH / 2, 0);
    bay.add(bayUp);
    // the shopfront in the bay: recessed doorway dead centre, a run of
    // display glass either side, sign band over the lot
    // Same band grid as shopfrontTex, so the bay lines up exactly with the two
    // shopfronts it turns the corner between. It used to be a fixed 48x52
    // canvas regardless of how wide the bay actually is — 24 x 12.38 px/m on a
    // 2 m face, three times the density of the elevation it abuts.
    const bayS = masonry(CFW, SHOP, 0, SHOP_MULT);
    const bm = bayS.m, bw = bayS.W, bh = bayS.H;
    const bayFrontT = bayS.paint((g) => {
      // ONE RHYTHM across the whole bay, drawn with A's shopfront vocabulary
      // (proud / reveal / glazed / mullions from ct/tex-world.ts) rather than
      // a second one of my own. Every panel used to sit at its own depth and
      // its own width, with three different kick-plate heights, so the bay
      // read as several unrelated fronts jammed into a corner. Now there is
      // one fascia line, one opening, one reveal depth, one cill and one
      // stallriser running the full width — and the door is a hole in that
      // single opening rather than a fourth panel competing with it.
      const S = { m: bm, W: bw, H: bh };
      g.fillStyle = bod.brick; g.fillRect(0, 0, bw, bh);
      bayS.courses(g);
      // fascia: a signboard fixed to the brick, so it throws a shadow
      const fy = bm(0.16), fh = bm(0.9);
      proud(g, S, bm(0.12), fy, bw - bm(0.24), fh, bod.col);
      g.font = `bold ${bm(0.6)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillText(bod.nm, bw / 2 + 1, fy + fh / 2 + 1);
      g.fillStyle = '#f2ead0'; g.fillText(bod.nm, bw / 2, fy + fh / 2);
      // ONE opening, set back from the brick, with ONE reveal round it
      const ox = bm(0.4), oy = fy + fh + bm(0.26);
      const ow = bw - bm(0.8), oh = bh - oy - bm(0.05);
      g.fillStyle = '#211d18'; g.fillRect(ox, oy, ow, oh);
      reveal(g, S, ox, oy, ow, oh);
      const gx = ox + bm(0.22), gy = oy + bm(0.22);
      const gw = ow - bm(0.44), gh = oh - bm(0.8);
      glazed(g, S, gx, gy, gw, gh, '#38302a');
      // the shop behind the glass — lit ceiling, a shelf run, dark floor
      g.fillStyle = '#c9a45e'; g.fillRect(gx, gy, gw, bm(0.26));
      g.fillStyle = 'rgba(201,164,94,0.22)'; g.fillRect(gx, gy + bm(0.26), gw, bm(0.5));
      g.fillStyle = '#4a3f33'; g.fillRect(gx, gy + bm(1.35), gw, bm(0.12));
      g.fillStyle = '#2b241e';
      for (let x = gx + bm(0.35); x < gx + gw - bm(0.4); x += bm(0.7)) g.fillRect(x, gy + bm(1.05), bm(0.36), bm(0.3));
      g.fillStyle = '#241e19'; g.fillRect(gx, gy + gh - bm(0.42), gw, bm(0.42));
      g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(gx, gy + bm(0.98), gw, Math.max(1, bm(0.09)));
      g.fillStyle = HI; g.fillRect(gx, gy + bm(1.07), gw, 1);
      mullions(g, S, gx, gy, gw, gh, 4, '#3e372f');
      // THE DOORWAY IS A HOLE in that same opening, on the same cill, so it
      // shares the bay's rhythm instead of being a fourth panel. The leaf and
      // its reveal are real geometry hung behind this face.
      const dw = bm(1.3), dx = Math.round(bw / 2 - dw / 2);
      g.fillStyle = '#141820'; g.fillRect(dx - bm(0.1), gy, dw + bm(0.2), oy + oh - gy);
      g.clearRect(dx, gy, dw, oy + oh - gy);
      // ONE stallriser, full width, broken only by the doorway
      const ry = gy + gh, rh = bh - ry - bm(0.05);
      proud(g, S, ox, ry, dx - bm(0.1) - ox, rh, '#4a4034');
      proud(g, S, dx + dw + bm(0.1), ry, ox + ow - (dx + dw + bm(0.1)), rh, '#4a4034');
      dither(g, bw, bh, Math.round(CFW * SHOP * 5));
    });
    const bayFront = new THREE.Mesh(new THREE.PlaneGeometry(CFW, SHOP),
      new THREE.MeshBasicMaterial({ map: bayFrontT, alphaTest: 0.5 }));
    bayFront.position.set(0, SHOP / 2, 0);
    bay.add(bayFront);
    // The bay front is the one shopfront face that is a REAL hole — 861 of its
    // 3015 texels are discarded by that alphaTest, which is what makes the
    // doorway read as a way in. It had nothing behind it, and the sidewalk is
    // one plane that runs from the kerb straight on under the buildings, so
    // through the hole you saw pavement and the bodega had a pavement for a
    // floor. The door leaf below covers the doorway; this covers everything
    // else the alphaTest opens up, and sits behind the leaf.
    const bayRoom = new THREE.Mesh(new THREE.PlaneGeometry(CFW, SHOP),
      new THREE.MeshBasicMaterial({ map: shopInteriorTex('BODEGA', CFW, SHOP) }));
    bayRoom.position.set(0, SHOP / 2, -0.45);
    bay.add(bayRoom);
    // ── the door itself ───────────────────────────────────────────────────
    //
    // Set BACK behind the shopfront line, with its reveal boxed in, so the
    // opening has depth and throws a shadow. Everything here lives inside the
    // 0.3 m cushion the corner's footprint already reserves, so none of it
    // reaches the pavement (GOTCHAS §9).
    const DW = 1.3, DH = 2.35, DREC = 0.12;
    const doorT = declareSurface(pixTex(52, 94, (g) => {
      g.fillStyle = '#2b2f36'; g.fillRect(0, 0, 52, 94);                 // stiles and rails
      g.fillStyle = '#c9b184'; g.fillRect(5, 6, 42, 58);                 // warm light from inside
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(7, 8, 14, 54);  // glare down one side
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(5, 34, 42, 2);        // glazing bar
      g.fillStyle = '#8a5f3a'; g.fillRect(5, 40, 14, 12);                // shelf of stock behind it
      g.fillStyle = '#7a8a5a'; g.fillRect(24, 44, 12, 8);
      g.fillStyle = '#1d2026'; g.fillRect(0, 64, 52, 6);                 // lock rail
      g.fillStyle = '#3a2c22'; g.fillRect(4, 76, 44, 14);                // kick plate
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(4, 76, 44, 1);
      g.fillStyle = '#c9b45e'; g.fillRect(38, 44, 3, 22);                // push bar, vertical
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(41, 46, 1, 20);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(24, 0, 2, 94);        // the meeting stile — two leaves
    }), 'detail');
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(DW + 0.04, DH + 0.04), flat(doorT));
    leaf.position.set(0, (DH + 0.04) / 2, -DREC);
    bay.add(leaf);
    const jambM = new THREE.MeshBasicMaterial({ color: 0x141820 });
    for (const sx of [-1, 1]) {                                          // the reveal, boxed in
      const jb = new THREE.Mesh(new THREE.BoxGeometry(0.07, DH, DREC), jambM);
      jb.position.set(sx * (DW / 2 + 0.035), DH / 2, -DREC / 2);
      bay.add(jb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(DW + 0.14, 0.07, DREC), jambM);
    head.position.set(0, DH + 0.035, -DREC / 2);
    bay.add(head);
    const awnT = declareSurface(pixTex(48, 12, (g) => {
      for (let x = 0; x < 48; x += 8) {
        g.fillStyle = (x / 8) % 2 ? bod.col : '#d8d0c0';
        g.fillRect(x, 0, 8, 12);
      }
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 9, 48, 3);
    }), 'sign');
    const awn = new THREE.Mesh(new THREE.BoxGeometry(CFW, 0.1, 0.9), new THREE.MeshBasicMaterial({ map: awnT, side: THREE.DoubleSide }));
    // the awning tucks UNDER the sign band. On the taller band the fascia now
    // runs 3.15–4.04 m and the glass head is at 2.91, so it hangs at 2.99 —
    // recheck this whenever SHOP_BAND_H moves, or it covers the name again.
    awn.position.set(0, 2.99, 0.35);
    // THE SIXTH FACING BUG, and this one had a comment claiming the opposite of
    // what the number did. *"bodega sign is tilted up which makes no sense
    // should be tilted a bit down no? … like it needs to be rotated 180
    // degrees"*.
    //
    // Derived from what the awning should FACE rather than by flipping a sign
    // until it looked better (GOTCHAS §33). The bay's local +z is OUT from the
    // shopfront, so `rotation.x = θ` sends the outer edge (0, 0, +0.45) to
    // (0, −0.45 sin θ, 0.45 cos θ) and the top face's normal (0, 1, 0) to
    // (0, cos θ, sin θ). An awning has to shed water and shade the glass, so
    // its outer edge must be the LOW one and its top face must look up and OUT,
    // over the pavement — which is θ POSITIVE.
    //
    // At −0.18 the outer edge stood 81 mm HIGH and the top face looked up and
    // BACK at the wall: a sign tipped toward the sky, and the raised lip cut
    // across the bottom of the BODEGA fascia behind it — the comment two lines
    // up used to warn about that exact occlusion without noticing it had
    // already happened. At +0.18 the outer edge drops 81 mm to 2.91 and the
    // wall edge rises to 3.07, which still clears the fascia's foot at 3.15.
    awn.rotation.x = 0.18;    // outer edge LOW: slopes down and away from the face
    bay.add(awn);
    const openT = declareSurface(pixTex(24, 12, (g) => {
      g.fillStyle = '#141416'; g.fillRect(0, 0, 24, 12);
      g.fillStyle = '#e8574a'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
      g.fillText('OPEN', 12, 9);
    }), 'sign');
    const open = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), flat(openT));
    // OVER THE DOOR, where a shop hangs it — it used to sit in the left
    // display window, which told you the wrong panel was the way in
    open.position.set(0, 1.98, -DREC + 0.04);
    bay.add(open);
    // roof cap over the wedge R1 and R2 leave open (wound for an up normal)
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute([
      BX0, TOP, BZ1 + CHF,
      BX0 + CHF, TOP, BZ1 + CHF,
      BX0 + CHF, TOP, BZ1,
    ], 3));
    cap.computeVertexNormals();
    scene.add(new THREE.Mesh(cap, roofM));
    // …and the matching triangle of SIDEWALK at the foot of it. Cutting the
    // corner uncovered ground that was under the building: the east walk
    // stops dead at x = FACE and the side-street walk stops at z = BZ1, so
    // the wedge between them had no floor at all and you saw sky through it.
    // This fills exactly that triangle, at walk height, ABUTTING both walks
    // on their existing edges — never overlapping them, or the two coplanar
    // tops would z-fight. UVs are taken straight off world x/z so the 1 m
    // slab grid runs on unbroken from the walks either side.
    {
      const tri = [[BX0, BZ1], [BX0, BZ1 + CHF], [BX0 + CHF, BZ1]] as [number, number][];
      const gap = new THREE.BufferGeometry();
      gap.setAttribute('position', new THREE.Float32BufferAttribute(
        tri.flatMap(([x, z]) => [x, KERB_H, z]), 3));
      // walkTex now takes WORLD EXTENTS (it aligns the slab grid globally via
      // repeat+offset), so UVs here are normalised across the triangle's rect
      // rather than raw world/2 as they were under the old size-based signature.
      gap.setAttribute('uv', new THREE.Float32BufferAttribute(
        tri.flatMap(([x, z]) => [(x - BX0) / CHF, (z - BZ1) / CHF]), 2));
      gap.computeVertexNormals();
      const gapT = walkTex(BX0, BX0 + CHF, BZ1, BZ1 + CHF);
      scene.add(new THREE.Mesh(gap, wet(new THREE.MeshBasicMaterial({ map: gapT, side: THREE.DoubleSide }))));
    }
    // Produce crates, not cartons. A slatted crate is BOARDS WITH GAPS: the
    // dark of the inside shows between them, the corner posts stand proud of
    // the boards, and there is a rail round the top. A flat tan box with a
    // grid drawn on it reads as cardboard every time.
    const crateT = declareSurface(pixTex(28, 18, (g) => {
      g.fillStyle = '#1a1108'; g.fillRect(0, 0, 28, 18);              // the dark inside
      g.fillStyle = '#a8834a';
      for (const y of [2, 8, 13]) {                                    // three boards…
        g.fillRect(0, y, 28, 4);
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, y, 28, 1);
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, y + 3, 28, 1);
        g.fillStyle = '#a8834a';
      }
      // …with the GAP between them left dark and deep. A slatted crate is
      // read by its shadows; painting the boards edge to edge with a hairline
      // between made it one flat plank with stripes on it.
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 6, 28, 2); g.fillRect(0, 12, 28, 1); g.fillRect(0, 17, 28, 1);
      g.fillStyle = '#8d6b3a';                                         // corner posts
      g.fillRect(0, 0, 3, 18); g.fillRect(25, 0, 3, 18);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 1, 18); g.fillRect(25, 0, 1, 18);
      g.fillStyle = '#b8944f'; g.fillRect(0, 0, 28, 2);                // top rail
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 16, 28, 2);       // shadow at the foot
      dither(g, 28, 18, 40);
    }), 'detail');
    // The top of the crate is just the rim and the dark inside now — the fruit
    // that used to be painted flat on it is real geometry heaped above it.
    const fruitTop = () => declareSurface(pixTex(28, 24, (g) => {
      g.fillStyle = '#1a1108'; g.fillRect(0, 0, 28, 24);
      g.fillStyle = '#b8944f'; g.fillRect(0, 0, 28, 3); g.fillRect(0, 21, 28, 3);   // rim
      g.fillRect(0, 0, 3, 24); g.fillRect(25, 0, 3, 24);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(3, 3, 22, 3);                    // inside shadow
    }), 'detail');
    // A heap is read by seeing the INDIVIDUAL UNITS and the gaps between them.
    // Attempt two was one smooth faceted dome per crate, roughly as wide as
    // the crate, and it read as a single enormous tomato — a dome has neither
    // units nor gaps. So: twelve separate fruit per crate, varied in size and
    // shade, sitting in a shallow pile that overflows the rim, with one
    // tumbled onto the rim and one on the pavement.
    //
    // Each fruit is a FLAT COLOUR, no map. The checkerboard that read as a
    // texture artefact was the heap texture's circle grid wrapped over a
    // sphere; there is no texture here to wrap.
    const crateM = flat(crateT);
    // WHERE THEY STAND, and the wall they stand against is not one plane.
    //
    // *"align these crates so they fit better against this wall"*, with
    // `shots/user-crates4.png`. Measured rather than eyeballed, and the fault
    // was not the crates being untidy — it was that they STRADDLED A STEP IN
    // THE WALL and so could not be flush against both halves at once:
    //
    //   x 9.00 … 10.405  the corner block's brick pier — flat shell face, z −96.0
    //   x 10.405 …       the wing's shopfront, whose plinth and stallriser cap
    //                    stand 105–120 mm PROUD, so its face is z −96.12
    //
    // The two crates sat at −96.28 and −96.25 — a 30 mm stagger between them,
    // and both backs at about −96.0, which put 100 mm of each crate INSIDE the
    // wing's plinth. Sunk into the base band on one side of the step and adrift
    // on the other is exactly the "doesn't fit" the user is pointing at.
    //
    // So both go on ONE stretch, the wing's, at ONE z, with their backs 15 mm
    // clear of the proud face — 15 mm rather than 0 because coplanar faces
    // z-fight in this world (GOTCHAS §6) and because a crate leaning on a
    // plinth is what this is meant to read as.
    //
    // NOT further west, however tempting: the bodega's `[E]` spot is at
    // (7.47, −95.53) with r 1.8, and the brick-pier stretch is only 1.4 m wide,
    // so two crates on it reach x 9.13 — inside that circle. Crates across the
    // door's approach is precisely what made the bodega un-enterable once
    // already (GOTCHAS §8), and it is not worth re-testing for 70 cm.
    const CRATE_Z = -96.41;                  // back face −96.135, wall face −96.12
    for (const [cxx, czz, shades] of [
      [10.75, CRATE_Z, ['#d8892a', '#c2701f', '#e6a044', '#b0621c']],
      [11.45, CRATE_Z, ['#9a3a2c', '#842f24', '#b45140', '#6f2820']],
    ] as [number, number, string[]][]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.55),
        [crateM, crateM, flat(fruitTop()), crateM, crateM, crateM]);
      crate.position.set(cxx, sidewalkY + 0.2, czz);
      // one box per crate and no bigger than the crate. A single generous box
      // across both is what swallowed the bodega's [E] spot (GOTCHAS §8).
      solid({ minX: cxx - 0.31, maxX: cxx + 0.31, minZ: czz - 0.28, maxZ: czz + 0.28 });
      scene.add(crate);
      const RIM = sidewalkY + 0.4;
      const mats = shades.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c) }));
      const fruit = (fx: number, fy: number, fz: number, r: number, mi: number) => {
        const f = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), mats[mi % mats.length]);
        f.position.set(fx, fy, fz);
        f.rotation.set(fx * 3, fz * 5, 0);     // break the facets up between them
        scene.add(f);
      };
      for (let i = 0; i < 12; i++) {
        const u = ((i % 4) - 1.5) / 1.5, v = (Math.floor(i / 4) - 1) / 1;
        const jx = (((i * 37) % 7) - 3) / 70, jz = (((i * 53) % 7) - 3) / 70;
        const d = Math.hypot(u, v);
        const r = 0.052 + ((i * 29) % 5) * 0.008;
        fruit(cxx + u * 0.195 + jx, RIM + 0.03 + 0.055 * (1 - d * 0.5), czz + v * 0.155 + jz, r, i * 3 + Math.floor(i / 4));
      }
      fruit(cxx + 0.255, RIM + 0.015, czz - 0.175, 0.055, 2);   // tumbled onto the rim
      // …and one on the pavement, IN FRONT of the crate. It used to be at
      // czz + 0.285, which is behind the back face — so with the crate flush to
      // the wall the loose fruit was buried in the plinth, and before the crate
      // moved it was buried in the shell. A fruit that rolls out of a crate
      // rolls toward the walk, where somebody can see it.
      fruit(cxx - 0.375, sidewalkY + 0.052, czz - 0.40, 0.052, 1);
    }
}

import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';
import { masonry } from './tex-world';
import { floorDrain } from './tex-ground';
import { setAlleyDish } from './alley-floor';
import { buildCatRig } from './cat';
import { type BldSpec } from './civic';
import type { AABB } from '../fp';
import type { CtxBuild } from './ctx';

/** THE ALLEY, split whole out of `ct/street.ts`.
 *
 *  My queue file carried this as a standing note rather than a checkbox:
 *  *"This file is the monolith now. Ten items queued here at one point while a
 *  functional blocker sat third in line. `ct/street.ts` should be split
 *  (buildings / alley / corner) so more than one builder can work the block."*
 *  The alley is the first cut because it is the most self-contained: one block,
 *  one site, and it is this worktree's own topic.
 *
 *  **This is a MOVE, not a rewrite.** Every line below stood in `street.ts` in
 *  this order; nothing was re-tuned on the way. The paint order is unchanged
 *  because the call site is unchanged, which matters more here than it looks:
 *  the fingerprint harness seeds `Math.random`, so a texture created one step
 *  earlier or later re-grains every texture painted after it (GOTCHAS §31), and
 *  the single seeded `rnd()` stream in `ct/rng.ts` moves every tree height and
 *  pigeon in the world if a draw is inserted anywhere but the end (GOTCHAS §2).
 *  Proved rather than asserted: `npm run fp` before and after, dist against
 *  dist, all four hashes and the object count identical.
 *
 *  What it closes over is passed in rather than imported, because the things it
 *  needs are `buildStreet`'s locals — the roster's geometry, the collider sink,
 *  the material helpers — not module state. That keeps the dependency one-way
 *  and this file free of any import back into `street.ts`.
 */
export function buildAlley(a: {
  scene: THREE.Scene;
  FACE: number;
  AZ0: number; AZ1: number;
  KERB_H: number;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  solid: (b: AABB) => AABB;
  ground: CtxBuild['ground'];
  boards: { m: THREE.Mesh }[];
  stampFrom: (mark: number, mod: string) => void;
  // The two buildings the alley is cut between, already resolved. They used to
  // be found twice inside this block with two copies of `WEST.indexOf('alley')`
  // — the same fact decided twice, which is the defect shape this file's own
  // comments keep naming. The roster is street.ts's to read; the alley only
  // needs to know what is either side of it.
  northNeighbour: BldSpec;
  southNeighbour: BldSpec;
  bandOf: (b: BldSpec) => number;
}) {
  const { scene, FACE, AZ0, AZ1, KERB_H, flat, wet, solid, boards, stampFrom } = a;

    // The alley floor, painted PER METRE like everything else on the ground.
    //
    // It was one 64 x 64 canvas stretched over 6.6 x 6.5 m — 9.7 px/m, abutting
    // a sidewalk at 32 and a road at 14-19. notes/seam-audit.md finding 4: "a
    // three-to-one grain jump in a single frame, plus the stain blobs and the
    // drain each appear exactly once so they read as smears rather than as
    // ground." Both halves of that are the same cause: one small canvas doing
    // a whole surface.
    //
    // 24 px/m is the number. The walk is 32 and the road 14-19, so the alley
    // now sits between its two neighbours instead of three times coarser than
    // either, and the arris at x = -7 stops announcing itself.
    const AF_W = 6.6, AF_L = AZ0 - AZ1, AF_PXM = 24;
    // WHERE THE DRAIN IS, decided once. The painter puts the gully at these
    // fractions of the canvas and the dished geometry below falls toward the
    // same point; before this they were the literal 0.42 in the painter and a
    // number I had worked out by hand in a note, which is the shape of defect
    // this file keeps finding — the same fact decided twice.
    //
    // The canvas maps to the alley BACKWARDS along z, and that is not a guess:
    // pixTex leaves flipY at the CanvasTexture default of true, so canvas row 0
    // is v = 1 is local +y is world -z. Verified against the built world by
    // mapping the canvas corners through the mesh's own localToWorld —
    // top -> z -43.50 (the end wall), bottom -> z -37.00 (the mouth). So the
    // drain is 42% of the way from the END WALL toward the street, not from the
    // street. Getting that backwards puts the dish 1.3 m off, on the wrong side
    // of the alley's centre, and it would look deliberate.
    const DRAIN_U = 0.5, DRAIN_V = 0.42, DRAIN_SIZE = 0.60;
    const DRAIN_X = -FACE - 3.3 + (DRAIN_U - 0.5) * AF_W;
    const DRAIN_Z = AZ1 + DRAIN_V * AF_L;
    const AFW = Math.round(AF_W * AF_PXM), AFL = Math.round(AF_L * AF_PXM);
    const am = (v: number) => Math.max(1, Math.round(v * AF_PXM));
    const alleyFloorT = declareSurface(pixTex(AFW, AFL, (g) => {
      g.fillStyle = '#2e3034'; g.fillRect(0, 0, AFW, AFL);
      // grain per SQUARE METRE, not a flat count — the same correction the
      // facades and the party walls already took
      dither(g, AFW, AFL, Math.round(AF_W * AF_L * 22));
      // Stains sized in METRES and scattered across the whole floor, rather
      // than two blobs that each happened once. Deterministic, not rnd()
      // (GOTCHAS §2).
      let h = 0x9e3779b1;
      const nx = () => { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; return (h >>> 9) / 0x7fffff; };
      g.fillStyle = 'rgba(0,0,0,0.32)';
      for (let i = 0; i < 9; i++) {
        const cx = nx() * AFW, cy = nx() * AFL;
        g.beginPath();
        g.ellipse(cx, cy, am(0.35 + nx() * 0.75), am(0.2 + nx() * 0.4), nx() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      // THE DRAIN IS REAL CASTING NOW, so this paints the HOLE and nothing
      // else. B exported `floorDrain()` from ct/tex-ground.ts — frame, seven
      // bars sunk 11 mm under the frame top, a dark void plate — and it is
      // placed below. Painting bars here as well would double-image them
      // against the geometry, which is worse than either alone.
      //
      // The square is deliberately a little LARGER than the casting's 0.60 m
      // opening. B's void plate sits 9 mm under the slots, and this floor plane
      // is opaque and continuous underneath it, so what you actually see
      // between the bars is THIS PAINT. If it were flush to the opening, a rim
      // of lit paving would show inside the frame and the drain would read as a
      // grille sitting on the ground rather than over a hole.
      const dx = Math.round(AFW * DRAIN_U), dy = Math.round(AFL * DRAIN_V);
      // WATER FINDS IT — and my first attempt at saying so was wrong, reported
      // within the hour: *"long thin dark diagonal streaks running across the
      // paving … They read as smears or as a rendering artefact, not as
      // anything."*
      //
      // That was 16 stroked lines converging on the drain from every side. The
      // reasoning was "water runs downhill toward the gully, so draw it running"
      // — but sixteen strokes radiating from one point is a STARBURST, and from
      // standing height a starburst on the floor is a set of diagonals cutting
      // across the whole alley. It described the flow rather than the mark the
      // flow leaves, which is the mistake: a floor does not show you streamlines.
      //
      // What a yard gully actually leaves is DAMP — the paving stays wet longest
      // where the water sits longest, so it darkens toward the drain smoothly
      // and has no edges at all. A radial wash says that with nothing to
      // mistake for a line. The user's own rule from the earlier note is the
      // test it now passes: a stain "should follow where water runs or where
      // something was dragged, not cut diagonally across the whole floor".
      const wash = g.createRadialGradient(dx, dy, am(0.30), dx, dy, am(2.30));
      wash.addColorStop(0, 'rgba(0,0,0,0.30)');
      wash.addColorStop(0.45, 'rgba(0,0,0,0.15)');
      wash.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = wash;
      g.fillRect(0, 0, AFW, AFL);
      const dw = am(DRAIN_SIZE + 0.06);
      g.fillStyle = '#0a0b0d'; g.fillRect(dx - dw / 2, dy - dw / 2, dw, dw);
    }), 'ground');
    // wet(), like the open sites' ground at the top of this file. The alley is
    // ROOFLESS — rain falls in it — and this `wet()` is what registers the floor
    // with `updateRain`, which owns every material handed to it.
    //
    // THE FAULT THIS FIXED, AND THE PROOF IT IS FIXED. Before the call, the
    // floor got only the grading path's wetK and never updateRain's treatment:
    //
    //     road          67.1 -> 28.0   -58%
    //     alley floor   54.4 -> 51.1    -6%
    //
    // — the street soaked and the alley stayed dry in the same downpour. That
    // measurement stood here for a long time in the PRESENT TENSE with no
    // "after" beside it, so it read as an open fault. It is not one. Re-measured
    // from the material colours, standing in the alley, 13:00 dry against 14:00
    // raining:
    //
    //     road planes   -12.1%
    //     alley floor   -12.1%     the same, to three figures
    //
    // A comment that records a fault and not its repair costs the next reader
    // the whole investigation again — which is what it just cost me, and the
    // same shape as the awning line two files away that described a slope
    // opposite to the one its number produced.
    //
    // Two things about the measurement, because the first version of it was
    // wrong twice. **Ask the world which hours rain**: `props.ts` publishes
    // `rainAt` on `scene.userData` precisely so nothing mirrors the formula, and
    // 15:00 — which I had assumed was wet from a note — is DRY, so my first
    // comparison was dry against dry and correctly showed nothing. **And do not
    // measure the road by pixels**: cars and pedestrians drive through the
    // frame, so the same dry hour read 57 in one pass and 32.9 in another. The
    // alley is traffic-free and read 42.9 three times running, which is the only
    // reason the pixel method looked trustworthy at all (GOTCHAS §29: say
    // whether your number describes an empty world or a lived one).
    // THE ALLEY FALLS TO THE DRAIN — and the player falls with it.
    //
    // The user: *"an alley drain sits mid-floor with the alley falling toward
    // it … the paving should dish slightly into it."* 6 cm over 2.6 m is a 2%
    // fall, which is what a real yard gully is laid to.
    //
    // BOTH HALVES OR NEITHER. GOTCHAS §7: walking height comes from the PICKER,
    // not from the mesh. Displacing this geometry alone would leave the player
    // striding flat across a visible dip — a cosmetic change that ships a
    // floating-player bug, and it looks finished on its own, which is why I
    // stopped last time instead of doing half of it (`177b0e332`).
    //
    // The registration answers ONLY INSIDE THE DISH and returns null everywhere
    // else, so nothing outside the bowl changes hands. That matters more than
    // it looks: groundPick's final fallback gives KERB_H for |x| < FACE + 0.3
    // and 0 beyond it, so the alley walks at road level but there is a 14 cm
    // kerb step in the strip x −7.3 … −7.0 at the mouth. A patch that answered
    // for the whole alley floor would silently flatten that step. The dish is
    // 2.6 m from a drain at x −10.30, so it never reaches it.
    //
    // smoothstep, not a cone: zero slope at the centre so the casting beds flat
    // when it arrives, and zero slope at the rim so the bowl does not meet the
    // flat paving on a crease.
    const DISH_R = 2.6, DISH_D = 0.06;
    /** metres below the flat alley floor at (x, z) — 0 outside the bowl */
    const dishAt = (x: number, z: number) => {
      const t = Math.hypot(x - DRAIN_X, z - DRAIN_Z) / DISH_R;
      if (t >= 1) return 0;
      return -DISH_D * (1 - t * t * (3 - 2 * t));
    };
    // Publish it, so anything RESTING on this floor can ask instead of
    // remembering a number. Assigned during the build, and the module-level
    // default is flat — so a caller that somehow runs before this gets exactly
    // the height it would have got before the dish existed, rather than a wrong
    // one. See the export at the top of this file.
    setAlleyDish(dishAt);
    const floorG = new THREE.PlaneGeometry(AF_W, AF_L, 22, 22);
    {
      // local +x is world +x, local +y is world −z, local +z is world +y —
      // the mesh is laid down by rotation.x = −π/2 below.
      const pos = floorG.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, dishAt(-FACE - 3.3 + pos.getX(i), (AZ0 + AZ1) / 2 - pos.getY(i)));
      }
      pos.needsUpdate = true;
      floorG.computeVertexNormals();
    }
    const floorA = new THREE.Mesh(floorG, wet(new THREE.MeshBasicMaterial({ map: alleyFloorT })));
    floorA.rotation.x = -Math.PI / 2;
    floorA.position.set(-FACE - 3.3, 0.005, (AZ0 + AZ1) / 2);
    floorA.userData.alley = 'floor';
    scene.add(floorA);
    // THE CASTING, and it is B's rather than a second design.
    //
    // The user was explicit: "If the casting is B's asset, ask me and B exports
    // it rather than you drawing a second one — a second grate design is exactly
    // how this project ended up with two of everything." I asked
    // (notes/D-alley-grate.md) and B exported `floorDrain()`, which is the kerb
    // inlet's vocabulary with the throat removed, because water arrives at a
    // yard gully from every side rather than down a gutter. So the block has ONE
    // grate design in two correct variants, which is what was asked for.
    //
    // The y it wants is the FLOOR HEIGHT here, and B's doc says the caller knows
    // its own floor and this does not guess. Ours is the dished paving surface:
    // the plane sits 5 mm proud of nominal and the bowl takes it 60 mm down.
    // Passing the flat height instead would bury the frame in the dip it is
    // supposed to sit at the bottom of.
    floorDrain(scene, DRAIN_X, floorA.position.y + dishAt(DRAIN_X, DRAIN_Z), DRAIN_Z, DRAIN_SIZE);
    // the collision half. Same dishAt the geometry was built from, so the floor
    // you walk cannot drift from the floor you see.
    a.ground((x: number, z: number) => (dishAt(x, z) < 0 ? dishAt(x, z) : null));
    // bare-brick end wall (no shop, one grimy window). 7 m wide, and as tall
    // as the taller of the two buildings the alley is cut between.
    //
    // It was a fixed 12.8 m, and its neighbours are 16–19 m, so standing in
    // the alley and looking up you saw a WEDGE OF SKY over the back wall —
    // between two five-storey shells that are supposed to be solid block
    // (notes/seam-audit.md finding 16, "still live"). An alley is a slot, and
    // a slot that shows sky at the closed end is a fence, not a building.
    //
    // Derived from the roster neighbours rather than typed, so it cannot fall
    // behind again when a building's floor count changes — which is exactly
    // how 12.8 stopped being right.
    const topOfB = (b: BldSpec) => a.bandOf(b) + 3.4 + b.floors * 2.4;
    const END_H = Math.max(topOfB(a.northNeighbour), topOfB(a.southNeighbour));
    const endS = masonry(7.0, END_H, 0);
    const bareBrickT = endS.paint((g) => {
      const EW = endS.W, EH = endS.H, em = endS.m;
      g.fillStyle = '#5a3a30'; g.fillRect(0, 0, EW, EH);
      endS.courses(g);
      // The window is anchored to the GROUND, not to the top of the canvas.
      // It used to be `em(3.0)` down from the top of a 12.8 m wall — 9.8 m up
      // — and the moment the wall got its real height that put it 15 m up,
      // sliding with the parapet instead of staying on its floor. Same numbers
      // in the world as before, measured from the pavement.
      const winTop = EH - em(9.8);
      g.fillStyle = '#1a1c22'; g.fillRect(em(2.6), winTop, em(1.75), em(2.4));   // window reveal
      g.fillStyle = '#3a4450'; g.fillRect(em(2.8), winTop + em(0.15), em(1.4), em(2.05));  // grimy glass
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 4; k++) g.fillRect(Math.floor(Math.random() * (EW - em(0.25))), 0, em(0.25), Math.floor(EH * Math.random()));
      dither(g, EW, EH, Math.round(7.0 * END_H * 7.8));
    });
    const endWallM = new THREE.MeshBasicMaterial({ color: 0x3d2a24 });
    const alleyEnd = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, END_H, 7),
      [new THREE.MeshBasicMaterial({ map: bareBrickT }), endWallM, endWallM, endWallM, endWallM, endWallM],
    );
    alleyEnd.position.set(-FACE - 6.9, END_H / 2, (AZ0 + AZ1) / 2);
    // Stamped so a check can find these three without guessing from position.
    // Guessing is what made scripts/shells.mjs read this very wall as a 1.2 m
    // building; see notes/D-alley-report.md.
    alleyEnd.userData.alley = 'end';
    solid({ minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 });
    scene.add(alleyEnd);
    // ── the alley's two flanks ────────────────────────────────────────────
    // These are the exposed party walls of the two buildings the alley is cut
    // between: whatever the roster puts north of it, and MUSIC to the south. They carry the SAME
    // brick as the rear wall — 5 px courses, 9 px stretchers, ~11.7 px/m —
    // so the alley reads continuous around both corners. But they are two
    // different buildings with two different histories, so they are painted
    // one at a time at full wall size (no tiling, no mirroring): different
    // tone, different weathering, different repairs.
    //
    // They run the FULL height of the building behind them, so brick — not
    // the shell's flat end cap — is what you see when you look up.
    //
    // Painted from a LOCAL lcg instead of Math.random: the fingerprint
    // harness seeds Math.random globally, so spending draws here would
    // ripple through every texture the world builds after the alley.
    const lcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    // whole stretchers a shade off the run — the thing that stops flat brick
    // reading as wallpaper. Walks the same bond masonry() lays down, so the
    // alley brick is the street brick seen from the side.
    const mottle = (g: CanvasRenderingContext2D, W: number, H: number, up: string, dn: string, r: () => number, cH: number, pW: number) => {
      for (let y = 0; y < H; y += cH) {
        const off = (Math.round(y / cH) % 2) ? 0 : Math.round(pW / 2);
        for (let x = off; x < W; x += pW) {
          const k = r();
          if (k > 0.85) g.fillStyle = up; else if (k < 0.13) g.fillStyle = dn; else continue;
          g.fillRect(x + 1, y + 1, pW - 1, cH - 1);
        }
      }
    };
    const grain = (g: CanvasRenderingContext2D, W: number, H: number, n: number, r: () => number) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
        g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1);
      }
    };
    // The flanks are 7 m of wall, as tall as the building they belong to.
    // They used to be a fixed 80 px wide at 150/12.8 px per metre up — 11.43 x
    // 11.74, against a street that now runs 8 x 8.
    //
    // The art below is still written in the texel coordinates it was drawn in.
    // Restating two dozen constants in metres is a bigger edit than this file
    // can safely take right now, so `ox`/`oy` re-base them onto the correctly
    // dense canvas instead: same world positions, one derivation, no painter
    // carrying a px/m of its own. Worth restating properly next time the alley
    // is opened — see notes/A-density-cross.md.
    const FLANK_W = 7.0, OLD_AW = 80, OLD_PXM = 150 / 12.8;
    // north flank — the wall of whatever sits north of the gap. Warmer red brick, badly patched: a square
    // of newer grey brick let in mid-height, a bricked-up service door at
    // the bottom, and a long rust-and-rain streak off a missing downpipe.
    const northFlankT = (hM: number) => {
      const surf = masonry(FLANK_W, hM, 0);
      const AW = surf.W, H = surf.H;
      const ox = (v: number) => Math.round(v * (AW / OLD_AW));
      const oy = (v: number) => Math.round(v * (surf.ppm / OLD_PXM));
      const cH = surf.m(0.5), pW = surf.m(1.125);
      return surf.paint((g) => {
      const r = lcg(0x51f0a3);
      g.fillStyle = '#623f32'; g.fillRect(0, 0, AW, H);
      mottle(g, AW, H, '#6f4b3a', '#553629', r, cH, pW);
      surf.courses(g);
      // NO rectangular infill anywhere on this flank. Any outlined block with
      // a line across its head reads as a bricked-up doorway from inside the
      // alley — twice now — so this wall's history is told with repointing
      // that follows the courses and stops on a ragged brick edge instead.
      for (let y = Math.round(H * 0.3); y < Math.round(H * 0.62); y += cH) {
        const x0 = ox(40) + Math.floor(r() * ox(8)), x1 = ox(68) + Math.floor(r() * ox(10));
        g.fillStyle = 'rgba(216,200,172,0.1)'; g.fillRect(x0, y, x1 - x0, 1);
        g.fillStyle = 'rgba(214,198,170,0.06)'; g.fillRect(x0 + 2, y + 1, x1 - x0 - 5, oy(3));
      }
      // the streak: a wet column off a downpipe that isn't there any more
      for (const [sx, sw, a] of [[35, 3, 0.3], [34, 1, 0.16], [38, 1, 0.13]] as [number, number, number][]) {
        g.fillStyle = `rgba(24,14,10,${a})`;
        g.fillRect(ox(sx), 0, ox(sw), Math.round(H * 0.78));
        g.fillRect(ox(sx) - 1, Math.round(H * 0.5), ox(sw) + 2, Math.round(H * 0.28));
      }
      g.fillStyle = 'rgba(196,178,150,0.09)';                    // salt bloom near the floor
      for (let i = 0; i < 14; i++) g.fillRect((i * ox(17)) % ox(74), H - oy(4) - ((i * oy(11)) % oy(22)), ox(5), oy(2));
      grain(g, AW, H, Math.round(FLANK_W * hM * 9), r);
      });
    };
    // south flank — MUSIC's wall. Darker, sootier, wetter: a tide-line of
    // damp climbing off the floor, spalled brick faces, and the ghost of a
    // painted sign nobody has been able to scrub off.
    const southFlankT = (hM: number) => {
      const surf = masonry(FLANK_W, hM, 0);
      const AW = surf.W, H = surf.H;
      const ox = (v: number) => Math.round(v * (AW / OLD_AW));
      const oy = (v: number) => Math.round(v * (surf.ppm / OLD_PXM));
      const cH = surf.m(0.5), pW = surf.m(1.125);
      return surf.paint((g) => {
      const r = lcg(0x2b91c7);
      g.fillStyle = '#563a2f'; g.fillRect(0, 0, AW, H);       // greyer, sootier — same value, different cast
      mottle(g, AW, H, '#604436', '#492f28', r, cH, pW);
      surf.courses(g);
      // soot: this flank gets the weather off the roof, top down
      for (let y = 0; y < H * 0.4; y++) {
        g.fillStyle = `rgba(18,14,14,${0.2 * (1 - y / (H * 0.4))})`;
        g.fillRect(0, y, AW, 1);
      }
      // ghost sign — painted over decades ago, still coming through
      const gY = Math.round(H * 0.30), gW = ox(58), gX = ox(11);
      g.fillStyle = 'rgba(186,172,146,0.1)'; g.fillRect(gX, gY, gW, oy(29));
      g.fillStyle = 'rgba(198,184,158,0.16)';
      for (let i = 0; i < 5; i++) g.fillRect(gX + ox(4) + i * ox(11), gY + oy(6), ox(7), oy(11));   // washed lettering
      g.fillRect(gX + ox(8), gY + oy(22), gW - ox(20), oy(2));
      g.fillStyle = 'rgba(0,0,0,0.09)';
      for (let i = 0; i < 26; i++) g.fillRect((i * ox(29)) % (gW - ox(4)) + gX, gY + ((i * oy(13)) % oy(28)), ox(3), oy(2)); // flaked off
      // damp climbing out of the floor. Stepped BRICK BY BRICK, not a smooth
      // curve — masonry wicks along the courses, and a sine here just reads
      // as bunting at this texel size.
      for (let x = 0; x < AW; x += pW) {
        const t = cH * (3 + Math.floor(r() * 5));              // tide height, whole courses
        for (let y = H - t; y < H; y++) {
          g.fillStyle = `rgba(20,15,17,${0.07 + 0.26 * ((y - (H - t)) / t)})`;
          g.fillRect(x, y, pW, 1);
        }
      }
      // spalled faces — brick that has blown off, showing the dark core
      for (let i = 0; i < 8; i++) {
        const sx = ox(3) + Math.floor(r() * (AW - ox(14))), sy = oy(8) + Math.floor(r() * (H - oy(60)));
        g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(sx, sy, ox(5) + Math.floor(r() * ox(3)), oy(4));
        g.fillStyle = 'rgba(206,190,166,0.1)'; g.fillRect(sx, sy + oy(4), ox(5), 1);
      }
      // one long stepped crack running down from the top
      let cx = ox(52);
      for (let y = oy(2); y < H * 0.62; y += oy(3)) {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx, y, 1, oy(3));
        cx += r() < 0.42 ? (r() < 0.5 ? -1 : 1) : 0;
      }
      g.fillStyle = 'rgba(10,9,11,0.45)'; g.fillRect(0, H - oy(2), AW, oy(2));  // tar line at the foot
      grain(g, AW, H, Math.round(FLANK_W * hM * 9), r);
      });
    };
    // Each flank is as tall as its building and stands 1 cm proud of the
    // shell face — the shells now stop exactly on AZ0/AZ1, so 1 cm is all
    // the clearance the depth test needs.
    const topOf = (b: BldSpec) => a.bandOf(b) + 3.4 + b.floors * 2.4;
    for (const [paint, spec, az, ry] of [
      [northFlankT, a.northNeighbour, AZ0 - 0.01, Math.PI],
      [southFlankT, a.southNeighbour, AZ1 + 0.01, 0],
    ] as [(h: number) => THREE.Texture, BldSpec, number, number][]) {
      const wh = topOf(spec);
      // FrontSide, not DoubleSide. These are the alley's two flanks and you
      // only ever stand on one side of them — but the reason it matters CHANGED
      // under them: flank paint used to be plain brick, which is its own
      // mirror, and it now carries party-wall marks (the stepped scar, chimney
      // breasts, blocked-up windows) which are emphatically handed. A
      // double-sided plane renders the back mirrored (GOTCHAS §10), so this
      // was a latent defect the moment those marks landed. Single-sided means
      // it cannot arise if the alley is ever opened up from behind.
      const m = new THREE.MeshBasicMaterial({ map: paint(wh) });
      const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(7.0, wh), m);
      sideWall.position.set(-FACE - 3.5, wh / 2, az);
      sideWall.rotation.y = ry;
      sideWall.userData.alley = 'flank';
      scene.add(sideWall);
    }
    // the dumpster: ribbed tub with fork pockets, stencil on the long faces
    // only, lid hinged on the wall side and propped open onto the wall
    const dumpFrontT = declareSurface(pixTex(96, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 96, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 96, 3);            // top lip
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 6; x < 96; x += 12) g.fillRect(x, 3, 2, 41);                   // ribs
      g.fillStyle = '#14161a'; g.fillRect(8, 38, 24, 7); g.fillRect(64, 38, 24, 7); // fork pockets
      g.fillStyle = 'rgba(122,66,40,0.55)';
      g.fillRect(38, 36, 16, 10); g.fillRect(82, 16, 12, 14);                     // rust
      g.fillStyle = '#c9c4b0'; g.font = 'bold 9px monospace';
      g.textAlign = 'center'; g.fillText('CITY WASTE', 48, 20);
      dither(g, 96, 48, 160);
    }), 'detail');
    const dumpSideT = declareSurface(pixTex(48, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 48, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 48, 3);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 5; x < 48; x += 12) g.fillRect(x, 3, 2, 41);
      g.fillStyle = 'rgba(122,66,40,0.5)'; g.fillRect(10, 34, 14, 12);
      dither(g, 48, 48, 90);
    }), 'detail');
    const dumpFrontM = new THREE.MeshBasicMaterial({ map: dumpFrontT });
    const dumpSideM = new THREE.MeshBasicMaterial({ map: dumpSideT });
    const dumpInsideM = new THREE.MeshBasicMaterial({ color: 0x101114 });
    const dump = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.05),
      [dumpSideM, dumpSideM, dumpInsideM, dumpInsideM, dumpFrontM, dumpFrontM],
    );
    dump.position.set(-11.2, 0.69, AZ0 - 1.15);
    solid({ minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 });
    scene.add(dump);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.06, 1.12), new THREE.MeshBasicMaterial({ color: 0x24482f }));
    lid.geometry.translate(0, 0.03, -0.56); // pivot runs along its hinge edge
    lid.position.set(-11.2, 1.24, AZ0 - 0.625);
    lid.rotation.x = 0.5;
    scene.add(lid);
    for (const [wx, wz] of [[-12.15, AZ0 - 0.78], [-10.25, AZ0 - 0.78], [-12.15, AZ0 - 1.52], [-10.25, AZ0 - 1.52]]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), new THREE.MeshBasicMaterial({ color: 0x0e0f12 }));
      wheel.position.set(wx, 0.09, wz);
      scene.add(wheel);
    }
    // No trash bags. Three passes of low-poly lumps only ever read as rocks
    // on the ground, so they are gone rather than redrawn a fourth time —
    // the dumpster carries the alley on its own. Nothing referenced them:
    // the only alley colliders are the end wall and the dumpster.
    { const m = scene.children.length; buildCatRig({ scene, boards, AZ1 }); stampFrom(m, 'cat'); }
    // The leaning plywood sheet is gone too — a tan slab against brick reads
    // as a mystery door, not as junk. The wall behind it is full brick now,
    // so there is nothing to patch over.
    // LA graffiti — cholo placa lineage (Bojórquez/Prime, not East-Coast
    // bubbles): ALL CAPS square block letters stood shoulder to shoulder,
    // upright, ONE color, hard underline. Hand-built 5×7 glyphs so the
    // strokes are square, not font curves.
    const PLACA: Record<string, [number, number, number, number][]> = {
      R: [[0, 0, 1, 7], [0, 0, 4, 1], [4, 1, 1, 2], [0, 3, 4, 1], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 1]],
      E: [[0, 0, 1, 7], [0, 0, 5, 1], [0, 3, 4, 1], [0, 6, 5, 1]],
      Z: [[0, 0, 5, 1], [4, 1, 1, 1], [3, 2, 1, 1], [2, 3, 1, 1], [1, 4, 1, 1], [0, 5, 1, 1], [0, 6, 5, 1]],
      O: [[0, 0, 5, 1], [0, 6, 5, 1], [0, 1, 1, 5], [4, 1, 1, 5]],
      S: [[0, 0, 5, 1], [0, 1, 1, 2], [0, 3, 5, 1], [4, 4, 1, 2], [0, 6, 5, 1]],
      N: [[0, 0, 1, 7], [4, 0, 1, 7], [1, 1, 1, 2], [2, 3, 1, 1], [3, 4, 1, 2]],
      A: [[0, 1, 1, 6], [4, 1, 1, 6], [1, 0, 3, 1], [1, 3, 3, 1]],
      K: [[0, 0, 1, 7], [3, 0, 1, 1], [2, 1, 1, 1], [1, 2, 1, 2], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 1]],
      B: [[0, 0, 1, 7], [0, 0, 4, 1], [4, 1, 1, 2], [0, 3, 4, 1], [4, 4, 1, 2], [0, 6, 4, 1]],
    };
    const placaTex = (word: string, ink: string) => {
      const W = word.length * 7 + 3;
      return declareSurface(pixTex(W, 20, (g) => {
        g.fillStyle = ink;
        for (let i = 0; i < word.length; i++) {
          const x0 = 2 + i * 7;
          for (const [sx, sy, sw, sh] of PLACA[word[i]] ?? []) {
            g.fillRect(x0 + sx, 1 + sy * 2, sw, sh * 2); // ×2 tall — soldiers, not squares
          }
        }
        g.fillRect(2, 17, W - 6, 1); // the hard underline
        g.fillRect(W - 5, 16, 2, 1); // finished with a flick
      }), 'sign');
    };
    const tag = (t: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry: number) => {
      // alphaTest. It WAS what stopped these tags glowing at midnight, and it is
      // not any more — `34a3ed95` fixed the cause properly, upstream.
      //
      // The history, because the comment used to claim more than it should. The
      // tags rendered at colour 1.0 at 23:00 while the brick behind them sat at
      // 0.062: props.ts skipped anything `isGlass = m.transparent &&
      // !(m.alphaTest > 0)` called glass, and a transparent decal with no
      // alphaTest is glass by that test. Setting alphaTest took them out of it.
      //
      // B then classified all 67 of their own and found the predicate was
      // carrying three meanings — additive light (bright at midnight is what it
      // is FOR), self-lit signage, and ordinary decals — and split it. Measured
      // at HEAD: remove this alphaTest and the tags are STILL graded, still
      // 0.115 at 23:00. My fix is now redundant as a fix.
      //
      // Kept because it is still right for this art: `placaTex` is fillRect on
      // a transparent ground, every texel fully opaque or fully clear, so a
      // cutout is what it should have been regardless of grading.
      //
      // Safe here because the art is hard-edged: `placaTex` is fillRect on a
      // transparent ground, so every texel is fully opaque or fully clear and a
      // cutout renders identically to a blend. Nothing about the daytime alley
      // changes; see shots/al-graffiti.png against shots/al-night-in.png.
      //
      // Found by SHOOTING THE ALLEY AT NIGHT, which nobody had done — all eight
      // alley shots were 13:00. A check could not have told me: the tags were
      // exactly as bright as they were designed to be.
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, depthWrite: false }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    tag(placaTex('REZO', '#16161a'), 1.7, 1.1, -9.6, 1.45, AZ0 - 0.05, Math.PI);
    tag(placaTex('SNAK', '#c9c4b0'), 1.35, 0.87, -11.6, 1.15, AZ1 + 0.05, 0);
    tag(placaTex('KOBRA', '#16161a'), 1.55, 0.82, -FACE - 6.27, 1.7, AZ0 - 2.3, Math.PI / 2);
}

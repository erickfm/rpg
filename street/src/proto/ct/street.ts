import * as THREE from 'three';
import { declareSurface, pixTex, dither } from './paint';
import {
  facadeTex, facadeLitTex, shopfrontTex, resGroundTex, ENTRANCE, SHOP_BAND_H, masonry, SHOP_MULT, wallHeight, FLOOR_M,
  proud, reveal, glazed, mullions, HI, shopfrontRelief, shopInteriorTex, WALK_PROJECTION,
  burgerFront, pawnFront, taxFront,
} from './tex-world';
import { walkTex } from './tex-ground';
import { buildCatRig } from './cat';
import { buildCivic, type BldSpec } from './civic';
import { buildVice } from './vice';
import { L, ROAD_HALF, WALK, FACE } from './rng';
import { type AABB } from '../fp';

// Every building on the block, hand-authored end to end, plus the alley
// cut into the west wall. Adds meshes + billboard sprites; owns no state.
export function buildStreet(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  sidewalkY: number; KERB_H: number;
  boards: { m: THREE.Mesh }[];
  AZ0: number; AZ1: number;
  SIDE_X1: number; SIDE_Z0: number; SIDE_Z1: number;
}) {
  const { scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1 } = o;
  // ── collision, registered by the module that draws the building ─────────
  //
  // This used to be two rectangles hand-written in crosstown.ts spanning the
  // whole block, which meant collision could not follow geometry: the library
  // courtyard was walled off by a blanket that knew nothing about it, and the
  // bodega's canted corner collided square. Same failure the [E] spots and the
  // frame hooks already outgrew, same fix — whoever draws it registers it.
  //
  // The two numbers every footprint below is built from:
  //   CUSH the cushion in FRONT of a facade, so nothing projecting sticks
  //        through the collider into the walking lane (GOTCHAS §9). It was a
  //        flat 0.3 on every building, written before the shopfront relief
  //        existed and sized by guess. It is now `WALK_PROJECTION` — 0.12,
  //        the depth of the deepest thing the relief actually puts at walking
  //        height (the jamb; the cornice is deeper but it is 3.5 m up).
  //
  //        That 0.18 m difference was the single biggest encroachment on the
  //        block. notes/lane-audit.md: "the clear lane is 1.70 m, not 2.00 m
  //        — before anyone puts anything on it… 15 % of the sacred 2 m is
  //        consumed by collision that corresponds to no geometry, everywhere,
  //        permanently." Giving it back is worth more than every individual
  //        lamp post and tree in that audit put together.
  //
  //        The BANK keeps 0.30, because its granite portal genuinely projects
  //        that far (DREC below) — there the cushion describes real stone.
  //   8    the depth BEHIND a facade. Shells are only 3.4 m deep; the extra
  //        stops you running round the back into the dead ground.
  const CUSH = WALK_PROJECTION;
  // ── whose mesh is this ──────────────────────────────────────────────────
  //
  // `userData.mod` makes "whose face is this" a LOOKUP instead of geography.
  // 501f5d74 measured what geography has cost: 726 of 3383 meshes stamped, all
  // from two modules, so 79 % of every cross-agent attribution this week was
  // inference — and inference misrouted thirteen faults onto ct/lot.ts, cost
  // 9e1bce93 two rounds, and nearly misrouted a third time. I did two of those
  // attributions myself, by hand, from coordinates (the lamp splash and pool).
  //
  // This module is a special case worth being careful about: `buildStreet`
  // CALLS other agents' builders — E's library and church, G's casino and
  // hotel, the cat rig — and they add straight to the same scene. Stamping
  // everything added during this function would put my name on their
  // geometry, which is precisely the false attribution the mechanism exists to
  // stop. So each of those calls is bracketed and stamped with ITS OWN owner
  // first, and `street` is applied last to whatever is still unclaimed.
  //
  // Never overwrites: first writer wins, so a module that stamps itself keeps
  // its own answer.
  const stampFrom = (mark: number, mod: string) => {
    for (let i = mark; i < scene.children.length; i++) {
      scene.children[i].traverse((n) => { if (!n.userData.mod) n.userData.mod = mod; });
    }
  };
  const STREET_MARK = scene.children.length;
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); return b; };
  // `kind` takes a building OUT of the shopfront system entirely — a civic
  // building is not a brick box with an awning and a painted name on it, and
  // the two that carry this block get their own builders below.
  //
  // ── the block, re-cast ────────────────────────────────────────────────
  //
  // Widths are load-bearing, not decoration. Three runs have to land on an
  // exact number and every roster below is balanced to hit it:
  //   · WEST before the alley must total 51.2 so PAWN ends on AZ0 = -37
  //   · WEST after it must total 54.5 so the last shell ends on -98, where
  //     the corner building takes over
  //   · EAST before No. 227 must total 49.2, because the walk-up's door and
  //     its interior live in ct/apartment.ts at a fixed z
  // Change a width and you must pay for it out of a neighbour in the same run.
  const WEST: (BldSpec | 'alley' | 'park' | 'bank')[] = [
    // DINER and LAUNDRY swapped IDENTITIES, not slots — the widths stay where
    // they are, so both run totals are untouched (51.2 before the alley, 54.5
    // after). Moving the entries bodily would have cost 2.8 m of
    // reconciliation in each run for nothing. The diner also wants the wider
    // frontage, and the far side of the alley had nothing to eat on it.
    // LAUNDRY 9.2 + MERIDIAN 10 merged into one 19.2 m bank — the run before
    // the alley still totals 51.2. MERIDIAN was the corporation, and a branch
    // bank plays that part better: institutional, flat, and still the right
    // foil for the library next door.
    'bank',
    { nm: 'LIBRARY', col: '', w: 16, brick: '', floors: 0, kind: 'library' },
    // the loudest thing on the block, in the widest slot on this side, right
    // up against the quietest — that contrast is doing a lot of work here
    { nm: 'BURGER BARN', col: '#c8302a', w: 16, brick: '#7a4a3a', floors: 4, front: 'burger' },
    'alley',
    // z -55.5 … -43.5, centre -49.5 — ct/int-diner.ts anchors its door here
    { nm: 'DINER', col: '#8a5a22', w: 12, brick: '#6b4034', floors: 4 },
    // BARBER and THRIFT swapped identities — widths stay, so the run still
    // totals 54.5. The swap is what MAKES the park: it puts BARBER beside
    // GROCERY, and those two together are the 30 m running down to z = -98
    // where the corner building takes over. With THRIFT between them there
    // was no 30 m to give away without breaking the run.
    { nm: 'THRIFT', col: '#7a5a2c', w: 12.5, brick: '#5c4436', floors: 4 },
    'park',   // the old BARBER 14 + GROCERY 16, given over — see placePark
  ];
  const EAST: (BldSpec | 'lot')[] = [
    // CAFE 11.2 + HARDWARE 12 given over to a used car lot. Already adjacent,
    // so no swap — and the run before No. 227 still totals 49.2, which is
    // load-bearing: the walk-up's door and interior sit at a fixed z in
    // ct/apartment.ts.
    'lot',
    { nm: 'A-1 TAX', col: '#2c4a7a', w: 13, brick: '#7a4a3a', floors: 5, front: 'tax' },
    { nm: 'LIQUOR', col: '#8a2c42', w: 13, brick: '#835444', floors: 4 },
    { nm: '', col: '', w: 18, brick: '#835444', floors: 5, res: true }, // No. 227 — home, across from the alley, a bit off
    // PAWN pays the 3 m. DELI + RECORDS were 21 m and the nave is 18, and the
    // post-227 run must still total 43 so the last shell lands on -96 — so the
    // difference goes to the church's north neighbour rather than overflowing
    // the run. No. 227 is untouchable: ct/apartment.ts depends on its z.
    { nm: 'PAWN', col: '#6a5a3a', w: 15, brick: '#5c4436', floors: 5, front: 'pawn' },
    { nm: 'ST BRIGID', col: '', w: 18, brick: '', floors: 0, kind: 'church' },
    { nm: 'BODEGA', col: '#b8342a', w: 10, brick: '#6b4034', floors: 3 }, // the corner store
  ];
  // The side street. It runs east into the fog, and the far end of it is
  // somewhere else: the casino and the hotel that feeds it sit out at x = 34
  // and beyond, read at 40 m through the haze, and are not part of this
  // block's life. Both rosters stop dead on x = 57, where the cross building
  // that closes the street begins.
  const NORTH2: BldSpec[] = [
    { nm: 'FLOWERS', col: '#4a7a52', w: 6, brick: '#835444', floors: 3 }, // half of it is the bodega's now
    { nm: 'CHOP SUEY', col: '#8a3a2e', w: 11, brick: '#5c4436', floors: 3 },
    { nm: 'HOTEL ORPHEUS', col: '#6a4a2c', w: 12, brick: '#7a4a3a', floors: 5 },
    { nm: 'GOLDEN ACES', col: '#8a2c42', w: 11.55, brick: '#5c4436', floors: 4 },
  ];
  const SOUTH2: BldSpec[] = [
    // the church has moved to the main block; the two shops it displaced take
    // its old slot. 9.5 + 8.5 = the 18 m the church vacated, so this run still
    // totals 64 and still ends dead on x = 57.
    { nm: 'DELI', col: '#2e6a34', w: 9.5, brick: '#6b4034', floors: 3 },
    { nm: 'RECORDS', col: '#6a2c6a', w: 8.5, brick: '#7a4a3a', floors: 3 },
    { nm: 'GARAGE', col: '#5a5f66', w: 12, brick: '#5c4436', floors: 3 },
    { nm: 'BILLIARDS', col: '#2c5a3a', w: 12, brick: '#835444', floors: 4 },
    { nm: 'SMOKES', col: '#8a6a22', w: 11, brick: '#6b4034', floors: 3 },
    { nm: 'LOANS', col: '#7a6a2c', w: 11, brick: '#7a4a3a', floors: 4 },
  ];
  // Buildings ABUT — a shell is exactly b.w deep, never b.w + slop. Two
  // neighbours share the boundary plane; their facade quads meet edge to
  // edge instead of overlapping, so there is no coplanar strip to z-fight
  // (same rule that fixed the corner road: abut, never overlap).
  // The three shopfronts that are NOT the block default — BURGER BARN, PAWN
  // and A-1 TAX — now live in ct/tex-world.ts next to shopfrontTex, which is
  // the system they are variants of. They were here, in a file owned by
  // somebody who did not own that system, and drifting is what that split
  // bought us: the burger barn kept its mustard through three fixes.
  // A shop's ground floor and a flat's are NOT the same height, and pretending
  // they were is what made every storefront on this block read undersized:
  // 3.2 m of band left only 1.92 m of glass, shorter than the door beside it.
  // Shops get SHOP_BAND_H; the walk-up keeps ENTRANCE.BAND_H, which is what
  // ct/apartment.ts hangs its door in and is already the right size.
  const bandOf = (b: BldSpec) => (b.res ? ENTRANCE.BAND_H : SHOP_BAND_H);
  // ── the block goes to bed ────────────────────────────────────────────────
  //
  // Lit windows used to be painted INTO the facade, so the same rooms were lit
  // at four in the morning as at nine at night — and at one in the afternoon,
  // which is the version you actually notice. The light is now its own
  // transparent sheet hung a couple of centimetres off each facade, and its
  // opacity is a function of the hour.
  //
  // Two things make this cheap rather than clever. `facadeLitTex` shares the
  // window grid with `facadeTex`, so the light cannot slide off its holes; and
  // props.dimWorld() skips any material with `transparent` set, so the night
  // grading that darkens the brick leaves the light alone without either side
  // having to know about the other.
  // TWO sheets, not one, because a block that fades all its windows together
  // is still one pattern — just a dimmer one at four in the morning. The
  // EVENING set is the block at home; the SMALL-HOURS set is a different,
  // much sparser set of rooms, and they cross-fade past each other so the
  // windows that are on at three are not the windows that were on at nine.
  const eveMats: THREE.MeshBasicMaterial[] = [];
  const lateMats: THREE.MeshBasicMaterial[] = [];
  const SHEETS = [
    { list: eveMats, variant: 0, pct: 19, off: 0.02 },
    { list: lateMats, variant: 1, pct: 8, off: 0.035 },
  ];
  // hang both sheets on a facade. `nx`/`nz` is the way the facade looks; the
  // sheets stand at slightly different offsets along it so two coplanar quads
  // never have to be ordered against each other.
  const litSheets = (
    b: BldSpec, wM: number, hM: number,
    x: number, y: number, z: number, ry: number, nx: number, nz: number,
  ) => {
    for (const sh of SHEETS) {
      const m = new THREE.MeshBasicMaterial({
        map: facadeLitTex(b.brick, b.floors, wM, { variant: sh.variant, pct: sh.pct }),
        transparent: true, opacity: 0, depthWrite: false,
      });
      // THIS SHEET CARRIES ITS OWN LIGHT — do not grade it down after dark.
      // It is already left alone, but for the wrong reason: props.ts's
      // `isGlass` is `m.transparent && !(m.alphaTest > 0)`, and these are
      // transparent, so the grader skips them as GLASS. They are not glass.
      // That is incidental, not a decision: tighten `isGlass` to actually
      // mean glass — entirely reasonable, it is B's file — and every lit
      // window on the block starts dimming at night with nothing on record
      // saying it must not.
      //
      // `userData.selfLit` is the convention for saying so (ct/paint.ts
      // documents it; props.ts stamps it on the signage path). No behaviour
      // changes today — measured, `graded` stays false either way. It makes
      // the exclusion DECLARED, and it answers the question A's nightgrade
      // asks of every ungraded material: 34 sheets that were never offered
      // to the dimmer, and now they say why.
      m.userData.selfLit = true;
      sh.list.push(m);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), m);
      // WHICH SET OF ROOMS THIS SHEET IS. The user's complaint had two halves
      // and only one is visible in a frame: "lit at one in the afternoon" a
      // camera can see, but "the same windows at 4am as at 8pm" it cannot —
      // a warm-pixel count is non-linear in opacity and cannot tell a window
      // at 0.35 from a window that is off (scripts/windowlights.mjs records
      // the numbers that proved it). The fact only this file knows is WHICH
      // sheet is which, so it says so, and a checker can read the two
      // opacities instead of guessing at pixels. Same move as userData.mod
      // and userData.facing.
      p.userData.litSheet = sh.variant === 0 ? 'evening' : 'late';
      p.position.set(x + nx * sh.off, y, z + nz * sh.off);
      p.rotation.y = ry;
      p.renderOrder = 2;                                // over its own facade
      scene.add(p);
    }
  };
  // Not a light sensor — people. Nobody switches a lamp on at noon, the block
  // is at its fullest around nine, and by four in the morning it is down to
  // whoever is still up. Both curves are continuous across midnight: they
  // leave hour 24 at the value they enter hour 0 with.
  const ramp = (a: number, b: number, t: number) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  const eveAt = (h: number) => {
    if (h < 5) return 1 - ramp(22.5, 24.5, h + 24);      // last night's tail
    if (h < 6.5) return 0.35 * ramp(5, 6.5, h);          // kettles on
    if (h < 7) return 0.35;
    if (h < 9.5) return 0.35 * (1 - ramp(7, 9.5, h));    // out for the day
    if (h < 16.5) return 0;                              // nobody lights a room at noon
    if (h < 20) return ramp(16.5, 20, h);                // home, a window at a time
    if (h < 22.5) return 1;                              // the block at its fullest
    return 1 - ramp(22.5, 24.5, h);                      // going to bed
  };
  const lateAt = (h: number) => {
    const t = h < 12 ? h + 24 : h;                       // one axis across midnight
    if (t < 21.5) return 0;
    if (t < 23) return ramp(21.5, 23, t);                // the ones who stay up
    if (t < 28) return 1;                                // …until four
    return 1 - ramp(28, 31, t);                          // gone by seven
  };
  const setWindows = (hourF: number) => {
    const e = eveAt(hourF), l = lateAt(hourF);
    for (const m of eveMats) m.opacity = e;
    for (const m of lateMats) m.opacity = l;
  };

  const placeBld = (side: number, z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const gh = bandOf(b);
    const dep = depthOf(b.nm || 'res'), cx = side * (FACE + dep / 2);
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = shellMats(side < 0 ? 0 : 1, facade, dep, h, b.w, b.brick, gh, true, roofM);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(dep, h, b.w), mats);
    // WHICH WAY THIS SHELL FACES. A BoxGeometry carries width/depth in world
    // axes and nothing that says which of them is the DEPTH — that depends on
    // whether the shell fronts the main street or a cross street, and only the
    // placer knows. Inferring it from position outside this file misreads the
    // alley's end wall and the bodega's corner block (notes/D-alley-report.md),
    // so the fact is published instead of guessed. Same reasoning as
    // userData.mod: whoever knows, says.
    //
    // 'x' means the facade's normal runs along x, so the shell's DEPTH is its
    // x extent. Only real shells carry it, which is what lets a checker tell a
    // building from a wall without a list of exceptions.
    wall.userData.facing = 'x';
    wall.position.set(cx, h / 2 + gh, cz);
    scene.add(wall);
    litSheets(b, b.w, h, side * FACE, h / 2 + gh, cz,
      side < 0 ? Math.PI / 2 : -Math.PI / 2, -side, 0);
    // MOVED ABOVE THE PAINTER, and it has to stay there. shopfrontRelief
    // registers where this frontage is in the world, and the painter needs
    // that registration to resolve the door position the ROOM declared —
    // paint first and it has nothing to resolve against, so the facade
    // quietly falls back to its own guess. Also adds the projecting mouldings;
    // nothing there projects past the 0.30 m solid() already reserves, so it
    // adds no collision. The walk-up (b.res) has a doorcase, not a shopfront.
    if (!b.res) shopfrontRelief({
      scene, name: b.nm, wMeters: b.w, trim: b.col,
      x: side * FACE, z: cz, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
    });
    const shopM = flat(
      b.res ? resGroundTex(b.brick, b.w)
        : b.front === 'burger' ? burgerFront(b.brick, b.w)
          : b.front === 'pawn' ? pawnFront(b.brick, b.w)
            : b.front === 'tax' ? taxFront(b.brick, b.w)
              : shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = shellMats(side < 0 ? 0 : 1, shopM, dep, gh, b.w, b.brick, 0, false, roofM);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(dep, gh, b.w), shopMats);
    shop.position.set(cx, gh / 2, cz);
    scene.add(shop);
    roofKit(cx, cz, dep, b.w, gh + h, b.nm || 'res');
    // collision follows the real footprint, not a fixed 8 m guess
    solid(side < 0
      ? { minX: -FACE - dep, maxX: -FACE + CUSH, minZ: cz - b.w / 2, maxZ: cz + b.w / 2 }
      : { minX: FACE - CUSH, maxX: FACE + dep, minZ: cz - b.w / 2, maxZ: cz + b.w / 2 });
  };
  // ── civic stone ─────────────────────────────────────────────────────────
  //
  // The library and the church live in `ct/civic.ts` — they share no
  // vocabulary with the shopfront system below (ashlar not brick, arches not
  // rectangles, cut letters not painted bands, real depth in the silhouette)
  // and splitting them off lets a second builder work them without touching
  // this file. street.ts still owns WHERE they stand; civic.ts owns what
  // they look like.
  const { placeLibrary, placeChurch } = buildCivic({ scene, flat, KERB_H });
  // ── how deep a building is ──────────────────────────────────────────────
  //
  // Every shell on the block was 3.4 m deep. That is a corridor, not a
  // building, and it is the "fake building" complaint: a real commercial block
  // is 15-30 m. It never showed while the street was an unbroken wall on both
  // sides and you never saw a return — it shows everywhere now the park, the
  // car lot, the alley and the church have opened the block up.
  //
  // Depth VARIES per building, hashed off the name so it is deterministic and
  // so the backs are not a second flat wall 20 m behind the first. A block
  // where every mass is the same depth is its own kind of fake.
  //
  // METRES CLAIMED, so E and C can plan against them (see notes/BLOCKED-D.md):
  //   west shells  x -7 … -30.5 at the deepest      park back wall is x -14
  //   east shells  x  7 …  30.5 at the deepest      lot  back wall is x  15
  // The two sites sit in z-gaps in those runs, so nothing overlaps — but if E
  // or C wants a site as deep as the block around it, the room is there and
  // this is the number to match.
  const depthOf = (nm: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < nm.length; i++) h = Math.imul(h ^ nm.charCodeAt(i), 0x01000193) >>> 0;
    return 14 + ((h >>> 9) % 6) * 1.9;               // 14 … 23.5 m
  };

  // ── what you now see on top ─────────────────────────────────────────────
  //
  // Deep buildings mean you see their ROOFS — from the park, from the car lot,
  // from the alley, from anywhere the block has been opened. A 20 m slab of
  // flat colour up there is worse than the 3.4 m corridor was, so every shell
  // gets the things that are actually on a roof: a parapet standing above the
  // deck, a stair bulkhead, a water tank on legs, and a vent or two. Placed
  // deterministically off the name so the skyline varies without jittering.
  const roofKit = (cx: number, cz: number, dx: number, dz: number, top: number, nm: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < nm.length; i++) h = Math.imul(h ^ nm.charCodeAt(i), 0x01000193) >>> 0;
    const r = () => { h = Math.imul(h ^ 0x9e3779b1, 0x01000193) >>> 0; return (h >>> 8) / 0xffffff; };
    const deckM = new THREE.MeshBasicMaterial({ color: 0x33343a });
    const wallM = new THREE.MeshBasicMaterial({ color: 0x6b5f52 });
    const tankM = new THREE.MeshBasicMaterial({ color: 0x5a4632 });
    // parapet: a low upstand round the deck, which is what gives a roofline
    // its edge instead of letting the wall just stop
    for (const [px, pz, sx, sz] of [
      [cx, cz - dz / 2 + 0.15, dx, 0.3], [cx, cz + dz / 2 - 0.15, dx, 0.3],
      [cx - dx / 2 + 0.15, cz, 0.3, dz], [cx + dx / 2 - 0.15, cz, 0.3, dz],
    ] as [number, number, number, number][]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.62, sz), wallM);
      p.position.set(px, top + 0.31, pz);
      scene.add(p);
    }
    // stair bulkhead — every flat roof has one, it is how you get out there
    const bw = 2.2 + r() * 1.2, bd = 2.0 + r() * 1.0;
    const bulk = new THREE.Mesh(new THREE.BoxGeometry(bw, 2.4, bd), deckM);
    bulk.position.set(cx + (r() - 0.5) * (dx - bw - 1.2), top + 1.2, cz + (r() - 0.5) * (dz - bd - 1.2));
    scene.add(bulk);
    // a timber water tank on legs, if the roof is big enough to hold one
    if (dx > 12 && dz > 8) {
      const tx = cx + (r() - 0.5) * (dx - 4), tz2 = cz + (r() - 0.5) * (dz - 4);
      for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]] as [number, number][]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), tankM);
        leg.position.set(tx + lx, top + 0.95, tz2 + lz);
        scene.add(leg);
      }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.3, 9), tankM);
      tank.position.set(tx, top + 3.05, tz2);
      scene.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.6, 9), new THREE.MeshBasicMaterial({ color: 0x3f3a33 }));
      cap.position.set(tx, top + 4.5, tz2);
      scene.add(cap);
    }
    // vents
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), deckM);
      v.position.set(cx + (r() - 0.5) * (dx - 2), top + 0.35, cz + (r() - 0.5) * (dz - 2));
      scene.add(v);
    }
  };

  // ── flanks: a return is made of what the building is made of ────────────
  //
  // `endM` was ONE flat brown — 0x53382e — on the sides, ends and returns of
  // every building on the block, whatever its front was made of. So the bank's
  // pale precast front met a brown brick flank and the corner read as a stage
  // flat with something else propped up behind it.
  //
  // A blind party wall IS correct: a flank does not want the front's windows,
  // its glazing or its sign. What it must not be is a different MATERIAL. So
  // the flank is derived from the same `brick` the front is painted from, at
  // the same masonry density, phased off the same world-Y course grid — and
  // every building gets its own instead of sharing a constant.
  //
  // Same family as the two patterns already fixed: one masonry density for the
  // world, one authoring of the door position. The defect is always the same
  // fact decided twice, or decided once and applied where it does not belong.
  // ── ONE party-wall painter, for every exposed return on the block ───────
  //
  // Opening the park, the car lot, the alley and the churchyard exposed a lot
  // of flanks that were never meant to be seen, and they all read as freshly
  // built blank brick — which is the "fake building" complaint again, one
  // surface further round. A flank that nobody was meant to see is not blank.
  // It carries what it was built against:
  //
  //   the SCAR      the demolished neighbour's roofline, stepped down the
  //                 wall, drawn as the LIGHTER area rather than as a line —
  //                 brick that spent decades sheltered is cleaner than brick
  //                 that spent them in the weather, so the ghost is the clean
  //                 part, not a stripe
  //   BREASTS       the chimneys they shared, shallow pilasters dying at the
  //                 old roofline
  //   BLOCKED-UP    windows bricked shut when they stopped facing a room and
  //                 started facing the street, in their own course rhythm
  //                 with the cill left proud
  //
  // This used to exist TWICE — here for the buildings and again inside
  // openSite for the park's and the lot's walls, which is how the two drifted
  // (the sites had the marks and the buildings did not). One painter now.
  //
  // Everything is hashed off `salt`, so two flanks of one building do not
  // wear identical scars, and none of it touches rnd() (GOTCHAS §2).
  const partyWallTex = (
    brick: string, wM: number, hM: number, baseY: number, cope: boolean, salt: number,
  ) => {
    const ms = masonry(wM, hM, baseY);
    let hh = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    const mark = (n: number) => {
      hh = Math.imul(hh ^ (hh >>> 15), 0x2c1b3c6d) >>> 0;
      return (hh >>> 9) % Math.max(1, n);
    };
    return ms.paint((g) => {
      g.fillStyle = brick; g.fillRect(0, 0, ms.W, ms.H);
      ms.courses(g);
      const steps = 2 + mark(3);
      const ridge = ms.m(hM * (0.50 + mark(4) * 0.06));
      let x = 0;
      for (let i = 0; i <= steps; i++) {
        const x1 = Math.round(ms.W * ((i + 1) / (steps + 1)));
        const top = ridge + ms.m((mark(5) - 2) * 0.55);
        g.fillStyle = 'rgba(214,198,170,0.12)';
        g.fillRect(x, top, x1 - x, ms.H - top);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(x, top, x1 - x, Math.max(1, ms.m(0.09)));
        x = x1;
      }
      const breasts = 1 + mark(3);
      for (let i = 0; i < breasts; i++) {
        const bx = ms.m(1.5) + mark(Math.max(1, Math.round(wM - 3))) * ms.ppm;
        const bw = ms.m(0.9 + mark(3) * 0.3);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(bx, ridge, bw, ms.H - ridge);
        g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(bx + bw, ridge, Math.max(1, ms.m(0.12)), ms.H - ridge);
      }
      const blocked = 1 + mark(4);
      for (let i = 0; i < blocked; i++) {
        const wx = ms.m(1.2) + mark(Math.max(1, Math.round(wM - 3))) * ms.ppm;
        const wy = ridge + ms.m(1.0) + mark(4) * ms.m(1.4);
        const ww = ms.m(1.1), wh = ms.m(1.4);
        if (wy + wh > ms.H - ms.m(0.5) || wx + ww > ms.W) continue;
        g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        g.fillStyle = 'rgba(168,140,112,0.45)'; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(0,0,0,0.15)';
        for (let c = 0; c < 6; c++) g.fillRect(wx, wy + Math.round((c * wh) / 6), ww, 1);
        g.fillStyle = '#9a8a72'; g.fillRect(wx - 1, wy + wh, ww + 2, Math.max(1, ms.m(0.14)));
      }
      // weather, PER METRE. It was a flat 14 per wall, so a 32 m park flank
      // got the same fourteen streaks as a 6 m shop return.
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < Math.max(6, Math.round(wM * 1.1)); i++) {
        g.fillRect((i * 37) % ms.W, 0, 2, Math.round(ms.H * ((i % 5) / 6)));
      }
      if (cope) {                                             // only where it IS the top
        g.fillStyle = '#8a7a62'; g.fillRect(0, 0, ms.W, ms.m(0.5));
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, ms.m(0.5), ms.W, ms.m(0.16));
      }
      dither(g, ms.W, ms.H, Math.round(wM * hM * 5));
    });
  };
  const flankSalt = (brick: string, wM: number, hM: number) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < brick.length; i++) h = Math.imul(h ^ brick.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ Math.round(wM * 8), 0x01000193) >>> 0;
    return Math.imul(h ^ Math.round(hM * 8), 0x01000193) >>> 0 >>> 16;
  };
  const flankTex = (brick: string, wM: number, hM: number, baseY: number, cope: boolean) =>
    partyWallTex(brick, wM, hM, baseY, cope, flankSalt(brick, wM, hM));
  /** the six materials of a shell: its front where the front goes, and its own
   *  masonry on every side and return. `fi` is the BoxGeometry face index the
   *  facade belongs on (0 +x, 1 -x, 4 +z, 5 -z). */
  const shellMats = (
    fi: number, facade: THREE.Material, dx: number, dy: number, dz: number,
    brick: string, baseY: number, cope: boolean, roofM: THREE.Material,
  ) => {
    const xt = flat(flankTex(brick, dz, dy, baseY, cope));    // the +-x faces span z
    const zt = flat(flankTex(brick, dx, dy, baseY, cope));    // the +-z faces span x
    const m: THREE.Material[] = [xt, xt, roofM, roofM, zt, zt];
    m[fi] = facade;
    return m;
  };

  // ── open sites ──────────────────────────────────────────────────────────
  //
  // A hole in the street wall — the park, and now the used car lot. They are
  // the same object: a piece of frontage given up, with ground you can walk
  // on, the neighbours' newly exposed party walls finished off, and a rear
  // elevation so the gap opens onto a city instead of onto fog. What goes IN
  // them is somebody else's file (the park is E's ct/park.ts, the lot is C's
  // ct/lot.ts) exactly the way the library and the church are.
  //
  // One builder, not two, because the second site would otherwise be the same
  // sixty lines with the signs flipped — and the mistakes worth making once
  // are the ones already commented here.
  //
  // `side` is -1 for the west run and +1 for the east, and every x below is
  // written through it so neither case is a special case.
  interface Site { minX: number; maxX: number; minZ: number; maxZ: number; y: number }
  const openSite = (
    side: -1 | 1, z: number, w: number,
    o: { depth: number; ground: string; grain: string; back: string; flank: string; gate: number },
  ): Site => {
    const XB = side * FACE, XF = XB + side * o.depth;       // street edge, back
    const z0 = z - w, z1 = z;
    const lo = Math.min(XF, XB), hi = Math.max(XF, XB);
    // the ground. A PLANE at exactly KERB_H that ABUTS the walk rather than
    // overlapping it — two coplanar tops z-fight (GOTCHAS §6).
    const groundT = declareSurface(pixTex(64, 64, (g) => {
      g.fillStyle = o.ground; g.fillRect(0, 0, 64, 64);
      g.fillStyle = o.grain;
      for (let i = 0; i < 90; i++) g.fillRect((i * 23) % 64, (i * 41) % 64, 2, 1);
      for (let i = 0; i < 60; i++) g.fillRect((i * 17) % 64, (i * 29) % 64, 1, 1);
      dither(g, 64, 64, 260);
    }), 'ground');
    groundT.wrapS = groundT.wrapT = THREE.RepeatWrapping;
    groundT.repeat.set(o.depth / 2, w / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(o.depth, w), wet(flat(groundT)));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((XF + XB) / 2, KERB_H, (z0 + z1) / 2);
    scene.add(floor);
    // the two party walls the site has just exposed, given a finished face.
    // masonry() phases its courses off world Y, so they run level with the
    // brick on the street elevation either side instead of starting again —
    // which is the difference between a party wall and the raw end of a shell.
    // A party wall is not a wall somebody built. It is the side of a building
    // that used to have another building against it, and everything on it is
    // evidence of the one that went: the stepped scar where its roof ran, the
    // chimney breasts that were shared, the windows bricked up when they
    // stopped facing a room and started facing the street.
    //
    // This mattered much less when these sites were 7 and 8 m deep. At 32 m
    // and 23 m a blank flank is most of what you see from inside, and 32 m of
    // unmarked brick reads as a prison yard rather than as a hole in a block.
    //
    // `mark` is a deterministic hash off the site so the two flanks of one
    // site do not wear identical scars.
    const wallTex = (wM: number, hM: number, brick: string, salt: number) =>
      partyWallTex(brick, wM, hM, 0, true, salt);
    const fh = wallHeight(4);
    for (const [zAt, ry] of [[z1 - 0.01, Math.PI], [z0 + 0.01, 0]] as [number, number][]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(o.depth, fh), flat(wallTex(o.depth, fh, o.flank, ry > 1 ? 3 : 7)));
      p.position.set((XF + XB) / 2, fh / 2, zAt);
      p.rotation.y = ry;
      scene.add(p);
    }
    // the back of the site, so the gap opens onto a city and not onto fog
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, fh), flat(wallTex(w, fh, o.back, 11)));
    back.position.set(XF - side * 0.01, fh / 2, (z0 + z1) / 2);
    back.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(back);
    solid(side < 0
      ? { minX: XF - 8, maxX: XF, minZ: z0, maxZ: z1 }
      : { minX: XF, maxX: XF + 8, minZ: z0, maxZ: z1 });
    // a low boundary along the street line with the middle left open, so the
    // site has an edge rather than bleeding into the pavement.
    //
    // IT SITS INSIDE THE SITE, not on the pavement. It used to be centred at
    // `XB - side * 0.18`, i.e. straddling the street line with half its
    // thickness — the whole 0.36 m, once the collider rounded outward — lying
    // in the walk, for the entire length of both runs on both sites.
    //
    // Builder C measured it rather than arguing it (notes/C-frontage.md,
    // scripts/lot-frontage.mjs): the clear band past the lot read 1.30 m
    // against a 1.54 m control on the same walk with no lot on it, and the
    // script named this wall as the overlap, twice, reaching 0.36 m in. That
    // is 18 % of the sacred 2 m (GOTCHAS §9) taken the whole way along, and
    // the park shares this helper so it was paying it twice over.
    //
    // A boundary belongs on its own land. `XB + side * 0.18` puts the face
    // flush with the street line and the body behind it, which is also what
    // C's own module already does — "everything this module builds is at
    // x >= 7.18".
    const railM = new THREE.MeshBasicMaterial({ color: 0x6d6455 });
    for (const [rz0, rz1] of [[z0 + 0.3, z0 + w * o.gate], [z1 - w * o.gate, z1 - 0.3]] as [number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, rz1 - rz0), railM);
      wall.position.set(XB + side * 0.18, KERB_H + 0.31, (rz0 + rz1) / 2);
      scene.add(wall);
      solid({ minX: Math.min(XB, XB + side * 0.36), maxX: Math.max(XB, XB + side * 0.36), minZ: rz0, maxZ: rz1 });
    }
    return { minX: lo, maxX: hi, minZ: z0, maxZ: z1, y: KERB_H };
  };
  // 30 m of the west side, where BARBER and GROCERY stood. Contents: E, in
  // ct/park.ts.
  //
  // DEEP — 32 m, not the 7 it opened with. The shells either side of it now run
  // 14–23.5 m back, and a 7 m yard between them read as a notch cut in a solid
  // block rather than as a park. These are the same metres the building-depth
  // item claims, and where the two want the same ground the open space wins:
  // a shallow park reads as a gap, whereas a building 18 m deep instead of 24
  // reads as a building. At 32 m its back wall is at x -39, clear of the
  // deepest shell on this side (x -30.5), so nothing is actually contested.
  let PARK: Site = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, y: KERB_H };
  const placePark = (z: number, w: number) => {
    PARK = openSite(-1, z, w, {
      depth: 32.0, ground: '#6a6f58', grain: '#5c6249', back: '#6b4034', flank: '#835444', gate: 0.36,
    });
  };
  // 23.2 m of the east side, where CAFE and HARDWARE stood. Contents — the
  // surfacing, the fence, the office, the signage and the stock — are C's, in
  // ct/lot.ts. A car lot is deeper than a park because it has to hold cars,
  // and its ground is broken asphalt rather than grass.
  let LOT: Site = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, y: KERB_H };
  const placeLot = (z: number, w: number) => {
    LOT = openSite(1, z, w, {
      depth: w, ground: '#4a4c50', grain: '#3e4044', back: '#5c4436', flank: '#6b4034', gate: 0.3,
    });
  };
  // ── the bank ────────────────────────────────────────────────────────────
  //
  // LAUNDRY and MERIDIAN merged: 9.2 + 10 = 19.2 m, so the run before the
  // alley still totals 51.2 and nothing is paid for out of a neighbour.
  // MERIDIAN was the corporation — bland, modern, standing next to the
  // library on purpose — and a branch bank does that job better, so this
  // settles the corporation slot too.
  //
  // It is NOT a shopfront, and the difference is the point. No brick, no
  // awning, no painted fascia: precast panel and polished granite, deep-set
  // windows with bronze frames, applied metal letters with a drop shadow, an
  // ATM in the wall. Dimensions are declared in METRES and converted once,
  // which is A's convention on the shopfront painters — the ground band still
  // uses masonry() at SHOP_MULT so its course datum is the same world grid as
  // every other band on the block and the two neighbours line up with it.
  //
  // It also stands beside the LIBRARY, the other stone building on this side,
  // and must not read as the same institution. The library is warm worn
  // ashlar with arched openings and forty years of soot; the bank is cool
  // grey precast, dead flat, square-headed, and looks like it was cleaned
  // last year.
  const BANK_STONE = '#9a9ca0', BANK_DARK = '#7c7f85', BANK_LIGHT = '#b3b5b8';
  const BANK_GRANITE = '#4e5358', BANK_BRONZE = '#7a6a44';
  const bankBand = (wM: number) => {
    const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
    const { W, H, ppm } = surf;
    const m = (v: number) => Math.round(v * ppm);
    return surf.paint((g) => {
      g.fillStyle = BANK_STONE; g.fillRect(0, 0, W, H);
      // precast panels: wide bays with a recessed joint, NOT brick courses
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let x = 0; x <= W; x += m(2.4)) g.fillRect(x, 0, Math.max(1, m(0.05)), H);
      g.fillStyle = 'rgba(255,255,255,0.1)';
      for (let x = 0; x <= W; x += m(2.4)) g.fillRect(x + Math.max(1, m(0.05)), 0, 1, H);
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, m(0.5), W, Math.max(1, m(0.06)));  // one shadow line
      // polished granite plinth
      g.fillStyle = BANK_GRANITE; g.fillRect(0, H - m(0.62), W, m(0.62));
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, H - m(0.62), W, Math.max(1, m(0.06)));
      // deep-set windows: a dark reveal, bronze frame, blinds half down
      const win = (cx: number, wWin: number) => {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(cx - m(wWin / 2) - m(0.14), m(1.28), m(wWin) + m(0.28), m(2.1) + m(0.14));
        g.fillStyle = BANK_BRONZE;
        g.fillRect(cx - m(wWin / 2), m(1.36), m(wWin), m(2.1));
        g.fillStyle = '#26303a';
        g.fillRect(cx - m(wWin / 2) + m(0.1), m(1.46), m(wWin) - m(0.2), m(1.9));
        g.fillStyle = '#9aa2a8';                                   // venetian blinds, half down
        for (let y = m(1.5); y < m(2.5); y += Math.max(2, m(0.13))) {
          g.fillRect(cx - m(wWin / 2) + m(0.1), y, m(wWin) - m(0.2), Math.max(1, m(0.05)));
        }
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(cx - m(wWin / 2) + m(0.1), m(1.46), m(0.25), m(1.9));
        g.fillStyle = BANK_LIGHT;                                   // sill
        g.fillRect(cx - m(wWin / 2) - m(0.1), m(3.46), m(wWin) + m(0.2), m(0.12));
      };
      win(Math.round(W * 0.18), 2.2);
      win(Math.round(W * 0.82), 2.2);
      // applied metal letters — a shadow under each, no painted band
      g.font = `bold ${m(0.5)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText('FIRST FEDERAL', W / 2 + m(0.06), m(0.78) + m(0.06));
      g.fillStyle = '#c9ccd0'; g.fillText('FIRST FEDERAL', W / 2, m(0.78));
      // the ATM, which is very 1997, with its own little hood
      const ax = Math.round(W * 0.36);
      g.fillStyle = BANK_GRANITE; g.fillRect(ax - m(0.5), m(1.5), m(1.0), m(1.5));
      g.fillStyle = '#1c2026'; g.fillRect(ax - m(0.38), m(1.66), m(0.76), m(0.72));
      g.fillStyle = '#3f6a4a'; g.fillRect(ax - m(0.3), m(1.74), m(0.6), m(0.42));   // green CRT
      g.fillStyle = '#8a8e94'; g.fillRect(ax - m(0.3), m(2.48), m(0.6), m(0.16));   // keypad
      g.fillStyle = BANK_LIGHT; g.fillRect(ax - m(0.58), m(1.38), m(1.16), m(0.14)); // hood
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ax - m(0.58), m(1.52), m(1.16), m(0.1));
      // night depository, plaque, camera
      const nx = Math.round(W * 0.62);
      g.fillStyle = BANK_GRANITE; g.fillRect(nx - m(0.24), m(2.0), m(0.48), m(0.62));
      g.fillStyle = '#16181c'; g.fillRect(nx - m(0.16), m(2.12), m(0.32), m(0.1));
      g.fillStyle = BANK_BRONZE; g.fillRect(nx + m(0.4), m(2.0), m(0.3), m(0.42));   // plaque
      g.fillStyle = '#2a2c30'; g.fillRect(Math.round(W * 0.28), m(0.28), m(0.22), m(0.16)); // camera
      dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
    });
  };
  const bankWall = (wM: number, hM: number, floors: number) => {
    const surf = masonry(wM, hM, SHOP_BAND_H);
    const { W, H, ppm } = surf;
    const m = (v: number) => Math.round(v * ppm);
    return surf.paint((g) => {
      g.fillStyle = BANK_STONE; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.15)';                       // precast panel joints
      for (let x = 0; x <= W; x += m(2.4)) g.fillRect(x, 0, Math.max(1, m(0.05)), H);
      for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(0, y, W, Math.max(1, m(0.05)));
      g.fillStyle = 'rgba(255,255,255,0.09)';
      for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(0, y + Math.max(1, m(0.05)), W, 1);
      const cols = Math.max(2, Math.floor(wM / 2.4));
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const cx = Math.round(W * (c + 0.5) / cols);
          const y = m(0.7) + f * m(FLOOR_M);
          g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(cx - m(0.78), y - m(0.08), m(1.56), m(1.42));
          g.fillStyle = BANK_BRONZE; g.fillRect(cx - m(0.7), y, m(1.4), m(1.26));
          g.fillStyle = '#2b343d'; g.fillRect(cx - m(0.62), y + m(0.08), m(1.24), m(1.1));
          g.fillStyle = 'rgba(160,180,200,0.18)'; g.fillRect(cx - m(0.62), y + m(0.08), m(0.4), m(1.1));
          g.fillStyle = BANK_LIGHT; g.fillRect(cx - m(0.78), y + m(1.26), m(1.56), m(0.1));
        }
      }
      g.fillStyle = BANK_DARK; g.fillRect(0, 0, W, m(0.55));          // flat capping, no cornice
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, m(0.55), W, Math.max(1, m(0.08)));
      dither(g, W, H, Math.round(wM * hM * 3));
    });
  };
  const placeBank = (z: number, w: number) => {
    const cz = z - w / 2, floors = 4, h = wallHeight(floors);
    const dep = depthOf('FIRST FEDERAL'), cx = -(FACE + dep / 2);
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    // THE REPORTED DEFECT. The bank's front is pale precast and its returns
    // were the block's brown brick, so it read as a stage flat. bankWall with
    // floors = 0 is the same panel, the same joints and the same palette with
    // no windows in it — which is what a blind precast return actually is.
    // THE RETURN, and it is a DECISION rather than a leftover.
    //
    // The complaint, twice: the front is a pale precast panel system with a
    // regular window grid and the return was flat brick with nothing in it —
    // not the wrong shade, a different building, two materials meeting at a
    // sharp arris with nothing reconciling them.
    //
    // A blind flank IS real. Buildings do have windowless sides where they
    // expected a neighbour. But it has to look like a party wall, and the
    // strongest answer for a bank on a corner is the one real banks of the
    // period use: CARRY THE FRONT ROUND THE FIRST BAY, then let it become a
    // party wall behind that. The corner stays architecture; the depth of the
    // site admits it was never meant to be seen.
    //
    // One texture, not two meshes: the transition IS the drawing. The bay is
    // the same `bankWall` panel, joints, capping and window rhythm the FRONT
    // is painted from — derived from that spec, never from a shared constant.
    const BANK_PARTY = '#7d5140';        // cheaper, duller, NOT the block brick
    const BAY_M = 3.2;
    const bankReturn = (depM: number, hM: number, streetAt: 'left' | 'right') => {
      const surf = masonry(depM, hM, SHOP_BAND_H);
      const { W, H, ppm } = surf;
      const m = (v: number) => Math.round(v * ppm);
      const bayW = Math.min(m(BAY_M), Math.round(W * 0.45));
      const bx = streetAt === 'right' ? W - bayW : 0;   // +z face reads +x; -z reads -x
      return surf.paint((g) => {
        // ── behind the bay: a party wall nobody was meant to see ──────────
        g.fillStyle = BANK_PARTY; g.fillRect(0, 0, W, H);
        surf.courses(g);
        // tar ghosts — the roofline of what stood against it, painted over
        g.fillStyle = 'rgba(30,24,20,0.28)';
        const ghost = m(hM * 0.46);
        g.fillRect(streetAt === 'right' ? 0 : bayW, ghost, W - bayW, H - ghost);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(streetAt === 'right' ? 0 : bayW, ghost, W - bayW, Math.max(1, m(0.14)));
        // a painted sign that has almost gone, the way they do
        g.fillStyle = 'rgba(214,198,170,0.10)';
        g.fillRect(streetAt === 'right' ? m(0.8) : bayW + m(0.8), ghost + m(1.4), Math.max(2, W - bayW - m(1.6)), m(1.9));
        // weather, per metre, heaviest at the top where it runs off
        g.fillStyle = 'rgba(0,0,0,0.17)';
        for (let i = 0; i < Math.max(6, Math.round(depM * 1.2)); i++) {
          g.fillRect((i * 37) % W, 0, 2, Math.round(H * (0.25 + ((i % 5) / 6))));
        }
        // NO capping across the party wall. That is the tell: a cornice costs
        // money and nobody spends it on a face that was going to be buried.
        // ── the bay: the front, turning the corner ────────────────────────
        g.fillStyle = BANK_STONE; g.fillRect(bx, 0, bayW, H);
        g.fillStyle = 'rgba(0,0,0,0.15)';                      // the same panel joints
        for (let x = bx; x <= bx + bayW; x += m(2.4)) g.fillRect(x, 0, Math.max(1, m(0.05)), H);
        for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(bx, y, bayW, Math.max(1, m(0.05)));
        g.fillStyle = 'rgba(255,255,255,0.09)';
        for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(bx, y + Math.max(1, m(0.05)), bayW, 1);
        // ONE window per floor, on the front's own rhythm and sill line, so
        // the grid genuinely continues round the corner instead of restarting
        const cx = bx + Math.round(bayW / 2);
        for (let f = 0; f < 4; f++) {
          const y = m(0.7) + f * m(FLOOR_M);
          g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(cx - m(0.78), y - m(0.08), m(1.56), m(1.42));
          g.fillStyle = BANK_BRONZE; g.fillRect(cx - m(0.7), y, m(1.4), m(1.26));
          g.fillStyle = '#2b343d'; g.fillRect(cx - m(0.62), y + m(0.08), m(1.24), m(1.1));
          g.fillStyle = 'rgba(160,180,200,0.18)'; g.fillRect(cx - m(0.62), y + m(0.08), m(0.4), m(1.1));
          g.fillStyle = BANK_LIGHT; g.fillRect(cx - m(0.78), y + m(1.26), m(1.56), m(0.1));
        }
        // the capping returns over the bay ONLY, and stops dead
        g.fillStyle = BANK_DARK; g.fillRect(bx, 0, bayW, m(0.55));
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx, m(0.55), bayW, Math.max(1, m(0.08)));
        // the arris itself: a shadow where precast meets brick, so the change
        // reads as two materials meeting and not as a seam in one
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.fillRect(streetAt === 'right' ? bx - Math.max(1, m(0.07)) : bx + bayW, 0, Math.max(1, m(0.07)), H);
        dither(g, W, H, Math.round(depM * hM * 4));
      });
    };
    // the BACK is party wall all the way — no bay, nobody turns that corner
    const bankFlank = (wM: number, hM: number) => flat(bankReturn(wM, hM, 'right'));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(dep, h, w),
      [flat(bankWall(w, h, floors)), bankFlank(w, h), roofM, roofM,
        flat(bankReturn(dep, h, 'right')),      // +z face: u runs with +x, street is at max
        flat(bankReturn(dep, h, 'left'))]);     // -z face: u runs with -x, street is at min
    wall.userData.facing = 'x';        // the bank fronts the main street
    wall.position.set(cx, h / 2 + SHOP_BAND_H, cz);
    scene.add(wall);
    const band = new THREE.Mesh(new THREE.BoxGeometry(dep, SHOP_BAND_H, w),
      [flat(bankBand(w)), bankFlank(w, SHOP_BAND_H), roofM, roofM,
        flat(bankReturn(dep, SHOP_BAND_H, 'right')), flat(bankReturn(dep, SHOP_BAND_H, 'left'))]);
    band.position.set(cx, SHOP_BAND_H / 2, cz);
    scene.add(band);
    solid({ minX: -FACE - dep, maxX: -FACE + 0.3, minZ: cz - w / 2, maxZ: cz + w / 2 });
    // A recessed entrance, because a bank door is not a glass hole in a band.
    // Same trick as the bodega's canted bay: the leaf sits back behind the
    // wall line and the reveal is boxed in, so the opening has a shadow.
    const DW = 1.9, DH = 2.6, DREC = 0.30;
    const XF = -FACE;
    const doorT = declareSurface(pixTex(60, 82, (g) => {
      g.fillStyle = BANK_BRONZE; g.fillRect(0, 0, 60, 82);
      g.fillStyle = '#232a31'; g.fillRect(5, 5, 22, 58); g.fillRect(33, 5, 22, 58);
      g.fillStyle = 'rgba(170,190,210,0.16)'; g.fillRect(7, 7, 7, 54); g.fillRect(35, 7, 7, 54);
      g.fillStyle = BANK_BRONZE; g.fillRect(28, 0, 4, 82);            // meeting stile
      g.fillStyle = '#c9b07a'; g.fillRect(24, 30, 3, 20); g.fillRect(33, 30, 3, 20);  // pull handles
      g.fillStyle = '#3a4048'; g.fillRect(0, 66, 60, 16);             // kick rail
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, 66, 60, 1);
    }), 'detail');
    // The surround PROJECTS and the leaf sits flush behind it, rather than the
    // leaf being set back into a solid wall — a band box is opaque, so a door
    // buried behind it is just a hole with nothing in it. Three granite pieces
    // make a portal: two jambs and a head, standing 0.30 m proud, which is
    // exactly the cushion the footprint already reserves so it takes no
    // pavement. The depth of those three is what casts the shadow.
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), flat(doorT));
    leaf.position.set(XF + 0.02, DH / 2, cz);
    leaf.rotation.y = Math.PI / 2;
    scene.add(leaf);
    const graniteM = new THREE.MeshBasicMaterial({ color: 0x4e5358 });
    for (const sg of [-1, 1]) {
      const jb = new THREE.Mesh(new THREE.BoxGeometry(DREC, DH + 0.42, 0.46), graniteM);
      jb.position.set(XF + DREC / 2 - 0.01, (DH + 0.42) / 2, cz + sg * (DW / 2 + 0.23));
      scene.add(jb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(DREC, 0.42, DW + 0.92), graniteM);
    head.position.set(XF + DREC / 2 - 0.01, DH + 0.21, cz);
    scene.add(head);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(DREC + 0.06, 0.14, DW + 1.16),
      new THREE.MeshBasicMaterial({ color: 0x6a6f75 }));
    lintel.position.set(XF + DREC / 2 + 0.01, DH + 0.49, cz);
    scene.add(lintel);
  };
  let zw = 14.2;
  for (const b of WEST) {
    if (b === 'alley') { zw = AZ1; continue; }
    if (b === 'park') { placePark(zw, 30); zw -= 30; continue; }
    if (b === 'bank') { placeBank(zw, 19.2); zw -= 19.2; continue; }
    if (b.kind === 'library') { const m = scene.children.length; placeLibrary(zw, b); stampFrom(m, 'civic'); }
    else placeBld(-1, zw, b);
    zw -= b.w;
  }
  // The church stands on the main block now, and `placeChurch` builds along +x
  // with its facade on +z — the side-street axis it was authored for. Rather
  // than ask E to parameterise that (ct/civic.ts is E's), the church is built
  // into a GROUP and the group is turned: `buildCivic` only ever calls
  // scene.add and registers nothing, so a Group is a perfectly good scene, and
  // the transform is arithmetic on my side of the line.
  //
  // rotation.y = -π/2 sends local +x → world +z and local +z → world -x. So
  // the nave runs down the block from `z - b.w` to `z`, and the facade — local
  // +z, 1.7 out from the group origin — lands on x = FACE looking west across
  // the street, exactly where placeBld puts an east shopfront.
  const placeChurchEast = (z: number, b: BldSpec) => {
    const g = new THREE.Group();
    buildCivic({ scene: g as unknown as THREE.Scene, flat, KERB_H }).placeChurch(0, 0, b);
    g.rotation.y = -Math.PI / 2;
    g.position.set(FACE + 1.7, 0, z - b.w);
    g.traverse((n) => { if (!n.userData.mod) n.userData.mod = 'civic'; });
    scene.add(g);
    // NO blanket footprint here any more. This used to be
    //
    //     solid({ minX: FACE - 0.3, maxX: FACE + 8, minZ: z - b.w, maxZ: z });
    //
    // one box over the whole frontage, written when the church WAS a plain
    // slab and had no colliders of its own. The church is inlaid now and
    // ct/civic.ts registers the real thing — the nave, the tower and the
    // churchyard walls — so this box was doing nothing except sealing the
    // churchyard shut, exactly the way the old blanket wall sealed E's
    // library courtyard. Same mistake, same shape, second time.
    //
    // WALKED, not assumed, because this is the collider whose removal made
    // the church walk-through once before (E's patch note, and my own
    // handoff). Along the whole frontage, walking east off the pavement:
    //
    //     z -88 … -62   held at x 6.26 … 6.59   the churchyard wall
    //     z -80         in, to x 9.23           the GATE, which is the point
    //     from inside, east   stopped at x 9.24 the nave is still solid
    //     from inside, west   back out to the street
    //     eye height 1.62 everywhere, in and out — no floor hole at the gate
    //
    // E's scripts/E-yard-walk.mjs passes all four of its walks too.
  };
  let ze = 14.2;
  let bodegaZ0 = 0; // the bodega turns the corner — hand-built below, not by placeBld
  for (const b of EAST) {
    if (b === 'lot') { placeLot(ze, 23.2); ze -= 23.2; continue; }
    if (b.nm === 'BODEGA') { bodegaZ0 = ze; ze -= b.w; continue; }
    if (b.kind === 'church') placeChurchEast(ze, b); else placeBld(1, ze, b);
    ze -= b.w;
  }
  // side-street rosters run along x; facade on the street-facing z side
  const placeBldZ = (x0: number, zc: number, b: BldSpec, facing: 1 | -1) => {
    const cx = x0 + b.w / 2;
    const gh = bandOf(b);
    const dep = depthOf(b.nm), front = zc + facing * 1.7;
    const czd = front - facing * dep / 2;             // centre of the deeper shell
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = shellMats(facing > 0 ? 4 : 5, facade, b.w, h, dep, b.brick, gh, true, roofM);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, dep), mats);
    wall.userData.facing = 'z';        // cross-street shells front along z
    wall.position.set(cx, h / 2 + gh, czd);
    scene.add(wall);
    litSheets(b, b.w, h, cx, h / 2 + gh, front,
      facing > 0 ? 0 : Math.PI, 0, facing);
    // registered before the painter runs — see placeBld
    shopfrontRelief({
      scene, name: b.nm, wMeters: b.w, trim: b.col,
      x: cx, z: front, rotY: facing > 0 ? 0 : Math.PI,
    });
    const shopM = flat(shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = shellMats(facing > 0 ? 4 : 5, shopM, b.w, gh, dep, b.brick, 0, false, roofM);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w, gh, dep), shopMats);
    shop.position.set(cx, gh / 2, czd);
    scene.add(shop);
    roofKit(cx, czd, b.w, dep, gh + h, b.nm);
    solid(facing > 0
      ? { minX: x0, maxX: x0 + b.w, minZ: front - dep, maxZ: front + CUSH }
      : { minX: x0, maxX: x0 + b.w, minZ: front - CUSH, maxZ: front + dep });
  };
  // The bodega is the anchor store on this corner, so it does not stop at the
  // canted bay — it runs on down the side street, taking the first 6 m of what
  // used to be the FLOWERS frontage (FLOWERS is 6 m wide now, and everything
  // east of it is where it always was). Starts at BX1 = FACE + 3.4 so the wing
  // ABUTS the corner block exactly.
  const BODEGA_WING = 6.05;
  // THIS LINE PUBLISHES THE BODEGA'S FRONTAGE, AND IT IS THE WING'S, NOT THE
  // DOOR'S. Read this before trusting `__frontages['BODEGA']` for anything.
  //
  // `placeBldZ` paints the band from `nm` and `shopfrontRelief` registers the
  // frontage from the same `nm`, so this call publishes an axis-x frontage on
  // the side street's north face at z = -96 with a door at x 12.82 — the wing's
  // PAINTED door, which is decorative and opens onto nothing (checked: no [E]
  // fires anywhere along x 11.0…14.6).
  //
  // The customer door is round the corner on the canted bay at (8.0, -95.0),
  // 5 m away and on a different wall. It is published by `DOOR.face` in
  // ct/int-bodega.ts and readable through `declaredDoors()` / `doorStandFor`,
  // which is what the [E] uses and what `crosstown.ts`'s `doors:` affordance
  // exists to expose. `Placement` is axis-aligned (`axis: 'x' | 'z'`), so a 45°
  // face cannot register a correct frontage at all — that is the root of it.
  //
  // So: for a CUT FACE, `declaredDoors()` is the authority and `__frontages` is
  // not. Nothing consumes the wrong entry today; it goes live the moment anyone
  // derives door geometry from the frontage roster. notes/BLOCKED-D.md has the
  // three ways out and why none of them is mine to pick.
  placeBldZ(FACE + 3.4, -94.3, { nm: 'BODEGA', col: '#b8342a', w: BODEGA_WING, brick: '#6b4034', floors: 3 }, -1);
  let xn = FACE + 3.4 + BODEGA_WING;
  const sideSpans: Record<string, [number, number]> = {};
  // GOLDEN ACES and HOTEL ORPHEUS are built by ct/vice.ts — they are not
  // shopfronts and are not made of shopfront parts (same argument that took the
  // library and the church into ct/civic.ts). street.ts still owns where they
  // stand: the roster above and this cursor. Called from INSIDE the loop rather
  // than afterwards so the paint order is unchanged — the fingerprint harness
  // seeds Math.random, so moving a texture's creation shifts the grain of every
  // texture painted after it.
  const vice = buildVice({ scene, flat, solid, KERB_H });
  for (const b of NORTH2) {
    sideSpans[b.nm] = [xn, xn + b.w];
    if ((vice.VICE as readonly string[]).includes(b.nm)) { const m = scene.children.length; vice.placeShell(xn, -94.3, b); stampFrom(m, 'vice'); }
    else placeBldZ(xn, -94.3, b, -1);
    xn += b.w;
  }
  // The signs at the far end of the side street are ct/vice.ts's too — the
  // casino's rooftop pylon and the hotel's blade. Invoked here, at the point in
  // the sequence they were built at before, for the paint-order reason above.
  { const m = scene.children.length; vice.placeSigns(sideSpans); stampFrom(m, 'vice'); }
  let xs = -7;
  for (const b of SOUTH2) {
    if (b.kind === 'church') { const m = scene.children.length; placeChurch(xs, -111.7, b); stampFrom(m, 'civic'); }
    else placeBldZ(xs, -111.7, b, 1);
    xs += b.w;
  }
  // ── the bodega turns the corner on a canted bay ─────────────────────────
  //
  // The classic American corner store does not meet the intersection with a
  // square 90° arris. It cuts the corner off at 45° for the FULL height of
  // the elevation — ground floor to cornice — and puts the entrance in that
  // angled face, so the door addresses the crossing diagonally and both
  // streets see a shopfront. The upper storeys carry the same brick and the
  // same window rhythm as the rest of the building; it is one bay of the
  // elevation, not a notch cut in the shopfront.
  //
  // Plan (the shell is a rectangle with the south-west corner triangle taken
  // out, so it is built as two boxes plus the canted bay and a roof cap):
  //
  //        z=-86  ┌──────────────┐  BX1 = FACE+3.4
  //               │      R1      │
  //     z=-94.2   ├───────┬──────┤
  //               │  cut  │  R2  │
  //        z=-96  └╲______┴──────┘
  //                 ╲ canted bay, A→B
  //               BX0 = FACE
  {
    const bod = EAST[EAST.length - 1] as BldSpec;     // BODEGA — last on the roster
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
    const SHOP = SHOP_BAND_H, BH = 3.4 + bod.floors * 2.4, TOP = SHOP + BH;
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    // The corner's footprint FOLLOWS THE CUT. The shell is the rectangle
    // BX0…BX1 × BZ1…BZ0 minus the triangle the chamfer takes out of its
    // south-west corner — the void is x ≥ BX0, z ≤ BZ1 + CHF and
    // x + z ≤ BX0 + BZ1 + CHF. An AABB cannot be diagonal, so the cut is
    // approximated by a staircase of thin bands, each starting at the
    // MOST PERMISSIVE x in its band so the stair never eats walkable ground
    // — the 0.36 m player radius more than covers the sliver of masonry that
    // leaves unblocked. Collide square here and you clip the cut face, which
    // is exactly what the user reported.
    {
      const CUT = BX0 + BZ1 + CHF;                    // x + z along the cut
      const BAND = 0.25;
      for (let z = BZ1; z < BZ1 + CHF - 1e-6; z += BAND) {
        solid({ minX: CUT - z, maxX: BX1 + 8, minZ: z, maxZ: z + BAND });
      }
      // …and the rest of the block, north of the cut, at full width
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
    awn.rotation.x = -0.18;   // slopes down and away from the face
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
    for (const [cxx, czz, shades] of [
      // NOT in front of the canted bay. They used to stand at x 7.9 and 9.3,
      // straight across the door's approach, and their collider is what made
      // the bodega impossible to enter: you were stopped at x = 7.13 walking
      // east and x = 10.07 walking west, with the [E] spot stranded inside
      // the box between. Crates belong against the side-street frontage,
      // where they dress the shop without standing in its doorway.
      [10.05, -96.28, ['#d8892a', '#c2701f', '#e6a044', '#b0621c']],
      [10.95, -96.25, ['#9a3a2c', '#842f24', '#b45140', '#6f2820']],
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
      fruit(cxx - 0.375, sidewalkY + 0.052, czz + 0.285, 0.052, 1); // …and one on the pavement
    }
  }
  // south-west corner building closes the side street's west end
  placeBld(-1, -98, { nm: 'RADIO', col: '#3a4a7a', w: 12, brick: '#835444', floors: 4 });
  // east cross building — the side street disappears into the fog toward it
  {

    const eRoof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const eWall = new THREE.Mesh(
      new THREE.BoxGeometry(6, 13.6, 24),
      shellMats(1, flat(facadeTex('#5c4436', 4, 24, 13.6, 0)), 6, 13.6, 24, '#5c4436', 0, true, eRoof),
    );
    eWall.position.set(SIDE_X1 + 5, 6.8, (SIDE_Z0 + SIDE_Z1) / 2);
    scene.add(eWall);
  }

  // billboard registry (declared early — the alley adds to it too)
  interface Board { m: THREE.Mesh }

  // cross building closing the north end; the south end turns the corner now
  {
    // 13.6 m tall, not wallHeight(4) = 13.0 — pass the real face or the
    // texture is painted for a wall that does not exist and lands at 7.65 up
    //
    // THIS is the object in shots/user-bankflank.png, not the bank. It used to
    // be a 30 m box at z 13.5…19.5 while the bank runs to z 14.2, so the two
    // shells INTERPENETRATED by 0.7 m — a brick block standing through the
    // bank's precast front, floor to parapet, meeting it at a razor arris with
    // nothing between. Raycasting from that screenshot's camera hits this box
    // on every ray; the bank's own returns are behind it.
    //
    // It now ABUTS instead of overlapping (GOTCHAS §6: coplanar surfaces must
    // abut, never overlap — the same rule that fixed the alley walls and the
    // building seams), and it is only as wide as the gap it has to close, so
    // it stops barging across the building line on either side.
    const NZ = 14.2;                                   // the block's north end
    const CAP_W = 2 * FACE;                            // exactly the street, no more
    const CAP_D = 6;
    const facade = flat(facadeTex('#5c4436', 4, CAP_W, 13.6, 0));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(CAP_W, 13.6, CAP_D),
      shellMats(5, facade, CAP_W, 13.6, CAP_D, '#5c4436', 0, true, roofM));
    wall.position.set(0, 6.8, NZ + CAP_D / 2);
    scene.add(wall);
    // and the two returns it presents where it meets the flanking runs are
    // party walls, not the block's flat brown — same reasoning as the bank's
    solid({ minX: -FACE, maxX: FACE, minZ: NZ, maxZ: NZ + CAP_D });
  }

  // ── the alley: a dark cut in the left wall with a dumpster ──────────────
  {
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
      // the drain: a real 0.4 m gully with its bars, not an 8 px square
      const dx = Math.round(AFW * 0.5), dy = Math.round(AFL * 0.42), dw = am(0.4);
      g.fillStyle = '#17181c'; g.fillRect(dx - dw / 2, dy - dw / 2, dw, dw);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let k = 1; k < 4; k++) {
        g.fillRect(dx - dw / 2, dy - dw / 2 + Math.round((k * dw) / 4), dw, Math.max(1, am(0.02)));
      }
    }), 'ground');
    // wet(), like the open sites' ground at the top of this file. The alley is
    // ROOFLESS — rain falls in it — but this floor was never registered, so it
    // only ever got the grading path's wetK and not updateRain's treatment.
    // Measured from a fixed camera, 13:00 dry against 15:00 raining, mean pixel
    // luminance of the surface:
    //
    //     road          67.1 -> 28.0   -58%
    //     alley floor   54.4 -> 51.1    -6%
    //
    // The street soaked and the alley stayed dry, in the same downpour.
    const floorA = new THREE.Mesh(new THREE.PlaneGeometry(AF_W, AF_L), wet(new THREE.MeshBasicMaterial({ map: alleyFloorT })));
    floorA.rotation.x = -Math.PI / 2;
    floorA.position.set(-FACE - 3.3, 0.005, (AZ0 + AZ1) / 2);
    floorA.userData.alley = 'floor';
    scene.add(floorA);
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
    const alleyI = WEST.indexOf('alley');
    const topOfB = (b: BldSpec) => bandOf(b) + 3.4 + b.floors * 2.4;
    const END_H = Math.max(
      topOfB(WEST[alleyI - 1] as BldSpec),
      topOfB(WEST[alleyI + 1] as BldSpec),
    );
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
    const ai = WEST.indexOf('alley');
    const topOf = (b: BldSpec) => bandOf(b) + 3.4 + b.floors * 2.4;
    for (const [paint, spec, az, ry] of [
      [northFlankT, WEST[ai - 1] as BldSpec, AZ0 - 0.01, Math.PI],
      [southFlankT, WEST[ai + 1] as BldSpec, AZ1 + 0.01, 0],
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
      // alphaTest, and it is not a rendering preference — it is what stops the
      // tags GLOWING AT MIDNIGHT. props.ts grades the world down after dark and
      // skips anything it thinks is glass: `isGlass = m.transparent &&
      // !(m.alphaTest > 0)`. A transparent decal with no alphaTest is glass by
      // that test, so these three were never offered to the dimmer at all —
      // measured, `userData.graded` false and colour still 1.0 at 23:00, while
      // the brick behind them went to 0.09. Spray paint reading brighter than
      // the wall it is on.
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

  stampFrom(STREET_MARK, 'street');
  return { colliders, park: PARK, lot: LOT, setWindows };
}

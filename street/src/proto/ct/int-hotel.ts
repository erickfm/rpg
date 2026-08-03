import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface, slabTex, BOX_FACE_DIMS } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
// the hard-texel text painter from the casino's facade — one signage hand for
// both sides of this pair, and it is why the corridor sign is not soft
import { hardLayer, leafPair } from './vice';
import { VICE_DOOR_X } from './vice';

// HOTEL ORPHEUS, the lobby.
//
// The brief is a gap, not a room: it WAS grand and it is not any more, and the
// distance between those two is the whole thing. So every object in here is
// one of two kinds, and the room is built out of the argument between them:
//
//   what is still grand          what has happened to it
//   ─────────────────────────    ──────────────────────────────────────
//   a real tile floor            a vinyl runner over the worn track
//   a mahogany reception desk    one clerk on a dead shift behind it
//   a full wall of pigeonholes   most of the keys still in them
//   a proper lift with a dial    the dial stopped between floors
//   a planted palm               dead, and nobody has moved it
//   four matched lobby chairs    three that do not match
//   four ceiling fittings        one of them out
//
// None of that reads if the shabbiness is drawn as dirt. It has to be drawn as
// REPLACEMENT — the vinyl is a different material from the carpet, the chairs are
// different shapes, the dead lamp is a different colour from the lit ones. A
// grand room with grime on it is just a dirty grand room.
//
// HOTEL ORPHEUS stands on the side street at x ∈ [33.45, 45.45] in street.ts's
// NORTH2 roster, facade on z = -96.0, with its blade sign hung off the east end
// of the building. The door is painted by ct/vice.ts, which is where the x
// lives — derived and walked in notes/G-interiors2-prep.md, not eyeballed.
// This said "u = 0.4948 of a 96-texel shopfront"; the band is 192 texels and
// the u is 0.495, so both figures were wrong. See the casino's note.
/**
 * The [E] spot, derived from THIS FILE's own `face` rather than looked up.
 *
 * It is the same arithmetic `doors.ts`'s `doorStandFor` does — point plus
 * outward normal times the standoff — but computed here, so this module does not
 * import a VALUE from `./doors`. That import is what put this file in a runtime
 * cycle with the door registry, and a module in that cycle resolves to an
 * undefined namespace in the Rollup bundle, so its `DOOR` was collected in dev
 * and silently dropped in `dist`. Type-only imports are erased and cost nothing,
 * which is why the other six rooms were never affected.
 *
 * The standoff default is duplicated from `doors.ts` and that is the price.
 *
 * I first wrote that walking to the door guards it. It does not, and I checked
 * rather than leaving the claim standing: with this constant drifted to 1.00,
 * every walking check still passed, because they all approach through a 1.05 m
 * trigger radius that swallows a 0.25 m error whole. That is the same blindness
 * the typed door constants had, asserted a second time instead of tested.
 *
 * What actually guards it is a comparison of the two NUMBERS, no walking
 * involved: `spots-walk.mjs` does it across the world, and `G-rooms-walk.mjs`
 * now does it for these four rooms — "every [E] spot sits exactly on its
 * published door", within 1 cm.
 */
const standOf = (d: DoorDecl, standoff = 0.75) =>
  ({ x: d.face!.x + d.face!.nx * standoff, z: d.face!.z + d.face!.nz * standoff });

/**
 * WHERE THIS ROOM'S DOOR IS, declared as a world POINT and an outward NORMAL.
 *
 * This building fronts the SIDE STREET: the roster lays it out along x from
 * 33.45 to 45.45 and its facade faces −z, so "signed metres from the frontage
 * centre along z" — the form the main-block rooms use — cannot describe it.
 *
 * It does not need to. `face` was added for the bodega's canted bay and it is
 * not a chamfer special case: a point plus a normal is the GENERAL form, and
 * the main block's `cz`/`side` is the shorthand for the common one.
 * `doorPointFor` already derives one from the other. I had this written up as
 * needing a type change; it needed reading my own type properly.
 *
 * The point is G's, unchanged and already walked — declaring it publishes it
 * to tooling without moving anything.
 */
export const DOOR: DoorDecl = {
  building: 'HOTEL ORPHEUS', w: 12.0, cz: 39.45, side: 1, at: 0, width: 1.15,
  // WHAT THE DOOR IS, declared so both sides read one fact. Outside, ct/vice.ts
  // paints "a revolving door in a stone case" — a wide entrance somebody arrives
  // at, two dark glazed leaves in pale stone with a brass post between them. The
  // room was building a 1.10 m domestic leaf against it.
  leaf: {
    clearW: 2.2, h: 2.6, leaves: 2,
    frame: { colour: 0x8a8478, material: 'steel' }, glazing: 'full',
  },
  // Read from ct/vice.ts, which paints the entrance at this x — see the casino's
  // decl and VICE_DOOR_X for why the painter is the authority and not this file.
  face: { x: VICE_DOOR_X['HOTEL ORPHEUS'], z: -96.0, nx: 0, nz: -1 },
};

// The room's dimensions, and the ONE rhythm its ceiling is on.
//
// The user: "the pendant lights and the recessed panels are on different
// rhythms". They were, and the kit is half of it: with no `light` spec
// ct/interior.ts:1000 hangs `round(D / 3.5)` = 7 flush fittings down the
// centreline, while this file hung 4 pendants of its own in a 2x2 cluster at
// x +/-2.8. Seven of one thing at 3.71 m and four of another at 4.8 m, in the
// same ceiling.
//
// So there is now one count, one spacing formula and one centreline, declared
// here and read by BOTH: the kit gets `count` and `dead`, and the pendants hang
// from the roses the kit draws, on the same z. `lampZ` is the kit's own formula
// (`-hd + D * ((i + 0.5) / lamps)`) rather than a second one that agrees today.
const H_W = 11.0, H_D = 26.0, H_H = 3.4;
const LAMP_N = 5, LAMP_DEAD = 1;
const lampZ = (i: number) => -H_D / 2 + H_D * ((i + 0.5) / LAMP_N);

// THE PALETTE, NAMED ONCE. These four went straight into the `palette:` literal
// below and nowhere else, which was fine while nothing else in the file needed
// them. The ceiling section at the bottom does — its coffer field is the ceiling
// tone and its cornice is the trim tone — and a second hand-typed `0x2e1c1e`
// down there is the two-authorings problem this file's own header spends four
// paragraphs on (BUILDER-BRIEF §8). Same four numbers, one place.
//
// They are ct/vice.ts's constants for this elevation brought inside: RED
// #8e1f2a, RED_D #5a1520, GOLD_D #8a6a22. See the note on `palette:`.
const H_FLOOR = 0x5a2430, H_WALL = 0x6d2029, H_CEIL = 0x2e1c1e, H_TRIM = 0x8a6a22;

// THE BAY JOINTS — the seams of the coffered ceiling, one rhythm with the lamps.
//
// `lampZ(i)` is the CENTRE of bay i; this is its two EDGES, half a bay either
// side, for i = 0..LAMP_N. Derived off `lampZ` rather than written as a second
// `-hd + D * (i / N)` that happens to agree today: the user's complaint that
// started all of this was *"the pendant lights and the recessed panels are on
// different rhythms"*, and it was caused by exactly that — two formulas for one
// grid. There is one grid here and this is the other half of it.
//
// It also means a beam can never land on a lamp. `bayZ(i)` and `lampZ(j)` are
// half a bay (2.6 m) apart for every i and j by construction, so the coffer
// beams cannot collide with the kit's rose-and-dome at H − 0.185…H.
const BAY = H_D / LAMP_N;
const bayZ = (i: number) => lampZ(0) - BAY / 2 + i * BAY;

export function buildHotel(ctx: CtxBuild): void {
  const DOOR_X = 39.51, WALK_Z = -97.0;
  const room = buildRoom(ctx, {
    id: 'hotel',
    label: 'into the HOTEL ORPHEUS',
    // NAMED, so this file's own DoorDecl is actually consulted. It was not.
    //
    // `bName` (ct/interior.ts:1140) is `spec.building ?? fr?.name ?? null`, and
    // a CHAMFER room publishes no frontage — so `fr` is null here and the name
    // had to come from the spec. It did not, `bName` resolved to `null`, `LEAF`
    // with it, and every reader below took its `??` branch: this lobby has been
    // wearing **the kit's generic 1.1 m timber leaf** while `DOOR` twelve lines
    // up declares HOTEL ORPHEUS's own 1.15 m door. The building's declaration
    // was not wrong, it was thrown away.
    //
    // The kit screams about exactly this at ct/interior.ts:1171 and it has been
    // screaming every load — it is the one `[interior:*]` warning in a clean
    // 96-shot sweep, and `scripts/interiors-walk.mjs:284` and
    // `scripts/G-rooms-walk.mjs:210` both fail on that channel.
    //
    // Read off `DOOR` rather than typed again: a second hand-typed 'HOTEL
    // ORPHEUS' here is the two-authorings problem that this file's own header
    // spends four paragraphs on (BUILDER-BRIEF §8).
    building: DOOR.building,
    // 3.4 m, the tallest room in the belt so far and deliberately so. The
    // casino two doors down is 2.5 m and presses on you; this one has to do
    // the opposite before it can have fallen from anywhere.
    // WIDTH STAYS, DEPTH GROWS. The width is pinned to the frontage — 12.0 m of
    // HOTEL ORPHEUS, so the street-facing wall is the building's own width, and
    // that is half of the "interiors must agree with exteriors" the user has
    // asked for four times. The DEPTH was never constrained by anything: the
    // kit tiles slabs along x at SLAB_X0 400 + idx * 80 with every slab on
    // cz = 0 (ct/interior.ts:44, :471), so there is no neighbour behind a room
    // at all. 9 m was a number I chose, not a limit I was given.
    //
    // 26 m is what a hotel actually is: a modest frontage with a great deal of
    // building behind it. You come in, the desk is on your left, and the room
    // keeps going past it — lounge, then the lift bay, then a corridor mouth
    // that goes somewhere this game does not model.
    w: H_W, d: H_D, h: H_H,
    // The kit's fittings, on the shared rhythm above, with the dead one named
    // rather than drawn separately. My earlier note here — "one lamp out is not
    // something the kit can express" — was simply wrong: `dead` is at
    // ct/interior.ts:998 and takes the index. Four lit, one out, one spacing.
    light: { count: LAMP_N, dead: [LAMP_DEAD] },
    // THE FACADE'S PALETTE, BROUGHT INSIDE. The user, twice: what is outside is
    // "deep red, gold, black, bulb-lit letters and a lit porte-cochere" and what
    // was in here was "a pale beige room with plain tile ... clean, plain,
    // municipal". These are ct/vice.ts's own constants for this elevation --
    // RED #8e1f2a, RED_D #5a1520, GOLD_D #8a6a22 -- not colours that merely
    // resemble them, for the same reason `tube` is one exported painter rather
    // than two: someone walking in from that facade has to recognise the
    // building. Faded, not municipal: the wall sits between RED and RED_D so it
    // reads as deep red gone dusty, and the ceiling is darker than the wall so
    // the room feels tall and the light hangs IN it.
    palette: { floor: H_FLOOR, wall: H_WALL, ceil: H_CEIL, trim: H_TRIM },
    door: {
      // From the DECLARATION above, not typed again here. Hand-typing it
      // beside a declaration is the two-authorings problem in miniature, and
      // it had already drifted: this spot sat at z = {WALK_Z} = -97.0 while the
      // published door puts you at -96.75, 0.25 m apart. Small, and exactly
      // the class that grows — scripts/spots-walk.mjs now compares the two and
      // is how the gap was found.
      //
      // Derived by `standOf` rather than fetched with `doorStandFor`. Same
      // number; the difference is that asking the registry for it is a runtime
      // import, and that import is what dropped this building's door from the
      // built bundle. See `standOf` above.
      ...standOf(DOOR), r: 1.05,
      // CENTRED to match the facade, for the reason written out in full in
      // int-casino.ts: the portal on this elevation is at the frontage centre
      // (39.51 of [33.45, 45.45], mid 39.45) and this was -3.4, so the same wall
      // read centre from the street and a third to the right from inside. The
      // user's rule is "i need the facades to line up with the interior".
      at: 0,
      // Along the walk, east, for the same reason as the casino: the north
      // side-street walk is a 2 m band and the building collider eats down to
      // z = -96.3, so stepping BACK from the door cannot clear a 1.05 m
      // trigger without putting you in the road. 1.55 m along it gives 1.57 m.
      // 2.05 ALONG THE WALK, NOT 1.55, and the 0.5 m is a measurement I got wrong
      // rather than a preference. This note used to read "1.55 m along it gives
      // 1.57 m" against "a 1.05 m trigger" — but a spot's reach is NOT its
      // radius: fp.ts:425 adds REACH_MARGIN = 0.6, added when the user asked to
      // "widen the volumes", so the way-in spot is live out to 1.65 m. The
      // landing sat at 1.629 — INSIDE its own way-in reach by 2 cm, so you
      // pressed E to leave, arrived on the pavement already being offered the way
      // back in, and a second E bounced you straight inside. My own suite has
      // called this for a while and I had answered it by hand-measuring against
      // r alone, which is how a real bug survives a real check.
      //
      // 2.05 gives hypot(2.05, 0.5) = 2.11 m, clear by 0.46 m — and it is along
      // the walk, not back into the road, so the 2 m lane is untouched.
      outX: DOOR_X + 2.05, outZ: WALK_Z - 0.25, outYaw: 0, outGy: ctx.KERB_H,
    },
    // A lobby has a window — it is the one room on my list that wants people
    // outside to see in. East of the door, clear of it by 0.6 m so the kit's
    // overlap check has nothing to say.
    // Moved east and narrowed because the door moved to centre. At `at: 2.6,
    // w: 4.0` this spanned local x [0.6, 4.6]; a centred 1.15 m door spans
    // [-0.575, 0.575], so the two would have met with 2.5 cm between them and
    // the kit's overlap check would have had something to say. [1.5, 5.1] keeps
    // 0.93 m clear of the door and 0.4 m off the corner (half-width 5.5).
    window: { at: 3.3, w: 3.6, h: 1.7, sill: 0.9 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;

  // ── UPHOLSTERY HAS A WEAVE ────────────────────────────────────────────
  //
  // Worker ninetyseven, surveying this room: the seating group *"reads as flat
  // untextured slabs (they are — `MeshBasicMaterial`, no map)"*. Measured here:
  // of the 30 largest meshes in the lobby, **7 carry no map at all**, and the
  // suite and all three chairs are among them.
  //
  // This is `ct/paint.ts`'s own doctrine, quoted from `slabTex`'s docstring:
  // *"an untextured quad has no grain for the eye to attach to and no joints to
  // give it scale"* — it is already recorded there as being behind four separate
  // user complaints.
  //
  // IT KEEPS THE COLOUR. `slabTex` fills `base` unchanged, so the bottle-green
  // velvet and the three deliberately mismatched chairs are exactly the tones
  // that were authored — this adds grain, it does not restyle anything. That
  // matters more than usual here: the mismatch IS the room's thesis and two of
  // these colours are things the user asked for.
  //
  // `joint: 0` — grain and no joints. Upholstery is not masonry.
  //
  // ⚠ AND `grain` MUST STAY UNDER 0.14. Above it `slabTex` starts scattering
  // PEBBLES — 2 px stones, deliberately, because that is what separates a gravel
  // path from a poured slab (`ct/paint.ts`, the `if (grain > 0.14)` branch). My
  // first pass asked for 0.17 and the lobby suite came back covered in bright
  // confetti: a velvet sofa wearing gravel. Photographed, then read in the
  // source rather than tuned by eye — BUILDER-BRIEF §7, the source is the answer.
  //
  // ⚠ ONE SHEET PER FACE, NOT ONE SHEET SIZED TO THE LARGEST FACE (item 259).
  //
  // The comment that used to stand here named the hazard and then shipped it:
  // *"SIZED TO THE LARGEST FACE, NOT TO THE TOP… a backrest's TOP face is a
  // 0.1 m sliver."* Sizing to the two biggest dimensions avoids stretching the
  // sheet on the face you look at — and hands that same 1:1 sheet to the four
  // faces that are NOT that size, because `slabTex` maps 1:1 and a material is
  // shared by all six faces of a box. `texdensity` went red on it the same
  // night: **`interior:hotel` 3 → 9**, with the slivers drawing **250 px/m**
  // against a declared 48.
  //
  // Choosing which face to be wrong about was never the choice. A box authored
  // (W, H, D) has THREE distinct face sizes — `±x = D×H`, `±y = W×D`,
  // `±z = W×H` — so one map lands three different densities on it whatever you
  // size it to. That is BUILDER-BRIEF §7b, and item 163 landed
  // **`BOX_FACE_DIMS`** as the one written copy of that table precisely so
  // nobody has to rediscover it a fifth time.
  //
  // So this returns SIX materials, each with its own 1:1 sheet at the same
  // px/m. `boxFaces` is the general helper but it is the wrong one here: it
  // clones ONE texture and sets `repeat`, which is right for a tiling sheet and
  // wrong for `slabTex`, whose output is `ClampToEdgeWrapping` and 1:1 by
  // contract. Cached per distinct face size, so a box costs at most three
  // canvases and usually two.
  //
  // NOTHING ABOUT THE LOOK CHANGES. Same `base`, same `ppm`, same `grain`, same
  // `joint: 0` — item 96's weave was a deliberate improvement the user has not
  // complained about, and only its per-face sizing was ever wrong.
  //
  // ⚠ AND `grain` MUST STILL STAY UNDER 0.14 — see the note above.
  const FABRIC_PPM = 48;      // finer than the ground's 32: you stand next to it
  const fabric = (col: number, w: number, h: number, d: number): THREE.Material[] => {
    const base = `#${col.toString(16).padStart(6, '0')}`;
    const cache = new Map<string, THREE.Material>();
    return BOX_FACE_DIMS(w, h, d).map(([fw, fh]) => {
      const key = `${fw.toFixed(4)}x${fh.toFixed(4)}`;
      let m = cache.get(key);
      if (!m) {
        m = new THREE.MeshBasicMaterial({
          map: slabTex({ wMeters: fw, dMeters: fh, base, joint: 0, ppm: FABRIC_PPM, grain: 0.09 }),
        });
        cache.set(key, m);
      }
      return m;
    });
  };

  // ── the way in, matched to the doorway you came through ───────────────
  //
  // The same fault the user caught on the casino, found by doing what they then
  // asked -- "check your other five rooms' doors against their facades too".
  // Outside this one is a wide entrance in a pale stone case with two dark
  // glazed leaves and a brass post between them; inside was the kit's single
  // narrow leaf with a small window.
  //
  // Temporary and by hand, exactly as in int-casino.ts: F is extending the
  // frontage descriptor to publish door FORM, ct/interior.ts is F's, and this
  // should be deleted the day that lands. Colours are ct/vice.ts's own entrance
  // for this elevation -- #8a8478 and #9a9488 stone, #3a3428 leaf, the warm
  // glaze over it -- rather than colours chosen to look similar.
  const STONE = 0x8a8478, STONE_L = 0x9a9488;
  const stoneM = new THREE.MeshBasicMaterial({ color: STONE });
  const stoneLM = new THREE.MeshBasicMaterial({ color: STONE_L });
  // from the declaration, so the leaves cannot be narrower than their opening
  // READ OFF THIS FILE'S OWN DECLARATION, not fetched with doorLeafFor(). Same
  // number, and the difference is that asking the registry is a RUNTIME import
  // of ./doors — which is the import cycle that drops a building's DOOR from the
  // built bundle with no error. G-rooms-walk caught it the moment I wrote it;
  // `standOf` above exists for exactly the same reason.
  const LEAF_H = DOOR.leaf!;
  const DW = LEAF_H.clearW, DH = Math.min(LEAF_H.h, room.H - 0.2), dAt = room.doorAt;
  {
    const hits: THREE.Mesh[] = [];
    room.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.geometry?.type !== 'PlaneGeometry') return;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshBasicMaterial;
      const img = mat?.map?.image as HTMLCanvasElement | undefined;
      if (img && img.width === 32 && img.height === 64) hits.push(m);
    });
    if (hits.length === 1) hits[0].visible = false;
    else console.warn(`[interior:hotel] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the lobby now has both the kit door and its own. ct/interior.ts changed shape.');
  }
  // the stone case: head, its lit top edge, and the two jambs
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.42, 0.20, 0.12), stoneM), dAt, DH + 0.08, hd - 0.07);
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.42, 0.04, 0.13), stoneLM), dAt, DH + 0.17, hd - 0.07);
  for (const sx of [-1, 1]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.19, DH + 0.20, 0.12), stoneM),
      dAt + sx * (DW / 2 + 0.12), (DH + 0.20) / 2, hd - 0.07);
  }
  // two leaves, and the brass post between them that the facade also has
  const hLeafT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = '#141118'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#3a3428'; g.fillRect(2, 2, 20, 52);
    g.fillStyle = 'rgba(232,200,138,0.30)'; g.fillRect(3, 3, 18, 44);
    g.fillStyle = 'rgba(255,246,224,0.16)';
    for (let i = 0; i < 9; i++) g.fillRect(4 + i, 4 + i * 2, 16 - i, 1);
    g.fillStyle = '#2a251c'; g.fillRect(2, 46, 20, 8);            // the kick panel
    g.fillStyle = '#9a7c3a'; g.fillRect(18, 22, 2, 12);           // brass pull
    dither(g, 24, 56, 36);
  }), 'detail');
  const hLeafM = new THREE.MeshBasicMaterial({ map: hLeafT, side: THREE.DoubleSide });
  const LEAF_GAP = 0.04;
  // THE SAME FAULT WAS HERE. The desk predicted it — "if this one was mirrored
  // wrong, its siblings were authored the same way" — and it is true to the line:
  // same `rotation.y = -sx * OPEN`, same placement arithmetic, same brass pull at
  // texture x 18 of 24, so this pair had its handle on the hinge on one leaf too.
  // Both now go through the one rule in vice.ts.
  //
  // AND SO IS THE SWING NOW. This file's own `OPEN = 0.50` was the odd one out
  // of eight — nobody else used it — and it stood the lobby doors 28.6° open
  // under a painted street face that is shut. `LEAF_AJAR` owns it.
  leafPair(put, hLeafM, dAt, DW, DH, hd - 0.13, 'hotel', LEAF_GAP);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.05, DH - 0.06, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x9a7c3a })), dAt, (DH - 0.06) / 2, hd - 0.13);
  const BRASS = 0x9a7c3a, MAHOG = 0x4a2a20;
  const brassM = new THREE.MeshBasicMaterial({ color: BRASS });
  const mahogM = new THREE.MeshBasicMaterial({ color: MAHOG });

  // ── the carpet, and the vinyl over the worn part ──
  //
  // This was plain cream-and-ochre TILE and it was the single biggest reason the
  // room read municipal. "Patterned carpet doing far too much rather than plain
  // tile" is the instruction, and it is the same instruction the casino got and
  // the user liked the result of, so this is deliberately the same hand: 48x48
  // at the kit's density, a gold lattice on deep red, a colour fighting the gold,
  // and one motif too many.
  //
  // Not a copy of the casino's, though. A casino's carpet is designed to stop
  // you looking down; a hotel's is trying to look expensive, so this is a
  // bordered medallion — a repeating centre with a frame around it — rather than
  // an all-over diamond scatter.

  // The reception desk's own numbers, declared before the floor because the
  // runner in front of it is laid off them and a floor goes down first. The
  // desk itself is built from these further down; there is one authoring.
  const DESK_X = -4.55, DESK_Z = hd - 4.6, DESK_L = 4.4, DESK_D = 0.75;

  // One repeat of the carpet is 5.5 m — the room's own width — on a 96 px canvas,
  // so 17.5 px/m, next to the kit floor's ~20 (GOTCHAS 5). The canvas doubled
  // from 48 because the SIZE OF THE MOTIF turned out to be the second half of
  // "rugs all over": at 48 px over 7.2 m a medallion came out 1.6 m across, and
  // a 1.6 m gold lozenge with a green ring in it is not a pattern, it is a mat
  // lying on the floor. Sixteen motifs at 0.6 m read as weave.
  const CARPET_M = 5.5;
  const carpetT = declareSurface(pixTex(96, 96, (g) => {
    g.fillStyle = '#5a2430'; g.fillRect(0, 0, 96, 96);
    // NO BORDER ON THE TILE BOUNDARY. This drew two gold lines across every
    // repeat, and at a 2.4 m repeat those lines land every 2.4 m in both
    // directions — so the eye reads them as the EDGES OF SEPARATE RUGS and
    // counts thirty of them. "Rugs all over" is exactly what a bordered tile
    // does. A carpet is one field; only a rug has an edge.
    //
    // The motif stays and the frame goes. What is left is a quiet lattice that
    // does not announce where the texture repeats.
    // NO ORTHOGONAL LINES AT ALL, and no motif that lines up into a row.
    //
    // Tripling the repeat was not enough on its own and the second look proved
    // it: the floor still read as a grid of squares with a medallion in each,
    // because the pattern itself was built on a square grid — a lattice at
    // v = 0 and 24, four medallions on those axes, and a bright fleuron at every
    // crossing. Any straight line in a floor texture reads as an EDGE, and four
    // marks in a row read as a border, at any repeat. The size of the tile was
    // never the whole fault; the squareness of the drawing was.
    //
    // What replaces it is a damask: a half-drop diagonal, which is what a real
    // hotel carpet of this period is. Two medallions on the diagonal with a
    // smaller secondary between them, so nothing in the pattern is collinear
    // with anything else and there is no cell to count.
    g.strokeStyle = '#632b36'; g.lineWidth = 1;                 // the trellis, on 45deg
    for (let k = -96; k <= 192; k += 24) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 96, 96); g.stroke();
      g.beginPath(); g.moveTo(k, 96); g.lineTo(k + 96, 0); g.stroke();
    }
    // THE HALF-DROP. Sixteen motifs on a 24 px cell, every other row shifted by
    // half a cell, so no two are collinear and there is no row, column or cell
    // edge anywhere in the drawing. That is the whole difference between a
    // carpet and a floor covered in mats, and it is why the frame is gone.
    const main: [number, number][] = [], sec: [number, number][] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = 12 + c * 24 + (r % 2) * 12, y = 12 + r * 24;
      (((r + c) % 2) ? sec : main).push([x % 96, y]);
    }
    // the medallion: a lozenge, ring and pip stacked, 0.6 m across
    g.fillStyle = '#8a6a22';
    for (const [cx, cy] of main) for (let t = 0; t <= 5; t++) {
      const r = 5 - t;
      g.fillRect(cx + t, cy - r, 1, 1); g.fillRect(cx - t, cy - r, 1, 1);
      g.fillRect(cx + t, cy + r, 1, 1); g.fillRect(cx - t, cy + r, 1, 1);
    }
    g.strokeStyle = '#3d5a4a'; g.lineWidth = 1;                 // a green fighting the gold
    for (const [cx, cy] of main) { g.beginPath(); g.arc(cx + 0.5, cy + 0.5, 2, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d8a83a';
    for (const [cx, cy] of main) g.fillRect(cx, cy, 1, 1);
    // the secondary, deliberately dimmer: a small quatrefoil, close enough to
    // the field that it fills between the medallions rather than counting
    g.fillStyle = '#6e4a30';
    for (const [cx, cy] of sec) {
      for (const [ox, oy] of [[0, -3], [0, 3], [-3, 0], [3, 0]] as [number, number][]) {
        g.fillRect(cx + ox - 1, cy + oy - 1, 2, 2);
      }
      g.fillRect(cx, cy, 1, 1);
    }
    dither(g, 96, 96, 520);
  }), 'ground');
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping;
  // The repeat is the room's own width, so exactly two across and five down and
  // no partial tile at any wall — a seam that dies in a corner is the last place
  // one can still be counted. It is the SIZE OF THE DRAWING, not this number,
  // that stopped the floor reading as rugs; this only decides how often the
  // weave comes round.
  carpetT.repeat.set(Math.max(1, Math.round(room.W / CARPET_M)), Math.max(1, Math.round(room.D / CARPET_M)));
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(carpetT));
  carpet.rotation.x = -Math.PI / 2;
  put(carpet, 0, 0.012, 0);

  // …and the shabby half, laid ON the track people actually walk: door to
  // desk. It is a different MATERIAL, not a dirtier tile — sheet vinyl in a
  // colour that never matched, with the carpet still showing at its edges. That
  // is what makes it read as a repair rather than as wear — and it matters more
  // now the floor under it is grand: sheet vinyl over a gold medallion carpet is
  // exactly the shape of a place that peaked decades ago.
  const vinylT = declareSurface(pixTex(32, 48, (g) => {
    g.fillStyle = '#6a6358'; g.fillRect(0, 0, 32, 48);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 48; y += 6) g.fillRect(0, y, 32, 1);    // the roll's own grain
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, 2, 48); g.fillRect(30, 0, 2, 48);
    dither(g, 32, 48, 70);
  }), 'ground');
  vinylT.wrapS = vinylT.wrapT = THREE.RepeatWrapping;
  vinylT.repeat.set(1, 3);
  // SQUARED TO THE DESK, which is the user's "off center and stuff". It was
  // 2.3 x 6.8 at (-3.75, hd - 6.0): that runs from x -4.90 to -2.60 while the
  // desk front face is at -4.175, so a third of the runner was UNDER the desk;
  // and in z it started 2.6 m behind the desk's back end and stopped 0.2 m short
  // of its front. Two edges, neither of them lining up with anything.
  //
  // Both numbers now come off the desk. The runner starts exactly at the desk
  // face, is centred on the desk's own centre, and overhangs each end by the
  // same 0.5 m — so standing at the counter you have it square under you, and
  // from the door its long edge is parallel to the desk and to the wall.
  // DESK_X/DESK_Z/DESK_L are declared below; hoisted here because the floor has
  // to be laid before the things that stand on it.
  const RUN_W = 1.6;
  const vinyl = new THREE.Mesh(new THREE.PlaneGeometry(RUN_W, DESK_L + 1.0), ctx.flat(vinylT));
  vinyl.rotation.x = -Math.PI / 2;
  put(vinyl, DESK_X + DESK_D / 2 + RUN_W / 2, 0.014, DESK_Z);

  // ── THE WORN TRACK, which is the detail that sells the room ───────────
  //
  // The user: "a patterned carpet with a worn track across it where everyone
  // walks — the worn track is the detail that will sell it, because it says
  // people cross this room without ever stopping in it." That is exactly the
  // story this lobby is telling now that it is 26 m deep and nearly empty.
  //
  // Drawn as the carpet's own pattern with the pile walked flat: same weave,
  // paler and greyer, the gold rubbed thin. NOT a different material — the
  // vinyl runner is the repair, and this is the wear the repair did not cover.
  // It runs door -> desk and then the length of the room to the lift and the
  // corridor, because that is where the feet actually go.
  // WEAR HAS NO EDGE. That is the whole of the "buggy textures" report, and it
  // was mine, not a light bug: the user saw "large PALE TRANSLUCENT QUADS ... with
  // hard straight edges ... one a broad diagonal band running corner to corner
  // with a crisp edge down the middle of the room".
  //
  // MEASURED FIRST, because the two candidates wanted opposite fixes. All six
  // floor layers in this room are opaque, NormalBlending, opacity 1 — there is no
  // additive quad and no light-pool plane anywhere on this floor, so it is not
  // B's per-mesh light-pooling bug. The "diagonal band" is this file's own
  // 2.4 x 24 m worn-track plane seen in perspective from a corner; the overlaps
  // are it against the 5.38 x 2.6 m spur.
  //
  // The old version was a repeating tile clipped by a rectangle, so every patch
  // ended on a straight line and read as a second layer laid on the first. A
  // walked path does not end; it thins out. So each patch is now its OWN
  // non-repeating texture, sized to the patch at exactly the carpet's density,
  // and its alpha DISSOLVES over the last 0.6 m on all four sides.
  //
  // Dissolved with an ORDERED DITHER, not a smooth alpha ramp: a gradient would
  // be the off-style blur the kit was already told off for ("a smooth radial
  // gradient in a world that is entirely hard-edged nearest-filtered texels").
  // A 4x4 Bayer threshold gives hard texels that thin out — same idea, right
  // house style. Overlaps now just read as more worn where two paths meet, which
  // is exactly what the floor by the desk should be.
  //
  // Still translucent, deliberately: the carpet IS still there under a walked
  // track, only flattened and greyed. His "a rug should never be see-through"
  // is about rugs, and this is not one — the vinyl runner is the opaque object
  // in this story and it keeps its hard edge, because sheet vinyl has one.
  const PXM = 96 / CARPET_M;                       // the carpet's own density, exactly
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const worn = (w: number, d: number, lx: number, lz: number) => {
    const W = Math.max(8, Math.round(w * PXM)), H = Math.max(8, Math.round(d * PXM));
    const F = 0.6 * PXM;                           // 0.6 m of dissolve at every edge
    const t = declareSurface(pixTex(W, H, (g) => {
      g.clearRect(0, 0, W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
        const k = Math.min(1, edge / F);            // 1 well inside, 0 at the border
        if (k <= (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) continue;
        // the carpet's own weave, walked flat: same 24 px cell, same half-drop,
        // same diagonal trellis, only greyed and with the gold rubbed thin
        const cyi = Math.round((y - 12) / 24), row = ((cyi % 2) + 2) % 2;
        const nxi = Math.round((x - 12 - row * 12) / 24);
        const md = Math.abs(x - (12 + nxi * 24 + row * 12)) + Math.abs(y - (12 + cyi * 24));
        let col = '#6a4048';                                        // the field, greyed
        if ((x + y) % 24 === 0 || (x - y + 9600) % 24 === 0) col = '#74505a';
        if (md === 5) col = '#6e5a44';                              // gold rubbed thin
        if (md === 0) col = '#7a6a52';
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
      }
    }), 'ground');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    // under the vinyl, over the carpet. depthWrite false with depthTest on is
    // what keeps it under: the vinyl is opaque, so it draws first and writes
    // depth, and the wear then fails the test wherever the repair covers it.
    put(m, lx, 0.013, lz);
  };
  // ONE path, not two rectangles that miss each other. The old pair was
  // 2.0 wide centred on x -1.2 and 2.2 wide centred on x +1.0: they overlapped
  // in z by 20 cm and jogged 2.2 m sideways at the join, so the "track" had a
  // step in it in the middle of an empty floor — a large part of the user's
  // "off center and stuff".
  //
  // The door is at local x 0 and the lift and corridor are at the far end, so
  // the track people wear is a straight line down the centre, and a spur west to
  // the counter. The spur meets the runner's edge and the centre track's edge,
  // so the wear is continuous underfoot rather than three islands.
  const TRACK_W = 2.4;
  worn(TRACK_W, room.D - 2.0, 0, 0);                       // door -> lift, straight
  const SPUR_X0 = DESK_X + DESK_D / 2;                     // the counter face
  const SPUR_X1 = TRACK_W / 2;                             // the centre track's edge
  worn(SPUR_X1 - SPUR_X0, 2.6, (SPUR_X0 + SPUR_X1) / 2, DESK_Z);

  // ── ENRICHMENT AT THE EDGES, AND THE MIDDLE LEFT ALONE ────────────────
  //
  // The user called this room EERIE and asked explicitly not to fill it in:
  // "keep the sense of too much room and too few people; crowding it would
  // destroy the thing they just praised". So every one of these sits against a
  // wall or in a corner. The centre of the floor stays empty on purpose, and
  // that is a design decision, not an unfinished one.
  {
    const brass2 = new THREE.MeshBasicMaterial({ color: 0x9a7c3a });
    const oak = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    const oakD = new THREE.MeshBasicMaterial({ color: 0x372a1c });
    // THE SUITE IS NOT THE WALL. This was 0x6d2029 — byte for byte the wall
    // colour in this room's own palette — so a sofa and two armchairs standing
    // against that wall were invisible, and the "seating group" read as a low
    // table with nothing round it. Found by standing in front of it rather than
    // by looking down the room, which is the whole reason for the eye-height
    // pass. Faded bottle-green velvet: what a lobby suite of this period
    // actually was, and it reads against ox-blood at any distance.
    const plush = fabric(0x3f5449, 0.85, 0.42, 2.1);
    const plushBack = fabric(0x3f5449, 0.30, 0.52, 2.1);
    const plushSeat = fabric(0x3f5449, 0.72, 0.40, 0.72);
    const plushRest = fabric(0x3f5449, 0.72, 0.46, 0.22);
    const paper = new THREE.MeshBasicMaterial({ color: 0xd8d2c0 });
    // `m` takes a material ARRAY as well as one material, because `fabric` now
    // returns six — one per face, at each face's own metres (item 259).
    const bx = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[],
      x: number, y: number, z: number) =>
      put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);

    // A SOFA AND TWO ARMCHAIRS ROUND A LOW TABLE, in the east corner
    {
      // Against the wall, not a metre off it. At hw - 1.5 the sofa's back stood
      // 1.0 m clear of the east wall, which is the "furniture strewn about"
      // reading in miniature — furniture floating in a room rather than placed
      // in it. hw - 0.62 puts the back 6 cm off the plaster.
      const SX = hw - 0.62, SZ = hd - 9.5;
      bx(0.85, 0.42, 2.1, plush, SX, 0.21, SZ);                    // sofa seat
      bx(0.30, 0.52, 2.1, plushBack, SX + 0.32, 0.62, SZ);         // its back
      bx(0.95, 0.16, 2.2, oakD, SX, 0.06, SZ);                     // the plinth
      solid(SX, SZ, 1.1, 2.2);
      for (const az of [-1.7, 1.7]) {                              // the armchairs
        bx(0.72, 0.40, 0.72, plushSeat, SX - 1.1, 0.20, SZ + az);
        bx(0.72, 0.46, 0.22, plushRest, SX - 1.1, 0.58, SZ + az + (az < 0 ? -0.25 : 0.25));
        solid(SX - 1.1, SZ + az, 0.9, 0.9);
      }
      // AND YOU CAN SIT ON ALL OF IT. The user's standing rule is *"for every seat
      // in the game i want to be able to sit down"*, and this room had SIX drawn
      // sittable objects and ZERO registered seats — measured, not assumed:
      // `__ct.seats()` returned nothing at all for the hotel while the casino
      // returned 121 and the church 28. A lobby suite you cannot sit on is the
      // largest exception left in the world after the pews.
      //
      // Seat tops come from the geometry above, not from a guess: the sofa
      // cushion is a 0.42 box centred 0.21 so its top is 0.42, and an armchair
      // cushion is a 0.40 box centred 0.20 so its top is 0.40. Every one declares
      // an `approach` on the OPEN side, 0.9 m out, so the sit spot and the stand
      // spot never share a coordinate — the 0.00 m trap measured across the world
      // on C's stuck-seat row.
      const SOFA_TOP = 0.42, ARM_TOP = 0.40;
      for (const dz of [-0.52, 0.52]) {                            // two places on the sofa
        ctx.seat({
          x: room.wx(SX - 0.10), z: room.wz(SZ + dz), yaw: -Math.PI / 2, h: SOFA_TOP,
          approach: { x: room.wx(SX - 1.0), z: room.wz(SZ + dz) },
          label: 'sit on the sofa', ok: () => room.inside(),
        });
      }
      for (const az of [-1.7, 1.7]) {                              // and the armchairs
        ctx.seat({
          x: room.wx(SX - 1.1), z: room.wz(SZ + az), h: ARM_TOP,
          // each faces the low table, which is the way its back is already turned
          yaw: az < 0 ? Math.PI : 0,
          approach: { x: room.wx(SX - 1.95), z: room.wz(SZ + az) },
          label: 'sit in the armchair', ok: () => room.inside(),
        });
      }
      bx(0.80, 0.06, 0.80, oak, SX - 1.15, 0.40, SZ);              // the low table
      for (const lx of [-0.3, 0.3]) for (const lz of [-0.3, 0.3]) {
        bx(0.06, 0.38, 0.06, oakD, SX - 1.15 + lx, 0.19, SZ + lz);
      }
    }

    // The SINGLE CHAIR FACING NOTHING that used to stand at (-hw + 1.1, -2.0) is
    // gone. It was written as the loneliest object in the room and I still like
    // the idea, but the user's word for this floor was "awful" and his diagnosis
    // was "furniture strewn about" — and by his own definition a chair on its own
    // in the middle of a wall, facing nothing, part of no group, IS the scattered
    // item. The room keeps its emptiness through the empty floor, which is what
    // he praised, not through one stray chair.

    // A LUGGAGE CART WITH NOBODY'S BAGS ON IT
    {
      // Tucked hard against the west wall at the desk's front end, where a
      // luggage cart actually stands — between reception and the door. It was at
      // (-hw + 1.4, hd - 8.0), which is x -4.1: that is 7 cm PROUD of the desk
      // face, so it stood in the runner lane you walk to the counter along, in
      // the open floor rather than against anything.
      const LX = -hw + 0.85, LZ = hd - 1.2;
      bx(0.72, 0.06, 1.20, brass2, LX, 0.30, LZ);
      for (const p of [-0.5, 0.5]) bx(0.05, 1.55, 0.05, brass2, LX - 0.30, 0.78, LZ + p);
      bx(0.05, 0.05, 1.20, brass2, LX - 0.30, 1.55, LZ);
      for (const w of [[-0.28, -0.5], [0.28, -0.5], [-0.28, 0.5], [0.28, 0.5]] as [number, number][]) {
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8), oakD),
          LX + w[0], 0.09, LZ + w[1]).rotation.z = Math.PI / 2;
      }
      solid(LX, LZ, 0.9, 1.4);
    }

    // A PAYPHONE ALCOVE on the west wall, and a leaflet rack beside it
    {
      const PZ2 = -5.4;
      bx(0.30, 2.30, 1.30, oakD, -hw + 0.16, 1.15, PZ2);           // the alcove lining
      bx(0.16, 0.62, 0.30, new THREE.MeshBasicMaterial({ color: 0x2a2a2e }), -hw + 0.38, 1.32, PZ2);
      bx(0.10, 0.22, 0.08, brass2, -hw + 0.46, 1.05, PZ2 - 0.16);  // the handset
      bx(0.34, 0.05, 0.42, oak, -hw + 0.44, 0.92, PZ2 + 0.42);     // the shelf
      solid(-hw + 0.3, PZ2, 0.6, 1.4);

      // A LEAFLET RACK WITH POCKETS, because leaflets have to stand IN something.
      //
      // F swept the world for floating decorations and the only four are here:
      // six paper slips at local x -5.16 against a rack face at -5.18, so they
      // overlapped the rack by 5 mm and otherwise hung in the air with nothing
      // under them. A leaflet is the one object in a room that CANNOT float —
      // everybody has seen one in a rack — and pasting it to a flat panel is
      // exactly the mistake.
      //
      // So the rack now has a back panel, three pocket lips, and slips that rest
      // ON those lips: each leaflet's underside is the lip's top face, computed
      // from one number, so there is no gap to drift.
      const RZ2 = -7.0;                                            // leaflets nobody has taken
      const RK_X = -hw + 0.20, TIERS = [0.55, 0.85, 1.15], LIP_DROP = 0.11;
      bx(0.10, 1.05, 0.70, oak, RK_X, 0.86, RZ2);                  // the back panel
      for (const ty of TIERS) {
        bx(0.16, 0.03, 0.66, oakD, RK_X + 0.13, ty - LIP_DROP - 0.015, RZ2);   // the lip
        for (const lz of [-0.2, 0.2]) {                            // slips standing on it
          bx(0.05, 0.22, 0.16, paper, RK_X + 0.10, ty, RZ2 + lz);
        }
      }
    }

    // A CIGARETTE URN by the lift, and a rate card behind glass by the desk
    {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.72, 10), brass2), hw - 0.7, 0.36, -2.6);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10),
        new THREE.MeshBasicMaterial({ color: 0x8a8478 })), hw - 0.7, 0.74, -2.6);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66),
        new THREE.MeshBasicMaterial({ color: 0xcfc7ae }));
      card.rotation.y = Math.PI / 2;
      put(card, -hw + 0.07, 1.55, hd - 6.4);
      bx(0.05, 0.74, 0.58, brass2, -hw + 0.05, 1.55, hd - 6.4);
    }

    // A WALL CLOCK STOPPED AT THE WRONG TIME, and prints hung too high
    {
      const clockT = declareSurface(pixTex(24, 24, (g) => {
        g.fillStyle = '#2a1c1e'; g.fillRect(0, 0, 24, 24);
        g.fillStyle = '#d8d2c0'; g.fillRect(2, 2, 20, 20);
        g.fillStyle = '#3a3026';
        for (const [x, y] of [[11, 3], [11, 19], [3, 11], [19, 11]] as [number, number][]) g.fillRect(x, y, 2, 2);
        g.fillRect(11, 7, 2, 5);                                   // hands at 4:50, stopped
        g.fillRect(6, 11, 6, 2);
      }), 'detail');
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), ctx.flat(clockT));
      cl.rotation.y = Math.PI / 2;
      put(cl, -hw + 0.07, 2.55, -0.4);

      const printT = declareSurface(pixTex(20, 26, (g) => {
        g.fillStyle = '#6a5a3a'; g.fillRect(0, 0, 20, 26);
        g.fillStyle = '#c9bfa4'; g.fillRect(2, 2, 16, 22);
        g.fillStyle = '#8a9a8a'; g.fillRect(4, 12, 12, 10);        // a dull landscape
        g.fillStyle = '#a8b0bc'; g.fillRect(4, 4, 12, 8);
        dither(g, 20, 26, 26);
      }), 'detail');
      const pm = ctx.flat(printT);
      for (const [pz, sx] of [[-6.2, 1], [-9.0, 1], [-4.0, -1]] as [number, number][]) {
        const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.64), pm);
        pr.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        put(pr, sx * (hw - 0.07), 2.62, pz);                       // deliberately too high
      }
    }
  }

  // ── the reception desk ──
  //
  // Down the west wall rather than facing the door, which is how a lobby of
  // this size was actually planned: you come in, the room opens to your right,
  // and the desk is the thing you walk ALONG. Deep counter, mahogany front,
  // brass rail on top.
  // The desk sits just inside the door now rather than in the middle of the
  // room: at d 9 those were the same place, and at d 26 they are 8.5 m apart.
  // A reception desk you walk past is a reception desk; one in the centre of the
  // floor is an island.
  // (DESK_X / DESK_Z / DESK_L / DESK_D are declared above the floor, because the
  // runner is laid off them.)
  const deskT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = '#4a2a20'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#5c382a';                                    // raised panels
    for (let y = 6; y < 52; y += 16) g.fillRect(3, y, 18, 12);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let y = 6; y < 52; y += 16) g.fillRect(3, y + 11, 18, 1);
    g.fillStyle = '#6a4630'; g.fillRect(0, 0, 24, 3);           // the counter's edge
    dither(g, 24, 56, 34);
  }), 'detail');
  const deskM = ctx.flat(deskT);
  const deskTopM = new THREE.MeshBasicMaterial({ color: 0x5c3826 });
  put(new THREE.Mesh(new THREE.BoxGeometry(DESK_D, 1.12, DESK_L),
    [deskM, deskM, deskTopM, deskM, deskM, deskM]), DESK_X, 0.56, DESK_Z);
  // the brass rail along the top — plain colour, no texture. It is 0.06 m
  // thick, well under the 0.3 m that GOTCHAS §4 says can hold no fine detail.
  put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, DESK_L), brassM),
    DESK_X + 0.33, 1.18, DESK_Z);
  solid(DESK_X, DESK_Z, DESK_D, DESK_L);
  // the bell, and the register open beside it — the two things on the counter
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 8), brassM),
    DESK_X + 0.1, 1.15, DESK_Z + 1.5);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xd8d0bc })), DESK_X + 0.05, 1.14, DESK_Z - 0.6);

  // ── brass and mirror behind the desk, and drapes at the window ────────
  //
  // The last two things the instruction names. Both are cheap and both do a lot,
  // because they are what a lobby has and a waiting room does not.
  //
  // The mirror is a tall dark panel in a gold frame rather than a real
  // reflection: this world has no reflective material and a flat pale rectangle
  // would read as a hole. Dark glass with a highlight raked across it reads as
  // mirror at a glance, which is the same trick the casino's bronzed glazing
  // plays on the street outside.
  const mirrorT = declareSurface(pixTex(24, 40, (g) => {
    g.fillStyle = '#241a1c'; g.fillRect(0, 0, 24, 40);
    g.fillStyle = 'rgba(216,168,58,0.10)';
    for (let i = 0; i < 14; i++) g.fillRect(2 + i, 3 + i * 2, 8 - Math.floor(i / 3), 1);
    g.fillStyle = 'rgba(255,246,224,0.13)'; g.fillRect(3, 2, 2, 34);
    dither(g, 24, 40, 40);
  }), 'detail');
  for (const mz of [DESK_Z - 1.4, DESK_Z + 1.4]) {
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.1), new THREE.MeshBasicMaterial({ color: 0xd8a83a })),
      -hw + 0.05, 1.85, mz).rotation.y = Math.PI / 2;
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.9), ctx.flat(mirrorT)),
      -hw + 0.07, 1.85, mz).rotation.y = Math.PI / 2;
  }

  // Tall drapes at the window — floor length, not sill length, which is the
  // whole difference between a lobby and an office. The window is at local
  // x 3.3, 3.6 m wide with its sill at 0.9, so the pair hangs outside that at
  // 1.5 and 5.1 and falls from the head to the floor.
  const drapeT = declareSurface(pixTex(16, 64, (g) => {
    g.fillStyle = '#5a1520'; g.fillRect(0, 0, 16, 64);
    for (let x = 0; x < 16; x += 3) {                    // the folds
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(x, 0, 1, 64);
      g.fillStyle = 'rgba(216,168,58,0.10)'; g.fillRect(x + 1, 0, 1, 64);
    }
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 58, 16, 6);   // dust at the hem
    dither(g, 16, 64, 60);
  }), 'detail');
  const drapeM = ctx.flat(drapeT);
  for (const dx of [1.5, 5.1]) {
    put(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.75), drapeM), dx, 1.375, hd - 0.09);
  }
  // the pelmet the pair hangs from, in the same gold as everything else up high
  put(new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x8a6a22 })), 3.3, 2.86, hd - 0.10);

  // ── the clerk ─────────────────────────────────────────────────────────
  //
  // The user: *"the people inside these places are always flat and not like the
  // people on the street"*. This lobby had nobody in it at all, which read as
  // closed rather than as quiet — an empty desk under a full key rack says the
  // hotel has shut, and the story here is that it is open and nearly nobody is
  // staying.
  //
  // So: one clerk, in the 0.6 m staff strip between the desk and the west wall,
  // facing across the counter into the room — `facing: PI/2` is atan2(vx, vz)
  // toward +x. Shirt and tie, no jacket, because it is a long shift on a quiet
  // night. `room.person` is the kit's wrapper over the same atlas every citizen
  // outside uses — the right altitude for a room, per notes/CITIZEN-STYLE.md,
  // and it owns the per-frame turn so the room does not wire one.
  const CLERK_X = DESK_X - 0.62, CLERK_Z = DESK_Z + 0.35;   // behind the counter
  room.person({ jacket: '#8a8478', pants: '#3a3630', skin: '#8d5a34', hair: '#241a12',
      accent: '#6a2a30', fit: 'plain', cut: 'crop', build: 0, stride: 2 },
    CLERK_X, CLERK_Z,
    // Derived from where the GUEST stands, not typed and not aimed at the desk.
    // `Math.PI / 2` was right, but it is the same copied-constant shape that left
    // the tax preparer and the pawnbroker facing their back walls (GOTCHAS §23).
    //
    // Aiming at the desk CENTRE was my first attempt and it is wrong by 30°: the
    // clerk stands off-centre along the counter, so the centre is diagonally
    // forward of him while the guest is straight across. The desk is 0.75 m deep
    // in x down the west wall, so the guest stands at its +x face, level with the
    // clerk — which is what this points at, and it stays right if he moves along
    // the counter.
    { facing: Math.atan2((DESK_X + 0.375) - CLERK_X, CLERK_Z - CLERK_Z), h: 1.0, w: 0.98 });

  // ── the pigeonholes, on the wall behind the desk ──
  //
  // The single most hotel-lobby object there is, and the one that carries the
  // story: most of the keys are still on their hooks, which means most of the
  // rooms are empty. A few holes have mail in them that nobody has collected.
  const holesT = declareSurface(pixTex(96, 40, (g) => {
    g.fillStyle = '#3a2418'; g.fillRect(0, 0, 96, 40);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
      const x = 2 + c * 8, y = 2 + r * 9;
      g.fillStyle = '#241610'; g.fillRect(x, y, 7, 8);          // the hole itself
      g.fillStyle = '#4a2e1e'; g.fillRect(x, y, 7, 1);
      // a key on its hook in most of them, mail in a few, empty in the rest
      const n = r * 12 + c;
      if (n % 7 !== 3) { g.fillStyle = '#9a7c3a'; g.fillRect(x + 3, y + 3, 1, 4); g.fillRect(x + 3, y + 6, 2, 1); }
      if (n % 11 === 5) { g.fillStyle = '#c8c0aa'; g.fillRect(x + 1, y + 5, 5, 3); }
    }
    g.fillStyle = '#5a4028'; g.fillRect(0, 38, 96, 2);          // the shelf under
    dither(g, 96, 40, 50);
  }), 'detail');
  const holes = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), ctx.flat(holesT));
  holes.rotation.y = Math.PI / 2;                                // faces +x, into the room
  put(holes, -hw + 0.06, 1.85, DESK_Z);

  // the rate card, framed under glass beside the pigeonholes. Weekly rates,
  // because that is what a hotel quotes when it has stopped being a hotel for
  // travellers and become one for residents — the whole fall, in four lines.
  const rateT = declareSurface(pixTex(40, 28, (g) => {
    g.fillStyle = '#e2dac4'; g.fillRect(0, 0, 40, 28);
    g.fillStyle = '#5a4028'; g.fillRect(0, 0, 40, 1); g.fillRect(0, 27, 40, 1);
    g.fillRect(0, 0, 1, 28); g.fillRect(39, 0, 1, 28);
    g.fillStyle = '#3a2a1a'; g.font = 'bold 6px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WEEKLY', 20, 6);
    g.font = '5px monospace'; g.textAlign = 'left';
    const rows: [string, string][] = [['SINGLE', '42'], ['DOUBLE', '55'], ['BATH', '+6']];
    rows.forEach(([a, b], i) => {
      g.textAlign = 'left'; g.fillText(a, 4, 14 + i * 5);
      g.textAlign = 'right'; g.fillText(b, 36, 14 + i * 5);
    });
    g.fillStyle = 'rgba(190,215,225,0.20)'; g.fillRect(1, 1, 38, 26);   // the glass over it
  }), 'sign');
  const rate = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.52), ctx.flat(rateT));
  rate.rotation.y = Math.PI / 2;
  put(rate, -hw + 0.06, 1.55, DESK_Z + 2.85);

  // ── the corridor mouth at the far end ────────────────────────────────
  //
  // "A corridor mouth that suggests more building." It is a dark opening in the
  // far wall with a runner going into it and a sign over it, and the whole trick
  // is that it does not go anywhere: the room ends at the wall behind the dark
  // panel. What sells it is that you cannot see the end of it — the panel is
  // black, the runner runs under it, and the last thing lit is 2 m short of it.
  //
  // A hotel that ends at its own lobby wall is a stage set. This costs four
  // boxes and a plane and buys the whole rest of the building.
  {
    const MZ = -hd + 0.10, MW = 2.4, MH = 2.55;
    const jambM = new THREE.MeshBasicMaterial({ color: 0x8a6a22 });
    const voidM = new THREE.MeshBasicMaterial({ color: 0x120e10 });
    // the dark itself, a hair in front of the wall
    put(new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), voidM), 0, MH / 2, MZ + 0.04);
    // architrave: two jambs and a head, in the same gold as everything else high up
    for (const sx of [-1, 1]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.16, MH + 0.18, 0.14), jambM),
        sx * (MW / 2 + 0.08), (MH + 0.18) / 2, MZ + 0.10);
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(MW + 0.32, 0.18, 0.14), jambM), 0, MH + 0.09, MZ + 0.10);
    // the runner going in, so the eye follows it into the dark
    const runT = declareSurface(pixTex(16, 48, (g) => {
      g.fillStyle = '#5a1520'; g.fillRect(0, 0, 16, 48);
      g.fillStyle = '#8a6a22'; g.fillRect(1, 0, 1, 48); g.fillRect(14, 0, 1, 48);
      dither(g, 16, 48, 40);
    }), 'ground');
    runT.wrapT = THREE.RepeatWrapping; runT.repeat.set(1, 3);
    const run = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5.0), ctx.flat(runT));
    run.rotation.x = -Math.PI / 2;
    put(run, 0, 0.016, MZ + 2.6);
    // ROOMS 100-140 over the arch, the sign that does the suggesting
    const sgT = declareSurface(pixTex(40, 10, (g) => {
      g.fillStyle = '#241a1c'; g.fillRect(0, 0, 40, 10);
      hardLayer(g, '#d8a83a', (h) => {
        h.fillStyle = '#d8a83a'; h.font = 'bold 6px monospace';
        h.textAlign = 'center'; h.textBaseline = 'middle';
        h.fillText('ROOMS 100-140', 20, 5);
      });
    }), 'sign');
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), ctx.flat(sgT)), 0, MH + 0.42, MZ + 0.12);
  }

  // ── the lift ──
  //
  // East wall. No collider: the room's own wall already stops you 0.36 m short
  // of it, so a box here would only be a second wall in the same place — and
  // an unnecessary collider next to nothing is how the bodega's door got eaten
  // (GOTCHAS §8).
  const liftT = declareSurface(pixTex(48, 56, (g) => {
    g.fillStyle = '#6a6258'; g.fillRect(0, 0, 48, 56);          // the surround
    g.fillStyle = '#8a8478'; g.fillRect(3, 2, 42, 52);          // the doors
    g.fillStyle = '#5a544a'; g.fillRect(23, 2, 2, 52);          // the seam between them
    g.fillStyle = '#9a9488'; g.fillRect(3, 2, 42, 1);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 6; x < 45; x += 6) g.fillRect(x, 3, 1, 50);    // fluted panels
    g.fillStyle = '#9a7c3a'; g.fillRect(38, 26, 5, 8);          // the call plate
    g.fillStyle = '#2a2620'; g.fillRect(39, 28, 3, 2);
    dither(g, 48, 56, 40);
  }), 'detail');
  const lift = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.25), ctx.flat(liftT));
  lift.rotation.y = -Math.PI / 2;                                // faces -x, into the room
  // the lift bay is FURTHER IN, past the lounge — the thing you walk toward
  put(lift, hw - 0.06, 1.13, -3.5);

  // the floor dial over it, stopped between floors — the detail that says the
  // lift has not moved in a while without anyone having to write it down
  const dialT = declareSurface(pixTex(40, 22, (g) => {
    g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 40, 22);
    g.fillStyle = '#d8cfb4'; g.fillRect(2, 2, 36, 18);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1;
    g.beginPath(); g.arc(20, 20, 14, Math.PI, Math.PI * 2); g.stroke();
    g.fillStyle = '#3a2a1a';
    for (let i = 0; i <= 5; i++) {                               // the floor ticks
      const a = Math.PI + (i / 5) * Math.PI;
      g.fillRect(Math.round(20 + Math.cos(a) * 11) - 1, Math.round(20 + Math.sin(a) * 11) - 1, 2, 2);
    }
    g.fillStyle = '#8a2c22';                                     // the needle, between 2 and 3
    const na = Math.PI + 0.46 * Math.PI;
    for (let t = 0; t < 11; t++) g.fillRect(Math.round(20 + Math.cos(na) * t), Math.round(20 + Math.sin(na) * t), 1, 1);
  }), 'detail');
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.44), ctx.flat(dialT));
  dial.rotation.y = -Math.PI / 2;
  put(dial, hw - 0.06, 2.62, -2.0);

  // ── the lobby chairs, and the table they no longer match ──
  //
  // Three chairs, three different frames and three different colours: the
  // matched set went years ago and these arrived one at a time. They block as
  // ONE collider with the table, not four — the gaps between them are 0.4 m
  // and the player is 0.72 m across, so per-chair boxes would only carve slots
  // to wedge into, which is the lesson the diner's booths taught.
  // Shifted east from 1.6 when the door moved to centre. The seating collider
  // is 3.0 x 2.0 about this point, so at 1.6 it spanned local x [0.1, 3.1] --
  // directly in front of a centred door, and walking in put you straight into
  // it. That is the pawn shop's "i immediately hit a counter" all over again,
  // caught by G-rooms-walk's spawn probe rather than by the user this time.
  // At 2.6 it spans [1.1, 4.1]: clear of a 0.36 m player entering at x 0, under
  // the window where lobby seating wants to be, and leaving 1.4 m between the
  // chairs and the east wall. 3.0 was the first try and pushed that lane down to
  // 1.0 m -- walkable, but a squeeze the room did not used to have.
  //
  // AND THE ACTUAL BUG BEHIND "furniture strewn about". The three chairs were
  // written as absolute local coordinates — (0.5, 2.3), (2.7, 2.3), (1.6, 3.2) —
  // while their table, their ashtray and their collider were all placed at
  // CH_X / CH_Z. When the anchor moved east and forward, the table went and the
  // chairs did not: they ended up FIVE METRES from the table they belong to,
  // parked against the sofa group with nothing between them, and outside any
  // collider. That is the screenshot.
  //
  // So every piece is now derived from the anchor, and they are ARRANGED: three
  // mismatched chairs round the low table, west, east and north of it, each
  // turned to face it, with the fourth side left open toward the window. Facing
  // is (sin ry, cos ry) — the back is placed at -sin/-cos — so a chair west of
  // the table faces east at ry = +PI/2. They still do not match each other; that
  // was always the point. They are just no longer scattered.
  const CH_X = 3.0, CH_Z = hd - 3.6;
  const chair = (lx: number, lz: number, col: number, back: number, ry: number) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.5),
      fabric(col, 0.52, 0.12, 0.5));
    seat.rotation.y = ry; put(seat, lx, 0.42, lz);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.52, back, 0.1),
      fabric(col, 0.52, back, 0.1));
    br.rotation.y = ry;
    put(br, lx - Math.sin(ry) * 0.2, 0.48 + back / 2, lz - Math.cos(ry) * 0.2);
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), mahogM);
      put(leg, lx + sx, 0.18, lz + sz);
    }
  };
  // a green wing-back, the oldest of them, west of the table looking east
  chair(CH_X - 0.95, CH_Z, 0x5a6a5c, 0.5, Math.PI / 2);
  // a tan one, lower and newer, east of the table looking west
  chair(CH_X + 0.95, CH_Z, 0x7a5a3a, 0.38, -Math.PI / 2);
  // maroon, at the head of the table with its back to the room
  chair(CH_X, CH_Z - 0.85, 0x6a4a52, 0.44, 0);
  // …and all three sittable, same rule and same reasoning as the suite above. The
  // seat box is 0.12 tall centred at 0.42, so the cushion top is 0.48 — read off
  // `chair()` rather than guessed. `ry` is each chair's own facing, already
  // derived when they were arranged round the table, so the sitter looks where
  // the chair looks. Approach 0.85 m along the chair's own facing, which is the
  // open side of the group in every case.
  // APPROACHED FROM THE OPEN SIDE OF THE GROUP, not along each chair's own facing.
  //
  // My first pass put every approach 0.85 m along the chair's `ry`, which is right
  // for a chair on its own and wrong for a facing pair: the west and east chairs
  // look AT each other across 1.9 m, so both approaches landed in the middle of
  // the group **0.20 m apart** — measured, and the same class as the 0.00 m
  // sit-spot/stand-spot trap on C's stuck-seat row. Two spots that close is a
  // pick nobody can aim.
  //
  // The group is open toward the window at +z (the head chair closes the -z end),
  // so that is the side a person walks in from and the side the pair is approached
  // from. Their approaches are now 1.90 m apart instead of 0.20. The head chair
  // keeps its own -z approach, which is already its open side.
  const CHAIR_TOP = 0.48;
  for (const [clx, clz, ry, ax, az] of [
    [CH_X - 0.95, CH_Z, Math.PI / 2, CH_X - 0.95, CH_Z + 0.85],
    [CH_X + 0.95, CH_Z, -Math.PI / 2, CH_X + 0.95, CH_Z + 0.85],
    [CH_X, CH_Z - 0.85, 0, CH_X, CH_Z - 1.70],
  ] as [number, number, number, number, number][]) {
    ctx.seat({
      x: room.wx(clx), z: room.wz(clz), yaw: ry, h: CHAIR_TOP,
      approach: { x: room.wx(ax), z: room.wz(az) },
      label: 'sit in the lobby', ok: () => room.inside(),
    });
  }
  const lowT = declareSurface(pixTex(32, 20, (g) => {
    g.fillStyle = '#5c3826'; g.fillRect(0, 0, 32, 20);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 32, 2);
    g.fillStyle = 'rgba(0,0,0,0.20)';
    for (let x = 0; x < 32; x += 7) g.fillRect(x, 0, 1, 20);
    dither(g, 32, 20, 20);
  }), 'detail');
  put(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.6), ctx.flat(lowT)), CH_X, 0.44, CH_Z);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.2, 0.2]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), mahogM), CH_X + sx, 0.21, CH_Z + sz);
  }
  // an ashtray stand and a folded newspaper nobody has cleared
  put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xb0a894 })), CH_X + 0.15, 0.48, CH_Z);
  // one collider round the whole group, sized to what is actually there now:
  // chairs reach x CH_X +/- 1.25 and z CH_Z - 1.15 .. CH_Z + 0.35
  solid(CH_X, CH_Z - 0.4, 2.9, 2.2);

  // ── the dead palm ──
  //
  // In the corner by the door, where it was put to be the first thing you saw.
  // Drawn as a sprite with alphaTest, the same treatment as the diner's
  // waitress — a plant is all silhouette and a box cannot do it.
  const palmT = declareSurface(pixTex(40, 56, (g) => {
    // THE TRUNK REACHES THE CROWN. It ran y 22..44 while the crown sat at 8..13,
    // so 9 texels of a 56-texel plane — 0.26 m of the 1.6 m this thing stands —
    // had nothing in it but a few frond tips, and the green read as floating
    // above the pot. Same fault the user reported on the tax office plant, a
    // different cause: there it was foliage-to-pot, here it is crown-to-trunk.
    // Neither was two objects drifting apart; both were one texture drawn with a
    // hole in it. Checked the pot end too — trunk base 44 meets pot rim 43, and
    // the plane's bottom edge is on the floor, so that join was always sound.
    g.fillStyle = '#6a4a2a'; g.fillRect(18, 11, 3, 33);          // the trunk
    g.fillStyle = '#5c3f24'; g.fillRect(18, 11, 1, 33);          // its shaded side
    g.fillStyle = '#7a5632';                                      // the ringed scars a palm has
    for (let y = 14; y < 43; y += 4) g.fillRect(17, y, 5, 1);
    // fronds, all of them hanging DOWN — that is the whole difference between
    // a palm and a dead palm, and it is worth more than any amount of brown
    const frond = (x0: number, y0: number, dx: number, n: number, col: string) => {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        g.fillRect(Math.round(x0 + dx * i), Math.round(y0 + i * i * 0.16), 2, 2);
      }
    };
    frond(19, 12, -2.0, 9, '#7a6a34');
    frond(20, 11, 2.1, 9, '#6a5c2c');
    frond(19, 14, -1.2, 8, '#5c5228');
    frond(20, 13, 1.3, 8, '#7a6a34');
    frond(19, 10, -0.3, 7, '#6a5c2c');
    g.fillStyle = '#8a7c3a'; g.fillRect(17, 8, 5, 5);            // the crown, gone to straw
    g.fillStyle = '#8a5a3a'; g.fillRect(12, 44, 15, 12);         // the pot
    g.fillStyle = '#7a4a2e'; g.fillRect(11, 43, 17, 3);
    g.fillStyle = '#3a2e22'; g.fillRect(14, 45, 11, 2);          // dry soil
    dither(g, 40, 56, 24);
  }), 'detail');
  const palm = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6),
    new THREE.MeshBasicMaterial({ map: palmT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(palm, -4.8, 0.8, 3.6);
  solid(-4.8, 3.6, 0.5, 0.5);

  // ── the hotel in its prime, hung crooked over the back wall ──
  //
  // The back wall was the one bare surface in the room, and the thing that
  // belongs on it is the argument the whole lobby is making: a framed
  // photograph of the ORPHEUS when the awning was new and there were cars
  // outside. Hung a few degrees off level, because nobody has straightened it
  // in years — which says more about the place than any amount of dirt would.
  const photoT = declareSurface(pixTex(56, 40, (g) => {
    g.fillStyle = '#4a3624'; g.fillRect(0, 0, 56, 40);           // the frame
    g.fillStyle = '#6a5238'; g.fillRect(1, 1, 54, 38);
    g.fillStyle = '#cfc6ae'; g.fillRect(4, 4, 48, 32);           // the mount
    g.fillStyle = '#9a9184'; g.fillRect(7, 7, 42, 26);           // the photograph, gone sepia
    g.fillStyle = '#7a7266'; g.fillRect(7, 7, 42, 9);            // the building above
    g.fillStyle = '#6a6256';
    for (let x = 9; x < 48; x += 6) g.fillRect(x, 9, 3, 5);      // its windows
    g.fillStyle = '#8a7c5a'; g.fillRect(7, 16, 42, 3);           // the awning, when it was new
    g.fillStyle = '#5a5248'; g.fillRect(7, 27, 42, 6);           // the street
    g.fillStyle = '#6a6258';
    for (const cx of [12, 24, 38]) g.fillRect(cx, 24, 8, 4);     // cars outside it
    g.fillStyle = 'rgba(190,215,225,0.14)'; g.fillRect(4, 4, 48, 32);
    dither(g, 56, 40, 30);
  }), 'detail');
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.75), ctx.flat(photoT));
  photo.rotation.z = 0.035;                                       // crooked, and left that way
  put(photo, 1.2, 1.85, -hd + 0.06);

  // The standing ashtray that stood at (4.5, -0.7) is gone: the cigarette urn by
  // the lift is 1.9 m away at (4.8, -2.6) and does the identical job. Two
  // near-identical objects two metres apart on the same wall is exactly what
  // reads as strewn, and the urn is the better of the two.

  // ── a picture rail, chipped ──
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.07, 0.04), mahogM), 0, 2.35, -hd + 0.02);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, room.D), mahogM), -hw + 0.02, 2.35, 0);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, room.D), mahogM), hw - 0.02, 2.35, 0);

  // ── the ceiling: a surface, where there was a hole ────────────────────
  //
  // THE COMPLAINT. The user, on this room: *"hotel interior is strange. needs
  // some work"* — and of the five things that could be seen in his frame, four
  // are this room's stated design and were surveyed and refused
  // (notes/ninetyseven-item96-hotel-survey.md). The one that survived is the
  // ceiling, and it is CONDITIONAL: it only reads badly looking ACROSS the room.
  //
  // MEASURED, before touching anything, on the built bundle at a pinned 13:00
  // (scripts/probes/w101-hotel-ceiling.mjs):
  //
  //     vantage     ceiling cover   distinct RGB in it
  //     across-e         39.6%              (one)
  //     across-w         43.6%              (one)
  //     along            22.8%              (one)
  //     entry            23.0%              (one)
  //
  // Two facts, and neither is the colour.
  //
  // ONE: `ct/interior.ts:889` builds every room's ceiling as
  // `MeshBasicMaterial({ color })` with NO MAP. This file's own `paint.ts`
  // already has the diagnosis written down, for the ground: *"an untextured
  // quad has no grain for the eye to attach to and no joints to give it scale,
  // so it reads as a TINT OVER the paving rather than as a piece of paving."*
  // B measured 123 ground-facing surfaces in that state and it was behind four
  // separate user complaints. **Nobody ever swept the ceilings.** In the ten
  // pale rooms it does not show — a flat #c4c1b4 at 2.5 m passes for plaster.
  // Here it is the darkest ceiling in the world (luminance 32 against the
  // wall's 49) on the tallest room in the belt, and a large dark field with
  // literally one colour in it does not read as dark, it reads as ABSENT.
  //
  // TWO: nothing terminated the wall. This room has a skirting and a picture
  // rail at 2.35, and then 1.05 m of bare ox-blood running into black with a
  // razor-sharp step and no moulding. That step is why the eye reads the black
  // as *behind* the wall rather than *above* it.
  //
  // Which is the whole of "why only across the room": look ALONG it and there
  // is a lit pendant in frame, both side walls converging, and the field is 23%
  // of the picture. Look ACROSS and there is no lamp above you — they hang in a
  // single file down the centreline — the field nearly doubles to 40%, and it
  // is bounded by one straight edge. Same ceiling, twice the frame, none of the
  // things that were explaining it.
  //
  // SO THE COLOUR IS NOT CHANGED. `H_CEIL` stays exactly what it was and the
  // ceiling stays darker than the wall, because that is this room's own written
  // rationale (*"so the room feels tall and the light hangs IN it"*) and because
  // the frame the survey called handsome is the one lit by that darkness. What
  // it gets instead is what it never had: grain, joints, and an edge.
  {
    // THE COFFER FIELD. `slabTex` sized from the room's REAL METRES and mapped
    // 1:1 — so the joints land on a grid I chose rather than wherever a repeat
    // happens to cut, and BUILDER-BRIEF §7b's rule ("declare the density,
    // derive the repeat") is satisfied by there being no repeat at all.
    //
    // 12 px/m is the kit's own wall density (ct/interior.ts:908, 32 px per
    // 2.7 m ≈ 11.9), matched rather than picked, so the ceiling does not draw
    // at a different grain from the wall it meets. `joint: 1.3` is a plaster
    // panel a person can read the size of; at 5.2 m — the beam bay below — the
    // panels are too big to give the field any scale, which is the failure this
    // is fixing, one size up.
    //
    // `grain: 0.055`, and that number was WALKED BACK from 0.11 by looking at
    // the frame it made. `slabTex` scales its speckle CONTRAST off `grain`
    // (paint.ts:139), so 0.11 on a near-black base put pale texels at RGB
    // ~(84,69,68) — and at 11.9 px/m one texel is 8.4 cm, so from underneath
    // they read as a ceiling with bits MISSING rather than as plaster. Half the
    // grain is still far clear of the "no grain at all" this exists to fix.
    const CEIL_PPM = 32 / 2.7;
    const ceilT = slabTex({
      wMeters: room.W, dMeters: room.D, ppm: CEIL_PPM, joint: 1.3, grain: 0.055,
      base: '#' + new THREE.Color(H_CEIL).getHexString(), kind: 'detail',
    });
    // 1 cm below the kit's, the same way the carpet is laid 7 mm over the kit
    // floor. It is under the kit's rose (H − 0.03) so the fittings still sit in
    // it, and 1 cm is far enough that nothing z-fights.
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(ceilT));
    ceil.rotation.x = Math.PI / 2;                      // faces DOWN
    put(ceil, 0, room.H - 0.010, 0);

    // THE PRINCIPAL BEAMS, on the bay joints. Four of them, spanning the width,
    // never on a lamp — see `bayZ`. They are the reason the field can stay dark:
    // a dark recess between beams is a coffer, where a dark plane is a hole.
    //
    // A FIFTH OF THE WAY FROM THE CEILING TO THE TRIM — a rib moulded IN the
    // ceiling, not a sawn timber laid across it. My first try read as a barn
    // roof, which is a change of the room's character and not the sightline fix
    // that was asked for.
    //
    // ⚠ AND `THREE.Color.lerp` IS NOT THE TOOL FOR THAT, which cost me a round.
    // `new THREE.Color(hex)` converts sRGB into the LINEAR working space, so a
    // lerp there is a photometric mix and not the mix the eye reads: dropping
    // the parameter from 0.30 to 0.17 moved the beams from RGB (85,63,31) to
    // (72,52,31) — thirteen levels, invisible in the re-shot frame, which is
    // the only reason I caught it. Every other colour in this file is a
    // hand-picked sRGB hex, so the blend belongs in the same space they were
    // chosen in.
    const mixHex = (a: number, b: number, k: number) => {
      const ch = (s: number) => Math.round((((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k));
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    const beamM = new THREE.MeshBasicMaterial({ color: mixHex(H_CEIL, H_TRIM, 0.21) });
    for (let i = 1; i < LAMP_N; i++) {
      put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.15, 0.30), beamM), 0, room.H - 0.075, bayZ(i));
    }
    // …and two down the length, so the coffers are squarish rather than eleven
    // metres of unbroken plank. At ±W/4 they miss the centreline the lamps hang
    // on by 2.75 m.
    for (const bx of [-room.W / 4, room.W / 4]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, room.D), beamM), bx, room.H - 0.065, 0);
    }

    // THE CORNICE — the thing that was actually missing. A moulding capping all
    // four walls: a deep member in the gone-dusty gold this room already uses
    // high up, and a thin lit fillet on its bottom arris, which is what reads as
    // a moulded edge rather than a stripe. Both colours DERIVED off `H_TRIM`
    // rather than picked to look similar.
    //
    // Its underside sits at 3.24 m. The two things nearest it are the corridor
    // sign (top 3.21) and the window pelmet (top 2.97), so it clears both — the
    // sign by 3 cm, which is why the member is 0.16 deep and not 0.20.
    const cornM = new THREE.MeshBasicMaterial({
      color: new THREE.Color(H_TRIM).multiplyScalar(0.62) });
    const fillM = new THREE.MeshBasicMaterial({
      color: new THREE.Color(H_TRIM).multiplyScalar(0.88) });
    const CORN_H = 0.16, CORN_P = 0.13, FILL_H = 0.035;
    const cy = room.H - CORN_H / 2, fy = room.H - CORN_H - FILL_H / 2;
    for (const [sz, z] of [[1, hd], [-1, -hd]] as [number, number][]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(room.W, CORN_H, CORN_P), cornM), 0, cy, z - sz * CORN_P / 2);
      put(new THREE.Mesh(new THREE.BoxGeometry(room.W, FILL_H, CORN_P + 0.04), fillM),
        0, fy, z - sz * (CORN_P + 0.04) / 2);
    }
    for (const [sx, x] of [[1, hw], [-1, -hw]] as [number, number][]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(CORN_P, CORN_H, room.D), cornM), x - sx * CORN_P / 2, cy, 0);
      put(new THREE.Mesh(new THREE.BoxGeometry(CORN_P + 0.04, FILL_H, room.D), fillM),
        x - sx * (CORN_P + 0.04) / 2, fy, 0);
    }
  }

  // ── the pendants, hanging from the kit's own roses ──
  //
  // These used to be a SECOND set of fittings on a second grid, and that is the
  // "different rhythms" the user saw. They are now the same fixture as the
  // kit's: the kit draws the rose and the diffuser at the ceiling on `lampZ`,
  // and this hangs the brass stem and the faceted glass bowl below it on the
  // same z and the same centreline, so a rose and a bowl read as one lamp.
  //
  // The dead one is drawn DIFFERENTLY, not just unlit: a cold grey shade against
  // four warm ones. An unlit copy of a lit thing reads as a rendering mistake; a
  // different colour reads as a dead bulb. It is index LAMP_DEAD — the same
  // index the kit was handed — so the grey shade and the blackened tube above it
  // are the same lamp rather than two different ones being out.
  const glowT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(248,214,140,0.42)');
    gr.addColorStop(1, 'rgba(248,214,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // "a chandelier or a run of glass fixtures instead of flush ceiling discs".
  // A RUN, not a chandelier, because the brief this room was built to also says
  // one lamp is out, and five fixtures with one dead tells that story where a
  // single central chandelier cannot. They hang — brass stem, brass gallery,
  // faceted glass bowl — instead of sitting flush, which is most of what makes a
  // ceiling read as tall. A single file down the centre of a 26 m room is also
  // what a lobby this shape actually had: one run you walk under.
  const litShadeM = new THREE.MeshBasicMaterial({ color: 0xf0d9a0 });
  const deadShadeM = new THREE.MeshBasicMaterial({ color: 0x6e6a62 });
  const galleryM = new THREE.MeshBasicMaterial({ color: 0xd8a83a });
  const FITTINGS: [number, number, boolean][] = Array.from(
    { length: LAMP_N }, (_, i) => [0, lampZ(i), i !== LAMP_DEAD]);
  for (const [lx, lz, lit] of FITTINGS) {
    // No ceiling rose here any more — the kit draws one at H - 0.03 with its
    // dome under it reaching down to H - 0.185, and mine was a second rose in
    // the same 4 cm of ceiling. The stem starts BELOW that, so the run reads
    // rose -> stem -> bowl as one fitting.
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.50, 6), brassM), lx, room.H - 0.45, lz);
    // the gallery the bowl sits in
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.06, 6), galleryM), lx, room.H - 0.73, lz);
    // the bowl: a faceted glass dish, wider and shallower than the old disc
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.16, 0.24, 8), lit ? litShadeM : deadShadeM),
      lx, room.H - 0.88, lz);
    if (lit) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), glowM);
      gl.rotation.x = Math.PI / 2;
      put(gl, lx, room.H - 0.63, lz);
    }
  }

}

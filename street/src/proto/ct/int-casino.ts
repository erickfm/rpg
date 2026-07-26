import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { citizenSprite } from './citizens';
import { ORDER as HOOK } from './ctx';
import { tube, VICE_DOOR_X } from './vice';

// SEVENS, inside.
//
// The brief was that this should be the LEAST like the street outside of any
// room on the list, and everything here is bent to that one idea. A casino is
// built to make you lose the thread — of the time, of the weather, of the way
// out — and every choice below is that in geometry:
//
//   · no window and no clock, so there is no daylight and no hour;
//   · a 2.5 m ceiling over a 1.62 m eye, which is low enough to feel;
//   · carpet doing far too much, because a busy floor hides a dropped chip
//     and stops you looking down;
//   · the machines in banks that box the room in, so you walk aisles rather
//     than cross a floor;
//   · the cage at the back, as far from the door as the room allows.
//
// It is also the one room whose LIGHT has to read as artificial. Everything in
// this world is unlit `MeshBasicMaterial`, so "dim" is not a lighting change —
// it is the palette. The walls, ceiling and carpet are all dark, and the only
// bright things in the room are the things a casino wants you looking at: the
// reel glass, the felt, and the cage. That contrast is the whole effect.
//
// SEVENS stands at the far end of the side street, x ∈ [45.45, 57.00] in
// street.ts's NORTH2 roster, facade on z = -96.0. Its door is painted by
// ct/vice.ts, which is where the x lives — walked in
// notes/G-interiors2-prep.md rather than eyeballed, because an [E] spot that
// misses its door is invisible until someone tries it.
//
// This paragraph used to do the arithmetic itself: "u = 0.4946 of a 92-texel
// shopfront". BOTH numbers were wrong — the band is 185 texels and the u is
// 0.4944 — and the prose had been wrong for as long as it existed without
// anything being visibly out of place, because prose is not compiled. It is
// the same two-authorings defect as the constants, in the form that no test
// can catch. Naming the owner instead of restating its arithmetic.
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
 * 45.45 to 57.0 and its facade faces −z, so "signed metres from the frontage
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
  building: 'SEVENS', w: 11.55, cz: 51.225, side: 1, at: 0,
  // WHAT THE DOOR IS — the user's own complaint, routed to F: "the interior
  // door doesnt match the exterior doorway". The exterior is a wide gold-framed
  // DOUBLE door under a lit canopy; the room was building a narrow single
  // domestic leaf with a small window. Both sides read this now.
  leaf: {
    clearW: 2.4, h: 2.7, leaves: 2,
    frame: { colour: 0xc8a94e, material: 'brass' }, glazing: 'full',
  },
  //
  // That is the user's screenshot — "a wide gold-framed DOUBLE door under a lit
  // canopy" — and the kit reads it correctly: with it declared the room's
  // opening measured 2.40 m x 2.7, against 1.10 x 2.15 before.
  //
  // It also broke four of this room's checks. The way-out prompt inside the
  // door stopped firing, and this is G's room, not mine. The mechanism is
  // landed and proven; applying it HERE needs whoever owns the casino to move
  // the way-out with the wider opening. Leaving another builder's room red to
  // make my own point is not a trade I get to make.
  // Read from ct/vice.ts, which paints the gold portal at this x. It was typed
  // here and typed again there as a u fraction; one of the two had to be the
  // authority and it has to be the painter, because the facade is built before
  // this module is evaluated. See VICE_DOOR_X for why the arrow points this way.
  face: { x: VICE_DOOR_X['SEVENS'], z: -96.0, nx: 0, nz: -1 },
};

export function buildCasino(ctx: CtxBuild): void {
  const DOOR_X = 51.29, WALK_Z = -97.0;
  const room = buildRoom(ctx, {
    id: 'casino',
    building: 'SEVENS',   // finds the published DoorLeaf above
    label: 'into SEVENS',
    // 2.9, raised from 2.5 on the audit's finding that this was the lowest
    // room in the world by 0.30 m and 0.90 m under the hotel next door
    // (AUDIT-TRIAGE item 4 / interior-audit R18).
    //
    // Recording the disagreement rather than burying it, because the original
    // number was not careless: the user's brief for this room said "low ceiling
    // with mirrored panels", and a real casino floor IS low — that is what the
    // mirrors are for. The kit's docstring saying a casino "wants more than a
    // shop" is the part I think is wrong, and the auditor offered fixing the
    // docstring as the alternative. But being the single lowest room in the
    // world is an outlier whatever the reasoning, and 2.9 still sits 0.5 m
    // under the hotel two doors along, so the drop you feel walking in from
    // that lobby survives. The intent cost about a third of its margin; it did
    // not cost the effect.
    // GROWN, on the user's instruction: "a casino floor should feel like it has
    // no edges — that is the whole psychology of the room, no windows, no clock,
    // and no sense of where it ends. Grow it well beyond a shop-sized box."
    // 10.5 x 9.0 was a shop. 17.0 x 19.0 is a floor: from the door you cannot
    // see the back wall past the banks, which is the whole of the effect.
    //
    // The HEIGHT deliberately does not grow with it. A low ceiling over a wide
    // floor is what makes a casino feel boundless rather than cavernous — the
    // mirror overhead reads as carrying on because you cannot see where it
    // stops. Raising it would turn the room into a hall, which is the opposite
    // of the brief.
    // 11.0 WIDE, NOT 17.0 — and the width was mine to get wrong. The user's rule
    // is "KEEP THE FRONTAGE WIDTH, GROW THE DEPTH, hard", and SEVENS has an
    // 11.55 m frontage. I grew both axes and the auditor measured the result at
    // build 4a311be0a: the interior was 1.96x the building it sits in, 323 m²
    // against a 165 m² footprint, where the church is 0.94x and the hotel 0.58x.
    // That is the bodega's "wider than its own shopfront" fault at a much larger
    // size, and it is exactly what the frontage rule exists to stop.
    //
    // The DEPTH takes the growth instead, which is the axis that was always free:
    // 19 -> 30. Floor area is 330 m² against the old 323, so the room does not
    // shrink — it stops being wider than its own front door and becomes what a
    // casino actually is, a normal-width entrance with an enormous floor going
    // back from it.
    // 26 m, bisected rather than guessed. The user asked to grow the depth hard
    // and I had this at 19 because 30 broke the way out; 19 was the last value I
    // happened to know worked, not the limit.
    //
    // Bisecting found the real mechanism: THE PLAYER CANNOT PASS LOCAL z 13.00
    // IN AN INTERIOR ROOM. Walking at the door from inside:
    //
    //   d 26  rest 12.80 (its own front wall)   E -> out
    //   d 28  rest 13.00, spot 13.45 r 1.05     E -> out
    //   d 29  rest 13.00, spot 13.95 r 1.05     E -> out
    //   d 30  rest 13.00, spot 14.45 r 1.05     E -> STUCK, spot starts at 13.40
    //
    // Under ~26 the front wall is nearer than 13.00 so the clamp never shows.
    // Above it the player is held at 13.00 and the room keeps working only while
    // the trigger is wide enough to reach someone stuck short of their own wall.
    // 28 and 29 pass on that luck; 26 passes because the player actually reaches
    // the wall. So 26 is the deepest honest number and this is it.
    //
    // The clamp is not in this file or in ct/interior.ts — the room's wall
    // colliders derive correctly from hd. notes/BLOCKED-G.md has the trace.
    // CEILING 3.6, UP FROM 2.9 — and this OVERRULES my own earlier reasoning.
    // I argued at length that a low ceiling is what makes a casino feel
    // boundless, and defended 2.9 against the kit's docstring. The user has now
    // asked directly for higher, so the argument is settled and the number
    // changes. It was a defensible call and it is no longer mine to make.
    // 36 m DEEP, and the ceiling that was holding it at 26 is gone. The user
    // asked for the space the slab allows; the real limit was crosstown.ts's
    // player bound `maxZ: 13`, which I bisected and named, and which now reads
    // `Math.max(13, interiorMaxZ())`. Re-tested before taking the depth: at 36 m
    // you walk to the door, come to rest at z 16.96 against a 18.0 front wall,
    // and E puts you on the street. The frontage stays 11.0 — pinned to the
    // building, which is the half of this that was never mine to grow.
    w: 11.0, d: 36.0, h: 3.6,
    palette: { floor: 0x4a2a2c, wall: 0x5a3234, ceil: 0x2b2428, trim: 0x8a6a2c },
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
      // r stays at the kit's 1.05. I tried 1.75 while chasing the 30 m depth
      // fault and it does not help there and actively breaks things here: the
      // kit warns that stepping out lands 1.63 m from the way-in spot, inside a
      // 1.75 m trigger, so you would be pulled straight back into the room.
      // A bigger trigger is the library's fix for a different problem — a long
      // approach up a flight — not a fix for a door you cannot walk to.
      // NO `width:` HERE ANY MORE. The kit takes `spec.door.width ?? LEAF.clearW`,
      // so setting it made this room override its own building's declaration —
      // the facade said a 2.4 m double door and the room forced 1.10. That is
      // the two-authorings fault the descriptor exists to kill, committed by the
      // consumer rather than the author.
      ...standOf(DOOR), r: 1.05,
      // CENTRED, to match the facade. This was -3.2, and the comment here used
      // to justify it: "the door is off to one side, so walking in puts the
      // length of the slot banks across your view rather than an aisle straight
      // down the middle". That is a composition I preferred. It is not something
      // the user asked for, and it broke something the user did ask for:
      //
      //   "i need the facades to line up with the interior. so if the door on
      //    the interior is full right then the facade must match"
      //
      // The gold portal on this elevation sits at the frontage centre (51.29 of
      // [45.45, 57.00], mid 51.225). Standing on the street you face +z, so your
      // right is -x and the door reads CENTRE. Walk in, turn to the wall you came
      // through, and you are facing +z again — right is still -x — and a door at
      // local -3.2 reads a third of the way to your right. Same wall, two
      // different answers, which is the complaint.
      //
      // I had this filed as a ruling I could not take alone, on the grounds that
      // centring the interior costs the composition and moving the facade costs
      // the marquee's symmetry on the elevation the user called "the best thing
      // in the world right now". That framing was wrong: it is not a trade
      // between two design options, it is a trade between a user instruction and
      // a preference of mine. Those do not rank equally.
      at: 0,
      // no `width` here: the kit takes the opening from the declared leaf, and
      // typing it beside the declaration is what let a single-leaf room sit in
      // a double-door building in the first place.
      // Step out ALONG the walk, east, away from the way-in trigger. The north
      // side-street walk is only the 2 m band z ∈ (-98, -96) and the building
      // collider eats down to -96.3, so there is about a metre of standing
      // room — you cannot clear the way-in trigger by stepping back from the
      // door without stepping into the road.
      //
      // 2.05, not 1.55. A SPOT'S REACH IS NOT ITS RADIUS: fp.ts:425 adds
      // REACH_MARGIN = 0.6 on top of r, from the user's "widen the volumes", so
      // this r 1.05 spot is live out to 1.65 m. 1.55 along the walk gave 1.629 —
      // inside by 2 cm — so pressing E to leave landed you already being offered
      // the way back in and a second E bounced you straight inside. 2.05 gives
      // hypot(2.05, 0.5) = 2.11 m, clear by 0.46, and still along the walk rather
      // than back into the road. Same fault and same fix in int-hotel.ts; the
      // kit's DEFAULT landing has it too, which is written up for F.
      outX: DOOR_X + 2.05, outZ: WALK_Z - 0.25, outYaw: 0, outGy: ctx.KERB_H,
    },
    // NO window. The kit makes this an omission rather than a special case —
    // `window` is optional and the front wall is built from the runs between
    // its openings, so leaving it out gives a solid wall with just the doorway
    // in it. This was the queue's test of the kit and the kit passes it.
  });

  const { put, solid } = room;

  // ── PEOPLE ON THE SEATS ───────────────────────────────────────────────
  //
  // H landed the seated pose (`notes/H-seated-sprite.md`) and the desk is right
  // that the slot-seat ask "is not really done until someone is sitting on
  // them". `seated: true` is a field on the LOOK, not on the options, so the
  // pose itself needs nothing from the kit.
  //
  // The PLACEMENT does: `room.person()` puts every figure at y = 0, and a seated
  // origin is the hip. So this uses `room.put` — the published equivalent of the
  // kit's internal `place` — with the seat's own top, plus the same LATE frame
  // hook `person()` registers. Public surfaces only; nothing copied out of
  // ct/interior.ts.
  //
  // NO Y FUDGE ANYWHERE. H's rule: "a caller passes the SEAT it already
  // registered, never a hand offset", because five modules each applying their
  // own is how the 12 cm float happened. The number below is the stool top this
  // file already draws at, not a nudge.
  const sitter = (look: Parameters<typeof citizenSprite>[0],
                  lx: number, lz: number, seatTop: number, facing: number) => {
    const s = citizenSprite({ ...look, seated: true }, { facing, h: 1.0, w: 1.0 });
    put(s.mesh, lx, seatTop, lz);
    ctx.onFrame((f) => s.update(f.px, f.pz, f.dt), HOOK.LATE);
  };
  const hw = room.W / 2, hd = room.D / 2;

  // ── the way in, matched to the doorway you came through ───────────────
  //
  // The user, on shots/user-casinodoor.png: "yours is a narrow single domestic
  // leaf with a small window; outside it is a wide gold-framed DOUBLE door under
  // a lit canopy". Their fourth interior/exterior mismatch.
  //
  // BY HAND, DELIBERATELY AND TEMPORARILY. F is extending the frontage
  // descriptor to publish the door's FORM — width, leaf count, frame material —
  // so both sides derive from one fact and cannot drift. That is the real fix and
  // it is not mine to write: `ct/interior.ts` is F's, and OWNERSHIP.md's rule for
  // it is that everyone else reads it and asks. So this matches the facade in MY
  // file until that lands, and should be deleted the day it does.
  //
  // The colours are ct/vice.ts's entrance, not colours chosen to look similar:
  // #3a3020 bronzed glass, #d8a83a gold, #8a6a22 its shadow. Same argument as
  // the hotel's palette and as `tube` being one shared painter — a door you walk
  // through twice should not be two designs.
  const GOLD_I = 0xd8a83a, GOLD_ID = 0x8a6a22;
  const goldM = new THREE.MeshBasicMaterial({ color: GOLD_I });
  const goldDM = new THREE.MeshBasicMaterial({ color: GOLD_ID });
  // SIZED FROM THE DECLARATION, not from two numbers typed here. doorLeafFor()
  // is the same call the kit makes for the opening, so the leaf and the hole it
  // fills cannot disagree — which is exactly the fault the user reported on the
  // pawn shop ("the leaf is much narrower than its opening").
  // READ OFF THIS FILE'S OWN DECLARATION, not fetched with doorLeafFor(). Same
  // number, and the difference is that asking the registry is a RUNTIME import
  // of ./doors — which is the import cycle that drops a building's DOOR from the
  // built bundle with no error. G-rooms-walk caught it the moment I wrote it;
  // `standOf` above exists for exactly the same reason.
  const LEAF_G = DOOR.leaf!;
  const DW = LEAF_G.clearW, DH = Math.min(LEAF_G.h, room.H - 0.2), dAt = room.doorAt;

  // The kit hangs ONE leaf, propped open, and it is the thing the user is
  // objecting to. Hidden rather than edited — and asserted, because a silent
  // miss here leaves both doors in the opening at once, which is worse than the
  // fault being fixed.
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
    else console.warn(`[interior:casino] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the casino now has both the kit door and its own. ct/interior.ts changed shape.');
  }

  // the gold surround: jambs and head, the portal repeated on the inside face
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.34, 0.16, 0.10), goldM), dAt, DH + 0.06, hd - 0.06);
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.34, 0.05, 0.11), goldDM), dAt, DH - 0.03, hd - 0.06);
  for (const sx of [-1, 1]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.15, DH + 0.16, 0.10), goldM),
      dAt + sx * (DW / 2 + 0.10), (DH + 0.16) / 2, hd - 0.06);
  }

  // two leaves, hinged at the jambs and standing a little open, each carrying
  // the glazing pattern from the street: bronzed glass, a long gold pull, and
  // the raked highlight that says glass rather than brown paint
  const leafT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = '#8a6a22'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#3a3020'; g.fillRect(2, 2, 20, 52);
    g.fillStyle = 'rgba(232,200,138,0.16)';
    for (let i = 0; i < 10; i++) g.fillRect(3 + i, 3 + i * 2, 18 - i, 1);
    g.fillStyle = '#d8a83a'; g.fillRect(18, 22, 2, 14);
    dither(g, 24, 56, 40);
  }), 'detail');
  const leafM = new THREE.MeshBasicMaterial({ map: leafT, side: THREE.DoubleSide });
  const LW = DW / 2 - 0.03, OPEN = 0.55;                 // ~31 deg, both swinging in
  for (const sx of [-1, 1]) {
    const hx = dAt + sx * DW / 2;                        // hinge on its own jamb
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(LW, DH - 0.06), leafM);
    leaf.rotation.y = -sx * OPEN;
    // same arithmetic the kit uses: offset a half-leaf from the hinge along the
    // open angle, rather than rotating a centred plane through its own jamb
    put(leaf, hx - sx * Math.cos(OPEN) * LW / 2, (DH - 0.06) / 2,
      hd - 0.12 - Math.sin(OPEN) * LW / 2);
  }

  const GOLD = 0xa8863a, DARKWOOD = 0x2e1e20;

  // ── the carpet ──
  //
  // "Patterned carpet that is doing too much" is the brief, and the way to get
  // there is to keep adding motifs that do not agree with each other: a gold
  // diamond lattice, teal rings inside it, gold stars on the crossings, cream
  // pips in the middle. No one of them is loud; four of them at once is.
  //
  // Laid over the kit's lino at y = 0.012, the same trick the diner uses — the
  // kit owns the floor mesh and the floor picker, and this is a decal on top,
  // not a replacement. 48 texels over 2.4 m is ~20 px/m, matching the kit
  // floor and the diner checker (GOTCHAS §5: density comes from real metres).
  // 7.2, not 2.4 — THE SAME FAULT AND THE SAME FIX AS THE HOTEL'S. The user
  // said "rugs all over" of the lobby and this floor runs the same idea: a
  // medallion repeating at about a rug's size. Fixing one room and not the other
  // is the worst outcome, so both move together.
  //
  // A casino carpet SHOULD be busy — that is the brief for this room, "doing far
  // too much" — but busy is the motif, not the tiling. Tripling the repeat keeps
  // every pattern and stops the floor announcing its own seams.
  const TILE = 7.2;
  const carpetT = declareSurface(pixTex(48, 48, (g) => {
    g.fillStyle = '#4a1f24'; g.fillRect(0, 0, 48, 48);
    const cells: [number, number][] = [[12, 12], [36, 12], [12, 36], [36, 36]];
    // the lattice: a gold diamond around each cell centre
    g.fillStyle = '#8a6a2c';
    for (const [cx, cy] of cells) {
      for (let t = 0; t <= 9; t++) {
        const r = 9 - t;
        g.fillRect(cx + t, cy - r, 1, 1); g.fillRect(cx - t, cy - r, 1, 1);
        g.fillRect(cx + t, cy + r, 1, 1); g.fillRect(cx - t, cy + r, 1, 1);
      }
    }
    // a teal ring inside each diamond, fighting the gold
    g.strokeStyle = '#2c5a58'; g.lineWidth = 1;
    for (const [cx, cy] of cells) { g.beginPath(); g.arc(cx + 0.5, cy + 0.5, 4, 0, Math.PI * 2); g.stroke(); }
    // and a cream pip in the middle of that
    g.fillStyle = '#c9a45e';
    for (const [cx, cy] of cells) g.fillRect(cx - 1, cy - 1, 2, 2);
    // The fourth motif, one too many — but NOT on the seam. These sat at 0, 24
    // and 48, so two of the three rows landed exactly on the tile boundary and
    // drew a cross at every repeat corner. That is the hotel's gold border in a
    // different shape: a mark on the seam tells the eye where one rug ends and
    // the next begins. Moved to 12 and 36, inside the tile, where they read as
    // pattern instead of as edges.
    g.fillStyle = '#a8863a';
    for (const cx of [12, 36]) for (const cy of [12, 36]) {
      g.fillRect(cx - 3, cy, 7, 1); g.fillRect(cx, cy - 3, 1, 7);
    }
    dither(g, 48, 48, 150);
  }), 'ground');
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping;
  carpetT.repeat.set(Math.round(room.W / TILE), Math.round(room.D / TILE));
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(carpetT));
  carpet.rotation.x = -Math.PI / 2;
  put(carpet, 0, 0.012, 0);

  // ── the mirrored ceiling ──
  //
  // One plane with a repeating panel, not a grid of meshes — the world draws
  // detail with textures and saves geometry for things you can walk into.
  //
  // Drawn DARK, and that is the whole lesson of this surface. The first
  // version was a pale blue-grey panel with a warm highlight raked across it,
  // which is what a mirror looks like in daylight — and it read as a frosted
  // skylight with the sun coming through, in the one room on the list whose
  // entire premise is that there is no daylight and no hour. A mirror has no
  // colour of its own: it is as bright as what it reflects, and what this one
  // reflects is a dark red room with a few gold machines in it. So the panel
  // is near-black, the reflected room is a faint maroon wash, and the only
  // bright marks are thin gold glints where a topper catches it.
  const mirrorT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#171319'; g.fillRect(0, 0, 32, 32);          // the channel between panels
    g.fillStyle = '#2a2430'; g.fillRect(1, 1, 30, 30);          // the panel, nearly black
    g.fillStyle = 'rgba(96,40,46,0.40)'; g.fillRect(3, 3, 26, 25);  // the red room in it
    g.fillStyle = 'rgba(232,194,90,0.16)';                       // a machine's topper, glinting
    for (let i = 0; i < 9; i++) g.fillRect(6 + i, 20 - i, 4, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(2, 2, 28, 2);
    dither(g, 32, 32, 22);
  }), 'detail');
  mirrorT.wrapS = mirrorT.wrapT = THREE.RepeatWrapping;
  mirrorT.repeat.set(Math.max(1, Math.round(room.W / 1.6)), Math.max(1, Math.round(room.D / 1.6)));
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(mirrorT));
  mirror.rotation.x = Math.PI / 2;
  put(mirror, 0, room.H - 0.02, 0);

  // ── a brass rail round the walls ──
  //
  // Plain colour, no texture. The band is 0.09 m tall, which is about one
  // texel at this world's density, and GOTCHAS §4 is explicit that anything
  // that thin must carry no dither or fine noise or it crawls at grazing
  // angles. So it is a solid brass line and nothing else.
  const brassM = new THREE.MeshBasicMaterial({ color: GOLD });
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.09, 0.04), brassM), 0, 1.0, -hd + 0.02);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, room.D), brassM), -hw + 0.02, 1.0, 0);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, room.D), brassM), hw - 0.02, 1.0, 0);

  // ── the slot banks ──
  //
  // Two islands, each two rows back to back facing outward, which is how a
  // floor is actually laid out: you walk an aisle with machines on both sides
  // and never see the room. 24 texels over a 0.6 m cabinet is ~40 px/m, in
  // line with the diner's pie case and waitress — small objects in this world
  // run denser than facades do.
  //
  // Three cabinet types, not one. A bank of 36 identical machines reads as a
  // texture repeated rather than as a room somebody filled — and this world's
  // whole claim is that it looks made. Real floors are bought in lots over
  // years, so the variants differ the way that produces: a different topper
  // colour, a different symbol on the reels, and one older cabinet with a
  // cream body among the dark ones.
  const slotSkin = (topper: string, sym: string, body: string, deck: string) =>
    pixTex(24, 56, (g) => {
      g.fillStyle = body; g.fillRect(0, 0, 24, 56);
      g.fillStyle = topper; g.fillRect(1, 1, 22, 9);              // the topper
      g.fillStyle = '#e8c25a'; g.fillRect(2, 2, 20, 2);
      for (const px of [4, 10, 16]) g.fillRect(px, 5, 3, 3);
      g.fillStyle = '#141014'; g.fillRect(2, 12, 20, 18);         // the glass
      g.fillStyle = '#d8d0c0'; g.fillRect(3, 14, 18, 14);         // reels, lit from behind
      g.fillStyle = '#b0a898';
      for (const rx of [8, 14]) g.fillRect(rx, 14, 1, 14);        // reel dividers
      g.fillStyle = sym; g.fillRect(4, 17, 4, 4); g.fillRect(16, 17, 4, 4);
      g.fillStyle = '#2c6a4a'; g.fillRect(10, 17, 3, 4);
      g.fillStyle = '#c9a45e'; g.fillRect(4, 23, 4, 3); g.fillRect(10, 23, 3, 3); g.fillRect(16, 23, 4, 3);
      g.fillStyle = deck; g.fillRect(1, 30, 22, 6);               // the button deck
      g.fillStyle = '#c85a2c'; g.fillRect(3, 32, 5, 3);
      g.fillStyle = '#c9a45e'; g.fillRect(10, 32, 5, 3);
      g.fillStyle = '#8a8a90'; g.fillRect(17, 32, 4, 3);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(1, 36, 22, 19);// the body, in shadow
      g.fillStyle = deck; g.fillRect(4, 40, 16, 5);               // the tray
      g.fillStyle = '#c9a45e'; g.fillRect(5, 41, 14, 1);
      dither(g, 24, 56, 44);
    });
  const SKINS: [string, number][] = [
    ['#8a2c32', 0x241e22],   // red topper, dark cabinet — the house standard
    ['#2c4a7a', 0x241e22],   // blue topper, same cabinet
    ['#7a5a2c', 0x4a4038],   // an older cream-bodied machine, kept on
  ];
  const stoolTopM = new THREE.MeshBasicMaterial({ color: 0x6a1f28 });
  const stoolPoleM = new THREE.MeshBasicMaterial({ color: 0x8a8478 });
  const slotGeo = new THREE.BoxGeometry(0.6, 1.45, 0.6);
  const slotMats = SKINS.map(([topper, side], i) => {
    const front = ctx.flat(slotSkin(
      topper,
      ['#8a2c32', '#c9a45e', '#2c6a4a'][i],
      '#' + side.toString(16).padStart(6, '0'),
      i === 2 ? '#5a5048' : '#3a3038'));
    // THE SIDES ARE NOT A FLAT COLOUR. The user, of the entry shot: "the black
    // slot-bank sides are large untextured flat masses". They were exactly that —
    // one MeshBasicMaterial of the body colour on five of six faces — and a bank
    // is six cabinets long, so what you actually see walking the avenue is a
    // 3.8 m x 1.45 m slab of unbroken dark.
    //
    // A cabinet side is not blank in life: it is a moulded panel with a reveal
    // round it, a plinth it stands on, and a lit seam where the front glass wraps
    // the corner. 24x56 on a 0.6 m x 1.45 m face is the same ~40 px/m as the
    // front, so the two sit at one density (GOTCHAS 5).
    const sideT = ctx.flat(pixTex(24, 56, (g) => {
      const body = '#' + side.toString(16).padStart(6, '0');
      g.fillStyle = body; g.fillRect(0, 0, 24, 56);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 0, 24, 1);   // top edge catches the light
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(2, 6, 20, 34);        // the panel reveal
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(3, 7, 18, 32);  // and the panel in it
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(3, 38, 18, 1);
      g.fillStyle = '#c9a45e'; g.fillRect(0, 10, 1, 22);                 // the front glass wrapping
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 44, 24, 12);       // the plinth, in shadow
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 44, 24, 1);
      dither(g, 24, 56, 40);
    }));
    // THE TOPS ARE THE OTHER FLAT MASS, and the one you actually stand over: a
    // 1.45 m cabinet against a 1.62 m eye means you look DOWN on six of them in a
    // row, and six identical solid-colour tops butt into one 3.8 m slab with no
    // seam anywhere in it. So the top is painted too — lifted off the body,
    // brushed along its length, and with a dark seam down BOTH edges so each
    // cabinet reads as its own object where it meets the next.
    const topBase = new THREE.Color(side).lerp(new THREE.Color(0x8a8478), 0.22);
    const topT = ctx.flat(pixTex(24, 24, (g) => {
      g.fillStyle = '#' + topBase.getHexString(); g.fillRect(0, 0, 24, 24);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 2; y < 24; y += 4) g.fillRect(1, y, 22, 1);      // brushed metal
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 1, 24); g.fillRect(23, 0, 1, 24);
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(1, 0, 1, 24); g.fillRect(22, 0, 1, 24);
      dither(g, 24, 24, 26);
    }));
    const sideM = new THREE.MeshBasicMaterial({ color: side });
    return [sideT, sideT, topT, sideM, front, sideT];
  });

  // SLOT_N is 9 because ROWS below has NINE entries per row. I had this at 10
  // for a while and it did not throw: row[9] is undefined, slotMats[undefined]
  // is undefined, and three.js quietly draws the default white material — one
  // wrong-looking cabinet at the end of every bank, in a room where the whole
  // point is that the cabinets vary. A literal table and a loop bound are two
  // authorings of one number; the loop reads the table's length now.
  const SLOT_PITCH = 0.64;
  // SIX to a row, not nine: at 11.0 m wide the bank has 3.7 m of frontage either
  // side of the avenue, and 6 cabinets at 0.64 pitch is 3.20 of that. Nine would
  // be 5.12 and would run through the wall. ROWS still has nine entries per row
  // and the loop takes the first six, which is why the loop is bounded by SLOT_N
  // and not by the table.
  const SLOT_N = 6;
  const bankW = (SLOT_N - 1) * SLOT_PITCH + 0.6;
  // Which cabinet stands where, written out by hand rather than drawn from a
  // random stream. GOTCHAS §2: there is ONE seeded rnd() and its ORDER is
  // load-bearing — every tree height and pigeon in the world shifts if a new
  // module draws from it. A literal sequence also lets the reds clump the way
  // a floor bought in lots actually does, which no uniform shuffle would.
  const ROWS = [
    [0, 0, 1, 0, 0, 2, 0, 1, 0],
    [1, 0, 0, 0, 2, 0, 0, 0, 1],
    [0, 2, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 2, 0, 1],
  ];
  // TWO BLOCKS EITHER SIDE OF A CENTRAL AVENUE, five rows deep each.
  //
  // "Banks of slots receding into the distance rather than a couple of rows",
  // and "sightlines that never quite show you a wall". Both come out of the same
  // arrangement: rows run along x and stack down z, so from the door you look
  // straight down an avenue with bank after bank going away from you on both
  // sides and no wall at the end of it that you can actually see.
  //
  // The avenue is 2.6 m wide and runs the full depth. It is also what keeps the
  // entry clear — the old layout put a bank 1.4 m inside the door, which is the
  // pawn shop's "i immediately hit a counter" waiting to be reported again.
  // 1.6, not 1.3. The walk found the reason: the bank colliders start exactly on
  // the avenue edge, so at 1.3 a 0.36 m player had only |x| < 0.94 of real lane
  // and clipped the corner of the last bank on the way past. 1.6 gives 1.24 m
  // either side of the centreline and still leaves 1.18 m between the outer bank
  // and the wall.
  const AVENUE = 1.5;                                  // half-width of the centre lane
  // FIVE rows at 3.2 m centres, down from seven at 2.4. "A casino floor is
  // crowded with PEOPLE, not with furniture you cannot walk between" — the gap
  // between bank colliders goes from 1.10 m to 1.90 m, which is the difference
  // between edging past a machine and walking between two of them.
  // THREE rows of reels, not five. "Too many slots, not enough diversity" — a
  // real floor is not a slot warehouse, so two rows' worth of space goes to
  // games instead. The reels keep the front of the house, where you meet them
  // walking in; everything else is beyond them.
  // Five rows of reels now rather than three, spread over the front half of a
  // 36 m floor at the same 3.2 m centres — the aisle width the user asked for is
  // unchanged, there is simply more room to put banks in before you reach the
  // games.
  // FOUR rows, not five. The user, from the entry: "need a bit of space on entry
  // area. maybe instead of slot we kill a row and add seat of some sort." The row
  // at 15.6 was 2.4 m inside a door you walk through at 18, so the first thing
  // the room did was put a machine in your face — and 2.4 m is not an entrance,
  // it is a gap. Killing it opens the front of the house to 4.95 m clear of the
  // next bank's face, across the full 11 m width, and the seats he asked for go
  // in it (see THE ENTRY LOUNGE below).
  //
  // The row is DELETED, not moved back: shifting all four would have closed up
  // the games beyond them, and he has already sent this room back once for being
  // cramped. The floor keeps its 3.2 m centres and its depth.
  const BANK_Z = [12.4, 9.2, 6.0, 2.8];
  let rowN = 0;
  for (const bz of BANK_Z) {
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -AVENUE - 0.3 - (SLOT_N - 1) * SLOT_PITCH : AVENUE + 0.3;
      for (const face of [1, -1]) {
        const row = ROWS[rowN++ % ROWS.length];
        for (let i = 0; i < SLOT_N; i++) {
          const m = new THREE.Mesh(slotGeo, slotMats[row[i]]);
          if (face < 0) m.rotation.y = Math.PI;
          put(m, x0 + i * SLOT_PITCH, 0.725, bz + face * 0.35);
          // CABINETS THAT ARE NOT ALL THE SAME. "A hundred identical machines is
          // what makes it read as wallpaper" — so every third one carries a
          // raised topper and every fourth a taller crown, off the machine's
          // INDEX rather than a random stream (GOTCHAS §2: there is one seeded
          // rnd() and its order is load-bearing). Three silhouettes down a bank
          // instead of one, from two boxes.
          const k = (i + rowN) % 4;
          if (k === 1 || k === 3) {
            put(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.30, 0.30), slotMats[row[i]][4]),
              x0 + i * SLOT_PITCH, 1.60, bz + face * 0.35);
          }
          if (k === 3) {
            put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.22),
              new THREE.MeshBasicMaterial({ color: 0xd8a83a })),
              x0 + i * SLOT_PITCH, 1.86, bz + face * 0.35);
          }
        }
      }
      // ONE collider per bank, not one per machine. The cabinets are 0.04 m
      // apart and the player is 0.72 m across, so per-machine boxes would only
      // carve slots you wedge into — the same lesson the diner's booths taught.
      solid(x0 + ((SLOT_N - 1) * SLOT_PITCH) / 2, bz, bankW, 1.3);

      // A STOOL AT EVERY MACHINE, and every one of them sittable. The user:
      // "casino slots have stools" and, standing since the seat kit landed,
      // "for every seat in the game i want to be able to sit down". Low, round
      // and fixed, on a single column with a foot ring — which is what a slot
      // stool is, and why it does not look like a chair.
      for (const face of [1, -1]) for (let i = 0; i < SLOT_N; i++) {
        const sx2 = x0 + i * SLOT_PITCH, sz2 = bz + face * 1.02;
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.07, 10), stoolTopM), sx2, 0.64, sz2);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.60, 8), stoolPoleM), sx2, 0.30, sz2);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 10), stoolPoleM), sx2, 0.03, sz2);
        put(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.017, 4, 10), stoolPoleM), sx2, 0.22, sz2)
          .rotation.x = Math.PI / 2;
        ctx.seat({
          x: room.wx(sx2), z: room.wz(sz2), yaw: face > 0 ? Math.PI : 0, h: 0.64,
          approach: { x: room.wx(sx2), z: room.wz(sz2 + face * 0.75) },
          label: 'sit at the slot', ok: () => room.inside(),
        });
      }
    }
  }

  // ── THE ENTRY LOUNGE ──────────────────────────────────────────────────
  //
  // The second half of "kill a row and add seat of some sort". A slot stool is
  // not a seat you can wait on — it faces a machine, it has no back, and it is
  // in a bank. What the front of a casino actually has is somewhere to sit that
  // is NOT playing: you come in, or you are waiting for somebody, or you have
  // stopped.
  //
  // Two banquettes against the side walls, facing the avenue across the entry,
  // with the middle left completely clear — the door spot is at hd - 0.55 and
  // the whole point of the row that went was space, so nothing goes in the
  // centre. Every place is registered with F's ctx.seat(), which is the standing
  // rule for anything sittable ("for every seat in the game i want to be able to
  // sit down"), and the seat top is one constant the geometry is built from.
  {
    const LOUNGE_Z = 15.3;                       // mid-way between door and bank
    const SEAT_TOP = 0.44, BENCH_L = 2.6, BENCH_D = 0.55;
    const BX = hw - 0.40;                        // 3.5 cm off the plaster
    // WHERE A PERSON SITS ON A BENCH IS NOT ITS BOX CENTRE. A sitter is a plane
    // with no thickness, so placing it on the middle of a 0.55 m cushion buries
    // the legs in the front half of that cushion — which is what the first pass
    // did, and it read as a torso growing out of the upholstery. A body sits
    // ~0.16 m forward of centre on a bench this deep, and that is a fact about
    // benches, not a fudge for the sprite: the SEAT is registered there too, so
    // ctx.seat() and the figure are one point and cannot drift apart. (H's rule
    // is "place it at the seat you registered" — so the seat has to be right.)
    const SIT_OFF = 0.16;
    const plushM = new THREE.MeshBasicMaterial({ color: 0x6a1f28 });   // the stool red
    const buttonM = new THREE.MeshBasicMaterial({ color: 0x521820 });
    const brassM2 = new THREE.MeshBasicMaterial({ color: 0xc9a45e });
    for (const sx of [-1, 1]) {
      const bx2 = sx * BX;
      // plinth, cushion, and a buttoned back against the wall
      put(new THREE.Mesh(new THREE.BoxGeometry(BENCH_D, 0.12, BENCH_L), buttonM),
        bx2, 0.06, LOUNGE_Z);
      put(new THREE.Mesh(new THREE.BoxGeometry(BENCH_D, 0.14, BENCH_L), plushM),
        bx2, SEAT_TOP - 0.07, LOUNGE_Z);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, BENCH_L), plushM),
        sx * (hw - 0.16), SEAT_TOP + 0.31, LOUNGE_Z);
      // BUTTONED, AND PIPED ALONG THE FRONT EDGE. A 2.6 m bench in one colour is
      // the same fault as the slot flanks at a smaller size — the user has now
      // called out large untextured masses in this room and in the library, so it
      // is not a thing to ship twice in one commit. Two rows of buttons break the
      // back and a brass line catches the front of the cushion.
      for (const bz2 of [-1.0, -0.5, 0, 0.5, 1.0]) for (const by of [0.20, 0.46]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), buttonM),
          sx * (hw - 0.24), SEAT_TOP + by, LOUNGE_Z + bz2);
      }
      put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, BENCH_L), brassM2),
        bx2 - sx * (BENCH_D / 2 - 0.02), SEAT_TOP - 0.02, LOUNGE_Z);
      // a brass rail capping the back, so it is not another flat mass
      put(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, BENCH_L), brassM2),
        sx * (hw - 0.16), SEAT_TOP + 0.64, LOUNGE_Z);
      // ONE collider for the bench, for the same reason the banks get one each
      solid(bx2, LOUNGE_Z, BENCH_D + 0.28, BENCH_L);
      // four places, facing the avenue. Facing is (sin yaw, -cos yaw), so a
      // bench on +x looks along -x at yaw -PI/2 and the west bench at +PI/2.
      for (const dz of [-0.975, -0.325, 0.325, 0.975]) {
        ctx.seat({
          x: room.wx(bx2 - sx * SIT_OFF), z: room.wz(LOUNGE_Z + dz),
          yaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2,
          h: SEAT_TOP,
          approach: { x: room.wx(bx2 - sx * 0.9), z: room.wz(LOUNGE_Z + dz) },
          label: 'sit down', ok: () => room.inside(),
        });
      }
    }
    // Somebody waiting on the east bench, so the seats read as FOR sitting on —
    // the same job the four slot players do, and the same call: `seated` on the
    // Look, placed at the seat top this block already declares, no y fudge.
    sitter({ jacket: '#3a3a44', pants: '#2a2830', skin: '#c9a184', hair: '#3a2a1e',
      fit: 'coat', cut: 'short', build: 1 },
    BX - SIT_OFF, LOUNGE_Z - 0.325, SEAT_TOP, -Math.PI / 2);
    // a standing ashtray between the benches and the door, against the wall
    for (const sx of [-1, 1]) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.62, 8),
        new THREE.MeshBasicMaterial({ color: 0x6a6258 })), sx * (hw - 0.45), 0.31, LOUNGE_Z + 1.85);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.09, 8), brassM2),
        sx * (hw - 0.45), 0.66, LOUNGE_Z + 1.85);
    }
  }

  // FOUR PLAYERS, NOT A HUNDRED AND TWENTY. A machine at every stool would read
  // as a crowd, and this floor's whole effect is that it is too big for the
  // people in it — the same reason the hotel lobby is left empty in the middle.
  // Four is enough that the seats are visibly FOR sitting on, which is the ask.
  //
  // Placed on the stool tops this file draws at 0.64, off the same BANK_Z and
  // SLOT_PITCH the stools use, so a player sits on a stool rather than near one.
  {
    const seatY = 0.64, x0e = AVENUE + 0.3, x0w = -AVENUE - 0.3 - (SLOT_N - 1) * SLOT_PITCH;
    const PLAYERS: [number, number, number, Parameters<typeof citizenSprite>[0]][] = [
      [x0e + 1 * SLOT_PITCH, BANK_Z[1], 1,
        { jacket: '#5a4a3a', pants: '#3a3630', skin: '#c9a184', hair: '#6b5236', fit: 'plain', cut: 'short', build: 0 }],
      [x0e + 4 * SLOT_PITCH, BANK_Z[3], -1,
        { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e', fit: 'coat', cut: 'short', build: 1 }],
      [x0w + 2 * SLOT_PITCH, BANK_Z[0], -1,
        { jacket: '#3a4a5a', pants: '#2e2b33', skin: '#8a6a52', hair: '#2a2018', fit: 'plain', cut: 'short', build: 0 }],
      [x0w + 5 * SLOT_PITCH, BANK_Z[2], 1,
        { jacket: '#6a5a2a', pants: '#3a3630', skin: '#d8b48a', hair: '#9a8a6a', fit: 'coat', cut: 'short', build: 2 }],
    ];
    for (const [px, bz, face, look] of PLAYERS) {
      // the stool sits at bz + face * 1.02 and the player faces the machine
      sitter(look, px, bz + face * 1.02, seatY, face > 0 ? Math.PI : 0);
    }
  }

  // ── the felt table ──
  //
  // One, because the brief says one, and because a floor of machines with a
  // single table in it is what a neighbourhood casino actually looks like —
  // the tables are where the house pays staff, so there is exactly as much
  // table as the room can justify.
  const feltT = declareSurface(pixTex(64, 34, (g) => {
    g.fillStyle = '#1e5a3e'; g.fillRect(0, 0, 64, 34);
    g.strokeStyle = 'rgba(216,208,192,0.55)'; g.lineWidth = 1;
    for (const r of [13, 18, 23]) { g.beginPath(); g.arc(32, 40, r, Math.PI, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(216,208,192,0.5)';
    g.fillRect(6, 6, 12, 1); g.fillRect(46, 6, 12, 1);
    g.fillStyle = '#c9a45e'; g.fillRect(29, 3, 6, 2);            // the house's own mark
    dither(g, 64, 34, 40);
  }), 'detail');
  // Sized off the lanes it has to leave, not off what looks right in plan. It
  // sits between the east end of the slot banks and the east wall, so its
  // collider decides both of those gaps: 1.9 × 1.2 leaves 0.56 m of clear band
  // for the player's centre on the bank side and 0.48 m on the wall side. A
  // 2.2 m table — the first size I drew — closed the wall side to 0.28 m and
  // turned the corner of the room into a wedge (GOTCHAS §9).
  // Was 3.1, 0.4, sized off the gap between the old bank and the old east wall.
  // Both of those are gone: the floor is 17 x 19 now and the tables sit in the
  // open ground BEYOND the banks, where a pit belongs — you walk the avenue
  // past the machines and come out at the tables.
  // TZ is -7.0, not -7.6, and the walk found the reason: at -7.6 the tables'
  // colliders ended on z -8.2 and the cage's front face is at -8.9, leaving a
  // 0.70 m gap for a 0.72 m player. Nobody would have got through it. 1.30 m now.
  const TX = -2.6, TZ = -13.0;
  const woodM = new THREE.MeshBasicMaterial({ color: DARKWOOD });
  const railM = new THREE.MeshBasicMaterial({ color: 0x3a2226 });
  put(new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 1.0), woodM), TX, 0.36, TZ);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 1.15), railM), TX, 0.77, TZ);
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.85), ctx.flat(feltT));
  felt.rotation.x = -Math.PI / 2;
  put(felt, TX, 0.83, TZ);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.12), brassM), TX, 0.86, TZ - 0.34);
  solid(TX, TZ, 1.9, 1.2);

  // The dealer, on the house side of the table, from the 8-ANGLE ATLAS.
  //
  // He was a hand-painted plane whose own comment said "same billboard-free
  // treatment as the diner's waitress" — which was true, and the waitress was
  // the mistake being copied. The user: *"the people inside these places are
  // always flat and not like the people on the street."* Every figure indoors
  // traced back to her; she went onto the atlas first and this is the last one
  // in the interiors.
  //
  // Black waistcoat over a white shirt: house uniform, described to the atlas
  // rather than drawn. `ct/citizens.ts` has no bow tie, so the shirt is the
  // accent — worth asking H for, not worth hand-drawing around.
  room.person({
    jacket: '#3a2226', pants: '#241e22', skin: '#b8845a', hair: '#2a2018',
    fit: 'plain', accent: '#d8d0c0', cut: 'short', build: 0,
  // Facing derived from the table he deals to, not typed. It was `facing: 0`,
  // which happened to be right — the two rooms where the same constant was
  // copied instead of derived both ended up backwards (GOTCHAS §23), so being
  // right by luck is not a reason to leave it. He stands on the far side and
  // looks across the felt at whoever is playing.
  }, TX, TZ - 0.95, { facing: Math.atan2(TX - TX, TZ - (TZ - 0.95)), h: 0.98, w: 0.95 });

  // ── the cage ──
  //
  // Back wall, furthest point from the door, which is where it belongs: the
  // one place in the building where the money is real is the last place you
  // reach. High counter, barred grille above it, one gap in the bars to pass
  // notes through.
  // "A cage in the far corner." It was central-ish on the back wall of a 9 m
  // room, which on a 19 m floor would sit dead ahead of the avenue and close the
  // view down it — the one sightline the room is built around.
  const CAGE_X = hw - 2.6, CAGE_W = 3.0, CAGE_Z = -hd + 0.3;
  const cageWoodT = declareSurface(pixTex(48, 20, (g) => {
    g.fillStyle = '#3a2620'; g.fillRect(0, 0, 48, 20);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < 48; x += 12) g.fillRect(x, 0, 1, 20);     // panelling
    g.fillStyle = '#8a6a2c'; g.fillRect(0, 1, 48, 1);
    dither(g, 48, 20, 30);
  }), 'detail');
  const cageFrontM = ctx.flat(cageWoodT);
  put(new THREE.Mesh(new THREE.BoxGeometry(CAGE_W, 1.05, 0.6),
    [cageFrontM, cageFrontM, brassM, cageFrontM, cageFrontM, cageFrontM]),
    CAGE_X, 0.525, CAGE_Z);
  solid(CAGE_X, CAGE_Z, CAGE_W, 0.6);

  const grilleT = declareSurface(pixTex(96, 37, (g) => {
    g.fillStyle = '#141014'; g.fillRect(0, 0, 96, 37);
    g.fillStyle = '#2a2228'; g.fillRect(4, 3, 88, 31);           // the room behind
    g.fillStyle = '#3a3038';
    for (let y = 6; y < 33; y += 8) g.fillRect(6, y, 84, 1);      // shelves of trays
    g.fillStyle = '#c9a45e'; g.fillRect(68, 9, 9, 5);            // the cashier's lamp
    g.fillStyle = 'rgba(201,164,94,0.25)'; g.fillRect(64, 7, 17, 10);
    g.fillStyle = '#8a8a90';                                     // the bars
    for (let x = 2; x < 96; x += 5) g.fillRect(x, 0, 1, 37);
    g.fillStyle = '#9a9aa0'; g.fillRect(0, 1, 96, 1); g.fillRect(0, 34, 96, 1);
    g.fillStyle = '#141014'; g.fillRect(40, 25, 16, 12);         // the gap you pass notes through
    g.fillStyle = '#c9a45e'; g.fillRect(40, 35, 16, 1);
  }), 'detail');
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(CAGE_W, 1.15), ctx.flat(grilleT));
  put(grille, CAGE_X, 1.63, -hd + 0.06);

  // CAGE, over the grille. A FrontSide plane on a wall, so GOTCHAS §10 — the
  // mirrored back face of a double-sided sign — cannot bite; but the letters
  // are asymmetric anyway, which is the check that rule asks for.
  const signT = declareSurface(pixTex(48, 16, (g) => {
    g.fillStyle = '#241e22'; g.fillRect(0, 0, 48, 16);
    g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 48, 1); g.fillRect(0, 15, 48, 1);
    tube(g, 'CAGE', 24, 9, 11, '#e8c25a', '#fff4d0', '#2a2018');
  }), 'sign');
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.24), ctx.flat(signT)),
    CAGE_X, room.H - 0.56, -hd + 0.06);

  // ── the same building, from the inside ────────────────────────────────
  //
  // The user, having seen the new facade: *"someone walking in from that
  // facade should recognise the place"*. The room was already dim, which is
  // right — no daylight, no clock, no windows — but dim had drifted into DRAB,
  // and the thing the outside has that the inside did not is GLITTER: gold,
  // small repeated bulbs, and the 777.
  //
  // The signage is painted by `tube` imported from ct/vice.ts — the same
  // painter that draws SEVENS and LOOSEST SLOTS on the front of the
  // building, so the hand is identical rather than merely similar.

  // Bulbs, and a chase to run them. Same idea as the marquee outside: sockets
  // are fixed and the chase is which of them are alight, so three shared
  // materials animate the whole room. Driven off `onBeforeRender` on a mesh
  // that is always drawn with the room, guarded on the renderer's own frame
  // counter — the interior kit has no per-frame hook and does not need one.
  const PHASES = 3;
  const onCol = new THREE.Color(0xfff0bc), offCol = new THREE.Color(0x7a6438);
  const phaseM = Array.from({ length: PHASES }, () => new THREE.MeshBasicMaterial({ color: 0x7a6438 }));
  const bulbGeo = new THREE.SphereGeometry(0.045, 5, 4);
  let bulbN = 0;
  // Everything hung off the ceiling is measured DOWN FROM IT, not typed as an
  // absolute height. Raising this room from 2.5 to 2.9 would otherwise have left
  // the valances, the bulb runs and the cage sign stranded 0.4 m low — which is
  // how a height change turns into six separate bugs.
  const BULB_Y = room.H - 0.60;
  const bulbLine = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pitch: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / pitch));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const m = new THREE.Mesh(bulbGeo, phaseM[bulbN++ % PHASES]);
      put(m, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, z0 + (z1 - z0) * k);
    }
  };

  // ── gold valances over the slot banks, bulb-lit ──
  //
  // The thing a casino floor actually has over every bank and the room did not:
  // a lit soffit you read the aisle by. It also gives the machines a top edge,
  // which is what stops a bank reading as a row of boxes.
  // Shallower and higher than the first version, which hung a 1.5 m flat gold
  // slab across the whole arrival view at eye line and read as a ceiling beam
  // rather than as a lit soffit. 1.0 m deep, hung 0.64 m under the ceiling, it
  // clears the sightline to the
  // machines, and the face is PAINTED — a run of diamonds in two golds — because
  // one flat colour over that much area is what made it read as a slab.
  const valT = declareSurface(pixTex(64, 12, (g) => {
    g.fillStyle = '#8a6a28'; g.fillRect(0, 0, 64, 12);
    g.fillStyle = '#a8862f';
    for (let x = 0; x < 64; x += 8) {
      for (let i = 0; i < 4; i++) g.fillRect(x + 4 - i, 4 - i + 2, 1 + i * 2, 1);
      for (let i = 0; i < 3; i++) g.fillRect(x + 2 + i, 7 + i, 5 - i * 2, 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, 64, 1);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 11, 64, 1);
    dither(g, 64, 12, 22);
  }), 'detail');
  valT.wrapS = THREE.RepeatWrapping;
  const valFaceM = ctx.flat(valT);
  const valTopM = new THREE.MeshBasicMaterial({ color: 0x6a5220 });
  // one valance per BANK, so the gold-and-bulbs run carries away down both
  // blocks — it is the thing that makes the depth read as depth rather than as
  // an empty floor with machines at the near end
  for (const bz of BANK_Z) {
    for (const sx of [-1, 1]) {
      const cx2 = sx < 0
        ? -AVENUE - 0.3 - ((SLOT_N - 1) * SLOT_PITCH) / 2
        : AVENUE + 0.3 + ((SLOT_N - 1) * SLOT_PITCH) / 2;
      const t = valT.clone(); t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(Math.round(bankW / 1.1), 1); t.needsUpdate = true;
      const faceM = ctx.flat(t);
      put(new THREE.Mesh(new THREE.BoxGeometry(bankW, 0.3, 1.0),
        [valTopM, valTopM, valTopM, valTopM, faceM, faceM]), cx2, room.H - 0.64, bz);
      for (const s2 of [-1, 1]) {
        bulbLine(cx2 - bankW / 2 + 0.15, 2.08, bz + s2 * 0.5,
                 cx2 + bankW / 2 - 0.15, 2.08, bz + s2 * 0.5, 0.34);
      }
    }
  }
  void valFaceM;

  // ── 777 on the back wall, in the facade's own red tube ──
  const sevensT = declareSurface(pixTex(72, 26, (g) => {
    g.fillStyle = '#2a1418'; g.fillRect(0, 0, 72, 26);
    g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 72, 2); g.fillRect(0, 24, 72, 2);
    tube(g, '777', 36, 13, 20, '#ff4a3a', '#ffd8c0', '#3a1016');
  }), 'sign');
  put(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.83), ctx.flat(sevensT)), -2.0, 1.86, -hd + 0.07);
  bulbLine(-3.25, 1.30, -hd + 0.10, -0.75, 1.30, -hd + 0.10, 0.3);

  // ── THE GAMES, which is what stops this being a slot warehouse ────────
  //
  // "A real floor has zones: a blackjack pit, a roulette wheel, a craps table
  // with its high sides, a poker corner, a keno board, a wall of video poker
  // distinct from the reel slots." Each of these is a different SHAPE, which is
  // the point — a floor reads as varied because you can tell the games apart
  // across the room, not because the cabinets have different stickers.
  {
    const feltG = new THREE.MeshBasicMaterial({ color: 0x1e5a3e });
    const feltR = new THREE.MeshBasicMaterial({ color: 0x5a1f24 });
    const rail = new THREE.MeshBasicMaterial({ color: 0x3a2226 });
    const wood = new THREE.MeshBasicMaterial({ color: DARKWOOD });
    const chrome = new THREE.MeshBasicMaterial({ color: 0x9a9488 });
    const ivory = new THREE.MeshBasicMaterial({ color: 0xd8d0bc });

    // ROULETTE — round, and the only round thing on the floor
    {
      const RX = -3.1, RZ = 0.2;
      put(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 16), feltG), RX, 0.86, RZ);
      put(new THREE.Mesh(new THREE.CylinderGeometry(1.10, 1.10, 0.10, 16), rail), RX, 0.78, RZ);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.10, 12), wood), RX, 0.97, RZ - 0.42);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.04, 12), chrome), RX, 1.03, RZ - 0.42);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), chrome), RX, 1.10, RZ - 0.42);
      for (const lz of [-0.7, 0.7]) for (const lx of [-0.7, 0.7]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.78, 0.10), wood), RX + lx, 0.39, RZ + lz);
      }
      solid(RX, RZ, 2.3, 2.3);
    }

    // CRAPS — long, and high-sided, which is its whole silhouette
    {
      const CX2 = 3.0, CZ2 = 0.2;
      put(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 2.8), feltG), CX2, 0.88, CZ2);
      for (const sx of [-1, 1]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 2.8), rail), CX2 + sx * 0.75, 1.12, CZ2);
      }
      for (const sz of [-1, 1]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.46, 0.12), rail), CX2, 1.12, CZ2 + sz * 1.4);
      }
      for (const lz of [-1.2, 1.2]) for (const lx of [-0.6, 0.6]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.82, 0.10), wood), CX2 + lx, 0.41, CZ2 + lz);
      }
      solid(CX2, CZ2, 1.8, 3.0);
    }

    // POKER — oval-ish, red felt, and lower than the rest
    {
      const PX2 = -3.0, PZ2 = -3.6;
      put(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.11, 12), feltR), PX2, 0.80, PZ2);
      put(new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.06, 4, 14), rail), PX2, 0.86, PZ2)
        .rotation.x = Math.PI / 2;
      for (const a of [0, 1.6, 3.1, 4.7]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), wood),
          PX2 + Math.cos(a) * 0.7, 0.36, PZ2 + Math.sin(a) * 0.7);
      }
      solid(PX2, PZ2, 2.5, 2.5);
    }

    // VIDEO POKER — a low run against the east wall, deliberately NOT a reel
    // cabinet: half the height, a counter rather than a box, screens not reels
    {
      const VX = hw - 0.55;
      put(new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.92, 4.2), wood), VX, 0.46, -3.4);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 4.3), rail), VX, 0.95, -3.4);
      for (let i = 0; i < 6; i++) {
        const vz = -5.2 + i * 0.72;
        put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.44),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0x2a4a6a : 0x1e3a52 })), VX - 0.36, 1.18, vz);
        put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.30), chrome), VX - 0.30, 0.99, vz);
      }
      solid(VX, -3.4, 0.9, 4.4);
    }

    // STOOLS AT THE GAMES, and every one of them sittable. My own grading last
    // commit: "a blackjack pit nobody can sit at is the same omission the user
    // just caught on the slots", and all 120 reel machines had one while the
    // tables had none. Taller than a slot stool because a gaming table is
    // higher, and placed round each table's own centre so they follow it.
    const gameStool = (gx: number, gz: number, yaw: number) => {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 10), stoolTopM), gx, 0.72, gz);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.68, 8), stoolPoleM), gx, 0.34, gz);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.03, 10), stoolPoleM), gx, 0.03, gz);
      put(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.017, 4, 10), stoolPoleM), gx, 0.24, gz)
        .rotation.x = Math.PI / 2;
      ctx.seat({
        x: room.wx(gx), z: room.wz(gz), yaw, h: 0.72,
        approach: { x: room.wx(gx + Math.sin(yaw) * 0.8), z: room.wz(gz + Math.cos(yaw) * 0.8) },
        label: 'sit at the table', ok: () => room.inside(),
      });
    };
    // roulette: five round its open side
    for (let i = 0; i < 5; i++) {
      const a = -1.15 + i * 0.575;
      gameStool(-3.1 + Math.sin(a) * 1.55, 0.2 + Math.cos(a) * 1.55, a + Math.PI);
    }
    // craps: three a side down the long table
    for (const sx of [-1, 1]) for (const dz of [-0.85, 0, 0.85]) {
      gameStool(3.0 + sx * 1.35, 0.2 + dz, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    // poker: six round it, which is what a poker table seats
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      gameStool(-3.0 + Math.sin(a) * 1.65, -3.6 + Math.cos(a) * 1.65, a + Math.PI);
    }

    // KENO — a lit board on the west wall, the only thing up there with numbers
    {
      const kenoT = declareSurface(pixTex(64, 26, (g) => {
        g.fillStyle = '#14161c'; g.fillRect(0, 0, 64, 26);
        g.fillStyle = '#2a2e38';
        for (let r = 0; r < 4; r++) for (let c = 0; c < 20; c++) g.fillRect(2 + c * 3, 2 + r * 6, 2, 4);
        g.fillStyle = '#f2b83a';
        for (const [c, r] of [[3, 0], [7, 1], [11, 0], [2, 2], [16, 3], [9, 2], [18, 1]]) {
          g.fillRect(2 + c * 3, 2 + r * 6, 2, 4);
        }
        dither(g, 64, 26, 30);
      }), 'sign');
      const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.05), ctx.flat(kenoT));
      kb.rotation.y = Math.PI / 2;
      put(kb, -hw + 0.06, 2.05, -3.0);
    }
  }

  // ── the second table, and the pit rail around both ────────────────────
  //
  // "More than one table, a raised or roped-off area." Both come out of the
  // same move: two tables sitting inside a roped pit, which is what a real floor
  // does — it separates the people playing tables from the people walking past
  // the machines without putting a wall anywhere.
  const T2X = 2.6, T2Z = -13.0;
  {
    const legM = new THREE.MeshBasicMaterial({ color: DARKWOOD });
    const felt2 = feltT.clone(); felt2.needsUpdate = true;
    put(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.2),
      [railM, railM, ctx.flat(felt2), railM, railM, railM]), T2X, 0.86, T2Z);
    for (const lx of [-0.7, 0.7]) for (const lz of [-0.4, 0.4]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.80, 0.12), legM), T2X + lx, 0.40, T2Z + lz);
    }
    solid(T2X, T2Z, 1.9, 1.2);
  }

  // the rope: brass posts with a slack line between them, three sides open to
  // the avenue so you can walk in — a rope you cannot cross is a wall
  {
    const postM = new THREE.MeshBasicMaterial({ color: 0xb98f30 });
    const ropeM = new THREE.MeshBasicMaterial({ color: 0x6a1f28 });
    const PX0 = -4.2, PX1 = 4.2, PZ = -10.4;
    const posts: number[] = [];
    for (let x = PX0; x <= PX1 + 0.01; x += 2.8) posts.push(+x.toFixed(2));
    for (const px of posts) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.92, 8), postM), px, 0.46, PZ);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), postM), px, 0.95, PZ);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      // skip the middle span: that is the way in, on the avenue's centreline
      if (Math.abs((posts[i] + posts[i + 1]) / 2) < 1.5) continue;
      const w = posts[i + 1] - posts[i];
      put(new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), ropeM),
        (posts[i] + posts[i + 1]) / 2, 0.80, PZ);
    }
  }

  // ── the cage, given the same treatment as the front of the house ──
  bulbLine(CAGE_X - CAGE_W / 2, BULB_Y, -hd + 0.10, CAGE_X + CAGE_W / 2, BULB_Y, -hd + 0.10, 0.3);
  for (const s2 of [-1, 1]) {
    bulbLine(CAGE_X + s2 * CAGE_W / 2, 1.10, -hd + 0.10, CAGE_X + s2 * CAGE_W / 2, BULB_Y, -hd + 0.10, 0.3);
  }

  // ── and a bulb line round the room, under the mirrors ──
  bulbLine(-hw + 0.12, BULB_Y, -hd + 0.12, -hw + 0.12, BULB_Y, hd - 0.12, 0.42);
  bulbLine(hw - 0.12, BULB_Y, -hd + 0.12, hw - 0.12, BULB_Y, hd - 0.12, 0.42);

  // one bank of sockets is dead — the same joke as the marquee's dead bulb,
  // and the reason this room is losing money in the same building that is
  const deadM = new THREE.MeshBasicMaterial({ color: 0x4a4238 });
  {
    const cx2 = -AVENUE - 0.3 - ((SLOT_N - 1) * SLOT_PITCH) / 2;   // the west block, second row in
    for (let i = 0; i < 5; i++) {
      put(new THREE.Mesh(bulbGeo, deadM), cx2 - bankW / 2 + 0.15 + i * 0.34, 2.08, BANK_Z[1] + 0.5);
    }
  }

  // ── the light ──
  //
  // The kit hangs its own warm bulbs down the centreline and they stay. These
  // are the pools that make the room read as lit FOR something rather than lit
  // evenly: one over the felt, one down each aisle. Additive, so they only
  // ever brighten what is under them, and they are the reason the aisles have
  // a middle and the corners do not.
  // Hung 0.35 m below the ceiling, not 0.09 m under it. Additive blending
  // brightens whatever is BEHIND the plane, so a glow parked just under the
  // ceiling paints the ceiling instead of the room — it put a blown-out white
  // patch on the mirrors directly above each pool. Down at 2.15 m it reads as
  // light hanging over the machines, which is what it is for.
  const poolT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(240,196,110,0.38)');
    gr.addColorStop(1, 'rgba(240,196,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  const poolM = new THREE.MeshBasicMaterial({
    map: poolT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pool = (w: number, d: number, lx: number, lz: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), poolM);
    m.rotation.x = Math.PI / 2;
    put(m, lx, room.H - 0.35, lz);
  };
  pool(2.8, 2.0, TX, TZ);                       // over the table
  // …and one down the avenue for every gap between banks, so the floor is lit
  // in bands all the way back rather than only where the old two rows were
  for (let i = 0; i < BANK_Z.length - 1; i++) {
    const mid = (BANK_Z[i] + BANK_Z[i + 1]) / 2;
    for (const sx of [-1, 1]) {
      const cx2 = sx < 0
        ? -AVENUE - 0.3 - ((SLOT_N - 1) * SLOT_PITCH) / 2
        : AVENUE + 0.3 + ((SLOT_N - 1) * SLOT_PITCH) / 2;
      pool(6.4, 1.6, cx2, mid);
    }
  }

  // The chase. `mesh.onBeforeRender` is a per-frame callback three.js already
  // gives every mesh, so a room can animate without the kit growing a hook —
  // and guarding on the renderer's frame counter keeps it to one pass however
  // many meshes carry it.
  let lastFrame = -1;
  carpet.onBeforeRender = (renderer) => {
    const f = (renderer as THREE.WebGLRenderer).info.render.frame;
    if (f === lastFrame) return;
    lastFrame = f;
    const step = Math.floor(performance.now() / 1000 * 6) % PHASES;
    for (let i = 0; i < PHASES; i++) phaseM[i].color.copy(i === step ? onCol : offCol);
  };

}

import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom, seatTaken, claimSeat, PARTY } from './interior';   // item 267: the rail breaks where the doorway is
import { type DoorDecl } from './doors';
import { citizenSprite } from './citizens';
import { ORDER as HOOK } from './ctx';
import { tube, VICE_DOOR_X, leafPair } from './vice';
// The playable slot machines — cabinets, lever, reels, coins and their maths
// all live there; this file only says where they stand and which way they
// face. Since 2026-08-10's "remove chairs for all games and tables" there
// are no stools: every machine is played standing, at the [E] spot slotcab
// wires on whichever side its glass looks. No cycle: slotcab imports ctx
// types, ./paint and (dynamically) ./hud, never this file or ./interior.
import { buildSlots } from './slotcab';
// The felt sits in the pit at TX = 2.7, TZ = -5.0 (moved 2026-08-09 with the
// layout overhaul), the only green felt on this floor with a standing dealer.
// Since 2026-08-09's "blackjack and roulettte need to be diagetic" the FELT
// PAINTERS come over this edge: each table's top is painted by its own game's
// painter in the idle state (`paintTable(g, w, h, null)`), on a NAMED mesh
// the game hangs its live canvas on when you play. One painter, two moments —
// the printed felt and the played felt cannot drift. `openTable` is the
// standing way in (2026-08-10, chairs gone): this file's [E] spot at the rail
// calls it. No cycle: blackjack.ts imports only ./ctx, ./hud (dynamically)
// and ./slots (dynamically), never this file.
import { FELT as BJ_FELT,
  paintTable as paintBlackjackFelt, openTable as openBlackjack } from './blackjack';
// Same bridge, other table. Same no-cycle shape too — roulette.ts imports
// only ./ctx at runtime, never this file. WHEEL and REDS come over for the
// head's own paint: the pockets on the 3D wheel are the real European order,
// coloured by the same set the game pays on.
import { FELT as RL_FELT,
  paintTable as paintRouletteFelt, WHEEL as RL_WHEEL, REDS as RL_REDS,
  openTable as openRoulette } from './roulette';
// Same bridge, third game — the BIG SIX money wheel (2026-08-10: "yea add
// wheel of fortune"). The head's face and the idle betting counter are both
// painted by bigsix's own exported painters, so the wheel you watch from the
// door IS the wheel the game lands. Same no-cycle shape: bigsix.ts imports
// only ./ctx at runtime, never this file.
import { BOARD as BS_BOARD, PANE as BS_PANE, FACE as BS_FACE,
  paintBoard as paintBigSixBoard, paintWheelFace as paintBigSixFace,
  openWheel as openBigSix } from './bigsix';
// The doorman speaks — the backroom's $1,000 rule is a LINE, not a tooltip.
// Same import edge as the dealer's pitch and the park; dialog.ts never
// imports an interior.
import { talker } from './dialog';

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
    // 'into SEVENS' until item 196. The elevation this door is cut into no
    // longer says SEVENS anywhere — the category line reads ORPHEUS and the
    // name board reads CASINO — and a prompt that names an address the sign
    // above it has stopped using is the same class of contradiction as a door
    // that disagrees with its own facade. `building: 'SEVENS'` above is
    // UNCHANGED and must stay: it is the key into vice.VICE, VICE_DOOR_X and
    // the DoorDecl registry, and renaming it is a break dressed as a rename.
    label: 'into the ORPHEUS CASINO',
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
  // `seatFwd` is the fourth thing this bypass has to pass through by hand, and
  // it is OPT-IN for a reason: the four slot players sit at MACHINES, which are
  // supposed to hide their legs, and only the lounge bench eats them. See
  // ct/citizens.ts. (Item 280.)
  const sitter = (look: Parameters<typeof citizenSprite>[0],
                  lx: number, lz: number, seatTop: number, facing: number,
                  seatFwd = 0) => {
    const s = citizenSprite({ ...look, seated: true }, { facing, h: 1.0, w: 1.0, seatFwd });
    put(s.mesh, lx, seatTop, lz);
    // TAG IT, same as room.person() does (ct/interior.ts). This bypasses the
    // kit wrapper on purpose — a sitter needs the SEAT TOP, not the floor —
    // but every people-sweep in the world keys off userData.citizen/.seated
    // to tell a figure from the thrift's mannequin, and skipping the tag here
    // made these five (the lounge waiter + four slot players) invisible to
    // every one of those checks while reading as present in the room.
    s.mesh.userData.citizen = true;
    s.mesh.userData.seated = true;
    // …AND CLAIM THE SEAT, the third thing this bypass has to remember by hand.
    // Read back off the mesh, because `put` has already resolved local to world
    // and re-deriving it here is the drift the comment above warns about.
    // Without this the player is offered the stool a man is already sitting on
    // and lands inside him — *"you sit where he sits and that just breaks
    // immersion."*
    claimSeat(s.mesh.position.x, s.mesh.position.z);
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
  // Both leaves through `leafPair`, which owns the mirror. The user reported one
  // leaf reversed here, and it was the HANDLE: the pull is drawn at the +u edge,
  // u = 1 lands on the +x side for BOTH leaves after their rotation, and the free
  // edge is the side away from the hinge — so on one leaf the pull sat exactly ON
  // the hinge. Hinge edge, swing and face were all already right. See vice.ts.
  // The swing is no longer this file's to choose — see `LEAF_AJAR` in vice.ts.
  leafPair(put, leafM, dAt, DW, DH, hd - 0.12, 'casino', 0.03);

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

  // ── AND IT STOPS AT THE PARTY DOORWAY. ITEM 267. ──────────────────────────
  //
  // The user: *"theres this here that cuts across the entry way."* This wall's
  // rail was one box `room.D` long, drawn before item 196 cut an opening
  // through the flank — **a band drawn before an opening existed will not know
  // to stop**. At y = 1.0 against a 2.6 m opening it passed straight across the
  // entrance at waist height, which is exactly what he photographed.
  //
  // ⚠ THE GAP IS DERIVED FROM `PARTY`, NOT TYPED. `ct/interior.ts` cuts the
  // hole from that same declaration (`at: -9.0, w: 2.6`), so the rail's break
  // and the doorway cannot drift apart — BUILDER-BRIEF §8, and the reason
  // `bedcavity.mjs` spent a week measuring a truck that no longer existed. If
  // item 268 re-hands this wall, or the opening moves, the break follows for
  // free and nobody has to remember this line exists.
  //
  // ⚠ NO NEW IMPORT EDGE, WHICH IS THE THING TO CHECK BEFORE COPYING THIS.
  // `ct/doors.ts` would have been a cycle — it eagerly globs `int-*.ts` and
  // every one of those imports only `type DoorDecl` precisely so no runtime
  // edge exists, and GOTCHAS 28 drops such a module from the BUILT BUNDLE ONLY.
  // `./interior` is different: line 4 of this file already imports `buildRoom`
  // from it at runtime, so `PARTY` rides an edge that has always been here.
  //
  // The rail dies into the JAMB rather than stopping in mid-air: the opening
  // already carries a gold architrave, and brass meeting brass at the reveal
  // reads as a rail returning into the frame, which is what a real one does.
  // ⚠ WHICH FLANK IS THE PARTY WALL IS DERIVED TOO, not assumed to be −x.
  // Item 268 is open against this very doorway — *"the hotel is right of the
  // casino outside and left of it inside"* — and its fix may re-hand the wall.
  // `PARTY` says which room sits on which side, so reading the side from the
  // declaration means a handedness change moves the break with the opening
  // instead of leaving a broken rail on the wrong wall and an unbroken one on
  // the right. The row warned about exactly this collision.
  const pw = PARTY.find((q) => q.east === 'casino' || q.west === 'casino');
  // this room is EAST of the wall  ->  the wall is on its low-x flank
  const partySign = pw ? (pw.east === 'casino' ? -1 : 1) : 0;
  for (const sign of [-1, 1] as const) {
    const wallZ = sign * (hw - 0.02);
    if (!pw || sign !== partySign) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, room.D), brassM), wallZ, 1.0, 0);
      continue;
    }
    // The wall runs the room's whole depth; the opening takes `w` out of it at
    // `at`. Two remainders, each placed at its own midpoint — written as SPANS
    // and converted to centre+length once, so there is no second chance to get
    // a half-length wrong.
    const lo = -room.D / 2, hi = room.D / 2;
    const gapLo = pw.at - pw.w / 2, gapHi = pw.at + pw.w / 2;
    for (const [a, c] of [[lo, gapLo], [gapHi, hi]] as [number, number][]) {
      const len = c - a;
      if (len <= 0.01) continue;          // the opening reaches the corner
      put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, len), brassM),
        wallZ, 1.0, (a + c) / 2);
    }
  }

  // ── THE SLOT BANK — the glowing thing you see on entry ────────────────
  //
  // 2026-08-09: "fix the casino, the layout is ass … i want slot to be unique
  // and interesting. all the machines are identical." The 96-cabinet warehouse
  // is gone. Then 2026-08-10: "make slots aisles double sided. slot machines
  // also on backs of all slot machines. we have more space so make sure
  // they're not too close." So: TWO ISLAND BANKS, each a back-to-back pair of
  // rows — every machine has another machine on its back, the way a real
  // floor stacks them — and the 36 m depth pays for the spread: the aisle
  // between the banks keeps ~3 m clear between stool edges, well over the 2 m
  // lane. Every one of them is PLAYABLE from its own side: walk up or take
  // the stool, pull the ball-handle lever, watch the reels stagger in. The
  // machines themselves — shapes, reels, lever, coins, maths (RTP 94.97%, hit
  // rate 28.6%, the card on every belly prints the dollars) — live in
  // ct/slotcab.ts; this file owns the FLOOR: where they stand, which way they
  // face, their colliders, and the stools.
  //
  // Three personalities: CHERRY BELLE ($2 a pull), LUCKY 7 ($5), and ONE
  // KING KACHING ($10, $1,500 jackpot) anchoring the west block.
  // TWO ISLAND BANKS at 10.8 and 4.6, each two rows BACK-TO-BACK, 0.35 m off
  // the bank line — a 15 cm spine gap between the backs, the way a real floor
  // stacks them. The +z row of each bank faces the door, the −z row faces the
  // pit, so every aisle is lined with lit glass on both sides. The spread is
  // deliberate ("we have more space so make sure they're not too close"):
  // between the banks the clear walk is ~4.9 m face-to-face, and the centre
  // avenue (|x| < 1.45) runs clear from the door to the pit.
  const SLOT_ROWS: { z: number; face: 1 | -1; cabs: { kind: 'cherry' | 'seven' | 'king'; x: number }[] }[] = [
    // the door bank
    { z: 11.15, face: 1, cabs: [
      { kind: 'seven', x: 1.9 }, { kind: 'cherry', x: 2.75 }, { kind: 'seven', x: 3.6 }, { kind: 'cherry', x: 4.45 },
      { kind: 'cherry', x: -1.9 }, { kind: 'seven', x: -2.75 }, { kind: 'cherry', x: -3.6 }, { kind: 'seven', x: -4.45 },
    ] },
    { z: 10.45, face: -1, cabs: [
      { kind: 'cherry', x: 1.9 }, { kind: 'seven', x: 2.75 }, { kind: 'cherry', x: 3.6 }, { kind: 'seven', x: 4.45 },
      { kind: 'seven', x: -1.9 }, { kind: 'cherry', x: -2.75 }, { kind: 'seven', x: -3.6 }, { kind: 'cherry', x: -4.45 },
    ] },
    // the pit bank — the KING faces the door from the west block
    { z: 4.95, face: 1, cabs: [
      { kind: 'cherry', x: 1.9 }, { kind: 'seven', x: 2.75 }, { kind: 'cherry', x: 3.6 }, { kind: 'seven', x: 4.45 },
      { kind: 'king', x: -2.35 }, { kind: 'seven', x: -3.55 }, { kind: 'cherry', x: -4.4 },
    ] },
    { z: 4.25, face: -1, cabs: [
      { kind: 'seven', x: 1.9 }, { kind: 'cherry', x: 2.75 }, { kind: 'seven', x: 3.6 }, { kind: 'cherry', x: 4.45 },
      { kind: 'cherry', x: -1.9 }, { kind: 'seven', x: -2.75 }, { kind: 'cherry', x: -3.6 }, { kind: 'seven', x: -4.45 },
    ] },
  ];
  // …PLUS THE HIGH-ROLLER BANK, in the backroom built further down: the same
  // three personalities at 10x — $20, $50 and $100 a pull, the KING's topper
  // printing its honest $15,000 — against the backroom's own back wall,
  // facing the door you had to show a grand to walk through. ONE buildSlots
  // call for the whole floor, deliberately: the `slot-lever-N` / `slot-*-N`
  // naming contract ct/audio.ts watches indexes per call, and a second call
  // would mint duplicate names (and a second 'ct-slotcab' panel — the makePanel
  // reuse-by-id trap the ⚠ in slotcab documents).
  buildSlots(ctx, room, [
    ...SLOT_ROWS.flatMap((r) =>
      r.cabs.map((c) => ({ kind: c.kind, lx: c.x, lz: r.z, face: r.face as 1 | -1 }))),
    { kind: 'cherry' as const, lx: -4.65, lz: -17.25, face: 1 as const, stakeMul: 10 },
    { kind: 'king' as const, lx: -3.5, lz: -17.25, face: 1 as const, stakeMul: 10 },
    { kind: 'seven' as const, lx: -2.35, lz: -17.25, face: 1 as const, stakeMul: 10 },
  ]);
  // one collider for the high-roller row, same rule as the banks below
  solid(-3.5, -17.35, 3.3, 0.9);

  // ONE collider per bank side, spanning both rows and the spine — 0.23 m
  // gaps are slots you wedge into, the diner's lesson, and the 15 cm spine
  // doubly so. Depth 1.6 covers both rows' tray lips and the levers' balls;
  // the KING's deeper body sits inside the same envelope.
  solid(3.175, 10.8, 3.45, 1.6); solid(-3.175, 10.8, 3.45, 1.6);
  solid(3.175, 4.6, 3.45, 1.6); solid(-3.175, 4.6, 3.45, 1.6);

  // NO STOOLS AT THE MACHINES. 2026-08-10: "remove chairs for all games and
  // tables in casino. it actually is just annoying." You play standing, at
  // the [E] spot each machine wires on its own facing side (ct/slotcab.ts);
  // ESC and [E] leave through the framework, exactly as before.
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
          label: 'sit down',
          // The east bench already has somebody on it (just below), at exactly
          // one of these four places. He claims it through `room.person`; the
          // other three on that bench and all four opposite stay free.
          ok: () => room.inside()
            && !seatTaken(room.wx(bx2 - sx * SIT_OFF), room.wz(LOUNGE_Z + dz)),
        });
      }
    }
    // Somebody waiting on the east bench, so the seats read as FOR sitting on —
    // the same job the four slot players do, and the same call: `seated` on the
    // Look, placed at the seat top this block already declares, no y fudge.
    sitter({ jacket: '#3a3a44', pants: '#2a2830', skin: '#c9a184', hair: '#3a2a1e',
      fit: 'coat', cut: 'short', build: 1 },
    BX - SIT_OFF, LOUNGE_Z - 0.325, SEAT_TOP, -Math.PI / 2,
    // …forward to the front lip of the bench. He is already SIT_OFF in from the
    // centre, so what is left is the rest of the half-depth — 0.115 m, the
    // smallest offset in the world and still the difference between a man on a
    // bench and a torso behind one. DERIVED from the two constants this block
    // already declares; the census measured exactly this number off the built
    // world, which is the check that they agree. (Item 280.)
    BENCH_D / 2 - SIT_OFF);
    // a standing ashtray between the benches and the door, against the wall
    for (const sx of [-1, 1]) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.62, 8),
        new THREE.MeshBasicMaterial({ color: 0x6a6258 })), sx * (hw - 0.45), 0.31, LOUNGE_Z + 1.85);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.09, 8), brassM2),
        sx * (hw - 0.45), 0.66, LOUNGE_Z + 1.85);
    }
  }

  // THREE PLAYERS, NOT A HUNDRED — and STANDING, since the chairs went
  // (2026-08-10). Each stands a stride off a machine's glass, facing it, so
  // the banks read as played from both sides; the floor's effect is still a
  // room too big for the people in it. Sprite facing π is toward −z, the
  // dealer's derivation in reverse.
  room.person({ jacket: '#5a4a3a', pants: '#3a3630', skin: '#c9a184', hair: '#6b5236',
    fit: 'plain', cut: 'short', build: 0 },
  -2.75, 12.15, { facing: Math.PI, h: 0.98, w: 0.95 });          // door bank, front row
  room.person({ jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e',
    fit: 'coat', cut: 'short', build: 1 },
  3.6, 5.95, { facing: Math.PI, h: 0.98, w: 0.95 });             // pit bank, front row
  room.person({ jacket: '#3a4a5a', pants: '#2e2b33', skin: '#8a6a52', hair: '#2a2018',
    fit: 'plain', cut: 'short', build: 0 },
  4.45, 9.45, { facing: 0, h: 0.98, w: 0.95 });                  // door bank, BACK row
  // ── the felt table ──
  //
  // One, because the brief says one, and because a floor of machines with a
  // single table in it is what a neighbourhood casino actually looks like —
  // the tables are where the house pays staff, so there is exactly as much
  // table as the room can justify.
  // THE GAME'S OWN FELT, idle. `paintTable(g, …, null)` is ct/blackjack.ts's
  // one painter with nothing live on it — arc, printed rules, shoe, betting
  // spot — at the same 320 px/m the live canvas plays at. No dither: the live
  // canvas has none (GOTCHAS §1) and the two must be the same picture.
  const feltT = declareSurface(pixTex(BJ_FELT.w, BJ_FELT.h, (g) =>
    paintBlackjackFelt(g, BJ_FELT.w, BJ_FELT.h, null)), 'detail');
  // In the PIT, east side, mirrored by the roulette table across the avenue.
  // The pit sits past the slot bank at mid-floor — you walk the avenue through
  // the machines and come out at the tables, with the cage still the furthest
  // thing from the door. The stools and the dealers hang off these four
  // numbers and nothing else re-types them.
  const TX = 2.7, TZ = -5.0;                    // blackjack, east of the avenue
  const RX = -2.7, RZ = -5.2;                   // roulette, west, wheel at its far end
  const woodM = new THREE.MeshBasicMaterial({ color: DARKWOOD });
  const railM = new THREE.MeshBasicMaterial({ color: 0x3a2226 });
  put(new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 1.0), woodM), TX, 0.36, TZ);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 1.15), railM), TX, 0.77, TZ);
  // ONE MESH, NAMED — ct/blackjack.ts finds `blackjack-felt` at open time,
  // hangs its live canvas on it and locks the view down onto the table (the
  // focus-surface rule: a screen is one mesh, like the mirror's glass). The
  // 1.6 × 0.85 plane and the 512 × 272 canvas are the same 1.882 aspect, so
  // nothing stretches. Canvas TOP faces −z: the dealer's side, where he
  // stands. rotation.x = −π/2 maps local +y (canvas top) to world −z.
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.85), ctx.flat(feltT));
  felt.name = 'blackjack-felt';
  felt.rotation.x = -Math.PI / 2;
  put(felt, TX, 0.83, TZ);
  // the chip tray, moved OFF the felt to the dealer's lip of the wood — at
  // TZ − 0.34 it sat on the playing surface, exactly where the live canvas
  // now deals the dealer's cards
  put(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.12), brassM), TX, 0.84, TZ - 0.50);
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
  // painter that draws SEVENS and the marquee headline (`WINNERS DAILY` since
  // 2026-08-04, `LOOSEST SLOTS` before it) on the front of the building, so the
  // hand is identical rather than merely similar.

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
  // one valance per BANK side, deep enough to roof both back-to-back rows,
  // so the gold-and-bulbs run reads down both blocks from the door — the lit
  // soffit is what says "the machines are HERE" across a dim floor. The bulb
  // runs ride its two long edges, one over each row's faces.
  for (const seg of [
    { cx: 3.175, z: 10.8, w: 3.45 }, { cx: -3.175, z: 10.8, w: 3.45 },
    { cx: 3.175, z: 4.6, w: 3.45 }, { cx: -3.175, z: 4.6, w: 3.45 },
  ]) {
    const t = valT.clone(); t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(Math.round(seg.w / 1.1), 1); t.needsUpdate = true;
    const faceM = ctx.flat(t);
    put(new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.3, 1.8),
      [valTopM, valTopM, valTopM, valTopM, faceM, faceM]), seg.cx, room.H - 0.64, seg.z);
    for (const s2 of [-1, 1]) {
      bulbLine(seg.cx - seg.w / 2 + 0.15, 2.08, seg.z + s2 * 0.9,
               seg.cx + seg.w / 2 - 0.15, 2.08, seg.z + s2 * 0.9, 0.34);
    }
  }
  void valFaceM;
  // ── 777 on the back wall, in the facade's own red tube ──
  //
  // At x −2.0 until the backroom landed (2026-08-10): the high-roller wall
  // now claims the west end of this elevation, so the sign moves to the slot
  // BETWEEN the backroom's partition (x −1.5) and the cage's bulbs (x 1.4) —
  // still the glitter at the end of the avenue's long dark walk.
  const sevensT = declareSurface(pixTex(72, 26, (g) => {
    g.fillStyle = '#2a1418'; g.fillRect(0, 0, 72, 26);
    g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 72, 2); g.fillRect(0, 24, 72, 2);
    tube(g, '777', 36, 13, 20, '#ff4a3a', '#ffd8c0', '#3a1016');
  }), 'sign');
  put(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.83), ctx.flat(sevensT)), -0.05, 1.86, -hd + 0.07);
  bulbLine(-1.15, 1.30, -hd + 0.10, 1.05, 1.30, -hd + 0.10, 0.3);

  // ── THE PIT: TWO TABLE GAMES, EACH A REAL DESTINATION ─────────────────
  //
  // 2026-08-09: "there should be black jack and roulette as table games."
  // Exactly two — the craps table, poker oval and video-poker run that used to
  // crowd this pit are GONE: furniture offering a game it cannot honour is the
  // same lie as a stool nobody can reach, and the old pit had three of them
  // jammed against a slot bank. Blackjack (east) has been playable since
  // ae4147cee — sit at the felt and ct/blackjack.ts opens. Roulette (west) is
  // its mirror: sit at the wheel and ct/roulette.ts opens, over the same
  // seat-label bridge.
  {
    const rail = new THREE.MeshBasicMaterial({ color: 0x3a2226 });
    const wood = new THREE.MeshBasicMaterial({ color: DARKWOOD });
    const chrome = new THREE.MeshBasicMaterial({ color: 0x9a9488 });
    const ivory = new THREE.MeshBasicMaterial({ color: 0xd8d0bc });

    // ROULETTE — the long green table with the wheel at its far end, the only
    // round thing on the floor. The wheel head and ball are NAMED
    // ('roulette-wheel-head', 'roulette-ball'): ct/roulette.ts finds them by
    // name and turns them while a spin runs, so the room's wheel moves when
    // the game's does — and audio can watch the same meshes.
    {
      put(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.72, 2.05), wood), RX, 0.36, RZ);
      put(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.10, 2.2), rail), RX, 0.77, RZ);
      // THE WHOLE TABLETOP IS ONE MESH, NAMED — ct/roulette.ts hangs its live
      // canvas on `roulette-felt` and locks the view down onto it (2026-08-09,
      // "blackjack and roulettte need to be diagetic"). Painted by the game's
      // own painter in the idle state, so the printed layout you see walking
      // past IS the layout you bet on. The plane is oriented so canvas RIGHT
      // runs toward −z (the wheel's end) and canvas TOP toward −x — the frame
      // the locked pose (faceYaw −π/2) reads it in: with Euler XYZ, rotation
      // (−π/2, 0, π/2) maps local +x → −z and local +y → −x.
      const rfeltT = declareSurface(pixTex(RL_FELT.w, RL_FELT.h, (g) =>
        paintRouletteFelt(g, RL_FELT.w, RL_FELT.h, null)), 'detail');
      const rfelt = new THREE.Mesh(new THREE.PlaneGeometry(1.94, 1.18), ctx.flat(rfeltT));
      rfelt.name = 'roulette-felt';
      rfelt.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      put(rfelt, RX, 0.83, RZ - 0.05);
      // the wheel: wooden rim, chrome bowl, and the head that spins
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.10, 16), wood), RX, 0.86, RZ - 0.62);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.05, 16), chrome), RX, 0.92, RZ - 0.62);
      // THE HEAD IS THE SHOW NOW — the locked view watches this object, not a
      // painted copy, so it carries the real thing: 37 pockets in EUROPEAN
      // WHEEL ORDER (RL_WHEEL), coloured by the same REDS the game pays on,
      // numbered on a ring. Pocket i is CENTRED at canvas angle i/37·TAU —
      // ct/roulette.ts's hook rotates the head to π/2 − wheelA against
      // exactly this convention so the ball lands in the number it announces.
      const headT = declareSurface(pixTex(192, 192, (g) => {
        const C = 96, TAU2 = Math.PI * 2;
        g.fillStyle = '#2a2018'; g.fillRect(0, 0, 192, 192);
        for (let p = 0; p < RL_WHEEL.length; p++) {
          const n = RL_WHEEL[p];
          const a0 = ((p - 0.5) / 37) * TAU2, a1 = ((p + 0.5) / 37) * TAU2;
          g.fillStyle = n === 0 ? '#1e7c3c' : RL_REDS.has(n) ? '#c8342c' : '#26222c';
          g.beginPath(); g.moveTo(C, C);
          g.arc(C, C, 92, a0, a1); g.closePath(); g.fill();
        }
        // the pocket wells, a darker band inside the number ring
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.beginPath(); g.arc(C, C, 64, 0, TAU2); g.fill();
        // the numbers, radial like the real thing
        g.fillStyle = '#ece6d4'; g.font = 'bold 11px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let p = 0; p < RL_WHEEL.length; p++) {
          const a = (p / 37) * TAU2;
          g.save();
          g.translate(C + Math.cos(a) * 77, C + Math.sin(a) * 77);
          g.rotate(a + Math.PI / 2);
          g.fillText(String(RL_WHEEL[p]), 0, 0);
          g.restore();
        }
        // separator frets between pockets
        g.strokeStyle = 'rgba(201,164,94,0.55)'; g.lineWidth = 1;
        for (let p = 0; p < RL_WHEEL.length; p++) {
          const a = ((p + 0.5) / 37) * TAU2;
          g.save(); g.translate(C, C); g.rotate(a);
          g.beginPath(); g.moveTo(24, 0); g.lineTo(92, 0); g.stroke();
          g.restore();
        }
        // the hub
        g.fillStyle = '#8a6a22'; g.beginPath(); g.arc(C, C, 22, 0, TAU2); g.fill();
        g.fillStyle = '#c9a45e'; g.beginPath(); g.arc(C, C, 19, 0, TAU2); g.fill();
        g.fillStyle = '#2a2018'; g.beginPath(); g.arc(C, C, 5, 0, TAU2); g.fill();
      }), 'detail');
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24),
        [chrome, ctx.flat(headT), chrome]);
      head.name = 'roulette-wheel-head';
      put(head, RX, 0.96, RZ - 0.62);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 8), chrome), RX, 1.04, RZ - 0.62);
      // 0.028, up from 0.022 — the ball is the thing the locked pose watches
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), ivory);
      ball.name = 'roulette-ball';
      put(ball, RX + 0.30, 1.00, RZ - 0.62);
      for (const lz of [-0.85, 0.85]) for (const lx of [-0.55, 0.55]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.78, 0.10), wood), RX + lx, 0.39, RZ + lz);
      }
      solid(RX, RZ, 1.75, 2.35);
      // the croupier, wheel side, back to the west wall — where one stands
      room.person({
        jacket: '#3a2226', pants: '#241e22', skin: '#d8b48a', hair: '#3a2a1e',
        fit: 'plain', accent: '#d8d0c0', cut: 'short', build: 1,
      }, RX - 1.15, RZ - 0.45, { facing: Math.PI / 2, h: 0.98, w: 0.95 });
    }

    // NO CHAIRS AT THE TABLES EITHER — 2026-08-10: "remove chairs for all
    // games and tables in casino. it actually is just annoying." You play
    // STANDING at the rail: one [E] spot per table opens the same locked
    // diegetic view the stools used to open (the view itself is unchanged,
    // and ESC/[E]/LEAVE still close it through the framework — nothing modal
    // outlives walking up to a table). The spots stand where the seats were:
    // the player side of the blackjack felt, the avenue side of the wheel.
    ctx.spot({
      x: room.wx(TX), z: room.wz(TZ + 1.05), r: 1.15,
      aimX: room.wx(TX), aimZ: room.wz(TZ), obj: felt,
      label: () => 'play blackjack',
      ok: () => room.inside(),
      act: () => openBlackjack(),
    });
    ctx.spot({
      x: room.wx(RX + 1.35), z: room.wz(RZ + 0.2), r: 1.15,
      aimX: room.wx(RX), aimZ: room.wz(RZ),
      obj: room.group.getObjectByName('roulette-felt') ?? undefined,
      label: () => 'play roulette',
      ok: () => room.inside(),
      act: () => openRoulette(),
    });

    // KENO — the lit board, moved to the deep west wall where the floor runs
    // dark toward the cage: numbers glowing at the far end of the room
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
      put(kb, -hw + 0.06, 2.05, -11.5);
    }
  }

  // ── the pit rope ───────────────────────────────────────────────────────
  //
  // Brass posts and a slack line across the front of the pit, the middle span
  // open on the avenue's centreline — a rope you cannot cross is a wall, and
  // this one has no collider at all; it is a threshold, not a fence.
  {
    const postM = new THREE.MeshBasicMaterial({ color: 0xb98f30 });
    const ropeM = new THREE.MeshBasicMaterial({ color: 0x6a1f28 });
    const PX0 = -4.2, PX1 = 4.2, PZ = -2.6;
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
  // and the reason this room is losing money in the same building that is.
  // On the KING's own valance, naturally.
  const deadM = new THREE.MeshBasicMaterial({ color: 0x4a4238 });
  {
    // the pit bank's west valance, door edge — right over the KING's crown
    for (let i = 0; i < 5; i++) {
      put(new THREE.Mesh(bulbGeo, deadM), -2.9 + i * 0.34, 2.08, 4.6 + 0.9);
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
  pool(2.8, 2.0, TX, TZ);                       // over the blackjack felt
  pool(2.8, 2.6, RX, RZ);                       // over the roulette wheel
  pool(3.2, 2.2, 0, 12.6);                      // the entry, first pool you cross
  // the cross-aisle between the two banks, lit in a band each side, and the
  // pit-side faces of the deep bank — each row of glass gets its own light
  pool(6.4, 1.8, 3.175, 7.7); pool(6.4, 1.8, -3.175, 7.7);
  pool(6.4, 1.6, 3.175, 2.9); pool(6.4, 1.6, -3.175, 2.9);
  pool(3.0, 2.2, 0, 2.0);                       // mid-avenue, walking to the pit
  pool(3.0, 2.2, 0, -12.0);                     // the long dark walk to the cage
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

  // ── THE BIG SIX WHEEL — the big vertical money wheel (2026-08-10: "yea add
  // wheel of fortune") ──────────────────────────────────────────────────────
  //
  // East wall, mid-deep — you see it turning from the door, down the east
  // aisle past the banks, which is the whole reason a house stands one: a
  // roulette wheel hides in its table, a Big Six IS its own sign. The game
  // lives in ct/bigsix.ts; this file owns the STAND: podium, posts, the head
  // (painted by the game's own paintWheelFace, so the wheel you watch is the
  // wheel that pays), the flapper, and the tall invisible pane the locked
  // view hangs on — slotcab's session-pane trick, because the show here is
  // vertical. NAMES ARE THE CONTRACT: 'bigsix-wheel-head' (userData.speed),
  // 'bigsix-flapper' (userData.flap) and 'bigsix-pane' are what ct/bigsix.ts
  // turns and what audio will watch.
  {
    const BS_X = 4.92, BS_Z = -11.2;
    const chrome = new THREE.MeshBasicMaterial({ color: 0x9a9488 });
    // the podium, with the betting counter printed on its face — the game's
    // own painter in the idle state, one painter both moments (the felt rule)
    put(new THREE.Mesh(new THREE.BoxGeometry(0.80, 1.05, 1.80), woodM), BS_X, 0.525, BS_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 1.86), railM), BS_X, 1.06, BS_Z);
    const bsBoardT = declareSurface(pixTex(BS_BOARD.w, BS_BOARD.h, (g) =>
      paintBigSixBoard(g, BS_BOARD.w, BS_BOARD.h, null)), 'detail');
    const bsBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.66), ctx.flat(bsBoardT));
    bsBoard.rotation.y = -Math.PI / 2;            // facing the avenue, −x
    put(bsBoard, BS_X - 0.41, 0.66, BS_Z);
    // the A-posts and crossbar that carry the wheel
    for (const sz of [-1, 1]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.87, 0.12), woodM),
        BS_X, 1.05 + 0.935, BS_Z + sz * 0.95);
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 2.02), woodM), BS_X, 2.92, BS_Z);
    // THE WHEEL. The stand group's Rz(π/2) turns the cylinder's +y cap to
    // face −x (the avenue), so the head's own rotation.y — the axis the game
    // drives — spins it in the vertical plane. Pocket i is centred at canvas
    // angle i/N·TAU (paintWheelFace's convention); the flapper hangs at
    // world UP = local +x = bearing π/2, and ct/bigsix.ts rotates the head
    // to π/2 + wheelA against exactly that.
    const stand = new THREE.Group();
    put(stand, BS_X - 0.15, 1.95, BS_Z);
    stand.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.06, 36), woodM);
    stand.add(rim);
    // the head's texel size is the GAME's call — it owns the lettering that
    // has to survive it (2026-08-11: "big six wheel is illegible"). 512 over
    // the 1.64 m head is ~312 px/m, up from 224's starved 136.
    const bsFaceT = declareSurface(
      pixTex(BS_FACE, BS_FACE, (g) => paintBigSixFace(g, BS_FACE)), 'detail', BS_FACE / 1.64);
    const bsHead = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.05, 36),
      [chrome, ctx.flat(bsFaceT), chrome]);
    bsHead.name = 'bigsix-wheel-head';
    bsHead.userData.speed = 0;
    bsHead.position.y = 0.035;
    stand.add(bsHead);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.10, 10), brassM);
    hub.position.y = 0.09;
    stand.add(hub);
    // the flapper: bracket off the crossbar, blade hanging over the pegs.
    // Its own group in world space — rotation.x flaps the blade in z, the
    // wheel's plane, which is the clack audio will hang here.
    put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.04), brassM), 4.81, 2.89, BS_Z);
    const flapper = new THREE.Group();
    put(flapper, 4.68, 2.88, BS_Z);
    flapper.name = 'bigsix-flapper';
    flapper.userData.flap = 0;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xc81e28 }));
    blade.position.y = -0.11;
    flapper.add(blade);
    // the session pane — invisible until the panel framework borrows it;
    // covers the wheel (upper frame, kept transparent so the 3D head stays
    // the show) and the counter (painted live into its bottom region)
    const paneCv = document.createElement('canvas');
    paneCv.width = 1; paneCv.height = 1;
    // height DERIVED from the game's canvas aspect — the pane and the pixels
    // it will carry are one authoring, so nothing can stretch
    const bsPane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9 * BS_PANE.h / BS_PANE.w),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(paneCv), transparent: true, depthWrite: false }));
    bsPane.name = 'bigsix-pane';
    bsPane.rotation.y = -Math.PI / 2;
    put(bsPane, 4.49, 1.55, BS_Z);
    // BIG SIX in the facade's own tube hand, riding the crossbar
    const bsSignT = declareSurface(pixTex(80, 22, (g) => {
      g.fillStyle = '#2a1418'; g.fillRect(0, 0, 80, 22);
      g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 80, 2); g.fillRect(0, 20, 80, 2);
      tube(g, 'BIG SIX', 40, 11, 13, '#e8c25a', '#fff4d0', '#2a2018');
    }), 'sign');
    const bsSign = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.40), ctx.flat(bsSignT));
    bsSign.rotation.y = -Math.PI / 2;
    put(bsSign, 4.86, 3.18, BS_Z);
    solid(5.0, BS_Z, 1.15, 2.2);
    pool(2.4, 2.4, 4.3, BS_Z);
    ctx.spot({
      x: room.wx(3.55), z: room.wz(BS_Z), r: 1.25,
      aimX: room.wx(4.77), aimZ: room.wz(BS_Z), obj: stand,
      label: () => 'play the big six',
      ok: () => room.inside(),
      act: () => openBigSix(),
    });
  }

  // ── THE HIGH-ROLLER BACKROOM ──────────────────────────────────────────────
  //
  // 2026-08-10: "add a high-roller backroom with a 1k cash entrance crit. you
  // dont need to spend it to get in but you have to have 1k on hand to get
  // in." So: the deep west corner walled off in its own palette — baize green
  // and brass against the floor's oxblood — behind a doorway with a doorman,
  // a printed $1,000 rule, and a rope that is DOWN when your wallet clears it.
  //
  // THE CHECK IS A CHECK, NEVER A CHARGE, AND IT LIVES AT THE DOOR ONLY. The
  // doorway's collider is the mechanism: parked out of the world while the
  // wallet holds $1,000 (you just walk in — nothing is taken), live across
  // the opening while it doesn't. Three zones, latched, so the door can never
  // close ON you: standing anywhere INSIDE parks the collider outright —
  // going broke at the $100 slots ejects nobody, and leaving is a plain walk
  // out — the doorway VESTIBULE holds whatever state you crossed it with (a
  // wall must not materialise around a body mid-threshold), and everywhere
  // else the wallet is re-read. A poor player pushing at the door rests
  // against the box well outside the vestibule's far edge, so the gate they
  // feel is the gate that stays.
  {
    const BR_X = -1.5, BR_Z = -10.6;              // partition and front planes
    const DOOR_BX = -2.6, DOOR_BW = 1.3, DOOR_BH = 2.2;
    const brWallM = new THREE.MeshBasicMaterial({ color: 0x1c3226 });
    const brDadoM = new THREE.MeshBasicMaterial({ color: 0x122419 });
    const brassM3 = new THREE.MeshBasicMaterial({ color: 0xc9a45e });

    // the partition (full depth of the corner) and the front wall, split
    // round the doorway. Wainscot and a brass rail proud of BOTH faces, so
    // the palette change reads from the avenue too.
    put(new THREE.Mesh(new THREE.BoxGeometry(0.16, room.H, 7.4), brWallM), BR_X, room.H / 2, -14.3);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 7.4), brDadoM), BR_X, 0.5, -14.3);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 7.4), brassM3), BR_X, 1.02, -14.3);
    solid(BR_X, -14.3, 0.16, 7.4);
    for (const seg of [{ cx: -4.375, w: 2.25 }, { cx: -1.725, w: 0.45 }]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(seg.w, room.H, 0.16), brWallM), seg.cx, room.H / 2, BR_Z);
      put(new THREE.Mesh(new THREE.BoxGeometry(seg.w, 1.0, 0.18), brDadoM), seg.cx, 0.5, BR_Z);
      put(new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.05, 0.19), brassM3), seg.cx, 1.02, BR_Z);
      solid(seg.cx, BR_Z, seg.w, 0.16);
    }
    // the lintel over the opening — VISUAL ONLY, never a collider: colliders
    // here are infinite-height columns (fp.ts), and a solid lintel would be
    // a wall across its own doorway
    put(new THREE.Mesh(new THREE.BoxGeometry(DOOR_BW + 0.3, room.H - DOOR_BH, 0.16), brWallM),
      DOOR_BX, DOOR_BH + (room.H - DOOR_BH) / 2, BR_Z);
    // gold architrave, both faces — the same portal grammar as the way in
    put(new THREE.Mesh(new THREE.BoxGeometry(DOOR_BW + 0.44, 0.16, 0.22), goldM),
      DOOR_BX, DOOR_BH + 0.06, BR_Z);
    for (const sx of [-1, 1]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.15, DOOR_BH + 0.16, 0.22), goldM),
        DOOR_BX + sx * (DOOR_BW / 2 + 0.10), (DOOR_BH + 0.16) / 2, BR_Z);
    }
    // the rule, printed over the door where you read it before you try it
    const hlT = declareSurface(pixTex(96, 36, (g) => {
      g.fillStyle = '#101c15'; g.fillRect(0, 0, 96, 36);
      g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 96, 2); g.fillRect(0, 34, 96, 2);
      tube(g, 'HIGH LIMIT', 48, 12, 12, '#e8c25a', '#fff4d0', '#2a2018');
      g.fillStyle = '#9ab0a0'; g.font = '6px monospace'; g.textAlign = 'center';
      g.fillText('$1,000 ON HAND TO ENTER', 48, 30);
    }), 'sign');
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), ctx.flat(hlT)),
      DOOR_BX, 2.86, BR_Z + 0.10);

    // ── the gate itself ──
    const gate = solid(DOOR_BX, BR_Z, DOOR_BW + 0.24, 0.5);
    const gateHome = { minX: gate.minX, maxX: gate.maxX, minZ: gate.minZ, maxZ: gate.maxZ };
    // the rope: down across the doorway while the gate is live — the collider
    // made visible, so nobody shoulders an invisible wall (posts stay put)
    // IN the opening, not in front of it: a blocked player rests 0.46 m shy
    // of this line, so the rope is a thing seen, never a thing clipped through
    for (const sx of [-1, 1]) {
      const px = DOOR_BX + sx * (DOOR_BW / 2 + 0.18);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.92, 8), brassM3), px, 0.46, -10.45);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), brassM3), px, 0.95, -10.45);
    }
    const rope = new THREE.Mesh(new THREE.BoxGeometry(DOOR_BW + 0.36, 0.05, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x6a1f28 }));
    put(rope, DOOR_BX, 0.80, -10.45);
    let gateOpen = false;
    ctx.onFrame((f) => {
      const lx = f.px - room.wx(0), lz = f.pz - room.wz(0);
      const inBack = room.inside() && lx < BR_X && lz < BR_Z;
      const inVest = room.inside() && Math.abs(lx - DOOR_BX) < 1.35
        && lz >= BR_Z - 0.35 && lz < -9.4;
      if (inBack) gateOpen = true;                // the door never holds you IN
      else if (!inVest) gateOpen = ctx.purse.cash >= 1000;   // THE CHECK
      // else: mid-threshold — hold the state you crossed with
      if (gateOpen) {
        gate.minX = 9999; gate.maxX = 9999.1; gate.minZ = 9999; gate.maxZ = 9999.1;
      } else {
        gate.minX = gateHome.minX; gate.maxX = gateHome.maxX;
        gate.minZ = gateHome.minZ; gate.maxZ = gateHome.maxZ;
      }
      rope.visible = !gateOpen;
    }, HOOK.WORLD);

    // ── the doorman — the rule with a face on it ──
    const dm = room.person({
      jacket: '#1a1a20', pants: '#14141a', skin: '#8a6a52', hair: '#1a1410',
      fit: 'coat', accent: '#d8d0c0', cut: 'short', build: 1,
    }, -3.78, -9.95, { facing: 0.55, h: 1.0, w: 1.0 });
    const dmTalk = talker(ctx, {
      obj: dm.mesh, name: 'doorman',
      lines: () => (ctx.purse.cash >= 1000
        ? ['evening. the room\'s open to you — mind the rope on the way out.']
        : [`the room behind me is for players holding a grand. you\'re $${
          Math.max(0, 1000 - Math.floor(ctx.purse.cash))} short.`,
        'the nickel slots are lovely this time of year. that way.']),
    });
    ctx.spot({
      x: room.wx(-3.35), z: room.wz(-9.35), r: 1.25,
      aimX: room.wx(-3.78), aimZ: room.wz(-9.95), obj: dm.mesh,
      label: dmTalk.label,
      ok: () => room.inside(),
      act: () => dmTalk.say(),
    });

    // ── inside: the corner re-skinned in its own palette ──
    //
    // Liner planes over the room's oxblood on the two outer walls, a darker
    // busier carpet, its own pools and bulb run — tighter, greener, brassier.
    const linerM = new THREE.MeshBasicMaterial({ color: 0x1c3226 });
    const wLiner = new THREE.Mesh(new THREE.PlaneGeometry(7.3, room.H - 0.1), linerM);
    wLiner.rotation.y = Math.PI / 2;
    put(wLiner, -hw + 0.045, (room.H - 0.1) / 2, -14.3);
    const bLiner = new THREE.Mesh(new THREE.PlaneGeometry(3.95, room.H - 0.1), linerM);
    put(bLiner, -3.52, (room.H - 0.1) / 2, -hd + 0.045);
    const brCarpT = declareSurface(pixTex(48, 48, (g) => {
      g.fillStyle = '#12241b'; g.fillRect(0, 0, 48, 48);
      g.fillStyle = '#1c3a2a';
      for (const [cx, cy] of [[12, 12], [36, 12], [12, 36], [36, 36]] as const) {
        for (let t = 0; t <= 7; t++) {
          const r = 7 - t;
          g.fillRect(cx + t, cy - r, 1, 1); g.fillRect(cx - t, cy - r, 1, 1);
          g.fillRect(cx + t, cy + r, 1, 1); g.fillRect(cx - t, cy + r, 1, 1);
        }
      }
      g.fillStyle = '#8a6a2c';
      for (const [cx, cy] of [[12, 12], [36, 12], [12, 36], [36, 36]] as const) {
        g.fillRect(cx - 1, cy - 1, 2, 2);
      }
      dither(g, 48, 48, 120);
    }), 'ground');
    brCarpT.wrapS = brCarpT.wrapT = THREE.RepeatWrapping;
    brCarpT.repeat.set(2, 4);
    const brCarp = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 7.3), ctx.flat(brCarpT));
    brCarp.rotation.x = -Math.PI / 2;
    put(brCarp, -3.52, 0.016, -14.3);
    pool(2.6, 1.8, -3.5, -16.8);                  // over the $100 machines
    pool(2.4, 2.0, -3.5, -13.2);                  // the middle of the room
    bulbLine(-4.85, 2.5, -16.55, -2.15, 2.5, -16.55, 0.34);

    // a short buttoned banquette on the west wall — somewhere to sit and
    // watch your money go; both places registered, the standing rule
    {
      const SEAT_TOP = 0.44, BL = 2.0, BX2 = -hw + 0.42, BZ2 = -13.2, SIT_OFF = 0.16;
      const plushM2 = new THREE.MeshBasicMaterial({ color: 0x1e4432 });
      const btnM2 = new THREE.MeshBasicMaterial({ color: 0x163227 });
      put(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, BL), btnM2), BX2, 0.06, BZ2);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, BL), plushM2), BX2, SEAT_TOP - 0.07, BZ2);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, BL), plushM2),
        -hw + 0.16, SEAT_TOP + 0.31, BZ2);
      for (const bz of [-0.6, 0, 0.6]) for (const by of [0.20, 0.46]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), btnM2),
          -hw + 0.24, SEAT_TOP + by, BZ2 + bz);
      }
      put(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, BL), brassM3),
        -hw + 0.16, SEAT_TOP + 0.64, BZ2);
      solid(BX2, BZ2, 0.83, BL);
      for (const dz of [-0.5, 0.5]) {
        ctx.seat({
          x: room.wx(BX2 + SIT_OFF), z: room.wz(BZ2 + dz),
          yaw: Math.PI / 2, h: SEAT_TOP,
          approach: { x: room.wx(BX2 + 0.9), z: room.wz(BZ2 + dz) },
          label: 'sit down',
          ok: () => room.inside() && !seatTaken(room.wx(BX2 + SIT_OFF), room.wz(BZ2 + dz)),
        });
      }
      // a brass ashtray at the bench's elbow, same part as the lounge's
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.62, 8),
        new THREE.MeshBasicMaterial({ color: 0x6a6258 })), -hw + 0.45, 0.31, BZ2 + 1.35);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.09, 8), brassM3),
        -hw + 0.45, 0.66, BZ2 + 1.35);
    }
  }
}

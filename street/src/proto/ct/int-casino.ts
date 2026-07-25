import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { tube, VICE_DOOR_X } from './vice';

// GOLDEN ACES, inside.
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
// GOLDEN ACES stands at the far end of the side street, x ∈ [45.45, 57.00] in
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
  building: 'GOLDEN ACES', w: 11.55, cz: 51.225, side: 1, at: 0,
  width: 1.15,
  // THE LEAF THIS BUILDING SHOULD DECLARE, and why it is not declared yet:
  //
  //   leaf: { clearW: 2.4, h: 2.7, leaves: 2,
  //           frame: { colour: 0xc8a94e, material: 'brass' }, glazing: 'full' }
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
  face: { x: VICE_DOOR_X['GOLDEN ACES'], z: -96.0, nx: 0, nz: -1 },
};

export function buildCasino(ctx: CtxBuild): void {
  const DOOR_X = 51.29, WALK_Z = -97.0;
  const room = buildRoom(ctx, {
    id: 'casino',
    building: 'GOLDEN ACES',   // finds the published DoorLeaf above
    label: 'into GOLDEN ACES',
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
    w: 10.5, d: 9.0, h: 2.9,
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
      at: 0, width: 1.15,
      // Step out ALONG the walk, east, away from the way-in trigger. The north
      // side-street walk is only the 2 m band z ∈ (-98, -96) and the building
      // collider eats down to -96.3, so there is about a metre of standing
      // room — you cannot clear a 1.05 m trigger by stepping back from the
      // door without stepping into the road. Going 1.55 m along it gives
      // 1.57 m of separation, clear of the kit's doorR + 0.35 check.
      outX: DOOR_X + 1.55, outZ: WALK_Z - 0.25, outYaw: 0, outGy: ctx.KERB_H,
    },
    // NO window. The kit makes this an omission rather than a special case —
    // `window` is optional and the front wall is built from the runs between
    // its openings, so leaving it out gives a solid wall with just the doorway
    // in it. This was the queue's test of the kit and the kit passes it.
  });

  const { put, solid } = room;
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
  const DW = 1.15, DH = 2.15, dAt = room.doorAt;

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
  const TILE = 2.4;
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
    // stars where the lattice crosses — the fourth motif, one too many
    g.fillStyle = '#a8863a';
    for (const cx of [0, 24, 48]) for (const cy of [0, 24, 48]) {
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
  const slotGeo = new THREE.BoxGeometry(0.6, 1.45, 0.6);
  const slotMats = SKINS.map(([topper, side], i) => {
    const front = ctx.flat(slotSkin(
      topper,
      ['#8a2c32', '#c9a45e', '#2c6a4a'][i],
      '#' + side.toString(16).padStart(6, '0'),
      i === 2 ? '#5a5048' : '#3a3038'));
    const sideM = new THREE.MeshBasicMaterial({ color: side });
    return [sideM, sideM, sideM, sideM, front, sideM];
  });

  const SLOT_X0 = -4.55, SLOT_PITCH = 0.64, SLOT_N = 9;
  const bankX0 = SLOT_X0 - 0.3, bankX1 = SLOT_X0 + (SLOT_N - 1) * SLOT_PITCH + 0.3;
  const bankCx = (bankX0 + bankX1) / 2, bankW = bankX1 - bankX0;
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
  let rowN = 0;
  for (const bz of [-1.6, 0.9]) {
    for (const face of [1, -1]) {
      const row = ROWS[rowN++];
      for (let i = 0; i < SLOT_N; i++) {
        const m = new THREE.Mesh(slotGeo, slotMats[row[i]]);
        if (face < 0) m.rotation.y = Math.PI;
        put(m, SLOT_X0 + i * SLOT_PITCH, 0.725, bz + face * 0.35);
      }
    }
    // ONE collider per bank, not one per machine. The cabinets are 0.04 m
    // apart and the player is 0.72 m across, so per-machine boxes would only
    // carve slots you wedge into — the same lesson the diner's booths taught.
    solid(bankCx, bz, bankW, 1.3);
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
  const TX = 3.1, TZ = 0.4;
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
  const CAGE_X = 3.0, CAGE_W = 3.0, CAGE_Z = -hd + 0.3;
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
  // painter that draws GOLDEN ACES and LOOSEST SLOTS on the front of the
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
  for (const bz of [-1.6, 0.9]) {
    const t = valT.clone(); t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(Math.round(bankW / 1.1), 1); t.needsUpdate = true;
    const faceM = ctx.flat(t);
    put(new THREE.Mesh(new THREE.BoxGeometry(bankW, 0.3, 1.0),
      [valTopM, valTopM, valTopM, valTopM, faceM, faceM]), bankCx, room.H - 0.64, bz);
    for (const s2 of [-1, 1]) {
      bulbLine(bankCx - bankW / 2 + 0.15, 2.08, bz + s2 * 0.5,
               bankCx + bankW / 2 - 0.15, 2.08, bz + s2 * 0.5, 0.34);
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
  for (let i = 0; i < 5; i++) {
    put(new THREE.Mesh(bulbGeo, deadM), bankCx - bankW / 2 + 0.15 + i * 0.34, 2.08, 0.9 + 0.5);
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
  pool(2.8, 2.0, TX, TZ);           // over the table
  pool(6.4, 1.6, bankCx, -0.35);    // the aisle between the banks
  pool(6.4, 1.6, bankCx, -3.0);     // the aisle in front of the cage

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

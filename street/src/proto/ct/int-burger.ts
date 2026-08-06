import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
// FOR THE SIDE EFFECT, and it is the whole point of the import: `ct/goods.ts`
// calls `defineItem` at module scope, so importing it is what puts a burger, a
// carton of fries and the rest into the one item table the bag and the wallet
// read. Without this the board would sell seven wrapped parcels.
import './goods';

// BURGER BARN, inside.
//
// Read this against `ct/int-diner.ts` — they are the two ends of the range
// every other interior sits between, and the contrast is the point of building
// them next to each other. The diner is warm, chrome, upholstered, dim: a room
// that wants you to stay. This is the opposite in every decision. Brighter
// than anything else in the world, hard surfaces to the waist, moulded plastic
// bolted to the floor, fluorescent troffers instead of opal domes, and NOT ONE
// SOFT SEAT. A 1997 fast-food room is designed to turn a table in nine
// minutes, and it should feel like it.
//
// The palette is the facade's, exactly: `burgerFront` in ct/street.ts paints
// the shopfront in three colours and says "Change them here, nowhere else" —
// so these are read off it rather than re-picked. Red and BEIGE. The user
// rejected red/yellow twice and the mustard is what read as the second colour.
const BB_RED = 0xc8302a;
const BB_INSIDE = 0xe0d2b4;
/** the same red, as a canvas colour — DERIVED, so the two cannot drift apart */
const BB_RED_HEX = `#${BB_RED.toString(16).padStart(6, '0')}`;

// WHERE IT IS is not written here. The room names its building and the kit
// reads `frontageOf('BURGER BARN', 16)` — the same object the facade painter
// draws from — for the door centre, its width, the glazing and the [E] spot.
//
// This file used to derive that by hand from the painter's texel arithmetic,
// which was right at the time and wrong the moment A moved the door: the
// derivation said z = -28.25 and the published door is now at -29.0.

/**
 * WHERE THIS ROOM'S DOOR IS. Declared here, in the local terms the room is
 * actually laid out around, and the FACADE follows it — `ct/doors.ts` explains
 * why that direction and not the other one.
 *
 * `at` is the number this room was built against: the counter, the seating and
 * the walking route are all placed relative to it. Changing it moves the
 * painted shopfront door to match, not the other way round.
 */
export const DOOR: DoorDecl = {
  building: 'BURGER BARN', w: 16, cz: -29, side: -1, at: -3.6, width: 1.2,
};

export function buildBurger(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'burger',
    label: 'into BURGER BARN',
    // wider, deeper and taller than the diner. Fast food buys floor area and
    // spends it on turnover; the height is what stops all that hard surface
    // feeling like a corridor.
    d: 8.5, h: 3.2,
    // The wall is BB_INSIDE, and that is not a free choice: it is the colour
    // `burgerFront` paints behind the glass as "lit right through". That patch
    // is what the street promises this room looks like, so the room has to
    // deliver it — walk in and the wall is the colour you saw from outside.
    palette: { floor: 0xbdb5a2, wall: BB_INSIDE, ceil: 0xd8d4cc, trim: BB_RED },
    // tile to the waist, painted block above — the brief, and the single
    // biggest reason this room does not read like the diner
    wainscot: { h: 1.15, tile: 0.34, face: 0xd2c8b0, grout: 0xb2a996 },
    // fluorescent, cool, and more of them than the room needs. Over-lighting
    // is not an accident in these places.
    light: { kind: 'troffer', tint: 0xeaf2f6, count: 4 },
    frontage: { name: 'BURGER BARN', w: 16, cz: -29, side: -1 },
    door: { r: 1.05, at: DOOR.at, width: DOOR.width },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const redM = new THREE.MeshBasicMaterial({ color: BB_RED });

  // ── the floor: quarry tile, not a checker ──
  //
  // The diner has the checkerboard. Giving this one a checker too — even in
  // different colours — would collapse the contrast the whole room is for.
  // This is the small hard reddish quarry tile every fast-food place had,
  // laid tight, and it reads as easy-to-mop rather than as decoration.
  const tileT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#8a7a6a'; g.fillRect(0, 0, 32, 32);            // grout bed
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const warm = (x * 5 + y * 3) % 4;
      g.fillStyle = ['#a8785e', '#9e7058', '#b08066', '#a07a60'][warm];
      g.fillRect(x * 8, y * 8, 7, 7);
    }
    dither(g, 32, 32, 40);
  }), 'ground');
  tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping;
  tileT.repeat.set(Math.round(room.W / 1.6), Math.round(room.D / 1.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(tileT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ── the order counter ──
  //
  // Taller than the diner's (1.15 against 1.02) and that is deliberate: a
  // diner counter is something you sit AT, this is something you stand at and
  // are served across. No overhang, no knee room, no stools — the three
  // things that made the diner's counter hospitable are all absent here.
  // Everything below is sized off the ROOM, not off a constant, because the
  // room is sized off the frontage and the frontage can change. It did: the
  // kit's width rule took this room from 11.0 m to 14.8 m to match 16 m of
  // shopfront, and a 7.4 m counter centred in it left four metres of bare
  // tile at each end. Furniture that does not follow its room is how a room
  // grows into a waiting hall.
  const CZ = -hd + 1.25, CL = room.W * 0.68, CCX = -room.W * 0.036;
  const counterFaceT = declareSurface(pixTex(96, 24, (g) => {
    g.fillStyle = '#c8302a'; g.fillRect(0, 0, 96, 24);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < 96; x += 12) g.fillRect(x, 0, 1, 24);     // moulded panel joints
    g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, 96, 2);             // beige capping
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 21, 96, 3);   // kick shadow
    dither(g, 96, 24, 40);
  }), 'detail');
  const counterTopT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#d8d0be'; g.fillRect(0, 0, 64, 16);            // laminate
    g.fillStyle = 'rgba(120,100,80,0.2)';
    for (let i = 0; i < 60; i++) g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 16), 1, 1);
  }), 'detail');
  const cTopT = counterTopT.clone();
  cTopT.wrapS = cTopT.wrapT = THREE.RepeatWrapping;
  cTopT.repeat.set(CL / 5.0, 0.75 / 1.25);                        // metres, not tiles
  cTopT.needsUpdate = true;
  const cFace = ctx.flat(counterFaceT), cTop = ctx.flat(cTopT);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(CL, 1.15, 0.75),
    [cFace, cFace, cTop, cFace, cFace, cFace]);
  put(counter, CCX, 0.575, CZ);
  solid(CCX, CZ, CL, 0.75);

  // three tills along it, and the tray rail they push your tray onto
  for (const tx of [CCX - CL * 0.35, CCX, CCX + CL * 0.35]) {
    const till = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.34),
      new THREE.MeshBasicMaterial({ color: 0x38383a }));
    put(till, tx, 1.3, CZ - 0.1);
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x6a6a6c }));
    keys.rotation.x = -Math.PI / 3;
    put(keys, tx, 1.44, CZ + 0.06);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(CL, 0.04, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xb8b2a6 }));
  put(rail, CCX, 1.13, CZ + 0.41);

  // ── the crew wall behind it: fryers, the grill, the warming chute ──
  //
  // Painted, like the diner's back bar, because it is the thing you look at
  // while you queue. But where the diner's back bar is domestic — pie case,
  // urns, cupboards — this is a production line, and it should read as one.
  const crewT = declareSurface(pixTex(128, 48, (g) => {
    g.fillStyle = '#b0aca4'; g.fillRect(0, 0, 128, 48);           // stainless
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = 0; x < 128; x += 4) g.fillRect(x, 0, 1, 48);     // brushed grain
    // the warming chute — the bright slot the food comes through
    g.fillStyle = '#3a3630'; g.fillRect(6, 6, 62, 15);
    g.fillStyle = '#e8a33a'; g.fillRect(8, 8, 58, 11);            // heat lamps
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(8, 8, 58, 2);
    g.fillStyle = '#5a5650';                                      // wrapped stock in the chute
    for (let x = 11; x < 64; x += 9) g.fillRect(x, 12, 6, 6);
    // the fry station: two vats, baskets hung over them
    g.fillStyle = '#7a766e'; g.fillRect(74, 4, 48, 20);
    g.fillStyle = '#2e2a26'; g.fillRect(78, 8, 18, 12); g.fillRect(100, 8, 18, 12);
    g.fillStyle = '#c8b45a'; g.fillRect(80, 15, 14, 4); g.fillRect(102, 15, 14, 4);
    g.fillStyle = '#9a968e'; g.fillRect(84, 2, 3, 8); g.fillRect(106, 2, 3, 8);
    // under-counter: prep cupboards and a stack of trays
    g.fillStyle = '#8e8a82'; g.fillRect(0, 24, 128, 24);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < 128; x += 16) g.fillRect(x, 24, 1, 24);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 24, 128, 1);
    dither(g, 128, 48, 60);
  }), 'detail');
  const crew = new THREE.Mesh(new THREE.PlaneGeometry(CL + 1.4, 2.4), ctx.flat(crewT));
  put(crew, CCX, 1.35, -hd + 0.05);

  // ══ THE MENU BOARD — AND IT IS THE SHOP'S STOCK LIST ══════════════════════
  //
  // *"for every business i just want to be able to talk to the shop keeper or
  //  cashier and see a diagetic list of options as like a sign or something for
  //  everything you can buy."*   (2026-08-06)
  //
  // **THIS BOARD IS THAT SIGN.** It is the same object it always was — three
  // backlit panels over the crew wall, split sandwiches / sides / drinks, the
  // brightest thing in the room because in a 1997 fast-food place the board IS
  // the decor — and it is now also the thing you order off. `ct/shop.ts` paints
  // it and `shopCounter` below hangs the reading view on this very mesh, so what
  // is printed on the wall and what you buy from cannot drift apart: one table,
  // one painter, two surfaces.
  //
  // ── IT IS ONE MESH NOW, AND THAT IS THE ONE REAL CHANGE ───────────────────
  //
  // It used to be three separate planes with a metre of wall showing between
  // them. A focus surface is ONE mesh — `poseFor` takes the eye along a single
  // face's normal and `screenSlot` borrows a single material — so three planes
  // could only ever have offered one third of the menu. Made contiguous, which
  // is also what a real board is: one long backlit box divided into panels, the
  // divisions printed rather than built.
  //
  // ── AND THE STOCK IS SHORTER THAN THE OLD DECOR WAS ───────────────────────
  //
  // The painted board carried fifteen lines — a fish sandwich, three numbered
  // combos, a kids' bag. **Every line on it is buyable now, so every line on it
  // has to be a thing that exists**, and a board where four rows work and eleven
  // do nothing teaches the player the menu lies (`ItemDef.use`'s note: a dead
  // option is worse than a missing one). Seven lines, six of them new items in
  // `ct/goods.ts` and one — the soda — already in the world.
  const MENU: ShopColumn[] = [
    { head: 'SANDWICHES', lines: [
      { id: 'BURGER', name: 'BARN BURGER', price: 1.89 },
      { id: 'CHICKEN', name: 'CHICKEN', price: 2.29 },
    ] },
    { head: 'SIDES', lines: [
      { id: 'FRIES', name: 'FRIES', price: 0.89 },
      { id: 'PIE', name: 'APPLE PIE', price: 0.69 },
    ] },
    { head: 'DRINKS', lines: [
      { id: 'SODA', name: 'SODA', price: 0.79 },
      { id: 'SHAKE', name: 'SHAKE', price: 1.29 },
      { id: 'COFFEE', name: 'COFFEE', price: 0.65 },
    ] },
  ];
  // The barn's own three colours, read off the constants at the head of this
  // file rather than re-picked: the panel is the lit beige the facade promises,
  // the surround is the red, and the type is the same near-black the posters and
  // the bin are lettered in.
  const MENU_LOOK: BoardLook = {
    panel: '#f2ead4', frame: BB_RED_HEX, band: BB_RED_HEX, bandInk: '#f2ead4',
    ink: '#3a2a22', priceInk: '#8a2a22',
    hover: 'rgba(200,48,42,0.16)', flash: 'rgba(232,163,58,0.55)',
  };
  // 6.0 x 1.11 m and 150 texels per metre. The metres are the object; the
  // canvas follows them, so the panel's own canvas — which is this same picture
  // at this same size, swapped onto this same material while you read it — is
  // never a different shape from the board on the wall.
  const BOARD_W = 6.0, BOARD_H = 1.11, BOARD_Y = 2.35;
  const BOARD_PX = 900, BOARD_PY = Math.round(BOARD_PX * BOARD_H / BOARD_W);
  const boardT = boardTexture(BOARD_PX, BOARD_PY, MENU, MENU_LOOK);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), ctx.flat(boardT));
  put(board, CCX, BOARD_Y, -hd + 0.07);
  // the moulded surround, proud of the wall behind the printed one
  const boardBox = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.10, BOARD_H + 0.10, 0.07), redM);
  put(boardBox, CCX, BOARD_Y, -hd + 0.03);

  // ── the seating: moulded, fixed, and bolted to the floor ──
  //
  // The unit is one pedestal, one laminate top and four swivel stools on
  // arms — no chair you can pull out, nothing upholstered, nothing that
  // moves. It is the single most 1997 object in the room and it is what makes
  // this NOT the diner.
  //
  // They sit in the right two thirds. The left third is left empty as the
  // queue lane, because a queue is the shape of the room at lunchtime and
  // furniture standing in it would be furniture nobody could reach.
  const stoolT = new THREE.MeshBasicMaterial({ color: BB_RED });
  const postM = new THREE.MeshBasicMaterial({ color: 0x9a968e });
  const topM = () => {
    const t = counterTopT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.1 / 5.0, 0.72 / 1.25);
    t.needsUpdate = true;
    return ctx.flat(t);
  };
  // Laid out from the room rather than listed: the left of the room is the
  // queue lane (furniture standing in it is furniture nobody can reach at
  // lunchtime), and the rest fills with units on a 2.3 m pitch — which is what
  // keeps the aisles between them walkable whatever width the room turns out
  // to be.
  const SX0 = -room.W * 0.10, SX1 = hw - 0.95;
  const cols = Math.max(2, Math.floor((SX1 - SX0) / 2.3) + 1);
  const pitch = cols > 1 ? (SX1 - SX0) / (cols - 1) : 0;
  const UNITS: [number, number][] = [];
  for (let c = 0; c < cols; c++) {
    // 2.3 and -0.6. Three constraints meet here and all three have bitten:
    //   · the rows must clear EACH OTHER — at 2.35/-0.15 they were 2.5 m
    //     apart against a 2.44 m padded footprint, 6 cm of gap, and every
    //     stool between them was unreachable
    //   · the front row must leave standing room against the WINDOW WALL —
    //     at 2.7 its window-side stools had none, and those failed instead
    //   · and the back row must clear the counter behind it
    // 2.3 leaves 0.6 m from the front stools to standable floor (inside their
    // 0.66 m trigger), 0.46 m between the rows, and 0.44 m off the counter.
    UNITS.push([SX0 + c * pitch, 2.3]);
    if (c < cols - 1) UNITS.push([SX0 + (c + 0.5) * pitch, -0.6]);   // staggered second row
  }
  for (const [ux, uz] of UNITS) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.72, 8), postM);
    put(ped, ux, 0.36, uz);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.72), topM());
    put(top, ux, 0.75, uz);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.03, 0.76), redM);
    put(edge, ux, 0.71, uz);
    // four stools on swing arms, two a side
    for (const sx of [-0.38, 0.38]) for (const sz of [-0.62, 0.62]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(sx) + 0.1, 0.05, 0.06), postM);
      put(arm, ux + sx / 2, 0.14, uz + sz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.44, 6), postM);
      put(post, ux + sx, 0.36, uz + sz);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10), stoolT);
      put(seat, ux + sx, 0.61, uz + sz);
      // Every one of the twenty is sittable, and every one faces its own
      // table: the stool is on a swing arm bolted to that pedestal, so
      // "which way does it point" is not a choice, it is the geometry.
      // yaw from the rig's convention, fwd = (sin yaw, −cos yaw), pointing
      // from the stool back at the unit centre.
      ctx.seat({
        x: room.wx(ux + sx), z: room.wz(uz + sz),
        yaw: Math.atan2(-sx, sz), h: 0.61, r: 0.66,
        ok: room.inside, label: 'sit down',
      });
    }
    // One collider for the whole unit — the gaps between a stool and its own
    // table are nowhere near the 0.72 m the player needs, so boxing the parts
    // separately would only build slots to get wedged in.
    //
    // 1.60 deep, not 1.72, and the 0.12 matters. The furniture actually
    // reaches uz ± 0.79: the stools sit at ± 0.62 and are 0.17 in radius. 1.72
    // claimed 0.06 m more than exists at each end, and padded by the player's
    // 0.36 that pushed the nearest standable floor to 3.52 — leaving the
    // window-side stool of the front row 0.60 m away against a 0.66 m trigger,
    // close enough to the boundary that it never prompted. Boxing furniture to
    // what it IS rather than rounding up is what makes it reachable; widening
    // the trigger instead would have hidden it.
    solid(ux, uz, 1.28, 1.60);
  }

  // ── the bin, beside the door, with the swing flap ──
  const binT = declareSurface(pixTex(24, 32, (g) => {
    g.fillStyle = '#8a4a3a'; g.fillRect(0, 0, 24, 32);            // moulded brown body
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 4; y < 32; y += 6) g.fillRect(0, y, 24, 1);
    g.fillStyle = '#e6dcc6'; g.fillRect(3, 10, 18, 7);            // THANK YOU panel
    g.fillStyle = '#8a4a3a'; g.font = 'bold 5px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('THANK', 12, 13);
    dither(g, 24, 32, 24);
  }), 'sign');
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.0, 0.5), ctx.flat(binT));
  // -5.6, not -1.9. At -1.9 the bin stood between the front row's window-side
  // stool and the wall, and its padded box met the unit's with no gap at all —
  // that stool had NO standable point anywhere near it and never prompted. It
  // reads as "the seat is broken"; it was a waste bin 1.2 m away.
  //
  // Down at the far end of the queue lane it is out of the seating entirely
  // and still beside the door, which is where a bin belongs. Clear of the
  // opening too: padded it reaches -4.93 and the door starts at -4.20.
  put(bin, -5.6, 0.5, hd - 0.5);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.54), redM);
  put(lid, -5.6, 1.04, hd - 0.5);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x2a2622, side: THREE.DoubleSide }));
  flap.rotation.x = -0.55;                                        // pushed in, hanging open
  put(flap, -5.6, 0.98, hd - 0.28);
  solid(-5.6, hd - 0.5, 0.62, 0.5);

  // the tray stack on the counter's near end, where you pick one up
  const trayM = new THREE.MeshBasicMaterial({ color: 0x7a4a3a });
  for (let i = 0; i < 5; i++) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.025, 0.34), trayM);
    put(tray, 2.9, 1.17 + i * 0.028, CZ + 0.06);
  }

  // ── the crew member, behind the counter ──
  //
  // From the citizen atlas, like everyone on the street — she was a
  // hand-painted plane copied from the diner's waitress, who was the original
  // mistake. Red polo and a visor rather than the diner's dress and apron:
  // the two rooms should employ visibly different decades of person, and that
  // difference survives the move to the atlas because it is in the colours.
  // FACING DERIVED FROM THE COUNTER, not typed.
  //
  // This read `facing: Math.PI`, which is -z — the BACK WALL. `ct/citizens.ts`
  // documents the convention as `atan2(vx, vz)` with `0 = facing +z`, and in
  // every one of these rooms the counter sits near the back and the customer
  // floor is on the +z side of it, so the keeper was turned away from the shop.
  //
  // Builder G hit exactly this in `int-pawn.ts` — "two of my four keepers faced
  // their back walls" (15f86d64) — and the literal they name as the bug is the
  // one that was in all four of mine. I nearly cleared my rooms on `turn.mjs`
  // showing "8 distinct frames over 8 headings": that proves the ATLAS picks an
  // angle, not that the angle is right. A figure facing a wall still turns.
  //
  // Derived from the counter so it cannot drift if the counter moves.
  const KEEP_AT = CZ - 0.72;   // behind the counter
  const KEEP_X = CCX - 1.8;
  // `keeper`, not `crew` — the stainless production wall a hundred lines up is
  // already `crew`, and this is the person standing in front of it.
  const keeper = room.person({
    jacket: '#c8302a', pants: '#4a4a52', skin: '#a87a52', hair: '#2a2622',
    fit: 'cap', accent: '#e6dcc6', cut: 'crop', build: 0,
  }, KEEP_X, KEEP_AT, { facing: Math.atan2(0, CZ - KEEP_AT), h: 1.0, w: 0.95 });

  // ── the lobby side, because walking in you faced an empty floor ──
  //
  // Graded this room from the door with the user's own test - would this
  // impress someone who has been disappointed - and it does not, for one
  // reason: between the door and the service counter there is a large bare
  // tile floor, and the left wall above the wainscot is completely blank. The
  // counter, the menu boards and the tiling are all good; the room is just
  // empty where you stand.
  //
  // A fast-food lobby is never empty there. It has the two things you use on
  // the way in and out, and both are instantly nameable, which is the standard
  // the user set for the alley: "these should be recognizable."
  {
    const LW = -hw + 0.05;                       // the wall, and everything hangs off it
    const steelM = new THREE.MeshBasicMaterial({ color: 0x9a9ea2 });
    const trimRed = new THREE.MeshBasicMaterial({ color: 0xb8322c });

    // THE TRAY-RETURN BIN: a bin with a swing flap and a tray shelf on top,
    // which is the silhouette everyone reads as "put your tray here".
    const BIN_Z = hd - 2.6;
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.58), trimRed);
    put(bin, LW + 0.42, 0.525, BIN_Z);
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.30),
      new THREE.MeshBasicMaterial({ color: 0x2a2622 }));
    flap.rotation.y = Math.PI / 2;
    put(flap, LW + 0.74, 0.66, BIN_Z);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.05, 0.66), steelM);
    put(shelf, LW + 0.42, 1.08, BIN_Z);
    for (let t = 0; t < 3; t++) {                // trays somebody left on it
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.022, 0.34), trimRed);
      put(tray, LW + 0.42, 1.12 + t * 0.025, BIN_Z + (t % 2 ? 0.03 : -0.02));
    }
    solid(LW + 0.42, BIN_Z, 0.62, 0.58);

    // THE CONDIMENT STAND: napkin box, straws, sauce pumps. The things you
    // stop at, and the reason anyone stands on this side of the room at all.
    const CON_Z = hd - 4.3;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.95, 1.15),
      new THREE.MeshBasicMaterial({ color: 0x6a4a3a }));
    put(stand, LW + 0.36, 0.475, CON_Z);
    const stTop = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 1.21), steelM);
    put(stTop, LW + 0.36, 0.975, CON_Z);
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.22), steelM);
    put(napkin, LW + 0.36, 1.065, CON_Z - 0.34);
    for (const [dz, col] of [[0.0, 0xb8322c], [0.26, 0xd8b84a]] as [number, number][]) {
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.30, 8),
        new THREE.MeshBasicMaterial({ color: col }));
      put(pump, LW + 0.36, 1.15, CON_Z + dz);
    }
    const straws = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.20, 8), steelM);
    put(straws, LW + 0.36, 1.10, CON_Z + 0.48);
    solid(LW + 0.36, CON_Z, 0.52, 1.15);

    // …and the blank wall above them. A crew-hiring notice and a tray of
    // combo posters, which is what that wall carries in every one of these.
    const posterT = (head: string, sub: string, col: string) =>
      declareSurface(pixTex(32, 40, (g) => {
        g.fillStyle = col; g.fillRect(0, 0, 32, 40);
        g.fillStyle = '#e8e0cc'; g.fillRect(2, 2, 28, 36);
        g.fillStyle = col; g.fillRect(4, 5, 24, 9);
        g.fillStyle = '#e8e0cc'; g.font = 'bold 6px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(head, 16, 10);
        g.fillStyle = '#3a352c'; g.font = '5px monospace';
        g.fillText(sub, 16, 20);
        g.fillStyle = col; g.fillRect(6, 25, 20, 10);        // the product block
        dither(g, 32, 40, 30);
      }), 'sign');
    room.sign(posterT('NOW', 'HIRING', '#b8322c'), 0.46, 0.58, LW + 0.04, 1.86, hd - 3.4, Math.PI / 2);
    room.sign(posterT('COMBO', '2.99', '#c8902a'), 0.46, 0.58, LW + 0.04, 1.86, hd - 5.2, Math.PI / 2);
  }

  // ══ YOU TALK TO HER, AND YOU ORDER OFF THE BOARD ══════════════════════════
  //
  // WHAT THIS REPLACES, because the difference is the whole item. There used to
  // be two hand-written `ctx.spot`s on this counter — `order a barn burger`,
  // `order fries` — and three things were wrong with them:
  //
  //   · they were a MENU MADE OF PROMPTS. Two of the fifteen lines painted on
  //     the board above were buyable, and the only way to find out which was to
  //     walk along the counter reading `[E]` captions. *"a diagetic list of
  //     options as like a sign"* is the answer to exactly that.
  //   · they wrote `purse.inv[item] += 1` DIRECTLY, which is the one thing
  //     `ct/inventory.ts` asks nobody to do: it skips `give`, so it skipped the
  //     twelve-slot bag, the one-slot hands and the per-item stack, and a
  //     player with a full bag was charged $1.89 for a burger that went nowhere.
  //   · `'BARN BURGER'` and `'FRIES'` were ids nobody had declared, so they
  //     arrived in the bag as wrapped parcels called "barn burger".
  //
  // All three go away by DESCRIBING the shop rather than writing it: the table
  // above, the board mesh, and the woman already standing behind the counter.
  // `ct/shop.ts` owns the panel, the camera pose, the hit test and the money.
  //
  // The customer station is derived from the counter, on the CUSTOMER side of
  // it — CZ is the counter line and the room opens toward +z — and the keeper's
  // world position is read off the sprite the room just placed rather than
  // recomputed from the locals that placed it (BUILDER-BRIEF §8).
  shopCounter(ctx, {
    id: 'ct-shop-burger',
    columns: MENU, look: MENU_LOOK,
    w: BOARD_PX, h: BOARD_PY,
    mesh: () => board,
    // WHERE THE EYE GOES, DERIVED FROM THE SIGN. 6 m of board needs a few
    // metres of room to be read whole, and `poseFor` clamps the eye to 1.75 m
    // over the floor against a board hung at 2.35 — so the rise is 0.60 and the
    // standoff is the leg of that triangle, not its hypotenuse. See
    // `boardStandoff`, which is where all of that arithmetic lives.
    standoff: boardStandoff({ wM: BOARD_W, hM: BOARD_H, fov: 60, riseM: BOARD_Y - 1.75 }),
    fov: 60,
    stand: { x: room.wx(KEEP_X), z: room.wz(CZ + 1.05) },
    keeper: { x: keeper.mesh.position.x, z: keeper.mesh.position.z, obj: keeper.mesh },
    who: 'the cashier',
    ok: room.inside,
  });

}

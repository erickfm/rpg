import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';

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

// WHERE IT IS is not written here. The room names its building and the kit
// reads `frontageOf('BURGER BARN', 16)` — the same object the facade painter
// draws from — for the door centre, its width, the glazing and the [E] spot.
//
// This file used to derive that by hand from the painter's texel arithmetic,
// which was right at the time and wrong the moment A moved the door: the
// derivation said z = -28.25 and the published door is now at -29.0.

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
    door: { r: 1.05 },
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
  const tileT = pixTex(32, 32, (g) => {
    g.fillStyle = '#8a7a6a'; g.fillRect(0, 0, 32, 32);            // grout bed
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const warm = (x * 5 + y * 3) % 4;
      g.fillStyle = ['#a8785e', '#9e7058', '#b08066', '#a07a60'][warm];
      g.fillRect(x * 8, y * 8, 7, 7);
    }
    dither(g, 32, 32, 40);
  });
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
  const counterFaceT = pixTex(96, 24, (g) => {
    g.fillStyle = '#c8302a'; g.fillRect(0, 0, 96, 24);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < 96; x += 12) g.fillRect(x, 0, 1, 24);     // moulded panel joints
    g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, 96, 2);             // beige capping
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 21, 96, 3);   // kick shadow
    dither(g, 96, 24, 40);
  });
  const counterTopT = pixTex(64, 16, (g) => {
    g.fillStyle = '#d8d0be'; g.fillRect(0, 0, 64, 16);            // laminate
    g.fillStyle = 'rgba(120,100,80,0.2)';
    for (let i = 0; i < 60; i++) g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 16), 1, 1);
  });
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
  const crewT = pixTex(128, 48, (g) => {
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
  });
  const crew = new THREE.Mesh(new THREE.PlaneGeometry(CL + 1.4, 2.4), ctx.flat(crewT));
  put(crew, CCX, 1.35, -hd + 0.05);

  // ── the menu boards, backlit, over the crew wall ──
  //
  // Three panels, and they are the brightest thing in the room on purpose:
  // in a 1997 fast-food place the board IS the decor. Text is drawn at 7 px
  // on the texel grid — the door-plate complaint on file was numerals drawn
  // at a size that did not land on the grid and aliased into mush.
  // Three DIFFERENT panels. The first pass painted one texture and hung it
  // three times, which reads instantly as a copy-paste rather than as a menu —
  // a real board is split burgers / sides / drinks, and the eye checks.
  const PANELS: [string, [string, string][]][] = [
    ['SANDWICHES', [
      ['BARN BURGER', '1.89'], ['DOUBLE BARN', '2.69'],
      ['CHICKEN', '2.29'], ['FISH', '1.99'], ['BARN MELT', '2.49'],
    ]],
    ['COMBOS', [
      ['NO 1  DOUBLE', '3.49'], ['NO 2  CHICKEN', '3.29'],
      ['NO 3  FISH', '2.99'], ['ADD CHEESE', ' .30'], ['KIDS BARN BAG', '1.99'],
    ]],
    ['SIDES  DRINKS', [
      ['FRIES  REG', ' .89'], ['FRIES  LG', '1.09'],
      ['SODA  REG', ' .79'], ['SHAKE', '1.29'], ['COFFEE', ' .65'],
    ]],
  ];
  PANELS.forEach(([head, rows], i) => {
    const boardT = pixTex(128, 40, (g) => {
      g.fillStyle = '#f2ead4'; g.fillRect(0, 0, 128, 40);         // the lit panel
      g.fillStyle = '#c8302a'; g.fillRect(0, 0, 128, 7);
      g.fillStyle = '#f2ead4'; g.font = 'bold 6px monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(head, 64, 4);
      g.fillStyle = '#3a2a22'; g.font = 'bold 7px monospace';
      rows.forEach(([a, b], r) => {
        g.textAlign = 'left'; g.fillText(a, 5, 13 + r * 6);
        g.textAlign = 'right'; g.fillText(b, 123, 13 + r * 6);
      });
    });
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.95), ctx.flat(boardT));
    put(bd, CCX + (i - 1) * (CL / 3), 2.5, -hd + 0.07);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.08, 0.06), redM);
    put(frame, CCX + (i - 1) * (CL / 3), 2.5, -hd + 0.03);
  });

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
    // 2.7 and -0.6, which is 3.3 m apart against a 1.72 m unit — the player
    // pads that to 2.44, so this leaves 0.86 m to walk between the rows and
    // 0.44 m clear of the counter behind. At 2.35 / -0.15 the rows were 2.5
    // apart and the gap closed to 6 cm: every stool between them became
    // unreachable, and the seat suite went from 33/33 to 3/43.
    UNITS.push([SX0 + c * pitch, 2.7]);
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
    // one collider for the whole unit — the gaps between a stool and its own
    // table are nowhere near the 0.72 m the player needs, so boxing the parts
    // separately would only build slots to get wedged in
    solid(ux, uz, 1.28, 1.72);
  }

  // ── the bin, beside the door, with the swing flap ──
  const binT = pixTex(24, 32, (g) => {
    g.fillStyle = '#8a4a3a'; g.fillRect(0, 0, 24, 32);            // moulded brown body
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 4; y < 32; y += 6) g.fillRect(0, y, 24, 1);
    g.fillStyle = '#e6dcc6'; g.fillRect(3, 10, 18, 7);            // THANK YOU panel
    g.fillStyle = '#8a4a3a'; g.font = 'bold 5px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('THANK', 12, 13);
    dither(g, 24, 32, 24);
  });
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.0, 0.5), ctx.flat(binT));
  put(bin, -1.9, 0.5, hd - 0.5);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.54), redM);
  put(lid, -1.9, 1.04, hd - 0.5);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x2a2622, side: THREE.DoubleSide }));
  flap.rotation.x = -0.55;                                        // pushed in, hanging open
  put(flap, -1.9, 0.98, hd - 0.28);
  solid(-1.9, hd - 0.5, 0.62, 0.5);

  // the tray stack on the counter's near end, where you pick one up
  const trayM = new THREE.MeshBasicMaterial({ color: 0x7a4a3a });
  for (let i = 0; i < 5; i++) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.025, 0.34), trayM);
    put(tray, 2.9, 1.17 + i * 0.028, CZ + 0.06);
  }

  // ── the crew member, behind the counter ──
  //
  // Visor and a polo, not the diner's uniform dress and apron: the two rooms
  // employ different decades of person and the difference should be visible.
  const crewPersonT = pixTex(40, 64, (g) => {
    g.fillStyle = '#c8302a'; g.fillRect(9, 24, 22, 22);           // red polo
    g.fillStyle = '#e6dcc6'; g.fillRect(9, 24, 22, 3);            // collar
    g.fillStyle = '#4a4a52'; g.fillRect(11, 46, 8, 16); g.fillRect(21, 46, 8, 16);
    g.fillStyle = '#c9946a'; g.fillRect(4, 26, 5, 13); g.fillRect(31, 26, 5, 13);
    g.fillStyle = '#a87a52'; g.fillRect(14, 9, 12, 14);           // head
    g.fillStyle = '#2a2622'; g.fillRect(13, 7, 14, 4);            // hair
    g.fillStyle = '#c8302a'; g.fillRect(12, 10, 16, 3);           // the visor
    g.fillStyle = '#e6dcc6'; g.fillRect(12, 12, 16, 1);
    g.fillStyle = '#241a12'; g.fillRect(16, 16, 2, 2); g.fillRect(22, 16, 2, 2);
    g.fillStyle = '#8a5a4a'; g.fillRect(18, 20, 4, 1);
    dither(g, 40, 64, 18);
  });
  const person = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.85),
    new THREE.MeshBasicMaterial({ map: crewPersonT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(person, -2.2, 0.925, CZ - 0.72);

}

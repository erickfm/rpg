import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';

// THE THRIFT STORE, inside.
//
// The brief is one word: DENSITY. "It should feel like too much stuff in too
// little room… a thrift store with clear floor space reads as a boutique."
// That makes it the third corner of the interior programme — the diner is
// warm and settled, the burger barn is bright and hard, and this is CROWDED.
// If you can see the floor, it has failed.
//
// Which puts it in direct tension with the one rule that cannot bend: the
// player is 0.72 m across and every room must be walkable end to end. The
// resolution is not to space everything out — that loses the brief — but to
// give the room a SPINE and let the aisles be genuinely tight:
//
//   · the rails fill the left two thirds and the aisles between them clear
//     the player by about 0.19 m a side. You turn sideways. That is the feel.
//   · the right third is an open run from the door to the till, so you can
//     always get from one end to the other without squeezing at all.
//
// Every measurement below is chosen against the 0.36 m capsule radius and
// then WALKED — `scripts/interiors-walk.mjs` drives the aisles, not just the
// spine, because a room that is only passable down one lane is a corridor.
//
// WHERE IT IS is not written here. The room names its building and the kit
// reads `frontageOf('THRIFT', 12.5)` for the door, its width, the glazing and
// the [E] spot on the pavement.
//
// This file used to hold `DOOR_Z = -74.94`, derived by hand and correct when
// written. It then went wrong TWICE without being touched: D swapped THRIFT
// with BARBER, moving it 13 m up the block, and A's descriptor put its door
// hard left instead of near the middle. The prompt was standing in the park.

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
  building: 'THRIFT', w: 12.5, cz: -61.75, side: -1, at: -2.2, width: 1.1,
};

export function buildThrift(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'thrift',
    label: 'into the THRIFT STORE',
    // Small, and lower than the shops either side of it. The burger barn is
    // 11.0 × 8.5 × 3.2; this is deliberately the opposite end of that so the
    // ceiling is in your eyeline and the walls are close.
    // 9.4 DEEP, up from 6.5. The desk, correcting its own brief: *"THE THRIFT
    // IS TOO CROWDED, and that one is my fault — I told you 'too much stuff in
    // too little room' after the user called it thin, and it has overshot. The
    // answer is NOT to remove stock: the user says the room should be LARGER."*
    //
    // So every fixture stays and the floor grows under them. 11.3 x 9.4 is
    // 106 m2 against 73 — half as much floor again for the same stock, which
    // turns "you cannot get past the rails" back into "it is packed", and those
    // are different rooms.
    //
    // Depth, not width: width is the FRONTAGE and is not mine to invent — the
    // kit takes it from the 12.5 m shopfront (roomWidthFor -> 11.3) and a room
    // wider than its own building is the mirror bug in a new form. Depth is
    // free: the belt parks rooms in 80 m slabs and nothing is behind this one.
    d: 9.4, h: 2.75,
    // faded, mismatched, second-hand: cream that used to be white, a worn
    // vinyl floor, and brown trim nobody has repainted since the seventies
    palette: { floor: 0x9a8f7c, wall: 0xc6c0a8, ceil: 0xc4beac, trim: 0x6a4a2c },
    // No wainscot. Tile is what a business FITS OUT; this unit was taken over
    // as it stood, which is the whole character of the place.
    light: {
      // Bare battens screwed to the soffit — and one of them is out, which the
      // brief asks for by name. It is the cheapest possible detail and it does
      // more for "this place is barely holding on" than any amount of clutter.
      kind: 'strip', tint: 0xe4e8dc, count: 3, dead: [1],
    },
    frontage: { name: 'THRIFT', w: 12.5, cz: -61.75, side: -1 },
    door: { r: 1.05, at: DOOR.at, width: DOOR.width },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const woodM = new THREE.MeshBasicMaterial({ color: 0x7a6248 });
  const steelM = new THREE.MeshBasicMaterial({ color: 0xa8a49a });

  // ── the rails ──
  //
  // Three runs down the left two thirds, packed. A rail is uprights, a bar,
  // and a SOLID BLOCK of garments — the block matters: hanging clothes on a
  // full rail are a mass, not separate items, and drawing them as a mass is
  // both truer and cheaper than fifty planes.
  //
  // Rows sit 1.35 m apart with a 0.44 m garment block, so the clear aisle is
  // 0.91 m and the player's 0.72 m leaves ~0.19 m. Tight on purpose. Anything
  // wider and the room reads as a boutique; anything narrower and it is a wall.
  const garmentT = declareSurface(pixTex(64, 32, (g) => {
    // a jumbled run of coats and shirts, muted and mismatched — thrift stock
    // is everything nobody wanted, so no two neighbours agree
    const cols = ['#6a4a3a', '#4a5a6a', '#7a6a4a', '#5a4a5a', '#3a4a3a', '#8a7a5a',
      '#6a3a3a', '#4a4a58', '#7a5a4a', '#55603f', '#6d5570', '#8a5a3a'];
    let x = 0, i = 0;
    while (x < 64) {
      const w = 3 + ((i * 7) % 4);
      g.fillStyle = cols[(i * 5) % cols.length];
      g.fillRect(x, 0, w, 32);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x + w - 1, 0, 1, 32);               // the shadow between garments
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fillRect(x, 0, 1, 32);
      x += w; i++;
    }
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, 64, 3);   // shoulders in shadow
    dither(g, 64, 32, 90);
  }), 'detail');
  const RAIL_X0 = -3.7, RAIL_X1 = -0.3;
  const RAIL_L = RAIL_X1 - RAIL_X0, RAIL_CX = (RAIL_X0 + RAIL_X1) / 2;
  const ROWS = [1.1, -0.25, -1.6];
  for (const rz of ROWS) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(RAIL_L, 0.04, 0.04), steelM);
    put(bar, RAIL_CX, 1.55, rz);
    for (const ux of [RAIL_X0 + 0.1, RAIL_CX, RAIL_X1 - 0.1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.55, 0.05), steelM);
      put(post, ux, 0.775, rz);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.44), steelM);
      put(foot, ux, 0.02, rz);
    }
    const gt = garmentT.clone();
    gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
    gt.repeat.set(RAIL_L / 2.6, 1);                  // texel density off real metres
    gt.needsUpdate = true;
    const clothes = new THREE.Mesh(new THREE.BoxGeometry(RAIL_L - 0.15, 1.05, 0.44), ctx.flat(gt));
    put(clothes, RAIL_CX, 0.98, rz);
    solid(RAIL_CX, rz, RAIL_L, 0.44);
  }

  // ── the wall of shoes, down the right-hand wall ──
  //
  // Six shelves of them, paired and facing out, because a shoe wall is the one
  // fixture in a thrift store that is actually ORDERED — everything else is a
  // heap, and the contrast is what makes the heap read as a heap.
  const shoeT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#6a6258'; g.fillRect(0, 0, 64, 16);
    const cols = ['#3a2c22', '#5a4a3a', '#2a2a30', '#7a6a52', '#4a3a4a', '#8a7a62'];
    for (let i = 0; i < 11; i++) {
      const x = 1 + i * 6;
      g.fillStyle = cols[(i * 3) % cols.length];
      g.fillRect(x, 6, 5, 8);                        // the shoe
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x, 13, 5, 2);                       // sole in shadow
      g.fillStyle = 'rgba(255,255,255,0.09)';
      g.fillRect(x, 6, 5, 1);
    }
    dither(g, 64, 16, 30);
  }), 'detail');
  const SHOE_Z0 = -2.2, SHOE_Z1 = 1.4;
  const SHOE_L = SHOE_Z1 - SHOE_Z0, SHOE_CZ = (SHOE_Z0 + SHOE_Z1) / 2;
  const st = shoeT.clone();
  st.wrapS = st.wrapT = THREE.RepeatWrapping;
  st.repeat.set(SHOE_L / 2.2, 1);
  st.needsUpdate = true;
  const shoeM = ctx.flat(st);
  for (let i = 0; i < 5; i++) {
    const y = 0.28 + i * 0.42;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, SHOE_L), woodM);
    put(shelf, hw - 0.17, y, SHOE_CZ);
    const row = new THREE.Mesh(new THREE.PlaneGeometry(SHOE_L, 0.34), shoeM);
    row.rotation.y = -Math.PI / 2;                   // faces into the room (−x)
    put(row, hw - 0.33, y + 0.19, SHOE_CZ);
  }
  const shoeEnd = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.1, 0.05), woodM);
  put(shoeEnd, hw - 0.18, 1.05, SHOE_Z0 - 0.03);
  put(shoeEnd.clone(), hw - 0.18, 1.05, SHOE_Z1 + 0.03);
  solid(hw - 0.17, SHOE_CZ, 0.34, SHOE_L + 0.1);

  // ── the crockery shelf, along the back wall to the left ──
  //
  // Chipped, mismatched, stacked two deep. Nobody is buying it.
  const crockT = declareSurface(pixTex(96, 24, (g) => {
    g.fillStyle = '#8a8274'; g.fillRect(0, 0, 96, 24);
    const cols = ['#d8d0c0', '#c8bca8', '#e0d8c8', '#b8ac98', '#d0c4b0'];
    for (let i = 0; i < 14; i++) {
      const x = 2 + i * 7;
      const h = 5 + ((i * 5) % 6);
      g.fillStyle = cols[(i * 3) % cols.length];
      g.fillRect(x, 22 - h, 5, h);                   // a stack of plates or a cup
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 22 - h; y < 22; y += 2) g.fillRect(x, y, 5, 1);
      if (i % 3 === 0) { g.fillStyle = '#8a8274'; g.fillRect(x + 3, 22 - h, 2, 2); }  // the chip
    }
    dither(g, 96, 24, 40);
  }), 'detail');
  const CR_X0 = -3.8, CR_X1 = -0.4;
  const CR_L = CR_X1 - CR_X0, CR_CX = (CR_X0 + CR_X1) / 2;
  for (let i = 0; i < 3; i++) {
    const y = 0.55 + i * 0.5;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(CR_L, 0.04, 0.3), woodM);
    put(shelf, CR_CX, y, -hd + 0.16);
    const ct = crockT.clone();
    ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
    ct.repeat.set(CR_L / 3.0, 1);
    ct.needsUpdate = true;
    const stack = new THREE.Mesh(new THREE.PlaneGeometry(CR_L, 0.4), ctx.flat(ct));
    put(stack, CR_CX, y + 0.22, -hd + 0.03);
  }
  solid(CR_CX, -hd + 0.16, CR_L, 0.34);

  // ── the till, and the glass case with the good stuff in it ──
  //
  // The one locked thing in the shop. Everything else is on an open rail; the
  // jewellery is behind glass at the counter where it can be watched, and that
  // single difference says more about the place than a sign would.
  const TILL_CX = 2.2, TILL_Z = -hd + 0.5;
  const caseT = declareSurface(pixTex(64, 24, (g) => {
    g.fillStyle = 'rgba(196,214,220,0.30)'; g.fillRect(0, 0, 64, 24);
    g.fillStyle = '#6a6258'; g.fillRect(0, 11, 64, 2);            // the middle shelf
    const jewel = ['#c9b45e', '#d8d0c0', '#8a6a3a', '#b8a24e', '#9aa8b8'];
    for (let i = 0; i < 9; i++) {
      const x = 3 + i * 7;
      g.fillStyle = jewel[(i * 2) % jewel.length];
      g.fillRect(x, i % 2 ? 4 : 15, 4, 4);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x, i % 2 ? 4 : 15, 2, 1);
    }
    g.fillStyle = '#8a8274'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 22, 64, 2);
  }), 'detail');
  const glassM = new THREE.MeshBasicMaterial({
    map: caseT, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const tillBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.94, 0.6), woodM);
  put(tillBody, TILL_CX, 0.47, TILL_Z);
  const tillGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.66), glassM);
  put(tillGlass, TILL_CX, 0.6, TILL_Z + 0.31);
  const tillTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.68), woodM);
  put(tillTop, TILL_CX, 0.96, TILL_Z);
  solid(TILL_CX, TILL_Z, 2.6, 0.6);
  const register = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.32),
    new THREE.MeshBasicMaterial({ color: 0x4a4a4e }));
  put(register, TILL_CX + 0.9, 1.13, TILL_Z);

  // a bin of loose paperbacks, jammed in beside the till because there was
  // nowhere else — the shop has run out of room for its own stock
  const bookT = declareSurface(pixTex(32, 16, (g) => {
    g.fillStyle = '#5a4a3a'; g.fillRect(0, 0, 32, 16);
    const cols = ['#8a3a3a', '#3a5a6a', '#7a6a3a', '#5a3a5a', '#4a6a4a'];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = cols[(i * 3) % cols.length];
      g.fillRect(i * 2, 2 + ((i * 5) % 4), 2, 12);
    }
    dither(g, 32, 16, 16);
  }), 'detail');
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.6), woodM);
  put(bin, TILL_CX - 2.0, 0.275, TILL_Z + 0.05);
  const books = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.5), ctx.flat(bookT));
  books.rotation.x = -Math.PI / 2;
  put(books, TILL_CX - 2.0, 0.56, TILL_Z + 0.05);
  solid(TILL_CX - 2.0, TILL_Z + 0.05, 0.8, 0.6);

  // ── the handwritten card signs ──
  //
  // Biro on card, taped up crooked. They are the voice of the place: nobody
  // designed this shop, somebody just kept adding notices to it. Drawn at 7 px
  // on the texel grid — the door-plate complaint on file was lettering drawn
  // at a size that did not land on the grid and aliased into mush.
  const cardT = (text: string, sub: string) => declareSurface(pixTex(48, 24, (g) => {
    g.fillStyle = '#e2dcc6'; g.fillRect(0, 0, 48, 24);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, 21, 48, 3);
    g.fillStyle = '#2a3a6a'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 24, 8);
    g.font = '7px monospace';
    g.fillText(sub, 24, 16);
  }), 'sign');
  // Hung through `room.sign`, which builds each one as two back-to-back
  // single-sided planes. A rail card is read from BOTH aisles, and a single
  // DoubleSide plane is mirrored from behind (GOTCHAS §10) — the first pass
  // used one and `ALL COATS` came out backwards from the aisle on the far
  // side of its own rail. That is the failure the kit helper now prevents for
  // every room, not just this one.
  const CARDS: [string, string, number, number, number][] = [
    ['ALL COATS', '$4', -2.0, 1.72, 1.1],
    ['SHIRTS', '2 FOR $3', -2.0, 1.72, -0.25],
    ['SKIRTS', 'DRESSES', -2.0, 1.72, -1.6],
    // propped ON the counter top (0.96 + the card's own half-height), not at
    // a typed height above it — that is how it ended up hanging in mid-air
    ['AS SEEN', 'NO REFUND', TILL_CX, 0.96 + 0.11, TILL_Z + 0.33],
  ];
  for (const [a, b, cx2, cy, cz2] of CARDS) room.sign(cardT(a, b), 0.44, 0.22, cx2, cy, cz2);
  // …and one taped up in the window, which you read from inside because there
  // is no outside: interiors are not behind their facades.
  room.sign(cardT('OPEN', 'CASH ONLY'), 0.6, 0.3, 1.2, 1.45, hd - 0.06);

  // ═══════════════════════════════════════════════════════════════════════
  // THE DENSITY PASS
  //
  // The desk, measuring rather than eyeballing: this was the THINNEST room in
  // the world — 21 placed objects against the casino's 552 lines' worth — and
  // the original brief was *"too much stuff in too little room; density is the
  // whole effect, a thrift store with clear floor space reads as a boutique."*
  // It read as a boutique.
  //
  // The reference is the BODEGA, not the diner. A diner is laid out — booths in
  // a run, stools in a line, and the order is the point. A thrift store is
  // ACCRETED: every fixture arrived separately, none of them match, and each
  // one was put wherever there was still floor. The bodega passed on exactly
  // that quality, so this copies its method: fixtures at angles to each other,
  // stock overflowing its own container, and nothing lining up with anything.
  //
  // The one rule that does not bend is that you can still WALK it.
  // `scripts/interiors-walk.mjs` asserts a clear run across most of the room's
  // width, and it is right to — "hard to cross in a straight line" means the
  // straight line is blocked, not that the room is. Everything below is placed
  // so the path bends; nothing below closes it.
  // ═══════════════════════════════════════════════════════════════════════

  // ── the rails are doubled where there is no room ──
  //
  // A packed rail does not get a fourth rail when more stock arrives; it gets a
  // SECOND TIER under the first, because the bar is already there and the floor
  // is not. Short garments below, long above, and the two blocks touching is
  // the whole tell — there is no gap because a gap would be wasted.
  const dblT = declareSurface(pixTex(24, 20, (g) => {
    const cols = ['#6a5a4a', '#4a5a62', '#7a6a52', '#5a4a52', '#3a4a3a'];
    for (let i = 0; i < 24; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(i, 0, 1, 12 + ((i * 7) % 8));
    }
    dither(g, 24, 20, 90);
  }), 'detail');
  for (const rz of ROWS) {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(RAIL_L - 0.5, 0.52, 0.4),
      ctx.flat(dblT));
    put(lower, RAIL_CX + 0.12, 0.62, rz);
  }

  // ── the coat rail, sagging under what is on it ──
  //
  // Wool coats are the heaviest thing a thrift store hangs, and the rail that
  // takes them is never rated for it. The BOW is the detail: a straight bar
  // says the shop is coping. Three segments stepping down and back up reads as
  // a curve at this scale and costs three boxes, which is the same trick the
  // kerb profile uses.
  const COAT_X = 3.4, COAT_Z0 = -2.3, COAT_Z1 = 0.9;
  const COAT_L = COAT_Z1 - COAT_Z0, COAT_CZ = (COAT_Z0 + COAT_Z1) / 2;
  const coatT = declareSurface(pixTex(20, 28, (g) => {
    const cols = ['#3a3a42', '#4a4238', '#2f3a3a', '#52463a', '#38323a'];
    for (let i = 0; i < 20; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(i, 0, 1, 20 + ((i * 5) % 8));
    }
    dither(g, 20, 28, 110);
  }), 'detail');
  for (const [seg, drop] of [[-1, 0], [0, 0.07], [1, 0]] as [number, number][]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, COAT_L / 3),
      new THREE.MeshBasicMaterial({ color: 0x9a9690 }));
    put(bar, COAT_X, 1.78 - drop, COAT_CZ + seg * (COAT_L / 3));
    const coats = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.02, COAT_L / 3 - 0.04),
      ctx.flat(coatT));
    put(coats, COAT_X, 1.22 - drop, COAT_CZ + seg * (COAT_L / 3));
  }
  for (const end of [COAT_Z0, COAT_Z1]) {
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x9a9690 }));
    put(up, COAT_X, 0.9, end);
  }
  solid(COAT_X, COAT_CZ, 0.5, COAT_L);

  // ── the bin of loose belts ──
  //
  // Not folded, not paired, not priced individually — tipped in and left. A
  // heap of straps reads as a heap because the buckles catch the light at every
  // angle and the leather does not, so it is drawn as scattered bright ticks on
  // a dark mass rather than as belts.
  const beltT = declareSurface(pixTex(28, 18, (g) => {
    g.fillStyle = '#3a2f28'; g.fillRect(0, 0, 28, 18);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = ['#5a4a3a', '#2f2620', '#6a5442'][i % 3];
      g.fillRect((i * 5) % 28, (i * 7) % 18, 4, 2);
    }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = '#b8ae96';                       // buckles
      g.fillRect((i * 9 + 3) % 28, (i * 5 + 2) % 18, 2, 2);
    }
  }), 'detail');
  const beltBin = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.62), woodM);
  // z 2.55, not 2.0: the spine aisle the harness walks runs along local z = 1.8,
  // and at 2.0 this bin's 0.62 m depth plus the 0.36 m capsule sat right across
  // it. Dense is the brief; blocking the one route to the till is not.
  put(beltBin, 0.7, 0.21, 2.55);
  const belts = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.58), ctx.flat(beltT));
  belts.rotation.x = -Math.PI / 2;
  put(belts, 0.7, 0.44, 2.55);
  solid(0.7, 2.55, 0.82, 0.62);

  // ── the mannequin, at the wrong angle ──
  //
  // Nobody turned it back. It faces into the rail rather than at the door,
  // which is the single most thrift-store thing in the room: a boutique's
  // mannequin is aimed at you, and this one is aimed at nothing because the
  // person who moved it was carrying something else at the time.
  // likewise clear of the z = 1.8 spine once the capsule is allowed for
  const MAN_X = -0.4, MAN_Z = 2.68;
  const formM = new THREE.MeshBasicMaterial({ color: 0xc8bda8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.22), formM);
  torso.rotation.y = 0.9;                            // the wrong angle
  put(torso, MAN_X, 1.28, MAN_Z);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), formM);
  put(stem, MAN_X, 0.66, MAN_Z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), formM);
  put(base, MAN_X, 0.37, MAN_Z);
  const dress = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.26),
    ctx.flat(declareSurface(pixTex(16, 20, (g) => {
      g.fillStyle = '#8a5a62'; g.fillRect(0, 0, 16, 20);
      for (let i = 0; i < 16; i += 3) { g.fillStyle = '#a06a72'; g.fillRect(i, 0, 1, 20); }
      dither(g, 16, 20, 60);
    }), 'detail')));
  dress.rotation.y = 0.9;
  put(dress, MAN_X, 1.22, MAN_Z);
  solid(MAN_X, MAN_Z, 0.4, 0.4);

  // ── boxes behind the counter, not sorted yet ──
  //
  // The back of a thrift store is where the donations land and wait. Stacked
  // three high and not squared to each other, because they were put down, not
  // placed. They sit BEHIND the till, so they are scenery you look past the
  // keeper at rather than anything you walk into.
  const boxM = new THREE.MeshBasicMaterial({ color: 0xa08a68 });
  const BOXES: [number, number, number, number][] = [
    // 0.44 m tall, so tier one centres at 0.22 and tier two at 0.66. These were
    // eyeballed at 0.24…0.28 and 0.70…0.76, which left every one of them a few
    // centimetres off its own floor or the box below it.
    [-0.3, 0.22, -0.18, 0.5], [-0.22, 0.66, -0.12, 0.2],
    [0.55, 0.22, 0.1, -0.35], [0.62, 0.66, 0.06, 0.15],
    [1.35, 0.22, -0.05, 0.6],
  ];
  for (const [dx, y, dz, rot] of BOXES) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.4), boxM);
    b.rotation.y = rot;
    put(b, TILL_CX + dx, y, TILL_Z - 0.95 + dz);
  }

  // ── the window display, which is what A's glass looks into ──
  //
  // The desk: the thrift EXTERIOR is being rebuilt by A, and *"the window
  // display you build inside should be what is visible through the glass."* So
  // this is aimed OUT — a dressed form and a shelf of the better stock, set
  // right at the front wall where the glazing is, on the assumption that
  // somebody outside is looking in at it.
  //
  // Deliberately the ONE tidy corner in the room. A thrift store dresses its
  // window because that is the only part the street sees; everything two metres
  // behind it is a heap. The contrast is the joke, and it only works if the
  // window is genuinely neat.
  const WIN_X = -3.0, WIN_Z = hd - 0.55;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.5), woodM);
  put(plinth, WIN_X, 0.21, WIN_Z);
  solid(WIN_X, WIN_Z, 1.5, 0.5);
  const wTorso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.56, 0.2), formM);
  wTorso.rotation.y = Math.PI;                        // facing the street
  put(wTorso, WIN_X - 0.35, 0.42 + 0.28, WIN_Z);   // plinth top + half the torso
  const wCoat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.24), ctx.flat(coatT));
  wCoat.rotation.y = Math.PI;
  put(wCoat, WIN_X - 0.35, 0.42 + 0.31, WIN_Z);    // …and half the coat
  for (let i = 0; i < 3; i++) {
    const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.18),
      new THREE.MeshBasicMaterial({ color: [0xb8a24e, 0x8a9aa8, 0xa06a72][i] }));
    put(g2, WIN_X + 0.15 + i * 0.28, 0.53, WIN_Z);

  // ── the folded-goods wall, because a thrift store is PACKED ──
  //
  // The user: "thrift interior too thin". Measured against every other room
  // before touching it: at 128 meshes over 106 m2 the thrift is 1.2/m2, which
  // is denser than the bodega (0.9) and no longer the thinnest room in the
  // world - pawn (0.5), hotel (0.6) and library (0.6) are now below it. So
  // this is not the emergency it was when the room had 21 objects. It is still
  // thin for a THRIFT though: the whole character of one is stock stacked to
  // the ceiling on every surface that will hold it, and the back wall was bare.
  //
  // Four shelves of folded clothes, derived from the WALL (-hd) rather than
  // typed, so nothing floats if the room grows again - which it has twice.
  const foldT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#6e6658'; g.fillRect(0, 0, 64, 16);
    const cols = ['#8a4a4a', '#4a6a8a', '#8a7a4a', '#5a7a5a', '#7a5a7a', '#a8a094', '#6a5a4a'];
    let x = 0, i = 0;
    while (x < 64) {
      const w = 5 + ((i * 3) % 5), h = 4 + ((i * 5) % 6);
      g.fillStyle = cols[(i * 3) % cols.length];
      g.fillRect(x, 15 - h, w - 1, h);                 // a stack, bottom-aligned
      for (let f = 1; f < h; f += 2) {                 // the folds
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, 15 - h + f, w - 1, 1);
      }
      x += w; i++;
    }
    dither(g, 64, 16, 50);
  }), 'detail');
  const SH_W = room.W - 1.4, SH_Z = -hd + 0.16;
  for (let sh = 0; sh < 4; sh++) {
    const y = 0.55 + sh * 0.52;
    const board = new THREE.Mesh(new THREE.BoxGeometry(SH_W, 0.05, 0.30),
      new THREE.MeshBasicMaterial({ color: 0x6a5a44 }));
    put(board, 0, y, SH_Z);
    const ft = foldT.clone(); ft.needsUpdate = true;
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(SH_W / 3.2, 1);                      // GOTCHAS 5: from real metres
    const goods = new THREE.Mesh(new THREE.PlaneGeometry(SH_W, 0.44),
      new THREE.MeshBasicMaterial({ map: ft }));
    put(goods, 0, y + 0.245, SH_Z + 0.14);
  }
  // uprights, so the run reads as shelving and not as floating boards
  for (const ux of [-SH_W / 2, 0, SH_W / 2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.15, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x5a4a38 }));
    put(post, ux, 1.07, SH_Z);
  }
  solid(0, SH_Z, SH_W, 0.34);
  }

  // ── more card signs, because one notice is never the last notice ──
  const MORE: [string, string, number, number, number][] = [
    ['ALL SALES', 'FINAL', TILL_CX - 1.5, 1.62, TILL_Z + 0.1],
    ['COATS', 'HEAVY $6', COAT_X - 0.32, 1.92, COAT_CZ],
    // propped ON the bin rim (0.42 top + the card's own half-height), not at a
    // typed height above a bin that has no wall behind it to tape it to
    ['BELTS', '$1 EACH', 0.7, 0.42 + 0.10, 2.55],
    ['SHOES', 'AS FOUND', hw - 0.42, 1.86, SHOE_CZ],
  ];
  for (const [a, b, cx2, cy, cz2] of MORE) room.sign(cardT(a, b), 0.4, 0.2, cx2, cy, cz2);

  // ── the proprietor, behind the till ──
  //
  // From the citizen atlas. She was a hand-painted plane — the third copy of
  // the diner waitress's mistake — and a shop whose whole character is that
  // somebody has been minding it for thirty years cannot have a keeper who
  // only exists from one angle.
  //
  // Brown cardigan over grey, grey hair: she is not selling to you, she is
  // minding the shop, and the atlas carries that in the palette.
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
  const KEEP_AT = TILL_Z - 0.55;   // behind the counter
  room.person({
    jacket: '#6a5a48', pants: '#4a4a52', skin: '#c9a48a', hair: '#c8c4bc',
    fit: 'coat', accent: '#8a7a62', cut: 'short', build: 0,
  }, TILL_CX, KEEP_AT, { facing: Math.atan2(0, TILL_Z - KEEP_AT), h: 0.95, w: 0.94 });
  // ── the till, which is also what makes the keeper check honest ──
  //
  // Same reason as the burger barn's order spot: the harness's authored
  // customer station cannot falsify a keeper authored in the same file, and a
  // published serve spot is the world's own answer to where a customer stands.
  // Derived from the till case, on the shopper's side of it.
  ctx.spot({
    x: room.wx(TILL_CX), z: room.wz(TILL_Z + 1.05), r: 1.0,
    ok: room.inside,
    label: () => (ctx.purse.cash >= 4
      ? 'buy a coat at the till — $4.00'
      : 'a coat is $4.00 — you’re short'),
    act: () => {
      if (ctx.purse.cash < 4) return;
      ctx.purse.cash -= 4;
      ctx.purse.inv['COAT'] = (ctx.purse.inv['COAT'] ?? 0) + 1;
      ctx.refreshWallet();
    },
  });

}

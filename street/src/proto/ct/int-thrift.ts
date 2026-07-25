import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
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
    d: 6.5, h: 2.75,
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
  const garmentT = pixTex(64, 32, (g) => {
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
  });
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
  const shoeT = pixTex(64, 16, (g) => {
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
  });
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
  const crockT = pixTex(96, 24, (g) => {
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
  });
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
  const caseT = pixTex(64, 24, (g) => {
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
  });
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
  const bookT = pixTex(32, 16, (g) => {
    g.fillStyle = '#5a4a3a'; g.fillRect(0, 0, 32, 16);
    const cols = ['#8a3a3a', '#3a5a6a', '#7a6a3a', '#5a3a5a', '#4a6a4a'];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = cols[(i * 3) % cols.length];
      g.fillRect(i * 2, 2 + ((i * 5) % 4), 2, 12);
    }
    dither(g, 32, 16, 16);
  });
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
  const cardT = (text: string, sub: string) => pixTex(48, 24, (g) => {
    g.fillStyle = '#e2dcc6'; g.fillRect(0, 0, 48, 24);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, 21, 48, 3);
    g.fillStyle = '#2a3a6a'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 24, 8);
    g.font = '7px monospace';
    g.fillText(sub, 24, 16);
  });
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
    ['AS SEEN', 'NO REFUND', TILL_CX, 1.42, TILL_Z + 0.33],
  ];
  for (const [a, b, cx2, cy, cz2] of CARDS) room.sign(cardT(a, b), 0.44, 0.22, cx2, cy, cz2);
  // …and one taped up in the window, which you read from inside because there
  // is no outside: interiors are not behind their facades.
  room.sign(cardT('OPEN', 'CASH ONLY'), 0.6, 0.3, 1.2, 1.45, hd - 0.06);

  // ── the proprietor, behind the till ──
  //
  // From the citizen atlas. She was a hand-painted plane — the third copy of
  // the diner waitress's mistake — and a shop whose whole character is that
  // somebody has been minding it for thirty years cannot have a keeper who
  // only exists from one angle.
  //
  // Brown cardigan over grey, grey hair: she is not selling to you, she is
  // minding the shop, and the atlas carries that in the palette.
  room.person({
    jacket: '#6a5a48', pants: '#4a4a52', skin: '#c9a48a', hair: '#c8c4bc',
    fit: 'coat', accent: '#8a7a62', cut: 'short', build: 0,
  }, TILL_CX, TILL_Z - 0.55, { facing: Math.PI, h: 0.95, w: 0.94 });
}

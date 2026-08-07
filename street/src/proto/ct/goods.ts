import { defineItem, mBox, mCyl, mOf } from './inventory';

// ══ THE THINGS SHOPS SELL ══════════════════════════════════════════════════
//
// *"for every business i just want to be able to talk to the shop keeper or
//  cashier and see a diagetic list of options as like a sign or something for
//  everything you can buy. stock the burger barn, the diner, the bodega, etc
//  all of them."*   (2026-08-06)
//
// A SECOND ITEM FILE, NOT A SECOND ITEM SYSTEM. Every declaration here goes
// through `defineItem` into the one table `ct/inventory.ts` owns, so a burger
// bought at the barn is the same kind of thing as a newspaper picked off the
// pavement — one `Purse.inv`, one bag, one wallet. What is separate is only the
// FILE, and for the reason `defineItem`'s own comment gives: declaring an item
// never required that file to own it, and stock is going to arrive shop by shop
// over the whole rollout. Keeping it here means the diner, the bodega and the
// video hut each add their goods without eight builders queueing on one file.
//
// ⚠ NOTHING IS CONSTRUCTED AT MODULE SCOPE. `model` is a BUILDER, called once
// per drop, and the icons are canvas painters. Creating a `THREE` object up here
// would spend `Math.random()` on `generateUUID` before the world builds and move
// every tree and pigeon in it (GOTCHAS §2).
//
// ⚠ AND EVERY ITEM HAS BOTH PICTURES. `ItemDef` degrades honestly — no icon is a
// wrapped parcel, no model is a textured box — but a shop full of parcels is a
// shop that looks broken. If you add stock, draw it twice: a 24 x 24 icon for
// the bag, and a few flat boxes at REAL SIZE for when it is dropped on a floor.
// The sizes below are measured things: a fries carton is 11 cm tall, a shake cup
// is 16, a wrapped burger is 11 across.

/** one flat rectangle in the 24 x 24 icon box. The whole icon vocabulary. */
const box = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

// ── BURGER BARN ────────────────────────────────────────────────────────────
//
// The palette is the room's, read off `ct/int-burger.ts` rather than re-picked:
// #c8302a is the barn's red and #e6dcc6 its beige, and the greaseproof paper
// everything is wrapped in is #ded4bc. Food bought over a counter in 1997 is
// nearly all PAPER from the outside, which is what makes these read as a set.

export const BURGER = defineItem({
  id: 'BURGER', name: 'barn burger', stack: 2,
  thick: 0.06,
  blurb: 'still warm through the paper.',
  icon: (g) => {
    box(g, '#ded4bc', 2, 6, 20, 13);                   // the greaseproof wrap
    box(g, '#cbc0a6', 2, 6, 20, 2);                    // its folded top
    box(g, '#c8302a', 2, 11, 20, 3);                   // the printed band
    box(g, '#e6dcc6', 6, 12, 3, 1);
    box(g, '#b8ad94', 2, 17, 20, 2);                   // where it is greasy
    box(g, '#9a8f76', 9, 6, 1, 13);                    // the fold up its side
  },
  // A WRAPPED BURGER: 11 across, 6 tall, the paper twisted at the top. Not a
  // bun — you never see the bun, you see the parcel it comes in.
  model: () => mOf(
    mBox(0.11, 0.055, 0.11, '#ded4bc', 0, 0.028, 0),
    mBox(0.112, 0.016, 0.112, '#c8302a', 0, 0.030, 0),
    mBox(0.06, 0.012, 0.06, '#cbc0a6', 0, 0.061, 0),
  ),
});

export const CHICKEN = defineItem({
  id: 'CHICKEN', name: 'chicken sandwich', stack: 2,
  thick: 0.06,
  blurb: 'a long box, and it rattles.',
  icon: (g) => {
    box(g, '#e6dcc6', 1, 8, 22, 10);                   // the clamshell box
    box(g, '#d4c8ae', 1, 8, 22, 2);
    box(g, '#c8302a', 1, 12, 22, 2);                   // the printed stripe
    box(g, '#3a2a22', 4, 14, 6, 2);                    // the stamp
    box(g, '#b8ad94', 1, 16, 22, 2);
  },
  // THE LONG POLYSTYRENE CLAMSHELL every chicken sandwich came in: 18 x 6 x 10.
  model: () => mOf(
    mBox(0.18, 0.055, 0.10, '#e6dcc6', 0, 0.028, 0),
    mBox(0.182, 0.010, 0.102, '#c8302a', 0, 0.030, 0),
    mBox(0.182, 0.004, 0.102, '#d4c8ae', 0, 0.055, 0),
  ),
});

export const FRIES = defineItem({
  id: 'FRIES', name: 'carton of fries', stack: 2,
  thick: 0.11,
  blurb: 'the ones at the bottom are the good ones.',
  icon: (g) => {
    box(g, '#d8b84a', 7, 2, 3, 8); box(g, '#e8cc6a', 11, 1, 3, 9);   // the fries
    box(g, '#c8a83a', 15, 3, 3, 7);
    box(g, '#c8302a', 5, 8, 14, 14);                   // the carton
    box(g, '#a82820', 5, 8, 2, 14);
    box(g, '#e6dcc6', 8, 12, 8, 4);                    // the printed panel
    box(g, '#c8302a', 9, 13, 6, 2);
  },
  // A TAPERED RED CARTON, 11 tall, with the fries standing proud of it — the
  // one silhouette in this world that needs no label at all.
  model: () => mOf(
    mBox(0.085, 0.105, 0.055, '#c8302a', 0, 0.052, 0),
    mBox(0.087, 0.030, 0.057, '#e6dcc6', 0, 0.048, 0),
    mBox(0.014, 0.055, 0.014, '#e8cc6a', -0.02, 0.128, 0),
    mBox(0.014, 0.070, 0.014, '#d8b84a', 0.005, 0.135, 0.008),
    mBox(0.014, 0.045, 0.014, '#c8a83a', 0.022, 0.122, -0.008),
  ),
});

export const PIE = defineItem({
  id: 'PIE', name: 'apple pie', stack: 4,
  thick: 0.035,
  blurb: 'the filling is hotter than the sun and always has been.',
  icon: (g) => {
    box(g, '#c8862e', 2, 7, 20, 11);                   // the cardboard sleeve
    box(g, '#a86a20', 2, 7, 20, 2);
    box(g, '#e6dcc6', 5, 10, 14, 5);                   // the label panel
    box(g, '#8a5a1e', 7, 12, 10, 1);
    box(g, '#d8b84a', 2, 16, 20, 2);                   // where it has soaked
  },
  // THE CARDBOARD SLEEVE, 13 x 3.5 x 8, printed end on.
  model: () => mOf(
    mBox(0.13, 0.034, 0.08, '#c8862e', 0, 0.017, 0),
    mBox(0.09, 0.036, 0.05, '#e6dcc6', 0, 0.018, 0),
    mBox(0.132, 0.008, 0.082, '#a86a20', 0, 0.030, 0),
  ),
});

export const SHAKE = defineItem({
  id: 'SHAKE', name: 'milkshake', stack: 2,
  thick: 0.16,
  blurb: 'too thick for the straw. It always is.',
  icon: (g) => {
    box(g, '#e8e2d0', 4, 6, 4, 1);                     // the straw, bent
    box(g, '#c8302a', 7, 3, 2, 5);
    box(g, '#e6dcc6', 6, 7, 12, 15);                   // the cup
    box(g, '#d4c8ae', 6, 7, 2, 15);
    box(g, '#c8302a', 6, 11, 12, 4);                   // the printed band
    box(g, '#e6dcc6', 8, 12, 3, 2);
    box(g, '#f0ead6', 5, 6, 14, 2);                    // the lid
  },
  // A LIDDED PAPER CUP, 16 tall on a 40 mm radius, with a straw out of the top.
  model: () => {
    const cup = mCyl(0.040, 0.150, '#e6dcc6'); cup.position.y = 0.075;
    const band = mCyl(0.0405, 0.045, '#c8302a'); band.position.y = 0.070;
    const lid = mCyl(0.044, 0.014, '#f0ead6'); lid.position.y = 0.155;
    const straw = mCyl(0.005, 0.090, '#c8302a'); straw.position.set(0.008, 0.200, 0);
    return mOf(cup, band, lid, straw);
  },
});

export const COFFEE = defineItem({
  id: 'COFFEE', name: 'cup of coffee', stack: 2,
  thick: 0.13,
  blurb: 'burnt, and it has been on the plate since six.',
  icon: (g) => {
    box(g, '#e8e2d0', 6, 6, 12, 16);                   // the paper cup
    box(g, '#d0cab8', 6, 6, 2, 16);
    box(g, '#8a5a1e', 6, 12, 12, 3);                   // the printed band
    box(g, '#3a2a22', 5, 5, 14, 2);                    // the brown lid
    box(g, '#2a1e18', 11, 5, 3, 1);                    // the drinking tab
  },
  // A PAPER CUP UNDER A BROWN LID, 12 tall on a 36 mm radius.
  model: () => {
    const cup = mCyl(0.036, 0.115, '#e8e2d0'); cup.position.y = 0.058;
    const band = mCyl(0.0365, 0.030, '#8a5a1e'); band.position.y = 0.052;
    const lid = mCyl(0.040, 0.014, '#3a2a22'); lid.position.y = 0.120;
    return mOf(cup, band, lid);
  },
});

// ── THE DINER ──────────────────────────────────────────────────────────────
//
// A sit-down place plates its food, and a plate is not a thing you put in a
// bag — so what the diner actually SELLS you to carry is the foam clamshell it
// goes home in, which is what a 1997 diner hands across the counter. Its
// palette is `ct/int-diner.ts`'s: #cfc7b6 chrome, #c8bfa4 formica, #9a2f2c the
// vinyl red, #d8a02a the heat lamp over the pass.
//
// Everything else on that menu board is an item the world already has. The
// coffee and the apple pie are the burger barn's, dearer, which is the whole
// of what "a diner is not a fast-food place" means in money.

export const EGGS = defineItem({
  id: 'EGGS', name: 'eggs any style', stack: 2,
  thick: 0.06,
  blurb: 'the yolk went hard somewhere between the pass and here.',
  icon: (g) => {
    box(g, '#e8e4d8', 2, 7, 20, 12);                   // the foam clamshell
    box(g, '#d4d0c4', 2, 7, 20, 2);
    box(g, '#c8bfa4', 2, 12, 20, 1);                   // the hinge line
    box(g, '#4a7a6a', 4, 14, 9, 4);                    // the green order slip
    box(g, '#e8e4d8', 5, 15, 5, 1);
    box(g, '#c4c0b2', 2, 17, 20, 2);
  },
  // A SMALL WHITE FOAM CLAMSHELL, 17 x 6 x 15, the slip taped to the lid.
  model: () => mOf(
    mBox(0.17, 0.055, 0.15, '#e8e4d8', 0, 0.028, 0),
    mBox(0.172, 0.006, 0.152, '#c8bfa4', 0, 0.028, 0),
    mBox(0.07, 0.004, 0.05, '#4a7a6a', -0.02, 0.056, 0.02),
  ),
});

export const PLATTER = defineItem({
  id: 'PLATTER', name: 'burger platter', stack: 1,
  thick: 0.08,
  blurb: 'heavy, and the underneath is already going soft.',
  icon: (g) => {
    box(g, '#ded8c8', 1, 5, 22, 15);                   // the big clamshell
    box(g, '#cac4b2', 1, 5, 22, 2);
    box(g, '#9a2f2c', 1, 10, 22, 3);                   // the paper band round it
    box(g, '#ded8c8', 4, 11, 4, 1);
    box(g, '#b8b09a', 1, 17, 22, 3);                   // where the grease came through
    box(g, '#a89e86', 6, 18, 9, 1);
  },
  // THE BIG ONE, 22 x 7 x 18, with a paper band round the middle to keep it
  // shut. `stack: 1` — you are not carrying two dinners.
  model: () => mOf(
    mBox(0.22, 0.070, 0.18, '#ded8c8', 0, 0.035, 0),
    mBox(0.224, 0.020, 0.184, '#9a2f2c', 0, 0.038, 0),
    mBox(0.222, 0.006, 0.182, '#cac4b2', 0, 0.070, 0),
  ),
});

// ── THE BODEGA ─────────────────────────────────────────────────────────────
//
// A corner shop sells what a corner shop sells, and five of its seven lines are
// already in this world — cereal, soda, coffee, a newspaper, a pack of tube
// socks. The two it needed are the two things behind its own deli glass and on
// its own rack. Palette off `ct/int-bodega.ts`: #e4dcc4 the card stock its signs
// are written on, #2a3a6a the marker, #6a5442 the timber.

export const SANDWICH = defineItem({
  id: 'SANDWICH', name: 'deli sandwich', stack: 2,
  thick: 0.07,
  blurb: 'cut on the diagonal, taped shut, and warm from the case.',
  icon: (g) => {
    box(g, '#e8e4d8', 2, 4, 20, 17);                   // white deli paper
    box(g, '#d4d0c4', 2, 4, 20, 2);
    box(g, '#c8c4b6', 11, 4, 1, 17);                   // the fold down the middle
    box(g, '#d8b84a', 8, 10, 8, 3);                    // the tape across it
    box(g, '#8a5a3a', 4, 15, 7, 3);                    // and the filling, showing
    box(g, '#5a7a3a', 4, 17, 7, 1);
  },
  // WRAPPED IN DELI PAPER, 17 x 7 x 11, cut and taped.
  model: () => mOf(
    mBox(0.17, 0.065, 0.11, '#e8e4d8', 0, 0.033, 0),
    mBox(0.05, 0.068, 0.112, '#d8b84a', 0, 0.034, 0),
    mBox(0.172, 0.008, 0.112, '#d4d0c4', 0, 0.065, 0),
  ),
});

export const CHIPS = defineItem({
  id: 'CHIPS', name: 'bag of chips', stack: 2,
  thick: 0.10,
  blurb: 'mostly air, and it always was.',
  icon: (g) => {
    box(g, '#d8b84a', 3, 3, 18, 19);                   // the foil bag
    box(g, '#c8a83a', 3, 3, 4, 19);                    // the shaded side
    box(g, '#e8cc6a', 3, 3, 18, 2);                    // the crimped top
    box(g, '#e8cc6a', 3, 20, 18, 2);
    box(g, '#b8342a', 5, 9, 14, 6);                    // the printed panel
    box(g, '#e8e4d8', 7, 11, 10, 2);
  },
  // A PUFFED FOIL BAG, 17 x 10 x 6, crimped top and bottom.
  model: () => mOf(
    mBox(0.16, 0.095, 0.055, '#d8b84a', 0, 0.048, 0),
    mBox(0.09, 0.040, 0.058, '#b8342a', 0, 0.048, 0),
    mBox(0.17, 0.014, 0.020, '#e8cc6a', 0, 0.093, 0),
    mBox(0.17, 0.014, 0.020, '#e8cc6a', 0, 0.007, 0),
  ),
});

// ── THE THRIFT STORE ───────────────────────────────────────────────────────
//
// **`COAT` ALREADY EXISTED AND NOBODY HAD DECLARED IT.** `int-thrift.ts` wrote
// `purse.inv['COAT'] += 1` at its till, so the coat you bought for $4 arrived in
// your bag as `itemOf`'s honest fallback — a wrapped parcel called "coat", with
// no icon of its own and a generic box on the floor if you dropped it. That is
// the fallback doing exactly its job (an unknown id must still be carryable),
// and it is not a thing a shop should be selling. It is declared now.
//
// Palette off `ct/int-thrift.ts`: the shop is browns and greys under a strip
// light, its handwritten cards are #e2dcc6 with #2a3a6a biro, and nothing in it
// is new — everything is the colour it faded to.

export const COAT = defineItem({
  id: 'COAT', name: 'wool coat', stack: 1, bulky: true,
  thick: 0.14,
  blurb: 'somebody else’s shape is still in the shoulders.',
  icon: (g) => {
    box(g, '#5a4a36', 6, 3, 12, 19);                   // the body, folded
    box(g, '#4a3c2c', 6, 3, 3, 19);                    // the shaded fold
    box(g, '#6a5a44', 8, 5, 3, 14);                    // the lapel
    box(g, '#3a3028', 11, 7, 1, 12);                   // the placket
    box(g, '#8a7a5e', 12, 9, 2, 2); box(g, '#8a7a5e', 12, 14, 2, 2);   // buttons
    box(g, '#3a3028', 6, 20, 12, 2);                   // the hem
  },
  // A FOLDED WOOL COAT, 34 x 14 x 26 — the biggest soft thing in the world's
  // item table, which is why it is `bulky`: you carry it, you do not stow it.
  // Same rule the toaster taught (*"dont like that i can take the toaster
  // through all the floors of the apt"*), applied to the only garment for sale.
  model: () => mOf(
    mBox(0.34, 0.13, 0.26, '#5a4a36', 0, 0.065, 0),
    mBox(0.342, 0.030, 0.262, '#4a3c2c', 0, 0.050, 0),
    mBox(0.10, 0.020, 0.24, '#6a5a44', -0.06, 0.135, 0),
    mBox(0.028, 0.012, 0.028, '#8a7a5e', 0.02, 0.138, 0.05),
  ),
});

export const SHIRT = defineItem({
  id: 'SHIRT', name: 'second-hand shirt', stack: 3,
  thick: 0.045,
  blurb: 'pressed by somebody who is not you, some time ago.',
  icon: (g) => {
    box(g, '#8a9aa8', 4, 5, 16, 15);                   // folded, on the board
    box(g, '#7a8a98', 4, 5, 16, 2);                    // the collar band
    box(g, '#e8e4d8', 9, 5, 6, 3);                     // the collar itself
    box(g, '#6a7a88', 11, 8, 1, 11);                   // the buttoned front
    box(g, '#9aaab8', 4, 12, 16, 1);                   // the fold
    box(g, '#7a8a98', 4, 18, 16, 2);
  },
  // FOLDED ON THE BOARD, 26 x 4.5 x 20, the way a shop folds one.
  model: () => mOf(
    mBox(0.26, 0.040, 0.20, '#8a9aa8', 0, 0.020, 0),
    mBox(0.262, 0.008, 0.202, '#9aaab8', 0, 0.040, 0),
    mBox(0.08, 0.012, 0.05, '#e8e4d8', 0, 0.046, -0.07),
  ),
});

export const BELT = defineItem({
  id: 'BELT', name: 'leather belt', stack: 4,
  thick: 0.05,
  blurb: 'worn through at one hole and one hole only.',
  icon: (g) => {
    box(g, '#5a3a22', 3, 8, 18, 5);                    // the strap, coiled
    box(g, '#4a2e1a', 3, 8, 18, 1);
    box(g, '#6a4a2e', 3, 15, 14, 4);                   // the second turn
    box(g, '#c9a45e', 15, 6, 6, 6);                    // the buckle
    box(g, '#5a3a22', 17, 8, 2, 2);
    box(g, '#3a2618', 6, 16, 1, 2); box(g, '#3a2618', 10, 16, 1, 2);   // the holes
  },
  // COILED, the way a belt lies on a table: a 13 cm ring of strap with the
  // buckle sitting on top of it.
  model: () => mOf(
    mCyl(0.065, 0.035, '#5a3a22'),
    mBox(0.13, 0.036, 0.030, '#4a2e1a', 0, 0.018, 0),
    mBox(0.045, 0.012, 0.038, '#c9a45e', 0.04, 0.041, 0),
  ),
});

export const BOOK = defineItem({
  id: 'BOOK', name: 'paperback', stack: 4,
  thick: 0.03,
  blurb: 'the spine is broken at somebody else’s favourite page.',
  icon: (g) => {
    box(g, '#b8503a', 4, 3, 15, 19);                   // the cover
    box(g, '#8a3a28', 4, 3, 3, 19);                    // the spine
    box(g, '#e0d8c0', 19, 4, 2, 17);                   // the block of pages
    box(g, '#e8e0cc', 8, 7, 9, 4);                     // the title panel
    box(g, '#8a3a28', 9, 8, 7, 1); box(g, '#8a3a28', 9, 10, 5, 1);
    box(g, '#d8c8a8', 8, 16, 8, 1);
  },
  // A MASS-MARKET PAPERBACK, 106 x 30 x 174 — the real size, lying face up.
  model: () => mOf(
    mBox(0.106, 0.028, 0.174, '#b8503a', 0, 0.014, 0),
    mBox(0.020, 0.030, 0.176, '#8a3a28', -0.045, 0.015, 0),
    mBox(0.098, 0.024, 0.166, '#e0d8c0', 0.006, 0.014, 0),
    mBox(0.106, 0.002, 0.174, '#b8503a', 0, 0.028, 0),
  ),
});

// ── THE PAWN SHOP ──────────────────────────────────────────────────────────
//
// He sells the same kinds of things he takes in, and the two new ones are the
// two the room already shows you and could not hand over: a radio on the shelf
// behind him, and the watches lying on tags under the counter glass. The other
// four lines on his card are items the fence table already prices — the point of
// the card is the SPREAD, and it only reads if both numbers are about the same
// object. Palette off `ct/int-pawn.ts`: #c9a45e is its gold, #4a4238 its grime.

export const RADIO = defineItem({
  id: 'RADIO', name: 'transistor radio', stack: 2,
  thick: 0.09,
  blurb: 'the dial is off by a station and always will be.',
  icon: (g) => {
    box(g, '#3a3630', 2, 6, 20, 13);                   // the case
    box(g, '#2a2620', 2, 6, 20, 2);
    box(g, '#8a8478', 4, 9, 9, 8);                     // the speaker grille
    for (let y = 10; y < 17; y += 2) box(g, '#3a3630', 4, y, 9, 1);
    box(g, '#c9a45e', 14, 9, 6, 4);                    // the tuning scale
    box(g, '#8a2c22', 17, 10, 1, 3);                   // the needle
    box(g, '#b8c0c8', 15, 15, 3, 3);                   // the knob
    box(g, '#b8c0c8', 20, 2, 1, 5);                    // the aerial
  },
  // A TABLE TRANSISTOR SET, 21 x 9 x 7, aerial up.
  model: () => mOf(
    mBox(0.21, 0.085, 0.070, '#3a3630', 0, 0.043, 0),
    mBox(0.085, 0.060, 0.004, '#8a8478', -0.05, 0.045, 0.036),
    mBox(0.060, 0.026, 0.004, '#c9a45e', 0.045, 0.050, 0.036),
    mBox(0.006, 0.130, 0.006, '#b8c0c8', 0.095, 0.150, 0),
  ),
});

export const WRISTWATCH = defineItem({
  id: 'WRISTWATCH', name: 'wristwatch', stack: 4,
  thick: 0.025,
  blurb: 'running, and eleven minutes fast.',
  icon: (g) => {
    box(g, '#4a3a2a', 10, 2, 5, 7);                    // the strap, top
    box(g, '#4a3a2a', 10, 16, 5, 6);                   // and bottom
    box(g, '#c9a45e', 7, 8, 11, 9);                    // the case
    box(g, '#e0d8c0', 9, 10, 7, 5);                    // the dial
    box(g, '#2a2620', 12, 11, 1, 3);                   // the hands
    box(g, '#2a2620', 12, 12, 3, 1);
    box(g, '#8a7a4a', 18, 11, 1, 2);                   // the crown
  },
  // ON ITS SIDE ON A TAG, which is how it lies in his case: a 36 mm gold case
  // with the strap falling either way off it.
  model: () => mOf(
    mCyl(0.018, 0.009, '#c9a45e'),
    mBox(0.028, 0.010, 0.002, '#e0d8c0', 0, 0.006, 0),
    mBox(0.016, 0.006, 0.075, '#4a3a2a', 0, 0.004, 0),
  ),
});

// ── THE VIDEO HUT ──────────────────────────────────────────────────────────
//
// **A RENTED TAPE AND A TAPE YOU OWN ARE DIFFERENT OBJECTS, and that is what
// makes the shop's two tape lines two lines rather than one line priced twice.**
// The world's `VHS` is *"no label. Somebody taped over something."* — a home
// tape, a black slab with biro on it. What a rental shop hands over is a great
// yellow clamshell with the cover art slid under the sleeve and the shop's own
// sticker on the spine. Ex-rentals are those same cases sold off at $10, which
// is the `2 FOR $20` painted on the shopfront; a home tape is not.
//
// Palette straight off `videoFront` in `ct/tex-world.ts`: #1e5aa8 the blue,
// #f2c22a the yellow, and the five spine colours the facade cycles through its
// racks — so the boxes on the shelves inside are the boxes painted in the glass.

export const RENTAL = defineItem({
  id: 'RENTAL', name: 'rental tape', stack: 2,
  thick: 0.035,
  blurb: 'BE KIND, REWIND. Somebody did not.',
  icon: (g) => {
    box(g, '#f2c22a', 3, 2, 18, 20);                   // the clamshell
    box(g, '#d8a81e', 3, 2, 3, 20);                    // the spine
    box(g, '#e8e0cc', 7, 4, 12, 12);                   // the cover art, slid in
    box(g, '#2f3d6a', 8, 5, 10, 7);
    box(g, '#b8402c', 8, 13, 10, 2);
    box(g, '#1e5aa8', 6, 18, 12, 3);                   // the shop's own sticker
    box(g, '#f2c22a', 8, 19, 6, 1);
  },
  // THE BIG CLAMSHELL, 200 x 30 x 120 — the real size, lying face up.
  model: () => mOf(
    mBox(0.120, 0.030, 0.200, '#f2c22a', 0, 0.015, 0),
    mBox(0.096, 0.032, 0.150, '#e8e0cc', 0, 0.016, -0.012),
    mBox(0.080, 0.034, 0.090, '#2f3d6a', 0, 0.017, -0.030),
    mBox(0.122, 0.012, 0.036, '#1e5aa8', 0, 0.020, 0.080),
  ),
});

export const BLANKS = defineItem({
  id: 'BLANKS', name: 'three blank tapes', stack: 2,
  thick: 0.08,
  blurb: 'shrink-wrapped, and one of them will eat something.',
  icon: (g) => {
    box(g, '#241f1a', 3, 5, 18, 15);                   // three tapes, banded
    box(g, '#3a352d', 3, 5, 18, 2);
    box(g, '#241f1a', 3, 10, 18, 1); box(g, '#241f1a', 3, 15, 18, 1);
    box(g, '#1e5aa8', 6, 5, 12, 15);                   // the paper band round them
    box(g, '#f2c22a', 7, 9, 10, 4);
    box(g, '#1e5aa8', 8, 10, 7, 2);
    box(g, 'rgba(255,255,255,0.18)', 3, 5, 18, 2);     // the wrap catching the light
  },
  // THREE TAPES IN A SLEEVE — 188 x 78 x 104, a real three-pack.
  model: () => mOf(
    mBox(0.188, 0.078, 0.104, '#241f1a', 0, 0.039, 0),
    mBox(0.110, 0.080, 0.106, '#1e5aa8', 0, 0.040, 0),
    mBox(0.070, 0.026, 0.108, '#f2c22a', 0, 0.044, 0),
  ),
});

export const POPCORN = defineItem({
  id: 'POPCORN', name: 'microwave popcorn', stack: 4,
  thick: 0.03,
  blurb: 'the box says two and a half minutes. It is lying.',
  icon: (g) => {
    box(g, '#c8302a', 2, 6, 20, 13);                   // the flat carton
    box(g, '#a82820', 2, 6, 20, 2);
    box(g, '#e8e0cc', 5, 9, 14, 7);                    // the label panel
    box(g, '#c8302a', 6, 10, 12, 2);
    box(g, '#d8b84a', 6, 13, 8, 2);                    // the kernels printed on it
    box(g, '#a82820', 2, 17, 20, 2);
  },
  // A FLAT CARTON OF THREE BAGS, 190 x 30 x 130.
  model: () => mOf(
    mBox(0.190, 0.030, 0.130, '#c8302a', 0, 0.015, 0),
    mBox(0.130, 0.032, 0.070, '#e8e0cc', 0, 0.016, 0),
    mBox(0.192, 0.008, 0.132, '#a82820', 0, 0.030, 0),
  ),
});

/** every id this file declares, so a sweep can ask "does all stock have art?" */
export const GOODS: string[] = [
  BURGER.id, CHICKEN.id, FRIES.id, PIE.id, SHAKE.id, COFFEE.id,
  EGGS.id, PLATTER.id, SANDWICH.id, CHIPS.id,
  COAT.id, SHIRT.id, BELT.id, BOOK.id,
  RADIO.id, WRISTWATCH.id,
  RENTAL.id, BLANKS.id, POPCORN.id,
];

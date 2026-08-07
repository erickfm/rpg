import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import './goods';   // for the side effect: it is what declares the stock

// SLEEP CENTER, inside.
//
// *"build out the remaining stores that atrent built yet pls"*   (2026-08-06)
//
// The fifteenth interior. A WIDE LOW SHOWROOM — 11.8 x 12.0, the largest floor
// in the belt — because that is what the type is: a mattress store is a big flat
// pale room with very little in it and everything you can see from the door.
//
// ══ THE ROOM IS READ OFF THE OUTSIDE ═══════════════════════════════════════
//
// `mattressFront` in `ct/tex-world.ts` paints this shopfront and it is specific.
// Everything below that has a source has this one:
//
//   *"a mattress is one of the most recognisable silhouettes there is: a pale
//    slab, thicker than a shelf and thinner than a table, lying on a darker
//    base, with a pillow cocked at one end. Three of them in a row, at different
//    heights."*
//
// So there are three beds in the window, the middle one a taller divan set, all
// with headboards, pillows and a price card on a wire — the facade's own five
// parts, in the facade's own colours. It also paints a lit ceiling and *"a hard
// pale floor, not a shop's dark boards"*, a MATTRESS SALE banner taped inside
// the glass, and two smaller bills reading NO PAYMENTS TIL '98 and FREE
// DELIVERY. The room owes all of it and it is all here.
//
// ⚠ THE FACADE IS AN ELEVATION AND A ROOM IS A PLAN, which is the one place the
// two cannot be literal. The window beds are drawn SIDE-ON because that is the
// only way to draw a bed in a shopfront; laid out side-on inside, three of them
// span 6.3 m against a 6.36 m glazed run and leave 100 mm between beds, which
// reads as one slab rather than as stock. They stand with their headboards
// against the glass instead — which is what a real showroom window is, and what
// the street sees is still three headboards, three pale slabs and three pillows.
//
// The five colours are the painter's own constants, lifted and not re-picked.
// RUST is also `col` in `ct/street.ts` — the projecting joinery — so the fascia,
// the mouldings and the counter front are one value.
const RUST = '#b8642c', CREAM = '#efe6d2', BLUE = '#2f5c86';
const ALU = '#8f938f', SALE_INK = '#a02818';
/** the beds' own five, straight out of `mattressFront`'s bed loop */
const TICK = '#e6dfcb', TICK_BIG = '#f0ead8';
const DIVAN = '#403a35', DIVAN_BIG = '#4a3f38';
const HEADB = '#4e4238', HEADB_BIG = '#5b4a3c', PILLOW_W = '#faf4e4';

// ══ THE DOOR ═══════════════════════════════════════════════════════════════
//
// An ORDINARY FRONTAGE — main street, EAST side — so the plain `DoorDecl` form
// is all this needs. `ct/street.ts` walks the east roster from z 14.2: the car
// lot takes 23.2 and A-1 TAX 13, which lands its centre on -15.5 (the number
// `ct/int-tax.ts` carries), and SLEEP CENTER's 13 follows it, so `cz` is -28.5.
//
// `at` is 1.583, and it is where the painter is ALREADY drawing the door rather
// than a number I liked — declaring it moves nothing on the street. `layoutOf`
// gives this front (BANDS.mattress: ox 0.30, gi 0.20, dw 1.10) a glazed run of
// 0.50 … 12.50 m and puts the door at `doorFrac('SLEEP CENTER')` = 0.66 along
// it, i.e. 8.244 m from the facade's left edge. Through the kit's own
// conversion — metres along the painter's u, scaled into the room, measured from
// the room's left edge:
//
//     at = alongU * (W / frontageM) - W / 2
//        = 8.244 * (11.8 / 13) - 5.9
//        = 1.583
//
// The room is the AUTHORITY now: move this and the facade's door follows, which
// is the one direction `ct/doors.ts` says it may go.
export const DOOR: DoorDecl = {
  building: 'SLEEP CENTER', w: 13, cz: -28.5, side: 1, at: 1.583,
  // What `mattressFront` draws: an aluminium leaf, glazed to a transom, with a
  // kick plate and an OPEN sign. 1.10 is `BANDS.mattress`'s own `dw`, so the
  // opening you walk through and the one painted on the street are one number.
  leaf: {
    clearW: 1.10, h: 2.4, leaves: 1,
    frame: { colour: 0x8f938f, material: 'aluminium' }, glazing: 'full',
  },
};

// ══ WHAT A BED COSTS, DECLARED ONCE ════════════════════════════════════════
//
// Three consumers quote these numbers — the card on the wire at the foot of
// every bed, the price list on the west wall, and this comment. That is exactly
// the shape that comes to disagree if each carries its own copy, which is the
// fault this project has paid for repeatedly (the door position, the door leaf,
// the ATM's u, the facade's window). One authoring, every reader.
//
// The world's ×4 scale off real 1997 discount-showroom money, rounded to round
// figures because a signwriter writes round money:
//
//     twin set (mattress + foundation)   $199 in 1997  ->  $800
//     full set                            $299         ->  $1200
//     queen set                           $399         ->  $1600
const BEDS = [
  { size: 'TWIN SET', price: 800 },
  { size: 'FULL SET', price: 1200 },
  { size: 'QUEEN SET', price: 1600 },
] as const;
type BedSpec = typeof BEDS[number];

export function buildSleep(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'sleep',
    label: 'into the SLEEP CENTER',
    // W is the kit's rule off the frontage: roomWidthFor(13) = 11.8.
    //
    // 12.0 DEEP, AND THE DEPTH IS THE WHOLE ROOM. A bed is 2.0 m long and the
    // lane rule is 2 m, so a row of beds costs 4 m of depth before anything
    // else — two rows and a counter simply do not fit in the 9-ish metres the
    // other shops take, and the first cut at 11.0 put the window row 1.55 m off
    // the wall row. The thrift store was deepened for the identical reason
    // (*"the room should be LARGER"* — every fixture stays and the floor grows
    // under them). At 12.0 every gap below is 2.0 m or better.
    d: 12.0,
    // 3.3, the tallest shop in the belt. This building is ONE STOREY (`floors:
    // 0`) and its whole street elevation is the 4.2 m shop band, and the glass
    // outside runs to 2.88 m above the pavement — a 2.9 m ceiling would have the
    // head of its own shopfront in the coving.
    h: 3.3,
    // ── PALE AND LIT, AND THE FACADE SAYS SO ───────────────────────────────
    //
    // `mattressFront` paints a ceiling wash and *"a hard pale floor"* into the
    // glass and gives its reason: *"A SHOWROOM IS LIT, and that is why you can
    // see into it at all … the ceiling is brighter than the floor, and the floor
    // throws the light back."* That is the exact opposite of VOLT VILLAGE two
    // hundred metres away, whose facade glazes a dark room so its screens can be
    // the lighting — and the two shops standing across the street from each
    // other in opposite keys is worth having.
    palette: { floor: 0xcfc8b6, wall: 0xe4dcc8, ceil: 0xeae4d4, trim: 0xb8642c },
    // Warm fluorescent trays in a suspended ceiling — the facade draws three
    // strips receding; a 12 m room takes four on the kit's own spacing.
    light: { kind: 'troffer', tint: 0xfff6e0, count: 4 },
    frontage: { name: 'SLEEP CENTER', w: 13, cz: -28.5, side: 1 },
    // The door, its width, the [E] spot on the pavement and the way back out all
    // derive from DOOR above. No `width`: the LEAF is the authority.
    door: { r: 1.05, at: DOOR.at },
    // ── PLATE GLASS ALMOST TO THE FLOOR ───────────────────────────────────
    //
    // `BANDS.mattress` is the shallowest sill gap on the block (0.44 against the
    // default 0.57) and it says why: *"A showroom is MOSTLY GLASS — that is the
    // whole silhouette of the type."* The kit's derived default is a 1.5 m
    // window on a 0.95 m sill, which is a SHOP window; this room owes the
    // facade the glass the facade actually paints.
    //
    // Both numbers are the facade's own (SHOP_BAND_H 4.2; fy 0.10, fh 0.86,
    // og 0.16, gi 0.20, sg 0.44), arithmetic shown so it can be re-derived:
    //
    //     opening top     oy = 0.10 + 0.86 + 0.16           = 1.12 m down
    //     glazing height  gh = (4.2 - 1.12 - 0.05) - 0.44   = 2.59 m
    //     stallriser      4.2 - (1.12 + 0.20 + 2.59) - 0.05 = 0.24 m
    //     glass runs      0.29 … 2.88 m above the pavement
    //
    // And the SPAN is the glazed run west of the door, through the same
    // conversion `at` used: 0.50 m and 12.50 m along u land at local -5.446 and
    // +5.446, the door and its 0.12 m margin take 0.913 … 2.253, and the bigger
    // of the two remaining runs is the west one at 6.359 m.
    window: { at: -2.2665, w: 6.359, h: 2.59, sill: 0.29 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const MATS = new Map<string, THREE.Material>();
  /** one material per colour, because a bed is thirty boxes and five beds is a
   *  hundred and fifty — a fresh `MeshBasicMaterial` each would be a hundred and
   *  fifty draw states for eleven colours. */
  const m = (c: string): THREE.Material => {
    const hit = MATS.get(c);
    if (hit) return hit;
    const made = new THREE.MeshBasicMaterial({ color: c });
    MATS.set(c, made);
    return made;
  };

  // ── the floor: pale vinyl tile, which is what the facade is painting ──
  //
  // 0.6 m squares in two shades of one cream with a dark joint — a hard floor
  // that throws light back, against the video hut's cord carpet and VOLT
  // VILLAGE's grey carpet tile. You know which shop you are in from the floor.
  const tileT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#cfc8b6'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#d9d2bf';
    g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
    g.fillStyle = 'rgba(120,108,88,0.22)';
    g.fillRect(15, 0, 1, 32); g.fillRect(0, 15, 32, 1);            // the joints
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 32, 1);
    dither(g, 32, 32, 34);
  }), 'ground');
  tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping;
  // ⚠ THE CANVAS COVERS 1.2 m AND THAT NUMBER IS THE OBJECT: it holds a 2 x 2
  // block of 0.6 m tiles, so the repeat is the room's metres over 1.2 (GOTCHAS
  // §5). Sized off the mesh instead, this room would be floored in 6 m tiles.
  tileT.repeat.set(Math.round(room.W / 1.2), Math.round(room.D / 1.2));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(tileT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ══ THE FLOOR PLAN, AND THE LANE ARITHMETIC ════════════════════════════════
  //
  // The 2 m lane is sacred indoors, and in a room whose furniture is 1.4 x 2.0 m
  // it is the thing that decides the layout. Room is 11.8 x 12.0, so hw = 5.9,
  // hd = 6.0, and the door is at local x +1.583.
  //
  //   z  6.00   the front wall: the door at +1.58 (1.03 … 2.13), and plate
  //             glass from -5.45 to +0.91
  //   z  5.90   the window row's headboards, against that glass
  //   z  3.85   …and the feet of those three beds  (x -5.40 … -0.20)
  //             ── 2.15 m ──                         the front aisle
  //   z  1.65   the west pair's north edge          (x -5.90 … -3.85)
  //   z -2.05   …and its south edge
  //             ── 2.35 m ──                         (against the linen run)
  //   z -4.35   the counter's front face            (x +0.60 … +5.90)
  //   z -5.05   its back face
  //             ── 0.95 m ──                         the staff strip
  //   z -6.00   the back wall
  //
  // and up the east wall, clear of both:
  //
  //   the linen run  x 5.30 … 5.90,  z -2.00 … 2.00
  //
  // ⚠ THE DOOR OPENS ONTO EMPTY FLOOR, WHICH IS THE POINT OF THE WHOLE PLAN.
  // The video hut had to move its counter after the first cut because *"you
  // walked in with a rack of tape one metre from your face and the till out of
  // sight behind it"*; this room is laid out from that fact rather than into it.
  // You come in at x +1.58 and the room runs 10.25 m straight ahead of you to
  // the counter with NOTHING in the way — no bed is east of x -0.20, so the
  // whole east half is the walking floor and the whole west half is the
  // showroom. The nearest thing to the doorway is a headboard 1.78 m to your
  // left, beside you rather than in front of you.
  //
  // Every measured gap:
  //
  //   window row  -> west pair    2.15 m
  //   linen run   -> counter      2.35 m
  //   west pair   -> linen run    9.15 m
  //   the walking floor east of the beds is 6.10 m wide, end to end.
  //
  // ⚠ A BED IS 2.03 m FROM ITS FOOT TO THE BACK OF ITS HEADBOARD (0.975 of
  // divan, then the board 0.04 behind it and 0.08 thick), and the two rows are
  // pushed to leave 0.07 m and 0.015 m of daylight at the wall they face rather
  // than landing ON it. A headboard whose back face is coplanar with the plaster
  // z-fights (GOTCHAS §6) and a headboard buried in it loses the shadow line
  // that makes it read as furniture standing against a wall.
  const ROW_Z = 4.875, ROW_X = [-4.65, -2.80, -0.95];   // foot 3.90, head 5.93
  const PAIR_X = -4.83, PAIR_Z = [0.90, -1.30];         // heads to the west wall
  const LIN_X = 5.60, LIN_D = 0.60, LIN_L = 4.00;
  const CTR_X0 = 0.60, CTR_X1 = hw, CTR_D = 0.70, CTR_Z = -4.70;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;

  // ══ A BED ══════════════════════════════════════════════════════════════════
  //
  // Built in BED-LOCAL terms — `u` across it, `v` along it from the middle, +v
  // toward the head — and mapped into the room by `dir`. Two orientations are
  // all this room has (heads to the front wall, heads to the west wall) and both
  // go through the same builder rather than through two copies of it, which is
  // the only way the divan, the ticking, the stitch lines and the card cannot
  // come out different on the two rows.
  //
  // Every part is `mattressFront`'s own part in `mattressFront`'s own colour:
  // headboard, shadow, divan base, the pale slab with a lit top edge and three
  // stitch lines down its side, a pillow, and the price card on a wire.
  const bed = (o: { cx: number; cz: number; dir: 'z' | 'x'; big: boolean; spec: BedSpec }) => {
    const at = (u: number, v: number): [number, number] =>
      o.dir === 'z' ? [o.cx + u, o.cz + v] : [o.cx - v, o.cz + u];
    const dim = (du: number, dv: number): [number, number] =>
      o.dir === 'z' ? [du, dv] : [dv, du];
    const slab = (du: number, h: number, dv: number, c: string, u: number, y: number, v: number) => {
      const [dx, dz] = dim(du, dv);
      const [lx, lz] = at(u, v);
      put(new THREE.Mesh(new THREE.BoxGeometry(dx, h, dz), m(c)), lx, y, lz);
    };
    // REAL SIZES. A double mattress is 1.37 x 1.90 and 0.24 thick over a 0.28
    // divan; the "different heights" the facade draws are a genuinely deeper
    // base on the set in the middle, not a scale factor.
    const BASE_H = o.big ? 0.38 : 0.28;
    const MAT_H = 0.24, PLINTH = 0.06;
    const baseY = PLINTH + BASE_H / 2;
    const matY0 = PLINTH + BASE_H, matY = matY0 + MAT_H / 2;
    slab(1.32, PLINTH, 1.85, '#2a2622', 0, PLINTH / 2, 0);              // castors, in shadow
    slab(1.40, BASE_H, 1.95, o.big ? DIVAN_BIG : DIVAN, 0, baseY, 0);   // the divan
    slab(1.38, MAT_H, 1.93, o.big ? TICK_BIG : TICK, 0, matY, 0);       // THE PALE SLAB
    slab(1.386, 0.030, 1.936, '#fdfaf0', 0, matY0 + MAT_H - 0.015, 0);  // its lit top edge
    // the quilted band down the side — three stitch lines, the facade's own
    // count, and they are what stops the slab reading as a sheet of card
    for (let k = 1; k < 4; k++)
      slab(1.392, 0.012, 1.938, '#c8bda6', 0, matY0 + (MAT_H * k) / 4, 0);
    // the headboard, hard against whatever wall this bed's head is at
    const HB_H = o.big ? 1.15 : 0.95;
    slab(1.50, HB_H, 0.08, o.big ? HEADB_BIG : HEADB, 0, 0.14 + HB_H / 2, 1.015);
    // TWO PILLOWS, cocked at the head — the facade draws one because it is
    // drawing one bed side-on; seen in plan a made bed has a pair.
    for (const pu of [-0.34, 0.34])
      slab(0.62, 0.13, 0.40, PILLOW_W, pu, matY0 + MAT_H + 0.065, 0.62);
    // ── the price card on a wire, which is how a showroom prices a bed ──
    //
    // *"a price card on a wire, because that is what is on every bed in one."*
    // It carries a REAL number, off the one `BEDS` table at the head of this
    // file, and it faces the aisle the bed is approached from.
    const cardT = declareSurface(pixTex(64, 40, (g) => {
      g.fillStyle = '#fdfaf0'; g.fillRect(0, 0, 64, 40);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 37, 64, 3);
      g.fillStyle = BLUE; g.fillRect(0, 0, 64, 3);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 8px monospace'; g.fillStyle = '#3a2c22';
      g.fillText(o.spec.size, 32, 12);
      g.font = 'bold 15px monospace'; g.fillStyle = SALE_INK;
      g.fillText(`$${o.spec.price}`, 32, 27);
    }), 'sign');
    const [wx, wz] = at(-0.62, -1.02);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.02), m(ALU)), wx, matY + 0.30, wz);
    room.sign(cardT, 0.34, 0.21, wx, matY + 0.52, wz, o.dir === 'z' ? Math.PI : Math.PI / 2);
  };

  // ── the window row, which is the picture on the shopfront ──
  //
  // Three beds, the middle one the taller divan set, headboards against the
  // glass. ONE collider for the run: the gaps between them are 0.35 m against a
  // 0.72 m player, so boxing them separately would only build three slots to
  // wedge in — the video hut's gondolas make the same call for the same reason.
  bed({ cx: ROW_X[0], cz: ROW_Z, dir: 'z', big: false, spec: BEDS[0] });
  bed({ cx: ROW_X[1], cz: ROW_Z, dir: 'z', big: true, spec: BEDS[2] });
  bed({ cx: ROW_X[2], cz: ROW_Z, dir: 'z', big: false, spec: BEDS[1] });
  // x from the outer beds' own headboards (1.50 wide), z from foot to head.
  solid(ROW_X[1], ROW_Z + 0.015, (ROW_X[2] - ROW_X[0]) + 1.50, 2.03);

  // ── and the pair up the west wall ──
  bed({ cx: PAIR_X, cz: PAIR_Z[0], dir: 'x', big: true, spec: BEDS[2] });
  bed({ cx: PAIR_X, cz: PAIR_Z[1], dir: 'x', big: false, spec: BEDS[1] });
  solid(PAIR_X - 0.015, (PAIR_Z[0] + PAIR_Z[1]) / 2, 2.03, (PAIR_Z[0] - PAIR_Z[1]) + 1.50);

  // ══ THE BED PRICE LIST, AND WHY IT IS A SIGN AND NOT A COUNTER ═════════════
  //
  // ── WHAT BUYING A MATTRESS ACTUALLY DOES: NOTHING, AND SO IT IS NOT SOLD ───
  //
  // The honest answer, stated rather than faked.
  //
  // `ct/shop.ts` can sell a thing that is not an object — the hotel's `serve`
  // takes the money and advances the clock, because *"a night, not an object"*
  // is a transaction this world can actually carry out. **A mattress is neither
  // an object you can carry nor an act this world can perform.** Nothing would
  // change if you bought one: `ct/goods.ts` could hold a `MATTRESS` id, but a
  // queen set does not go in a shoulder bag and does not go in the one-slot
  // hands either, and the only place it could meaningfully arrive is the bed in
  // room 301 — which lives in `ct/apartment.ts`, has no state to change, and is
  // nobody's ask.
  //
  // So a bed line at the counter would take $1,600 and hand over a note. That is
  // exactly the half-a-system the video hut refused when it declined to invent a
  // return clock — *"nothing is owed back, because a return clock is a system
  // nobody has asked for and half a system is worse than none"* — and it is the
  // same argument `ItemDef.use` makes about a menu option that does nothing:
  // **a dead option is worse than a missing one, because it teaches the player
  // that the menu lies.** At $1,600 against a purse that reaches ~$623 a season
  // it would also be a lie he could not even reach to be told.
  //
  // WHAT THE SHOP SELLS INSTEAD IS EVERY PART OF A BED A PERSON CAN CARRY HOME
  // — the frame, the pillow, the sheets, the blanket — and those are real items
  // that really arrive in the bag. The mattresses are priced the way a showroom
  // prices them, on the card at the foot of each bed and on this list, because a
  // price you can read and cannot pay is a shop; a button that takes your money
  // and does nothing is a bug.
  //
  // IF IT IS EVER WANTED, most of it is already built: the prices are one table,
  // the cards read from it, and the facade already advertises FREE DELIVERY. The
  // piece that does not exist is a flat that can receive furniture, and that is
  // a real piece and not a line of code.
  {
    const LIST_W = 2.6, LIST_H = 1.05;
    const px = Math.round(LIST_W * 220), py = Math.round(LIST_H * 220);
    const listT = declareSurface(pixTex(px, py, (g) => {
      g.fillStyle = ALU; g.fillRect(0, 0, px, py);                     // the tin frame
      g.fillStyle = CREAM; g.fillRect(6, 6, px - 12, py - 12);
      g.fillStyle = RUST; g.fillRect(6, 6, px - 12, Math.round(py * 0.24));
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.font = `bold ${Math.round(py * 0.15)}px monospace`;
      g.fillStyle = CREAM; g.fillText('BEDS', px / 2, 6 + py * 0.12);
      const rows = BEDS.length;
      const top = 6 + py * 0.24, rowH = (py - 12 - py * 0.24) / (rows + 1);
      g.font = `bold ${Math.round(rowH * 0.42)}px monospace`;
      BEDS.forEach((b, i) => {
        const y = top + rowH * (i + 0.5);
        g.textAlign = 'left'; g.fillStyle = '#3a2c22';
        g.fillText(b.size, 22, y);
        // `$800`, not `800.00` — this is a hand-lettered showroom card, and
        // `boardPrice` is the convention for a PRINTED board (the counter's, ten
        // feet away, uses it). The cards on the beds write the same way, off the
        // same table, so the two never quote the number differently.
        g.textAlign = 'right'; g.fillStyle = SALE_INK;
        g.fillText(`$${b.price}`, px - 22, y);
      });
      // the line the facade already promises on the pavement
      g.textAlign = 'center'; g.fillStyle = BLUE;
      g.font = `bold ${Math.round(rowH * 0.36)}px monospace`;
      g.fillText('FREE DELIVERY · NO PAYMENTS TIL 98', px / 2, top + rowH * (rows + 0.45));
      dither(g, px, py, Math.round((px * py) / 1200));
    }), 'sign');
    // On the west wall over the pair, facing +x into the room. 2.10 m up, which
    // is clear of the taller divan's 1.29 m headboard by 0.28 m at its own top.
    room.sign(listT, LIST_W, LIST_H, -hw + 0.06, 2.15, -0.20, Math.PI / 2);
  }

  // ── the linen run, up the east wall ──
  //
  // Where the four things you CAN take home actually live, so the board over the
  // counter is describing stock you can see. Four shelves of folded blankets,
  // bagged sheet sets and pillows in the shop's own three colours.
  {
    const carc = new THREE.Mesh(new THREE.BoxGeometry(LIN_D, 1.80, LIN_L), m('#c9b9a0'));
    put(carc, LIN_X, 0.90, 0);
    const SHELF = [0.35, 0.75, 1.15, 1.55];
    SHELF.forEach((y, s) => {
      put(new THREE.Mesh(new THREE.BoxGeometry(LIN_D + 0.06, 0.05, LIN_L), m(ALU)), LIN_X - 0.03, y, 0);
      // eight per shelf at a 0.50 m pitch, which is a folded blanket's own width
      for (let i = 0; i < 8; i++) {
        const z = -LIN_L / 2 + 0.25 + i * 0.50;
        const c = (i + s) % 3 === 0 ? BLUE : (i + s) % 3 === 1 ? PILLOW_W : CREAM;
        put(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.42), m(c)), LIN_X - 0.04, y + 0.14, z);
        put(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.43), m('#b3a68e')), LIN_X - 0.04, y + 0.04, z);
      }
    });
    const linT = declareSurface(pixTex(96, 14, (g) => {
      g.fillStyle = RUST; g.fillRect(0, 0, 96, 14);
      g.fillStyle = 'rgba(239,230,210,0.30)'; g.fillRect(0, 1, 96, 1); g.fillRect(0, 12, 96, 1);
      g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = CREAM; g.fillText('PILLOWS · LINEN', 48, 7);
    }), 'sign');
    room.sign(linT, 2.4, 0.30, hw - 0.06, 2.05, 0, -Math.PI / 2);
    solid(LIN_X, 0, LIN_D, LIN_L);
  }

  // ── the counter ──
  //
  // Rust front with a cream keyline and an aluminium kick, cream laminate top —
  // the shopfront's own three materials in the order it uses them. It runs to
  // the east wall so the staff strip is closed at one end without a second run
  // of anything, and it is 5.3 m of it because you sign a delivery docket on a
  // mattress counter rather than just paying at one.
  const lamT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#ded5be'; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(120,105,85,0.18)';
    for (let i = 0; i < 60; i++) g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 16), 1, 1);
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(0, 0, 64, 2);
  }), 'detail');
  const lam = lamT.clone();
  lam.wrapS = lam.wrapT = THREE.RepeatWrapping;
  lam.repeat.set(CTR_W / 5.0, CTR_D / 1.25);
  lam.needsUpdate = true;
  const frontT = declareSurface(pixTex(64, 26, (g) => {
    g.fillStyle = RUST; g.fillRect(0, 0, 64, 26);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 26);        // the panel joints
    g.fillStyle = 'rgba(239,230,210,0.55)'; g.fillRect(0, 3, 64, 1); // the cream keyline
    g.fillStyle = ALU; g.fillRect(0, 23, 64, 3);                     // the kick
    dither(g, 64, 26, 40);
  }), 'detail');
  const fM = ctx.flat(frontT), tM = ctx.flat(lam);
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 1.02, CTR_D), [fM, fM, tM, fM, fM, fM]),
    CTR_CX, 0.51, CTR_Z);
  solid(CTR_CX, CTR_Z, CTR_W, CTR_D);

  // the till, the docket book beside it, and a cut-away mattress corner stood on
  // the end — the sample every bed shop keeps on the counter to show you the
  // springs it is charging you for
  put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.34), m('#3a3a3e')), CTR_CX + 1.6, 1.16, CTR_Z);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.20), m('#6a6a6c'));
  keys.rotation.x = -Math.PI / 3;
  put(keys, CTR_CX + 1.6, 1.30, CTR_Z + 0.10);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.22), m('#fdfaf0')), CTR_CX + 0.7, 1.04, CTR_Z + 0.06);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.20, 0.30), m(TICK_BIG)), CTR_X0 + 0.52, 1.12, CTR_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.31), m('#c8bda6')), CTR_X0 + 0.52, 1.16, CTR_Z);

  // ══ WHAT YOU CAN ACTUALLY TAKE HOME ════════════════════════════════════════
  //
  // Four lines, all of them real items that really arrive in the bag — see the
  // long note above the bed price list for why the mattresses are not among
  // them. Prices are the world's ×4 scale off real 1997 money:
  //
  //     folding metal frame   $40 in 1997  ->  $160   (and it is `bulky`)
  //     sheet set              $25         ->  $100
  //     wool blanket           $18         ->   $72   (`bulky`)
  //     pillow                 $12         ->   $48
  //
  // AGAINST A PURSE THAT REACHES ~$623 A SEASON this is the shop's whole
  // reachable half, and it is deliberately shaped that way: a pillow is under
  // three days of rent, a frame is nine, and the bed it goes under is forty-five.
  // You can furnish the floor of a room here; you cannot yet furnish the room.
  const STOCK: ShopColumn[] = [
    { head: 'TAKE TODAY', lines: [
      { id: 'FRAME', name: 'BED FRAME', price: 160.00 },
      { id: 'SHEETS', name: 'SHEET SET', price: 100.00 },
      { id: 'BLANKET', name: 'BLANKET', price: 72.00 },
      { id: 'PILLOW', name: 'PILLOW', price: 48.00 },
    ] },
  ];
  // The facade's own colours, used the way the facade uses them: a rust board
  // with the cream keyline reversed out of it, and the sale red for the figures.
  const STOCK_LOOK: BoardLook = {
    panel: CREAM, frame: ALU, band: RUST, bandInk: '#f6efdb',
    ink: '#3a2c22', priceInk: SALE_INK,
    hover: 'rgba(184,100,44,0.18)', flash: 'rgba(160,40,24,0.34)',
  };
  // 2.6 x 1.1 m at 150 texels per metre, over the counter on the back wall. Its
  // bottom edge is 1.75 m, which clears the man standing under it.
  const BD_W = 2.6, BD_H = 1.1, BD_Y = 2.30;
  const BD_PX = Math.round(BD_W * 150), BD_PY = Math.round(BD_H * 150);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H),
    ctx.flat(boardTexture(BD_PX, BD_PY, STOCK, STOCK_LOOK)));
  put(board, CTR_CX, BD_Y, -hd + 0.09);
  put(new THREE.Mesh(new THREE.BoxGeometry(BD_W + 0.10, BD_H + 0.10, 0.06), m(ALU)),
    CTR_CX, BD_Y, -hd + 0.05);

  // ── the man behind the counter ──
  //
  // Facing DERIVED from the counter, never typed: `ct/citizens.ts` takes
  // `atan2(vx, vz)` with 0 = +z, and four rooms have shipped a keeper staring at
  // their own back wall by copying `Math.PI` from a neighbour (GOTCHAS §23).
  //
  // 0.68 m of staff strip behind him — the thrift store put its keeper 0.55 m
  // back and lost her INSIDE the plaster. Shirt and tie, because a mattress
  // salesman in 1997 is on commission and dressed for it.
  const KEEP_Z = CTR_Z - 0.62;
  const KEEP_X = CTR_CX + 0.30;
  const clerk = room.person({
    jacket: '#e8e2d0', pants: '#3a3630', skin: '#c9946a', hair: '#5a4432',
    fit: 'plain', accent: '#b8642c', cut: 'short', build: 1,
  }, KEEP_X, KEEP_Z, { facing: Math.atan2(0, CTR_Z - KEEP_Z), h: 1.00, w: 1.00 });

  // ── the three things taped inside the glass, from this side ──
  //
  // `mattressFront` tapes a hand-lettered MATTRESS SALE banner across the top
  // third of the window and two smaller bills either side of it — and it is
  // explicit that they live in the TOP third and the stock in the bottom two,
  // *"and they do not overlap at any width"*. Same discipline in here: the
  // banner sits at 2.20 m and the bills at 2.72 m, both above the 1.29 m
  // headboards below them and both inside the glass, which runs to 2.88 m.
  //
  // They hang just inside the glazing plane rather than on the plaster, because
  // that is where they are: `room.sign` builds them back to back, so the sheet
  // reads from the pavement as well as from the shop (GOTCHAS §10 handled).
  const GLASS_Z = hd + 0.045;
  const bannerT = declareSurface(pixTex(128, 20, (g) => {
    g.fillStyle = '#f6efdb'; g.fillRect(0, 0, 128, 20);
    g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = SALE_INK; g.fillText('MATTRESS SALE', 64, 9);
    g.fillStyle = BLUE; g.fillRect(10, 16, 108, 2);
    g.fillStyle = 'rgba(0,0,0,0.16)';                                  // the tape at the corners
    for (const tx of [2, 118]) for (const ty of [1, 15]) g.fillRect(tx, ty, 8, 4);
  }), 'sign');
  room.sign(bannerT, 4.20, 0.62, -2.27, 2.20, GLASS_Z, Math.PI);
  const billT = (t: string) => declareSurface(pixTex(80, 16, (g) => {
    g.fillStyle = '#fdf6e2'; g.fillRect(0, 0, 80, 16);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 14, 80, 2);
    g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = BLUE; g.fillText(t, 40, 7);
  }), 'sign');
  room.sign(billT("NO PAYMENTS TIL '98"), 1.55, 0.30, -4.60, 2.72, GLASS_Z, Math.PI);
  room.sign(billT('FREE DELIVERY'), 1.55, 0.30, -0.30, 2.72, GLASS_Z, Math.PI);

  // ══ AND YOU BUY FROM HIM, OFF THE BOARD ════════════════════════════════════
  //
  // The customer stands on the counter's own centreline, 1.05 m off its front
  // face — inside the 2.35 m lane laid out above, with 1.3 m of it still behind
  // him. He is the aim and the outline; the board over his head is the view.
  shopCounter(ctx, {
    id: 'ct-shop-sleep',
    columns: STOCK, look: STOCK_LOOK,
    w: BD_PX, h: BD_PY,
    mesh: () => board,
    standoff: boardStandoff({ wM: BD_W, hM: BD_H, fov: 55, riseM: BD_Y - 1.75 }),
    fov: 55,
    stand: { x: room.wx(CTR_CX), z: room.wz(CTR_Z + CTR_D / 2 + 1.05) },
    keeper: { x: clerk.mesh.position.x, z: clerk.mesh.position.z, obj: clerk.mesh },
    who: 'the salesman',
    ok: room.inside,
  });
}

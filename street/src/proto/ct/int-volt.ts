import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import './goods';   // for the side effect: it is what declares the stock

// VOLT VILLAGE, inside.
//
// *"build out the remaining stores that atrent built yet pls"*   (2026-08-06)
//
// The fourteenth interior, and the second built around a shop counter rather
// than having one fitted afterwards. It follows `ct/int-video.ts` in shape and
// in method; where it differs it says why.
//
// ══ THE ROOM IS READ OFF THE OUTSIDE, AND THE OUTSIDE IS SPECIFIC ══════════
//
// `electroFront` in `ct/tex-world.ts` paints this shopfront and it is emphatic
// about one thing:
//
//   *"THE WALL OF TELEVISIONS IS THE WHOLE FRONT. Everything else here is in
//    service of it. A 1997 electronics discounter is recognised from the far
//    pavement by one thing: a grid of lit screens, all showing the SAME
//    picture, stacked three high behind plate glass."*
//
// So this room is that wall, seen from the other side: thirty sets in three
// tiers, and **one material shared by every screen in the shop**, which is what
// makes "all showing the same thing" a fact of the geometry rather than a thing
// somebody has to remember. Under it are the two other things the front draws —
// the hi-fi separates stacked at one end, and the price card that reads
// `TV · VCR · CAMCORDER`, which is the board's stock list in three words.
//
// EVERY COLOUR HERE IS THE PAINTER'S OWN CONSTANT, lifted rather than re-picked
// (the video hut's rule, and the reason a room and its facade look like one
// building). GRAPHITE is also `col` in `ct/street.ts` — the projecting joinery —
// so the fascia, the mouldings and the counter front are one value.
//
// (`electroFront`'s sixth constant, `ROOM = '#1a1c20'`, is the dark it glazes
// this shop against. It is not repeated as a value — it is the argument for the
// palette below, and that is where it is spent.)
const GRAPHITE = '#2a2d33', RED = '#c8322a', SILVER = '#9aa0a6';
const SCREEN = '#5f8fa8';

// ══ THE DOOR ═══════════════════════════════════════════════════════════════
//
// An ORDINARY FRONTAGE, so the plain `DoorDecl` form is all this needs — VOLT
// VILLAGE is on the main street's west side and its facade is on the roster's
// z axis, which is exactly the case `at` was written for. (The video hut needed
// the `face` form only because it fronts the side street, where a position
// along z means nothing.)
//
// `ct/street.ts` places it absolutely: `placeBld(-1, -98, { w: 12 })`, and
// `placeBld` takes its argument as the HIGH-z edge — `cz = z - b.w / 2` — so the
// frontage centre is -104 and the side is -1.
//
// ── WHY `at` IS 1.427 AND NOT A NUMBER I LIKED ────────────────────────────
//
// It is where the painter is ALREADY drawing the door, converted into the
// room's frame, so declaring it moves nothing on the street. `layoutOf` gives
// this front (BANDS.electro: ox 0.32, gi 0.20, dw 1.05) a glazed run of
// 0.52 … 11.48 m and puts the door at `doorFrac('VOLT VILLAGE')` = 0.66 along
// it, i.e. 7.586 m from the facade's left edge. The kit's own conversion —
// metres along the painter's u, scaled into the room, measured from the room's
// left edge (`int-video.ts`, checked there against the diner) — is
//
//     at = alongU * (W / frontageM) - W / 2
//        = 7.586 * (10.8 / 12) - 5.4
//        = 1.427
//
// The whole point of declaring it is that the room is now the AUTHORITY: move
// this number and the facade's door follows it, which is the one direction
// `ct/doors.ts` says it must go.
export const DOOR: DoorDecl = {
  building: 'VOLT VILLAGE', w: 12, cz: -104, side: -1, at: 1.427,
  // What `electroFront` actually draws in that opening: a silver-framed
  // half-glazed leaf with a transom bar and a kick plate. 1.05 is `BANDS.electro`'s
  // own `dw`, so the opening you walk through and the one painted on the street
  // are one number rather than two that agree today.
  leaf: {
    clearW: 1.05, h: 2.4, leaves: 1,
    frame: { colour: 0x9aa0a6, material: 'aluminium' }, glazing: 'full',
  },
};

export function buildVolt(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'volt',
    label: 'into VOLT VILLAGE',
    // W is the kit's rule off the frontage: roomWidthFor(12) = 10.8.
    // 9.6 DEEP, and the depth is set by the WALKING. The lane arithmetic is
    // written out at the floor plan below; at 9.6 every gap in the room is
    // 2.0 m or better, and at 9.0 the aisle past the hi-fi run was 1.85.
    d: 9.6,
    // 3.2, taller than the video hut's 3.0. A showroom has height — the glass
    // outside runs to 2.82 m above the pavement (see the window below) and a
    // 2.9 m ceiling would have the head of the glazing in the coving.
    h: 3.2,
    // ── A DARK ROOM, ON PURPOSE, AND THE FACADE SAYS SO ────────────────────
    //
    // `electroFront` glazes this shop against `ROOM = '#1a1c20'` and gives it no
    // ceiling wash at all, where `mattressFront` next door paints a bright
    // ceiling and a pale floor. That is not an oversight in the painter, it is
    // the type: *"in a shop like this the merchandise IS the lighting."* So the
    // shell is graphite and blue-grey and the only bright thing in the room is
    // thirty lit screens.
    palette: { floor: 0x3a3d43, wall: 0x5a606a, ceil: 0x484c53, trim: 0x2a2d33 },
    // Bare battens screwed to the soffit — a unit that was cheaply fitted out
    // and never finished, which is what a 1997 discounter is. Cool, and only
    // four of them across 104 m2: the wall is meant to out-glow the ceiling.
    light: { kind: 'strip', tint: 0xdce6ee, count: 4 },
    frontage: { name: 'VOLT VILLAGE', w: 12, cz: -104, side: -1 },
    // The door, its width, the [E] spot on the pavement and the way back out
    // all derive from DOOR above — one authoring, not two. No `width`: the
    // LEAF is the authority, so the room's opening is the facade's 1.05 m.
    door: { r: 1.05, at: DOOR.at },
    // ── PLATE GLASS, TO THE FLOOR, BECAUSE THAT IS WHAT IS PAINTED ─────────
    //
    // The kit's derived default is a 1.5 m window on a 0.95 m sill, which is a
    // SHOP window and this is a SHOWROOM. `BANDS.electro` took the mattress
    // row's shallow sill gap (0.44 against the default 0.57) for exactly this
    // reason — *"TVs are stacked from low down; 0.57 of stallriser cuts the
    // bottom row off at the knees"* — and the room owes it the same glass.
    //
    // Both numbers are the facade's own, arithmetic shown so they can be
    // re-derived rather than trusted (SHOP_BAND_H 4.2; fy 0.10, fh 0.92,
    // og 0.16, gi 0.20, sg 0.44):
    //
    //     opening top     oy = 0.10 + 0.92 + 0.16          = 1.18 m down
    //     glazing height  gh = (4.2 - 1.18 - 0.05) - 0.44  = 2.53 m
    //     stallriser      4.2 - (1.18 + 0.20 + 2.53) - 0.05 = 0.24 m
    //     glass runs      0.29 … 2.82 m above the pavement
    //
    // And the SPAN is the glazed run west of the door, through the same
    // conversion `at` used: 0.52 m and 11.48 m along u land at local -4.932 and
    // +4.932, the door and its 0.12 m margin take 0.782 … 2.072, and the bigger
    // of the two remaining runs is the west one at 5.714 m. That is the same
    // arithmetic `buildRoom` does when a room stays silent; it is written out
    // here only because overriding the height means overriding all four.
    window: { at: -2.075, w: 5.714, h: 2.53, sill: 0.29 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const graphM = new THREE.MeshBasicMaterial({ color: 0x2a2d33 });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x17191d });
  const silvM = new THREE.MeshBasicMaterial({ color: 0x9aa0a6 });
  const redM = new THREE.MeshBasicMaterial({ color: 0xc8322a });

  // ── the floor: carpet tile, which is what a discounter puts down ──
  //
  // 0.5 m squares in two shades of the same grey, laid quarter-turned so the
  // pile catches differently — the cheapest commercial floor of the period and
  // the one that tells this room from the video hut's cord and the bodega's
  // vinyl before you have read a sign.
  const carpetT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#3a3d43'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#42454c';
    g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);        // the quarter turn
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(15, 0, 1, 32); g.fillRect(0, 15, 32, 1);          // the tile joints
    dither(g, 32, 32, 52);
  }), 'ground');
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping;
  // ⚠ ONE TILE PAIR PER METRE, AND THE NUMBER IS THE OBJECT. The canvas holds a
  // 2 x 2 block of 0.5 m tiles, so it covers 1.0 m of floor and the repeat is
  // the room's metres (GOTCHAS §5). Sized off the mesh instead, a 10.8 m room
  // would have laid 5 m carpet tiles.
  carpetT.repeat.set(Math.round(room.W), Math.round(room.D));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(carpetT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ══ THE FLOOR PLAN, AND THE LANE ARITHMETIC ════════════════════════════════
  //
  // The 2 m lane is sacred indoors. Room is 10.8 x 9.6, so hw = 5.4, hd = 4.8,
  // and the door lands you at local x +1.43 on the front wall.
  //
  //   z  4.80   the front wall: the door at +1.43, plate glass -4.93 … +0.78
  //             ── 2.40 m ──                       the way in
  //   z  2.40   the hi-fi run's south end          (west wall, x -5.40 … -4.78)
  //   z -0.30   the camcorder case, south face     (x -1.60 … +0.40)
  //   z -0.90   …and its north face
  //   z -2.00   the hi-fi run's north end
  //             ── 2.25 m ──                       the aisle across the back
  //   z -3.15   the counter's front face           (x +1.00 … +5.40)
  //   z -3.85   its back face
  //             ── 0.95 m ──                       the staff strip
  //   z -4.37   the TV wall's front face           (x -5.40 … +0.60)
  //   z -4.80   the back wall
  //
  // Across, x from -5.4 to 5.4:
  //
  //   the hi-fi run stands against the west wall     -5.40 … -4.78
  //   the camcorder case is an island               -1.60 …  0.40
  //   the TV wall runs the back to the counter      -5.40 …  0.60
  //   the counter runs from there to the east wall   1.00 …  5.40
  //
  //   west aisle    -4.78 → -1.60   3.18 m
  //   east floor     0.40 →  5.40   5.00 m
  //
  // ⚠ THE COUNTER IS IN THE HALF OF THE ROOM YOU WALK INTO. That is the video
  // hut's second layout, taken as read rather than rediscovered: it put its
  // racks between the door and the till first time and *"you walked in with a
  // rack of tape one metre from your face and the till out of sight behind
  // it"*, which is the pawn shop's own complaint wearing a different hat. The
  // door here is at +1.43 and the counter runs +1.00 … +5.40, so you come in
  // facing straight down its length with nothing between you and it — and the
  // wall of televisions fills the whole view to your left, which is the one
  // thing this shop is for.
  //
  // Nothing is within 4.2 m of the doorway.
  const TVW_X0 = -hw, TVW_X1 = 0.60;
  const TVW_CX = (TVW_X0 + TVW_X1) / 2, TVW_W = TVW_X1 - TVW_X0;
  const CTR_X0 = 1.00, CTR_X1 = hw, CTR_D = 0.70, CTR_Z = -3.50;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;
  const HIFI_X = -hw + 0.31, HIFI_Z0 = -2.00, HIFI_Z1 = 2.40;
  const CASE_CX = -0.60, CASE_CZ = -0.60, CASE_W = 2.00, CASE_D = 0.60;

  // ══ THE WALL OF TELEVISIONS ════════════════════════════════════════════════
  //
  // ── ONE MATERIAL. THIRTY SETS. ────────────────────────────────────────────
  //
  // *"a grid of lit screens, all showing the SAME picture"* is the whole tell of
  // this shop type, and the cheapest possible way to be sure of it is to build
  // exactly one screen material and hand it to every set. There is no per-set
  // variation to accidentally introduce, and if the demo tape ever changes it
  // changes on all thirty at once — which is what a shop with one VCR feeding a
  // distribution amp actually looked like.
  //
  // The picture is `electroFront`'s own, at a size you can stand in front of:
  // a pale band across the top third, the blue-grey of a lit tube under it, a
  // bright block in the middle and the red caption bar the facade paints along
  // the bottom. Scan lines, because a 1997 set seen from two metres has them.
  const screenM = ctx.flat(declareSurface(pixTex(40, 30, (g) => {
    g.fillStyle = SCREEN; g.fillRect(0, 0, 40, 30);
    g.fillStyle = 'rgba(240,250,255,0.55)'; g.fillRect(0, 0, 40, 10);
    g.fillStyle = 'rgba(255,255,255,0.80)'; g.fillRect(0, 0, 40, 1);
    g.fillStyle = '#e8f2f8'; g.fillRect(13, 11, 14, 9);            // the bright block
    g.fillStyle = '#2a3d5a'; g.fillRect(16, 13, 8, 4);
    g.fillStyle = 'rgba(200,60,40,0.55)'; g.fillRect(0, 23, 40, 7);  // the caption bar
    g.font = 'bold 5px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f4edd8'; g.fillText('DEMO', 20, 26);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 1; y < 30; y += 2) g.fillRect(0, y, 40, 1);        // the scan lines
    dither(g, 40, 30, 26);
  }), 'sign'));

  {
    // ⚠ THE SET IS 0.50 x 0.44 AND THAT IS THE OBJECT, NOT A TASTE. A 13"
    // portable is 40 cm of cabinet round a 33 cm tube, and `ct/goods.ts` builds
    // the one you can BUY at 0.40 x 0.34 — these are the shop's slightly bigger
    // 14" floor stock, and both are within a hand's width of the real thing. A
    // grid sized off the 6 m run instead of off a television would have given
    // ten 0.60 m sets, which from the door reads as a wall of microwaves.
    const SET_W = 0.50, SET_H = 0.44, SET_D = 0.40, PITCH = 0.60;
    const COLS = Math.floor(TVW_W / PITCH);          // 10 across a 6.0 m run
    const CARC_D = 0.40, CARC_H = 1.90;
    const CARC_Z = -hd + CARC_D / 2;                 // hard against the back wall
    // the carcass: one dark run of shelving, not thirty separate stands
    put(new THREE.Mesh(new THREE.BoxGeometry(TVW_W, CARC_H, CARC_D), graphM),
      TVW_CX, CARC_H / 2, CARC_Z);
    const SHELF = [0.28, 0.86, 1.44];
    for (const y of SHELF) {
      // proud of the carcass, so the run has three visible edges rather than
      // being one flat slab with pictures stuck to it
      put(new THREE.Mesh(new THREE.BoxGeometry(TVW_W + 0.04, 0.05, CARC_D + 0.10), silvM),
        TVW_CX, y, CARC_Z + 0.05);
      for (let c = 0; c < COLS; c++) {
        const x = TVW_X0 + PITCH / 2 + c * PITCH;
        const sy = y + 0.025 + SET_H / 2;
        const sz = -hd + 0.02 + SET_D / 2;
        put(new THREE.Mesh(new THREE.BoxGeometry(SET_W, SET_H, SET_D), graphM), x, sy, sz);
        const face = sz + SET_D / 2;
        put(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), darkM), x - 0.02, sy, face + 0.006);
        put(new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), screenM), x - 0.02, sy, face + 0.010);
      }
    }
    // ── the header over it, which is the one thing the shop says to your face ──
    const hdrT = declareSurface(pixTex(96, 12, (g) => {
      g.fillStyle = GRAPHITE; g.fillRect(0, 0, 96, 12);
      g.fillStyle = 'rgba(90,190,220,0.28)'; g.fillRect(0, 1, 96, 1); g.fillRect(0, 10, 96, 1);
      g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = RED; g.fillText('EVERY SET ON DEMO', 48, 6);
    }), 'sign');
    room.sign(hdrT, 4.2, 0.30, TVW_CX, 2.12, -hd + 0.10);
    // ONE collider for the run, at its real reach: the carcass stops at -4.40
    // but the sets stand 0.02 proud of the wall and are 0.40 deep, so the thing
    // your shoulder meets is at -4.37. A collider drawn to the carcass would let
    // you walk through ten televisions.
    solid(TVW_CX, -hd + 0.215, TVW_W, 0.43);
  }

  // ── the hi-fi separates, up the west wall ──
  //
  // The facade draws a tower of four separates with one lit dot each, at one
  // end of the glass and UNDER the screen wall — *"they say 'and the other two
  // things this shop sells' and they are not allowed to be more than that."*
  // Same restraint inside: three racks and two floor-standers along one wall,
  // no more, because the televisions are the room.
  {
    const RK_D = 0.60, RK_W = 0.64, RK_H = 1.10;
    for (const z of [-1.20, 0.20, 1.60]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(RK_D, 0.06, RK_W), darkM), HIFI_X, 0.03, z);
      put(new THREE.Mesh(new THREE.BoxGeometry(RK_D, RK_H, RK_W), graphM), HIFI_X, 0.06 + RK_H / 2, z);
      // FOUR SEPARATES, at 0.20 m each — an amplifier, a tuner, a twin cassette
      // deck and a CD player are all 2U-ish boxes and that is why a stack of
      // them reads as a stack. The faces are planes on the +x side, which is the
      // only side anybody in this room can see.
      for (let i = 0; i < 4; i++) {
        const y = 0.30 + i * 0.20;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(RK_W - 0.08, 0.16), silvM);
        f.rotation.y = Math.PI / 2;                              // faces +x, into the room
        put(f, HIFI_X + RK_D / 2 + 0.012, y, z);
        const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.04),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0x5abedc : 0xe67828 }));
        dot.rotation.y = Math.PI / 2;
        put(dot, HIFI_X + RK_D / 2 + 0.018, y, z + RK_W / 2 - 0.10);
      }
    }
    // the floor-standers that close the run at each end
    for (const z of [-1.78, 2.18]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.90, 0.44), graphM), -hw + 0.17, 0.45, z);
      const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.62), darkM);
      grille.rotation.y = Math.PI / 2;
      put(grille, -hw + 0.35, 0.50, z);
    }
    solid(HIFI_X, (HIFI_Z0 + HIFI_Z1) / 2, 0.62, HIFI_Z1 - HIFI_Z0);
  }

  // ── THE CAMCORDER CASE, which is the third word on the facade's price card ──
  //
  // *"camcorders in a case"* — and a case is what makes a camcorder read as the
  // expensive thing in the room. A graphite plinth with a glazed top box, four
  // of them lying on a pale riser under the glass, silver rails round it. It is
  // the only fixture on the open floor, which is why it is an ISLAND: you walk
  // round it on the way to everything else.
  {
    const BASE_H = 0.66, GLASS_H = 0.30;
    put(new THREE.Mesh(new THREE.BoxGeometry(CASE_W, BASE_H, CASE_D), graphM),
      CASE_CX, BASE_H / 2, CASE_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(CASE_W + 0.04, 0.04, CASE_D + 0.04), silvM),
      CASE_CX, BASE_H + 0.02, CASE_CZ);
    // the riser and the stock on it, INSIDE the glass
    put(new THREE.Mesh(new THREE.BoxGeometry(CASE_W - 0.16, 0.05, CASE_D - 0.14),
      new THREE.MeshBasicMaterial({ color: 0x8a8f97 })), CASE_CX, BASE_H + 0.065, CASE_CZ);
    for (let i = 0; i < 4; i++) {
      const x = CASE_CX - 0.66 + i * 0.44;
      put(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.13),
        new THREE.MeshBasicMaterial({ color: 0x3a3e46 })), x, BASE_H + 0.15, CASE_CZ);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.14), darkM), x - 0.14, BASE_H + 0.15, CASE_CZ);
    }
    // the glass, and it is GLASS: transparent, not a grey slab. A display case
    // you cannot see into is a box.
    const glassM = new THREE.MeshBasicMaterial({
      color: 0xaebcc4, transparent: true, opacity: 0.26, side: THREE.DoubleSide,
    });
    put(new THREE.Mesh(new THREE.BoxGeometry(CASE_W - 0.06, GLASS_H, CASE_D - 0.06), glassM),
      CASE_CX, BASE_H + 0.04 + GLASS_H / 2, CASE_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(CASE_W, 0.04, CASE_D), silvM),
      CASE_CX, BASE_H + 0.04 + GLASS_H, CASE_CZ);
    solid(CASE_CX, CASE_CZ, CASE_W, CASE_D);
  }

  // ── the counter ──
  //
  // Graphite front with the fascia's red keyline and a silver kick, and a
  // brushed top — the shopfront's own three materials, in the order it uses
  // them. It runs to the east wall so the staff strip is closed at one end
  // without a second run of anything.
  const topT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#8f949b'; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let y = 0; y < 16; y += 3) g.fillRect(0, y, 64, 1);        // the brushed grain
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 14, 64, 2);
  }), 'detail');
  const topTex = topT.clone();
  topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping;
  topTex.repeat.set(CTR_W / 2.0, CTR_D / 0.7);
  topTex.needsUpdate = true;
  const frontT = declareSurface(pixTex(64, 26, (g) => {
    g.fillStyle = GRAPHITE; g.fillRect(0, 0, 64, 26);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 26);       // the panel joints
    g.fillStyle = RED; g.fillRect(0, 3, 64, 1);                     // the keyline
    g.fillStyle = SILVER; g.fillRect(0, 23, 64, 3);                 // the kick
    dither(g, 64, 26, 40);
  }), 'detail');
  const fM = ctx.flat(frontT), tM = ctx.flat(topTex);
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 1.02, CTR_D), [fM, fM, tM, fM, fM, fM]),
    CTR_CX, 0.51, CTR_Z);
  solid(CTR_CX, CTR_Z, CTR_W, CTR_D);

  // the till, and the roll of receipt paper beside it
  put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x3a3a3e })), CTR_CX + 1.30, 1.16, CTR_Z);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.20),
    new THREE.MeshBasicMaterial({ color: 0x6a6a6c }));
  keys.rotation.x = -Math.PI / 3;
  put(keys, CTR_CX + 1.30, 1.30, CTR_Z + 0.10);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xe8e2d0 })), CTR_CX + 0.70, 1.07, CTR_Z + 0.04);
  // a boxed VCR waiting to go out, stood on the end of the counter
  put(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.20, 0.42),
    new THREE.MeshBasicMaterial({ color: 0xa8977c })), CTR_X0 + 0.44, 1.12, CTR_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.004), redM),
    CTR_X0 + 0.44, 1.14, CTR_Z + 0.212);

  // ══ THE PRICE BOARD, AND EVERY LINE OF IT ANSWERS TO SOMETHING ═════════════
  //
  // ── THE FACADE NAMES THE STOCK ────────────────────────────────────────────
  //
  // `electroFront` tapes ONE price card inside the glass and it reads
  // `TV · VCR · CAMCORDER`. Those three are the VIDEO column, in that order,
  // and the shop cannot quietly stop selling one of them without the street
  // going on advertising it.
  //
  // ── AND THE PRICES ARE THE WORLD'S ×4 SCALE, MEASURED AGAINST RENT ────────
  //
  // *"everything needs to be more expensive. use 500 bucks a mo rent as a
  //  baseline."* Rent is the ruler ($500 a season, $17.86 a day) and everything
  //  else in the world is real 1997 money times four. So:
  //
  //     13" colour portable   $130 in 1997   ->  $520
  //     four-head VCR          $150          ->  $600
  //     VHS-C camcorder        $480          ->  $1920
  //     new transistor radio    $14          ->  $56
  //     3-pack of blank T-120    $1.75       ->  $7
  //     four D cells             $3          ->  $12
  //
  // ── WHAT THAT MEANS, WHICH IS THE PART WORTH SAYING OUT LOUD ──────────────
  //
  // A PURSE THAT REACHES ~$623 A SEASON CANNOT CASUALLY BUY ANYTHING IN THE TOP
  // HALF OF THIS BOARD, and that is the intended reading rather than an
  // accident of the multiplier. A television is 29 days of rent. The camcorder
  // is three seasons of it and is not a purchase at all this year — it is the
  // thing under glass that you look at, which is precisely why the shop keeps
  // it in a case and why the case is the one fixture on the open floor. The
  // small end of the board is where a player actually shops: batteries, tapes
  // and a radio are all inside a day's rent.
  //
  // Nothing here invents an income to make the big lines reachable. That is a
  // decision for the user (`ct/shop.ts` says the same at the foot of the price
  // note), and a shop is the wrong place to make it on his behalf.
  //
  // ── AND WHERE THE SAME OBJECT IS SOLD TWICE, THE SPREAD IS DELIBERATE ─────
  //
  // Two lines here are already sold elsewhere and both are cheaper HERE, which
  // is the relationship the ×4 note asks to be preserved rather than a
  // coincidence:
  //
  //     BLANKS   $7 here against the VIDEO HUT's $9 — a rental shop marks up
  //              the tape you buy at the till on your way out; a discounter two
  //              streets away is what it is discounting against.
  //     RADIO    $56 here against the PAWN shop's $28 — exactly double, because
  //              one of them is new in a box and the other has somebody else's
  //              thumbprints on the dial.
  const STOCK: ShopColumn[] = [
    { head: 'VIDEO', lines: [
      { id: 'TV', name: '13" COLOUR', price: 520.00 },
      { id: 'VCR', name: '4-HEAD VCR', price: 600.00 },
      { id: 'CAMCORDER', name: 'CAMCORDER', price: 1920.00 },
      { id: 'BLANKS', name: 'BLANKS 3PK', price: 7.00 },
    ] },
    { head: 'SOUND', lines: [
      { id: 'RADIO', name: 'RADIO', price: 56.00 },
      { id: 'BATTERIES', name: 'D CELL 4PK', price: 12.00 },
    ] },
  ];
  // The fascia's own three colours, used the way the fascia uses them: a
  // graphite panel, red lettering, and the blue-white of the tube behind the
  // plexi for the heading band.
  const STOCK_LOOK: BoardLook = {
    panel: GRAPHITE, frame: SILVER, band: RED, bandInk: '#1b1d21',
    ink: '#e4ecf2', priceInk: '#ff8a7a',
    hover: 'rgba(90,190,220,0.20)', flash: 'rgba(228,236,242,0.55)',
  };
  // 3.8 x 1.0 m at 150 texels per metre, over the counter on the back wall. Its
  // bottom edge is 1.95 m — clear of the clerk's head and clear in x of the TV
  // wall, which stops at +0.60 and reaches 1.90 m.
  const BD_W = 3.8, BD_H = 1.0, BD_Y = 2.45;
  const BD_PX = Math.round(BD_W * 150), BD_PY = Math.round(BD_H * 150);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H),
    ctx.flat(boardTexture(BD_PX, BD_PY, STOCK, STOCK_LOOK)));
  put(board, CTR_CX, BD_Y, -hd + 0.09);
  // the moulded surround, behind the printed face and proud of the wall
  put(new THREE.Mesh(new THREE.BoxGeometry(BD_W + 0.10, BD_H + 0.10, 0.06), silvM),
    CTR_CX, BD_Y, -hd + 0.05);

  // ── the man behind the counter ──
  //
  // Facing DERIVED from the counter, never typed: `ct/citizens.ts` takes
  // `atan2(vx, vz)` with 0 = +z, and four rooms have shipped a keeper staring at
  // their own back wall by copying `Math.PI` from a neighbour (GOTCHAS §23). The
  // customer floor is on the +z side of this counter, so the heading points that
  // way and moves if the counter does.
  //
  // 0.68 m of staff strip between his shoulder and the back wall — the thrift
  // store put its keeper 0.55 m back and lost her INSIDE the plaster. Red shirt,
  // because a 1997 discounter puts its staff in the fascia colour.
  const KEEP_Z = CTR_Z - 0.62;
  const KEEP_X = CTR_CX + 0.30;
  const clerk = room.person({
    jacket: '#c8322a', pants: '#2a2d33', skin: '#8a5a3a', hair: '#221c18',
    fit: 'plain', accent: '#9aa0a6', cut: 'short', build: 0,
  }, KEEP_X, KEEP_Z, { facing: Math.atan2(0, CTR_Z - KEEP_Z), h: 1.00, w: 0.98 });

  // ── the two things taped in the glass, from this side ──
  //
  // The facade tapes one price card inside the window and paints its fascia
  // tube over the top; from in here the card is the back of the same sheet, so
  // it hangs on the front wall at the far end of the glazed run from the door —
  // which is where `electroFront` puts it (`cxp`, the end opposite the tower).
  const cardT = declareSurface(pixTex(64, 12, (g) => {
    g.fillStyle = '#f4edd8'; g.fillRect(0, 0, 64, 12);
    g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = RED; g.fillText('TV · VCR · CAMCORDER', 32, 6);
  }), 'sign');
  room.sign(cardT, 1.60, 0.30, -3.60, 0.70, hd - 0.09, Math.PI);
  const saleT = declareSurface(pixTex(48, 14, (g) => {
    g.fillStyle = GRAPHITE; g.fillRect(0, 0, 48, 14);
    g.fillStyle = RED; g.fillRect(0, 0, 48, 2); g.fillRect(0, 12, 48, 2);
    g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e4ecf2'; g.fillText('NO CREDIT', 24, 7);
  }), 'sign');
  room.sign(saleT, 1.10, 0.32, -0.40, 2.30, hd - 0.09, Math.PI);

  // ══ AND YOU BUY FROM HIM, OFF THE BOARD ════════════════════════════════════
  //
  // The customer stands on the counter's own centreline, 1.05 m off its front
  // face — inside the 2.25 m aisle laid out above, with 1.2 m of it still behind
  // him. He is the aim and the outline; the board over his head is the view.
  shopCounter(ctx, {
    id: 'ct-shop-volt',
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

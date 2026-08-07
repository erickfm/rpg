import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { frontageWorld, alongU } from './tex-world';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import './goods';   // for the side effect: it is what declares the stock

// VIDEO HUT, inside.
//
// *"build out the remaining stores that atrent built yet pls"*   (2026-08-06)
//
// The thirteenth interior, and the first room built for this world since the
// shop counter existed — so it is furnished around one, rather than having one
// fitted afterwards.
//
// ══ EVERY COLOUR AND EVERY PRICE IS READ OFF THE OUTSIDE ═══════════════════
//
// `videoFront` in `ct/tex-world.ts` paints this shopfront and it is unusually
// specific about what is behind the glass: three banks of shelving with the
// spines stood on end in five cycling colours, a NEW RELEASES header over the
// top rack, two posters taped inside the glass at the ends, a hand-lettered
// card reading `VHS · 2 FOR $20`, and a RETURN SLOT beside the door. This room
// is that picture from the other side. The blue, the yellow and the five spine
// colours below are the painter's own constants; the prices are the ones
// already painted on the street.
const BLUE = '#1e5aa8', YELLOW = '#f2c22a', ALU = '#8f938f';
/** the facade's own rack palette — a rack reads as a rack because a few boxes
 *  repeat, so this is cycled and never randomised (GOTCHAS §31). */
const SPINE = ['#b8402c', '#2f6ea8', '#c8a230', '#4a7a4a', '#8a4a7a'];

// ══ WHY THIS ROOM DECLARES A `face` AND NOT A FRONTAGE ═════════════════════
//
// **EVERY OTHER SHOP IN THE BELT IS ON THE MAIN STREET, WHOSE FRONTAGES RUN
// ALONG z. THIS ONE IS ON THE SIDE STREET AND RUNS ALONG x.** The registry says
// so — `axis: 'x'`, `facePos: -110`, `outward: 1` — and `DoorDecl`'s ordinary
// form cannot express that: `doorWorldFor` returns a number on the roster's z
// axis and `doorPointFor` builds its normal out of `side`, which only means
// anything for a building facing across the main street.
//
// `face` is the form for exactly this, and its own note says so: *"a position
// along the frontage has no meaning on a face that is not on the roster's axis
// … the axis-aligned case is the SAME THING with a normal of (±1, 0), so the
// chamfer is not a special case bolted on, it is the general form."* The bodega
// uses it for a canted corner; a side street is the same argument with a
// different angle.
//
// **NOTHING IN THE KIT WAS CHANGED FOR THIS.** A room with a `face` publishes no
// frontage, so `buildRoom` takes the street door from `door.x/z` and the landing
// from `door.outX/outZ` — the documented override path six rooms already use —
// and names its building with `building:` so the leaf still comes from this
// declaration (the kit warns loudly if a chamfer room forgets, and the church
// shipped a domestic door in a 5.5 m arch that way).
//
// The point and the normal are DERIVED from the frontage registry inside
// `buildVideo`, not typed here, so the door follows the building if the roster
// ever moves it. This declaration carries the fallbacks the type requires.
export const DOOR: DoorDecl = {
  building: 'VIDEO HUT', w: 18, cz: -110, side: 1, at: 0,
  // the shopfront's own door: an aluminium half-glazed leaf with a kick plate,
  // which is what `videoFront` draws. 1.05 is the registry's own width, so the
  // opening you walk through and the one painted on the street are one number.
  leaf: {
    clearW: 1.05, h: 2.4, leaves: 1,
    frame: { colour: 0x8f938f, material: 'aluminium' }, glazing: 'full',
  },
  face: { x: 7.04, z: -110, nx: 0, nz: 1 },
};

export function buildVideo(ctx: CtxBuild): void {
  // ── WHERE THE DOOR IS, ASKED RATHER THAN REMEMBERED ──────────────────────
  //
  // Interiors build LAST (`BUILD.INTERIOR`), long after `buildStreet` has
  // registered every frontage, so this is always answerable by the time it runs.
  // Null would mean the roster no longer has a VIDEO HUT, and the honest answer
  // to that is to build nothing rather than a room with a door onto nowhere —
  // the same rule `ctx.site()` states for open ground.
  const FW = frontageWorld('VIDEO HUT');
  if (!FW) {
    console.warn('[interior:video] no VIDEO HUT frontage is registered — building nothing.');
    return;
  }
  const W = 16.8;                       // roomWidthFor(18): the kit's own rule
  const K = W / FW.frontageM;           // the room is narrower than its shopfront
  // Local x of the doorway. The conversion is the kit's: metres along the
  // painter's u, scaled into the room, measured from the room's own left edge —
  // so a door three-quarters along a shopfront is three-quarters along the room.
  // Checked against the diner, which the kit derives the same way: its door is
  // 3.111 m along a 12 m front and lands at local −2.6 in a 10.8 m room.
  const AT = alongU(FW, FW.doorWorld) * K - W / 2;
  // The pavement point outside. 0.75 m off the facade plane along its outward
  // normal — the kit's own standoff, and the reason for it is that the shell
  // collider reaches 0.12 m proud of the plane, so anything closer stands the
  // trigger inside collision. Measured here: the collider face is z −109.88 and
  // this lands at −109.25, which is 0.27 m of daylight past a 0.36 m body.
  const standZ = FW.facePos + FW.outward * 0.75;

  const room = buildRoom(ctx, {
    id: 'video',
    label: 'into the VIDEO HUT',
    // NAMED, because this room publishes no frontage and the kit cannot
    // otherwise find the DoorDecl above — see the warning `buildRoom` prints.
    building: 'VIDEO HUT',
    w: W,
    // 9.5 m deep, and the depth is set by the WALKING and not by the shop.
    // Three gondola runs and a counter across a 8 m room leave 1.3 m aisles;
    // the lane rule is 2 m and it holds indoors. At 9.5 every lane below
    // measures 2.0 m or better, and the arithmetic is written out where the
    // runs are laid.
    d: 9.5, h: 3.0,
    palette: { floor: 0x3f4a58, wall: 0xd6d0be, ceil: 0xd2cec6, trim: 0x1e5aa8 },
    // Fluorescent, cool and plenty of it: the facade paints a lit ceiling
    // washing down the inside of the glass, and that is only true if the room
    // behind it is over-lit. A rental floor in 1997 is not atmospheric.
    light: { kind: 'troffer', tint: 0xeef4f8, count: 5 },
    door: {
      at: AT, r: 1.05,
      x: FW.doorWorld, z: standZ,
      // ALONG THE WALK, not out along the normal. The kit's cut-face landing
      // steps 3 m down the door's own normal, which here is straight into the
      // side road — the carriageway starts 2 m off this pavement. So the
      // landing goes 1.5 m along the shopfront instead, exactly as a flat
      // frontage's does, and it clears the way-in trigger by 0.10 m against the
      // 0.35 the kit warns below (1.5 against r 1.05).
      outX: FW.doorWorld + 1.5, outZ: standZ,
      // fwd = (sin yaw, −cos yaw), so facing the outward normal +z is yaw π:
      // you come out with the shop behind you.
      outYaw: Math.PI, outGy: ctx.KERB_H,
    },
    // The shopfront window, west of the door — the facade glazes the whole
    // front and hangs its two posters at the ENDS, so the room's one window is
    // the run between them. It stops 0.38 m short of the door opening; the kit
    // refuses overlapping holes and says so, and this is inside that.
    window: { at: -1.3, w: 10.2, h: 2.0, sill: 0.45 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const blueM = new THREE.MeshBasicMaterial({ color: 0x1e5aa8 });
  const aluM = new THREE.MeshBasicMaterial({ color: 0x8f938f });
  const carcM = new THREE.MeshBasicMaterial({ color: 0x4a4038 });

  // ── the floor: cord carpet, because a rental shop is carpeted ──
  //
  // It is the one thing that tells this room from the burger barn's quarry tile
  // and the bodega's vinyl before you have read a single sign: you walk in off
  // a wet pavement onto flat blue-grey cord that has had ten years of it.
  const carpetT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#3f4a58'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 32; y += 2) g.fillRect(0, y, 32, 1);        // the cord
    g.fillStyle = 'rgba(0,0,0,0.14)';
    for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
    dither(g, 32, 32, 46);
  }), 'ground');
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping;
  carpetT.repeat.set(Math.round(room.W / 1.6), Math.round(room.D / 1.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(carpetT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ── THE RACK FACE, which is the whole texture of this room ──
  //
  // Spines stood on end, five colours cycling, a white flash near the top of
  // each and a dark edge down its right — the same three marks `videoFront`
  // makes, at the same order of size, because these are the boxes it paints
  // through the glass. Tiled by REAL METRES (GOTCHAS §5) so a 4 m run and a
  // 1.2 m end cap carry boxes of one size.
  // ⚠ THE TILE COVERS 0.24 m AND THAT NUMBER IS THE OBJECT, NOT A TASTE.
  // The texture draws EIGHT spines, and a VHS clamshell spine is 30 mm — so one
  // tile is 8 x 0.030 = 0.24 m of shelf. The first cut said 1.0 m and every box
  // in the shop came out 125 mm across: from the door it read as a library of
  // encyclopaedias, which is the exact failure GOTCHAS 5 is about (a texture
  // sized off the mesh instead of off the real thing it depicts).
  const SPINE_M = 0.24;                // what one tile covers, in metres
  /** and one ROW of it is one shelf: a 190 mm box plus its board and the air
   *  over it. Same rule vertically, so the rows land on the boards. */
  const SHELF_M = 0.40;
  const rackT = declareSurface(pixTex(48, 32, (g) => {
    g.fillStyle = '#2e2a26'; g.fillRect(0, 0, 48, 32);              // the shelf void
    for (let i = 0; i < 8; i++) {
      const x = 1 + i * 6;
      g.fillStyle = SPINE[i % SPINE.length];
      g.fillRect(x, 2, 5, 28);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, 5, 5, 1);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 4, 2, 1, 28);
    }
    dither(g, 48, 32, 30);
  }), 'detail');
  const rackFor = (wM: number, hM: number) => {
    const t = rackT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(wM / SPINE_M, hM / SHELF_M);
    t.needsUpdate = true;
    return ctx.flat(t);
  };

  // ══ THE FLOOR PLAN, AND THE LANE ARITHMETIC ════════════════════════════════
  //
  // The 2 m lane is sacred indoors. Every gap below is written out because a
  // rental shop is nothing but aisles and getting one wrong turns the room into
  // a maze you shuffle through sideways. Room is 16.8 x 9.5, so hd = 4.75.
  //
  //   z  4.75   the front wall, with the door and the window
  //             ── 2.15 m ──                          browsing lane
  //   z  2.60   gondola A near face   (centre 2.25, 0.70 deep)
  //   z  1.90   gondola A far face
  //             ── 2.10 m ──                          aisle
  //   z −0.20   gondola B near face   (centre −0.55, 0.70 deep)
  //   z −0.90   gondola B far face
  //             ── 2.05 m ──                          counter lane
  //   z −2.95   the counter's front face (centre −3.30, 0.70 deep)
  //   z −3.65   its back face
  //             ── 0.70 m ──                          the staff strip
  //   z −4.75   the back wall
  //
  // And across, x from −8.4 to 8.4:
  //
  //   NEW RELEASES up the west wall, its boards reaching x −8.06
  //   the gondolas run −6.0 … 1.4 (7.4 m)
  //   the counter runs  3.4 … 8.4 (5.0 m, to the east wall)
  //
  //   west aisle   −8.06 → −6.00   2.06 m
  //   east aisle     1.40 →  3.40   2.00 m
  //
  // ⚠ THE COUNTER IS AT THE DOOR END, AND THAT IS THE SECOND LAYOUT. The first
  // put it against the west wall with the gondolas filling the east half, and
  // the door is at local x +4.70 — so you walked in with a rack of tape one
  // metre from your face and the till out of sight behind it. That is the pawn
  // shop's own complaint (*"i immediately hit a counter. it's like i'm behind
  // the counter i don't get it"*) wearing a different hat, and it is worth
  // moving furniture for. A rental counter belongs by the door anyway: you pay
  // on the way out, and the clerk watches who comes in.
  //
  // Now the door lands you at (4.70, 3.60) on open floor with 2.25 m to the
  // nearest thing, looking down the room past the ends of the runs at the
  // counter and its board.
  const GOND_A_Z = 2.25, GOND_B_Z = -0.55, GOND_D = 0.70;
  const GOND_X0 = -6.0, GOND_X1 = 1.4;
  const CTR_Z = -3.30, CTR_D = 0.70;
  const CTR_X0 = 3.4, CTR_X1 = hw;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;

  // ── the gondolas: double-sided racks you walk both sides of ──
  //
  // A carcass with a rack face on each side and a header board along the top
  // carrying the genre, which is the one thing a video shop signs at eye level.
  // 1.50: a 0.22 m plinth, three 0.40 m shelves of face, and a 0.08 m cap. Every
  // one of those is a real part of the unit and they add up to the height rather
  // than the height being chosen and the parts left to fit inside it — the first
  // cut was 1.55 and left a 0.13 m band of bare carcass over the top shelf and
  // an untextured brown top, which is the *"blank grey slab"* fault the bodega's
  // gondola end and the pawn shop's till were both pulled up for.
  const GOND_PLINTH = 0.22, GOND_CAP = 0.08;
  const GOND_H = GOND_PLINTH + 0.40 * 3 + GOND_CAP;
  const genreT = (word: string) => declareSurface(pixTex(64, 12, (g) => {
    g.fillStyle = BLUE; g.fillRect(0, 0, 64, 12);
    g.fillStyle = YELLOW; g.fillRect(0, 1, 64, 1); g.fillRect(0, 10, 64, 1);
    g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = YELLOW; g.fillText(word, 32, 6);
  }), 'sign');
  const gondola = (cz: number, west: string, east: string) => {
    const cx = (GOND_X0 + GOND_X1) / 2, w = GOND_X1 - GOND_X0;
    put(new THREE.Mesh(new THREE.BoxGeometry(w, GOND_H, GOND_D), carcM), cx, GOND_H / 2, cz);
    // the two rack faces, a hair proud of the carcass so nothing is coplanar
    // THREE WHOLE SHELVES, 1.20 m of face from 0.20 to 1.40. A fractional row
    // wraps to a sliced box at the top edge, which reads as a texture bug rather
    // than as a shelf — so the face height is a multiple of SHELF_M by
    // construction and the carcass is sized around it, not the other way round.
    const FH = SHELF_M * 3;
    for (const [dz, ry] of [[GOND_D / 2 + 0.012, 0], [-GOND_D / 2 - 0.012, Math.PI]] as [number, number][]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.10, FH), rackFor(w - 0.10, FH));
      face.rotation.y = ry;
      put(face, cx, GOND_PLINTH + FH / 2, cz + dz);
    }
    // THE CAP, proud of the carcass on all four sides so the unit has a top edge
    // rather than a cut-off. Blue, like everything else this shop signs itself
    // with, and it is what the header board stands on.
    put(new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, GOND_CAP, GOND_D + 0.06), blueM),
      cx, GOND_H - GOND_CAP / 2, cz);
    // the header board, read from both aisles — `room.sign` builds it as two
    // back-to-back single-sided planes, which is GOTCHAS §10 handled for free
    room.sign(genreT(west), w * 0.42, 0.22, cx, GOND_H + 0.18, cz + GOND_D / 2 + 0.02);
    room.sign(genreT(east), w * 0.42, 0.22, cx, GOND_H + 0.18, cz - GOND_D / 2 - 0.02);
    // one collider for the run: the two faces are 0.72 m apart across a 0.72 m
    // player, so boxing them separately would only build a slot to wedge in
    solid(cx, cz, w, GOND_D);
  };
  gondola(GOND_A_Z, 'COMEDY', 'ACTION');
  gondola(GOND_B_Z, 'DRAMA', 'HORROR');

  // ── NEW RELEASES, up the west wall, exactly as the facade advertises ──
  //
  // The header is painted on the shopfront over the top rack, so the room owes
  // it a wall. Four shelves of spines from 0.55 to 2.05 m with a yellow-on-blue
  // header over them, on the wall you face as you come through the door.
  {
    const NR_Z0 = -2.2, NR_Z1 = 4.0;
    const NR_L = NR_Z1 - NR_Z0, NR_CZ = (NR_Z0 + NR_Z1) / 2;
    const WX = -hw + 0.16;
    // Four shelves on the SHELF_M pitch, so the boxes here are the same size as
    // the boxes on the gondolas — one shop, one stock.
    for (let sh = 0; sh < 4; sh++) {
      const y = 0.50 + sh * SHELF_M;
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, NR_L), carcM);
      put(board, WX, y, NR_CZ);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(NR_L, SHELF_M - 0.06), rackFor(NR_L, SHELF_M - 0.06));
      face.rotation.y = Math.PI / 2;                     // faces +x, into the room
      put(face, WX + 0.15, y + (SHELF_M - 0.06) / 2 + 0.025, NR_CZ);
    }
    const nrT = declareSurface(pixTex(96, 14, (g) => {
      g.fillStyle = BLUE; g.fillRect(0, 0, 96, 14);
      g.fillStyle = YELLOW; g.fillRect(0, 1, 96, 1); g.fillRect(0, 12, 96, 1);
      g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = YELLOW; g.fillText('NEW RELEASES', 48, 7);
    }), 'sign');
    room.sign(nrT, NR_L * 0.7, 0.26, WX + 0.16, 2.30, NR_CZ, Math.PI / 2);
    // 0.34 deep, not 0.30: the shelves reach WX + 0.15 and the collider has to
    // cover what is actually there, or the boards clip a shoulder.
    solid(WX, NR_CZ, 0.34, NR_L);
  }

  // ── the counter, with the till and the drop box ──
  //
  // Laminate top, blue front panel, aluminium kick — the shopfront's own three
  // materials. It runs from the west wall so the staff strip behind it is
  // closed at one end without needing a second run of anything.
  const lamT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#c8c2b2'; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(80,70,60,0.20)';
    for (let i = 0; i < 70; i++) g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 16), 1, 1);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 64, 2);
  }), 'detail');
  const lam = lamT.clone();
  lam.wrapS = lam.wrapT = THREE.RepeatWrapping;
  lam.repeat.set(CTR_W / 5.0, CTR_D / 1.25);
  lam.needsUpdate = true;
  const frontT = declareSurface(pixTex(64, 26, (g) => {
    g.fillStyle = BLUE; g.fillRect(0, 0, 64, 26);
    g.fillStyle = 'rgba(0,0,0,0.20)';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 26);       // panel joints
    g.fillStyle = YELLOW; g.fillRect(0, 2, 64, 1);                  // the keyline
    g.fillStyle = '#8f938f'; g.fillRect(0, 23, 64, 3);              // aluminium kick
    dither(g, 64, 26, 40);
  }), 'detail');
  const fM = ctx.flat(frontT), tM = ctx.flat(lam);
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 1.02, CTR_D), [fM, fM, tM, fM, fM, fM]),
    CTR_CX, 0.51, CTR_Z);
  solid(CTR_CX, CTR_Z, CTR_W, CTR_D);

  // the till, and the demagnetiser plate every rental counter had beside it
  put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x3a3a3e })), CTR_CX + 1.1, 1.16, CTR_Z);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.20),
    new THREE.MeshBasicMaterial({ color: 0x6a6a6c }));
  keys.rotation.x = -Math.PI / 3;
  put(keys, CTR_CX + 1.1, 1.30, CTR_Z + 0.10);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.20), aluM), CTR_CX + 0.5, 1.05, CTR_Z + 0.05);

  // ── THE RETURN SLOT, which the facade draws beside the door ──
  //
  // A steel drop box let into the counter's front face at the door end, with a
  // black letterbox mouth. It is DECOR and it is honest about that: there is no
  // due date in this world and nothing to return, so a slot that took a tape
  // back would be a system nobody asked for. It is here because a rental shop
  // without one does not read as a rental shop, and because the shopfront paints
  // one four metres away on the other side of the same wall.
  {
    const SX = CTR_X1 - 0.62;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.46), aluM);
    put(plate, SX, 0.62, CTR_Z + CTR_D / 2 + 0.014);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.09),
      new THREE.MeshBasicMaterial({ color: 0x111316 }));
    put(mouth, SX, 0.70, CTR_Z + CTR_D / 2 + 0.020);
    const slotT = declareSurface(pixTex(32, 10, (g) => {
      g.fillStyle = BLUE; g.fillRect(0, 0, 32, 10);
      g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = YELLOW; g.fillText('RETURNS', 16, 5);
    }), 'sign');
    room.sign(slotT, 0.46, 0.14, SX, 0.44, CTR_Z + CTR_D / 2 + 0.020);
  }

  // ── the drop-back wall behind the counter: cases, and the tapes themselves ──
  //
  // The joke of a 1997 rental shop is that the box on the shelf is empty — the
  // tape is behind the counter in a plain sleeve, and the clerk fetches it. So
  // the wall behind him is unlabelled black spines, and the colour is all out on
  // the floor.
  {
    const backT = declareSurface(pixTex(64, 40, (g) => {
      g.fillStyle = '#3a352d'; g.fillRect(0, 0, 64, 40);
      for (let r = 0; r < 4; r++) {
        const y = 2 + r * 10;
        for (let i = 0; i < 20; i++) {
          g.fillStyle = i % 5 === 2 ? '#4a443a' : '#241f1a';
          g.fillRect(1 + i * 3, y, 2, 8);
        }
        g.fillStyle = '#5a5044'; g.fillRect(0, y + 8, 64, 1);
      }
      dither(g, 64, 40, 40);
    }), 'detail');
    const bt = backT.clone();
    bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
    bt.repeat.set(CTR_W / 2.4, 1);
    bt.needsUpdate = true;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(CTR_W, 1.8), ctx.flat(bt));
    put(back, CTR_CX, 1.25, -hd + 0.06);
  }

  // ══ THE RATE BOARD, AND IT IS THE SHOP ═════════════════════════════════════
  //
  // Plastic letters on a blue board over the counter — the same blue and yellow
  // as the fascia outside, because a shop this size had one signwriter and he
  // did the front and the back on the same afternoon.
  //
  // ── EVERY PRICE AGREES WITH SOMETHING PAINTED ON THE STREET ───────────────
  //
  //   `VHS · 2 FOR $20` on the shopfront card   ->  EX-RENTAL $10.00 each
  //   `$6.00 A DAY` on the VIDEO HUT flyer      ->  NEW RELEASE $6.00
  //     (`ct/tenancy.ts`, the handbill that arrives in your mail)
  //
  // Both of those were repriced with everything else this morning, so the board
  // is at the world's ×4 scale by construction rather than by being scaled a
  // second time here.
  //
  // ── HOW RENTING IS EXPRESSED, AND WHAT IT IS NOT ──────────────────────────
  //
  // **A RENTED TAPE AND A TAPE YOU OWN ARE DIFFERENT OBJECTS**, which is the
  // only reason `NEW RELEASE` and `EX-RENTAL` are two lines and not one line
  // priced twice. `RENTAL` is the shop's own yellow clamshell with cover art and
  // a spine sticker; `VHS` is the world's existing home tape, *"no label,
  // somebody taped over something"*. You can tell them apart in your bag.
  //
  // **THERE IS NO DUE DATE AND THIS DOES NOT PRETEND THERE IS.** Renting hands
  // you the case and takes the money; nothing is owed back, because a return
  // clock is a system nobody has asked for and half a system is worse than none
  // — the same argument `ItemDef.use` makes about a menu option that does
  // nothing. If it is ever wanted, the drop box is already built and the item is
  // already distinct, which is most of it.
  const RATES: ShopColumn[] = [
    { head: 'RENT', lines: [
      { id: 'RENTAL', name: 'NEW RELEASE', price: 6.00 },
    ] },
    { head: 'BUY', lines: [
      { id: 'VHS', name: 'EX-RENTAL', price: 10.00 },
      { id: 'BLANKS', name: 'BLANKS 3PK', price: 9.00 },
      { id: 'POPCORN', name: 'POPCORN', price: 4.00 },
    ] },
  ];
  const RATE_LOOK: BoardLook = {
    panel: BLUE, frame: ALU, band: YELLOW, bandInk: '#17427a',
    ink: '#f6efdb', priceInk: YELLOW,
    hover: 'rgba(242,194,42,0.20)', flash: 'rgba(246,239,219,0.55)',
  };
  // 3.2 x 0.9 m at 150 texels per metre, hung over the counter on the back
  // wall. Its bottom edge is 1.85 m — clear of the 1.25 m tape wall behind the
  // counter with 0.6 m to spare, so neither hides the other.
  const BD_W = 3.2, BD_H = 0.9, BD_Y = 2.30;
  const BD_PX = Math.round(BD_W * 150), BD_PY = Math.round(BD_H * 150);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H),
    ctx.flat(boardTexture(BD_PX, BD_PY, RATES, RATE_LOOK)));
  put(board, CTR_CX, BD_Y, -hd + 0.09);
  // the moulded surround, behind the printed face and proud of the wall
  put(new THREE.Mesh(new THREE.BoxGeometry(BD_W + 0.10, BD_H + 0.10, 0.06), aluM),
    CTR_CX, BD_Y, -hd + 0.05);

  // ── the clerk, behind the counter ──
  //
  // Facing DERIVED from the counter, never typed: `ct/citizens.ts` takes
  // `atan2(vx, vz)` with 0 = +z, and four rooms have shipped a keeper staring at
  // their own back wall by copying `Math.PI` from a neighbour (GOTCHAS §23). The
  // customer floor is on the +z side of this counter, so the heading points that
  // way and moves if the counter does.
  //
  // 0.70 m of staff strip between the counter's back face and the wall — the
  // thrift store put its keeper 0.55 m back and lost her INSIDE the plaster,
  // never drawn from any angle a customer can stand at, so this is deliberately
  // generous. Blue polo over the shop's own colour.
  const KEEP_Z = CTR_Z - 0.62;
  const KEEP_X = CTR_CX + 0.3;
  const clerk = room.person({
    jacket: '#2f6ea8', pants: '#3a3a42', skin: '#c9946a', hair: '#4a3a2a',
    fit: 'plain', accent: '#f2c22a', cut: 'long', build: -1,
  }, KEEP_X, KEEP_Z, { facing: Math.atan2(0, CTR_Z - KEEP_Z), h: 0.98, w: 0.95 });

  // ── the two posters the facade tapes inside the glass ──
  //
  // Read from outside as two rectangles at the ends of the window; from inside
  // they are the backs of the same sheets, so they hang on the front wall in the
  // same two places. Their extents are the facade's own: 1.15 x 1.70 m at the
  // ends of the glazed run.
  const posterT = (a: string, b: string) => declareSurface(pixTex(28, 42, (g) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, 28, 42);
    g.fillStyle = a; g.fillRect(2, 2, 24, 26);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(4, 5, 20, 8);
    g.fillStyle = b; g.fillRect(6, 16, 16, 8);
    g.fillStyle = 'rgba(240,235,215,0.62)'; g.fillRect(4, 31, 20, 3);
    g.fillStyle = 'rgba(240,235,215,0.62)'; g.fillRect(7, 36, 14, 2);
    dither(g, 28, 42, 24);
  }), 'sign');
  for (const [px, pa, pb] of [[-6.1, '#2f3d6a', '#b8402c'], [3.2, '#6a2f33', '#c8a230']] as [number, string, string][]) {
    room.sign(posterT(pa, pb), 0.86, 1.28, px, 1.55, hd - 0.09, Math.PI);
  }

  // ── the drop bin of ex-rentals, which is where the `2 FOR $20` lives ──
  //
  // A wire basket of loose cases by the door, the way every rental shop cleared
  // its old stock — and the one object in the room that quotes the shopfront's
  // `2 FOR $20` back at you, because that card is what it is for.
  {
    // In the FRONT-EAST corner by the door, which is where a shop puts the bin
    // it wants you to trip over on the way in. Padded it reaches x 6.95, and the
    // door lands you at 4.70 — 2.25 m clear of it.
    const BX = 7.4, BZ = hd - 1.05;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.60, 0.62), aluM), BX, 0.30, BZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.24, 0.54), blueM), BX, 0.66, BZ);
    const cardT = declareSurface(pixTex(40, 12, (g) => {
      g.fillStyle = '#f6efdb'; g.fillRect(0, 0, 40, 12);
      g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = BLUE; g.fillText('2 FOR $20', 20, 6);
    }), 'sign');
    room.sign(cardT, 0.62, 0.19, BX, 0.90, BZ);
    solid(BX, BZ, 0.90, 0.62);
  }

  // ══ AND YOU RENT FROM HIM, OFF THE BOARD ═══════════════════════════════════
  //
  // The customer stands on the counter's own centreline, 1.05 m off its front
  // face — inside the 2.05 m lane laid out above, with 1.0 m of it still behind
  // him. He is the aim and the outline; the board over his head is what the view
  // shows.
  shopCounter(ctx, {
    id: 'ct-shop-video',
    columns: RATES, look: RATE_LOOK,
    w: BD_PX, h: BD_PY,
    mesh: () => board,
    standoff: boardStandoff({ wM: BD_W, hM: BD_H, fov: 55, riseM: BD_Y - 1.75 }),
    fov: 55,
    stand: { x: room.wx(CTR_CX), z: room.wz(CTR_Z + CTR_D / 2 + 1.05) },
    keeper: { x: clerk.mesh.position.x, z: clerk.mesh.position.z, obj: clerk.mesh },
    who: 'the clerk',
    ok: room.inside,
  });
}

import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';

// FIRST FEDERAL, inside.
//
// Two requests, one room: *enter the bank and apply for a loan*, and *a whole
// interior that is very nice inside*. This file is the room; the loan is the
// desk in it.
//
// ── what the outside already decided, and what it did NOT ──────────────────
//
// A's facade (`ct/bank.ts`) is approved and I have not touched it — "i like the
// ATM … i love the doors of the bank too". Three facts about it are load-bearing
// in here:
//
//   · the ENTRANCE IS CENTRED on the frontage, behind a granite portal that
//     stands 0.30 m proud, and its leaf is a BRONZE DOUBLE DOOR 1.9 m clear and
//     2.6 m tall. So the room's door is centred too, and it is the same leaf —
//     declared once, below, and read by both sides (`ct/doors.ts`).
//   · the ground band carries TWO deep-set windows at u 0.18 / 0.82 of the
//     frontage. The kit's front wall takes ONE opening besides the door, so the
//     room gets the u = 0.82 one — the right-hand one as you walk in — and the
//     left of the front wall is solid. Noted in my handoff as the one thing
//     about this room the exterior does not get back.
//   · it is PRECAST AND GRANITE, cool grey, "looks like it was cleaned last
//     year", and it stands next to the warm sooty library on purpose. The
//     interior holds that line: terrazzo, bronze, oak, and nothing warm except
//     the joinery.
//
// GOTCHAS 45 is the rule that decides everything else: *"by matching the
// exterior i really mean in general positioning. no one is going to take a ruler
// and measure the width of the inner and outer"* — and *"you can make it wider
// than it actually is outside too."* So the door's SITUATION matches and the
// dimensions are mine. This room takes 14 x 12 m at 3.6 m, which is the tallest
// interior in the world: a 1997 savings bank lobby is deliberately overbuilt,
// and height is most of how that reads.
//
// ── what makes it a BANK and not an office with a counter ──────────────────
//
// Four things, and they are the four this room spends its care on:
//
//   1. THE TELLER LINE — a 10.8 m oak counter with three bronze-screened
//      windows, deal trays, a stone top, and the staff side genuinely sealed.
//      You cannot get behind it, which is the whole point of the object.
//   2. THE VAULT, AND YOU CAN WALK INTO IT. A strongroom in the back-left
//      corner with a 0.30 m steel door standing open on its hinges, a
//      combination dial, a spoke handle, a stepped sill, and three walls of
//      safe-deposit boxes inside. Every other room in this world is one space;
//      this one has a room inside it.
//   3. TERRAZZO WITH BRASS DIVIDERS, not lino and not carpet tile. It is the
//      floor of a building that expected to be here in fifty years.
//   4. THE RATE BOARD — mortgage 7.75, auto 9.25, passbook 4.10. Nothing dates
//      a room to 1997 faster than the numbers a bank was quoting in it.

/**
 * WHERE THIS ROOM'S DOOR IS — declared by the ROOM; the facade follows it.
 * See ct/doors.ts for why that direction.
 *
 * `at: 0` is not a shrug, it is the measurement. `ct/bank.ts` hangs its leaf at
 * `cz` — the exact centre of the frontage — so the interior door is centred too,
 * and `doorWorldFor('FIRST FEDERAL')` resolves to z 4.6, which is where the
 * bronze doors already are. The two cannot drift because there is one number.
 *
 * The LEAF is the other half, and it is the half four rooms got wrong before
 * `DoorLeaf` existed: the facade's door is a wide bronze double under a granite
 * head, so the room's is too. A narrow domestic leaf inside a double-door bank
 * is exactly the contradiction the declaration exists to make impossible.
 */
export const DOOR: DoorDecl = {
  building: 'FIRST FEDERAL', w: 19.2, cz: 4.6, side: -1, at: 0,
  leaf: {
    clearW: 1.9, h: 2.6, leaves: 2,
    // #7a6a44 is `BANK_BRONZE` in ct/bank.ts, read from there rather than
    // matched by eye. The frame inside and the frame outside are one frame.
    frame: { colour: 0x7a6a44, material: 'brass' },
    glazing: 'full',
  },
};

// The frontage, in the terms the roster lays it out in: `ct/street.ts` walks
// WEST from z 14.2 and hands the bank 19.2 m, so `placeBank` centres it on
// 14.2 - 19.2/2 = 4.6. Written here as arithmetic on the two roster numbers
// rather than as the answer, because the answer is what goes stale.
const FR_NAME = 'FIRST FEDERAL';
const FR_W = 19.2;                       // ct/street.ts: placeBank(zw, 19.2)
const FR_Z0 = 14.2;                      // ct/street.ts: the WEST walk starts here
const FR_CZ = FR_Z0 - FR_W / 2;          // 4.6 — and ct/bank.ts hangs its leaf here
const FR_SIDE = -1 as const;             // west: facade on x = -FACE

/** clear interior, in metres. Wider and deeper than the kit's default because a
 *  banking hall is the one room on this block that is supposed to feel large. */
const RW = 14.0, RD = 12.0, RH = 3.6;

/**
 * A facade window's centre, as this room's local x.
 *
 * Two conversions, and they are the two that go wrong (GOTCHAS 33, and the
 * mirror that got applied twice on the diner):
 *
 *   1. `bankBand`'s u runs -z — measured in ct/bank.ts, not assumed: "the
 *      depository at u 0.62 photographs at z 2.3". So u = 0 is the HIGH-z edge
 *      and world z = FR_Z0 - u * FR_W.
 *   2. Inside you look back at the same wall from behind, so the offset from the
 *      building centre is MIRRORED — multiplied by `FR_SIDE` — and scaled by the
 *      room's width over the frontage's, because what must match is the door's
 *      PROPORTION along the front, not an absolute offset.
 */
const facadeUtoLocalX = (u: number) =>
  FR_SIDE * (FR_Z0 - u * FR_W - FR_CZ) * (RW / FR_W);

export function buildBankInterior(ctx: CtxBuild): void {
  // ct/bank.ts paints its two ground-floor windows with `win(W * 0.18, 2.2)`
  // and `win(W * 0.82, 2.2)`, and their canvas span y 1.36…3.46 of a 4.2 m band
  // puts the sill 0.60 m and the head 2.70 m above the pavement.
  //
  // ONE of them can be a hole in the kit's front wall. Taking u = 0.82 puts it
  // at local x +4.48 — the right-hand side as you walk in — which is the side
  // the loan desk and the waiting chairs are on, so the daylight falls where
  // somebody actually sits and reads.
  const WIN_X = facadeUtoLocalX(0.82);

  const room = buildRoom(ctx, {
    id: 'bank',
    label: 'into FIRST FEDERAL',
    w: RW, d: RD, h: RH,
    // Cool, institutional, and not one warm note in the shell — the warmth in
    // this room is all oak and bronze joinery, placed rather than painted on.
    // Read against the library next door, which is the warm building.
    palette: { floor: 0x9a968c, wall: 0xbdbbb0, ceil: 0xc4c1b4, trim: 0x5c4a2e },
    // A MARBLE DADO, not wall tile. The kit's wainscot paints tiles of whatever
    // size you ask for into the plaster, so a 0.95 m "tile" with a dark joint is
    // a run of marble panels rather than a bathroom — which is what a bank wall
    // does from the floor to waist height.
    wainscot: { h: 1.05, tile: 0.95, grout: 0x6a6458, face: 0xc8c0ae },
    // Cool fluorescent troffers, which is what a 1997 branch is lit by. THREE
    // is the kit's own count for a 12 m room and they run down the centreline;
    // the two flanking rows are added below, because one line of light down the
    // middle of a 14 m room reads as a corridor.
    light: { kind: 'troffer', tint: 0xe8f0f4, count: 3 },
    frontage: { name: FR_NAME, w: FR_W, cz: FR_CZ, side: FR_SIDE },
    // No `width` here on purpose: the LEAF above is the authority, so the room's
    // opening is the facade's 1.9 m bronze double and cannot be anything else.
    door: { r: 1.05, at: DOOR.at },
    window: { at: WIN_X, w: 2.2, h: 2.1, sill: 0.60 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;

  // ── the palette, named once ────────────────────────────────────────────────
  const BRONZE = 0x7a6a44;          // ct/bank.ts BANK_BRONZE — one bronze, inside and out
  const BRONZE_LIT = 0x9c8a5c;
  const OAK = 0x6a4f30, OAK_DARK = 0x503a22;
  const STONE_TOP = 0x3e3a34;       // the counter's polished top
  const STEEL = 0xa8acb0, STEEL_DARK = 0x5e6266;
  const bronzeM = new THREE.MeshBasicMaterial({ color: BRONZE });
  const bronzeLitM = new THREE.MeshBasicMaterial({ color: BRONZE_LIT });
  const steelM = new THREE.MeshBasicMaterial({ color: STEEL });
  const steelDarkM = new THREE.MeshBasicMaterial({ color: STEEL_DARK });
  const oakM = new THREE.MeshBasicMaterial({ color: OAK });
  const oakDarkM = new THREE.MeshBasicMaterial({ color: OAK_DARK });
  const paperM = new THREE.MeshBasicMaterial({ color: 0xe6e2d4 });

  /** a box at a local position — the shorthand every room in here ends up with */
  const bx = (w: number, h: number, d: number, m: THREE.Material,
              x: number, y: number, z: number) =>
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);

  // ── lettering ──────────────────────────────────────────────────────────────
  //
  // A 3x5 block font drawn as rects, not `fillText`. Canvas text ANTIALIASES,
  // which is what made the casino blade blurry and what puts a grey fringe on
  // every glyph in a nearest-filtered world. A rect per texel cannot have one.
  //
  // Fuller than the tables in int-tax.ts and int-pawn.ts because this room has
  // six things to letter — the rate board, the window numbers, the vault, the
  // name over the counter, the notices and the loan plate — and a partial table
  // is how "BUY ERE AY ERE" shipped.
  const F35: Record<string, string[]> = {
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'], D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '111', '100', '111'], F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'], J: ['001', '001', '001', '101', '111'],
    K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'], N: ['101', '111', '111', '111', '101'],
    O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'],
    Q: ['111', '101', '101', '111', '001'], R: ['111', '101', '111', '110', '101'],
    S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'],
    W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    '.': ['000', '000', '000', '000', '010'], '%': ['101', '001', '010', '100', '101'],
    '$': ['011', '110', '011', '110', '010'], '-': ['000', '000', '111', '000', '000'],
    '&': ['110', '101', '110', '101', '011'], ':': ['000', '010', '000', '010', '000'],
    ' ': ['000', '000', '000', '000', '000'],
  };
  /** draw `s` at (x, y) with `px`-sized texels; returns the width it drew */
  const word = (g: CanvasRenderingContext2D, s: string, x: number, y: number,
                px: number, col: string) => {
    g.fillStyle = col;
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const rows = F35[ch] ?? F35[' '];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (rows[r][c] === '1') g.fillRect(cx + c * px, y + r * px, px, px);
      }
      cx += 4 * px;
    }
    return cx - x - px;
  };
  /** the same, centred on `cx` */
  const wordC = (g: CanvasRenderingContext2D, s: string, cx: number, y: number,
                 px: number, col: string) => {
    const w = s.length * 4 * px - px;
    return word(g, s, Math.round(cx - w / 2), y, px, col);
  };

  // ── the floor: TERRAZZO, with brass divider strips ─────────────────────────
  //
  // Not lino (the kit's default, right for a diner) and not carpet tile (the tax
  // office, right for a landlord). Terrazzo is the floor of a building that
  // expected to still be here in fifty years, and the brass dividers are the
  // detail that makes it read as terrazzo rather than as speckled paint: the
  // strips are there because the screed has to be poured in bays.
  //
  // 64 px over a 2.4 m bay is 26.7 px/m, in line with the tax office's carpet
  // (24) and the kit's lino (20). The bay size is the repeat, so the strips fall
  // on a continuous grid across the whole 14 x 12 m floor (GOTCHAS 5).
  const BAY_M = 2.4;
  const terrazzoT = declareSurface(pixTex(64, 64, (g) => {
    g.fillStyle = '#9a968c'; g.fillRect(0, 0, 64, 64);
    // the aggregate: three chip tones, coarse enough to see from standing height
    for (const [col, n, s] of [['#c4beac', 210, 2], ['#7a766c', 170, 2],
                               ['#b0a894', 150, 1], ['#5e5a52', 90, 1]] as [string, number, number][]) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        g.fillRect((i * 23 + n) % 64, (i * 41 + n * 7) % 64, s, s);
      }
    }
    // the brass divider strips, on two edges so the repeat makes a grid
    g.fillStyle = '#8a7a46'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64);
    g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 2, 64, 1); g.fillRect(2, 0, 1, 64);
    dither(g, 64, 64, 90);
  }), 'ground');
  terrazzoT.wrapS = terrazzoT.wrapT = THREE.RepeatWrapping;
  terrazzoT.repeat.set(Math.round(room.W / BAY_M), Math.round(room.D / BAY_M));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(terrazzoT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // an inlaid dark-stone mat inside the doors, which is where the grit lands
  const matT = declareSurface(pixTex(32, 24, (g) => {
    g.fillStyle = '#4a4740'; g.fillRect(0, 0, 32, 24);
    for (const [col, n] of [['#5c584f', 90], ['#3a3832', 70]] as [string, number][]) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) g.fillRect((i * 19) % 32, (i * 29) % 24, 1, 1);
    }
    g.fillStyle = '#8a7a46'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 23, 32, 1);
    dither(g, 32, 24, 30);
  }), 'ground');
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.8), ctx.flat(matT));
  mat.rotation.x = -Math.PI / 2;
  put(mat, room.doorAt, 0.014, hd - 1.0);

  // ── the ceiling: acoustic tile in a T-bar grid ──────────────────────────────
  //
  // The kit paints a flat ceiling colour, which is right for a small shop. A
  // 168 m² hall needs the grid, because the grid is what gives the ceiling a
  // size — and at 3.6 m up, a ceiling with no scale makes the room read shorter
  // than it is.
  const ceilT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#b2af9f'; g.fillRect(0, 0, 32, 32);          // the T-bar
    g.fillStyle = '#c8c5b6'; g.fillRect(1, 1, 30, 30);          // the tile
    g.fillStyle = 'rgba(0,0,0,0.05)';                            // its fissured face
    for (let i = 0; i < 30; i++) g.fillRect(3 + ((i * 7) % 26), 3 + ((i * 13) % 26), 2, 1);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(1, 1, 30, 1);
    dither(g, 32, 32, 16);
  }), 'detail');
  ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping;
  ceilT.repeat.set(Math.round(room.W / 1.2), Math.round(room.D / 1.2));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(ceilT));
  ceil.rotation.x = Math.PI / 2;
  put(ceil, 0, room.H - 0.02, 0);

  // ── two more rows of troffers, matching the kit's ─────────────────────────
  //
  // The kit puts `count` fixtures down lx = 0. In a 14 m room that is one line
  // of light with four metres of gloom either side, so the centre row gets a
  // flanking row at lx ±4.4 on the same z stations.
  //
  // The halo is QUANTISED onto the texel grid — four hard steps, no
  // interpolation — because that is what the kit's does and because a smooth
  // radial gradient in a hard-edged nearest-filtered world has already been
  // rejected once: *"it's a smooth radial gradient in a world that is entirely
  // hard-edged nearest-filtered texels — the blur is wildly off-style"*.
  const LAMP_TINT = new THREE.Color(0xe8f0f4);
  const lampRGB = `${Math.round(LAMP_TINT.r * 255)},${Math.round(LAMP_TINT.g * 255)},`
    + `${Math.round(LAMP_TINT.b * 255)}`;
  const haloT = declareSurface(pixTex(16, 16, (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8;
      const step = Math.max(0, Math.ceil((1 - d) * 4) / 4);
      if (step <= 0) continue;
      g.fillStyle = `rgba(${lampRGB},${(step * 0.16).toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
  }), 'detail');
  haloT.minFilter = haloT.magFilter = THREE.NearestFilter;
  const haloM = new THREE.MeshBasicMaterial({
    map: haloT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const trayM = new THREE.MeshBasicMaterial({ color: 0xc4c0b8 });
  const diffuserM = new THREE.MeshBasicMaterial({ color: LAMP_TINT });
  /** one recessed twin-tube tray, dimensioned off the kit's own troffer */
  const troffer = (lx: number, lz: number) => {
    bx(1.5, 0.1, 0.42, trayM, lx, room.H - 0.05, lz);
    const dif = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), diffuserM);
    dif.rotation.x = Math.PI / 2;
    put(dif, lx, room.H - 0.105, lz);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), haloM);
    gl.rotation.x = Math.PI / 2;
    put(gl, lx, room.H - 0.12, lz);
  };
  // the kit's three sit at lz -4, 0, +4 (D * (i + 0.5) / 3 back from -hd), and
  // these take the same stations so the grid is a grid rather than a scatter
  const LAMP_Z = [0, 1, 2].map((i) => -hd + room.D * ((i + 0.5) / 3));
  for (const lz of LAMP_Z) {
    troffer(4.4, lz);
    // no fixture over the vault: its roof is at 2.6 m and a troffer above it
    // would be lighting the top of a box nobody can see
    if (lz > -3.0) troffer(-4.4, lz);
  }

  // ══ THE VAULT ══════════════════════════════════════════════════════════════
  //
  // Back-left corner, and YOU CAN WALK INTO IT. Every other interior in this
  // world is one space; this one has a room inside it, and that is the single
  // biggest reason to build a bank rather than another shop.
  //
  // It is a strongroom standing in the corner rather than a hole in the wall,
  // because the kit's walls are solid boxes and an opening in one is not mine to
  // add. That is also how a real branch vault is built — a poured box inside the
  // shell — so the honest construction and the available one are the same thing.
  //
  // It borrows the room's own west and back walls for two of its four sides and
  // builds the other two, so there is no double wall and no slot between them.
  const V_X1 = -3.60;                 // east face, outside — abuts the counter's west end
  const V_T = 0.28;                   // vault wall thickness
  const V_Z1 = -3.00;                 // front face, outside
  const V_H = 2.60;                   // inside height, under a 3.6 m room
  const V_IN_X1 = V_X1 - V_T;         // -3.88, inside face of the east wall
  const V_IN_Z1 = V_Z1 - V_T;         // -3.28, inside face of the front wall
  const THROAT_W = 1.50, THROAT_H = 2.15, THROAT_CX = -5.40;
  const THROAT_X0 = THROAT_CX - THROAT_W / 2, THROAT_X1 = THROAT_CX + THROAT_W / 2;

  // the concrete the strongroom is made of: a poured, hard-trowelled grey with
  // nothing decorative on it at all, which is the point of a vault
  const concreteT = declareSurface(pixTex(48, 40, (g) => {
    g.fillStyle = '#8e8d88'; g.fillRect(0, 0, 48, 40);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, 48, 2);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 8; i++) g.fillRect(0, 5 + i * 5, 48, 1);      // form-board lines
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 6; i++) g.fillRect(6 + ((i * 17) % 40), 8 + ((i * 11) % 28), 2, 2);
    dither(g, 48, 40, 44);
  }), 'detail');
  const concreteM = ctx.flat(concreteT);

  // the east wall, full height of the strongroom
  bx(V_T, V_H, V_Z1 - (-hd), concreteM, V_X1 - V_T / 2, V_H / 2, (V_Z1 + -hd) / 2);
  solid(V_X1 - V_T / 2, (V_Z1 + -hd) / 2, V_T, V_Z1 - (-hd));
  // the front wall, in two pieces either side of the throat, plus a header
  {
    const wSeg = (x0: number, x1: number) => {
      if (x1 - x0 <= 0.001) return;
      bx(x1 - x0, V_H, V_T, concreteM, (x0 + x1) / 2, V_H / 2, V_Z1 - V_T / 2);
      solid((x0 + x1) / 2, V_Z1 - V_T / 2, x1 - x0, V_T);
    };
    wSeg(-hw, THROAT_X0);
    wSeg(THROAT_X1, V_IN_X1);
    // the header over the opening — and NOT a collider, so the throat stays a
    // way through rather than a hole with a box in it (GOTCHAS 8)
    bx(THROAT_W, V_H - THROAT_H, V_T, concreteM,
      THROAT_CX, THROAT_H + (V_H - THROAT_H) / 2, V_Z1 - V_T / 2);
  }
  // the roof slab, which is what makes it read as a box in a taller room
  bx(hw + V_X1, 0.18, V_Z1 - (-hd), concreteM,
    (-hw + V_X1) / 2, V_H + 0.09, (V_Z1 + -hd) / 2);

  // ── the throat: a steel architrave, and a sill you step over ───────────────
  //
  // The architrave is the part that says "this is not a doorway, it is an opening
  // in something 30 cm thick". Two jambs, a head and a sill in polished steel,
  // standing 0.10 m proud on both faces so the reveal is lined.
  //
  // ALL FOUR SIT INSIDE THE THROAT AND ABUT — they do not overlap each other and
  // they do not overlap the concrete. That is not tidiness: this world z-fights
  // the moment two coplanar faces overlap (GOTCHAS 6), and the first version of
  // this block had the jambs straddling the wall's own arris and the head
  // straddling the jambs — three coincident face pairs, all of them front-facing,
  // all of them in the one opening the room is built around.
  const ARCH_T = 0.12;                                   // architrave section
  const ARCH_D = V_T + 0.20;                             // wraps 0.10 proud each side
  const IN_X0 = THROAT_X0 + ARCH_T, IN_X1 = THROAT_X1 - ARCH_T;   // clear 1.26 m
  const IN_TOP = THROAT_H - ARCH_T;                      // clear 2.03 m
  for (const jx of [THROAT_X0 + ARCH_T / 2, THROAT_X1 - ARCH_T / 2]) {
    bx(ARCH_T, THROAT_H, ARCH_D, steelM, jx, THROAT_H / 2, V_Z1 - V_T / 2);
  }
  bx(IN_X1 - IN_X0, ARCH_T, ARCH_D, steelM, THROAT_CX, IN_TOP + ARCH_T / 2, V_Z1 - V_T / 2);
  // the sill. A vault has one, it is the thing you step over, and it is what
  // tells you from across the lobby that the floor continues in there.
  bx(IN_X1 - IN_X0, 0.06, ARCH_D - 0.04, steelDarkM, THROAT_CX, 0.03, V_Z1 - V_T / 2);
  bx(IN_X1 - IN_X0, 0.015, ARCH_D - 0.04, steelM, THROAT_CX, 0.0675, V_Z1 - V_T / 2);

  // ── the door itself ────────────────────────────────────────────────────────
  //
  // A 0.30 m steel slab, standing open. THE FACE HAS TO BE VISIBLE FROM THE
  // LOBBY or the whole object is wasted, and which way it ends up pointing is
  // decided by which jamb it is hinged on — GOTCHAS 33, and it is exactly the
  // "anything with a front will end up backwards" shape.
  //
  // Hinged on the EAST jamb (the lobby side of the throat) and swung 100°, the
  // face that pointed into the room when closed ends up pointing at +x — across
  // the lobby, at the person walking in. Hinged on the west jamb it would point
  // at the wall, and every detail on it would be for nobody.
  //
  // Worked, rather than eyeballed. `rotation.y = π + θ` maps the box's -z face
  // (material index 5, where the door face texture goes) to the normal
  // (sin θ, 0, cos θ): at θ = 0 that is +z, into the room, which is a closed
  // door; at θ = 1.75 rad it is (0.98, 0, -0.18), which is across the lobby.
  // ONE rotation about ONE axis, so there is no Euler-order trap here — the
  // trap that cost ct/bank.ts a whole attempt at the ATM rake.
  const DOOR_TH = 0.30, DOOR_W = THROAT_W + 0.14, DOOR_H2 = THROAT_H + 0.10;
  const THETA = 1.75;                                   // 100° — open, and clear of the throat
  const HINGE_X = THROAT_X1 + 0.07, HINGE_Z = V_Z1 + DOOR_TH / 2;

  // The face: concentric machined rings, a combination dial, a spoke handle, and
  // the bolt-work showing round the edge. Everything on it is round, because
  // everything on a vault door is turned on a lathe.
  const vaultFaceT = declareSurface(pixTex(80, 104, (g) => {
    const cx = 40;
    g.fillStyle = '#8a8f93'; g.fillRect(0, 0, 80, 104);
    // the outer bevel: lit at the top, shadowed at the bottom, so the slab has
    // a thickness even seen flat on
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, 80, 3);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 3, 104);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 101, 80, 3);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(77, 0, 3, 104);
    // a recessed panel, and a machined ring inside it
    g.fillStyle = '#7e8387'; g.fillRect(6, 6, 68, 92);
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(6, 6, 68, 2);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(6, 96, 68, 2);
    const ring = (r: number, col: string, w = 1) => {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.arc(cx, 46, r, 0, Math.PI * 2); g.stroke();
    };
    g.fillStyle = '#95999d'; g.beginPath(); g.arc(cx, 46, 27, 0, Math.PI * 2); g.fill();
    ring(27, 'rgba(0,0,0,0.30)', 2);
    ring(24, 'rgba(255,255,255,0.16)', 1);
    // THE COMBINATION DIAL — the one thing on a vault door everybody can name
    g.fillStyle = '#2e3236'; g.beginPath(); g.arc(cx, 46, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d8dcdf';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const len = i % 3 === 0 ? 4 : 2;
      g.fillRect(Math.round(cx + Math.sin(a) * (15 - len)), Math.round(46 - Math.cos(a) * (15 - len)),
        1, 1);
      if (i % 3 === 0) {
        g.fillRect(Math.round(cx + Math.sin(a) * 13), Math.round(46 - Math.cos(a) * 13), 1, 1);
      }
    }
    g.fillStyle = '#b8bcc0'; g.beginPath(); g.arc(cx, 46, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a8f93'; g.beginPath(); g.arc(cx, 46, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e2e6e9'; g.fillRect(cx - 1, 46 - 9, 2, 4);      // the index mark
    g.fillStyle = '#2e3236'; g.fillRect(cx - 1, 33, 2, 4);          // the fiducial above it
    // THE SPOKE HANDLE, below the dial, where your hand goes
    g.fillStyle = '#5e6266'; g.beginPath(); g.arc(cx, 78, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a8f93'; g.beginPath(); g.arc(cx, 78, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5e6266'; g.beginPath(); g.arc(cx, 78, 5, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.fillStyle = '#b0b4b8';
      g.fillRect(Math.round(cx + Math.sin(a) * 4 - 1), Math.round(78 - Math.cos(a) * 4 - 1),
        Math.max(2, Math.round(Math.abs(Math.sin(a)) * 9)),
        Math.max(2, Math.round(Math.abs(Math.cos(a)) * 9)));
    }
    g.fillStyle = '#d0d4d8';
    for (let i = 0; i < 4; i++) {                                   // the spoke knobs
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.fillRect(Math.round(cx + Math.sin(a) * 13) - 2, Math.round(78 - Math.cos(a) * 13) - 2, 4, 4);
    }
    // the hinge-side bolt heads, and the maker's plate
    g.fillStyle = '#6e7276';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(11, 14 + i * 19, 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.20)';
    for (let i = 0; i < 5; i++) g.fillRect(9, 12 + i * 19, 3, 1);
    g.fillStyle = '#6a5c38'; g.fillRect(52, 12, 20, 9);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(52, 12, 20, 1);
    wordC(g, '1961', 62, 15, 1, '#d8cba0');
    dither(g, 80, 104, 60);
  }), 'detail');
  // the slab's edge: the locking bolts, which is the whole reason a vault door
  // is 30 cm thick and the detail you see most of it standing open
  const vaultEdgeT = declareSurface(pixTex(24, 96, (g) => {
    g.fillStyle = '#787c80'; g.fillRect(0, 0, 24, 96);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 2, 96);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(22, 0, 2, 96);
    for (let i = 0; i < 5; i++) {                                   // five throw bolts
      const y = 10 + i * 19;
      g.fillStyle = '#5e6266'; g.fillRect(4, y - 1, 16, 12);
      g.fillStyle = '#a4a8ac'; g.fillRect(6, y, 12, 9);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(6, y, 12, 1);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(6, y + 8, 12, 1);
    }
    dither(g, 24, 96, 30);
  }), 'detail');
  const vFaceM = ctx.flat(vaultFaceT);
  const vEdgeM = ctx.flat(vaultEdgeT);
  const vBackM = new THREE.MeshBasicMaterial({ color: 0x6e7276 });
  const vaultDoor = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H2, DOOR_TH),
    // [+x, -x, +y, -y, +z, -z] — the FACE is on -z, which `rotation.y = π + θ`
    // turns to point across the lobby. See the derivation above.
    [vEdgeM, vEdgeM, vEdgeM, vEdgeM, vBackM, vFaceM]);
  vaultDoor.rotation.y = Math.PI + THETA;
  put(vaultDoor,
    HINGE_X - (DOOR_W / 2) * Math.cos(THETA), DOOR_H2 / 2,
    HINGE_Z + (DOOR_W / 2) * Math.sin(THETA));
  // the barrel hinges it hangs on, on the jamb
  for (const hy of [0.30, DOOR_H2 / 2, DOOR_H2 - 0.30]) {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10), steelDarkM),
      HINGE_X, hy, HINGE_Z + 0.06);
  }
  // a collider over the swung slab, so you cannot stand inside 30 cm of steel.
  // Sized off the same three numbers the mesh is placed from rather than typed.
  {
    const fx = HINGE_X - DOOR_W * Math.cos(THETA), fz = HINGE_Z + DOOR_W * Math.sin(THETA);
    solid((HINGE_X + fx) / 2, (HINGE_Z + fz) / 2,
      Math.abs(fx - HINGE_X) + DOOR_TH, Math.abs(fz - HINGE_Z) + DOOR_TH);
  }

  // ── inside the vault: safe-deposit boxes on three walls ───────────────────
  //
  // The reason to be able to walk in. Rows of bronze doors, each with two
  // keyholes and a number, which is what a safe-deposit nest actually looks
  // like — one keyhole is the bank's and one is yours, and that detail is the
  // whole idea of the object.
  const sdbT = declareSurface(pixTex(64, 80, (g) => {
    g.fillStyle = '#4a4034'; g.fillRect(0, 0, 64, 80);                 // the carcass behind
    const bw = 15, bh = 9;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      const x = 1 + c * (bw + 1), y = 1 + r * (bh + 1);
      g.fillStyle = r % 3 === 2 ? '#8a7a4e' : '#7a6a44';               // bronze, not uniform
      g.fillRect(x, y, bw, bh);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, y, bw, 1);
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(x, y + bh - 1, bw, 1);
      g.fillStyle = '#2e2a22';                                          // the two keyholes
      g.fillRect(x + 4, y + 4, 2, 2); g.fillRect(x + 9, y + 4, 2, 2);
      g.fillStyle = '#d8cba0'; g.fillRect(x + 2, y + 2, 3, 1);          // the number card
    }
    dither(g, 64, 80, 40);
  }), 'detail');
  const sdbM = ctx.flat(sdbT);
  /** a nest of boxes, `len` metres long, standing against a wall */
  const sdbNest = (lx: number, lz: number, len: number, along: 'x' | 'z') => {
    const geo = along === 'x'
      ? new THREE.BoxGeometry(len, 1.95, 0.16) : new THREE.BoxGeometry(0.16, 1.95, len);
    // the painted face goes on the two faces that point along the OTHER axis
    const m = along === 'x'
      ? [concreteM, concreteM, concreteM, concreteM, sdbM, sdbM]
      : [sdbM, sdbM, concreteM, concreteM, concreteM, concreteM];
    put(new THREE.Mesh(geo, m), lx, 1.02, lz);
    if (along === 'x') solid(lx, lz, len, 0.16); else solid(lx, lz, 0.16, len);
  };
  sdbNest(-hw + 0.08, (-hd + V_IN_Z1) / 2, V_IN_Z1 - (-hd) - 0.2, 'z');      // west wall
  sdbNest((-hw + V_IN_X1) / 2, -hd + 0.08, V_IN_X1 - (-hw) - 0.2, 'x');      // back wall
  sdbNest(V_IN_X1 - 0.08, (-hd + V_IN_Z1) / 2 - 0.35, 1.6, 'z');             // east wall, part
  // the coupon table and its chair: where you actually open the box
  {
    const TX = V_IN_X1 - 0.62, TZ = V_IN_Z1 - 0.55;
    bx(0.86, 0.05, 0.56, oakM, TX, 0.74, TZ);
    for (const sx of [-0.36, 0.36]) for (const sz of [-0.22, 0.22]) {
      bx(0.05, 0.72, 0.05, steelDarkM, TX + sx, 0.36, TZ + sz);
    }
    bx(0.30, 0.04, 0.22, paperM, TX - 0.1, 0.77, TZ);              // somebody's papers
    solid(TX, TZ, 0.94, 0.64);
    // a folding chair, and it is sittable, because every seat in this game is
    bx(0.42, 0.06, 0.40, steelDarkM, TX, 0.44, TZ - 0.78);
    bx(0.42, 0.44, 0.05, steelDarkM, TX, 0.69, TZ - 0.98);
    for (const sx of [-0.16, 0.16]) bx(0.04, 0.42, 0.04, steelM, TX + sx, 0.21, TZ - 0.62);
    ctx.seat({
      x: room.wx(TX), z: room.wz(TZ - 0.74), yaw: Math.PI, h: 0.47,
      approach: { x: room.wx(TX), z: room.wz(TZ - 1.2) },
      label: 'sit at the coupon table', ok: () => room.inside(),
    });
  }
  // the caged bulb, because a vault is not on the lobby's lighting circuit
  {
    const BX2 = (-hw + V_IN_X1) / 2, BZ = (-hd + V_IN_Z1) / 2;
    bx(0.14, 0.05, 0.14, steelDarkM, BX2, V_H - 0.03, BZ);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffeec4 })), BX2, V_H - 0.13, BZ);
    for (let i = 0; i < 6; i++) {                                   // the cage
      const a = (i / 6) * Math.PI * 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.20, 0.012), steelDarkM);
      put(w, BX2 + Math.sin(a) * 0.085, V_H - 0.13, BZ + Math.cos(a) * 0.085);
    }
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), haloM);
    gl.rotation.x = Math.PI / 2;
    put(gl, BX2, V_H - 0.30, BZ);
  }
  // VAULT over the throat, on the lobby side, so you know what it is before you
  // are close enough to read the boxes
  {
    const plateT = declareSurface(pixTex(56, 14, (g) => {
      g.fillStyle = '#3a3e42'; g.fillRect(0, 0, 56, 14);
      g.fillStyle = '#6a5c38'; g.fillRect(1, 1, 54, 12);
      g.fillStyle = 'rgba(255,255,255,0.26)'; g.fillRect(1, 1, 54, 1);
      wordC(g, 'VAULT', 28, 4, 2, '#efe4bc');
    }), 'sign');
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.90, 0.225), ctx.flat(plateT));
    put(plate, THROAT_CX, THROAT_H + 0.34, V_Z1 + 0.02);
  }

  // ══ THE TELLER LINE ════════════════════════════════════════════════════════
  //
  // The object the room is about. It runs from the vault's east face to the east
  // wall — 10.78 m, three windows — and the staff side is SEALED: the collider
  // goes from the front of the counter to the back wall, so there is no way
  // behind it and no 0.5 m slot beside it either. That is not a limitation, it
  // is what a teller line IS.
  // THE DEPTHS ARE SET BY THE LANE BETWEEN THEM, not chosen for the counter.
  // First pass put a 0.72 m counter at z -4.50 and the back bench at -5.38, which
  // left the teller 0.27 m to stand in — and the teller sprite was placed at
  // -5.05, inside the bench. A teller line is three things and a gap: counter,
  // GAP, back bench, wall. The gap is 0.84 m here, which is what one person and a
  // wheeled chair need, and it is derived below rather than assumed.
  const CTR_Z = -4.30, CTR_D = 0.68, CTR_H = 1.05;
  const CTR_X0 = V_X1, CTR_X1 = hw + 0.18;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;
  const CTR_FRONT = CTR_Z + CTR_D / 2;                   // -3.96, the customer face
  const CTR_BACK = CTR_Z - CTR_D / 2;                    // -4.64
  const BB_Z = -hd + 0.24, BB_D = 0.48, BB_H = 0.92;     // -5.76, spans -6.00…-5.52
  const BB_FRONT = BB_Z + BB_D / 2;                      // -5.52
  const LANE = CTR_BACK - BB_FRONT;                      // 0.88 m of staff side
  const TELLER_Z = (CTR_BACK + BB_FRONT) / 2;            // stood in the middle of it
  const WINDOW_X = [-1.4, 1.8, 5.0];

  // the counter front: oak with raised fielded panels, which is the one warm
  // surface a customer is ever within arm's reach of in here
  const panelT = declareSurface(pixTex(96, 42, (g) => {
    g.fillStyle = '#6a4f30'; g.fillRect(0, 0, 96, 42);
    g.fillStyle = 'rgba(0,0,0,0.14)';                               // the grain
    for (let i = 0; i < 34; i++) g.fillRect(0, (i * 5 + (i % 3)) % 42, 96, 1);
    // three fielded panels per 2.4 m bay
    for (let p = 0; p < 3; p++) {
      const x = 4 + p * 30;
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(x, 6, 26, 30);
      g.fillStyle = '#715534'; g.fillRect(x + 2, 8, 22, 26);
      g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(x + 2, 8, 22, 1);
      g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(x + 2, 8, 1, 26);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 2, 33, 22, 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 96, 2);   // the top rail lit
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(0, 39, 96, 3);        // the kick in shadow
    dither(g, 96, 42, 60);
  }), 'detail');
  panelT.wrapS = THREE.RepeatWrapping;
  const panelMat = (len: number) => {
    const t = panelT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(len / 2.4)), 1);
    t.needsUpdate = true;
    return ctx.flat(t);
  };
  // the top: dark polished stone, with the one long highlight a polished slab has
  const topT = declareSurface(pixTex(64, 20, (g) => {
    g.fillStyle = '#3e3a34'; g.fillRect(0, 0, 64, 20);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 3, 64, 2);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 6, 64, 1);
    for (const [col, n] of [['#4e4a42', 90], ['#2e2b26', 70]] as [string, number][]) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) g.fillRect((i * 17) % 64, (i * 23) % 20, 2, 1);
    }
    dither(g, 64, 20, 26);
  }), 'detail');
  topT.wrapS = topT.wrapT = THREE.RepeatWrapping;
  const topMat = (len: number) => {
    const t = topT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(len / 1.6)), 1);
    t.needsUpdate = true;
    return ctx.flat(t);
  };

  {
    const front = panelMat(CTR_W), top = topMat(CTR_W);
    // the body, then a stone top with a lip standing proud of the panelling —
    // the lip is what you rest your elbows and your cheque book on
    put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, CTR_H - 0.06, CTR_D),
      [front, front, top, front, front, front]), CTR_CX, (CTR_H - 0.06) / 2, CTR_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.06, CTR_D + 0.10),
      [top, top, top, top, top, top]), CTR_CX, CTR_H - 0.03, CTR_Z + 0.05);
    // a bronze foot rail along the customer side, at the height they always are
    put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.05, 0.05), bronzeM),
      CTR_CX, 0.16, CTR_FRONT + 0.06);
    // SEALED, front face to back wall, in ONE box. Per-window boxes would carve
    // slots to wedge into, which is what the diner's booths taught this project.
    solid(CTR_CX, (CTR_FRONT + -hd - 0.18) / 2, CTR_W, CTR_FRONT - (-hd - 0.18));
  }

  // ── the three windows ─────────────────────────────────────────────────────
  //
  // Screen, grille, deal tray, number plate. Window 3 is CLOSED, with the sign
  // propped on the counter — a bank where all three windows are staffed at four
  // in the afternoon is a bank with a payroll it does not have, and the closed
  // one is what makes the other two read as open.
  const grilleT = declareSurface(pixTex(40, 28, (g) => {
    g.fillStyle = '#4a4230'; g.fillRect(0, 0, 40, 28);           // the dark behind the bars
    for (let x = 2; x < 38; x += 4) {
      g.fillStyle = '#7a6a44'; g.fillRect(x, 2, 2, 24);          // BANK_BRONZE
      g.fillStyle = 'rgba(255,255,255,0.24)'; g.fillRect(x, 2, 1, 24);
    }
    g.fillStyle = '#8a7a4e'; g.fillRect(0, 0, 40, 2); g.fillRect(0, 26, 40, 2);
    dither(g, 40, 28, 16);
  }), 'detail');
  const grilleM = ctx.flat(grilleT);
  // GLASS: transparent, and NO alphaTest. GOTCHAS 22 — a cut-out and a
  // translucency are different things, and setting both moves the pane into the
  // sorted transparent queue for nothing.
  const glassM = new THREE.MeshBasicMaterial({
    color: 0x9fb2b8, transparent: true, opacity: 0.24, side: THREE.DoubleSide });

  WINDOW_X.forEach((wx, i) => {
    const open = i < 2;
    const SCREEN_TOP = 2.30;
    // the screen: a pane in a bronze frame from the counter top to head height
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.30, SCREEN_TOP - CTR_H - 0.06), glassM);
    put(pane, wx, (SCREEN_TOP + CTR_H + 0.06) / 2, CTR_Z - 0.10);
    for (const sx of [-0.70, 0.70]) {                             // mullion posts
      bx(0.06, SCREEN_TOP - CTR_H, 0.08, bronzeM, wx + sx, (SCREEN_TOP + CTR_H) / 2, CTR_Z - 0.10);
    }
    bx(1.46, 0.07, 0.08, bronzeM, wx, SCREEN_TOP, CTR_Z - 0.10);   // head rail
    bx(1.46, 0.05, 0.08, bronzeM, wx, CTR_H + 0.06, CTR_Z - 0.10);
    // the grille, at the height you talk through. A thin box with the painted
    // face on BOTH z faces, so it is right from the teller's side too — and the
    // pattern is symmetric, so §10's mirroring cannot bite it.
    put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.05),
      [bronzeM, bronzeM, bronzeM, bronzeM, grilleM, grilleM]), wx, 1.62, CTR_Z - 0.10);
    // the deal tray: a dished slot cut into the top, with a bronze lip at the
    // front edge. This is the part of a teller window you actually use.
    bx(0.52, 0.05, 0.30, new THREE.MeshBasicMaterial({ color: 0x24221e }),
      wx, CTR_H - 0.02, CTR_Z + 0.16);
    bx(0.58, 0.025, 0.05, bronzeM, wx, CTR_H + 0.02, CTR_FRONT - 0.06);
    // the number plate over the window, and its lamp
    const numT = declareSurface(pixTex(20, 24, (g) => {
      g.fillStyle = '#2a2e32'; g.fillRect(0, 0, 20, 24);
      g.fillStyle = open ? '#dfe6c8' : '#5a5e56'; g.fillRect(2, 2, 16, 20);
      wordC(g, String(i + 1), 10, 8, 2, open ? '#24282c' : '#3e423c');
    }), 'sign');
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.29), ctx.flat(numT));
    put(num, wx, 2.56, CTR_Z - 0.14);
    if (open) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), haloM);
      put(gl, wx, 2.56, CTR_Z - 0.06);
    } else {
      // THE FOLDED CARD ON THE COUNTER. A tented card, not a plane: two faces
      // leaning against each other, which is the only way a card stands up on a
      // counter — and it means the object reads as a card from any angle rather
      // than vanishing edge-on. Card is the one thing in this room that is not
      // square to the walls, and only because card cannot help it.
      const closedT = declareSurface(pixTex(48, 18, (g) => {
        g.fillStyle = '#e4dfcc'; g.fillRect(0, 0, 48, 18);
        g.fillStyle = '#8a2c22'; g.fillRect(0, 0, 48, 2); g.fillRect(0, 16, 48, 2);
        wordC(g, 'CLOSED', 24, 6, 2, '#2e2a24');
        dither(g, 48, 18, 8);
      }), 'sign');
      // The two faces are placed so their TOP edges coincide and their bottoms
      // splay — a tent, not a V. Written as the arithmetic (`- sin(lean) * half`)
      // rather than a nudged offset, because I had the sign the other way round
      // first and got a card standing on its point.
      const CARD_H = 0.17, HALF = CARD_H / 2;
      for (const lean of [-0.42, 0.42]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, CARD_H),
          new THREE.MeshBasicMaterial({ map: closedT, side: THREE.DoubleSide }));
        face.rotation.x = lean;
        put(face, wx, CTR_H + HALF * Math.cos(lean),
          CTR_Z + 0.14 - Math.sin(lean) * HALF);
      }
    }
  });

  // ── the back bench, behind the line ───────────────────────────────────────
  //
  // What you see OVER the counter, which is most of what says people work here:
  // cash drawers, two adding machines, a coin tray, banded straps, and the
  // stacked deposit-slip boxes nobody has put away.
  {
    const BB_W = CTR_W - 0.4;
    const bbFront = panelMat(BB_W), bbTop = topMat(BB_W);
    put(new THREE.Mesh(new THREE.BoxGeometry(BB_W, BB_H, BB_D),
      [bbFront, bbFront, bbTop, bbFront, bbFront, bbFront]), CTR_CX, BB_H / 2, BB_Z);
    // the drawer bank, its fronts standing 1 cm PROUD of the carcass. Buried
    // 1 cm behind it they would be invisible, which is the fault that has now
    // cost this project a confessional, a font and a LOANS sign.
    for (let i = 0; i < 7; i++) {
      const x = CTR_X0 + 0.9 + i * 1.4;
      if (x > CTR_X1 - 0.5) break;
      bx(0.52, 0.16, 0.03, oakDarkM, x, 0.62, BB_FRONT + 0.01);
      bx(0.16, 0.03, 0.03, bronzeM, x, 0.62, BB_FRONT + 0.03);
    }
    // two adding machines with their till rolls, and a coin tray with banded
    // straps in it — what you can actually see over a 1.05 m counter
    for (const mx of [-1.4, 3.4]) {
      bx(0.30, 0.10, 0.26, new THREE.MeshBasicMaterial({ color: 0xd8d2c0 }),
        mx, BB_H + 0.05, BB_Z);
      bx(0.24, 0.05, 0.16, new THREE.MeshBasicMaterial({ color: 0x54504a }),
        mx, BB_H + 0.12, BB_Z - 0.04);
      bx(0.07, 0.02, 0.20, paperM, mx + 0.16, BB_H + 0.11, BB_Z + 0.02);
    }
    bx(0.44, 0.06, 0.28, steelDarkM, 1.8, BB_H + 0.03, BB_Z);
    for (let i = 0; i < 4; i++) {
      bx(0.16, 0.035, 0.11, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xc8b86a : 0xb8c0c8 }),
        1.8 - 0.18 + (i % 2) * 0.36, BB_H + 0.08 + Math.floor(i / 2) * 0.04, BB_Z + 0.02);
    }
    // THE BOXES OF SLIPS, in the staff lane behind the CLOSED window — not on
    // the floor against the back wall, where they would have stood inside the
    // back bench. Behind window 3 on purpose: that window is shut, so the space
    // in front of it is where the overflow goes, and the two details explain
    // each other.
    for (const [sx, n] of [[6.2, 3], [5.5, 2]] as [number, number][]) {
      for (let i = 0; i < n; i++) {
        bx(0.56, 0.28, 0.40, new THREE.MeshBasicMaterial({ color: 0x8a7a5c }),
          sx, 0.14 + i * 0.29, TELLER_Z);
        bx(0.58, 0.03, 0.42, new THREE.MeshBasicMaterial({ color: 0x9a8a6a }),
          sx, 0.29 + i * 0.29, TELLER_Z);
      }
    }
  }

  // ── FIRST FEDERAL over the counter, and a clock above it ──────────────────
  //
  // The thing you read when you walk in. Applied letters on a dark bronze-backed
  // panel, drawn from the block font rather than with fillText, so at 3 m across
  // the room they are texels and not a grey smear.
  {
    const nameT = declareSurface(pixTex(160, 34, (g) => {
      g.fillStyle = '#2e3236'; g.fillRect(0, 0, 160, 34);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 160, 1);
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(0, 33, 160, 1);
      wordC(g, 'FIRST FEDERAL', 80, 5, 3, 'rgba(0,0,0,0.45)');       // the drop shadow
      wordC(g, 'FIRST FEDERAL', 79, 4, 3, '#c9ccd0');
      wordC(g, 'SAVINGS & LOAN', 80, 24, 1, '#8a8f93');
    }), 'sign');
    const name = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.83), ctx.flat(nameT));
    put(name, CTR_CX, 2.20, -hd + 0.06);
    bx(4.02, 0.95, 0.04, new THREE.MeshBasicMaterial({ color: 0x24282c }),
      CTR_CX, 2.20, -hd + 0.03);
  }
  // A CLOCK THAT TELLS THE TIME — through the kit, so it agrees with the
  // wristwatch and with every other face in the world. A bank has a clock
  // everybody in the queue can see, and this one is where they can see it.
  room.clock({ lx: CTR_CX, y: 3.02, lz: -hd + 0.08, r: 0.26 });

  // ── the people ────────────────────────────────────────────────────────────
  //
  // From the atlas, through the kit — never hand-painted on a plane (GOTCHAS 21;
  // four rooms shipped cardboard before that was written down). Three, which is
  // what a branch has at half past three: one teller working, one customer being
  // served, and the loan officer at her desk (below, with the loan).
  //
  // EVERY FACING IS DERIVED from the thing the person is looking at, not typed
  // (GOTCHAS 33). `person` takes atan2(vx, vz) with 0 = +z, so the derivation is
  // atan2(target.x - mine.x, target.z - mine.z) and BOTH of these look at the
  // counter — from opposite sides, which is the whole point of a teller window.
  const faceAt = (mx: number, mz: number, tx: number, tz: number) =>
    Math.atan2(tx - mx, tz - mz);
  // the teller, behind window 2, looking out over the counter
  room.person(
    { jacket: '#5c6a76', pants: '#3a3e44', skin: '#8d5a34', hair: '#20180f',
      fit: 'plain', cut: 'crop', build: 0, stride: 2 },
    WINDOW_X[1], TELLER_Z,
    { facing: faceAt(WINDOW_X[1], TELLER_Z, WINDOW_X[1], CTR_FRONT), h: 1.00, w: 0.98 });
  // and somebody being served at window 1, on the customer side, looking in
  const CUST_Z = CTR_FRONT + 0.52;
  room.person(
    { jacket: '#6a5a48', pants: '#4a4640', skin: '#f0cba4', hair: '#7a6242',
      fit: 'coat', cut: 'short', build: 1, stride: 2 },
    WINDOW_X[0], CUST_Z,
    { facing: faceAt(WINDOW_X[0], CUST_Z, WINDOW_X[0], CTR_Z), h: 1.04, w: 1.05 });

  // ── skirting, on the walls that have one ──────────────────────────────────
  const skirtM = new THREE.MeshBasicMaterial({ color: 0x5c4a2e });
  bx(room.W, 0.12, 0.03, skirtM, 0, 0.06, hd - 0.015);            // front wall
  bx(0.03, 0.12, room.D, skirtM, hw - 0.015, 0.06, 0);            // east wall
}

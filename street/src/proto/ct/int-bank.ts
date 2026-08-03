import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
// K's shared panel cabinet. SAFE TO IMPORT FROM A ROOM, and worth saying why
// rather than hoping: `ct/doors.ts` globs `./int-*.ts` EAGERLY, and any room in
// an import cycle with it resolves to an undefined namespace and has its DOOR
// dropped SILENTLY — in the BUILT BUNDLE only, which is the worst way round and
// is how SEVENS was lost (GOTCHAS 28). `ct/hud.ts` imports three.js and the
// build stamp and nothing else, so there is no path back. Verified against the
// bundle with scripts/doors-declared.mjs, not assumed.
import { makePanel, UI } from './hud';
// THE DOOR'S LOOK, READ FROM WHERE THE FACADE PAINTS IT. Not a cycle for the
// same reason `./hud` above is safe: `ct/bank.ts` imports paint/rng/tex-world/
// civic/ctx/atm and nothing that globs `./int-*.ts`, so there is no path back
// to this module while `ct/doors.ts` is still resolving its glob. Verified
// against the built bundle with scripts/doors-declared.mjs, not assumed.
import { BANK_DOOR } from './bank';
import { leafPair } from './vice';

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
 *
 * `leaf` below is BUILT FROM `BANK_DOOR`, not retyped — that used to be a
 * comment's promise ("read from there rather than matched by eye") with no
 * import behind it, which is how the user found a single brown timber door
 * with a knob behind a brass double door with push-bars. See `BANK_DOOR` in
 * `ct/bank.ts` for the one place this is now written down.
 */
export const DOOR: DoorDecl = {
  building: 'FIRST FEDERAL', w: 19.2, cz: 4.6, side: -1, at: 0,
  leaf: {
    clearW: BANK_DOOR.clearW, h: BANK_DOOR.h, leaves: BANK_DOOR.leaves,
    frame: { colour: BANK_DOOR.bronze, material: 'brass' },
    glazing: BANK_DOOR.glazing,
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

/**
 * WHAT FIRST FEDERAL LENDS, AND AT WHAT PRICE — declared once, at module scope,
 * because TWO things in this room quote it: the loan officer at her desk and the
 * RATE BOARD on the east wall. Those are exactly the two consumers that come to
 * disagree if each carries its own copy, which is the fault this project has now
 * paid for four times over — the door position, the door leaf, the ATM's u, the
 * facade's window. One authoring, both readers.
 *
 * The rate FALLS AS THE AMOUNT RISES, which is true of a 1997 personal loan and
 * is the reason the amount is worth choosing at all.
 */
const AMOUNTS = [200, 500, 1000, 2500, 5000];
const RATE: Record<number, number> = { 200: 13.5, 500: 12.5, 1000: 11.25, 2500: 9.75, 5000: 8.9 };
/** the headline the board quotes: an unsecured personal loan of $500 */
const HEADLINE_RATE = RATE[500];

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

  // ── the door itself, matched to the one outside ────────────────────────────
  //
  // The kit (`ct/interior.ts`, F's) cuts the wall opening at `DOOR.leaf`'s
  // width and height — that part already worked, because the SIZE was
  // declared correctly even before this fix. What it hangs IN that opening is
  // its own default: a single hardcoded brown timber leaf with a small round
  // knob, regardless of what the room declared. That default is exactly what
  // the user saw and it is what four other rooms (casino, hotel, pawn) already
  // work around the same way: hide the kit's leaf, hang the room's own.
  //
  // Everything below reads `BANK_DOOR` — the same object `ct/bank.ts` paints
  // its own leaf from — so the two faces cannot drift back apart by a builder
  // matching one to the other by eye.
  const DW = BANK_DOOR.clearW, DH = Math.min(BANK_DOOR.h, room.H - 0.2), dAt = room.doorAt;
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
    else console.warn(`[interior:bank] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the bank now has both the kit door and its own. ct/interior.ts changed shape.');
  }
  // the brass surround: jambs and head, the granite portal's frame repeated on
  // the inside face — same shape as the casino's gold surround, brass instead
  // of gold. Named `doorFrameM`/`doorFrameDarkM` rather than `bronzeM` because
  // the palette below declares its own `bronzeM` for the rest of the room's
  // joinery — same colour, kept as two materials because Three.js materials
  // are mutable handles and the door and the teller line should not share one.
  const doorFrameM = new THREE.MeshBasicMaterial({ color: BANK_DOOR.bronze });
  const doorFrameDarkM = new THREE.MeshBasicMaterial({
    color: new THREE.Color(BANK_DOOR.bronze).multiplyScalar(0.72) });
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.34, 0.16, 0.10), doorFrameM), dAt, DH + 0.06, hd - 0.06);
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.34, 0.05, 0.11), doorFrameDarkM), dAt, DH - 0.03, hd - 0.06);
  for (const sx of [-1, 1]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.15, DH + 0.16, 0.10), doorFrameM),
      dAt + sx * (DW / 2 + 0.10), (DH + 0.16) / 2, hd - 0.06);
  }
  // two leaves, hinged at the jambs and standing a little open — dark glass in
  // a brass frame, with a vertical brass push-bar at the FREE edge of each
  // leaf. The push-bar sits near u=1 of this canvas because `leafPair`'s own
  // doc requires the handle at the free edge (away from the hinge) for BOTH
  // leaves after its mirror — see ct/vice.ts.
  const bronzeCss = '#' + BANK_DOOR.bronze.toString(16).padStart(6, '0');
  const bankLeafT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = bronzeCss; g.fillRect(0, 0, 24, 56);               // frame border
    g.fillStyle = BANK_DOOR.glassDark; g.fillRect(2, 2, 20, 52);
    g.fillStyle = BANK_DOOR.glassHighlight; g.fillRect(3, 3, 7, 48);
    g.fillStyle = BANK_DOOR.hardware; g.fillRect(17, 20, 3, 16);   // the push-bar
    dither(g, 24, 56, 40);
  }), 'detail');
  const bankLeafM = new THREE.MeshBasicMaterial({ map: bankLeafT, side: THREE.DoubleSide });
  leafPair(put, bankLeafM, dAt, DW, DH, hd - 0.12, 0.55, 'bank', 0.03);

  // ── the palette, named once ────────────────────────────────────────────────
  const BRONZE = BANK_DOOR.bronze;  // ct/bank.ts BANK_DOOR.bronze — one bronze, inside and out
  const OAK = 0x6a4f30, OAK_DARK = 0x503a22;
  const STONE_TOP = 0x3e3a34;       // the counter's polished top
  const STEEL = 0xa8acb0, STEEL_DARK = 0x5e6266;
  const bronzeM = new THREE.MeshBasicMaterial({ color: BRONZE });
  const steelM = new THREE.MeshBasicMaterial({ color: STEEL });
  const steelDarkM = new THREE.MeshBasicMaterial({ color: STEEL_DARK });
  const oakM = new THREE.MeshBasicMaterial({ color: OAK });
  const oakDarkM = new THREE.MeshBasicMaterial({ color: OAK_DARK });
  const paperM = new THREE.MeshBasicMaterial({ color: 0xe6e2d4 });

  /**
   * "THIS FACE IS MEANT TO BE LOOKED AT."
   *
   * The queue's rule is blunt — *"a flat colour is not a material"* — and I broke
   * it twice in this room before measuring: the loan desk's client side was a
   * 1.9 x 0.74 m plate of one brown, and the back of the vault door was 3.69 m2
   * of one grey on the room's headline object.
   *
   * A blanket "nothing untextured over N m2" check cannot work here, because most
   * of the big flat faces in any room are the UNDERSIDES and BACKS of boxes and a
   * probe cannot tell those from the ones you stand in front of. So the room says
   * which is which, and `M-bank-int-walk.mjs` asserts that every face declared
   * here carries paint — a positive claim, with a population floor, which is what
   * GOTCHAS 34 asks for over an absence that is free on an empty set.
   */
  const skin = <T extends THREE.Object3D>(m: T, what: string): T => {
    m.userData.bankSkin = what;
    return m;
  };
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
  /** the width `word` will draw `s` at, before drawing it */
  const wordW = (s: string, px: number) => s.length * 4 * px - px;
  /**
   * AND IT COMPLAINS WHEN THE TEXT WILL NOT FIT.
   *
   * This room letters six things, and I shipped one of them clipped: the queue
   * sign's "PLEASE WAIT" wanted 86 texels on a 72-texel canvas, so it drew
   * "LEASE WAI" and looked deliberate. That is the same defect as the facade's
   * "BUY ERE AY ERE" — a glyph run silently walking off the edge of a canvas —
   * and it is invisible in code and obvious in a screenshot only if you happen
   * to be able to read it at that distance.
   *
   * `g.canvas.width` is right there, so the guard costs nothing and it covers
   * every sign in the file rather than the one I caught.
   */
  const fits = (g: CanvasRenderingContext2D, s: string, px: number, x0: number) => {
    const w = wordW(s, px);
    if (x0 >= 0 && x0 + w <= g.canvas.width) return true;
    console.warn(`[interior:bank] "${s}" needs ${w} texels at x ${x0} on a `
      + `${g.canvas.width}-texel canvas — it will be CLIPPED`);
    return false;
  };
  /** draw `s` at (x, y) with `px`-sized texels; returns the width it drew */
  const word = (g: CanvasRenderingContext2D, s: string, x: number, y: number,
                px: number, col: string) => {
    fits(g, s, px, x);
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
                 px: number, col: string) =>
    word(g, s, Math.round(cx - wordW(s, px) / 2), y, px, col);

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
    // THE CHIPS ARE THE RIGHT SIZE AND WERE THE WRONG CONTRAST. At 26.7 px/m a
    // 1-texel chip is a 3.7 cm aggregate, which is real terrazzo — but #5e5a52
    // against a #9a968c screed is 40% darker, and at the grazing angles you see a
    // floor from standing height those dark texels string together into
    // diagonals that read as SCRATCHES rather than as stone. Same family as
    // GOTCHAS 4: the fault is not the detail, it is detail at a contrast the
    // sampling cannot hold. Range pulled in to about half, and the darkest tone
    // thinned out, so it reads as aggregate from a metre and as tone from four.
    for (const [col, n, s] of [['#a8a498', 210, 2], ['#8a867c', 170, 2],
                               ['#9e9a8e', 150, 1], ['#7c786e', 60, 1]] as [string, number, number][]) {
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
  skin(put(floor, 0, 0.012, 0), 'terrazzo floor');

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
  skin(put(ceil, 0, room.H - 0.02, 0), 'acoustic ceiling');

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
  // This canvas was one MATERIAL shared, unrepeated, across four faces of very
  // different real size — the 3.0 m east wall, two front-wall slivers under
  // 0.9 m each, and the 3.4 x 3.0 m roof. A ClampToEdge texture stretched once
  // across each of those reads its six speckle blotches at a different
  // physical size on every face, which is exactly GOTCHAS 5 (repeat must derive
  // from the surface's real metres) — and exactly what turned poured-concrete
  // form lines and aggregate into what looks like scattered random dashes.
  // `panelMat`/`topMat` above set the local pattern: clone, tile in real
  // metres, one material per run length. Same move here, at a tile chosen so
  // the form-board bands read at roughly the scale drawn (8 bands / 40 px, so
  // ~1.3 m of wall per texture repeat keeps a board close to real height).
  const CONCRETE_TILE_M = 1.3;
  const concreteMat = (wMeters: number, hMeters: number) => {
    const t = concreteT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(wMeters / CONCRETE_TILE_M)),
      Math.max(1, Math.round(hMeters / CONCRETE_TILE_M)));
    t.needsUpdate = true;
    return ctx.flat(t);
  };
  // Small incidental faces (the safe-deposit nest's end caps, top and bottom —
  // never more than ~0.2 m of any one, never what a player is looking at) keep
  // the plain unrepeated material; they are not the surfaces the row is about.
  const concreteM = ctx.flat(concreteT);

  // the east wall, full height of the strongroom
  const eastWallLen = V_Z1 - (-hd);
  skin(bx(V_T, V_H, eastWallLen, concreteMat(eastWallLen, V_H),
    V_X1 - V_T / 2, V_H / 2, (V_Z1 + -hd) / 2), 'vault east wall');
  solid(V_X1 - V_T / 2, (V_Z1 + -hd) / 2, V_T, V_Z1 - (-hd));
  // the front wall, in two pieces either side of the throat, plus a header
  {
    const wSeg = (x0: number, x1: number) => {
      if (x1 - x0 <= 0.001) return;
      skin(bx(x1 - x0, V_H, V_T, concreteMat(x1 - x0, V_H), (x0 + x1) / 2, V_H / 2, V_Z1 - V_T / 2),
        'vault front wall');
      solid((x0 + x1) / 2, V_Z1 - V_T / 2, x1 - x0, V_T);
    };
    wSeg(-hw, THROAT_X0);
    wSeg(THROAT_X1, V_IN_X1);
    // the header over the opening — and NOT a collider, so the throat stays a
    // way through rather than a hole with a box in it (GOTCHAS 8)
    bx(THROAT_W, V_H - THROAT_H, V_T, concreteMat(THROAT_W, V_H - THROAT_H),
      THROAT_CX, THROAT_H + (V_H - THROAT_H) / 2, V_Z1 - V_T / 2);
  }
  // the roof slab, which is what makes it read as a box in a taller room
  const roofW = hw + V_X1, roofD = V_Z1 - (-hd);
  skin(bx(roofW, 0.18, roofD, concreteMat(roofW, roofD),
    (-hw + V_X1) / 2, V_H + 0.09, (V_Z1 + -hd) / 2), 'vault roof');

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
  // BRUSHED, not one tone. The architrave lines the reveal of the room's headline
  // object, so a jamb's inner face is 1.03 m2 of polished steel a player stands a
  // metre from — measured, and it was the second-largest flat colour in the room.
  // A brushed grain is the honest texture for it: real polished stone-cut steel
  // has a directional finish, and at 0.3 m of section a grain is all it can carry
  // (GOTCHAS 4 forbids dither on anything this thin).
  const archT = declareSurface(pixTex(24, 64, (g) => {
    g.fillStyle = '#a8acb0'; g.fillRect(0, 0, 24, 64);
    for (let i = 0; i < 40; i++) {                        // the drawn direction
      const y = (i * 13) % 64;
      g.fillStyle = i % 3 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      g.fillRect(0, y, 24, 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 2, 64);   // the lit arris
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(22, 0, 2, 64);
  }), 'detail');
  const archM = ctx.flat(archT);
  const ARCH_T = 0.12;                                   // architrave section
  const ARCH_D = V_T + 0.20;                             // wraps 0.10 proud each side
  const IN_X0 = THROAT_X0 + ARCH_T, IN_X1 = THROAT_X1 - ARCH_T;   // clear 1.26 m
  const IN_TOP = THROAT_H - ARCH_T;                      // clear 2.03 m
  for (const jx of [THROAT_X0 + ARCH_T / 2, THROAT_X1 - ARCH_T / 2]) {
    skin(bx(ARCH_T, THROAT_H, ARCH_D, archM, jx, THROAT_H / 2, V_Z1 - V_T / 2), 'vault jamb');
  }
  skin(bx(IN_X1 - IN_X0, ARCH_T, ARCH_D, archM, THROAT_CX, IN_TOP + ARCH_T / 2,
    V_Z1 - V_T / 2), 'vault head');
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
  // ── THE BACK OF THE DOOR, which is 3.69 m2 and I had left as one grey ────
  //
  // Measured: the largest untextured surface a player can actually see in this
  // room, and it is on the room's headline object. A door standing open at 100
  // degrees shows its INNER face across the lobby, so "the back" is not the
  // hidden side — it is half of what you look at.
  //
  // What is on the inside of a vault door: the bolt-work carrier plate, the
  // spindle boss the dial turns through, an emergency release handle, and the
  // ventilator somebody bolted on after the 1961 date on the front. No dial and
  // no spoke wheel — those are on the outside, and putting them on both faces is
  // the mistake that makes a thing read as a sticker.
  const vaultBackT = declareSurface(pixTex(80, 104, (g) => {
    g.fillStyle = '#6e7276'; g.fillRect(0, 0, 80, 104);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 80, 2);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 102, 80, 2);
    // the carrier plate, bolted on, with the bolt-work bars running off it
    g.fillStyle = '#5e6266'; g.fillRect(14, 22, 52, 60);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(14, 22, 52, 1);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(14, 81, 52, 1);
    g.fillStyle = '#7e8286';
    for (let i = 0; i < 5; i++) g.fillRect(2, 14 + i * 19, 14, 7);      // to the bolts
    g.fillStyle = 'rgba(0,0,0,0.26)';
    for (let i = 0; i < 5; i++) g.fillRect(2, 20 + i * 19, 14, 1);
    // the plate's own fixings
    g.fillStyle = '#4a4e52';
    for (const [bx2, by] of [[18, 26], [62, 26], [18, 78], [62, 78]]) {
      g.beginPath(); g.arc(bx2, by, 2, 0, Math.PI * 2); g.fill();
    }
    // the spindle boss the dial turns through, dead centre of the plate
    g.fillStyle = '#8a8f93'; g.beginPath(); g.arc(40, 44, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3e42'; g.beginPath(); g.arc(40, 44, 4, 0, Math.PI * 2); g.fill();
    // the emergency release: a stubby lever, and it is the one warm thing here
    g.fillStyle = '#8a6a2e'; g.fillRect(34, 60, 12, 4);
    g.fillStyle = '#a8853c'; g.fillRect(34, 60, 12, 1);
    g.fillStyle = '#3a3e42'; g.fillRect(44, 58, 4, 8);
    // the ventilator, bolted on later and not square to anything
    g.save(); g.translate(60, 92); g.rotate(0.06);
    g.fillStyle = '#5e6266'; g.fillRect(-10, -7, 20, 14);
    g.fillStyle = '#2a2e32';
    for (let i = 0; i < 4; i++) g.fillRect(-7, -4 + i * 3, 14, 2);
    g.restore();
    dither(g, 80, 104, 40);
  }), 'detail');
  const vFaceM = ctx.flat(vaultFaceT);
  const vEdgeM = ctx.flat(vaultEdgeT);
  const vBackM = ctx.flat(vaultBackT);
  const vaultDoor = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H2, DOOR_TH),
    // [+x, -x, +y, -y, +z, -z] — the FACE is on -z, which `rotation.y = π + θ`
    // turns to point across the lobby. See the derivation above.
    [vEdgeM, vEdgeM, vEdgeM, vEdgeM, vBackM, vFaceM]);
  vaultDoor.rotation.y = Math.PI + THETA;
  skin(vaultDoor, 'vault door');
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
    skin(put(new THREE.Mesh(geo, m), lx, 1.02, lz), 'safe-deposit boxes');
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
  // …and SAY SO if it ever stops being wide enough for the person standing in it.
  // This is the check for the bug I actually shipped into this file once, and it
  // lives beside the numbers rather than in a harness that might not be run.
  if (LANE < 0.70) {
    console.warn(`[interior:bank] the teller lane is ${LANE.toFixed(2)} m — the `
      + 'counter and the back bench have closed on the person standing between them');
  }
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
    skin(put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, CTR_H - 0.06, CTR_D),
      [front, front, top, front, front, front]), CTR_CX, (CTR_H - 0.06) / 2, CTR_Z),
      'teller counter');
    put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.06, CTR_D + 0.10),
      [top, top, top, top, top, top]), CTR_CX, CTR_H - 0.03, CTR_Z + 0.05);
    // a bronze foot rail along the customer side, at the height they always are
    put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.05, 0.05), bronzeM),
      CTR_CX, 0.16, CTR_FRONT + 0.06);
    // SEALED, front face to back wall, in ONE box. Per-window boxes would carve
    // slots to wedge into, which is what the diner's booths taught this project.
    //
    // It stops AT the back wall's inner face (-hd) rather than running through it
    // to -hd - T. Both hold the player, but overlapping the kit's own wall box
    // made this collider indistinguishable from it by predicate — my selftest
    // removed both and reported the player escaping 7 m past the back wall, which
    // is a true statement about a mutation I did not mean to make.
    solid(CTR_CX, (CTR_FRONT + -hd) / 2, CTR_W, CTR_FRONT - (-hd));
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

  // the middle window's grille, kept so the loan spot registered on it can
  // NAME it: a spot with no object gets a generic box drawn at its coordinate,
  // and this is the one a player walks up to first.
  let tellerGrille: THREE.Object3D | undefined;
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
    const gr = put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.05),
      [bronzeM, bronzeM, bronzeM, bronzeM, grilleM, grilleM]), wx, 1.62, CTR_Z - 0.10);
    if (i === 1) tellerGrille = gr;
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
    skin(put(new THREE.Mesh(new THREE.BoxGeometry(BB_W, BB_H, BB_D),
      [bbFront, bbFront, bbTop, bbFront, bbFront, bbFront]), CTR_CX, BB_H / 2, BB_Z),
      'back bench');
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
    // 3.05, NOT 2.20, and the reason is a collision that only shows up in a
    // photograph: the window number plates stand 1.5 m in front of this wall with
    // their tops at 2.705, and at 2.20 the sign spanned 1.785…2.615 — so the "2"
    // plate sat squarely across the middle of the lettering from anywhere in the
    // lobby. Two objects that never touch and still read as one mess.
    const NAME_H = 0.62, NAME_Y = 3.05;             // spans 2.74…3.36, clear of 2.705
    const name = new THREE.Mesh(new THREE.PlaneGeometry(3.9, NAME_H), ctx.flat(nameT));
    skin(put(name, CTR_CX, NAME_Y, -hd + 0.06), 'FIRST FEDERAL sign');
    bx(4.02, NAME_H + 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0x24282c }),
      CTR_CX, NAME_Y, -hd + 0.03);
  }
  // A CLOCK THAT TELLS THE TIME — through the kit, so it agrees with the
  // wristwatch and with every other face in the world. A bank has a clock
  // everybody in the queue can see, and this one is where they can see it.
  // …and the clock moves EAST, off the sign it was sitting on top of. Over the
  // closed window, where the queue can see it, which is where a bank hangs one.
  // r 0.34 — a 0.68 m face, not the 0.48 m shop clock I first hung. The queue
  // asked for "a big clock" in as many words and I had given it an ordinary one;
  // a bank clock is sized to be read from the back of a queue, and this one hangs
  // where the queue is looking.
  room.clock({ lx: 5.95, y: 2.80, lz: -hd + 0.08, r: 0.34 });

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

  // ══ THE LOAN DESK, AND APPLYING FOR A LOAN ═════════════════════════════════
  //
  // The second request: *enter the bank and APPLY FOR A LOAN*. It is built as
  // three interactions in the room rather than as a screen over it, because
  // every other verb in this world is an `[E]` on an object you can walk up to
  // and this one should not be the exception:
  //
  //   1. THE APPLICATION FORM on the desk — E cycles the amount.
  //   2. THE LOAN OFFICER across the desk — E hands it over. She approves or
  //      declines, and the decline says WHY.
  //   3. WINDOW 2 at the teller line — E collects the cash, and E pays it back.
  //
  // The third one is what makes it a bank rather than a vending machine: the
  // officer approves the loan and the TELLER counts it out, so the two halves of
  // the room are one system and the counter I built has a job.
  //
  // The money is real: `ctx.purse.cash`, the same number the wallet shows on
  // right-click and the same one A's ATM reads out on the pavement outside. Take
  // a loan and the ATM says so.
  //
  // WHY YOU LOOK AT TWO DIFFERENT THINGS. The form and the officer are separate
  // spots a foot apart, which works because the `[E]` dispatch sorts on
  // OFF-AXIS ANGLE first (`fp.ts`, `key = offAxis + d * 0.02`): sitting in the
  // client chair looking straight ahead you get HER, and looking down-left at
  // the desk you get the FORM. That is the interaction — you read the form, then
  // you look up and hand it over — and it is a property of the aim rule rather
  // than of radii I tuned.
  {
    const DESK_X = 4.4, DESK_Z = 1.70, DESK_W = 1.90, DESK_D = 0.90, DESK_H = 0.74;
    const OFF_Z = 0.82;                     // the officer's chair, the far side
    const CLI_Z = 2.62;                     // the client's chair, nearer the door
    // 0.22 rather than 0.35: at 0.35 the form's 0.40 m sheet hung 0.10 m off the
    // front edge of a 0.90 m desk. Derived off DESK_D so it stays on the desk if
    // the desk changes size.
    const FORM_X = DESK_X - 0.65, FORM_Z = DESK_Z + DESK_D / 4;

    // FIVE PER CENT DOWN, and the figure is set by the game's own economy rather
    // than by what sounds like a bank. You start with $14.50 (`crosstown.ts`), so
    // at ten per cent even the smallest loan is refused and the whole feature
    // reads as broken on first contact. At five per cent the $200 goes through
    // today and everything above it is something to save for — which is a
    // mechanic, where a locked door is not.
    const DOWN = 0.05;
    const OPEN_H = 9, CLOSE_H = 16;         // nine to four, and the clock is real
    const money = (n: number) => `$${n.toFixed(2)}`;
    const cents = (n: number) => +n.toFixed(2);

    let amountIdx = 0;
    let loan: { principal: number; owed: number; rate: number; collected: boolean } | null = null;
    const shut = () => {
      const h = ctx.clock.now().hour;
      return h < OPEN_H || h >= CLOSE_H;
    };

    // ── the desk ─────────────────────────────────────────────────────────────
    const veneerT = declareSurface(pixTex(72, 36, (g) => {
      g.fillStyle = '#7a5a36'; g.fillRect(0, 0, 72, 36);
      g.fillStyle = 'rgba(60,40,20,0.22)';                     // the grain, along the length
      for (let i = 0; i < 30; i++) {
        const y = (i * 7 + (i % 3) * 2) % 36;
        g.fillRect(0, y, 72, 1);
      }
      g.fillStyle = 'rgba(90,62,32,0.30)';
      for (let i = 0; i < 8; i++) g.fillRect((i * 11) % 72, (i * 5) % 36, 9, 2);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 72, 1);
      dither(g, 72, 36, 30);
    }), 'detail');
    const veneerM = ctx.flat(veneerT);
    const deskSideM = new THREE.MeshBasicMaterial({ color: 0x5a4228 });
    // VENEER ON EVERY FACE YOU CAN SEE, flat colour only underneath. The client
    // side of this desk was `deskSideM` — a 1.9 x 0.74 m plate of one brown,
    // which is the biggest surface in the room a player is ever within arm's
    // reach of, and the queue's rule is blunt about it: *"a flat colour is not a
    // material"*.
    skin(put(new THREE.Mesh(new THREE.BoxGeometry(DESK_W, DESK_H, DESK_D),
      [veneerM, veneerM, veneerM, deskSideM, veneerM, veneerM]),
      DESK_X, DESK_H / 2, DESK_Z), 'loan desk');
    // THE MODESTY PANEL STANDS PROUD, which is the whole point of it. I first put
    // it at `DESK_D / 2 - 0.03` — three centimetres INSIDE a solid box, so it was
    // building an object inside another object and could never be seen. That is
    // the same mistake as an enclosure over a fitting, which has now cost this
    // project a confessional, a font and a LOANS sign, and it is the reason to
    // look at a thing after adding it.
    bx(DESK_W - 0.16, 0.46, 0.03, veneerM, DESK_X, 0.29, DESK_Z + DESK_D / 2 + 0.015);
    bx(DESK_W - 0.16, 0.02, 0.035, new THREE.MeshBasicMaterial({ color: 0x8a6a44 }),
      DESK_X, 0.52, DESK_Z + DESK_D / 2 + 0.017);          // its lit top edge
    // and a pedestal of drawers under her end, fronts proud of the carcass
    for (let d = 0; d < 3; d++) {
      bx(0.52, 0.19, 0.03, veneerM, DESK_X + 0.58, 0.16 + d * 0.21, DESK_Z - DESK_D / 2 + 0.02);
      bx(0.18, 0.025, 0.03, bronzeM, DESK_X + 0.58, 0.16 + d * 0.21, DESK_Z - DESK_D / 2 + 0.04);
    }

    // the blotter, and the desk pad you would actually find under the paperwork
    bx(0.68, 0.012, 0.44, new THREE.MeshBasicMaterial({ color: 0x2e4438 }),
      DESK_X - 0.1, DESK_H + 0.006, DESK_Z + 0.06);

    // ── THE APPLICATION FORM ─────────────────────────────────────────────────
    //
    // A real object with real printing on it, not a white rectangle: a red rule
    // across the head, boxed fields, and a signature line at the foot. It is
    // face up on the client's side of the blotter, which is where a form you are
    // being asked to fill in actually sits.
    const formT = declareSurface(pixTex(34, 46, (g) => {
      g.fillStyle = '#eae5d2'; g.fillRect(0, 0, 34, 46);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 0, 34, 1);
      g.fillStyle = '#8a2c22'; g.fillRect(2, 3, 30, 2);
      wordC(g, 'LOAN', 17, 7, 1, '#2e2a24');
      g.fillStyle = 'rgba(70,62,50,0.55)';
      for (let i = 0; i < 5; i++) {                            // boxed fields
        g.fillRect(3, 15 + i * 5, 28, 1);
        g.fillRect(3, 15 + i * 5 - 3, 1, 3); g.fillRect(30, 15 + i * 5 - 3, 1, 3);
      }
      g.fillStyle = '#8a2c22'; g.fillRect(3, 40, 18, 1);       // the signature line
      g.fillStyle = 'rgba(70,62,50,0.40)'; g.fillRect(23, 39, 8, 3);
      dither(g, 34, 46, 8);
    }), 'sign');
    // LAID FLAT AND NOT SPUN, and the second half of that is the part worth
    // writing down because I added a `rotation.z = PI` to "turn it toward the
    // client" and it would have printed the form upside down for the only person
    // meant to sign it. `rotation.x = -PI/2` maps the plane's local +y to world
    // -z, and a reader in the client chair faces -z with their right hand at +x —
    // which is exactly the plane's own +x. So it already reads correctly from the
    // chair, and the extra half turn was a mirror the rotation had already paid
    // for (GOTCHAS 35, the same shape as flipping a back-to-back sign twice).
    const form = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.40), ctx.flat(formT));
    form.rotation.x = -Math.PI / 2;
    const formMesh = put(form, FORM_X, DESK_H + 0.014, FORM_Z);
    // the pen, on its bead chain, because a bank pen is always chained down
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.13, 6),
      new THREE.MeshBasicMaterial({ color: 0x22242a })), FORM_X + 0.21, DESK_H + 0.02, FORM_Z)
      .rotation.set(0, 0.5, Math.PI / 2);
    for (let i = 0; i < 7; i++) {
      put(new THREE.Mesh(new THREE.SphereGeometry(0.008, 5, 4), steelM),
        FORM_X + 0.26 + i * 0.035, DESK_H + 0.019, FORM_Z - 0.03 - i * 0.018);
    }

    // the nameplate, facing the client — a service sign, which is what a bank
    // desk actually carries
    const plateT = declareSurface(pixTex(64, 20, (g) => {
      g.fillStyle = '#3a3026'; g.fillRect(0, 0, 64, 20);
      g.fillStyle = '#7a6a44'; g.fillRect(1, 1, 62, 18);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(1, 1, 62, 1);
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(1, 18, 62, 1);
      wordC(g, 'LOANS', 32, 4, 2, '#efe4bc');
      wordC(g, 'NEW ACCOUNTS', 32, 14, 1, '#d8cba0');
    }), 'sign');
    room.sign(plateT, 0.42, 0.13,
      DESK_X - 0.62, DESK_H + 0.08, DESK_Z + DESK_D / 2 + 0.02);

    // a banker's lamp, an adding machine, the phone, a Rolodex, the folders and
    // a mug — her side of the desk, because that is whose desk it is
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10), bronzeM),
      DESK_X + 0.66, DESK_H + 0.01, DESK_Z - 0.22);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), bronzeM),
      DESK_X + 0.66, DESK_H + 0.13, DESK_Z - 0.22);
    bx(0.24, 0.09, 0.11, new THREE.MeshBasicMaterial({ color: 0x1f4436 }),
      DESK_X + 0.66, DESK_H + 0.28, DESK_Z - 0.22);            // the green glass shade
    bx(0.22, 0.05, 0.20, new THREE.MeshBasicMaterial({ color: 0xd8d2c0 }),
      DESK_X + 0.30, DESK_H + 0.025, DESK_Z - 0.26);           // adding machine
    bx(0.16, 0.03, 0.12, new THREE.MeshBasicMaterial({ color: 0x54504a }),
      DESK_X + 0.30, DESK_H + 0.06, DESK_Z - 0.28);
    bx(0.06, 0.015, 0.16, paperM, DESK_X + 0.30, DESK_H + 0.055, DESK_Z - 0.16);
    bx(0.22, 0.08, 0.19, new THREE.MeshBasicMaterial({ color: 0x2a2c30 }),
      DESK_X - 0.72, DESK_H + 0.04, DESK_Z - 0.24);            // the telephone
    bx(0.20, 0.035, 0.06, new THREE.MeshBasicMaterial({ color: 0x36383c }),
      DESK_X - 0.72, DESK_H + 0.10, DESK_Z - 0.24);            // the handset on it
    for (let i = 0; i < 5; i++) {                              // the coiled cord
      put(new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 4, 8),
        new THREE.MeshBasicMaterial({ color: 0x36383c })),
        DESK_X - 0.72, DESK_H + 0.02, DESK_Z - 0.12 + i * 0.035)
        .rotation.x = Math.PI / 2;
    }
    // the Rolodex: a drum of cards on a stand, and it is instantly nameable,
    // which is the standard this project holds every small object to
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 12), paperM),
      DESK_X + 0.02, DESK_H + 0.10, DESK_Z - 0.30).rotation.z = Math.PI / 2;
    for (const sx of [-0.085, 0.085]) {
      bx(0.02, 0.13, 0.13, steelDarkM, DESK_X + 0.02 + sx, DESK_H + 0.07, DESK_Z - 0.30);
    }
    for (let i = 0; i < 4; i++) {                              // the manila folders
      bx(0.30, 0.014, 0.22, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9a8a62 : 0x8a7a56 }),
        DESK_X - 0.34, DESK_H + 0.01 + i * 0.015, DESK_Z - 0.24 + i * 0.006);
    }
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.033, 0.09, 10),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c8 })), DESK_X + 0.46, DESK_H + 0.045, DESK_Z + 0.04);

    // ── the two chairs ───────────────────────────────────────────────────────
    const chair = (cz: number, col: number, backH: number, arms: boolean, faceZ: number) => {
      const m = new THREE.MeshBasicMaterial({ color: col });
      bx(0.50, 0.10, 0.48, m, DESK_X, 0.44, cz);
      // THE BACKREST GOES ON THE SIDE AWAY FROM THE DESK, derived from which way
      // the sitter faces rather than from a sign copied off the other chair —
      // that copy is how the park's benches ended up backwards (GOTCHAS 33).
      bx(0.50, backH, 0.07, m, DESK_X, 0.49 + backH / 2, cz - Math.sign(faceZ) * 0.21);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.40, 6), steelDarkM),
        DESK_X, 0.22, cz);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 10), steelDarkM),
        DESK_X, 0.03, cz);
      if (arms) for (const sx of [-0.27, 0.27]) {
        bx(0.05, 0.05, 0.34, m, DESK_X + sx, 0.63, cz);
        bx(0.05, 0.14, 0.05, steelDarkM, DESK_X + sx, 0.53, cz - Math.sign(faceZ) * 0.13);
      }
    };
    chair(OFF_Z, 0x3f4a56, 0.54, true, +1);        // hers: she faces +z, at the client
    chair(CLI_Z, 0x6a5c46, 0.44, false, -1);       // the client's: faces -z, at her

    // ONE collider for the desk and her chair, and a small one for the client's.
    // The gaps between per-object boxes are under the 0.72 m player and would
    // only carve slots to wedge into — the diner's booths taught this project
    // that one and the tax office repeated it.
    // 0.72 back off the desk's far edge, which is where her chair's base actually
    // ends — at 0.42 it stopped short and left a 0.25 m sliver of floor behind
    // the chair. Too narrow for the 0.72 m player to stand in, so harmless, but
    // it is the same shape of gap that put a standable slot behind the tax
    // office's bolted-down chairs.
    const OFF_BACK = DESK_Z - DESK_D / 2 - 0.72;
    solid(DESK_X, (OFF_BACK + DESK_Z + DESK_D / 2) / 2, 2.10,
      (DESK_Z + DESK_D / 2) - OFF_BACK);
    solid(DESK_X, CLI_Z, 0.62, 0.56);

    // ── the loan officer, seated, from the atlas ─────────────────────────────
    //
    // SEATED — H's pose, with the SEAT TOP passed as `y`, because the atlas's
    // seated origin is the hip and the kit owns the 0.445 m offset. And facing
    // DERIVED from the client's chair: move either chair and her head follows.
    room.person(
      { jacket: '#4a4650', pants: '#3a3640', skin: '#5c3a22', hair: '#2a1d14',
        fit: 'plain', cut: 'tied', build: 0, stride: 2 },
      DESK_X, OFF_Z,
      { seated: true, y: 0.44, facing: faceAt(DESK_X, OFF_Z, DESK_X, CLI_Z),
        h: 0.99, w: 0.97 });

    // ── and the client's chair is sittable, like every seat in this game ─────
    //
    // THE APPROACH IS TO THE SIDE, AND THAT IS THE WHOLE OF THIS COMMENT.
    //
    // `ctx.seat` registers the "sit down" prompt AT the approach point. I put
    // that point squarely in front of the desk — where a client naturally stands
    // — and it ate the loan officer: the `[E]` dispatch sorts on
    // `offAxis + d * 0.02`, and a spot you are standing ON has offAxis 0 and
    // d 0, so it beats anything further away however squarely you are looking at
    // it. Walking up to the desk offered "sit down", pressing E sat you down, and
    // then the only thing on offer was "stand up". The loan was unreachable from
    // the one position every player arrives in. GOTCHAS 8, and it took a walk to
    // find because it looks perfect in a screenshot.
    //
    // So you take the chair from its RIGHT, out of the 1.55 m of clear floor
    // between the desk and the east wall, and the space in front of the desk
    // belongs to the officer.
    //
    // AND THE LABEL NO LONGER PROMISES A CONVERSATION. It said "sit down with the
    // loan officer", which is a promise this engine cannot keep: the stand-up
    // spot is registered at the seat itself, so while you are seated it is at
    // d 0 and NOTHING else can ever win. No seat in this world can carry an
    // interaction you use while sitting on it. That is worth knowing beyond this
    // room — it is in my handoff for the desk — and here it means the business is
    // done standing, exactly like every other counter in the game.
    ctx.seat({
      x: room.wx(DESK_X), z: room.wz(CLI_Z), yaw: 0, h: 0.49,
      r: 0.8, approach: { x: room.wx(DESK_X + 1.10), z: room.wz(CLI_Z + 0.25) },
      label: 'sit in the client chair', ok: () => room.inside(),
    });

    // ── THE APPLICATION, on K's shared panel ────────────────────────────────
    //
    // My queue is explicit and it is right: *"K is building one shared full-screen
    // panel framework in ct/hud.ts for the ATM, the inventory and the slot
    // machine. Use it — a loan application on a different-looking panel would
    // stand out immediately."* So the cabinet, the freeze, the one-at-a-time rule,
    // ESC and the typeface are all K's, and what is mine is the paper inside the
    // glass.
    //
    // `chrome: 'cloth'` rather than `'machine'`, following the pockets: a machine
    // is a thing you WALK UP TO and this is a thing you are HOLDING — a form
    // across a desk. The ATM on the pavement outside is the machine; this is its
    // paperwork.
    //
    // AND THE FORM IS THE INTERFACE. The amount, the term, the rate, the monthly
    // payment, the security wanted and the cash you actually have are all on one
    // sheet, and the decision is STAMPED across it. A loan you are refused should
    // show you the two numbers that refused you, on the paper, rather than in a
    // prompt you have to remember.
    const TERM_MONTHS = 24;
    const owedOn = (a: number) => cents(a * (1 + RATE[a] / 100));
    let stamp: 'none' | 'approved' | 'declined' = 'none';

    // ══ ITEM 185: THE APPLICATION IS ON THE PAPER NOW ═══════════════════════
    //
    // *"the load [loan] application process should also be like atm and whatnot.
    // you sit and its the loan process as an integrated overlay."*
    //
    // ⚠ THIS REVERSES THE DECISION IN THE BLOCK COMMENT ABOVE, BY REQUEST.
    // That comment says the loan was built as three `[E]`s in the room "rather
    // than as a screen over it, because every other verb in this world is an
    // `[E]` on an object you can walk up to and this one should not be the
    // exception". The reasoning was sound when it was written; the user has
    // since asked for the exception, twice over — first for the ATM, and now
    // here — and BUILDER-BRIEF §6a is that his words outrank a note. It is left
    // standing rather than deleted because it still explains why WINDOW 2 is
    // a separate act in the room, which has not changed.
    //
    // WHAT ACTUALLY CHANGES: one field, `surface`, and the shape of the canvas.
    // Hanging the picture on a mesh, easing the eye onto it, locking the look,
    // freezing the feet, raycasting the pointer back into canvas pixels, the
    // Win98 hand, ESC always closing, putting the paper's own face back — every
    // one of those is `ct/hud.ts` and `crosstown.ts`, built for the ATM by w41
    // and called here. Nothing of it is re-implemented, per w41's own
    // instruction: *"If you find yourself writing new mechanism, hand it back."*
    //
    // AND THE MESH WAS ALREADY IN THE ROOM. w41 had to find someone else's
    // plane; w55 had to build one, because a slot cabinet is a six-material box
    // and `ct/hud.ts` still throws on those (item 150, open). This room already
    // draws THE APPLICATION FORM as a single-material `PlaneGeometry` lying face
    // up on the blotter — the exact object the player is being asked to fill in.
    // So the overlay is not a screen standing in for the paper: it IS the paper.
    //
    // THE CANVAS IS CUT TO THAT PLANE'S OWN FACE, from its own geometry rather
    // than from two numbers typed here (BUILDER-BRIEF §8). w55's finding is that
    // this is most of the work and all of the difference: a canvas cut to the
    // wrong aspect is a smear, and the whole point of the request is that it
    // should read as a thing in the room.
    const sheetGeo = (form.geometry as THREE.PlaneGeometry).parameters;
    /** px per metre on the sheet, the SAME both ways — BUILDER-BRIEF §7b, which
     *  is the rule for a canvas as much as for a wall. */
    const SHEET_PPM = 1000;
    const SHEET_W = Math.round(sheetGeo.width * SHEET_PPM);    // 0.30 m -> 300
    const SHEET_H = Math.round(sheetGeo.height * SHEET_PPM);   // 0.40 m -> 400
    // The width is UNCHANGED from the screen-space sheet this replaces, so every
    // horizontal measurement in `draw` below is the one that was already tuned.
    // Only the vertical spacing is re-cut, and it is re-SPACED rather than
    // scaled — w55's rule, and the reason is that a form's bands are not all
    // equally elastic: the letterhead and the rules are furniture, and the space
    // belongs to the things you read and the things you press.

    /**
     * THE AMOUNT IS A ROW OF TICK BOXES, and that is the mouse's whole
     * affordance on this sheet.
     *
     * It was a single caret row that `W`/`S` walked up and down. That is fine
     * for a keyboard and it is nothing at all for a pointer — the same gap w41
     * found on the ATM (no clickable PIN pad) and w55 found on the slots (no
     * bill acceptor), and both times the answer was the same: the affordance the
     * mouse needs and the part the object was missing are the same object. A
     * 1997 loan application asks you to TICK THE AMOUNT YOU WANT. So it does.
     *
     * DECLARED ONCE and read by the painter AND by the hit test, so a box cannot
     * be drawn where a click does not land — w55's `DECK` rule, learned there
     * because that is exactly what happens when the two carry separate copies.
     */
    const BOX = { y: 88, h: 30, gap: 4, x0: 10 };
    const boxW = (SHEET_W - BOX.x0 * 2 - BOX.gap * (AMOUNTS.length - 1)) / AMOUNTS.length;
    const boxAt = (i: number) => ({ x: BOX.x0 + i * (boxW + BOX.gap), y: BOX.y, w: boxW, h: BOX.h });
    /** the second act. You read the form, then you sign it — and signing IS
     *  handing it over, which is the spirit of the two-spot aim rule the block
     *  comment above describes, kept on the sheet now that both acts are. */
    const SIGN = { x: 22, y: 306, w: SHEET_W - 44, h: 46 };
    const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    /** which amount box a canvas point is in, or -1 */
    const boxHit = (x: number, y: number) =>
      AMOUNTS.findIndex((_, i) => inRect(boxAt(i), x, y));
    /** can the sheet be signed at all right now — the same test the painter uses
     *  to decide whether to draw the box live, so it cannot look pressable and
     *  do nothing. */
    const signLive = () => stamp !== 'approved' && !loan && !shut();

    /**
     * How far the eye sits off the paper, and how wide it looks.
     *
     * Both are MEASURED against the built world rather than picked to sound
     * right — w55 got the slots' standoff wrong by reasoning and right by
     * shooting, and the reason it is easy to get wrong here is that this face
     * is HORIZONTAL. `poseFor` clamps the eye to between 1.05 m and 1.75 m
     * above the floor, and the sheet lies at desk height, so past a certain
     * standoff the clamp takes over, the eye stops climbing, and backing off
     * further only tilts the view instead of framing more of the page.
     *
     * At 0.55 m the eye lands 1.30 m over a 0.754 m desk — inside the clamp,
     * so the number is still doing what it says — and the 0.40 m sheet fills
     * about seven eighths of a 45° frame. That is a person leaning over a form,
     * which is the pose the request describes.
     */
    const LOAN_STANDOFF = 0.55;
    const LOAN_FOV = 45;

    /**
     * The ONE place the amount changes, so the wheel, the keys and the mouse
     * cannot drift. Guards `approved` in one place too — a signed form is not
     * a form you go on editing.
     */
    const setAmount = (i: number): void => {
      if (stamp === 'approved') return;
      amountIdx = Math.max(0, Math.min(AMOUNTS.length - 1, i));
      stamp = 'none';
      panel.repaint();
    };

    // FRAMELESS. `draw` below already paints a complete fascia — the
    // letterhead, the FIRST FEDERAL / SAVINGS & LOAN masthead, the whole
    // sheet of paper — filling the canvas edge to edge. `chrome: 'cloth'`
    // wrapped that paper in a SECOND cabinet with its own `LOAN APPLICATION`
    // title stamp, which is the framework redrawing a letterhead the form
    // already has. Item 5i (the same fix as item 0c, just not named by it):
    // *"i never want there to be menus popping up unless they are embedded
    // to look as if they are in the actual game."* `title` dropped with it —
    // frameless has no title band to put it in, and the masthead the form
    // draws for itself already says what this is.
    const panel = makePanel({
      id: 'ct-loan', w: SHEET_W, h: SHEET_H, chrome: 'none',
      // ── THE ONE FIELD THAT MAKES IT DIEGETIC ──────────────────────────────
      //
      // `mesh` is resolved per open and a null degrades to the screen-space
      // sheet rather than failing, which is what keeps the node harnesses (no
      // focus controller, no renderer) working. `formMesh` is `form` after
      // `put()`, i.e. the same object with the room's transform applied — the
      // pose comes off ITS world normal, so nothing about the camera is typed
      // here and the desk can move without this following it by hand.
      surface: {
        mesh: () => formMesh,
        // MEASURED, NOT CHOSEN. `crosstown.ts:poseFor` puts the eye a standoff
        // along the face's own normal, and this face's normal points STRAIGHT
        // UP — it is a sheet of paper lying on a desk, which is a case that
        // file already anticipates (`flat.lengthSq() < 1e-6` → "a screen facing
        // straight up"). So the standoff is a reading distance, not a standing
        // distance: how far your eyes are from a form you are leaning over.
        standoff: LOAN_STANDOFF,
        fov: LOAN_FOV,
        hot: (x, y) => boxHit(x, y) >= 0 || (signLive() && inRect(SIGN, x, y)),
        // ONE DISPATCH. A click goes through the same two functions the keys
        // do, so a pointer and a keyboard cannot drift apart — w41's rule, and
        // the reason it is a rule is that the drift is invisible until someone
        // uses the other input.
        click: (x, y) => {
          const i = boxHit(x, y);
          if (i >= 0) { setAmount(i); return; }
          if (signLive() && inRect(SIGN, x, y)) { submit(); panel.repaint(); }
        },
      },
      hint: () => (stamp === 'approved'
        ? 'ESC  step back'
        : 'click an amount, then SIGN   ·   W / S · ENTER   ·   ESC  step back'),
      draw: (g, w, h) => {
        const a = AMOUNTS[amountIdx], rate = RATE[a];
        const owed = owedOn(a), need = cents(a * DOWN), have = ctx.purse.cash;
        const INK = '#2e2a24', DIM = '#6a6458', RED = '#8a2c22';
        g.fillStyle = '#eae5d2'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, h - 3, w, 3);
        // the letterhead — half again as deep as it was, because on the paper it
        // is the thing that says which bank you are sitting in
        g.fillStyle = '#1f3a5a'; g.fillRect(0, 0, w, 34);
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.font = UI.font(11, true); g.fillStyle = '#e8ecf0';
        g.fillText('FIRST FEDERAL', 8, 17);
        g.font = UI.font(8); g.fillStyle = '#9fb4c8'; g.textAlign = 'right';
        g.fillText('SAVINGS & LOAN', w - 8, 17);
        g.textAlign = 'left'; g.fillStyle = DIM;
        g.fillText('APPLICATION FOR AN UNSECURED PERSONAL LOAN', 8, 50);
        g.fillStyle = RED; g.fillRect(8, 60, w - 16, 1);

        // ── ACT ONE: TICK THE AMOUNT ────────────────────────────────────────
        g.font = UI.font(8); g.fillStyle = DIM;
        g.fillText('AMOUNT REQUESTED — TICK ONE', 10, 76);
        AMOUNTS.forEach((amt, i) => {
          const r = boxAt(i), on = i === amountIdx;
          g.fillStyle = on ? '#1f3a5a' : 'rgba(255,255,255,0.55)';
          g.fillRect(r.x, r.y, r.w, r.h);
          g.strokeStyle = on ? '#1f3a5a' : 'rgba(106,100,88,0.65)';
          g.lineWidth = 1;
          g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
          g.textAlign = 'center';
          g.font = UI.font(9, on); g.fillStyle = on ? '#f2efe4' : '#4a4640';
          g.fillText(`$${amt}`, r.x + r.w / 2, r.y + r.h / 2);
          g.textAlign = 'left';
        });

        // The terms the tick decides. None of these is touchable and none of
        // them pretends to be — they are what the bank says back to you.
        const rows: [string, string][] = [
          ['TERM', `${TERM_MONTHS} MONTHS`],
          ['RATE', `${rate.toFixed(2)} % APR`],
          ['MONTHLY', money(cents(owed / TERM_MONTHS))],
          ['TOTAL DUE', money(owed)],
        ];
        rows.forEach(([k, v], i) => {
          const y = 150 + i * 26;
          g.font = UI.font(9); g.fillStyle = DIM;
          g.fillText(k, 12, y);
          // the dotted leader, which is what makes a column of pairs read as a form
          g.fillStyle = 'rgba(106,100,88,0.45)';
          for (let dx = 100; dx < w - 76; dx += 4) g.fillRect(dx, y, 1, 1);
          g.textAlign = 'right'; g.font = UI.font(10, true);
          g.fillStyle = '#4a4640';
          g.fillText(v, w - 10, y);
          g.textAlign = 'left';
        });

        // What they want off you against what you have. THE COMPARISON IS THE
        // DECISION, so it is on the sheet before you submit rather than only in
        // the refusal afterwards — you can see why the answer will be no.
        g.fillStyle = 'rgba(106,100,88,0.5)'; g.fillRect(8, 262, w - 16, 1);
        g.font = UI.font(8); g.fillStyle = DIM;
        g.fillText(`SECURITY REQUIRED (${Math.round(DOWN * 100)} %)`, 10, 276);
        g.textAlign = 'right'; g.font = UI.font(9, true); g.fillStyle = INK;
        g.fillText(money(need), w - 10, 276);
        g.textAlign = 'left'; g.font = UI.font(8); g.fillStyle = DIM;
        g.fillText('CASH ON HAND', 10, 292);
        g.textAlign = 'right'; g.font = UI.font(9, true);
        g.fillStyle = have >= need ? '#2f6a3a' : RED;
        g.fillText(money(have), w - 10, 292);
        g.textAlign = 'left';

        // ── ACT TWO: SIGN IT, WHICH IS HANDING IT OVER ──────────────────────
        //
        // The block comment above calls the two-spot aim rule "a genuinely
        // elegant piece of design" and asks that its SPIRIT survive the move
        // onto one sheet: reading and handing over should still feel like two
        // acts. They do — you tick, and then you sign — and the sign box is
        // deliberately at the foot of the paper, where you have to travel to it.
        if (signLive()) {
          g.fillStyle = 'rgba(31,58,90,0.08)';
          g.fillRect(SIGN.x, SIGN.y, SIGN.w, SIGN.h);
          g.strokeStyle = '#1f3a5a'; g.lineWidth = 2;
          g.strokeRect(SIGN.x + 1, SIGN.y + 1, SIGN.w - 2, SIGN.h - 2);
          g.textAlign = 'center'; g.font = UI.font(13, true); g.fillStyle = '#1f3a5a';
          g.fillText('SIGN & HAND IT OVER', SIGN.x + SIGN.w / 2, SIGN.y + SIGN.h / 2);
          g.textAlign = 'left';
        }

        // the signature line with a scrawl on it: a form nobody has signed reads
        // as a form nobody has filled in
        g.fillStyle = 'rgba(60,52,42,0.55)'; g.fillRect(10, 372, 108, 1);
        g.fillStyle = 'rgba(40,36,30,0.75)';
        for (let i = 0; i < 26; i++) {
          g.fillRect(14 + i * 3.4, 366 + Math.round(Math.sin(i * 0.9) * 3), 3, 1);
        }
        g.font = UI.font(7); g.fillStyle = DIM;
        g.fillText('APPLICANT', 10, 384);
        g.textAlign = 'right'; g.fillText('OFFICER USE ONLY', w - 10, 384);
        g.textAlign = 'left';

        // THE STAMP: the answer and the reason, rotated across the middle
        if (stamp !== 'none') {
          const ok = stamp === 'approved';
          const col = ok ? '47,106,58' : '138,44,34';
          // ACROSS THE TERMS, not across the figures. On the taller sheet the
          // clear band is the one between TOTAL DUE and the security block, and
          // the stamp sits centred there — the rate and the total are the two
          // numbers the whole sheet is about and a stamp that hides them is a
          // stamp that hides the point.
          g.save();
          g.translate(w * 0.50, 226); g.rotate(-0.11);
          g.strokeStyle = `rgba(${col},0.85)`; g.lineWidth = 3;
          g.strokeRect(-104, -24, 208, 48);
          g.textAlign = 'center';
          g.font = UI.font(20, true); g.fillStyle = `rgba(${col},0.9)`;
          g.fillText(ok ? 'APPROVED' : 'DECLINED', 0, -4);
          g.font = UI.font(8, true); g.fillStyle = `rgba(${col},0.95)`;
          g.fillText(ok ? 'COLLECT AT WINDOW 2' : `SHORT BY ${money(cents(need - have))}`, 0, 14);
          g.restore();
          g.textAlign = 'left';
        }
      },
      // THE KEYBOARD IS UNTOUCHED BY GOING DIEGETIC, which is w41's promise to
      // its tenants and it held: `W`/`S`/`ENTER` do here exactly what they did
      // when this was a rectangle over the camera. What is new is that they now
      // go through `setAmount`, the same function the tick boxes call.
      key: (k) => {
        if (stamp === 'approved') return;                  // signed, and done
        if (k === 'w' || k === 'arrowup' || k === 'd' || k === 'arrowright') {
          setAmount(amountIdx + 1);
        } else if (k === 's' || k === 'arrowdown' || k === 'a' || k === 'arrowleft') {
          setAmount(amountIdx - 1);
        } else if (k === 'enter' || k === ' ') {
          submit(); panel.repaint();
        }
      },
      // …and the wheel, because the pockets established that the wheel is how you
      // move a selection inside one of these cabinets
      wheel: (dir) => setAmount(amountIdx - dir),
    });

    /**
     * The decision, and it is deliberately legible rather than a credit model.
     * The desk's steer: *"keep it simple and a little sleazy … an approval that is
     * too easy, and interest that is obviously bad for you, is more in keeping
     * than a real credit model"*. 13.50% APR on two hundred dollars is that, and
     * the block already has a pawn shop and a used car lot on it.
     */
    function submit(): void {
      if (loan || shut()) return;
      const a = AMOUNTS[amountIdx], need = cents(a * DOWN);
      if (ctx.purse.cash < need) { stamp = 'declined'; return; }
      loan = { principal: a, owed: owedOn(a), rate: RATE[a], collected: false };
      stamp = 'approved';
    }

    // ── the two ways to open it ─────────────────────────────────────────────
    //
    // The FORM on the desk and the OFFICER across it both open the same sheet.
    // Two spots rather than one, and the aim rule keeps them apart for free:
    // standing at the desk looking straight ahead gets HER, looking down-left at
    // the paper gets the FORM. Both, because a player who walks up and looks at
    // the desk should not have to guess that the PERSON is the interactive thing.
    const openApplication = () => {
      if (loan || shut()) return;
      stamp = 'none';
      panel.open();
      panel.repaint();
    };
    ctx.spot({
      x: room.wx(FORM_X), z: room.wz(FORM_Z), r: 0.7, obj: formMesh,
      ok: () => room.inside() && loan === null,
      label: () => (shut()
        ? 'the applications are put away until nine'
        : 'read the loan application'),
      act: openApplication,
    });

    // ── the officer ─────────────────────────────────────────────────────────
    ctx.spot({
      x: room.wx(DESK_X), z: room.wz(DESK_Z - DESK_D / 2 - 0.30), r: 1.0,
      ok: () => room.inside(),
      label: () => {
        if (loan) {
          return loan.collected
            ? `you owe First Federal ${money(loan.owed)} — settle it at a window`
            : `approved — collect ${money(loan.principal)} at window 2`;
        }
        if (shut()) return 'the loan desk takes applications nine to four';
        return 'apply for a loan';
      },
      act: openApplication,
    });

    // ── WINDOW 2: the teller counts it out, and takes it back ───────────────
    //
    // Registered on the counter at the window the teller is actually standing
    // behind, and named on the grille so the selection outline draws the window
    // rather than a generic box at a coordinate.
    //
    // It is live even with no loan, and says where the desk is. A teller you can
    // walk up to and get nothing from is the same fault as a machine that
    // ignores you, and this is the one spot in the room a player finds first.
    ctx.spot({
      x: room.wx(WINDOW_X[1]), z: room.wz(CTR_Z), r: 1.0, obj: tellerGrille,
      ok: () => room.inside(),
      label: () => {
        if (!loan) return 'ask about a loan — the officer\'s desk is by the window';
        if (!loan.collected) return `collect your loan — ${money(loan.principal)}`;
        const pay = Math.min(ctx.purse.cash, loan.owed);
        if (pay < 0.01) return `you owe ${money(loan.owed)} and have nothing to pay it with`;
        return pay >= loan.owed
          ? `pay off your loan — ${money(loan.owed)}`
          : `pay ${money(pay)} off your loan  ·  ${money(loan.owed)} outstanding`;
      },
      act: () => {
        if (!loan) return;
        if (!loan.collected) {
          loan.collected = true;
          ctx.purse.cash = cents(ctx.purse.cash + loan.principal);
          ctx.refreshWallet();
          return;
        }
        const pay = Math.min(ctx.purse.cash, loan.owed);
        if (pay < 0.01) return;
        ctx.purse.cash = cents(ctx.purse.cash - pay);
        loan.owed = cents(loan.owed - pay);
        // settled: back to being someone who could borrow again
        if (loan.owed <= 0.004) loan = null;
        ctx.refreshWallet();
      },
    });
  }

  // ══ THE PUBLIC HALF ════════════════════════════════════════════════════════
  //
  // Everything between the doors and the counter. The standing rule here is the
  // user's own, given about the tax office: *"MORE THINGS IS NOT THE ANSWER ON
  // ITS OWN … a few considered things arranged and aligned, not clutter. Density
  // is a diagnosis, not a target."*
  //
  // So this is not a scatter. It is the five things a branch lobby has that the
  // room did not, each against a wall or on an axis:
  //
  //   · a WRITING ISLAND, because you fill your slip in before you queue
  //   · a QUEUE LINE, because you queue after that
  //   · a WAITING ROW with the RATE BOARD over it, because you wait after that
  //   · a BROCHURE RACK and two PLANTS at the doors, because that is what is
  //     the first thing you see and the last
  //   · the NOTICE BY THE DOOR that says what the hours are — which is the same
  //     nine-to-four the loan desk enforces, so the room explains its own rule
  {
    // ── the writing island ──────────────────────────────────────────────────
    //
    // Free-standing, square to the room, on the centre-left where it does not
    // stand between the doors and either the counter or the vault. Slip holders,
    // a blotter, and TWO PENS ON CHAINS, which is the detail that makes a
    // waist-high box unmistakably a bank writing desk.
    const ISL_X = -2.4, ISL_Z = 1.20, ISL_W = 1.70, ISL_D = 0.80, ISL_H = 1.06;
    {
      const front = panelMat(ISL_W), top = topMat(ISL_W);
      skin(put(new THREE.Mesh(new THREE.BoxGeometry(ISL_W, ISL_H - 0.05, ISL_D),
        [front, front, top, front, front, front]), ISL_X, (ISL_H - 0.05) / 2, ISL_Z),
        'writing island');
      put(new THREE.Mesh(new THREE.BoxGeometry(ISL_W + 0.08, 0.05, ISL_D + 0.08),
        [top, top, top, top, top, top]), ISL_X, ISL_H - 0.025, ISL_Z);
      // the slip holders: two raked trays, one each side, with the slips in them
      const slipT = declareSurface(pixTex(30, 20, (g) => {
        g.fillStyle = '#e8e3d0'; g.fillRect(0, 0, 30, 20);
        g.fillStyle = '#3a6a8a'; g.fillRect(0, 0, 30, 2);
        g.fillStyle = 'rgba(70,62,50,0.45)';
        for (let i = 0; i < 4; i++) g.fillRect(3, 6 + i * 3, 24 - ((i * 5) % 7), 1);
        dither(g, 30, 20, 6);
      }), 'sign');
      const slipM = ctx.flat(slipT);
      for (const [sx, sz] of [[-0.52, -0.20], [0.52, 0.20]] as [number, number][]) {
        bx(0.34, 0.03, 0.24, steelDarkM, ISL_X + sx, ISL_H + 0.015, ISL_Z + sz);
        const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.21), slipM);
        tray.rotation.x = -Math.PI / 2 + 0.30;        // raked, so you can read them
        put(tray, ISL_X + sx, ISL_H + 0.045, ISL_Z + sz);
        // …and a low back on the tray so the slips have something to lean on
        bx(0.34, 0.07, 0.02, steelDarkM, ISL_X + sx, ISL_H + 0.05, ISL_Z + sz - 0.12);
      }
      bx(0.52, 0.012, 0.36, new THREE.MeshBasicMaterial({ color: 0x2e4438 }),
        ISL_X, ISL_H + 0.008, ISL_Z);                 // the blotter between them
      // TWO PENS ON CHAINS, anchored to the top. The chain is the object.
      for (const sx of [-0.20, 0.24]) {
        const anchor = ISL_X + sx;
        bx(0.05, 0.02, 0.05, bronzeM, anchor, ISL_H + 0.02, ISL_Z + 0.28);
        for (let i = 0; i < 8; i++) {
          put(new THREE.Mesh(new THREE.SphereGeometry(0.008, 5, 4), steelM),
            anchor + (sx < 0 ? 1 : -1) * i * 0.026, ISL_H + 0.022, ISL_Z + 0.26 - i * 0.016);
        }
        const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.12, 6),
          new THREE.MeshBasicMaterial({ color: 0x22242a }));
        pen.rotation.set(0, sx < 0 ? 0.8 : -0.8, Math.PI / 2);
        put(pen, anchor + (sx < 0 ? 0.24 : -0.24), ISL_H + 0.026, ISL_Z + 0.14);
      }
      solid(ISL_X, ISL_Z, ISL_W + 0.2, ISL_D + 0.2);
    }

    // ── the queue line ──────────────────────────────────────────────────────
    //
    // Three chrome posts and a maroon rope, run ACROSS the front of the counter
    // rather than down the room, with a sign on the middle post. It marks where
    // the queue forms and it has a real collider, because a rope you walk
    // through is worse than no rope — you go round either end, and both ends
    // leave more than three metres of clear lane.
    const Q_Z = -2.60, Q_X = [-1.4, 0.4, 2.2];
    {
      const ropeM = new THREE.MeshBasicMaterial({ color: 0x6a2430 });
      for (const qx of Q_X) {
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.03, 12), steelDarkM),
          qx, 0.015, Q_Z);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.96, 8), steelM),
          qx, 0.48, Q_Z);
        put(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), steelM), qx, 0.99, Q_Z);
        bx(0.05, 0.05, 0.05, bronzeM, qx, 0.88, Q_Z);          // the rope eye
      }
      // the rope, slung between them with a real sag — TWO segments per bay, so
      // it dips instead of running dead straight, which is the only thing that
      // makes a rope read as rope
      for (let i = 0; i + 1 < Q_X.length; i++) {
        const a = Q_X[i], b = Q_X[i + 1], mid = (a + b) / 2;
        for (const [x0, x1, y0, y1] of [[a, mid, 0.88, 0.76], [mid, b, 0.76, 0.88]] as
             [number, number, number, number][]) {
          const len = Math.hypot(x1 - x0, y1 - y0);
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, len, 6), ropeM);
          seg.rotation.z = Math.PI / 2 - Math.atan2(y1 - y0, x1 - x0);
          put(seg, (x0 + x1) / 2, (y0 + y1) / 2, Q_Z);
        }
      }
      // ONE collider along the run, not three posts with walkable rope between
      solid((Q_X[0] + Q_X[Q_X.length - 1]) / 2, Q_Z, Q_X[Q_X.length - 1] - Q_X[0] + 0.4, 0.20);
      // 96 x 28, sized off the LONGEST LINE rather than picked: "PLEASE WAIT" at
      // 2 px is 86 texels and "FOR THE NEXT TELLER" at 1 px is 75, so 72 clipped
      // both and drew "LEASE WAI / OR THE NEXT TELLE".
      const waitT = declareSurface(pixTex(96, 28, (g) => {
        g.fillStyle = '#2a2e32'; g.fillRect(0, 0, 96, 28);
        g.fillStyle = '#d8d4c4'; g.fillRect(1, 1, 94, 26);
        g.fillStyle = '#8a2c22'; g.fillRect(1, 1, 94, 2);
        wordC(g, 'PLEASE WAIT', 48, 6, 2, '#2e2a24');
        wordC(g, 'FOR THE NEXT TELLER', 48, 18, 1, '#5a564e');
      }), 'sign');
      room.sign(waitT, 0.72, 0.21, Q_X[1], 1.12, Q_Z);
    }

    // ── the waiting row, and the rate board over it ──────────────────────────
    //
    // Linked chairs on a common rail, against the east wall — the one piece of
    // furniture that cannot be strewn about, because it is bolted into a line.
    // Its collider REACHES THE WALL: sized to the chairs it would leave a 0.4 m
    // slot behind a bolted-down row, which is exactly what the tax office had.
    const WAIT_X = 6.30, WAIT_Z = [-0.55, -1.20, -1.85];
    {
      const chairM = new THREE.MeshBasicMaterial({ color: 0x4a5560 });
      bx(0.08, 0.06, 1.62, steelM, WAIT_X + 0.18, 0.10, WAIT_Z[1]);        // the rail
      for (const wz of WAIT_Z) {
        bx(0.48, 0.10, 0.50, chairM, WAIT_X, 0.42, wz);                    // the seat
        bx(0.07, 0.44, 0.50, chairM, WAIT_X + 0.20, 0.68, wz);             // the back
        for (const sz of [-0.20, 0.20]) bx(0.04, 0.38, 0.04, steelM, WAIT_X - 0.16, 0.19, wz + sz);
        // every seat in this game is sittable, and you take it from IN FRONT —
        // clear of the row's own collider, which reaches the wall behind it
        ctx.seat({
          x: room.wx(WAIT_X - 0.04), z: room.wz(wz), yaw: -Math.PI / 2, h: 0.47,
          r: 0.85, approach: { x: room.wx(WAIT_X - 0.95), z: room.wz(wz) },
          label: 'sit and wait', ok: () => room.inside(),
        });
      }
      const rowBack = WAIT_X - 0.24;
      solid((rowBack + hw + 0.18) / 2, WAIT_Z[1], (hw + 0.18) - rowBack, 2.0);
      // a low table with the brochures nobody reads, at the end of the row
      bx(0.46, 0.04, 0.62, oakDarkM, WAIT_X - 0.02, 0.44, WAIT_Z[2] - 0.78);
      for (const sx of [-0.16, 0.16]) for (const sz of [-0.22, 0.22]) {
        bx(0.05, 0.42, 0.05, steelM, WAIT_X - 0.02 + sx, 0.21, WAIT_Z[2] - 0.78 + sz);
      }
      bx(0.22, 0.02, 0.30, paperM, WAIT_X - 0.02, 0.475, WAIT_Z[2] - 0.84);
      bx(0.20, 0.02, 0.28, new THREE.MeshBasicMaterial({ color: 0xd8cfae }),
        WAIT_X + 0.04, 0.492, WAIT_Z[2] - 0.72);
      solid((rowBack + hw + 0.18) / 2, WAIT_Z[2] - 0.78, (hw + 0.18) - rowBack, 0.8);

      // ── THE RATE BOARD ────────────────────────────────────────────────────
      //
      // The single most 1997 object in the building. Nothing dates a room faster
      // than the numbers a savings bank was quoting in it, and 12.50% on an
      // unsecured personal loan is the figure the loan desk actually charges —
      // read off RATE[500] rather than typed here, so the board and the officer
      // cannot come to disagree the way the ATM and the facade once did.
      const rows: [string, string][] = [
        ['MORTGAGE 30 YR', '7.75'],
        ['AUTO 48 MO', '9.25'],
        ['PERSONAL', HEADLINE_RATE.toFixed(2)],
        ['PASSBOOK SAVINGS', '4.10'],
        ['6 MONTH CD', '5.15'],
      ];
      const boardT = declareSurface(pixTex(120, 74, (g) => {
        g.fillStyle = '#1e2226'; g.fillRect(0, 0, 120, 74);
        g.fillStyle = '#2a3036'; g.fillRect(2, 2, 116, 70);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(2, 2, 116, 1);
        wordC(g, 'TODAYS RATES', 60, 5, 2, '#e8c25a');
        g.fillStyle = '#e8c25a'; g.fillRect(8, 15, 104, 1);
        rows.forEach(([what, num], i) => {
          const y = 20 + i * 10;
          word(g, what, 8, y, 1, '#cfd3d6');
          const w = num.length * 4 - 1;
          word(g, num, 112 - w, y, 1, '#8fe0a0');           // the figures, in green
          g.fillStyle = 'rgba(255,255,255,0.06)';           // the slot each card sits in
          g.fillRect(8, y + 6, 104, 1);
        });
        g.fillStyle = '#8a8f93'; g.fillRect(8, 68, 40, 1);
        word(g, 'APR', 52, 66, 1, '#8a8f93');
        dither(g, 120, 74, 30);
      }), 'sign');
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.10, 1.30), ctx.flat(boardT));
      board.rotation.y = -Math.PI / 2;                       // faces -x, into the room
      skin(put(board, hw - 0.07, 2.02, WAIT_Z[1]), 'rate board');
      bx(0.05, 1.42, 2.22, new THREE.MeshBasicMaterial({ color: 0x14171a }),
        hw - 0.035, 2.02, WAIT_Z[1]);                        // the frame, BEHIND the face
    }

    // ── the brochure rack, and two plants at the doors ───────────────────────
    {
      const RACK_X = -5.0, RACK_Z = hd - 0.24;
      const brochT = declareSurface(pixTex(56, 64, (g) => {
        g.fillStyle = '#4a4238'; g.fillRect(0, 0, 56, 64);
        // three shelves of leaflets, each a different stock, standing up in slots
        const cols = ['#c8ccd0', '#d8c8a4', '#b8ccc0', '#d0c0c8'];
        for (let r = 0; r < 3; r++) {
          const y = 4 + r * 20;
          g.fillStyle = '#3a342c'; g.fillRect(2, y + 15, 52, 3);          // the shelf lip
          for (let c = 0; c < 4; c++) {
            const x = 4 + c * 13;
            g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 1, y + 1, 10, 14);
            g.fillStyle = cols[(r + c) % 4]; g.fillRect(x, y, 10, 15);
            g.fillStyle = 'rgba(60,54,44,0.55)';                          // a title block
            g.fillRect(x + 1, y + 2, 8, 2);
            for (let l = 0; l < 3; l++) g.fillRect(x + 1, y + 6 + l * 3, 7 - l, 1);
          }
        }
        dither(g, 56, 64, 26);
      }), 'detail');
      const brochM = ctx.flat(brochT);
      skin(put(new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.42, 0.30),
        [oakDarkM, oakDarkM, oakDarkM, oakDarkM, oakDarkM, brochM]),
        RACK_X, 0.71, RACK_Z), 'brochure rack');
      solid(RACK_X, (RACK_Z - 0.15 + hd) / 2, 1.1, hd - (RACK_Z - 0.15));

      // TWO PLANTS FLANKING THE DOORS. One texture, one plane, so the foliage
      // cannot come adrift from the pot — which is the fault the tax office's
      // plant was reported for, and it was drawn in rather than a drift.
      const ficusT = declareSurface(pixTex(48, 76, (g) => {
        const blade = (bx0: number, by: number, tx: number, ty: number, w0: number, col: string) => {
          g.fillStyle = col;
          const n = Math.max(Math.abs(tx - bx0), Math.abs(ty - by));
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const x = bx0 + (tx - bx0) * t, y = by + (ty - by) * t;
            const w = Math.max(1, Math.round(w0 * (1 - t * 0.7)));
            g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
          }
        };
        // a ficus is a TRUNK with sprays, so the trunk goes down first and the
        // leaves are hung ON it — drawn back to front in three tones so they
        // overlap and the thing has depth
        g.fillStyle = '#4a3a26'; g.fillRect(22, 26, 4, 30);
        g.fillStyle = '#5a4830'; g.fillRect(22, 26, 1, 30);
        for (const [y0, spread, tone] of [[30, 15, '#2c4426'], [22, 18, '#33512d'],
                                          [14, 15, '#3f6238'], [7, 11, '#4f7a44']] as
             [number, number, string][]) {
          for (const dir of [-1, 1]) {
            blade(24, y0, 24 + dir * spread, y0 - 5, 5, tone);
            blade(24, y0 + 3, 24 + dir * (spread - 5), y0 + 7, 4, tone);
          }
        }
        // the brass planter, tapered, with a rolled rim over visible bark chip
        g.fillStyle = '#2e2418'; g.fillRect(16, 54, 16, 4);
        for (let y = 56; y < 76; y++) {
          const inset = Math.round((y - 56) * 0.16);
          g.fillStyle = y < 60 ? '#8a7a4e' : '#7a6a44';
          g.fillRect(14 + inset, y, 20 - inset * 2, 1);
        }
        g.fillStyle = '#9c8a5c'; g.fillRect(13, 53, 22, 4);                 // the rim
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(15, 58, 3, 16);
        g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(28, 58, 4, 16);
        dither(g, 48, 76, 20);
      }), 'detail');
      for (const px of [-2.4, 2.4]) {
        const plant = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.46),
          new THREE.MeshBasicMaterial({ map: ficusT, alphaTest: 0.5, side: THREE.DoubleSide }));
        // half the plane's own height, so the planter's base sits ON the floor
        // whatever the plane is resized to
        put(plant, px, 1.46 / 2, hd - 0.85);
        solid(px, hd - 0.85, 0.52, 0.52);
      }

      // the bin in the corner nobody looks at
      {
        const BIN_X = -6.5, BIN_Z = hd - 0.55;
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.17, 0.62, 12),
          new THREE.MeshBasicMaterial({ color: 0x6a6458 })), BIN_X, 0.31, BIN_Z);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 12), steelM),
          BIN_X, 0.65, BIN_Z);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 10),
          new THREE.MeshBasicMaterial({ color: 0x2a2824 })), BIN_X, 0.685, BIN_Z);
        solid(BIN_X - 0.1, (BIN_Z - 0.22 + hd) / 2, 0.6, hd - (BIN_Z - 0.22));
      }
    }

    // ── the notice by the door ───────────────────────────────────────────────
    //
    // MEMBER FDIC and the hours, framed on the front wall inside the doors. It
    // earns its place twice: it is what a 1997 branch actually hangs there, and
    // it is where the room TELLS YOU the rule the loan desk enforces — nine to
    // four. A rule a player can only discover by being refused is a bug wearing
    // a mechanic's clothes.
    {
      // 96 wide, and I did not work that out — the overflow guard above did, on
      // the first build after I added it: "MEMBER FDIC needs 86 texels on a
      // 72-texel canvas". That is the SECOND sign in this room the guard caught
      // clipping in the twenty minutes after it was written, and neither was
      // visible in the code. It paid for itself twice before it was committed.
      const noticeT = declareSurface(pixTex(96, 52, (g) => {
        g.fillStyle = '#dfdccc'; g.fillRect(0, 0, 96, 52);
        g.fillStyle = '#1f3a5a'; g.fillRect(0, 0, 96, 12);
        wordC(g, 'MEMBER FDIC', 48, 4, 2, '#e8ecf0');
        wordC(g, 'DEPOSITS INSURED', 48, 16, 1, '#4a4640');
        wordC(g, 'TO 100000', 48, 23, 1, '#4a4640');
        g.fillStyle = '#8a2c22'; g.fillRect(20, 31, 56, 1);
        wordC(g, 'LOBBY 9 TO 4', 48, 35, 1, '#2e2a24');
        wordC(g, 'SAT 9 TO 12', 48, 43, 1, '#2e2a24');
        dither(g, 96, 52, 18);
      }), 'sign');
      const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.45), ctx.flat(noticeT));
      notice.rotation.y = Math.PI;                    // faces -z, into the room
      put(notice, -1.55, 1.62, hd - 0.05);
      bx(0.70, 0.53, 0.04, oakDarkM, -1.55, 1.62, hd - 0.02);
    }

    // ── two camera domes, because this is a bank ─────────────────────────────
    for (const [dx, dz] of [[-1.6, 3.2], [4.6, -1.4]] as [number, number][]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x2a2c30, side: THREE.DoubleSide }));
      dome.rotation.x = Math.PI;                      // hung, so the dome faces DOWN
      put(dome, dx, room.H - 0.06, dz);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10),
        new THREE.MeshBasicMaterial({ color: 0xd8d4c8 })), dx, room.H - 0.03, dz);
    }
  }

  // ── skirting, on the walls that have one ──────────────────────────────────
  const skirtM = new THREE.MeshBasicMaterial({ color: 0x5c4a2e });
  bx(room.W, 0.12, 0.03, skirtM, 0, 0.06, hd - 0.015);            // front wall
  bx(0.03, 0.12, room.D, skirtM, hw - 0.015, 0.06, 0);            // east wall
  // the west wall only as far as the vault, which is concrete and has none
  bx(0.03, 0.12, hd - V_Z1, skirtM, -hw + 0.015, 0.06, (V_Z1 + hd) / 2);
}

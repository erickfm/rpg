import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { frontageWorld, alongU } from './tex-world';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import { stat, raiseStat, type StatName } from './stats';
import { hudNote } from './hud';
import { registerSlice } from './save';

// CROSSTOWN FITNESS, inside.
//
// *"health is derived from str and con... that means we need a gym"*  (2026-08-08)
//
// …and then he looked at the first pass:
//
// *"also improve the gym the gym should be crosstown fitness. make a nice
//  interior with gym equipment. you pay a fee at the front desk to be able to
//  use all the equipment there 3 machines. one that improve str specifically,
//  one that improves dex specifically, another that improves both but less."*
//   (2026-08-09)
//
// HIS WORDS OUTRANK THE FIRST PASS, and they overturn three of its decisions:
//
//   FLEX GYM                    ->  CROSSTOWN FITNESS. The town's own name on
//                                   the fascia, the banner and the roster.
//   a bench and two treadmills  ->  THREE MACHINES, each visibly a different
//                                   apparatus, and they are the floor's stars.
//   STR and CON                 ->  STR and DEX. The press is strength, the
//                                   heavy bag is speed, and the rower works
//                                   both for less. CON training left the
//                                   building with the treadmills.
//
// What survives is what was right the first time: the rubber floor, the
// painted mirror wall, the sign-in desk with its book, and the pay-the-desk /
// train-at-the-machines split — which is exactly the "one fee unlocks all the
// equipment" his new words ask for.
//
// ── WHERE IT IS ─────────────────────────────────────────────────────────────
//
// The side street's south face, x 11…23 at z −110, where GARAGE stood — the
// unbuilt frontage nearest the main street, one door east of the VIDEO HUT.
// An identity change in `ct/street.ts`, the RADIO → VOLT VILLAGE move.
const TEAL = '#17766b', MAGENTA = '#c02a6a', CREAM = '#f2ede0';
const STEEL = '#2e3134';

// ══ THE DOOR — A SIDE-STREET `face`, THE VIDEO HUT'S OWN CASE ═══════════════
//
// This shop fronts the side street, so its frontage runs along x and the plain
// `DoorDecl` form (a position on the roster's z axis) cannot express it. The
// point and normal here are the painter's own door under the NEW name —
// doorFrac('CROSSTOWN FITNESS') = 0.34 along the glazing, doorCentreM 4.446,
// world x = 11 + 4.446 = 15.446 — typed as the fallback the type requires and
// re-derived from the registry inside buildGym. (The rename MOVED the door:
// the default painter hashes its position off the shop's name, so FLEX GYM's
// door at 20.107 became this one. The room is laid out around the new number.)
export const DOOR: DoorDecl = {
  building: 'CROSSTOWN FITNESS', w: 12, cz: -110, side: 1, at: 0,
  leaf: {
    clearW: 1.05, h: 2.4, leaves: 1,
    frame: { colour: 0x8f938f, material: 'aluminium' }, glazing: 'full',
  },
  face: { x: 15.446, z: -110, nx: 0, nz: 1 },
};

// ══ THE MEMBERSHIP LEDGER — module state, saved as a slice ══════════════════
//
// `paidUntilDay` is EXCLUSIVE — a day pass bought on day 12 sets it to 13 and
// is good until midnight; a season adds 28, tenancy's own 28. The three
// `last*Day` fields are the one-session-a-day gates, PER MACHINE: a body gets
// one press, one bag and one row a day, and that plus the diminishing odds
// below is what keeps this from being a money-to-god pump.
let paidUntilDay = -1;
let lastPressDay = -1;
let lastBagDay = -1;
let lastRowDay = -1;

registerSlice('gym', {
  capture: () => ({ paidUntilDay, lastPressDay, lastBagDay, lastRowDay }),
  restore: (v: unknown) => {
    const o = v as Record<string, unknown>;
    if (!o || typeof o !== 'object') return;
    const num = (k: string): number | null =>
      typeof o[k] === 'number' && Number.isFinite(o[k] as number) ? o[k] as number : null;
    paidUntilDay = num('paidUntilDay') ?? paidUntilDay;
    // MIGRATION: the first pass saved `lastStrDay`/`lastConDay` for a bench
    // and a treadmill that no longer exist. The old STR day carries into the
    // press (still the STR machine); the old CON day dies with the treadmills
    // rather than blocking a machine it never gated.
    lastPressDay = num('lastPressDay') ?? num('lastStrDay') ?? lastPressDay;
    lastBagDay = num('lastBagDay') ?? lastBagDay;
    lastRowDay = num('lastRowDay') ?? lastRowDay;
  },
});

export function buildGym(ctx: CtxBuild): void {
  // Where the door is, ASKED rather than remembered — interiors build last,
  // long after buildStreet registered every frontage (int-video.ts, verbatim).
  const FW = frontageWorld('CROSSTOWN FITNESS');
  if (!FW) {
    console.warn('[interior:gym] no CROSSTOWN FITNESS frontage is registered — building nothing.');
    return;
  }
  const W = 10.8;                      // roomWidthFor(12): the kit's own rule
  const K = W / FW.frontageM;
  const AT = alongU(FW, FW.doorWorld) * K - W / 2;      // −1.398 for this name
  const standZ = FW.facePos + FW.outward * 0.75;

  const room = buildRoom(ctx, {
    id: 'gym',
    label: 'into CROSSTOWN FITNESS',
    // NAMED, because a `face` room publishes no frontage and the kit cannot
    // otherwise find the DoorDecl above.
    building: 'CROSSTOWN FITNESS',
    w: W,
    d: 9.6,
    // 3.2: the heavy bag hangs from this ceiling and the press tower stands
    // 1.75 — a 3.0 ceiling put the banner in the coving.
    h: 3.2,
    // Rubber-charcoal floor, off-white walls, and the fascia's teal on every
    // piece of trim, so the room and its shopfront are one building.
    palette: { floor: 0x33353a, wall: 0xd8d4c8, ceil: 0xd2cec6, trim: 0x17766b },
    light: { kind: 'troffer', tint: 0xeef2f4, count: 6 },
    door: {
      at: AT, r: 1.05,
      x: FW.doorWorld, z: standZ,
      // The landing goes ALONG the walk, not out the normal — the video hut's
      // note: the side road's carriageway starts 2 m off this pavement.
      outX: FW.doorWorld + 1.5, outZ: standZ,
      outYaw: Math.PI, outGy: ctx.KERB_H,
    },
    // The glazed run EAST of the door this time — the rename moved the door to
    // 0.34 along the glazing, so the big glass is on the other side of it now.
    // Through the painter's numbers (default band): glazing 0.62…11.38 along
    // u, the door and its 0.12 m margins take 3.801…5.091, and the east run
    // converts to local −0.818…+4.842. Height and sill are the band's own.
    window: { at: 2.012, w: 5.660, h: 2.40, sill: 0.40 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const steelM = new THREE.MeshBasicMaterial({ color: 0x2e3134 });
  const greyM = new THREE.MeshBasicMaterial({ color: 0x6a6e74 });
  const ironM = new THREE.MeshBasicMaterial({ color: 0x23252a });
  const vinylM = new THREE.MeshBasicMaterial({ color: 0x7a2432 });   // pads and the bag
  const creamM = new THREE.MeshBasicMaterial({ color: 0xf2ede0 });
  const matM = new THREE.MeshBasicMaterial({ color: 0x26282c });

  // ── the floor: interlocking rubber tile, which is what a gym puts down ──
  //
  // 0.5 m squares in two charcoals with a stud-dot grain. One 2×2 block of
  // tiles per canvas covers 1.0 m, so the repeat is the room's metres
  // (GOTCHAS §5).
  const rubberT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#33353a'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#3a3d42';
    g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);      // the quarter turn
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 2; y < 32; y += 4)
      for (let x = 2; x < 32; x += 4) g.fillRect(x, y, 1, 1);  // the studs
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(15, 0, 1, 32); g.fillRect(0, 15, 32, 1);        // the tile joints
    dither(g, 32, 32, 20);
  }), 'ground');
  rubberT.wrapS = rubberT.wrapT = THREE.RepeatWrapping;
  rubberT.repeat.set(Math.round(room.W), Math.round(room.D));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(rubberT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);
  // the entry mat, inside the door
  const mat0 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), matM);
  mat0.rotation.x = -Math.PI / 2;
  put(mat0, AT, 0.015, hd - 0.55);

  // ══ THE FLOOR PLAN, AND THE LANE ARITHMETIC ═════════════════════════════
  //
  // The 2 m lane is sacred indoors. Room is 10.8 × 9.6, hw 5.4, hd 4.8, and
  // the door lands you at local x −1.40 on the front wall, facing the floor.
  //
  //   z  4.80   the front wall: door at −1.40, glass −4.84…−1.98 and −0.82…+4.84
  //             the flat bench (decor) under the east glass, z 4.12…4.58
  //   z  2.05   the heavy bag's mat, north edge      (bag hangs at −1.20, 1.80)
  //   z  1.70   the rower, north edge                (x 3.20 … 5.40)
  //   z  0.90   …and its south edge
  //   z −0.95   the press station, north edge        (x −3.05 … −1.55)
  //   z −2.45   …and its south edge
  //   z −3.15   the counter's front face             (x 1.00 … 5.40)
  //   z −3.85   its back face
  //             ── 0.95 m ──                         the staff strip
  //   z −4.80   the back wall
  //
  // Across, x from −5.4 to 5.4:
  //
  //   the mirror wall and the dumbbell rack   −5.40 … −4.75   (z −0.6 … 2.4)
  //   the press station                       −3.05 … −1.55   (z −2.45 … −0.95)
  //   the heavy bag                           −1.48 … −0.92   (z 1.52 … 2.08)
  //   the rower                                3.20 …  5.40   (z 0.90 … 1.70)
  //
  //   rack aisle (you lift facing the mirror)  −4.75 → −1.48   3.27 m
  //   bag to rower, the centre run             −0.92 →  3.20   4.12 m
  //   rower to the counter                      0.90 → −3.15   4.05 m
  //   press to the mirror wall at its own z    −5.40 → −3.05   2.35 m
  //   bag to the press (in z)                  −0.95 →  1.52   2.47 m
  //
  // Press and rack share no z; press and counter share no x; their closest
  // corners are 1.7 and 2.6 m apart on the diagonal, and neither pair bounds
  // a walk. The straight run from the door to the desk passes east of the bag
  // with 4.1 m in hand.
  const CTR_X0 = 1.00, CTR_X1 = hw, CTR_D = 0.70, CTR_Z = -3.50;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;

  // ══ THE MIRROR WALL ═════════════════════════════════════════════════════
  //
  // NOTHING IN CROSSTOWN REFLECTS (ct/mirror.ts keeps the only real mirror in
  // the world painted too). Pale blue-grey plate in aluminium-jointed panels
  // with two diagonal light streaks per sheet, 7.2 m down the west wall.
  {
    const MIR_W = 7.2, MIR_H = 2.10, MIR_CZ = 0.0;
    const mirT = declareSurface(pixTex(96, 28, (g) => {
      g.fillStyle = '#c2ced2'; g.fillRect(0, 0, 96, 28);
      for (let p = 0; p < 3; p++) {                       // three sheets per tile
        const x0 = p * 32;
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.beginPath(); g.moveTo(x0 + 6, 28); g.lineTo(x0 + 16, 0);
        g.lineTo(x0 + 20, 0); g.lineTo(x0 + 10, 28); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath(); g.moveTo(x0 + 22, 28); g.lineTo(x0 + 30, 6);
        g.lineTo(x0 + 32, 6); g.lineTo(x0 + 24, 28); g.closePath(); g.fill();
        g.fillStyle = 'rgba(60,70,80,0.55)'; g.fillRect(x0 + 31, 0, 1, 28);  // the joint
      }
      g.fillStyle = 'rgba(40,48,56,0.35)'; g.fillRect(0, 27, 96, 1);
      dither(g, 96, 28, 14);
    }), 'detail');
    const mir = mirT.clone();
    mir.wrapS = mir.wrapT = THREE.RepeatWrapping;
    mir.repeat.set(MIR_W / 2.4, 1);                       // one 0.8 m sheet per 32 px
    mir.needsUpdate = true;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(MIR_W, MIR_H), ctx.flat(mir));
    plate.rotation.y = Math.PI / 2;                       // faces +x, into the room
    put(plate, -hw + 0.05, 0.25 + MIR_H / 2, MIR_CZ);
    for (const y of [0.23, 0.25 + MIR_H + 0.02]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, MIR_W), greyM);
      put(rail, -hw + 0.05, y, MIR_CZ);
    }
    // THE NAME OVER THE MIRROR — the logo wall, which every gym of the period
    // had. Teal band, the town's name in cream, FITNESS picked out warmer.
    const banT = declareSurface(pixTex(128, 14, (g) => {
      g.fillStyle = TEAL; g.fillRect(0, 0, 128, 14);
      g.fillStyle = CREAM; g.fillRect(0, 1, 128, 1); g.fillRect(0, 12, 128, 1);
      g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = CREAM; g.fillText('CROSSTOWN', 40, 7);
      g.fillStyle = '#e88ab8'; g.fillText('FITNESS', 96, 7);
    }), 'sign');
    room.sign(banT, 5.4, 0.56, -hw + 0.10, 2.72, MIR_CZ, Math.PI / 2);
  }

  // ── the dumbbell rack, against the mirror — the free-weight corner ──
  {
    const RK_Z0 = -0.6, RK_Z1 = 2.4, RK_CZ = (RK_Z0 + RK_Z1) / 2, RK_L = RK_Z1 - RK_Z0;
    const RK_X = -hw + 0.33;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.10, RK_L), steelM), RK_X, 0.05, RK_CZ);
    for (const [y, dx] of [[0.42, 0.10], [0.82, -0.06]] as [number, number][]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, RK_L), steelM), RK_X + dx, y, RK_CZ);
      for (let i = 0; i < 6; i++) {
        const z = RK_Z0 + 0.28 + i * 0.50;
        put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.09), ironM), RK_X + dx, y + 0.075, z);
        for (const s of [-1, 1])
          put(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.13), greyM),
            RK_X + dx + s * 0.115, y + 0.075, z);
      }
    }
    for (const z of [RK_Z0 + 0.05, RK_Z1 - 0.05])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.06), steelM), RK_X, 0.46, z);
    solid(RK_X, RK_CZ, 0.65, RK_L);
  }

  // ── the flat bench, under the east glass — decor, the rack's partner ──
  {
    const BN_CX = 2.0, BN_CZ = hd - 0.45;
    put(new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.12, 0.42), vinylM), BN_CX, 0.45, BN_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.39, 0.30), steelM), BN_CX, 0.195, BN_CZ);
    solid(BN_CX, BN_CZ, 1.35, 0.50);
  }

  // ══ THE THREE MACHINES ══════════════════════════════════════════════════
  //
  // *"3 machines. one that improve str specifically, one that improves dex
  //  specifically, another that improves both but less."*
  //
  // Each is a different apparatus you can read from the door: a plate-stack
  // PRESS is strength, a hanging HEAVY BAG is speed and hands, and a ROWER is
  // the whole body at once — which is why it trains both, and why it trains
  // both for less. Each stands on its own darker mat inlay.
  const inlay = (cx: number, cz: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matM);
    m.rotation.x = -Math.PI / 2;
    put(m, cx, 0.016, cz);
  };

  // ── THE PRESS (STR) — a seated press with a weight-stack tower ──
  const PR_CX = -2.3, PR_CZ = -1.7;
  let pressObj: THREE.Object3D;
  {
    inlay(PR_CX, PR_CZ, 1.9, 1.9);
    const TW_X = PR_CX - 0.55;                            // the tower, west side
    // the stack: a tower of plates drawn as one box with plate seams and the
    // magenta selector pin — the thing that makes a machine read as a machine
    const stackT = declareSurface(pixTex(16, 32, (g) => {
      g.fillStyle = '#23252a'; g.fillRect(0, 0, 16, 32);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      for (let y = 3; y < 32; y += 4) g.fillRect(0, y, 16, 1);   // the plate seams
      g.fillStyle = MAGENTA; g.fillRect(2, 11, 8, 2);            // the pin
      dither(g, 16, 32, 10);
    }), 'detail');
    pressObj = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.90, 0.34), ctx.flat(stackT));
    put(pressObj, TW_X, 0.53, PR_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.44), steelM), TW_X, 0.04, PR_CZ);
    // the guide rods and the crossbar over them
    for (const s of [-1, 1])
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.60, 8), greyM),
        TW_X, 0.88, PR_CZ + s * 0.13);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.44), steelM), TW_X, 1.70, PR_CZ);
    // the seat and its back pad, east side, facing the tower
    put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.10), steelM), PR_CX + 0.45, 0.275, PR_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), vinylM), PR_CX + 0.45, 0.58, PR_CZ);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.40), vinylM);
    back.rotation.z = -0.12;
    put(back, PR_CX + 0.66, 1.02, PR_CZ);
    // the press arms: two angled bars off the tower with handle grips
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.05), steelM);
      arm.rotation.z = 0.35;
      put(arm, PR_CX - 0.12, 1.42, PR_CZ + s * 0.24);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.20, 8), ironM);
      grip.rotation.x = Math.PI / 2;
      put(grip, PR_CX + 0.20, 1.54, PR_CZ + s * 0.30);
    }
    solid(PR_CX, PR_CZ, 1.5, 1.5);
  }

  // ── THE HEAVY BAG (DEX) — hung from the ceiling on its chain ──
  const BAG_CX = -1.2, BAG_CZ = 1.8;
  let bagObj: THREE.Object3D;
  {
    inlay(BAG_CX, BAG_CZ, 1.6, 1.6);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, 0.30), steelM), BAG_CX, 3.17, BAG_CZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.10, 8), greyM),
      BAG_CX, 2.60, BAG_CZ);
    // the bag: vinyl cylinder, steel collar, a cream tape band worn at fist
    // height — the one apparatus in the room a stranger names on sight
    bagObj = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.95, 12), vinylM);
    put(bagObj, BAG_CX, 1.52, BAG_CZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.06, 12), steelM),
      BAG_CX, 2.02, BAG_CZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.192, 0.192, 0.10, 12), creamM),
      BAG_CX, 1.42, BAG_CZ);
    solid(BAG_CX, BAG_CZ, 0.55, 0.55);
  }

  // ── THE ROWER (STR + DEX, for less) — an erg along the east wall ──
  const RW_CZ = 1.30;
  let rowObj: THREE.Object3D;
  {
    inlay(4.3, RW_CZ, 2.3, 1.0);
    // the flywheel at the west end, face into the room, cage in steel
    rowObj = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.14, 16), steelM);
    rowObj.rotation.x = Math.PI / 2;                      // axis along z: face shows
    put(rowObj, 3.55, 0.44, RW_CZ);
    const web = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 16), greyM);
    web.rotation.x = Math.PI / 2;
    put(web, 3.55, 0.44, RW_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.30), steelM), 3.55, 0.10, RW_CZ);
    // the rail, its legs, the sliding seat and the footplates
    put(new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.07, 0.15), greyM), 4.50, 0.30, RW_CZ);
    for (const x of [3.90, 5.25])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.30), steelM), x, 0.13, RW_CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.07, 0.28), vinylM), 4.65, 0.37, RW_CZ);
    for (const s of [-1, 1]) {
      const fp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.10), ironM);
      fp.rotation.z = -0.5;
      put(fp, 3.85, 0.30, RW_CZ + s * 0.22);
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.42), ironM), 3.90, 0.52, RW_CZ);
    solid(4.30, RW_CZ, 2.2, 0.8);
    // the poster on the wall over it
    const poT = declareSurface(pixTex(48, 32, (g) => {
      g.fillStyle = CREAM; g.fillRect(0, 0, 48, 32);
      g.fillStyle = MAGENTA; g.fillRect(0, 0, 48, 3); g.fillRect(0, 29, 48, 3);
      g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = TEAL; g.fillText('FEEL', 24, 11);
      g.fillStyle = MAGENTA; g.fillText('THE BURN', 24, 21);
      dither(g, 48, 32, 16);
    }), 'sign');
    room.sign(poT, 1.05, 0.72, hw - 0.09, 1.75, RW_CZ, -Math.PI / 2);
  }

  // ── the wall clock over the door, because every gym counts the hour ──
  {
    const ckT = declareSurface(pixTex(24, 24, (g) => {
      g.fillStyle = CREAM; g.beginPath(); g.arc(12, 12, 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = STEEL; g.lineWidth = 2;
      g.beginPath(); g.arc(12, 12, 11, 0, Math.PI * 2); g.stroke();
      g.fillStyle = STEEL;
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2;
        g.fillRect(Math.round(11 + Math.sin(a) * 8.5), Math.round(11 - Math.cos(a) * 8.5), 1, 1);
      }
      g.fillRect(11, 6, 1, 7); g.fillRect(11, 11, 5, 1);       // ten past six, forever
    }), 'sign');
    room.sign(ckT, 0.42, 0.42, AT, 2.92, hd - 0.09, Math.PI);
  }

  // ── the water cooler, in the front-east pier corner ──
  {
    const CX = 5.05, CZ = hd - 0.32;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.95, 0.36), creamM), CX, 0.475, CZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26),
      new THREE.MeshBasicMaterial({ color: 0x7ab8d4, transparent: true, opacity: 0.75 })),
      CX, 1.12, CZ);
    solid(CX, CZ, 0.40, 0.40);
  }

  // ── the counter: the sign-in desk across the back, teal under laminate ──
  const lamT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(80,90,90,0.16)';
    for (let i = 0; i < 24; i++) g.fillRect((i * 17) % 64, (i * 7) % 16, 2, 1);
    g.fillStyle = STEEL; g.fillRect(0, 14, 64, 2);                // the edge banding
  }), 'detail');
  const lam = lamT.clone();
  lam.wrapS = lam.wrapT = THREE.RepeatWrapping;
  lam.repeat.set(CTR_W / 2.0, CTR_D / 0.7);
  lam.needsUpdate = true;
  const frontT = declareSurface(pixTex(64, 26, (g) => {
    g.fillStyle = TEAL; g.fillRect(0, 0, 64, 26);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 26);     // the panel joints
    g.fillStyle = MAGENTA; g.fillRect(0, 3, 64, 1);               // the keyline
    g.fillStyle = STEEL; g.fillRect(0, 23, 64, 3);                // the kick
    dither(g, 64, 26, 30);
  }), 'detail');
  const fM = ctx.flat(frontT), tM = ctx.flat(lam);
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 1.02, CTR_D), [fM, fM, tM, fM, fM, fM]),
    CTR_CX, 0.51, CTR_Z);
  solid(CTR_CX, CTR_Z, CTR_W, CTR_D);

  // THE SIGN-UP BOOK, open on the counter with a pen in the gutter — the fee
  // you pay at this desk diegetically IS this book.
  {
    const BX = CTR_CX - 0.9;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.32), steelM), BX, 1.035, CTR_Z + 0.05);
    const pageT = declareSurface(pixTex(24, 16, (g) => {
      g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = 'rgba(60,60,70,0.5)';
      for (let y = 3; y < 15; y += 3) g.fillRect(2, y, 20, 1);    // the ruled lines
      g.fillStyle = 'rgba(40,40,90,0.6)';
      g.fillRect(3, 3, 8, 1); g.fillRect(3, 6, 11, 1); g.fillRect(3, 9, 6, 1);
    }), 'detail');
    for (const s of [-1, 1]) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.30), ctx.flat(pageT));
      page.rotation.x = -Math.PI / 2;
      page.rotation.z = s * 0.03;
      put(page, BX + s * 0.11, 1.052, CTR_Z + 0.05);
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.14), ironM), BX, 1.06, CTR_Z + 0.05);
  }
  // the till, and the towel stack a member is handed with the pass
  put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.30), greyM), CTR_CX + 1.3, 1.14, CTR_Z);
  for (let i = 0; i < 3; i++)
    put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.24),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xe8e4d8 : 0xdcd8cc })),
      CTR_CX + 0.55, 1.05 + i * 0.052, CTR_Z - 0.08);

  // ══ THE RATE BOARD ══════════════════════════════════════════════════════
  //
  // ONE FEE UNLOCKS EVERYTHING — *"you pay a fee at the front desk to be able
  // to use all the equipment"* — which is what the pass already was. Priced
  // against the ruler (rent $500/season, $17.86 a day):
  //
  //     day pass    1997 ~$4     ×4  ->  $15   (a day at the barn is $14)
  //     a season    1997 ~$30/mo ×4  ->  $120  (eight day passes)
  const dayNow = () => Math.floor(ctx.clock.now().totalMin / 1440);
  const RATES: ShopColumn[] = [
    { head: 'MEMBERS', lines: [
      { name: 'DAY PASS', price: 15.00, serve: () => {
        const d = dayNow();
        if (paidUntilDay > d) { hudNote('you are already signed in'); return false; }
        paidUntilDay = d + 1;
        hudNote('signed in — the floor is yours all day');
        return true;
      } },
      { name: 'FULL SEASON', price: 120.00, serve: () => {
        paidUntilDay = Math.max(paidUntilDay, dayNow()) + 28;
        hudNote('membership stamped — 28 days on the book');
        return true;
      } },
    ] },
  ];
  const RATE_LOOK: BoardLook = {
    panel: CREAM, frame: STEEL, band: TEAL, bandInk: CREAM,
    ink: '#2b2b28', priceInk: MAGENTA,
    hover: 'rgba(192,42,106,0.18)', flash: 'rgba(246,239,219,0.60)',
  };
  const BD_W = 2.8, BD_H = 0.9, BD_Y = 2.35;
  const BD_PX = Math.round(BD_W * 150), BD_PY = Math.round(BD_H * 150);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H),
    ctx.flat(boardTexture(BD_PX, BD_PY, RATES, RATE_LOOK)));
  put(board, CTR_CX, BD_Y, -hd + 0.09);
  put(new THREE.Mesh(new THREE.BoxGeometry(BD_W + 0.10, BD_H + 0.10, 0.06), steelM),
    CTR_CX, BD_Y, -hd + 0.05);

  // ── the trainer behind the desk ──
  //
  // Facing DERIVED from the counter, never typed (GOTCHAS §23). Teal polo —
  // the fascia colour on the staff — over grey trackpants.
  const KEEP_Z = CTR_Z - 0.62;
  const KEEP_X = CTR_CX + 0.3;
  const trainer = room.person({
    jacket: '#17766b', pants: '#4a4e54', skin: '#8a5a3a', hair: '#221c18',
    fit: 'plain', accent: '#c02a6a', cut: 'short', build: 1,
  }, KEEP_X, KEEP_Z, { facing: Math.atan2(0, CTR_Z - KEEP_Z), h: 1.02, w: 1.0 });

  // the card taped in the glass, from this side — what the street reads
  const cardT = declareSurface(pixTex(48, 12, (g) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, 48, 12);
    g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = MAGENTA; g.fillText('DAY PASS $15', 24, 6);
  }), 'sign');
  room.sign(cardT, 1.30, 0.30, 3.6, 0.72, hd - 0.09, Math.PI);

  // ══ TRAINING — THE WHOLE POINT OF THE BUILDING ══════════════════════════
  //
  // ── THE GATES, so this is not a money-to-god pump ────────────────────────
  //
  //   1. THE DOOR COSTS MONEY — the pass, off the desk, unlocks all three.
  //   2. ONE SESSION PER MACHINE PER DAY — then that piece of you is spent.
  //   3. GAINS DIMINISH — a specialist machine lands its +1 with chance
  //      (10−stat)/5, so 5→6 is certain and 9→10 is one day in five. THE
  //      ROWER TRAINS BOTH FOR LESS: it rolls STR and DEX independently at
  //      HALF those odds, which is the *"both but less"* of the ask as
  //      arithmetic. stats.ts clamps at 10 regardless.
  //
  // Each session advances the clock an hour, because an hour is what it is.

  /** one machine session: pay-gate, day-gate, an hour, then the rolls.
   *  `mul` scales the odds — 1 for a specialist, 0.5 for the rower. */
  const train = (
    kinds: StatName[], mul: number,
    getLast: () => number, setLast: (d: number) => void,
    words: { spent: string; maxed: string; gained: (k: StatName, v: number) => string; nothing: string },
  ): void => {
    const d = dayNow();
    if (paidUntilDay <= d) {
      hudNote('sign in at the desk first — day pass $15');
      return;
    }
    const open = kinds.filter((k) => stat(k) < 10);
    if (open.length === 0) { hudNote(words.maxed); return; }
    if (getLast() === d) { hudNote(words.spent); return; }
    setLast(d);
    ctx.clock.advance(60);
    const gains: string[] = [];
    for (const k of open) {
      const s = stat(k);
      if (Math.random() < ((10 - s) / 5) * mul) {
        raiseStat(k, 1);
        gains.push(words.gained(k, s + 1));
      }
    }
    hudNote(gains.length ? gains.join(', ') : words.nothing);
  };

  // THE PRESS — STR, specifically
  ctx.spot({
    x: room.wx(PR_CX + 1.35), z: room.wz(PR_CZ),
    aimX: room.wx(PR_CX), aimZ: room.wz(PR_CZ),
    r: 0.9, obj: pressObj,
    ok: room.inside,
    label: () => 'work the press',
    act: () => train(['str'], 1,
      () => lastPressDay, (d) => { lastPressDay = d; }, {
        spent: 'your arms are spent — come back tomorrow',
        maxed: 'as strong as a body gets',
        gained: (_k, v) => `the stack is paying off — STR ${v}`,
        nothing: 'a hard hour under the stack — nothing to show yet',
      }),
  });

  // THE HEAVY BAG — DEX, specifically
  ctx.spot({
    x: room.wx(BAG_CX + 1.1), z: room.wz(BAG_CZ),
    aimX: room.wx(BAG_CX), aimZ: room.wz(BAG_CZ),
    r: 0.9, obj: bagObj,
    ok: room.inside,
    label: () => 'work the bag',
    act: () => train(['dex'], 1,
      () => lastBagDay, (d) => { lastBagDay = d; }, {
        spent: 'your hands are done for today',
        maxed: 'your hands are as fast as hands get',
        gained: (_k, v) => `the bag is teaching you — DEX ${v}`,
        nothing: 'an hour on the bag — nothing to show yet',
      }),
  });

  // THE ROWER — both, for less
  ctx.spot({
    x: room.wx(2.75), z: room.wz(RW_CZ),
    aimX: room.wx(3.55), aimZ: room.wz(RW_CZ),
    r: 0.9, obj: rowObj,
    ok: room.inside,
    label: () => 'pull the rower',
    act: () => train(['str', 'dex'], 0.5,
      () => lastRowDay, (d) => { lastRowDay = d; }, {
        spent: 'your back is done rowing for today',
        maxed: 'the erg has nothing left to teach you',
        gained: (k, v) => `${k === 'str' ? 'STR' : 'DEX'} ${v} off the erg`,
        nothing: 'a long hour on the erg — nothing to show yet',
      }),
  });

  // ══ AND YOU SIGN IN WITH HIM, OFF THE BOARD ══════════════════════════════
  shopCounter(ctx, {
    id: 'ct-shop-gym',
    columns: RATES, look: RATE_LOOK,
    w: BD_PX, h: BD_PY,
    mesh: () => board,
    standoff: boardStandoff({ wM: BD_W, hM: BD_H, fov: 55, riseM: BD_Y - 1.75 }),
    fov: 55,
    stand: { x: room.wx(CTR_CX), z: room.wz(CTR_Z + CTR_D / 2 + 1.05) },
    keeper: { x: trainer.mesh.position.x, z: trainer.mesh.position.z, obj: trainer.mesh },
    who: 'the trainer',
    ok: room.inside,
  });
}

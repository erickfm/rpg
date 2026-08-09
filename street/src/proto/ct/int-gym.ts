import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { frontageWorld, alongU } from './tex-world';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import { stat, raiseStat } from './stats';
import { hudNote } from './hud';
import { registerSlice } from './save';

// FLEX GYM, inside.
//
// *"health is derived from str and con... that means we need a gym"*  (2026-08-08)
//
// The sixteenth interior, and the first one that TRAINS a stat rather than
// selling an object. `ct/stats.ts` landed this morning and owns the numbers;
// this room owns the sweat: you sign in at the desk, and the weights raise STR
// and the treadmills raise CON, one session of each a day, through
// `raiseStat()` so the 1…10 clamp is stats.ts's and not a second copy here.
//
// ── WHERE IT IS, AND WHOSE FRONTAGE IT TOOK ─────────────────────────────────
//
// GARAGE became the gym — an IDENTITY change in `ct/street.ts`, the same move
// that made RADIO into VOLT VILLAGE and LIQUOR into the SLEEP CENTER: `w`
// stays 12 so the side street's south run still totals 64 and still ends dead
// on x = 57, and nothing either side of it moves. GARAGE was chosen over the
// other empty shells because it is the unbuilt frontage nearest the main
// street (x 11…23, one door down from the VIDEO HUT), and because the
// community college is being placed by another builder at the same time —
// taking the near end leaves the rest of the side street clear.
//
// A 1997 storefront gym is a converted anything with rubber down and mirrors
// up, which is exactly what a shell called GARAGE wants to become.
const TEAL = '#17766b', MAGENTA = '#c02a6a', CREAM = '#f2ede0';
const STEEL = '#2e3134';

// ══ THE DOOR — A SIDE-STREET `face`, THE VIDEO HUT'S OWN CASE ═══════════════
//
// This shop fronts the side street, so its frontage runs along x and the plain
// `DoorDecl` form (a position on the roster's z axis) cannot express it. The
// `face` form can, and the VIDEO HUT one door west is the precedent this
// follows line for line: the point and normal here are the painter's own door
// (default band, doorFrac('FLEX GYM') = 0.82 along the glazing → doorCentreM
// 9.107, world x = 11 + 9.107 = 20.107), typed as the fallback the type
// requires and re-derived from the registry inside buildGym.
export const DOOR: DoorDecl = {
  building: 'FLEX GYM', w: 12, cz: -110, side: 1, at: 0,
  // what the default painter draws in the opening: an aluminium half-glazed
  // leaf at the band's own 1.05 m, so the door you walk through and the one
  // painted on the street are one number.
  leaf: {
    clearW: 1.05, h: 2.4, leaves: 1,
    frame: { colour: 0x8f938f, material: 'aluminium' }, glazing: 'full',
  },
  face: { x: 20.107, z: -110, nx: 0, nz: 1 },
};

// ══ THE MEMBERSHIP LEDGER — module state, saved as a slice ══════════════════
//
// Three day-numbers and nothing else. `paidUntilDay` is EXCLUSIVE — a day pass
// bought on day 12 sets it to 13 and is good until midnight; a season adds 28,
// the same 28 `ct/tenancy.ts` calls a season. `lastStrDay`/`lastConDay` are
// the one-session-a-day gates: a body trains once and then it is spent, which
// is the cap that keeps this from being a money-to-god pump — that and the
// STAT_MAX clamp stats.ts applies for free.
let paidUntilDay = -1;
let lastStrDay = -1;
let lastConDay = -1;

registerSlice('gym', {
  capture: () => ({ paidUntilDay, lastStrDay, lastConDay }),
  restore: (v: unknown) => {
    const o = v as Record<string, unknown>;
    if (!o || typeof o !== 'object') return;
    if (typeof o.paidUntilDay === 'number' && Number.isFinite(o.paidUntilDay)) paidUntilDay = o.paidUntilDay;
    if (typeof o.lastStrDay === 'number' && Number.isFinite(o.lastStrDay)) lastStrDay = o.lastStrDay;
    if (typeof o.lastConDay === 'number' && Number.isFinite(o.lastConDay)) lastConDay = o.lastConDay;
  },
});

export function buildGym(ctx: CtxBuild): void {
  // Where the door is, ASKED rather than remembered — interiors build last,
  // long after buildStreet registered every frontage (int-video.ts, verbatim).
  const FW = frontageWorld('FLEX GYM');
  if (!FW) {
    console.warn('[interior:gym] no FLEX GYM frontage is registered — building nothing.');
    return;
  }
  const W = 10.8;                      // roomWidthFor(12): the kit's own rule
  const K = W / FW.frontageM;
  const AT = alongU(FW, FW.doorWorld) * K - W / 2;      // +2.796 for this name
  const standZ = FW.facePos + FW.outward * 0.75;

  const room = buildRoom(ctx, {
    id: 'gym',
    label: 'into FLEX GYM',
    // NAMED, because a `face` room publishes no frontage and the kit cannot
    // otherwise find the DoorDecl above.
    building: 'FLEX GYM',
    w: W,
    // 9.6 deep — the depth is set by the WALKING, and the lane arithmetic is
    // written out at the floor plan below: every gap is 2.0 m or better.
    d: 9.6,
    // 3.2: a mirror wall wants height over it, and a treadmill's console
    // already stands 1.35 — a 3.0 ceiling put the banner in the coving.
    h: 3.2,
    // Rubber-charcoal floor, off-white walls, and the fascia's teal on every
    // piece of trim, so the room and its shopfront are one building.
    palette: { floor: 0x33353a, wall: 0xd8d4c8, ceil: 0xd2cec6, trim: 0x17766b },
    // Cool fluorescents and plenty — a gym in 1997 is lit like a supermarket,
    // and the mirror wall is only worth having if there is light to double.
    light: { kind: 'troffer', tint: 0xeef2f4, count: 6 },
    door: {
      at: AT, r: 1.05,
      x: FW.doorWorld, z: standZ,
      // The landing goes ALONG the walk, not out the normal — the video hut's
      // note: the side road's carriageway starts 2 m off this pavement.
      outX: FW.doorWorld + 1.5, outZ: standZ,
      // facing the outward normal +z is yaw π: you come out with the gym
      // behind you.
      outYaw: Math.PI, outGy: ctx.KERB_H,
    },
    // The glazed run west of the door, through the painter's own numbers
    // (default band): glazing 0.62…11.38 along u, the door and its 0.12 m
    // margin take 8.462…9.752, and the west run converts to local
    // −4.842…+2.216. Height and sill are the band's: gh 2.40, sill 0.40.
    window: { at: -1.313, w: 7.058, h: 2.40, sill: 0.40 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const tealM = new THREE.MeshBasicMaterial({ color: 0x17766b });
  const steelM = new THREE.MeshBasicMaterial({ color: 0x2e3134 });
  const greyM = new THREE.MeshBasicMaterial({ color: 0x6a6e74 });
  const ironM = new THREE.MeshBasicMaterial({ color: 0x23252a });
  const vinylM = new THREE.MeshBasicMaterial({ color: 0x7a2432 });   // bench pad
  const creamM = new THREE.MeshBasicMaterial({ color: 0xf2ede0 });

  // ── the floor: interlocking rubber tile, which is what a gym puts down ──
  //
  // 0.5 m squares in two charcoals with a stud-dot grain — the one floor that
  // says gym before you have read a sign, and the reason the palette above is
  // dark where every shop on this street is not. One 2×2 block of tiles per
  // canvas covers 1.0 m, so the repeat is the room's metres (GOTCHAS §5).
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

  // ══ THE FLOOR PLAN, AND THE LANE ARITHMETIC ═════════════════════════════
  //
  // The 2 m lane is sacred indoors. Room is 10.8 × 9.6, hw 5.4, hd 4.8, and
  // the door lands you at local x +2.80 on the front wall.
  //
  //   z  4.80   the front wall: door at +2.80, glass −4.84 … +2.22
  //             ── 2.55 m ──                        the entry lane
  //   z  2.25   the treadmill bank, north edge      (x 3.55 … 5.40)
  //   z  0.25   …and its south edge
  //             ── 3.40 m ──                        the open floor
  //   z −3.15   the counter's front face            (x 1.00 … 5.40)
  //   z −3.85   its back face
  //             ── 0.95 m ──                        the staff strip
  //   z −4.80   the back wall
  //
  // Across, x from −5.4 to 5.4:
  //
  //   the mirror wall and the dumbbell rack   −5.40 … −4.75
  //   the bench station                       −2.75 … −0.45
  //   the treadmill bank                       3.55 …  5.40
  //
  //   rack aisle       −4.75 → −2.75   2.00 m   (you lift facing the mirror)
  //   the centre run   −0.45 →  3.55   4.00 m   door to counter, dead straight
  //
  // The bench (z −2.15…−0.45) and the counter (x 1.00…5.40) share no span on
  // either axis; their closest corners are 1.76 m apart on the diagonal and
  // the walk between them is the 4.0 m centre run. Nothing is within 1.4 m of
  // the doorway, and the straight walk in ends at the sign-in desk.
  const CTR_X0 = 1.00, CTR_X1 = hw, CTR_D = 0.70, CTR_Z = -3.50;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;

  // ══ THE MIRROR WALL ═════════════════════════════════════════════════════
  //
  // NOTHING IN CROSSTOWN REFLECTS (ct/mirror.ts says so over the only real
  // mirror in the world, and keeps that one painted too). So this is what a
  // painted mirror is: pale blue-grey plate in aluminium-jointed panels with
  // two diagonal light streaks per sheet, run 7.2 m down the west wall from
  // 0.25 to 2.35 — the whole reason a free-weight floor stands against it.
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
    // the aluminium trim top and bottom, so the plate has edges and not a crop
    for (const y of [0.23, 0.25 + MIR_H + 0.02]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, MIR_W), greyM);
      put(rail, -hw + 0.05, y, MIR_CZ);
    }
    // the banner over it — every gym of the period hung one word over the iron
    const banT = declareSurface(pixTex(96, 12, (g) => {
      g.fillStyle = TEAL; g.fillRect(0, 0, 96, 12);
      g.fillStyle = CREAM; g.fillRect(0, 1, 96, 1); g.fillRect(0, 10, 96, 1);
      g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = CREAM; g.fillText('NO PAIN · NO GAIN', 48, 6);
    }), 'sign');
    room.sign(banT, 4.6, 0.42, -hw + 0.10, 2.72, MIR_CZ, Math.PI / 2);
  }

  // ── the dumbbell rack, against the mirror ──
  //
  // Two angled steel shelves with six pairs a tier — small iron boxes with
  // paler ends, which is all a dumbbell is at this art scale. One collider for
  // the unit at its real reach, and you lift in the 2.0 m aisle it faces.
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
    // uprights at the ends, so the shelves stand on something
    for (const z of [RK_Z0 + 0.05, RK_Z1 - 0.05])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.06), steelM), RK_X, 0.46, z);
    solid(RK_X, RK_CZ, 0.65, RK_L);
  }

  // ── THE BENCH, which is where STR lives ──
  //
  // A flat bench under a racked bar: red vinyl pad, steel legs, two uprights,
  // and a barbell with a plate and a collar each end. The plates are the only
  // cylinders in the room and they are what makes it a gym from the door. One
  // collider for the whole station; the [E] stands in the aisle at its foot.
  const BEN_CX = -1.6, BEN_CZ = -1.2;
  let benchObj: THREE.Object3D;
  {
    // the mat under the station — a darker rubber inlay, cheap and loud
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0),
      new THREE.MeshBasicMaterial({ color: 0x26282c }));
    mat.rotation.x = -Math.PI / 2;
    put(mat, BEN_CX, 0.016, BEN_CZ - 0.1);
    // the bench itself, long axis down z, head at the uprights
    put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 1.35), vinylM), BEN_CX, 0.45, BEN_CZ + 0.15);
    benchObj = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.39, 0.90), steelM);
    put(benchObj, BEN_CX, 0.195, BEN_CZ + 0.15);
    // the uprights and the bar across them
    for (const s of [-1, 1])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.15, 0.10), steelM),
        BEN_CX + s * 0.55, 0.575, BEN_CZ - 0.65);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.20, 10), greyM);
    bar.rotation.z = Math.PI / 2;
    put(bar, BEN_CX, 1.06, BEN_CZ - 0.65);
    for (const s of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 14), ironM);
      plate.rotation.z = Math.PI / 2;
      put(plate, BEN_CX + s * 0.90, 1.06, BEN_CZ - 0.65);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), greyM);
      collar.rotation.z = Math.PI / 2;
      put(collar, BEN_CX + s * 0.78, 1.06, BEN_CZ - 0.65);
    }
    // two spare plates leaning on the upright, because a gym is never tidy
    for (const [dx, dz] of [[-0.82, -0.30], [-0.70, -0.30]] as [number, number][]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 14), ironM);
      p.rotation.z = Math.PI / 2 - 0.18;
      put(p, BEN_CX + dx, 0.21, BEN_CZ + dz);
    }
    solid(BEN_CX, -1.3, 2.3, 1.7);
  }

  // ── THE TREADMILLS, which is where CON lives ──
  //
  // A bank of two against the east wall, facing west into the room so the
  // runner watches the floor and not the plaster. Deck, rails, a console on an
  // upright with a small green readout — 1997 in six boxes each. One collider
  // for the bank: the gap between the two decks is 0.45 m and boxing them
  // separately would only build a slot to wedge in.
  let millObj: THREE.Object3D;
  {
    const beltM = new THREE.MeshBasicMaterial({ color: 0x1c1e22 });
    const lcdM = new THREE.MeshBasicMaterial({ color: 0x4ad07a });
    const mill = (cz: number): THREE.Object3D => {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.14, 0.70), steelM);
      put(deck, 4.55, 0.09, cz);
      const belt = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 0.48), beltM);
      belt.rotation.x = -Math.PI / 2;
      put(belt, 4.60, 0.165, cz);
      for (const s of [-1, 1])                                 // the side rails
        put(new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.04, 0.05), greyM),
          4.45, 0.86, cz + s * 0.33);
      // the console, on twin uprights at the west (facing) end
      for (const s of [-1, 1])
        put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), steelM),
          3.85, 0.55, cz + s * 0.28);
      const con = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.62), steelM);
      put(con, 3.83, 1.10, cz);
      const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.08), lcdM);
      lcd.rotation.y = -Math.PI / 2;
      put(lcd, 3.75, 1.16, cz);
      return con;
    };
    millObj = mill(0.75);
    mill(1.75);
    solid(4.5, 1.25, 1.85, 2.0);
    // the poster on the wall over them, read from the deck
    const poT = declareSurface(pixTex(48, 32, (g) => {
      g.fillStyle = CREAM; g.fillRect(0, 0, 48, 32);
      g.fillStyle = MAGENTA; g.fillRect(0, 0, 48, 3); g.fillRect(0, 29, 48, 3);
      g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = TEAL; g.fillText('FEEL', 24, 11);
      g.fillStyle = MAGENTA; g.fillText('THE BURN', 24, 21);
      dither(g, 48, 32, 16);
    }), 'sign');
    room.sign(poT, 1.05, 0.72, hw - 0.09, 1.75, 1.25, -Math.PI / 2);
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

  // THE SIGN-UP BOOK, open on the counter with a pen in the gutter — the one
  // object the ask names, and the thing the day pass diegetically IS.
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
  // the till at the other end, small — a gym desk rings up passes, not stock
  put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.30), greyM), CTR_CX + 1.3, 1.14, CTR_Z);

  // ══ THE RATE BOARD ══════════════════════════════════════════════════════
  //
  // ── PRICED AGAINST THE RULER: rent is $500 a season ($17.86 a day) ────────
  //
  //     day pass    1997 ~$4    ×4  ->  $15  (a day at the barn is $14)
  //     a season    1997 ~$30/mo ×4 ->  $120 (eight day passes; commitment pays)
  //
  // A season of training costs a quarter of a season of rent, and maxing a
  // stat takes DAYS regardless of money — the wallet buys the door, never the
  // muscle. See the session gates below.
  const RATES: ShopColumn[] = [
    { head: 'TRAINING', lines: [
      { name: 'DAY PASS', price: 15.00, serve: () => {
        const d = dayNow();
        if (paidUntilDay > d) { hudNote('you are already signed in'); return false; }
        paidUntilDay = d + 1;
        hudNote('signed in — good all day');
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
  // the fascia colour on the staff, the discounter's rule — over grey
  // trackpants, 0.68 m of staff strip behind him.
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
  room.sign(cardT, 1.30, 0.30, -3.4, 0.72, hd - 0.09, Math.PI);

  // ══ TRAINING — THE WHOLE POINT OF THE BUILDING ══════════════════════════
  //
  // *"health is derived from str and con... that means we need a gym"* — and
  // health.ts derives its max from exactly these two numbers, so a session
  // here is a bigger bar there with no wire between the modules.
  //
  // ── THE THREE GATES, so this is not a money-to-god pump ──────────────────
  //
  //   1. THE DOOR COSTS MONEY  — a pass from the desk, $15 the day.
  //   2. A BODY TRAINS ONCE A DAY — one weights session and one run, then
  //      you are spent until tomorrow. Time is the real currency.
  //   3. GAINS DIMINISH — a session raises the stat with chance (10−stat)/5,
  //      so 5→6 is certain and 9→10 lands one day in five. stats.ts clamps
  //      at 10 regardless; expected cost of a maxed stat is ~11 training
  //      days, which is money AND a third of a season of mornings.
  //
  // Each session advances the clock an hour, because an hour is what it is.
  const dayNow = () => Math.floor(ctx.clock.now().totalMin / 1440);

  const train = (kind: 'str' | 'con'): void => {
    const d = dayNow();
    if (paidUntilDay <= d) {
      hudNote('sign in at the desk first — day pass $15');
      return;
    }
    const s = stat(kind);
    if (s >= 10) {
      hudNote(kind === 'str' ? 'as strong as a body gets' : 'your wind has no more to give');
      return;
    }
    if ((kind === 'str' ? lastStrDay : lastConDay) === d) {
      hudNote(kind === 'str' ? 'your arms are spent — come back tomorrow'
                             : 'your legs are done for today');
      return;
    }
    if (kind === 'str') lastStrDay = d; else lastConDay = d;
    ctx.clock.advance(60);
    if (Math.random() < (10 - s) / 5) {
      raiseStat(kind, 1);
      hudNote(kind === 'str' ? `the iron is paying off — STR ${s + 1}`
                             : `your wind is coming in — CON ${s + 1}`);
    } else {
      hudNote(kind === 'str' ? 'a hard hour under the bar — nothing to show yet'
                             : 'a long hour on the belt — nothing to show yet');
    }
  };

  // the bench: stand in the aisle at its foot, aim at the bench
  ctx.spot({
    x: room.wx(BEN_CX), z: room.wz(0.6),
    aimX: room.wx(BEN_CX), aimZ: room.wz(BEN_CZ),
    r: 0.9, obj: benchObj,
    ok: room.inside,
    label: () => 'work the weights',
    act: () => train('str'),
  });
  // the treadmills: stand off the west end of the bank, aim at the console
  ctx.spot({
    x: room.wx(3.15), z: room.wz(1.25),
    aimX: room.wx(3.83), aimZ: room.wz(0.75),
    r: 0.9, obj: millObj,
    ok: room.inside,
    label: () => 'run the treadmill',
    act: () => train('con'),
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

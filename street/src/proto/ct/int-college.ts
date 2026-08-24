import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { doorOpen } from './hours';
import { frontageWorld, alongU } from './tex-world';
import { screenFade, hudNote } from './hud';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import { jobStation } from './jobs';
import { stat, raiseStat } from './stats';
import { mentalFull } from './mental';

// CROSSTOWN COMMUNITY COLLEGE, inside.
//
// *"int allows you to get better jobs, but you always have a small chance of
//  getting the job or passing the application of whatever and that small
//  chance is slightly more likely from having high charisma. that means we
//  need a gym and a crosstown community college"*   (2026-08-08)
//
// This room is the second half of that sentence: the place INT is TRAINED.
// The rule itself — the small chance, the charisma nudge — lives in
// `ct/stats.ts` as `jobChance()`, waiting for a job-giver; nothing about jobs
// is built here. This room sells courses over a counter and calls
// `raiseStat('int', 1)` when one is completed, and that is its whole writ.
//
// ── WHAT A 1997 STOREFRONT CAMPUS IS ────────────────────────────────────────
//
// Not a quad. A community college's evening division rented exactly this kind
// of space: a former shop on a side street, lino on the floor, a registrar
// behind a counter you meet as you walk in, a partition with a corridor gap,
// and ONE classroom behind it with combo desks and a chalkboard. The whole
// building is read in two rooms and a corkboard, and everything below is one
// of those three things.
//
// ── THE FRONTAGE IS THE OLD LOANS OFFICE ────────────────────────────────────
//
// It was the south row of the side street, x 46…57 facing north — the old
// `LOANS` slot, and a storefront college moving into a dead loan office is
// precisely the 1997 of it. It is the MAIN street's east side now, z -9…14.2
// facing west, on the 23.2 m the used car lot gave up (*"swap the used car lot
// and the college pls"*, 2026-08-11) — twice the frontage, a real campus court
// in front of it, and the lot has the 11 m down the side street.
//
// NOTHING IN THE ROOM MOVED. Every position below is local to the room and the
// room asks `frontageWorld` where it is, so a building that doubles its
// frontage widens its own registrar's office and nothing else. The two facts
// that had to be chased by hand are both on `DOOR` below.
// (The GYM from the same ask is with another builder, told to prefer the park
// end — this is the opposite corner of the world from the park, on purpose.)
//
// EVERY COLOUR HERE IS INSTITUTIONAL ON PURPOSE: two-tone lino, off-white
// walls, and the one maroon — the fascia's own — spent on the dado line, the
// counter front and the course board's masthead, so the room and its sign out
// front are one building.
const MAROON = '#6a2430';
const CREAM = '#efe8d4';
const INK = '#2b2419';
const LINO = '#b2ac98', LINO_HI = '#c4beaa';
const OAK_D = '#7a5936';

// ══ THE DOOR ═══════════════════════════════════════════════════════════════
//
// STILL THE `face` FORM, AND NOW FOR THE OPPOSITE REASON. It was the face form
// because a side-street frontage runs along x and a `cz` on the roster's z axis
// means nothing there. The college is on the MAIN street's east side now —
// *"swap the used car lot and the college pls"* (2026-08-11) — where z IS the
// roster axis, so `cz` is meaningful again; but the facade is RECESSED
// `COLLEGE_YARD_D` behind the building line, and the derived form in
// `ct/doors.ts` puts the stand point at `side * FACE`, i.e. out on the pavement
// 4.5 m short of the door with the courtyard in between. `face` is what carries
// a facade that is not on the building line.
//
// AND THE TYPED VALUES ARE NOT ALL FALLBACKS, whatever the note here used to
// say. `doorPointFor` short-circuits on `face` and returns it BEFORE it looks at
// anything derived, so `face` is the first authority and two live consumers read
// it: the opening-hours card (ct/hours-cards.ts) and the "closed, opens at 8"
// [E] spot (ct/hours-doors.ts). The room itself is derived — it asks
// `frontageWorld` — which is exactly why a stale `face` is silent: the way in
// works and the card hangs in mid-air over the neighbour's brick.
//
//   frontage   z -9 … 14.2 on the east side, 23.2 m (it took the car lot's slot)
//   facade     x 11.5 — the building line at 7, plus the 4.5 m recess
//   door       centred, so z 2.6; `BANDS.college` centres it and
//              ct/college-yard.ts runs its gate, path and axis to the same line
export const DOOR: DoorDecl = {
  building: 'COMMUNITY COLLEGE', w: 23.2, cz: 2.6, side: 1, at: 0,
  // What collegeFront paints in that opening: a maroon timber DOUBLE leaf,
  // glazed above the lock rail, under a fanlight. 1.2 is BANDS.college's own
  // `dw`, so the opening you walk through and the painted one are one number.
  leaf: {
    clearW: 1.2, h: 2.4, leaves: 2,
    frame: { colour: 0x6a2430, material: 'timber' }, glazing: 'half',
  },
  face: { x: 11.5, z: 2.6, nx: -1, nz: 0 },
};

export function buildCollege(ctx: CtxBuild): void {
  // Asked, not remembered — the registry registered this frontage during
  // buildStreet, long before interiors run. Null means the roster no longer
  // has a COMMUNITY COLLEGE, and the honest answer is to build nothing.
  const FW = frontageWorld('COMMUNITY COLLEGE');
  if (!FW) {
    console.warn('[interior:college] no COMMUNITY COLLEGE frontage is registered — building nothing.');
    return;
  }
  const W = 9.8;                        // roomWidthFor(11): the kit's own rule
  const K = W / FW.frontageM;
  const AT = alongU(FW, FW.doorWorld) * K - W / 2;      // 0.0 — the campus axis
  // ── THE STAND POINT'S TWO NUMBERS SWAPPED AXES IN THE SWAP, AND THIS SPOT
  // MISSED IT: *"i can't enter the community college"* (2026-08-15). On the
  // side street the frontage ran along x, so `doorWorld` was an X and the
  // off-the-face coordinate was a Z — and the door below was written
  // `x: FW.doorWorld, z: standZ`. On the main street's east side the frontage
  // runs along z: `doorWorld` is now a Z (2.6) and the face offset an X
  // (10.75), so that line planted the way-in [E] spot at world (2.6, 10.75) —
  // out in the roadway, eleven metres from the door — while the CLOSED-hours
  // spot (ct/hours-doors.ts, off `face` above) stood correctly on the path.
  // Open for business and unenterable. Derived per axis now, so a third move
  // cannot repeat it.
  const standOff = FW.facePos + FW.outward * 0.75;      // off the facade, on the path
  const doorX = FW.axis === 'z' ? standOff : FW.doorWorld;
  const doorZ = FW.axis === 'z' ? FW.doorWorld : standOff;
  // Stepping out: 1.6 m further down the path toward the gate — 1.0 landed
  // inside the way-in trigger (r 1.2 wants 1.55 m clear; the kit has warned
  // about that gap since the room was built) and one more E sucked you back in.
  const outOff = FW.facePos + FW.outward * 2.35;
  const outNx = FW.axis === 'z' ? FW.outward : 0;       // the facade's outward normal
  const outNz = FW.axis === 'x' ? FW.outward : 0;

  const room = buildRoom(ctx, {
    id: 'college',
    label: 'into CROSSTOWN COMMUNITY COLLEGE',
    // NAMED, because a face-form room publishes no frontage and the kit
    // cannot otherwise find the DoorDecl above (int-video's warning).
    building: 'COMMUNITY COLLEGE',
    w: W,
    // 12 m deep — a lobby, a partition, and a classroom that holds six desks
    // with its aisle intact. The lane arithmetic is at the floor plan below.
    d: 12.0,
    // 3.1 m: an institutional drop-ceiling height, taller than a shop's 3.0
    // because the fluorescent battens hang in a room you sit under for hours.
    h: 3.1,
    palette: { floor: 0xb2ac98, wall: 0xd8d2c0, ceil: 0xe6e3d8, trim: 0x6a2430 },
    // Fluorescent battens, slightly green the way tube light over lino is —
    // six of them, because an evening class is lit like an office, not a shop.
    light: { kind: 'strip', tint: 0xf0f2e6, count: 6 },
    door: {
      at: AT, r: 1.2,
      x: doorX, z: doorZ,
      // the doorcase keeps the college's hours — night classes until nine.
      // See int-burger.ts's note, and ct/hours.ts.
      ok: () => doorOpen(ctx, DOOR.building),
      // You come out ON the courtyard path (ct/college-yard.ts's axis), a
      // stride down it toward the gate — not out along the walk, because the
      // walk is 4.5 m away across the yard now.
      outX: FW.axis === 'z' ? outOff : FW.doorWorld,
      outZ: FW.axis === 'z' ? FW.doorWorld : outOff,
      // fwd = (sin yaw, −cos yaw): facing the facade's outward normal — down
      // the path to the gate, whichever way the building faces.
      outYaw: Math.atan2(outNx, -outNz), outGy: ctx.KERB_H,
    },
    // One sash-run of glass west of the centred door — collegeFront paints
    // two tall windows in each flank; the room's opening is the west pair.
    // Door opening is local -0.72…+0.72 with its margin; this stops at -0.9.
    window: { at: -2.55, w: 3.3, h: 2.0, sill: 0.5 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const maroonM = new THREE.MeshBasicMaterial({ color: 0x6a2430 });
  const creamM = new THREE.MeshBasicMaterial({ color: 0xefe8d4 });
  const oakDM = new THREE.MeshBasicMaterial({ color: 0x7a5936 });
  const chromeM = new THREE.MeshBasicMaterial({ color: 0x9aa0a6 });
  const seatM = new THREE.MeshBasicMaterial({ color: 0xc8a24a });   // moulded plastic

  // ── the floor: two-tone vinyl composite tile, the school corridor classic ──
  //
  // 0.5 m squares checkered in two warm greys with a speckle in each — the one
  // floor that says "institution" before a single sign is read. The canvas
  // holds a 2 x 2 block of tiles = 1.0 m of floor, so the repeat is the room's
  // metres (GOTCHAS §5, volt's carpet makes the same point).
  const linoT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = LINO; g.fillRect(0, 0, 32, 32);
    g.fillStyle = LINO_HI;
    g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
    g.fillStyle = 'rgba(90,70,50,0.20)';
    for (let i = 0; i < 26; i++) g.fillRect((i * 13) % 32, (i * 7) % 32, 1, 1);  // the speckle
    g.fillStyle = 'rgba(60,50,40,0.12)';
    g.fillRect(15, 0, 1, 32); g.fillRect(0, 15, 32, 1);              // the joints
    dither(g, 32, 32, 20);
  }), 'ground');
  linoT.wrapS = linoT.wrapT = THREE.RepeatWrapping;
  linoT.repeat.set(Math.round(room.W), Math.round(room.D));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(linoT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ══ THE FLOOR PLAN, AND THE LANE ARITHMETIC ════════════════════════════════
  //
  // The 2 m lane is sacred indoors. Room is 9.8 x 12.0, hw 4.9, hd 6.0; the
  // door lands you at local x 0 on the front wall — the campus axis.
  //
  //   z  6.00   the front wall: door at 0, glass -4.20 … -0.90
  //             ── 3.60 m ──                       the lobby
  //   z  2.40   the registrar counter, front face  (x -4.35 … -0.35)
  //   z  1.70   …and its back face
  //             ── 1.03 m ──                       the registrar's strip
  //   z  0.675  the partition, north face          (x -4.90 … +1.90)
  //   z  0.525  …and its south face                (gap: x +1.90 … +4.90)
  //             ── 2.03 m ──                       front of the classroom
  //   z -1.50   the front desk row's chair edge    (rows at -2.15, -3.75)
  //   z -4.00   the back row's desk edge
  //   z -6.00   the back wall, chalkboard on it
  //
  // Across: the desk block sits west (x -3.95 … +0.15), so the EAST AISLE —
  // the run from the partition gap to the back of the classroom — is
  // 4.9 - 0.15 = 4.75 m clear. The lobby's walk from the door to the counter
  // face is 3.6 m; the corridor gap in the partition is 3.0 m. The waiting
  // chairs sit against the west wall with 2.9 m between them and the counter's
  // west end. Nothing is within 3.5 m of the doorway.
  const CTR_X0 = -4.35, CTR_X1 = -0.35, CTR_D = 0.70, CTR_Z = 2.05;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;
  const PART_Z = 0.60, PART_T = 0.15;
  const PART_X0 = -hw, PART_X1 = 1.90;
  const PART_CX = (PART_X0 + PART_X1) / 2, PART_W = PART_X1 - PART_X0;

  // ── the partition: lobby in front, classroom behind ──
  //
  // Stud wall to the ceiling, painted the room's own wall tone with the
  // maroon dado line a corridor of this period always has — one line at rail
  // height and a kick at the floor. The corridor gap (x +1.9 … +4.9) is east
  // of the centred door: you walk in on the axis, the counter ahead-left, the
  // way to the classroom a half-turn to your left.
  const partT = declareSurface(pixTex(64, 32, (g) => {
    g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, 64, 32);
    // canvas covers 3.4 x 1.7 m at the repeat below: dado at ~1.1 m, kick at 0
    g.fillStyle = MAROON; g.fillRect(0, 10, 64, 2);                  // the dado line
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 30, 64, 2);      // the kick
    dither(g, 64, 32, 18);
  }), 'detail');
  partT.wrapS = partT.wrapT = THREE.RepeatWrapping;
  partT.repeat.set(PART_W / 3.4, room.H / 1.7);
  put(new THREE.Mesh(new THREE.BoxGeometry(PART_W, room.H, PART_T), ctx.flat(partT)),
    PART_CX, room.H / 2, PART_Z);
  solid(PART_CX, PART_Z, PART_W, PART_T);

  // the room sign over the corridor gap — white letters on maroon, screwed to
  // the partition's end where you read it on the way through
  // 256x48 — ~197 px/m; the first pass was 64x12 with a 6px font, which canvas
  // antialiases into a smear before the face stretches it (same as the chalkboard)
  const wayT = declareSurface(pixTex(256, 48, (g) => {
    g.fillStyle = MAROON; g.fillRect(0, 0, 256, 48);
    g.font = 'bold 24px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = CREAM; g.fillText('CLASSROOM A →', 128, 24);
  }), 'sign');
  room.sign(wayT, 1.30, 0.24, 1.15, 2.35, PART_Z + PART_T / 2 + 0.008);

  // ── the registrar's counter ──
  //
  // Laminate top, maroon-fronted, standing across the west half of the lobby
  // so it is the first thing in view from the door — the volt rule ("the
  // counter is in the half of the room you walk into"), and here it IS the
  // shop: what this building sells is sold over it.
  const topT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(140,120,90,0.14)';
    for (let i = 0; i < 20; i++) g.fillRect((i * 17) % 64, (i * 7) % 16, 2, 1);  // the fleck
    g.fillStyle = OAK_D; g.fillRect(0, 14, 64, 2);                   // edge banding
  }), 'detail');
  const frontT = declareSurface(pixTex(64, 26, (g) => {
    g.fillStyle = MAROON; g.fillRect(0, 0, 64, 26);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 26);        // panel joints
    g.fillStyle = 'rgba(255,240,220,0.20)'; g.fillRect(0, 2, 64, 1); // the top line
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 23, 64, 3);      // the kick
    dither(g, 64, 26, 24);
  }), 'detail');
  const topTex = topT.clone();
  topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping;
  topTex.repeat.set(CTR_W / 2.0, CTR_D / 0.7);
  topTex.needsUpdate = true;
  const fM = ctx.flat(frontT), tM = ctx.flat(topTex);
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 1.02, CTR_D), [fM, fM, tM, fM, fM, fM]),
    CTR_CX, 0.51, CTR_Z);
  solid(CTR_CX, CTR_Z, CTR_W, CTR_D);

  // what lives on a registrar's counter: the tray of forms, a pen on a chain,
  // and a beige terminal turned so only its back says anything to you
  put(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.24), creamM), CTR_X0 + 0.60, 1.055, CTR_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.30, 0.30),
    new THREE.MeshBasicMaterial({ color: 0xd8cdb2 })), CTR_X1 - 0.55, 1.18, CTR_Z - 0.05);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), maroonM), CTR_X0 + 1.45, 1.06, CTR_Z + 0.10);

  // ── the registrar ──
  //
  // Facing DERIVED, never typed (GOTCHAS §23): the customers stand on the +z
  // side of the counter, so the heading points that way and moves if the
  // counter does. 0.30 m behind the counter's back face, 0.42 clear of the
  // partition — the thrift store lost its keeper inside the plaster at 0.55.
  const KEEP_X = CTR_CX + 0.30, KEEP_Z = CTR_Z - CTR_D / 2 - 0.30;
  const registrar = room.person({
    jacket: '#b08a3a', pants: '#4a4038', skin: '#a06a42', hair: '#8a8378',
    fit: 'plain', accent: MAROON, cut: 'short', build: 1,
  }, KEEP_X, KEEP_Z, { facing: Math.atan2(0, (CTR_Z + 2) - KEEP_Z), h: 1.00, w: 0.98 });

  // ── the waiting chairs, against the west wall of the lobby ──
  //
  // Three moulded-plastic chairs on chrome legs, bolted in a row the way a
  // registrar's lobby always has them — facing the counter, not the door.
  for (const z of [3.30, 4.05, 4.80]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), seatM), -4.50, 0.45, z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.45), chromeM), -4.50, 0.22, z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.40, 0.45), seatM);
    put(back, -4.70, 0.68, z);
  }
  solid(-4.58, 4.05, 0.70, 2.10);

  // ── the corkboard of course flyers, east wall of the lobby ──
  //
  // *"a corkboard of course flyers"* — cream and white sheets pinned at odd
  // heights, pull-tab fringes cut into the bottoms, one maroon header strip.
  // Flyer positions CYCLE rather than randomise (GOTCHAS §31).
  // 360 x 204 for 2.4 x 1.35 m = 150 px/m — the shop-board standard, after
  // *"make things readable"* (2026-08-09) caught every 50 px/m surface here.
  const corkT = declareSurface(pixTex(360, 204, (g) => {
    g.fillStyle = '#b08a54'; g.fillRect(0, 0, 360, 204);             // the cork
    g.fillStyle = OAK_D; g.fillRect(0, 0, 360, 6); g.fillRect(0, 198, 360, 6);
    g.fillRect(0, 0, 6, 204); g.fillRect(354, 0, 6, 204);            // the frame
    g.fillStyle = MAROON; g.fillRect(18, 15, 324, 27);               // the header
    g.font = 'bold 17px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = CREAM; g.fillText("SPRING '97 · EVENING DIVISION", 180, 30);
    const PAPER = ['#f4efe0', '#ffffff', '#f0e4c8', '#e8d8e0'];
    for (let i = 0; i < 7; i++) {
      const x = 21 + (i * 48) % 306, y = 57 + ((i * 11) % 3) * 39;
      const w = 39 + (i % 3) * 6, h = 48 + (i % 2) * 9;
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3, y + 3, w, h);
      g.fillStyle = PAPER[i % PAPER.length]; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(40,30,20,0.65)';
      for (let l = 0; l < 4; l++) g.fillRect(x + 6, y + 9 + l * 9, w - 12 - (l % 2) * 9, 3);
      for (let t = 0; t < 4; t++) g.fillRect(x + 3 + t * 9, y + h - 9, 6, 9);   // pull tabs
      g.fillStyle = MAROON; g.fillRect(x + Math.floor(w / 2), y - 3, 6, 6);     // the pin
    }
    dither(g, 360, 204, 48);
  }), 'sign');
  room.sign(corkT, 2.40, 1.35, hw - 0.06, 1.62, 3.90, -Math.PI / 2);

  // ══ THE LOBBY DRESSED — *"make the inside of the community college as nice
  // as the outside"* (2026-08-24). The facade got a stone order, a dedication
  // tablet and lit sashes; this is the same building met from indoors: the
  // tablet's words framed on the wall, the class photos a real evening
  // division hangs by its door, and the storefront radiator every converted
  // loans office kept because ripping it out cost money. Everything here hugs
  // a wall — the 3.6 m lobby walk and the corridor gap are untouched.

  // ── the walk-off mat, just inside the double leaf ──
  // Ribbed rubber-backed matting, maroon-bordered like everything else this
  // college owns. Flat on the lino, 3 mm proud, no collider — it is a rug.
  const matT = declareSurface(pixTex(96, 64, (g) => {
    g.fillStyle = '#3a352c'; g.fillRect(0, 0, 96, 64);
    g.fillStyle = MAROON; g.fillRect(0, 0, 96, 4); g.fillRect(0, 60, 96, 4);
    g.fillRect(0, 0, 4, 64); g.fillRect(92, 0, 4, 64);               // the border
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let y = 8; y < 58; y += 5) g.fillRect(6, y, 84, 2);         // the ribs
    g.fillStyle = 'rgba(200,190,170,0.10)'; g.fillRect(30, 12, 36, 40); // the wear
    dither(g, 96, 64, 26);
  }), 'detail');
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), ctx.flat(matT));
  mat.rotation.x = -Math.PI / 2;
  put(mat, 0, 0.020, hd - 0.65);

  // ── the radiator under the front glass ──
  // Column fins in chipped ivory paint, rust bleeding at the feet — it came
  // with the building. 0.42 m tall under the 0.5 m sill, west of the door on
  // the front wall, nowhere near the door's 1.44 m opening.
  const radT = declareSurface(pixTex(128, 48, (g) => {
    g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, 128, 48);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let x = 2; x < 128; x += 5) g.fillRect(x, 4, 2, 40);        // the fins
    g.fillStyle = 'rgba(255,255,245,0.35)'; g.fillRect(0, 0, 128, 3); // top rail
    g.fillStyle = 'rgba(122,74,42,0.35)';
    for (let i = 0; i < 9; i++) g.fillRect((i * 29) % 124, 40 + (i % 3) * 2, 5, 3); // the rust
    dither(g, 128, 48, 30);
  }), 'detail');
  put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.16), ctx.flat(radT)),
    -2.55, 0.26, hd - 0.14);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x8a8578 })), -2.55, 0.03, hd - 0.14);
  solid(-2.55, hd - 0.14, 2.0, 0.22);

  // ── the dedication plaque, west wall over the waiting chairs ──
  // The cornerstone outside says ERECTED A.D. 1971; indoors the same words go
  // on varnished oak with the lamp of learning, because a college that rents
  // a shopfront still frames its own founding. 288 px over 1.15 m = 250 px/m.
  const brassM = new THREE.MeshBasicMaterial({ color: 0xc8b06a });
  const sealT = declareSurface(pixTex(288, 196, (g) => {
    g.fillStyle = OAK_D; g.fillRect(0, 0, 288, 196);                 // the oak
    g.fillStyle = MAROON; g.fillRect(8, 8, 272, 180);                // the field
    g.strokeStyle = '#c8b06a'; g.lineWidth = 2;
    g.strokeRect(16, 16, 256, 164); g.strokeRect(22, 22, 244, 152);  // double rule
    // the lamp of learning: base, bowl, spout, and the flame in gold
    g.fillStyle = '#c8b06a';
    g.fillRect(132, 52, 24, 5); g.fillRect(140, 44, 8, 8);           // base and stem
    g.fillRect(126, 36, 36, 9); g.fillRect(158, 32, 8, 6);           // bowl and spout
    g.fillStyle = '#f2c86a'; g.fillRect(164, 24, 5, 9); g.fillRect(165, 20, 3, 5); // flame
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = CREAM;
    g.font = 'bold 24px monospace';
    g.fillText('CROSSTOWN', 144, 84);
    g.fillText('COMMUNITY COLLEGE', 144, 112);
    g.fillStyle = '#c8b06a'; g.fillRect(84, 130, 120, 2);            // the rule
    g.font = 'bold 14px monospace'; g.fillStyle = CREAM;
    g.fillText("EVENING DIVISION · EST. 1971", 144, 148);
    g.fillStyle = '#c8b06a'; g.fillText('LUX ET LABOR', 144, 168);
    dither(g, 288, 196, 36);
  }), 'sign');
  room.sign(sealT, 1.15, 0.78, -hw + 0.06, 2.00, 4.05, Math.PI / 2);

  // ── two class photos on the front wall, east of the door ──
  // Grey group portraits on the bleachers, cream mats, oak frames — the wall
  // you read on the way out, which is where these always hang. 206 px/m; the
  // caption is the only text and it gets the 10px floor.
  const photoT = (year: string, seed: number) => declareSurface(pixTex(128, 96, (g) => {
    g.fillStyle = OAK_D; g.fillRect(0, 0, 128, 96);                  // the frame
    g.fillStyle = CREAM; g.fillRect(6, 6, 116, 84);                  // the mat
    g.fillStyle = '#8a8578'; g.fillRect(14, 12, 100, 58);            // the print
    g.fillStyle = 'rgba(60,58,50,0.8)';
    g.fillRect(14, 30, 100, 2); g.fillRect(14, 48, 100, 2);          // the risers
    for (let r = 0; r < 3; r++) for (let i = 0; i < 11; i++) {
      const v = (i * 7 + r * 5 + seed) % 4;                          // cycle, not rnd
      g.fillStyle = ['#c8b8a0', '#a0785a', '#6a4a32', '#d8c8b0'][v];
      g.fillRect(18 + i * 9, 16 + r * 18, 5, 6);                     // the heads
      g.fillStyle = ['#3a3430', '#4a4038', '#2b241e', '#5a5048'][(v + 1) % 4];
      g.fillRect(17 + i * 9, 22 + r * 18, 7, 8);                     // the shoulders
    }
    g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = INK; g.fillText(`CLASS OF ${year}`, 64, 81);
    dither(g, 128, 96, 24);
  }), 'sign');
  room.sign(photoT("'95", 0), 0.62, 0.46, 2.35, 1.72, hd - 0.06, Math.PI);
  room.sign(photoT("'96", 2), 0.62, 0.46, 3.45, 1.72, hd - 0.06, Math.PI);

  // the nameplate on the counter, facing the queue, and the bin behind it
  const nameT = declareSurface(pixTex(128, 32, (g) => {
    g.fillStyle = MAROON; g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#c8b06a'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 30, 128, 2);
    g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = CREAM; g.fillText('REGISTRAR', 64, 17);
  }), 'sign');
  put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.065, 0.02), ctx.flat(nameT)),
    -1.35, 1.055, CTR_Z + 0.24);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26),
    new THREE.MeshBasicMaterial({ color: 0x6a6e62 })), -3.90, 0.16, 1.15);

  // ══ THE CLASSROOM ═══════════════════════════════════════════════════════════

  // ── the chalkboard, the whole back wall's reason ──
  //
  // Painted at 640x176 — ~133 px/m over the 4.80 x 1.30 m face, near the course
  // board's 150. The first pass was 160x44 (33 px/m) with 6-7px fonts, and a
  // canvas glyph that small is antialiased mush before the face ever stretches
  // it — *"its blurry"*. Same writing, four times the texels.
  const chalkT = declareSurface(pixTex(640, 176, (g) => {
    g.fillStyle = '#2f4f3e'; g.fillRect(0, 0, 640, 176);             // the slate green
    g.fillStyle = OAK_D; g.fillRect(0, 0, 640, 8); g.fillRect(0, 168, 640, 8);
    g.fillRect(0, 0, 8, 176); g.fillRect(632, 0, 8, 176);
    g.font = 'bold 28px monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(240,238,225,0.85)';
    g.fillText('WK 6: COMPOUND INTEREST', 32, 40);
    g.font = '24px monospace';
    g.fillText('A = P(1+r/n)^nt', 32, 80);
    g.fillText('MIDTERM THURSDAY — BRING A PENCIL', 32, 120);
    g.fillStyle = 'rgba(240,238,225,0.30)';                          // half-erased ghosts
    g.fillText('no. 2', 472, 80); g.fillRect(400, 136, 136, 3);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 5; i++) g.fillRect(40 + i * 120, 144, 72, 12); // eraser smears
    dither(g, 640, 176, 48);
  }), 'sign');
  room.sign(chalkT, 4.80, 1.30, -0.90, 1.75, -hd + 0.09);
  // the chalk rail under it, with the eraser sitting where it was left
  put(new THREE.Mesh(new THREE.BoxGeometry(4.80, 0.04, 0.10), oakDM), -0.90, 1.06, -hd + 0.14);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.06), creamM), -2.10, 1.10, -hd + 0.14);

  // ── the lectern and the instructor, mid-lecture ──
  const lectT = declareSurface(pixTex(24, 32, (g) => {
    g.fillStyle = '#a8804f'; g.fillRect(0, 0, 24, 32);
    g.fillStyle = OAK_D;
    for (let i = 0; i < 5; i++) { g.globalAlpha = 0.25; g.fillRect(0, 3 + i * 6, 24, 1); }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(0, 30, 24, 2);
    dither(g, 24, 32, 20);
  }), 'detail');
  put(new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.45), ctx.flat(lectT)), -3.50, 0.525, -5.00);
  solid(-3.50, -5.00, 0.55, 0.45);
  room.person({
    jacket: '#5a4a38', pants: '#3a3430', skin: '#8a5a3a', hair: '#4a4038',
    fit: 'plain', accent: CREAM, cut: 'short', build: 0,
  }, -3.50, -5.45, { facing: Math.atan2(0, -2.15 - (-5.45)), h: 1.00, w: 0.98 });

  // ── six combo desks, two rows of three, facing the board ──
  //
  // The tablet-arm school desk: a laminate top on a steel frame with the
  // moulded seat welded on behind. The block sits west so the east aisle —
  // the room's own walk from the corridor gap to the back — stays 4.75 m.
  // Row gaps are a classroom's (0.9 m between rows), which is furniture
  // spacing inside one block, like the diner's booths; the 2 m lanes are the
  // lobby, the gap and the aisle, and all three hold (floor plan above).
  const deskTopM = ctx.flat(topT);
  for (const x of [-3.60, -1.90, -0.20]) {
    for (const z of [-2.15, -3.75]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.50), deskTopM), x, 0.72, z);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.70, 0.05), chromeM), x - 0.26, 0.35, z);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.70, 0.05), chromeM), x + 0.26, 0.35, z);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.40), seatM), x, 0.45, z + 0.48);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), seatM), x, 0.70, z + 0.66);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), chromeM), x, 0.22, z + 0.48);
      solid(x, z + 0.20, 0.70, 1.00);
    }
  }

  // ── three students, mid-lecture ──
  //
  // An instructor lecturing an empty room was the giveaway that this interior
  // was furniture, not a college. Three of the six seats taken — an evening
  // class is never full — facing the board like the instructor faces them
  // (facing DERIVED toward the back wall, GOTCHAS §23). Seat top is the seat
  // box: 0.45 centre + 0.025. The desk in front hides the legs, so no
  // `seatFwd` — the bank and the library make the same call for the same
  // reason. These seats are not player seats (no ctx.seat here), so nothing
  // to claim.
  const STUDENTS: [number, number, Parameters<typeof room.person>[0]][] = [
    [-3.60, -2.15, { jacket: '#4a6a8a', pants: '#3a3e48', skin: '#8a5a3a',
      hair: '#2b241e', fit: 'plain', cut: 'crop', build: 0 }],
    [-0.20, -2.15, { jacket: '#8a4a3a', pants: '#4a4038', skin: '#c08a5a',
      hair: '#3a2e22', fit: 'plain', accent: CREAM, cut: 'tied', build: -1 }],
    [-1.90, -3.75, { jacket: '#6a6a5a', pants: '#3a3430', skin: '#a06a42',
      hair: '#8a8378', fit: 'plain', cut: 'short', build: 1 }],
  ];
  for (const [sx, sz, look] of STUDENTS) {
    room.person(look, sx, sz + 0.48,
      { seated: true, y: 0.475, facing: Math.atan2(0, -hd - sz), h: 1.00, w: 0.98 });
    // the open notebook and the pencil on that student's desk
    put(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.18), creamM), sx + 0.08, 0.746, sz);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.015),
      new THREE.MeshBasicMaterial({ color: 0xc8a230 })), sx - 0.14, 0.746, sz + 0.06);
  }
  // a backpack dumped by the front-left desk, inside its own collider
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.42, 0.17),
    new THREE.MeshBasicMaterial({ color: 0x4a5a42 }));
  pack.rotation.y = 0.5;
  put(pack, -3.32, 0.21, -1.72);

  // ── the low bookcase up the west wall: the course catalogue, in triplicate ──
  const spineT = declareSurface(pixTex(48, 16, (g) => {
    g.fillStyle = '#2b241e'; g.fillRect(0, 0, 48, 16);
    const SPINE = [MAROON, '#2f6ea8', '#c8a230', '#4a7a4a', '#8a4a3a'];
    for (let i = 0; i < 12; i++) {
      g.fillStyle = SPINE[i % SPINE.length];
      g.fillRect(1 + i * 4, 2 + (i % 3), 3, 13 - (i % 3));
      g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(1 + i * 4, 5, 3, 1);
    }
    dither(g, 48, 16, 22);
  }), 'detail');
  const caseT = declareSurface(pixTex(32, 16, (g) => {
    g.fillStyle = '#a8804f'; g.fillRect(0, 0, 32, 16);
    g.fillStyle = OAK_D; g.fillRect(0, 14, 32, 2); g.fillRect(0, 0, 32, 1);
    dither(g, 32, 16, 20);
  }), 'detail');
  put(new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.10, 3.00), ctx.flat(caseT)), -hw + 0.17, 0.55, -2.90);
  for (const dz of [-0.95, 0]) {
    const shelf = new THREE.Mesh(new THREE.PlaneGeometry(2.80, 0.34), ctx.flat(spineT));
    shelf.rotation.y = Math.PI / 2;                                  // faces +x, into the room
    put(shelf, -hw + 0.34, 0.62 + dz * 0.42, -2.90);
  }
  solid(-hw + 0.17, -2.90, 0.38, 3.00);

  // the clock every classroom is run by, on the east wall where the whole
  // class can watch it not move
  room.clock({ lx: hw - 0.07, y: 2.40, lz: -2.50, rotY: -Math.PI / 2, r: 0.19 });

  // ── the pull-down world map, filling the back wall east of the chalkboard ──
  //
  // Every 1997 classroom has one, rolled down and never quite rolled back up.
  // A spring roller on an oak slat, buff paper, pale oceans, the pull ring
  // hanging at the bottom. 440 px over 2.2 m = 200 px/m; the continents are
  // deliberate pixel blobs — recognisable at desk distance, on-style up close.
  const mapT = declareSurface(pixTex(440, 290, (g) => {
    g.fillStyle = '#a8c0c4'; g.fillRect(0, 0, 440, 290);             // the ocean
    g.fillStyle = 'rgba(60,70,72,0.12)';
    for (let x = 36; x < 440; x += 52) g.fillRect(x, 0, 1, 290);     // the graticule
    for (let y = 36; y < 290; y += 44) g.fillRect(0, y, 440, 1);
    const LAND: [number, number, number, number][] = [
      [40, 62, 90, 34], [58, 92, 76, 26], [84, 116, 40, 20],         // North America
      [128, 46, 34, 22],                                             // Greenland
      [116, 148, 34, 52], [122, 196, 20, 34],                        // South America
      [208, 58, 46, 30], [216, 86, 26, 14],                          // Europe
      [206, 108, 62, 48], [228, 154, 32, 34],                        // Africa
      [252, 52, 132, 44], [268, 96, 84, 30], [318, 124, 36, 22],     // Asia
      [354, 186, 44, 24],                                            // Australia
      [80, 254, 300, 16],                                            // Antarctica
    ];
    for (const [x, y, w, h] of LAND) {
      g.fillStyle = 'rgba(90,100,80,0.45)'; g.fillRect(x + 2, y + 2, w, h);  // the coast shadow
      g.fillStyle = '#d0c088'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(120,140,90,0.35)';
      g.fillRect(x + 4, y + 4, Math.max(2, w - 12), Math.max(2, h - 8));     // the interior green
    }
    g.fillStyle = 'rgba(140,60,50,0.55)';
    for (let i = 0; i < 9; i++) g.fillRect(58 + (i * 47) % 340, 64 + (i * 29) % 150, 3, 3); // capitals
    g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, 440, 26);              // the title strip
    g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(0, 25, 440, 1);
    g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = INK; g.fillText('THE WORLD · POLITICAL', 220, 14);
    g.fillStyle = 'rgba(40,30,20,0.25)';                             // roller curl
    g.fillRect(0, 282, 440, 8); g.fillRect(0, 0, 3, 290); g.fillRect(437, 0, 3, 290);
    dither(g, 440, 290, 60);
  }), 'sign');
  put(new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.07, 0.06), oakDM), 3.15, 2.33, -hd + 0.10);
  room.sign(mapT, 2.2, 1.45, 3.15, 1.56, -hd + 0.08);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.20, 0.03, 0.03), oakDM), 3.15, 0.825, -hd + 0.08);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), brassM), 3.15, 0.78, -hd + 0.08);

  // ── the flag in the back-east corner ──
  //
  // A classroom in 1997 has a flag on a floor pole whether anyone salutes it
  // or not. Brass pole and finial, the cloth hung on the corner diagonal so it
  // reads from the aisle. `room.sign` because a drape seen from behind must
  // not mirror (GOTCHAS §10).
  const flagT = declareSurface(pixTex(112, 176, (g) => {
    for (let i = 0; i < 14; i++) {                                   // hanging stripes
      g.fillStyle = i % 2 ? '#e8e4d8' : '#a83232';
      g.fillRect(i * 8, 0, 8, 176);
    }
    g.fillStyle = '#2a3a6a'; g.fillRect(0, 0, 48, 68);               // the canton
    g.fillStyle = '#e8e4d8';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
      g.fillRect(5 + c * 9 + (r % 2) * 4, 6 + r * 12, 2, 2);         // the stars
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(20, 0, 7, 176); g.fillRect(62, 0, 9, 176); g.fillRect(94, 0, 6, 176); // the folds
    dither(g, 112, 176, 30);
  }), 'sign');
  put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.35, 0.05), brassM), 4.55, 1.175, -5.55);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), brassM), 4.55, 2.40, -5.55);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), oakDM), 4.55, 0.025, -5.55);
  room.sign(flagT, 0.55, 0.85, 4.36, 1.85, -5.36, Math.PI / 4);
  solid(4.55, -5.55, 0.36, 0.36);

  // ══ ENROLMENT, OVER THE COUNTER, OFF THE BOARD ══════════════════════════════
  //
  // ── THE PRICES ARE MEASURED AGAINST RENT, AND A COURSE IS A COMMITMENT ─────
  //
  // *"use 500 bucks a mo rent as a baseline"* — rent is $500 a season. So the
  // night class is a tenth of a season, the certificate most of a month, and
  // the semester nearly two seasons of rent. Raising INT from the average 5 to
  // the cap of 10 costs $150 + 400 + 400 + 850 + 850 = $2,650 and 36 days of
  // your life, which is what "int allows you to get better jobs" ought to
  // cost against a purse that reaches ~$623 a season.
  //
  // ── AND THE INCREMENTS ARE SMALL, AND CAPPED BY TIER ───────────────────────
  //
  // Each completed course is `raiseStat('int', 1)` — one point, never more.
  // The cap is the syllabus: a night class cannot teach a person past INT 6,
  // the certificate stops at 8 — and the SEMESTER HAS NO TOP ANY MORE. It
  // read to 10 until *"i dont want an upper ceiling on the points"*
  // (2026-08-15) took the ceiling off the five numbers; with stats unbounded,
  // the full fourteen days re-enrols for ever, $850 and a fortnight per
  // point, because a stat with no ceiling still needs a ladder that reaches.
  // Past its cap a course refuses and SAYS WHY (shop.ts's rule: a silent
  // false reads as a broken shop), and the money never moves on a refusal —
  // that is `serve`'s own contract.
  //
  // ── AND A COURSE TAKES TIME, THE HOTEL'S WAY ───────────────────────────────
  //
  // The night class runs three hours tonight; the longer courses end at eight
  // in the morning after their last day, exactly the hotel's arithmetic — a
  // course of days ends at a morning, not "N×24 hours from whenever you paid".
  // Same fade, same 140/90/170 timing, because the world going by is the same
  // event wherever it happens.
  const enrol = (days: number, cap: number, done: string): boolean => {
    const int = stat('int');
    if (int >= cap) {
      hudNote(`Nothing on this syllabus you don't already know — INT ${int} wants the next course up.`);
      return false;
    }
    const { hour, minute } = ctx.clock.now();
    const mins = days === 0
      ? 180
      : ((8 * 60 - (hour * 60 + minute)) + 1440) % 1440 + (days - 1) * 1440;
    void screenFade({
      // *"school fills mental to full always."* (2026-08-15) — a completed
      // course, any length, restores the whole mental bar. Not the refusal
      // above: a syllabus you were turned away from is not a class attended.
      mid: () => { ctx.clock.advance(mins, { overSeconds: 0 }); raiseStat('int', 1); mentalFull(); },
      outMs: 140, holdMs: 90, inMs: 170,
    });
    hudNote(`${done} INT ${int + 1}.`);
    return true;
  };

  const COURSES: ShopColumn[] = [
    { head: 'EVENING DIVISION', lines: [
      { name: 'NIGHT CLASS', price: 150.00, serve: () => enrol(0, 6, 'Three hours of compound interest.') },
      { name: 'CERTIFICATE', price: 400.00, serve: () => enrol(7, 8, 'A week of evenings and a laminated card.') },
      { name: 'SEMESTER', price: 850.00, serve: () => enrol(14, Infinity, 'Fourteen days. The registrar shakes your hand.') },
    ] },
  ];
  const LOOK: BoardLook = {
    panel: CREAM, frame: OAK_D, band: MAROON, bandInk: CREAM,
    ink: INK, priceInk: MAROON,
    hover: 'rgba(106,36,48,0.14)', flash: 'rgba(255,250,235,0.60)',
  };
  // the course board, framed on the partition over the registrar's head —
  // 3.4 x 0.95 m at 150 texels per metre, bottom edge 1.85 m, volt's geometry
  const BD_W = 3.4, BD_H = 0.95, BD_Y = 2.33;
  const BD_PX = Math.round(BD_W * 150), BD_PY = Math.round(BD_H * 150);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H),
    ctx.flat(boardTexture(BD_PX, BD_PY, COURSES, LOOK)));
  const BD_Z = PART_Z + PART_T / 2 + 0.065;
  put(board, CTR_CX, BD_Y, BD_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(BD_W + 0.10, BD_H + 0.10, 0.06), oakDM),
    CTR_CX, BD_Y, BD_Z - 0.035);

  // You stand on the counter's centreline, 1.05 m off its front face, in the
  // middle of the 3.6 m lobby; the registrar is the aim, the board the view.
  shopCounter(ctx, {
    id: 'ct-shop-college',
    columns: COURSES, look: LOOK,
    w: BD_PX, h: BD_PY,
    mesh: () => board,
    standoff: boardStandoff({ wM: BD_W, hM: BD_H, fov: 55, riseM: BD_Y - 1.75 }),
    fov: 55,
    stand: { x: room.wx(CTR_CX), z: room.wz(CTR_Z + CTR_D / 2 + 1.05) },
    keeper: { x: registrar.mesh.position.x, z: registrar.mesh.position.z, obj: registrar.mesh },
    who: 'the registrar',
    ok: room.inside,
  });

  // ══ AND THE COLLEGE HIRES — application and punch clock (ct/jobs.ts) ═══════
  //
  // On the east wall of the LOBBY, in the clear strip between the partition's
  // corridor gap (south face z 0.675) and the corkboard (z 2.7 … 5.1 at
  // x hw-0.06). The section spans z 0.92 … 2.33 around this centre, so it
  // clears the corner by 0.24 m and the corkboard's frame by 0.37 m — it
  // used to sit AT z 3.3, mounted straight over the corkboard, and the card
  // rack (proud 0.02 off a hw-0.04 base) landed at exactly hw-0.06, coplanar
  // with the corkboard's plane: the z-fighting fuzz Erick shot 2026-08-10.
  // Its two stands point 0.79 m out on the open lobby floor.
  jobStation(ctx, room, 'ct-shop-college', { x: hw - 0.04, z: 1.55, rotY: -Math.PI / 2 });
}

import * as THREE from 'three';
import type { AABB } from '../fp';
import { pixTex, dither, declareSurface, type SurfaceKind } from './paint';

/** `pixTex` + `declareSurface` in one call — see the twin in ct/lot.ts.
 *
 *  Every texture this building paints declares what KIND of surface it is, so
 *  the seam audit can judge it rather than parking it as unjudgeable: from
 *  outside, a brick face and a painted sign are the same coloured rectangle
 *  and only the author knows which. This module had 240 textured faces and
 *  none of them said.
 *
 *  Wrapped rather than declared afterwards on purpose: a separate
 *  `declareSurface(t, …)` line is one you can forget when you add a texture,
 *  and forgetting it is silent. */
const surfTex = (kind: SurfaceKind, w: number, h: number,
                 draw: (g: CanvasRenderingContext2D) => void) =>
  declareSurface(pixTex(w, h, draw), kind);
import { ENTRANCE } from './tex-world';
import { declareRoom } from './interior';
import { citizenSprite, type CitizenSprite } from './citizens';
import { FACE } from './rng';
import { ORDER, type CtxBuild } from './ctx';
import { giveRandom, pocketsFull } from './inventory';
import { screenFade } from './hud';

// ── No. 227 — the player's walk-up ────────────────────────────────────────
// Four stories, a switchback stair, your place (301) on the third floor,
// and the hermit across the hall at 302. The interior is parked far east
// of the street, past the fog, in the same scene; the doors teleport.
//
// This module owns `lastGy` — the player's current floor height. It is not a
// plain value but a floor PICKER with hysteresis: with four floors stacked
// over one 2D walker, "which storey am I on" can only be answered by the
// height you were at last frame. Everything outside that needs to move the
// player between floors (the warp hook, the street's own groundY, the door
// jumps) goes through setGy so there is exactly one writer of record.
//
// ONE WRITER OF RECORD IS TRUE OF THE FUNCTION AND NOT OF THE CALLERS, and
// that gap produced the kerb-edge disagreement — see the note on `gy()` where
// this object is returned. `setGy` was indeed the only thing that assigned
// `lastGy`, but its caller `groundPick` was invoked per-frame with coordinates
// that are NOT the player's, so the single writer faithfully recorded the
// wrong position. A sole writer guarantees no races; it does not guarantee the
// value is about you. The guarantee now comes from the CALL, not the function:
// asking where the floor is is a pure read, and only a call that commits moves
// the storey.

// A 4×5 texel numeral, stamped rather than typed. Canvas text antialiases —
// at the sizes this world paints at, 'bold 8px monospace' lands half a texel
// off the grid and comes out as grey mush, which NearestFilter then magnifies
// into smear. Anything meant to be READ at this texel density has to be drawn
// as texels. Bit 3 is the leftmost column of each row.
const DIGIT: Record<string, number[]> = {
  '0': [0b1111, 0b1001, 0b1001, 0b1001, 0b1111],
  '1': [0b0010, 0b0110, 0b0010, 0b0010, 0b0111],
  '2': [0b1111, 0b0001, 0b1111, 0b1000, 0b1111],
  '3': [0b1111, 0b0001, 0b0111, 0b0001, 0b1111],
  '4': [0b1001, 0b1001, 0b1111, 0b0001, 0b0001],
  '5': [0b1111, 0b1000, 0b1111, 0b0001, 0b1111],
  '6': [0b1111, 0b1000, 0b1111, 0b1001, 0b1111],
  '7': [0b1111, 0b0001, 0b0010, 0b0010, 0b0010],
  '8': [0b1111, 0b1001, 0b1111, 0b1001, 0b1111],
  '9': [0b1111, 0b1001, 0b1111, 0b0001, 0b1111],
};
/** stamp digits at a 5-texel pitch (4 wide, 1 apart) from the top-left texel */
function stampNum(g: CanvasRenderingContext2D, num: string, x0: number, y0: number, ink: string) {
  g.fillStyle = ink;
  for (let i = 0; i < num.length; i++) {
    const rows = DIGIT[num[i]] ?? [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 4; c++) {
        if (rows[r] & (1 << (3 - c))) g.fillRect(x0 + i * 5 + c, y0 + r, 1, 1);
      }
    }
  }
}

/**
 * WHERE THE GAME STARTS: beside the bed in 301, facing the window.
 *
 * Declared here rather than typed into the entry point, the same way a room
 * declares its own `DOOR` and lets the facade read it: 301 is built around
 * these numbers, so 301 is the only place that can keep them true. Move the
 * walk-up and the spawn moves with it. `crosstown.ts` is builder F's — this is
 * the number for F to use, not an edit to their file.
 *
 *   crosstown.ts:460   new FPRig(cam, { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw })
 *                      ...starting the rig on SPAWN.gy, not ground level.
 *
 * ── why this spot and not the middle of the room ──
 *
 * The user asked for a viewpoint rather than a centre: *"waking up should have
 * a viewpoint ... so the first thing they see is the room and the street
 * beyond it rather than a wall."* This stands just off the foot of the bed,
 * looking west down the long axis of the room and straight out of the window,
 * so the first frame holds the bed, the radiator under the sill, the dresser,
 * and the buildings across the street through the glass. Confirmed by warping
 * there and looking at it, not by reasoning about it.
 *
 * ── the two things that had to be checked ──
 *
 * GOTCHAS 7, the stacked-storey floor picker: `groundAt` reads 5.4 here and
 * still reads 5.4 after walking forward, back, left and right from it, so the
 * hysteresis settles on floor 3 rather than resolving to the lobby underneath.
 * Starting on the wrong storey is worse than starting on the street.
 *
 * And it is clear of the furniture: 0 colliders within the rig's 0.36 m at the
 * spawn — the bed is 0.7 m north, the dresser is in the far corner, and the
 * door leaf misses it with the door OPEN and with it SHUT, which is the case
 * the closable door added.
 *
 * DERIVED from the building's own constants, so it survives the walk-up
 * moving: x = APT_X0 - 1.4, z = APT_Z0 + 3.7, floor 3 = 2 * ST0. Eye height
 * lands at 7.02.
 */
/** Where the walk-up stands, and its storey height. AT MODULE SCOPE because
 *  `SPAWN` below has to be derived from them rather than repeat them — these
 *  used to be locals inside `buildApartment`, which is why the first version of
 *  SPAWN was written `200 - 1.4` and claimed in its own comment to be local. It
 *  was a copy, and a copy of a coordinate is the exact defect 4a7c2f60 and
 *  4dae9afe are sweeping the checks for this week. `buildApartment` binds its
 *  own APT_X/APT_Z/ST to these, so the 57 uses inside it are unchanged. */
export const APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7;

export const SPAWN = {
  x: APT_X0 - 1.4,
  z: APT_Z0 + 3.7,
  yaw: -Math.PI / 2,
  gy: 2 * ST0,
};

export interface Apartment {
  /** hall/stair/room walls, plus the floor-aware caps kept up to date inside
   *  this module's own per-frame hook */
  colliders: AABB[];
  /** The floor picker: world x/z → ground height, with hysteresis.
   *
   *  **A PURE READ unless you pass `commit`.** The hysteresis reads the
   *  storey the player is on and, when committing, replaces it — so asking
   *  about somewhere the player is NOT standing must not commit, or the
   *  question becomes a move. Only the rig's per-frame ground callback, which
   *  passes the player's own position, may pass true. */
  ground: (wx: number, wz: number, commit?: boolean) => number;
  /** current floor height */
  gy: () => number;
  /** set it and hand it back, so callers can `return setGy(…)` */
  setGy: (v: number) => number;
  /** debug hook: force him in (true) / out (false) / back on schedule (null) */
  forceHermit: (v: boolean | null) => void;
  /** debug hook: every door gets a package (true) / none (false) / roll (null) */
  forcePackages: (v: boolean | null) => void;
  /** every door and whether it is holding a package right now — for checks */
  packages: () => { num: string; floor: number; present: boolean;
                    x: number; z: number; side: number; doorZ: number; doorW: number }[];
}

// WHAT CAME OFF THIS INTERFACE, and why it is worth a note rather than a
// silent deletion. It also published `AX`, `AZI`, `ST`, `updateCaps` and
// `updateHermit`. Counting readers across the tree: none of the five had one.
//
// `AX`/`AZI`/`ST` are this building's own local-to-world helpers and never
// meant anything outside it. `updateCaps` and `updateHermit` genuinely were
// called from the entry point once — they moved into this module's own
// `ctx.onFrame` when [E] spots did, and the interface kept advertising them
// afterwards.
//
// E's verify sweep asks whether everything a module publishes has a reader,
// which is a good question to steal: an unread export is a promise nobody
// checks. `updateHermit` had drifted to a four-argument signature by then, so
// anything that HAD called it would have broken — the interface was describing
// a building that no longer existed.

export function buildApartment(ctx: CtxBuild): Apartment {
  const { scene, boards, sidewalkY } = ctx;
  // Everything this module adds gets stamped `userData.mod = 'walkup'` at the
  // end — see the note by the return. The mark is taken before anything is
  // built; all 54 scene.add calls in this file are inside this function and it
  // is synchronous, so children from here to the end are exactly ours.
  const MARK = scene.children.length;
  // PUBLISHED, so a check can read the spawn without importing source.
  // interiors-walk reaches into /src/proto/ct/doors.ts and therefore cannot run
  // against the built bundle at all (af5b68cd); rainAt was published on
  // scene.userData for exactly this reason (e0c68e46). Same move, same reason:
  // scripts/door301.mjs asserts this number stays standable on floor 3, and it
  // has to be able to see it from a preview.
  scene.userData.spawn = SPAWN;
  const APT_X = APT_X0, APT_Z = APT_Z0, ST = ST0;
  // ── the switchback ───────────────────────────────────────────────────────
  // 7 risers over a 2.2 m run per half storey: a 0.193 m rise on a 0.314 m
  // tread, which is 31.5°. A normal residential pitch (US code allows about
  // 37°) and steeper than the 27.4° it used to be. Taller risers rather than
  // shallower treads, so the flight also eats 0.4 m less floor — the half
  // landing gets that back and is 2.6 m deep now instead of 2.2.
  //
  // EVERYTHING downstream is derived from these: the treads, the landing, the
  // core wall, the sloped soffits, the handrail, the under-stair boxes, the
  // colliders — and the one that actually bites, the ramp inside aptGround.
  // The floor-picker does not know about treads; it walks you up a smooth
  // ramp whose gradient is RISE/RUN. Change the pitch without re-deriving it
  // and you sink through the stairs or float above them.
  const STEPS = 7;
  const RISE = 1.35;                            // half a storey, fixed by ST
  const RUN = 2.2;                              // horizontal, per half flight
  const RISER = RISE / STEPS, TREAD = RUN / STEPS;
  const STAIR_Z0 = 8.4, STAIR_Z1 = STAIR_Z0 + RUN;
  /** The CENTRELINE of each half-flight, in lobby-local x. Flight A (up from the
   *  lobby) runs at 0.6, flight B (the return) at 1.8, either side of the core
   *  wall that separates them — the collider at `AX(1.04)…AX(1.36)` below.
   *
   *  Named because two things have to agree on it and did not: the tread meshes
   *  place themselves here, and the No. 227 door has to LAND you here. It landed
   *  you at `AX(1.2)` instead — dead centre of the core wall's own x-span — so
   *  holding W from the front door of the player's home walked you into the wall
   *  between the flights and stopped 0.39 m short of the bottom step, measured.
   *  Nothing was wrong with the staircase; the arithmetic mean of the two
   *  flights is not a place, it is the wall. (w28, item 53.)
   *
   *  The band that actually climbs is `AX(0.41)…AX(0.67)`, walked at 1 cm
   *  resolution (`scripts/probes/w28-227-landing.mjs`): above it you clip the
   *  core wall's south-west corner, below it the west lobby wall. 0.6 sits
   *  +0.07 / −0.19 inside that, and the bound is a static collider corner — no
   *  frame time enters it, so the margin is a fact rather than an average. */
  const FLIGHT_A_X = 0.6, FLIGHT_B_X = 1.8;
  const LAND_Z1 = 13.2;                         // the shaft's south wall
  // ── the top landing ──────────────────────────────────────────────────────
  // At floor 3 the shaft's west half is where flight A WOULD carry on up to a
  // fourth floor that does not exist, so it was open void. The hall floor
  // stopped dead at the stairwell and the picker's best offer over there was
  // flight A, a storey and a half below: step past AZI(8.4) and you dropped
  // 2.6 m. A collider hid it, which is its own kind of wrong — the floor
  // visibly ended and something you could not see stopped you.
  //
  // So floor the first NIB_D of that half at floor-3 level and put a real
  // railing on its edge. NIB_D is bounded by HEADROOM, not by taste: flight A
  // climbs directly underneath, and at 1.2 m deep the far end still clears
  // the flight below by about 2.0 m. Deepen it and you start clipping the
  // heads of people walking up.
  //
  // The landing geometry, the floor-picker and the guard collider all read
  // these three numbers. They must not drift apart — that is the whole bug.
  // ── doors ────────────────────────────────────────────────────────────────
  // The leaf inside doorTexN's painted casing is 26 of the texture's 32
  // texels, so the plane has to be 32/26 wider than the leaf you want. At
  // DOOR_W = 1.11 that is a 0.90 m leaf — a normal flat entry door. It used
  // to be 0.95, i.e. a 0.77 m leaf, which against a 2.1 m height read as a
  // slot rather than a door.
  //
  // DOOR_GAP is the real hole in the west wall that 301's doorway is cut
  // from — the only door you actually walk THROUGH rather than past. It has
  // to clear the leaf, and it has to clear the player: the rig is 0.36 m in
  // radius, so the old 0.80 m gap left 8 cm of daylight and you scraped
  // through it. 0.95 leaves 23 cm.
  const DOOR_W = 1.11, DOOR_GAP = 0.95;
  const NIB_D = 1.2;              // how far the landing reaches into the shaft
  const NIB_Z1 = STAIR_Z0 + NIB_D; // its open edge: the railing stands here
  const TOP_Y = 3 * ST;           // floor 3
  const AX = (lx: number) => APT_X + lx, AZI = (lz: number) => APT_Z + lz;
  let lastGy = 0; // last ground height — this is what picks the active floor
  const mkCap = (): AABB => ({ minX: 999, maxX: 999, minZ: 999, maxZ: 999 });
  const stairCap = mkCap();       // no stairs above floor 3
  const underStairA = mkCap();    // lobby: dead space under the flights
  const underStairB = mkCap();
  const aptDoorCap = mkCap();     // 301's doorway only opens on floor 3
  const hermitCap = mkCap();      // he is solid, but only when he is in
  const doorShutCap = mkCap();    // 301's leaf, when it is actually shut

  // ── 301's door, open and shut ────────────────────────────────────────────
  // The user: *"i want to be able to close this door"*. Being able to shut it
  // is most of the difference between a room and a corridor you happen to be
  // standing in.
  //
  // The leaf hangs on a pivot at the DOOR_Z0 jamb and its tip travels on a
  // circle of radius LEAF_W about that pivot. Both end poses fall out of that
  // one fact rather than being posed by eye:
  //   SHUT  the tip is at pivot + LEAF_W in +z, which lands it just short of
  //         the far jamb — so the leaf fills the gap and touches neither end
  //   OPEN  swung back flat against the room wall, which is where a door in a
  //         one-room flat actually lives
  /** WHICH JAMB A DOOR HANGS ON — one declaration for the whole building.
   *
   *  The user: *"301's knob is on the left ... to match the other floors"*, and
   *  he is right. Measured across the walk-up before changing anything:
   *
   *    101, 201, 401  (numbers ending 01)   hinge +z, knob -z
   *    102, 202, 402  (numbers ending 02)   hinge -z, knob +z
   *    302                                  hinge -z, knob +z   agrees with 02
   *    301                                  hinge -z, knob +z   should be 01
   *
   *  So a landing's pair MIRRORS — the two flats face each other and their
   *  doors open away from each other — and 301 was the only door in the
   *  building that broke it. Three 01 doors against one; the other floors win.
   *
   *  It is derived here rather than typed at each door so that "every 01 door
   *  in this building hands the same way" is true by construction and not by
   *  four numbers happening to agree. Same shape as F's entry-spot descriptor:
   *  one declaration, none hand-typed. */
  const hingeSide = (num: string) => (num.endsWith('01') ? 1 : -1);
  // ── EVERY DOOR IN THE BUILDING, DECLARED ONCE ────────────────────────────
  // The building used to know its own door count in exactly one place — the
  // loop that drew them — so anything else that wanted to reason about doors
  // had to restate the arithmetic and hope. This is that knowledge, hoisted:
  // eight flats, four landings, two per landing, and the two on floor 2 hung
  // as real openings rather than drawn as panels.
  //
  // Same argument as F's entry-spot descriptors, which is the precedent the
  // desk named: derive from the declaration and nothing hand-typed can drift
  // out of step when a landing moves.
  type WalkupDoor = {
    num: string; floor: number;
    x: number; z: number; ry: number; wallN: number;
    hinge: number;      // +1 hinges toward +z, -1 toward -z
    face: number;       // which way it opens into the hall: +1 is +x
    hung: boolean;      // a real swinging opening (301, 302) rather than a panel
  };
  /**
   * WHICH FACE POINTS WHICH WAY — the fourth attribute of a door, and the one
   * that did not come with the handing fix.
   *
   * The user, standing in his own flat: *"the 301 number plate is facing him"*.
   * A flat number goes on the HALL side so people in the corridor can find the
   * door; from inside your own home you never see your own number. The leaf's
   * two faces were swapped, and this is the fourth face/handedness fault of the
   * night — GOTCHAS 23, anything with a front ends up backwards.
   *
   * So it is DERIVED rather than flipped. A BoxGeometry's materials run
   * [+x, -x, +y, -y, +z, -z]; rotating the leaf by `a` about y sends local +z
   * to world (sin a, 0, cos a), so at the SHUT angle its world x-component is
   * `sin(shut)`. The hall lies in the `face` direction the door already
   * declares. If those agree, local +z is the hall side.
   *
   * Returns the pair in material order, so a caller cannot get it half right.
   */
  const leafFaces = <T,>(shut: number, face: number, hall: T, room: T): [T, T] =>
    (Math.sign(Math.sin(shut)) === Math.sign(face) ? [hall, room] : [room, hall]);
  const DOORS: WalkupDoor[] = [];
  for (let f = 0; f < 4; f++) {
    for (const side of ['01', '02'] as const) {
      const num = `${f + 1}${side}`;
      const west = side === '01';
      DOORS.push({
        num, floor: f,
        x: west ? AX(0.085) : AX(2.315),
        z: AZI(3.5),
        ry: west ? Math.PI / 2 : -Math.PI / 2,
        wallN: west ? AX(0.005) : AX(2.395),
        hinge: hingeSide(num),
        face: west ? 1 : -1,
        hung: f === 2,
      });
    }
  }
  // 301 hangs on the +z jamb (hingeSide('301') = +1), so its leaf must span
  // TOWARD -z when shut. Local -x maps to (-cos t, 0, sin t), so -z wants
  // t = -pi/2, and the open pose mirrors with it — still swinging back into the
  // room, which is where a door in a one-room flat lives. Both angles are
  // derived from the hand rather than typed, so flipping the hand flips the
  // swing WITH it: a knob moved without its hinges is a door that opens from
  // its own hinge edge, which looks right in a still and absurd in motion.
  const H301 = 1;                                   // = hingeSide('301')
  const DOOR_A_SHUT = H301 * -Math.PI / 2;
  const DOOR_A_OPEN = H301 * (Math.PI / 2 - 0.25);
  let doorShut = false;           // persists for the session, not per visit
  let doorA = DOOR_A_OPEN;        // where the leaf is right now
  let leaf301: THREE.Group | null = null;
  // 302's leaf, and the state that makes it follow the neighbour rather than
  // standing open for ever. The user: *"neighbors door should be closed when
  // neightbor is not out"*.
  //
  // SHUT is pi/2 for the same reason 301's is: the leaf hinges at DOOR_Z0 and
  // its local -x must map to +z to span the gap, and rotation.y = pi/2 is what
  // sends it there. OPEN is the pi - 0.28 it already had — swung back against
  // his own wall, which is where a door in a one-room flat actually lives.
  const D302_SHUT = Math.PI / 2, D302_OPEN = Math.PI - 0.28;
  let leaf302: THREE.Mesh | null = null;
  let d302A = D302_SHUT;            // CLOSED is the default on load, as asked
  // ── how the neighbour comes and goes ─────────────────────────────────────
  // The user: *"neighbor just disappears when he goes away why not make him go
  // in his apt and then close the door"*. He is right, and the fix is not a
  // better fade — it is that he was a BOOLEAN. `visible` went false and a man
  // stopped existing on a landing, which is a worse artefact than the
  // frequency problem that started this.
  //
  // So he is a small sequence now, in order, and the door is a CONSEQUENCE of
  // where he is in it rather than a second thing to keep in agreement:
  //
  //     in -> opening -> out -> loiter -> back -> closing -> in
  //     shut    swings     walks   stands   walks   swings     shut
  //
  // Two things fall out of that for free. The door is shut whenever he is not
  // there BY CONSTRUCTION, which is the state the desk asked for and which
  // used to need its own bookkeeping and a 1.2 s tail. And he cannot vanish
  // mid-move, because only `in` reads the schedule — once he is out of it the
  // sequence runs to its end whatever the hour does.
  type HermitPhase = 'in' | 'opening' | 'out' | 'loiter' | 'back' | 'closing';
  let hermitPhase: HermitPhase = 'in';   // SHUT and empty on load, as asked
  const HERMIT_X_IN = 2.52;              // behind his own door, inside the flat
  const HERMIT_X_OUT = 1.95;             // where he stands on the landing
  const HERMIT_WALK = 0.62;              // m/s — a big man, in no hurry
  const HERMIT_MIN_DWELL = 4;            // s he is out for at minimum
  let hermitX = HERMIT_X_IN;
  let hermitDwell = 0;
  let DOOR_PIV_X = 0, DOOR_PIV_Z = 0, DOOR_LEAF_W = 0.91;
  // assigned where the packages are built, which is inside the same block that
  // owns their meshes. Declared here so the returned object can close over them.
  // raised by the floor picker on the one frame it can still see that the
  // player was above the building; read and cleared by the respawn hook.
  let lostAbove = false;
  let pkgForceSet: (v: boolean | null) => void = () => {};
  let pkgReport: () => { num: string; floor: number; present: boolean;
                         x: number; z: number; side: number; doorZ: number; doorW: number }[] = () => [];

  // `doorClear` lived here: the swept-volume test that decided whether the
  // door was allowed to close. It is gone with the refusal it served — the
  // player being in the way is now resolved by fp.ts's unstick() rather than
  // by declining the interaction.

  const setCap = (c: AABB, on: boolean, x0: number, x1: number, z0: number, z1: number) => {
    if (on) { c.minX = x0; c.maxX = x1; c.minZ = z0; c.maxZ = z1; }
    else { c.minX = c.maxX = c.minZ = c.maxZ = 999; }
  };
  let hermit!: THREE.Mesh;
  let hermitSprite!: CitizenSprite;
  // he stands in his doorway on the east wall, so he faces WEST into the
  // hall. Same convention the street citizens use for `facing`: 0 is +z.
  const HERMIT_FACING = -Math.PI / 2;
  const sevColliders: AABB[] = [];
  {
    const texM = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    // tired beige stripes; the tile is one 2.7 m story so baseboards land on
    // every floor of the full-height walls
    const wallpaperT = surfTex('detail', 64, 64, (g) => {
      g.fillStyle = '#7e7460'; g.fillRect(0, 0, 64, 64); // dim halls — one bare bulb's worth
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64);
      // Report finding 3: this dark pinstripe was ONE texel in an eight-texel
      // repeat, and the stairwell is the only place in the building with a
      // long grazing sightline — so it is the only place the paper is asked to
      // survive heavy minification, and it broke into a moire crawl looking up
      // or down the shaft. GOTCHAS §4 ("a surface 1-2 texels cannot hold
      // detail") applied to a wall seen edge-on rather than to a thin surface.
      //
      // Two texels at half the contrast is the same stripe to the eye at
      // reading distance and twice the coverage at the far end, which is what
      // survives a mip level. Widening it rather than deleting it keeps the
      // paper looking like paper up close, where you spend most of your time.
      g.fillStyle = 'rgba(0,0,0,0.075)';
      for (let x = 6; x < 64; x += 8) g.fillRect(x, 0, 2, 64);
      dither(g, 64, 64, 90);
      // THE BAND IS GONE. The user: it reads as a stripe across the stairwell
      // wall behind the handrail, and he is right.
      //
      // It was a "ceiling shadow each storey" — 5 texels at 0.22 black plus 4
      // more at 0.1, at the TOP of the tile. That is defensible on a wall one
      // storey tall. But this tile is one 2.7 m storey and the stairwell walls
      // are the full 10.65 m, so it repeated at 2.7, 5.4 and 8.1 m — painting a
      // dark horizontal band across open wall at every storey line, including
      // mid-flight where there is no ceiling above it to cast anything.
      //
      // On the flights that band crosses the handrail's diagonal at a different
      // angle, which is exactly the visual noise he is objecting to: the rail
      // already gives that wall its strong line and a horizontal stripe
      // competing with it reads as a glitch rather than as trim.
      //
      // NOTHING DERIVES A HEIGHT FROM IT — it was paint, not geometry. The rail
      // is a polyline of its own (railPts) and the skirting below is a separate
      // band in this same tile, so cutting this moves neither.
      //
      // The skirting STAYS: it lands at every storey too, but there IS a floor
      // at each of those lines on the full-height walls, so it is describing
      // something real. And the vertical stripe stays — that is the period
      // paper and it is not what he objected to.
      g.fillStyle = '#3e3024'; g.fillRect(0, 58, 64, 6);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 58, 64, 1);
    });
    const roomWallT = surfTex('detail', 64, 64, (g) => {
      g.fillStyle = '#8a95a0'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
      dither(g, 64, 64, 80);
      g.fillStyle = '#3c3428'; g.fillRect(0, 58, 64, 6);
    });
    const carpetT = surfTex('ground', 64, 64, (g) => {
      g.fillStyle = '#663832'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 40; i++) g.fillRect(Math.floor(Math.random() * 62), Math.floor(Math.random() * 62), 3, 2);
      g.fillStyle = 'rgba(200,170,120,0.15)';
      for (let y = 8; y < 64; y += 16) for (let x = (y % 32) ? 2 : 10; x < 60; x += 16) { g.fillRect(x, y, 5, 1); g.fillRect(x + 2, y - 2, 1, 5); }
      dither(g, 64, 64, 130);
    });
    const woodFloorT = surfTex('ground', 64, 64, (g) => {
      g.fillStyle = '#7a5c3c'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 1);
      for (let y = 0; y < 64; y += 8) g.fillRect(((y * 13) % 56), y + 1, 1, 7);
      dither(g, 64, 64, 110);
    });
    const ceilT = surfTex('detail', 32, 32, (g) => {
      g.fillStyle = '#6e6a60'; g.fillRect(0, 0, 32, 32);
      dither(g, 32, 32, 60);
    });
    const H = 3 * ST + 2.55; // top-floor ceiling height
    // ── walls have THICKNESS ─────────────────────────────────────────────
    // They were single planes, so every opening was a hole cut in paper: you
    // stood in a doorway and the wall had no edge. A stud wall is ~0.14 m and
    // you SEE that at every opening, as the reveal down each side and the
    // head above. That one fact is most of what separates a building from a
    // set, so it is fixed here, once, for every wall in the walk-up rather
    // than patched opening by opening.
    //
    // The box's thin axis is its local z, which the ry rotation carries round
    // to the wall's normal — so the two big faces stay the papered ones and
    // the four narrow faces are cut plaster. The ends of a wall segment are
    // exactly what you look at when you stand in a doorway.
    const WALL_T = 0.14;
    const jambM = new THREE.MeshBasicMaterial({ color: 0x8b8271 });
    // uOff/vOff are in METRES from the start and the base of the wall this
    // piece belongs to. They exist because cutting an opening turns one wall
    // into four, and each piece then samples the tile from ITS own corner —
    // which puts the tile's baseboard band across the middle of the room. The
    // tile is one 2.7 m storey; a piece has to be told where in that storey it
    // sits or the paper does not line up across the hole.
    const wallMesh = (w: number, h: number, cx: number, cy: number, cz: number, ry: number,
                      tex = wallpaperT, uOff = 0, vOff = 0) => {
      const t = tex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      // The other half of finding 3. pixTex hands out NearestMipmapNearest,
      // which picks ONE mip level per fragment with a hard jump between them
      // and no anisotropy — down a stairwell that is a visible seam that
      // crawls as you climb. Linear between levels removes the seam, and
      // anisotropy is what actually fixes a grazing angle: it samples along
      // the direction the surface is stretched instead of taking a square.
      // magFilter is untouched, so it is still hard texels up close, which is
      // the whole look. three.js clamps the 8 to whatever the device allows.
      t.minFilter = THREE.NearestMipmapLinearFilter;
      t.anisotropy = 8;
      t.repeat.set(w / 2.7, h / 2.7);
      t.offset.set(uOff / 2.7, vOff / 2.7);
      t.needsUpdate = true;
      const face = new THREE.MeshBasicMaterial({ map: t });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, WALL_T),
        [jambM, jambM, jambM, jambM, face, face]);
      m.position.set(cx, cy, cz);
      m.rotation.y = ry;
      scene.add(m);
      return m;
    };
    // architrave: trim standing proud of the wall face on BOTH sides of an
    // opening, because you see both. A plain hole in wallpaper reads
    // unfinished no matter how much depth the reveal has.
    const trimM = new THREE.MeshBasicMaterial({ color: 0x473729 });
    // a0/a1 are the opening's extents along whichever axis the wall runs
    const casing = (wallN: number, a0: number, a1: number, yBase: number, yTop: number, alongZ = true) => {
      const z0 = a0, z1 = a1;
      const T = 0.028, W = 0.085;                    // projection, and trim width
      for (const s of [1, -1]) {
        const off = wallN + s * (WALL_T / 2 + T / 2);
        const put = (a: number, b: number, c: number, px: number, pz: number, py: number) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), trimM);
          m.position.set(px, py, pz);
          scene.add(m);
        };
        if (alongZ) {                                 // wall runs along z, normal is x
          put(T, yTop - yBase + W, W, off, z0 - W / 2, (yBase + yTop + W) / 2);
          put(T, yTop - yBase + W, W, off, z1 + W / 2, (yBase + yTop + W) / 2);
          put(T, W, z1 - z0 + W * 2, off, (z0 + z1) / 2, yTop + W / 2);
        } else {                                      // wall runs along x, normal is z
          put(W, yTop - yBase + W, T, z0 - W / 2, off, (yBase + yTop + W) / 2);
          put(W, yTop - yBase + W, T, z1 + W / 2, off, (yBase + yTop + W) / 2);
          put(z1 - z0 + W * 2, W, T, (z0 + z1) / 2, off, yTop + W / 2);
        }
      }
    };
    const floorMesh = (y: number, w: number, d: number, cx: number, cz: number, tex = carpetT) => {
      const t = tex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 1.8, d / 1.8);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), texM(t));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, y, cz);
      scene.add(m);
      return m;
    };
    // hall + stairwell shell. West wall leaves 301's doorway gap on floor 3.
    wallMesh(3.025, H, AX(0), H / 2, AZI(1.5125), Math.PI / 2);
    wallMesh(9.225, H, AX(0), H / 2, AZI(8.5875), Math.PI / 2);
    wallMesh(DOOR_GAP, 2 * ST, AX(0), ST, AZI(3.5), Math.PI / 2);
    wallMesh(DOOR_GAP, H - 2 * ST - 2.1, AX(0), (H + 2 * ST + 2.1) / 2, AZI(3.5), Math.PI / 2);
    // the east wall is pierced too: 302 is a real opening now, not a black
    // quad stuck on the face. Same four pieces as 301's side.
    wallMesh(3.025, H, AX(2.4), H / 2, AZI(1.5125), -Math.PI / 2);
    wallMesh(9.225, H, AX(2.4), H / 2, AZI(8.5875), -Math.PI / 2);
    wallMesh(DOOR_GAP, 2 * ST, AX(2.4), ST, AZI(3.5), -Math.PI / 2);
    wallMesh(DOOR_GAP, H - 2 * ST - 2.1, AX(2.4), (H + 2 * ST + 2.1) / 2, AZI(3.5), -Math.PI / 2);
    wallMesh(2.4, H, AX(1.2), H / 2, AZI(0), 0);
    wallMesh(2.4, H, AX(1.2), H / 2, AZI(13.2), Math.PI);
    // architrave round both flat doorways, on both faces of each
    const DOOR_Z0 = AZI(3.5 - DOOR_GAP / 2), DOOR_Z1 = AZI(3.5 + DOOR_GAP / 2);
    casing(AX(0), DOOR_Z0, DOOR_Z1, 2 * ST, 2 * ST + 2.1);
    casing(AX(2.4), DOOR_Z0, DOOR_Z1, 2 * ST, 2 * ST + 2.1);
    sevColliders.push(
      { minX: AX(-0.15), maxX: AX(0), minZ: AZI(0), maxZ: AZI(3.5 - DOOR_GAP / 2) },
      { minX: AX(-0.15), maxX: AX(0), minZ: AZI(3.5 + DOOR_GAP / 2), maxZ: AZI(13.2) },
      { minX: AX(2.4), maxX: AX(2.55), minZ: AZI(0), maxZ: AZI(13.2) },
      { minX: AX(0), maxX: AX(2.4), minZ: AZI(-0.15), maxZ: AZI(0) },
      { minX: AX(0), maxX: AX(2.4), minZ: AZI(13.2), maxZ: AZI(13.35) },
      { minX: AX(1.04), maxX: AX(1.36), minZ: AZI(STAIR_Z0), maxZ: AZI(STAIR_Z1) }, // core wall + the handrails on both its faces
      { minX: AX(2.25), maxX: AX(2.4), minZ: AZI(3.5 - DOOR_GAP / 2), maxZ: AZI(3.5 + DOOR_GAP / 2) }, // 302's doorway (and the hermit in it)
      stairCap, underStairA, underStairB, aptDoorCap, hermitCap, doorShutCap,
    );
    // floors, ceilings
    for (let f = 0; f < 4; f++) {
      floorMesh(f * ST + 0.006, 2.4, 8.4, AX(1.2), AZI(4.2));
      if (f < 3) floorMesh(f * ST + 2.55, 2.4, 8.4, AX(1.2), AZI(4.2), ceilT);
    }
    floorMesh(H, 2.4, 13.2, AX(1.2), AZI(6.6), ceilT);
    // the switchback: steeper now — 8 treads over a 2.6 m run (~28°), wood
    // grain on top, painted risers, a generous half landing
    const treadTopT = surfTex('ground', 32, 16, (g) => {
      g.fillStyle = '#6a5038'; g.fillRect(0, 0, 32, 16);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 4; y < 16; y += 4) g.fillRect(0, y, 32, 1);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(10, 4, 12, 12); // worn centre
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 0, 32, 2); // nosing
      dither(g, 32, 16, 40);
    });
    const riserT = surfTex('detail', 32, 12, (g) => {
      g.fillStyle = '#54402c'; g.fillRect(0, 0, 32, 12);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 32, 2);
      dither(g, 32, 12, 24);
    });
    const darkWoodM = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    const treadMats = [darkWoodM, darkWoodM, texM(treadTopT), darkWoodM, texM(riserT), texM(riserT)];
    const railM = new THREE.MeshBasicMaterial({ color: 0x3a2c20 });
    const landMats = [darkWoodM, darkWoodM, texM(woodFloorT.clone()), darkWoodM, darkWoodM, darkWoodM];
    for (let f = 0; f < 3; f++) {
      // tread i's TOP sits at (i+1) risers, so the last one is flush with the
      // landing and there is no half-step at either end of the flight
      for (let i = 0; i < STEPS; i++) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, TREAD + 0.05), treadMats);
        a.position.set(AX(FLIGHT_A_X), f * ST + (i + 1) * RISER - 0.09, AZI(STAIR_Z0 + (i + 0.5) * TREAD));
        scene.add(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, TREAD + 0.05), treadMats);
        b.position.set(AX(FLIGHT_B_X), f * ST + RISE + (i + 1) * RISER - 0.09, AZI(STAIR_Z1 - (i + 0.5) * TREAD));
        scene.add(b);
      }
      const LAND_D = LAND_Z1 - STAIR_Z1;
      const land = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, LAND_D), landMats);
      land.position.set(AX(1.2), f * ST + RISE - 0.07, AZI(STAIR_Z1 + LAND_D / 2));
      scene.add(land);
      // solid sloped undersides — the flights read as built, not floating
      const slope = Math.atan2(RISE, RUN);
      const soffit = Math.hypot(RISE, RUN) + 0.06;
      const underA2 = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, soffit), darkWoodM);
      underA2.position.set(AX(0.6), f * ST + RISE / 2 - 0.12, AZI(STAIR_Z0 + RUN / 2));
      underA2.rotation.x = -slope;
      scene.add(underA2);
      const underB2 = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, soffit), darkWoodM);
      underB2.position.set(AX(1.8), f * ST + RISE + RISE / 2 - 0.12, AZI(STAIR_Z0 + RUN / 2));
      underB2.rotation.x = slope;
      scene.add(underB2);
    }
    // one solid core wall between the up and down flights — no floating
    // diagonal rails, treads butt into something real
    // It stops 1.0 m above floor 3 — high enough to be the balustrade at the
    // head of the stairs, low enough that it is not a slab left standing in
    // the shaft — and it wears the hall's own wallpaper under a timber cap,
    // so it reads as a plastered core wall instead of a bare grey panel.
    // ── the handrail ─────────────────────────────────────────────────────
    // ONE rail, lobby to floor 3. You can slide your hand from the bottom of
    // the first flight, round every landing, to the top without letting go.
    // It used to be two stub rails per flight that both died in mid-air, at
    // heights that did not match each other or the landing.
    //
    // What makes every joint mitre dead flat, with no gooseneck anywhere: the
    // ramp through the nosings sits half a riser (0.096 m) above each
    // flight's structural floor, so a rake at 0.904 m above the nosings
    // arrives at EXACTLY 1.0 m above the floor at the bottom and 1.0 m above
    // the landing at the top — which is where the landing rail wants to be.
    // 0.904 over nosings, 1.0 over landings: both well inside code, and the
    // two reconcile themselves. Change RISE/RUN/STEPS and this still holds;
    // it falls out of the geometry rather than being tuned by hand.
    //
    // The run wraps the ENDS of the core wall — its south end at each half
    // landing, its north end at each floor — which is what carries the rail
    // across from one flight to the next and from one storey to the next.
    const RAIL_H = 1.0;                        // above floor / above landing
    const WX = AX(1.08), EX = AX(1.32);        // a rail off each core face
    const RET = 0.07;                          // return past the core's end
    const CORE_H = TOP_Y + RAIL_H - 0.04;      // cap centreline lands on RAIL_H
    const coreT = wallpaperT.clone();
    coreT.wrapS = coreT.wrapT = THREE.RepeatWrapping;
    coreT.repeat.set(RUN / 2.7, CORE_H / 2.7);
    coreT.needsUpdate = true;
    const coreFaceM = texM(coreT);
    const coreEdgeM = new THREE.MeshBasicMaterial({ color: 0x6e6558 });
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.12, CORE_H, RUN),
      [coreFaceM, coreFaceM, coreEdgeM, coreEdgeM, coreEdgeM, coreEdgeM]);
    divider.position.set(AX(1.2), CORE_H / 2, AZI(STAIR_Z0 + RUN / 2));
    scene.add(divider);
    // at floor 3 the core's cap IS the handrail — same centreline, so the
    // rake coming up the last flight mitres straight into it
    const coreCap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, RUN), railM);
    coreCap.position.set(AX(1.2), TOP_Y + RAIL_H, AZI(STAIR_Z0 + RUN / 2));
    scene.add(coreCap);
    // the polyline. Continuity is guaranteed by construction: consecutive
    // points share endpoints, so there is nothing to line up by hand.
    const railPts: THREE.Vector3[] = [];
    const P = (x: number, y: number, lz: number) => railPts.push(new THREE.Vector3(x, y, AZI(lz)));
    P(WX, RAIL_H, STAIR_Z0 - RET);                       // its newel, in the lobby
    for (let f = 0; f < 3; f++) {
      P(WX, f * ST + RAIL_H, STAIR_Z0);                  // foot of the first rake
      P(WX, f * ST + RISE + RAIL_H, STAIR_Z1);           // head of it, at the landing
      P(WX, f * ST + RISE + RAIL_H, STAIR_Z1 + RET);     // return past the core's south end
      P(EX, f * ST + RISE + RAIL_H, STAIR_Z1 + RET);     // across it
      P(EX, f * ST + RISE + RAIL_H, STAIR_Z1);           // onto the east face
      P(EX, (f + 1) * ST + RAIL_H, STAIR_Z0);            // up the second rake
      P(EX, (f + 1) * ST + RAIL_H, STAIR_Z0 - RET);      // return past the north end
      P(WX, (f + 1) * ST + RAIL_H, STAIR_Z0 - RET);      // across, ready for the next
    }
    const Z_AXIS = new THREE.Vector3(0, 0, 1);
    for (let i = 1; i < railPts.length; i++) {
      const a = railPts[i - 1], b = railPts[i];
      const d = new THREE.Vector3().subVectors(b, a);
      // segments overrun by one section so the mitres never open a gap
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, d.length() + 0.08), railM);
      seg.position.copy(a).addScaledVector(d, 0.5);
      seg.quaternion.setFromUnitVectors(Z_AXIS, d.clone().normalize());
      scene.add(seg);
    }
    // it is fixed to the core wall, so show the fixings: a bracket every
    // third of a flight, bridging the gap from the wall face to the rail
    for (let f = 0; f < 3; f++) {
      for (const t of [0.2, 0.5, 0.8]) {
        for (const [bx, y, lz] of [
          [AX(1.11), f * ST + RAIL_H + t * RISE, STAIR_Z0 + t * RUN],
          [AX(1.29), f * ST + RISE + RAIL_H + t * RISE, STAIR_Z1 - t * RUN],
        ] as [number, number, number][]) {
          const br = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.035), railM);
          br.position.set(bx, y - 0.065, AZI(lz));
          scene.add(br);
        }
      }
    }
    // the newel the whole run starts from, standing on the lobby floor
    const newel = new THREE.Mesh(new THREE.BoxGeometry(0.1, RAIL_H + 0.04, 0.1), railM);
    newel.position.set(WX, (RAIL_H + 0.04) / 2, AZI(STAIR_Z0 - RET));
    scene.add(newel);
    // ── the top landing itself ───────────────────────────────────────────
    // Carpet on top to match the hall it continues, a ceiling on the
    // underside because you walk up flight A directly beneath it, and a
    // timber fascia on the open edges so it reads as built rather than as a
    // floating shelf.
    const nibTop = carpetT.clone();
    nibTop.wrapS = nibTop.wrapT = THREE.RepeatWrapping;
    nibTop.repeat.set(1.2 / 1.8, NIB_D / 1.8);
    nibTop.needsUpdate = true;
    const nibUnder = ceilT.clone();
    nibUnder.wrapS = nibUnder.wrapT = THREE.RepeatWrapping;
    nibUnder.repeat.set(1.2 / 1.8, NIB_D / 1.8);
    nibUnder.needsUpdate = true;
    const nib = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, NIB_D),
      [darkWoodM, darkWoodM, texM(nibTop), texM(nibUnder), darkWoodM, darkWoodM]);
    nib.position.set(AX(0.6), TOP_Y + 0.006 - 0.06, AZI(8.4 + NIB_D / 2));
    scene.add(nib);
    // the guard: a railing you can SEE, standing exactly where the stairCap
    // collider starts, so nothing invisible ever stops you
    const railCap2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.09), railM);
    railCap2.position.set(AX(0.6), TOP_Y + RAIL_H, AZI(NIB_Z1));
    scene.add(railCap2);
    // BALUSTERS, not a single mid-rail. Report finding 7: the cap was right —
    // 1.0 m, continuous, meeting the core — but under it was one rail at half
    // height and then 0.50 m of clear air down to the landing. Nothing a
    // player can fall through, and that is exactly why it looked wrong rather
    // than felt wrong: it is the one place in the building that reads
    // under-BUILT instead of old, and a walk-up stair from this period is the
    // last thing that would be.
    //
    // Pitch is 0.115 with a 0.035 stick, so the clear gap is 0.08 — under the
    // hand's-breadth a balustrade is actually built to, which is the number
    // that makes a run of sticks look considered rather than decorative.
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 0.055), railM);
    botRail.position.set(AX(0.6), TOP_Y + 0.075, AZI(NIB_Z1));
    scene.add(botRail);
    const BAL_H = RAIL_H - 0.135;
    for (let bx = 0.155; bx <= 1.05; bx += 0.115) {
      const bal = new THREE.Mesh(new THREE.BoxGeometry(0.035, BAL_H, 0.035), railM);
      bal.position.set(AX(bx), TOP_Y + 0.075 + BAL_H / 2 + 0.0225, AZI(NIB_Z1));
      scene.add(bal);
    }
    // the newels last, so they read as heavier than what they carry
    for (const lx of [0.08, 0.6, 1.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, RAIL_H, 0.07), railM);
      post.position.set(AX(lx), TOP_Y + RAIL_H / 2, AZI(NIB_Z1));
      scene.add(post);
    }
    // lobby: the dead space under the half landing stays boxed in, full
    // width. The east half of the shaft NEARER the hall used to be boxed too
    // — a flat navy panel that read as a blue wall — and is the basement
    // stair now; see further down, once the glow material exists.
    const underM = new THREE.MeshBasicMaterial({ color: 0x1a1b21 });
    const underLand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, LAND_Z1 - STAIR_Z1), underM);
    underLand.position.set(AX(1.2), 0.65, AZI((STAIR_Z1 + LAND_Z1) / 2));
    scene.add(underLand);
    // doors up the floors — 301 is a real opening; 302 is the hermit's
    // knob=false for leaves that carry a MODELLED handle instead — drawing
    // both gives the door two knobs in different places
    const doorTexN = (num: string, knob = true) => surfTex('detail', 32, 64, (g) => {
      g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#5c4430'; g.fillRect(3, 3, 26, 61);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(7, 16, 18, 16); g.fillRect(7, 38, 18, 20);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(7, 16, 18, 2); g.fillRect(7, 38, 18, 2);
      if (knob) { g.fillStyle = '#c9b45e'; g.fillRect(24, 33, 3, 3); }
      dither(g, 32, 64, 40);
      // The number plate: screwed-on BRASS, fixed after the grime. It used to
      // be a near-white rectangle — brighter than anything else indoors, so it
      // pulled the eye off the door it labels — carrying canvas text that
      // smeared. Brass sits in the same muted register as the hall, and the
      // numerals are stamped texel by texel so they stay sharp.
      // Centred on the door: plate x 7…24, numerals 9…22, both about x = 16.
      g.fillStyle = '#8a7440'; g.fillRect(7, 4, 18, 9);
      g.fillStyle = '#a89056'; g.fillRect(7, 4, 18, 1);   // lit top edge
      g.fillStyle = '#5e4e28'; g.fillRect(7, 12, 18, 1);  // shadow under it
      g.fillStyle = '#6a5a30';                            // four fixing screws
      g.fillRect(8, 5, 1, 1); g.fillRect(23, 5, 1, 1);
      g.fillRect(8, 11, 1, 1); g.fillRect(23, 11, 1, 1);
      if (num) stampNum(g, num, 9, 6, '#2e2616');
    });
    /** The INSIDE face of a flat's own front door. Same leaf, no number and no
     *  plate: the number is how the hall tells your door from the hermit's,
     *  and you do not need telling which door is yours from your own side.
     *  It used to carry 301 on both faces, which read as a second door
     *  standing in the room whenever it was open. */
    const doorTexInner = () => surfTex('detail', 32, 64, (g) => {
      g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#57402c'; g.fillRect(3, 3, 26, 61);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(7, 16, 18, 16); g.fillRect(7, 38, 18, 20);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(7, 16, 18, 2); g.fillRect(7, 38, 18, 2);
      // a security chain and its slide, because this is the side you use
      g.fillStyle = '#8d8d92'; g.fillRect(5, 22, 6, 2);
      g.fillStyle = '#6e6e74'; for (let i = 0; i < 5; i++) g.fillRect(11 + i * 2, 23, 1, 1);
      dither(g, 32, 64, 40);
    });
    // Report finding 8: the knob was a single flat square of #c9b45e painted
    // into the texture. At the distance you stand to read the number plate the
    // plate is crisp and the knob is a yellow blob — the one thing on the door
    // that never got the texel treatment the numerals got.
    //
    // It is modelled now, so `doorTexN` must stop painting one as well: 301's
    // leaf already hit exactly this and came back with two knobs.
    const knobM = new THREE.MeshBasicMaterial({ color: 0xc9b45e });
    const knobDark = new THREE.MeshBasicMaterial({ color: 0x8f7d3c });
    // ── ONE KNOB FOR THE WHOLE BUILDING ──────────────────────────────────
    // The user: *"door handles on my floor dont match other door handles"*.
    // He is right, and the mismatch was inside this building rather than
    // against the rest of the world. Three treatments were in play:
    //
    //   the six flat doors   rose + stem + ball, modelled, at floor + 1.02
    //   301                  a plain 0.055 box, at floor + 1.07
    //   302                  a PAINTED 3x3 square and no geometry at all
    //
    // 302 was the only door in the walk-up with a painted handle, and 301 and
    // 302 are the two you stand between every time you leave your flat — so
    // his floor was the one place all three met.
    //
    // On the world's tone, checked before changing anything: #c9b45e is not
    // just ours. It is in ct/interior.ts, bodega-corner.ts and int-thrift.ts as
    // well, so ours is the one the others copied and the brass stays. The real
    // outliers elsewhere are int-library's grey steel LEVER at 1.02 and
    // int-pawn's olive painted bar — those are F's and are the desk's to route.
    //
    // `axis` is which way the knob sticks out: 'x' for the flat door planes,
    // 'z' for the two hung leaves, whose local +z becomes world x once the
    // leaf is swung. Same parts, same height, same brass either way.
    const doorKnob = (parent: THREE.Object3D, lx: number, ly: number, lz: number,
                      dir: number, axis: 'x' | 'z') => {
      const put = (m: THREE.Mesh, out: number) => {
        m.position.set(lx + (axis === 'x' ? dir * out : 0), ly,
                       lz + (axis === 'z' ? dir * out : 0));
        if (axis === 'x') m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
        parent.add(m);
      };
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.012, 8), knobDark);
      put(rose, 0.012);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.055, 6), knobM);
      put(stem, 0.040);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), knobM);
      ball.position.set(lx + (axis === 'x' ? dir * 0.076 : 0), ly,
                        lz + (axis === 'z' ? dir * 0.076 : 0));
      parent.add(ball);
    };
    // wallN is the centreline `casing` measures from. It puts its trim at
    // wallN +- (WALL_T / 2 + T / 2), so it is picked to land a few mm PROUD of
    // the leaf rather than behind it.
    const doorPlane = (num: string, wx: number, baseY: number, wz: number, ry: number,
                       wallN: number) => {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 2.1), texM(doorTexN(num, false)));
      d.position.set(wx, baseY + 1.05, wz);
      d.rotation.y = ry;
      scene.add(d);
      // A knob is a rose, a stem and a ball. The rose is what actually reads
      // at hall distance — a knob with no backplate looks stuck on.
      const nx = Math.sin(ry) < 0 ? -1 : 1;          // which way the door faces
      const off = -hingeSide(num) * (DOOR_W / 2 - 0.13);   // knob opposite the hinge
      doorKnob(scene, wx, baseY + 1.02, wz + off, nx, 'x');
      // Report finding 2, the last of it: these six doors had their casing
      // PAINTED INTO doorTexN, so beside 301's and 302's real architrave they
      // read flat — consistent with each other, inconsistent with the two
      // openings you actually walk through. The painted border stays (it is
      // the leaf's own stile edge) and real trim goes outside it.
      casing(wallN, wz - DOOR_W / 2 - 0.015, wz + DOOR_W / 2 + 0.015,
        baseY, baseY + 2.1);
    };
    // Built from DOORS rather than from a second copy of the same arithmetic.
    // The desk, on the packages that hang off this: *"the walk-up needs to know
    // how many doors it has — if that is currently hardcoded per floor, derive
    // it."* It was: this loop knew, and nothing else did.
    for (const d of DOORS) if (!d.hung) doorPlane(d.num, d.x, d.floor * ST, d.z, d.ry, d.wallN);
    // ── 302, ajar ────────────────────────────────────────────────────────
    // It was a flat black quad hung on the wall face. Pure black behind a
    // hard edge reads as a hole cut in the wall, not as a dark room — and it
    // was also what sliced the hermit in half, since his billboard swept
    // straight through it as it turned. Now it is a real opening with a real
    // room behind it: 1.2 m of unlit hallway, dim rather than black, so the
    // eye reads depth instead of a cutout.
    const RECESS_D = 1.2;
    const dimRoomT = surfTex('detail', 32, 32, (g) => {
      g.fillStyle = '#191a20'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = 'rgba(255,255,255,0.035)';
      for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 3, 32);   // his wallpaper, barely there
      dither(g, 32, 32, 60);
    });
    const dimRoomM = new THREE.MeshBasicMaterial({ map: dimRoomT, side: THREE.DoubleSide });
    const recessSurf = (w: number, h: number, cx: number, cy: number, cz: number, ry: number, flat = false) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dimRoomM);
      m.position.set(cx, cy, cz);
      if (flat) m.rotation.x = -Math.PI / 2; else m.rotation.y = ry;
      scene.add(m);
    };
    {
      const x0 = AX(2.4) + WALL_T / 2, x1 = x0 + RECESS_D, xm = (x0 + x1) / 2;
      const yb = 2 * ST, yt = yb + 2.1, ym = (yb + yt) / 2;
      const zm = AZI(3.5);
      recessSurf(DOOR_GAP, 2.1, x1, ym, zm, -Math.PI / 2);          // back wall
      recessSurf(RECESS_D, 2.1, xm, ym, DOOR_Z0, 0);                 // north return
      recessSurf(RECESS_D, 2.1, xm, ym, DOOR_Z1, Math.PI);           // south return
      recessSurf(RECESS_D, DOOR_GAP, xm, yt, zm, 0, true);           // ceiling
      recessSurf(RECESS_D, DOOR_GAP, xm, yb + 0.01, zm, 0, true);    // floor
      // his door, swung back inside — a box now, so the leaf has an edge
      const leafGeo = new THREE.BoxGeometry(DOOR_W - 0.2, 2.05, 0.045);
      leafGeo.translate(-(DOOR_W - 0.2) / 2, 0, 0);                  // hinge at the +x edge
      const leafEdgeM = new THREE.MeshBasicMaterial({ color: 0x6b5138 });
      // 302 carried its NUMBER on both faces — the same fault as 301's, and it
      // would have been found by anyone who ever stood in the hermit's doorway.
      // Same rule, so the two hung doors cannot disagree.
      const d302 = DOORS.find((d) => d.num === '302')!;
      const hall302 = texM(doorTexN('302', false)), room302 = texM(doorTexInner());
      hall302.userData.plate = true; room302.userData.plate = false;
      const [f302a, f302b] = leafFaces(D302_SHUT, d302.face, hall302, room302);
      const leaf = new THREE.Mesh(leafGeo,
        [leafEdgeM, leafEdgeM, leafEdgeM, leafEdgeM, f302a, f302b]);
      leaf.position.set(x0 + 0.05, yb + 1.05, DOOR_Z0 + 0.04);
      leaf.rotation.y = d302A;        // starts SHUT; updateHermitAt drives it
      scene.add(leaf);
      leaf.name = 'leaf302';
      scene.userData.doorTravel = {
        ...(scene.userData.doorTravel ?? {}),
        leaf302: { shut: D302_SHUT, open: D302_OPEN },
      };
      leaf302 = leaf;
      // the same knob every other door in the building has, on BOTH faces —
      // GOTCHAS 41, the mirror is where the bug hides, and a handle on one
      // side only is exactly the class that survives a one-sided check. Local
      // y puts it at floor + 1.02 like the rest: the leaf sits at yb + 1.05.
      for (const dir of [1, -1]) doorKnob(leaf, -(DOOR_W - 0.2) + 0.13, -0.03, 0, dir, 'z');
    }
    // ── 301's door ───────────────────────────────────────────────────────
    // There was no door at all — just a hole. Then a leaf standing permanently
    // open, which is honest but is also why the room never read as YOURS. It
    // now swings, on an [E] spot, and the collider follows it.
    {
      // THE LEAF HAS TO COVER THE CLEAR OPENING, WITH OVERLAP. It was 0.91 in
      // a 0.95 gap with the pivot 0.02 off the jamb, which left a 2 cm strip
      // of daylight at the hinge AND another at the strike — the user sees the
      // hinge one from inside (shots/user-301door2.png), and from the hall the
      // strike one is just as open. A leaf narrower than its opening cannot be
      // shut, only nearly shut.
      //
      // It closes onto the WALL FACE, not into the reveal: the pivot is at
      // AX(-0.09) and the wall's room-side face is at AX(-0.07), so the shut
      // leaf lies flat against the plaster rather than inside the jamb. That
      // is what makes overlap possible at all — the leaf can be WIDER than the
      // hole because it never has to fit inside it, which is exactly how a
      // real door meets a face-fixed stop. 0.99 over a 0.95 opening gives
      // 0.02 of overlap at each jamb and no line of sight at either.
      const LW = DOOR_GAP + 0.04;                     // 0.99 m leaf over a 0.95 m gap
      // AND THE SAME AT THE HEAD. Widening the leaf closed both jambs and I
      // stopped there, because the user's report named a VERTICAL strip. It
      // left a horizontal one: the leaf topped out at 7.475 against a doorway
      // head at 7.50, so 0.025 m of lit hall showed straight over the door.
      // Found by measuring the shut leaf's world extent against the opening's
      // instead of trusting the two head-on screenshots I had already taken —
      // it is invisible at eye height and obvious the moment you look up.
      //
      // 2.12 spans 5.43 to 7.55: 0.05 of overlap onto the head, and the 0.03
      // undercut at the floor kept, because a door that seals to the boards is
      // a door that has never been fitted to a real one.
      const LEAF_H = 2.12;
      const g301 = new THREE.BoxGeometry(LW, LEAF_H, 0.045);
      g301.translate(-LW / 2, 0, 0);                  // hinge at the +x edge
      const edgeM = new THREE.MeshBasicMaterial({ color: 0x6b5138 });
      // Face 4 is +z, face 5 is -z. Shut, the leaf is rotated a quarter turn,
      // which sends local +z to world +x — the HALL. So the numbered face is
      // index 4 and the room only ever sees the plain inner leaf.
      const hallM = texM(doorTexN('301', false));
      const roomM = texM(doorTexInner());
      // stamped so scripts/doorfaces.mjs can assert which way the NUMBER points
      // without reading pixels — the plate is the thing that must only ever
      // face the hall.
      hallM.userData.plate = true; roomM.userData.plate = false;
      leaf301 = new THREE.Group();
      const d301 = DOORS.find((d) => d.num === '301')!;
      const [f301a, f301b] = leafFaces(DOOR_A_SHUT, d301.face, hallM, roomM);
      leaf301.add(new THREE.Mesh(g301, [edgeM, edgeM, edgeM, edgeM, f301a, f301b]));
      // was a plain 0.055 box at -0.02; now the building's own knob, at the
      // same floor + 1.02 as every other door and on BOTH faces
      for (const dir of [1, -1]) doorKnob(leaf301, -LW + 0.13, -0.07, 0, dir, 'z');
      // THE PIVOT sits 0.02 PAST the jamb now, not 0.02 inside it, so the
      // shut leaf spans DOOR_Z0-0.02 to DOOR_Z0+0.97 across a gap that runs
      // DOOR_Z0 to DOOR_Z0+0.95 — covered at both ends instead of short at
      // both ends.
      // ON THE +z JAMB now, per hingeSide('301'). It was DOOR_Z0 - 0.02, the
      // -z jamb, which is what made 301 the only 01 door in the building
      // hinged the wrong way. The 0.02 still overlaps the jamb by the same
      // amount, just from the other end.
      DOOR_PIV_X = AX(-0.09); DOOR_PIV_Z = DOOR_Z1 + 0.02; DOOR_LEAF_W = LW;
      // named so scripts/swing.mjs can drive the arc and check what it sweeps
      leaf301.name = 'leaf301';
      // PUBLISH THE TRAVEL, do not make a harness guess it. scripts/swing.mjs
      // first swept 76deg of a 166deg arc, in the wrong direction, and passed
      // — a door check that never visited the doorway. Same idea as props.ts
      // publishing `wetness`: state what the world knows rather than infer it.
      scene.userData.doorTravel = {
        ...(scene.userData.doorTravel ?? {}),
        leaf301: { shut: DOOR_A_SHUT, open: DOOR_A_OPEN },
      };
      leaf301.position.set(DOOR_PIV_X, 2 * ST + 1.09, DOOR_PIV_Z);
      leaf301.rotation.y = doorA;
      scene.add(leaf301);
      const hingeM = new THREE.MeshBasicMaterial({ color: 0x4a4238 });
      for (const hy of [2 * ST + 0.32, 2 * ST + 1.78]) {
        const hg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.022), hingeM);
        hg.position.set(AX(-0.032), hy, DOOR_PIV_Z + 0.007);   // on the pivot line
        scene.add(hg);
      }

      // Where you stand to work it. Out in front of the leaf and back from it,
      // on the room side — a door you can only reach by standing inside its
      // own swing is a door you can never shut.
      //
      // ONE spot used to exist here, and it only reached the room side. Its
      // r0.95 circle centred at x 199.36 dies at x 200.31 — short of the
      // hall, whose free floor starts at AX(0.07) = 200.07, the wall's far
      // face, and which the SHUT leaf then also blocks with doorShutCap
      // (199.84-200.06). So nobody could ever stand close enough to touch it
      // from the landing. Line of sight does not save it either: pickSpot's
      // aimed fallback needs `visible()`, and a shut door is opaque, so
      // there is no ray from the hall into the room for it to travel along.
      // SHUT AND ON THE LANDING, THE DOOR WAS UNOPENABLE — exactly what the
      // room said two lines up must never happen. `scripts/A-verify-301-door.mjs`
      // never caught it because it only ever warps to `spots().find(...)`,
      // which is this one spot, standing inside 301 the whole time.
      //
      // Both stand-points share the same ok/label/act — a door is one piece
      // of state with two thresholds, not two doors that happen to agree.
      const doorOk = () => ctx.player.x() > 100 && Math.abs(lastGy - 2 * ST) < 0.5;
      const doorLabel = () => (doorShut ? 'open the door' : 'close the door');
      const doorAct = () => { doorShut = !doorShut; };
      // IT NEVER REFUSES. The user: *"it should always be able to
      // open/close."* This used to read 'step clear of the door' and do
      // nothing when you stood in the swing, which is safe and makes the
      // door feel broken — refusing an interaction is the one outcome a
      // player reads as a bug rather than as a rule.
      //
      // The reason the refusal existed is now handled a layer down, by
      // machinery that did not exist when this was written: F's unstick()
      // runs every frame, sums the escape vectors from everything the rig is
      // inside, and eases the player out along the minimum translation
      // (fp.ts:191). The shut leaf publishes doorShutCap like any other
      // collider, so a player standing in the swept volume is pushed clear
      // by the same code that handles a collider appearing under them
      // anywhere else. One rule, not two.
      const ROOM_STAND_X = DOOR_PIV_X - 0.55, STAND_Z = DOOR_PIV_Z - H301 * 1.45;
      ctx.spot({ x: ROOM_STAND_X, z: STAND_Z, r: 0.95, ok: doorOk, label: doorLabel, act: doorAct });
      // AND ITS MIRROR, on the hall side. Reflected about the wall's own
      // centreline (AX(0)) rather than a second hand-typed x, so the two
      // stand-points keep the same 0.57 m offset off their own wall face by
      // construction: the room spot sits 199.93 (the wall's room-side face,
      // AX(-0.07)) minus 0.57; this one sits 200.07 (the hall-side face,
      // AX(0.07)) plus 0.57. Neither the shut collider (199.84-200.06) nor
      // the wall itself falls inside either circle, so both are reachable
      // whichever side of a shut door you are standing on.
      const HALL_STAND_X = 2 * AX(0) - ROOM_STAND_X;
      ctx.spot({ x: HALL_STAND_X, z: STAND_Z, r: 0.95, ok: doorOk, label: doorLabel, act: doorAct });
    }
    // the hermit — a big quiet man; you only ever catch him at his door.
    //
    // He gets exactly what everyone on the street gets: the 5-view × 2-frame
    // citizen atlas, billboarded, with the far four angles done by mirroring.
    // He used to be a bespoke single cutout pinned at one fixed rotation, so
    // he stayed dead-on to you no matter where you stood in the hall — the
    // one figure in the world that did not turn.
    //
    // He STANDS IN THE HALL, not in the doorway, and that is load-bearing
    // for two separate complaints:
    //
    //  · He was being sliced in half by a hard vertical edge. He stood on the
    //    door plane and his billboard rotates to face you, so as it turned it
    //    swept straight through that plane. His opaque half-width is 0.36 m
    //    (the atlas paints him cx±10 of 32, times the 1.14 m plane), so his
    //    rotation circle only clears the wall face at AX(2.4) if he stands at
    //    AX(2.04) or less. AX(1.95) leaves ~9 cm.
    //  · He also looked flat even after getting the 8-angle atlas, and the
    //    atlas was never the problem: standing in a doorway at the end of a
    //    corridor, you can only ever come at him from the front, so exactly
    //    one of five painted columns was ever on screen. Out in the hall you
    //    can walk round him and the other four finally show.
    //
    // Palette: a yellowed, sweated-through undershirt rather than the crisp
    // white he used to wear, and GRIME turns on the stains, the unshaven jaw
    // and the messy hair in ct/citizens.ts.
    //
    // ONE CALL, per notes/CITIZEN-STYLE.md. He predates `citizenSprite` and
    // was carrying his own copy of everything it does: the atlas, the plane
    // with its origin moved to the feet, the alphaTest material, a push into
    // `boards` for the billboard pass, and a hand-rolled `viewFor` that ran a
    // frame behind that pass and re-derived his own yaw to pick a column.
    //
    // All of that is now H's, in one place, and the version in the kit is
    // better than the one that was here: it does HYSTERESIS on the view, which
    // this did not. Rounding a heading straight to a column makes the sprite
    // flip back and forth between two paintings when you stand near a
    // boundary, and the only reason it never showed on him is that he does not
    // move — walk a slow arc round him and it would have.
    hermitSprite = citizenSprite(
      { jacket: '#c9c0a6',      // a yellowed undershirt, not the crisp white
        pants: '#454149', skin: '#c08d63', hair: '#3a3226',
        fit: 'plain', cut: 'long', build: 1, grime: 1 },   // unkempt, grown out
      { facing: HERMIT_FACING, h: 1.1, w: 1.2 },
    );
    hermit = hermitSprite.mesh;
    hermit.position.set(AX(1.95), 2 * ST, AZI(3.5));
    scene.add(hermit);
    // ── the hall lights ──────────────────────────────────────────────────
    // A period flush-mount: bronze ceiling rose, shallow ribbed opal dome
    // under it. There used to be no fixture at all here — just a bare
    // additive gradient billboard — so the light read as a smudge on the
    // ceiling rather than a thing screwed to it.
    //
    // Two rules, both learned off the old one:
    //  1. NOTHING in this world is a smooth gradient. Every other surface is
    //     hard-edged and nearest-filtered, so the glow is stepped into hard
    //     concentric discs with a broken outer edge, not blurred.
    //  2. The glow is a HALO around the fixture, not the light itself — it
    //     is small and faint. The dome is what you actually read as lit,
    //     and it is lit by being painted bright (everything is MeshBasic).
    //
    // The dome's texture runs rim (v=1, top of canvas) to pole (v=0, bottom),
    // because SphereGeometry puts v=1 at thetaStart — so the bands read as
    // turned glass when you stand under it and look up.
    const opalT = surfTex('detail', 16, 12, (g) => {
      const bands = ['#9a8f74', '#b8ac8c', '#d2c5a2', '#e8dcba', '#f6efd6', '#fdf8e8'];
      for (let y = 0; y < 12; y++) { g.fillStyle = bands[Math.floor(y / 2)]; g.fillRect(0, y, 16, 1); }
      g.fillStyle = 'rgba(0,0,0,0.10)';                       // ribs, like a real shade
      for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 12);
      dither(g, 16, 12, 14);
    });
    const glowT = surfTex('detail', 24, 24, (g) => {
      const C = 12;
      const disc = (r: number, fill: string) => {
        g.fillStyle = fill;
        for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
        }
      };
      disc(11, 'rgba(255,226,168,0.07)');                     // hard steps, no gradient
      disc(8.5, 'rgba(255,230,178,0.11)');
      disc(6.2, 'rgba(255,236,194,0.16)');
      disc(4.2, 'rgba(255,242,210,0.22)');
      disc(2.4, 'rgba(255,248,228,0.30)');
      g.fillStyle = 'rgba(255,228,172,0.09)';                 // falloff breaks into texels
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, rr = 8.5 + Math.random() * 4.5;
        const x = Math.floor(C + Math.cos(a) * rr), y = Math.floor(C + Math.sin(a) * rr);
        if (x >= 0 && y >= 0 && x < 24 && y < 24) g.fillRect(x, y, 1, 1);
      }
    });
    const glowMat = new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    // SELF-LIT, and stamped rather than merely true. These are the light
    // itself: additive, and constant on purpose, because a hallway lamp does
    // not switch off at noon — the same reason interiors-walk asserts "the
    // room keeps its own light after dark". But from outside, a lamp that is
    // meant to be bright and a sheet nobody remembered to dim are the same
    // picture: transparent, ungraded, bright at 23:00. e91df374 swept for that
    // signature; these eight would have come back as "C's 8 unexamined" and
    // cost someone the afternoon I just spent on the other thirteen.
    glowMat.userData.selfLit = true; glowMat.userData.graded = true;
    // the pool the fixture throws on the ceiling around itself — same stepped
    // disc laid flat and dimmed, so the ceiling reads as lit near the lamp
    // instead of the lamp being a bright dot on a dead grey slab
    const spillMat = new THREE.MeshBasicMaterial({
      map: glowT, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x707070, side: THREE.DoubleSide,
    });
    spillMat.userData.selfLit = true; spillMat.userData.graded = true;
    // the dome is open at the rim, so it is DoubleSide — you see the inside
    // of the far wall of the shade when you look up into it
    const opalM = new THREE.MeshBasicMaterial({ map: opalT, side: THREE.DoubleSide });
    const roseSideM = new THREE.MeshBasicMaterial({ color: 0x6a5a42 });
    const roseCapM = new THREE.MeshBasicMaterial({ color: 0x4a3f2e });
    const domeGeo = new THREE.SphereGeometry(0.19, 10, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    domeGeo.scale(1, 0.55, 1);                                // shallow, not a half ball
    const roseGeo = new THREE.CylinderGeometry(0.21, 0.20, 0.05, 10);
    // ceilY is the ceiling it hangs from; the rose is wider than the dome's
    // rim so the open edge is capped and never shows as a hole
    // wx defaults to the hall's centreline; room 301 passes its own so the
    // flat is lit by the SAME fixture as the landing outside its door
    const ceilingLamp = (ceilY: number, wz: number, halo: number, wx = AX(1.2)) => {
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(halo * 2.4, halo * 2.4), spillMat);
      spill.rotation.x = Math.PI / 2;                        // laid flat, seen from below
      spill.position.set(wx, ceilY - 0.02, wz);
      scene.add(spill);
      const rose = new THREE.Mesh(roseGeo, [roseSideM, roseCapM, roseCapM]);
      rose.position.set(wx, ceilY - 0.025, wz);
      scene.add(rose);
      const dome = new THREE.Mesh(domeGeo, opalM);
      dome.position.set(wx, ceilY - 0.05, wz);
      scene.add(dome);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(halo, halo), glowMat);
      gl.position.set(wx, ceilY - 0.12, wz);
      boards.push({ m: gl });
      scene.add(gl);
    };
    for (let f = 0; f < 4; f++) {
      ceilingLamp(f * ST + 2.55, AZI(3.5), 0.6);              // hall, under that floor's ceiling
      // the half landings hang theirs off whatever is genuinely above them:
      // the underside of the next landing up, or — at the top of the shaft,
      // where there is no next landing — the building's top ceiling
      // Report finding 5: the half landings were the darkest place in the
      // building, and it was purely WHERE the lamp is. It hung at
      // (STAIR_Z1 + LAND_Z1) / 2 + 0.3 — a third of a metre PAST the middle of
      // the landing, toward the far wall — so the turn itself, at STAIR_Z1
      // where the core wall ends and the rail wraps and you actually change
      // direction, was 1.6 m away and lit only by spill. You passed through a
      // dark pocket to get to a lit corner of empty floor.
      //
      // Over the turn instead, and a wider halo because a landing is deeper
      // than a hall bay and one bulb has to reach both ends of it. Headroom is
      // not the problem and never was — 2.56 m over the landing, checked as
      // numbers rather than from the picture.
      if (f < 3) ceilingLamp(f < 2 ? (f + 1) * ST + RISE - 0.14 : H, AZI(STAIR_Z1 + 0.55), 0.62);
    }
    // ── the basement stair ───────────────────────────────────────────────
    // The east half of the shaft at lobby level was a flat navy box filling
    // the dead space under flight B, and it read as a blue wall. It is an
    // opening now: a short flight going down into the dark behind a
    // padlocked chain-link gate. You can see down it; you cannot go down it.
    //
    // Nothing here changes where you can walk, and that is deliberate.
    // underStairA already blocks this whole half of the shaft whenever you
    // are on the lobby floor, and the gate stands on that collider's near
    // face — so the thing that stops you is the thing you can SEE stopping
    // you, and the floor-picker is never asked for a height down here at
    // all. There is no way to fall in, because there is nothing to fall to:
    // the collider is the same one that has always been there.
    const CX0 = AX(1.2), CX1 = AX(2.4), CZ0 = AZI(STAIR_Z0), CZ1 = AZI(STAIR_Z1);
    const CW = CX1 - CX0, CD = CZ1 - CZ0, CELL_FLOOR = -2.5, CH = -CELL_FLOOR;
    const CXM = (CX0 + CX1) / 2, CZM = (CZ0 + CZ1) / 2;
    const cellarT = surfTex('detail', 32, 32, (g) => {
      g.fillStyle = '#26272d'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 32, 1);   // board-formed concrete
      for (let x = 0; x < 32; x += 16) g.fillRect(x, 0, 1, 32);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 12; i++) g.fillRect((i * 7) % 30, (i * 11) % 30, 2, 1);
      dither(g, 32, 32, 140);
    });
    const cellarSurf = (w: number, h: number, cx: number, cy: number, cz: number, ry: number, flat = false) => {
      const t = cellarT.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 1.6, h / 1.6);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
      m.position.set(cx, cy, cz);
      if (flat) m.rotation.x = -Math.PI / 2; else m.rotation.y = ry;
      scene.add(m);
    };
    cellarSurf(CD, CH, CX0, CELL_FLOOR + CH / 2, CZM, Math.PI / 2);
    cellarSurf(CW, CH, CXM, CELL_FLOOR + CH / 2, CZ0, 0);
    cellarSurf(CW, CD, CXM, CELL_FLOOR, CZM, 0, true);
    // The east and far walls carry ON UP past the lobby floor, because they
    // are what you look AT through the gate. Left at floor level they
    // stopped, and you saw the lit stairwell wallpaper behind the mesh —
    // which read as a fenced-off bit of corridor rather than a hole going
    // down. Rough concrete all the way up is also just what the underside of
    // a stair enclosure is. The far one stops at 1.15 so it stays clear of
    // flight B's bottom tread coming in overhead.
    cellarSurf(CD, CH + 2.2, CX1 - 0.01, CELL_FLOOR + (CH + 2.2) / 2, CZM, -Math.PI / 2);
    cellarSurf(CW, CH + 1.15, CXM, CELL_FLOOR + (CH + 1.15) / 2, CZ1 - 0.02, Math.PI);
    // the flight: seven steps, and then it is too dark to see the rest
    const cellStepM = new THREE.MeshBasicMaterial({ color: 0x34353b });
    const C_RISER = 0.21, C_TREAD = 0.26;
    for (let i = 0; i < 7; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.08, 0.1, C_TREAD + 0.04), cellStepM);
      st.position.set(CXM, -(i + 1) * C_RISER - 0.05, CZ0 + (i + 0.5) * C_TREAD);
      scene.add(st);
    }
    // barely lit — one dim bulb far enough down that you get the bottom of
    // the flight and nothing else. A basement you can peer into beats a wall.
    const cellGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({
      map: glowT, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x4a4136,
    }));
    cellGlow.position.set(CXM, -1.85, CZ1 - 0.4);
    boards.push({ m: cellGlow });
    scene.add(cellGlow);
    // the gate. Chain link drawn as texels: a canvas stroke would antialias
    // into exactly the grey mush the door numbers had.
    const linkT = surfTex('detail', 24, 24, (g) => {
      g.clearRect(0, 0, 24, 24);
      // #aeb4bc at full alpha put the brightest thing in the lobby on a
      // near-black hole, so the gate pulled the eye off the stairs and read
      // as a white lattice rather than as galvanised wire in an unlit corner.
      // Report finding 4. Dropped to a dim metal grey and given a shaded half
      // so the diamonds have some depth instead of being a flat screen.
      g.fillStyle = '#5c626b';
      for (let i = 0; i < 24; i++) for (const o of [0, 8, 16]) {
        g.fillRect((i + o) % 24, i, 1, 1);
        g.fillStyle = '#464c55';
        g.fillRect((((o - i) % 24) + 24) % 24, i, 1, 1);
        g.fillStyle = '#5c626b';
      }
    });
    linkT.wrapS = linkT.wrapT = THREE.RepeatWrapping;
    linkT.repeat.set((CW - 0.1) / 0.3, 1.95 / 0.3);
    const GZ = CZ0 + 0.03;
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.1, 1.95), new THREE.MeshBasicMaterial({
      // alphaTest, and NOT `transparent`. Same one-flag bug that had every
      // alpha-cut prop in the car lot standing at full daylight brightness at
      // midnight: a cut-out discards its fragment and never blends, so
      // `transparent` buys nothing, costs a place in the sorted transparent
      // queue, and puts the material on props.ts's dimWorld skip list.
      //
      // No visible change HERE today, and that is worth being straight about:
      // dimWorld returns early for anything past x = 100, so the lobby keeps
      // its own light and this gate was never going to glow. It is fixed
      // because it is the same latent trap, because DoubleSide in the sorted
      // queue is a sorting artifact waiting to happen, and because the day the
      // interiors do get graded is not the day anyone will think to look here.
      map: linkT, alphaTest: 0.4, side: THREE.DoubleSide,
    }));
    gate.position.set(CXM, 0.99, GZ);
    scene.add(gate);
    const gateM = new THREE.MeshBasicMaterial({ color: 0x41464d });
    const bar = (w: number, h: number, d: number, cx: number, cy: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gateM);
      m.position.set(cx, cy, GZ);
      scene.add(m);
    };
    bar(CW, 0.07, 0.07, CXM, 1.96);                  // head
    bar(CW, 0.07, 0.07, CXM, 0.04);                  // threshold
    bar(0.07, 2.0, 0.07, CX0 + 0.04, 1.0);           // stiles
    bar(0.07, 2.0, 0.07, CX1 - 0.04, 1.0);
    bar(CW, 0.05, 0.05, CXM, 1.16);                  // mid rail
    // WHICH SIDE OPENS. Report finding 4: there was nothing to say, so it read
    // as a fixed panel rather than a gate. Two hinge plates on the east stile
    // and a meeting stile down the middle settle it — a gate is a thing with a
    // hinged edge and a shutting edge, and if you cannot see either it is a
    // fence.
    const hingeM = new THREE.MeshBasicMaterial({ color: 0x2f343a });
    for (const hy of [0.42, 1.62]) {
      const hp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.10, 0.045), hingeM);
      hp.position.set(CX1 - 0.06, hy, GZ);
      scene.add(hp);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 6), gateM);
      pin.position.set(CX1 - 0.015, hy, GZ);
      scene.add(pin);
    }
    bar(0.055, 1.9, 0.055, CXM + 0.03, 1.0);         // the shutting stile
    // THE PADLOCK NOW HANGS ON SOMETHING. The hasp behind it was too thin to
    // read, so the lock floated in the middle of the mesh with nothing holding
    // it. A hasp is a strap on the gate leaf and a STAPLE on the frame, and
    // the shackle goes through both — draw all three or the lock is jewellery.
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.055, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x6b7079 }));
    strap.position.set(CXM - 0.06, 1.05, GZ - 0.028);
    scene.add(strap);
    const staple = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x7b8089 }));
    staple.position.set(CXM + 0.045, 1.05, GZ - 0.028);
    scene.add(staple);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.010, 4, 10, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x9aa0a8 }));
    shackle.position.set(CXM + 0.045, 1.045, GZ - 0.055);
    scene.add(shackle);
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.095, 0.032),
      new THREE.MeshBasicMaterial({ color: 0x8a7440 }));
    lockBody.position.set(CXM + 0.045, 0.985, GZ - 0.055);
    scene.add(lockBody);
    // lobby dressing: mailboxes and the front door
    const mailT = surfTex('detail', 48, 32, (g) => {
      g.fillStyle = '#2c2620'; g.fillRect(0, 0, 48, 32);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = '#8a7a4e'; g.fillRect(3 + c * 11, 3 + r * 9, 9, 7);
        g.fillStyle = '#5e5236'; g.fillRect(4 + c * 11, 6 + r * 9, 7, 1);
      }
    });
    // A BOX, not a painted panel. Report finding 2 again: this was a
    // zero-thickness plane on a wall that now has 0.14 m of thickness
    // everywhere else, and you could see it was paper-thin from any angle off
    // dead-on. A bank of mailboxes is the one thing in a walk-up lobby you
    // stand right beside, so it is the worst place in the building to be flat.
    //
    // Face 1 is -x, which is the face turned into the hall. The doors go
    // there and the carcass takes everything else.
    const mailFrame = new THREE.MeshBasicMaterial({ color: 0x241f1a });
    const mail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 1.5),
      [mailFrame, texM(mailT), mailFrame, mailFrame, mailFrame, mailFrame]);
    mail.position.set(AX(2.28), 1.4, AZI(1.3));
    scene.add(mail);
    // the pressed lip over the top, which is what a bank of boxes has instead
    // of a top edge, and a shelf under it for what will not go in a slot
    const mailTrim = new THREE.MeshBasicMaterial({ color: 0x3a332a });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 1.58), mailTrim);
    lip.position.set(AX(2.255), 1.92, AZI(1.3));
    scene.add(lip);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 1.58), mailTrim);
    shelf.position.set(AX(2.24), 0.88, AZI(1.3));
    scene.add(shelf);
    // ── the front door, from inside ──────────────────────────────────────
    // My own report, finding 1: *the front door disagrees with itself*. From
    // the street it is a DOUBLE door, dark green, under a glazed transom
    // carrying the gold 227. From the lobby it was a SINGLE louvred door with
    // no transom at all. You pass through it in one step and it changes.
    //
    // The lobby and the facade are not the same geometry — the interior is a
    // separate place you are teleported into — so nothing enforces the match
    // and it drifted. It is enforced here instead: the leaf takes its width,
    // its height, its transom and its glazing from ENTRANCE and the same
    // DOOR_TOP / BAR / TRANSOM_H the street side uses, so the two cannot part
    // again without someone changing both.
    const IN_LEAF_W = ENTRANCE.OPEN_W - 0.125 * 2;      // = the street leaf
    const IN_DOOR_H = 2.30 - ENTRANCE.OPEN_BOT;
    const IN_BAR = 0.08, IN_TRANSOM_H = 0.45;
    // Same two leaves, seen from behind. What changes is what changes in
    // reality: the glass is now the BRIGHT side, because you are looking at
    // daylight through it, and the handles are on the other hand.
    const frontDoorT = surfTex('detail', 48, 64, (g) => {
      g.fillStyle = '#22301f'; g.fillRect(0, 0, 48, 64);
      for (const ox of [2, 25]) {
        g.fillStyle = '#33452e'; g.fillRect(ox, 2, 21, 62);        // shaded side
        g.fillStyle = '#8fa2ae'; g.fillRect(ox + 3, 6, 15, 26);     // daylight
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(ox + 9, 7, 6, 24);
        g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(ox + 3, 38, 15, 20);
        g.fillStyle = '#6a7a5c'; g.fillRect(ox + 3, 5, 15, 1);      // glazing bead
      }
      g.fillStyle = '#c9b45e'; g.fillRect(21, 34, 2, 4); g.fillRect(25, 34, 2, 4);
      g.fillStyle = '#8d8d92'; g.fillRect(2, 56, 44, 4);            // kick plate
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(2, 56, 44, 1);
      dither(g, 48, 64, 40);
    });
    const lobbyDoor = new THREE.Mesh(new THREE.PlaneGeometry(IN_LEAF_W, IN_DOOR_H), texM(frontDoorT));
    // AZI(0.09), not AZI(0.008). The lobby's front wall is a box whose
    // geometry is translated rather than positioned, so it does not show up
    // where a search by mesh origin looks for it — and its inner face is
    // around AZI(0.07). A door at AZI(0.008) is buried INSIDE the wall and
    // renders nowhere, which is exactly what the first cut did. The old
    // single door sat at 0.085 for this reason; keep it there.
    lobbyDoor.position.set(AX(1.2), IN_DOOR_H / 2, AZI(0.09));
    scene.add(lobbyDoor);
    // THE TRANSOM, glazed from both sides — the report asked to be able to see
    // the daylight through it from the lobby, and the gold 227 is leaf on the
    // street face of the glass, so from in here it reads BACKWARDS. That is
    // the detail that says it is one piece of glass and not two signs.
    const transomInT = surfTex('sign', 48, 14, (g) => {
      g.fillStyle = '#8fa2ae'; g.fillRect(0, 0, 48, 14);            // daylight
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(2, 2, 44, 5);
      g.save(); g.translate(48, 0); g.scale(-1, 1);
      g.fillStyle = '#a98d34';                                       // gold, from behind
      stampNum(g, '227', 17, 4, '#a98d34');
      g.restore();
      g.fillStyle = '#3a4438'; g.fillRect(0, 0, 48, 2); g.fillRect(0, 12, 48, 2);
    });
    const lobbyTransom = new THREE.Mesh(
      new THREE.PlaneGeometry(IN_LEAF_W, IN_TRANSOM_H), texM(transomInT));
    lobbyTransom.position.set(AX(1.2), IN_DOOR_H + IN_BAR + IN_TRANSOM_H / 2, AZI(0.09));
    scene.add(lobbyTransom);
    // the meeting rail between leaf and transom
    const tbar = new THREE.Mesh(new THREE.BoxGeometry(IN_LEAF_W + 0.10, IN_BAR, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x2f3f2c }));
    tbar.position.set(AX(1.2), IN_DOOR_H + IN_BAR / 2, AZI(0.10));
    scene.add(tbar);
    // and the trim it never had. Report finding 2: this was the one door in
    // the building with no casing at all, which read worse once every other
    // opening got real jambs.
    // wallN picked so the trim lands just PROUD of the leaf: casing puts its
    // faces at wallN +- 0.084, and the leaf is at AZI(0.09).
    casing(AZI(0.02), AX(1.2) - IN_LEAF_W / 2, AX(1.2) + IN_LEAF_W / 2,
      0, IN_DOOR_H + IN_BAR + IN_TRANSOM_H, false);

    // ── FLAT 301's EXTENT, DECLARED ONCE ─────────────────────────────────
    //
    // Four walls, a floor, a ceiling and a door skin each carried their own
    // hand-typed copy of these numbers, and the WORLD's room registry carried
    // none of them — the walk-up predates `buildRoom`, so no slab was ever
    // claimed for it and `__ct.roomDims()` did not know this room exists. The
    // cost showed up in `scripts/seat-facing.mjs`, which resolves a seat's room
    // from that registry: the bed seat below came back `outdoor`, and both of
    // that check's rules are skipped for a seat with no room. The seat the
    // player uses most, in the room he spawns in, was the one seat in the world
    // the facing check could not see. `declareRoom` at the foot of this section
    // is the other half of the fix.
    //
    // These are wall CENTRELINES in room-local metres — the shell is drawn on
    // them, so the CLEAR room is WALL_T narrower on each axis. That distinction
    // is what the registry wants: `RoomDims.w/d` are "wall face to wall face",
    // the same as `RoomSpec.w/d` in the kit.
    const R301_X0 = -3.2, R301_X1 = 0;       // west (window) wall … the shell
    const R301_Z0 = 2, R301_Z1 = 5.5;        // south wall … north wall
    const R301_CX = (R301_X0 + R301_X1) / 2, R301_CZ = (R301_Z0 + R301_Z1) / 2;
    const R301_W = R301_X1 - R301_X0, R301_D = R301_Z1 - R301_Z0;
    const R301_H = 2.55;                     // ceiling height inside the flat
    const R301_DOOR_Z = 3.5;                 // the doorway's centre in the shell
    // 301 — your place: wood floor, a bed, the window with the city in it
    // The west wall, in FOUR pieces with a hole in it for the window.
    //
    // It was one solid box, which is why the window had to be a plane stuck on
    // the inside of it — and why the first attempt at giving that window a
    // reveal simply hid the glass inside the wall. Same trap the lobby door
    // fell into an hour earlier: a surface set back into a wall that has no
    // opening does not read as recessed, it disappears. If you want a reveal
    // you have to actually cut the hole.
    //
    // The collider is untouched and still spans the whole wall, so the hole is
    // in the geometry only and you cannot walk through the window.
    {
      const WY = 2 * ST + 1.5, WH = 1.3, WZ = R301_CZ, WW = 1.3;
      const y0 = 2 * ST, y1 = 2 * ST + R301_H;
      const oy0 = WY - WH / 2, oy1 = WY + WH / 2;
      const z0 = R301_Z0, z1 = R301_Z1;
      const oz0 = WZ - WW / 2, oz1 = WZ + WW / 2;
      wallMesh(R301_D, oy0 - y0, AX(R301_X0), (y0 + oy0) / 2, AZI(WZ), Math.PI / 2, roomWallT, 0, 0);
      wallMesh(R301_D, y1 - oy1, AX(R301_X0), (oy1 + y1) / 2, AZI(WZ), Math.PI / 2, roomWallT, 0, oy1 - y0);
      wallMesh(oz0 - z0, WH, AX(R301_X0), WY, AZI((z0 + oz0) / 2), Math.PI / 2, roomWallT, 0, oy0 - y0);
      wallMesh(z1 - oz1, WH, AX(R301_X0), WY, AZI((oz1 + z1) / 2), Math.PI / 2, roomWallT, oz1 - z0, oy0 - y0);
    }
    wallMesh(R301_W, R301_H, AX(R301_CX), 2 * ST + R301_H / 2, AZI(R301_Z0), 0, roomWallT);
    wallMesh(R301_W, R301_H, AX(R301_CX), 2 * ST + R301_H / 2, AZI(R301_Z1), Math.PI, roomWallT);
    // ── 301's FOURTH wall ────────────────────────────────────────────────
    // The room papered three walls and forgot the one with its own door in it.
    // That wall is the stairwell shell's, built by the `wallMesh` runs at
    // AX(0) which paper BOTH faces in the hall's paper — so standing in your
    // room looking at your own door, the wall around it was the corridor's tan
    // stripe while the other three were blue.
    //
    // It hid for as long as the door stood permanently open, because the tan
    // read as the hall seen through the opening — which is exactly what I put
    // it down to on my first walk of the building. It only became undeniable
    // once the leaf actually filled its frame: shut, there is no opening left
    // to explain it.
    //
    // A SKIN, not another wall. The shell's box is load-bearing for the
    // colliders, the jamb reveals and the architrave, and a second box here
    // would z-fight its face and double the doorway's trim. Three planes on
    // the room side, around the opening, sampling `roomWallT` the same way
    // `wallMesh` does so the paper lines up with the walls either side of it.
    {
      const SKIN_X = AX(R301_X1) - WALL_T / 2 - 0.002;  // just proud of the shell
      const DZ0 = R301_DOOR_Z - DOOR_GAP / 2, DZ1 = R301_DOOR_Z + DOOR_GAP / 2;
      const HEAD = 2.1;                                // the doorway's own height
      const skin = (w: number, h: number, lz: number, ly: number, vOff: number) => {
        const t = roomWallT.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.minFilter = THREE.NearestMipmapLinearFilter;
        t.anisotropy = 8;
        t.repeat.set(w / 2.7, h / 2.7);
        // vOff is where this piece sits WITHIN the 2.7 m storey tile — without
        // it the over-door strip samples from the tile's bottom and puts a
        // skirting band above the door.
        t.offset.set(0, vOff / 2.7);
        t.needsUpdate = true;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map: t }));
        m.position.set(SKIN_X, ly, AZI(lz));
        m.rotation.y = -Math.PI / 2;                   // faces -x, into the room
        scene.add(m);
      };
      skin(DZ0 - R301_Z0, R301_H, (R301_Z0 + DZ0) / 2, 2 * ST + R301_H / 2, 0);    // south of the door
      skin(R301_Z1 - DZ1, R301_H, (DZ1 + R301_Z1) / 2, 2 * ST + R301_H / 2, 0);    // north of it
      skin(DOOR_GAP, R301_H - HEAD, R301_DOOR_Z, 2 * ST + HEAD + (R301_H - HEAD) / 2, HEAD);  // over it
    }
    floorMesh(2 * ST + 0.007, R301_W, R301_D, AX(R301_CX), AZI(R301_CZ), woodFloorT);
    floorMesh(2 * ST + R301_H, R301_W, R301_D, AX(R301_CX), AZI(R301_CZ), ceilT);

    // ── AND SAY SO, so the world's room registry knows this room exists ────
    //
    // Clear size is the wall centrelines less one wall thickness, which is what
    // `RoomDims.w/d` means everywhere else — the kit's `buildRoom` publishes
    // its rooms face-to-face and a check that mixes the two conventions is
    // reading a 7 cm lie on every wall. The doorway is given in ROOM-LOCAL
    // metres with the normal pointing INTO the room: 301's door is in the
    // stairwell shell on the room's +x side, so you come through it heading -x.
    //
    // Not a slab, deliberately — the walk-up has four storeys and its own
    // floor picker (`aptGround` below), and `interiorGround` cannot express
    // that. See the note on `declareRoom` in ct/interior.ts.
    declareRoom({
      id: 'apt301',
      w: R301_W - WALL_T, d: R301_D - WALL_T,
      cx: AX(R301_CX), cz: AZI(R301_CZ),
      // FLOOR 3, the same `2 * ST` the flat's own floor and ceiling are drawn
      // at. It is the only room in the registry that is not at y 0, and a
      // harness that warps here must hand it to `warp`'s `gy` — see RoomDims.y.
      y: 2 * ST,
      door: { x: R301_X1 - R301_CX, z: R301_DOOR_Z - R301_CZ, nx: -1, nz: 0 },
    });
    // ── 301, furnished ───────────────────────────────────────────────────
    // A specific person's room, not a hotel room. Everything here is
    // somebody's: the frame and the mattress do not match, the middle drawer
    // has never shut, the TV sits on a milk crate because there is no table,
    // and the ashtray has not been emptied.
    //
    // The room shares the walk-up's conventions rather than inventing its
    // own — 0.14 m walls with jamb reveals and casing (wallMesh gives it
    // those for free), the same 2.55 m ceiling, and the SAME flush-mount
    // fixture as the landing outside its door.
    //
    // Layout, so the circulation survives: furniture is pushed to the north
    // and south walls and the middle of the room is left clear. The band
    // z 2.65 → 4.40 is open the full width, which is 1.75 m against a rig
    // that needs 0.72 — you can walk in, cross to the window, and turn round
    // without touching anything.
    const RY = 2 * ST + 0.007;               // the floorboards
    // solid furniture, so front faces only — texM's DoubleSide is for planes
    const flatOf2 = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number,
                 m: THREE.Material | THREE.Material[], ry = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(AX(x), y, AZI(z));
      if (ry) b.rotation.y = ry;
      scene.add(b);
      return b;
    };
    // The view: third floor of No. 227, which stands on the EAST side of the
    // street with its face turned WEST — so what you see is the far pavement,
    // the facades opposite, and the mouth of the alley almost straight ahead.
    // It has to agree with where the building actually is.
    // THE VIEW. The user: *"the user wants A VIEW from room 301 and gets a
    // light well — a small gap and then brick ... you should be able to see
    // the street from a standing position at the window and from the bed, not
    // only by pressing your face to the glass."*
    //
    // The window was already on the street facade and already pointing west;
    // there is no light well behind it and never was. What was wrong is the
    // PICTURE. The old 40x40 gave rows 13-30 to the brick opposite and left
    // the pavement and road four rows at the very bottom — a tenth of the
    // opening, below the sill line of anyone standing up. So you got sky, then
    // brick, and the street only if you walked into the glass and looked down.
    // The user described exactly what was painted.
    //
    // Recomposed for the height it is actually at. Three storeys up across a
    // 14 m street you look slightly DOWN, so the road belongs just under the
    // middle of the opening and the facade opposite above it, not filling it.
    // The street — far pavement, road, parked cars, near kerb — now runs rows
    // 30 to 61 of 64: half the glass, centred on the eye rather than pooled at
    // the bottom.
    //
    // What is in it is the point, because a view is things happening: two
    // people on the far pavement, cars nose-to-tail at both kerbs, the centre
    // line, a shopfront with an awning, the alley mouth straight across, and
    // one window lit in the afternoon because somebody else is in.
    // ── the window's reveal, sill and architrave ─────────────────────────
    // Report finding 2: the one window in the building was a flat plane stuck
    // on the inside of a 0.14 m wall. Every DOORWAY here shows its thickness
    // — 301 and 302 got real reveals when the paper-thin walls were fixed —
    // and the window did not, which reads worse now than it did before the
    // doorways were done, because it is the only opening left that is a
    // sticker.
    //
    // The glass goes back to the OUTER face and the wall is left in front of
    // it. That is not a detail, it is the whole difference: a window you look
    // at is a picture, and a window you look THROUGH has 11 cm of jamb
    // between you and it, so the view shifts as you cross the room.
    const WIN_W = 1.3, WIN_H = 1.3, WIN_Y = 2 * ST + 1.5, WIN_LZ = 3.75;
    const WIN_LX = -3.2;                          // the wall's centreline
    const GLASS_X = WIN_LX - 0.062;               // the wall's OUTER face
    const REV_D = 0.11;                           // what is left in front of it
    // THE GLASS IS NOW GLASS. It used to be the picture — a painted view on an
    // opaque plane at the outer face, which is why the well behind it could
    // never read as a space no matter what was painted on it. A faint tinted
    // sheet lets the built well show through and still catches the light
    // enough that you can tell there is something in the opening.
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H),
      new THREE.MeshBasicMaterial({ color: 0x9fb0bb, transparent: true, opacity: 0.13,
        depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(AX(GLASS_X), WIN_Y, AZI(WIN_LZ));
    glass.rotation.y = Math.PI / 2;
    scene.add(glass);
    // and the glazing bars, which were painted into that same texture and had
    // to become real when it went — a window with no bars reads as a hole
    const barM = new THREE.MeshBasicMaterial({ color: 0x3a2c22 });
    box(0.035, WIN_H, 0.05, GLASS_X + 0.02, WIN_Y, WIN_LZ, barM);
    box(0.035, 0.05, WIN_W, GLASS_X + 0.02, WIN_Y, WIN_LZ, barM);
    // ── THE LIGHT WELL, as a real space ──────────────────────────────────
    // The user, in their own words: *"a bit of a gap out of the window and
    // then just a brick wall, almost like a little room outside the window
    // that is just brick."* They want the well. It was painted on the glass as
    // a picture; now it is built, and you look THROUGH the opening into it.
    //
    // What was wrong was never the brick. It was that a flat picture 6 cm
    // behind the glass reads as an accidental gap: no depth, no side returns,
    // nothing to say the far wall is a far wall rather than a sheet of card
    // pressed to the window. So this has the three things that make a well a
    // room you cannot get into — 2.3 m of air between the glass and the far
    // wall, brick RETURNING on both sides so it reads enclosed, and a floor
    // three storeys down in the dark.
    //
    // Nothing lights it. Everything here is MeshBasic, so brightness is
    // whatever the texture is painted at, and this is painted at about a third
    // of the room's brick — almost no light reaches the bottom of a tenement
    // well and that gloom IS the character of them. It is also why the far
    // window opposite is nearly black: it is a real window, it just never sees
    // the sun and nobody ever opens it.
    // WIDTH IS WHAT MAKES IT A ROOM. At 3.24 m across, the far wall exactly
    // filled the cone you can see through a 1.3 m opening from across the
    // room, so the returns fell outside the view and it read as a flat brick
    // sheet again — the same fault as the painting, in geometry. A real
    // tenement well is NARROW, and narrow is also what puts both side walls in
    // frame converging away from you, which is the whole cue for depth.
    // SHALLOW. The user wants *"a bit of a gap and then brick"*, not a long
    // shaft — the brick should feel close enough to touch from the window.
    // Halved from 2.4. The returns still read: from 1.86 m back the cone
    // through a 1.3 m opening is 2.18 m wide at this distance and the well is
    // 1.9 m across, so both side walls stay in frame.
    const WELL_D = 1.2;                    // glass to the far wall
    const WELL_HW = 0.95;                  // half width, in z — 1.9 m across
    const WELL_FLOOR = 1.15;               // three storeys down, in shadow
    const WELL_TOP = 12.4;                 // above the head of our own opening
    const FAR_LX = WIN_LX - WELL_D;
    const WELL_H = WELL_TOP - WELL_FLOOR;
    const sootT = surfTex('brick', 32, 32, (g) => {
      g.fillStyle = '#3a2a25'; g.fillRect(0, 0, 32, 32);          // dark, sooted brick
      // A MORTAR JOINT IS A LINE, NOT A BAR. These were 0.30 black, the same
      // weight as the streaks below, which is why the joints read as heavy
      // dark bars rather than as pointing. 0.16 puts them back to a fine line.
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 3; y < 32; y += 4) g.fillRect(0, y, 32, 1);    // courses
      for (let y = 0; y < 32; y += 4) {
        // RUNNING BOND: the perps shift half a brick every course, so no two
        // ever line up and there is no continuous vertical line. This part was
        // always right and is not what striped the wall.
        const off = (y / 4) % 2 ? 0 : 8;
        for (let x = off; x < 32; x += 16) g.fillRect(x, y, 1, 4); // perpends
      }
      // THE STRIPES WERE HERE. This used to be
      //     for (const sx of [2, 11, 19, 27]) g.fillRect(sx, 0, 2, 32);
      // — four 2 px bars at fixed x running the FULL height of the tile, which
      // I wrote as "a well is stained down its whole height". In a tiled
      // texture any full-height feature at a fixed x becomes a stripe, and at
      // 1.65 repeats across the far wall that is ~7 hard vertical bars floor to
      // top. Measured: those four columns sat 11-13 below the texture's median
      // brightness while the perps sat 5-6 below, so the streaks, not the bond
      // and not a seam, were what the eye was reading.
      //
      // Staining stays, because a light well IS stained — but as short broken
      // runs that never touch the tile's top or bottom edge, so nothing can
      // line up across a repeat, and at a third of the old weight.
      g.fillStyle = 'rgba(0,0,0,0.10)';
      for (const [sx, sy, sh] of [[5, 6, 9], [14, 17, 8], [22, 3, 7], [29, 20, 8]] as [number, number, number][])
        g.fillRect(sx, sy, 1, sh);
      g.fillStyle = 'rgba(90,100,86,0.08)'; g.fillRect(7, 15, 4, 11);  // a patch of damp
      dither(g, 32, 32, 34);
    });
    const wellM = (uw: number, uh: number) => {
      const t = sootT.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(uw / 1.15, uh / 1.15);
      t.needsUpdate = true;
      return new THREE.MeshBasicMaterial({ map: t });
    };
    // the far wall, and the two returns that make it enclosed rather than a gap
    const farWall = new THREE.Mesh(new THREE.PlaneGeometry(WELL_HW * 2, WELL_H), wellM(WELL_HW * 2, WELL_H));
    farWall.position.set(AX(FAR_LX), WELL_FLOOR + WELL_H / 2, AZI(WIN_LZ));
    farWall.rotation.y = Math.PI / 2;
    scene.add(farWall);
    for (const sgn of [1, -1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(WELL_D, WELL_H), wellM(WELL_D, WELL_H));
      side.position.set(AX(FAR_LX + WELL_D / 2), WELL_FLOOR + WELL_H / 2, AZI(WIN_LZ + sgn * WELL_HW));
      side.rotation.y = sgn > 0 ? Math.PI : 0;         // both faces turned INWARD
      scene.add(side);
    }
    // the floor of it, which you only half see — that is the point
    const wellFloor = new THREE.Mesh(new THREE.PlaneGeometry(WELL_D, WELL_HW * 2),
      new THREE.MeshBasicMaterial({ color: 0x1b1614 }));
    wellFloor.position.set(AX(FAR_LX + WELL_D / 2), WELL_FLOOR, AZI(WIN_LZ));
    wellFloor.rotation.x = -Math.PI / 2;
    scene.add(wellFloor);
    // ── the drainpipe ────────────────────────────────────────────────────
    // There was a dark window on the far wall here. It came out: it was the
    // desk's suggestion rather than the user's ask, and the far wall is meant
    // to be plain brick.
    // the drainpipe, down the corner where the far wall meets the return —
    // the one vertical in a wall of horizontals, and what tells you the well
    // keeps going down past where you can see
    const pipeM = new THREE.MeshBasicMaterial({ color: 0x33302c });
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, WELL_H - 0.4, 6), pipeM);
    pipe.position.set(AX(FAR_LX + 0.14), WELL_FLOOR + (WELL_H - 0.4) / 2, AZI(WIN_LZ - WELL_HW + 0.16));
    scene.add(pipe);
    for (const by of [3.1, 5.9, 8.7]) {                 // its fixing bands
      box(0.20, 0.05, 0.20, FAR_LX + 0.14, by, WIN_LZ - WELL_HW + 0.16, pipeM);
    }
    // a fire escape landing one storey down, so the eye has somewhere to fall
    const escM = new THREE.MeshBasicMaterial({ color: 0x2b2a2c });
    box(0.62, 0.04, 1.25, FAR_LX + 0.34, WIN_Y - 2.55, WIN_LZ + 0.10, escM);
    for (let i = 0; i < 6; i++) {                        // its railing
      box(0.03, 0.42, 0.03, FAR_LX + 0.62, WIN_Y - 2.55 + 0.23, WIN_LZ - 0.48 + i * 0.22, escM);
    }
    box(0.05, 0.04, 1.25, FAR_LX + 0.62, WIN_Y - 2.55 + 0.44, WIN_LZ + 0.10, escM);

    // the four returns, in the wall's own paint but shaded: a reveal in the
    // same flat colour as the wall face reads as a hole cut in card
    const revM = new THREE.MeshBasicMaterial({ color: 0x8b8474 });
    const revDark = new THREE.MeshBasicMaterial({ color: 0x776f61 });
    const RX = GLASS_X + REV_D / 2;
    // THE HEAD AND SILL STOP AT THE JAMBS, they do not run over them. At
    // WIN_W + 0.04 they spanned z +-(WIN_W/2 + 0.02), which is exactly the
    // jambs' outer face — so both solids occupied the same 2 cm cube at each
    // top corner with coplanar faces, and the pair z-fought along the diagonal
    // where they met. That is the stepped speckle the user is seeing on the
    // inner edge, top and right.
    //
    // Measured before and after with the camera walking towards it in 2 cm
    // steps, counting pixels that flip against a control patch of plain
    // wallpaper under the same motion — parallax moves both, only a depth
    // fight moves one of them far more.
    //
    // Fixed by giving them non-overlapping extents rather than a polygon
    // offset, which is how the corner road and the side-street asphalt smear
    // were both fixed: at WIN_W the head and sill butt against the jambs'
    // inner faces and share no volume at all.
    box(REV_D, 0.02, WIN_W, RX, WIN_Y + WIN_H / 2 + 0.01, WIN_LZ, revDark);   // head, in shadow
    box(REV_D, 0.02, WIN_W, RX, WIN_Y - WIN_H / 2 - 0.01, WIN_LZ, revM);      // the reveal's own sill
    for (const sgn of [1, -1]) {
      box(REV_D, WIN_H + 0.04, 0.02, RX, WIN_Y, WIN_LZ + sgn * (WIN_W / 2 + 0.01),
        sgn > 0 ? revM : revDark);                // one jamb catches the light
    }
    // the sill you can put things on, projecting past the architrave
    const sillM = new THREE.MeshBasicMaterial({ color: 0xa8a091 });
    box(0.22, 0.045, WIN_W + 0.22, WIN_LX + 0.09, WIN_Y - WIN_H / 2 - 0.035, WIN_LZ, sillM);
    box(0.20, 0.03, WIN_W + 0.18, WIN_LX + 0.085, WIN_Y - WIN_H / 2 - 0.07, WIN_LZ,
      new THREE.MeshBasicMaterial({ color: 0x8f887a }));                              // its apron
    // ── and something ON it ──────────────────────────────────────────────
    // The user's third condition: *"a sill, and something on it — that is what
    // makes a window read as somewhere you stand rather than a hole."* The
    // sill was already here and already projected; it was bare.
    //
    // A plant somebody has not watered enough and a mug they left there. Both
    // at the ENDS, because the middle of the sill is where you put your hands
    // when you lean on it to look down at the street, and leaving that clear is
    // the difference between a sill somebody uses and a shelf of ornaments.
    const SILL_TOP = WIN_Y - WIN_H / 2 - 0.035 + 0.0225;
    const SILL_X = WIN_LX + 0.09;
    const potM = new THREE.MeshBasicMaterial({ color: 0x9c5b3c });
    box(0.11, 0.10, 0.11, SILL_X, SILL_TOP + 0.05, WIN_LZ + 0.52, potM);
    box(0.125, 0.018, 0.125, SILL_X, SILL_TOP + 0.101, WIN_LZ + 0.52, potM);   // its rim
    const leafT = surfTex('detail', 12, 14, (g) => {
      g.clearRect(0, 0, 12, 14);
      const greens = ['#4e6b34', '#5f7d3f', '#6d8a49'];
      for (let b = 0; b < 5; b++) {
        const bx = 2 + ((b * 5) % 8), lean = ((b * 7) % 5) - 2, hgt = 7 + ((b * 11) % 6);
        g.fillStyle = greens[b % 3];
        for (let k = 0; k < hgt; k++) {
          const px = bx + Math.round((lean * k) / hgt);
          g.fillRect(px, 13 - k, 2, 1);
        }
      }
      // one frond gone brown, because nobody in this room waters anything
      g.fillStyle = '#8a7340'; g.fillRect(3, 6, 2, 5);
      dither(g, 12, 14, 12);
    });
    const leafM = new THREE.MeshBasicMaterial({ map: leafT, alphaTest: 0.4, side: THREE.DoubleSide });
    for (const ry of [0, Math.PI / 2]) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.24), leafM);
      q.position.set(AX(SILL_X), SILL_TOP + 0.10 + 0.12, AZI(WIN_LZ + 0.52));
      q.rotation.y = ry + 0.4;
      scene.add(q);
    }
    // the mug, at the other end, with the handle turned to the room
    const mugM = new THREE.MeshBasicMaterial({ color: 0xd8d2c4 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.095, 8), mugM);
    mug.position.set(AX(SILL_X), SILL_TOP + 0.0475, AZI(WIN_LZ - 0.55));
    scene.add(mug);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 4, 8), mugM);
    handle.position.set(AX(SILL_X + 0.055), SILL_TOP + 0.05, AZI(WIN_LZ - 0.55));
    handle.rotation.y = Math.PI / 2;
    scene.add(handle);
    // architrave, room side only. `casing` puts trim on BOTH faces, which is
    // right for a doorway you pass through and wrong for a window — the far
    // face of this wall is the FACADE, and the street does not want a lobby
    // architrave on it.
    const trimW = new THREE.MeshBasicMaterial({ color: 0x6f5a44 });
    const AT = WIN_LX + 0.085;
    for (const sgn of [1, -1]) {
      box(0.03, WIN_H + 0.14, 0.075, AT, WIN_Y + 0.02, WIN_LZ + sgn * (WIN_W / 2 + 0.055), trimW);
    }
    box(0.03, 0.075, WIN_W + 0.19, AT, WIN_Y + WIN_H / 2 + 0.075, WIN_LZ, trimW);
    // the radiator under it — cast-iron columns, painted over so many times
    // the fins have gone soft
    const radT = surfTex('detail', 24, 16, (g) => {
      g.fillStyle = '#9c9689'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      for (let x = 2; x < 24; x += 3) g.fillRect(x, 1, 1, 14);    // the columns
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 24, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 15, 24, 1);
      dither(g, 24, 16, 26);
    });
    // the ribs belong on the LONG faces (±x, 0.58 × 1.0), not the ends — the
    // box is 0.16 deep, so indices 4/5 are the two little end caps
    const radM = flatOf2(radT), radEnd = new THREE.MeshBasicMaterial({ color: 0x8f897c });
    box(0.16, 0.58, 1.0, -3.02, RY + 0.32, 3.75, [radM, radM, radEnd, radEnd, radEnd, radEnd]);
    box(0.05, 0.05, 0.05, -3.02, RY + 0.06, 3.28, new THREE.MeshBasicMaterial({ color: 0x6a6258 })); // the valve
    // Report finding 8: it stood 0.03 off the wall, which is right, and
    // NOTHING held it there. Two wall brackets and two feet — cast iron is
    // heavy enough that the absence of them is what the eye notices.
    const ironM = new THREE.MeshBasicMaterial({ color: 0x7d776b });
    for (const bz of [3.42, 4.08]) {
      box(0.09, 0.05, 0.05, -3.085, RY + 0.50, bz, ironM);       // bracket into the wall
      box(0.07, 0.09, 0.07, -3.02, RY + 0.035, bz, ironM);       // and a foot under it
    }
    // the pipe up out of the floor to the valve
    box(0.035, 0.30, 0.035, -3.02, RY + 0.15, 3.28, new THREE.MeshBasicMaterial({ color: 0x6a6258 }));
    // the bed: a good frame under a mattress that was never bought for it —
    // 6 cm narrower and shoved to one end, so it overhangs at the foot
    const frameM = new THREE.MeshBasicMaterial({ color: 0x4a3626 });
    box(1.90, 0.26, 0.92, -2.10, RY + 0.13, 4.86, frameM);
    for (const [lx, lz] of [[-3.00, 4.45], [-1.20, 4.45], [-3.00, 5.27], [-1.20, 5.27]] as [number, number][]) {
      box(0.08, 0.13, 0.08, lx, RY + 0.065, lz, frameM);
    }
    const mattT = surfTex('detail', 32, 20, (g) => {
      g.fillStyle = '#c9c2ae'; g.fillRect(0, 0, 32, 20);
      g.fillStyle = 'rgba(0,0,0,0.10)';
      for (let x = 3; x < 32; x += 6) g.fillRect(x, 0, 1, 20);    // ticking stripes
      g.fillStyle = 'rgba(120,100,70,0.18)'; g.fillRect(6, 8, 9, 6); // an old stain
      dither(g, 32, 20, 50);
    });
    box(1.78, 0.19, 0.86, -2.14, RY + 0.355, 4.86, flatOf2(mattT));
    // unmade: the blanket thrown back in a heap rather than laid flat
    const blankM = new THREE.MeshBasicMaterial({ color: 0x6a3f3a });
    box(1.10, 0.17, 0.90, -1.72, RY + 0.53, 4.88, blankM, 0.06);
    box(0.62, 0.13, 0.66, -1.35, RY + 0.60, 4.72, blankM, -0.22);
    const sheetM = new THREE.MeshBasicMaterial({ color: 0xb3ab97 });
    box(0.70, 0.06, 0.88, -2.55, RY + 0.47, 4.86, sheetM);
    box(0.46, 0.11, 0.30, -2.86, RY + 0.50, 4.74, new THREE.MeshBasicMaterial({ color: 0xd0cabb }), 0.14); // dented pillow
    // ── sleep ────────────────────────────────────────────────────────────
    // The user: *"sleep in your room"*. It is the one thing a bed is for and
    // the room has had a bed since it was furnished.
    //
    // UNTIL MORNING, NOT EIGHT HOURS — the desk's ruling, and it is what makes
    // the verb mean the same thing whenever you use it. Lie down at 23:00 and
    // you get eight hours; lie down at 04:00 and you get three; either way you
    // wake at 07:00, which is what "sleep" means to a player. A fixed span
    // would put you back to bed in the dark half the time.
    //
    // RAMPED, NOT SNAPPED, and this is where the desk's ruling and F's kit
    // needed reconciling rather than one overriding the other. The ruling says
    // *"no fade — jump the clock"*, which is about not building a full-screen
    // HUD overlay, and I have not built one. But `ctx.clock.advance` documents
    // its default 1.5 s ramp as load-bearing: *"everything that reads the clock
    // reads totalMin fresh every frame, so moving it smoothly means all of them
    // follow smoothly... snapping is what would fight them: the grade would
    // jump a full night in one frame and the rain would teleport through its
    // own schedule."* Passing overSeconds: 0 here would break the sky, the
    // lamps and the rain schedule to save 1.5 seconds. So: the default ramp,
    // and no overlay. Both halves of the instruction are satisfied.
    const WAKE_H = 7;
    // WHERE IT STANDS MATTERS AS MUCH AS WHAT IT DOES. At AX(-2.1)/r 0.9 this
    // sat close enough to 301's door spot to win the prompt from it: door301
    // pressed E expecting to shut the door and got "sleep until morning"
    // instead, and every clause after that cascaded. Two spots a metre and a
    // half apart is not enough when one of them is where you stand to work the
    // door.
    //
    // Moved to the far side of the bed, by the pillow end — which is where you
    // would stand to get into it anyway — and the radius tightened. That is
    // 1.98 m from the door spot instead of 1.49, and clear of both the bed
    // collider (z -15.60..-14.68) and the radiator (x 196.9..197.06).
    ctx.spot({
      x: AX(-2.6), z: AZI(4.2), r: 0.75,
      ok: () => ctx.player.x() > 100 && Math.abs(lastGy - 2 * ST) < 0.5,
      label: () => 'sleep until morning',
      act: () => {
        const { totalMin } = ctx.clock.now();
        // minutes to the NEXT 07:00. `|| 1440` covers standing on it exactly:
        // sleeping at 07:00 means the next morning, not a no-op that reads as
        // a broken interaction.
        const mins = (((WAKE_H * 60 - (totalMin % 1440)) % 1440) + 1440) % 1440 || 1440;
        // THE FADE. This row read CONFIRMED while the fade never fired: the
        // bed advanced the clock and nothing else, so K's capability worked
        // and nothing called it. A and D both reproduced it — the control
        // `__hud.fade({mid})` peaks at opacity 1.000 while pressing E on the
        // bed peaked at 0.000 and still ramped the clock 16.5 hours.
        //
        // `overSeconds: 0` because the clock now moves BEHIND a black screen:
        // ramping it over 1.5 s was there so the jump was not jarring, and
        // that is exactly what the fade is for. The shape is K's, verbatim
        // from notes/K-screen-fade.md.
        void screenFade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) });
      },
    });
    // ── PACKAGES ON THE LANDINGS ─────────────────────────────────────────
    // The user: *"every neighbor in the building has a small chance of getting
    // a package · every night all packages go away · packages never go in
    // front of a door, only to the sides · you have the option to steal one ·
    // stealing gives you a random item."*
    //
    // Everything here derives from `DOORS`, which is why the walk-up now
    // declares its doors instead of drawing them from a loop that was the only
    // thing that knew. The side-of-door rule is a PLACEMENT CONSTRAINT, so it
    // is arithmetic off the door's own frame rather than eight hand-typed
    // spots: a package sits at the jamb plus half its own depth plus a
    // margin, which cannot land on a threshold however the landings move.
    //
    // THE ROLL IS PER DOOR PER DAY and it is a hash, not a stored random.
    // That is what makes "every night they go away" free: the day index is an
    // input, so a new day IS a new set, and it works identically whether the
    // player walked through midnight or slept through it. Nothing to clear.
    const PKG_CHANCE = 0.08;                 // per door per day — see scripts/packages.mjs
    const PKG_W = 0.28, PKG_H = 0.26, PKG_D = 0.34;
    // margin from the jamb: half the parcel, plus enough that it reads as
    // beside the door rather than against it
    const PKG_OFF = DOOR_W / 2 + PKG_D / 2 + 0.09;
    const pkgT = surfTex('detail', 24, 24, (g) => {
      g.fillStyle = '#a98d63'; g.fillRect(0, 0, 24, 24);        // parcel paper
      g.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < 26; i++) g.fillRect((i * 7) % 24, (i * 11) % 24, 2, 2);
      g.fillStyle = '#6d5436'; g.fillRect(0, 10, 24, 3);        // string, one way
      g.fillRect(10, 0, 3, 24);                                  // and the other
      g.fillStyle = '#e6e2d6'; g.fillRect(14, 15, 8, 6);         // the label
      g.fillStyle = '#3a352c';
      for (let i = 0; i < 3; i++) g.fillRect(15, 16 + i * 2, 6 - i, 1);
    });
    const pkgM = texM(pkgT);
    /** deterministic, and the day is an INPUT rather than state to reset */
    const pkgRoll = (num: string, day: number, salt: number) => {
      let h = (2166136261 ^ day ^ (salt * 374761393)) >>> 0;
      for (let i = 0; i < num.length; i++) {
        h ^= num.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      // FINAL AVALANCHE. Without it this ran at 16% per door against a
      // declared 10% — FNV over three characters and a small sequential day
      // index does not spread its low bits, and `% 100000` reads exactly
      // those. Measured over 40 days x 8 doors before and after.
      h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
      h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
      h = (h ^ (h >>> 16)) >>> 0;
      return h / 4294967296;
    };
    const pkgTaken = new Set<string>();      // `${day}:${num}`, so it clears itself
    let pkgForce = -1;                       // test hook: 1 all, 0 none, -1 the roll
    const packages = DOORS.map((d) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(PKG_W, PKG_H, PKG_D), pkgM);
      mesh.visible = false;
      scene.add(mesh);
      const cap = mkCap();
      sevColliders.push(cap);
      return { d, mesh, cap, side: 1, present: false };
    });
    /** where the parcel stands for a given door and side — never the threshold */
    const pkgPos = (d: WalkupDoor, side: number): [number, number, number] =>
      [d.x + d.face * (PKG_W / 2 + 0.03), d.floor * ST + PKG_H / 2, d.z + side * PKG_OFF];
    for (const q of packages) {
      const key = () => `${Math.floor(ctx.clock.now().totalMin / 1440)}:${q.d.num}`;
      const [sx, , sz] = pkgPos(q.d, 1);
      ctx.spot({
        // registered at the door's centre-ish and moved with the parcel each
        // frame would be nicer, but a spot's x/z are read once — so one spot
        // per SIDE would be two prompts on one parcel. It sits at the parcel's
        // own place and `ok()` answers for whichever side today's roll chose.
        x: sx, z: sz, r: 0.95,
        ok: () => q.present && q.side === 1
          && Math.abs(lastGy - q.d.floor * ST) < 0.5,
        // WHOSE package it is, because that is the whole charm of it: you see
        // him in the hall. And the refusal is readable BEFORE the key is
        // pressed rather than after — K's note is explicit about that, and it
        // is the difference between a full pack and a broken prompt.
        label: () => (pocketsFull(ctx.purse)
          ? 'pockets full — you cannot carry it'
          : `steal ${q.d.num}'s package`),
        act: () => {
          // GATED ON `taken`. If the pockets are full the parcel stays on the
          // landing: destroying what you could not pick up is the one failure
          // K warned about, and it would read as the package evaporating.
          const got = giveRandom(ctx);
          if (got.taken) pkgTaken.add(key());
        },
      });
      const [ox, , oz] = pkgPos(q.d, -1);
      ctx.spot({
        x: ox, z: oz, r: 0.95,
        ok: () => q.present && q.side === -1
          && Math.abs(lastGy - q.d.floor * ST) < 0.5,
        label: () => (pocketsFull(ctx.purse)
          ? 'pockets full — you cannot carry it'
          : `steal ${q.d.num}'s package`),
        act: () => { const got = giveRandom(ctx); if (got.taken) pkgTaken.add(key()); },
      });
    }
    ctx.onFrame(({ px, pz }) => {
      const day = Math.floor(ctx.clock.now().totalMin / 1440);
      for (const q of packages) {
        const k = `${day}:${q.d.num}`;
        q.side = pkgRoll(q.d.num, day, 7) < 0.5 ? 1 : -1;
        q.present = !pkgTaken.has(k)
          && (pkgForce === -1 ? pkgRoll(q.d.num, day, 1) < PKG_CHANCE : pkgForce === 1);
        const [x, y, z] = pkgPos(q.d, q.side);
        q.mesh.position.set(x, y, z);
        q.mesh.visible = q.present;
        // Withheld if you are already standing in it, for the same reason the
        // hermit's is: a collider that appears around the player shoves them.
        const inIt = Math.abs(px - x) < 0.4 && Math.abs(pz - z) < 0.45;
        setCap(q.cap, q.present && !inIt && Math.abs(lastGy - q.d.floor * ST) < 0.5,
          x - PKG_W / 2, x + PKG_W / 2, z - PKG_D / 2, z + PKG_D / 2);
      }
    });
    pkgForceSet = (v) => { pkgForce = v === null ? -1 : v ? 1 : 0; };
    // AND published on the scene, because `__ct` is assembled in crosstown.ts
    // and that file is not mine — my mandate there was two named fields. This
    // is the same route props.ts already uses for `registerWet`, so a harness
    // can drive the packages today without waiting on the desk to wire a hook.
    scene.userData.packages = {
      force: (v: boolean | null) => { pkgForce = v === null ? -1 : v ? 1 : 0; },
      list: () => pkgReport(),
    };
    pkgReport = () => packages.map((q) => ({
      num: q.d.num, floor: q.d.floor, present: q.present,
      x: q.mesh.position.x, z: q.mesh.position.z, side: q.side,
      doorZ: q.d.z, doorW: DOOR_W,
    }));
    // dresser on the north wall, middle drawer permanently out
    const dresserT = surfTex('detail', 28, 32, (g) => {
      g.fillStyle = '#4a3626'; g.fillRect(0, 0, 28, 32);
      g.fillStyle = 'rgba(0,0,0,0.26)';
      for (const y of [3, 13, 23]) g.fillRect(3, y, 22, 8);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (const y of [3, 13, 23]) g.fillRect(3, y, 22, 1);
      g.fillStyle = '#b0a06a';
      for (const y of [6, 16, 26]) { g.fillRect(9, y, 3, 2); g.fillRect(16, y, 3, 2); }
      dither(g, 28, 32, 40);
    });
    const dresserSideM = new THREE.MeshBasicMaterial({ color: 0x412f21 });
    box(0.70, 0.82, 0.50, -2.65, RY + 0.41, 2.37,
      [dresserSideM, dresserSideM, dresserSideM, dresserSideM, flatOf2(dresserT), dresserSideM]);
    // The drawer that never shuts — proud of the FRONT, into the room.
    // Report finding 8: it was a front and a solid lump, so from an oblique
    // angle you looked into a block of wood rather than into a drawer. It is
    // a real open box now: two sides, a bottom, a back, and the shirt that is
    // stopping it closing sitting IN it rather than being it.
    const drawIn = new THREE.MeshBasicMaterial({ color: 0x6b523a });
    const DZ0 = 2.62, DZ1 = 2.79;                    // how far it stands out
    box(0.62, 0.035, DZ1 - DZ0, -2.65, RY + 0.355, (DZ0 + DZ1) / 2, drawIn);   // bottom
    for (const sx of [-0.29, 0.29]) {
      box(0.035, 0.17, DZ1 - DZ0, -2.65 + sx, RY + 0.44, (DZ0 + DZ1) / 2, drawIn);
    }
    box(0.62, 0.17, 0.03, -2.65, RY + 0.44, DZ0, drawIn);                       // back
    box(0.62, 0.20, 0.035, -2.65, RY + 0.44, DZ1, dresserSideM);                // the front
    box(0.50, 0.10, 0.11, -2.65, RY + 0.42, 2.72, new THREE.MeshBasicMaterial({ color: 0x8a8272 }));
    // an ashtray on top, full
    box(0.17, 0.04, 0.17, -2.52, RY + 0.84, 2.40, new THREE.MeshBasicMaterial({ color: 0x6a6a70 }));
    for (const [bx, bz, r] of [[-2.55, 2.37, 0.3], [-2.49, 2.42, -0.5], [-2.52, 2.44, 1.1]] as [number, number, number][]) {
      box(0.055, 0.022, 0.018, bx, RY + 0.865, bz, new THREE.MeshBasicMaterial({ color: 0xd8d0bc }), r);
    }
    // portable TV on a milk crate, because there is no table
    const crateT = surfTex('detail', 20, 20, (g) => {
      g.fillStyle = '#2f4f78'; g.fillRect(0, 0, 20, 20);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 2; y < 20; y += 5) for (let x = 2; x < 20; x += 5) g.fillRect(x, y, 3, 3);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 20, 1);
    });
    box(0.38, 0.36, 0.38, -1.56, RY + 0.18, 2.34, flatOf2(crateT));
    const tvT = surfTex('detail', 32, 24, (g) => {
      g.fillStyle = '#26262c'; g.fillRect(0, 0, 32, 24);
      g.fillStyle = '#101820'; g.fillRect(3, 3, 22, 18);
      g.fillStyle = 'rgba(160,200,220,0.25)'; g.fillRect(5, 5, 7, 6);
      g.fillStyle = '#3a3a42'; g.fillRect(26, 4, 4, 3); g.fillRect(26, 9, 4, 3);  // dials
      dither(g, 32, 24, 24);
    });
    const tvBodyM = new THREE.MeshBasicMaterial({ color: 0x26262c });
    // ── THE SCREEN IS ALIVE ─────────────────────────────────────────────
    // The user: *"i want to be able to watch tv. and i sit on the bed and
    // literally watch tv"*, and on the content: *"kinda nonsensical. random.
    // lots of things so it doesnt get to repetative."*
    //
    // So it is not one loop — it is a POOL of short segments that shuffle,
    // cut every few seconds. Short is what makes a small pool feel like a
    // channel; a long segment makes three feel like three. This commit is the
    // MECHANISM plus three segments, which is what the desk asked for; the
    // pool is meant to grow and growing it is one entry in this array.
    //
    // `pixTex` hands back a CanvasTexture, so the canvas is `t.image` and
    // redrawing it plus `needsUpdate` is the whole of the animation. No new
    // texture per frame — that would leak one every 120 ms.
    const TVW = 64, TVH = 48;
    type TvSeg = { name: string; secs: number; live?: boolean;
                   draw: (g: CanvasRenderingContext2D, t: number) => void };
    const scr = (g: CanvasRenderingContext2D) => { g.fillStyle = '#0b0d12'; g.fillRect(0, 0, TVW, TVH); };
    const tvText = (g: CanvasRenderingContext2D, txt: string, x: number, y: number, c: string, px = 4) => {
      // 3x5 block glyphs, the same way the pole sign and the door numbers are
      // drawn — real fonts do not survive a 48 px canvas.
      const F: Record<string, string[]> = {
        A:['111','101','111','101','101'], B:['110','101','110','101','110'], C:['111','100','100','100','111'],
        D:['110','101','101','101','110'], E:['111','100','110','100','111'], F:['111','100','110','100','100'],
        G:['111','100','101','101','111'], H:['101','101','111','101','101'], I:['111','010','010','010','111'],
        L:['100','100','100','100','111'], M:['101','111','111','101','101'], N:['101','111','111','111','101'],
        O:['111','101','101','101','111'], P:['111','101','111','100','100'], R:['111','101','111','110','101'],
        S:['111','100','111','001','111'], T:['111','010','010','010','010'], U:['101','101','101','101','111'],
        V:['101','101','101','101','010'], W:['101','101','111','111','101'], Y:['101','101','010','010','010'],
        '0':['111','101','101','101','111'], '1':['010','110','010','010','111'], '2':['111','001','111','100','111'],
        '3':['111','001','111','001','111'], '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
        '6':['111','100','111','101','111'], '7':['111','001','001','001','001'], '8':['111','101','111','101','111'],
        '9':['111','101','111','001','111'], '-':['000','000','111','000','000'], ' ':['000','000','000','000','000'],
        '$':['111','110','111','011','111'], '!':['010','010','010','000','010'],
        J:['001','001','001','101','111'], K:['101','110','100','110','101'],
        Q:['111','101','101','111','011'], X:['101','101','010','101','101'],
        Z:['111','001','010','100','111'], '.':['000','000','000','000','010'],
        '%':['101','001','010','100','101'], ',':['000','000','000','010','100'],
      };
      g.fillStyle = c;
      let cx = x;
      for (const ch of txt.toUpperCase()) {
        const rows = F[ch] ?? F[' '];
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++)
          if (rows[r][q] === '1') g.fillRect(cx + q * (px / 3), y + r * (px / 5), px / 3, px / 5);
        cx += px / 3 * 4;
      }
    };
    /** centred, and SIZED TO FIT — 'CROSSTOWN' at px 5 is 60 px on a 48 px
     *  screen, so the first version read 'CROSST'. Everything on this screen
     *  is seen from across a small room, so it either fits or it is not
     *  written. */
    const tvFit = (g: CanvasRenderingContext2D, txt: string, y: number, c: string, maxPx = 6) => {
      let px = maxPx;
      while (px > 3 && (txt.length * px / 3 * 4) > TVW - 4) px -= 1;
      // px 3 is the floor — below that the glyphs stop being glyphs. If it
      // STILL does not fit, the line is too long and gets cut here rather
      // than running off the edge, which is what 'WE FINANCE ANYONE' did.
      const max = Math.floor((TVW - 4) / (px / 3 * 4));
      if (txt.length > max) txt = txt.slice(0, max);
      const w = txt.length * px / 3 * 4;
      tvText(g, txt, Math.max(1, Math.round((TVW - w) / 2)), y, c, px);
    };
    /**
     * ADS THAT DIFFER IN KIND, NOT IN CONTENT.
     *
     * The user: *"i need much more diversity on the ads, theyre all basically
     * the same ad just diffr colors almost."* He is exactly right, and it was
     * my doing: the first pool was twenty sets of copy through ONE renderer —
     * band at the top, price in the middle, phone at the bottom — so it read
     * as one ad in twenty palettes. Adding a twenty-first would have changed
     * nothing, because the eye reads LAYOUT before it reads words.
     *
     * So there are ten FORMATS now and each ad declares which it is. A price
     * card and a testimonial do not resemble each other even in the same two
     * colours. Pacing varies with them — a two-second sting beside a six-second
     * list ad does more for variety than any number of new palettes — and so
     * does REGISTER: a shouting local spot, a brand pretending to be classy, a
     * public service announcement, a station ident, a legal notice. A quiet
     * slate between two loud ones makes both louder.
     *
     * The street ones stay and appear in SEVERAL formats: the pawn shop as a
     * price card AND as a testimonial is two different ads.
     */
    type Fmt = 'price' | 'product' | 'split' | 'list' | 'order'
             | 'quote' | 'demo' | 'legal' | 'sting' | 'slate';
    type Ad = {
      name: string; fmt: Fmt; secs: number;
      bg: string; ink: string; accent: string;
      head?: string; sub?: string; price?: string; was?: string;
      phone?: string; hours?: string; lines?: string[]; who?: string; tag?: string;
    };
    /** left-aligned and SIZED TO FIT from x. `tvFit` only centres, so anything
     *  drawn from an offset — list bullets, quote lines, name captions — had
     *  no fitting at all and ran off the glass: 'FOUR DOLLARS' read 'FOUR DOL'. */
    const tvAt = (g: CanvasRenderingContext2D, txt: string, x: number, y: number, c: string, maxPx = 5) => {
      let px = maxPx;
      while (px > 3 && x + txt.length * px / 3 * 4 > TVW - 2) px -= 1;
      const max = Math.max(1, Math.floor((TVW - 2 - x) / (px / 3 * 4)));
      tvText(g, txt.length > max ? txt.slice(0, max) : txt, x, y, c, px);
    };
    const fill = (g: CanvasRenderingContext2D, c: string) => { g.fillStyle = c; g.fillRect(0, 0, TVW, TVH); };
    /** the starburst, for the formats loud enough to deserve one */
    const burst = (g: CanvasRenderingContext2D, c: string, t: number, cy = TVH / 2) => {
      g.fillStyle = c;
      for (let k = 0; k < 12; k++) {
        g.save(); g.translate(TVW / 2, cy); g.rotate((k / 12) * Math.PI * 2 + t * 0.5);
        g.fillRect(0, -2, 46, 4); g.restore();
      }
    };
    /** a blocky head, for the testimonial */
    const face = (g: CanvasRenderingContext2D, x: number, y: number, skin: string, hair: string) => {
      g.fillStyle = hair; g.fillRect(x, y, 14, 5);
      g.fillStyle = skin; g.fillRect(x + 1, y + 4, 12, 11);
      g.fillStyle = '#20160e'; g.fillRect(x + 4, y + 8, 2, 2); g.fillRect(x + 9, y + 8, 2, 2);
      g.fillRect(x + 5, y + 12, 5, 1);
    };
    const RENDER: Record<Fmt, (g: CanvasRenderingContext2D, a: Ad, t: number) => void> = {
      // just a huge number and the thing it buys. No talking.
      price: (g, a, t) => {
        fill(g, a.bg);
        burst(g, a.accent, t, TVH / 2 - 2);
        if (a.was) tvFit(g, `WAS ${a.was}`, 4, a.ink, 4);
        tvFit(g, a.price ?? '', 13, '#00000077', 13);
        tvFit(g, a.price ?? '', 12, '#fffbe8', 13);
        tvFit(g, a.head ?? '', 34, a.ink, 5);
      },
      // the object on a plain sweep, turning. The width oscillates, which at
      // this size is exactly what a slow rotation looks like.
      product: (g, a, t) => {
        fill(g, a.bg);
        g.fillStyle = a.accent; g.fillRect(0, 30, TVW, TVH - 30);          // the sweep
        const w = 8 + Math.abs(Math.cos(t * 1.1)) * 16;
        g.fillStyle = a.ink;
        g.fillRect(TVW / 2 - w / 2, 12, w, 20);
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(TVW / 2 - w / 2, 12, Math.max(1, w * 0.3), 20);         // a highlight edge
        tvFit(g, a.head ?? '', 36, '#fffbe8', 5);
      },
      // before and after, down the middle
      split: (g, a) => {
        fill(g, a.bg);
        g.fillStyle = '#2a2a2e'; g.fillRect(0, 8, TVW / 2 - 1, 26);
        g.fillStyle = a.accent; g.fillRect(TVW / 2 + 1, 8, TVW / 2 - 1, 26);
        g.fillStyle = '#6b6b60'; g.fillRect(6, 16, 18, 12);                // the sad one
        g.fillStyle = '#fffbe8'; g.fillRect(TVW / 2 + 8, 14, 18, 16);      // the happy one
        g.fillStyle = '#fff'; g.fillRect(TVW / 2 - 1, 8, 2, 26);           // the divider
        tvAt(g, 'BEFORE', 3, 2, a.ink, 4); tvAt(g, 'AFTER', TVW / 2 + 6, 2, a.ink, 4);
        tvFit(g, a.head ?? '', 37, a.ink, 5);
      },
      // five bullets, ticking on one at a time
      list: (g, a, t) => {
        fill(g, a.bg);
        g.fillStyle = a.accent; g.fillRect(0, 0, TVW, 9);
        tvFit(g, a.head ?? '', 2, a.bg, 5);
        const shown = Math.min((a.lines ?? []).length, 1 + Math.floor(t / 0.9));
        (a.lines ?? []).slice(0, shown).forEach((ln, i) => {
          g.fillStyle = a.accent; g.fillRect(3, 13 + i * 7, 3, 3);         // the tick
          tvAt(g, ln, 9, 12 + i * 7, a.ink, 4);
        });
      },
      // the end card: number, hours, and nothing else
      order: (g, a, t) => {
        fill(g, a.bg);
        tvFit(g, 'ORDER NOW', 3, a.accent, 6);
        tvFit(g, a.phone ?? '', 15, '#00000077', 10);
        tvFit(g, a.phone ?? '', 14, '#fffbe8', 10);
        tvFit(g, a.hours ?? '24 HOURS', 30, a.ink, 4);
        if (Math.floor(t * 2) % 2 === 0) tvFit(g, 'OPERATORS WAITING', 39, a.ink, 3);
      },
      // a face, quote marks, a name caption
      quote: (g, a) => {
        fill(g, a.bg);
        face(g, 4, 10, '#d8a878', '#2e2018');
        g.fillStyle = a.accent;
        g.fillRect(22, 8, 3, 5); g.fillRect(27, 8, 3, 5);                  // the quote marks
        // the words go FULL WIDTH under the face, not squeezed into the 40 px
        // beside it — seven characters was all that ever fitted there.
        (a.lines ?? []).forEach((ln, i) => tvFit(g, ln, 27 + i * 7, a.ink, 5));
        g.fillStyle = a.accent; g.fillRect(0, TVH - 9, TVW, 9);
        tvAt(g, a.who ?? '', 3, TVH - 8, a.bg, 4);
      },
      // a hand doing the same thing to an object, over and over
      demo: (g, a, t) => {
        fill(g, a.bg);
        g.fillStyle = a.accent; g.fillRect(14, 22, 36, 4);                 // the counter
        g.fillStyle = a.ink; g.fillRect(28, 14, 10, 8);                    // the object
        const hx = 18 + Math.abs(Math.sin(t * 2.2)) * 22;                  // the hand
        g.fillStyle = '#d8a878'; g.fillRect(hx, 8, 9, 7);
        g.fillRect(hx + 2, 15, 5, 4);
        tvFit(g, a.head ?? '', 30, a.ink, 5);
        if (a.sub) tvFit(g, a.sub, 38, a.accent, 4);
      },
      // a still, with the small print crawling across it
      legal: (g, a, t) => {
        fill(g, a.bg);
        g.fillStyle = a.accent; g.fillRect(TVW / 2 - 13, 8, 26, 14);       // the logo block
        tvFit(g, a.head ?? '', 26, a.ink, 5);
        g.fillStyle = '#000'; g.fillRect(0, TVH - 8, TVW, 8);
        const txt = a.tag ?? '';
        const x = TVW - ((t * 22) % (TVW + txt.length * 4 + 10));
        tvText(g, txt, x, TVH - 7, '#9a9a9a', 3);   // crawls, so it may overrun by design
      },
      // two seconds, a card, nothing else
      sting: (g, a, t) => {
        fill(g, '#000');
        const k = Math.min(1, t * 3);
        g.fillStyle = a.accent;
        g.fillRect(TVW / 2 - 22 * k, TVH / 2 - 9 * k, 44 * k, 18 * k);
        if (t > 0.35) tvFit(g, a.head ?? '', TVH / 2 - 3, a.bg, 5);
      },
      // white on blue. The quiet one, and it is what makes the loud ones loud.
      slate: (g, a) => {
        fill(g, a.bg);
        g.fillStyle = a.accent; g.fillRect(2, 2, TVW - 4, TVH - 4);
        g.fillStyle = a.bg; g.fillRect(3, 3, TVW - 6, TVH - 6);
        (a.lines ?? []).forEach((ln, i) => tvFit(g, ln, 8 + i * 8, a.ink, 5));
      },
    };
    const ADS: Ad[] = [
      // ── his own street, each in more than one format ───────────────────
      { name: 'crosstown price', fmt: 'price', secs: 3.4, bg: '#2f7a4a', ink: '#fff8e0', accent: '#3f9a5e',
        was: '$2995', price: '$1395', head: 'CROSSTOWN AUTO' },
      { name: 'crosstown order', fmt: 'order', secs: 3.8, bg: '#1d4a30', ink: '#cfe8d8', accent: '#e0a81c',
        phone: '555-0199', hours: 'OPEN TIL NINE' },
      { name: 'crosstown sting', fmt: 'sting', secs: 2.0, bg: '#2a2118', ink: '#fff8e0', accent: '#e0a81c',
        head: 'CROSSTOWN' },
      { name: 'sevens slate', fmt: 'slate', secs: 4.2, bg: '#10203f', ink: '#eaf2ff', accent: '#c8d8f0',
        lines: ['SEVENS', 'FREE BUFFET', 'MUST BE 21'] },
      { name: 'sevens quote', fmt: 'quote', secs: 4.4, bg: '#7a1420', ink: '#ffe9a8', accent: '#e8c33a',
        lines: ['I WON', 'FOUR DOLLARS'], who: 'DENNIS, A LOCAL' },
      { name: 'first federal legal', fmt: 'legal', secs: 5.0, bg: '#1d3d6b', ink: '#eaf2ff', accent: '#c8d8f0',
        head: 'FIRST FEDERAL', tag: 'APR 29 PERCENT. RATES MAY VARY. FEES APPLY. NOT A COMMITMENT TO LEND.' },
      { name: 'first federal slate', fmt: 'slate', secs: 3.6, bg: '#0d2748', ink: '#eaf2ff', accent: '#7f9fd0',
        lines: ['A LOAN', 'TODAY', 'ASK INSIDE'] },
      { name: 'pawn price', fmt: 'price', secs: 3.2, bg: '#2a2036', ink: '#ffe08a', accent: '#3a2c4a',
        price: 'CASH', head: 'WE BUY GOLD' },
      { name: 'pawn quote', fmt: 'quote', secs: 4.2, bg: '#241b2e', ink: '#ffe08a', accent: '#e0b020',
        lines: ['THEY TOOK', 'MY WATCH'], who: 'A CUSTOMER' },
      { name: 'bodega list', fmt: 'list', secs: 5.6, bg: '#3a2c1e', ink: '#ffeec8', accent: '#c04a2a',
        head: 'CORNER BODEGA', lines: ['OPEN LATE', 'MILK', 'BREAD', 'BEER', 'NO CHECKS'] },
      { name: 'burger split', fmt: 'split', secs: 3.6, bg: '#a8301c', ink: '#fff4d8', accent: '#f0c020',
        head: 'BURGER BARN' },
      // ── and the tat, spread across the same formats ────────────────────
      { name: 'slice demo', fmt: 'demo', secs: 4.6, bg: '#c81e28', ink: '#fffbe8', accent: '#ffd21e',
        head: 'SLICE O MATIC', sub: 'IT NEVER STOPS' },
      { name: 'mop split', fmt: 'split', secs: 3.4, bg: '#1a7a8a', ink: '#f0ffff', accent: '#ffe83a',
        head: 'MIRACLE MOP' },
      { name: 'hair split', fmt: 'split', secs: 3.4, bg: '#4a2a5a', ink: '#ffe8ff', accent: '#e0a0f0',
        head: 'HAIR IN A CAN' },
      { name: 'ab list', fmt: 'list', secs: 5.4, bg: '#20304a', ink: '#e8f4ff', accent: '#ff6a20',
        head: 'AB BLASTER 3000', lines: ['SIX PAYMENTS', 'NO WAITING', 'FOLDS FLAT', 'FITS ANYWHERE', 'AS SEEN ON TV'] },
      { name: 'psychic order', fmt: 'order', secs: 3.8, bg: '#2a1a4a', ink: '#ffe0a0', accent: '#c0a0ff',
        phone: '555-0777', hours: 'FOUR A MINUTE' },
      { name: 'mega list', fmt: 'list', secs: 5.2, bg: '#d81880', ink: '#fff0ff', accent: '#40e0d0',
        head: 'MEGA HITS 97', lines: ['FORTY SONGS', 'TWO TAPES', 'NOT IN STORES'] },
      { name: 'carpet price', fmt: 'price', secs: 3.0, bg: '#7a4a1a', ink: '#fff0d0', accent: '#9a6030',
        was: '$3', price: '99C', head: 'CARPET BARN' },
      { name: 'mattress slate', fmt: 'slate', secs: 4.0, bg: '#123a6a', ink: '#f0f8ff', accent: '#6f8fc0',
        lines: ['MATTRESS KING', 'NO PAYMENTS', 'UNTIL 98'] },
      { name: 'tan product', fmt: 'product', secs: 3.6, bg: '#e08a10', ink: '#8a4a00', accent: '#c06a00',
        head: 'TAN U MORE' },
      { name: 'video sting', fmt: 'sting', secs: 2.0, bg: '#1a1a2a', ink: '#ffe040', accent: '#e02020',
        head: 'VIDEO HUT' },
      { name: 'pizza order', fmt: 'order', secs: 3.6, bg: '#0a5a2a', ink: '#fff8e0', accent: '#e02020',
        phone: '555-0311', hours: 'TIL TWO AM' },
      { name: 'veg demo', fmt: 'demo', secs: 4.8, bg: '#8a1060', ink: '#fff0ff', accent: '#ffe83a',
        head: 'VEG O CHOP', sub: 'BUT WAIT' },
      { name: 'gold legal', fmt: 'legal', secs: 5.0, bg: '#101018', ink: '#ffd870', accent: '#c8a020',
        head: 'GOLD CLUB CARD', tag: 'PRE APPROVAL IS NOT APPROVAL. ANNUAL FEE. SEE TERMS. THIS IS NOT AN OFFER.' },
      { name: 'roach product', fmt: 'product', secs: 3.4, bg: '#3a3a1a', ink: '#c8c8a0', accent: '#20200a',
        head: 'ROACH MOTEL' },
      // ── and the two that are not selling anything, which is the point ──
      { name: 'psa', fmt: 'slate', secs: 4.6, bg: '#1a1a1a', ink: '#e8e8e8', accent: '#8a8a8a',
        lines: ['A MESSAGE', 'FROM THIS', 'STATION'] },
      { name: 'ident', fmt: 'sting', secs: 2.2, bg: '#0a0a12', ink: '#fff', accent: '#4a6ad0',
        head: 'CHANNEL 4' },
    ];
    const SEGMENTS: TvSeg[] = ADS.map((a) => ({
      name: a.name, secs: a.secs, live: true,
      draw: (g, t) => RENDER[a.fmt](g, a, t),
    }));

    let tvSeg = 0, tvLeft = SEGMENTS[0].secs, tvClock = 0, tvRedraw = 0;
    let tvBag: number[] = [];
    const tvScreenT = surfTex('detail', TVW, TVH, (g) => { g.fillStyle = '#1b211d'; g.fillRect(0, 0, TVW, TVH); });
    const tvScreenM = flatOf2(tvScreenT);
    // ── THE BEZEL ────────────────────────────────────────────────────────
    // The user: *"give the tv a bezel"*. A glowing rectangle on a wall is a
    // poster; a glowing rectangle behind a chunky surround is a television.
    // The screen used to BE the whole front face, which is exactly the poster.
    //
    // So: a fat beige box, the glass recessed 15 mm inside it and smaller than
    // the face on all four sides, a darker band under it carrying a badge and
    // three buttons, and a standby LED. The surround is a separate, dull
    // material so the night grade dims it while the screen stays bright — the
    // bezel must frame the glow, not swallow it.
    const TV_X = -1.56, TV_Y = RY + 0.58, TV_Z = 2.34;
    const CASE_W = 0.52, CASE_H = 0.46, CASE_D = 0.40;
    const SCR_W = 0.36, SCR_H = 0.26, SCR_Y = TV_Y + 0.045;
    const TV_FRONT = TV_Z + CASE_D / 2;                 // the plane of the surround
    // BLACK PLASTIC IS NOT BLACK. The user: *"the tv bezel looks good but i
    // think i want the tv black."* The shape is untouched — he likes it — and
    // only the casing's colour changes.
    //
    // A mesh filled with #000 would read as a hole in the wall, which is the
    // exact fault the OFF SCREEN was told to avoid, so the casing gets the
    // same treatment: a very dark neutral grey, the TOP FACE lighter than the
    // front where the moulding catches light, sides darker than the front and
    // the underside darker still, and the surround a shade off the carcass so
    // the mould line between them reads.
    //
    // It also has to separate from the dead screen, which is now the other
    // dark thing on that wall. They are different HUES — the casing neutral,
    // the glass grey-green — and the well between them (#14141a) is darker
    // than both, so there is a boundary at any light level.
    const tvFrontM = new THREE.MeshBasicMaterial({ color: 0x26262c });
    const tvTopM = new THREE.MeshBasicMaterial({ color: 0x36363f });   // catches light
    const tvSideM = new THREE.MeshBasicMaterial({ color: 0x1f1f25 });
    const tvUnderM = new THREE.MeshBasicMaterial({ color: 0x161619 });
    const tvRailFaceM = new THREE.MeshBasicMaterial({ color: 0x2e2e37 }); // the surround
    const tvCaseM: THREE.Material[] =
      [tvSideM, tvSideM, tvTopM, tvUnderM, tvFrontM, tvSideM];
    const tvRailM: THREE.Material[] =
      [tvSideM, tvSideM, tvTopM, tvUnderM, tvRailFaceM, tvSideM];
    const tvBandM = new THREE.MeshBasicMaterial({ color: 0x17171c });
    // THE BODY STOPS SHORT OF THE FACE. A solid box the full depth has an
    // opaque front, and a screen recessed behind it is simply not drawn — the
    // set read as a blank beige slab. So the carcass ends 0.06 m back and the
    // surround is four RAILS around an open aperture, which is what a bezel
    // physically is.
    const BODY_D = CASE_D - 0.06, BODY_Z = TV_Z - 0.03;
    box(CASE_W, CASE_H, BODY_D, TV_X, TV_Y, BODY_Z, tvCaseM);
    const WELL_Z = BODY_Z + BODY_D / 2;                 // the face the glass sits on
    box(SCR_W + 0.02, SCR_H + 0.02, 0.012, TV_X, SCR_Y, WELL_Z + 0.004,
      new THREE.MeshBasicMaterial({ color: 0x14141a }));                 // the dark well
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), tvScreenM);
    screen.position.set(AX(TV_X), SCR_Y, AZI(WELL_Z + 0.012));
    scene.add(screen);
    // the four rails, standing proud of the glass so the screen sits INSIDE
    const RAIL_D = 0.06, RAIL_Z = WELL_Z + RAIL_D / 2 + 0.012;
    const topH = (TV_Y + CASE_H / 2) - (SCR_Y + SCR_H / 2);
    const botH = (SCR_Y - SCR_H / 2) - (TV_Y - CASE_H / 2);
    const sideW = (CASE_W - SCR_W) / 2;
    box(CASE_W, topH, RAIL_D, TV_X, SCR_Y + SCR_H / 2 + topH / 2, RAIL_Z, tvRailM);
    box(CASE_W, botH, RAIL_D, TV_X, SCR_Y - SCR_H / 2 - botH / 2, RAIL_Z, tvRailM);
    box(sideW, SCR_H, RAIL_D, TV_X - SCR_W / 2 - sideW / 2, SCR_Y, RAIL_Z, tvRailM);
    box(sideW, SCR_H, RAIL_D, TV_X + SCR_W / 2 + sideW / 2, SCR_Y, RAIL_Z, tvRailM);
    // and the furniture of the thing, on the bottom rail's own face
    const FZ = RAIL_Z + RAIL_D / 2 + 0.002;
    const BY = SCR_Y - SCR_H / 2 - botH / 2;
    box(CASE_W - 0.06, 0.055, 0.010, TV_X, BY, FZ, tvBandM);
    box(0.10, 0.020, 0.008, TV_X - 0.16, BY, FZ + 0.006,
      new THREE.MeshBasicMaterial({ color: 0x8f897c }));                 // brand badge
    for (let k = 0; k < 3; k++)
      box(0.020, 0.020, 0.008, TV_X + 0.04 + k * 0.032, BY, FZ + 0.006,
        new THREE.MeshBasicMaterial({ color: 0x40404a }));               // buttons, lighter than the band
    box(0.012, 0.012, 0.008, TV_X + 0.19, BY, FZ + 0.006,
      new THREE.MeshBasicMaterial({ color: 0xd83a2a }));                 // standby LED
    // NO `addLamp` HERE, and that is a decision rather than an omission.
    // props.ts's lamp registry is build-time only — `addLamp(x, z)` pushes a
    // head and nothing removes it — so a TV registered as a lamp pools light
    // on the floor of 301 all night whether or not the set is on. That is
    // precisely what *"make the unilluminated stuff darker, it should feel
    // scarier at night"* is against, and the user has now asked for the set to
    // be off by default.
    //
    // The screen is still the brightest thing in the room while it is on,
    // because its material is bright and ungraded. What it does NOT do is
    // throw a pool onto the boards. A SWITCHABLE lamp would give us both; that
    // is B's registry and worth asking for rather than faking here.
    // ── OFF UNLESS HE SITS DOWN ──────────────────────────────────────────
    // The user: *"tv off unless i sit down to watch it pls"*. A set playing to
    // an empty room is wallpaper, and it also threw light into 301 all night,
    // which fights *"make the unilluminated stuff darker. it should feel
    // scarier at night"*.
    //
    // HOW THE MODULE KNOWS HE IS SEATED, since `ctx` publishes no such query:
    // the bed is a COLLIDER (AX -3.05..-1.15, AZI 4.40..5.32) and the seat is
    // inside it, so the player cannot stand there. Being AT the seat's x/z
    // therefore means one thing only. `__ct.seated()` exists but it is a test
    // affordance on the entry point, not something a module can reach; a real
    // `ctx.seated()` would be better and is worth asking F for.
    //
    // THIS PAIR IS THE SEAT. `ctx.seat` below is registered from these two
    // constants rather than from a second copy of the numbers, because the
    // last time there were two copies the feature died silently: the seat was
    // moved to the foot of the bed (4d5729246, the user's *"sitting on the bed
    // should have a perspective more from the foot of the bed"*) from
    // AX(-2.10) to AX(TV_X) = AX(-1.56), and this test was left behind on the
    // old x. `rig.sit` puts the player exactly on the seat pose, so the frame
    // loop was measuring 0.54 m against a 0.20 m tolerance — the set could
    // never come on again, and nothing errored. One declaration, read twice,
    // is the only version of this that cannot drift (BUILDER-BRIEF §8).
    const TV_SEAT_X = AX(TV_X), TV_SEAT_Z = AZI(4.42);
    let tvLit = false, tvWarm = 0;
    // A DEAD SCREEN IS NOT BLACK. Pure black reads as a hole cut in the wall;
    // a switched-off CRT is dark grey-green with the room faintly in it.
    const tvDead = (g: CanvasRenderingContext2D) => {
      g.fillStyle = '#1b211d'; g.fillRect(0, 0, TVW, TVH);
      g.fillStyle = 'rgba(255,255,255,0.045)';                 // a soft sheen
      for (let k = 0; k < TVH; k++) g.fillRect(Math.max(0, 26 - k), k, 16, 1);
      g.fillStyle = 'rgba(0,0,0,0.30)';                        // darker at the corners
      g.fillRect(0, 0, TVW, 2); g.fillRect(0, TVH - 2, TVW, 2);
      g.fillRect(0, 0, 2, TVH); g.fillRect(TVW - 2, 0, 2, TVH);
    };
    const tvPaint = () => {
      const cv = tvScreenT.image as HTMLCanvasElement;
      const g = cv.getContext('2d')!;
      SEGMENTS[tvSeg].draw(g, tvClock);
      tvScreenT.needsUpdate = true;
    };
    ctx.onFrame(({ dt, px, pz }) => {
      // Only while somebody is on this floor. A canvas redrawn 8 times a
      // second for a room nobody is in is pure cost.
      if (Math.abs(lastGy - 2 * ST) > 0.5) return;
      const seated = Math.abs(px - TV_SEAT_X) < 0.20 && Math.abs(pz - TV_SEAT_Z) < 0.20;
      if (seated !== tvLit) {
        tvLit = seated;
        if (seated) { tvWarm = 0.5; tvBag = []; tvLeft = 0.01; }   // a fresh pack each sitting
        else { const g = (tvScreenT.image as HTMLCanvasElement).getContext('2d')!;
               tvDead(g); tvScreenT.needsUpdate = true; }
      }
      if (!tvLit) return;
      // A MOMENT OF COMING ON. Half a second of dark glass before the first ad
      // reads as a set warming up; snapping straight to a full picture reads
      // as a texture swap, which is what it would be.
      if (tvWarm > 0) {
        tvWarm -= dt;
        const g = (tvScreenT.image as HTMLCanvasElement).getContext('2d')!;
        g.fillStyle = '#1b211d'; g.fillRect(0, 0, TVW, TVH);
        const k = Math.max(0, 1 - tvWarm / 0.5);
        g.fillStyle = `rgba(220,235,225,${(0.10 + 0.35 * k).toFixed(3)})`;
        g.fillRect(0, Math.round(TVH / 2 - k * TVH / 2), TVW, Math.max(1, Math.round(k * TVH)));
        tvScreenT.needsUpdate = true;
        return;
      }
      tvClock += dt; tvLeft -= dt;
      if (tvLeft <= 0) {
        // A SHUFFLED BAG, not a random pick. Picking uniformly at random from
        // twenty showed a repeat by the ninth ad in a two-minute sitting —
        // the birthday problem, not a small pool — and a repeat is exactly the
        // thing the user asked not to see. Dealing the whole pack before
        // reshuffling guarantees all twenty first, and reshuffling only when
        // it is empty means the seam between packs is the only place two can
        // land near each other.
        if (!tvBag.length) {
          tvBag = SEGMENTS.map((_, k) => k);
          for (let k = tvBag.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [tvBag[k], tvBag[j]] = [tvBag[j], tvBag[k]];
          }
          if (tvBag[0] === tvSeg && tvBag.length > 1) [tvBag[0], tvBag[1]] = [tvBag[1], tvBag[0]];
        }
        // NEVER THE SAME FORMAT TWICE RUNNING. The bag already guarantees no
        // ad repeats until the pack is dealt; this is the other half of *"you
        // should not be able to predict the next frame's layout"* — two price
        // cards back to back read as one ad even with different numbers.
        let pick = tvBag.length - 1;
        for (let k = tvBag.length - 1; k >= 0; k--) {
          if (ADS[tvBag[k]].fmt !== ADS[tvSeg].fmt) { pick = k; break; }
        }
        tvSeg = tvBag.splice(pick, 1)[0]; tvLeft = SEGMENTS[tvSeg].secs; tvRedraw = 0;
        tvPaint();
        return;
      }
      if (!SEGMENTS[tvSeg].live) return;         // a still segment is painted once
      tvRedraw -= dt;
      if (tvRedraw <= 0) { tvRedraw = 0.11; tvPaint(); }
    }, ORDER.WORLD);
    // published like doorTravel and hermit, so a check watches the schedule
    // rather than hashing pixels and guessing
    ctx.onFrame(() => {
      scene.userData.tv = { seg: SEGMENTS[tvSeg].name, fmt: ADS[tvSeg].fmt, i: tvSeg,
                            left: tvLeft, pool: SEGMENTS.length, on: tvLit, warming: tvWarm > 0 };
    }, ORDER.WORLD);
    // ── and somewhere to watch it from ──────────────────────────────────
    // `ctx.seat` already does the whole mechanism the request describes —
    // press E, the camera settles at seat height facing a given yaw, press E
    // again to stand. Building a second seating system beside it would be the
    // two-pocket-models mistake in a different file.
    //
    // The seat is the near edge of the bed, the yaw faces the TV (yaw 0 is -z
    // and the set is at z 2.34 against a bed at 4.86), and `h` is the mattress
    // top rather than the frame.
    // ── SIT AT THE FOOT, NOT THE MIDDLE ───────────────────────────────────
    //
    // The user: *"sitting on the bed should have a perspective more from the
    // foot of the bed."* He is right, and the bed itself says which end that
    // is: the dented pillow sits at x −2.86 and the frame spans −3.05 … −1.15,
    // so the HEAD is −x and the FOOT is +x.
    //
    // The seat was at x −2.10, the frame's own centre — mid-mattress, level
    // with your own pillow, and **off to one side of the television**, whose
    // cabinet stands at x ≈ −1.56 (its rabbit ears are pinned at −1.68 and
    // −1.44). So the old view watched the set at an angle across the bed.
    //
    // It reads `TV_X`, the set's OWN centre line declared where the cabinet is
    // built — not a copy of it. A hand-typed second number is what left
    // `bedcavity.mjs` measuring a truck that no longer existed and
    // `doorside2.mjs` failing a door that was fine (GOTCHAS 58). Move the
    // television and the seat follows it.
    //
    // AND IT IS REGISTERED FROM `TV_SEAT_X/TV_SEAT_Z` — the pair the frame
    // loop above tests to decide whether the set is lit — rather than from a
    // second `AX(TV_X)`. Those were two independent copies of one coordinate
    // until now, and moving the seat here broke the television silently.
    ctx.seat({
      x: TV_SEAT_X, z: TV_SEAT_Z, yaw: 0, h: 0.45, r: 0.70,
      approach: { x: AX(TV_X + 0.40), z: AZI(3.70) },
      ok: () => ctx.player.x() > 100 && Math.abs(lastGy - 2 * ST) < 0.5,
      label: 'sit on the bed and watch TV',
      standLabel: 'stop watching TV',
    });
    const antM = new THREE.MeshBasicMaterial({ color: 0x9a9aa2 });
    box(0.02, 0.42, 0.02, -1.68, RY + 0.95, 2.34, antM, 0).rotation.z = 0.38;   // rabbit ears
    box(0.02, 0.38, 0.02, -1.44, RY + 0.93, 2.34, antM, 0).rotation.z = -0.44;
    // a chair with yesterday's clothes over the back
    //
    // TUCKED 0.30 m NORTH of where it used to stand. Re-handing the door to
    // match the rest of the building swung its 166deg arc across this half of
    // the room instead of the other, and the leaf passed clean through the
    // chair from 138deg onward — scripts/swing.mjs, twelve sampled points at
    // all three heights. The arc is 0.86 m from a pivot at (-0.09, 3.975) and
    // the chair's near corner was 0.75 m out; it is 1.01 m out now. It could
    // not go deeper into the room instead: the dresser collider runs to
    // x -1.15 and the chair is 0.45 wide, which leaves 0.01 m of margin, so
    // north to the wall was the only direction with room in it.
    const chairM = new THREE.MeshBasicMaterial({ color: 0x6b5033 });
    box(0.42, 0.04, 0.40, -0.72, RY + 0.44, 5.12, chairM);
    for (const [lx, lz] of [[-0.54, 4.95], [-0.90, 4.95], [-0.54, 5.29], [-0.90, 5.29]] as [number, number][]) {
      box(0.05, 0.44, 0.05, lx, RY + 0.22, lz, chairM);
    }
    box(0.42, 0.46, 0.05, -0.72, RY + 0.69, 5.29, chairM);
    box(0.40, 0.20, 0.26, -0.74, RY + 0.80, 5.24, new THREE.MeshBasicMaterial({ color: 0x3f5a6b }), 0.1);
    box(0.34, 0.14, 0.22, -0.70, RY + 0.50, 5.08, new THREE.MeshBasicMaterial({ color: 0x7a5a4a }), -0.3);
    // ── the poster ───────────────────────────────────────────────────────
    // The user: *"what is this poster on the wall?"* — which on this project
    // has meant the same thing four times now: the object is drawn but it is
    // not READABLE. What was there was an orange field, a yellow disc, a
    // cross and two white bars, and it was not a picture of anything. The
    // answer is not to redraw it better, it is to DECIDE what it is.
    //
    // It is a photocopied gig flyer, off a lamp post, on acid-green copy
    // stock — the cheapest thing anyone pinned to a wall in 1997 and the one
    // most likely to still be up in a rented room. That decision is what
    // makes it drawable, because a flyer is a fixed set of parts: a masthead,
    // ONE big shape, a bill of support acts in ragged lines, and a date bar.
    //
    // It is 0.52 m wide and you see it from across a 3 m room, so nothing on
    // it can be read as words and nothing is asked to be. The shape carries
    // it: a filled star at 22 of the 32 texels across, black on green, which
    // is a silhouette that survives being four pixels tall on screen. The
    // text is BARS — the eye reads ragged black lines under a shape as
    // "small print" without ever trying to spell it, and a bar cannot be
    // misread the way a half-drawn word can.
    const postT = surfTex('sign', 32, 44, (g) => {
      g.fillStyle = '#a9c93e'; g.fillRect(0, 0, 32, 44);          // copy stock
      g.fillStyle = '#16161a'; g.fillRect(0, 0, 32, 8);           // masthead
      g.fillStyle = '#a9c93e';                                     // knocked out of it
      for (const [x, w] of [[3, 4], [9, 3], [14, 5], [21, 3], [26, 4]]) g.fillRect(x, 2, w, 4);
      // the one strong shape
      g.fillStyle = '#16161a';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.6 : 11;
        const px2 = 16 + Math.cos(a) * r, py2 = 22 + Math.sin(a) * r;
        if (i === 0) g.moveTo(px2, py2); else g.lineTo(px2, py2);
      }
      g.closePath(); g.fill();
      // the bill: ragged lines, shortening down the page
      for (const [y, w] of [[35, 24], [38, 18], [41, 11]]) g.fillRect(Math.round((32 - w) / 2), y, w, 2);
      g.fillStyle = '#16161a'; g.fillRect(0, 30, 32, 3);           // date bar
      g.fillStyle = '#a9c93e';
      for (const [x, w] of [[4, 5], [12, 3], [17, 6], [25, 3]]) g.fillRect(x, 31, w, 1);
      // a toner streak, because it came off a machine that was running low
      g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(0, 14, 32, 3);
      // tape at the top corners, and the bottom-left corner gone soft and
      // curled away — the paper back is lighter than its printed face
      g.fillStyle = 'rgba(236,236,228,0.42)';
      g.fillRect(1, 0, 7, 3); g.fillRect(24, 0, 7, 3);
      g.fillStyle = '#20242e';
      for (let i = 0; i < 6; i++) g.fillRect(0, 43 - i, 6 - i, 1);   // wall behind
      g.fillStyle = '#cfd8a8';
      for (let i = 0; i < 5; i++) g.fillRect(6 - i, 43 - i, 1, 1);   // the curl itself
      dither(g, 32, 44, 22);
    });    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.70), texM(postT));
    poster.position.set(AX(-1.05), RY + 1.55, AZI(2.085));
    scene.add(poster);

    // ── the north wall, above the bed ────────────────────────────────────
    // Found by re-walking the building after the spawn moved in here
    // (notes/C-entrance-report.md, "RE-WALK"). You wake facing the window, and
    // three of the four directions you can turn to pay off — the window and
    // the street below, the poster and the TV to the south, your own door with
    // the 301 plate. North was bare from the bed's head to the ceiling, which
    // in a room 3.5 m deep is a quarter of what you see in the first five
    // seconds.
    //
    // Both of these hang ABOVE THE BED and are sized to be read from the
    // SPAWN, 1.2 m away and off to one side — not from the middle of the room.
    // Small enough that the wall is still mostly wall; a second poster up here
    // would have made the room read as decorated rather than lived in.
    //
    // rotation.y = PI on both. The south poster faces +z into the room with no
    // rotation; this wall is the other one, so its artwork has to be turned to
    // face -z or it reads mirrored — texM is DoubleSide, so getting this wrong
    // shows nothing missing, just a backwards calendar.
    // THE WALL IS A BOX AND AZI(5.5) IS ITS CENTRELINE, not its face. It is
    // 0.14 deep, so the room side is AZI(5.5) - 0.07 and anything hung at
    // AZI(5.49) is entombed inside the plaster — which is exactly what my
    // first attempt did: both meshes present, visible:true, at the right x and
    // y, and invisible. 0.015 proud of the face is what the south poster uses.
    const NORTH_Z = AZI(5.5) - 0.07 - 0.015;
    const calT = surfTex('detail', 30, 40, (g) => {
      g.fillStyle = '#8c3a2e'; g.fillRect(0, 0, 30, 12);            // the month block
      stampNum(g, '1997', 5, 3, '#e8dcb8');
      g.fillStyle = '#e8e0cc'; g.fillRect(0, 12, 30, 28);           // the grid page
      g.fillStyle = '#5a5348';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) g.fillRect(2 + c * 4, 15 + r * 5, 2, 2);
      // one day ringed in biro, which is the whole reason a calendar is on a
      // wall rather than in a drawer
      g.fillStyle = '#2f4f8c';
      g.fillRect(9, 24, 6, 1); g.fillRect(9, 29, 6, 1);
      g.fillRect(9, 24, 1, 6); g.fillRect(14, 24, 1, 6);
      dither(g, 30, 40, 26);
    });
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.40), texM(calT));
    cal.position.set(AX(-2.45), RY + 1.66, NORTH_Z);
    cal.rotation.y = Math.PI;
    scene.add(cal);
    // three snapshots taped up in a row, curling at one corner. Alpha outside
    // them so it is three photographs and not a photograph-coloured rectangle.
    const snapT = surfTex('detail', 34, 13, (g) => {
      g.clearRect(0, 0, 34, 13);
      const shot = (x0: number, sky: string, ground: string, figure: string) => {
        g.fillStyle = '#e6e2d6'; g.fillRect(x0, 0, 10, 12);          // the white border
        g.fillStyle = sky; g.fillRect(x0 + 1, 1, 8, 6);
        g.fillStyle = ground; g.fillRect(x0 + 1, 7, 8, 4);
        g.fillStyle = figure; g.fillRect(x0 + 4, 4, 2, 5);           // somebody, unreadably
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x0 + 3, 0, 4, 2);  // the tape
      };
      shot(0, '#7d94a8', '#4a5a48', '#3a3128');
      shot(12, '#c8b48a', '#8a7a5c', '#42352a');
      shot(24, '#6a7f9a', '#586a52', '#2e2a24');
      dither(g, 34, 13, 20);
    });
    const snaps = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.153), texM(snapT));
    snaps.position.set(AX(-1.62), RY + 1.52, NORTH_Z);
    snaps.rotation.y = Math.PI;
    scene.add(snaps);
    // lit by the same fixture as the landing outside the door
    ceilingLamp(2 * ST + 2.55, AZI(3.75), 0.55, AX(-1.6));
    sevColliders.push(
      { minX: AX(-3.35), maxX: AX(-3.2), minZ: AZI(2), maxZ: AZI(5.5) },
      { minX: AX(-3.2), maxX: AX(0), minZ: AZI(1.85), maxZ: AZI(2) },
      { minX: AX(-3.2), maxX: AX(0), minZ: AZI(5.5), maxZ: AZI(5.65) },
      // the furniture, each box matching what you can see
      { minX: AX(-3.05), maxX: AX(-1.15), minZ: AZI(4.40), maxZ: AZI(5.32) },  // bed
      { minX: AX(-3.10), maxX: AX(-2.94), minZ: AZI(3.25), maxZ: AZI(4.25) },  // radiator
      { minX: AX(-3.00), maxX: AX(-2.30), minZ: AZI(2.12), maxZ: AZI(2.80) },  // dresser + its open drawer
      { minX: AX(-1.75), maxX: AX(-1.37), minZ: AZI(2.15), maxZ: AZI(2.53) },  // crate + TV
      { minX: AX(-0.95), maxX: AX(-0.50), minZ: AZI(4.90), maxZ: AZI(5.34) },  // chair, clear of 301's arc
      // 301's leaf, standing open against the wall — a door is solid even
      // when it is open. Safe on every floor: west of AX(0) is only ever
      // reachable through 301's opening, which aptDoorCap gates to floor 3.
      // it stops SHORT of the opening (3.02 vs the jamb at 3.025) so the
      // doorway keeps its full 0.95 m clear — the door is solid, but it must
      // not be the thing that narrows the gap you walk through
      { minX: AX(-0.34), maxX: AX(-0.03), minZ: AZI(2.10), maxZ: AZI(3.02) },
    );
    // ── street side: the walk-up's front door ────────────────────────────
    // The building carries NO name. It never gets a nameplate: the gold 227
    // on the transom is the only identification it has, the way plenty of
    // real walk-ups are. (It briefly wore a brass plaque — THE WHITMORE,
    // then THE SYCAMORE — and both are gone. Don't put one back.)
    //
    // This is a composition, not a pile of props. tex-world's ENTRANCE owns
    // the numbers: it reserves a 4 m span in the middle of the residential
    // ground floor that no window may enter, paints a narrow limestone
    // doorcase and the dark doorway into it, and lays the window rhythm out
    // symmetrically either side. Everything below is measured off those same
    // constants, so nothing can drift back on top of anything else.
    //
    // Layout, either side of the door centreline:
    //   0.000 … 0.875   the doorway opening (painted dark by resGroundTex)
    //   0.875 … 1.250   the limestone doorcase jamb
    //   1.250 …         brick; the buzzer panel is centred at 1.55
    //   2.000           edge of the reserved span; the first window starts a
    //                   further 1.375 m out, so 1.7 m of clear brick past the
    //                   buzzer's outer end
    //
    // Depth: ONE plane for all the door furniture, 2 cm proud of the brick.
    // Everything used to sit at its own depth (0.02/0.04/0.05), which is why
    // the old plaque vanished behind the door leaf and the buzzer detached
    // from the wall at grazing angles.
    const DOOR_Z = -44;              // = the residential building's centre z
    const FRONT = FACE - 0.02;       // the entrance's single depth plane
    const { OPEN_W, OPEN_BOT, OPEN_TOP, FURN_C } = ENTRANCE;
    const REVEAL = 0.125;            // dark margin of opening around the door
    const LEAF_W = OPEN_W - REVEAL * 2;         // 1.50
    const DOOR_TOP = 2.30, BAR = 0.08, TRANSOM_H = 0.45;
    const hang = (m: THREE.Mesh, y: number, z: number) => {
      m.position.set(FRONT, y, z);
      m.rotation.y = -Math.PI / 2;
      scene.add(m);
    };
    const doubleDoorT = surfTex('detail', 48, 64, (g) => {
      g.fillStyle = '#22301f'; g.fillRect(0, 0, 48, 64);
      for (const ox of [2, 25]) {
        g.fillStyle = '#3a4c34'; g.fillRect(ox, 2, 21, 62);
        g.fillStyle = '#16202a'; g.fillRect(ox + 3, 6, 15, 26);   // glass pane
        g.fillStyle = 'rgba(200,215,225,0.25)'; g.fillRect(ox + 4, 7, 5, 24);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(ox + 3, 38, 15, 20); // lower panel
      }
      g.fillStyle = '#c9b45e'; g.fillRect(21, 34, 2, 4); g.fillRect(25, 34, 2, 4); // handles
      dither(g, 48, 64, 40);
    });
    // the leaf runs from the threshold to DOOR_TOP; its bottom centimetre is
    // buried in the stoop so the two can never part and show a hairline
    const streetDoor = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_W, DOOR_TOP - OPEN_BOT), texM(doubleDoorT));
    hang(streetDoor, (OPEN_BOT + DOOR_TOP) / 2, DOOR_Z);
    const transomT = surfTex('sign', 48, 14, (g) => {
      g.fillStyle = '#161c24'; g.fillRect(0, 0, 48, 14);
      g.fillStyle = 'rgba(200,215,225,0.14)'; g.fillRect(2, 2, 44, 10);
      g.fillStyle = '#d9b95c'; g.font = 'bold 9px monospace'; g.textAlign = 'center';
      g.fillText('227', 24, 11);
    });
    const transom = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_W, TRANSOM_H), texM(transomT));
    hang(transom, DOOR_TOP + BAR + TRANSOM_H / 2, DOOR_Z);
    // the buzzer panel — the only thing on the brick beside the doorcase now
    // that the nameplate is gone: 0.30 m clear of the stone, 1.7 m clear of
    // the nearest window. Nothing hangs on the other side; a walk-up with a
    // buzzer on one jamb and bare brick on the other is the ordinary case.
    const FURNITURE_Y = 1.72;
    const buzzerT = surfTex('detail', 16, 32, (g) => {
      g.fillStyle = '#8a8d95'; g.fillRect(0, 0, 16, 32);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 0, 16, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 31, 16, 1);
      g.fillStyle = '#6e727a'; g.fillRect(2, 3, 12, 26);
      g.fillStyle = '#26282e';
      for (let y = 5; y < 27; y += 6) { g.fillRect(4, y, 3, 3); g.fillRect(9, y, 3, 3); }
      dither(g, 16, 32, 18);
    });
    const buzzer = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.48), texM(buzzerT));
    hang(buzzer, FURNITURE_Y, DOOR_Z + FURN_C);
    // the stoop: one worn step, wider than the opening so it reads as built
    // out of the wall. Its top IS the threshold — the door stands on it —
    // and its base sinks 2 cm into the walk so no seam can open up there.
    const STOOP_TOP = OPEN_BOT + 0.01, STOOP_BASE = sidewalkY - 0.02;
    const STOOP_D = 0.55, STOOP_W = OPEN_W + 0.2;
    const stoopTreadT = surfTex('ground', 18, 62, (g) => {
      g.fillStyle = '#948f87'; g.fillRect(0, 0, 18, 62);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, 2, 62);   // nosing catches the sky
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(14, 0, 4, 62);        // shadow at the threshold
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(5, 12, 9, 38);        // worn centre, walked hollow
      dither(g, 18, 62, 150);
    });
    const stoopRiserT = surfTex('detail', 62, 6, (g) => {
      g.fillStyle = '#8b867e'; g.fillRect(0, 0, 62, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 62, 1);   // top arris
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 5, 62, 1);         // grime at the walk
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(12, 2, 3, 3); g.fillRect(44, 3, 4, 2); // chips
      dither(g, 62, 6, 30);
    });
    const stoopEndT = surfTex('detail', 18, 6, (g) => {
      g.fillStyle = '#8b867e'; g.fillRect(0, 0, 18, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 18, 1);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 5, 18, 1);
      dither(g, 18, 6, 12);
    });
    // solid box, so front faces only — texM's DoubleSide is for the planes
    const flatOf = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t });
    const stoopBuriedM = new THREE.MeshBasicMaterial({ color: 0x8b867e });
    const stoopEndM = flatOf(stoopEndT);
    const stoop = new THREE.Mesh(
      new THREE.BoxGeometry(STOOP_D, STOOP_TOP - STOOP_BASE, STOOP_W),
      // [+x buried, -x riser, +y tread, -y buried, +z end, -z end]
      [stoopBuriedM, flatOf(stoopRiserT), flatOf(stoopTreadT), stoopBuriedM, stoopEndM, stoopEndM],
    );
    // 0.40 m of it stands proud of the wall, the rest is buried in the brick
    stoop.position.set(FACE + 0.15 - STOOP_D / 2, (STOOP_TOP + STOOP_BASE) / 2, DOOR_Z);
    scene.add(stoop);

    // ── the two [E] spots this building owns ─────────────────────────────
    // Registered here, not hand-written into crosstown.ts's SPOTS array. The
    // entry point no longer knows what these are; it just iterates whatever
    // has been registered. Adding a door now touches only the file that owns
    // the door, which is the whole point of ctx.spot.
    //
    // `lastGy` is read directly rather than through ctx.player.gy(), because
    // that accessor routes back through this module anyway.
    const ENTER_X = FACE - 0.45, ENTER_R = 1.05;
    ctx.spot({
      x: ENTER_X, z: DOOR_Z, r: ENTER_R,
      ok: () => ctx.player.x() < 100 && lastGy < 1,
      // The building has no name — the gold 227 on the transom is its only
      // identification, so the prompt says that rather than the long-dead
      // THE WHITMORE it carried before the nameplate came off.
      label: () => 'enter No. 227',
      // LAND ON FLIGHT A, not on the mean of the two flights. `AX(1.2)` is the
      // arithmetic middle of the lobby and therefore the middle of the CORE WALL
      // (`AX(1.04)…AX(1.36)`), so walking forward from the front door of the
      // player's own home walked him into that wall and stopped 0.39 m short of
      // the bottom step. `yaw = PI` faces +z, straight up the shaft, and from
      // `FLIGHT_A_X` that is the flight — measured, walked, not warped.
      act: () => ctx.player.jumpTo(AX(FLIGHT_A_X), AZI(1.3), Math.PI, 0),
    });
    ctx.spot({
      x: AX(1.2), z: AZI(0.4), r: 0.95,
      ok: () => ctx.player.x() > 100 && ctx.player.x() < 230 && lastGy < 0.5,
      label: () => 'out to the street',
      // Land WELL OUTSIDE the enter spot's radius. It used to drop you at
      // FACE-1.1, which is 0.65 m from a 1.05 m trigger — you were inside it
      // the instant you arrived, and one held E ping-ponged you straight back
      // into the lobby, so the exit simply did not work. FACE-1.8 is 1.35 m
      // clear. Same fix the bodega exit already carries, for the same reason.
      act: () => ctx.player.jumpTo(FACE - 1.8, DOOR_Z, -Math.PI / 2, ctx.KERB_H),
    });
  }
  // multi-floor ground: pick the floor candidate nearest the last height —
  // that one closure is what makes stacked floors work with a 2D walker
  //
  // `commit` IS THE WHOLE DIFFERENCE BETWEEN A QUESTION AND A MOVE. Asking
  // "how high is the floor at (wx,wz)?" must not change which storey the
  // player is recorded as being on; only the per-frame call that passes the
  // PLAYER's own position may do that. This used to write `lastGy` on every
  // call, which made `groundPick`'s three callers — one of them `canSee`,
  // probing every candidate [E] spot every frame — into silent writers of the
  // player's storey. See the note on `gy()` where this object is returned.
  const aptGround = (wx: number, wz: number, commit = false): number => {
    // THE ROOF BUG LIVES HERE, and this is the only place that can see it.
    // `consider()` below refuses to step UP more than 0.6 m and puts no limit
    // at all on stepping DOWN, so a player 5 m above the building is silently
    // caught by the top landing — the nearest candidate — and set down on it.
    // That is the "respawn puts you on the roof" report: nothing respawned,
    // the picker rescued them onto floor 3 and the lost-test downstream never
    // saw a bad height because by then there was not one.
    //
    // The flag is raised on the PRE-SNAP value, which exists for exactly one
    // statement, and the respawn hook reads it. Fixing it in the hook instead
    // is impossible: the hook is handed `gy` after this function has already
    // laundered it.
    // Raised only on a committing call: it is a fact about where the PLAYER
    // is, and a question asked about some other coordinate is not evidence
    // about that.
    if (commit && lastGy > 3 * ST + 1.0) lostAbove = true;
    const lx = wx - APT_X, lz = wz - APT_Z;
    let rel = 0;
    if (lx >= 0 && lz > STAIR_Z0) {
      if (lz > STAIR_Z1) rel = RISE;
      else {
        const t = (lz - STAIR_Z0) / RUN;
        rel = lx < 1.2 ? t * RISE : 2 * RISE - t * RISE;
      }
    }
    let best = lastGy, bd = Infinity;
    const consider = (h: number) => {
      if (h > lastGy + 0.6) return;     // no stepping up half a storey
      const d = Math.abs(h - lastGy);
      if (d < bd) { bd = d; best = h; }
    };
    for (let f = 0; f < 4; f++) {
      const h = rel + f * ST;
      if (h > 3 * ST + 0.01) continue;  // nothing above floor 3
      consider(h);
    }
    // The top landing is the one surface that is NOT a repeat of the storey
    // pattern: it exists only at floor 3, only over the shaft's west half,
    // and only for the first NIB_D of it. Every other candidate is rel+f*ST,
    // and over there the best of those is flight A a storey and a half down —
    // which is exactly the 2.6 m drop this closes. Offered as a candidate
    // rather than special-cased, so the hysteresis still arbitrates: walking
    // DOWN the east flight never sees it, because it is west-half only.
    if (lx >= 0 && lx < 1.2 && lz > STAIR_Z0 && lz <= NIB_Z1) consider(TOP_Y);
    if (commit) lastGy = best;
    return best;
  };

  // He keeps his own hours — mostly afternoons, rarely at night.
  //
  // The user: *"i think the neighbor is out looking into my apt way too
  // often."* That is frequency, not a bug, and he stays: a neighbour
  // occasionally in the hall is one of the few signs of life on that landing.
  //
  // TWO THINGS CHECKED FIRST, because either would have caused it and they
  // need different fixes. He is NOT triggered by the player — no door event,
  // no landing entry — he is a pure hash of the ABSOLUTE GAME HOUR, so he
  // cannot be waiting for you and never could. And the hash does give one
  // decision per hour rather than per frame, so it does not flicker. Neither
  // was the fault.
  //
  // The fault was just the number: 0.7 every hour from 12:00 to 18:00. One
  // real second is one game minute, so an hour is a minute of play — walk out,
  // do something, come back, and you have crossed two or three hours at
  // seven-in-ten each. He was present for most of the afternoon, which is
  // exactly "wallpaper rather than an event".
  //
  // 0.16 at the peak, and then a REAL COOLDOWN on top: he cannot appear if he
  // appeared in any of the previous HERMIT_GAP hours. That is what stops
  // clustering — a bare probability will happily give you him twice running,
  // which is the thing that reads as broken. Still stateless and deterministic
  // (it re-asks the same hash for the earlier hours), so it needs no memory and
  // survives a clock jump or a sleep.
  //
  // Net: about 0.16 x (1 - 0.16)^6 ~= 5.6% of afternoon hours, so roughly one
  // sighting in three or four afternoons rather than most hours of every one.
  let hermitForce = -1;
  const HERMIT_GAP = 6;                    // hours he stays in after being seen
  const hermitRaw = (hAbs: number): boolean => {
    const h = ((hAbs % 24) + 24) % 24;
    const chance = h >= 12 && h < 18 ? 0.16 : h >= 8 && h < 22 ? 0.06 : 0.015;
    return ((((hAbs + 7) * 2654435761) >>> 0) % 1000) < chance * 1000;
  };
  const hermitIn = (hAbs: number): boolean => {
    if (!hermitRaw(hAbs)) return false;
    for (let k = 1; k <= HERMIT_GAP; k++) if (hermitRaw(hAbs - k)) return false;
    return true;
  };

  // floor-aware stair guards (2D colliders, so they follow the floor)
  // Registered rather than called by name from the sim loop: the entry point
  // no longer knows this module has per-frame work. WORLD order because the
  // stair guards and the hermit's presence are state that later passes read.
  // ── respawn: home is 301 ─────────────────────────────────────────────────
  // The user asked for both, separately: *"also make me spawn in my room"* and
  // *"i want the respawn to be my room"*. Spawn is the entry point starting the
  // rig on SPAWN. Respawn is this: wherever the player ends up, home is here.
  //
  // WHAT CAN ACTUALLY GO WRONG, since a safety net for an impossible state is
  // just dead code. Movement is clamped to `bounds` and `groundPick` always
  // returns a number, so you cannot walk off the world or fall out of it. What
  // CAN happen is a bad FLOOR: the walk-up stacks four storeys of 2D colliders
  // and the floor picker carries hysteresis, so a teleport, a collider added
  // under you, or a clock jump mid-stair can leave `lastGy` at a height no
  // storey occupies. The building runs 0 to 3*ST with stair ramps between, so
  // anything outside that band by more than a step is not a floor at all.
  //
  // It uses ctx.player.jumpTo, which already exists — no new plumbing, and none
  // fp.ts or crosstown.ts touched, both of which are the desk's.
  //
  // NOT a general stuck-recovery: the rig's own fallback returns you to
  // `lastGood`, which is wherever you last stood legally rather than your room,
  // and that lives in fp.ts. If the desk wants respawn to mean "always 301"
  // everywhere in the world, that is a one-line change to fp.ts's unstick
  // fallback and it is theirs to make. This covers the building.
  const FLOOR_LO = -0.6, FLOOR_HI = 3 * ST + 1.0;
  let lostFor = 0;
  ctx.onFrame((f) => {
    if (f.px <= 100) { lostFor = 0; return; }        // not in the walk-up at all
    // `lostAbove` fires IMMEDIATELY rather than through the 0.1 s debounce.
    // The debounce is there because one odd sample during a teleport is not a
    // lost player; but being above the top landing is not a sample that can be
    // odd, and the flag only survives a single frame anyway because the picker
    // corrects itself on the next one.
    const above = lostAbove;
    lostAbove = false;
    const lost = f.gy < FLOOR_LO || f.gy > FLOOR_HI;
    // a tenth of a second of it, not one frame — a single bad sample during a
    // teleport is not the player being lost, and bouncing them for it would be
    // its own bug
    lostFor = lost ? lostFor + f.dt : 0;
    if (above || lostFor > 0.1) {
      lostFor = 0;
      ctx.player.jumpTo(SPAWN.x, SPAWN.z, SPAWN.yaw, SPAWN.gy);
    }
  }, ORDER.WORLD);

  ctx.onFrame((f) => { updateCaps(f.px); updateDoor(f.dt); updateHermitAt(f.hourAbs, f.px, f.pz, f.dt); }, ORDER.WORLD);

  const updateCaps = (px: number) => {
    // the guard starts at the railing, not at the stairwell mouth: the first
    // NIB_D of the west half is the top landing now and you may stand on it
    setCap(stairCap, lastGy > 3 * ST - 0.12, AX(0), AX(1.2), AZI(NIB_Z1), AZI(LAND_Z1));
    const onLobby = px > 100 && lastGy < 0.6;
    setCap(underStairA, onLobby, AX(1.2), AX(2.4), AZI(STAIR_Z0), AZI(LAND_Z1));
    setCap(underStairB, onLobby, AX(0), AX(1.2), AZI(STAIR_Z1), AZI(LAND_Z1));
    setCap(aptDoorCap, Math.abs(lastGy - 2 * ST) > 0.4, AX(-0.15), AX(0.05), AZI(3.5 - DOOR_GAP / 2), AZI(3.5 + DOOR_GAP / 2));
  };

  /** Swing the leaf toward wherever it has been asked to be, and keep the
   *  collider on it. The cap goes on only once the leaf is nearly home:
   *  a door blocks when it is SHUT, not while it is still travelling, and
   *  raising the cap early is how you get sealed in behind a moving door. */
  const updateDoor = (dt: number) => {
    if (!leaf301) return;
    const target = doorShut ? DOOR_A_SHUT : DOOR_A_OPEN;
    if (doorA !== target) {
      const step = 4.2 * Math.min(dt, 0.05);           // ~0.7 s end to end
      doorA += Math.sign(target - doorA) * Math.min(step, Math.abs(target - doorA));
      leaf301.rotation.y = doorA;
    }
    // The gap is 0.95 and the leaf is 0.91 of it, so the cap is the whole
    // doorway: 2 cm of daylight at each jamb is not somewhere a 0.36 m rig
    // was ever getting through, and a collider with a hole in it reads as a
    // bug rather than as a draught.
    setCap(doorShutCap,
      // NEAR the shut pose, not "past" it. This was `doorA > DOOR_A_SHUT - 0.10`,
      // which silently assumed shut was the LARGER angle. Flip the hand and shut
      // becomes -pi/2 while open is +1.32, so that test was true at BOTH ends and
      // the doorway stayed blocked with the door standing open. A distance test
      // has no handedness in it and cannot be wrong that way again.
      Math.abs(doorA - DOOR_A_SHUT) < 0.10 && Math.abs(lastGy - 2 * ST) < 0.5,
      AX(-0.16), AX(0.06), AZI(3.5 - DOOR_GAP / 2) - 0.02, AZI(3.5 + DOOR_GAP / 2) + 0.02);
  };

  const updateHermitAt = (hAbs: number, px: number, pz: number, dt: number) => {
    // HE IS ONLY ON HIS OWN LANDING. Ref shots/user-neighbour-floating.png: he
    // was drawn beside 202, a storey below where he lives, with his feet in the
    // air.
    //
    // ONE BUG, NOT TWO, and it is worth being exact because the two candidates
    // wanted opposite fixes. His Y IS CORRECT — measured, he stands at float
    // 0.00 on the landing whose carpet is 2 * ST, which is his. What was wrong
    // is that `visible` was set from the schedule ALONE, with no floor gate, so
    // he was drawn on every landing in the building at his own storey's height:
    //
    //     player on the lobby      he floats 5.40 m
    //     player on 201/202        he floats 2.70 m   <- the shot
    //     player on 301/302        he stands, 0.00
    //
    // So NO y offset, and the desk's warning is the right one to have heeded:
    // citizenPlane owns the origin and a hand-fudge here would have been the
    // world-wide 12 cm float all over again. The floor is the thing to fix.
    //
    // Gated with the SAME test hermitCap already used, which is the other half
    // of it: the collider was floor-gated and the sprite was not, so from
    // another landing he was visible and not solid — two halves of one figure
    // disagreeing about whether he was there.
    const onHisLanding = Math.abs(lastGy - 2 * ST) < 0.5;
    // THE SCHEDULE IS ONLY CONSULTED IN `in` AND `loiter`. Everywhere else the
    // sequence is already running and finishes on its own, which is the
    // "do not let him vanish mid-sequence" rule expressed as control flow
    // rather than as a guard somebody has to remember.
    const wantsOut = hermitForce === -1 ? hermitIn(hAbs) : hermitForce === 1;
    const HZ = AZI(3.5);
    // HE WAITS RATHER THAN WALKING THROUGH YOU. Same class of fault as the
    // crossing the user got stuck at: a mover that does not look before it
    // moves. He simply does not take the step this frame, and takes it when
    // you move aside.
    const blockedAt = (nx: number) => Math.hypot(px - AX(nx), pz - HZ) < 0.72;
    const dOpen = Math.abs(d302A - D302_OPEN) < 0.04;
    const dShut = Math.abs(d302A - D302_SHUT) < 0.04;
    switch (hermitPhase) {
      case 'in':
        if (wantsOut) { hermitPhase = 'opening'; hermitX = HERMIT_X_IN; hermitDwell = 0; }
        break;
      case 'opening':                                    // he waits for his own door
        if (dOpen) hermitPhase = 'out';
        break;
      case 'out': {
        const nx = hermitX - HERMIT_WALK * dt;
        if (!blockedAt(nx)) hermitX = Math.max(HERMIT_X_OUT, nx);
        if (hermitX <= HERMIT_X_OUT + 1e-4) { hermitPhase = 'loiter'; hermitDwell = 0; }
        break;
      }
      case 'loiter':
        hermitDwell += dt;
        if (!wantsOut && hermitDwell >= HERMIT_MIN_DWELL) hermitPhase = 'back';
        break;
      case 'back': {
        const nx = hermitX + HERMIT_WALK * dt;
        if (!blockedAt(nx)) hermitX = Math.min(HERMIT_X_IN, nx);
        if (hermitX >= HERMIT_X_IN - 1e-4) hermitPhase = 'closing';
        break;
      }
      case 'closing':                                    // shut BEHIND him, not with him
        if (dShut) hermitPhase = 'in';
        break;
    }
    // `in` is the only phase he is not drawn in — and by then a shut door is
    // in front of him, so there is no frame where a visible man blinks out.
    hermit.position.x = AX(hermitX);
    hermit.visible = hermitPhase !== 'in' && onHisLanding;
    // PUBLISHED, so a harness watches the sequence rather than guessing it from
    // a sprite's x. Same move as `scene.userData.doorTravel` and props.ts's
    // `wetness`: the world states what it knows.
    // `wants` is the SCHEDULE, `phase` is where the sequence has got to. They
    // are different questions and a rarity measurement wants the first: step
    // the clock hour by hour and `phase` still reads 'out' long after the hour
    // turned, because he is mid-walk. Sampling phase that way reported him out
    // 65% of hours when the schedule says a small fraction of that.
    scene.userData.hermit = { phase: hermitPhase, x: hermitX, door: d302A, visible: hermit.visible, wants: wantsOut };
    // ── his door follows him ───────────────────────────────────────────────
    // An open door says somebody is there even when the sprite is not, which
    // is half of why the landing read as though he was out constantly — the
    // other half was the 0.7 hourly chance, fixed alongside this. They are one
    // behaviour: the schedule decides, and the door is the visible half of it.
    //
    // OPENS WITH HIM, CLOSES AFTER HIM. Arriving together reads as cause and
    // effect; the tail is what stops the door shutting in his face the instant
    // the hour rolls over. And it SWINGS — 1.29 rad at 1.4 rad/s is about
    // nine tenths of a second — so it never snaps between states while you are
    // stood on the landing looking at it.
    if (leaf302) {
      // No tail and no timer any more. `closing` is entered only once he is
      // back through the opening, so "after him" is a fact about the sequence
      // rather than 1.2 s of hoping.
      const target = hermitPhase === 'in' || hermitPhase === 'closing' ? D302_SHUT : D302_OPEN;
      if (d302A !== target) {
        const step = 1.4 * Math.min(dt, 0.05);
        d302A += Math.sign(target - d302A) * Math.min(step, Math.abs(target - d302A));
        leaf302.rotation.y = d302A;
      }
    }
    // solid while he is standing there — he is out in the hall now, so
    // without this you walk straight through him. Floor-gated like every
    // other cap, because colliders here are 2D and the hall is stacked 4 deep.
    // HIS COLLIDER WALKS WITH HIM, and it is withheld if you are already
    // standing where it would appear. A cap that materialises around the
    // player is the depenetration bug from the other side: he would shove you
    // rather than wait for you, which is exactly what he is not supposed to do.
    const capIn = Math.abs(px - AX(hermitX)) < 0.42 && Math.abs(pz - AZI(3.5)) < 0.42;
    setCap(hermitCap, hermit.visible && !capIn && Math.abs(lastGy - 2 * ST) < 0.5,
      AX(hermitX - 0.26), AX(hermitX + 0.26), AZI(3.24), AZI(3.76));
    if (!hermit.visible) return;
    // The sprite does the turning and the column now, and it needs the
    // player's position to do it — which is why this takes px/pz where it used
    // to take only the hour and read his own yaw back a frame late.
    hermitSprite.update(px, pz, dt);
  };

  // ── say what is ours ─────────────────────────────────────────────────────
  // `userData.mod = 'walkup'`, the same stamp ct/lot.ts carries and the same
  // move props.ts made with `userData.selfLit`.
  //
  // From outside the scene graph you cannot tell whose a mesh is, so a
  // whole-world checker has to be handed a BOX — and a box is a remembered
  // coordinate that goes stale the moment D reorders the roster. The car lot
  // had the same thirteen faults filed against it three times from a box that
  // held none of it. Selecting by author needs no memory:
  //
  //     o.traverse(n => { if (n.userData.mod === 'walkup') … })
  //
  // This building is the awkward case that most needs it: the street entrance
  // is at x ~7 and the interior is teleported out to x ~200, so NO single box
  // contains the walk-up. A box was never going to work here at all.
  for (let i = MARK; i < scene.children.length; i++) {
    scene.children[i].traverse((n) => { n.userData.mod = 'walkup'; });
  }

  return {
    colliders: sevColliders,
    ground: aptGround,
    // WHY gy() ONCE LIED AT THE KERB EDGE, and what now stops it. It reported
    // 0.00 while the ground there was 0.14 and the camera — which was right —
    // sat at 1.76. The drift was never in this module: `setGy` stores exactly
    // what it is handed, and `groundPick` (crosstown.ts) routed every one of
    // its returns through it, so the two could not disagree about ONE
    // coordinate.
    //
    // What disagreed was WHICH coordinate wrote last. `groundPick` was a query
    // with a side effect and it has three callers; only the FPRig's `groundY`
    // passes the PLAYER's position. `canSee` calls it once per candidate [E]
    // spot, every frame, at the SPOT's coordinates — so `lastGy` ended each
    // frame describing the last spot the prompt-aimer probed, not the ground
    // under the player. On the pavement the last spot probed happened to be at
    // 0.14 and it looked fine; at the kerb edge it was a road-level spot at
    // 0.00 and it did not. Measured in `scripts/probes/w25-kerb-gy.mjs`:
    // standing still at gy 0.140, one `groundAt(-2, -20)` moved gy to 0.000
    // WITHIN THE SAME TICK and the next frame put it back — which is why
    // sampling across two frames hid the fault entirely.
    //
    // FIXED by making the question and the move different calls, in both
    // files: `aptGround` above takes `commit`, `groundPick` takes `commit`,
    // and exactly one call site — the rig's per-frame `groundY(player.x,
    // player.z)` — passes true. `canSee` and the `groundAt` test affordance
    // are pure reads. Anything else that wants to MOVE the player between
    // storeys still says so out loud, through `setGy`.
    gy: () => lastGy,
    setGy: (v) => (lastGy = v),
    forceHermit: (v) => { hermitForce = v === null ? -1 : v ? 1 : 0; },
    forcePackages: (v) => pkgForceSet(v),
    packages: () => pkgReport(),
  };
}

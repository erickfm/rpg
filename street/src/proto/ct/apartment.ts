import * as THREE from 'three';
import type { AABB } from '../fp';
// RADIUS is the PLAYER'S OWN CAPSULE and it is imported, never retyped: the
// calendar's page is offset from its stand-point by less than one capsule
// (item 308), and a hand-typed 0.36 here would keep looking right after
// somebody re-tuned the rig — BUILDER-BRIEF §8.
import { WAY_OUT, RADIUS } from '../fp';
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
import { screenFade, makePanel, type Panel } from './hud';

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
  /** The subset of `colliders` that MOVES — this building's actors.
   *
   *  ITEM 260. `crosstown.ts` builds `actorBoxes` so that
   *  `__ct.staticColliders()` can mean "geometry", and its own comment claimed
   *  *"there are exactly two places an actor box enters `colliders`, and both
   *  are the registration hooks right here, so the set cannot drift from the
   *  world."* **There was a third, and it is this array.** Everything in
   *  `colliders` above arrives by a plain spread, so two moving caps in here
   *  were published to every check as furniture:
   *
   *   · `hermitCap` — idle at (999, 999) and at his own doorway from hour 17,
   *     drifting x 202.26 → 202.04 over hours 17–23 as he settles.
   *   · every **package cap** — `pkgRoll(num, day, 7)` flips which SIDE of the
   *     door a parcel sits on each night, so a cap jumps 1.63 m in z between
   *     game days without anything touching this file.
   *
   *  Both are real colliders and both should stop the player; neither is
   *  geometry. A red-dump reading a moving box out of `colliders` and calling
   *  it a static prop is what cost a queue item once already, and a builder
   *  reading 257/258/259 across a round trip nearly filed "ghosts.mjs is
   *  culled" on the back of it.
   *
   *  Published as a SEPARATE array rather than a flag on each box because
   *  `AABB` is a plain `{minX,maxX,minZ,maxZ}` shared with `fp.ts`, and the
   *  membership test upstream is by IDENTITY — `actorBoxes` is a `Set<AABB>` —
   *  which is exactly what a shape or a flag cannot express. */
  actorColliders: AABB[];
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
  // rainAt was published on scene.userData for exactly this reason (e0c68e46).
  // Same move, same reason: scripts/door301.mjs asserts this number stays
  // standable on floor 3, and it has to be able to see it from a preview.
  //
  // The precedent this comment used to cite has since been FIXED rather than
  // worked around, which strengthens the rule — corrected item 257. It said
  // "interiors-walk reaches into /src/proto/ct/doors.ts and therefore cannot
  // run against the built bundle at all (af5b68cd)". Item 251 converted it to
  // `__ct.doors()` / `__ct.party()`; re-measured for 257 on `vite preview`,
  // `interiors-walk church` scores 29/29, exit 0. Publish the value — do not
  // leave a check reaching for source and call it dev-only.
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
  // ── THE OPENING, AND THE LEAF THAT COVERS IT — FOR EVERY FLAT ───────────
  // The user: *"doors in apt are flush with wall on every floor except my
  // floor."* He was right, and the cause was structural rather than seven
  // separate oversights: the wall was pierced ONLY between 2*ST and 2*ST+2.1,
  // so 301 and 302 got a real hole with a reveal down each side and the other
  // six got a leaf laid on uncut plaster — measured at 10 mm PROUD of the
  // wall face, which is exactly what flush looks like.
  //
  // These three numbers are what an opening IS, so they live here, once, and
  // every floor reads them. 301 worked two of them out for itself and kept
  // them private; hoisting them is what stops the other six drifting again.
  //
  //   DOOR_HEAD  the head height — floor to the underside of the lintel
  //   FLAT_LEAF_W  WIDER than the gap: a door closes onto the wall FACE, not
  //              into the reveal, so it can overlap 0.02 at each jamb. A leaf
  //              narrower than its hole cannot be shut, only nearly shut
  //   FLAT_LEAF_H  0.05 over the head, and a 0.03 undercut at the floor kept,
  //              because a door that seals to the boards was never fitted
  const DOOR_HEAD = 2.1;
  const FLAT_LEAF_W = DOOR_GAP + 0.04, FLAT_LEAF_H = 2.12;
  // 1.2 -> 0.9: the user, on the top floor, *"top floor of apt railing is too
  // far out. scope it back here"*. The nib was built to the HEADROOM limit
  // rather than to how much landing anyone needs, and at 1.2 the balustrade
  // stands most of a body-length past the hall's edge, which is what reads as
  // "far out". 0.9 still leaves the player (0.36 m radius) half a metre of
  // landing past the hall line to stand on, and going SHALLOWER can never
  // cost headroom over flight A below — only deepening it can.
  const NIB_D = 0.9;              // how far the landing reaches into the shaft
  const NIB_Z1 = STAIR_Z0 + NIB_D; // its open edge: the railing stands here
  const TOP_Y = 3 * ST;           // floor 3
  const AX = (lx: number) => APT_X + lx, AZI = (lz: number) => APT_Z + lz;
  // ── 301'S DOOR STAND-POINT IS NOT HOISTED ANY MORE (item 309) ───────────
  //
  // Item 308 lifted it to here as `D301_STAND` so the BED'S APPROACH could be
  // derived from it. **Both of those moves are undone**: the user, after seeing
  // 308, asked for the door back — *"i liked it how it was before i just want
  // the calendar back to the right tho"* — and the pre-308 bed approach was
  // never derived from the door in the first place, so with the door restored
  // there is nothing left up here to share. It lives in the door block again,
  // written off `DOOR_PIV_X`/`DOOR_PIV_Z`, which is where those numbers are.
  //
  // Do not re-hoist it to "fix" the calendar. That was tried, it worked, and it
  // is not what he wanted; what makes the two coexist now is `fp.ts`'s `ON_IT`
  // being smaller, not this point being elsewhere.
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
  // eight flats, four landings, two per landing, and the two on floor index 2
  // — the third storey, 301 and 302 — the ones that SWING.
  //
  // That last clause used to read "hung as real openings rather than drawn as
  // panels", which conflated two different things and is why six doors stayed
  // flat for so long. Every door is a real opening now; `hung` only means the
  // leaf moves. A door you cannot open still has a hole cut for it.
  //
  // Same argument as F's entry-spot descriptors, which is the precedent the
  // desk named: derive from the declaration and nothing hand-typed can drift
  // out of step when a landing moves.
  type WalkupDoor = {
    num: string; floor: number;
    x: number; z: number; ry: number; wallN: number;
    hinge: number;      // +1 hinges toward +z, -1 toward -z
    face: number;       // which way it opens into the hall: +1 is +x
    hung: boolean;      // the leaf SWINGS (301, 302). Every door is a real
                        // opening; this is only about whether it moves.
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
        // `x` is the door's HALL-SIDE reference — where a parcel gets left and
        // where the [E] spot sits. It stays on the hall face; only the leaf
        // moved back into the reveal. (`packages` at the foot of this file
        // measures off it: move this and the parcels go inside the wall.)
        x: west ? AX(0.085) : AX(2.315),
        z: AZI(3.5),
        ry: west ? Math.PI / 2 : -Math.PI / 2,
        // the wall's TRUE centreline. It used to be 5 mm off it, a fudge whose
        // only job was to keep the architrave clear of a leaf laid on the wall
        // face; with the opening actually cut there is nothing to clear, and
        // being honest here is what lets the flat doors share 301's casing.
        wallN: west ? AX(0) : AX(2.4),
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
  /** ITEM 260 — the moving members of `sevColliders`, by identity. See the
   *  `actorColliders` doc on the `Apartment` interface for why this exists and
   *  what it cost when it did not. Anything pushed here MUST also be in
   *  `sevColliders`; it is a marker set, not a second population. */
  const sevActors: AABB[] = [];
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
    // hall + stairwell shell. Both walls run full height either side of the
    // door column; the column itself is cut floor by floor, just below.
    wallMesh(3.025, H, AX(0), H / 2, AZI(1.5125), Math.PI / 2);
    wallMesh(9.225, H, AX(0), H / 2, AZI(8.5875), Math.PI / 2);
    wallMesh(3.025, H, AX(2.4), H / 2, AZI(1.5125), -Math.PI / 2);
    wallMesh(9.225, H, AX(2.4), H / 2, AZI(8.5875), -Math.PI / 2);
    // ── THE DOOR COLUMN, PIERCED ONCE PER FLOOR ──────────────────────────
    // This used to be two pieces per wall — one solid slab from the ground to
    // 2*ST and one from 2*ST+2.1 to the roof — which cut a hole on floor 3
    // and left floors 1, 2 and 4 solid behind their door leaves. That single
    // fact is the whole of *"doors in apt are flush ... except my floor"*.
    //
    // Now the only masonry in the column is the SPANDREL over each head, and
    // it is derived from the storey rather than typed per floor: a doorway
    // runs from its own floor to DOOR_HEAD, and the wall picks up again there
    // and carries to the slab above (or, on the top floor, to the roof). Add
    // a storey and it cuts itself.
    //
    // vOff is what keeps the paper lining up across a hole (see wallMesh):
    // each spandrel is told how far up the wall it sits, or it restarts the
    // tile at its own bottom edge and the pattern jumps at every lintel. The
    // old top piece passed 0 from a base of 7.5 and was misaligned by 0.78 of
    // a tile — nobody had looked, because there was only ever one of them.
    const WALLS: [number, number][] = [[AX(0), Math.PI / 2], [AX(2.4), -Math.PI / 2]];
    for (let f = 0; f < 4; f++) {
      const yb = f * ST + DOOR_HEAD;               // underside of this floor's lintel
      const yt = f < 3 ? (f + 1) * ST : H;         // the slab above, or the roof
      for (const [wx, ry] of WALLS) {
        wallMesh(DOOR_GAP, yt - yb, wx, (yb + yt) / 2, AZI(3.5), ry, wallpaperT, 0, yb);
      }
    }
    wallMesh(2.4, H, AX(1.2), H / 2, AZI(0), 0);
    wallMesh(2.4, H, AX(1.2), H / 2, AZI(13.2), Math.PI);
    // architrave round both flat doorways, on both faces of each — on every
    // floor now, for the same reason the opening is
    const DOOR_Z0 = AZI(3.5 - DOOR_GAP / 2), DOOR_Z1 = AZI(3.5 + DOOR_GAP / 2);
    for (let f = 0; f < 4; f++) {
      for (const [wx] of WALLS) casing(wx, DOOR_Z0, DOOR_Z1, f * ST, f * ST + DOOR_HEAD);
    }
    // ── WHAT HOLDS THE SEVEN UNMODELLED FLATS SHUT — READ THIS BEFORE ────────
    //    TIDYING ANY COLLIDER BELOW.
    //
    // Eight flats have doorways off this shaft. **One of them is modelled** —
    // 301, the player's — and the other seven are painted doors with nothing
    // behind them. So the two wall lines are treated DIFFERENTLY on purpose,
    // and the asymmetry is the whole design:
    //
    //   WEST, AX(0)   301 is enterable, so the wall collider is SPLIT into two
    //                 pieces around the doorway and there is a real hole. The
    //                 other three floors' doors (101, 201, 401) are shut by
    //                 `aptDoorCap`, which `updateCaps` moves into the gap on
    //                 every storey except 301's. It MOVES because which floor
    //                 you are on is the thing that decides.
    //   EAST, AX(2.4) nobody enters 102, 202, 302 or 402 on ANY floor, so the
    //                 wall collider is a SINGLE UNSPLIT RUN over the full
    //                 AZI(0)…AZI(13.2). There is nothing to gate, so nothing
    //                 moves. **That run is what holds all four east doorways
    //                 shut, and it is deliberate.**
    //
    // ⚠ THE PLUG AT AX(2.25)…AX(2.40) IS NOT WHAT HOLDS THEM SHUT, and item 183
    // was filed believing it was: *"that collider is the only thing stopping the
    // player walking into those flats."* **It is not, and it never was.**
    // Walked on all four floors, twice, `probes/w101-flatdoor-plug.mjs`:
    //
    //     with the plug      stopped at local x 1.87  on 4 of 4 floors
    //     with it removed    stopped at local x 2.04  on 4 of 4 floors
    //
    // 2.04 is exactly the wall's inner face at 2.40 less the rig's 0.36 m
    // radius. **The player never reaches the opening either way**; deleting the
    // plug opens nothing and moves you 0.17 m. The row's worry was real — a
    // stray-looking collider doing load-bearing work is a genuine trap — it was
    // just pointed at the wrong box. The load-bearing one is the unsplit east
    // wall two lines up, and THAT is the line not to tidy.
    //
    // ⚠ AND DO NOT GIVE ANY OF THESE A `maxY`. They are unbounded in y on
    // purpose, which is how one box serves all four storeys. `fp.ts`'s
    // `standTop` treats **any collider carrying a `maxY` as a standable
    // surface**, so bounding these per-floor would let the player stand on a
    // door head at 2.1 m and walk the building at lintel height.
    sevColliders.push(
      { minX: AX(-0.15), maxX: AX(0), minZ: AZI(0), maxZ: AZI(3.5 - DOOR_GAP / 2) },
      { minX: AX(-0.15), maxX: AX(0), minZ: AZI(3.5 + DOOR_GAP / 2), maxZ: AZI(13.2) },
      // THE ONE THAT MATTERS: unsplit across the whole east run, because no
      // east flat is enterable on any floor. Splitting it "to match the west
      // wall" opens four doorways into nothing.
      { minX: AX(2.4), maxX: AX(2.55), minZ: AZI(0), maxZ: AZI(13.2) },
      { minX: AX(0), maxX: AX(2.4), minZ: AZI(-0.15), maxZ: AZI(0) },
      { minX: AX(0), maxX: AX(2.4), minZ: AZI(13.2), maxZ: AZI(13.35) },
      { minX: AX(1.04), maxX: AX(1.36), minZ: AZI(STAIR_Z0), maxZ: AZI(STAIR_Z1) }, // core wall + the handrails on both its faces
      // THE REVEAL PLUG — justified in place, and it is NOT structural (above).
      // The east doorways are cut 0.15 m deep into the wall and the hermit
      // stands in the 302 one. Without this you can walk INTO that reveal and
      // stand in a doorway you can never pass, shoulder to shoulder with him;
      // `hermitCap` only makes him solid while he is home, so on his way out it
      // is this that keeps the doorway his. Derived from the same `DOOR_GAP`
      // the opening is cut from, so it cannot drift from the hole it fills.
      { minX: AX(2.25), maxX: AX(2.4), minZ: AZI(3.5 - DOOR_GAP / 2), maxZ: AZI(3.5 + DOOR_GAP / 2) },
      stairCap, underStairA, underStairB, aptDoorCap, hermitCap, doorShutCap,
    );
    // ITEM 260: `hermitCap` MOVES — parked at (999, 999) while he is out, at
    // his own doorway from hour 17, and drifting x 202.26 → 202.04 through the
    // evening. It has been in `colliders` since the hermit shipped and in the
    // static list the whole time. The other five caps in that spread are
    // switched on and off but never relocated, so they stay geometry.
    sevActors.push(hermitCap);
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
    // ── THE SLAB EDGE AT THE STAIRWELL MOUTH ─────────────────────────────
    // The user: *"graphics bugs underl top floor railing"* — a band of the red
    // stair carpet showing THROUGH the plaster ceiling, ragged along both
    // edges, shot from the floor below.
    //
    // NOT the railing, and NOT item 310d's NIB_D pull-back — I checked mine
    // first and it is innocent. The edge this happens at is AZI(8.4), the
    // stairwell mouth, and no NIB number touches it; the nib is a BOX, its
    // sides are closed, and it starts at 8.4 whether it is 1.2 deep or 0.9.
    //
    // THE REAL CAUSE IS THAT A STOREY HAS NO SLAB. Every floor is two
    // zero-thickness planes — hall carpet at `f*ST + 0.006`, hall ceiling at
    // `f*ST + 2.55` — and BOTH stop dead at the mouth. Between them is 0.156 m
    // of void that is open along that whole edge. Stand near the mouth and look
    // steeply up and a thin cone of rays slips PAST the ceiling's edge and
    // lands on the UNDERSIDE of the carpet above: red, framed by plaster, and
    // aliased along its silhouette because it is a grazing sliver. It is not
    // z-fighting, and it has been there since the storeys were built — the
    // ceiling under the top landing is simply the first place anyone looked up.
    //
    // A slab has an edge, so give it one: the same timber fascia the nib
    // already wears on its open sides, run the full 2.4 m width of the mouth,
    // at EVERY storey rather than at the one he happened to photograph. It
    // meets the nib's own -z face in the same material, so the two read as one
    // board. Purely visual, 2.55 m up — no collider, nothing to walk into.
    for (let f = 0; f < 3; f++) {
      const yb = f * ST + 2.55, yt = (f + 1) * ST + 0.006;
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(2.4, yt - yb, 0.04), darkWoodM);
      fascia.position.set(AX(1.2), (yb + yt) / 2, AZI(8.4));
      scene.add(fascia);
    }
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
    /** A flat's front door, HUNG IN ITS OPENING rather than laid on the wall.
     *
     *  It used to be a plane at the door's hall-side x — 10 mm proud of the
     *  plaster — with its own architrave a few mm prouder still, on a wall
     *  that was not pierced at all except on floor 3. That is the whole of the
     *  user's *"flush with wall on every floor except my floor"*.
     *
     *  Where the leaf goes is now DERIVED from the wall it hangs on, and the
     *  derivation is the one 301 wrote down for itself below: a door closes
     *  onto the room-side FACE, half a wall thickness to the far side of the
     *  centreline, plus the leaf's own clearance off the plaster. On this
     *  building's numbers that lands on AX(-0.09) — the exact x 301's pivot was
     *  tuned to by hand and by eye. Two independent routes to one number is
     *  the best evidence available that this is the right rule, so it is
     *  written as the rule and 301 now reads it too (BUILDER-BRIEF §8).
     *
     *  The architrave is NOT drawn here any more: the shell casings every
     *  opening on every floor, so all eight doors get the identical trim
     *  instead of six sharing one width and two sharing another. */
    const doorPlane = (d: WalkupDoor) => {
      const baseY = d.floor * ST;
      const lx = d.wallN - d.face * (WALL_T / 2 + 0.02);
      // Behind a shut door on a floor that has no modelled flat there is
      // nothing at all, and the leaf's 0.03 undercut at the boards is a real
      // line of sight to it. Pure black behind a hard edge reads as a hole cut
      // in the world — the same thing 302's recess was built to stop — so the
      // dim is a surface, sitting just behind the leaf.
      const back = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR_GAP + 0.12, DOOR_HEAD + 0.1), dimRoomM);
      back.position.set(lx - d.face * 0.04, baseY + (DOOR_HEAD + 0.1) / 2 - 0.05, d.z);
      back.rotation.y = d.ry;
      scene.add(back);
      // AND THE RECESS NEEDS A FLOOR, which the back panel alone is not.
      // The undercut is a 0.03 slot at the boards, and an eye at hall distance
      // looking down through it leaves the building: from 1.05 m back the ray
      // crosses the panel's plane at y = -0.19, and the panel stops at -0.05.
      // It showed as a pale blue-grey line under all six doors — sampled at
      // #8a97a2, which is daylight, seen through a shut front door. A slot you
      // can see through is not closed by making the thing behind it darker.
      const sill = new THREE.Mesh(
        new THREE.PlaneGeometry(WALL_T + 0.14, DOOR_GAP + 0.12), dimRoomM);
      sill.rotation.x = -Math.PI / 2;
      // just UNDER the hall carpet (baseY + 0.006), so the carpet still wins
      // where there is carpet and this only shows inside the reveal
      sill.position.set(d.wallN - d.face * 0.03, baseY + 0.002, d.z);
      scene.add(sill);
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(FLAT_LEAF_W, FLAT_LEAF_H),
        texM(doorTexN(d.num, false)));
      // 0.03 off the boards and 0.05 over the head, same as 301's
      leaf.position.set(lx, baseY + 0.03 + FLAT_LEAF_H / 2, d.z);
      leaf.rotation.y = d.ry;
      scene.add(leaf);
      // A knob is a rose, a stem and a ball. The rose is what actually reads
      // at hall distance — a knob with no backplate looks stuck on. Its offset
      // comes off FLAT_LEAF_W, so it stays 0.13 in from the strike edge the way
      // 301's does rather than from the old painted plane's half-width.
      const nx = Math.sin(d.ry) < 0 ? -1 : 1;              // which way the door faces
      const off = -d.hinge * (FLAT_LEAF_W / 2 - 0.13);          // knob opposite the hinge
      doorKnob(scene, lx, baseY + 1.02, d.z + off, nx, 'x');
    };
    // Built from DOORS rather than from a second copy of the same arithmetic.
    // The desk, on the packages that hang off this: *"the walk-up needs to know
    // how many doors it has — if that is currently hardcoded per floor, derive
    // it."* It was: this loop knew, and nothing else did.
    // (Drawn further down, once the dim recess material exists.)
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
    // the six flats nobody has modelled — hung now, in real openings. Drawn
    // here rather than at their declaration because a shut door needs
    // something dim behind it, and that is the material above.
    for (const d of DOORS) if (!d.hung) doorPlane(d);
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
      // ── ITEM 304: THIS LEAF HAS NO COLLIDER OF ITS OWN, AND IT DOES NOT ──
      // ── NEED ONE. Do not add one; measure first, the way this was. ──────
      //
      // The row: *"NOTHING STOPS YOU AT THE HERMIT'S DOORWAY — 302's door leaf
      // has NO COLLIDER IN EITHER POSE."* The first half of that is true and
      // the second half is the part that matters, and they point opposite ways.
      // Measured on the built bundle, `scripts/probes/w304-hermit-doorway-walk.mjs`:
      //
      //   pose   leaf covered   walked east to   the leaf is at
      //   shut     41/41          local x 1.875    2.520          (the plug stops you)
      //   open      2/41          local x 1.655    2.520 … 3.395  (the hermit stops you)
      //   open      2/41          local x 2.040    2.520 … 3.395  (plug parked, hermit home:
      //                                                            the EAST WALL stops you)
      //
      // 2.040 is the hard ceiling — the unsplit east wall run at AX(2.40)…AX(2.55)
      // is a plain static push, the same in every pose and on every floor, and
      // 2.40 less the rig's 0.360 m radius is 2.040. It reproduces the figure
      // `w101-flatdoor-plug.mjs` measured for the same wall. **The open leaf's
      // nearest point is 0.480 m further east than the player can ever stand.**
      // UNCOVERED AND UNREACHABLE ARE DIFFERENT THINGS, and 302 is the second.
      //
      // AND IT IS NOT A LEAF THAT HANGS PERMANENTLY OPEN — that was the other
      // candidate fix ("register the jamb instead"). It starts SHUT (`d302A =
      // D302_SHUT`) and swings only while the hermit is out, because the user
      // asked for exactly that: *"neighbors door should be closed when neightbor
      // is not out"*. So the jamb is not the right registration on grounds of
      // permanence — it is the right one because **302 IS NOT AN ENTERABLE
      // FLAT.** The jamb is already registered, and has been all along: it is
      // the unsplit east wall, the run this file's collider block calls out as
      // "what holds all four east doorways shut, and it is deliberate".
      //
      // A collider swinging with this leaf would be a box in a 1.2 m recess the
      // player cannot enter — 0.48 m behind a wall — which is precisely the
      // stray-looking-box-doing-nothing that item 183 was mis-filed about two
      // hundred lines up. It buys nothing and it is one more thing to drift.
      //
      // WHAT THE FLAG BELOW DOES BUY, honestly stated: in the pose the world
      // loads in the leaf is 41/41 covered, and registering it makes
      // `scripts/solid-leaf-vs-collider.mjs` re-measure that every run. It
      // catches the shut leaf drifting OUT of the AX(2.40)…AX(2.55) band —
      // watched red by hand at x0 + 0.35, which took it to 0/41 and a 0.933 m
      // uncovered run. It does NOT catch a drift in z, because the wall run is
      // unsplit across AZI(0)…AZI(13.2) and covers every z equally, and it says
      // nothing at all about the open pose. That is the gap; it is declared
      // rather than papered over, and the walk probe above is what covers it.
      leaf.userData.solidLeaf = 'apt-302-hermit';
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
      // Hoisted to the top of the module (FLAT_LEAF_W) so the other seven doors are
      // held to it too — this block is where the rule was worked out, and it
      // stayed private here while six doors went on being flat panels.
      const LW = FLAT_LEAF_W;                         // 0.99 m leaf over a 0.95 m gap
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
      // a door that has never been fitted to a real one. (Hoisted with FLAT_LEAF_W,
      // and for the same reason.)
      const g301 = new THREE.BoxGeometry(LW, FLAT_LEAF_H, 0.045);
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
      // …and REGISTERED SOLID, which is a different claim from being named
      // (item 303). The open-leaf collider below is typed in the units of a
      // ROOM, 2,500 lines from here, so the mesh can move and the box stay put
      // — which is exactly what happened when this hinge went to the +z jamb.
      // `scripts/solid-leaf-vs-collider.mjs` samples every leaf carrying this
      // flag along its own body and requires the player to be stopped at each
      // point; nothing else in the world ties these two edits together.
      leaf301.userData.solidLeaf = 'apt-301-front';
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
      // ── THE ROOM-SIDE STAND-POINT, BACK IN ITS CORNER (item 309) ─────────
      //
      // (199.36, -17.455): 1.55 m from its own pivot, clear of the leaf's 166°
      // sweep, and only 0.46 m off the SOUTH wall. Item 308 moved it into the
      // doorway at (199.15, -16.12) to free that wall for the calendar; the
      // user then said *"i liked it how it was before i just want the calendar
      // back to the right tho. with the radius for all these things a bit
      // less"*, which is this line back as it was plus a smaller `ON_IT`.
      //
      // WHY IT CANNOT SIMPLY SLIDE ALONG THE WALL, since that is the obvious
      // move and it has been ruled out twice: the leaf pivots at
      // (199.91, -16.005) and sweeps 166° of a 0.99 m disc INTO the room, so
      // every point directly in front of the opening is inside the arc, and
      // -17.455 is the nearest floor clear of it. A door you can only reach by
      // standing inside its own swing is a door you can never shut.
      //
      // ⚠ AND IT STILL OWNS A DISC OF THE CALENDAR'S WALL. `fp.ts` tier 1 takes
      // a spot whose centre is inside `ON_IT` with no aim test and no regard
      // for rank, so a `ON_IT`-radius disc about this point is floor on which
      // the calendar cannot be read. That is not a bug and it is not fixable
      // from here — it is the price of the corner, the user has chosen to pay
      // it, and what item 309 did instead was make the disc smaller everywhere
      // (0.36 -> 0.288). The calendar's reading spot is derived from THIS point
      // and that radius; see it, ~2,400 lines below.
      const ROOM_STAND_X = DOOR_PIV_X - 0.55, ROOM_STAND_Z = DOOR_PIV_Z - H301 * 1.45;
      // A WAY OUT, on both sides (item 291) — *"just make the door high rank
      // pls."* `WAY_OUT` is declared on the pair, not on one of them, for the
      // same reason their ok/label/act are shared: a door is one piece of state
      // with two thresholds.
      ctx.spot({ x: ROOM_STAND_X, z: ROOM_STAND_Z, r: 0.95, rank: WAY_OUT, ok: doorOk, label: doorLabel, act: doorAct });
      // AND ITS MIRROR, on the hall side. Reflected about the wall's own
      // centreline (AX(0)) rather than a second hand-typed x, so the two
      // stand-points keep the same 0.57 m offset off their own wall face by
      // construction: the room spot sits 199.93 (the wall's room-side face,
      // AX(-0.07)) minus 0.57; this one sits 200.07 (the hall-side face,
      // AX(0.07)) plus 0.57. Neither the shut collider (199.84-200.06) nor
      // the wall itself falls inside either circle, so both are reachable
      // whichever side of a shut door you are standing on.
      //
      // (Item 308 broke the mirror, because its room-side point had moved into
      // the doorway and reflecting THAT would have shoved the landing spot past
      // the hermit. The room side is back in its corner, so the mirror holds
      // again and the hall side is once more one number rather than two —
      // item 309.)
      const HALL_STAND_X = 2 * AX(0) - ROOM_STAND_X;
      ctx.spot({ x: HALL_STAND_X, z: ROOM_STAND_Z, r: 0.95, rank: WAY_OUT, ok: doorOk, label: doorLabel, act: doorAct });
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
      // ── THE HALO MUST NOT REACH THE SLAB IT HANGS UNDER ─────────────────
      // The user: *"sometimes the lights in the apt bleed into the floor
      // above, make sure this doesnt happen"* — a bright rectangular patch
      // lying on a wooden floor.
      //
      // NOT additive blending, and not `depthWrite: false`. Those are honest:
      // the quad is still depth-TESTED, so from below the ceiling occludes it
      // correctly. The bug is that **the quad is genuinely sticking through the
      // floor**, and nothing occludes geometry that is on your side of it.
      //
      // `boards` billboards are YAW-ONLY (crosstown.ts: `rotation.y = atan2`),
      // so this quad is VERTICAL in every frame — its full `halo` height is
      // always vertical extent. Centred at `ceilY - 0.12` with halo 0.6 it ran
      // from ceilY-0.42 to **ceilY+0.18**: 0.18 m ABOVE the ceiling it hangs
      // from. The slabs are thinner than that everywhere:
      //
      //   hall lamps        floor above at ceilY+0.156   pokes 0.024
      //   half-landing      landing top  at ceilY+0.14   pokes 0.05  <- his shot
      //   301's own lamp    floor above at ceilY+0.156   clears by 0.001
      //   the two at H      nothing above at all         invisible
      //
      // So no fixture was ever SAFE BY DESIGN — two were safe because there is
      // no storey above them and one clears by a millimetre. That is the finding.
      // "Sometimes" is just which of them you happen to walk over.
      //
      // Cap the top edge at `ceilY` and leave the BOTTOM edge exactly where it
      // was. `ceilY` is by construction the underside of whatever is overhead
      // — a ceiling plane for the halls and 301, the landing box's own soffit
      // for the half landings — so one cap covers every fixture in the walk-up
      // and the flat, including any added later. Nothing visible from below
      // moves: the 0.18 m that got clipped was already inside the slab.
      const glTop = ceilY - 0.01, glBot = ceilY - 0.12 - halo / 2;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(halo, glTop - glBot), glowMat);
      gl.position.set(wx, (glTop + glBot) / 2, wz);
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
      // the same constant the flat's own walls, skins and ceiling are drawn
      // from a few lines above — not a second copy of 2.55 (BUILDER-BRIEF §8).
      h: R301_H,
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
    //
    // ── SECOND REPORT, AND IT WAS NEVER THE CORNERS ──────────────────────
    // Erick, 2026-08-04: *"there are textures which flicker on the top and
    // right inside of the window, can you look into that?"* The fix above is
    // real and stays. It solved the four CORNERS. The band he is seeing runs
    // the whole length of a return, and the pair fighting is not two reveal
    // pieces — it is each reveal piece against THE WALL'S OWN CUT FACE.
    //
    // The hole is cut by the four `wallMesh` pieces up at R301's west wall.
    // Their cut faces are the box's side faces, which `wallMesh` paints in
    // `jambM`. Those faces land exactly where the reveal's visible faces do:
    //
    //     wall x span        -3.270 .. -3.130   (WALL_T about WIN_LX)
    //     reveal x span      -3.262 .. -3.152   entirely INSIDE it
    //     wall cut face z     4.400              opening edge, normal -z
    //     jamb visible face   4.400              same plane, same normal
    //
    // So the reveal box was buried in the wall solid with only its inner face
    // showing, and that face was coplanar with the cut face over the returns'
    // full height. Same arithmetic at the head in y. The two colours are
    // jambM (139,130,113) and revM (139,132,116) — three levels apart, which
    // is why it reads as a fine cross-hatch of one tan rather than as two
    // surfaces, and why it took a second report to place.
    //
    // A LINING GOES INSIDE THE HOLE, which is all this change is. Each piece
    // moves in by its own 2 cm thickness, so its visible face stands 2 cm
    // proud of the cut face and its BACK face is the one now sharing that
    // plane — back-facing from the opening, so it culls and never contests.
    // The head and sill lose 0.04 of span and the jambs lose 0.04 of height
    // to keep them butting exactly as above, sharing no volume.
    //
    // All four returns had it, not just the two he could see from where he
    // stood; the opening reads 4 cm narrower and the lining now covers the
    // glass edge, which is what a real reveal does anyway.
    box(REV_D, 0.02, WIN_W - 0.04, RX, WIN_Y + WIN_H / 2 - 0.01, WIN_LZ, revDark); // head, in shadow
    box(REV_D, 0.02, WIN_W - 0.04, RX, WIN_Y - WIN_H / 2 + 0.01, WIN_LZ, revM);    // the reveal's own sill
    for (const sgn of [1, -1]) {
      box(REV_D, WIN_H - 0.04, 0.02, RX, WIN_Y, WIN_LZ + sgn * (WIN_W / 2 - 0.01),
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
    // ── the mug, at the other end ────────────────────────────────────────
    // The user, twice: *"mug looks messed up"*, then a close-up and *"the mug
    // is messed up."* Measured from the room's own SPAWN before touching it
    // (`scripts/probes/w60-mug-geometry.mjs`), the mug covers 20 x 25 px —
    // enough for a handle to read — and three things were wrong with it:
    //
    //  1. THE HANDLE WAS TURNED 90° FROM ANY ORIENTATION A HANDLE CAN HAVE.
    //     The ring's hole axis pointed along +x and it was ALSO offset along
    //     +x, so the loop's plane was perpendicular to the direction it stuck
    //     out (measured: |hole axis · offset| = 1.0000, where a real handle is
    //     0). That is a hoop parked beside the cup, not a handle joined to it,
    //     and it did not even touch: 9 mm of air between cup wall and ring.
    //     The ROTATION is fine and stays; it was the OFFSET that had to move.
    //  2. Body and handle shared one material, so nothing separated them.
    //  3. Seen from the doorway the cup's flat top read as a solid peg. In an
    //     unlit world every face of a cylinder is the same colour, so segment
    //     count buys nothing here — only tone and silhouette do.
    //
    // So the handle now hangs off the +z side, ACROSS the player's sightline
    // (he comes at the window ~15° off the -x axis), where it is silhouetted
    // against the dark glass of the light well and its hole shows daylight
    // instead of more cup. Turned along the sill rather than into the room:
    // that is also how a mug ends up when somebody puts it down without
    // thinking, which is the story this sill is telling.
    const mugM = new THREE.MeshBasicMaterial({ color: 0xd8d2c4 });
    const MUG_X = SILL_X, MUG_Z = WIN_LZ - 0.55, MUG_R = 0.038, MUG_H = 0.095;
    // ── THE MUG'S MOUTH: A BORE, NOT A DISC. FOUR PASSES, THEN THE CAUSE ─────
    //
    // The user, item 274: *"mug should be empty."* Then, in order:
    //
    //     0x4a3524  brown          -> "should be empty"      (read as coffee)
    //     0x6d6e6f  grey           -> "doesn't match"        (wrong hue)
    //     0x6c6962  body x0.50     -> "identical to before"  (invisible move)
    //     0x8c897f  body x0.65     -> "still not right"
    //
    // FOUR TONES ON ONE FLAT DISC, ALL WRONG, AND THE FIFTH WOULD HAVE BEEN
    // WRONG TOO. Every one of those was a value/hue argument about a **circle
    // sitting at the rim plane, 1 mm PROUD of a solid top cap** — which is not
    // an opening, it is a LID. That geometry has exactly two failure modes and
    // no success:
    //
    //     dark  -> a full-diameter dark ellipse in a cream cup = liquid
    //     light -> the top vanishes into the body = item 108's "peg"
    //
    // A hole is not read from tone. It is read from DEPTH, and depth in an
    // unlit world comes from the one thing this mug never had: **more than one
    // interior surface.** Look into a real empty mug from the 22° he plays at
    // and you see three tones, not one — the rim ring, a crescent of the far
    // INNER WALL catching light, and a small darker floor sitting low and near
    // inside that crescent. The offset between the crescent and the floor IS
    // the depth cue. One flat disc cannot produce it at any colour.
    //
    // Measured against his own screenshot (13-46-40, gameplay distance): the
    // mouth is roughly 30 x 12 px, ~360 px of ellipse. That is comfortably
    // enough for a 4 px crescent over a 6 px floor, so this is not detail
    // spent below the resolution he sees — it is the first thing he sees.
    //
    // So the cup is BORED OUT. Four parts, all opaque, no transparency and no
    // sort order to get wrong:
    //
    //   1. the outer skin, now `openEnded` — the solid cap that made a lid
    //      impossible to avoid is gone. Its bottom opens too; it stands on the
    //      sill, so that face was never rendered
    //   2. the RIM, a real annulus of ceramic thickness. It used to be the 6 mm
    //      of top cap left showing round a 0.032 disc, which is why the rim
    //      read as a coincidence rather than as the edge of a wall
    //   3. the BORE, `BackSide` so it draws the FAR half of the tube seen from
    //      within — precisely the crescent. Ceramic in bounced light, body
    //      x0.82 = (177, 172, 161): the inside of a cup is not in shadow, it is
    //      the brightest thing after the rim
    //   4. the FLOOR, at the BOTTOM of a visible shaft instead of 64 mm across
    //      at the top, so it reads as the bottom of an empty mug rather than
    //      as a pour. Its depth and its colour are item 310i, just below.
    //
    // He confirmed the shape of it — *"inside of the mug looks better"* — so
    // none of the above moves again. Two defects on top of it, both real:
    //
    // ── 310i(a): YOU COULD NOT SEE THE BOTTOM. IT WAS 85 mm DOWN A 64 mm HOLE
    //
    // *"it needs a bottom. the bottom can be tinted brown like coffee or
    // something."*
    //
    // The floor was NOT missing, not mis-wound, not culled and not the wrong
    // diameter — it rendered, faced up, and was exactly the bore's own bottom
    // radius. It was BEHIND THE NEAR RIM. The bore ran the full 85 mm from rim
    // to base in a cup only 64 mm across, so the shallowest sightline that
    // clears the near rim and still lands on the floor is atan(85/64) = **53
    // degrees**. This file's own measurement of how he looks at this sill is
    // 22-49 degrees. At every angle he plays at, the ray cleared the rim,
    // crossed the cavity and struck the FAR WALL 21 mm above the floor —
    // a bottomless shaft, which is exactly what he reported.
    //
    // So it is depth first and colour second. MUG_BASE 0.010 -> 0.060 leaves a
    // 35 mm bore, in view from atan(35/64) = 29 degrees: most of his range, and
    // far inside the close-up pitch he shot this from. It still leaves a 35 mm
    // crescent of wall above the floor in a 64 mm mouth, so the depth cue the
    // bore-out exists for is untouched. The base is thicker than a real mug's
    // and that costs nothing: the only sightline into this cup is from above,
    // and from there it is the difference between a cup and a pipe.
    //
    // The colour is HIS suggestion, taken as offered. 0x6b5138 = (107, 81, 56),
    // R over B at +51 — brown past arguing — and 26 levels lighter than item
    // 274's coffee 0x4a3524, so it reads as a SURFACE and not as a hole. This
    // is the one thing a disc at the rim could never be: a small brown floor at
    // the bottom of a plainly empty shaft is a dreg or a stain, not a full cup,
    // because the bare ceramic above it says so.
    //
    // The profile is a FUNCTION now, not three typed radii. The cup tapers
    // 0.038 -> 0.034, so the bore's bottom radius and the floor's radius both
    // depend on where the base sits; typed separately they would have left a
    // gap ring the moment MUG_BASE moved, which is precisely the change this
    // item makes. Both read `mugBoreR`, so they cannot disagree.
    const MUG_WALL = 0.005, MUG_BASE = 0.060, MUG_RB = 0.034;
    const mugOuterR = (ly: number) => MUG_RB + (ly / MUG_H) * (MUG_R - MUG_RB);
    const mugBoreR = (ly: number) => mugOuterR(ly) - MUG_WALL;
    const MUG_IR = mugBoreR(MUG_H);                  // bore radius at the rim
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(MUG_R, MUG_RB, MUG_H, 12, 1, true), mugM);
    mug.position.set(AX(MUG_X), SILL_TOP + MUG_H / 2, AZI(MUG_Z));
    scene.add(mug);
    const rim = new THREE.Mesh(new THREE.RingGeometry(MUG_IR, MUG_R, 12),
      new THREE.MeshBasicMaterial({ color: 0xd8d2c4, side: THREE.DoubleSide }));
    rim.position.set(AX(MUG_X), SILL_TOP + MUG_H, AZI(MUG_Z));
    rim.rotation.x = -Math.PI / 2;
    scene.add(rim);
    // DoubleSide, not BackSide. BackSide draws the far half of the tube, which
    // is the crescent and all you can ever LOOK at through the mouth — but it
    // leaves the near half undrawn, and an undrawn wall cannot hide what is
    // buried in the ceramic behind it. That is half of the handle bug below.
    // The near half is occluded by the outer skin from every outside angle and
    // is never hit by a ray coming in through the mouth, so drawing it changes
    // nothing you can see and closes the cavity properly.
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(MUG_IR, mugBoreR(MUG_BASE), MUG_H - MUG_BASE, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xb1aca1, side: THREE.DoubleSide }));
    bore.position.set(AX(MUG_X), SILL_TOP + MUG_BASE + (MUG_H - MUG_BASE) / 2, AZI(MUG_Z));
    scene.add(bore);
    const mugFloor = new THREE.Mesh(new THREE.CircleGeometry(mugBoreR(MUG_BASE), 12),
      new THREE.MeshBasicMaterial({ color: 0x6b5138 }));
    mugFloor.position.set(AX(MUG_X), SILL_TOP + MUG_BASE, AZI(MUG_Z));
    mugFloor.rotation.x = -Math.PI / 2;
    scene.add(mugFloor);
    // ── THE HANDLE, THIRD REPORT: IT WAS PAINTED IN ITS OWN BACKGROUND ───────
    //
    // The user, three times: *"mug looks messed up"*, *"the mug is messed up"*,
    // then *"mug handle still looks off, please try."* Item 108 fixed the
    // GEOMETRY and fixed it correctly — the offset/hole-axis bug above is real
    // and stays fixed. It then chose the handle's colour by reasoning about
    // which surface would be BEHIND it, and got that one thing wrong:
    //
    //   *"It is close to the sill's 0xa8a091, which would matter if the handle
    //    were ever seen against the sill; it is not, because it hangs 27-84 mm
    //    above it with the window behind."*
    //
    // IT IS SEEN AGAINST THE SILL, because he does not look at it level — he
    // stands at the window and looks DOWN at the sill at close range, at a
    // pitch of 22-49 degrees. From there the sightline past the handle, and
    // THROUGH ITS HOLE, lands on the sill top, not on the dark glass.
    //
    // MEASURED, in the rendered pixels of his own view rather than argued:
    // in the crop of the at-sill frame the sill #a8a091 is the single most
    // common colour at 6,921 px, and the handle's 176 px of #a79f8f differ from
    // it by (1, 1, 2) OUT OF 255. The world is unlit MeshBasicMaterial, so
    // material colour IS rendered colour and there is nothing else to save it.
    // A 176-pixel object drawn in its background's colour is not a handle; the
    // shape was right and simply could not be seen.
    //
    // So the fix is TONE AND SIZE, not construction:
    //
    //   PAINT IT AS CERAMIC, NOT AS A SEPARATE PART. 0xd0c9ba is one shade off
    //     the body — 8-10 levels, enough to round the form where it crosses the
    //     cup — but 40+ levels off the sill, which is the contrast that
    //     actually has to work. The cup already reads against that sill at ~50;
    //     the handle now reads for the same reason the cup does. Separating
    //     handle from CUP was never the problem: a real handle IS the same
    //     ceramic, and what says "handle" is the HOLE, not a tonal seam.
    //   MAKE THE HOLE WORTH SEEING. H_R 0.022 -> 0.028 takes the ring from 58 to
    //     70 mm against a 95 mm cup, which is a mug's real proportion, and opens
    //     the hole from 30 to 32 mm of daylight while the ring gains pixels.
    //   BITE DEEPER INTO THE WALL. The old offset put the hole's inner edge
    //     exactly ON the cup wall, so only 7 mm of ring lay inside it — under
    //     2 px at this range, which is why it read as a hoop parked beside the
    //     cup even though it was genuinely joined. Pulling it in 10 mm sinks the
    //     ring 17 mm into the wall and the two ends now merge visibly, the way a
    //     real handle does. The hole is still bounded by the cup on its inner
    //     side, which is also what a real handle looks like.
    //
    // ── 310i(b): THE BITE WAS ONLY EVER LEGAL BECAUSE THE CUP WAS SOLID ─────
    //
    // The user: *"also the inside contains the handle? gotta get rid of the
    // handle on the inside."*
    //
    // HANDLE_BITE is the cause and its REASON IS STILL RIGHT — a handle that
    // only kisses the cup reads as a hoop parked beside it, and that complaint
    // cost three passes. What changed is that item 310h opened the cup. A full
    // torus pushed 10 mm past the outer skin reached 24 mm INSIDE the bore, and
    // there is now an interior for it to be seen in. Nothing was wrong with the
    // bite until the wall behind it stopped existing.
    //
    // AND IT CANNOT BE FIXED BY MOVING THE RING. At handle height the ceramic
    // is 4.7 mm thick and the handle tube is 14 mm across, so no offset exists
    // where a FULL ring both touches the outer skin and clears the bore: pull
    // it out far enough to clear and it floats. That is the trade the ring
    // shape forces, and it is the ring shape that is wrong.
    //
    // A real handle is not a ring passing through the wall. It is an ARC that
    // leaves the cup and comes back, so use one — `TorusGeometry`'s fifth
    // argument, a half turn, standing off the +z face with both ends buried in
    // the ceramic. That gives MORE merge than the bite did, not less: the ends
    // TERMINATE inside the wall instead of passing through it, so there is no
    // gap, no float, and nothing left to emerge on the inside. The arc's open
    // ends need no caps — they are inside opaque ceramic and the bore is
    // DoubleSide now, so they are occluded from without and within.
    //
    // The geometry ships pointing the wrong way: a `TorusGeometry` arc starts
    // at local +x and sweeps to local -x through +y, and `rotation.y` then puts
    // local x on world z. `rotateZ` on the GEOMETRY spins the arc about its own
    // hole axis to point the bulge at +z — done to the geometry rather than as
    // a second Euler angle on the mesh, because two Euler angles compose in an
    // order that is easy to get backwards and this composes in none.
    //
    // The offset is DERIVED from the profile, not typed. The two ends sit at
    // y0 +/- H_R, and each end's inner tangent must fall between the bore at the
    // upper end and the outer skin at the lower one; the offset is the midpoint
    // of that window, so it re-solves itself if the taper or the base moves.
    const H_R = 0.028, H_TUBE = 0.007;
    const H_LY = 0.055;                                 // ring centre, above the sill
    const HANDLE_OFF = H_TUBE + (mugBoreR(H_LY + H_R) + mugOuterR(H_LY - H_R)) / 2;
    const hGeo = new THREE.TorusGeometry(H_R, H_TUBE, 6, 8, Math.PI);
    hGeo.rotateZ(Math.PI / 2);                          // bulge to local -x, i.e. world +z
    const handle = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({ color: 0xd0c9ba }));
    handle.position.set(AX(MUG_X), SILL_TOP + H_LY, AZI(MUG_Z + HANDLE_OFF));
    handle.rotation.y = Math.PI / 2;                    // hole axis along x, facing the room
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
    // The pillow lies ACROSS the head of the bed, not along it. The frame is
    // 1.90 in x by 0.92 in z, so the long axis is x and the head is the low-x
    // end (it is the end the turned-back sheet covers, and the end the blanket
    // heap is thrown away from). The pillow was 0.46 in x by 0.30 in z — its
    // long side pointing down the bed, i.e. turned ninety degrees off. Swapped:
    // 0.30 down the bed, 0.46 across it.
    //
    // Its POSITION was off too, not only its angle. At x −2.86 with a 0.46
    // half-span it reached to −3.09, and the mattress stops at −3.03 — the old
    // pillow poked 6 cm out through the head of the bed into the wall. Turned,
    // it spans −3.01…−2.71 and sits on the mattress. In z it sat at 4.74
    // against a mattress centred on 4.86, hanging 0.12 toward the near edge;
    // centred now, with the 0.14 rad tilt kept because the bed is unmade.
    box(0.30, 0.11, 0.46, -2.86, RY + 0.50, 4.86, new THREE.MeshBasicMaterial({ color: 0xd0cabb }), 0.14); // dented pillow
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
    // ── 0.08 -> 0.20, AND THE UNIT IS THE PROBLEM ────────────────────────
    //
    // The user, after all of the above shipped: *"i havent seen a single
    // package outside my neighbors doors?"* — and everything here works. I
    // walked to his own landing and stole 302's parcel and got a pair of
    // trainers (`scripts/probes/w64-pkg-landing3.mjs`). What was wrong is how
    // often one is THERE, and the reason is a unit nobody converted.
    //
    // `crosstown.ts:423`: **one real second is one game minute**, so a game DAY
    // is 24 real minutes. A "small chance per day" sounds like a chance per day;
    // it is a chance per 24 minutes of play.
    //
    // MEASURED at 0.08 over 120 days, sampling the real hash rather than
    // re-deriving it:
    //
    //     building-wide   76 parcels, on 50% of days
    //     HIS LANDING     19 parcels, on 14% of days
    //     longest stretch with nothing outside 301 or 302:  19 DAYS
    //
    // Nineteen game days is **7.6 real hours of play** in which no package
    // appears where he lives. That is not a rare event, it is an invisible
    // feature, and his sentence is the correct report of it.
    //
    // 0.20 was chosen with both of his statements in hand — he asked for *"a
    // small chance"* and he was telling me he had never seen one — and with the
    // failure the queue row names in the other direction: *"a landing with a
    // parcel at every door reads as a depot."* At 0.20 a door got a parcel
    // about one day in five, his own landing carried one on a third of days,
    // and the building averaged 1.6 of its 8 doors. Re-measured numbers are in
    // notes/w64-packages.md.
    //
    // 2026-08-04, and 0.20 overshot: *"there's too many packages to steal.
    // make package rate less frequent"*. Halved, because half is a number he
    // can push either way and because the arithmetic is legible from it:
    //
    //     0.20   1.6 of 8 doors per day · SOMETHING in the building 83% of days
    //     0.10   0.8 of 8 doors per day · something in the building 57% of days
    //            his own landing (301/302) carries one 19% of days
    //
    // Deliberately NOT back to the 0.08 that made it an invisible feature —
    // this is the one dial between "a depot" and "never happens", so expect to
    // move it again. It is one constant either way; nothing accumulates,
    // because `present` below is recomputed every frame from (door, day) and
    // `pkgTaken` is keyed by day, so an unstolen parcel clears at the rollover.
    const PKG_CHANCE = 0.10;                 // per door per day — see scripts/packages.mjs
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
      // ITEM 260: a parcel cap MOVES. `pkgRoll(q.d.num, day, 7)` picks which
      // SIDE of the door it sits on and re-rolls every night, so this box jumps
      // 1.63 m in z between game days — measured, `scripts/probes/
      // w105-moving-static.mjs DAYS=6`. Invisible to any probe sampling within
      // one day, which is why it sat in the static list unnoticed.
      sevActors.push(cap);
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
        // Two words, no apartment number: *"make the dialog for stealing just
        // say steal package"* (2026-08-04). It used to name the door it was
        // outside of. The refusal stays readable BEFORE the key is pressed
        // rather than after — K's note is explicit about that, and it is the
        // difference between a full pack and a broken prompt.
        label: () => (pocketsFull(ctx.purse)
          ? 'pockets full — you cannot carry it'
          : 'steal package'),
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
          : 'steal package'),
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
    /** ── TITLE-SAFE ────────────────────────────────────────────────────
     *  The user: *"make sure the top of the ad isnt getting cut off by the tv.
     *  we can reduce the bezel a little bit"* (2026-08-02).
     *
     *  THE BEZEL RAILS DO NOT OVERLAP THE GLASS — measured, all four abut it
     *  to the micron (scripts/probes/w48-tvprobe.mjs): the top rail's underside
     *  is at y 6.162 and the screen's top edge is at y 6.162. The clipping is
     *  PARALLAX. The rails stand proud of a recessed screen, and the ads only
     *  ever play to a SEATED player, whose eye is a fixed 0.538 m ABOVE the
     *  screen's centre at 1.928 m out — so he looks 15.6deg DOWN at it and the
     *  top rail's front edge cuts a band off the top of the picture.
     *
     *  Measured band, at the rail depth this file used to carry (0.06 m):
     *  0.01311 m of a 0.26 m screen = **2.42 of the 48 canvas rows**. `list`
     *  put its headline at row 2 and `split` its BEFORE/AFTER at row 2, so
     *  both lost the top row of every glyph; `slate` lost the top edge of its
     *  border. Ten of the 27 spots were visibly cut.
     *
     *  SHRINKING THE BEZEL ALONE CANNOT FIX THIS. Any recess at all occludes
     *  something off-axis: at 0.04 m the band is still 1.60 rows, at 0.03 m
     *  still 1.19. So the bezel comes in to 0.04 (the "little bit" he
     *  authorised, and no more — he likes the chunky set) and the ads get a
     *  declared safe area on top of it, which is what broadcast does and the
     *  only version of this that a NEW spot cannot reintroduce.
     *
     *  3 rows > the 1.60 the geometry actually eats, so there is a row of
     *  margin. `scripts/w48-tv-title-safe.mjs` re-measures the band in the
     *  built world and fails if it ever grows past this number — that is the
     *  guard, not this comment.
     *
     *  BACKGROUNDS STILL BLEED. A full-width accent bar is meant to run to the
     *  edge and is not harmed by losing two rows of itself; only INK has to
     *  stay inside. So the inset is enforced in `tvFit`/`tvAt`, the two
     *  functions that draw words, and nowhere else. */
    const TV_SAFE_T = 3, TV_SAFE_B = 2;
    /** the topmost canvas row any GLYPH pixel was drawn at during the current
     *  paint — published on `scene.userData.tv` so a check can assert the safe
     *  area holds for all 27 spots without re-deriving where each one writes */
    let tvMinRow = TVH;
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
          if (rows[r][q] === '1') {
            const gy = y + r * (px / 5);
            if (gy < tvMinRow) tvMinRow = gy;      // the safe-area witness
            g.fillRect(cx + q * (px / 3), gy, px / 3, px / 5);
          }
        cx += px / 3 * 4;
      }
    };
    /** clamp a text baseline into the title-safe box. `glyphH` is the drawn
     *  height of a line at this size — 5 glyph rows of `px/5` each, i.e. `px`.
     *
     *  This is the whole enforcement. Both writers below go through it, so a
     *  spot written next month that asks for row 0 gets row 3 instead of
     *  getting cut, and an over-tall headline is pushed up off the bottom
     *  rather than running past it. */
    const tvSafeY = (y: number, glyphH: number) =>
      Math.max(TV_SAFE_T, Math.min(y, TVH - TV_SAFE_B - glyphH));
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
      tvText(g, txt, Math.max(1, Math.round((TVW - w) / 2)), tvSafeY(y, px), c, px);
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
      tvText(g, txt.length > max ? txt.slice(0, max) : txt, x, tvSafeY(y, px), c, px);
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
        // THE BORDER IS THE SLATE. Everything else on this format is a full-
        // bleed wash that loses nothing by being trimmed, but a rule drawn
        // 2 rows down had its top edge eaten by the bezel and read as a
        // three-sided box. It is the one piece of non-text that has to sit
        // inside the safe area, so it is written FROM the safe constants
        // rather than from the 2 it used to carry.
        const bt = TV_SAFE_T, bh = TVH - TV_SAFE_B - TV_SAFE_T;
        g.fillStyle = a.accent; g.fillRect(2, bt, TVW - 4, bh);
        g.fillStyle = a.bg; g.fillRect(3, bt + 1, TVW - 6, bh - 2);
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
      // THE CASINO IS NOT CALLED SEVENS ANY MORE. Item 196 rebuilt this
      // elevation as the Orpheus casino wing: the category line on the facade
      // reads ORPHEUS and the name board reads CASINO (ct/vice.ts:1264), and the
      // [E] prompt is "into the ORPHEUS CASINO" (ct/int-casino.ts:133). This
      // slate still said SEVENS, which is an ad for a business the street no
      // longer has — precisely the fault the user filed when he asked for the
      // ads to *"actually be representative of the businesses we created thus
      // far"*. (Item 213.)
      //
      // ORPHEUS OVER CASINO, in the facade's own two-line arrangement rather
      // than as one 14-character line: `tvFit` sizes to fit and 'ORPHEUS CASINO'
      // only fits at px 3, its documented floor ("below that the glyphs stop
      // being glyphs"). Stacked, both words draw at px 5 — the size the rest of
      // this slate uses — and the ad reads the way the building does.
      // `slate` lays lines at 8 + i*8 and `tvSafeY` clamps the last one, so the
      // fourth row lands at y 32 against a safe bottom of 46.
      { name: 'orpheus slate', fmt: 'slate', secs: 4.2, bg: '#10203f', ink: '#eaf2ff', accent: '#c8d8f0',
        lines: ['ORPHEUS', 'CASINO', 'FREE BUFFET', 'MUST BE 21'] },
      { name: 'orpheus quote', fmt: 'quote', secs: 4.4, bg: '#7a1420', ink: '#ffe9a8', accent: '#e8c33a',
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

    /** The user: *"ads play too fast too. slow it down a bit"* (2026-08-02).
     *
     *  ONE MULTIPLIER RATHER THAN 20 EDITED NUMBERS. Each spot carries its own
     *  `secs` — 3.0 for a price card, 5.6 for the bodega's five-line list — and
     *  those RELATIVE lengths are the writing: a price card is meant to be
     *  shorter than a list. Scaling them all preserves that shape, and it means
     *  the next "a bit more" is this one number again rather than another sweep.
     *  1.4x: a 3.0 s card becomes 4.2 s, the 5.6 s list becomes 7.8 s. */
    const TV_PACE = 1.4;
    let tvSeg = 0, tvLeft = SEGMENTS[0].secs * TV_PACE, tvClock = 0, tvRedraw = 0;
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
    //
    // 0.06 -> 0.04. The user: *"we can reduce the bezel a little bit"*, and
    // this is the only number that controls how much of the picture the
    // surround eats: the rails abut the aperture exactly on all four sides,
    // so nothing is covered head-on and the loss is pure PARALLAX from the
    // seated eye 0.538 m above the screen's centre. Depth is the whole of it —
    // 0.06 cost 2.42 canvas rows off the top, 0.04 costs 1.60.
    //
    // IT DOES NOT GO FURTHER. He likes the set (*"the tv bezel looks good"*)
    // and a surround that stands 40 mm off the glass is still the chunky 1997
    // object the bezel was asked for; chasing the last row here would flatten
    // it into the poster the bezel exists to stop it being. The remaining
    // 1.60 rows are absorbed by TV_SAFE_T instead, which is the fix that also
    // survives the next spot somebody writes.
    //
    // The badge, buttons, LED and band all derive their z from RAIL_Z and
    // RAIL_D, so they follow the face in and nothing here is retyped.
    const RAIL_D = 0.04, RAIL_Z = WELL_Z + RAIL_D / 2 + 0.012;
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
      tvMinRow = TVH;                     // reset the witness for THIS paint
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
        tvSeg = tvBag.splice(pick, 1)[0]; tvLeft = SEGMENTS[tvSeg].secs * TV_PACE; tvRedraw = 0;
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
                            left: tvLeft, pool: SEGMENTS.length, on: tvLit, warming: tvWarm > 0,
                            // the title-safe contract, published rather than
                            // retyped in the check that enforces it, and the
                            // witness that says where this spot actually drew
                            safe: { t: TV_SAFE_T, b: TV_SAFE_B, rows: TVH },
                            minRow: tvMinRow };
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
    // ── AND THE APPROACH IS BACK IN THE DOOR'S MOUTH (item 309) ────────────
    //
    // Item 308 moved it from `AX(TV_X + 0.40)`/`AZI(3.70)` = (198.84, -16.30)
    // west to (197.90, -16.45), to make room for the door's stand-point in the
    // doorway. **The door went back to its corner and so did this**, because
    // the user asked for the flat the way it was: *"i liked it how it was
    // before i just want the calendar back to the right tho."*
    //
    // The +0.40 has no derivation and never had one — it is the oldest number
    // in this block. It is restored rather than re-justified, deliberately: the
    // thing he asked for is the feel he had, and re-deriving it would be a
    // third different position for a stand-point he never complained about.
    //
    // The SEAT does not move and never did — `TV_SEAT_X/Z` was untouched by
    // both items. This is only the patch of floor you press E from.
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
    // THE SEAT PAN, named rather than left as four literals — the garment below
    // has to land ON it, and item 249 is what happens when that relationship is
    // arithmetic in someone's head instead of in the file (BUILDER-BRIEF §8).
    const PAN_Y = RY + 0.44, PAN_T = 0.04;
    const PAN_TOP = PAN_Y + PAN_T / 2;
    box(0.42, PAN_T, 0.40, -0.72, PAN_Y, 5.12, chairM);
    for (const [lx, lz] of [[-0.54, 4.95], [-0.90, 4.95], [-0.54, 5.29], [-0.90, 5.29]] as [number, number][]) {
      box(0.05, 0.44, 0.05, lx, RY + 0.22, lz, chairM);
    }
    box(0.42, 0.46, 0.05, -0.72, RY + 0.69, 5.29, chairM);
    // ── "fix this chair" (item 146) ──────────────────────────────────────────
    //
    // The user photographed this one and the report reads: *back panel appears
    // to float above the seat, with a separate rail above it.* Both halves are
    // the SHIRT, not the chair — measured in world coordinates before touching
    // anything (`scripts/probes/w90-item146-find-chair.mjs`):
    //
    //     seat top      5.867
    //     backrest      5.867 .. 6.327     a 0.05 m panel
    //     shirt         6.107 .. 6.307     0.26 m DEEP — 5.2x the panel
    //
    // The seat/back junction is FLUSH, gap 0.000 — nothing floats. What floats
    // is what you can SEE: a 0.26 m slab pasted across the MIDDLE of a 0.05 m
    // panel hides it, and leaves a **0.02 m strip of backrest peeking out above
    // the shirt**. That two-centimetre strip is the "separate rail", and with
    // the panel cut into bands the part below reads as detached from the seat.
    // Confirmed against all 219 registered seats: ZERO have a real gap, so this
    // was never a geometry fault (`probes/w90-item146-floating-backs.mjs`).
    //
    // A shirt left on a chair hangs OVER THE TOP RAIL. So it straddles the top
    // edge now — 6.19..6.41 against a top of 6.327, folded 0.08 over and 0.14
    // down — instead of being a belt across the panel's waist. No strip is left
    // above it because there is nothing above it any more.
    //
    // z AND DEPTH DELIBERATELY UNCHANGED. The chair was tucked north until its
    // near corner cleared the door's 166deg arc by 1.01 m (see above), and the
    // shirt's 0.26 m already reaches z 5.37 toward the wall; moving it back to
    // centre on the panel would spend clearance this chair does not have.
    box(0.40, 0.22, 0.26, -0.74, RY + 0.90, 5.24, new THREE.MeshBasicMaterial({ color: 0x3f5a6b }), 0.1);
    // ── THE SECOND GARMENT (item 249) ────────────────────────────────────────
    //
    // Same family of fault as the shirt above, in the other direction: it was
    // EMBEDDED rather than floating. Measured on the built world before touching
    // it (`scripts/probes/w119-249-garment-vs-pan.mjs`):
    //
    //     seat pan     5.827 .. 5.867
    //     garment      5.837 .. 5.977     bottom 0.030 m BELOW the pan's top
    //
    // So 3 cm of a 14 cm bundle was buried in a 4 cm pan — three quarters of the
    // pan's whole thickness — and the frame is worse than the number: the pan
    // disappears behind it and what is left reads as a loose brown flap hanging
    // off the front of the chair, which is the same "separate rail" mistake the
    // user photographed in item 146 wearing different clothes.
    //
    // DERIVED FROM THE PAN, not renumbered: its underside sits exactly on
    // `PAN_TOP`. A hand-typed `RY + 0.53` would be the second copy of a number
    // the pan already owns, and the next person to move the seat would leave
    // this behind — which is precisely how it got 0.03 m out in the first place.
    //
    // x, z, SIZE AND YAW ARE ALL UNCHANGED, deliberately. The only thing wrong
    // was the height, and this chair has 0.01 m of margin against the dresser
    // collider and a door arc to clear (see the block above) — nudging it in
    // plan to "drape" it over the front lip would spend clearance it does not
    // have, and a solid box overhanging an edge is the FLOATING fault, which is
    // the one the user has already reported twice.
    const GARMENT_H = 0.14;
    box(0.34, GARMENT_H, 0.22, -0.70, PAN_TOP + GARMENT_H / 2, 5.08,
      new THREE.MeshBasicMaterial({ color: 0x7a5a4a }), -0.3);
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
    });
    // ── THE TWO HANGING PLANES, DECLARED TOGETHER ────────────────────────────
    //
    // The user: *"put the calendar where the poster is and the poster where the
    // calendar is."* The swap crosses the room, so the two z planes now have to
    // be named in ONE place rather than one being a bare literal down here and
    // the other a `const` ninety lines below — `NORTH_Z` was declared after this
    // point, so hanging the poster north would have read a `const` in its
    // temporal dead zone and thrown at module init.
    //
    // THEY ARE NOT MIRROR IMAGES OF EACH OTHER, which is the whole trap:
    //   SOUTH_Z sits 0.015 PROUD of the south wall's room face, at +z from it.
    //   NORTH_Z sits 0.015 proud of the NORTH wall's room face, at -z from it,
    //     and that face is `AZI(5.5) - 0.07` because AZI(5.5) is the box's
    //     CENTRELINE and the box is 0.14 deep. Hanging at AZI(5.49) entombs the
    //     mesh in the plaster: present, visible:true, right x and y, invisible.
    // So a hanging also needs the ROTATION belonging to its wall — see below.
    const SOUTH_Z = AZI(2.085);
    const NORTH_Z = AZI(5.5) - 0.07 - 0.015;
    // ── THE POSTER NOW HANGS ON THE NORTH WALL, ABOVE THE BED ────────────────
    //
    // It takes the calendar's former x and y verbatim; only the wall changed.
    // `rotation.y = Math.PI` because this wall faces -z and `texM` is
    // DoubleSide — get it wrong and nothing goes missing, the flyer simply
    // reads MIRRORED, which is the failure the calendar's own comment warned
    // about and which no "is it there?" check would catch.
    //
    // CLEARANCE, measured rather than assumed, because the flyer is 0.52 x 0.70
    // and the calendar it replaces was 0.30 x 0.40 — it is the bigger object
    // moving into the smaller one's slot, so this is the direction that can
    // foul. Spans x -2.71…-2.19; the three snapshots span -1.82…-1.42, so
    // 0.37 m of clear wall between them, and the west wall's inner face at
    // AX(-3.2) is a further 0.49 m past its left edge. Nothing overlaps.
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.70), texM(postT));
    poster.position.set(AX(-2.45), RY + 1.66, NORTH_Z);
    poster.rotation.y = Math.PI;
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
    // rotation.y = PI on the snapshots below, and on the POSTER that now hangs
    // here — this wall faces -z, so its artwork has to be turned or it reads
    // mirrored; texM is DoubleSide, so getting this wrong shows nothing
    // missing, just a backwards flyer. Both z planes are declared together up
    // beside the poster, with the centreline-vs-face trap written out there.
    //
    // THE CALENDAR HAS LEFT THIS WALL for the south one, at the user's request.
    // What remains above the bed is the poster and the three snapshots.
    // ══ THE CALENDAR — bigger, a little right, and a thing you can READ ══════
    //
    // The user: *"move the calendar a bit to the right, make it bigger, and make
    // it interactable in the same sort of integrated overlay view."* Three asks,
    // and the third decides the other two: an object you are meant to walk up to
    // and read has to be big enough to be worth walking to.
    //
    // WHAT THE RING MEANS, which is the only interesting question here. A biro
    // ring has been drawn on this calendar since it was written — *"the whole
    // reason a calendar is on a wall rather than in a drawer"* — and it referred
    // to nothing. It refers to RENT DAY now, because `ct/tenancy.ts` already
    // runs a lease and rent is the one recurring dated event this world has.
    // Nothing new is scheduled and there is NO scheduling UI: a wall calendar's
    // only real affordance is turning the page, so that is the only thing this
    // one offers. Days behind you are crossed off in the same biro, which is
    // what somebody waiting on a rent day actually does to a wall calendar.
    //
    // ── THE LEASE, COPIED WITH A CITATION AND NOT IMPORTED ───────────────────
    //
    // These four values are `ct/tenancy.ts:74-87`'s `RENT`, value for value.
    // BUILDER-BRIEF §8 says import rather than retype, and I cannot: `ct/
    // tenancy.ts:4` imports `APT_X0/APT_Z0/ST0` FROM THIS FILE, so importing it
    // back closes an import cycle — and GOTCHAS §28 is that a module in a cycle
    // can be silently dropped from the BUILT BUNDLE ONLY. Dev would look
    // perfect and the calendar (or the mailbox) would not exist in the artifact.
    // That is the same trap `ct/atm.ts` hit and left alone for the same reason.
    //
    // So: cited copy, and a CHECK rather than a promise —
    // `scripts/probes/w107-lease-copy-agrees.mjs` reads both files and fails if
    // these four drift from tenancy's. The follow-up for the desk is to hoist
    // `RENT` into a leaf module that neither file imports, which is the fix
    // `ct/atm.ts`'s note asks for as well.
    const LEASE = { firstDay: 2, everyDays: 7, amount: 45, landlord: 'V. OKONKWO' } as const;
    /**
     * DAY 0 OF THE GAME IS MONDAY 1 SEPTEMBER 1997 — derived, not picked.
     *
     * `ct/tenancy.ts:278` is `noDelivery(day) { return day % 7 === 6; }` with
     * the comment "Sunday. No delivery." That fixes the world's week: day 6 is
     * a Sunday, so DAY 0 IS A MONDAY, and any calendar drawn here has to start
     * on one or it will disagree with the post. 1 September 1997 is a Monday
     * (`new Date(Date.UTC(1997,8,1)).getUTCDay() === 1`) and it makes the first
     * rent day — day 2 — Wednesday 3 September, weekly on a Wednesday after
     * that. This is the only date this world has ever authored; nothing else
     * names a month.
     */
    const CAL_EPOCH = Date.UTC(1997, 8, 1);
    const CAL_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
      'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const CAL_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];   // Monday first, per above
    /** what day it is, the same expression `ct/tenancy.ts:42` uses. A game day
     *  is 1440 game-minutes, which is 24 real ones. */
    const calToday = () => Math.floor(ctx.clock.now().totalMin / 1440);
    const isRentDay = (d: number) =>
      d >= LEASE.firstDay && (d - LEASE.firstDay) % LEASE.everyDays === 0;
    /** the next rent day on or after `d` */
    const nextRentDay = (d: number) => (d <= LEASE.firstDay ? LEASE.firstDay
      : LEASE.firstDay + Math.ceil((d - LEASE.firstDay) / LEASE.everyDays) * LEASE.everyDays);

    // ── SIZE AND DENSITY (§7b) ───────────────────────────────────────────────
    //
    // 0.30 x 0.40 -> 0.48 x 0.64. That is 2.56x the area, against the 0.52 x
    // 0.70 flyer that used to hang in this slot — so it is visibly bigger and
    // still not the biggest thing on a wall in a rented room.
    //
    // THE ASPECT IS DELIBERATELY UNCHANGED at 3:4. The art is a month block over
    // a seven-column grid and it is drawn for a portrait page; re-cutting to a
    // new aspect would mean redrawing the grid to gain nothing. What DOES get
    // re-cut is the canvas, and that is the part that matters: 30 x 40 stretched
    // over 0.48 x 0.64 would be 62.5 px/m, and this surface has always been
    // 100 px/m (30 px / 0.30 m). So the canvas is DERIVED from the metres at the
    // density it already had, and the wall texture is unchanged in density and
    // in look. Both canvases below are 3:4, so neither is stretched on the plane.
    const CAL_W = 0.48, CAL_H = 0.64;
    const CAL_PPM = 100;                                    // px/m, as it always was
    const CAL_TW = Math.round(CAL_W * CAL_PPM);             // 48
    const CAL_TH = Math.round(CAL_H * CAL_PPM);             // 64
    // and the overlay is the SAME PAGE at six times the density, because you
    // read it from 0.42 m instead of from across the room. One drawing routine
    // lays out both, in 48 x 64 design units scaled by S — so the object cannot
    // re-arrange when you step up to it, which is exactly the fault the ATM's
    // handoff note logged against `ct/bank.ts` (notes/archive/w41, finding 1).
    const CAL_PW = CAL_TW * 6, CAL_PH = CAL_TH * 6;         // 288 x 384, 600 px/m
    // where the eye settles to read it — see the panel below for the derivation
    const CAL_FOV = 55;
    const CAL_STANDOFF = (CAL_H / 2) / Math.tan((CAL_FOV * Math.PI) / 360) * 1.18;

    /**
     * The month page, at any canvas size that is 3:4.
     *
     * `day` is the game day; `offset` is how many months forward or back of the
     * one containing it. Everything below is in 48 x 64 DESIGN UNITS and lands
     * on whole pixels through `u()`, so it is crisp at S = 1 and at S = 6.
     */
    const drawCalendar = (g: CanvasRenderingContext2D, W: number, H: number,
                          day: number, offset: number) => {
      const S = W / 48;
      const u = (v: number) => Math.round(v * S);
      const box = (x: number, y: number, w: number, h: number, fill: string) => {
        g.fillStyle = fill;
        g.fillRect(u(x), u(y), u(x + w) - u(x), u(y + h) - u(y));
      };
      const text = (s: string, cx: number, cy: number, size: number, fill: string) => {
        g.fillStyle = fill;
        g.font = `bold ${u(size)}px ui-monospace, Menlo, monospace`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s, u(cx), u(cy));
      };
      const biro = (lw: number) => {
        g.strokeStyle = '#2f4f8c';
        g.lineWidth = Math.max(1, u(lw));
      };

      // which month is on the page, and where it sits in game days
      const base = new Date(CAL_EPOCH + day * 86400000);
      const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
      const after = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
      const nDays = Math.round((after.getTime() - first.getTime()) / 86400000);
      const lead = (first.getUTCDay() + 6) % 7;              // 0 = Monday
      const day0 = Math.round((first.getTime() - CAL_EPOCH) / 86400000);
      const weeks = Math.ceil((lead + nDays) / 7);

      // the month block, and the page under it
      box(0, 0, 48, 16, '#8c3a2e');
      box(0, 16, 48, 1, '#5e2820');
      text(CAL_MONTHS[first.getUTCMonth()], 24, 5.5, 4.6, '#e8dcb8');
      // the year keeps the 4x5 pixel font this calendar has always used, scaled
      // rather than replaced — at S = 1 it is the identical stamp it was.
      g.save();
      g.translate(u(24 - 9.5), u(9)); g.scale(S, S);
      stampNum(g, String(first.getUTCFullYear()), 0, 0, '#e8dcb8');
      g.restore();
      box(0, 17, 48, 47, '#e8e0cc');
      for (let c = 0; c < 7; c++) text(CAL_WEEK[c], 3 + c * 6 + 2.5, 21, 3.6, '#8a8272');

      // the grid
      const GRID_T = 24, GRID_B = 55, COL_W = 6, X0 = 3;
      const rowH = (GRID_B - GRID_T) / weeks;
      for (let n = 1; n <= nDays; n++) {
        const idx = lead + n - 1;
        const cx = X0 + (idx % 7) * COL_W + COL_W / 2;
        const cy = GRID_T + Math.floor(idx / 7) * rowH + rowH / 2;
        const gd = day0 + n - 1;                             // the game day of this cell
        if (gd === day) box(cx - 2.4, cy - rowH / 2 + 0.4, 4.8, rowH - 0.8, '#8c3a2e');
        // NUMERALS ONLY WHERE THEY FIT. A two-digit number is 9 design units in
        // the pixel font and a cell is 5, so at S = 1 this stays the grid of
        // marks it has always been. The cell positions, the ring, the crossings
        // and today's block are identical at both scales, so stepping up to it
        // resolves the same page rather than showing a different one.
        if (S >= 3) text(String(n), cx, cy + 0.2, 3.4, gd === day ? '#f2e8cc' : '#4a443a');
        else box(cx - 1.5, cy - 1.5, 3, 3, gd === day ? '#f2e8cc' : '#5a5348');
        if (gd < day) {                                      // crossed off
          biro(0.4);
          g.beginPath();
          g.moveTo(u(cx - 2.1), u(cy - rowH / 2 + 0.9));
          g.lineTo(u(cx + 2.1), u(cy + rowH / 2 - 0.9));
          g.stroke();
        }
        if (isRentDay(gd)) {                                 // ringed
          biro(0.42);
          g.beginPath();
          // ry pulled well inside the row: at `rowH/2 - 0.3` consecutive rent
          // days ring into one another and a month of Wednesdays reads as a
          // chain down the page rather than as four circled dates.
          g.ellipse(u(cx), u(cy), u(2.7), u(rowH / 2 - 1.0), 0, 0, Math.PI * 2);
          g.stroke();
        }
      }

      // and what the ring is, written under it in the same biro
      const due = nextRentDay(day) - day;
      text(`RENT $${LEASE.amount}  ${LEASE.landlord}`, 24, 58, 3.2, '#2f4f8c');
      text(due === 0 ? 'DUE TODAY' : `DUE IN ${due} DAY${due === 1 ? '' : 'S'}`,
        24, 62, 3.2, '#2f4f8c');

      // Paper grain. The two inks and the 26-specks-per-30x40 density are
      // `ct/paint.ts:399`'s `dither`, and at S = 1 this loop IS `dither` — same
      // speck size, same count, so the wall texture's look is unchanged.
      //
      // AT S = 6 A ONE-UNIT SPECK IS A 6 px BLOCK and reads as damage rather
      // than as paper: the first overlay screenshot had grey squares scattered
      // over the month grid like blotches. So the speck halves with the scale
      // and the count rises to keep the inked AREA identical — same amount of
      // grain, finer, which is what paper does when you get closer to it.
      const sp = Math.max(1, Math.round(S / 2));
      const specks = Math.round(((48 * 64 * 26) / (30 * 40)) * (S / sp) ** 2);
      for (let i = 0; i < specks; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
        g.fillRect(Math.floor(Math.random() * (W - sp)), Math.floor(Math.random() * (H - sp)), sp, sp);
      }
    };

    // ⚠ THE FIRST PAINT MAY NOT ASK THE CLOCK, AND THIS COST A DEAD WORLD.
    //
    // `surfTex` draws IMMEDIATELY, i.e. during `buildApartment(ctx)` — and
    // `crosstown.ts:434` calls that on the line BEFORE `let totalMin` is
    // declared at :437. So `ctx.clock.now()` at build time reads a `let` in its
    // temporal dead zone and throws `ReferenceError: Cannot access 'totalMin'
    // before initialization` out of module init: no `__ct`, no world, a black
    // page, and a stack that points at the clock rather than at the caller.
    // Measured on the built bundle, not reasoned about.
    //
    // `ctx.clock` is a VERB YOU MAY CALL PER FRAME, NOT AT BUILD TIME. So the
    // first paint is day 0 — which is also where the game starts — and
    // `calShownDay = -1` guarantees the frame hook below repaints from the real
    // clock on frame one regardless.
    const calT = surfTex('detail', CAL_TW, CAL_TH,
      (g) => drawCalendar(g, CAL_TW, CAL_TH, 0, 0));
    // ── THE CALENDAR HANGS ABOVE THE FLOOR YOU READ IT FROM ─────────────────
    //
    // It has no `rotation.y`: the south wall faces +z into the room, so its
    // artwork carries none. Leaving a PI on would not hide it, it would show the
    // month page reversed, biro ring and all, and read as a texture bug.
    //
    // ⚠ IT WAS AT AX(-0.80) AND THE USER COULD NOT OPEN IT (item 298). His
    // words: *"i can t look at the calendar if im looking right at it."*
    // Measured on the built bundle, standing square in front of AX(-0.80) and
    // facing the wall, EVERY distance from 0.40 m to 1.10 m off it resolved to
    // *"close the door"* — the calendar was unreachable from the one place a
    // person naturally stands to read it.
    //
    // WHY, and it is geometry rather than ranking. 301's room-side door
    // stand-point is at x 199.36 / z -17.455, which is 0.46 m off THIS wall and
    // 0.16 m right of where the page hung. `fp.ts` tier 1 is "the spot's centre
    // is inside your own body" (`onIt`, `d < RADIUS`), and that disc covers the
    // floor from 0.14 m to 0.78 m off the wall at that x — i.e. the whole
    // approach. Anywhere inside it the door wins outright however you are
    // facing, and that is deliberate (`w40-bed-vs-door` END ONE(b) exists to
    // keep it). Outside it the door is still `touching` (r 0.95 + TOUCH_MARGIN
    // = 1.10 m of reach) and still aimed-at within tolerance, so it takes tier 1
    // on rank as well. There is no stand-point in front of AX(-0.80) that the
    // calendar can win, and four ranking cuts before this one could not make one.
    //
    // THE DOOR'S STAND-POINT CANNOT MOVE TO MAKE ROOM. Measured off `__ct`:
    // 301's opening is z -16.975…-16.025 in the east wall, the leaf pivots at
    // (199.91, -16.005) and sweeps 166° of a 0.95 m disc INTO the room. Every
    // point in front of the opening is inside that sweep; -17.455 is the nearest
    // floor clear of it, which is exactly what the door's own comment says it
    // must be ("a door you can only reach by standing inside its own swing is a
    // door you can never shut"). So the corner belongs to the door.
    //
    // SO THE PAGE MOVES TO THE STAND-POINT INSTEAD OF THE OTHER WAY ROUND.
    // `CAL_STAND_DX` used to be 0.60 — you stood well to the LEFT of the page
    // and looked at it sideways. That patch of floor is the only one in this
    // room that works (it clears the door spot by 0.88 m and the bed-to-door
    // route by 0.51 m; see the stand-point note below, both figures unchanged
    // by this item), so the page hung over it and the offset went to zero.
    //
    // ══ AND ALL OF IT CAME BACK (item 308) ══════════════════════════════════
    //
    // The user, after being told what item 298 cost him: *"move the calendar
    // back to the right and fix the door standpoint."* **He named the blocker
    // correctly and it is the door, so the door is what moved.** The page hangs
    // at AX(-0.80) — where his *"a bit to the right"* put it, all 0.60 m of it
    // — and `CAL_STAND_DX` is back to zero, so you read it standing square in
    // front of it and not sideways.
    //
    // THREE THINGS HAD TO GIVE, and they are three commits so a bad one reverts
    // alone:
    //   · 301's room-side door stand-point left the corner for its own doorway
    //     (see `D301_STAND`, up beside `AX`/`AZI`).
    //   · the bed's approach stepped out of the doorway it was parked in (see
    //     the seat, ~500 lines above).
    //   · `w40-bed-vs-door`'s firing leg was made to arrive on purpose. It had
    //     been walking into the bed's collider and firing from wherever the rig
    //     got shoved — 1 green in 5 on UNMODIFIED mainline — and it was the only
    //     thing standing between the user and this. Fixing the instrument is
    //     not loosening it; the same three facts are asserted.
    //
    // Clearance: the page spans x 198.96…199.44 — the clear strip east of the
    // TV crate (which ends at 198.63) and 0.41 m short of the east wall's room
    // face. Nothing stands under it now; its bottom edge is RY+1.23 regardless.
    // The three taped-up snapshots are NOT near it: north wall, above the bed.
    const CAL_X = AX(-0.80);
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(CAL_W, CAL_H), texM(calT));
    cal.position.set(CAL_X, RY + 1.55, SOUTH_Z);
    // NAMED, so a probe can find it by asking rather than by guessing a shape.
    // The ATM's ad panel went missing from an audit for exactly this reason:
    // a failed SEARCH cannot tell "not there" from "not shaped how I guessed".
    cal.userData.calendar = 'page';
    scene.add(cal);
    // The wall page is redrawn when the DAY turns, not every frame: today's
    // block and the crossings-off are the only things on it that move, and they
    // move once per 1440 game-minutes. Nothing here accumulates — the same rule
    // `ct/tenancy.ts:36` sets out, and the reason sleeping through a week and
    // walking through a week are the same code path.
    let calShownDay = -1;                  // never a real day: frame 1 repaints
    ctx.onFrame(() => {
      const d = calToday();
      if (d === calShownDay) return;
      calShownDay = d;
      const cv = calT.image as HTMLCanvasElement;
      const cg = cv.getContext('2d');
      if (!cg) return;
      cg.clearRect(0, 0, CAL_TW, CAL_TH);
      drawCalendar(cg, CAL_TW, CAL_TH, d, 0);
      calT.needsUpdate = true;
    });

    // ── AND YOU CAN READ IT: the sixth tenant of the diegetic framework ──────
    //
    // `PanelSpec.surface` hangs this panel's own canvas on the calendar's own
    // mesh and eases the eye onto it — no new mechanism, one extra field, and
    // the framework keeps Escape, `[E]`, the freeze and one-at-a-time. It
    // degrades rather than fails: `mesh()` returning null gives back the
    // screen-space panel, which is what a harness with no focus controller gets.
    //
    // ⚠ THE STAND-OFF IS DERIVED, AND THE LETTER'S 0.42 DOES NOT TRANSFER.
    //
    // I took `standoff: 0.42` from `ct/tenancy.ts`'s letter — "arm's length,
    // where a person holds something they are reading" — and the first overlay
    // shot came out with the month name off the top of the screen and the biro
    // line off the bottom. A letter is a small sheet; this page is 0.64 m tall.
    // `crosstown.ts:1227` puts `fov` straight onto `cam.fov`, which is VERTICAL,
    // so the HEIGHT is the binding dimension and the distance that fits it is
    // arithmetic, not taste: d = (H/2) / tan(fov/2), plus 18% so the page does
    // not touch the top and bottom edges. 0.73 m — which is also just about
    // where you would really stand to read a calendar on a wall, as opposed to
    // where you hold a letter.
    //
    // Item 189 (a panel on a HORIZONTAL surface put the wristwatch over its
    // bottom edge) cannot bite here — this face is vertical and the watch is
    // screen-space furniture. Item 150 (a multi-material mesh froze the world
    // before throwing) cannot bite either: `texM` gives this plane ONE
    // `MeshBasicMaterial`, so `screenSlot` has nothing to be ambiguous about.
    let calPage = 0;
    let calPanel: Panel | null = null;
    const openCalendar = () => {
      if (!calPanel) {
        calPanel = makePanel({
          id: 'ct-calendar', w: CAL_PW, h: CAL_PH, chrome: 'none', scale: 1,
          // `chrome:'none'` because `drawCalendar` IS the whole object, edge to
          // edge — a framework bezel here would be a plastic case drawn round a
          // picture of a piece of card.
          hint: () => 'scroll to turn the page',
          draw: (g, w, h) => drawCalendar(g, w, h, calToday(), calPage),
          wheel: (d) => { calPage += d; calPanel?.repaint(); },
          key: (k) => {
            if (k === 'arrowright' || k === 'arrowdown') calPage++;
            else if (k === 'arrowleft' || k === 'arrowup') calPage--;
            else return;
            calPanel?.repaint();
          },
          surface: {
            mesh: () => cal,
            standoff: CAL_STANDOFF,
            fov: CAL_FOV,
            // `hot`/`click` arrive in THIS canvas's own pixels. Turning the page
            // is the only thing a wall calendar does, so it is the only thing
            // offered: the outer fifth of each side, the same left-back /
            // right-forward gesture the wheel and the arrows already give.
            hot: (x) => x < CAL_PW * 0.2 || x > CAL_PW * 0.8,
            click: (x) => {
              if (x < CAL_PW * 0.2) calPage--;
              else if (x > CAL_PW * 0.8) calPage++;
              else return;
              calPanel?.repaint();
            },
          },
          // back to this month every time you walk up to it — a page you left
          // turned three months forward is a state the player cannot see the
          // cause of.
          onOpen: () => { calPage = 0; },
        });
      }
      calPanel.open();
    };
    // WHERE YOU STAND TO READ IT — and since item 298 the page hangs directly
    // above it, so it is also where you stand to LOOK at it. This point has not
    // moved by a millimetre in either item; what moved is the mesh, up the wall
    // to meet it. Both derivations below still hold and are still the reason
    // this x and this z and no others.
    //
    // ── THE COMMENT THAT USED TO BE HERE WAS WRONG BY 0.11 m, AND WORSE ──────
    //
    // It read: *"Derived from the door spot rather than chosen: at 0.90 m the
    // door's centre is 0.58 m away, outside `fp.ts`'s RADIUS 0.36, so it can
    // only reach tier 3."* Measured on the running world
    // (`probes/w116-calendar-vs-door-spots.mjs`, re-run today), **the door's
    // stand-point is 0.468 m away, not 0.58 m** — and both numbers miss the
    // point, because the thing that broke was never the DOOR.
    //
    // `SOUTH_Z + 0.90` at `CAL_X` put this stand-point **on the straight line
    // from the bed to the door**: 0.036 m off it, 0.79 m along it. So a player
    // walking out of 301 walked THROUGH it, and `onIt` — the spot's centre
    // inside your own capsule — handed him the calendar for the whole middle of
    // the room. Measured, `w40-bed-vs-door`: three consecutive strides facing
    // the door offered *"read the calendar"*, and so did three consecutive
    // strides facing the BED, which has no door in it at all.
    //
    // ── SO IT MOVES OFF THE ROUTE ───────────────────────────────────────────
    //
    // (It moved SIDEWAYS to do that, and item 298 undid the sideways part by
    // moving the page instead — see `CAL_X` above. The 0.90 m off the wall did
    // not change either, and the note below it says what happened when I tried.
    // The two governing numbers are still these:)
    //
    //   · clear of the DOOR'S stand-point by `2 * RADIUS` — two capsules. Below
    //     that the two "standing in it" circles overlap, and inside an overlap
    //     neither rank nor aim can decide, which is worker onehundredsixteen's
    //     measured finding and the reason four ranking cuts could not fix this.
    //   · clear of the ROUTE OUT — the bed-seat-to-door segment — by
    //     `RADIUS + TOUCH_MARGIN`. `RADIUS` alone is the bare condition (the
    //     centre stays outside the walking capsule); the extra `TOUCH_MARGIN` is
    //     so a stride that wanders a hand's breadth does not put it back,
    //     GOTCHAS 72 — a margin the world can absorb is the only kind worth
    //     writing down.
    //
    // The route is the binding one: `2 * RADIUS` from the door alone would put
    // this at x 198.79 and the route would still clip it by 0.021 m.
    //
    // WHAT IT USED TO COST, AND WHY THAT WAS THE REGRESSION (item 298): with
    // `CAL_STAND_DX = 0.60` the page hung 0.60 m to the RIGHT of this point, so
    // reading it meant standing beside it and looking sideways — and a player
    // who did the obvious thing and walked square up to the page was inside the
    // door's `onIt` disc, where the door wins outright. *"i can t look at the
    // calendar if im looking right at it."* The offset is now ZERO and `CAL_X`
    // above carries the move, so the two are the same column of air by
    // construction and cannot drift apart again.
    //
    // ⚠ THE FIGURES BELOW ARE COPIED, NOT IMPORTED, AND THAT IS A REPORTED DEBT.
    // `ROOM_STAND_X`/`STAND_Z` are locals of the walk-up's door block ~2,350
    // lines above (`ct/apartment.ts:1298`), and the bed seat is a local of the
    // flat's own block. Hoisting the three into module scope is a refactor of a
    // file this item does not otherwise touch, so the figures are derived here
    // with their citation and `scripts/standpoint-overlap.mjs` fails
    // if the world ever disagrees with them. See the handoff note.
    // STILL ZERO, and now it is zero for a good reason rather than a forced
    // one. Item 298 set it to zero by dragging the PAGE onto the only patch of
    // floor the door had left standing; item 308 moved the door instead, so the
    // page is where the user asked and the stand-point is under it. You walk
    // square up to the calendar and read it.
    const CAL_STAND_DX = 0;
    // ── THE 0.90 m IS NOT TASTE, IT IS THE NEAREST FLOOR THERE IS ───────────
    //
    // I tried 0.55 m first, to cover a pose the grid said was still failing
    // ("square on, 0.40 m off the wall -> close the door"), and **the walk
    // proved that pose does not exist.** The TV crate below the page occupies
    // x 198.25…198.63 / z -17.85…-17.47, and padded by the player's own RADIUS
    // it forbids everything south of z -17.11 in this column. 0.55 m puts the
    // stand-point INSIDE that box: nobody can stand on it, and a player holding
    // W is slid around the crate into the door's corner instead — walked, he
    // ended at (199.29, -17.64) reading *"close the door"*, which is the very
    // bug this item is about, reintroduced by the fix for it. A stand-point
    // inside a collider is worse than one in the wrong place: it fails silently
    // and the grid still scores it green, because `pickSpot` is asked about
    // poses and knows nothing about which poses are reachable.
    //
    // SO NOTHING CAN BE READ FROM CLOSE TO THIS WALL, and that is a property of
    // the room rather than of the calendar. Measured off `__ct.colliders()`: the
    // only standable floor within 0.80 m of the south wall is x 198.99…199.49 —
    // the strip between the crate and the east wall — and it USED TO BE
    // entirely inside 301's door `onIt` disc (x 199.00…199.72, z -17.82…-17.10).
    // Every other column is dresser or crate.
    //
    // ── AND THE DOOR IS BACK IN THAT CORNER, SO THE SPOT IS SQUEEZED (item 309)
    //
    // The user asked for the calendar AND the old door: *"i liked it how it was
    // before i just want the calendar back to the right tho. with the radius
    // for all these things a bit less."* Item 308's answer — move the door —
    // is undone. What is left to place is this one point, and it is boxed in on
    // three sides at once. All four figures below were SCANNED at 2 cm on the
    // running world by `scripts/probes/w134-301-column.mjs`, not derived on
    // paper; the paper version was right about the shape and wrong about two of
    // the numbers.
    //
    //   · THE DOOR'S OWN `ON_IT` DISC owns the floor from the wall out to
    //     0.70 m in this column. The door's stand-point is 0.46 m off the south
    //     wall and 0.16 m east of the page's centre line, so a disc of radius
    //     `ON_IT` about it covers the whole approach up to that distance, and
    //     inside it tier 1 hands you the door with no aim test and no regard
    //     for rank. **Nothing hung on this wall can be read from closer than
    //     0.70 m, and that is the price of the corner.** It is 0.08 m better
    //     than it was — item 309's world-wide trim took `ON_IT` from 0.36 to
    //     0.288, which is exactly what moved this edge from 0.78 m to 0.70 m.
    //   · IT MUST BE OUTSIDE THAT DISC ITSELF, which is the bound that fixes
    //     this number. At 0.205 m north of the door's stand-point the band was
    //     0.70-0.94 m and perfectly usable, and `scripts/standpoint-overlap.mjs`
    //     still failed *"at the calendar, facing it"* — because the spot's OWN
    //     centre was 0.260 m from the door's, inside `ON_IT`, so warping onto it
    //     and facing the page gave *"close the door"*. A reading spot you cannot
    //     read from is the whole complaint, restated. 0.28 m north puts it
    //     0.322 m away, clear by 0.034 m.
    //   · THE WALL stops you 0.32 m off it, and the TV crate forbids every
    //     column west of 198.99.
    //
    // SO THE SPOT SITS 0.28 m NORTH OF THE DOOR'S STAND-POINT, at (199.20,
    // -17.175). The band it opens is **0.70-1.02 m off the wall**, which
    // contains `CAL_STANDOFF` (0.73 m, the distance this panel's own camera ease
    // derives from the page's height) — i.e. exactly where a person stands to
    // read it. Walk closer than 0.70 m and the door takes the prompt back.
    //
    // ⚠ AND IT COSTS 0.36 m OF THE WAY OUT, WHICH IS NOT HIDDEN. The bed's
    // approach and the door's stand-point are 1.27 m apart and the line between
    // them passes within 0.03 m of this column, so this disc hangs over the
    // route you walk to leave; where it sticks out past the DOOR's disc, `onIt`
    // offers *"read the calendar"* mid-stride. Scanned at 2 cm: the prompt is
    // the calendar from 0.29 to 0.65 m from the door, and the door for the last
    // 0.29 m — so you still ARRIVE on the door, which is where you stop and
    // press. **The band and the hole trade 1:1** (spot at +0.205 -> band 0.24 /
    // hole 0.24; at +0.28 -> band 0.32 / hole 0.36), because both are the part
    // of this disc that sticks out past the door's, and the two bounds above are
    // mutually exclusive: no z makes both `standpoint-overlap`'s 0.40 m pose and
    // its "at the calendar" pose green at once. The only thing that removes the
    // trade is moving the DOOR — item 308, which the user asked to have undone.
    //
    // ⚠ DERIVED FROM THE DOOR, NOT TYPED. `DOOR_PIV_X/Z` are the `let`s the
    // walk-up's door block writes ~2,600 lines above, and this block runs after
    // it, so re-hanging 301's door carries this spot with it. The 0.205 is the
    // one figure here that is a search result rather than an identity; the
    // probe above re-runs the search and fails if it stops being the answer.
    const D301_STAND_Z = DOOR_PIV_Z - H301 * 1.45;
    ctx.spot({
      x: CAL_X - CAL_STAND_DX, z: D301_STAND_Z + 0.28, r: 0.60, obj: cal,
      // AIM AT THE PAGE, which is where the player is looking when he reads it —
      // the same two numbers `cal.position.set` uses above, not a second copy.
      aimX: CAL_X, aimZ: SOUTH_Z,
      ok: () => ctx.player.x() > 100 && Math.abs(lastGy - 2 * ST) < 0.5,
      label: () => 'read the calendar',
      act: openCalendar,
    });
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
    // ── 301'S COLLISION, FITTED TO THE MESHES IT STANDS FOR ──────────────────
    //
    // The user, 2026-08-04: *"make the collision on the object in the apt match
    // the actual geometry of the objects. i want to be able to jump onto the
    // bed, dresser, etc"*
    //
    // TWO SEPARATE FAULTS, and the second one is the whole ask.
    //
    // **THE WALLS STOPPED YOU AT THEIR CENTRELINES, NOT THEIR FACES.** All three
    // of R301's walls are 0.14 m boxes and the colliders below were typed to the
    // centreline, so 0.07 m of every wall in this room was walk-into-able
    // plaster. The faces are not guessed here — each is already named in this
    // file by something that has to hang flush on it: the west wall's span is
    // `-3.270..-3.130` (the window-reveal note ~line 2244), and `NORTH_Z`'s own
    // comment says `AZI(5.5)` is a CENTRELINE with the box 0.14 deep, which puts
    // the north face at `AZI(5.43)` and — by the same 0.07 — the south face at
    // `AZI(2.07)`, which is exactly the plane `SOUTH_Z` hangs 0.015 proud of.
    // The OUTER edge of each box is left where it was: nothing stands out there,
    // and thinning a wall is how you open a hole into the unmodelled half of the
    // building. The room loses 0.07 m on three sides and keeps 3.13 m of width
    // against a rig that needs 0.72 — the open band at z 2.65…4.40 is interior
    // and is not touched at all.
    //
    // **AND EVERY STICK OF FURNITURE WAS A WALL EXTRUDED TO INFINITY.** That is
    // the half he is asking for. The FOOTPRINTS were already honest — I
    // re-measured all five against the `box()` calls that draw them (bed frame
    // 2585, radiator 2570, dresser 2853, crate 2881, chair 3546) and four of the
    // five were exact — but a collider with no `maxY` blocks you at every
    // height, so a 0.36 m milk crate stopped you as dead as the wall behind it
    // and there was no top to land on.
    //
    // `fp.ts` HAS CARRIED THE MECHANISM SINCE THE CAR ROOFS SHIPPED, and nothing
    // in this flat had ever opted in. `standTop()` stands you on any collider
    // that declares a `maxY` once your feet are already within `TOP_EPS` (0.08)
    // of it, and `blocked()` stops treating that collider as a wall at the same
    // instant; `escapeFrom()` exempts it too, so resting on a top does not read
    // as being wedged in it. So this is one number per object, taken from the
    // top face of the mesh — not a new system.
    //
    // ⚠ WHAT THE HOP REACHES IS 0.475 m — fp.ts's jump block, the HARD FLOOR at
    // `main.ts`'s dt clamp, rising to ~0.538 m at 60 fps. Plus `TOP_EPS` that
    // makes **0.555 m the highest surface anything can climb from the floor**,
    // and only 0.475+0.08 = 0.555 is safe to rely on. Bed (0.45), chair (0.46)
    // and crate (0.36) are under it. The radiator (0.61), the TV (0.81) and the
    // dresser top (0.82) are OVER it and are reachable only by hopping bed ->
    // radiator -> dresser. **Raising the jump is the user's call and is not made
    // here**; v0 4.0 -> 5.0 would put 0.82 m in reach at the clamp, and it would
    // re-time every kerb, stoop and car roof in the world.
    sevColliders.push(
      { minX: AX(-3.35), maxX: AX(-3.13), minZ: AZI(2), maxZ: AZI(5.5) },
      { minX: AX(-3.13), maxX: AX(0), minZ: AZI(1.85), maxZ: AZI(2.07) },
      { minX: AX(-3.13), maxX: AX(0), minZ: AZI(5.43), maxZ: AZI(5.65) },
      // ── the furniture: footprint from the mesh, `maxY` from its top face ──
      // The bed's box IS the frame (1.90 x 0.92 at RY+0.13, line 2585) and the
      // top is the MATTRESS, 0.19 thick centred at RY+0.355 — you stand on the
      // ticking, not on the rail. The blanket heaped over the foot rises to
      // RY+0.665 and is deliberately NOT the height: you sink into a duvet, and
      // 0.665 is over the hop anyway, so taking it would make the bed he named
      // unclimbable.
      { minX: AX(-3.05), maxX: AX(-1.15), minZ: AZI(4.40), maxZ: AZI(5.32), maxY: RY + 0.45 },  // bed
      // cast iron, 0.58 tall on RY+0.32. Only 0.16 m deep, so the standable
      // strip is genuinely that narrow — `standTop` pads nothing, which is
      // right: a roof does not extend past its own edge.
      { minX: AX(-3.10), maxX: AX(-2.94), minZ: AZI(3.25), maxZ: AZI(4.25), maxY: RY + 0.61 },  // radiator
      // SPLIT, because the drawer that never shuts is 0.28 m lower than the
      // carcass and the old single box claimed the whole column was solid to
      // the dresser's top — i.e. it let you stand on 0.17 m of thin air over an
      // open drawer, which is the exact complaint. Carcass 0.70 x 0.50 x 0.82
      // (2853); drawer bottom RY+0.355, front 0.20 tall centred on RY+0.44, so
      // its lip is RY+0.54, standing out to DZ1 + half its 0.035 front.
      { minX: AX(-3.00), maxX: AX(-2.30), minZ: AZI(2.12), maxZ: AZI(2.62), maxY: RY + 0.82 },  // dresser carcass
      { minX: AX(-2.96), maxX: AX(-2.34), minZ: AZI(2.62), maxZ: AZI(2.81), maxY: RY + 0.54 },  // its open drawer
      // ONE BOX FOR THE STACK, at the TV's footprint rather than the crate's.
      // The set is WIDER than the thing it stands on — CASE_W 0.52 against a
      // 0.38 crate — so the old box left 0.07 m of cabinet hanging in the air on
      // each side that you walked straight through, and standing on the crate at
      // 0.36 would have put you inside the picture tube. The crate's footprint
      // is entirely contained in this one, so a second box would add nothing.
      // Top is the case: TV_Y (RY+0.58) + CASE_H/2.
      //
      // ⚠ IT COSTS THE CALENDAR 0.07 m OF ITS APPROACH COLUMN and does not break
      // it: this box's padded east edge moves 198.976 -> 199.046 world, and the
      // calendar's stand-point is at x 199.20, so the margin goes 0.224 -> 0.154
      // and the 0.70-1.02 m reading band is in z and is untouched.
      { minX: AX(-1.82), maxX: AX(-1.30), minZ: AZI(2.14), maxZ: AZI(2.53), maxY: RY + 0.81 },  // crate + TV
      // clear of 301's arc. Footprint is the pan and the four legs (3546-3548),
      // 0.02 tighter all round than the box that was here. Top is `PAN_TOP` —
      // the yesterday's-clothes bundle sits on the pan and you stand in it.
      // ⚠ THE BACKREST IS NOT A SECOND BOX ON PURPOSE. It is a 0.05 m panel
      // running to RY+0.92, and a box that tall padded by RADIUS covers the
      // whole seat pan — declaring it would make the chair unstandable, which
      // is the opposite of the ask. The cost is that once you are up on the
      // seat you can walk through 5 cm of chair back.
      { minX: AX(-0.93), maxX: AX(-0.51), minZ: AZI(4.92), maxZ: AZI(5.32), maxY: RY + 0.46 },  // chair
      // 301's leaf, standing open against the wall — a door is solid even
      // when it is open. Safe on every floor: west of AX(0) is only ever
      // reachable through 301's opening, which aptDoorCap gates to floor 3.
      // it stops SHORT of the opening (3.98 vs the jamb at 3.975) so the
      // doorway keeps its full 0.95 m clear — the door is solid, but it must
      // not be the thing that narrows the gap you walk through
      //
      // ⚠ ON THE +z SIDE, BECAUSE THE HINGE IS. This box was AZI(2.10)-AZI(3.02)
      // and stayed there when the pivot moved to the +z jamb (line ~1233,
      // `hingeSide('301') = +1`). A collider is not carried by the mesh — it is
      // typed out here, a second time, in the units of a room rather than of a
      // door — so mirroring the leaf left the box behind, and neither half
      // complained. What the player got was a box of solid air a metre south of
      // his own front door and an open leaf he could walk straight through, in
      // the flat he spawns in.
      //
      // Measured on the built bundle rather than derived: the open leaf's world
      // AABB is x 199.580-199.932, z -16.011..-15.040 (pivot 199.910,-16.005,
      // rotation.y 1.3208 = DOOR_A_OPEN); the old box was z -17.900..-16.980,
      // disjoint from it, on the far side of a doorway that runs -16.975 to
      // -16.025. Same 0.92 m length and same x band as before — this is the
      // mirror the hinge move owed, not a new shape.
      { minX: AX(-0.34), maxX: AX(-0.03), minZ: AZI(3.98), maxZ: AZI(4.90) },
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
      x: ENTER_X, z: DOOR_Z, r: ENTER_R, rank: WAY_OUT,
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
      x: AX(1.2), z: AZI(0.4), r: 0.95, rank: WAY_OUT,
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
    actorColliders: sevActors,
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

import * as THREE from 'three';
import type { AABB } from '../fp';
import { BUILD, ORDER as HOOK, type CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { frontageOf, frontageWorld, alongU } from './tex-world';
import { doorWorldFor, doorStandFor, doorPointFor, roomWidthFor, doorLeafFor, type DoorLeaf } from './doors';
import { LEAF_AJAR } from './vice';   // item 193: the one door angle
import { citizenSprite, type Look } from './citizens';
import { clockFace } from './clockface';
import { FACE } from './rng';

// ── the interior kit ──────────────────────────────────────────────────────
//
// Ten interiors were asked for at once — burger barn, diner, library, tax
// service, pawn shop, bodega, thrift, room 301, casino, hotel — and they are
// being built by different agents in parallel. Two things would go wrong
// without a shared kit, and both are fatal to a world whose whole value is
// that it looks MADE rather than generated:
//
//   1. Ten different room shells. Every builder would pick their own ceiling
//      height, their own doorway width, their own way of getting you back out
//      to the street. You would feel it immediately as ten unrelated games.
//   2. Ten builders colliding in world space. Interiors are not inside their
//      buildings — they are rooms parked far out along +x that you teleport
//      to. Two agents both choosing "somewhere past 300" silently overlap and
//      you walk out of the diner into the pawn shop.
//
// So this module owns BOTH: it hands out addresses, and it builds the shell.
// A builder calls `buildRoom` and gets back a room already wired to the
// street — door in, door out, colliders, floor height — and then furnishes it
// in LOCAL coordinates without ever knowing where in the world it stands.
//
// It also settles a standing complaint by construction. The user, on the
// walk-up: *"i need a door and not paper thin walls"*. Interior walls here
// are boxes with real thickness, and every opening is framed with jambs and a
// header, so a doorway has a visible reveal you walk THROUGH. There is no way
// to get a paper wall out of this kit, which is the point of having one.

// ── addressing ────────────────────────────────────────────────────────────
//
// x < 100 is the street. 100–230 is the walk-up, 230–260 the old bodega room;
// both predate this kit and keep their addresses. New interiors start at 400
// and take a 80 m slab each — far wider than any room, so there is dead space
// between neighbours and no chance of a stray collider or an overshooting
// teleport landing you in the wrong shop.
const SLAB_X0 = 400, SLAB_W = 80;

/** wall thickness. A wall is a BOX, not a plane — see "walls, with THICKNESS"
 *  in `buildRoom`. Hoisted out of that function because the party-wall
 *  addressing below has to know it before a room is built: two rooms meet by
 *  each leaving exactly one wall's worth of slab on the shared side. */
const WALL_T = 0.18;

// ── party walls: the ONE case where two rooms are not alone in the world ──
//
// The user: *"make it a combo orpheus hotel and casino. connect them internally
// and outside. i should be able to walk from one into the other."*
//
// Everything above is built on rooms being ISLANDS — a slab each, 80 m wide,
// 69 m of dead ground between the nearest walls of neighbours, which is exactly
// what makes a stray collider harmless. A room you can walk out of into another
// room is the one thing that arrangement cannot express, and worker sixtythree
// measured the consequence: the hotel and the casino were 229 m apart with the
// church and the diner parked between them, so "walk from one into the other"
// had no geometry to happen in at all.
//
// This is the smallest thing that makes it real, and it is deliberately a
// PAIRING rather than a per-room setting:
//
//   1. the two rooms are given CONSECUTIVE slabs (`buildAllInteriors` reorders
//      for it), so there is a slab boundary between them and nothing else;
//   2. each is SHOVED to that boundary instead of sitting centred in its slab,
//      leaving exactly `WALL_T` — so their flank walls meet back to back and
//      the party wall is one 0.36 m thickness standing ON the boundary;
//   3. one opening is cut through BOTH flanks, at one declared z.
//
// Point 3 is why this is a pairing. An opening is a single fact shared by two
// rooms; authored once in each file it is the two-authorings defect this
// project has paid for over and over (BUILDER-BRIEF §8) — and the failure mode
// is a hole in one room facing solid plaster in the other. Declared here, the
// rooms say nothing and cannot disagree.
//
// The boundary lands INSIDE the party wall, which matters for one thing that is
// not obvious: `interiorGround` dispatches on the slab a point falls in, so the
// two rooms answer for their own floors right up to the wall and the seam is
// buried in masonry — except in the doorway itself, where the player crosses
// it. Both rooms in this pair are flat, so the crossing is level; a pair where
// one room has `floor` levels must match heights at the opening.
export interface PartyWall {
  /** the two rooms this wall joins, in NO significant order. Which of them ends
   *  up west is DERIVED — see `handedness` below and `west`/`east`. */
  rooms: readonly [string, string];
  /** the room in the LOWER slab — its EAST flank carries the opening.
   *  **Derived from the street, never typed.** */
  readonly west: string;
  /** the room in the NEXT slab up — its WEST flank carries the opening.
   *  **Derived from the street, never typed.** */
  readonly east: string;
  /** centre of the opening in ROOM-LOCAL z. Both rooms sit on cz = 0, so one
   *  number addresses both of them. */
  at: number;
  /** clear width of the opening */
  w: number;
  /** clear height. Clamped per room to `H - 0.2`, so the shorter of the two
   *  ceilings wins on its own side without the taller room losing its head. */
  h: number;
}

/**
 * THE HEADING YOU ARRIVE ON when you walk into a belt room, and the reason the
 * handedness below can be computed at all.
 *
 * Hoisted out of `buildRoom`'s `spec.arriveYaw ?? 0` so the arrival convention
 * and the code that reasons about it are ONE authoring. If a room ever needs a
 * different default, `handedness` stops being valid for a pair containing it
 * and `assertArrivalConvention` (called from `buildRoom`) says so out loud.
 */
const ARRIVE_YAW = 0;

/**
 * WHICH OF A PAIR IS WEST — measured off the street, never typed.
 *
 * ── THE BUG THIS REPLACES ────────────────────────────────────────────────────
 * The user, for the third time in this class: *"the hotel is the right of the
 * casino outside but to the left inside. again these interior exterior
 * mismatch."* He was right, and the reason was written down here as an argument:
 *
 *   > *"a room is its facade seen from behind, so what is on your left outside
 *   > is on your right once you are inside (the `localOf` mirror)."*
 *
 * **There is no such mirror, and `localOf` is not one.** Interiors are not
 * behind their facades — they are parked in a belt 800 m away with their own
 * axes and you arrive by TELEPORT, so the arrival heading decides and nothing
 * else does. (`localOf`'s `side` factor converts between the two sides of the
 * STREET; check it on the east side, where greater z is on your right outside
 * and greater local x — also your right — inside. It preserves the hand. The
 * comment cited it for the opposite of what it does.)
 *
 * ── THE DERIVATION ───────────────────────────────────────────────────────────
 * The rig's convention (`crosstown.ts`): fwd = (sin yaw, 0, −cos yaw), so with
 * up = +y, left = up × fwd = (−cos yaw, 0, −sin yaw).
 *
 *   OUTSIDE  you face the shopfronts, i.e. along the INWARD normal −n of the
 *            frontage, which `ct/doors.ts` publishes per building.
 *   INSIDE   you arrive on `ARRIVE_YAW`, so left is fixed and known.
 *
 * A pair must present the same hand on both sides. So: take the direction from
 * one room's door to the other's along the street, ask which hand it is on
 * facing −n, and require the same hand of the belt's +x direction facing
 * `ARRIVE_YAW`. Whichever room that puts on the LEFT inside is the one in the
 * LOWER slab, because inside-left is −x when `ARRIVE_YAW` is 0.
 *
 * ── WHY IT IS LAZY ───────────────────────────────────────────────────────────
 * `doorPointFor` is `ct/doors.ts`'s registry, collected from an eager glob of
 * `./int-*.ts`. Forcing that collection while THIS module is still evaluating
 * is the cycle that silently dropped SEVENS from the built bundle once already
 * (GOTCHAS 28, and the long note over `MODS` in `ct/doors.ts`). So `west`/`east`
 * are getters: nothing reads them until `buildAllInteriors` runs, by which time
 * `publishDeclaredDoors()` has long since collected everything.
 */
/**
 * Every interior module, eagerly. Hoisted to module scope so `buildAllInteriors`
 * and `buildingOfRoom` share ONE glob — two globs of the same pattern is two
 * authorings of the belt's membership, and the second one would be the one that
 * goes stale. The import edges this creates are the same ones
 * `buildAllInteriors` has always had; only the READS are new, and they are all
 * lazy for the reason given over `handedness`.
 */
const INT_MODS = import.meta.glob<Record<string, unknown>>('./int-*.ts', { eager: true });

/**
 * The roster name of the building a belt room sits in — `'hotel'` →
 * `'HOTEL ORPHEUS'`.
 *
 * Read off the room's OWN `DoorDecl`, which is the same object `ct/doors.ts`
 * keys its registry by, so this cannot name a building the door registry has
 * never heard of. Not a second table: `int-<id>.ts` builds the room whose id is
 * `<id>` is a convention `scripts/interiors-wired.mjs` already enforces, so the
 * filename is the join and there is nothing to keep in step.
 */
function buildingOfRoom(id: string): string | null {
  const d = INT_MODS[`./int-${id}.ts`]?.DOOR as { building?: string } | undefined;
  return typeof d?.building === 'string' ? d.building : null;
}

const HANDED = new Map<string, readonly [string, string]>();

function handedness(rooms: readonly [string, string]): readonly [string, string] {
  const key = rooms.join('|');
  const done = HANDED.get(key);
  if (done) return done;

  const pts = rooms.map((id) => {
    const b = buildingOfRoom(id);
    return b ? doorPointFor(b) : null;
  });
  const [p0, p1] = pts;
  if (!p0 || !p1) {
    // NOT a silent fallback. A party wall whose handedness cannot be derived is
    // the exact defect this function exists to end, so it is loud — `bugsweep`
    // reports console errors and will go red rather than quietly re-typing it.
    console.error(`[interior] party wall ${key}: cannot read a door point for `
      + `${rooms.filter((_, i) => !pts[i]).join(' and ')} — handedness NOT derived, `
      + `falling back to declaration order. See ct/interior.ts handedness().`);
    return rooms;                                  // uncached: a later call retries
  }
  if (p0.nx !== p1.nx || p0.nz !== p1.nz) {
    console.error(`[interior] party wall ${key}: the two buildings face different ways `
      + `(${p0.nx},${p0.nz}) vs (${p1.nx},${p1.nz}) — there is no shared street to `
      + `derive a handedness from.`);
    return rooms;
  }

  // OUTSIDE: facing the inward normal, fwd = −n. Substituting into
  // left = (−cos yaw, 0, −sin yaw) with fwd = (sin yaw, 0, −cos yaw) gives
  // left = (fwd_z, 0, −fwd_x) = (−n_z, 0, n_x).
  // Check it on this street: n = (0, −1) gives left = (+1, 0) = +x, and facing
  // +z along the side street your left hand IS +x. (The first draft of this
  // line had the sign the other way and the after-verdict came back identical
  // to the before — which is what an instrument is for.)
  const lx = -p0.nz, lz = p0.nx;
  // is rooms[1] on rooms[0]'s LEFT out on the pavement?
  const oneIsLeftOutside = (p1.x - p0.x) * lx + (p1.z - p0.z) * lz > 0;
  // INSIDE: left facing ARRIVE_YAW, projected on the belt's +x — which is the
  // only axis the slabs run along.
  const beltPlusXIsLeftInside = -Math.cos(ARRIVE_YAW) > 0;
  // rooms[1] must be on the same hand inside. If its hand inside is LEFT and
  // belt +x is NOT left, then rooms[1] belongs at the LOWER x, i.e. west.
  const oneIsWest = oneIsLeftOutside !== beltPlusXIsLeftInside;
  const out = (oneIsWest ? [rooms[1], rooms[0]] : [rooms[0], rooms[1]]) as [string, string];
  HANDED.set(key, out);
  return out;
}

/** A party wall, with its handedness derived on first read rather than typed. */
function partyWall(rooms: readonly [string, string], at: number, w: number, h: number): PartyWall {
  return {
    rooms, at, w, h,
    get west() { return handedness(rooms)[0]; },
    get east() { return handedness(rooms)[1]; },
  };
}

/**
 * Every party wall in the world. There is one.
 *
 * The PAIR is authored; **which of them is west is not** — see `handedness`.
 * Typing it is what item 268 was: the declaration said `hotel` west of `casino`
 * and the street says the opposite, and nothing could ever have caught the
 * disagreement because the two facts had no common source.
 *
 * `at: -9.0` is measured, not chosen: `scripts/probes/w70-party-wall-clearance.mjs`
 * projects every collider within 1.6 m of each flank onto z and intersects the
 * gaps. The only run clear in BOTH rooms wide enough for a doorway and a 2 m
 * lane either side is local z −13.00 … −4.85, and −9.0 is its middle.
 */
export const PARTY: readonly PartyWall[] = [
  partyWall(['hotel', 'casino'], -9.0, 2.6, 2.6),
];

/** the party wall this room is half of, if any */
function partyFor(id: string): PartyWall | null {
  return PARTY.find((p) => p.rooms.includes(id)) ?? null;
}

interface Slab {
  id: string; x0: number; x1: number; gy: (x: number, z: number) => number | null;
  /** the room's RESOLVED size and centre — not what the spec asked for.
   *
   *  `W` is `spec.w ?? roomWidthFor(frontage)`, so a room that leaves it to the
   *  kit has no width anywhere in its own file. scripts/interiors-walk.mjs used
   *  to hand-carry a copy per room; the pawn shop then dropped its explicit
   *  `w: 10.0` and the harness went on believing it, reporting three escapes
   *  from a room that was holding the player in perfectly well at 13.8 m. Two
   *  authorings of one number, which is the same defect the door declarations
   *  exist to kill. Published so a harness can ASK. */
  w: number; d: number; cx: number; cz: number;
  /** WHERE THE DOORWAY ACTUALLY IS, in room-local metres, with the inward
   *  normal. Published because a harness that ASSUMES the front wall cannot
   *  follow a door round a corner: the bodega's belongs in its cut face, and
   *  five checks located it from the front wall and went red on a room that was
   *  correct. Same fix as `w`/`d` — the room states it, nobody remembers it. */
  door: { x: number; z: number; nx: number; nz: number };
}
const SLABS: Slab[] = [];

/**
 * Every collider every room has registered, in one list.
 *
 * The belt owns this so that adding a room does not mean adding a line to the
 * collider array in `crosstown.ts`. That array is in the most-contended file
 * in the project (GOTCHAS §11); ten rooms would have meant ten separate edits
 * to it, each one a merge conflict waiting for whichever builder landed
 * second. Now the entry point spreads this once and never changes again.
 */
const BELT_COLLIDERS: AABB[] = [];
export function interiorColliders(): AABB[] { return BELT_COLLIDERS; }

/**
 * The east edge of the world, which is the east edge of the LAST slab actually
 * claimed. It has to be derived rather than fixed: a constant sized for the
 * sixteen rooms we might one day build would leave the player free to walk a
 * kilometre of dead ground east of the bodega, which is how you discover the
 * world has no back wall. Call this after every room is built.
 */
export function interiorMaxX(): number {
  return SLAB_X0 + Math.max(1, SLABS.length) * SLAB_W;
}

/**
 * The far Z edge of the interior belt — how deep the DEEPEST room reaches.
 *
 * `crosstown.ts` bounds the player with `maxZ: 13`, which is the end of the
 * STREET. Rooms sit centred on z 0, so a room deeper than 26 m has `hd > 13`
 * and the player is clamped SHORT OF ITS OWN FRONT WALL — you can enter it and
 * not leave it on foot, because the way-out spot sits at `hd - 0.55`, past the
 * bound.
 *
 * Builder G measured it exactly (BLOCKED-G 1b): the casino at d 30 comes to
 * rest at 13.00 against a spot beginning at 13.40, while the hotel at d 26
 * reaches its wall and is fine. That is not a depth ceiling, which is what the
 * rule they first reached for said — it is this constant, and 26 m is simply
 * where a room stops fitting inside the street's bound.
 *
 * The X bound has always asked the belt how wide it is. This is the same
 * question on the other axis, and it was missing.
 */
export function interiorMaxZ(): number {
  let far = 0;
  for (const s of SLABS) far = Math.max(far, s.cz + s.d / 2);
  return far + 1.0;                 // clear of the front wall and its threshold
}

/**
 * Floor height inside the interior belt, or null if this point is not in any
 * room. `crosstown.ts` consults this before its own street logic — a room
 * owns the floor within its slab, so a builder can put a step or a mezzanine
 * in without the entry point knowing anything about it.
 *
 * Null, not 0, for the dead space BETWEEN slabs: answering 0 there would be
 * this module claiming ground it does not own, and the answer would be wrong
 * the day a room sits on a raised floor next to it.
 */
/** The id of every room that actually got built **by this kit**, in slab order.
 *
 *  SLAB-ONLY, DELIBERATELY, and it is not the same question as `interiorRooms`
 *  below. This one answers *"did `int-<id>.ts` build its room?"* — it is what
 *  `scripts/interiors-wired.mjs` and `scripts/world-wired.mjs` check the
 *  `int-*.ts` glob against, and what `ct/civic-doors.ts` matches a door's
 *  building name to. A room that has no `int-*.ts` file has nothing to be
 *  wired to, so listing it here would be answering a question nobody asked
 *  with a name that cannot be checked. */
export function interiorRoomIds(): string[] { return SLABS.map((s) => s.id); }

/** a room's resolved geometry as the world publishes it: clear size wall face
 *  to wall face, world centre, and the doorway in ROOM-LOCAL metres with its
 *  inward normal. */
export interface RoomDims {
  id: string; w: number; d: number; cx: number; cz: number;
  /**
   * THE HEIGHT OF THE ROOM'S FLOOR. Zero for every room in the belt, which is
   * why nothing published it until a room off the belt joined the registry.
   *
   * `__ct.warp(x, z, yaw, gy, pitch)` needs it: `gy` is the floor the walk-up's
   * multi-storey picker is told it is on, and a harness that passes 0 — as
   * `scripts/bugsweep.mjs` does for all twelve belt rooms, correctly — puts the
   * camera at street level under a flat three storeys up. Measured: the three
   * `bug-apt301-*` stations land on the right x and z, pass `verifyLanded`,
   * which only checks x and z, and photograph the outside of the building.
   *
   * So the registry states it and a caller uses `r.y` instead of a literal. It
   * is the same argument as `w`/`d`/`door`: the room knows, nobody else should
   * have to remember.
   */
  y: number;
  door: { x: number; z: number; nx: number; nz: number };
  /**
   * IS THIS ROOM A SLAB IN THE INTERIOR BELT, reached by pressing `[E]` at a
   * door on the street?
   *
   * This exists because `roomDims()` quietly became TWO registries answering
   * TWO questions, and one caller could not tell them apart.
   *
   * `interiorRooms()` used to mean "every kit room in the belt" — flat at y 0,
   * centred on an 80 m slab at x >= 400, cz 0, entered from the pavement. Every
   * harness that reads it was written against those four facts. Then `apt301`
   * declared itself here (correctly — `scripts/seat-facing.mjs` keys entirely
   * off this registry and the bed in 301 was being classified `outdoor`), and
   * the list stopped meaning that. The flat is at cx 198.4, cz -16.25, y 5.4,
   * three storeys up a stair shaft with no street door at all.
   *
   * `scripts/interiors-walk.mjs` has a coverage guard that refuses to run when
   * the world publishes a room its hand-written `ROOMS` list does not test —
   * a good guard, and the reason the bank and the library got tested at all.
   * But it was asking `roomDims()` for "rooms I must street-walk" and getting
   * back "rooms that exist", so `apt301` made it exit 2 for EVERY room, and
   * `scripts/checks.mjs` rendered that as a wall of twelve room failures. The
   * check could not start, and printed as though the world were broken.
   *
   * So the registry states which question each room answers instead of making
   * callers guess from `cx >= 400`. The distinction is not new — it is the one
   * `DECLARED` was created for, and the one `interiorRoomIds()` above already
   * makes for its own different question. It was simply never published.
   */
  belt: boolean;
}

/**
 * ROOMS THAT WERE NOT BUILT BY THIS KIT, but are rooms all the same.
 *
 * The addressing note at the top of this file records that the walk-up (x
 * 100–230) predates `buildRoom` and keeps its own address — it is a
 * four-storey building with a stair shaft, not a slab, so it cannot become one
 * without rewriting `ct/apartment.ts` around a kit that has no concept of
 * storeys. That was fine while `interiorRooms()` was only ever asked "where
 * are the shops". It stopped being fine the moment instruments started using
 * it as *the* room registry:
 *
 *   `scripts/seat-facing.mjs` keys entirely off `roomDims()`. Rule A needs the
 *   room's w/d/cx/cz to find the wall a seat's nose is pointed at, and rule B
 *   is skipped outright for a seat whose `roomOf()` comes back null. So the
 *   bed in flat 301 — the seat the player uses most, in the room he spawns in
 *   — was classified `outdoor` and neither rule has ever run on it, on a check
 *   that had just caught 105 backwards seats everywhere else.
 *
 * A room declares itself here and `interiorRooms()` returns it alongside the
 * slabs. What it does NOT get is a slab: `interiorGround`, `interiorMaxX` and
 * `interiorMaxZ` stay slab-only, because those three are about the belt out at
 * x >= 400 — the walk-up owns its own multi-storey floor picker (`aptGround`)
 * and sits 200 m west of the belt's first slab. Pushing it into `SLABS` to get
 * it into the registry would hand its ground to a one-height `gy` and shove
 * the world's east bound 80 m further out.
 */
// `Omit<…, 'belt'>`: a room does not get to SAY whether it is in the belt.
// Declaring yourself here is what makes you off-belt, so `interiorRooms()`
// derives the flag and a caller cannot contradict it.
const DECLARED: Omit<RoomDims, 'belt'>[] = [];
export function declareRoom(r: Omit<RoomDims, 'belt'>): void {
  if (DECLARED.some((d) => d.id === r.id) || SLABS.some((s) => s.id === r.id)) {
    console.warn(`[interior] a room called '${r.id}' is already registered — ignored`);
    return;
  }
  DECLARED.push(r);
}

/** every built room's resolved geometry, for harnesses that would otherwise
 *  keep their own copy of it going stale. Kit rooms (see `Slab`) plus the ones
 *  that declared themselves (see `DECLARED`). */
export function interiorRooms(): RoomDims[] {
  // y is 0 for the whole belt: a slab's floor sits on the world plane and any
  // level change inside it is `spec.floor`, which is the room's own business.
  // `belt` is DERIVED from which list the room came out of, not stored on each
  // room — a room built by the kit is in the belt by construction, and a room
  // that had to `declareRoom` itself is one the kit could not express (see the
  // note above `DECLARED`). Deriving it means a new room cannot get the flag
  // wrong by typing it, and a future kit room gets `belt: true` for free.
  return [...SLABS.map((s) => ({
            id: s.id, w: s.w, d: s.d, cx: s.cx, cz: s.cz, y: 0, door: s.door, belt: true })),
          ...DECLARED.map((r) => ({ ...r, belt: false }))];
}

/**
 * Build every interior there is.
 *
 * Writing `ct/int-<name>.ts` is now SUFFICIENT to put a room in the world.
 * There is no line to add in `crosstown.ts` and therefore no line to forget.
 *
 * That mattered: the casino, the hotel and the tax office were each finished,
 * committed and unreachable, because the one-line `buildX(ctx)` construction
 * call lived in the desk-owned entry point. Builder G could not wire its own
 * rooms and nothing checked that anyone had. The auditor reported it three
 * rounds running. The kit had already removed the need to touch the entry
 * point for `[E]` spots, colliders and floors — construction was the last
 * desk-contended step, and this is it going away.
 *
 * Conventions, both enforced by `scripts/interiors-wired.mjs`:
 *   · one `export function build…(ctx)` per file
 *   · the file `int-<id>.ts` builds the room whose `spec.id` is `<id>`
 *
 * Sorted by path so slab addresses are a deterministic property of the file
 * names rather than of whatever order the bundler happened to hand them over
 * in — a room that moves slab between builds is a room whose saved position
 * means nothing.
 */
export const ORDER = BUILD.INTERIOR;

/** The world loader's entry point for the whole interior belt — see
 *  `ct/world.ts`. The belt keeps its OWN glob (`INT_MODS`, at the top of this
 *  file) because interiors carry a second convention the other modules do not:
 *  `int-<id>.ts` must build the room whose `spec.id` is `<id>`, which
 *  `scripts/interiors-wired.mjs` enforces. */
export function register(ctx: CtxBuild): void { buildAllInteriors(ctx); }

/**
 * The order rooms are built in, which is the order they take slabs in.
 *
 * Path sort, then ONE adjustment: the two halves of a party wall must land in
 * consecutive slabs or there is no shared boundary for them to meet on, so the
 * pair is lifted out and re-inserted as a west-then-east BLOCK.
 *
 * ⚠ THE BLOCK GOES WHERE THE PAIR'S **LATER** MEMBER SAT, and that is the part
 * with a reason. Item 268 re-handed this wall, and under the old rule — "lift
 * the east room and drop it after the west one" — re-handing moved the whole
 * pair to the other member's alphabetical slot and shoved every room between
 * them 80 m sideways: swapping hotel/casino would have moved the CHURCH and the
 * DINER as well, for nothing. Anchoring on the later member makes the block's
 * address a property of the PAIR rather than of which way round it happens to
 * be, so a handedness change swaps exactly two rooms and disturbs nothing else.
 * It is also a strict no-op for the pre-268 declaration — hotel and casino sat
 * in slabs 5 and 6 before this change and the pair still does.
 *
 * The result is still a pure function of the file names plus the `PARTY`
 * declaration, which is the property the path sort was there for.
 *
 * Exported so `scripts/probes/w70-*.mjs` can assert the pairing is consecutive
 * without starting a browser.
 */
export function beltOrder(paths: string[]): string[] {
  const idOf = (p: string) => (p.match(/int-(.+)\.ts$/) ?? [, p])[1] as string;
  const order = [...paths].sort();
  for (const pw of PARTY) {
    const wi = order.findIndex((p) => idOf(p) === pw.west);
    const ei = order.findIndex((p) => idOf(p) === pw.east);
    // partner absent — leave the order alone rather than inventing one
    if (wi < 0 || ei < 0) continue;
    const [west, east] = [order[wi], order[ei]];
    // where the LATER of the two sits once BOTH have been taken out
    const anchor = Math.max(wi, ei) - 1;
    const rest = order.filter((_, i) => i !== wi && i !== ei);
    rest.splice(anchor, 0, west, east);
    order.length = 0;
    order.push(...rest);
  }
  return order;
}

export function buildAllInteriors(ctx: CtxBuild): void {
  const mods = INT_MODS;
  for (const path of beltOrder(Object.keys(mods))) {
    const mod = mods[path];
    const entry = Object.entries(mod).find(
      ([k, v]) => k.startsWith('build') && typeof v === 'function');
    if (!entry) { console.warn(`[interior] ${path} exports no build…() — not built`); continue; }
    try {
      (entry[1] as (c: CtxBuild) => void)(ctx);
    } catch (e) {
      // One bad room must not take the whole world down with it. Loud, and
      // the bugsweep reports console errors, so it cannot pass unnoticed —
      // but the other nine rooms and the street still load.
      console.error(`[interior] ${path} threw while building:`, e);
    }
  }
}

export function interiorGround(x: number, z: number): number | null {
  if (x < SLAB_X0) return null;
  for (const s of SLABS) if (x >= s.x0 && x < s.x1) return s.gy(x, z) ?? 0;
  return null;
}

// ── the shell ─────────────────────────────────────────────────────────────

/** a rectangular patch of room floor at a given height, in ROOM-LOCAL metres */
export interface RoomLevel { x0: number; x1: number; z0: number; z1: number; y: number }

export interface RoomSpec {
  /** stable id, also the slab key — 'diner', 'pawn', 'casino' */
  id: string;
  /**
   * A CUT CORNER, so the room's shape matches its building's.
   *
   * The user: *"if the door for the bodega is on a cut corner (literally) then
   * the interior should match."* Right, and it is the same principle as the
   * door's position one level up — a room and its building are one object seen
   * from two sides — so it belongs in the kit rather than in one room, because
   * the bodega will not be the last cut corner on this block.
   *
   * `cut` is how far the chamfer runs back along each of the two walls it
   * crosses, in metres. The corner behind it becomes dead space the player
   * cannot reach, which is the honest way to do this additively: the diagonal
   * wall and its colliders go in TOGETHER, so what you see and what stops you
   * are the same surface. A shell rewrite would let those two disagree, and a
   * room that looks square and behaves chamfered is a worse bug than the one
   * being fixed.
   */
  /**
   * LEVEL CHANGES INSIDE THE ROOM — a stair, a chancel step, a mezzanine.
   *
   * Builder G, blocked: *"The library's STAIR needs buildRoom to accept a floor
   * function"*, for the user's ask that the library have "more halls and stair
   * ways". The kit assumed one flat floor per room.
   *
   * The mechanism already exists — `ctx.ground` is the per-site floor registry
   * the library and church EXTERIOR flights use, and the entry point dispatches
   * over it. This exposes it to a ROOM, so there is still exactly ONE floor
   * picker in the world. A second one is the thing this project has paid for
   * repeatedly.
   *
   * Two forms, both in ROOM-LOCAL metres:
   *
   *   floor: [{ x0: -2, x1: 2, z0: 3, z1: 5, y: 0.18 },   // the dais
   *           { x0: -2, x1: 2, z0: 5, z1: 7, y: 0.36 }]   // and the step up
   *
   *   floor: (lx, lz) => lz > 3 ? (lz - 3) * 0.14 : 0     // a ramp or a stair
   *
   * A LIST, not a single split, and later entries win — so a mezzanine over a
   * dais is two rows rather than a special case. Return null from the function
   * form for "not mine", exactly as `ctx.ground` does.
   */
  floor?: RoomLevel[] | ((lx: number, lz: number) => number | null);
  /**
   * Which way the player looks on arrival, in the room's own frame — 0 is
   * square into the room, which is what almost every shop wants. Set it only
   * when a room is laid out ACROSS its width rather than down its depth.
   * Derived behaviour, not a hand-typed yaw per room: see the arrival block.
   */
  arriveYaw?: number;
  chamfer?: {
    corner: 'front-left' | 'front-right' | 'back-left' | 'back-right';
    cut: number;
    /** put the DOOR in the cut face rather than in the front wall. This is the
     *  half of the user's ask that "the room is the right shape" does not
     *  cover: the bodega's door is literally on the canted bay outside, so
     *  inside it has to be in the same face. The diagonal is then built as two
     *  segments with a gap, and the colliders skip it — no diagonal `addHole`
     *  needed, because the opening is an absence rather than a cut. */
    door?: boolean;
  };
  /** the roster name of the building this room is inside, matching its
   *  `DoorDecl.building`. Only needed for a room that declares its door by
   *  `face` and therefore has no `frontage` to be named by — the side-street
   *  pair and the bodega. It is how the kit finds the published DoorLeaf. */
  building?: string;
  /** what the [E] prompt says outside: 'into the DINER' */
  label: string;
  /** clear interior size in metres, wall face to wall face. `w` is optional
   *  when `frontage` is given — the kit sizes the room off the building. */
  w?: number;
  d: number;
  /**
   * Ceiling height. 2.9 is a shop.
   *
   * Which way a room departs from that is a character decision, and it goes
   * BOTH ways. A library wants more — it is trying to feel civic. A casino
   * wants LESS: SEVENS is 2.5 m over a 1.62 m eye, because a casino is
   * built to make you lose the thread of the time, the weather and the way
   * out, and a low ceiling is how that is done in geometry. The bodega is 2.6
   * for the same reason in a different key — cramped is height as much as
   * floor area.
   *
   * This used to read "a casino or a library wants more", which sent exactly
   * the wrong signal to anyone building one and contradicted a room that
   * already existed and was right.
   */
  h?: number;
  /** floor, wall, ceiling, trim — hex ints, muted, 1997 */
  palette?: { floor?: number; wall?: number; ceil?: number; trim?: number };
  /** the way in, on the street: where you stand and press E */
  door: {
    /** Street coords of the [E] spot outside. Derived from the frontage when
     *  one is given — and it must be, because a hand-typed one cannot know its
     *  building moved. Three have: the diner's ended up outside a bank. */
    x?: number; z?: number; r?: number;
    /** where standing outside is legal — defaults to "anywhere on the street" */
    ok?: () => boolean;
    /** where you land when you step back OUT, and which way you face */
    outX?: number; outZ?: number; outYaw?: number; outGy?: number;
    /** door centre along the room's front (south) wall, in local x. 0 = middle */
    at?: number;
    /** clear door width. 1.1 is generous; the player capsule is 0.72 across */
    width?: number;
  };
  /**
   * The building this room is inside, so the kit can DERIVE the door, the
   * window and the street trigger instead of the room hand-typing them.
   *
   * The user: *"i need the facades to line up with the interior. so if the
   * door on the interior is full right then the facade must match."* They were
   * two authorings of one fact — `ct/tex-world.ts` painted a door wherever it
   * liked and each `int-*.ts` typed an offset beside it — so of course they
   * disagreed, and the auditor measured it twice. `frontageOf()` is now the
   * one authority; this reads it.
   *
   * Supplying this makes `door.at`, `door.width`, `door.x/z` and `window`
   * optional: give them anyway only to override, and expect to justify it.
   */
  frontage?: {
    /** the roster name, exactly — `frontageOf` dispatches character on it */
    name: string;
    /** the building's frontage width and centre z, from the roster */
    w: number; cz: number;
    /** -1 west (facade at x = -FACE), +1 east */
    side: -1 | 1;
  };
  /** shopfront glazing on the front wall, so the room is not a sealed box */
  window?: { at?: number; w: number; h?: number; sill?: number };
  /**
   * Tiled dado up the bottom of every wall, painted into the plaster rather
   * than modelled — a commercial room that is plaster to the floor reads as a
   * bedroom. Fast food and the tax office tile to the waist; a diner does not.
   */
  wainscot?: {
    /** dado height in metres (default 1.1 — waist height) */
    h?: number;
    /** tile size in metres. Default 0.32 — larger than real wall tile
     *  because at ~12 px/m anything under ~0.25 m draws a one-texel tile
     *  beside a one-texel joint, which reads as a dotted line, not tile. */
    tile?: number;
    /** the joint colour showing between tiles */
    grout?: number;
    /** the tile face itself */
    face?: number;
  };
  /**
   * The ceiling light. `kind` picks the fixture, `tint` its colour, `count`
   * how many (default: one per 3.5 m of depth).
   *
   * There IS a fixture, always. The user has already rejected the bare-glow
   * version of this once, on the walk-up: *"there is no fixture at all — it's
   * a bare glow decal on the ceiling, no shade, no bulb, so it reads as a
   * smudge rather than a light"*, and *"it's a smooth radial gradient in a
   * world that is entirely hard-edged nearest-filtered texels — the blur is
   * wildly off-style"*. This kit shipped that exact mistake, and would have
   * shipped it ten more times. The glow is stepped on the texel grid now and
   * it hangs under something you can see.
   */
  light?: {
    /**
     * `dome` — a shallow opal flush-mount. Domestic, warm, a diner.
     * `troffer` — a recessed fluorescent tray. A suspended commercial ceiling.
     * `strip` — a bare batten screwed to the soffit, tube showing. A unit that
     *   was cheaply converted and never finished; the thrift store, the back
     *   of a pawn shop.
     */
    kind?: 'dome' | 'troffer' | 'strip';
    tint?: number;
    count?: number;
    /**
     * Indices of fixtures that are OUT — no glow, and a dead grey tube.
     * A room where every light works is a room that has a facilities budget,
     * which is a thing some of these places conspicuously do not have.
     */
    dead?: number[];
  };
}

export interface Room {
  /** world centre of the floor */
  cx: number; cz: number;
  /** clear dimensions, echoed back so furniture can be sized off them */
  W: number; D: number; H: number;
  /** local (x right, z toward the door) → world, for anything that has to be
   *  told a world address. Furniture does NOT need these — use `put`. */
  wx: (lx: number) => number;
  wz: (lz: number) => number;
  /** add a mesh positioned in LOCAL coordinates. Always place through this
   *  rather than `group.add` — see the note on `group`. */
  put: (m: THREE.Object3D, lx: number, y: number, lz: number) => THREE.Object3D;
  /**
   * A sign readable from BOTH sides — two back-to-back single-sided planes,
   * not one `DoubleSide` plane.
   *
   * GOTCHAS §10: a DoubleSide plane viewed from behind is mirrored, because
   * three.js flips the normal and leaves the UVs alone. Symmetrical letters
   * hide it (a HOTEL blade sign shipped backwards; only the E and L gave it
   * away) and asymmetrical ones make it glaring. A shop is full of signs you
   * walk around — price cards on a rail, a notice in a window — so "which way
   * does this one face" is a question every room would otherwise have to get
   * right one sign at a time. This makes it not a question.
   *
   * Coincident planes do NOT z-fight here: each is FrontSide, so from any
   * given side exactly one of them is drawn and the other is culled.
   */
  sign: (map: THREE.Texture, w: number, h: number,
    lx: number, y: number, lz: number, rotY?: number) => void;
  /**
   * A CLOCK THAT TELLS THE TIME. The user: *"make sure all the clocks
   * throughout the world (library, diner, etc. tell the time accurately)"*.
   *
   * That is a property of the world, not a bug in one clock: every face must
   * agree with game time and therefore with every other face and with the
   * wristwatch. So this is a kit primitive in the shape of `person()` and
   * `ctx.seat()` — the caller says WHERE and WHAT KIND, and the kit registers
   * the frame hook and drives the hands. A room that hand-rolls a clock drifts
   * from the others the first time anyone touches it.
   *
   *     room.clock({ lx: 0, y: 2.4, lz: -hd + 0.1 })          // on the back wall
   *     room.clock({ lx: 2, y: 1.1, lz: 0, r: 0.13, rotY: Math.PI / 2 })
   *
   * BOTH HANDS MOVE, and the hour hand CREEPS — at 13:30 it sits halfway
   * between 1 and 2, which is the thing that gives a fake clock away. It reads
   * `hourF` every frame and caches nothing, so when C's sleep advances time the
   * hands follow the jump without knowing sleep exists.
   */
  clock: (opts: {
    lx: number; y: number; lz: number;
    /** face radius in metres; 0.22 is a shop wall clock */
    r?: number;
    /** which way the face looks; 0 faces +z, like sign() */
    rotY?: number;
    face?: number; rim?: number; hands?: number;
  }) => void;
  /** a collider in LOCAL coordinates, centred on (lx,lz) */
  solid: (lx: number, lz: number, w: number, d: number) => AABB;
  /** every collider this room has registered — hand these to the rig */
  colliders: AABB[];
  /** Where the door is along the front wall, in LOCAL x — derived from the
   *  facade. Furnish around it: the door moves when the shopfront changes, and
   *  a fitting laid out against a remembered position ends up in front of it.
   *  The diner's booth bank did exactly that. */
  doorAt: number;
  /**
   * A PERSON, drawn from the 8-angle citizen atlas like everyone on the street.
   *
   * The user: *"the people inside these places are always flat and not like
   * the people on the street."* They were right and it was my fault — the
   * diner's waitress was one hand-painted front view on a plane, and because
   * she was the reference interior every room after her copied the mistake.
   * A street citizen turns through eight painted views; she turned through
   * one, so she was cardboard from every angle but dead ahead.
   *
   * This wraps H's `citizenSprite` and does the two things a room would
   * otherwise get wrong: it places the mesh in WORLD coordinates (a local
   * position gets the figure dimmed by the night sweep — see `group`), and it
   * registers the per-frame `update` the sprite needs to choose its sector.
   * Without that hook the sprite never turns and you are back where you
   * started, with better art.
   *
   * Stationary people hold the IDLE frame: `setWalking(false)` is the default,
   * which is row 0 of the atlas, not a walk cycle frozen mid-stride.
   */
  person: (look: Look, lx: number, lz: number, o?: {
    /** which way they face, atan2(vx, vz); 0 = +z. Point them at their work. */
    facing?: number;
    h?: number; w?: number;
    /**
     * SEATED, using H's seated pose. Pass the SEAT TOP as `y` — the origin
     * moves with the pose (standing is the painted shoe and goes on the
     * floor; seated is the hip, 0.445 m above the shoe, and goes on the seat).
     * `citizenPlane` owns that offset, so if a figure needs a y fudge to sit
     * right, the atlas is wrong and it goes to H — not patched here.
     */
    seated?: boolean;
    /** floor-relative height to place at; defaults to 0. Use the seat top. */
    y?: number;
  }) => void;
  /** true while the player is standing in THIS room */
  inside: () => boolean;
  /**
   * The group everything in the room hangs off. It sits at the world ORIGIN
   * and its children carry world positions — deliberately, and it is not free
   * to change. `props.dimWorld` decides what the night sweep may darken by
   * reading each object's own `position.x` and skipping `|x| > 100`, and it
   * reads the LOCAL position, not the world one. Park the group out at the
   * room's address with local children and every stick of furniture looks
   * like it is standing on the street: the whole interior goes dark at 2am
   * while the lit window it is behind stays on.
   *
   * So: add through `put`, which does the offset for you. Reach in here with
   * `group.add` and you get a room that is correct all day and wrong all
   * night, which is the kind of bug that ships.
   */
  group: THREE.Group;
}

let slabN = 0;

// ── WHO IS ALREADY SITTING THERE ──────────────────────────────────────────
//
// The user, twice: *"[screenshot] when folks sit, they clip, fix this"* and, of
// the church, *"this guy is sat in the pew but is clipping the pew geometry.
// additionally **if you sit in his pew you sit where he sits** and that just
// breaks immersion."*
//
// The second half of that is a CLASS, not a church bug. Every room places its
// sitters at exactly the coordinates it registered a seat at — deliberately, so
// that a figure sits ON a stool rather than near one — and then registers that
// seat as free. Measured, all the same shape:
//
//   ct/int-church.ts   the praying woman, pew row 3 left
//   ct/int-casino.ts   the lounge bench sitter at LOUNGE_Z - 0.325
//   ct/int-casino.ts   all four slot players, on the stools at BANK_Z +- 1.02
//
// Fixing it per room would be four edits and a fifth room tomorrow, so the
// registry is here, beside `person()` — the one call every seated figure in
// every interior goes through. A room opts a seat in with one clause:
//
//     ctx.seat({ ..., ok: () => !seatTaken(x, z) })
//
// WHY `ok` AND NOT A FILTER AT REGISTRATION TIME. Rooms register their seats
// BEFORE they place their people (the church registers 36 pews at :467 and its
// figure at :1017), so anything resolved at registration would read an empty
// registry. `crosstown.ts:398` calls a seat's `ok` lazily, once per frame, so a
// predicate cannot be fooled by build order — and that is also what lets a
// figure be added to a room later without revisiting the seat.
const TAKEN: { x: number; z: number }[] = [];

/**
 * Is a seated figure already occupying this seat? Coordinates are WORLD, the
 * same ones `ctx.seat` takes, so a caller passes what it already wrote.
 *
 * The default tolerance is deliberately SMALL. Seats in this world are as
 * close as 0.65 m apart (the casino's lounge bench places four at 0.65 m
 * pitch), so a generous radius here would blank a whole bench because one
 * person sat on the end of it. 0.30 m is comfortably under half that pitch and
 * comfortably over the float error of a coordinate that both sides derive from
 * the same constant.
 */
export function seatTaken(wx: number, wz: number, tol = 0.30): boolean {
  return TAKEN.some((t) => Math.abs(t.x - wx) < tol && Math.abs(t.z - wz) < tol);
}

/**
 * Claim a seat for a figure that did NOT come through `room.person`.
 *
 * `ct/int-casino.ts` has its own `sitter()` helper built straight on
 * `citizenSprite`, and deliberately so — its comment says a sitter needs the
 * SEAT TOP where the kit wrapper takes the floor. That file already has to
 * remember to stamp `userData.citizen`/`.seated` by hand for exactly the same
 * reason, and its comment records the five figures that went invisible to every
 * people-sweep the one time it forgot. This is the third thing on that list,
 * and it is one call rather than a second registry.
 */
export function claimSeat(wx: number, wz: number): void { TAKEN.push({ x: wx, z: wz }); }

/** Test affordance: every occupied seat, so a probe can assert the pairing
 *  rather than infer it from a prompt that may be a ghost. */
export function takenSeats(): { x: number; z: number }[] { return TAKEN.map((t) => ({ ...t })); }

export function buildRoom(ctx: CtxBuild, spec: RoomSpec): Room {
  const { scene, flat, player } = ctx;

  // ── derive from the facade, if we were told which building this is ──────
  //
  // Everything below that the frontage can answer, it answers, and the room's
  // own value becomes an override rather than the source. Where the two used
  // to disagree they now cannot, because there is only one of them.
  const fr = spec.frontage;
  const F = fr ? frontageOf(fr.name, fr.w) : null;
  // The frontage in WORLD coordinates. `alongU` converts one back to metres
  // along the painter's u — and it is the only place handedness is applied.
  // Converting with `fr.side` instead applies the mirror TWICE: measured, that
  // replaces the diner's window with a solid 4.03 x 2.60 panel, because side
  // and uDir disagree on 7 of the 16 frontages.
  const FW = fr ? frontageWorld(fr.name) : null;
  // ── the door's position, as ONE world number ──────────────────────────
  //
  // The user, standing in the tax office: the door is on the RIGHT of the
  // interior, so from outside it must be on the LEFT of the facade — and they
  // want that for every building. They are right, and it is not a preference:
  // a room and its facade are two faces of ONE WALL, so the handedness is
  // opposite by construction.
  //
  // Nothing in the code knew that, because each side authored its own offset
  // in its own local space and "left" meant something different in each. So
  // the position is carried as a WORLD coordinate on the axis the roster lays
  // buildings out on — z for a main-block shop — and each consumer converts
  // once, applying its own mirror. One number, three consumers: the painter
  // turns it into a texel column, the [E] spot uses it as it stands, and the
  // room turns it into a local x with the flip that being inside implies.
  //
  // ONE conversion, used by the door and the glazing alike so they cannot
  // drift apart. `alongFrontage` is metres from the facade's left edge as the
  // painter's canvas sees it (u = 0).
  //
  //   worldOf  — u = 0 is the HIGH-z edge of a west building, because a west
  //              facade is the +x face of its box and three.js runs u along
  //              -z there; an east facade is the -x face and runs the other
  //              way. That sign is the whole street conversion.
  //   localOf  — and then the MIRROR. Outside you face the building; inside
  //              you face the same wall from behind, so your right hand has
  //              swapped sides. Multiplying the world offset by `side` is what
  //              performs that swap: check it on the west side, where the
  //              observer's right is -z outside and -x inside.
  const worldOf = (alongFrontage: number) => fr
    ? (fr.side < 0 ? fr.cz + fr.w / 2 - alongFrontage : fr.cz - fr.w / 2 + alongFrontage)
    : 0;
  const localOf = (alongFrontage: number) => fr && F
    ? fr.side * (worldOf(alongFrontage) - fr.cz) * (W / F.frontageM)
    : 0;
  // THE ROOM'S DOOR, not the facade's. `ct/doors.ts` holds the declaration
  // this room made at module scope and the facade painter reads the same
  // entry, so the two cannot disagree — and when they move, the painted door
  // is what moves. See the note at the top of ct/doors.ts for why the room is
  // the authority and not the shopfront.
  const doorWorld = fr ? doorWorldFor(fr.name) : null;
  // The room is as wide as the building, less the wall thickness at each end.
  // Room width used to be a number each room picked: the burger barn had
  // 11.36 m of room behind 16 m of frontage — 71%, where the others were
  // 94–97% — and nothing said which was right. This makes it a rule.
  const W = spec.w ?? (F ? roomWidthFor(F.frontageM) : 8);
  const D = spec.d, H = spec.h ?? 2.9;
  const pal = spec.palette ?? {};
  const FLOOR = pal.floor ?? 0x8a8578, WALL = pal.wall ?? 0x9aa88e;
  const CEIL = pal.ceil ?? 0xb0aa9c, TRIM = pal.trim ?? 0x5a4632;

  // claim a slab. Rooms are centred in theirs, so a builder who overshoots by
  // a few metres runs into dead space rather than into somebody else's shop.
  const idx = slabN++;
  const x0 = SLAB_X0 + idx * SLAB_W, x1 = x0 + SLAB_W;
  // …EXCEPT half of a party wall, which is shoved to the shared slab boundary
  // so its flank wall stands ON it. See `PartyWall` at the top of this file.
  // Derived, never typed: the shove is whatever is left of the half-slab once
  // the room's own half-width and its own wall thickness are taken off it, so a
  // room that changes width stays joined.
  const PW = partyFor(spec.id);
  const shove = PW ? SLAB_W / 2 - W / 2 - WALL_T : 0;
  const cx = x0 + SLAB_W / 2 + (PW ? (PW.west === spec.id ? shove : -shove) : 0), cz = 0;
  const wx = (lx: number) => cx + lx;
  const wz = (lz: number) => cz + lz;

  // The group stays at the origin and its children hold world positions — see
  // the note on `Room.group` for why. `place` is the only way anything gets
  // into the room, so the offset happens in exactly one spot.
  const group = new THREE.Group();
  scene.add(group);
  const place = <T extends THREE.Object3D>(m: T, lx: number, y: number, lz: number): T => {
    m.position.set(cx + lx, y, cz + lz);
    group.add(m);
    return m;
  };
  const colliders: AABB[] = [];

  // ── floor ──
  const linoT = declareSurface(pixTex(32, 32, (g) => {
    const c = new THREE.Color(FLOOR);
    const hex = (m: number) => '#' + c.clone().multiplyScalar(m).getHexString();
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? hex(0.86) : hex(1.06);
      g.fillRect(x * 16, y * 16, 16, 16);
    }
    dither(g, 32, 32, 50);
  }), 'ground');
  linoT.wrapS = linoT.wrapT = THREE.RepeatWrapping;
  // texel density from the room's REAL METRES, so a big room does not get a
  // stretched floor and a small one a busy postage stamp (GOTCHAS §5)
  linoT.repeat.set(Math.max(1, Math.round(W / 1.6)), Math.max(1, Math.round(D / 1.6)));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), flat(linoT));
  floor.rotation.x = -Math.PI / 2;
  place(floor, 0, 0.005, 0);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshBasicMaterial({ color: CEIL, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  place(ceil, 0, H, 0);

  // ── walls, with THICKNESS ──
  //
  // A wall is a box 0.18 m thick, not a plane. That single decision is what
  // gives every opening a reveal: you see the depth of the jamb as you walk
  // through, the header casts the doorway as a hole in something solid, and
  // the room stops reading as a cardboard set.
  const T = WALL_T;
  // One plaster tile is TILE_M wide and the full height of the room, so the
  // canvas has to be sized off H — a fixed 32×54 gave ~12 px/m across and
  // ~18 px/m up, and texels half again as tall as they are wide turn every
  // speck of grain into a dash. Derive both from the same px/m (GOTCHAS §5 is
  // about repeat, but the same rule decides the canvas) and they come out
  // square in any ceiling height a room asks for.
  const TILE_M = 2.7;
  const PXM = 32 / TILE_M;                                  // ≈ 11.9 px/m
  const wallPx = Math.max(16, Math.round(H * PXM));
  const scuffPx = Math.max(2, Math.round(0.5 * PXM));
  const wain = spec.wainscot;
  const wainPx = wain ? Math.round((wain.h ?? 1.1) * PXM) : 0;
  const plasterT = declareSurface(pixTex(32, wallPx, (g) => {
    const c = new THREE.Color(WALL);
    g.fillStyle = '#' + c.getHexString(); g.fillRect(0, 0, 32, wallPx);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(0, wallPx - scuffPx, 32, scuffPx);           // scuffed base
    // Grain weighted toward the floor. An even scatter across a big flat wall
    // seen from two metres away does not read as plaster, it reads as mould —
    // the first pass did. Walls get dirty from the bottom up, so most of the
    // grain lives in the bottom metre and the rest is nearly clean.
    dither(g, 32, wallPx, Math.round(32 * wallPx * 0.015));
    const grimePx = Math.max(3, Math.round(1.0 * PXM));
    g.save();
    g.translate(0, wallPx - grimePx);
    dither(g, 32, grimePx, Math.round(32 * grimePx * 0.05));
    g.restore();
    // the tiled dado, over the top of all of that — tile is the wall down
    // here, not a decal on it, so it covers the grime rather than sharing it
    if (wain && wainPx > 2) {
      const y0 = wallPx - wainPx;
      const tilePx = Math.max(3, Math.round((wain.tile ?? 0.32) * PXM));
      const face = new THREE.Color(wain.face ?? 0xd8d0be);
      g.fillStyle = '#' + new THREE.Color(wain.grout ?? 0xa89e8c).getHexString();
      g.fillRect(0, y0, 32, wainPx);                         // the grout bed
      // Tiles laid ON the grout bed, one texel short each way, so the joint is
      // the bed showing through. One texel at ~12 px/m is an 8 cm joint —
      // coarse for grout, but it is the thinnest line this world can draw, and
      // a joint you cannot see is not a tiled wall.
      for (let ty = 0; y0 + ty * tilePx < wallPx; ty++) {
        for (let tx = 0; tx * tilePx < 32; tx++) {
          const x = tx * tilePx, y = y0 + ty * tilePx;
          g.fillStyle = '#' + face.clone()
            .multiplyScalar((tx + ty) % 2 ? 0.95 : 1.03).getHexString();
          g.fillRect(x, y, tilePx - 1, Math.min(tilePx - 1, wallPx - y));
        }
      }
      // the capping bullnose: the line that makes it read as tile stopping at
      // a height rather than as a differently-coloured wall
      g.fillStyle = '#' + new THREE.Color(TRIM).getHexString();
      g.fillRect(0, y0 - 1, 32, 2);
    }
  }), 'detail');
  /**
   * ONE FACE OF PLASTER, AT THE DENSITY THAT FACE ASKS FOR.
   *
   * BUILDER-BRIEF §7b: a texture's density comes from the face it lands on.
   * The old `wallMat(len)` got this wrong three separate ways, all of which
   * `scripts/texdensity.mjs` now measures:
   *
   *  1. `Math.max(1, len / TILE_M)` — the clamp. A wall run SHORTER than one
   *     2.7 m tile got a whole canvas anyway, so an 0.18 m run drew at
   *     **177 px/m against the room's own 11.9**. The clamp was protecting
   *     against a partial tile, which is not a problem: the plaster is a
   *     tiling texture and a fraction of it is a correct fraction of it.
   *  2. `repeat.y` was always 1, so a run that is not the full room height —
   *     every lintel over every door — wore the whole room's canvas squeezed
   *     into its own height. Measured at **162 px/m on a 0.24 m header**.
   *     Fixed by `offset.y`/`repeat.y` sampling exactly the band of the wall
   *     that this run occupies, which also makes a lintel line up with the
   *     plaster either side of the door instead of restarting.
   *  3. the same material went on all four sides — see `boxMats`.
   *
   * A full-height run gives `repeat.y = 1, offset.y = 0`, i.e. exactly what it
   * did before, so nothing that was already right moves.
   */
  const matCache = new Map<string, THREE.Material>();
  const runMat = (faceW: number, y0: number, y1: number) => {
    const key = `${faceW.toFixed(4)}|${y0.toFixed(4)}|${y1.toFixed(4)}`;
    const hit = matCache.get(key);
    if (hit) return hit;
    const t = plasterT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(faceW / TILE_M, (y1 - y0) / H);
    t.offset.set(0, y0 / H);
    t.needsUpdate = true;
    const m = flat(t);
    matCache.set(key, m);
    return m;
  };
  const trimM = new THREE.MeshBasicMaterial({ color: TRIM });

  /**
   * THE SIX MATERIALS OF A PLASTERED BOX, in three's face order
   * `[+x, -x, +y, -y, +z, -z]`.
   *
   * **The ±x pair is `depth` across and the ±z pair is `width`.** Getting that
   * backwards is the single most expensive mistake in this repo — it produced
   * two retracted findings (42 "off-density" faces, 135 "disagreeing"
   * junctions) and `scripts/lib/faces.mjs` exists solely to hold the one
   * correct copy of it.
   *
   * Every caller here previously passed ONE material for all four sides, so
   * whichever pair was not the wide one drew the wide one's density. On a
   * 0.18 m wall return against a 3.6 m run that is **2394 px/m against 11.9**,
   * and it was in all twelve interiors at once because they share this kit.
   */
  const boxMats = (w: number, d: number, y0: number, y1: number) => [
    runMat(d, y0, y1), runMat(d, y0, y1),      // ±x : `depth` across
    trimM, trimM,                               // ±y : flat trim, no texture
    runMat(w, y0, y1), runMat(w, y0, y1),      // ±z : `width` across
  ];

  /** a solid run of wall: length `len`, from height `y0` to `y1`.
   *  `along 'x'` is a box `len` wide and T deep; `along 'z'` is the transpose,
   *  and `boxMats` takes the box's own width and depth so it cannot get the
   *  pairing backwards. */
  const wallRun = (lx: number, lz: number, len: number, along: 'x' | 'z', y0: number, y1: number) => {
    if (len <= 0.001 || y1 - y0 <= 0.001) return;
    const w = along === 'x' ? len : T;
    const d = along === 'x' ? T : len;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, d), boxMats(w, d, y0, y1));
    place(m, lx, (y0 + y1) / 2, lz);
  };

  const hw = W / 2, hd = D / 2;
  // back is solid
  wallRun(0, -hd - T / 2, W + T * 2, 'x', 0, H);

  // ── the flanks ──
  //
  // Solid, unless this room is half of a party wall — then the shared flank is
  // built in pieces around the opening, exactly the way the front wall is built
  // around its door, and for the same reason: a hole in a box is a box with the
  // hole's runs left out, not a plane with a decal on it.
  //
  // `PW_OPEN` is the opening in this room's own terms, or null. Both rooms of a
  // pair read the same declaration, so the two holes are the same hole.
  const partySide = PW ? (PW.west === spec.id ? 1 : -1) : 0;   // +1 = my east flank
  const PW_OPEN = PW
    ? { z0: PW.at - PW.w / 2, z1: PW.at + PW.w / 2, h: Math.min(PW.h, H - 0.2) }
    : null;
  const flank = (sx: 1 | -1) => {
    const lx = sx * (hw + T / 2);
    if (!PW_OPEN || sx !== partySide) { wallRun(lx, 0, D + T * 2, 'z', 0, H); return; }
    const { z0, z1, h } = PW_OPEN;
    const e0 = -hd - T, e1 = hd + T;                     // the flank's own extent
    if (z0 <= e0 || z1 >= e1) {
      // console.warn with the `[interior:<id>]` prefix rather than the `bad`
      // helper further down: that one is a `const` and this runs before it.
      // Two registered checks match on the prefix, so this still fails a check.
      console.warn(`[interior:${spec.id}] the party-wall opening spans `
        + `${z0.toFixed(2)}…${z1.toFixed(2)} but the flank only runs `
        + `${e0.toFixed(2)}…${e1.toFixed(2)} — built solid instead`);
      wallRun(lx, 0, D + T * 2, 'z', 0, H);
      return;
    }
    wallRun(lx, (e0 + z0) / 2, z0 - e0, 'z', 0, H);      // beyond the opening, one way
    wallRun(lx, (z1 + e1) / 2, e1 - z1, 'z', 0, H);      // …and the other
    wallRun(lx, (z0 + z1) / 2, z1 - z0, 'z', h, H);      // the header over it
    // the reveal's own trim, the flank equivalent of `jamb` below
    for (const jz of [z0, z1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(T + 0.02, h, 0.06), trimM);
      place(m, lx, h / 2, jz);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(T + 0.02, 0.07, z1 - z0 + 0.12), trimM);
    place(head, lx, h + 0.035, (z0 + z1) / 2);

    // ── THE THRESHOLD, AND WHY THE OPENING NEEDED ONE ─────────────────────
    //
    // `floor` is a `PlaneGeometry(W, D)` centred on the room, so it stops dead
    // at the room's own inner face — and the party wall stands on the T metres
    // BEYOND that, ground which neither room floors. Along the rest of the wall
    // that strip is buried in masonry and nobody can ever see it. **In the
    // opening it is a slot of open sky in the floor**, 2 x WALL_T = 0.36 m
    // wide, exactly where the user asked to be able to *"walk from one into the
    // other"*.
    //
    // It was invisible to every check in the project. `w75-site-contained`
    // decides floor-versus-void from each mesh's axis-aligned BOUNDING BOX, and
    // the two rooms' floor boxes are 0.36 m apart in a 20 m room, so their
    // 0.25 m EDGE tolerances very nearly close the gap on paper; `groundAt`
    // names a height across it either way. It took the exact triangle raycast
    // in `scripts/world-contained.mjs` to see it — the world's ONLY reachable
    // hole, 3 cells at x 880.00, z -9.5…-8.5 — and then a photograph to
    // believe it (`shots/w85-party-880-down.png`, a grey band of sky between
    // two carpets).
    //
    // Each room lays the half under its OWN flank, so the two halves meet on
    // the slab boundary exactly as the wall bases do, and neither room has to
    // know the other's width. Same y as `floor`.
    const sillT = linoT.clone();
    sillT.needsUpdate = true;
    sillT.wrapS = sillT.wrapT = THREE.RepeatWrapping;
    // THE DENSITY IS DERIVED FROM THE FLOOR IT CONTINUES, not typed
    // (BUILDER-BRIEF §7b): the floor's own repeat over the floor's own metres
    // is its px/m, and this strip asks for the same px/m over its own metres.
    // Accepting the default repeat would put a whole lino tile in 0.18 m.
    sillT.repeat.set((linoT.repeat.x / W) * T, (linoT.repeat.y / D) * (z1 - z0));
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(T, z1 - z0), flat(sillT));
    sill.rotation.x = -Math.PI / 2;
    place(sill, lx, 0.005, (z0 + z1) / 2);
  };
  flank(-1);
  flank(1);

  // the front wall carries the door and the window, so it is built in pieces
  // Where the door sits along the room's front wall, and how wide it is —
  // from the facade when we know the building.
  //
  // `FW.doorWorld` is a WORLD coordinate; `alongU` turns it into metres along
  // the painter's u, and `localOf` scales that by room width over frontage
  // width — the room is a little narrower than the building (wall thickness),
  // and the user's ask was that the door be in the corresponding PLACE — "if
  // the door on the interior is full right then the facade must match" — which
  // is a proportion, not an absolute offset.
  // World z → the room's local x, MIRRORED.
  //
  // Inside, you stand with the front wall behind you and the room in front, so
  // the wall you are looking back at is the same wall reversed. `doorWorld` is
  // metres along the street; `(doorWorld - cz)` is its signed offset from the
  // building centre on that axis; the leading minus is the mirror, and it is
  // the whole point of this line. Scaled by room width over frontage so a door
  // three-quarters along a shopfront is three-quarters along the room —
  // "if the door on the interior is full right then the facade must match".
  // No FW means no registered frontage — nothing to follow, so centre it. The
// old fallback read the painter's own local guess, which is the authority this
// whole descriptor exists to remove.
const dAt = spec.door.at ?? (FW ? localOf(alongU(FW, FW.doorWorld)) : 0);
  // THE LEAF COMES FROM THE DECLARATION, so the room cannot disagree with its
  // own building. See `DoorLeaf` in ct/doors.ts — the user found four separate
  // interior/exterior contradictions and every one was a fact authored twice.
  // A casino with a wide gold double door outside and a narrow domestic leaf
  // inside is now impossible rather than something a builder must remember.
  //
  // `spec.door.width` still wins if a room sets it, because six rooms predate
  // this and an unconverted room must be unchanged, not broken.
  // by BUILDING, not by frontage: a room on a cut face declares no frontage at
  // all, and those are exactly the rooms whose doors were disagreeing.
  const bName = spec.building ?? fr?.name ?? null;
  const LEAF = bName ? doorLeafFor(bName) : null;
  // ── AND IF THERE IS NOTHING TO ASK, SAY SO. THE SILENCE WAS THE BUG. ──────
  //
  // The user, twice, about the church: outside is a 5.5 m pointed arch with two
  // timber leaves; inside was a 1.4 m brown domestic door with a grey pane.
  //
  // The cause was not a wrong value anywhere. `bName` above is the ONLY way
  // into the declaration, and it has two sources: the spec's `building`, and
  // the frontage's name. **A chamfer room publishes no frontage**, so a chamfer
  // room that also omits `building` resolves `bName` to `null`, `LEAF` to
  // `null`, and every reader below silently takes its `??` branch — the kit's
  // generic 1.1 m timber leaf with a vision panel. `ST BRIGID` declares a
  // perfectly good `DoorDecl` in `ct/int-church.ts` and **it was never
  // consulted**, and nothing anywhere said a word.
  //
  // That is the same class as the two faults `ct/doors.ts` already screams
  // about at collection time — an undefined namespace in the glob, and two
  // rooms claiming one building — and it deserves the same treatment. A room
  // that declared nothing and a room whose declaration was thrown away look
  // identical from outside, and telling them apart is exactly what a check
  // cannot do for itself.
  //
  // `bad()` is the kit's own channel for this and two registered checks already
  // read it — `scripts/interiors-walk.mjs:284` and `scripts/G-rooms-walk.mjs:210`
  // both collect `[interior:<id>]` warnings and fail on them — so a room that
  // loses its door declaration now fails a check rather than merely looking
  // wrong to whoever walks in. Declared here rather than reusing the `bad` at
  // :881 because that one is defined forty lines further down; same format, and
  // the checks match on the prefix.
  if (!bName) {
    console.warn(`[interior:${spec.id}] NO BUILDING NAME, so no DoorDecl was consulted and `
      + `this room is getting the kit's generic timber leaf. A chamfer room publishes no `
      + `frontage, so it must name its building itself: add \`building: '<roster name>'\` to `
      + `its buildRoom spec. If the room really has no declaration, that is fine — but it `
      + `has to be visible either way, because a thrown-away declaration and no declaration `
      + `look the same from here.`);
  }
  const dW = spec.door.width ?? LEAF?.clearW ?? F?.doorWidthM ?? 1.1;
  // CLAMPED TO THE ROOM. A declared leaf describes the door the BUILDING has,
  // and a building's entrance can legitimately be taller than the room behind
  // it — the casino's is 2.7 m under a lit canopy while its interior is
  // deliberately 2.5 m, the lowest ceiling in the world. Left unclamped the
  // opening ran through the ceiling and took the way-out prompt with it.
  //
  // So the room takes as much of the declared height as it has, and the facade
  // keeps the full number. That is not the two-authorings problem returning:
  // it is one declaration, honoured as far as the geometry allows, in the one
  // direction where the two sides genuinely differ.
  const DOOR_H = Math.min(LEAF?.h ?? 2.15, H - 0.2);
  // The glazing, likewise: the painter's glazed span, scaled into the room and
  // then trimmed back off the door so the two openings cannot collide — which
  // the front-wall builder would otherwise drop on the floor with a warning.
  const glaze = FW ? (() => {
    // through the same conversion as the door, mirror included, or the glass
    // ends up on the opposite side of the room from the window you were just
    // looking through
    const e0 = localOf(alongU(FW, FW.glazingLoWorld));
    const e1 = localOf(alongU(FW, FW.glazingHiWorld));
    let a = Math.min(e0, e1), b = Math.max(e0, e1);
    const dl = dAt - dW / 2 - 0.12, dr = dAt + dW / 2 + 0.12;
    // keep whichever side of the door is the bigger run of glass
    if (a < dl && b > dr) { if (dl - a >= b - dr) b = dl; else a = dr; }
    else if (b > dl && b <= dr) b = dl;
    else if (a >= dl && a < dr) a = dr;
    return b - a > 0.8 ? { at: (a + b) / 2, w: b - a } : null;
  })() : null;
  const win = spec.window ?? (glaze ? { at: glaze.at, w: glaze.w, h: 1.5, sill: 0.95 } : undefined);
  const wAt = win?.at ?? 0;
  const wW = win?.w ?? 0;
  const wSill = win?.sill ?? 0.95;
  const wH = win?.h ?? 1.5;

  // Openings along the front wall, left to right, as [from, to, y0, y1].
  //
  // The wall is then built as the runs BETWEEN them, which only produces a
  // wall at all if the openings are inside it, in order, and disjoint. None of
  // that is guaranteed by the types — a builder sizing a shopfront window off
  // the room width will overlap the door sooner or later — and the failure is
  // silent: negative-length runs are dropped, so you get a room with a hole in
  // it and no clue why. Check it here, once, for all ten rooms.
  const X0 = -hw - T, X1 = hw + T;
  const bad = (why: string) => console.warn(`[interior:${spec.id}] ${why}`);
  const holes: [number, number, number, number][] = [];
  const addHole = (what: string, from: number, to: number, y0: number, y1: number) => {
    if (to - from <= 0.001) { bad(`${what} has no width — dropped`); return; }
    if (from < X0 || to > X1) {
      bad(`${what} spans ${from.toFixed(2)}…${to.toFixed(2)} but the front wall only runs `
        + `${X0.toFixed(2)}…${X1.toFixed(2)} — dropped`);
      return;
    }
    if (y1 > H) { bad(`${what} is ${y1.toFixed(2)} m tall in a ${H.toFixed(2)} m room — dropped`); return; }
    const clash = holes.find((o) => from < o[1] && to > o[0]);
    if (clash) {
      bad(`${what} overlaps the opening at ${clash[0].toFixed(2)}…${clash[1].toFixed(2)} — dropped`);
      return;
    }
    holes.push([from, to, y0, y1]);
  };
  // the door goes in first: a room with no window is a room, a room with no
  // door is a bug, so the door is the one that wins a clash
  const doorInCut = !!spec.chamfer?.door;
  if (!doorInCut) addHole('the door', dAt - dW / 2, dAt + dW / 2, 0, DOOR_H);
  if (win && wW > 0) addHole('the window', wAt - wW / 2, wAt + wW / 2, wSill, wSill + wH);
  const hasWindow = holes.length > 1;
  holes.sort((a, b) => a[0] - b[0]);

  let cursor = -hw - T;
  for (const [from, to, y0, y1] of holes) {
    wallRun((cursor + from) / 2, hd + T / 2, from - cursor, 'x', 0, H);
    if (y0 > 0) wallRun((from + to) / 2, hd + T / 2, to - from, 'x', 0, y0);       // under a window
    if (y1 < H) wallRun((from + to) / 2, hd + T / 2, to - from, 'x', y1, H);       // header over
    cursor = to;
  }
  wallRun((cursor + hw + T) / 2, hd + T / 2, hw + T - cursor, 'x', 0, H);

  // jambs: the short returns that make the reveal visible from inside the room
  const jamb = (lx: number, y1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, y1, T), trimM);
    place(m, lx, y1 / 2, hd + T / 2);
  };
  if (!doorInCut) { jamb(dAt - dW / 2, DOOR_H); jamb(dAt + dW / 2, DOOR_H); }

  if (hasWindow) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(wW, wH),
      new THREE.MeshBasicMaterial({ color: 0x7d8b93, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    place(glass, wAt, wSill + wH / 2, hd + T / 2);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(wW + 0.2, 0.08, T + 0.12), trimM);
    place(sill, wAt, wSill - 0.04, hd + T / 2);
    // Mullions, and a transom bar across the top.
    //
    // Shopfront glazing is never one pane — it is panes in a frame, because
    // nobody in 1997 is hanging six metres of unsupported glass. Without them
    // a wide window is a single flat slab of colour taking up a third of the
    // room, which is what the burger barn's 6.2 m one looked like. One bar
    // every ~2 m, which is about the widest pane you would actually see.
    const bays = Math.max(1, Math.round(wW / 2.0));
    for (let i = 1; i < bays; i++) {
      const mx = wAt - wW / 2 + (wW * i) / bays;
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.07, wH, T + 0.04), trimM);
      place(mull, mx, wSill + wH / 2, hd + T / 2);
    }
    const transom = new THREE.Mesh(new THREE.BoxGeometry(wW, 0.07, T + 0.04), trimM);
    place(transom, wAt, wSill + wH * 0.72, hd + T / 2);
  }

  // wall colliders — the openings are NOT gaps you can walk out of, except
  // the doorway, which is left clear so the [E] spot inside is reachable
  // (GOTCHAS §8: a collider that swallows a trigger is the classic way to
  // make a door un-enterable, and it has already happened once here)
  const wall = (mnx: number, mxx: number, mnz: number, mxz: number) => {
    const b: AABB = { minX: cx + mnx, maxX: cx + mxx, minZ: cz + mnz, maxZ: cz + mxz };
    colliders.push(b);
    BELT_COLLIDERS.push(b);
    return b;
  };
  wall(-hw - T, hw + T, -hd - T, -hd);            // back
  // The flanks, split around the party-wall opening on the shared side, from
  // the SAME numbers the mesh above used — so what you see and what stops you
  // are one authoring. A hole you can see and cannot walk through is the exact
  // defect the cut-corner note twenty lines down was written about.
  const flankWall = (sx: 1 | -1) => {
    const mnx = sx > 0 ? hw : -hw - T, mxx = sx > 0 ? hw + T : -hw;
    if (!PW_OPEN || sx !== partySide) { wall(mnx, mxx, -hd - T, hd + T); return; }
    wall(mnx, mxx, -hd - T, PW_OPEN.z0);
    wall(mnx, mxx, PW_OPEN.z1, hd + T);
  };
  flankWall(-1);                                  // left
  flankWall(1);                                   // right
  wall(-hw - T, dAt - dW / 2, hd, hd + T);        // front, left of the door
  wall(dAt + dW / 2, hw + T, hd, hd + T);         // front, right of the door

  // ── the cut corner, if this room has one ──
  //
  // Additive on purpose. The four walls above stay exactly as they are and a
  // diagonal is placed ACROSS the corner, sealing the square behind it. The
  // player sees a chamfered room because the diagonal is the only face they can
  // reach, and the colliders that stop them are the same run of boxes that
  // carries the mesh — so the two cannot drift apart.
  if (spec.chamfer) {
    const { corner, cut } = spec.chamfer;
    const sx = corner.endsWith('right') ? 1 : -1;      // +x or -x corner
    const sz = corner.startsWith('front') ? 1 : -1;    // +z (door side) or -z
    // the cut runs from (sx*hw, sz*(hd-cut)) to (sx*(hw-cut), sz*hd)
    const ax = sx * hw, az = sz * (hd - cut);
    const bx = sx * (hw - cut), bz = sz * hd;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    const rotY = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
    // the door's span along the cut, as fractions of its length
    const gap = spec.chamfer.door ? dW / len : 0;
    const g0 = 0.5 - gap / 2, g1 = 0.5 + gap / 2;
    const seg = (t0: number, t1: number, y0: number, y1: number) => {
      const L = (t1 - t0) * len;
      if (L <= 0.001 || y1 - y0 <= 0.001) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, y1 - y0, T),
        boxMats(L, T, y0, y1));       // ±x is the T-deep return, not another L
      m.rotation.y = rotY;
      place(m, ax + (bx - ax) * (t0 + t1) / 2, (y0 + y1) / 2,
            az + (bz - az) * (t0 + t1) / 2);
    };
    if (gap > 0) {
      seg(0, g0, 0, H);                 // cut face, one side of the door
      seg(g1, 1, 0, H);                 // …and the other
      seg(g0, g1, DOOR_H, H);           // the header over the opening
      //
      // AND SOMETHING TO SEE THROUGH IT.
      //
      // The user, on his fourth report of this room: the prompt reads "[E] out
      // to the street" while he stands at "a BLANK CORNER OF WALL. No door, no
      // frame, no threshold, no daylight." He was right, and the opening above
      // is why it was so confusing — the hole IS cut. But rooms are parked out
      // at x >= 400, so what lies beyond the hole is empty scene, which renders
      // the same pale tone as the plaster. An opening onto nothing reads as
      // wall. "An exit prompt with no visible door is worse than a locked
      // door, because he cannot tell whether the game is broken or he is."
      //
      // A flat-wall room gets its leaf and glazing from the doorway builder.
      // The cut face never had that, so it gets the same three things here:
      // DAYLIGHT beyond, a FRAME around, and a THRESHOLD underfoot.
      const ox = sx / Math.SQRT2, oz = sz / Math.SQRT2;    // outward, off the cut
      const dcx = ax + (bx - ax) * 0.5, dcz = az + (bz - az) * 0.5;
      // daylight: a bright panel a little way outside, so the opening reads as
      // an opening from anywhere in the room rather than only head-on.
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(dW * 1.9, DOOR_H * 1.25),
        new THREE.MeshBasicMaterial({ color: 0xd8e2ea, side: THREE.DoubleSide }));
      sky.rotation.y = rotY;
      place(sky, dcx + ox * 0.5, DOOR_H * 0.6, dcz + oz * 0.5);
      // the frame: two jambs and a head, proud of the face on the inside
      const frameM = new THREE.MeshBasicMaterial({ color: LEAF?.frame.colour ?? 0x5a4a34 });
      for (const t of [g0, g1]) {
        const jx = ax + (bx - ax) * t, jz = az + (bz - az) * t;
        const j = new THREE.Mesh(new THREE.BoxGeometry(0.10, DOOR_H, T * 1.6), frameM);
        j.rotation.y = rotY;
        place(j, jx - ox * 0.02, DOOR_H / 2, jz - oz * 0.02);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.2, 0.12, T * 1.6), frameM);
      head.rotation.y = rotY;
      place(head, dcx - ox * 0.02, DOOR_H + 0.06, dcz - oz * 0.02);
      // the threshold, so the floor tells you where the room stops
      const sill = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.2, 0.03, 0.26), frameM);
      sill.rotation.y = rotY;
      place(sill, dcx, 0.015, dcz);
    } else {
      seg(0, 1, 0, H);
    }
    // …and a stepped run of AABBs along it, because one box cannot be a 45°
    // face. Steps of ~0.35 m with the capsule at 0.36 leave nothing to slip
    // through, and the last one overlaps each wall it meets.
    // SMALL BOXES ALONG THE LINE, not bounding squares of segments.
    //
    // This sampled the diagonal in ~0.35 m segments and gave each one the
    // bounding square of its endpoints plus T/2 — which for a 45 degree run is
    // (L/root2 + T) across, far fatter than the wall it represents. The two
    // flanking the doorway bulged into the room and made the point a stride
    // inside it unstandable (measured: freeAtTarget false), so the opening read
    // as sealed while looking open.
    //
    // A chain of T-sized boxes every 0.12 m is thin, continuous against the
    // 0.36 m capsule, and hugs the line instead of boxing it.
    const steps = Math.max(2, Math.ceil(len / 0.12));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      if (gap > 0 && t1 > g0 && t0 < g1) continue;   // leave the doorway open
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const px = (x0 + x1) / 2, pz2 = (z0 + z1) / 2;
      wall(px - T / 2, px + T / 2, pz2 - T / 2, pz2 + T / 2);
    }
  }
  // …and the doorway is stopped OUTSIDE the threshold, not in it.
  //
  // Leaving the opening as a plain gap in the collider line is how you get a
  // room you can walk out of the front of, into the dead ground between
  // slabs — the way in is a teleport, so there is nothing out there. But the
  // blocker cannot sit IN the doorway either, because the way-out [E] spot
  // stands just inside it and a collider that swallows a trigger is exactly
  // how the bodega became un-enterable (GOTCHAS §8). So it goes on the far
  // face of the wall: you can still walk right up into the reveal and get the
  // prompt, you just cannot keep going.
  wall(dAt - dW / 2, dAt + dW / 2, hd + T, hd + T + 0.18);

  // ── the light ──
  //
  // Interiors are excluded from the night sweep (`dimWorld` skips |x| > 100),
  // so a room keeps its own light around the clock — which is right: a shop
  // with the lights on at 2am is exactly what a lit window on the street is
  // promising. This is the glow, not the illumination; the flat materials do
  // the rest.
  //
  // There is a FIXTURE, and the glow is STEPPED. Both are corrections to a
  // complaint already on file against the walk-up's ceiling lamps: *"there is
  // no fixture at all — it's a bare glow decal on the ceiling, no shade, no
  // bulb, so it reads as a smudge rather than a light"*, and *"it's a smooth
  // radial gradient in a world that is entirely hard-edged nearest-filtered
  // texels — the blur is wildly off-style"*. The first version of this kit
  // reproduced that mistake exactly, and ten rooms were about to inherit it.
  const lit = spec.light ?? {};
  const kind = lit.kind ?? 'dome';
  const tint = new THREE.Color(lit.tint ?? (kind === 'dome' ? 0xffebbe : 0xe8f0f4));
  const rgb = `${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)}`;
  // A halo quantised onto the texel grid: four hard steps, no interpolation.
  // Same job as a gradient, drawn the way everything else in this world is.
  const haloT = declareSurface(pixTex(16, 16, (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8;
      const step = Math.max(0, Math.ceil((1 - d) * 4) / 4);   // 0, .25, .5, .75, 1
      if (step <= 0) continue;
      // Weak on purpose. Additive white on an already-pale ceiling stops
      // reading as spill and starts reading as a splat of paint very quickly —
      // the first pass at 0.5 put a blocky cloud around every fixture. The
      // room is lit by its flat materials; this is only the bloom at the edge.
      g.fillStyle = `rgba(${rgb},${(step * 0.16).toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
  }), 'detail');
  haloT.minFilter = haloT.magFilter = THREE.NearestFilter;
  const haloM = new THREE.MeshBasicMaterial({
    map: haloT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const diffuserM = new THREE.MeshBasicMaterial({ color: tint });
  // The housing is painted metal, NOT the room's trim. Trim is right for
  // mullions and skirting — they are joinery — but a light fitting is a
  // bought object, and taking TRIM here gave the burger barn bright red
  // ceiling troffers, which no building has ever had.
  const roseM = new THREE.MeshBasicMaterial({ color: 0xc4c0b8 });
  // a tube that has gone: grey-green, slightly darker than the ceiling, with
  // the blackened ends a dead fluorescent always has
  const deadM = new THREE.MeshBasicMaterial({ color: 0x9a9a92 });
  const out = new Set(lit.dead ?? []);

  const lamps = Math.max(1, lit.count ?? Math.round(D / 3.5));
  for (let i = 0; i < lamps; i++) {
    const lz = -hd + D * ((i + 0.5) / lamps);
    const off = out.has(i);
    const lampM = off ? deadM : diffuserM;
    if (kind === 'strip') {
      // Batten: a channel screwed flat to the soffit with the tube exposed
      // under it. No diffuser, no tray, nowhere for the dust to hide — which
      // is exactly why it reads as the cheap option.
      const chan = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.12), roseM);
      place(chan, 0, H - 0.04, lz);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 8), lampM);
      tube.rotation.z = Math.PI / 2;
      place(tube, 0, H - 0.12, lz);
      for (const ex of [-0.76, 0.76]) {          // the blackened end caps
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 8),
          off ? new THREE.MeshBasicMaterial({ color: 0x54544e }) : roseM);
        cap.rotation.z = Math.PI / 2;
        place(cap, ex, H - 0.12, lz);
      }
      if (!off) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), haloM);
        gl.rotation.x = Math.PI / 2;
        place(gl, 0, H - 0.19, lz);
      }
    } else if (kind === 'troffer') {
      // a recessed fluorescent tray: the 1997 commercial ceiling, and the
      // reason a fast-food room feels harder than a diner
      const tray = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.42), roseM);
      place(tray, 0, H - 0.05, lz);
      const dif = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), lampM);
      dif.rotation.x = Math.PI / 2;
      place(dif, 0, H - 0.105, lz);
      if (!off) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), haloM);
        gl.rotation.x = Math.PI / 2;
        place(gl, 0, H - 0.12, lz);
      }
    } else {
      // a shallow opal flush-mount on a ceiling rose
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), roseM);
      place(rose, 0, H - 0.03, lz);
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.13, 10), lampM);
      place(dome, 0, H - 0.12, lz);
      if (!off) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), haloM);
        gl.rotation.x = Math.PI / 2;
        place(gl, 0, H - 0.2, lz);
      }
    }
  }

  // ── the way in and the way out ────────────────────────────────────────
  //
  // Both spots are registered HERE, so no builder has to touch crosstown.ts
  // to add an interior — the entry point is the most-contended file in the
  // project (GOTCHAS §11) and ten new interiors would have meant ten agents
  // queueing to edit it.
  //
  // The way out lands you where the spec says, and that landing point must be
  // OUTSIDE the entry trigger's radius or you get sucked straight back in the
  // moment you step out. That bug has shipped once already.
  const doorR = spec.door.r ?? 1.05;
  // ── the [E] spot on the street ──
  //
  // Derived from the SAME published door centre the painter draws with, so the
  // prompt cannot drift off its door — and cannot be left behind when its
  // building moves, which has now happened three times.
  //
  // The facade plane is at x = ±FACE and the wall collider reaches 0.3 m past
  // it, so the spot stands 0.75 m off the plane rather than the 0.45 m the
  // rooms were typing. The auditor measured every kit door spot sitting 0.21 m
  // INSIDE collision, prompting only because the trigger radius is five times
  // the intrusion. This puts it on ground you can actually stand on.
  //
  // Along the street: a west facade is the +x face of its box, where three.js
  // runs u along -z, so u = 0 is the HIGH-z edge. An east facade is the -x
  // face and runs the other way. That sign is the whole conversion.
  // `doorStandFor` handles a CUT FACE as well as a flat frontage — the bodega's
  // door is on a canted bay and "0.75 m out from the facade plane" has no
  // meaning there. For a flat frontage it returns exactly what the line below
  // it used to compute.
  const stand = fr ? doorStandFor(fr.name) : null;
  const spotOnStreet = stand
    ? stand
    : doorWorld !== null && fr
      ? { x: fr.side * (FACE - 0.75), z: doorWorld }
      : { x: spec.door.x ?? 0, z: spec.door.z ?? 0 };
  // and stepping out: 1.5 m along the walk, which clears the trigger by more
  // than the 0.35 m margin the kit warns below
  const dp = fr ? doorPointFor(fr.name) : null;
  const outAt = spec.door.outX !== undefined && spec.door.outZ !== undefined
    ? { x: spec.door.outX, z: spec.door.outZ, yaw: spec.door.outYaw ?? 0, gy: spec.door.outGy ?? 0 }
    : dp && dp.nz !== 0
      // A CUT FACE: step out along its normal, into the open corner. Sending
      // you "along the walk" the way a flat frontage does has no meaning on a
      // chamfer — it walks you into the shopfront next door, which is what the
      // bodega's landing did.
      ? {
        // 3.0: the kit warns below when the landing sits inside the
        // way-in trigger, and D widened the chamfer trigger to 1.5 m, so the
        // landing needs 1.85 m clear of the door it stands 0.75 m in front of.
        x: dp.x + dp.nx * 3.0, z: dp.z + dp.nz * 3.0,
        yaw: Math.atan2(dp.nx, dp.nz), gy: ctx.KERB_H,
      }
      : { x: (fr ? fr.side : -1) * (FACE - 1.2), z: spotOnStreet.z + 1.5,
        yaw: (fr ? fr.side : -1) < 0 ? Math.PI / 2 : -Math.PI / 2, gy: ctx.KERB_H };
  // where the way-out trigger sits, and — separately — where you actually land
  // when you come in. They are not the same point: landing ON the threshold
  // puts you inside the swing of the door leaf and a step from walking back
  // out by accident. Land a stride clear of it, still close enough that the
  // way-out prompt is already up, so you always know how to leave.
  // On a chamfered room the way OUT is on the cut face, not on the front wall —
  // otherwise the door you walk through and the door you leave by are in
  // different walls, which is the original complaint wearing a new hat.
  const CH = spec.chamfer?.door ? spec.chamfer : null;
  const chSx = CH ? (CH.corner.endsWith('right') ? 1 : -1) : 1;
  const chSz = CH ? (CH.corner.startsWith('front') ? 1 : -1) : 1;
  const chMx = CH ? chSx * (hw - CH.cut / 2) : 0;
  const chMz = CH ? chSz * (hd - CH.cut / 2) : 0;
  // 1.3 m in from the cut face, not 0.8.
  //
  // The flat-wall spot sits 0.55 m in and the player stands ~1.3 m in, so they
  // are 0.75 m apart inside a 1.0 m trigger. On the cut face the spot was 0.8 m
  // in while the standable lane projects to ~1.9 m — 1.11 m apart, and the
  // trigger missed. Measured: spot at local (2.83, 3.93), player at (2.05,
  // 3.15), prompt null.
  //
  // Putting the spot where the player actually ends up is the fix; widening the
  // trigger to cover a gap was treating the symptom, and it did not reach.
  const inset = 1.3 / Math.SQRT2;
  const spotX = CH ? wx(chMx - chSx * inset) : wx(dAt);
  const spotZ = CH ? wz(chMz - chSz * inset) : wz(hd - 0.55);
  //
  // WHERE YOU ARRIVE, AND WHICH WAY YOU LOOK, ARE TWO DIFFERENT THINGS.
  //
  // The user: *"when i enter bodega i should be facing perpendicular to the
  // wall door. so looking this way"* — into the store, down the aisles. That
  // does not contradict the cut corner: the THRESHOLD is angled, so you step
  // through diagonally, but the ARRIVAL HEADING is square to the shelving.
  //
  // Measured all ten rooms by walking in from the street: every one already
  // arrives at yaw 0, which is fwd (0,0,-1) — square into the room. So the
  // heading was never the fault. The POSITION was. A chamfered room put the
  // player at (chMx - inset) along x, which for the bodega is 2.48 of a 4.4
  // half-width: hard against the side wall, where facing square means facing
  // the counter rather than down an aisle.
  //
  // So a chamfered arrival now also steps toward the room's centreline. Half
  // way is enough to clear the corner pocket without dumping the player in the
  // middle of the shop, and it is derived from the room's own half-width, so a
  // wider room steps further and a narrow one barely moves.
  const arriveX = CH ? wx((chMx - chSx * inset) * 0.5) : spotX;
  const arriveZ = CH ? wz(chMz - chSz * inset * 1.6) : wz(hd - 1.15);
  //
  // The heading is DERIVED, not typed. `spec.arriveYaw` lets a room that is
  // laid out across its width say so; everything else takes the inward normal
  // of the front wall, which is what "square to the wall the door is in"
  // means and which survives the room being rotated or mirrored. A hand-typed
  // yaw is the class of bug that produced the tax office reversal.
  const arriveYaw = spec.arriveYaw ?? ARRIVE_YAW;
  // A PARTY WALL'S HANDEDNESS IS DERIVED FROM `ARRIVE_YAW` (see `handedness`).
  // A room that is half of one and arrives on some other heading breaks that
  // derivation silently — inside-left stops being −x — so it is refused out
  // loud here rather than producing a west/east that quietly means nothing.
  // This is the check that would have caught item 268 if the handedness had
  // been derived from the start; it exists so the next pair cannot repeat it.
  if (PW && arriveYaw !== ARRIVE_YAW) {
    console.error(`[interior] room '${spec.id}' is half of a party wall but arrives on `
      + `yaw ${arriveYaw}, not the belt's ${ARRIVE_YAW}. The west/east handedness in `
      + `ct/interior.ts is derived from that heading and is NOT valid for this pair.`);
  }
  ctx.spot({
    x: spotOnStreet.x, z: spotOnStreet.z, r: doorR,
    ok: () => (spec.door.ok ? spec.door.ok() : player.x() < 100),
    label: () => spec.label,
    // yaw 0 is fwd = (0,0,-1). The door is in the +z wall, so facing away from
    // it — INTO the room — is yaw 0. Facing Math.PI walks you back out.
    act: () => player.jumpTo(arriveX, arriveZ, arriveYaw, 0),
  });
  ctx.spot({
    // 1.4 on a cut face, 1.0 on a flat one. A corner entrance is approached
    // diagonally and from a wider arc — the natural standing point works out
    // ~1.1 m from the spot, which a 1.0 m trigger misses by a hand's breadth.
    // Measured: prompt=null at (2.05, 3.15) against a spot at (2.83, 3.93).
    x: spotX, z: spotZ, r: CH ? 1.4 : 1.0,
    ok: () => player.x() >= x0 && player.x() < x1,
    label: () => 'out to the street',
    act: () => player.jumpTo(outAt.x, outAt.z, outAt.yaw, outAt.gy),
  });
  // Stepping out must not put you back inside the trigger you just used. Get
  // this wrong and the street prompt reads "into the DINER" the instant you
  // leave, and one more E — the key you are already pressing — puts you
  // straight back. That has shipped once. Checked rather than trusted,
  // because it is invisible until someone walks it.
  const outGap = Math.hypot(outAt.x - spotOnStreet.x, outAt.z - spotOnStreet.z);
  if (outGap < doorR + 0.35) {
    bad(`stepping out lands ${outGap.toFixed(2)} m from the way-in spot, inside its `
      + `${doorR.toFixed(2)} m trigger — you will be sucked straight back in. `
      + `Move outX/outZ at least ${(doorR + 0.35).toFixed(2)} m clear.`);
  }

  // The door leaf, propped open — its FRAME COLOUR and GLAZING now come from
  // the room's own DECLARATION (`LEAF`, above) rather than a hardcoded
  // brown-timber-with-a-window for every room regardless of what it actually
  // declared.
  //
  // notes/door-faces-match.md: 7 of 12 rooms had a facade that disagreed with
  // its own interior door, and 6 of those 7 shared one cause — this default
  // read `LEAF` for `clearW`/`h` (sizing the wall opening) but never for
  // `frame.colour` or `glazing` (what the leaf actually LOOKS like), so every
  // room got the same single timber leaf with a small window no matter what
  // its exterior showed. jail is the sharpest case: it already declares
  // `frame: steel, glazing: 'none'` and the kit was ignoring both.
  //
  // A room that has never declared a `leaf` still gets exactly the old
  // default (`doorLeafFor` falls back to timber/vision-panel), so this is
  // additive: nothing changes until a room's own DOOR speaks up.
  //
  // NOT done here: `LEAF.leaves` (1 vs 2). Five rooms (casino, hotel, bank,
  // library, pawn) already hide this single mesh and hang their OWN leaf —
  // they find it by `geometry.type === 'PlaneGeometry'` and a 32x64 texture
  // image, and hide it only when they find EXACTLY ONE. Drawing a second
  // mesh here for any room whose declared `leaves` is 2 makes three of those
  // five (bank, casino, library — the two that resolve `bName` via
  // `spec.building`/`spec.frontage`) find TWO kit leaves, hide neither, and
  // render their own on top: two doors, stacked, in three rooms that were
  // correct before this change. Measured, not guessed — `node
  // scripts/bugsweep.mjs` against a leafPair-based version of this fix printed
  // exactly that: `[interior:bank] expected 1 kit door leaf to hide, found 2`,
  // same for casino and library. Reverted to a single mesh for that reason.
  // jail's leaf COUNT (it declares 2, matching its real riveted double door)
  // is therefore still wrong after this fix — only its colour and glazing are
  // corrected. Closing the count needs either a per-room opt-out this kit
  // does not have yet, or — cheaper — giving `int-jail.ts` the same "hide the
  // kit's one leaf, hang leafPair's own" recipe the other five already use,
  // which is a one-file change in O's room, not this kit. Flagged, not done.
  const frameHex = '#' + (LEAF?.frame.colour ?? 0x3a2c22).toString(16).padStart(6, '0');
  const glazing = LEAF?.glazing ?? 'vision-panel';
  // the glass rect in the leaf's 32x64 texel canvas, by declared coverage —
  // 'none' draws no glass at all (jail's riveted steel), 'vision-panel' is
  // the kit's old small window, 'half' and 'full' scale up from there.
  const GLASS: Record<DoorLeaf['glazing'], [number, number, number, number] | null> = {
    none: null,
    'vision-panel': [4, 4, 24, 40],
    half: [4, 4, 24, 28],
    full: [3, 3, 26, 58],
  };
  const leafT = declareSurface(pixTex(32, 64, (g) => {
    g.fillStyle = frameHex; g.fillRect(0, 0, 32, 64);
    const gl = GLASS[glazing];
    if (gl) {
      const [gx, gy, gw, gh] = gl;
      g.fillStyle = '#8a97a2'; g.fillRect(gx, gy, gw, gh);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(gx, gy + gh / 2, gw, 2);
    }
    g.fillStyle = '#c9b45e'; g.fillRect(25, 34, 3, 3);
  }), 'detail');
  // Hung on a pivot at the hinge rather than positioned at an angle by hand:
  // a plane placed at its own centre and then rotated swings its inner half
  // back THROUGH the jamb, which is what the previous version did. Hinged on
  // the outer face and swung outward, it cannot reach the wall at all.
  //
  // (That paragraph used to end "and it reads from inside as a propped shop
  // door rather than as a hole." It no longer does, and the claim went with the
  // angle — see the LEAF_AJAR block below. The hinge arithmetic still matters:
  // it is what keeps the leaf out of the jamb whenever the angle is not zero.)
  //
  // The hinge is done by arithmetic rather than by a pivot Group, for the same
  // reason everything else here is: a child of a nested group carries a LOCAL
  // position, `dimWorld` reads that local position, and the leaf alone would
  // go dark at 2am in an otherwise lit room. So swing it by hand — offset the
  // centre a half-leaf out from the hinge along the open angle, which is
  // exactly what the pivot was doing.
  // ── ITEM 193: THE ANGLE IS `LEAF_AJAR` NOW, NOT A CONSTANT OF THIS FILE ────
  //
  // This read `const SWING = -0.85;   // ~49° open, swinging outward` — the last
  // survivor of the eight different door angles item 159 collapsed. That item
  // made `ct/vice.ts` export a single `LEAF_AJAR = 0` and removed the swing
  // parameter from `leafPair` entirely, so *"a caller that cannot pass one
  // cannot copy the wrong one."* This file was outside its scope and kept its
  // own, so the shared room kit went on hanging every unreplaced leaf 49° open
  // while the twelve buildings that matter hung theirs shut.
  //
  // ⚠ `LEAF_AJAR = 0` IS NOT A TASTE CALL and `vice.ts:160-179` argues it at
  // length: nine of the twelve shopfronts have **no door geometry at all** — the
  // door is painted into the facade, shut — and the two that hang real leaves on
  // the street (jail, bodega) hang them shut. Zero is the only value that can
  // agree with what is already outside.
  //
  // IMPORTED FROM `vice.ts`, NOT FROM `doors.ts`, and that is load-bearing.
  // `ct/doors.ts` looks like the right home for shared door state and is a trap:
  // it eagerly globs `int-*.ts`, and every one of those imports only
  // `type DoorDecl` precisely so no runtime edge exists. A runtime import closes
  // the cycle and GOTCHAS 28 drops the module **from the built bundle only** —
  // source looks fine and the world is broken. `vice.ts` imports paint,
  // tex-world, civic and fp, and nothing that reaches back here, so this edge is
  // safe in the direction it is drawn.
  //
  // The arithmetic below is left exactly as it was rather than simplified for
  // the zero case, for the reason `vice.ts` types the constant as `number`: the
  // day this value moves, `cos`/`sin` still have to be here.
  const SWING = LEAF_AJAR;
  const leafW = dW * 0.95;
  const hx = dAt - dW / 2, hz = hd + T + 0.02;    // the hinge, on the OUTER face
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(leafW, DOOR_H * 0.98),
    new THREE.MeshBasicMaterial({ map: leafT, side: THREE.DoubleSide }));
  leaf.rotation.y = SWING;
  place(leaf,
    hx + Math.cos(SWING) * leafW / 2, DOOR_H / 2,
    hz - Math.sin(SWING) * leafW / 2);

  // the room's own floor picker, in world coords, answering for THIS slab. One
  // ── the levels are BUILT, not just answered ──
  //
  // `floor` told the picker how high the ground was and drew nothing, so a
  // player walked up an invisible ramp. That is a fair reading of "the kit
  // cannot express a stair": it could express a floor HEIGHT and not a STAIR.
  //
  // Every RoomLevel is now a plinth — a box from the room floor up to its own
  // height, across its own footprint. A dais is one row and looks like a dais;
  // a stair is six thin rows and looks like a stair, because stacked plinths of
  // rising height ARE a stair. Nothing to keep in step with the picker, because
  // it is the same list.
  //
  // The function form draws nothing and cannot: a closure has no extent to
  // build from. That is the trade — regions if you want to see it, a function
  // if you are shaping ground you have already built yourself.
  if (Array.isArray(spec.floor)) {
    for (const L of spec.floor) {
      if (L.y <= 0.001) continue;
      const bw = L.x1 - L.x0, bd = L.z1 - L.z0;
      if (bw <= 0.001 || bd <= 0.001) continue;
      // a floor riser: bw across, bd deep, L.y tall. Its two axes are genuinely
      // different lengths, so one repeat for all four sides was wrong on the
      // ±x pair by exactly bd/bw.
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, L.y, bd),
        boxMats(bw, bd, 0, L.y));
      place(m, (L.x0 + L.x1) / 2, L.y / 2, (L.z0 + L.z1) / 2);
    }
  }

  // registry for the world: this is the same `gy` the entry point already
  // dispatches over for the exterior flights.
  const levelAt = (wxx: number, wzz: number): number => {
    const f = spec.floor;
    if (!f) return 0;
    const lx = wxx - cx, lz = wzz - cz;
    if (typeof f === 'function') return f(lx, lz) ?? 0;
    let y = 0;
    for (const L of f) if (lx >= L.x0 && lx <= L.x1 && lz >= L.z0 && lz <= L.z1) y = L.y;
    return y;                       // later rows win, so a mezzanine can sit over a dais
  };
  SLABS.push({ id: spec.id, x0, x1, gy: (gx, gz) => levelAt(gx, gz), w: W, d: D, cx, cz,
    // in the cut face when the door lives there, otherwise mid front wall
    door: CH
      ? { x: chMx, z: chMz, nx: -chSx / Math.SQRT2, nz: -chSz / Math.SQRT2 }
      : { x: dAt, z: hd, nx: 0, nz: -1 } });

  return {
    cx, cz, W, D, H, wx, wz, group, colliders, doorAt: dAt,
    put: (m, lx, y, lz) => place(m, lx, y, lz),
    person: (look, lx, lz, o = {}) => {
      const s = citizenSprite(o.seated ? { ...look, seated: true } : look,
        { facing: o.facing ?? 0, h: o.h, w: o.w });
      // Standing goes on the FLOOR, seated goes on the SEAT TOP: the origin
      // moves with the pose and citizenPlane owns the 0.445 m hip offset.
      place(s.mesh, lx, o.y ?? 0, lz);
      // TAG IT AS A PERSON. A circle test that selects "textured plane about
      // person-height" also catches the thrift's mannequin and the diner's
      // framed photographs, so it cannot tell a figure that wrongly stares at
      // you from a picture that correctly does. The kit is the only thing that
      // knows which meshes are people; saying so here is what makes
      // "does every figure turn?" answerable instead of inferable.
      s.mesh.userData.citizen = true;
      s.mesh.userData.seated = !!o.seated;
      // …AND CLAIM THE SEAT. Read back off the mesh rather than recomputed from
      // `lx`/`lz`: `place()` has just written `cx + lx`, and the room group sits
      // at the world origin with its children carrying world positions, so this
      // IS the world coordinate and cannot drift from where the figure actually
      // is. Deriving beats retyping (BUILDER-BRIEF §8).
      if (o.seated) TAKEN.push({ x: s.mesh.position.x, z: s.mesh.position.z });
      // the sprite picks its painted view from where YOU are, so it needs the
      // frame. LATE, after the world has moved: it is reacting to the finished
      // position, the same as the billboard pass.
      ctx.onFrame((f) => s.update(f.px, f.pz, f.dt), HOOK.LATE);
    },
    clock: (o) => {
      // A THIN WRAPPER over ct/clockface.ts, which is where the dial and the
      // hand-driving now live. They moved out because a FACADE clock cannot
      // call a room primitive — the church tower carries the most visible
      // clock in the game and it is not inside any buildRoom. One mechanism
      // for the world, the same argument as the floor picker and the door
      // descriptor.
      const cf = clockFace({ r: o.r, face: o.face, rim: o.rim, hands: o.hands });
      cf.group.rotation.y = o.rotY ?? 0;
      place(cf.group, o.lx, o.y, o.lz);
      // LATE, and reading hourF every frame with no cache, so a time jump
      // (C's sleep) carries the hands with it for free.
      ctx.onFrame((f) => cf.update(f.hourF), HOOK.LATE);
    },
    sign: (map, w, h, lx, y, lz, rotY = 0) => {
      for (const flip of [0, Math.PI]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map, side: THREE.FrontSide }));
        m.rotation.y = rotY + flip;
        place(m, lx, y, lz);
      }
    },
    solid: (lx, lz, w, d) => wall(lx - w / 2, lx + w / 2, lz - d / 2, lz + d / 2),
    inside: () => player.x() >= x0 && player.x() < x1,
  };
}

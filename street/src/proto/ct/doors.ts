// WHERE EACH SHOP'S DOOR IS — declared by the ROOM, read by the facade.
//
// The user, twice: *"make the exteriors match the interiors."* The first pass
// had it the other way round — `frontageOf()` decided where the door went and
// the room moved to suit — and that is backwards on the merits as well as
// against the ask. A room is hand-built: a counter, a till, a queue lane and a
// walking route that all depend on where you come in. A painted facade door is
// one x position in a texture. Move the cheap thing to match the expensive one.
//
// The mechanism is unchanged and it was the right one: ONE number in WORLD
// coordinates on the axis the roster lays buildings out on, three consumers,
// each applying its own mirror exactly once.
//
//   the room     declares it, in the local terms it is actually built in
//   the painter  reads `doorWorldFor(name)` and paints its door there
//   the [E] spot reads the same world number and stands in front of it
//
// ── why this is a module-scope declaration and not a build-time call ──
//
// The facade is painted during `buildStreet`, which runs early. Interiors are
// built LAST and must stay last (GOTCHAS §2 — the seeded stream). So a room
// that published its door while building would publish it long after the
// painter had already drawn one. These are `export const` declarations,
// collected by a glob at IMPORT time, so the answer exists before anything
// builds.

/** A room's own statement of where its door is. Declared in the room's file. */
import { declareDoorWorld } from './tex-world';
import { FACE } from './rng';

/** A room's own statement of where its door is. Declared in the room's file. */
/** The physical door, published by the room and consumed by BOTH sides. */
export interface DoorLeaf {
  /** total clear opening across ALL leaves, in metres */
  clearW: number;
  /** clear height. 2.15 is domestic; a commercial entrance is 2.4–2.8 */
  h: number;
  /** 1 for a shop door, 2 for an entrance somebody arrives at */
  leaves: 1 | 2;
  frame: { colour: number; material: 'timber' | 'steel' | 'brass' | 'aluminium' };
  glazing: 'none' | 'vision-panel' | 'half' | 'full';
}

/** the leaf a building declares, or the plain timber door the kit used before
 *  this existed — an undeclared building keeps exactly what it had */
export function doorLeafFor(building: string): DoorLeaf {
  ensure();
  const d = DECLS.get(building);
  return d?.leaf ?? {
    clearW: d?.width ?? 1.1, h: 2.15, leaves: 1,
    frame: { colour: 0x6a5a46, material: 'timber' }, glazing: 'vision-panel',
  };
}

export interface DoorDecl {
  /** the roster name of the building this room is inside */
  building: string;
  /** the building's frontage width and centre, from the roster */
  w: number;
  cz: number;
  /** -1 west (facade at x = -FACE), +1 east */
  side: -1 | 1;
  /** door centre in the ROOM's local x, signed from the room centre. This is
   *  the number the room is actually laid out around. */
  at: number;
  /** clear door width in metres. @deprecated — use `leaf.clearW`, which the
   *  facade and the room BOTH build from. Kept so the six rooms that predate
   *  `leaf` keep working while they are converted. */
  width?: number;
  /**
   * WHAT THE DOOR IS, not just where it is.
   *
   * The user, on the fourth interior/exterior disagreement in a row — the tax
   * office door on the wrong side, the bodega's room shape, the hotel palette,
   * and then a casino whose *interior* door is a narrow single domestic leaf
   * with a small window while its *exterior* is a wide gold-framed DOUBLE door
   * under a lit canopy:
   *
   *   *"Your frontage descriptor already publishes where the door IS. IT MUST
   *   ALSO PUBLISH WHAT THE DOOR IS … a single-leaf room door in a double-door
   *   building becomes impossible rather than something a builder has to
   *   remember."*
   *
   * That is the same argument as the position, one level up. All four bugs are
   * ONE FACT AUTHORED TWICE, and the fix is the same shape every time: publish
   * it once, build both sides from it. `at`/`face` killed the position bug;
   * this kills the rest of the leaf.
   *
   * Read it with `doorLeafFor(building)`, which falls back to a plain 1.1 m
   * timber leaf so an undeclared room is unchanged rather than broken.
   */
  leaf?: DoorLeaf;
  /**
   * A door on a CUT FACE rather than a flat frontage — the bodega's canted
   * corner bay, cut at 45°.
   *
   * "A position along the frontage" has no meaning on a face that is not on
   * the roster's axis, so a chamfered door has to be given as what it actually
   * is: a point in world x/z, and the outward normal of the face it sits in.
   * The axis-aligned case is the SAME THING with a normal of (±1, 0) — see
   * `doorPointFor`, which derives it — so the chamfer is not a special case
   * bolted on, it is the general form and the flat one is the shortcut.
   *
   * Without this the bodega falls out of the descriptor the moment anything
   * moves, which is how it got misaligned in the first place.
   */
  face?: { x: number; z: number; nx: number; nz: number };
}

/** How wide a room is for a given frontage — the kit's rule, in one place so
 *  the local↔world conversion here and `buildRoom` cannot disagree. */
export function roomWidthFor(frontageM: number): number {
  return Math.max(4, frontageM - 1.2);
}

// Collected LAZILY, not at module init.
//
// The glob eagerly IMPORTS every ct module, and ct/bodega.ts imports this one
// back for `doorStandFor` — a cycle. Reading `mod.DOOR` while this module is
// still initialising then throws "Cannot access 'DOOR' before initialization"
// and takes the whole world down. Importing is fine; READING has to wait until
// everyone has finished evaluating, which is what `ensure()` does.
// `./int-*.ts`, NOT `./*.ts` — and the narrowing is the cycle fix.
//
// Globbing every sibling made this module import `interior.ts`, which imports
// four values back. That is an import cycle, and a module caught in one
// resolves to `undefined` inside an eager glob: any DOOR it declares is dropped
// SILENTLY, with no error and no gap in any count unless you compare the two
// totals. SEVENS (then called GOLDEN ACES) was lost exactly that way in the
// BUILT BUNDLE while the
// dev server showed all eight — see notes/BLOCKED-C.md §0 and BLOCKED-D.md.
//
// Every door in the world is declared by an `int-*.ts`, and all eight of those
// import only `type DoorDecl`, which TypeScript erases — so they have no
// runtime edge back here and cannot form a cycle. Narrowing the pattern drops
// `interior.ts`, `world.ts` and `civic-doors.ts` out of the glob entirely: the
// bundle now reports ZERO undefined namespaces, where it reported three.
//
// Deliberately NOT the bigger refactor (invert to a push registry, or have
// world.ts feed this one). I tried that first and it works, but it changes the
// contract: importing `doors.ts` alone would no longer populate it, and FOUR
// harnesses do exactly that — two of G's, one of A's, one of mine. Breaking
// three builders' tools to fix a latent problem is the wrong trade, and
// `scripts/doors-declared.mjs` guards the count either way, so a future
// non-`int-` module that declares a door goes red rather than missing.
const MODS = import.meta.glob<Record<string, unknown>>('./int-*.ts', { eager: true });
const DECLS = new Map<string, DoorDecl>();
let collected = false;

function ensure(): void {
  if (collected) return;
  collected = true;
  for (const path of Object.keys(MODS).sort()) {
    // An UNDEFINED namespace is not the same as "this module has no door", and
    // the `?.` that stopped the world crashing here cannot tell them apart. A
    // module caught in an import cycle with this one — directly, or through
    // any chain of siblings — resolves to undefined inside an eager glob, so
    // any DOOR it declares is dropped SILENTLY. That is the worse bug: a room
    // with no door looks exactly like a room that never declared one, the same
    // class as the missing glyph that shipped "BUY ERE AY ERE".
    // Asked for in notes/BLOCKED-C.md §0.2.
    if (MODS[path] === undefined) {
      console.warn(`[doors] ${path} resolved to an UNDEFINED namespace at collection `
        + `time — it is in an import cycle with ./doors, so any DOOR it declares is `
        + `being dropped without trace. See notes/BLOCKED-C.md §0.`);
      continue;
    }
    const d = MODS[path]?.DOOR as DoorDecl | undefined;
    if (!d || typeof d.building !== 'string') continue;
    if (DECLS.has(d.building)) {
      console.warn(`[doors] two rooms both claim ${d.building} — ${path} ignored`);
      continue;
    }
    DECLS.set(d.building, d);
  }
}

/**
 * Hand every declared door to the facade painter.
 *
 * Called from the entry point BEFORE buildStreet, which is the constraint that
 * shapes this whole module: the facade is painted early and the rooms are
 * built last, so the rooms have to have spoken before a single shopfront is
 * drawn. It is explicit rather than a module-init side effect because the
 * import cycle above makes side effects at init unsafe.
 */
export function publishDeclaredDoors(): void {
  ensure();
  for (const [name, d] of DECLS) {
    // A cut face has no position along an axis, so there is nothing to tell a
    // painter that draws in canvas columns — and the bodega's facade is
    // APPROVED and must not move anyway ("do not change the facade i love it").
    if (d.face) continue;
    const z = doorWorldFor(name);
    if (z !== null) declareDoorWorld(name, z);
  }
}

/**
 * The world coordinate of a building's door, along the axis its street runs
 * on, or null if no room has declared one (an ordinary shopfront with no
 * interior — the painter keeps its own default for those).
 *
 * The mirror lives here, once. Inside you stand with the front wall behind
 * you, so the wall you look back at is that same wall reversed: multiplying
 * the room's local offset by `side` performs the swap. Check it on the west
 * side, where the observer's right is -z outside and -x inside.
 */
export function doorWorldFor(building: string): number | null {
  ensure();
  const d = DECLS.get(building);
  if (!d) return null;
  const k = roomWidthFor(d.w) / d.w;              // room is narrower than the front
  return d.cz + d.side * (d.at / k);
}

/** …and the same fact as metres from the frontage's LEFT edge, which is what
 *  a painter wants: it works in canvas columns from u = 0. West facades are
 *  the +x face of their box, where three.js runs u along -z, so u = 0 is the
 *  HIGH-z edge; east facades run the other way. */
export function doorAlongFrontage(building: string): number | null {
  ensure();
  const d = DECLS.get(building);
  const z = doorWorldFor(building);
  if (!d || z === null) return null;
  return d.side < 0 ? d.cz + d.w / 2 - z : z - (d.cz - d.w / 2);
}

/** the declared clear width, for the painter to draw the opening at */
export function doorWidthFor(building: string): number | null {
  ensure();
  return DECLS.get(building)?.width ?? null;
}

/**
 * The door as a POINT and an OUTWARD NORMAL, which is the general form: a
 * chamfered face gives them directly, a flat frontage derives them from its
 * axis. Everything that needs to stand in front of a door uses this, so a cut
 * face needs no special handling anywhere downstream.
 */
export function doorPointFor(building: string): { x: number; z: number; nx: number; nz: number } | null {
  ensure();
  const d = DECLS.get(building);
  if (!d) return null;
  if (d.face) {
    const L = Math.hypot(d.face.nx, d.face.nz) || 1;
    return { x: d.face.x, z: d.face.z, nx: d.face.nx / L, nz: d.face.nz / L };
  }
  const z = doorWorldFor(building);
  if (z === null) return null;
  // A flat frontage faces OUT ACROSS THE STREET, which is away from the
  // building: +x on the west side (side -1), -x on the east (side +1). So the
  // normal is MINUS side. Getting that backwards put every derived stand point
  // 0.75 m inside its own shopfront instead of 0.75 m in front of it — and
  // then 1.5 m from where the player can actually stand, which is just outside
  // the wall collider.
  return { x: d.side * FACE, z, nx: -d.side, nz: 0 };
}

/**
 * Where you STAND to use a door: `standoff` metres out along its normal.
 *
 * 0.75 rather than the 0.45 the rooms used to type. The facade plane is at
 * ±FACE and the wall collider reaches 0.3 m past it, so 0.45 put every trigger
 * 0.21 m inside collision — it prompted only because the radius is five times
 * the intrusion. On the bodega's chamfer the same 0.75 is the first standable
 * point along the normal, measured.
 */
export function doorStandFor(building: string, standoff = 0.75): { x: number; z: number } | null {
  const d = doorPointFor(building);
  return d ? { x: d.x + d.nx * standoff, z: d.z + d.nz * standoff } : null;
}

/** every declaration, for `scripts/mirror-walk.mjs` and the desk */
export function declaredDoors(): DoorDecl[] { ensure(); return [...DECLS.values()]; }

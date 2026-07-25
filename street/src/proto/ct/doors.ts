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
  /** clear door width in metres */
  width?: number;
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
const MODS = import.meta.glob<Record<string, unknown>>('./*.ts', { eager: true });
const DECLS = new Map<string, DoorDecl>();
let collected = false;

function ensure(): void {
  if (collected) return;
  collected = true;
  for (const path of Object.keys(MODS).sort()) {
    const d = MODS[path].DOOR as DoorDecl | undefined;
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
  // a flat frontage faces straight out across the street: -x on the west side
  return { x: d.side * FACE, z, nx: d.side, nz: 0 };
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

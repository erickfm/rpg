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
}

/** How wide a room is for a given frontage — the kit's rule, in one place so
 *  the local↔world conversion here and `buildRoom` cannot disagree. */
export function roomWidthFor(frontageM: number): number {
  return Math.max(4, frontageM - 1.2);
}

const DECLS = new Map<string, DoorDecl>();
{
  const mods = import.meta.glob<Record<string, unknown>>('./int-*.ts', { eager: true });
  for (const path of Object.keys(mods).sort()) {
    const d = mods[path].DOOR as DoorDecl | undefined;
    if (!d || typeof d.building !== 'string') continue;
    if (DECLS.has(d.building)) {
      console.warn(`[doors] two rooms both claim ${d.building} — ${path} ignored`);
      continue;
    }
    DECLS.set(d.building, d);
  }
  // …and tell the painter. A's `declareDoorWorld` takes the same world number
  // this module computes, so the shopfront's door is painted where the room
  // says its door is — which is the whole point of the flip: "make the
  // exteriors match the interiors".
  //
  // At MODULE scope, which is load-bearing. interior.ts glob-imports the rooms
  // eagerly and crosstown.ts imports interior.ts, so every declaration is in
  // before buildStreet paints a single facade. A room that spoke while
  // BUILDING would speak long after the painter had drawn its door.
  for (const [name] of DECLS) {
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
  const d = DECLS.get(building);
  const z = doorWorldFor(building);
  if (!d || z === null) return null;
  return d.side < 0 ? d.cz + d.w / 2 - z : z - (d.cz - d.w / 2);
}

/** the declared clear width, for the painter to draw the opening at */
export function doorWidthFor(building: string): number | null {
  return DECLS.get(building)?.width ?? null;
}

/** every declaration, for `scripts/mirror-walk.mjs` and the desk */
export function declaredDoors(): DoorDecl[] { return [...DECLS.values()]; }

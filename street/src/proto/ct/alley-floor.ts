/** The alley's floor height, and NOTHING ELSE. This file exists to have no
 *  imports at all.
 *
 *  It was in `ct/street.ts` until the alley was split out of it. That split
 *  would have created a cycle if this had travelled with the rest —
 *  `street -> alley -> cat -> street`, because `ct/cat.ts` asks for the floor
 *  and `ct/alley.ts` calls the cat. GOTCHAS §28 is what that costs: a module in
 *  an import cycle can resolve to an undefined namespace at collection time,
 *  the bundler orders modules differently from the browser's own loader, and
 *  the result is a fault that is REAL IN THE BUILT OUTPUT and absent in dev.
 *  Two agents spent a day disagreeing about 8 doors versus 7 over exactly that.
 *
 *  A leaf module cannot be in a cycle, so this is a leaf. `ct/street.ts`
 *  re-exports both names, which is why nothing that imported them had to change.
 *
 *  ── why the height is a function at all ────────────────────────────────────
 *
 *  Published because `ct/props.ts` had `const ALLEY_Y = 0.006;` under the
 *  comment *"ct/street.ts lays the alley slab at 0.005"* — true when written,
 *  and I then laid the alley falling 6 cm into a drain. Measured after the dish
 *  landed: 22 objects standing in the bowl at the old flat height, the worst of
 *  them 57 mm in the air. That is `46b330d35`'s finding exactly ("B's park
 *  lamps stand at a hard-coded KERB_H, and I moved the ground"), and this time
 *  the ground I moved was under someone else's props.
 *
 *  A constant in another file cannot notice that. A function can, so the fact
 *  lives with the module that owns the floor and everyone else asks.
 *
 *  `ctx.ground` is the registration for what the PLAYER walks and it already
 *  carries this; it has no query side, and `Site` is a flat rect with a single
 *  `y`, so neither existing channel can hand out a dished surface. Hence a
 *  plain export.
 */

let alleyDish: (x: number, z: number) => number = () => 0;

export const ALLEY_SLAB_Y = 0.005;

/** ── THE PAWN ALLEY IS FLUSH WITH THE PAVEMENT, AND THAT IS THE WHOLE POINT ──
 *
 *  The user, 2026-08-04: *"make the long alley flush with the sidewalk"*.
 *
 *  The long alley (2.5 m, between PAWN and No. 227) was laid at 0.009 — road
 *  level — while the walk it opens off is at KERB_H. That is a 13 cm DROP at
 *  the mouth, and it is not a kerb: kerbs in this world stand at |x| = ROAD_HALF,
 *  out at the carriageway. This mouth is at the BUILDING LINE, two metres of
 *  pavement inland, so there was nothing there for a step to mean. You walked
 *  along the pavement and fell into a slot.
 *
 *  0.14 IS CROSSTOWN'S `KERB_H`, restated here because this file is a LEAF by
 *  design (see the header — a cycle here cost two agents a day) and cannot
 *  import it. It is the one number the alley reads: `ct/props.ts` lays the slab
 *  and registers the walking height off it, and `ct/pawn-alley.ts` stands every
 *  piece of its furniture on it. If the kerb ever moves, move this with it.
 *
 *  The west alley keeps ALLEY_SLAB_Y above — that one is a SERVICE YARD off the
 *  road, its own mouth already documents its 14 cm step, and the user named the
 *  long one. */
export const ALLEY2_SLAB_Y = 0.14;

/** Height of the paving SURFACE at (x, z) — what something resting on the
 *  ground should sit on. Outside the alley it is the flat slab, which is what
 *  every caller got before this existed, so importing it can only change an
 *  answer inside the bowl. */
export function alleyFloorY(x: number, z: number): number {
  return ALLEY_SLAB_Y + alleyDish(x, z);
}

/** Installed by `ct/alley.ts` once the dished geometry it describes exists.
 *  Before that call every query returns the flat slab. */
export function setAlleyDish(f: (x: number, z: number) => number) {
  alleyDish = f;
}

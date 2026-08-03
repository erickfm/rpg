// Resolve a room's street-side [E] entry spot WITHOUT naming it.
//
// WHY THIS EXISTS (item 213). Three harnesses identified the casino by the
// literal string `SEVENS` in its `[E]` label — `G-rooms-walk.mjs`,
// `interiors-walk.mjs` and `casinodoor.mjs`. Item 196 renamed the elevation to
// the Orpheus casino wing and the prompt now reads `into the ORPHEUS CASINO`,
// so all three went red on a door that works perfectly. Measured on build
// 9fbd3b781: `G-rooms-walk casino` 3/6, `interiors-walk casino` 13/30, and
// `casinodoor.mjs` printed `SEVENS spots registered: 0` while exiting 0 because
// it had no assertion at all.
//
// A harness that keys on user-facing text breaks every time the user asks for a
// rename, and he asks for renames. There have been two already: SEVENS -> the
// Orpheus casino wing, and JAIL -> HOUSE OF DETENTION (which `interiors-walk`
// was carrying as a hand-maintained `/JAIL|HOUSE OF DETENTION/` alias — the
// same debt, paid a different way).
//
// WHAT IT KEYS ON INSTEAD. `DoorDecl.building` — the roster key the room
// declares in its own `buildRoom` spec (`ct/int-casino.ts:96,126`). It is NOT a
// display name: the casino's is still `SEVENS` on purpose, because it is the
// key into `vice.VICE`, `VICE_DOOR_X` and the DoorDecl registry, and
// `int-casino.ts:131` says in as many words that renaming it is "a break
// dressed as a rename". So it is exactly the stable identifier this needs.
//
// HOW THE JOIN IS EXACT, not approximate. `__ct.doors()` publishes
// `stand` — the standing point derived from the declaration — and `__ct.spots()`
// publishes each `[E]` trigger's own x/z. Measured over all 12 declared doors on
// build 9fbd3b781 (`scripts/probes/w76-door-shape.mjs`), the nearest spot to
// each published `stand` is **0.000 m away, 12 times out of 12**. So this is a
// join on an exact coordinate, not a nearest-neighbour guess, and `TOL` below is
// there to make a door that has LOST its spot resolve to `null` rather than
// silently borrow a neighbour's.
//
// Derived, not retyped (BUILDER-BRIEF §8): every value here is read back from
// the running world. Nothing in this file is a copy of a number the source owns.

/** A door whose [E] spot sits further than this from its published stand is
 *  treated as HAVING NO SPOT, rather than matched to whatever is nearest.
 *  0.05 m, against a measured population where all 12 sit at 0.000. */
export const TOL = 0.05;

/**
 * Read every declared door and the [E] spot standing on it.
 *
 * @param {import('playwright').Page} p
 * @returns {Promise<{
 *   rows: Array<{building:string, standX:number, standZ:number,
 *                 label:string|null, x:number|null, z:number|null,
 *                 r:number|null, off:number}>,
 *   byBuilding: Map<string, object>,
 *   resolved: number, total: number,
 * }>}
 * @throws if the world published no doors at all — "I measured nothing" must
 *         FAIL, never pass vacuously.
 */
export async function entrySpots(p) {
  const rows = await p.evaluate(() => {
    const xz = (v) => (Array.isArray(v) ? { x: v[0], z: v[1] } : v && typeof v.x === 'number' ? { x: v.x, z: v.z } : null);
    const spots = window.__ct?.spots ? window.__ct.spots() : [];
    const doors = window.__ct?.doors ? window.__ct.doors() : [];
    return doors.map((d) => {
      const st = xz(d.stand) ?? xz(d.point);
      if (!st) return { building: d.building, standX: NaN, standZ: NaN, label: null, x: null, z: null, r: null, off: Infinity };
      let best = null, bd = Infinity;
      for (const s of spots) {
        const dd = Math.hypot(s.x - st.x, s.z - st.z);
        if (dd < bd) { bd = dd; best = s; }
      }
      return {
        building: d.building, standX: st.x, standZ: st.z,
        label: best?.label ?? null, x: best?.x ?? null, z: best?.z ?? null,
        r: best?.r ?? null, off: bd,
      };
    });
  });

  // POPULATION FLOOR. A harness that resolves nothing has measured nothing, and
  // the one thing this project has been bitten by nine times this week is a
  // check that reports green over an empty population.
  if (rows.length === 0) {
    throw new Error('entrySpots: __ct.doors() published 0 doors — the world was not measured. '
      + 'This is a harness/world failure, not a pass.');
  }

  const byBuilding = new Map();
  let resolved = 0;
  for (const r of rows) {
    if (r.off > TOL) { r.label = null; r.x = null; r.z = null; r.r = null; }
    else resolved++;
    byBuilding.set(r.building, r);
  }
  return { rows, byBuilding, resolved, total: rows.length };
}

/**
 * The [E] text a room's entry prompt is expected to carry, read from the world.
 * Returns null when the door declares no reachable spot — callers must FAIL on
 * null, never skip.
 */
export function labelFor(index, building) {
  return index.byBuilding.get(building)?.label ?? null;
}

/**
 * Does a HUD prompt belong to this room? The HUD renders `[E] <label>`, the spot
 * publishes `<label>`, so this is containment of the world's own current string
 * — no pattern, no alias list, nothing to update on a rename.
 */
export function promptIsFor(index, building, prompt) {
  const lab = labelFor(index, building);
  if (lab == null || !prompt) return false;
  return String(prompt).includes(lab);
}

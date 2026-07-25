// Walking materials from a check, without dropping half the world.
//
// Four checks this week have had the same defect — a7f2241d (nightgrade),
// 8ceded66 (the hours sweep, which turned out to be seeing 51% of the world),
// b39e97c6 (people-walk), and my own scripts/shells.mjs, which only escaped it
// because the thing it measures is a six-material box and the bug would have
// been obvious. The shape is always:
//
//     const m = o.material; if (!m || Array.isArray(m)) return;   // <- half the world
//     const m = o.material; if (!m.color) return;                 // <- same, quieter
//
// It is not carelessness. These traversals run INSIDE page.evaluate, so there
// has never been anything to import — every author retypes the walk by hand,
// and the multi-material case is exactly the one you forget when the object in
// front of you happens to have one material. A box with six is how the walls,
// bands, castings and every shell on the block are built.
//
// So this installs the walk in the page instead, where a check can reach it.
//
//   import { installMats, blindSpot } from './lib/materials.mjs';
//   await installMats(page);            // after load, before you measure
//   await page.evaluate(() => { ... __mats(o).forEach(m => ...) ... });
//
// `__mats(o)` returns a real array, always — [] for a mesh with no material,
// one entry for the single case, n for the array case. There is no flag and no
// second code path, because a flag is the thing people forget.

/** Define `window.__mats` in the page. Call after load; safe to call twice. */
export async function installMats(page) {
  await page.evaluate(() => {
    window.__mats = (o) => {
      const mm = o && o.material;
      if (!mm) return [];
      return Array.isArray(mm) ? mm.filter(Boolean) : [mm];
    };
  });
}

/**
 * What a naive `o.material` walk would have missed, in this world, right now.
 *
 * Prints one line. Worth calling once in any check that touches materials —
 * the number is the argument, and it is bigger than anyone guesses. Returns
 * `{ naive, all, missed, meshes }` so a check can assert on it if it wants to.
 */
export async function blindSpot(page, { quiet = false } = {}) {
  const r = await page.evaluate(() => {
    let naive = 0, all = 0, meshes = 0;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const mm = o.material;
      if (!mm) return;
      if (!Array.isArray(mm)) naive++;
      all += Array.isArray(mm) ? mm.filter(Boolean).length : 1;
    });
    return { naive, all, meshes };
  });
  r.missed = r.all - r.naive;
  if (!quiet) {
    const pct = r.all ? Math.round((r.naive / r.all) * 100) : 0;
    console.log(`materials: ${r.all} in ${r.meshes} meshes · a naive o.material walk`
      + ` sees ${r.naive} (${pct}%) and misses ${r.missed}`);
  }
  return r;
}

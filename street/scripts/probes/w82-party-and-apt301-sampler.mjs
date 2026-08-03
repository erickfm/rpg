// Item 226, measurement 1 of 2. Two questions, both cheap, both answered before
// a line of `interiors-walk.mjs` is edited.
//
//   Q1. Can the PAGE read the authoritative `PARTY` declaration out of
//       `ct/interior.ts`, so the harness never holds a second copy of the
//       doorway's geometry? (BUILDER-BRIEF §8.)
//   Q2. Item 226 claims leg 6's sampler "assumes every room sits on z = 0, so it
//       sees 1 mesh instead of 440" for apt301. Is that the real number, and in
//       which direction is the row wrong?
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4185/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

// ── Q1 ───────────────────────────────────────────────────────────────────────
// vite dev serves TS transpiled, and the app has ALREADY imported this module,
// so the ES module cache hands back the same instance rather than re-running it.
const party = await p.evaluate(async () => {
  try {
    const m = await import('/src/proto/ct/interior.ts');
    return { ok: true, PARTY: m.PARTY ?? null, keys: Object.keys(m).length };
  } catch (e) { return { ok: false, err: String(e) }; }
});
console.log('Q1  import(/src/proto/ct/interior.ts) ->', JSON.stringify(party));

// ── Q2 ───────────────────────────────────────────────────────────────────────
const dims = await p.evaluate(() => window.__ct.roomDims());
const apt = dims.find((d) => d.id === 'apt301');
console.log('\nQ2  apt301 published as', JSON.stringify(apt));

// leg 6's sampler verbatim (interiors-walk.mjs:1254-1265), and the same sampler
// with the room's own cz/y honoured. Counted as MESHES and as MATERIALS, because
// the leg's population floor counts materials.
const counts = await p.evaluate(([cx, cz, y]) => {
  const box = (fx, fz, fy, rz, ry) => {
    let meshes = 0; const mats = new Set();
    window.__ct.scene().updateMatrixWorld(true);
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - fx) > 8) return;
      if (Math.abs(wp.z - fz) > rz) return;
      if (ry !== null && Math.abs(wp.y - fy) > ry) return;
      meshes++;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) if (m && m.color && !m.transparent) mats.add(m.uuid);
    });
    return { meshes, mats: mats.size };
  };
  return {
    asWritten: box(cx, 0, 0, 8, null),        // leg 6 today: |wp.z| > 8, no y at all
    czAware:   box(cx, cz, y, 8, null),       // the room's own cz
    czAndY:    box(cx, cz, y, 8, 4),          // …and its own storey
  };
}, [apt.cx, apt.cz, apt.y]);
console.log('    leg-6 sampler AS WRITTEN (|z|<8 about z=0):', JSON.stringify(counts.asWritten));
console.log('    leg-6 sampler cz-aware              :', JSON.stringify(counts.czAware));
console.log('    leg-6 sampler cz + storey           :', JSON.stringify(counts.czAndY));

// And what IS at the as-written box, so we can say what it was measuring instead.
const whatIsThere = await p.evaluate((cx) => {
  const names = {};
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8) return;
    names[o.name || '(unnamed)'] = +wp.y.toFixed(2);
  });
  return names;
}, apt.cx);
console.log('    what the as-written box actually contains:', JSON.stringify(whatIsThere));

await b.close();

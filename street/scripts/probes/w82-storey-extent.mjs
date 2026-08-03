// Item 226. Before typing a y bound into leg 6's sampler, ask what the world's
// vertical extents actually are — a constant I choose is a constant that is
// wrong for the first room that disagrees, which is the whole defect being
// fixed here.
//
//   · how tall is a belt room's mesh population above its floor?  (a bound
//     tighter than this would silently drop ceiling lights from 12 rooms)
//   · how far apart are the walk-up's flats?  (a bound looser than half this
//     judges 302 and the stairwell as part of 301)
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

const DIMS = await p.evaluate(() => window.__ct.roomDims());
const rows = await p.evaluate((dims) => {
  window.__ct.scene().updateMatrixWorld(true);
  return dims.map((d) => {
    let lo = Infinity, hi = -Infinity, n = 0;
    const hist = {};
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - d.cx) > 8 || Math.abs(wp.z - d.cz) > 8) return;
      n++;
      lo = Math.min(lo, wp.y); hi = Math.max(hi, wp.y);
      const bucket = Math.round((wp.y - d.y) * 2) / 2;
      hist[bucket] = (hist[bucket] ?? 0) + 1;
    });
    return { id: d.id, y: d.y, n, lo, hi, hist };
  });
}, DIMS);

for (const r of rows) {
  console.log(`${r.id.padEnd(10)} floor y=${r.y.toFixed(2)}  ${String(r.n).padStart(4)} meshes  `
    + `origins y ${r.lo.toFixed(2)}..${r.hi.toFixed(2)}  (relative ${(r.lo - r.y).toFixed(2)}..${(r.hi - r.y).toFixed(2)})`);
}

// the walk-up's storeys, from the registry plus whatever else is stacked there
const apt = rows.find((r) => r.id === 'apt301');
console.log('\napt301 mesh-origin histogram, relative to its own floor:');
for (const k of Object.keys(apt.hist).map(Number).sort((a, c) => a - c)) {
  console.log(`  ${String(k).padStart(6)} m  ${'#'.repeat(Math.min(60, apt.hist[k]))} ${apt.hist[k]}`);
}
await b.close();

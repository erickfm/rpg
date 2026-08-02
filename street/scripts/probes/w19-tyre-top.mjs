// ONE QUESTION: how high is the top of a tyre, actually?
//
// `ct/cars.ts` states 0.68 in several comments. Item 48 says a measurement gives
// 0.66, and item 47 reasons about first-step margins of 28 mm and 31 mm — so a
// 20 mm error in the stated number is larger than the margins it is used to
// justify. Measure it off the RENDERED geometry rather than off any comment.
//
// A tyre is selected the way K-tyre-has-arch selects one — a cylinder lying on
// its SIDE, which no bar stool imitates — and confirmed against the car's own
// published `userData.tyre` radius, so two unrelated filters have to agree.
//
//   SHOT_URL=http://localhost:4184/ node scripts/probes/w19-tyre-top.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(900);

const out = await p.evaluate(() => {
  const THREE = window.THREE ?? null;
  const scene = window.__ct.scene();
  const cars = [];
  scene.traverse((o) => { if (o.userData && o.userData.tyre !== undefined) cars.push(o); });

  const rows = [];
  for (const car of cars.slice(0, 8)) {
    const R = car.userData.tyre;
    const tyres = [];
    car.traverse((m) => {
      const g = m.geometry;
      if (!g || !g.parameters) return;
      const pr = g.parameters;
      // a cylinder whose radius matches the car's own published tyre radius
      if (pr.radiusTop === undefined) return;
      if (Math.abs(pr.radiusTop - R) > 0.02) return;
      m.updateWorldMatrix(true, false);
      g.computeBoundingBox();
      const bb = g.boundingBox.clone();
      bb.applyMatrix4(m.matrixWorld);
      tyres.push({ top: +bb.max.y.toFixed(4), bottom: +bb.min.y.toFixed(4),
        height: +(bb.max.y - bb.min.y).toFixed(4) });
    });
    if (tyres.length) {
      rows.push({ body: car.userData.body ?? '?', R, n: tyres.length,
        tops: [...new Set(tyres.map((t) => t.top))].sort((a, c) => a - c),
        bottoms: [...new Set(tyres.map((t) => t.bottom))].sort((a, c) => a - c),
        heights: [...new Set(tyres.map((t) => t.height))] });
    }
  }
  return { cars: cars.length, rows, three: !!THREE };
});
await b.close();

console.log(`${out.cars} cars publish a tyre radius\n`);
for (const r of out.rows) {
  console.log(`  ${String(r.body).padEnd(10)} R ${r.R}  ${r.n} tyre mesh(es)`);
  console.log(`      tops    ${r.tops.join(', ')}`);
  console.log(`      bottoms ${r.bottoms.join(', ')}`);
  console.log(`      heights ${r.heights.join(', ')}   (= 2R if it is a full circle: ${(2 * r.R).toFixed(2)})`);
}
const allTops = out.rows.flatMap((r) => r.tops);
if (allTops.length) {
  console.log(`\n  tyre top, across ${allTops.length} distinct values: `
    + `min ${Math.min(...allTops).toFixed(4)}  max ${Math.max(...allTops).toFixed(4)}`);
}

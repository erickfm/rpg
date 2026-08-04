// WHAT IS ACTUALLY IN FLAT 301 — spots, colliders, and the standable floor.
//
// Item 308: the calendar has to go back to the RIGHT and the door's stand-point
// is what is in the way. Everything this item does is derived from this dump;
// nothing is retyped out of the source. Run it before and after.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w133-301-floor.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1200);

// stand in 301 so its ok() predicates go live
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(500);

const out = await p.evaluate(() => {
  const R = window.__ct.playerRadius();
  const TM = window.__ct.touchMargin();
  const spots = window.__ct.spots()
    .filter((s) => s.ok && s.x > 196 && s.x < 203 && s.z > -19 && s.z < -13)
    .map((s) => ({ label: s.label, x: s.x, z: s.z, r: s.r, rank: s.rank ?? 0 }));
  const cols = window.__ct.staticColliders()
    .filter((c) => c.maxX > 196 && c.minX < 203 && c.maxZ > -19 && c.minZ < -13)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  // the calendar page itself, by the name it carries
  let cal = null;
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.calendar === 'page') {
      const bb = new (o.geometry.boundingBox ? Object : Object)();
      cal = { x: o.position.x, y: o.position.y, z: o.position.z,
        w: o.geometry.parameters?.width, h: o.geometry.parameters?.height };
    }
  });
  let leaf = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'leaf301') leaf = { x: o.position.x, z: o.position.z, ry: o.rotation.y }; });
  return { R, TM, spots, cols, cal, leaf };
});
console.log(`RADIUS ${out.R}  TOUCH_MARGIN ${out.TM}`);
console.log(`calendar page: ${JSON.stringify(out.cal)}`);
console.log(`leaf301 pivot: ${JSON.stringify(out.leaf)}`);
console.log(`\n${out.spots.length} live spots in/around 301:`);
for (const s of out.spots) console.log(`  (${s.x.toFixed(3)}, ${s.z.toFixed(3)}) r${s.r} rank${s.rank}  "${s.label}"`);
console.log(`\n${out.cols.length} colliders overlapping the flat:`);
for (const c of out.cols) console.log(`  x ${c.minX.toFixed(2)}..${c.maxX.toFixed(2)}  z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}`);

// pairwise stand-point separations, the thing standpoint-overlap.mjs measures
console.log(`\npairwise separations under ${(4 * out.R).toFixed(2)} m:`);
for (let i = 0; i < out.spots.length; i++) {
  for (let j = i + 1; j < out.spots.length; j++) {
    const a = out.spots[i], c = out.spots[j];
    const d = Math.hypot(a.x - c.x, a.z - c.z);
    if (d < 4 * out.R) console.log(`  ${d.toFixed(3)}  "${a.label}" — "${c.label}"`
      + (d < 2 * out.R ? '   ⚠ INSIDE 2*RADIUS' : ''));
  }
}
await b.close();

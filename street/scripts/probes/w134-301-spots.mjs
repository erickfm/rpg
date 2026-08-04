// WHAT IS ON 301'S FLOOR, and how far apart — item 309's baseline.
//
// Prints every spot the resolver can see inside the flat with its radius, its
// aim-free touch disc (`r + TOUCH_MARGIN`, read off `__ct` not retyped) and the
// pairwise distances. Numbers, not an absence: a run that finds no door says so
// by printing 0 door rows, which is a visible failure rather than a silent pass.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w134-301-spots.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(700);

const K = await p.evaluate(() => ({
  TM: window.__ct.touchMargin(), R: window.__ct.playerRadius(),
  onIt: window.__ct.onItRadius ? window.__ct.onItRadius() : null,
}));
console.log(`TOUCH_MARGIN ${K.TM}  RADIUS ${K.R}  onItRadius ${K.onIt}`);

const spots = await p.evaluate(() => window.__ct.spots()
  .filter((s) => s.ok && s.x > 195 && s.x < 203 && s.z > -19 && s.z < -14));
console.log(`${spots.length} live spots in flat 301:`);
for (const s of spots) {
  console.log(`  (${s.x.toFixed(3)}, ${s.z.toFixed(3)})  r ${s.r.toFixed(2)}  touch<${(s.r + K.TM).toFixed(2)}  rank ${s.rank ?? 0}  ${s.label}`);
}
console.log('pairwise:');
for (let i = 0; i < spots.length; i++) {
  for (let j = i + 1; j < spots.length; j++) {
    const d = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z);
    console.log(`  ${d.toFixed(3)} m  ${spots[i].label}  <->  ${spots[j].label}`);
  }
}
await b.close();

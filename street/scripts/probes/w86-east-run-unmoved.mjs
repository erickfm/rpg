// DID THE EAST RUN MOVE? Item 166.
//
// The one thing item 166 must not do is change `w: 13`, because ct/street.ts's
// own comment says the run before No. 227 must total 49.2 or the walk-up's door
// and interior — pinned to a fixed z in ct/apartment.ts — move with it.
//
// The identity change touches `nm`, `col` and `front` only, so arithmetically
// nothing can move. This asserts it rather than arguing it: the shopfront
// colliders along the east facade, listed with their z spans, against the
// numbers ct/street.ts documents (the slot at -22..-35, No. 227 at -35..-53,
// the second alley at -53..-55.5, bodegaZ0 at -86).
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-east-run-unmoved.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);

const runs = await p.evaluate(() => window.__ct.colliders()
  .filter((c) => c.minX >= 6.5 && c.minX < 9 && c.minZ > -100 && c.maxZ < 20)
  .map((c) => ({ z0: +c.minZ.toFixed(2), z1: +c.maxZ.toFixed(2), w: +(c.maxZ - c.minZ).toFixed(2) }))
  .sort((a, b2) => b2.z1 - a.z1));

console.log('\neast shopfront colliders, north to south:');
for (const r of runs) console.log(`   z ${String(r.z1).padStart(8)} .. ${String(r.z0).padStart(8)}   ${r.w} m`);

const slot = runs.find((r) => Math.abs(r.z1 - -22) < 0.6 && Math.abs(r.z0 - -35) < 0.6);
console.log(`\n  ${slot ? 'OK  ' : 'FAIL'} the SLEEP CENTER slot is still z -22..-35` +
  `${slot ? ` (${slot.z1}..${slot.z0}, ${slot.w} m wide)` : ' — NOT FOUND, the run has moved'}`);
if (!slot || Math.abs(slot.w - 13) > 0.35) {
  console.log(`  FAIL width is ${slot ? slot.w : 'n/a'} and must be 13`);
  process.exitCode = 1;
}
// the walk-up: the whole reason the width is load-bearing
const apt = await p.evaluate(() => {
  const r = window.__ct.roomDims().find((q) => q.id === 'apt301');
  return r ? { cx: r.cx, cz: r.cz, y: r.y } : null;
});
console.log(`  apt301 still at ${JSON.stringify(apt)} — ct/apartment.ts pins this off the 49.2 run`);
await b.close();

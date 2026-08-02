// w47 / item 98 — WHAT IS ACTUALLY REGISTERED AROUND THE CASINO DOOR.
//
// One question, asked once: the user reports three zones on the SEVENS
// approach, and the item offers "there may be two competing spots" as a
// candidate cause. Before walking anything, list every spot within 12 m of the
// door and every declared door, so the walk has something to name its winners
// against.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w47-casino-spots.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4185/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const DOOR = { x: 51.29, z: -96.0 };

const out = await page.evaluate(([dx, dz]) => {
  const spots = window.__ct.spots();
  const near = spots
    .map((s) => ({ ...s, d: Math.hypot(s.x - dx, s.z - dz) }))
    .filter((s) => s.d < 14)
    .sort((a, b) => a.d - b.d);
  return {
    total: spots.length,
    reachMargin: window.__ct.reachMargin(),
    near,
    doors: window.__ct.doors(),
  };
}, [DOOR.x, DOOR.z]);

console.log(`total spots in world: ${out.total}   REACH_MARGIN=${out.reachMargin}`);
console.log(`\nspots within 14 m of the SEVENS door (${DOOR.x}, ${DOOR.z}):`);
for (const s of out.near) {
  console.log(`  d=${s.d.toFixed(2).padStart(6)}  r=${String(s.r).padStart(5)}  ok=${s.ok ? 'Y' : 'n'}  (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  ${JSON.stringify(s.label)}`);
}
console.log(`\ndeclared doors:`);
for (const d of out.doors) {
  console.log(`  ${String(d.building).padEnd(16)} point=${JSON.stringify(d.point)} stand=${JSON.stringify(d.stand)} w=${d.widthM} chamfer=${d.chamfer}`);
}

await browser.close();

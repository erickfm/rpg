// One-shot: what does the world's own room registry publish for each room?
// Item 68 filed apt301 as "one registry omission"; this asks whether apt301 is
// shaped like the twelve belt rooms interiors-walk knows how to walk.
//
// Usage: SHOT_URL=http://localhost:4188/ node scripts/probes/w32-roomdims-dump.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4188/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims);
const dims = await p.evaluate(() => window.__ct.roomDims());
for (const r of dims) {
  console.log(
    `${r.id.padEnd(8)} w=${r.w?.toFixed(2)} d=${r.d?.toFixed(2)} ` +
    `cx=${r.cx?.toFixed(2)} cz=${r.cz?.toFixed(2)} y=${r.y?.toFixed(3)} ` +
    `door=${r.door ? `(${r.door.x.toFixed(2)},${r.door.z.toFixed(2)}) n=(${r.door.nx},${r.door.nz})` : 'none'}`,
  );
}
await b.close();

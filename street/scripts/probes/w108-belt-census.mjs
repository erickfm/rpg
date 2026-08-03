// ITEM 268 — WHICH ROOM SITS IN WHICH SLAB. One line per belt room.
//
// The point of running it before and after: re-handing the party wall must move
// EXACTLY the two rooms in the pair. The old `beltOrder` would have dragged the
// church and the diner 80 m each as a side effect, which is why that function
// was changed too. This is the check that says whether it did.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });
const rooms = (await p.evaluate(() => window.__ct.roomDims())).filter((r) => r.belt);
rooms.sort((a, c) => a.cx - c.cx);
for (const r of rooms) {
  const slab = 400 + Math.floor((r.cx - 400) / 80) * 80;
  console.log(`slab ${String(slab).padStart(4)}…${slab + 80}  cx ${r.cx.toFixed(2).padStart(7)}`
    + `  w ${r.w.toFixed(2).padStart(6)}  ${r.id}`);
}
console.log(`\n${rooms.length} belt rooms`);
await b.close();

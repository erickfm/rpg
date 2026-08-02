// WHAT DOES roomDims() ACTUALLY PUBLISH, AND HOW MANY ROOMS ARE THERE?
//
// Item 62 says bugsweep warps with a literal `gy 0` — three storeys below flat
// 301 — and that w22 published `RoomDims.y` so the fix is `gy: r.y`. Both
// halves are hypotheses (BUILDER-BRIEF §6): check the field exists and carries
// a real storey height before writing code against it, and check what the
// room count actually is now.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-roomdims.mjs
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const dims = await p.evaluate(() => window.__ct.roomDims());
const ids = await p.evaluate(() => window.__ct.rooms());
console.log(`roomDims(): ${dims.length} rooms      rooms(): ${ids.length} ids`);
console.log(`fields on the first row: ${Object.keys(dims[0]).join(', ')}\n`);
console.log('  id                 cx        cz        w      d      y       door');
for (const r of dims.sort((a, c) => (a.y ?? 0) - (c.y ?? 0))) {
  console.log(`  ${String(r.id).padEnd(18)} ${String(r.cx?.toFixed(1)).padStart(8)} ` +
    `${String(r.cz?.toFixed(1)).padStart(8)}  ${String(r.w?.toFixed(1)).padStart(5)} ` +
    `${String(r.d?.toFixed(1)).padStart(5)}  ${r.y === undefined ? '  MISSING' : String(r.y.toFixed(2)).padStart(6)}` +
    `   ${r.door ? `${r.door.x.toFixed(1)},${r.door.z.toFixed(1)}` : 'none'}`);
}
const noY = dims.filter((r) => r.y === undefined);
console.log(`\nrooms with no y: ${noY.length}${noY.length ? ' -> ' + noY.map((r) => r.id).join(', ') : ''}`);
const raised = dims.filter((r) => (r.y ?? 0) > 0.01);
console.log(`rooms NOT on the ground floor: ${raised.length}` +
  `${raised.length ? ' -> ' + raised.map((r) => `${r.id} @ y=${r.y}`).join(', ') : ''}`);

// And what does groundAt say at each room's centre? That is what a gy 0 warp
// would be fighting.
const g = await p.evaluate((rows) => rows.map((r) => ({
  id: r.id, ground: window.__ct.groundAt(r.cx, r.cz),
})), dims);
console.log('\nground under each room centre (what warp gy must agree with):');
for (const r of g) console.log(`  ${r.id.padEnd(18)} groundAt = ${r.ground}`);
await b.close();

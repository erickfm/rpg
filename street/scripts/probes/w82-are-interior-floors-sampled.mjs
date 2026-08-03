// Item 226. My own instrument nearly shipped with a hole in it.
//
// The classification probe sampled floors ONCE at startup, before entering any
// room — and then classified 288 endpoints of which exactly one was not
// "inside its own room box". So the FLOOR predicate was never actually asked
// about an interior point. If interiors are built lazily, or if their floors are
// not floor-shaped by this predicate's rules, `hasFloor` would answer VOID
// everywhere inside the belt and I would not have found out.
//
// So: ask it about the centre of every room, before and after standing in one.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { sampleFloors, makeHasFloor } from '../lib/floors.mjs';

const URL = aim('http://localhost:4185/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

const DIMS = await p.evaluate(() => window.__ct.roomDims());

const before = makeHasFloor(await sampleFloors(p));
console.log('sampled at spawn, having entered no room:');
for (const d of DIMS) console.log(`  ${d.id.padEnd(10)} centre floored? ${before(d.cx, d.cz, d.y)}`);

// now stand in one, and re-sample
await p.evaluate(() => window.__ct.warp(1320, 0, 0, 0, 0));
await p.waitForTimeout(500);
const after = makeHasFloor(await sampleFloors(p));
console.log('\nafter warping into the thrift store:');
for (const d of DIMS) console.log(`  ${d.id.padEnd(10)} centre floored? ${after(d.cx, d.cz, d.y)}`);

await b.close();

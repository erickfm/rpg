#!/usr/bin/env node
// ITEM 196 — WHERE CAN THE ORPHEUS PARTY WALL BE OPENED?
//
// The casino and the hotel are about to share a wall. An opening is only worth
// cutting where BOTH rooms have a clear run of floor against that wall, and
// "clear" is a question about colliders, not about reading two 1,200-line
// files and hoping. So ask the world: for each room, project every collider
// that comes within `NEAR` metres of the named flank onto z, and print the
// gaps left over.
//
//   SHOT_URL=http://localhost:4260/ node scripts/probes/w70-party-wall-clearance.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const NEAR = 1.6;          // a doorway needs this much clear floor in front of it

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 20000 });
await waitPainted(p, { quiet: true });

const data = await p.evaluate(() => ({
  dims: window.__ct.roomDims(),
  cols: window.__ct.staticColliders().map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ })),
}));

const runs = (id, flank) => {
  const r = data.dims.find((d) => d.id === id);
  if (!r) { console.log(`  ${id}: not in the belt`); return []; }
  const face = flank === 'east' ? r.cx + r.w / 2 : r.cx - r.w / 2;
  const band = flank === 'east' ? [face - NEAR, face] : [face, face + NEAR];
  const z0 = r.cz - r.d / 2, z1 = r.cz + r.d / 2;
  // every collider overlapping the band, EXCLUDING the room's own shell walls
  // (which run the full flank and would swallow everything)
  const shell = 0.30;      // wall boxes are T = 0.18 thick; anything thinner-than-this
  const blocks = data.cols
    .filter((c) => c.maxX > band[0] && c.minX < band[1] && c.maxZ > z0 && c.minZ < z1)
    .filter((c) => !(c.maxZ - c.minZ >= r.d))          // drop the flank wall itself
    .filter((c) => c.maxX - c.minX > 0.001 || c.maxZ - c.minZ > shell)
    .map((c) => [Math.max(z0, c.minZ), Math.min(z1, c.maxZ)])
    .sort((a, c) => a[0] - c[0]);
  const gaps = [];
  let cur = z0;
  for (const [a, c] of blocks) { if (a > cur) gaps.push([cur, a]); cur = Math.max(cur, c); }
  if (cur < z1) gaps.push([cur, z1]);
  console.log(`\n  ${id} ${flank} flank at world x ${face.toFixed(2)}, room z ${z0}..${z1}`);
  console.log(`    ${blocks.length} obstruction(s) within ${NEAR} m of it`);
  for (const g of gaps) if (g[1] - g[0] > 0.5)
    console.log(`    CLEAR z ${(g[0] - r.cz).toFixed(2)} .. ${(g[1] - r.cz).toFixed(2)}  (local, ${(g[1] - g[0]).toFixed(2)} m)`);
  return gaps.map((g) => [g[0] - r.cz, g[1] - r.cz]);
};

const [FA, FB] = (process.argv[2] ?? 'east,west').split(',');
const a = runs('casino', FA);
const c = runs('hotel', FB);

// intersect, in ROOM-LOCAL z — both rooms sit on cz = 0, so local z is shared
const both = [];
for (const x of a) for (const y of c) {
  const lo = Math.max(x[0], y[0]), hi = Math.min(x[1], y[1]);
  if (hi - lo > 0.5) both.push([lo, hi]);
}
both.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
console.log('\n  CLEAR IN BOTH ROOMS, local z:');
for (const g of both) console.log(`    ${g[0].toFixed(2)} .. ${g[1].toFixed(2)}   (${(g[1] - g[0]).toFixed(2)} m, centre ${((g[0] + g[1]) / 2).toFixed(2)})`);
if (!both.length) console.log('    NONE — the opening needs furniture moved first');
await b.close();

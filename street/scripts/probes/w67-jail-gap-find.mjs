// WHERE IS THE HOLE IN THE JAIL'S SIDE? Item 175, measurement before repair.
//
// The user: *"side of the jail are still bugged and allow for out of bounds."*
// A night shot shows a vertical slot of open sky between the jail's west face
// and the brick building beside it, and it is walkable.
//
//   SHOT_URL=http://localhost:4230/ node scripts/probes/w67-jail-gap-find.mjs
//
// Measures, asserts nothing. Prints the world bounds, the jail site, every
// collider overlapping the jail's z band, and a `groundAt` raster of the ground
// around the whole site so a hole shows up as a shape rather than a number.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4230/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

const info = await page.evaluate(() => ({
  sites: window.__ct.sites(),
  bounds: window.__ct.bounds ? window.__ct.bounds() : null,
  nColliders: window.__ct.colliders ? window.__ct.colliders().length : null,
}));
console.log('sites:', JSON.stringify(info.sites));
console.log('bounds:', JSON.stringify(info.bounds));
console.log('colliders:', info.nColliders);

const site = info.sites.jail;
if (!site) { console.log('NO JAIL SITE'); await b.close(); process.exit(3); }

// every collider that overlaps the jail's z band, sorted west to east
const near = await page.evaluate(([s]) => (window.__ct.colliders() ?? [])
  .filter((c) => c.maxZ > s.minZ - 8 && c.minZ < s.maxZ + 8 && c.maxX > s.minX - 20)
  .map((c) => ({ tag: c.tag ?? '', minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2),
    minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2), maxY: c.maxY }))
  .sort((a, b2) => a.minX - b2.minX), [site]);
console.log(`\ncolliders overlapping the jail z band (${near.length}):`);
for (const c of near) console.log(`  x ${String(c.minX).padStart(7)}…${String(c.maxX).padEnd(7)} z ${String(c.minZ).padStart(8)}…${String(c.maxZ).padEnd(8)} ${c.maxY !== undefined ? 'top ' + c.maxY : ''} ${c.tag}`);

// ── the ground raster. `null`/undefined from groundAt is a HOLE: leg 6 of
// w15-jail-walk.mjs already treats it that way, so the reading is the world's
// own, not a new convention invented here.
const X0 = Math.floor(site.minX - 6), X1 = Math.ceil(site.maxX + 6);
const Z0 = Math.floor(site.minZ - 6), Z1 = Math.ceil(site.maxZ + 6);
const grid = await page.evaluate(([X0, X1, Z0, Z1]) => {
  const rows = [];
  for (let z = Z0; z <= Z1; z += 1) {
    const row = [];
    for (let x = X0; x <= X1; x += 1) {
      const g = window.__ct.groundAt(x, z);
      row.push(g === null || g === undefined ? null : +g.toFixed(2));
    }
    rows.push({ z, row });
  }
  return rows;
}, [X0, X1, Z0, Z1]);

console.log(`\ngroundAt raster, x ${X0}…${X1} (one column per metre), z down the side.`);
console.log('  "." = ground at kerb height   "#" = higher (a step/roof)   "!" = NO GROUND (hole)\n');
const base = grid[0].row.find((v) => v !== null) ?? 0;
console.log('        ' + Array.from({ length: X1 - X0 + 1 }, (_, i) => (X0 + i) % 10 === 0 ? '|' : ' ').join(''));
for (const { z, row } of grid) {
  const line = row.map((v) => v === null ? '!' : Math.abs(v - base) < 0.3 ? '.' : '#').join('');
  console.log(`  z ${String(z).padStart(5)} ${line}`);
}
const holes = [];
for (const { z, row } of grid) row.forEach((v, i) => { if (v === null) holes.push([X0 + i, z]); });
console.log(`\n${holes.length} sample point(s) with NO GROUND:`);
console.log('  ' + JSON.stringify(holes.slice(0, 60)));

await b.close();

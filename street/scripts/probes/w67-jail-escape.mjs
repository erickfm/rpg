// CAN YOU WALK OUT OF THE WORLD AT THE JAIL? Item 175, discovery run.
//
// The user: *"side of the jail are still bugged and allow for out of bounds."*
//
//   SHOT_URL=http://localhost:4230/ node scripts/probes/w67-jail-escape.mjs
//
// Measures, asserts nothing — the containment CHECK is a separate file. This
// WALKS (collision is only ever proven by walking, never from a raster or a
// screenshot): from a ring of start points around the jail it holds `w` down in
// sixteen directions and reports where the player ends up. An escape shows as a
// finishing position far outside the side street's corridor.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4230/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

const site = await page.evaluate(() => window.__ct.sites().jail);
const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, yaw]) =>
  window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);

// The side street corridor, read from the colliders that make it rather than
// typed: the buildings flanking the side street are the ones that overlap the
// jail's z band and stop at the frontage.
const walls = await page.evaluate(([s]) => (window.__ct.colliders() ?? [])
  .filter((c) => c.maxX > s.minX - 14 && c.minX < s.minX + 1 && c.maxZ > s.minZ - 24 && c.minZ < s.maxZ + 24)
  .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ })), [site]);
const northFace = Math.min(...walls.filter((w) => w.minZ > site.maxZ - 2).map((w) => w.minZ));
const southFace = Math.max(...walls.filter((w) => w.maxZ < site.minZ + 2).map((w) => w.maxZ));
console.log(`jail site      x ${site.minX}…${site.maxX}  z ${site.minZ}…${site.maxZ}`);
console.log(`side-street corridor between the flanking buildings: z ${southFace}…${northFace}`);
console.log(`  (the jail is ${(site.maxZ - site.minZ).toFixed(2)} m wide in z; the corridor is ${(northFace - southFace).toFixed(2)} m)\n`);

const starts = [
  ['forecourt centre',     site.minX + 2,  (site.minZ + site.maxZ) / 2],
  ['forecourt N end',      site.minX + 2,  site.maxZ - 0.5],
  ['forecourt S end',      site.minX + 2,  site.minZ + 0.5],
  ['NW corner of the jail', site.minX + 4, site.maxZ - 0.2],
  ['SW corner of the jail', site.minX + 4, site.minZ + 0.2],
  ['hard against N flank', site.minX + 6,  site.maxZ + 0.3],
  ['hard against S flank', site.minX + 6,  site.minZ - 0.3],
];

console.log('holding w for 3.2 s from each start, in 16 directions.');
console.log('an ESCAPE is a finish outside the corridor AND east of the frontage.\n');

const escapes = [];
for (const [name, sx, sz] of starts) {
  const worst = [];
  for (let d = 0; d < 16; d++) {
    const yaw = (d / 16) * Math.PI * 2;
    await warp(sx, sz, yaw);
    await page.waitForTimeout(120);
    await page.keyboard.down('w');
    await page.waitForTimeout(3200);
    await page.keyboard.up('w');
    await page.waitForTimeout(90);
    const p = await pos();
    const out = p[0] > site.minX && (p[2] > northFace + 0.5 || p[2] < southFace - 0.5);
    if (out) { escapes.push({ name, yaw: +yaw.toFixed(2), end: [+p[0].toFixed(2), +p[2].toFixed(2)] }); worst.push(`yaw ${yaw.toFixed(2)} -> (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`); }
  }
  console.log(`  ${name.padEnd(24)} ${worst.length ? 'ESCAPED ' + worst.length + '/16: ' + worst.slice(0, 4).join('  ') : 'contained 16/16'}`);
}

console.log(`\n${escapes.length} escaping walk(s).`);
if (escapes.length) {
  const zs = escapes.map((e) => e.end[1]);
  console.log(`  worst z reached: ${Math.min(...zs).toFixed(2)} … ${Math.max(...zs).toFixed(2)}`);
  console.log(`  corridor is     ${southFace.toFixed(2)} … ${northFace.toFixed(2)}`);
  console.log('  ' + JSON.stringify(escapes.slice(0, 10)));
}
await b.close();

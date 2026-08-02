// ITEM 97 — night frames of the SEVENS frontage from the user's own viewing
// position. `node scripts/probes/w46-facade-shot.mjs <label>`; SHOT_URL picks
// the world.
//
// The user's screenshot is taken from the road, close in and looking steeply
// up, with HOTEL ORPHEUS falling away to the right — i.e. standing off the
// casino's WEST half at street level. Low x is screen-right on this facade, so
// the blade at x 56 is the bar on the LEFT of his frame.
//
// The camera is placed, then the placement is READ BACK from __ct.pos() before
// any shot is filed, because a warp that silently fails gives you a photograph
// of somewhere else (GOTCHAS 26 / scripts/aim.mjs).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const label = process.argv[2] ?? 'before';
mkdirSync('shots/w46', { recursive: true });

// forward is (sin yaw, -cos yaw) — crosstown.ts:1673. yaw = PI looks toward +z,
// which is the way the facade at z = -96 faces the road.
const STATIONS = [
  { id: 'hero', x: 53.6, z: -103.2, yaw: Math.PI, pitch: 0.62 },   // his frame
  { id: 'wide', x: 51.2, z: -112.0, yaw: Math.PI, pitch: 0.24 },   // whole frontage
  { id: 'name', x: 51.2, z: -106.0, yaw: Math.PI, pitch: 0.50 },   // the name panel square on
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 819 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// night by default — these two buildings are the world's only light sources, so
// that is the hour they are designed for. HOUR=13 checks the other half: the
// same texels have to hold up as dull painted metal by day.
await p.evaluate((h) => window.__ct.clock(h, 10), Number(process.env.HOUR ?? 23));
await p.waitForTimeout(1600);

for (const s of STATIONS) {
  await p.evaluate((q) => window.__ct.warp(q.x, q.z, q.yaw, undefined, q.pitch), s);
  await p.waitForTimeout(700);
  const [gx, gy, gz] = await p.evaluate(() => window.__ct.pos());   // [x, y, z, groundY]
  const off = Math.hypot(gx - s.x, gz - s.z);
  if (off > 0.05) { console.log(`  ** ${s.id}: warp landed ${off.toFixed(2)} m off — NOT filing`); continue; }
  await p.screenshot({ path: `shots/w46/${label}-${s.id}.png` });
  console.log(`shots/w46/${label}-${s.id}.png   at (${gx.toFixed(2)}, ${gy.toFixed(2)}, ${gz.toFixed(2)}) pitch ${s.pitch}`);
}
console.log(errs.length ? `console errors: ${errs.length}\n  ${errs.join('\n  ')}` : 'console errors: none');
await b.close();

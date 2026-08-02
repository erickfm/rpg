// ITEM 132 part 1 — the user asked a QUESTION: *"maybe we get rid of the one on
// the side here?"*. So look at the frontage without the blade BEFORE committing
// to removing it, from his own station and one from down the street.
//
// The blade is hidden at RUNTIME rather than deleted from source, so the answer
// costs nothing if it is "no". Its meshes are selected by exact footprint —
// x 55.75..56.35, above 5 m, and standing PROUD of the facade (bbox z_min <
// -96.5). That last clause is what separates the blade's own bulb run
// (z -97.46) from the cornice/crown run that passes behind it at z -96.16;
// without it this probe silently strips the parapet lights too.
//
// Usage: SHOT_URL=http://localhost:4183/ node scripts/probes/w51-frontage-without-blade.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4183/';
mkdirSync('shots/w51', { recursive: true });

const STATIONS = [
  { id: 'hero', x: 53.6, z: -103.2, yaw: Math.PI, pitch: 0.62 },   // his frame
  { id: 'down', x: 40.0, z: -108.0, yaw: 2.62, pitch: 0.30 },      // approaching along the street
  { id: 'far', x: 24.0, z: -104.0, yaw: 1.94, pitch: 0.18 },       // the long view the blade is FOR
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 819 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  console error:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate((h) => window.__ct.clock(h, 10), Number(process.env.HOUR ?? 23));
await p.waitForTimeout(1600);

const shoot = async (label) => {
  for (const s of STATIONS) {
    await p.evaluate((q) => window.__ct.warp(q.x, q.z, q.yaw, undefined, q.pitch), s);
    await p.waitForTimeout(600);
    const [gx, , gz] = await p.evaluate(() => window.__ct.pos());
    const off = Math.hypot(gx - s.x, gz - s.z);
    if (off > 0.05) { console.log(`  ** ${s.id}: warp landed ${off.toFixed(2)} m off — NOT filing`); continue; }
    await p.screenshot({ path: `shots/w51/${label}-${s.id}.png` });
    console.log(`shots/w51/${label}-${s.id}.png`);
  }
};

await shoot('blade-on');

const hidden = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const got = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.visible === false) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.x < 55.75 || bb.max.x > 56.35) return;   // the blade's own x band
    if (bb.max.y < 5.0) return;                          // above the marquee
    if (bb.min.z > -96.5) return;                        // PROUD of the facade plane
    o.visible = false;
    got.push(`${g.type} x ${bb.min.x.toFixed(2)}..${bb.max.x.toFixed(2)} `
      + `y ${bb.min.y.toFixed(2)}..${bb.max.y.toFixed(2)} z ${bb.min.z.toFixed(2)}..${bb.max.z.toFixed(2)}`);
  });
  return got;
});
console.log(`\nhid ${hidden.length} meshes:`);
const tally = new Map();
for (const h of hidden) { const k = h.split(' x ')[0]; tally.set(k, (tally.get(k) ?? 0) + 1); }
for (const [k, n] of tally) console.log(`   ${n} x ${k}`);
for (const h of hidden.filter((x) => !x.startsWith('SphereGeometry'))) console.log(`   ${h}`);

await p.waitForTimeout(400);
console.log('');
await shoot('blade-off');
await b.close();

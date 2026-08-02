import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4181/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);

// pull every mesh's world AABB near the jail site (x 40-80, z -115..-90),
// grouped by userData.mod, so we can see the actual footprint layout without
// guessing from a first-person screenshot.
const boxes = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.max.x < 30 || w.min.x > 90 || w.max.z < -120 || w.min.z > -85) return;
    out.push({
      mod: n.userData.mod ?? '?',
      x0: +w.min.x.toFixed(2), x1: +w.max.x.toFixed(2),
      z0: +w.min.z.toFixed(2), z1: +w.max.z.toFixed(2),
      y1: +w.max.y.toFixed(2),
    });
  });
  return out;
});
console.log(`${boxes.length} meshes near the jail site\n`);
// group by mod and print the overall x/z envelope each owner occupies
const byMod = {};
for (const b2 of boxes) {
  const m = byMod[b2.mod] ??= { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 };
  m.x0 = Math.min(m.x0, b2.x0); m.x1 = Math.max(m.x1, b2.x1);
  m.z0 = Math.min(m.z0, b2.z0); m.z1 = Math.max(m.z1, b2.z1);
  m.n++;
}
for (const [mod, m] of Object.entries(byMod)) {
  console.log(`${mod.padEnd(12)} x ${m.x0.toFixed(1)}..${m.x1.toFixed(1)}   z ${m.z0.toFixed(1)}..${m.z1.toFixed(1)}   (${m.n} meshes)`);
}

console.log('\n-- TALL (y1 > 1.5) only, i.e. actual walls, not ground paving --\n');
const byModTall = {};
for (const b2 of boxes) {
  if (b2.y1 <= 1.5) continue;
  const m = byModTall[b2.mod] ??= { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 };
  m.x0 = Math.min(m.x0, b2.x0); m.x1 = Math.max(m.x1, b2.x1);
  m.z0 = Math.min(m.z0, b2.z0); m.z1 = Math.max(m.z1, b2.z1);
  m.n++;
}
for (const [mod, m] of Object.entries(byModTall)) {
  console.log(`${mod.padEnd(12)} x ${m.x0.toFixed(1)}..${m.x1.toFixed(1)}   z ${m.z0.toFixed(1)}..${m.z1.toFixed(1)}   (${m.n} meshes)`);
}

console.log('\n-- jail meshes with x0 > 65 (behind the real building), individually --\n');
for (const b2 of boxes) {
  if (b2.mod !== 'jail' || b2.x0 < 65) continue;
  console.log(`  x ${b2.x0}..${b2.x1}  z ${b2.z0}..${b2.z1}  y1 ${b2.y1}`);
}

await b.close();

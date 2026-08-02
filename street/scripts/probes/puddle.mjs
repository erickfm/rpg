// Puddles, at a DAYTIME raining hour. The previous attempt used the first
// raining hour by the world's own hash, which is 05:00 — a night frame where a
// dark puddle cannot be told from dark wet tarmac. h = 15 is the first raining
// hour that falls in daylight, found with the same hash.
//
// Puddles lag the rain deliberately (puddleLevel eases at 0.22/s), so the sim
// is given real time to pool before anything is shot.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(15, 0));
await p.waitForTimeout(1000);
// find the puddle decals first, then aim at one — scan, do not guess
const pud = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true); const o = [];
  s.traverse(m => {
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(m.matrixWorld);
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || !mat.transparent) return;
    if (bb.max.y - bb.min.y > 0.06 || bb.min.y > 0.4) return;
    const w = bb.max.x - bb.min.x;
    if (w < 0.8 || w > 6) return;
    o.push({ c: [(bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2].map(v=>+v.toFixed(2)),
      w: +w.toFixed(2), opacity: +mat.opacity.toFixed(2), visible: m.visible });
  });
  return o;
});
console.log(`${pud.length} flat transparent decals on the ground:`);
pud.slice(0, 8).forEach(x => console.log(`   w ${x.w}  opacity ${x.opacity}  visible ${x.visible}  at (${x.c.join(', ')})`));
// let it rain and pool
await p.waitForTimeout(9000);
const after = await p.evaluate(() => {
  const s = window.__ct.scene(); let n = 0, maxOp = 0;
  s.traverse(m => {
    if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
    if (!m.material.transparent) return;
    const g = m.geometry; if (!g || !g.boundingBox) return;
    if (g.boundingBox.max.y - g.boundingBox.min.y > 0.06) return;
    if (m.visible && m.material.opacity > 0.02) { n++; maxOp = Math.max(maxOp, m.material.opacity); }
  });
  return { visiblePuddles: n, maxOpacity: +maxOp.toFixed(2) };
});
console.log(`\nafter 9 s of rain: ${after.visiblePuddles} visible puddle decals, peak opacity ${after.maxOpacity}`);
const look = (x,z,tx,tz) => Math.atan2(tx-x, -(tz-z));
const t = pud.find(x => Math.abs(x.c[0]) > 3 && Math.abs(x.c[0]) < 5.5) ?? pud[0];
if (t) {
  const sx = t.c[0] > 0 ? t.c[0] - 2.6 : t.c[0] + 2.6;
  await p.evaluate(([x,z,yaw]) => window.__ct.warp(x, z, yaw, 0, -0.42), [sx, t.c[2] + 2.2, look(sx, t.c[2]+2.2, t.c[0], t.c[2])]);
  await p.waitForTimeout(500); await p.screenshot({ path: 'shots/pd-puddle-day.png' });
  console.log(`shot pd-puddle-day aimed at the decal at (${t.c.join(', ')})`);
}
await p.evaluate(() => window.__ct.warp(-1.4, -30, 0, 0, -0.30));
await p.waitForTimeout(500); await p.screenshot({ path: 'shots/pd-street-day.png' });
await b.close();

// VERIFYING E's CHURCH PIER ROW.
//
// The row's central insight is a measurement discipline, not a geometry fact:
// each pier is THREE stages — 0.92 m at the base, then 0.76, then 0.60 — and
// the lancets sit 9.2–13.4 m up, where the base has already ended. "Testing the
// 0.92 m base against a window four metres above it measures a clearance that
// does not exist."
//
// That is exactly the kind of claim worth checking independently, because the
// naive measurement (widest pier vs window) is the one anybody would reach for
// and it gives the wrong answer. So this measures each pier's extent AT THE
// HEIGHT THE LANCET IS, off matrixWorld, and reports both numbers so the
// difference is visible rather than asserted.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (Math.abs(w.min.x) > 60 || w.min.z < -95 || w.min.z > -65) return;
    m.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
             mod: n.userData.mod ?? '?' });
  });
  // PIERS: tall narrow uprights standing on the ground, in the z band the row
  // names. Take their extent in z (the frontage runs along z) at two heights.
  const piers = m.filter((q) => q.y1 - q.y0 > 4 && q.y0 < 1.5
    && (q.z1 - q.z0) < 1.6 && (q.z1 - q.z0) > 0.3);
  // group into stacks by z centre — a three-stage pier is three boxes
  const stacks = new Map();
  for (const q of piers) {
    const k = Math.round(((q.z0 + q.z1) / 2) * 4) / 4;
    if (!stacks.has(k)) stacks.set(k, []);
    stacks.get(k).push(q);
  }
  // and the LANCETS: painted openings high on the wall
  const high = m.filter((q) => q.y0 > 8 && q.y0 < 15 && (q.z1 - q.z0) > 0.6 && (q.z1 - q.z0) < 3.5
    && (q.y1 - q.y0) > 1.5);
  return {
    total: m.length,
    stacks: [...stacks.entries()].map(([k, v]) => ({
      z: k, stages: v.length,
      byStage: v.sort((a, c) => a.y0 - c.y0).map((q) => ({
        y: [+q.y0.toFixed(2), +q.y1.toFixed(2)], wz: +(q.z1 - q.z0).toFixed(2) })),
    })).sort((a, c) => a.z - c.z),
    high: high.map((q) => ({ z: [+q.z0.toFixed(2), +q.z1.toFixed(2)],
                             y: [+q.y0.toFixed(2), +q.y1.toFixed(2)],
                             wz: +(q.z1 - q.z0).toFixed(2), mod: q.mod })).sort((a, c) => a.z[0] - c.z[0]),
  };
});

console.log(`\n── the church frontage (z -95..-65): ${r.total} meshes ──`);
console.log(`\n  PIER STACKS — the row says FOUR piers of THREE stages, 0.92 / 0.76 / 0.60 m`);
for (const s of r.stacks) {
  console.log(`   z ${String(s.z).padStart(7)}  ${s.stages} stage(s): ` +
    s.byStage.map((b) => `${b.wz} m @ y ${b.y[0]}-${b.y[1]}`).join('  |  '));
}
console.log(`\n  the row names piers at z -85.5 / -82.9 / -76.1 / -73.5`);

console.log(`\n  OPENINGS at 8-15 m — the lancets`);
for (const h of r.high) console.log(`   z ${JSON.stringify(h.z)}  y ${JSON.stringify(h.y)}  ${h.wz} m wide  ${h.mod}`);

// THE POINT OF THE ROW: pier width AT LANCET HEIGHT, not at the base
if (r.high.length && r.stacks.length) {
  const ly = (r.high[0].y[0] + r.high[0].y[1]) / 2;
  console.log(`\n  ── the discipline the row is about: pier width AT the lancet's own height (y ${ly.toFixed(1)}) ──`);
  for (const s of r.stacks) {
    const atH = s.byStage.find((b) => b.y[0] <= ly && b.y[1] >= ly);
    const base = s.byStage[0];
    console.log(`   z ${String(s.z).padStart(7)}   base ${base.wz} m   at y ${ly.toFixed(1)}: ` +
      (atH ? `${atH.wz} m` : 'this pier does not reach that height'));
  }
}

// and stand where the row says
await p.evaluate(() => window.__ct.clock(13, 0));
await p.evaluate(() => window.__ct.warp(-5.4, -79.5, Math.PI / 2, 0.14, 0.42));
const lum = await settle(p);
await p.screenshot({ path: 'shots/B-verify-E/church-front.png' });
console.log(`\n  shots/B-verify-E/church-front.png  mean ${lum.toFixed(4)}  (station: (-5.4, -79.5) looking east, pitched up)`);
await b.close();

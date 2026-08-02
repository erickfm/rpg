// H (verifier): does each registered seat tell the truth about its own height?
// G's row says the casino stools under-reported by half a cushion and are
// fixed, and that three library seats still under-report by 2.5 cm. This
// compares each ctx.seat()'s declared h against the real top face beneath it.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
const rows = await p.evaluate(() => {
  const ct = window.__ct;
  const seats = (ct.seats ? ct.seats() : []) || [];
  const root = ct.scene(); root.updateMatrixWorld(true);
  const solids = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, e = o.matrixWorld.elements, pts = [];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z])
      pts.push([e[0]*X+e[4]*Y+e[8]*Z+e[12], e[1]*X+e[5]*Y+e[9]*Z+e[13], e[2]*X+e[6]*Y+e[10]*Z+e[14]]);
    const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]), zs=pts.map(q=>q[2]);
    solids.push({ x0:Math.min(...xs), x1:Math.max(...xs), y1:Math.max(...ys), z0:Math.min(...zs), z1:Math.max(...zs) });
  });
  return seats.map((S) => {
    const s = { x: S.pose.x, z: S.pose.z, h: S.pose.h, room: S.label };
    // the highest face directly under the seat point, below head height
    let top = null;
    for (const m of solids) {
      if (s.x < m.x0 - 0.02 || s.x > m.x1 + 0.02 || s.z < m.z0 - 0.02 || s.z > m.z1 + 0.02) continue;
      if (m.y1 > (s.h ?? 0) + 0.35) continue;      // ignore tables/backs above the pad
      if (m.y1 < 0.15) continue;                    // ignore the floor
      if (top === null || m.y1 > top) top = m.y1;
    }
    return { room: s.room, x:+s.x.toFixed(2), z:+s.z.toFixed(2), h: +s.h.toFixed(3), top: top === null ? null : +top.toFixed(3) };
  });
});
console.log(`registered seats: ${rows.length}\n`);
let bad = 0;
for (const r of rows) {
  const d = r.top === null ? null : +(r.top - r.h).toFixed(3);
  const flag = d === null ? '  (no pad found)' : (Math.abs(d) > 0.005 ? `  <-- UNDER-REPORTS by ${d.toFixed(3)}` : '');
  if (d !== null && Math.abs(d) > 0.005) bad++;
  console.log(`  ${String(r.room).padEnd(22)} (${String(r.x).padStart(7)},${String(r.z).padStart(6)})  declared h ${String(r.h).padStart(6)}   true top ${String(r.top).padStart(6)}${flag}`);
}
console.log(`\n${bad} seat(s) do not report their own top face.`);
await b.close();

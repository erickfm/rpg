// ITEM 156 — WHAT IS THE BRIGHT RECTANGLE, and does it dim at all?
//
// The ray row named mesh #4121: a white 3.4 x 5.0 m plane at x 6.94, z -52.7…-49.3,
// carrying NO pool patch while the wall behind it does. In the night/day ratio
// map it is the bright rectangle with straight vertical sides.
//
// Two things settle what it is, and neither can be read off a screenshot:
//   DOES IT DIM?  compare material.color at 13:00 and 23:00. For a REGISTERED
//     material the CPU still writes base*amb, so this comparison is valid for
//     "does it lose the ambient at night" even though it is blind to lamplight
//     (item 234). A material identical at noon and midnight never registered,
//     or is deliberately held bright.
//   WHICH IS IT?  read the flags ct/props.ts stamps — `graded`, `poolLit`,
//     and whether the material is in the lit registry at all.
//
// Also lists EVERY mesh in the world that behaves the same way, because one
// instance is an instance and the class is what matters (BUILDER-BRIEF).
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const snap = async (h) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(900);
  return p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const out = {};
    s.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      const mm = Array.isArray(n.material) ? n.material : [n.material];
      const m = mm[0]; if (!m || !m.color) return;
      out[n.id] = { c: m.color.getHexString(), op: m.opacity };
    });
    return out;
  });
};
const day = await snap(13);
const night = await snap(23);

const meta = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = {};
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const mm = Array.isArray(n.material) ? n.material : [n.material];
    const m = mm[0]; if (!m || !m.color) return;
    const g = n.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    out[n.id] = {
      patched: !!(m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool'),
      ud: JSON.parse(JSON.stringify(m.userData || {})),
      meshUd: JSON.parse(JSON.stringify(n.userData || {})),
      bx: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)],
      by: [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)],
      bz: [+bb.min.z.toFixed(2), +bb.max.z.toFixed(2)],
      w: +(bb.max.x - bb.min.x).toFixed(2), hh: +(bb.max.y - bb.min.y).toFixed(2),
      d: +(bb.max.z - bb.min.z).toFixed(2),
      type: g.type, transparent: m.transparent, name: n.name || '',
    };
  });
  return out;
});

const t = meta[4121];
console.log('── mesh #4121, the bright rectangle ──');
console.log(`  day colour  #${day[4121] && day[4121].c}`);
console.log(`  night colour #${night[4121] && night[4121].c}`);
console.log(`  DIMS AT NIGHT: ${day[4121] && night[4121] && day[4121].c !== night[4121].c ? 'yes' : 'NO — identical at noon and midnight'}`);
console.log(`  patched with the pool shader: ${t && t.patched}`);
console.log(`  geometry ${t && t.type}  ${t && t.w} x ${t && t.hh} x ${t && t.d}   x[${t && t.bx}] y[${t && t.by}] z[${t && t.bz}]`);
console.log(`  transparent=${t && t.transparent}  material.userData=${JSON.stringify(t && t.ud)}  mesh.userData=${JSON.stringify(t && t.meshUd)}`);

// ── THE CLASS, not the instance ──────────────────────────────────────────
// Every mesh with a base low enough to take a pool that nonetheless does not
// dim at all. Those are the ones that will read as lit panels after dark.
console.log('\n── every EXTERIOR mesh that does not dim at night, base under 4.5 m ──');
const rows = [];
for (const id of Object.keys(meta)) {
  const m = meta[id], d = day[id], n = night[id];
  if (!m || !d || !n) continue;
  if (d.c !== n.c) continue;                       // it dims: fine
  if (m.by[0] >= 4.5) continue;                    // too high to pool anyway
  if (m.bx[0] > 100) continue;                     // interiors live at x 400+
  const area = Math.max(m.w, 0.01) * Math.max(m.hh, 0.01) * (m.d < 0.05 ? 1 : 1);
  rows.push({ id, area: Math.max(m.w, m.d) * m.hh, ...m, c: d.c });
}
rows.sort((a, c) => c.area - a.area);
console.log(`  ${rows.length} such meshes; the 12 largest by face area:`);
for (const r of rows.slice(0, 12)) {
  console.log(`   #${String(r.id).padStart(5)}  ${String(r.area.toFixed(1)).padStart(6)} m2  #${r.c}  patched=${r.patched ? 'Y' : 'n'}`
    + `  ${r.w}x${r.hh}x${r.d}  x[${r.bx}] y[${r.by}] z[${r.bz}]`);
}
await b.close();

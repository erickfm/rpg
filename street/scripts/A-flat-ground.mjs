// WHICH GROUND SURFACES ARE FLAT COLOUR, AND WHOSE ARE THEY?
//
// B measured 123 ground-facing untextured quads, ~454 m2, and diagnosed the
// class: "a flat colour is not a material. an untextured quad has no grain for
// the eye to attach to and no joints to give it scale, so it reads as a TINT
// OVER the paving rather than as a piece of paving."
//
// This locates them and attributes them by `userData.mod`, so the desk can
// route owners rather than guess. An investigation — it prints, it does not
// assert.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const rows = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const out = [];
  const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const hex = (c) => '#' + [c.r, c.g, c.b]
    .map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, '0')).join('');
  scene.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const gp = n.geometry.parameters || {};
    const e = n.matrixWorld.elements;
    // a GROUND-FACING surface: its world normal points up. For a PlaneGeometry
    // that is rotation.x = -PI/2; for a box, the +y face. Use the world matrix's
    // y basis to decide rather than guessing from rotation.
    const up = [e[4], e[5], e[6]];
    const isFlatPlane = n.geometry.type === 'PlaneGeometry' && Math.abs(up[1]) < 0.35;
    const isBox = n.geometry.type === 'BoxGeometry';
    if (!isFlatPlane && !isBox) return;
    // GROUND, OUTDOORS. My first predicate said only `y <= 1.6` and swept in
    // roofs (a 19.7x18 slab at y 1.6) and the interior rooms, which sit out at
    // x 680-1000 and are a different problem with a different owner. It counted
    // 307 surfaces against B's careful 123 — the over-count was mine.
    if (e[13] > 0.7) return;                       // paving, not a roof or a sill
    if (Math.abs(e[12]) > 140 || Math.abs(e[14]) > 140) return;   // the block, not a room
    for (const m of mats) {
      if (!m || m.map) continue;                   // TEXTURED is fine
      if (!m.color) continue;
      if (m.transparent && (m.opacity ?? 1) < 0.9) continue;   // a stain, not paving
      let w = 0, d = 0;
      if (isFlatPlane) { w = gp.width ?? 0; d = gp.height ?? 0; }
      else { w = gp.width ?? 0; d = gp.depth ?? 0; }
      if (!w || !d) continue;
      const area = Math.abs(w * d);
      if (area < 0.6) continue;                    // trims and edges are not paving
      out.push({ mod: n.userData.mod ?? '(unattributed)', w: +w.toFixed(2), d: +d.toFixed(2),
                 area: +area.toFixed(1), col: hex(m.color),
                 at: [+e[12].toFixed(1), +e[13].toFixed(2), +e[14].toFixed(1)] });
      break;                                       // one row per mesh
    }
  });
  return out;
});
await b.close();

const byMod = new Map();
for (const r of rows) {
  if (!byMod.has(r.mod)) byMod.set(r.mod, []);
  byMod.get(r.mod).push(r);
}
const tot = rows.reduce((a, r) => a + r.area, 0);
console.log(`\n  ${rows.length} flat-colour ground surfaces, ${tot.toFixed(0)} m2 total\n`);
console.log('  module            count   area m2   distinct tones   biggest single surface');
for (const [mod, rs] of [...byMod.entries()].sort((a, z) => z[1].reduce((s,r)=>s+r.area,0) - a[1].reduce((s,r)=>s+r.area,0))) {
  const area = rs.reduce((s, r) => s + r.area, 0);
  const tones = new Set(rs.map((r) => r.col)).size;
  const big = rs.slice().sort((a, z) => z.area - a.area)[0];
  console.log(`  ${mod.padEnd(16)} ${String(rs.length).padStart(5)}  ${area.toFixed(0).padStart(7)}   ${String(tones).padStart(12)}   ${big.w}x${big.d} m ${big.col} at ${big.at}`);
}
console.log('\n  biggest ten anywhere:');
for (const r of rows.slice().sort((a, z) => z.area - a.area).slice(0, 10)) {
  console.log(`    ${String(r.area).padStart(6)} m2  ${String(r.w).padStart(6)}x${String(r.d).padStart(6)}  ${r.col}  ${r.mod.padEnd(12)} at ${r.at}`);
}

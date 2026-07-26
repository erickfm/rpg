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
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? "http://localhost:4181/";
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
                 h: +(gp.height ?? 0).toFixed(2), type: n.geometry.type,
                 nm: n.name || '(anon)', parent: n.parent?.name || '(anon)',
                 area: +area.toFixed(1), col: hex(m.color),
                 at: [+e[12].toFixed(1), +e[13].toFixed(2), +e[14].toFixed(1)] });
      break;                                       // one row per mesh
    }
  });
  return out;
});
await b.close();

// PAVING vs TRIM. A's predicate accepts every BoxGeometry under y 0.7 without
// testing its orientation, and charges the area of the +y face even when that
// face is 0.11 m of moulding seen edge-on or is sealed inside another object.
// A surface is paving only if you could stand on it: both spans wide enough to
// take a 0.72 m stride, and not a lid on top of something 0.5 m tall.
const isPaving = (r) => Math.min(r.w, r.d) >= 0.45 && !(r.type === 'BoxGeometry' && r.h > 0.5);
const paveRows = rows.filter(isPaving), trimRows = rows.filter((r) => !isPaving(r));
const sum = (rs) => rs.reduce((a, r) => a + r.area, 0);
console.log(`\n  ALL modules, re-sorted:`);
console.log(`    paving  ${String(paveRows.length).padStart(3)} surfaces  ${sum(paveRows).toFixed(0).padStart(4)} m2`);
console.log(`    trim    ${String(trimRows.length).padStart(3)} surfaces  ${sum(trimRows).toFixed(0).padStart(4)} m2   <- not walkable, slabTex would be wrong`);
const byModP = new Map();
for (const r of paveRows) { if (!byModP.has(r.mod)) byModP.set(r.mod, []); byModP.get(r.mod).push(r); }
console.log('\n  real paving by module:');
for (const [m, rs] of [...byModP].sort((a,z)=>sum(z[1])-sum(a[1]))) console.log(`    ${m.padEnd(16)} ${String(rs.length).padStart(3)}  ${sum(rs).toFixed(0).padStart(4)} m2`);
const st = rows.filter((r) => r.mod === 'street').sort((a, z) => z.area - a.area);
console.log(`\n  street: ${st.length} surfaces, ${st.reduce((a,r)=>a+r.area,0).toFixed(0)} m2\n`);
console.log('   area   w   x   d   boxH  tone      y     at x,z            name / parent');
for (const r of st) {
  console.log(`  ${String(r.area).padStart(5)} ${String(r.w).padStart(6)}x${String(r.d).padStart(6)}  ${String(r.h).padStart(5)}  ${r.col}  ${String(r.at[1]).padStart(5)}  ${String(r.at[0]).padStart(7)},${String(r.at[2]).padStart(7)}  ${r.nm} / ${r.parent}`);
}

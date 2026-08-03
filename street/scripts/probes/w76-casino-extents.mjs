// One-shot (item 213 fallout): the casino's LABEL legs are fixed, but 13 legs of
// interiors-walk stayed red and none of them is about a name. This asks the two
// questions that decide whether the room or the harness is wrong:
//   1. what does __ct.roomDims() actually publish for the casino, vs the hotel?
//   2. is there a floor MESH under it at all (both suites say "not found")?
//   SHOT_URL=http://localhost:4320/ node scripts/probes/w76-casino-extents.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — GOTCHAS 50'); })();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const dims = await p.evaluate(() => window.__ct.roomDims());
for (const d of dims) console.log(`${String(d.id).padEnd(8)} cx=${d.cx}  cz=${d.cz}  w=${d.w}  d=${d.d}  y=${d.y}`);

// Floor meshes under each of the four rooms G walks, by world-space footprint.
const floors = await p.evaluate(() => {
  const out = {};
  for (const r of window.__ct.roomDims()) {
    let n = 0, lowest = null, area = 0;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const x = e[12], y = e[13], z = e[14];
      if (Math.abs(x - r.cx) > r.w / 2 || Math.abs(z - r.cz) > r.d / 2) return;
      if (y > r.y + 0.35) return;               // floor-height only
      const P = o.geometry?.parameters ?? {};
      const w = P.width ?? 0, h = P.height ?? 0, dd = P.depth ?? 0;
      const flat = (P.width !== undefined && P.height !== undefined && P.depth === undefined) || (dd > 0 && h < 0.35);
      if (!flat) return;
      n++; area += Math.max(w, 0) * Math.max(dd || h, 0);
      if (lowest === null || y < lowest) lowest = y;
    });
    out[r.id] = { n, lowest, area: +area.toFixed(1), need: +(r.w * r.d).toFixed(1) };
  }
  return out;
});
console.log('\nflat meshes at floor height inside each room footprint:');
for (const [id, f] of Object.entries(floors)) {
  console.log(`  ${id.padEnd(8)} ${String(f.n).padStart(4)} meshes, lowest y=${f.lowest}, ~${f.area} m² of ${f.need} m² needed`);
}
await b.close();

// ITEM 305 — WHY DOES `I-clip` SEE NO GEOMETRY IN ANY LOT CAR?
//
// I-clip's `boxOf` skips a mesh with any invisible ancestor, and on this build
// it skipped EVERY mesh of ALL ELEVEN lot cars — which is what produced its
// -1e9 half-extents and its "OVERLAP by 1000000000.00 m" rows. This asks the
// world which of the two filters is doing it, and names the ancestor.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4190/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isGroup) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
    if (n < 8) return;
    let hidden = 0, nobb = 0, ok = 0;
    const chain = [];
    o.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      let bad = null;
      for (let q = c; q; q = q.parent) if (q.visible === false) { bad = `${q.type}${q.name ? ':' + q.name : ''}`; break; }
      if (bad) { hidden++; if (chain.length < 3) chain.push(bad); return; }
      const g = c.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) { nobb++; return; }
      ok++;
    });
    out.push({ at: [+o.position.x.toFixed(1), +o.position.z.toFixed(1)], n, hidden, nobb, ok,
      selfVisible: o.visible, chain });
  });
  // …and the blunt question underneath it: of every mesh the lot module owns,
  // how many are actually drawn?
  let lotMeshes = 0, lotVisible = 0;
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    lotMeshes++;
    let vis = true; for (let q = o; q; q = q.parent) if (q.visible === false) { vis = false; break; }
    if (vis) lotVisible++;
  });
  return { roots: out, lotMeshes, lotVisible };
});
console.log(`lot meshes ${r.lotMeshes}, of which VISIBLE ${r.lotVisible}`);
console.log(JSON.stringify(r.roots, null, 1));
await b.close();

// IS THE BUILT WORLD THE SAME WORLD AS THE DEV WORLD?
//
// doors-declared already knows one difference: 8 of 8 doors arrive under vite
// dev, 7 of 8 under the rollup bundle. That is one symptom of emission order.
// Nobody has asked whether anything ELSE differs, and an auditor should.
//
// Same census against both servers, diffed.
import { chromium } from 'playwright';
const census = async (url) => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  await p.evaluate(() => window.__ct.clock(13, 0));
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let meshes = 0, textured = 0, masonry = 0, stamped = 0;
    s.traverse(o => { if (!o.isMesh) return; meshes++;
      const m = Array.isArray(o.material)?o.material[0]:o.material;
      if (m && m.map) { textured++;
        if (m.map.userData && m.map.userData.masonry) masonry++; }
      for (let q=o;q;q=q.parent) if (q.userData && q.userData.mod) { stamped++; break; }
    });
    return {
      meshes, textured, masonry, stamped,
      doors: (window.__ct.doors?window.__ct.doors():[]).map(d=>d.building).sort(),
      spots: window.__ct.spots().length,
      seats: window.__ct.seats ? window.__ct.seats().length : null,
      rooms: window.__ct.rooms ? window.__ct.rooms().length : null,
      colliders: window.__ct.colliders().length,
      frontages: (globalThis.__frontages||[]).length,
    };
  });
  await b.close();
  return r;
};
const A = await census('http://localhost:4185/');   // dev
const B = await census('http://localhost:4184/');   // preview
const keys = ['meshes','textured','masonry','stamped','spots','seats','rooms','colliders','frontages'];
console.log('field         dev      preview   same?');
for (const k of keys) {
  const a = A[k], b2 = B[k];
  console.log(`${k.padEnd(12)} ${String(a).padStart(6)}  ${String(b2).padStart(8)}   ${a===b2?'yes':'** DIFFERS **'}`);
}
console.log(`\ndoors dev     (${A.doors.length}) ${A.doors.join(', ')}`);
console.log(`doors preview (${B.doors.length}) ${B.doors.join(', ')}`);
const lost = A.doors.filter(d=>!B.doors.includes(d));
console.log(lost.length ? `\nLOST IN THE BUNDLE: ${lost.join(', ')}` : '\nno door lost in the bundle');

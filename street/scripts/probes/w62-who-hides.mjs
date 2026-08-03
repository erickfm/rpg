// WHICH ancestor is hiding all 305 masonry stamps? masonry.mjs drops any mesh
// with a visible===false ancestor, and on this world that is every stamped face
// in the world. Name the node that does it, so the handoff can say why.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4183/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim(URL), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const hiders = {};       // name of the hiding ancestor -> stamped faces below it
  const hidersAll = {};    // same, for all textured faces
  let stamped = 0, stampedVisible = 0;
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let hider = null;
    for (let q = o; q; q = q.parent) if (q.visible === false) hider = q;   // outermost
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m || !m.map) return;
      const label = hider ? (hider.name || hider.userData?.mod || `<unnamed ${hider.type}>`) : null;
      if (label) hidersAll[label] = (hidersAll[label] || 0) + 1;
      if (m.map.userData && m.map.userData.masonry) {
        stamped++;
        if (!hider) stampedVisible++;
        else hiders[label] = (hiders[label] || 0) + 1;
      }
    });
  });
  return { stamped, stampedVisible, hiders, hidersAll };
});
console.log(`masonry stamps in the scene: ${out.stamped}`);
console.log(`  of those VISIBLE to masonry.mjs: ${out.stampedVisible}`);
console.log('\nhidden stamped faces, by the outermost ancestor that hides them:');
for (const [k, v] of Object.entries(out.hiders).sort((a, c) => c[1] - a[1]))
  console.log(`   ${String(v).padStart(4)} ×  ${k}`);
console.log('\nALL hidden textured faces, by hiding ancestor:');
for (const [k, v] of Object.entries(out.hidersAll).sort((a, c) => c[1] - a[1]).slice(0, 20))
  console.log(`   ${String(v).padStart(4)} ×  ${k}`);
await b.close();

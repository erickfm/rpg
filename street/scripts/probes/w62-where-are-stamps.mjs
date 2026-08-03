// The explore sweep found 0 masonry stamps on 1902 textured faces, while
// src/ calls masonry().paint() dozens of times. One of those two is lying.
// This asks the scene directly, WITHOUT the visible-subtree filter, and
// separately counts textures reachable from materials vs from meshes.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4183/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  page error:', m.text().slice(0, 160)); });
await p.goto(aim(URL), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1500);

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let meshes = 0, mapped = 0, stampedAll = 0, kindAll = 0, hiddenMapped = 0;
  const kinds = {};
  const stampedNames = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return; meshes++;
    let hidden = false;
    for (let q = o; q; q = q.parent) if (q.visible === false) hidden = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m || !m.map) return;
      mapped++; if (hidden) hiddenMapped++;
      const u = m.map.userData || {};
      if (u.masonry) { stampedAll++; if (stampedNames.length < 8) stampedNames.push((o.name || o.parent?.name || '?') + (hidden ? ' [HIDDEN]' : '')); }
      if (u.surface) { kindAll++; kinds[u.surface] = (kinds[u.surface] || 0) + 1; }
    });
  });
  // is the export even reaching the page? build one live and see if it stamps.
  return { meshes, mapped, hiddenMapped, stampedAll, kindAll, kinds, stampedNames,
           ctKeys: Object.keys(window.__ct) };
});
console.log(JSON.stringify(out, null, 2));
await b.close();

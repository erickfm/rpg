// ITEM 156 recon — where are the lamps, and where is the street, at night?
// Reads the lamp list off the UPLOADED SHADER UNIFORM rather than from
// ct/props.ts's private `lampHeads`, because the uniform is what the fragment
// actually shades from — the same reason item 234 exists: material.color is
// blind to lamplight now, so ask the thing that draws.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(23, 0));
await p.waitForTimeout(1000);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let lamps = null, patched = 0, total = 0;
  const seen = new Set();
  s.traverse((o) => {
    if (!o.isMesh) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) {
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid); total++;
      if (m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool') patched++;
    }
  });
  return {
    materials: total, patchedW45pool: patched,
    headCount: s.userData.lampHeadCount, uploaded: s.userData.lampHeadsUploaded,
    spawn: s.userData.spawn, pos: window.__ct.pos(),
    sites: window.__ct.sites ? window.__ct.sites() : null,
  };
});
console.log(JSON.stringify(out, null, 1));
await b.close();

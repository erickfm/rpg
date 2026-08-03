// w64: which stamp actually survives on a pooled material? Counts
// userData.graded, onBeforeCompile, customProgramCacheKey and the injected
// varying, so "0 pooled" can be told apart from "the probe read the wrong flag".
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const mats = new Set();
  s.traverse(o => { if (!o.isMesh) return; const mm = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mm) if (m) mats.add(m); });
  let graded = 0, obc = 0, cpk = 0, cpkVal = new Set(), selfLit = 0, prog = 0;
  for (const m of mats) {
    if (m.userData && m.userData.graded) graded++;
    if (m.onBeforeCompile && m.onBeforeCompile.length) obc++;
    if (m.customProgramCacheKey) { cpk++; try { cpkVal.add(m.customProgramCacheKey()); } catch (e) { cpkVal.add('ERR'); } }
    if (m.userData && m.userData.selfLit) selfLit++;
    if (m.program) prog++;
  }
  return { total: mats.size, graded, onBeforeCompile: obc, customProgramCacheKey: cpk, cpkValues: [...cpkVal], selfLit, withProgram: prog };
}, null), null, 1));
await b.close();

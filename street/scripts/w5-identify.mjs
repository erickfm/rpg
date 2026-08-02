import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from './lib/reachable.mjs';
const URL = aim('http://localhost:4184/');
const TX = parseFloat(process.env.TX), TZ = parseFloat(process.env.TZ);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const r = await page.evaluate(({ TX, TZ }) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateMatrixWorld(true);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, m = o.matrixWorld;
    const lo = bb.min.clone().applyMatrix4(m), hi = bb.max.clone().applyMatrix4(m);
    const cx = (lo.x+hi.x)/2, cz=(lo.z+hi.z)/2, cy=(lo.y+hi.y)/2;
    if (Math.abs(cx-TX) < 0.15 && Math.abs(cz-TZ) < 0.15) {
      let chain = [];
      for (let q = o; q; q = q.parent) chain.push(q.name || q.type);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      out.push({ cx, cz, cy, dims:[hi.x-lo.x,hi.y-lo.y,hi.z-lo.z], geoType: o.geometry.type,
        geoParams: o.geometry.parameters, chain,
        matColors: mats.map(mt => mt?.color?.getHexString()) });
    }
  });
  return out;
}, { TX, TZ });
console.log(JSON.stringify(r, null, 2));
await browser.close();

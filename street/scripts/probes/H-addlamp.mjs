import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
const r = await p.evaluate(() => {
  const ud = window.__ct.scene().userData;
  return { type: typeof ud.addLamp, lamps: Array.isArray(ud.lampHeads) ? ud.lampHeads.length : (ud.lamps?.length ?? null) };
});
console.log('scene.userData.addLamp is a', r.type, '| declared lamps:', r.lamps);
await b.close();

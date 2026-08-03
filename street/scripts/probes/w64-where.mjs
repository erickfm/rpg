// w64: where does the player start, where is the used-car lot sign, and what
// is the exterior actually made of once the street is the visible world?
// (A first pass measured the world from indoors — the exterior is culled while
// you are inside 301, so every exterior material read as "invisible".)
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
console.log(JSON.stringify(await p.evaluate(() => {
  const s = window.__ct.scene();
  const ud = s.userData;
  const call = (k) => { try { const v = ud[k]; return typeof v === 'function' ? v() : v; } catch (e) { return String(e); } };
  return { spawn: call('spawn'), lotSign: call('lotSign'), pos: window.__ct.pos ? window.__ct.pos() : null,
    ctKeys: Object.keys(window.__ct) };
}), null, 1));
await b.close();

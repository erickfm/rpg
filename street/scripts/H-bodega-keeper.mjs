// H (verifier): B's published station for the bodega keeper.
// (441.50, 0.40) facing the counter - "if you can see his face, this is fixed".
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
const S = [441.50, 0.40], K = [442.35, -0.70];
const yaw = Math.atan2(K[0] - S[0], -(K[1] - S[1]));
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0), [S[0], S[1], yaw]);
await p.waitForTimeout(800);
const prompt = await p.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});
console.log(`stood at (${S}) facing (${K})  yaw ${yaw.toFixed(2)}`);
console.log(`prompt: ${prompt || '(nothing)'}`);
await p.screenshot({ path: 'shots/H-bodega-keeper.png' });
await b.close();

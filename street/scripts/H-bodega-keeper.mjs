// H (verifier): B's published station for the bodega keeper.
// (441.50, 0.40) facing the counter - "if you can see his face, this is fixed".
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
// DERIVED, NOT WRITTEN DOWN. This station used to be the literal pair
// (441.50, 0.40) / (442.35, -0.70). B then inserted ct/int-bank.ts ahead of the
// other interiors and every room after it slid +80 m in x, so those numbers
// pointed into the bank and the probe read "(nothing)" - a station in the
// LEDGER that had quietly stopped existing.
//
// The world publishes where the customer stands: the bodega's own buy spot.
// Take it from there and the station follows the room wherever it goes.
const spot = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /buy cereal/i.test(q.label));
  return s ? { x: s.x, z: s.z, r: s.r, label: s.label } : null;
});
if (!spot) { console.log('no buy-cereal spot in the world — nothing measured (GOTCHAS §32)'); await b.close(); process.exit(3); }
// the keeper stands behind the counter, ~1.4 m from the customer spot
const K = await p.evaluate(([sx, sz]) => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  let best = null;
  root.traverse((o) => {
    if (!o.isMesh || !/Plane/.test(o.geometry?.type || '')) return;
    const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (y < 0.6 || y > 1.6) return;                       // a standing figure's mid-height
    const d = Math.hypot(x - sx, z - sz);
    if (d > 3.0) return;
    if (!best || d < best.d) best = { x: +x.toFixed(2), z: +z.toFixed(2), d: +d.toFixed(2) };
  });
  return best;
}, [spot.x, spot.z]);
const S = [spot.x, spot.z], KK = K ? [K.x, K.z] : [spot.x, spot.z - 1];
const yaw = Math.atan2(KK[0] - S[0], -(KK[1] - S[1]));
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0), [S[0], S[1], yaw]);
await p.waitForTimeout(800);
const prompt = await p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
console.log(`derived station: stand (${S[0].toFixed(2)}, ${S[1].toFixed(2)}) facing (${KK[0]}, ${KK[1]})`);
console.log(`prompt: ${prompt || '(nothing)'}`);
await p.screenshot({ path: 'shots/H-bodega-keeper.png' });
await b.close();

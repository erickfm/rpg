// Does camY transiently hold the SPAWN eye height (7.02) after warping to the
// pavement? fp.ts's standTop uses `atY = lastWorldY`, which right after the
// spawn is still 5.4 (walk-up floor 3) — a stale value that belongs to a
// different storey than the place you just warped to.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const trace = await p.evaluate(() => new Promise((resolve) => {
  const out = [];
  let n = 0;
  const tick = () => {
    out.push(+window.__ct.camY().toFixed(3));
    if (++n < 90) requestAnimationFrame(tick); else resolve(out);
  };
  // start recording, THEN warp, so frame 0 is the pre-warp camera
  requestAnimationFrame(() => { window.__ct.warp(-6.0, -20.0, 0, 0.14, 0); tick(); });
}));

console.log('camY, every frame from the warp:');
console.log(trace.slice(0, 24).join('  '));
console.log(`\nmax over 90 frames: ${Math.max(...trace).toFixed(3)}`);
console.log(`frames reading >= 7.0: ${trace.filter((v) => v >= 7.0).length}`);
console.log(`\nif any frame reads 7.020, jump-walk's Math.max would report`
  + ` ${(7.02 - (0.14 + 1.62)).toFixed(3)} m`);
await b.close();

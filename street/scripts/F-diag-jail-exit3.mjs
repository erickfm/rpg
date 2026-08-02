import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';

const URL = aim('http://localhost:4184/');
const N = parseInt(process.argv[2] || '20', 10);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(900);

// get inside once
await p.evaluate(() => window.__ct.warp(60.2, -103.0, Math.PI / 2, 0, 0));
await afterFrames(p, 5);
await p.keyboard.press('e');
await p.waitForFunction(() => window.__ct.pos()[0] > 400, { timeout: 15000 });
const inside = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log('inside at', inside);

let ok = 0, fail = 0;
for (let i = 0; i < N; i++) {
  // warp to the exit spot's exact standing point every time
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0), [inside[0], inside[2]]);
  await afterFrames(p, 6);
  await p.keyboard.press('e');
  let left = false;
  try {
    await p.waitForFunction(() => window.__ct.pos()[0] < 100, { timeout: 2000 });
    left = true;
  } catch { left = false; }
  console.log(`trial ${i + 1}: ${left ? 'OK left' : 'FAIL stuck'}`);
  if (left) { ok++;
    // walk back in for next trial
    await p.evaluate(() => window.__ct.warp(60.2, -103.0, Math.PI / 2, 0, 0));
    await afterFrames(p, 5);
    await p.keyboard.press('e');
    await p.waitForFunction(() => window.__ct.pos()[0] > 400, { timeout: 15000 });
  } else { fail++; }
}
console.log(`\n${ok} of ${N} exit taps succeeded, ${fail} failed`);
await b.close();
process.exit(fail > 0 ? 1 : 0);

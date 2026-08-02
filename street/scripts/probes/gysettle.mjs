// Does a gy reading taken 2 rAFs after a warp agree with one taken 300 ms
// later? My step-finding scans (steps.mjs, church2.mjs, regrade2.mjs) all read
// pos()[3] two frames after warping, and the seats-walk diagnosis showed the
// ground picker can lag. If it lags on ordinary moves too, every gy I have
// published is suspect at height transitions.
//
// Warmed first, so this measures the steady-state behaviour rather than the
// first-warp-after-load case already understood.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(async () => {
  const fast = async (x, z) => {                    // what my scans do
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    return +window.__ct.pos()[3].toFixed(3);
  };
  const slow = async (x, z) => {                    // generously settled
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise(r=>setTimeout(r, 350));
    return +window.__ct.pos()[3].toFixed(3);
  };
  // pavement → the library flight → pavement again, the sharpest transitions I know
  const pts = [[-6,-9],[-10.5,-13],[-10.5,-12],[-10.5,-14],[-6,-9],[9,-79.5],[8.75,-80.5],[-6,-40]];
  const res = [];
  for (const [x,z] of pts) {
    await new Promise(r=>setTimeout(r, 250));       // leave from a settled state
    const f = await fast(x,z);
    await new Promise(r=>setTimeout(r, 250));
    const s = await slow(x,z);
    res.push({ at:[x,z], fast:f, slow:s, agree: Math.abs(f-s) < 0.005 });
  }
  return res;
});
let bad = 0;
for (const r of out) {
  if (!r.agree) bad++;
  console.log(`(${String(r.at[0]).padStart(6)}, ${String(r.at[1]).padStart(6)})  2 rAF: ${String(r.fast).padEnd(6)}  350 ms: ${String(r.slow).padEnd(6)}  ${r.agree ? 'agree' : '** DISAGREE **'}`);
}
console.log(`\n${bad} of ${out.length} disagree`);
await b.close();

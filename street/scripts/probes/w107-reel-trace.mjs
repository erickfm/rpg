// WHAT DOES A SPINNING REEL'S `pos` ACTUALLY DO, frame by frame — does it wrap,
// and does it agree with the `speed` the machine publishes beside it?
// A one-shot measurement for item 214. Prints. Does not assert.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__slots !== undefined, { timeout: 30000 });
await p.evaluate(() => { window.__slots.insert(50); window.__slots.play(); });
const trace = await p.evaluate(async (n) => {
  const s = [];
  await new Promise((res) => {
    let k = 0;
    const tick = () => {
      const v = window.__slots.view();
      s.push({ t: performance.now(), state: v.state,
        pos: v.reels.map((r) => r.pos), sp: v.reels.map((r) => r.speed) });
      if (++k >= n) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return s;
}, 45);
console.log(`${trace.length} frames over ${(trace[trace.length - 1].t - trace[0].t).toFixed(0)} ms`);
for (let i = 1; i < trace.length; i++) {
  const dt = (trace[i].t - trace[i - 1].t) / 1000;
  const d0 = trace[i].pos[0] - trace[i - 1].pos[0];
  console.log(`  ${trace[i].state.padEnd(9)} dt ${(dt * 1000).toFixed(1).padStart(6)} ms`
    + `  pos0 ${trace[i].pos[0].toFixed(3).padStart(8)}  d ${d0.toFixed(3).padStart(8)}`
    + `  speed0 ${trace[i].sp[0].toFixed(2).padStart(7)}  d/dt ${(d0 / dt).toFixed(2).padStart(7)}`);
}
await b.close();

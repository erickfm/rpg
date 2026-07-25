// Hypothesis: seats-walk warps with gy = 0 (line 91) and this bench stands on
// the library courtyard, which is RAISED. Below the floor, the seat's ok() or
// the prompt logic fails and the tool reports "got null".
//
// Test: same point, two ground heights.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const read = () => {
    const d = document.getElementById('ct-prompt');
    return d && d.style.display !== 'none' ? d.textContent : null;
  };
  const res = [];
  for (const gy of [0, 0.14, 0.3, 0.42]) {
    window.__ct.warp(-8.6, -19.43, 0, gy, 0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>setTimeout(r,150));
    res.push({ gy, pos: window.__ct.pos().map(v=>+v.toFixed(2)), prompt: read() });
  }
  return res;
});
console.log('same point (-8.6, -19.43), different ground heights, reading #ct-prompt the way seats-walk does:\n');
for (const r of out)
  console.log(`   warp gy=${String(r.gy).padEnd(5)} → pos ${JSON.stringify(r.pos)}   prompt: ${r.prompt ?? 'NULL'}`);
await b.close();

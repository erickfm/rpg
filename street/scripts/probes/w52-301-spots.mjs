// ITEM 128, siting the turn test: which [E] spots are within reach in flat 301,
// so a station can be chosen where turning actually changes the prompt rather
// than one standing ON a spot, where tier 1 makes yaw irrelevant by design.
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w52-301-spots.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2000);
const home = await p.evaluate(() => window.__ct.pos());
const near = await p.evaluate((h) => window.__ct.spots()
  .map((s) => ({ ...s, d: Math.hypot(s.x - h[0], s.z - h[2]) }))
  .filter((s) => s.d < 12).sort((a, b) => a.d - b.d), home);
console.log(`player at (${home[0].toFixed(2)}, ${home[2].toFixed(2)}) gy ${home[3].toFixed(2)}`);
for (const s of near) {
  console.log(`  d=${s.d.toFixed(2)}  r=${s.r}  ok=${s.ok}  (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  ${s.label}`);
}
await b.close();

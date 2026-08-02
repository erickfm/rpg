// Every standable collider top in the world, by tag — what item 112's step-off
// fix has to hold. One-shot listing; see BUILDER-BRIEF §7a.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4187/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const cols = await p.evaluate(() => window.__ct.colliders());
for (const c of cols.filter((c) => c.maxY !== undefined)) {
  console.log(`${(c.tag ?? '(untagged)').padEnd(22)} maxY=${String(c.maxY).padEnd(7)}`
    + ` x ${c.minX.toFixed(2)}..${c.maxX.toFixed(2)}  z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}`);
}
await b.close();

// ITEM 158 — what does roomDims actually publish, and where is the library?
// GOTCHAS 86: a room is not necessarily centred in its slab, so ASK rather than
// derive. My first pass assumed a `library` key, got undefined, and silently
// fell back to sweeping every interior in the world — which is how an angled
// table 550 m away nearly became the answer.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
const out = await p.evaluate(() => {
  const d = window.__ct.roomDims ? window.__ct.roomDims() : null;
  return { type: Object.prototype.toString.call(d), json: JSON.parse(JSON.stringify(d)) };
});
console.log(out.type);
console.log(JSON.stringify(out.json, null, 1).slice(0, 4000));
await b.close();

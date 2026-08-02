// Every STATIC collider in the world, as a stable sorted list.
//
// gap.ts's `nudgeClear` decides where the parked cars stand, so a change to
// gap.ts that moved a single decision would move colliders. Diffing this file
// before and after is how "the drawn world did not move" is proved rather than
// asserted — the red dump only lists the red ones, and a car that moved from
// one clear spot to another clear spot would not appear in it at all.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w27-collider-keys.mjs > /tmp/x
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('SHOT_URL is required'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// static only: vehicleBoxes move every frame (w24-red-dump's note)
const snap = () => p.evaluate(() => window.__ct.colliders()
  .map((c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`));
const s1 = await snap();
await p.waitForTimeout(1000);
const s2 = await snap();
const still = s1.filter((k) => s2.includes(k)).sort();
for (const k of still) console.log(k);
console.log(`STATIC ${still.length} of ${s1.length}`);
await b.close();

// Item 198 — dump the PLAYER's static collider set, so before/after can be
// compared as a SET rather than as a count.
//
// The fix reroutes 39 boxes: they used to reach the player through
// `street.colliders` and now reach it through `propColliders`. Same boxes, same
// array, different order — but "same count" is not the same claim as "same
// set", and a reroute is exactly the change that could silently drop or
// duplicate one. 508 before and 508 after would survive losing one box and
// duplicating another.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-dump-static.mjs out.json
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4270/');
const OUT = process.argv[2];
if (!OUT) { console.error('usage: w71-dump-static.mjs <out.json>'); process.exit(2); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(600);

const d = await p.evaluate(() => {
  const key = (c) => [c.minX, c.maxX, c.minZ, c.maxZ].map((v) => v.toFixed(4)).join('|');
  return {
    static: window.__ct.staticColliders().map(key).sort(),
    all: window.__ct.colliders().length,
    avoid: window.__ct.citAvoid().filter((c) => !c.actor).map(key).sort(),
  };
});
if (d.static.length === 0) { console.error('EMPTY — nothing measured'); process.exit(3); }
writeFileSync(OUT, JSON.stringify(d));
console.log(`wrote ${OUT}: ${d.static.length} static, ${d.avoid.length} avoided, ${d.all} colliders total`);
await b.close();

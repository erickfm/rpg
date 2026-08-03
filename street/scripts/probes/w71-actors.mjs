// w71 scratch — WHAT IS IN actorColliders(), and can I track citizens with it?
// Item 198 needs a before/after on crowd health, and the crowd publishes no
// citizens. `actorColliders()` holds every box the two actor hooks registered:
// cars (via vehicleBox, which ALSO goes into citAvoid) and citizens (via the
// crowd's own `solid`, which does not). So citizens = actors NOT in citAvoid.
// Verify that separation holds before building anything on it.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4270/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(600);

const snap = () => p.evaluate(() => {
  const key = (c) => [c.minX, c.maxX, c.minZ, c.maxZ].map((v) => v.toFixed(3)).join('|');
  const av = window.__ct.citAvoid();
  const avActor = new Set(av.filter((c) => c.actor).map(key));
  const act = window.__ct.actorColliders();
  return {
    nAvoid: av.length, nAvoidActor: av.filter((c) => c.actor).length,
    nActor: act.length,
    actors: act.map((c) => ({
      w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
      x: +((c.minX + c.maxX) / 2).toFixed(3), z: +((c.minZ + c.maxZ) / 2).toFixed(3),
      inAvoid: avActor.has(key(c)),
    })),
  };
});

const a = await snap();
console.log(`citAvoid ${a.nAvoid} (${a.nAvoidActor} actors) · actorColliders ${a.nActor}`);
for (const c of a.actors) console.log(`  ${c.w} x ${c.d} at (${c.x}, ${c.z})  inCitAvoid=${c.inAvoid}`);

await p.waitForTimeout(3000);
const c2 = await snap();
console.log('\nafter 3 s — did they move?');
a.actors.forEach((c, i) => {
  const q = c2.actors[i];
  if (!q) return;
  console.log(`  [${i}] ${c.w}x${c.d}  d=${Math.hypot(q.x - c.x, q.z - c.z).toFixed(3)} m  inCitAvoid=${q.inAvoid}`);
});
await b.close();

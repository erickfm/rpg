// Item 198, INCIDENTAL FINDING — do the cars ever actually occupy their
// citAvoid boxes? NOT this item's to fix; recorded for item 173, which is
// *"people still get stuck. they should back up and allow the car to pass"*.
//
// The six `vehicleBox` registrations (crosstown.ts:615) are the ONLY things
// besides citizens in actorColliders, and a snapshot found all six sitting at
// (999, 999) with zero extent — i.e. parked outside the world. If they stay
// there, the crowd is never told where a car is, and "a citizen pinned by a
// car" cannot be a steering-strength problem at all. If they come alive, they
// do not. Either answer matters to 173 and neither was written down.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-are-cars-in-citavoid.mjs
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

await p.evaluate(() => {
  const S = { n: 0, frames: 0, live: 0, seen: [], area: [] };
  window.__w71c = S;
  const step = () => {
    const a = window.__ct.citAvoid().filter((c) => c.actor);
    S.n = a.length; S.frames++;
    a.forEach((c, i) => {
      const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
      const onStreet = Math.abs(c.minX) < 100 && Math.abs(c.minZ) < 200;
      S.area[i] = Math.max(S.area[i] || 0, w * d);
      if (w * d > 0.01 && onStreet) { S.live++; if (S.seen.length < 40) S.seen.push({ i, w: +w.toFixed(2), d: +d.toFixed(2), x: +((c.minX + c.maxX) / 2).toFixed(1), z: +((c.minZ + c.maxZ) / 2).toFixed(1) }); }
    });
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});
await p.waitForTimeout(45000);
const r = await p.evaluate(() => window.__w71c);
console.log(`actor boxes in citAvoid: ${r.n}   frames sampled: ${r.frames}`);
console.log(`box-frames with real extent ON the street: ${r.live}`);
console.log(`largest area each box ever reached: ${r.area.map((a) => a.toFixed(2)).join(', ')}`);
if (r.seen.length) { console.log('samples:'); for (const s of r.seen.slice(0, 12)) console.log(`   [${s.i}] ${s.w} x ${s.d} at (${s.x}, ${s.z})`); }
console.log(r.live === 0
  ? '>> NO car ever occupied a real citAvoid box in 45 s. The crowd is never told where a car is.'
  : '>> cars DO occupy citAvoid boxes.');
await b.close();

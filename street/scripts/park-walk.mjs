// Can you reach the whole of every open site?
//
// The park was deepened to 32 m while the world's west bound stayed at
// -13.40, so 25 metres of it — the lamps, the trees, the benches, the loop —
// were visible and unreachable. You walked in, stopped dead, and concluded the
// park was seven metres deep. A site you can see into and not walk into is
// worse than no site, and nothing caught it because the bound and the site
// depth live in different files.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4185/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const pos = () => p.evaluate(() => window.__ct.pos());

const fails = [];
//  is how much of the site its own back wall or fence legitimately
// takes: the park has a boundary wall, the car lot has a fence with signage
// standing behind it. What the test is looking for is not "you reached the
// last polygon" but "you were stopped by the SITE and not by the world bound",
// which is a 25 m discrepancy, not a 4 m one.
for (const [nm, midZ, dir, slack] of [['park', -83.0, -1, 3.0], ['lot', 2.5, 1, 5.0]]) {
  // where does the site's own geometry reach?
  const far = await p.evaluate(([midZ, dir]) => {
    let far = 0;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const w = new o.position.constructor(); o.getWorldPosition(w);
      // street-side only: the walk-up interior sits at x 100..230 and the
      // belt beyond 400, and both are nowhere near these sites
      if (Math.abs(w.x) > 60 || Math.abs(w.z - midZ) > 13) return;
      if (dir < 0 ? w.x < far : w.x > far) far = w.x;
    });
    return +far.toFixed(2);
  }, [midZ, dir]);
  // …and how far can you actually walk into it?
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [dir < 0 ? -7.5 : 7.5, midZ, dir < 0 ? -Math.PI / 2 : Math.PI / 2]);
  await p.waitForTimeout(220);
  await p.keyboard.down('w'); await p.waitForTimeout(9000); await p.keyboard.up('w');
  const got = (await pos())[0];
  const short = dir < 0 ? got - far : far - got;
  console.log(`${nm.padEnd(5)} geometry reaches x ${far.toFixed(2)}, you can walk to ${got.toFixed(2)} — ${short.toFixed(2)} m short`);
  if (short > slack) fails.push(`${nm}: ${short.toFixed(1)} m of it is visible and unreachable`);
}
console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length ? `${fails.length} site(s) you cannot walk into` : 'every open site is walkable to its far edge');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

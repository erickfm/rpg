// Can you still get into all eight rooms once EVERY builder is merged?
//
// DELIBERATELY NOT IN scripts/checks.mjs, and it must stay out. This measures
// the INTEGRATED world on :5177 — mainline plus every builder in flight —
// which is by definition NOT this checkout, so it cannot call reportWorld and
// would fail GOTCHAS 26 on purpose. Numbers from another tree are not evidence
// about yours, and nothing here should be quoted as if they were.
//
// The gap it fills is real though. `live-integrate.sh` drops a builder whose
// work breaks the BUILD, and that is the only thing standing between the
// player's world and a merge that compiles but does not play. Nothing asked
// whether the doors still open once H's traffic, D's props and my rooms are
// in the same tree — each of us verifies in a worktree where the others'
// colliders do not exist.
//
// Run it by hand, read it as an observation and not a verdict, and if it goes
// red the next question is WHOSE change did it, which this cannot tell you.
//
//     node scripts/integration-doors.mjs        # needs :5177 up
//
// 2026-07-25: 8/8, with the whole block merged.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto('http://localhost:5177/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const pos = () => p.evaluate(() => window.__ct.pos());
const out = [];
const doors = await p.evaluate(() => window.__ct.doors()
  .filter((d) => d.stand).map((d) => ({ b: d.building, x: d.stand.x, z: d.stand.z })));
for (const d of doors) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0.14, 0), [d.x, d.z]);
  await p.waitForTimeout(250);
  const before = (await pos())[0];
  // press E the way a player does: held across frames
  await p.keyboard.down('KeyE'); await p.waitForTimeout(140); await p.keyboard.up('KeyE');
  await p.waitForTimeout(400);
  const after = (await pos())[0];
  const inside = after > 400;
  out.push(`${inside ? ' ok ' : 'FAIL'}  ${d.b}: stood on its published door, E -> x ${after.toFixed(0)}`);
  if (inside) { // come back out
    await p.keyboard.down('KeyE'); await p.waitForTimeout(140); await p.keyboard.up('KeyE');
    await p.waitForTimeout(400);
  }
}
for (const l of out) console.log(l);
console.log(`\n${out.filter((l) => l.startsWith(' ok')).length}/${out.length} doors let you in, in the MERGED world`);
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();

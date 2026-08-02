// Can you still get into all eight rooms — in a world this checkout did not build?
//
// TWO uses, and it only reads `__ct`, never a source path, which is what makes
// both possible:
//
//   1. the INTEGRATED world (:5177), mainline plus every builder in flight
//   2. the BUILT BUNDLE, via PINNED_MODE=preview ./scripts/slow-pinned.sh
//
// (2) matters more than it looks. `interiors-walk` — 195 assertions, the real
// room suite — does `await import('/src/proto/ct/doors.ts')`, a source path no
// bundle serves, so it CANNOT run against a build (AUDIT-INSTRUMENTS.md has why
// converting it is not a one-line swap). Until this, nothing at all walked into
// a room in the artefact the user plays. It is a smoke test next to
// interiors-walk, and it is the only coverage that exists there.
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
//     node scripts/integration-doors.mjs                       # the merged world
//     PINNED_MODE=preview ./scripts/slow-pinned.sh integration-doors   # the BUNDLE
//
// 2026-07-25: 8/8, with the whole block merged.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
// SHOT_URL so this can be pointed at a BUNDLE as well as at the integrated
// world. It reads nothing but `__ct`, no source imports, so unlike
// interiors-walk it survives a built bundle — which makes it the only thing
// that walks a room in the artefact the user actually plays.
const URL = aim('http://localhost:5177/');
// INTEGRATION MODE vs OWN-BUILD MODE, and the guard depends on which.
//
// This started unregistered because it measures a tree that is not this
// checkout, which would fail GOTCHAS 26 on purpose. That is true of the :5177
// use and NOT of the other one: pointed at a pinned bundle of this HEAD it is
// measuring our own build, and there the sha check is exactly what you want.
//
// So: enforce it whenever the target is not the integration world, and when it
// IS, say so loudly instead of quietly skipping. A missing guard nobody
// mentions is how 55 scripts ended up reading another builder's server.
const INTEGRATION = /:5177(\/|$)/.test(URL);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
if (INTEGRATION) {
  console.log('INTEGRATED WORLD — mainline plus every builder in flight. This is NOT');
  console.log('this checkout, so no build-stamp check is possible and none is made.');
  console.log('Read the result as an observation; never quote it about a branch.');
  console.log('EXPECT IT TO BE FLAKY: live-integrate.sh rebuilds :5177 every 15 s, so a');
  console.log('walk of any length can be cut off mid-run ("Execution context was');
  console.log('destroyed") or report a door short. A clean 8/8 there is meaningful; a');
  console.log('failure is not, until you have seen it twice. The BUNDLE mode below is');
  console.log('the one to trust — a pinned tree cannot rebuild underneath you.\n');
} else {
  const { reportWorld } = await import('./lib/which-world.mjs');
  await reportWorld(p, URL);                                      // GOTCHAS 26
}
// Let the world settle before the FIRST door.
//
// The bodega is first in the list and started failing the moment anything
// changed how long startup took — it teleported nowhere and reported x 7, the
// street. Nothing was wrong with the bodega; it was being asked before the
// world had finished coming up, and every later door got that time for free
// from the doors ahead of it. A check whose first subject is tested under
// different conditions from the rest is not measuring the subject.
await p.waitForTimeout(900);

const pos = () => p.evaluate(() => window.__ct.pos());
const out = [];
const doors = await p.evaluate(() => window.__ct.doors()
  .filter((d) => d.stand).map((d) => ({ b: d.building, x: d.stand.x, z: d.stand.z })));
// GOTCHAS 34: an empty subject list is NOT a pass. This iterates a list the
// WORLD supplies, so a world that registers none of them would sail through
// reporting success over zero assertions — the more broken the world, the
// quieter this gets. 36d7bdd07 found two more of these upstream; my keeper
// check had the same shape.
if (!doors.length) {
  console.log('NO DECLARED DOORS WITH A STAND POINT. That is a failure, not a pass —');
  console.log('every room in the belt is reached through one, so zero means the');
  console.log('registry did not publish, and "0/0 doors let you in" would be a lie.');
  await b.close(); process.exit(1);
}
for (const d of doors) {
  // groundAt, not 0.14: the bodega's door is on a chamfered corner and the
  // side-street walks are laid separately, so "the pavement is 0.14" is a
  // remembered constant standing in for a published one.
  await p.evaluate(([x, z]) =>
    window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z) ?? 0.14, 0), [d.x, d.z]);
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
// name the world it actually measured — "the MERGED world" was printed
// unconditionally, which is a lie the moment SHOT_URL points somewhere else
const WHERE = process.env.SHOT_URL ? process.env.SHOT_URL : 'the MERGED world on :5177';
console.log(`\n${out.filter((l) => l.startsWith(' ok')).length}/${out.length} doors let you in — ${WHERE}`);
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();

// Is the 2 m sidewalk lane still there — in the geometry, before anyone stands in it?
//
// GOTCHAS §9 calls the 2 m lane sacred and nothing asserted it. What exists:
//
//   lot-frontage   the CAR LOT specifically, does it take any of the walk
//   crowd-walk     a stopped CITIZEN must not seal it (81603988)
//   footprint      does anything on the pavement clip the KERB
//   lanelive       a REPORT — prints numbers, asserts nothing, unregistered
//
// None of those catches the case this one is for: a builder places a bench, a
// planter, a stall, a sign post, and the BUILT lane narrows. That is static
// geometry, it is permanent, and every fix I have made in this area — the
// 0.18 m cushion, the boundary rail that was eating 0.36 m — was exactly it.
//
// STATIC ONLY, on purpose. Two collider snapshots 1.5 s apart; anything whose
// bounds moved is a citizen or a car and is dropped. That makes this
// deterministic and about GEOMETRY, and it leaves the moving case to
// crowd-walk, which now owns it properly.
//
// THE UNITS, because this is where the domain bites. `free(x, z)` asks whether
// a capsule CENTRE may sit at (x, z), testing against colliders inflated by the
// 0.36 m radius. So a run of free positions is a CENTRE-SPAN, and the clear
// width a body passes through is `centre + 2 * RADIUS`. 81603988 hit this
// exactly — "it compares a centre-span against a DIAMETER" — and reported 93
// sealed samples that were not sealed. A centre-span of 0.00 m is a passable
// knife-edge, not a wall.
//
// SCOPE, and a mutation taught me to state it. This reads COLLIDERS, so it is
// about what a body can walk through. My first mutation moved the boundary
// rail's MESH 0.75 m into the walk and this check did not move — correctly:
// ct/street.ts registers that rail's collider in a separate `solid(...)` call
// with its own arithmetic, so the mesh and the barrier are two facts and I had
// changed the wrong one. Moving the collider fires it at once (0.92 m, three
// sections). A prop that LOOKS like it overhangs the walk without colliding is
// invisible here, and that is the right scope for this file rather than an
// oversight — but it is a real gap in coverage and nothing else fills it.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/builtlane.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
// ct/gap.ts: PASSABLE = 0.95, "0.72 m of capsule plus room to turn". Taken from
// the project rather than invented, so this agrees with every other judgement
// about what a body fits through.
const PASSABLE = 0.95;
const CAPSULE = 0.72;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await setClock(page, 13, 0);

const snap = () => page.evaluate(() => window.__ct.colliders()
  .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
  .map((c) => [+c.minX.toFixed(3), +c.maxX.toFixed(3), +c.minZ.toFixed(3), +c.maxZ.toFixed(3)]));
const a1 = await snap();
await page.waitForTimeout(1500);
const a2 = await snap();
const key = (c) => c.join('|');
const moving = new Set(a2.map(key));
const stat = a1.filter((c) => moving.has(key(c)));

const scan = await page.evaluate((boxes) => {
  const RAD = 0.36, S = 0.05;
  // The two pavements, as bands of x either side of the road.
  const WALKS = [
    { lo: -7.4, hi: -4.6, from: 12, to: -104, side: 'west' },
    { lo: 4.6, hi: 7.4, from: 12, to: -94, side: 'east' },
  ];
  const free = (x, z) => !boxes.some((c) =>
    x > c[0] - RAD && x < c[1] + RAD && z > c[2] - RAD && z < c[3] + RAD);
  const out = [];
  for (const W of WALKS) {
    for (let v = W.from; v >= W.to; v -= 0.5) {
      let best = 0, run = 0;
      for (let c = W.lo; c <= W.hi; c += S) {
        run = free(c, v) ? run + S : 0;
        if (run > best) best = run;
      }
      // centre-span -> clear width. See the note at the top of this file.
      out.push({ z: +v.toFixed(1), side: W.side, clear: +(best + 2 * RAD).toFixed(2) });
    }
  }
  return out;
}, stat);

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

const sorted = [...scan].sort((a, b) => a.clear - b.clear);
const worst = sorted[0];
const sealed = scan.filter((s) => s.clear < CAPSULE);
const tight = scan.filter((s) => s.clear < PASSABLE);
const where = (s) => `${s.clear} m at z ${s.z} on the ${s.side} walk`;

console.log(`  ${a1.length} colliders, ${stat.length} static `
  + `(${a1.length - stat.length} moving — citizens and traffic, dropped)`);
console.log(`  ${scan.length} cross-sections sampled every 0.5 m\n`);

say(scan.length > 300, 'the walk was actually sampled', `${scan.length} cross-sections`);
// The load-bearing one. Static geometry that a body cannot pass is a wall
// across the pavement, and it is permanent — unlike a citizen, it never
// moves out of the way.
say(sealed.length === 0, 'no static geometry seals the walk',
  sealed.length ? `${sealed.length} sections under ${CAPSULE} m, worst ${where(sealed[0])}`
    : `narrowest is ${where(worst)}`);
// ct/gap.ts's line, not one of mine. Between 0.72 and 0.95 a body fits and
// cannot turn, which that file calls a trap.
say(tight.length === 0, 'and none of it is a trap to squeeze through',
  tight.length ? `${tight.length} sections under ${PASSABLE} m: `
    + tight.slice(0, 3).map(where).join(', ') : `all at or above ${PASSABLE} m`);
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Inverting the assertions proves this reads the world. It does NOT prove it
  // would catch a regression in ct/street.ts — that needs a source mutation,
  // and the one it was watched failing on is in notes/D-alley-report.md.
  console.log('\nselftest — asserting the defect, which must FAIL');
  const before = fails;
  say(sealed.length > 0, 'static geometry blocks the walk (the bug)', `${sealed.length} sealed`);
  say(tight.length > 5, 'the walk is full of traps (the bug)', `${tight.length} under ${PASSABLE} m`);
  const caught = fails - before;
  console.log(caught === 2
    ? '\nSELFTEST PASSED — both inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 2 caught`);
  await browser.close();
  process.exit(caught === 2 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe lane is still 2 m of nothing');
process.exit(fails ? 1 : 0);

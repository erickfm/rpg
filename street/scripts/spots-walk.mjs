// Is EVERY [E] in the world reachable, and is it on the thing it names?
//
// The user, three times now: *"i think we have to make sure all press e to
// enter options are aligned with the doors on the facades."* The block has
// been re-cast repeatedly — the diner and the thrift moved slots, the church
// moved streets, BARBER and GROCERY became a park, and CAFE, HARDWARE,
// MERIDIAN and LAUNDRY stopped existing — and every hand-typed spot that
// pointed at one of those went stale silently.
//
// So this does not check the spots somebody remembered. It walks the whole
// registry and asks two things of each:
//
//   reachable — is there anywhere you can legally STAND inside its radius? A
//               trigger you cannot reach is a trigger that does not exist, and
//               it is invisible until a player goes looking for it. This is
//               GOTCHAS §8 asked of every spot at once.
//   grounded  — is it near anything at all? This catches a spot stranded in
//               genuinely open ground — mid-road, mid-park — and NOT MUCH ELSE.
//               I tried to make it catch "your building moved" by moving the
//               thrift's declaration onto the park frontage, and it passed:
//               the building line is continuous, so a spot that slides along
//               it still has something solid within 3 m. Worth knowing before
//               you trust it.
//
// What actually guarantees a spot is on ITS OWN door is the descriptor, not
// this: `ct/doors.ts` derives the [E] from the same number the painter draws
// with, so for the six declared rooms they cannot disagree. This sweep is the
// backstop for everything else, and the reachability half is the part that
// earns its keep — it names all four doors if they are pushed inside their
// walls, which is the bug I shipped in the inverted outward normal.
//
// A spot whose `ok()` is false right now (an interior's way-out while you are
// on the street) is REPORTED, not failed: it is gated, not broken.
import { chromium } from 'playwright';

const RADIUS = 0.36;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 15000 });
await p.waitForTimeout(300);

const spots = await p.evaluate(() => window.__ct.spots());
console.log(`${spots.length} [E] spots registered\n`);

const report = await p.evaluate(([spots, R]) => {
  const cols = window.__ct.colliders();
  const free = (x, z) => !cols.some((c) =>
    x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
  const out = [];
  for (const s of spots) {
    // somewhere legal to stand inside the radius?
    let stand = null;
    for (let ring = 0.05; ring <= s.r && !stand; ring += 0.08) {
      for (let i = 0; i < 24 && !stand; i++) {
        const a = (i / 24) * Math.PI * 2;
        const x = s.x + Math.cos(a) * ring, z = s.z + Math.sin(a) * ring;
        if (free(x, z)) stand = [+x.toFixed(2), +z.toFixed(2)];
      }
    }
    // anything solid within 3 m? A door spot stands off a wall; a spot left
    // behind by a demolished shop stands in open ground with nothing near it.
    const near = cols.some((c) =>
      s.x > c.minX - 3 && s.x < c.maxX + 3 && s.z > c.minZ - 3 && s.z < c.maxZ + 3);
    out.push({ ...s, stand, near });
  }
  return out;
}, [spots, RADIUS]);

const fails = [];
let checked = 0, gated = 0;
for (const s of report) {
  const tag = `"${s.label}" @ ${s.x.toFixed(2)},${s.z.toFixed(2)} r=${s.r}`;
  if (!s.stand) {
    // an interior spot you are not currently inside is gated, not unreachable
    if (!s.ok) { gated++; continue; }
    fails.push(`${tag} — UNREACHABLE: nowhere to stand inside its radius`);
    continue;
  }
  if (!s.near && s.ok) {
    fails.push(`${tag} — ORPHANED: nothing solid within 3 m, so it points at a building that is not there`);
    continue;
  }
  checked++;
}
console.log(`${checked} live spots checked: reachable, and attached to something within 3 m`);
console.log(`${gated} gated by ok() from where the player is standing — a seat you are not on,`);
console.log(`   or an interior's way-out while you are on the street. scripts/interiors-walk.mjs`);
console.log(`   enters every room and exercises those; this sweep is for the STREET side, which`);
console.log(`   is where a spot goes stale when its building moves or stops existing.`);
for (const f of fails) console.log(`  FAIL  ${f}`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

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
// WHICH WORLD THESE NUMBERS DESCRIBE: an EMPTY one. `__ct.colliders()` holds
// the built world and not the citizens or cars moving through it, so every
// reachability figure below is of a pavement with nobody on it. 6168c410 and
// a047183e made this distinction for the lane widths and it applies here
// unchanged — the built lane is 1.15 m and the lived median is 0.77 m.
//
// That is the right world for THIS question. A spot a pedestrian is briefly
// standing on is not a broken spot, and failing on one would make this a check
// people re-run until it goes green. A spot inside a WALL is broken, and walls
// do not move. But the number is not "can you always reach it", it is "is
// there anywhere to stand when nobody is in the way", and those differ.
//
//   reachable — is there anywhere you can legally STAND inside its radius? A
//               trigger you cannot reach is a trigger that does not exist, and
//               it is invisible until a player goes looking for it. This is
//               GOTCHAS §8 asked of every spot at once.
//   on its door — for a spot that names a building, is it standing where that
//               building's PUBLISHED door is? This ASKS `__ct.doors()` rather
//               than guessing, and that is the whole point of the change.
//
// It used to guess: "is there anything solid within 3 m", on the theory that a
// spot left behind by a demolished shop would stand in open air. That is nearly
// useless and I proved it on myself — I moved the thrift's declaration onto the
// park frontage to see the check fire, and it passed, because the building line
// is continuous so a spot sliding along it still has masonry within 3 m.
//
// notes/AUDIT-INSTRUMENTS.md states the rule this violated: "Every probe that
// tried to infer what a thing is from its shape has eventually been wrong…
// prefer a probe that asks over a probe that guesses." Every one of those was
// fixed by the world declaring something. Doors declare now, so this asks.
//
// A spot whose `ok()` is false right now (an interior's way-out while you are
// on the street) is REPORTED, not failed: it is gated, not broken.
// --selftest: wall one live spot shut in the LIVE collider array — the same
// array the movement code tests — and require this to go red. A check nobody
// has watched fail is worth what a tool nobody can run is worth, and this one
// has form: its previous incarnation asked "is anything solid within 3 m",
// which I tested by moving the thrift's declaration onto the park frontage and
// watched PASS. Had there been a selftest it would have been one command.
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const RADIUS = 0.36;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(300);

// Unknown flags are REFUSED, not ignored — a mistyped `--selftest` would
// otherwise run the ordinary suite and exit 0, reporting a selftest pass for
// a selftest that never ran (GOTCHAS 34 shape one).
const SELFTEST = flags(['--selftest']).selftest;

const spots = await p.evaluate(() => window.__ct.spots());
const doors = await p.evaluate(() => window.__ct.doors());
console.log(`${spots.length} [E] spots registered\n`);

if (SELFTEST) {
  // Bury the first live spot under a collider bigger than its own radius, so
  // there is nowhere legal to stand inside it. Deterministic: the first spot
  // the registry reports as live, whatever the world currently contains.
  const victim = spots.find((s) => s.ok);
  if (!victim) { console.log('selftest: no live spot to break'); await b.close(); process.exit(1); }
  await p.evaluate(([v]) => {
    window.__ct.colliders().push({
      minX: v.x - v.r - 1, maxX: v.x + v.r + 1,
      minZ: v.z - v.r - 1, maxZ: v.z + v.r + 1 });
  }, [victim]);
  console.log(`selftest: walled "${victim.label}" shut at ${victim.x.toFixed(2)},${victim.z.toFixed(2)}`
    + ' — this MUST now go red');
}

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
let checked = 0, gated = 0, onDoor = 0;
for (const s of report) {
  const tag = `"${s.label}" @ ${s.x.toFixed(2)},${s.z.toFixed(2)} r=${s.r}`;
  if (!s.stand) {
    // an interior spot you are not currently inside is gated, not unreachable
    if (!s.ok) { gated++; continue; }
    fails.push(`${tag} — UNREACHABLE: nowhere to stand inside its radius`);
    continue;
  }
  // A spot whose label names a declared building must stand on that
  // building's published door. Exact, and it cannot go stale: both sides come
  // from the same declaration.
  const named = doors.find((d) => s.label.toUpperCase().includes(d.building.split(' ')[0]));
  if (named && named.stand) {
    const off = Math.hypot(s.x - named.stand.x, s.z - named.stand.z);
    if (off > 0.05) {
      fails.push(`${tag} — NOT ON ITS DOOR: ${named.building}'s published door puts you at `
        + `${named.stand.x.toFixed(2)},${named.stand.z.toFixed(2)}, which is ${off.toFixed(2)} m away`);
      continue;
    }
    onDoor++;
  } else if (!s.near) {
    fails.push(`${tag} — STRANDED: nothing solid within 3 m and no declared building of that name`);
    continue;
  }
  checked++;
}
console.log(`${checked} live spots checked: reachable, and standing where they claim`);
console.log(`   of those, ${onDoor} name a declared building and sit exactly on its published door`);
console.log(`${gated} gated by ok() from where the player is standing — a seat you are not on,`);
console.log(`   or an interior's way-out while you are on the street. This sweep is for the`);
console.log(`   STREET side, which is where a spot goes stale when its building moves or`);
console.log(`   stops existing.`);
// This used to claim "interiors-walk enters every room and exercises those",
// which I wrote without checking. It is true and incomplete — seats-walk holds
// most of them, and civic-doors-walk and door301 hold four more. Rather than
// restate it and be wrong again, scripts/spot-coverage.mjs now PROVES it: every
// one of the 137 registered spots is claimed by a named check, and it goes red
// when one is not.
console.log(`   scripts/spot-coverage.mjs proves the other ${gated} are each walked by a`);
console.log(`   named check, rather than this script asserting it.`);
for (const f of fails) console.log(`  FAIL  ${f}`);
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 5).join('\n  '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

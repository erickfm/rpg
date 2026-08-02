// Is every [E] spot in the world exercised by SOME check?
//
// `scripts/spots-walk.mjs` walks the spots that are live from where the player
// spawns — 25 of 137 on a cold load — and says of the rest:
//
//   "scripts/interiors-walk.mjs enters every room and exercises those"
//
// I wrote that sentence and never checked it. It is true, and it is also
// incomplete: seats-walk covers the furniture, civic-doors-walk covers the two
// civic doors, and door301 covers room 301's. Four spots matched none of the
// checks I had in mind when I wrote it, and all four turned out to be guarded
// by something I had forgotten.
//
// That is a fine outcome and a bad way to find out. The recurring failure on
// this project is work that never reaches the world — five modules had shipped
// unreachable, and GOTCHAS 24 is about a check that vanished without going red.
// A spot registered by a module nobody walks is the same hazard: it exists in
// an array, no check touches it, and nothing says so.
//
// So this asks the opposite question from every other probe here. Not "does
// this spot work" — "is anybody ASKING whether this spot works".
//
// NOT a pass/fail on the world. An uncovered spot is a gap in the HARNESS, so
// this reports the label and the owning module's absence and exits non-zero,
// because a gap nobody is told about is how the last five got in.
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4185/';
// Unknown flags are REFUSED, not ignored — a mistyped `--selftest` would
// otherwise run the ordinary suite and exit 0, reporting a selftest pass for
// a selftest that never ran (GOTCHAS 34 shape one).
const SELFTEST = flags(['--selftest']).selftest;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);                                          // GOTCHAS 26

if (SELFTEST) console.log('selftest: injecting an unowned spot — this MUST now go red');

const found = await p.evaluate((inject) => {
  const spots = window.__ct.spots().slice();
  // ok:FALSE, and nowhere near anything. The first version injected it with
  // ok:true and the selftest passed — because `ok` is the spots-walk rule, so
  // the spot I invented to be unowned was immediately claimed. GOTCHAS 27: a
  // mutation that does not actually break the thing proves nothing and looks
  // exactly like a check that works. Second time I have done it in two days.
  if (inject) spots.push({ x: -300, z: -300, r: 1, label: 'a spot nobody walks', ok: false });
  const seats = window.__ct.seats();
  const rooms = window.__ct.roomDims();

  // The apartment declares itself on its meshes, so its extent is ASKED for
  // rather than remembered. The stamp is `walkup`, not `apartment` — I guessed
  // the module's name instead of reading it, the rule silently matched nothing,
  // and 301's two spots came back UNGUARDED when they are in fact walked by
  // door301. A guess that fails loudly is the good case; this one only failed
  // loudly because the orphan list named the spots it could not place.
  let a0 = Infinity, a1 = -Infinity;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    let mod = null;
    for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'walkup') return;   // ct/apartment.ts stamps 'walkup', not 'apartment'
    const e = o.matrixWorld.elements;
    // OFF-STREET ONLY. apartment.ts stamps whole top-level scene children
    // (`scene.children[i].traverse(...)`), so street meshes inherit the mark and
    // the raw extent came back x 6.9…203.7 — the whole world. That made this
    // rule claim everything from x 2.9 to 207.7, and a genuinely unguarded
    // STREET spot would have been reported as covered by door301: a coverage
    // check handing out false comfort, which is worse than not having one.
    // |x| > 100 is the kit's own off-street line (props.dimWorld uses it).
    if (Math.abs(e[12]) <= 100) return;
    a0 = Math.min(a0, e[12]); a1 = Math.max(a1, e[12]);
  });

  // Each rule names the check that actually exercises the spot. If you add a
  // check, add its rule; if you add a spot, one of these must claim it.
  const RULES = [
    ['spots-walk', (s) => s.ok],
    ['seats-walk', (s) => seats.some((t) =>
      Math.hypot(t.at.x - s.x, t.at.z - s.z) < 0.35 ||
      Math.hypot(t.pose.x - s.x, t.pose.z - s.z) < 0.35)],
    ['interiors-walk', (s) => rooms.some((rm) => Math.abs(s.x - rm.cx) < rm.w / 2 + 3)],
    // `doors of the` matches NO spot label — its only occurrence anywhere is a
    // comment in ct/int-bank.ts quoting the user, so this row attributed zero
    // spots to civic-doors-walk and the table reported the cheerful version of
    // the truth: nothing uncovered, because nothing counted (GOTCHAS §34).
    // civic-doors-walk climbs both civic flights and tries their doors; the
    // world publishes those two as `into ST BRIGID'S` and `into the PUBLIC
    // LIBRARY`. Matched on the BUILDING NAMES, which the roster owns, rather
    // than on a verb phrase belonging to whoever last worded the interaction.
    ['civic-doors-walk', (s) => /ST BRIGID|PUBLIC LIBRARY/i.test(s.label)],
    ['door301', (s) => a0 <= a1 && s.x >= a0 - 4 && s.x <= a1 + 4],
  ];

  const by = {}, orphans = [];
  for (const s of spots) {
    const hit = RULES.find(([, test]) => { try { return test(s); } catch { return false; } });
    if (hit) by[hit[0]] = (by[hit[0]] ?? 0) + 1;
    else orphans.push({ label: s.label, x: +s.x.toFixed(2), z: +s.z.toFixed(2), r: s.r });
  }
  return { total: spots.length, by, orphans, apt: a0 <= a1 ? [+a0.toFixed(1), +a1.toFixed(1)] : null };
}, SELFTEST);

// GOTCHAS 34, and this one would have been the most misleading of the three:
// with an empty registry it prints "every registered [E] spot is exercised by a
// named check", which is TRUE and useless — a coverage report is exactly the
// kind of check that reads as reassurance when it has counted nothing.
if (!found.total) {
  console.log('NO [E] SPOTS REGISTERED AT ALL — refusing to report full coverage of');
  console.log('an empty registry. That sentence would be true and would mean nothing.');
  await b.close(); process.exit(1);
}
console.log(`\n${found.total} [E] spots registered; which check exercises each:`);
for (const [name, n] of Object.entries(found.by)) console.log(`  ${String(n).padStart(4)}  ${name}`);
if (found.apt) console.log(`  (apartment found at x ${found.apt[0]}…${found.apt[1]} by userData.mod)`);

if (found.orphans.length) {
  console.log(`\nUNGUARDED — registered, and no check asks whether they work:`);
  for (const o of found.orphans) console.log(`  FAIL  "${o.label}" @ ${o.x},${o.z} r=${o.r}`);
  console.log('\nThis is a gap in the HARNESS, not proof the spot is broken. Either walk it');
  console.log('from an existing suite, or add a rule above naming the check that does.');
} else {
  console.log('\nevery registered [E] spot is exercised by a named check');
}
if (errs.length) console.log('\npage errors:\n  ' + errs.slice(0, 4).join('\n  '));
await b.close();
process.exit(found.orphans.length || errs.length ? 1 : 0);

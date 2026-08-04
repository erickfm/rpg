// Can a player still get into the casino from the side street?
//
// The casino's door is declared and once never arrived (mainline e6c08482, a
// circular-import namespace resolving undefined). The declaration feeds the door
// PAINTER and the frontage; the [E] trigger is a SEPARATE registration, so the
// two can disagree and the room becomes unreachable with nothing looking wrong.
//
// ── WHY THIS FILE WAS REWRITTEN (item 213) ──────────────────────────────────
//
// IT COULD NOT FAIL. It carried no assertion of any kind: it printed counts and
// exited 0 whatever it found. Run on build 88605f3ed it printed
//
//     SEVENS spots registered: 0
//     walking the side street x 46…58: 4 samples fired a prompt, 0 of them SEVENS
//
// — a clean statement that the casino has no door at all — and exited 0. That is
// the ninth check found in this state this week (after masonry.mjs measuring
// zero faces, texdensity and w5-shadow-census unregistered, the by-index trio,
// and doormatch12 comparing nothing).
//
// It was also matching `/SEVENS/i` against the [E] LABEL, which is user-facing
// copy the user renames: item 196 moved the casino to the Orpheus wing and the
// prompt now reads "into the ORPHEUS CASINO". Both faults were live at once —
// the check was looking for the wrong string AND was unable to say so.
//
// It now keys on the DoorDecl roster key `SEVENS`, an identifier rather than a
// display name (ct/int-casino.ts:131: renaming it "is a break dressed as a
// rename"), and reads the expected copy back from the world.
// See scripts/lib/entry-spot.mjs.
//
// ── AND WHY IT WAS TIGHTENED (item 223) ─────────────────────────────────────
//
// REGISTERED IN scripts/checks.mjs AT LAST. Item 213 turned this into a real
// check and nothing ran it for a day; being unregistered is the same disease as
// exiting 0 on `SEVENS spots registered: 0`, one level up. Its row carries BOTH
// mutation flags, which needed a new shape in the runner's selftest column.
//
// The band leg used to be a LOWER BOUND against the spot's own radius, because
// the constant the band is really made of — `TOUCH_MARGIN` — had no runtime
// path. `crosstown.ts` now publishes `__ct.touchMargin()`, so the bound is an
// equality: the exact set of sample points inside the aim-free disc, predicted
// from `r` and the margin, both read off the world. Watched red by hand with
// `touchMargin()` wired to REACH_MARGIN instead — it predicts 6 points against
// the 4 the world fires, which is the 3.11 m band the stale docstring implied.
//
// Usage:  SHOT_URL=http://localhost:4320/ node scripts/casinodoor.mjs [--selftest|--selftest-gone]
// Exit:   0 the door is declared, triggered, reachable over the predicted band, opens
//         1 one or more of those is false
//         2 the world could not be measured, or no assertion ran — never a pass
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { entrySpots } from './lib/entry-spot.mjs';

const BUILDING = 'SEVENS';          // the roster key, NOT the shopfront copy
// TWO mutation cases, because ONE CERTIFIES ONE LEG. `--selftest` walls the door
// and reddens only the E-press leg — the sampling sweep uses `warp`, which does
// no collision resolution, so a collider cannot reach legs 1-4. `--selftest-gone`
// is aimed at exactly those: it is the e6c08482 failure, the declaration not
// arriving, which is the bug this file was written for in the first place.
const F = flags(['--selftest', '--selftest-gone']);
const SELFTEST = F.selftest || F.selftestGone;
const URL = aim('http://localhost:4320/');
const WALK_Z = -97.3, X0 = 46, X1 = 58, STEP = 0.5;
const SAMPLES = Math.round((X1 - X0) / STEP) + 1;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);          // it was called with NO url and printed "measuring undefined"
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const results = [];
const check = (name, ok, detail) => { results.push([ok, name, detail]); };
const f2 = (n) => +n.toFixed(2);

// ── 0. the world answered at all ────────────────────────────────────────────
//
// POPULATION FLOOR, and the reason exit 2 is separate from exit 1: "I measured
// nothing" is not "the door is fine", and it is not "the door is broken"
// either. entrySpots() throws when __ct.doors() is empty.
let index;
try {
  index = await entrySpots(p);
} catch (e) {
  console.error(`CANNOT MEASURE: ${e.message}`);
  await b.close();
  process.exit(2);
}
console.log(`__ct.doors(): ${index.total} declared, ${index.resolved} with an [E] spot on them`);

// --selftest: wall the casino door shut from the street and require this to go
// red. The mutation is a collider pushed onto the LIVE __ct.colliders() over the
// door's OWN published stand point — the real array the movement code tests, at
// the real place a player walks to. Nothing else changes: the room is still
// built, the spot is still registered, the declaration is still there. Only the
// approach is gone, which is one of the two ways this door has actually broken.
// --selftest-gone: drop the casino out of __ct.doors(), which is precisely what
// mainline e6c08482 did — a circular-import namespace resolving undefined, so
// the declaration never reached the registry. The room stays built and the
// street stays walkable; only the world's own answer to "is there a door here"
// changes, which is the state this script exists to notice. Legs 1-4 must go red.
if (F.selftestGone) {
  const dropped = await p.evaluate((nm) => {
    const real = window.__ct.doors.bind(window.__ct);
    const before = real().length;
    window.__ct.doors = () => real().filter((q) => q.building !== nm);
    return { before, after: window.__ct.doors().length };
  }, BUILDING);
  if (dropped.before === dropped.after) {
    console.error(`selftest-gone: ${BUILDING} was not in doors() to begin with — NOTHING WAS MUTATED`);
    await b.close(); process.exit(2);
  }
  console.log(`selftest-gone: dropped ${BUILDING} from doors() (${dropped.before} -> ${dropped.after}) `
    + '— the declaration and trigger legs MUST now go red\n');
}
if (F.selftest) {
  const walled = await p.evaluate((nm) => {
    const d = window.__ct.doors().find((q) => q.building === nm);
    if (!d || !d.stand) return null;
    window.__ct.colliders().push({
      minX: d.stand.x - 2.2, maxX: d.stand.x + 2.2,
      minZ: d.stand.z - 2.2, maxZ: d.stand.z + 2.2,
    });
    return { x: d.stand.x, z: d.stand.z };
  }, BUILDING);
  if (!walled) {
    console.error(`selftest: no ${BUILDING} door to wall — NOTHING WAS MUTATED, so this proves nothing`);
    await b.close(); process.exit(2);
  }
  console.log(`selftest: walled the ${BUILDING} door shut at (${walled.x}, ${walled.z}) — the entry legs MUST now go red\n`);
}

// RE-INDEX AFTER THE MUTATION, or the selftest measures the world it took a
// copy of before breaking it. `index` above exists only for the exit-2 population
// floor; every assertion below reads THIS one. Caught by watching
// `--selftest-gone` stay green: legs 1 and 2 were reading the pre-mutation copy.
if (SELFTEST) {
  try { index = await entrySpots(p); }
  catch (e) { console.error(`CANNOT MEASURE after mutation: ${e.message}`); await b.close(); process.exit(2); }
}
const entry = index.byBuilding.get(BUILDING);

// ── 1. the door is declared ─────────────────────────────────────────────────
check('the casino publishes a door declaration',
  !!entry,
  entry ? `stand (${f2(entry.standX)}, ${f2(entry.standZ)})` : `no doors() entry for ${BUILDING}`);

// ── 2. …and an [E] trigger is registered ON it ──────────────────────────────
// This is the leg that catches e6c08482: declaration present, trigger missing.
check('an [E] spot is registered on that declared door',
  !!entry && entry.label != null,
  !entry ? 'no declaration to hang one on'
    : entry.label != null
      ? `"${entry.label}" at (${f2(entry.x)}, ${f2(entry.z)}), r ${entry.r}, ${entry.off.toFixed(3)} m off the declaration`
      : `nearest [E] spot is ${entry.off === Infinity ? 'nowhere' : entry.off.toFixed(2) + ' m'} away — no trigger on this door`);

const WANT = entry?.label ?? null;

// ── 3. sampling the side street, does the prompt come up, and over what band? ─
//
// Sampled rather than walked: "is the trigger there and is it usable" is this
// script's question, and the three walked approaches are interiors-walk's job.
// What this adds is the BAND — a trigger that fires over half a metre is
// registered and useless.
const out = await p.evaluate(async ([want, x0, x1, step, z]) => {
  const read = () => {
    const n = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const hits = [], mine = [];
  let n = 0;
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    n++;
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const s = read();
    if (s) { hits.push({ x: +x.toFixed(1), s }); if (want && s.includes(want)) mine.push(+x.toFixed(1)); }
  }
  return {
    hits, mine, sampled: n,
    reachMargin: window.__ct.reachMargin ? window.__ct.reachMargin() : null,
    // THE MARGIN THIS SWEEP IS ACTUALLY ON, published by item 223. Read, never
    // typed — and read as `null` rather than defaulted, so an old bundle that
    // does not publish it is a MEASUREMENT FAILURE below and not a silent 0.15.
    touchMargin: window.__ct.touchMargin ? window.__ct.touchMargin() : null,
    // item 309: the aim-free disc is `(r + TOUCH_MARGIN) * REACH_TRIM` now, so
    // the margin alone is no longer the whole predicate. Read as null on a
    // build that predates it, which the floor below turns into exit 2 rather
    // than into a wrong band.
    reachTrim: window.__ct.reachTrim ? window.__ct.reachTrim() : null,
  };
}, [WANT, X0, X1, STEP, WALK_Z]);

console.log(`\nsampling the side street x ${X0}…${X1} at ${STEP} m, z=${WALK_Z}: `
  + `${out.hits.length} of ${out.sampled} points fired some prompt, ${out.mine.length} of them the casino's`);
if (out.mine.length) console.log(`   the casino prompt is up from x ${out.mine[0]} … ${out.mine[out.mine.length - 1]}`);

// POPULATION FLOOR on the sweep itself. A sweep that took no samples has
// measured nothing, and every leg below it would then be vacuous.
check('the side-street sweep actually sampled the street',
  out.sampled === SAMPLES, `${out.sampled} sample points, expected ${SAMPLES}`);

check('the casino prompt comes up on the side street',
  out.mine.length > 0,
  out.mine.length ? `${out.mine.length} of ${out.sampled} sample points`
    : `0 of ${out.sampled} — nothing on the street said ${JSON.stringify(WANT)}`);

// HOW WIDE SHOULD THE BAND BE? DERIVED FROM THE SPOT ITSELF, NOT TYPED (§8).
//
// The sweep runs along a line `dz` from the spot's centre, so it crosses a
// CHORD, not the diameter: 2*sqrt(r² - dz²), divided by the step, less one for
// sampling phase. `r` is read from __ct.spots(). Nothing here is a second copy
// of anything.
//
// THIS IS A LOWER BOUND ON PURPOSE, and the first cut of it was WRONG in a way
// worth recording, because it is a live documentation bug in the world's own
// published API.
//
// I first wrote R = r + REACH_MARGIN, on the authority of crosstown.ts:1814,
// which states that "whether you are standing AT it is `d < r + REACH_MARGIN`"
// and publishes `__ct.reachMargin()` (0.6) so scripts stop hand-typing it. That
// predicts a 3.11 m chord and 5 hits. THE WORLD GIVES 4. The source says why:
// `fp.ts:977` is `const touching = d < s.r + TOUCH_MARGIN` with TOUCH_MARGIN =
// 0.15 (`fp.ts:764`) — the aim-free pass was cut to a quarter of the old slack
// when the user said *"i feel like i select stuff without even looking at it"*,
// and REACH_MARGIN now applies only when you ARE aimed at the spot. This sweep
// warps at yaw 0, facing away, so it is on the `touching` path. r + 0.15 = 1.20
// predicts a 2.13 m chord and exactly the 4 hits observed.
//
// So `__ct.reachMargin()`'s docstring described a predicate the world stopped
// using, and TOUCH_MARGIN — the one that actually governs an unaimed player —
// was exported from fp.ts and NOT published on `__ct`, so this file could only
// bound the band from below by the chord of the spot's OWN radius: a bound that
// needs no margin constant and therefore cannot over-claim. The note ended
// "tighten it to an equality once `__ct` publishes the touch margin".
//
// IT DOES NOW (item 223, `crosstown.ts` `touchMargin: () => TOUCH_MARGIN`), so
// the loose bound is gone and the two legs below are exact instead.
//
// WHY AN EQUALITY IS HONEST HERE AND NOT A GUESS. The sweep warps to yaw 0 at
// z -97.3 with the spot at z -96.75, i.e. the door is roughly BEHIND the walker,
// so `looked` cannot fire and `touching` is the only path in. `touching` is a
// disc of radius `r + TOUCH_MARGIN` about the spot, the sweep is a straight line
// `dz` from its centre, and the samples are a known grid — so exactly which
// sample points fall inside is arithmetic, not a threshold anybody chose. Both
// numbers come off the world: `r` from `__ct.spots()`, the margin from
// `__ct.touchMargin()`.
//
// THE MEASUREMENT FLOOR IS SEPARATE ON PURPOSE. A bundle that does not publish
// the margin cannot answer this, and "I could not measure" must not print as
// "the band is fine" — that is the vacuous-pass family this file was rewritten
// out of (GOTCHAS 79). It exits 2, not 1.
if (entry?.label != null && (out.touchMargin == null || out.reachTrim == null)) {
  console.error(`CANNOT MEASURE: touchMargin()=${out.touchMargin} reachTrim()=${out.reachTrim} — one of them is not published by this build.`);
  console.error('  The aim-free band cannot be predicted without it, and the old own-radius');
  console.error('  bound under-claimed by 0.45 m. Rebuild, or check you are on item 223.');
  await b.close();
  process.exit(2);
}
let wantBand = null, bandWhy = 'no spot to derive from';
if (entry?.label != null) {
  const dz = Math.abs(WALK_Z - entry.z);
  // ── AND THE TRIM, ITEM 309 ────────────────────────────────────────────
  // `(r + TOUCH_MARGIN) * REACH_TRIM`, the user's *"with the radius for all
  // these things a bit less"*. Without the factor this predicted 1.20 m where
  // the world now gives 0.96, which is the same class of error the long note
  // above is about — a check believing a published constant after the
  // predicate moved on. WATCHED: with the factor removed the equality leg
  // below goes red, predicting a wider band than the door fires over.
  const R = (entry.r + out.touchMargin) * out.reachTrim;
  const half = Math.sqrt(Math.max(0, R * R - dz * dz));
  // the sample grid this sweep actually walked, filtered by the touch disc
  wantBand = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = X0 + i * STEP;
    if (Math.abs(x - entry.x) < half) wantBand.push(+x.toFixed(1));
  }
  bandWhy = `(r ${entry.r} + touchMargin ${out.touchMargin}) * reachTrim ${out.reachTrim} = ${f2(R)}, dz ${f2(dz)}`
    + ` → touch chord ${f2(2 * half)} m → x ${wantBand.join(', ')}`;
}

// POPULATION FLOOR ON THE PREDICTION ITSELF. A geometry that predicts an empty
// band would make the equality below true by measuring nothing.
check('the touch disc predicts a band at all',
  wantBand != null && wantBand.length >= 2,
  wantBand == null ? bandWhy : `${wantBand.length} sample points predicted (${bandWhy})`);

check('…over exactly the band the touch disc predicts',
  wantBand != null && wantBand.length >= 2
    && out.mine.length === wantBand.length
    && out.mine.every((x, i) => Math.abs(x - wantBand[i]) < 1e-9),
  `fired at x [${out.mine.join(', ')}], predicted [${(wantBand ?? []).join(', ')}]`);

// AND NOTHING OUTSIDE IT. The leg above would also go red if the trigger got
// NARROWER; this one is the direction that matters to the user's own complaint
// — *"i feel like i select stuff without even looking at it"* — because a prompt
// firing outside the touch disc, with the door behind him, is that complaint
// coming back. It is a separate claim from "the count matches", so it is a
// separate row.
{
  const R = entry?.label != null ? (entry.r + out.touchMargin) * out.reachTrim : null;
  const strays = R == null ? [] : out.mine.filter((x) => Math.hypot(x - entry.x, WALK_Z - entry.z) >= R);
  check('…and never fires from outside the aim-free disc',
    R != null && strays.length === 0,
    R == null ? 'no spot to measure against'
      : `${strays.length} of ${out.mine.length} hits outside ${f2(R)} m${strays.length ? `: x ${strays.join(', ')}` : ''}`);
}

// ── 4. and it opens ─────────────────────────────────────────────────────────
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0.14, 0), [entry?.x ?? 51.29, WALK_Z]);
await p.waitForTimeout(260);
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
await p.waitForTimeout(400);
const inside = await p.evaluate(() => window.__ct.pos());
check('pressing E at the door puts you in the interior belt',
  inside[0] >= 400, `pos=${inside.slice(0, 3).map(f2)}`);

// a look at the facade, for a human to LOOK at (never to prove anything)
await p.evaluate(() => window.__ct.warp(51.3, -105, Math.PI, 0.14, 0.05));
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/casino-facade.png' });

console.log('');
for (const [ok, name, detail] of results) {
  console.log(`${ok ? ' ok  ' : 'FAIL '} ${name}`);
  console.log(`        ${detail}`);
}
const passed = results.filter(([ok]) => ok).length;
console.log(`\n${passed}/${results.length} passed`);
console.log('shot shots/casino-facade.png from (51.3, -105) facing the casino');
await b.close();

// A run that asserted NOTHING is a failure of this script, not a pass.
if (results.length === 0) { console.error('no assertions ran'); process.exit(2); }
if (SELFTEST) {
  // The selftest INVERTS: the walled door must have been caught, or the
  // mutation missed and "this check can fail" is still an unproven claim.
  // …and it names WHICH legs must be red, so a mutation that misses its target
  // cannot be laundered into a pass by some unrelated row happening to fail.
  const redNames = results.filter(([ok]) => !ok).map(([, n]) => n);
  const must = F.selftestGone
    ? ['an [E] spot is registered on that declared door', 'the casino prompt comes up on the side street']
    : ['pressing E at the door puts you in the interior belt'];
  const missed = must.filter((m) => !redNames.includes(m));
  console.log(missed.length === 0
    ? `SELFTEST PASSED — ${redNames.length} of ${results.length} legs went red, including all ${must.length} the mutation targets`
    : `SELFTEST FAILED — these targeted legs stayed GREEN: ${missed.join('; ')}`);
  process.exit(missed.length === 0 ? 0 : 1);
}
process.exit(passed === results.length ? 0 : 1);

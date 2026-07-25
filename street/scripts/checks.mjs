// Run every world check, and say plainly which ones can fail.
//
// Six checks existed and four had no npm entry: you could only run them if you
// had read the note that introduced them. A tool nobody knows how to run is
// worth about what a tool nobody has watched fail is worth.
//
//   npm run checks               # against $SHOT_URL, or the default preview
//   npm run checks -- --selftest # break each one on purpose, require it to fail
//   npm run checks -- --slow     # include the WALKING suites (minutes, not seconds)
//
// NOT A GATE. `npm run build` stays `tsc --noEmit && vite build`; the desk stood
// wiring down as a gate deliberately and that reasoning holds for all of these.
// This is one command instead of six remembered ones.
//
// Every check here reads SHOT_URL and calls reportWorld, so each one refuses if
// the server is serving the WRONG build — and the runner prints that as WRONG
// WORLD rather than as a failure, because they are not the same news.
//
// NO server is a third case and it used to print as the second. `page.goto`
// throws ERR_CONNECTION_REFUSED before any check reaches reportWorld, so a
// plain `npm run checks` with nothing on the port produced ~30 stack traces,
// ~30 `FAILED (1)` rows, and a footer reading "Something above is red" — which
// was true, and told you nothing. Measured: that is what the default port does
// on a machine where the preview is not up, which is every fresh checkout.
//
// So the URL is probed ONCE, first, and a dead port stops the run in a second
// instead of failing thirty checks slowly. Nothing about a check's verdict
// changes; this only alters what you are told when there was nothing to
// measure. "Could not measure" and "measured, and it is wrong" are different
// sentences and the second one is the expensive one to get wrong.
import { spawnSync } from 'node:child_process';

const SELFTEST = process.argv.includes('--selftest');
const SLOW = process.argv.includes('--slow');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

// Is anything actually there? One request, before thirty browsers start.
{
  let live = false, why = '';
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(4000) });
    live = r.ok;
    if (!r.ok) why = `HTTP ${r.status}`;
  } catch (e) { why = String(e.cause?.code ?? e.name ?? e.message); }
  if (!live) {
    console.error(`\nNOTHING IS SERVING ${URL}  (${why})\n`);
    console.error('  Every check below would have reported FAILED, and none of them');
    console.error('  would have measured anything. That is not the same as red.\n');
    console.error('  Start one:   npm run preview -- --port <yours>');
    console.error('  Or point at an existing one:   SHOT_URL=http://localhost:PORT/ npm run checks\n');
    process.exit(2);
  }
}

// what each one answers, in the order a reader would want it
const CHECKS = [
  ['check-wiring',     'is every module that was written actually built?', true],
  ['health',           'does the world initialise at all?',                false],
  ['check-seethrough', 'can you see the pavement through a shopfront?',    true],
  ['density',          'is every masonry face at the density it declares?', ['density']],
  ['nightgrade',       'does everything the dimmer touched actually dim?',  true],
  ['seampairs',        'do two faces that should draw the same brick?',     true],
  ['lotwalk',          'can a pedestrian enter the car lot, and only there?', true],
  ['lot-frontage',     'does the car lot take any of the 2 m walk?',        false],
  ['door301',          'does 301\'s door open, shut, block and refuse?',     true],
  // The user's own test, asked for on every building: stand inside, note which
  // side the door is on, walk out, turn round, confirm it swapped. It was
  // dev-server-only and knew three rooms; it checks all five declared ones now.
  ['mirror-walk',    "does each room's door swap sides when you walk out?", false],
  ['frontage-honours', 'did the facade paint the door the room declared?', true],
  ['burger-palette',  'has BURGER BARN gone back to mustard?',            true],
  ['tree-crown',      'can you read a window through a tree again?',      true],
  ['window-lattice',  'are the lit windows a lattice again?',             ['window-lattice']],
  ['shop-interior',   'is the shop glass a room, or a black hole?',       true],
  ['checks-registered','is every self-testing script actually registered?', false],
  ['doors-declared',   'does every declared DOOR reach declaredDoors()?',    true],
  ['lot-layout',       'aisle in, cars either side, office at the back?',    true],
  ['lot-kerb-seam',    'does the kerb cut line up with the lot gate?',       true],
  ['people-walk',      'is every figure drawn from the 8-angle atlas?',      false],
  ['entrance-brick',   'does the brick run through No. 227\'s entrance bay?', true],
  ['gotchas-numbers',  'are the GOTCHAS numbered uniquely and in order?',    true],
  // Slowest entry here by some way — it WALKS, so it costs what walking costs.
  // Kept because the things it covers cannot be asked any other way: whether a
  // wall stops you, whether a door prompts when you arrive rather than mid
  // stride, whether the church steps rise under your feet, whether the money
  // actually leaves the purse. Its --selftest inverts three known truths and
  // requires all three to fail.
  ['D-walk',           'can you still walk the world, and does it answer?',  true],
  ['windowlights',     'are the flats dark at noon and lit at nine?',        true],
  ['shells',           'is a building a building, or a stage flat?',         true],
  ['alleycheck',       'is the alley a room, or a gap between two boxes?',   true],
  ['builtlane',        'is the 2 m walk still 2 m of nothing?',              true],
  // ── the ground: kerb, litter, lamps, water ──────────────────────────────
  // Third field as a STRING (or a LIST of them) names cases in
  // scripts/canfail.mjs, which break the guarded thing in source, rebuild, and
  // require the check to go red. Fourth field is any arguments the check needs.
  //
  // These were the case this file's preamble describes: real checks with no npm
  // entry, runnable only by whoever had read the note that introduced them.
  //
  // footprint guards two separate promises and needs both mutations — the kerb
  // line litter must not straddle, and the strip of walk the tree pits must
  // leave at it. One case would have left the other silently unproven, which is
  // the failure this column exists to make visible.
  ['footprint',        'does anything on the pavement clip the kerb?',     ['footprint', 'footprint-pits', 'footprint-water']],
  ['trash',            'is the APPROVED litter set placed, seated, varied?', ['trash', 'trash-set'], ['probe']],
  ['glow',             'do the lamps glow AND light what is under them?',  ['glow', 'glow-pool'], ['probe']],
  ['park',             'is EVERY park lantern lit, and the loop walkable?', ['park', 'park-partial', 'park-walk']],
  ['wetness',          'are puddles darker than the road they sit in?',    'wetness',  ['probe']],
  ['basin',            'are BOTH catch basins real casting, sunk and proud?', ['basin', 'basin-west']],
  ['kerbcut',          'is there a curb cut, and is it at the lot?',       ['kerbcut', 'kerbcut-moved']],
  ['bus',              'is the bench framed, seated and sittable?',        ['bus-bench'], ['bench']],
  ['bus',              'does the east pavement run through the bus stop?', ['bus-walk'],  ['walk']],
  ['rain',             'does it rain, and does the street stay wet after?', ['rain', 'rain-memory']],
  ['grade-sane',       'does the grade ever make an impossible colour?',   ['grade-nan']],
  // Reads the registry and classifies it — seconds, not minutes, so it belongs
  // in the DEFAULT tier. It sat in the walking block for one commit, which was
  // wrong: it does not walk, and a check behind a flag nobody passes is the
  // thing this file exists to stop.
  ['spot-coverage',    'is every [E] spot exercised by SOME check?',       true],
  // ── the walking suites (5th field: SLOW) ────────────────────────────────
  //
  // These hold the player-facing mechanics — every room entered, every seat sat
  // on, every [E] reached, both civic flights climbed — and they cost what
  // walking costs. interiors-walk alone is ~10 minutes.
  //
  // SLOW is a runtime tier, not an importance tier. In the default run they
  // would make the one command nobody-runs-it slow, which is the failure this
  // file exists to fix; left out of the file entirely they stay six more tools
  // you can only run if you read the note that introduced them.
  //
  // Their selftests are the boolean kind — the mutation is a collider pushed
  // onto the LIVE `__ct.colliders()`, the same array the movement code tests,
  // so there is nothing to rebuild and no source to mutate.
  // ── the fleet and the crowd (H) ─────────────────────────────────────────
  //
  // Sixteen probes existed here and NONE had an entry, which is the exact fault
  // this file's preamble describes: runnable only by whoever read the note that
  // introduced them. Measured runtimes decide the tier below — nothing is
  // guessed. The four with a case name have that mutation in canfail.mjs; the
  // rest say `false` rather than carry a selftest that does not exist.
  ['carstate',         'do hood-up, jacked and blocked cars still build right?', ['carstate-bay', 'carstate-hood']],
  ['gaps',             'can a parked car trap the player, or eat an [E]?',   false],
  ['park-repro',       'is the parked arrangement the same on every load?',  'park-repro'],
  ['faces',            'does any face read as more than one tone?',          'faces-bands'],
  ['feet-check',       'does a profile foot point the way it walks?',         false],
  ['world-wired',      'is every module that exports a builder called?',    false, [], true],
  ['spots-walk',       'is every [E] reachable, and on the door it names?',  true, [], true],
  ['steps-walk',       'can both civic flights actually be climbed?',        true, [], true],
  ['civic-doors-walk', 'do the doors at the top of the flights answer?',     true, [], true],
  ['seats-walk',       'does every seat seat you — on ITSELF, not a neighbour?', true, [], true],
  ['interiors-walk',   'can you enter every room, and does each hold you in?', false, [], true],
  // H's walking and watching suites. These drive or watch in real time, so they
  // belong in the SLOW tier for the reason stated above — a runtime tier, not an
  // importance tier. Measured: crowd-walk 45 s, jitter 73 s, side-walk 77 s,
  // crowd-net 93 s, corner-traffic 141 s and up to ~7 min when it has to retry
  // (it discards any run the car spent yielding, because a held run says
  // nothing about the arc).
  ['corner-traffic',   'do cars actually turn the corner, and yield?',       false, [], true],
  ['crowd-net',        'do people route the block, cross only at crossings?', false, [], true],
  ['side-walk',        'are both side-street walks clear, doors reachable?',  false, [], true],
  ['jitter',           'does a walker flip-flop when it passes somebody?',    false, [], true],
  ['crowd-walk',       'do people yield to the player and keep the 2 m lane?', false, [], true],
];

// A PER-CHECK TIMEOUT AND A LINE AS EACH ONE STARTS.
//
// This printed nothing until every check had finished. That was fine at six and
// stopped being fine the moment other builders registered theirs (3dfe0217):
// the suite now runs long enough that a caller with a two-minute limit sees no
// output at all and cannot tell a slow check from a hung one. A runner that
// looks hung gets killed, and a killed suite reports nothing.
//
// 180 s each. Nothing here has ever taken more than ~40 s against a live
// preview, so a check past three minutes is stuck rather than thorough, and
// saying which one is stuck is the whole point.
const PER_CHECK_MS = 180_000;
// The walking suites break the assumption above — 180 s is right for a check
// that measures, and wrong for one that walks eight rooms in real time. They
// get their own ceiling rather than relaxing everyone else's, so "past three
// minutes is stuck rather than thorough" stays true where it was written.
const SLOW_MS = 1_500_000;
const rows = [];
for (const [name, question, selftest, extra = [], slow = false] of CHECKS) {
  if (slow && !SLOW) { rows.push([name, 'walks — use --slow', '—']); continue; }
  if (SELFTEST && !selftest) { rows.push([name, 'no selftest', '—']); continue; }
  process.stderr.write(`  … ${name}\n`);
  const t0 = Date.now();
  // A string names a case in scripts/canfail.mjs: the mutation lives there,
  // in source, rather than as a --selftest flag inside the check itself.
  if (SELFTEST && typeof selftest !== 'boolean') {
    const cases = Array.isArray(selftest) ? selftest : [selftest];
    // canfail takes them all in one run: it holds a per-file lock, so two
    // invocations would refuse each other rather than queue.
    const rc = spawnSync('node', ['scripts/canfail.mjs', ...cases],
      { env: { ...process.env, SHOT_URL: URL }, encoding: 'utf8', timeout: PER_CHECK_MS * cases.length });
    const csecs = ((Date.now() - t0) / 1000).toFixed(0);
    if (rc.error?.code === 'ETIMEDOUT' || rc.signal === 'SIGTERM') {
      rows.push([name, question, `TIMED OUT after ${csecs}s`, csecs]); process.exitCode = 1; continue;
    }
    rows.push([name, question, rc.status === 0 ? 'ok' : `FAILED (${rc.status})`, csecs]);
    if (rc.status !== 0) { process.exitCode = 1; console.log(`${rc.stdout ?? ''}${rc.stderr ?? ''}`.trimEnd() + '\n'); }
    continue;
  }
  const args = [`scripts/${name}.mjs`, ...extra, ...(SELFTEST ? ['--selftest'] : [])];
  const r = spawnSync('node', args, { env: { ...process.env, SHOT_URL: URL }, encoding: 'utf8', timeout: slow ? SLOW_MS : PER_CHECK_MS });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    rows.push([name, question, `TIMED OUT after ${secs}s`, secs]);
    process.exitCode = 1;
    continue;
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const wrongWorld = out.includes('MEASURING THE WRONG WORLD');
  rows.push([name, question, r.status === 0 ? 'ok' : wrongWorld ? 'WRONG WORLD' : `FAILED (${r.status})`, secs]);
  if (r.status !== 0) process.exitCode = 1;
  // On failure the detail matters more than the summary, so pass it through.
  if (r.status !== 0) console.log(out.trimEnd() + '\n');
}

const w = Math.max(...rows.map(([n]) => n.length));
console.log(SELFTEST ? '\nSELFTEST — each check was broken on purpose:' : `\nchecks against ${URL}:`);
for (const [name, question, status, secs] of rows)
  // a skipped row must say WHY, or "·" reads as "passed quietly" — which is
  // how six checks stayed invisible in the first place
  console.log(`  ${status === 'ok' ? '✓' : status === '—' ? '·' : '✗'} ${name.padEnd(w)}  ${status === 'ok' || status === '—' ? question : status}`
    + (secs && +secs >= 20 ? `   (${secs}s)` : ''));
if (process.exitCode) console.log('\nSomething above is red. It is not gating the build; it is telling you.');

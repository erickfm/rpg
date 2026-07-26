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
import { distSha, localHead } from './lib/which-world.mjs';

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

// IS THE BUILD ON DISK THE ONE CHECKED OUT? Second probe, same argument as the
// first, and it cost two twelve-minute runs to learn that the argument applies
// twice.
//
// A preview serves `dist/`. If dist was built from a different commit than
// HEAD, every check calls reportWorld, every one exits 3, and you get sixty-
// eight identical WRONG WORLD rows twelve minutes later. Measured, twice in one
// session: 68 of 68. Nothing was tested and nothing could have been.
//
// This worktree sits on a merge train that REBASES, so HEAD moves under a
// running suite without anyone touching a file — you do not have to do anything
// wrong to land here. Asking once, before any browser starts, turns twelve
// wasted minutes into one second and a sentence.
//
// Not fatal in integration mode: that world's stamp can never equal any one
// checkout, which is exactly what SHOT_WORLD=integration exists to say.
const headAtStart = localHead();
if (process.env.SHOT_WORLD !== 'integration') {
  const dist = distSha();
  if (dist && headAtStart && !dist.startsWith(headAtStart) && !headAtStart.startsWith(dist)) {
    console.error(`\ndist/ ON THIS DISK IS NOT THIS COMMIT.\n`);
    console.error(`  dist/ was built from  ${dist}`);
    console.error(`  this checkout is at   ${headAtStart}\n`);
    console.error('  A preview serves dist/, so every check below would exit 3 and report');
    console.error('  WRONG WORLD. That is not red — it is nothing measured at all.\n');
    console.error('  Fix: npm run build   (then re-run; restart the preview if it caches)\n');
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
  // SLOW TIER, moved 2026-07-25. lotwalk WALKS — 28 held-W samples — and costs
  // 36 s measured, against 1-2 s for every other check I own. Every other
  // suite in this file that actually walks is already slow: spots-walk,
  // steps-walk, civic-doors-walk, seats-walk, interiors-walk, side-walk,
  // crowd-walk. lotwalk was the lone exception, and this file's own rule is
  // that "SLOW is a runtime tier, not an importance tier".
  //
  // What leaves the default run is the WALKED proof that a pedestrian can get
  // into the lot. What stays is lot-layout, lot-kerb-seam and lot-clearance —
  // the lot's shape, its gate lining up with the kerb cut, and nothing
  // clipping — all 1-2 s. So the default run still fails if the lot is wrong;
  // it just stops paying 36 s to walk through the gate every time.
  ['lotwalk',          'can a pedestrian enter the car lot, and only there?', true, [], true],
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
  ['facade-run',      'does a facade\'s window run terminate on its wall?', true],
  ['shop-interior',   'is the shop glass a room, or a black hole?',       true],
  ['checks-registered','is every self-testing script actually registered?', false],
  ['doors-declared',   'does every declared DOOR reach declaredDoors()?',    true],
  ['lot-layout',       'aisle in, cars either side, office at the back?',    true],
  ['lot-kerb-seam',    'does the kerb cut line up with the lot gate?',       true],
  ['lot-clearance',    'do any cars clip each other or the furniture?',      true],
  // ── the lot's two twice-reported faults, guarded so they cannot come back ──
  // Both of these answer a complaint the user has now made twice, and both were
  // already correct in the world when I took them: the value here is entirely in
  // the guarding. (I)
  //
  // I-rows adds the clause nothing else asserts — that the two rows RAKE the
  // same way. Nose-out alone does not make a herringbone; two rows can each be
  // nose-out and still rake against each other, which reads as two lots meeting
  // in the middle. Its --selftest turns the south row 180 degrees in the live
  // scene, which is the reported bug exactly.
  ['I-rows',           'is every car in both rows nose-out and raked alike?', true],
  // I-clip covers what lot-clearance structurally cannot see: it compares only
  // things whose mod is 'lot' and drops any fixture based above 1.4 m, so a car
  // against the frontage (ce8837e12: a bay came within 1 cm of it after a merge
  // widened the fleet, found by hand) and a 1.85 m balloon through a banner are
  // both outside it. This takes each car as a full 3D oriented box against every
  // solid mesh in the world. It is additive — lot-clearance stays.
  ['I-clip',           'does any car clip ANYTHING, in any module, at any height?', true],
  // The generalisation of "the chairs are backwards": ANYTHING with a front
  // ends up backwards eventually, and the lot is full of fronts. Sits in every
  // seat for real and reads the camera's own yaw back, then marches each
  // readable sheet's own normal. Its --selftest has two halves because the two
  // fail independently — a wall dropped into a seated view, and a sign turned
  // to read into the office wall. (I)
  ['I-facing',         'does any seat or sign in the lot face a wall?',      true],
  // B's class: "a flat colour is not a material — an untextured quad has no
  // grain for the eye to attach to and no joints to give it scale, so it reads
  // as a TINT OVER the paving rather than as a piece of paving." Guards the
  // lot's side of it. Takes area from the QUAD, never the world box: the bay
  // stripes are 0.09 x 5.0 m planes raked 0.55 rad, and measured as axis-aligned
  // boxes each reads 11.59 m2 instead of 0.45. (I)
  ['I-flatground',     'is any ground surface in the lot flat colour?',      true],
  // "the garlands are disconnected". The lot's own file calls the bunting the
  // single most identifying thing about the typology, so it gets a guard. Two
  // clauses because there are two ways it reads as disconnected and they fail
  // apart: a GAP mid-run (a polyline whose pieces do not meet) and a FREE END
  // (a run tied to nothing). Endpoints come off each segment's world matrix,
  // never off the TIES table the source builds them from — reading that back
  // would only prove the table agrees with itself. (I)
  ['I-bunting',        'does the bunting chain, and is every end tied on?',  true],
  // The user, on a festoon mast I had put 0.2 m inside the aisle edge: "the
  // aisle a customer walks down and the sight line into the lot from the
  // entrance are the two things that must stay clear". None of my other checks
  // could see it -- I-clip asks about OVERLAP and the mast overlapped nothing,
  // lotwalk asks whether you can get in and you could, by walking round it.
  // Standing in someone's way is not a collision. (I)
  ['I-aisle-clear',    'does anything stand in the aisle or block the view down it?', true],
  // "the card is inside the mesh instead of on the glass" -- and the class the
  // user has now named twice: a buried sheet both clips AND is unidentifiable.
  // Every card was pinned at a constant local z while the greenhouse's front
  // face varies by kind, so on a van it sat 0.53 m inside the roof. Derived from
  // the car's own windscreen now, and this is the guard. (I)
  ['I-cards',          'is every price card ON the glass, or inside the car?', true],
  // Held OUT of this suite while it was red on B's surface -- C's rule, and it
  // was right: "reddening the shared suite over something I cannot fix would
  // hand the block my problem." B fixed it in 41547e84f, so it comes in now, as
  // a guard against the lot mouth going flat again. Measures the RENDERED frame
  // from two viewpoints, joints and grain separately, with known-good control
  // bands read from the same image. (I)
  ['I-apron-grain',    'does the ground at the lot mouth read as a material?', false],
  // C WROTE THIS AND HELD IT BACK ON PURPOSE: "mods-dim stays unregistered
  // until this lands: it is red on this finding, and reddening the shared suite
  // over something I cannot fix would hand the block my problem." The finding
  // was `isSelfLit` holding ~40 printed sheets at full daylight brightness, and
  // it has landed — the lot now reports 715 dim, 43 declared lights, 0 holding
  // without saying why. So the check comes in, as its author intended. (I)
  ['mods-dim',         'does everything in the lot and walk-up actually dim?', true],
  ['note-hashes',      'do my notes cite commits others can resolve?',       true, ['notes/C-*.md', 'notes/BLOCKED-C.md']],
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
  // The four things the user RULED on, guarded by value rather than by shape.
  // Registered because a ruling reverting quietly is not hypothetical: I shipped
  // the ATM fascia bottom at 0.68 against a stated 0.75 on my own reading of the
  // sentence it came in, and it took the user saying 0.75 a third time to settle
  // it. Nothing in this file would have noticed. If a future note legitimately
  // moves one of the four, this goes red and somebody updates it ON PURPOSE,
  // which is the behaviour I want. ~10 s. (D)
  ['D-rulings-hold',   "do the user's four rulings on the block still hold?", true],
  // H counted 74 of these where A counted 35 and my own first cut counted 73 —
  // three filters, three sets, none agreeing, all correct by their own lights.
  // The disagreement was never about measurement: "ground-facing" is not the
  // question, "can you stand on it" is. Registered because the row was closed
  // on the ANSWER (the street has no paving) and an unpublished predicate makes
  // that an argument rather than a recount — the desk's new policy, and this
  // row is the example it was written from. Goes red if the street ever grows a
  // real paving surface, which is exactly when the slabTex row is live again.
  // --selftest inverts all three verdicts and requires each to be caught. (D)
  ['D-paving-vs-trim',  'is anything the street calls ground actually paving?', true],
  // The user killed the selection outline as a player feature and kept it for
  // debug: "get rid of outline unless debug is true". Two claims that pull
  // opposite ways, so neither can be checked by looking. Counts lines wearing
  // SpotOutline's own 0xfff3c4 rather than reading a screenshot, which could not
  // tell a missing outline from a dark one. The DEFAULT is asserted before the
  // script touches the flag, because from the second station on "nothing is
  // drawn" would be true only because the script turned it off. (D)
  ['D-outline-debug-only', 'is the outline out of play and alive behind debug?', true],
  ['windowlights',     'are the flats dark at noon and lit at nine?',        true],
  ['shells',           'is a building a building, or a stage flat?',         true],
  ['alleycheck',       'is the alley a room, or a gap between two boxes?',   true],
  ['builtlane',        'is the 2 m walk still 2 m of nothing?',              true],
  ['midnight',         'is anything bright at midnight without saying why?',  true],
  // Two cases, not one, because the feature has two halves that fail
  // independently: `alleydish` removes the floor registration (you stride flat
  // over a visible bowl) and `alleydish-flat` flattens the mesh (you sink into
  // visibly level paving). It carries a --selftest too, but the source
  // mutations are the stronger evidence and this column prefers them.
  ['alleydish',        'does the alley floor you walk match the one you see?', ['alleydish', 'alleydish-flat']],
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
  ['footprint',        'does anything on the pavement clip the kerb?',     ['footprint', 'footprint-pits', 'footprint-water', 'footprint-blind', 'course-across']],
  ['trash',            'is the APPROVED litter set placed, seated, varied?', ['trash', 'trash-set'], ['probe']],
  ['glow',             'do the lamps glow AND light what is under them?',  ['glow', 'glow-pool', 'glow-blind', 'glow-buried'], ['probe']],
  ['park',             'is EVERY park lantern lit, and the loop walkable?', ['park', 'park-partial', 'park-walk', 'park-buried', 'park-sunk']],
  ['wetness',          'are puddles darker than the road they sit in?',    ['wetness', 'wet-blind'],  ['probe']],
  ['basin',            'are BOTH catch basins real casting, sunk and proud?', ['basin', 'basin-west']],
  ['kerbcut',          'is there a curb cut, and is it at the lot?',       ['kerbcut', 'kerbcut-moved']],
  ['bus',              'is the bench framed, seated and sittable?',        ['bus-bench'], ['bench']],
  ['bus',              'does the east pavement run through the bus stop?', ['bus-walk'],  ['walk']],
  ['rain',             'does it rain, and does the street stay wet after?', ['rain', 'rain-memory']],
  ['grade-sane',       'does the grade ever make an impossible colour?',   ['grade-nan', 'grade-twice']],
  // Reads the registry and classifies it — seconds, not minutes, so it belongs
  // in the DEFAULT tier. It sat in the walking block for one commit, which was
  // wrong: it does not walk, and a check behind a flag nobody passes is the
  // thing this file exists to stop.
  ['spot-coverage',    'is every [E] spot exercised by SOME check?',       true],
  // Reports the hanging signs, FAILS on furniture-height floats — see the note
  // at the foot of the script for why only half of it is a verdict.
  ['floaters-walk',    'is anything resting on nothing at furniture height?', false],
  // 20 s, so default tier. Guards "make the jump a tiny bit higher AND gravity a
  // tiny bit stronger" — a feel request, which is the kind most easily undone by
  // an unrelated edit to fp.ts because nothing about it looks like a constant.
  ['jump-walk',        'does the jump still clear what it was tuned to clear?', false],
  // RED ON ARRIVAL, and correctly so — it is reporting three real scripts.
  //
  // Eight scripts here dispatch on a mode word. Hand one a mode it does not
  // know (`--probe` for `probe`, the flag form most of this suite takes) and it
  // matches no branch, falls off the end of the file and exits 0 — a green row
  // for a check that ran nothing. I found it in five of my own and fixed them
  // with lib/modes.mjs; lamplight, parking and truck still do it and are not
  // mine to edit (OWNERSHIP: "do not edit another agent's script"). Routed in
  // notes/B-routed-to-others.md with the two-line fix.
  //
  // Third field is `false` because there is no mutation — and it does not need
  // one. canfail invokes every check with the SAME correct arguments checks.mjs
  // does, so it cannot reach this path at all. What proves this check can go
  // red is that it is red, right now, for three defects nobody planted.
  //
  // Discovery is a source grep, not a list: a new script with a mode word is
  // covered the day it is written, by an author who never read this comment.
  ['no-silent-pass',   'can any check pass by doing nothing?',             false],
  // ALSO RED ON ARRIVAL, for a defect nobody planted: 164 of the 610 commit
  // hashes cited in this repo cannot be resolved from mainline. 158 have a
  // landed twin carrying the same subject, so they are rebase-rewritten hashes
  // written down while the commit was still on a branch — the note keeps the
  // old one, the merge train keeps the new. It resolves fine in the worktree
  // that wrote it, which is why the author cannot catch it by checking.
  //
  // a67cfda46 found 21 of its author's 59 in that state and fixed them by hand.
  // This is that audit, repeatable, naming the replacement for each. Scope it
  // to your own notes rather than reading everybody's:
  //
  //     node scripts/hashes-resolve.mjs A-
  //
  // Deliberately NOT the obvious "every hash resolves": e35219f43 showed fpdiff
  // fingerprints are hash-shaped and were never commits, so that direction has
  // false alarms no regex removes. This asserts the direction that cannot — a
  // token which RESOLVES AS A COMMIT must be reachable. Costs no browser.
  ['hashes-resolve',   'can anyone else resolve the commits we cite?',     false],
  // Every canfail case still quotes source that EXISTS. Costs no browser and no
  // build — it reads canfail.mjs and greps the files it names.
  //
  // Registered because the failure it guards is one I caused: 23e12c691 split
  // the alley out of ct/street.ts, two mutation cases went on quoting street.ts,
  // and both matched nothing — "0/2 checks caught their mutation". canfail says
  // so plainly, but only while running all 40 cases with a build and a browser
  // apiece, which is far too slow to run after a refactor, so in practice the
  // cases sit guarding air until somebody runs the whole thing. canfail's own
  // note is the argument: "a mutation case is a hard-coded quotation of
  // somebody's source; it is the one kind of test that a REFACTOR breaks
  // silently and a bug never does." (D)
  ['mutations-quote-real-source', 'do the mutation cases still quote source that exists?', true],
  // The sibling of hashes-resolve, one axis over: every `file.ts:123` pointer we
  // write into a note or a comment still lands inside the file it names. Costs
  // no browser and no build.
  //
  // Same refactor, same class, and again mine: splitting street.ts left a
  // pointer at street.ts line 1602 in the auditor's CONFIRMED ledger row for a
  // user ruling, 600 lines past the end of the file. (Written "line 1602" and
  // not in citation form on purpose — this check reads its own registry, and a
  // dead example in the comment would make it red forever.)
  // GOTCHAS 36 killed dead COMMIT citations;
  // this is the other pointer we write constantly and nothing was watching. (D)
  ['citations-resolve', 'does every file:line citation land inside its file?',  true],
  // No import cycle anywhere under src/proto. Costs no browser and no build.
  //
  // GOTCHAS 28 is entirely about what a cycle costs here — a module can resolve
  // to an undefined namespace at collection time, a bundler orders modules
  // differently from the browser, and the fault is REAL IN THE BUILT OUTPUT and
  // absent in dev. Two agents disagreed for a day over 8 doors versus 7 because
  // of one. Nothing was watching for the CONDITION, only for its symptoms.
  //
  // Comments are stripped before the graph is built: my first two audits scanned
  // raw text, read a usage example in ct/weeds.ts as a self-import, and I filed
  // the phantom twice as "one pre-existing self-edge". (D)
  ['no-import-cycles', 'is any module in an import cycle? (GOTCHAS 28)',       true],
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
  // 5 s, and it ASSERTED WITHOUT AN EXIT CODE until now — 548a8807d's count of
  // 25 such scripts is what sent me looking. Registering it before the exit code
  // existed would have made the suite green on a red world.
  ['side-night',       'does the side street go dark, and catch its lamps?',  false],
  ['world-wired',      'is every module that exports a builder called?',    true, [], true],
  ['spots-walk',       'is every [E] reachable, and on the door it names?',  true, [], true],
  ['steps-walk',       'can both civic flights actually be climbed?',        true, [], true],
  ['civic-doors-walk', 'do the doors at the top of the flights answer?',     true, [], true],
  ['seats-walk',       'does every seat seat you — on ITSELF, not a neighbour?', true, [], true],
  ['interiors-walk',   'can you enter every room, and does each hold you in?', true, [], true],
  // 395 s — SLOW tier, and by a distance. It walks 177 trap positions, which is
  // what the user's "im literally stuck here" request cost to guard properly.
  // Asserted since it was written and registered nowhere until now, so those
  // 177 escapes have been proving themselves to nobody.
  ['unstick-walk',     'can the player still always get out of a trap?',      false, [], true],
  // G's two suites, 132 checks the runner has never seen. Both walk, so both are
  // SLOW by the rule above — a runtime tier, not an importance tier. Measured on
  // an idle dev server: G-vice-walk 47 s, G-rooms-walk 158 s. The second is the
  // reason neither can sit in the default tier at all: PER_CHECK_MS is 180 s, so
  // a loaded run would report it as TIMED OUT rather than as slow, which is the
  // one outcome worse than not running it. 47 s is slow-tier by this file's own
  // precedent — lotwalk moved there at 36 s (c68d718c2) and crowd-walk sits
  // there at 45 s.
  ['G-vice-walk',      'do SEVENS and HOTEL ORPHEUS light the street, and read right from both sides?', true, [], true],
  ['G-rooms-walk',     'can you enter all four rooms, and does each keeper look AT you?', true, [], true],
  // E's courtyard walk, registered by A after checks-registered caught it — it
  // had been sitting unregistered for the best part of an hour. Measured on an
  // idle preview: 77 s, so SLOW by the same rule as the rest of this block.
  // It walks the sacred 2 m lane, the courtyard mouth and the flight, which are
  // the three things GOTCHAS §1 and §9 say a screenshot cannot answer.
  // Seen flaking, which mainline's note does not record: across eight runs
  // here, seven were clean (19 PASS, "all walks passed") and ONE printed
  // "1 FAILED" — I did not capture which assertion before it scrolled and
  // could not reproduce it in seven attempts. Recorded rather than smoothed
  // over, so the first intermittent red is met with "seen once already"
  // rather than as a fresh regression. (D)
  // It was never UNRUN, only unrun by this file: it is the `courtyard` area of
  // scripts/E-verify.mjs, E's own six-area suite (8a7b44bcb). Registering it
  // here closes one sixth of that gap; churchyard, park, drape, onslope and
  // coplanar are still outside `npm run checks` and that is the desk's call.
  // And it is why checks-registered saw this one alone: that audit's
  // population is scripts carrying a --selftest, and E-walk is the ONLY one
  // of E's fourteen that has one — so the audit built to catch invisible
  // checks is itself blind to the other thirteen. (D)
  ['E-walk',           'is the library courtyard walkable, in and out and up the steps?', true, [], true],
  // The ONLY check that walks into a room in a BUILT BUNDLE. interiors-walk
  // above cannot: it imports a source path no bundle serves. Run the slow tier
  // with PINNED_MODE=preview and this is what covers the artefact.
  ['integration-doors', 'can you get into all eight rooms in the BUNDLE?',    false, [], true],
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
  ['crowd-walk',       'do people yield to the player and keep the 2 m lane?', 'crowd-lane', [], true],

  // ── A's TWO, from the facade work. Fast tier: both measure, neither walks. ──
  //
  // It was five for about ten minutes, and the other three are deleted. I
  // appended to the bottom of this table without reading the middle of it, and
  // every one of those three was already checked here, BETTER:
  //
  //   A-door-mirrors       -> mirror-walk, which WALKS the user's own test
  //                           (stand inside, go out, turn round) over all five
  //                           declared rooms. Mine compared geometry and needed
  //                           a hand-calibrated sign to do it.
  //   A-diner-door-aligns  -> frontage-honours, which checks every declared
  //                           door against what the painter drew. Mine was the
  //                           diner alone.
  //   A-shopfronts-backed  -> check-seethrough, which repaints every ground
  //                           surface magenta and looks for it through each
  //                           facade — an actual see-through test, where mine
  //                           only asserted that an opaque plane exists. Plus
  //                           shop-interior for "dark but never black".
  //
  // Two checks for one claim is the same defect this project keeps fixing one
  // layer down — the auditor's line is that the fault is not computing a thing
  // badly, it is two things computing it at all — and a suite that reports the
  // same fact twice is slower and no safer. The rule in GOTCHAS 24 about not
  // "improving" a script that is already there has an obvious corollary: check
  // whether the CLAIM is taken before you register a second answer to it.
  //
  // Not mine, and registered because checks-registered.mjs has been red on it:
  // globorder had a --selftest and was in NO tier, so it ran exactly never.
  //
  // Registering someone else's check is a coverage decision, so the asymmetry
  // matters and it is why this is here while D-walk's tier is not touched:
  // adding a check that currently never runs can only ADD coverage, whereas
  // moving D-walk to the slow tier would REMOVE its walked proof from the
  // default run. The first is mine to do; the second is the desk's.
  //
  // Measured before registering rather than assumed: it reads the BUILT bundle,
  // starts no browser, and takes 0 s. Its --selftest inverts three truths and
  // catches all three. And it guards a real, silent failure — a glob binding
  // declared after the literal that reads it, which is how SEVENS' door
  // stopped being collected (GOTCHAS 28).
  ['globorder',            'is any globbed module bound after the glob that reads it?',  true],

  // These survive because nothing else makes their claim:
  ['A-joinery-matches-fascia', 'do a shopfront\'s mouldings match the fascia they frame?', 'joinery-roster'],
  ['A-tree-canopy-opaque', 'can you see the wall through the middle of a tree?',         'tree-holes'],
  // Registered RED, deliberately, and it is the only red in here. The player
  // spawns in 301 and cannot use anything in it: the [E] sight ray is built
  // from a hardcoded eye at y 1.6 while the player's eye in that room is 7.02,
  // so it starts 5.4 m under the floor and the floor stops it. Not the arrival
  // latch — the probe walks 1.48 m clear of it first and comes back to stand
  // 0.23 m from a live spot with a reach of 1.35.
  //
  // A check that goes green the day it is written tells you nothing about the
  // day it was needed. This one is red now and turns green when crosstown.ts
  // builds the eye from the player's floor, which is why it asserts the SYMPTOM
  // — is the thing you are standing next to offered — rather than the eye
  // arithmetic it would otherwise keep failing on after the fix.
  ['A-eye-height-holds', 'can the player use anything in the room they spawn in?', false],
  ['A-diner-block-vs-sky', 'is the diner glass block darker than the sky, as glass is?', 'diner-block-glare'],
  // tree-crown above overlaps but does NOT cover this: it samples a box at the
  // crown's centre (x within +/-8 of centre, y 22..30), so it cannot see the
  // LOWER TUFTS at y 45-60 or a pocket sealed at the rim. Both are where the
  // holes actually were — 303 of them across 11 crowns, after the rim fix that
  // tree-crown was written to guard. This one floods from the border instead,
  // so "hole" is topology rather than a sampled box.

  // ── J's one, from the library entrance ──────────────────────────────────
  //
  // Fast tier: it measures and does not walk. 4 s against a live preview.
  //
  // The claim nothing else here makes: the library's INTERIOR doorway is the
  // 2.50 x 4.00 double door its facade paints, and the kit's flush single leaf
  // is not standing inside it. That second half is the one worth the entry —
  // `ct/int-library.ts` hides the kit's leaf by finding its 32x64 texture, and
  // if `ct/interior.ts` ever paints it any other size the hide silently misses
  // and the room gets BOTH doors in one opening. mirror-walk and
  // frontage-honours both stop at flat shopfronts and neither looks at a leaf.
  ['J-library-door', 'is the library\'s inside doorway the door its facade has?', true],
  // The library's LEVEL CHANGE, which the user named twice ("i want to be able
  // to walk up the stairs of the library", "i like the stairs, and the idea of
  // a balcony but they are inaccessible because of walls") and which nothing
  // asserted. scripts/libstair.mjs samples groundAt and prints a picture of the
  // climb — a good investigation, no exit code, no walking, in no tier.
  //
  // FAST tier despite walking, and measured before claiming it: 14 s on an idle
  // preview, against the 36 s that moved lotwalk to SLOW. It is four short
  // walks in one room, not a sweep of the world.
  //
  // It earned its entry on the first run: the old reading table's collider was
  // standing INSIDE the staircase, invisible from every camera in the room
  // because the deck's soffit hides it, and the only symptom was a player
  // climbing the west side stopping dead partway up.
  ['J-gallery-walk', 'can you climb to the library gallery, walk it, and get back down?', true],
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
  // Status first, banner second. reportWorld exits 3 for "that is not my build"
  // (BLOCKED-H), which is a status this runner can trust; the string match stays
  // as a fallback for any check that predates it or prints without exiting.
  const wrongWorld = r.status === 3 || out.includes('MEASURING THE WRONG WORLD');
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
// DID THE TREE MOVE WHILE WE WERE MEASURING? The probe above can only speak
// for the instant it ran. A suite takes twelve minutes and a rebase takes none,
// so HEAD can move halfway through — and when it does, the checks before the
// move measured one world and the checks after it measured nothing.
//
// Without this the two are indistinguishable in the summary: a run that was
// invalidated at minute six prints ticks for the first half and WRONG WORLD for
// the second, and reads as "some checks are broken". It is not that. It is a
// run that stopped being about anything, and it should say so in its own voice
// rather than leave the reader to notice the pattern.
const headAtEnd = localHead();
if (headAtStart && headAtEnd && headAtStart !== headAtEnd) {
  console.log(`\nTHE TREE MOVED UNDER THIS RUN: ${headAtStart} -> ${headAtEnd}`);
  console.log('  Everything after the move measured a stale dist/, so any WRONG WORLD');
  console.log('  above is the rebase, not the check. A green here is provisional.');
  console.log('  Re-run: npm run build && npm run checks');
}
if (process.exitCode) console.log('\nSomething above is red. It is not gating the build; it is telling you.');

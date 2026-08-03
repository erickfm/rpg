// Run every world check, and say plainly which ones can fail.
//
// Six checks existed and four had no npm entry: you could only run them if you
// had read the note that introduced them. A tool nobody knows how to run is
// worth about what a tool nobody has watched fail is worth.
//
//   npm run checks               # against $SHOT_URL, or the default preview
//   npm run checks -- --selftest # break each one on purpose, require it to fail
//   npm run checks -- --slow     # include the WALKING suites (minutes, not seconds)
//   npm run checks -- --only masonry --only texdensity   # just these rows
//
// `--only` exists because of what it costs NOT to have it, and item 161 is the
// bill. `--selftest` over the whole registry is 120-odd checks, most of them
// with a full `npm run build` and a browser per mutation — hours. So in practice
// nobody ran it, and a check whose selftest had been failing with exit 2 the
// entire time went unnoticed for as long as it did. A flag that turns "prove
// this one check can still go red" from an afternoon into four seconds is the
// difference between a selftest that is run and a selftest that is merely
// registered. It matches a row by exact name or substring, and it is a FILTER on
// what runs — never on what is reported as passing, so a filtered run still says
// plainly which rows it looked at.
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
import { aim } from './lib/aim.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { distSha, localHead } from './lib/which-world.mjs';
import { probeWithRecovery } from './lib/server-state.mjs';

const SELFTEST = process.argv.includes('--selftest');
const SLOW = process.argv.includes('--slow');
// `--only <name>`, repeatable. Read positionally rather than as `--only=x` for
// the same reason lib/modes.mjs exists: a spelling this does not recognise must
// not silently select nothing, so an unmatched name is refused below rather than
// producing an empty, green, entirely vacuous run (GOTCHAS 34).
const ONLY = process.argv.reduce((a, v, i, all) => (v === '--only' && all[i + 1] ? [...a, all[i + 1]] : a), []);
const URL = aim('http://localhost:4177/');

// Is anything actually there? One request, before thirty browsers start.
// Kept (not folded into the probe below) so a dead port still gets its own
// plain answer rather than being read as "not a bundle".
let bodyAtStart = null;
{
  let live = false, why = '';
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(4000) });
    live = r.ok;
    if (r.ok) bodyAtStart = await r.text();
    if (!r.ok) why = `HTTP ${r.status}`;
    // `cause.message` before `name`: a blocked port sets no `cause.code`, so
    // reading `name` next turned the one diagnosable failure into "TypeError".
  } catch (e) { why = String(e.cause?.code ?? e.cause?.message ?? e.name ?? e.message); }
  // A THIRD THING THIS CAN MEAN, and it is not "nothing is serving".
  //
  // `fetch` implements the WHATWG BAD PORTS list, and so does every browser —
  // so Playwright will refuse the same URL. A preview on one of those ports
  // answers `curl` with 200 and this probe with "fetch failed", and the run
  // then aborts saying the server is down while the server is plainly up. Cost
  // me twenty minutes on 4190 (ManageSieve); 4045, 4190, 6000 and 6666 are all
  // in the 4000-6999 range builders pick their ports from.
  //
  // Told apart rather than lumped in, for this file's usual reason: "start a
  // server" is useless advice to somebody who has one running.
  if (!live && why === 'bad port') {
    // `URL` the global is shadowed by this file's own `const URL` (the target
    // address), so the port comes off the string. Caught by watching this very
    // branch throw `URL is not a constructor` instead of printing.
    const port = (URL.match(/:(\d+)/) ?? [, '?'])[1];
    console.error(`\nPORT ${port} IS ON THE BROWSER'S BLOCKED-PORTS LIST.\n`);
    console.error(`  ${URL} may well be serving — curl will say 200 — but neither`);
    console.error('  fetch nor Chrome will ever open it, so no check here can measure it.\n');
    console.error('  Fix: restart your preview on another port and pass it through');
    console.error('  SHOT_URL. Avoid 4045, 4190, 6000, 6665-6669 in particular.\n');
    process.exit(2);
  }
  // A FOURTH THING, and it is the one item 182 was filed about.
  //
  // `vite preview` serves `dist/` as static files. `vite build` EMPTIES `dist/`
  // before it writes — so a preview whose process is perfectly healthy answers
  // **HTTP 404** for the window in which dist/ is gone, and answers it forever
  // if the build then failed and never refilled it.
  //
  // Measured on this tree, 2026-08-02, polling a live preview on 4230 flat out
  // through one `npm run build`
  // (`scripts/probes/w67-does-build-kill-preview.mjs`):
  //
  //     HTTP 200   5760 polls   0.03s .. 2.44s
  //     HTTP 404   1175 polls   0.67s .. 0.89s
  //
  // The port never stopped accepting connections. **A build does not kill the
  // preview — it blinds it for about 220 ms.** Reporting that as "nothing is
  // serving" sends a builder to start a server they already have running, which
  // is the same wrong-sentence problem as everything else in this pre-flight.
  if (!live && /^HTTP [45]/.test(why)) {
    console.error(`\n${URL} IS SERVING, BUT dist/ IS NOT THERE  (${why})\n`);
    console.error('  The preview process is alive — it accepted the connection. What it');
    console.error('  could not find is the page, because a preview serves dist/ and dist/');
    console.error('  is empty or mid-write.\n');
    console.error('  Almost always one of two things:');
    console.error('    · a `npm run build` is running RIGHT NOW against this same tree');
    console.error('      (it empties dist/ first — ~220 ms of 404s). Wait, re-run.');
    console.error('    · the last build FAILED after emptying dist/. Re-run: npm run build\n');
    console.error('  Do NOT start a second preview — the port is already taken by a live one.\n');
    process.exit(2);
  }
  if (!live) {
    console.error(`\nNOTHING IS SERVING ${URL}  (${why})\n`);
    console.error('  Every check below would have reported FAILED, and none of them');
    console.error('  would have measured anything. That is not the same as red.\n');
    console.error('  Start one:   npm run preview -- --port <yours>');
    console.error('  Or point at an existing one:   SHOT_URL=http://localhost:PORT/ npm run checks\n');
    process.exit(2);
  }
}

// IS THIS EVEN A BUNDLE? A preview serves `dist/`, whose entry script is a
// content-hashed asset (`/assets/index-xxxxxx.js`); a dev server hands back
// the raw source path (`/src/main.ts`) for anything, live off disk, and has
// no relationship to `dist/` at all. The `dist`-vs-`HEAD` probe below is only
// a real question for the first case — `scripts/canfail.mjs` already draws
// exactly this DEV/bundle line (`HASHED`/`servedEntry`) for the same reason,
// and BUILDER-BRIEF tells every builder to point `SHOT_URL` at their OWN dev
// server, which is the common case this guard used to get wrong.
//
// Measured, against a dev server with a stale `dist/` sitting on disk from an
// earlier commit: every one of the individual checks' own `reportWorld` reads
// the LIVE page's build stamp and passes correctly — the check-level guard
// was already dev-server-safe. Only THIS pre-flight probe was not: it exits 2
// before a single check runs, on a `dist/` mismatch that has nothing to do
// with what is actually being measured. `notes/archive/K-check-artefacts.md`
// separately found the "kills its own preview server" symptom does NOT
// reproduce from running checks (8/8 survived; the deaths it saw happened
// with no check running at all) — this pre-flight is a different, real bug
// that happens to share the row, not the same one.
const entryOf = (html) => (html?.match(/src="([^"?]+\.(?:js|ts|tsx))(?:\?[^"]*)?"/) ?? [])[1] ?? null;
const HASHED = (e) => !!e && /\/assets\/.*-[\w-]{6,}\.js$/.test(e);
const servingBundle = HASHED(entryOf(bodyAtStart));

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
// Not fatal in integration mode (that world's stamp can never equal any one
// checkout, which is exactly what SHOT_WORLD=integration exists to say) and
// not fatal against a dev server (see `servingBundle` above) — a dev server
// is never stale, so there is nothing here for this probe to catch.
const headAtStart = localHead();
if (process.env.SHOT_WORLD !== 'integration' && servingBundle) {
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
  // REGISTERED 2026-08-02 (w28, item 71). The only check here that touches no
  // browser at all — it diffs notes/LEDGER.md against add-stick-and-city98 and
  // fails if a row was lost, an evidence cell shrank, a contribution was dropped
  // or a conflict marker survived. LEDGER.md is what this project treats as its
  // record of what is done, and it was guarded by a check that ran never.
  //
  // Run by hand first, as item 71 required: 253 rows -> 253, intact, exit 0 in
  // 0.06 s. `--selftest` reports "DAMAGED: lost rows, shrunk evidence" and
  // exits 0 by its own inverted convention, so it can fail.
  //
  // It tolerates the ordinary case of a builder's branch being behind — cells
  // shorter than mainline in rows this branch never touched are reported as
  // "add-stick-and-city98 moving on", not as loss.
  ['ledger-intact',    'is notes/LEDGER.md intact against mainline?',       true],
  // WAS `false` — no selftest — and that is how it went months as the only one
  // of these 122 that could not go red at all. It printed `WORLD BROKEN` and
  // exited 0, so this row rendered `ok` for a dead world. The exit code is fixed
  // in scripts/health.mjs; the `health-dead` case in scripts/canfail.mjs is what
  // stops it silently reverting, by withholding `(window as any).__ct` in
  // src/proto/crosstown.ts and requiring this row to go red.
  ['health',           'does the world initialise at all?',                ['health-dead']],
  ['check-seethrough', 'can you see the pavement through a shopfront?',    true],
  ['density',          'is every masonry face at the density it declares?', ['density']],
  // REGISTERED 2026-08-02 (w28, item 71) after being run by hand first, which is
  // what that item asked for rather than registering three orphans reflexively.
  //
  // It is NOT a duplicate of `density` above, which was my first worry: its own
  // header says it is density.mjs's SUCCESSOR — "that fixes what broke
  // density.mjs: its filter was geometric, so foliage, ground decals and signage
  // sat in a net meant for walls" — and it asks a second question density cannot,
  // namely whether each stamp AGREES with the face it is mapped to. A stamp that
  // disagrees is worse than no stamp, because it looks like an answer.
  //
  // Measured on this world: 305 masonry stamps, 16 disagreements, all 16
  // explained by whole-texel canvas rounding, 0 faces actually authored wrong.
  // 2.9 s, and it does not walk, so it is default tier by this file's own rule.
  // `--selftest` breaks one stamp at RUNTIME and it goes red: "selftest: caught it".
  ['masonry',          'does each masonry stamp agree with the face it is on?', true, [], false,
    ['masonry-blind']],
  // REGISTERED 2026-08-02 (item 161), and it is the OTHER 84% of the world.
  //
  // `masonry` above judges the 303 faces carrying `userData.masonry`. Measured
  // on this build: the world has 4457 textured faces, so a pillar, a door, a
  // bench, a floor tile — anything that is not brick — had no density guard even
  // in principle. That is what BUILDER-BRIEF §7b's four fixed-by-hand defects
  // all were, and it is why the fifth reached the user by eye.
  //
  // It needs no declaration to judge one, which is the trick worth knowing: on a
  // correctly mapped face a TEXEL IS SQUARE, and ppmX and ppmY are derived
  // independently from the face's own two dimensions. A face whose two densities
  // disagree by 4x is drawing a stretched texture whatever it is and whoever
  // failed to declare it.
  //
  // RATCHETED, not thresholded. It lands on a backlog of 188 gross faces, so it
  // fails on a REGRESSION per owner against `notes/texdensity-baseline.json`
  // rather than on the backlog — a check that is red on day one and stays red is
  // noise, and one tuned until it is green is GOTCHAS 58. `--bless` is the only
  // way the baseline moves and it is a reviewable commit.
  //
  // FAST tier, measured not guessed: 3.0 s plain and 3.1 s selftesting against a
  // preview on this tree, against the 36 s that moved lotwalk to slow. Run by
  // hand first, as item 71's precedent requires: 305 stamps / 16 disagreements /
  // 0 authored wrong from `masonry`, and 4087 measurable faces / 0 stamped faces
  // drawing wrong / 188 gross / "no owner got worse" from this — the four
  // figures item 161 names as the baseline to preserve. Its `--selftest` gives
  // one square face a 5x repeat and requires THAT FACE by name in the gross
  // list, not merely a non-zero count, because the 188-deep backlog would
  // satisfy a count no matter what the mutation did.
  ['texdensity',       'is any textured face in the world drawing a stretched texture?', true],
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
  // ── FIRST FEDERAL's interior, added by M ────────────────────────────────
  //
  // SLOW TIER, and by this file's own rule rather than by preference: it WALKS —
  // three approaches to the doors, five stations against the teller line, the
  // vault, and the whole loan mechanic end to end — and costs ~90 s against the
  // 1-2 s every fast check here runs in. "SLOW is a runtime tier, not an
  // importance tier."
  //
  // 54 claims, and its `--selftest` reddens 8 of them: it removes the teller
  // line's collider by predicate, walls the vault throat, and — the one no
  // world-breaking mutation can reach — strips half the room's painted-face
  // DECLARATIONS, so the population floor has to catch a check that would
  // otherwise pass over a smaller set (GOTCHAS 34).
  //
  // IT WAS UNREGISTERED FOR SEVEN COMMITS, which is the whole reason this entry
  // has a comment: `checks-registered` could not see it. That guard matches the
  // literal `argv.includes('--selftest')`, and this script — like 34 others,
  // including `interiors-walk` and every `K-*` — declares its flag through the
  // shared `flags(['--selftest'])` helper. See `notes/M-selftest-blindspot.md`.
  ['M-bank-int-walk',  'can you enter the bank, use the vault, and get a loan?', true, [], true],
  ['checks-registered','is every self-testing script actually registered?', false],
  // The other half of the question above, and nothing was asking it: that guard
  // catches a selftest with no registry row (runs never), this one catches a
  // registry row with no selftest (runs always, never watched go red). The
  // second is the shape that let health.mjs print WORLD BROKEN and exit 0 for
  // months. Both are `false` here for the same reason — they read scripts/, not
  // the world, so there is nothing to mutate — and both say so in their own
  // EXEMPT list rather than staying quiet about it.
  ['checks-can-fail',  'does every registered check declare a way to go red?', false],
  ['doors-declared',   'does every declared DOOR reach declaredDoors()?',    true],
  // REGISTERED 2026-08-03 (item 223), and this row is the whole point of that
  // item: item 213 rebuilt casinodoor.mjs into a real check — 6 assertions, 3
  // population floors, two mutation cases watched red — and then NOTHING RAN IT.
  // Before 213 it printed `SEVENS spots registered: 0` (a clean statement that
  // the casino has no door at all) and exited 0; being unregistered on top of
  // that is the same disease one level up, and it is the disease
  // `checks-registered` exists to catch. It could not: that guard greps for the
  // literal `argv.includes('--selftest')` and this script declares its flags
  // through `lib/flags.mjs`, the blindspot `notes/M-selftest-blindspot.md`
  // records and `M-bank-int-walk` was lost to for seven commits.
  //
  // It asks what `doors-declared` above cannot. That one checks the roster; this
  // one walks the side street and asks whether the [E] actually fires over a
  // band a player can stop in, and whether pressing it puts you inside. The
  // casino's door has broken in exactly that gap before — mainline e6c08482, a
  // circular-import namespace resolving undefined, declaration painted, trigger
  // absent, nothing looking wrong.
  //
  // Run by hand first on this build: 8/8, ~5 s, 4 of 25 sample points fire
  // "into the ORPHEUS CASINO" over x 50.5…52 — exactly the four the aim-free
  // touch disc predicts. Under 20 s and it does not walk, so default tier by
  // this file's own rule.
  //
  // TWO FLAGS, NOT ONE — see the fourth-shape branch in the runner below. Both
  // measured: `--selftest` reddens 1 of 6 legs (the targeted E-press), and
  // `--selftest-gone` reddens 4 of 6 (both targeted legs plus two downstream).
  //
  // ON ONE LINE ON PURPOSE, AND THAT IS A BUG IN A GUARD, NOT A STYLE CHOICE.
  // `checks-can-fail.mjs:95` parses this registry with a per-LINE regex, so a
  // row whose selftest column wrapped onto a continuation line reads as an empty
  // column and is accused of having no way to go red. It already accuses
  // `w40-bed-vs-door` — which declares two canfail cases, on its second line —
  // and wrapping this row made it the second false accusation. Reported for a
  // follow-up row; until the parser is fixed, keep the column on line one.
  ['casinodoor',       'can you get into the casino from the side street?', ['--selftest', '--selftest-gone']],
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
  // REGISTERED 2026-08-02 (w64, item 186). I-flatground above guards the LOT's
  // side of B's class; this is the same question asked of the whole world,
  // indoors and out, and it has existed unregistered since item 0a. Grep for it
  // in this file before today and there were zero hits — we built the detector
  // for the class the user has now reported SIX times and never wired it in.
  // That is the third unregistered-or-blind check found this week, after
  // masonry.mjs measuring zero faces (GOTCHAS 79) and texdensity.mjs (item 161).
  //
  // RATCHETED, not zeroed: 65 meshes / 151 m2 today against B's original
  // 123 / 454, and the entry gate is "this must not go UP". A check demanding
  // zero on a historical backlog is one that gets weakened until it passes.
  // `--selftest` strips the map off the alley floor and both numbers rise.
  //
  // It also prints a second, UNGATED census (STEP) for the dark-ground variant
  // the user actually reported this time. That one is a diagnostic and the
  // script's header says at length why it could not be made into a check.
  ['w5-shadow-census',  'is any ground surface in the world still bare flat colour?', true],
  // …AND THE DARK VARIANT, which is the one he actually keeps photographing.
  //
  // The same script with `--shadetest`, registered separately because the two
  // gates need DIFFERENT mutations: BARE's strips the alley floor's map, and a
  // surface with no map has no mean, so it drops out of SHADE's population
  // altogether. `--shadetest` therefore suppresses BARE's mutation (see the
  // note at the top of that branch) and darkens-and-flattens the floor instead,
  // then asserts SHADE names that exact surface — not merely that a count moved
  // (GOTCHAS 79's second corollary).
  //
  // Item 211. SHADE is "darker than 0.45 of ground it touches AND carrying less
  // grain than it". The grain clause is what separates the road — approved,
  // and DARKER than the alley floor the user rejected, 39.4 against 43.2 — from
  // a painted shadow: the road carries 4.9x the sidewalk's structure and the
  // alley floor carried 0.69x. Two earlier predicates that could not do this
  // are written up in the script's header; do not re-try them.
  //
  // NOT A SECOND ROW, and the reason is worth knowing before anyone adds one.
  // The row above already gates SHADE — it is the same process and the same
  // exit code. What is NOT wired here is SHADE's own MUTATION: `--shadetest`
  // darkens and flattens the alley floor and requires SHADE to name that exact
  // surface, and it is proven (exit 1, "SHADETEST CAUGHT IT: street at
  // -10.3, -40.3, ratio 0.173, grain 0.07"). It cannot ride the row above,
  // because `--selftest` is appended to EVERY row (:1306) and BARE's mutation
  // strips the same floor's map — a surface with no map has no mean, so it
  // leaves SHADE's population and the shade assertion fails for the wrong
  // reason. And it cannot be its own row with `selftest: false`, because such a
  // row still runs NORMALLY, and a mutation that runs in a normal sweep is a
  // permanent false red. The right home is a `canfail` case (see the masonry /
  // masonry-blind pair below), which is not built. Until then run it by hand:
  //   SHOT_URL=… node scripts/w5-shadow-census.mjs --shadetest    # must exit 1
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
  // F moved "wheel arches read as arches" back from CONFIRMED because nothing
  // could decide it: the first check compared a world-space tyre top against a
  // car-local arch line, and the replacement fixed the frame but selected "any
  // cylinder of radius 0.18-0.42", which is also a diner bar stool. This decides
  // it by taking the population from the CAR rather than from a radius. (I)
  ['I-archcheck',      'does every tyre have bodywork over it, or is it bare?', true],
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
  // Four of my own CONFIRMED rows that the auditor's sweep found resting on
  // nothing — one on 17 characters, one on 52. They still hold; what they did
  // not have was anything that would go red if they stopped holding, which is
  // the whole complaint. Registered so the answer keeps being checked rather
  // than being true once. --selftest inverts all four. (D)
  ['D-old-rows-hold',   'do my four oldest CONFIRMED rows still hold?',        true],
  // I narrowed selection twice in one session on the user's "the selection
  // options are a bit to wide", and THIRTEEN of my own CONFIRMED rows rest on a
  // prompt firing. Narrowing what is offered is allowed to change the world; it
  // is not allowed to quietly falsify a row nobody looks at any more. Stands on
  // each door's PUBLISHED stand point — never one I choose — and on the ATM,
  // the bus stop and the flat door. (D)
  ['D-confirmed-prompts', 'do the prompts my CONFIRMED rows rest on still fire?', true],
  // A wired K's ATM to the bank wall in one line; the label went from
  // "check balance" to "use the machine" and THREE checks broke, none of them
  // A's — M's whole bank run crashed, and two of mine went red. The common
  // shape is a check reaching for a subject through somebody else's WORDING,
  // which belongs to whoever last wrote the interaction. This finds literals
  // tested against a label that no longer match anything the world says. (D)
  ['D-dead-prompt-literals', 'do checks still match wording the world still uses?', true],
  // LEDGER.md is what the desk reads before telling the user something is
  // finished, and it has been losing content in conflict resolution — eleven
  // rows in one sweep, K's LANDED move, five verifier notes of mine. Most of
  // that is undetectable: nothing can notice prose that is no longer there. But
  // a lost STATUS leaves a fingerprint, because the status cell and the evidence
  // cell are written at different times by different people, so a row reading
  // OPEN over "AUDITOR CONFIRMED" has been rolled back. Held back until it was
  // green (C's mods-dim rule) — the two rows it found are settled. (D)
  ['D-ledger-status-vs-evidence', 'does every row\'s status agree with its evidence?', true],
  // SIX verifier notes of mine have been added, committed, and later silently
  // removed by ledger conflict resolutions — the jail row twice. Re-attaching by
  // hand each time is a chore that hides the frequency; this makes the loss go
  // red. Two of the eight are CORRECTIONS rather than corroboration, which is
  // why it is worth a tier: losing corroboration costs a re-walk, losing a
  // correction leaves a false claim standing under a status nobody re-reads. (D)
  ['D-my-evidence-intact', 'is the evidence D published still on its rows?',      true],
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
  // REGISTERED 2026-08-03 (item 225). The guard over item 219, which was a prop
  // pushing itself out of its own side panels — the litter tag sat on the GROUP
  // while `dimWorld`'s obstacle test read the NODE, so a milk crate found its own
  // four uprights and shoved itself clear, toward the road, which is how a crate
  // walked into the user's thrift-shop doorway.
  //
  // THE TWO ROWS ABOVE WOULD NOT HAVE CAUGHT IT AND WERE RIGHT NOT TO. The crate
  // was pushed OUT into clear pavement: `footprint` asks whether anything clips
  // the kerb or sits inside a building and the answer was correctly no; `trash`
  // asks whether the approved SET is placed and it was. Nothing anywhere asserted
  // that a prop LANDS WHERE IT WAS PUT DOWN, so the repair was one careless edit
  // from reverting in silence.
  //
  // Run by hand first: 5/5 in 1.6 s, no browser walking, so default tier. 14
  // dropped props, 3 of them able to push themselves (the crates — flat litter
  // never clears dimWorld's 0.25 m solid gate, which is why crates alone
  // suffered), and 3 movers matching a recorded displacement baseline.
  //
  // BOTH KINDS OF PROOF, and they fail apart, which is the `masonry`/
  // `masonry-blind` argument again. Its own `--selftest` displaces a crate at
  // RUNTIME and proves the verdict can go red. The `litter-self-push` canfail
  // case puts item 219 back in SOURCE — one `up === o &&` — rebuilds, and proves
  // the check catches the actual bug rather than a symptom somebody planted.
  ['prop-landing',     'does every dropped prop stand where it was put down?', true, [], false,
    ['litter-self-push']],
  ['glow',             'do the lamps glow AND light what is under them?',  ['glow', 'glow-pool', 'glow-blind', 'glow-buried'], ['probe']],
  ['park',             'is EVERY park lantern lit, and the loop walkable?', ['park', 'park-partial', 'park-walk', 'park-buried', 'park-sunk']],
  // REGISTERED 2026-08-03 (item 170). The user asked twice and the second time
  // in the PLURAL — *"bench is a lil too close to the path"* then *"benches need
  // space away from the path"* — so nudging the one he photographed is exactly
  // what earned the second report. This is the rule he was owed: every bench
  // derives its offset from one named constant, and this fails if a future bench
  // crowds the path.
  //
  // Measured before the fix, EVERY bench in the park OVERHUNG the circuit — the
  // two z legs by 0.04 m and the two x legs by 0.16 m, from two different
  // hand-typed offsets neither of which was named. After, all eight stand at
  // 0.51 m: RADIUS + TOUCH_MARGIN, both read off `__ct` rather than typed, so
  // re-tuning the player moves the world and this check together and neither can
  // drift into agreeing with itself.
  //
  // 2 s, no walking, so default tier. `--selftest` puts one bench back where the
  // item found it — 0.04 m INTO the path, the SMALLER of the two real defects,
  // so the mutation is the hard case — and requires the clearance leg to go red.
  ['bench-clearance',  'does every park bench stand clear of the path?',    true],
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
  // THE ONLY PROOF THE CLIMBING ROUTE WORKS, AND IT WAS REGISTERED NOWHERE.
  // *"we should be able to jump on the cars"* — the pickup's four tiers and the
  // sedan's are the answer, and every hop on both is within ~20-50 mm of the
  // engine's reach at main.ts's dt clamp. That is thin enough that an unrelated
  // edit to `vy`, gravity, `TOP_EPS` or `RADIUS` moves it, and nothing looks
  // like a constant when it does. It walks the whole route rather than warping
  // (a check that warped instead of walking is how the storey picker went its
  // whole life untested), so it is slow — hence the slow tier.
  ['w21-roof-climb',   'can you still climb onto the pickup, and get back off it?', 'roof-unreachable', [], true],
  // THE FIFTH FACING BUG, and the first thing to guard the class rather than one
  // instance of it. Five have shipped from a typed or mirrored yaw — the burger
  // barn guy, the librarian, the casino sitter, the park benches, the tax office
  // waiting row — and each was fixed one at a time by somebody looking at it.
  // This one went red on 105 seats the day it was written: 96 casino slot stools
  // sat you with your back 0.37 m from the machines you had just pressed [E] to
  // play, next to NPCs already facing the right way.
  //
  // IT WAS A ONE-OFF NO SUITE RAN. That is the whole reason for this row: the
  // sixth would have shipped exactly like the first five. It reads `__ct.seats()`
  // rather than a list, so a seat registered by a builder who has not been
  // written yet is covered the day it lands.
  //
  // Fast tier, measured not guessed: 4.4 s against an idle dev server, against
  // the 36 s that moved lotwalk to slow. It measures and does not walk — I-facing
  // makes the same claim for the lot alone and sits in the fast tier too.
  //
  // TWO CASES, because the check has two rules and they fail apart (the
  // `footprint` precedent above): `seat-facing` mirrors the casino stools back to
  // the historical bug verbatim — rule B, turned away from your own furniture,
  // which is the class a wall test structurally cannot see because a backwards
  // stool in a big room faces open floor — and `seat-facing-wall` turns the tax
  // office waiting row into the plaster 0.58 m behind it, which is rule A. One
  // case would have left the other silently unproven.
  //
  // NO --selftest, and that is deliberate rather than missing: both mutations
  // have to move the WORLD's yaws, and the only handle a harness has on
  // `__ct.seats()` would break the check's view while leaving the world intact,
  // which GOTCHAS 34 says proves nothing. Source mutations are the honest form.
  ['seat-facing',      'does every seat look at something, or at a wall?',   ['seat-facing', 'seat-facing-wall']],
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
  // The sibling of no-silent-pass, one axis over: that one asks whether a check
  // can pass without running, this asks whether it can run against the WRONG
  // WORLD without saying so. 648 scripts here fell back to a hardcoded port, on
  // 21 different ports, and on a machine with nine builders every one of those
  // ports belongs to somebody else — measured 2026-08-02, all twenty of
  // 4180-4199 listening, `jump-walk`'s default of 4185 serving another builder's
  // tree all session.
  //
  // Registered because the 649th is the problem, not the 648. That line is the
  // obvious one to type, it is in every neighbouring file's history, and it
  // fails silently by construction — a wrong-port run looks exactly like a right
  // one. canfail.mjs's header spends thirty lines on two rounds lost to it.
  //
  // Costs no browser and no build. Its --selftest plants all four spellings of
  // the bare form and requires each to be caught, plus three shapes of the FIX
  // that must not be — the detector is one regex, which is the part of it most
  // likely to stop matching quietly.
  ['aimed',            'can any instrument measure a default port in silence?', true],
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
  // And the other half of the same tool: does canfail REFUSE a selection it
  // cannot honour? Costs no browser and one ~0.7 s build.
  //
  // The row above reads canfail's CASES table. A bad argument never reaches the
  // table, so it cannot see the failure worker seventyeight found — `node
  // scripts/canfail.mjs crowd` selecting zero cases and printing "0/0 checks
  // caught their mutation", exit 0, in the one tool whose job is catching
  // vacuous passes. That was fixed as item 224 and the fix was UNGUARDED;
  // seventynine filed exactly that, and this is the row it asked for.
  //
  // It also guards item 229's needle pre-flight, which refuses a case whose
  // quotation has rotted. Four had, for weeks. (eightyfour)
  // Its --selftest blinds a COPY of canfail.mjs with BOTH front-door refusals
  // removed and requires its own legs to go red — 9 of them do, measured.
  // `checks-can-fail.mjs` caught this row registered with no failing path at
  // all, which is exactly the debt that check exists to collect.
  ['canfail-args', 'does canfail refuse a selection it cannot honour?', true],
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
  // REGISTERED 2026-08-02 (w28, item 71), here with the other car checks. It
  // asks whether any mesh sticks out past the silhouette of tyre and body at
  // wheel height — the wheel-arch flare that was removed and could be
  // re-attached by an edit to ct/cars.ts without anything else noticing.
  //
  // Run by hand first: 23 cars, 0 offenders, 1.0 s, and it does not walk.
  // `--selftest` re-attaches a flare and it is caught — "SELFTEST PASSED — the
  // re-attached flare was caught" — naming the offending BoxGeometry at
  // half-width 1.64 against a body of 0.90.
  ['H-flare-silhouette', 'does any car mesh stick out past tyre and body?',  true],
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
  // REGISTERED 2026-08-02 (w40, item 85). `pickSpot` has now been swung by two
  // OPPOSITE user complaints — *"i dont want to be so far from the bed and the
  // option is still to sit on the bed and watch tv"* and *"i dont want sit on
  // bed and watch tv to be the main option if im facing the door to leave"* —
  // and either is satisfiable by reintroducing the other. This walks flat 301
  // and pins both ends plus the band between them, so the next swing is caught
  // rather than shipped and reported. Two canfail cases, one per end: a single
  // one would certify half a guard.
  ['w40-bed-vs-door',  'does aim beat proximity in 301 — at BOTH ends of the knob?',
    ['w40-near-outright', 'w40-looked-dominant'], [], true],
  // The complement of seats-walk: that one asks whether a seat SEATS you, this
  // asks whether you can get OUT of it, which is the half the user reported —
  // "pressing e doesnt get me out of it". It approaches each seat from a pace
  // behind its own published `at`, because the fault only ever appeared when
  // sitting TELEPORTED the player, and a probe that warps onto the pose cannot
  // see it — which is why three verifiers reported it would not reproduce.
  // HELD BACK UNTIL NOW, red the whole time: 18 of 24 seats trapped the player
  // before F's e090a74fa, then 3 of 30 (all slot stools) until K's 9017f4318.
  // C's rule is register it the day it goes green, and it is green — 24 released
  // by E, 3 by Escape, 0 trapped. ~6 min for 32 seats, so SLOW. (I)
  ['I-seat-exit',      'can you get out of every seat you sit in?',           ['seat-traps', 'seat-nosit'], [], true],
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
  ['integration-doors', 'can you get into all eight rooms in the BUNDLE?',    ['door-standoff'], [], true],
  // H's walking and watching suites. These drive or watch in real time, so they
  // belong in the SLOW tier for the reason stated above — a runtime tier, not an
  // importance tier. Measured: crowd-walk 45 s, jitter 73 s, side-walk 77 s,
  // crowd-net 93 s, corner-traffic 141 s and up to ~7 min when it has to retry
  // (it discards any run the car spent yielding, because a held run says
  // nothing about the arc).
  ['corner-traffic',   'do cars actually turn the corner, and yield?',       'corner-lean-into', [], true],
  ['crowd-net',        'do people route the block, cross only at crossings?', 'crowd-net-inroad', [], true],
  ['side-walk',        'are both side-street walks clear, doors reachable?',  'sidewalk-sealed', [], true],
  ['jitter',           'does a walker flip-flop when it passes somebody?',    ['jitter-reversals'], [], true],
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
  // WAS `false` — no declared failing path, one of the 23 the item-70 inventory
  // found running on every suite with nothing ever having watched them go red.
  // The `eye-gate-flat` case restores the original bug (the sight gate aiming
  // from a bare 1.6 instead of the floor the player stands on) and this row is
  // required to go red. Item 72.
  ['A-eye-height-holds', 'can the player use anything in the room they spawn in?', ['eye-gate-flat']],
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
  // The three library claims that had NO automated predicate, written after the
  // auditor's sweep of 28 CONFIRMED rows resting on nothing. Fast tier, 6 s.
  // Four of its five verdicts have a mutation I watched go red; the facing one
  // does not and the script says so rather than faking one.
  ['J-library-room', 'is the partition still gone, the librarian behind her desk, the computers lit?', true],
  // The library's readers are built with `citizenSprite` directly, because the
  // kit places at the FLOOR and a sitter belongs at the seat top — so they do
  // not get `room.person`'s `userData.citizen` tag unless the room sets it.
  // They did not, and for a while three 8-angle citizens sat in that room
  // tagged as nothing. THAT FAILS SILENT IN THE WORST DIRECTION: a world sweep
  // asking "does every figure turn?" does not see them, finds nothing to
  // complain about, and prints GREEN. Registered because no camera and no
  // other check in this file could have caught it.
  ['J-library-people', 'are the library\'s figures visible as people, and the seated ones on their seats?', true],
  // The pockets. Registered in the same commit as the feature, per GOTCHAS §27,
  // and it guards the one rule of `ct/inventory.ts` that a picture cannot check:
  // TAKING SOMETHING CHANGES THE WORLD. A pickup that leaves the object standing
  // where it was looks identical from every camera to one that works — you
  // simply have two newspapers — so the mutation is exactly that, the taken
  // piece forced back to visible while it is in your pocket, and the check has
  // been watched going red on it. ~6 s, no walking; it warps to the [E] the
  // world reports rather than to a coordinate this file remembers. (K)
  ['K-pocket-loop', 'can you take a newspaper, and does it leave the ground?', true],
  // The panel, which is a different claim about a different thing — that one is
  // about the world changing, this one is about the screen. Reads whether a
  // panel is out from the ELEMENT'S OWN RECTANGLE rather than from a flag the
  // module sets, because a boolean going true would pass just as happily with
  // the canvas parked off the bottom of the viewport. Its --selftest moves the
  // selection behind the assertion's back and requires the red. ~8 s. (K)
  ['K-pocket-panel', 'does the pockets panel open, and does G drop what you CHOSE?', true],
  // "when the player goes to sleep i want the screen to fade to black". Reads
  // the overlay's COMPUTED OPACITY rather than a fading() flag, and carries two
  // controls because its central verdict is an absence: a held W with no fade
  // (proving the driver's keys reach the page at all) and a whole fade with no
  // keys (proving the residual drift is collider settling, which cost me a
  // round reading 0.13 m as a broken input lock). --selftest advances the clock
  // BEFORE the fade instead of inside it — the caller mistake the ordering rule
  // exists to prevent — and requires the red. ~14 s; green 4 of 4 run at
  // once, which is the test that matters for anything on a transition. (K)
  // RED ON PURPOSE, and the red is the point. Everything in this file about the
  // CAPABILITY was green while the world had no fade in it at all: ct/apartment.ts
  // advances the clock at the bed and never calls screenFade, which is why the
  // desk re-opened a CONFIRMED row as "not true at the same time". A check that
  // proves a kit works is not a check that the kit is USED, and that gap was
  // mine. It now presses the bed's own [E] — from a station found by SWEEPING,
  // because the TV seat wins the pick from half the squares around the bed — and
  // watches the screen rather than the clock. Goes green on one line in C's file.
  ['K-sleep-fade', 'does the screen fade to black, and does the world change while it is?', true],
  // "i also want an atm interface". The MONEY is the point, so the money is
  // what it asserts: the account falls by exactly what you asked for, the cash
  // rises by exactly what you took, and the two are conserved end to end. It
  // also checks the panel framework's promises from a caller's side — the world
  // frozen behind it, digits reaching the machine rather than main.ts's
  // prototype switcher, ESC costing you nothing — because a promise the kit
  // makes to three builders should be checked once rather than trusted thrice.
  // --selftest jams the dispenser: the debit stands and the notes vanish, which
  // every screen of the thing sails through looking perfectly correct. (K)
  ['K-atm-walk', 'can you actually use the cash machine, and is the money conserved?', true],
  // Not my row — F's "wheel arches read as arches", verified from an empty
  // queue. Registered rather than thrown away because the row's whole history
  // is THE POPULATION (328 by radius, 86, 83 by colour), and this is the only
  // predicate that has two unrelated filters agreeing: a tyre is a cylinder
  // lying on its SIDE, which no barstool can imitate, and F's "carries a map".
  // Its --selftest lifts every car body 0.6 m off its wheels and requires the
  // red — the positive control F's evidence names and never watched. ~8 s. (K)
  ['K-tyre-has-arch', 'does every tyre have bodywork arching over it?', true],
  // RED ON PURPOSE, and the most player-visible thing I have found: SIT DOWN ON
  // ANY OF THE WORLD'S 225 SEATS FROM MORE THAN A METRE AWAY AND YOU CANNOT GET
  // BACK UP. crosstown.ts latches `landing` when an [E] moves you more than a
  // stride and `canSee` then refuses every spot until you walk 1.2 m clear —
  // and a seated player cannot walk. Sitting is itself a move of more than a
  // stride. Measured on the bench: 0.97 m of travel gets up, 1.03 m and beyond
  // are stuck. The comment above that line anticipates exactly this failure.
  // Carries its own control (the near approach, which works) so the red cannot
  // be read as "nobody pressed anything". crosstown.ts is DESK-OWNED and
  // untouched. (K)
  ['K-seat-lets-you-up', 'can you get back UP off a seat you sat down on?', false],
  // Verifying C's "tv off unless i sit down to watch it pls". C published the
  // predicate, so this asks the two questions an author cannot ask of their own
  // work: does the boolean agree with the PICTURE, and does it hold on STANDING
  // BACK UP — the path that turns a state machine back into a toggle. Its
  // --selftest pins scene.userData.tv.on true and requires the red. Currently
  // red on the stand-up half, for the seat bug above and not for the TV. (K)
  ['K-tv-off-unless-seated', 'is the television off unless you are sitting down?', true],
  // REGISTERED 2026-08-02 (w48, item 119). "make sure the top of the ad isnt
  // getting cut off by the tv." The rails never overlapped the glass — all four
  // abut it exactly — so this is not a check on the bezel's SIZE. The ads only
  // play to a seated player, whose eye is a fixed 0.538 m above the screen's
  // centre, and the surround standing proud of a recessed screen cut a band off
  // the top by PARALLAX. So it measures the band from the real seated eye
  // against the real meshes, and separately requires all 27 spots to keep their
  // ink inside the declared safe area. Either half can rot alone: deepen the
  // bezel and the geometry goes red, write a spot that paints at row 0 and the
  // content half does. Backgrounds are still allowed to bleed.
  //
  // SLOW, and irreducibly so: "all 27" means sitting through the pack, and the
  // pack is 27 spots at `secs * 1.4` — about 150 s of television — plus the
  // sweep for a standing square that offers the seat rather than the bed's
  // other spot. That lands within a few seconds of PER_CHECK_MS, so it is
  // marked slow rather than left to flake against a 180 s budget. (w48)
  ['w48-tv-title-safe', 'is the top of the ad clear of the bezel, for all 27 spots?', true, [], true],
  // THE GUARD FOR THE TRAP THE USER ACTUALLY HIT — "pressing e doesnt get me out
  // of it". A slot stool opened a modal, the modal's gate swallowed every
  // keydown, and BOTH of that night's fixes lived downstream of the swallowed
  // event so neither could be reached. This tests the layer that eats the input,
  // on EVERY panel from the framework's own registry rather than the ones its
  // author remembered — six today and a new one cannot escape it by being new.
  // Per panel: open, confirm the world IS frozen (that part is correct and
  // wanted), press Escape, confirm it closed and the player can walk. Carries a
  // control (walking with nothing open) so "got the world back" is not free. Its
  // --selftest swallows Escape in capture BEFORE the panel opens, which is the
  // real bug's ordering, and every panel then reports the player walking 0.00 m.
  // Installing the mutation after the panel was up did NOT reproduce it and the
  // selftest sailed through — GOTCHAS §27's "a mutation that does not break the
  // thing proves nothing". (K)
  ['K-no-panel-traps', 'can the player always get out of a panel?', true],
  // "letters waiting at the mailboxes when he comes in off the street". The
  // clause worth registering is the LAST one: rent is a clock feature, and this
  // world's clock ramps eight hours in a second and a half every time the
  // player sleeps, straight past the eleven o'clock post. A delivery that
  // accumulated per frame would drop a day every single night and nothing else
  // in this suite would notice, because the box would still have post in it. So
  // it snaps four days forward without going near the box and requires the mail
  // of every delivery day in between.
  //
  // Its --selftest drags the box 3 m down the lobby and walls the approach. The
  // first version of both mutations was CAUGHT BY NEITHER — the probe reported
  // a local position the drag did not touch, and the walk set out 0.90 m from a
  // 0.95 m trigger, so it arrived without moving and sailed through the wall.
  // Watching a selftest fail to fail is the only thing that finds that. (N)
  ['N-post-waiting', 'is the post waiting in 301\'s box, and does sleeping fill it?', true],
  // The jail's door and its pavement. Two claims that are easy to break from
  // the outside: the [E] on x = 57 stops working the moment anything is put
  // back across the closed end (a collider there ate it once already —
  // crosstown.ts's own east-end rectangle stopped the player at x 56.35), and
  // the walk across that end is the thing the SITE was approved on. It goes
  // 1.70 m -> 1.89 m, so a regression there is a promise broken rather than a
  // preference lost.
  //
  // It asserts the POPULATION first — it aborts with 3 if no door is declared
  // for JAIL at all, because every verdict below that is free on a world where
  // the building failed to build (GOTCHAS 34). Its --selftest pushes a slab
  // across the doorway onto `__ct.colliders()`, the same array the movement
  // code reads. (O)
  ['O-jail-walk', 'can you walk into the jail, and did its pavement get wider?', true, ['all'], true],
  // Answers the live desk row "make the exteriors match the interiors" for one
  // building. It asserts ONLY what GOTCHAS 45 says is constrained — that the
  // room's door and the facade's door are one world point, that the [E] IS that
  // point rather than a second copy of it, and that the leaf is declared once.
  // It deliberately does NOT compare floor area, depth, ceiling height or width
  // against the frontage: enforcing those is the rule the desk spent a whole
  // GOTCHAS entry retracting, and it cost the bodega, the casino and the hotel
  // their depth.
  //
  // NO SELFTEST, and that is a statement rather than an omission. Its subject
  // is a DECLARATION collected at import time, and nothing outside the bundle
  // can move it. The only mutations a harness has — overriding `__ct.doors()`
  // or `__ct.spots()` — break the CHECK'S VIEW while leaving the world intact,
  // which GOTCHAS 34 says proves nothing. A selftest that passed on one of
  // those would be worse than the honest `no selftest` this prints, because it
  // would certify the check as mutation-proof when it is not. Whoever exposes a
  // writable door registry can close it. (O)
  ['O-jail-door-agree', 'does the jail\'s door agree with itself, outside and in?', false],

  // ── THE CASINO GAMES (L) ────────────────────────────────────────────────
  //
  // Six of these seven start NO BROWSER and take under six seconds between
  // them, because the game logic in `ct/slots.ts` and `ct/blackjack.ts` draws
  // nothing, imports nothing at module scope and advances by a `dt`. That is
  // the point of the boundary rather than a happy accident: the FEEL of a slot
  // machine and the fairness of a card table are normally things you can only
  // check by watching, and here they are arithmetic.
  //
  // Two of them are worth knowing about because they check things no
  // screenshot and no RTP figure can:
  //
  //   L-slots-glass  hands the panel painter a RECORDING 2D context and asserts
  //                  the call list — GOTCHAS 1 says two runs of this project
  //                  differ in 20% of pixels, so the panel is checked by what
  //                  it DRAWS. All 54 reel/row cells must draw exactly the
  //                  symbol that reel's strip has there.
  //   L-blackjack-table  sits a basic-strategy player at the real table, through
  //                  the API the panel uses, for 300,000 hands, and requires the
  //                  return to match the one the RTP proof costed. There are two
  //                  implementations of one rule set and there have to be; this
  //                  is what stops them drifting. It found the dealer playing on
  //                  after a player natural — a fault the money could not see,
  //                  because settle() skips a hand already paid.
  //
  // NOT REGISTERED HERE: `L-games-in-artifact.mjs`, deliberately. It tests the
  // PACKED single-file build and this runner hands every check the ordinary
  // SHOT_URL, so it would abort at exit 3 every run. It refuses a non-artifact
  // URL rather than passing on the wrong build, which is right and makes it
  // un-registerable until the suite grows an artifact tier. Run it by hand:
  //   node scripts/pack-artifact.mjs && npx vite preview --outDir dist --port <p>
  //   SHOT_URL=http://localhost:<p>/artifact.html node scripts/L-games-in-artifact.mjs
  // (L)
  ['L-slots-rtp',        'does the slot machine return the 92.834% it claims?',        true, ['all']],
  ['L-slots-feel',       'do the reels stop one at a time, left to right?',            true, ['all']],
  ['L-slots-glass',      'does the glass show the symbol the machine paid on?',        true, ['all']],
  ['L-blackjack-rtp',    'does the blackjack table return 99.5% to correct play?',     true, ['all']],
  ['L-blackjack-table',  'does the table you sit at play the game that was costed?',   true, ['all']],
  ['L-blackjack-felt',   'does the felt hide the hole card and show the hand?',        true, ['all']],
  // The only one of mine that needs a browser. It walks — sit at a stool, spin,
  // cash out, stand up — but it waits for EVENTS rather than sleeping, so it
  // comes in at 2.4 s and does not belong in the slow tier on runtime grounds,
  // which is the tier's stated basis. No `--selftest`: its mutations would have
  // to break the world, not the module, and `canfail.mjs` is where that belongs.
  ['L-slots-inworld',    'can you sit at a machine in SEVENS and play it?',            false, ['all']],
  // RED ON PURPOSE, and it is not my bug. Sit at a slot, press ESCAPE, and the
  // NEXT [E] press anywhere in the world is swallowed — 48 of 96 stools in a
  // sweep, alternating. Narrowed away from the stool, the casino, the panel
  // framework and the trigger volumes by controls: closing the same panel with
  // `__hud.closePanels()` leaves the identical state and does NOT break the next
  // press; only ESCAPE does. Walking 1.5 s in between does not clear it.
  // `notes/L-for-C-escape-eats-the-next-E.md`, routed to C with K cc'd.
  // Registered rather than held back because this file's own closing line is
  // "It is not gating the build; it is telling you." (L)
  ['L-every-stool-seats-you', 'does E seat you EVERY time, or only every other time?', false, ['twice']],
  // The blackjack half of the in-world pair. It CANNOT sit down — the felt table
  // registers no seats (`notes/BLOCKED-L.md`) — so it drives the cabinet from
  // `__blackjack.open()` and checks everything downstream of the seat: the panel
  // opens in the built bundle, the world is frozen behind it with a CONTROL
  // rather than on trust, real key presses reach the game through K's gate, and
  // the chips move through the one wallet at the one rate. Three of those live in
  // the JOIN rather than in the game and none is visible to the node checks —
  // `ct/hud.ts` has already shipped a cabinet that opened, drew perfectly and
  // answered no key at all, so it is not hypothetical. (L)
  ['L-blackjack-inworld', 'does the blackjack table work in the world, minus its seat?', false, ['all']],
  // REGISTERED 2026-08-02 (w67, item 184). The ATM's PIN screen, driven with the
  // REAL pointer: CANCEL by click, CLR-on-empty by key, the fourth digit
  // submitting on its own, the enrolled PIN remembered across a genuine second
  // visit, and ENT/CLR/Escape unbroken. Its failing path is the `atm-cancel-
  // shadowed` case in canfail.mjs, which restores the user's original bug —
  // a click on CANCEL typing a 5 into the PIN.
  //
  // APPENDED AT THE END DELIBERATELY: worker sixtysix holds item 161 and is
  // editing this same array around the `density`/`masonry` rows. One row at the
  // far end is the smallest thing that can conflict with that.
  ['w67-atm-pin', 'does the ATM PIN screen cancel, auto-submit and remember?', 'atm-cancel-shadowed'],
  // REGISTERED 2026-08-02 (w67, item 175), GENERALISED THE SAME DAY (w75, item
  // 215). A CONTAINMENT SWEEP, not a route: it walks outward from the street
  // and asserts the player can never end up outside a site's own ground. Two
  // route-walking checks were green over the jail's hole twice — see the file's
  // header for why. SLOW tier: it is a walk, and a real one.
  //
  // ONE ROW PER SITE, deliberately, rather than one row that sweeps all three.
  // Three reasons, all of them things this suite has been bitten by: a single
  // row takes ~25 minutes and blows PER_CHECK/SLOW timeouts, which reads as
  // TIMED OUT rather than as a verdict; `--only` can then not run just the one
  // site you are working on; and a table that says which SITE escaped is a
  // report, where one row saying `FAILED (1)` is a thing you have to go read
  // stdout for. The script itself still takes any number of sites, and with
  // none it sweeps every site the world publishes.
  ['w75-site-contained', 'can the player walk out of the world at the jail?', 'jail-forecourt-open', ['jail'], true],
  ['w75-site-contained', 'can the player walk out of the world at the park?', false, ['park'], true],
  ['w75-site-contained', 'can the player walk out of the world at the lot?', false, ['lot'], true],
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
// IS EVERY REGISTERED CHECK ACTUALLY ON DISK? Third probe, and the same
// argument as the first two: "could not measure" and "measured, and it is
// wrong" are different sentences, and this file has now been bitten by the
// difference three times — a dead port, a stale dist/, and this.
//
// Measured 2026-08-02: a scripts/ reorganisation moved 55 of the 121 registered
// checks into scripts/probes/. `spawnSync('node', ['scripts/<name>.mjs'])` then
// exits 1 with MODULE_NOT_FOUND, and every one of them printed as `FAILED (1)`
// — the same row a real defect prints. **45% of the suite was not running and
// the summary said it was red**, which is worse than the suite being red,
// because somebody reads those rows and goes hunting for a fault that is not
// there. That is most of what queue item 9 was sent to classify.
//
// A registry that names a file that does not exist is a broken registry, not a
// broken world. It stops the run, like the other two, rather than producing 55
// confident verdicts about nothing.
{
  const absent = CHECKS
    .map(([name]) => name)
    .filter((n, i, a) => a.indexOf(n) === i)
    .filter((n) => !existsSync(`scripts/${n}.mjs`));
  if (absent.length) {
    console.error(`\n${absent.length} REGISTERED CHECK(S) ARE NOT ON DISK.\n`);
    for (const n of absent) {
      const alt = ['probes', 'lib'].map((d) => `scripts/${d}/${n}.mjs`).find((p) => existsSync(p));
      console.error(`  scripts/${n}.mjs` + (alt ? `   — but ${alt} exists` : '   — missing entirely'));
    }
    console.error('\n  Each would have run as `node scripts/<name>.mjs`, exited 1 with');
    console.error('  MODULE_NOT_FOUND, and printed FAILED (1) — which is what a real');
    console.error('  defect prints. Nothing about the world would have been measured.\n');
    console.error('  Fix: move the file back to scripts/, or drop its row from CHECKS.\n');
    process.exit(2);
  }
}

// A `--only` THAT MATCHES NOTHING IS THE VACUOUS PASS THIS FILE KEEPS FINDING IN
// OTHER PEOPLE'S SCRIPTS. Mistype it and every row is filtered out, the summary
// prints an empty table, the exit code is 0, and the caller reads that as the
// check they named being green. Same shape as GOTCHAS 34's mode word.
if (ONLY.length) {
  const unmatched = ONLY.filter((o) => !CHECKS.some(([n]) => n === o || n.includes(o)));
  if (unmatched.length) {
    console.error(`\n--only MATCHED NO REGISTERED CHECK: ${unmatched.join(', ')}\n`);
    console.error('  Nothing would have run, and an empty run exits 0 — which reads exactly');
    console.error('  like the check you named having passed.\n');
    process.exit(2);
  }
}

// DID THE SERVER SURVIVE THE LAST CHECK? Measured (not fixed by fiat — see
// `notes/archive/K-check-artefacts.md`, which ran the suite eight times
// against a live preview and could not make it die from the checks
// themselves): whatever kills it, it is not this file putting concurrent
// load on it — spawnSync runs everything sequentially, one browser at a
// time, and a clean run here left zero leaked chromium processes behind.
// But the auditor DID reproduce a death mid-run (`notes/LEDGER.md`, "the
// full check suite kills the preview server"), and when it happens every
// check after the death currently reports FAILED — indistinguishable from a
// real one, which is the actual complaint: "~half its 52 failures are that
// rather than real faults."
//
// So: ask, after every check, whether the server is still there. Cheap (one
// HEAD-shaped GET, same probe as the pre-flight above) and it turns an
// unmeasurable back half of a run into an honest "SERVER DIED" rather than a
// wall of FAILED that a reader cannot tell from real ones. This does NOT
// restart the server — restarting would hide exactly the check that
// triggered the death, which the item this exists for explicitly warns
// against. It only stops trusting results once the server is confirmed
// gone, and says so once rather than fifty times.
//
// ── AND "THE SERVER IS GONE" IS TWO DIFFERENT ACCIDENTS ────────────────────
//
// That probe used to be a local `serverAlive()` returning a boolean off
// `response.ok`, and that boolean is the bug queue item 182 was filed about: a
// preview whose `dist/` has momentarily been emptied by `vite build` answers
// **404**, `r.ok` is false for a 404 exactly as it is for ECONNREFUSED, and the
// `serverDied` latch below was never re-tested — so **one 220 ms blink
// condemned every remaining check of a twelve-minute run to
// `SERVER DIED (unmeasured)`**, and the builder went looking at their own
// change. The item's stated cause ("the build KILLS the preview") is wrong; the
// measurements that show why, and the three-way classification that replaces
// the boolean, are in `scripts/lib/server-state.mjs`.
//
// It lives in lib/ rather than here so `scripts/probes/w67-server-state-cases.mjs`
// can drive the real classifier through all four answers instead of a copy.

const rows = [];

// null | 'dead' | 'empty' — WHY we stopped trusting results, not merely that we
// did. The footer needs the reason to name a cause, and the two causes have
// different fixes.
let serverDied = null;
// The row text for each reason. Both say "unmeasured" in the same voice, because
// the reader's first job is to stop reading them as defects; the footer then
// says which of the two happened and what to do about it.
const UNMEASURED = {
  dead: 'SERVER DIED (unmeasured)',
  empty: 'dist/ EMPTY — NO SERVER DEATH (unmeasured)',
};

// One check fell over, the server was momentarily 404, and it came back. That is
// a build race and NOT a reason to stop trusting the run: the world is still
// there, this one check just happened to reach for it during the ~220 ms in
// which `vite build` had emptied dist/. Report the casualty, keep going.
//
// Counted, so the footer can say it happened at all — a run with four of these
// is telling you something (somebody is building against your tree in a loop)
// even though every one of them is individually harmless.
let buildRaces = 0;

// SIXTH FIELD: canfail case names for a row that ALSO carries a --selftest flag.
//
// The third column is an either/or — `true` runs the script's own flag, a
// string or array runs canfail cases instead — and for most rows that is the
// right shape, because the two are alternative ways of saying the same thing.
// For `masonry` they are not, and item 161 is why. Its flag doubles one face's
// repeat and proves the "wrong density" VERDICT can go red; the `masonry-blind`
// case empties its POPULATION and proves the floor under that verdict can go
// red. Those fail apart — the flag sailed through the whole period this check
// was measuring zero faces, because with no faces there was nothing to double
// and it reported SELFTEST FAILED to a runner nobody was running. Registering
// only one of them would certify half a guard, which is the argument the
// `footprint` and `seat-facing` rows above already make for multiple cases.
for (const [name, question, selftest, extra = [], slow = false, cases = []] of CHECKS) {
  if (ONLY.length && !ONLY.some((o) => name === o || name.includes(o))) continue;
  if (slow && !SLOW) { rows.push([name, 'walks — use --slow', '—']); continue; }
  if (SELFTEST && !selftest) { rows.push([name, 'no selftest', '—']); continue; }
  if (serverDied) { rows.push([name, question, UNMEASURED[serverDied]]); continue; }
  process.stderr.write(`  … ${name}\n`);
  const t0 = Date.now();
  // A FOURTH SHAPE FOR THE SELFTEST COLUMN: entries that begin with `--` are the
  // check's OWN flags, and each one is a separate invocation.
  //
  // Registered 2026-08-03 (item 223) for casinodoor, the only check in the suite
  // that carries TWO mutation flags — `--selftest` walls the door shut and
  // reddens the E-press leg, `--selftest-gone` drops the casino out of
  // `__ct.doors()` and reddens the declaration and sweep legs. They fail apart
  // by construction: the sampling sweep uses `warp`, which does no collision, so
  // a collider mutation cannot reach legs 1-4, and its author recorded that
  // limitation rather than letting one case certify four legs it never touched.
  // The same argument the `masonry`/`masonry-blind` and `footprint` rows already
  // make — registering one of two cases certifies half a guard.
  //
  // `true` could only ever have run the first of them, because the runner
  // appends the literal `--selftest` and nothing else. Discriminating on the
  // leading `--` is unambiguous: no canfail case is named that way (canfail's
  // own registry is checked below), so no existing row changes shape.
  if (SELFTEST && Array.isArray(selftest) && selftest.some((s) => String(s).startsWith('--'))) {
    // MIXED IS A TYPO, NOT A FEATURE. Half a flag list handed to canfail.mjs
    // becomes "unknown case: --selftest", which exits non-zero and reads as the
    // WORLD being broken. Refuse to guess.
    if (!selftest.every((s) => String(s).startsWith('--'))) {
      console.error(`\n${name}: its selftest column mixes flags and canfail case names: ${selftest.join(', ')}`);
      console.error('  A row is one or the other. Flags run the script; bare names run scripts/canfail.mjs.\n');
      process.exit(2);
    }
    for (const flag of selftest) {
      const ft0 = Date.now();
      process.stderr.write(`  … ${name} ${flag}\n`);
      const rc = spawnSync('node', [`scripts/${name}.mjs`, ...extra, flag],
        { env: { ...process.env, SHOT_URL: URL }, encoding: 'utf8', timeout: slow ? SLOW_MS : PER_CHECK_MS });
      const secs = ((Date.now() - ft0) / 1000).toFixed(0);
      const timedOut = rc.error?.code === 'ETIMEDOUT' || rc.signal === 'SIGTERM';
      const ok = !timedOut && rc.status === 0;
      // Each flag gets its OWN row. One line saying "casinodoor: ok" cannot tell
      // a reader WHICH mutation was watched go red, and this row exists precisely
      // because the two are different claims.
      rows.push([`${name} ${flag}`, question,
        timedOut ? `TIMED OUT after ${secs}s` : ok ? 'ok' : `FAILED (${rc.status})`, secs]);
      if (!ok) {
        process.exitCode = 1;
        if (!timedOut) console.log(`${rc.stdout ?? ''}${rc.stderr ?? ''}`.trimEnd() + '\n');
      }
    }
    continue;
  }
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
  // …and the sixth field, for a row that carries BOTH. Reported on its own line
  // rather than folded into the row above, because "the verdict can go red" and
  // "the population under it can go red" are two claims and a reader who is told
  // one number cannot tell which one was proved.
  if (SELFTEST && cases.length) {
    const ct0 = Date.now();
    process.stderr.write(`  … ${name} (canfail: ${cases.join(', ')})\n`);
    const rc = spawnSync('node', ['scripts/canfail.mjs', ...cases],
      { env: { ...process.env, SHOT_URL: URL }, encoding: 'utf8', timeout: PER_CHECK_MS * cases.length });
    const csecs = ((Date.now() - ct0) / 1000).toFixed(0);
    const timedOut = rc.error?.code === 'ETIMEDOUT' || rc.signal === 'SIGTERM';
    rows.push([`${name} +canfail`, question,
      timedOut ? `TIMED OUT after ${csecs}s` : rc.status === 0 ? 'ok' : `FAILED (${rc.status})`, csecs]);
    if (timedOut || rc.status !== 0) {
      process.exitCode = 1;
      if (!timedOut) console.log(`${rc.stdout ?? ''}${rc.stderr ?? ''}`.trimEnd() + '\n');
    }
  }
  const args = [`scripts/${name}.mjs`, ...extra, ...(SELFTEST ? ['--selftest'] : [])];
  const r = spawnSync('node', args, { env: { ...process.env, SHOT_URL: URL }, encoding: 'utf8', timeout: slow ? SLOW_MS : PER_CHECK_MS });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    // A timeout is exactly the shape a dead-server casualty takes (GOTCHAS
    // §32's discriminator: non-zero with nothing measured) — check now,
    // before deciding this one check is the fault rather than the server.
    const state = await probeWithRecovery(URL);
    if (state === 'dead' || state === 'empty') {
      serverDied = state;
      rows.push([name, question, UNMEASURED[state]]);
      process.exitCode = 1;
      continue;
    }
    if (state === 'recovered') {
      buildRaces++;
      rows.push([name, question, 'BUILD RACE (unmeasured)', secs]);
      process.exitCode = 1;
      continue;
    }
    rows.push([name, question, `TIMED OUT after ${secs}s`, secs]);
    process.exitCode = 1;
    continue;
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // Status first, banner second. reportWorld exits 3 for "that is not my build"
  // (BLOCKED-H), which is a status this runner can trust; the string match stays
  // as a fallback for any check that predates it or prints without exiting.
  const wrongWorld = r.status === 3 || out.includes('MEASURING THE WRONG WORLD');
  if (r.status !== 0 && !wrongWorld) {
    // The check exited non-zero. Was the server that was supposed to answer it
    // even there? Attributing this (and everything after it) to the check would
    // be exactly the "~half its 52 failures are that rather than real
    // faults" this item exists to stop — but so would attributing it to a
    // server that never actually went anywhere, which is what the old boolean
    // did every time somebody ran a build against the same tree.
    const state = await probeWithRecovery(URL);
    if (state === 'dead' || state === 'empty') {
      serverDied = state;
      rows.push([name, question, UNMEASURED[state]]);
      process.exitCode = 1;
      continue;
    }
    if (state === 'recovered') {
      buildRaces++;
      rows.push([name, question, 'BUILD RACE (unmeasured)', secs]);
      process.exitCode = 1;
      console.log(out.trimEnd() + '\n');
      continue;
    }
  }
  rows.push([name, question, r.status === 0 ? 'ok' : wrongWorld ? 'WRONG WORLD' : `FAILED (${r.status})`, secs]);
  if (r.status !== 0) process.exitCode = 1;
  // On failure the detail matters more than the summary, so pass it through.
  if (r.status !== 0) console.log(out.trimEnd() + '\n');
}
if (serverDied === 'dead') {
  console.log(`\nTHE SERVER AT ${URL} DIED PARTWAY THROUGH THIS RUN.`);
  console.log('  Nothing is listening on that port any more — the connection was refused,');
  console.log('  which is a different thing from the 404 case below and from a build.');
  console.log('  Everything above SERVER DIED is real; everything from there down was');
  console.log('  never measured, not FAILED. `notes/archive/K-check-artefacts.md` could');
  console.log('  not reproduce this from the checks themselves (8/8 survived, sequential,');
  console.log('  zero leaked browsers) — if it keeps happening, the next thing to check is');
  console.log('  what else in the environment is reaping processes, not this file.');
  console.log('  Re-run once the server is back up.');
}
if (serverDied === 'empty') {
  console.log(`\nYOUR PREVIEW IS ALIVE. dist/ IS NOT.`);
  console.log(`  ${URL} accepted the connection and answered — it just has no page to`);
  console.log('  serve, for more than six seconds. A preview serves dist/, and dist/ is');
  console.log('  empty or half-written.\n');
  console.log('  THE CAUSE IS ALMOST CERTAINLY A BUILD AGAINST THIS SAME TREE.');
  console.log('  `vite build` empties dist/ before it writes. Measured here: a healthy');
  console.log('  preview answers 404 for ~220 ms of every build and never stops listening');
  console.log('  (scripts/probes/w67-does-build-kill-preview.mjs). Six seconds of 404 means');
  console.log('  the build is still going, or it FAILED after emptying dist/ and never');
  console.log('  refilled it.\n');
  console.log('  DO NOT go looking at your own change for this — nothing below the first');
  console.log('  such row measured anything at all.');
  console.log('  Fix: wait for the build, or re-run `npm run build`, then re-run the checks.');
  console.log('  Do NOT start a second preview; the port is already held by a live one.');
}
if (buildRaces) {
  console.log(`\n${buildRaces} CHECK(S) LOST A RACE WITH A BUILD, and are marked BUILD RACE.`);
  console.log('  dist/ was momentarily gone when they reached for it and was back a second');
  console.log('  later, so the server was never in trouble and neither, probably, are they.');
  console.log('  They measured nothing — re-run them individually rather than reading them:');
  for (const [n, , s] of rows) if (s === 'BUILD RACE (unmeasured)') console.log(`    SHOT_URL=${URL} node scripts/${n}.mjs`);
  console.log('  If this keeps happening, something is building against your tree in a loop');
  console.log('  (live-integrate.sh does exactly that, every 15 s — point SHOT_URL at your');
  console.log('  own preview, not the integration world).');
}

const w = Math.max(...rows.map(([n]) => n.length));
console.log(SELFTEST ? '\nSELFTEST — each check was broken on purpose:' : `\nchecks against ${URL}:`);
// SAY THAT THE RUN WAS FILTERED, in the summary and not only in the argv the
// reader cannot see. A short green table is otherwise indistinguishable from a
// whole suite passing, and this file's own preamble is about exactly that class
// of sentence — "could not measure" and "measured, and it is fine" being
// different news that used to print the same.
if (ONLY.length)
  console.log(`  (--only ${ONLY.join(', ')} — ${rows.length} of ${CHECKS.length} rows; the rest were NOT run)`);
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

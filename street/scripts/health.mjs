// Does the world actually initialise? THE ANSWER IS THE EXIT CODE.
//
// This is the command CLAUDE.md and START-HERE.md hand every new agent for
// "is the world alive", it is the cheapest check in the suite (so the one most
// likely to be run alone and believed), and it is registered in `checks.mjs`.
//
// FOR MONTHS IT COULD NOT GO RED. It printed `WORLD BROKEN — __ct never
// appeared` through `console.log` and then fell off the end of the file, and
// node returns 0 for that. There was no `process.exit` and no
// `process.exitCode` anywhere in it. So a world that had stopped initialising
// rendered as a green `ok` row in `npm run checks`, and `echo $?` said 0 —
// **of 122 registered checks it was the only one that could not fail** (w22's
// probe, `scripts/probes/can-a-check-print-fail-and-exit-0.mjs`, found 121 of
// 122 able to go red on their own verdict; this was the one).
//
// It survived every earlier sweep for exactly this because it prints the words
// "WORLD BROKEN" and not the word "FAIL", so the greps went past it — and the
// desk's own sweep found it and explained it away as "reports state, probably
// intentional". PRINTING IS NOT FAILING. A verdict that only reaches stdout is
// a verdict nobody acts on, because the suite reads status and nothing else.
//
//   node scripts/health.mjs            # exit 0 world alive, 1 world dead, 3 nothing measured
//   SHOT_URL=http://localhost:4192/ node scripts/health.mjs
//
// THREE STATUSES, NOT TWO, and the third is the one that makes the second
// trustworthy. Before this, `p.goto` against a dead port threw an unhandled
// rejection and node forced exit 1 — which, the moment "the world is broken"
// also became exit 1, would have made a port with nothing on it indistinguishable
// from a world that failed to build. That is the confusion the LEDGER's
// "~half its 52 failures are artefacts" row is about, and `reportWorld` already
// spends thirty lines on the same distinction. So:
//
//   0   __ct appeared. The world initialised.
//   1   the page loaded and __ct never appeared. MEASURED, and it is broken.
//   3   nothing was measured — no server, or the wrong build (reportWorld's own
//       code, GOTCHAS 32's convention, and what checks.mjs reads as WRONG WORLD).
//
// CONSOLE ERRORS ARE REPORTED, NOT JUDGED, and that is a deliberate call rather
// than an omission (w22 left it open; this is the decision). This check answers
// one question — did the world initialise — and `scripts/bugsweep.mjs` owns
// page errors properly across all 12 rooms. Folding them in would make the
// world's cheapest smoke test go red for a deprecation warning. It costs
// nothing: any error that actually stops initialisation also stops `__ct`
// appearing, so it is already caught by the verdict above.
//
// PROVED BY MUTATION, not by assertion. `canfail.mjs`'s `health-dead` case
// withholds `(window as any).__ct` in `src/proto/crosstown.ts`, rebuilds, and
// requires this to go red; `checks.mjs` registers `health` with that case name
// instead of the `false` it carried when it had no selftest at all.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message)));
// Had NO default at all — without SHOT_URL this called goto(undefined). `aim`
// announces a defaulted port on stderr rather than guessing silently; a
// CROSSTOWN world on the wrong port is caught a second time by `reportWorld`
// below, which exits 3 on a stamp mismatch.
const URL = aim('http://localhost:4177/');
// NOTHING SERVING IS NOT A BROKEN WORLD. Unhandled, this throws and node forces
// exit 1 — the same status a genuinely dead world now returns — so a builder
// who forgot to start a preview would be sent to look at their own code.
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
} catch (e) {
  console.error(`\n  NOTHING WAS MEASURED — could not load ${URL}`);
  console.error(`  ${String(e.message).split('\n')[0]}`);
  console.error(`  Start a preview for THIS tree and aim at it:`);
  console.error(`    npx vite preview --port <yours>`);
  console.error(`    SHOT_URL=http://localhost:<yours>/ node scripts/health.mjs\n`);
  await b.close();
  process.exit(3);                                             // GOTCHAS 32
}
// Before diagnosing whether the world initialises, check it is THIS world. A
// "WORLD BROKEN" verdict about somebody else's build is worse than no verdict,
// and the stamp is in the bundle, so it reads even when __ct never appears.
await reportWorld(p, URL);
let ok = true;
try { await p.waitForFunction(() => window.__ct !== undefined, { timeout: 12000 }); }
catch { ok = false; }
console.log(ok ? 'WORLD OK — __ct initialised' : 'WORLD BROKEN — __ct never appeared');
// Reported, not judged — see the note above.
if (errs.length) console.log('errors (not part of the verdict; bugsweep owns these):\n' + errs.slice(0,3).join('\n'));
await b.close();
// `exitCode` rather than `process.exit(…)`: this check's whole output is two
// lines on stdout, and `process.exit` can truncate a pending pipe write, which
// would lose the verdict in exactly the `| tail` case a reader is most likely
// to use. Nothing here holds the loop open once the browser is closed, so
// setting the status and returning is both safe and honest.
process.exitCode = ok ? 0 : 1;

// Item 182. Drive the REAL server-state classifier through all four of its
// answers, and drive `checks.mjs`'s pre-flight through the two it can print.
//
//   node scripts/probes/w67-server-state-cases.mjs
//
// Exit 0 = every case answered as designed; 1 = at least one did not.
//
// WHY THIS EXISTS AS A FILE RATHER THAN A PARAGRAPH. The bug being fixed is that
// `checks.mjs` could not tell "your preview was killed" from "your preview
// answered 404 for 220 ms while a build emptied dist/", and reported both as
// SERVER DIED. **A fix to a distinguishing bug that is not itself tested on both
// sides of the distinction is not a fix.** So every case below asserts the
// SPECIFIC answer — never merely that something non-empty came back, which is
// the vacuous-selftest failure of GOTCHAS 79.
//
// The classifier is IMPORTED, not reimplemented (BUILDER-BRIEF §8). A retyped
// copy would pass this file and tell you nothing about checks.mjs.
import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { probeServer, probeWithRecovery } from '../lib/server-state.mjs';

// ── a scratch port nothing holds. `ss -ltn`, never curl: a port curl reports
// as free can already be BOUND by something not yet answering HTTP, which is
// exactly how worker sixtyone lost port 4183 (GOTCHAS 81).
const taken = new Set(
  execSync("ss -ltn 2>/dev/null || true", { encoding: 'utf8' })
    .split('\n').map((l) => (l.match(/:(\d+)\s/) ?? [])[1]).filter(Boolean));
const PORT = [...Array(10).keys()].map((i) => 4231 + i).find((p) => !taken.has(String(p)));
if (!PORT) { console.error('no free scratch port in 4231-4240'); process.exit(3); }
const URL_ = `http://localhost:${PORT}/`;

let mode = 'ok';                                   // 'ok' | 'empty'
const srv = createServer((_req, res) => {
  if (mode === 'empty') { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<html><body><script type="module" src="/assets/index-abc123.js"></script></body></html>');
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

let bad = 0;
const is = (label, got, want) => {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} got '${got}'  want '${want}'`);
};

console.log(`\nserver-state classifier, against a scratch server on ${URL_}\n`);

// 1. a healthy world
mode = 'ok';
is('200 is a world', await probeServer(URL_), 'ok');

// 2. alive, but dist/ is gone and STAYS gone — a failed build, or one still
//    running. This is the case the old boolean called SERVER DIED.
mode = 'empty';
is('404 is not a death', await probeServer(URL_), 'empty');
is('404 that never heals -> empty', await probeWithRecovery(URL_, { tries: 2, waitMs: 50 }), 'empty');

// 3. THE BUILD RACE. dist/ is emptied and refilled — measured at ~220 ms on a
//    real build. The run must survive this, and must NOT latch.
mode = 'empty';
setTimeout(() => { mode = 'ok'; }, 220);
is('404 that heals in 220ms -> recovered', await probeWithRecovery(URL_, { tries: 6, waitMs: 100 }), 'recovered');

// 4. a real death. Nothing listening at all.
await new Promise((r) => srv.close(r));
is('refused connection is a death', await probeServer(URL_), 'dead');
is('a death does not "recover"', await probeWithRecovery(URL_, { tries: 2, waitMs: 50 }), 'dead');

// ── and now checks.mjs itself, end to end, on the two pre-flight branches ────
// A classifier that answers correctly inside a unit and a runner that prints the
// wrong sentence anyway is exactly the failure this project keeps paying for, so
// assert the TEXT a builder actually reads.
console.log('\nchecks.mjs pre-flight, end to end:\n');

// `spawn`, NOT `spawnSync` — and this cost a round, so it is worth the line.
// The scratch server above lives in THIS process. `spawnSync` blocks the event
// loop for the whole child, so the server can never accept the connection
// checks.mjs opens, and checks.mjs reports `NOTHING IS SERVING (TimeoutError)`
// — a perfect false negative that looks exactly like the fix not working.
const runChecks = (url) => new Promise((res) => {
  const c = spawn('node', ['scripts/checks.mjs'],
    { env: { ...process.env, SHOT_URL: url } });
  let out = '';
  c.stdout.on('data', (d) => { out += d; });
  c.stderr.on('data', (d) => { out += d; });
  c.on('exit', () => res(out));
});

// 4b. nothing on the port — the message must still be "start one"
const deadOut = await runChecks(URL_);
is('dead port still says NOTHING IS SERVING',
  /NOTHING IS SERVING/.test(deadOut), true);
is('dead port does NOT blame dist/',
  /dist\/ IS NOT THERE/.test(deadOut), false);

// 4c. alive but empty — the message must name the build, and must NOT tell a
//     builder to start a server they already have.
const srv2 = createServer((_q, res) => { res.writeHead(404); res.end('nope'); });
await new Promise((r) => srv2.listen(PORT, '127.0.0.1', r));
const emptyOut = await runChecks(URL_);
await new Promise((r) => srv2.close(r));

is('404 preflight says the preview IS serving',
  /IS SERVING, BUT dist\/ IS NOT THERE/.test(emptyOut), true);
is('404 preflight names npm run build as the cause',
  /npm run build/.test(emptyOut), true);
is('404 preflight does NOT say nothing is serving',
  /NOTHING IS SERVING/.test(emptyOut), false);
is('404 preflight warns off a second preview',
  /Do NOT start a second preview/.test(emptyOut), true);

console.log(bad ? `\n${bad} CASE(S) WRONG\n` : '\nall cases as designed\n');
process.exit(bad ? 1 : 0);

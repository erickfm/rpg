// Drive `endOfRun` through every answer it can give — against REAL sockets.
//
// Item 239 asks for two things at the end of a run: is the server still there,
// and did every registered leg run. This exercises both, and the four server
// states, on the real classifier rather than a retyped copy of it (BUILDER-BRIEF
// §8). It is the same argument `scripts/probes/w67-server-state-cases.mjs` makes
// for `probeServer`, one function later.
//
// The states are produced by standing up actual HTTP servers, because that is
// the only way to tell a 404 from a refused connection honestly:
//
//   'ok'         a server answering 200
//   'empty'      a server answering 404 — alive, dist/ gone
//   'dead'       nothing listening at all
//   'recovered'  404 that turns into 200 while endOfRun is waiting
//
// A CHECK I HAVE NEVER WATCHED FAIL IS A CHECK I WILL ARGUE WITH (GOTCHAS 27),
// and the point of the table below is that the PASS and the FAIL rows are
// produced by the same function on the same day.
import { createServer } from 'node:http';
import { endOfRun } from '../lib/server-state.mjs';

const listen = (handler) => new Promise((res) => {
  const s = createServer(handler);
  s.listen(0, '127.0.0.1', () => res({ s, url: `http://127.0.0.1:${s.address().port}/` }));
});

const rows = [];
const record = (name, want, v) => {
  const got = `${v.state}${v.lost ? ` lost=${v.lost}` : ''} ${v.ok ? 'PASS' : 'FAIL'}`;
  rows.push([got === want, name, got, want]);
};

// ── 1. healthy and complete: the only case that may pass ──────────────────
{
  const { s, url } = await listen((_, r) => r.end('ok'));
  record('server up, 13 of 13 legs', 'ok PASS',
    await endOfRun(url, { ran: 13, registered: 13, leg: 'room' }));
  // ── 2. healthy but SHORT. The half a liveness probe alone cannot see. ──
  const short = await endOfRun(url, { ran: 7, registered: 13, leg: 'room' });
  record('server up, only 7 of 13 legs', 'ok lost=6 FAIL', short);
  console.log('  the short-run message, in full:');
  for (const l of short.lines) console.log('    ' + l);
  // ── 3. no accounting offered: liveness only, and it must not invent one ──
  record('server up, legs not counted', 'ok PASS', await endOfRun(url));
  s.close();
}

// ── 4. dead: nothing listening. Bind then close, so the port is truly free ──
{
  const { s, url } = await listen((_, r) => r.end('ok'));
  await new Promise((r) => s.close(r));
  record('server DEAD, 13 of 13 legs', 'dead FAIL',
    await endOfRun(url, { ran: 13, registered: 13, leg: 'room' }));
  record('server DEAD and short too', 'dead lost=6 FAIL',
    await endOfRun(url, { ran: 7, registered: 13, leg: 'room' }));
}

// ── 5. empty: alive, but no page. Must NOT be reported as a death. ────────
{
  const { s, url } = await listen((_, r) => { r.statusCode = 404; r.end('no'); });
  record('server ALIVE but dist/ empty', 'empty FAIL',
    await endOfRun(url, { ran: 13, registered: 13, leg: 'room' }));
  s.close();
}

// ── 6. recovered: a build blinked dist/ and it came back. NOT a failure. ──
//
// This is the case that cost a twelve-minute run when it was lumped in with a
// death (`lib/server-state.mjs`), so it is worth holding on to: the world never
// went anywhere and the results stand.
{
  let hits = 0;
  const { s, url } = await listen((_, r) => {
    if (++hits <= 2) { r.statusCode = 404; r.end('no'); } else r.end('ok');
  });
  record('dist/ blinked and came back', 'recovered PASS',
    await endOfRun(url, { ran: 13, registered: 13, leg: 'room' }));
  s.close();
}

console.log('');
const w = Math.max(...rows.map(([, n]) => n.length));
for (const [ok, name, got, want] of rows)
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(w)}  ${got}${ok ? '' : `   (wanted ${want})`}`);
const bad = rows.filter(([ok]) => !ok).length;
console.log(`\n${rows.length - bad}/${rows.length} cases behave as specified`);
// POPULATION FLOOR. If the table is empty this prints "0/0" and exits 0, which
// is the exact vacuous pass this whole item is about.
if (rows.length < 7) {
  console.log(`ONLY ${rows.length} CASES RAN — expected 7. That is a failure, not a pass.`);
  process.exit(1);
}
process.exit(bad ? 1 : 0);

// Run every world check, and say plainly which ones can fail.
//
// Six checks existed and four had no npm entry: you could only run them if you
// had read the note that introduced them. A tool nobody knows how to run is
// worth about what a tool nobody has watched fail is worth.
//
//   npm run checks               # against $SHOT_URL, or the default preview
//   npm run checks -- --selftest # break each one on purpose, require it to fail
//
// NOT A GATE. `npm run build` stays `tsc --noEmit && vite build`; the desk stood
// wiring down as a gate deliberately and that reasoning holds for all of these.
// This is one command instead of six remembered ones.
//
// Every check here reads SHOT_URL and calls reportWorld, so each one refuses if
// the server is not serving this checkout's build.
import { spawnSync } from 'node:child_process';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

// what each one answers, in the order a reader would want it
const CHECKS = [
  ['check-wiring',     'is every module that was written actually built?', true],
  ['health',           'does the world initialise at all?',                false],
  ['check-seethrough', 'can you see the pavement through a shopfront?',    true],
  ['density',          'is every masonry face at the density it declares?', true],
  ['nightgrade',       'does everything the dimmer touched actually dim?',  true],
  ['seampairs',        'do two faces that should draw the same brick?',     true],
  ['lotwalk',          'can a pedestrian enter the car lot, and only there?', true],
  ['lot-frontage',     'does the car lot take any of the 2 m walk?',        false],
  ['door301',          'does 301\'s door open, shut, block and refuse?',     true],
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
const rows = [];
for (const [name, question, hasSelftest] of CHECKS) {
  if (SELFTEST && !hasSelftest) { rows.push([name, 'no selftest', '—']); continue; }
  const args = [`scripts/${name}.mjs`, ...(SELFTEST ? ['--selftest'] : [])];
  process.stderr.write(`  … ${name}\n`);
  const t0 = Date.now();
  const r = spawnSync('node', args, { env: { ...process.env, SHOT_URL: URL }, encoding: 'utf8', timeout: PER_CHECK_MS });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    rows.push([name, question, `TIMED OUT after ${secs}s`]);
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
  console.log(`  ${status === 'ok' ? '✓' : status === '—' ? '·' : '✗'} ${name.padEnd(w)}  ${status === 'ok' ? question : status}`
    + (secs && +secs >= 20 ? `   (${secs}s)` : ''));
if (process.exitCode) console.log('\nSomething above is red. It is not gating the build; it is telling you.');

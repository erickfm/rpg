// Does a check NOTICE that the server it is measuring died halfway through it?
//
// Item 239, reported by worker eightytwo: its dev server was killed mid-run and
// `interiors-walk` "kept going against the page it had already loaded", printing
// a full green report. It caught that only by noticing an unrelated
// notification.
//
// This probe is the measurement behind that claim, because the claim is a
// hypothesis until somebody runs it (BUILDER-BRIEF §6). It:
//
//   1. starts a `vite preview` on its own port,
//   2. launches one registered check against it,
//   3. KILLS the preview a set number of seconds in — after the check's single
//      `page.goto` has certainly landed, and while it is still measuring,
//   4. reports the check's exit code and whether it said anything at all about
//      the server.
//
// A check that exits 0 here is reporting a confident verdict about a world that
// stopped existing partway through the run.
//
// Usage:
//   node scripts/probes/w92-does-a-dead-server-show.mjs door301 6
//                                                       ^check  ^kill after N s
//
//   node scripts/probes/w92-does-a-dead-server-show.mjs checks 6 --only door301
//                                                       ^ the SUITE, with its
//                                                         own args passed through
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { probeServer } from '../lib/server-state.mjs';

const CHECK = process.argv[2] ?? 'door301';
const KILL_AT = Number(process.argv[3] ?? 6);
const PASSTHROUGH = process.argv.slice(4);   // args for the thing under test
const PORT = Number(process.env.W92_PORT ?? 4481);
const URL = `http://localhost:${PORT}/`;

// A port that is already taken makes this probe measure somebody else's server
// and then kill it — the worst possible failure mode for this particular script.
// `ss`, never curl (GOTCHAS 81).
{
  const ss = spawnSync('ss', ['-ltn'], { encoding: 'utf8' });
  if (ss.stdout?.includes(`:${PORT} `)) {
    console.error(`PORT ${PORT} IS ALREADY LISTENING. This probe KILLS the server on its port —`);
    console.error("refusing to run so it cannot kill somebody else's. Set W92_PORT.");
    process.exit(2);
  }
}

console.log(`probe: ${CHECK} against ${URL}, preview killed ${KILL_AT}s in\n`);

// W92_DEV=1 for the checks that cannot run against a built bundle — item 164:
// `interiors-walk` reads `import('/src/proto/ct/interior.ts')` inside the page,
// which only a dev server serves. Same kill, different server.
const preview = spawn('npx',
  process.env.W92_DEV ? ['vite', '--port', String(PORT), '--strictPort']
                      : ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', detached: true });

// Wait for it to actually serve, rather than sleeping a guessed amount.
let up = false;
for (let i = 0; i < 40 && !up; i++) {
  await sleep(250);
  up = (await probeServer(URL, 1000)) === 'ok';
}
if (!up) { try { process.kill(-preview.pid); } catch {} console.error('preview never came up'); process.exit(2); }
console.log(`preview up on ${PORT} (pid ${preview.pid})`);

const t0 = Date.now();
const run = spawn('node', [`scripts/${CHECK}.mjs`, ...PASSTHROUGH],
  { env: { ...process.env, SHOT_URL: URL } });
let out = '';
run.stdout.on('data', (d) => { out += d; });
run.stderr.on('data', (d) => { out += d; });

// KILL IT. `-pid` kills the process GROUP: `npx` forks vite, so killing the npx
// pid alone leaves the real server listening and the probe measures nothing.
await sleep(KILL_AT * 1000);
try { process.kill(-preview.pid, 'SIGKILL'); } catch {}
await sleep(400);
const stateAfterKill = await probeServer(URL, 1000);
console.log(`t+${KILL_AT}s: preview killed — server now reads '${stateAfterKill}'\n`);
if (stateAfterKill !== 'dead') {
  console.error('THE KILL DID NOT WORK — something is still serving that port.');
  console.error('Everything below would be a measurement of a LIVE server. Aborting.');
  try { process.kill(-preview.pid, 'SIGKILL'); } catch {}
  process.exit(2);
}

const code = await new Promise((r) => run.on('close', r));
const secs = ((Date.now() - t0) / 1000).toFixed(1);
try { process.kill(-preview.pid, 'SIGKILL'); } catch {}

console.log(out.trimEnd());
console.log(`\n── ${CHECK}: exit ${code} after ${secs}s, with the server dead from t+${KILL_AT}s ──`);
// Did it say anything about the server AT ALL? A check that fails for an
// unrelated reason is not the same as one that noticed.
const noticed = /server|died|unmeasured|liveness|no longer serving/i.test(out);
console.log(`   mentions the server: ${noticed ? 'YES' : 'NO'}`);
if (code === 0) {
  console.log('\n   VERDICT: GREEN OVER A DEAD WORLD. The check reported a confident pass');
  console.log('   about a server that stopped existing partway through the run.');
} else if (!noticed) {
  console.log('\n   VERDICT: non-zero, but it never says why — indistinguishable from a real defect.');
} else {
  console.log('\n   VERDICT: caught, and it says so.');
}

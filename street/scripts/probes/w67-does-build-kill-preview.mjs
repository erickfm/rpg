// Item 182 asks: does `npm run build` KILL a preview serving the same tree?
//
// Worker sixtyone reported that it does, and that every check afterwards prints
// `SERVER DIED (unmeasured)`. The first half of that is a hypothesis about the
// cause; the second half is an observed symptom. This measures the first half.
//
//   node scripts/probes/w67-does-build-kill-preview.mjs <port>
//
// Poll the preview as fast as the loop allows, run a build against the same
// tree, and record every distinct outcome the poll saw. Three outcomes are
// possible and they are NOT the same news:
//
//   ECONNREFUSED      the process is gone — the server really was killed
//   HTTP 404          the process is alive and dist/ is momentarily empty
//   HTTP 200 only     a build does not disturb the preview at all
//
// `checks.mjs`'s serverAlive() reads `response.ok`, which is false for all
// three, so it cannot tell them apart — which is the whole point.
import { spawn } from 'node:child_process';

const port = process.argv[2] ?? '4230';
const url = `http://localhost:${port}/`;
const seen = new Map();          // outcome -> {n, firstAt, lastAt}
const t0 = Date.now();
let polling = true;

function record(what) {
  const at = Date.now() - t0;
  const e = seen.get(what) ?? { n: 0, firstAt: at, lastAt: at };
  e.n++; e.lastAt = at;
  seen.set(what, e);
}

async function poll() {
  while (polling) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      record(`HTTP ${r.status}`);
    } catch (e) {
      record(String(e.cause?.code ?? e.cause?.message ?? e.name));
    }
  }
}

const loop = poll();
const build = spawn('npm', ['run', 'build'], { stdio: 'ignore' });
const rc = await new Promise((res) => build.on('exit', res));
// keep polling a moment past the build, so a death that lands on the last
// millisecond of it is still caught
await new Promise((r) => setTimeout(r, 1500));
polling = false;
await loop;

console.log(`build exited ${rc}; polled ${url} for ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
for (const [what, e] of [...seen].sort((a, b) => a[1].firstAt - b[1].firstAt))
  console.log(`  ${what.padEnd(18)} ${String(e.n).padStart(5)} polls   ${(e.firstAt / 1000).toFixed(2)}s .. ${(e.lastAt / 1000).toFixed(2)}s`);

const refused = [...seen.keys()].some((k) => /ECONNREFUSED|ECONNRESET|fetch failed/.test(k));
const notFound = seen.has('HTTP 404');
console.log('');
if (refused) console.log('  VERDICT: the preview PROCESS died — the port stopped accepting connections.');
else if (notFound) console.log('  VERDICT: the preview process SURVIVED. dist/ was emptied under it, so it\n'
  + '           served 404 for a window. "SERVER DIED" is the wrong diagnosis.');
else console.log('  VERDICT: a build did not disturb this preview at all.');

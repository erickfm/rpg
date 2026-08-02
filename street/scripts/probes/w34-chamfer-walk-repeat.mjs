// ITEM 67's ACCEPTANCE HARNESS — run w24-chamfer-walk.mjs N times and report
// whether the verdict is STABLE, not merely whether it passed once.
//
// The fault this exists to catch is not "the check is wrong", it is "the check
// disagrees with itself on identical world bytes". §4a walked a fixed 2600 ms
// and so measured how many frames the browser managed, not how far the chamfer
// let the player go: five runs on one bundle cleared 2.58 / 3.48 / 4.63 / 8.32
// / 8.41 m against a 2.83 m face width, so the same world passed three times
// and failed twice. A single green run cannot see that; ten can.
//
// It reports the spread of the §4a distance alongside the pass count, because
// a run that passes for the wrong reason (barely over the line, on a fast
// frame) is the thing that is about to go flaky again.
//
// Usage:
//   SHOT_URL=http://localhost:<port>/ CPU_THROTTLE=8 \
//     node scripts/probes/w34-chamfer-walk-repeat.mjs [runs]
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, 'w24-chamfer-walk.mjs');
const RUNS = Number(process.argv[2] ?? 10);

let passes = 0;
const alongs = [];
for (let i = 1; i <= RUNS; i++) {
  let out = '', code = 0;
  try {
    // Exit code read UNPIPED — `$?` after a pipeline is the last command's
    // status, and this verdict is the whole point of the harness.
    out = execFileSync(process.execPath, [target], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
    code = e.status ?? 1;
  }
  const m = out.match(/(?:cleared the corner|did NOT clear the corner — stopped) \(?([\d.]+) m/);
  const a = m ? Number(m[1]) : NaN;
  alongs.push(a);
  if (code === 0) passes++;
  const verdict = code === 0 ? 'PASS' : 'FAIL';
  console.log(`run ${String(i).padStart(2)}: ${verdict}  §4a cleared ${Number.isNaN(a) ? '??' : a.toFixed(2)} m`);
}

const ok = alongs.filter((v) => !Number.isNaN(v));
if (ok.length) {
  console.log(`\n§4a distance  min ${Math.min(...ok).toFixed(2)}  max ${Math.max(...ok).toFixed(2)}` +
    `  spread ${(Math.max(...ok) - Math.min(...ok)).toFixed(2)} m over ${ok.length} runs`);
}
console.log(`${passes} of ${RUNS} runs passed`);
process.exit(passes === RUNS ? 0 : 1);

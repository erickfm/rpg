// Does a facade's window run TERMINATE, or does it just stop?
//
// The user, on the thrift store: "lazy and chopped off at points". Half of
// that was arithmetic. `facadeWindows()` sized the run as `cols * BAY_M` —
// whole bays — when n windows at BAY_M pitch actually span
// `(n-1) * BAY_M + WIN_W`. The last bay's trailing gap is not part of the run,
// so every facade on the block was centred on something 1.25 m longer than it
// was, and the right-hand end carried exactly BAY_M - WIN_W more blank brick
// than the left. On THRIFT — 12.5 m, three windows — that read as 2.13 m of
// brick at one end and 3.38 m at the other.
//
// It was uniform across all nineteen fronts, which is why it never looked like
// a bug: everything was wrong in the same direction by the same amount, so
// nothing stood out beside anything else. That is the kind of fault a picture
// cannot show you and a number can.
//
// So this asserts the composition, not the pixels:
//
//   · the brick left at each end of the window run is EQUAL, within a texel
//   · the run lies entirely INSIDE the wall — no window half off the edge
//
// A wall too narrow for any window declares cols 0 and is skipped, counted.
// That is a real case (1.4 m returns and piers come through the same painter)
// and not a silent one.
//
// Reads `userData.windows` — the painter publishing its own layout, the same
// move as userData.masonry. Re-measuring the run off the canvas would mean
// re-deriving the arithmetic that was wrong, which cannot catch it being wrong.
//
//   node scripts/facade-run.mjs
//   node scripts/facade-run.mjs --selftest
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4177/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

const r = await p.evaluate(([selftest]) => {
  const s = window.__ct.scene(); const seen = new Set();
  let judged = 0, blind = 0; const off = [], outside = [];
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const w = m?.map?.userData?.windows;
      if (!w || seen.has(m.map.uuid)) continue;
      seen.add(m.map.uuid);
      if (!w.cols) { blind++; continue; }
      let { runX0, runX1, W } = w;
      if (selftest && judged === 0) {
        // put the fencepost back: centre the run on cols * BAY_M rather than
        // on what the windows span. BAY_M 2.75, WIN_W 1.5 at 8 px/m -> 10 texels.
        runX0 -= 5; runX1 -= 5;
      }
      judged++;
      const left = runX0, right = W - runX1;
      if (Math.abs(left - right) > 1) {
        off.push(`${W}x — ${left} texels of brick at one end, ${right} at the other`);
      }
      if (runX0 < 0 || runX1 > W) {
        outside.push(`${W}x — run spans ${runX0}..${runX1}, off the end of the wall`);
      }
    }
  });
  return { judged, blind, off, outside };
}, [SELFTEST]);
await b.close();

if (!r.judged && !SELFTEST) { console.error('no facade published a window run — this check is inert, fix it'); process.exit(2); }
console.log(`${r.judged} facades judged (${r.blind} too narrow for a window, skipped)`);
console.log(`   run not centred: ${r.off.length}`);
for (const h of r.off.slice(0, 8)) console.log(`      ${h}`);
console.log(`   run off the wall: ${r.outside.length}`);
for (const h of r.outside.slice(0, 8)) console.log(`      ${h}`);

const bad = r.off.length + r.outside.length;
if (SELFTEST) {
  if (bad) { console.log('SELFTEST PASSED — a restored fencepost was caught'); process.exit(0); }
  console.error('SELFTEST FAILED — the window run was pushed off centre and this did not notice.');
  process.exit(2);
}
if (!bad) { console.log('  every window run is centred on its wall and inside it'); process.exit(0); }
console.error('  A WINDOW RUN DOES NOT TERMINATE ON ITS WALL — see facadeWindows() in');
console.error('  ct/tex-world.ts. n windows span (n-1)*BAY_M + WIN_W, not n*BAY_M.');
process.exit(1);

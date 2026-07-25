// Are the lit windows a LATTICE again, or a scatter?
//
// The user, with a frame: lit windows formed diagonal stripes. The cause was
// `(f * 7 + c * 3) % 5 === 0` — a linear congruence in floor and column, which
// can only ever land on parallel diagonals. Replaced with an avalanche hash.
//
// Nothing would notice if it came back. From outside, lit windows are bright
// rectangles in a canvas, and "lattice" is a property of (floor, column) that
// pixels do not carry — which is why ct/tex-world.ts now publishes the grid on
// the texture (`userData.windows`) instead of leaving it to be re-derived.
//
// THE TEST IS EXACT, not statistical: a linear congruence lights precisely one
// residue class, so the lit set must EQUAL {(f,c) : (a·f + b·c) mod n == k} for
// some small a, b, n. Searching a<n, b<n, n in 2..6 and requiring exact equality
// makes a coincidence unlikely — and measured on the correct world it is zero.
//
//   7 facades testable, 0 lattice matches
//
// Facades with fewer than 12 windows or fewer than 4 lit are SKIPPED and
// counted: on a small grid an exact match means little, and a check that fires
// on three lit windows would be noise. That is a real coverage limit, not a
// silent one — 27 of 34 are skipped today.
//
//   node scripts/window-lattice.mjs
//   node scripts/window-lattice.mjs --selftest
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

const r = await p.evaluate(([selftest]) => {
  const s = window.__ct.scene(); const seen = new Set();
  let testable = 0, skipped = 0; const hits = [];
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const w = m?.map?.userData?.windows;
      if (!w || seen.has(m.map.uuid)) continue;
      seen.add(m.map.uuid);
      if (selftest && testable === 0 && w.floors * w.cols >= 12) {
        // put back the exact bug: light one residue class and nothing else
        const lit = [];
        for (let f = 0; f < w.floors; f++) for (let c = 0; c < w.cols; c++)
          if (((f * 7 + c * 3) % 5) === 0) lit.push([f, c]);
        w.lit = lit;
      }
      if (w.floors * w.cols < 12 || w.lit.length < 4) { skipped++; continue; }
      testable++;
      const litSet = new Set(w.lit.map(([f, c]) => f + ',' + c));
      let found = null;
      for (let n = 2; n <= 6 && !found; n++)
        for (let a = 0; a < n && !found; a++)
          for (let bb = 0; bb < n && !found; bb++) {
            if (!a && !bb) continue;
            for (let k = 0; k < n; k++) {
              let ok = true;
              for (let f = 0; f < w.floors && ok; f++) for (let c = 0; c < w.cols && ok; c++)
                if ((((a * f + bb * c) % n) === k) !== litSet.has(f + ',' + c)) ok = false;
              if (ok) { found = `${a}f+${bb}c mod ${n} == ${k}`; break; }
            }
          }
      if (found) hits.push(`${w.floors}x${w.cols}, ${w.lit.length} lit — ${found}`);
    }
  });
  return { testable, skipped, hits };
}, [SELFTEST]);
await b.close();

if (!r.testable && !SELFTEST) { console.error('no facade published a window grid — this check is inert, fix it'); process.exit(2); }
console.log(`${r.testable} facades testable (${r.skipped} too small to judge), lattice matches: ${r.hits.length}`);
for (const h of r.hits) console.log(`   ${h}`);
if (SELFTEST) {
  if (r.hits.length) { console.log('SELFTEST PASSED — a restored congruence was caught'); process.exit(0); }
  console.error('SELFTEST FAILED — the lit windows were made a lattice again and this did not notice.');
  process.exit(2);
}
if (!r.hits.length) { console.log('  the lit windows are a scatter, not diagonal stripes'); process.exit(0); }
console.error('  THE LIT WINDOWS ARE ON A LATTICE — the diagonal stripes the user reported.');
console.error('  See litAt() in ct/tex-world.ts: it must be a hash with avalanche, not a');
console.error('  linear congruence in f and c.');
process.exit(1);

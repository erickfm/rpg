// What storm strengths does the world actually draw, over many storms?
//
// The user: *"rain seems extra intense now. thats fine but i want a drizzle to
// also exist and be more likely than the downpour featured here."*
//
// A distribution change is invisible in a single frame, so this samples every
// wet hour over a long run and prints the histogram. `rainAt` and `stormAt` are
// both published on `scene.userData` (ct/props.ts:238, :252) precisely so an
// instrument does not have to hand-copy the formula — two scripts once did and
// both copies were wrong.
//
//   node scripts/probes/w59-storm-dist.mjs [hours]
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const HOURS = Number(process.argv[2] || 20000);
const URL = process.env.SHOT_URL || 'http://localhost:4187/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const r = await p.evaluate((N) => {
  const u = window.__ct.scene().userData;
  if (!u.rainAt || !u.stormAt) return { err: 'rainAt/stormAt not published' };
  const wet = [];
  for (let h = 0; h < N; h++) if (u.rainAt(h)) wet.push(u.stormAt(h));
  return { wet, n: N };
}, HOURS);
await b.close();

if (r.err) { console.log('MISS:', r.err); process.exit(2); }
const w = r.wet;
w.sort((a, c) => a - c);
const q = (f) => w[Math.min(w.length - 1, Math.floor(f * w.length))];
console.log(`${w.length} wet hours out of ${r.n} (${((100 * w.length) / r.n).toFixed(1)}%)`);
console.log(`min ${w[0].toFixed(3)}  p10 ${q(0.1).toFixed(3)}  median ${q(0.5).toFixed(3)}  p90 ${q(0.9).toFixed(3)}  max ${w[w.length - 1].toFixed(3)}`);
console.log(`mean ${(w.reduce((a, c) => a + c, 0) / w.length).toFixed(3)}`);

// histogram over the FULL 0..1 axis, so a floor shows up as empty bins
console.log('\nstrength histogram (full 0..1 axis — empty low bins mean drizzle cannot happen):');
const B = 20;
const bins = new Array(B).fill(0);
for (const v of w) bins[Math.min(B - 1, Math.floor(v * B))]++;
const wide = Math.max(...bins);
for (let i = 0; i < B; i++) {
  const lo = (i / B).toFixed(2), hi = ((i + 1) / B).toFixed(2);
  const bar = '#'.repeat(Math.round((bins[i] / wide) * 54));
  console.log(`  ${lo}-${hi}  ${String(bins[i]).padStart(5)}  ${bar}`);
}

// ── stating the user's question as a number ────────────────────────────────
//
// *"i want a drizzle to also exist and be more likely than the downpour
//  featured here."*
//
// The first cut of this asked whether more than half of storms fall below an
// ABSOLUTE 0.5, and it went red at 48.7% on a distribution that is obviously
// right — bottom bin 826, top bin 254. That was a bad proxy, not a bad world:
// strength does not run 0…1, it runs FLOOR…1, so "below 0.5" is only a quarter
// of the way up the axis and the test was asking whether a quarter contains
// half the mass.
//
// Replaced with a STRICTLY STRONGER statement rather than a looser one, since
// loosening a check until it passes is the failure mode this project has a
// documented family of (GOTCHAS 58). The ask is that lighter weather is more
// common than heavier weather, so: the distribution must DECREASE across every
// quartile of its own range — which implies the light-vs-heavy split and also
// forbids a lumpy distribution that happened to satisfy it on average.
const lo = w[0], hi = w[w.length - 1];
const qs = [0, 1, 2, 3].map((i) =>
  w.filter((v) => v >= lo + ((hi - lo) * i) / 4 && v < lo + ((hi - lo) * (i + 1)) / 4 + (i === 3 ? 1e-9 : 0)).length);
console.log(`\nquartiles of the strength RANGE (${lo.toFixed(2)}…${hi.toFixed(2)}):`);
qs.forEach((c, i) => console.log(`  Q${i + 1} ${(lo + ((hi - lo) * i) / 4).toFixed(2)}-${(lo + ((hi - lo) * (i + 1)) / 4).toFixed(2)}  ${String(c).padStart(5)}  ${((100 * c) / w.length).toFixed(1)}%`));
const decreasing = qs.every((c, i) => i === 0 || c < qs[i - 1]);
console.log(`monotonically decreasing: ${decreasing}   lightest quartile is ${(qs[0] / qs[3]).toFixed(1)}x the heaviest`);

// and the plain-language version, reported for the desk to read
const drizzle = w.filter((v) => v < lo + (hi - lo) * 0.25).length;
const downpour = w.filter((v) => v > 0.9).length;
console.log(`\ndrizzle  (bottom quarter of the range): ${drizzle} (${((100 * drizzle) / w.length).toFixed(1)}%)`);
console.log(`downpour (above 0.90)                 : ${downpour} (${((100 * downpour) / w.length).toFixed(1)}%)`);
const light = drizzle, heavy = downpour;
// ── the assertions, so this can fail ───────────────────────────────────────
// A check that cannot go red is worse than one that is wrong (GOTCHAS 58), and
// this file's whole subject is a knob with the user's complaint at BOTH ends.
// So it guards both ends, not just the one that was reported last.
const fails = [];
// (1) drizzle must be more likely than downpour — the ask, stated two ways
if (!(light > heavy)) fails.push(`drizzle ${light} vs downpour ${heavy} — the user asked for drizzle to be the more common of the two`);
if (!decreasing) fails.push(`the strength distribution is not monotonically decreasing across its range (${qs.join(', ')}) — lighter weather is not reliably more common than heavier`);
// (2) drizzle must EXIST at all — the old floor made it unreachable
if (!(w[0] < 0.45)) fails.push(`the weakest storm in the world is ${w[0].toFixed(3)}; no drizzle can occur`);
// (3) but the weakest storm must still be PLAINLY RAIN. This is the earlier
//     complaint on file, and dropping the floor to satisfy (2) is exactly how
//     it would come back. 0.30 is below the 0.34 floor chosen by eye and above
//     the 0.22/0.28 frames that read as a few specks.
if (!(w[0] >= 0.30)) fails.push(`the weakest storm is ${w[0].toFixed(3)} — below the point where rain still reads as rain, which is the complaint the floor exists for`);
// (4) downpours must still happen
if (!(w[w.length - 1] > 0.9)) fails.push(`the strongest storm is only ${w[w.length - 1].toFixed(3)}; downpours have been lost`);

if (fails.length === 0) {
  console.log('\nPASS: drizzle exists, is the common case, still reads as rain, and downpours survive.');
} else {
  console.log('\nFAIL:');
  for (const f of fails) console.log('  - ' + f);
}
process.exit(fails.length === 0 ? 0 : 1);

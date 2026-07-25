// THE GRADE NEVER PRODUCES AN IMPOSSIBLE COLOUR — at any hour of the day.
//
// Named for what it asserts (GOTCHAS 24). Not to be confused with:
//   nightgrade.mjs  does everything the dimmer TOUCHED actually dim   (A's)
//   regrade.mjs     a one-off regrading pass
// This one asks a narrower and duller question of every material in the world:
// is its colour a real number in 0..1, and its opacity likewise.
//
// WHY IT EXISTS. Six rounds of coverage audit went after space — one of two
// basins, one of nine pools, one street of three. It never asked about TIME.
// Every check on this shelf samples 13:00, 23:00 and 03:00, and the grade ramps
// between them: ct/props.ts multiplies material colours every frame from the
// night curve, the lamp pools and the wet registry, all three of which move
// fastest at dawn and dusk, which is precisely where nothing was looking.
//
// A NaN colour is the failure this is really for. It does not throw, it does not
// log, and three.js will happily upload it — you get a black or white mesh, or
// nothing, and no clue where it came from. The same applies to a negative
// component or an opacity outside 0..1. All of them are silent, and silent is
// the class this project keeps being bitten by.
//
// NOT A CHECK ON THE OVERSHOOT. Sweeping 24 hours also found 739 material-hours
// with a colour component above 1.0 — zero in full day, 9 at night, 91-94 at
// each of 07, 08, 18 and 19. That is real and it is NOT asserted here, because
// 1.08 clamps at render and is pixel-identical to 1.0: it would be a red line
// for something nobody can see. It is recorded in notes/BLOCKED-B.md with the
// numbers, and if tone mapping ever arrives it becomes a defect that day.
//
//   SHOT_URL=http://localhost:4279/ node scripts/grade-sane.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { installMats } from './lib/materials.mjs';
import { setClock } from './lib/clock.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
// 4008d7c3 put the multi-material walk in the page so four checks stop
// retyping it. This one had its own correct copy; one place is better.
await installMats(page);

const bad = [];
let materials = 0;
// WAIT ON THE FRAME, not on a number I picked. I found this delay and named the
// mechanism wrong — "settle ramp" — and 2558b1ba corrected it: the grade does
// not lerp, it costs one rendered frame, and a too-early read returns the
// PREVIOUS time of day in full rather than a half-applied one. Measured both
// ways before accepting the correction:
//
//   23:00 on a FRESH page                 100:0  200:0  400:0  800:9  1600:9
//   23:00 from an already-running world   100:9  200:9  400:9  800:9  1600:9
//
// My repair was 250 ms per hour, which is still a guess — a slower machine or a
// throttled tab moves the number and nothing says so. lib/clock.mjs waits on
// two rendered frames and reports if its cap wins instead of degrading quietly.
for (let h = 0; h < 24; h++) {
  const t = await setClock(page, h, 0);
  if (t.capped) { console.log(`  ${h}:00 — setClock hit its cap; this hour is not trustworthy`); process.exitCode = 1; }
  const r = await page.evaluate(() => {
    const out = { n: 0, faults: [] };
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of window.__mats(o)) {
        const c = m.color; if (!c) continue;
        out.n++;
        const who = () => `${o.userData.mod ?? '?'} ${o.geometry?.type ?? ''} ` +
          `at ${o.position.x.toFixed(1)},${o.position.z.toFixed(1)}`;
        if (!isFinite(c.r) || !isFinite(c.g) || !isFinite(c.b))
          out.faults.push(`NaN colour — ${who()}`);
        else if (Math.min(c.r, c.g, c.b) < -1e-6)
          out.faults.push(`negative colour ${Math.min(c.r, c.g, c.b).toFixed(3)} — ${who()}`);
        if (!isFinite(m.opacity) || m.opacity < -1e-6 || m.opacity > 1.0001)
          out.faults.push(`opacity ${m.opacity} — ${who()}`);
      }
    });
    return out;
  });
  materials = Math.max(materials, r.n);
  for (const f of r.faults) bad.push(`${String(h).padStart(2)}:00  ${f}`);
}

console.log(`\n  swept 24 hours, ${materials} materials each — ${bad.length} impossible values`);
for (const line of bad.slice(0, 10)) console.log(`      ${line}`);
if (bad.length > 10) console.log(`      … and ${bad.length - 10} more`);
console.log(`\n  ${!bad.length ? 'OK  ' : 'FAIL'} every material colour is a real number in 0..1, at every hour`);
console.log(`  ${!bad.length ? 'OK  ' : 'FAIL'} every opacity likewise`);

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (bad.length) process.exit(1);
console.log('\nno page errors');

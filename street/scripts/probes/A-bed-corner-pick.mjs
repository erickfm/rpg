// WHICH [E] DOES THE BED CORNER OFFER? Measured across page loads, because the
// answer is not the same twice.
//
// Three spots contend within a metre or so of the bed in 301 — the bed itself
// ("sleep until morning"), C's TV seat ("sit on the bed and watch TV"), and the
// flat door. Verifying K's sleep fade I found a FIXED square offering "sleep
// until morning" on one load and "close the door" on the next, from identical
// code. Standing still it does not flicker: it settles on one answer and holds,
// then decides differently next time.
//
// "It varies" is not something a desk can act on. This turns it into a map:
// for every square on a grid around the bed, facing the bed, what is offered —
// repeated over several fresh loads, so a square that answers differently
// between runs is visible as a disagreement rather than as one person's bad
// luck.
//
// WHY IT MATTERS: two of the user's own complaints are shaped exactly like this
// — "how do i stop watching the tv" and "pressing e doesnt get me out of it".
// A player standing still, pressing E, and getting a verb other than the one on
// screen would say precisely that.
//
// This REPORTS rather than fails. There is no correct number of squares per
// verb, and a threshold I invented would be worse than the map. What it must
// not do is pass silently having measured nothing, so it exits 3 if the bed
// spot is missing or no load produced a reading.
//
//   node scripts/A-bed-corner-pick.mjs [port] [loads]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';
const LOADS = Number(process.argv[3] ?? 3);
if (!Number.isFinite(LOADS) || LOADS < 2) {
  console.error('\n  loads must be a number >= 2 — a single load cannot show disagreement.\n');
  process.exit(2);
}

const STEP = 0.4, REACH = 1.2;
const b = await chromium.launch();
const runs = [];

for (let run = 0; run < LOADS; run++) {
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  await p.waitForTimeout(2500);
  if (run === 0) await reportWorld(p, URL);

  // Walk clear of the arrival latch, which refuses every spot until you move
  // more than 1.2 m from where you came in.
  const walk = async (k, f) => {
    await p.evaluate((x) => window.dispatchEvent(new KeyboardEvent('keydown', { key: x })), k);
    for (let i = 0; i < f; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await p.evaluate((x) => window.dispatchEvent(new KeyboardEvent('keyup', { key: x })), k);
    await p.waitForTimeout(160);
  };
  const start = await p.evaluate(() => window.__ct.pos());
  for (let k = 0; k < 8; k++) {
    await p.evaluate(([y]) => { const v = window.__ct.pos(); window.__ct.warp(v[0], v[2], y); }, [k * Math.PI / 4]);
    await walk('w', 80);
    const v = await p.evaluate(() => window.__ct.pos());
    if (Math.hypot(v[0] - start[0], v[2] - start[2]) > 1.3) break;
  }

  const bed = await p.evaluate(() => window.__ct.spots().find((s) => /sleep until/i.test(s.label)) ?? null);
  if (!bed) { await p.close(); continue; }

  const grid = {};
  for (let dx = -REACH; dx <= REACH + 1e-9; dx += STEP) {
    for (let dz = -REACH; dz <= REACH + 1e-9; dz += STEP) {
      if (Math.hypot(dx, dz) < 0.2) continue;
      const x = bed.x + dx, z = bed.z + dz;
      const yaw = Math.atan2(bed.x - x, -(bed.z - z));         // face the bed
      await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 5.4, 0), [x, z, yaw]);
      await p.waitForTimeout(240);                              // let the pick settle
      const t = await p.evaluate(() =>
        (document.getElementById('ct-prompt')?.textContent ?? '').trim() || null);
      grid[`${dx.toFixed(1)},${dz.toFixed(1)}`] = (t ?? '—').replace(/^\[E\]\s*/, '');
    }
  }
  runs.push(grid);
  await p.close();
}
await b.close();

if (!runs.length) {
  console.error('\nCANNOT ANSWER — no load produced a bed spot; nothing was measured.\n');
  process.exit(3);                                              // GOTCHAS 32/34
}

const keys = Object.keys(runs[0]);
const short = (s) => (/sleep until/i.test(s) ? 'BED'
  : /watch TV/i.test(s) ? 'TV'
  : /the door/i.test(s) ? 'DOOR'
  : s === '—' ? '·' : s.slice(0, 4));

console.log(`\n${runs.length} fresh loads · ${keys.length} squares each, facing the bed\n`);
for (let i = 0; i < runs.length; i++) {
  const tally = {};
  for (const k of keys) { const v = short(runs[i][k]); tally[v] = (tally[v] ?? 0) + 1; }
  console.log(`  load ${i + 1}: ` + Object.entries(tally).map(([k, n]) => `${k} ${n}`).join('  ·  '));
}

const disagree = keys.filter((k) => new Set(runs.map((r) => short(r[k]))).size > 1);
console.log(`\nsquares that answered DIFFERENTLY between loads: ${disagree.length} of ${keys.length}`);
for (const k of disagree.slice(0, 12)) {
  console.log(`   (${k})  ${runs.map((r) => short(r[k])).join(' → ')}`);
}
console.log(`\nReported, not judged: there is no correct split, and the number that`);
console.log(`matters is the disagreement count — a square that changes its mind`);
console.log(`between loads is one a player cannot learn.`);

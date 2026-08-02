// IS THERE A CLIFF ON THE CHURCH STEPS, OR JUST A STEP?
//
// D-walk reports three reds at the church door: ground reaches 0.45, in ONE
// step of rise, with a 0.34 m jump. Ledger row 57 is CONFIRMED at "gy 0.31 ->
// 0.51". Those disagree, so this prints the ground PROFILE along the approach
// rather than a verdict — a pass/fail cannot tell a strict threshold from a
// cliff. An investigation: it prints, it does not assert.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4181/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// The churchyard gate is at x~9.2; D-walk drives east along z = the yard line.
// Sample the floor picker itself, which is what the player's feet read.
const rows = await p.evaluate(() => {
  const g = window.__ct.groundAt ?? window.__ct.groundPick;
  if (!g) return { err: 'no groundAt/groundPick on __ct — cannot read the floor picker' };
  const out = [];
  for (const z of [-79.9, -79.0, -81.0]) {
    const line = [];
    for (let x = 5.5; x <= 18.0; x += 0.05) line.push([+x.toFixed(2), +g(x, z).toFixed(3)]);
    out.push({ z, line });
  }
  return { out };
});
await b.close();
if (rows.err) { console.log('  ' + rows.err); process.exit(3); }

for (const { z, line } of rows.out) {
  const jumps = [];
  for (let i = 1; i < line.length; i++) {
    const d = line[i][1] - line[i - 1][1];
    if (Math.abs(d) > 0.02) jumps.push(`x ${line[i - 1][0]}->${line[i][0]}: ${line[i - 1][1]} -> ${line[i][1]}  (${d > 0 ? '+' : ''}${d.toFixed(3)})`);
  }
  const lo = Math.min(...line.map((r) => r[1])), hi = Math.max(...line.map((r) => r[1]));
  console.log(`\n  z = ${z}   ground ${lo.toFixed(2)} -> ${hi.toFixed(2)} over x 5.5..18`);
  if (!jumps.length) console.log('    flat, no change');
  for (const j of jumps) console.log('    ' + j);
}

// Jump, and land on the storey you were on.
//
// The floor picker in ct/apartment.ts has hysteresis (GOTCHAS §7) — it is the
// only thing that knows which of four stacked storeys you are on, and a jump
// that carries you higher can hand it a height it reads as the floor above.
// So this is not "does the jump feel right", which is the user's call; it is
// "does the jump still put you back where you started" everywhere the ground
// changes height.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4185/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const warp = (x, z, gy) => p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [x, z, gy]);
const jump = async () => { await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' '); };

const fails = [];
const spots = [
  ['the pavement', -6.0, -20.0, 0.14],
  ['the kerb edge', -5.1, -20.0, 0.14],
  ['the road', -2.0, -20.0, 0],
  ['the walk-up stoop', 6.2, -44.0, 0.14],
  ['inside, ground floor', 104, -16.0, 0],
  ['the apartment stairs', 112, -16.0, null],
  ['upstairs', 120, -16.0, null],
];
for (const [what, x, z, gy] of spots) {
  await warp(x, z, gy ?? 0);
  await p.waitForTimeout(350);
  const before = await pos();
  await jump();
  // measure the apex, then let it land
  let apex = 0;
  for (let t = 0; t < 900; t += 30) { await p.waitForTimeout(30); apex = Math.max(apex, await camY()); }
  await p.waitForTimeout(700);
  const after = await pos();
  const rise = apex - (before[3] + 1.62);
  const sameFloor = Math.abs(after[3] - before[3]) < 0.001;
  console.log(`${what.padEnd(22)} gy ${before[3].toFixed(2)} -> ${after[3].toFixed(2)}  apex +${rise.toFixed(3)} m  ${sameFloor ? 'same floor' : 'CHANGED FLOOR'}`);
  if (!sameFloor) fails.push(`${what}: jumping changed the floor from ${before[3].toFixed(2)} to ${after[3].toFixed(2)}`);
  if (rise < 0.45 || rise > 0.8) fails.push(`${what}: apex ${rise.toFixed(3)} m is outside the intended 0.6 m hop`);
}
console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\njump lands you on the floor you left, everywhere');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

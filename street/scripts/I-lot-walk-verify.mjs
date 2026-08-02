// Walk into each of the lot's three "not just parked" cars (hood-up, jacked,
// on blocks) and confirm the player is physically stopped by each — a
// collision fix must be proven by walking, not by reading the collider list.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4198/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 10000 });

async function warpAndCheckClear(x, z, yaw) {
  await page.evaluate(({ x, z, yaw }) => window.__ct.warp(x, z, yaw), { x, z, yaw });
  await page.waitForTimeout(150);
  const p = await page.evaluate(() => window.__ct.pos());
  const drift = Math.hypot(p[0] - x, p[2] - z);
  return { p, drift };
}

async function walkInto(label, approachX, approachZ, dirX, dirZ, holdMs) {
  // fp.ts: fwd = (sin(yaw), 0, -cos(yaw)) — yaw=0 faces -z.
  const yaw = Math.atan2(dirX, -dirZ);
  const start = await warpAndCheckClear(approachX, approachZ, yaw);
  await page.keyboard.down('w');
  await page.waitForTimeout(holdMs);
  await page.keyboard.up('w');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__ct.pos());
  const traveled = Math.hypot(after[0] - approachX, after[2] - approachZ);
  console.log(`${label}: startDrift=${start.drift.toFixed(3)}m start=(${approachX},${approachZ}) after=(${after[0].toFixed(2)},${after[2].toFixed(2)}) traveled=${traveled.toFixed(2)}m`);
  return { start, after, traveled };
}

// hood car: bay1 collider x[10.2,13] z[-5.4,-1.4], center (11.6,-3.4).
// Approach from the clear aisle at (11.6, 0), walk due south (-z).
const r1 = await walkInto('hood-up car (bay 1)', 11.6, 0.0, 0, -1, 4000);

// jacked car: collider x[25.25,28.05] z[5.3,9.3], center (26.65,7.3).
// Approach from the clear gap between the north row's last bay (ends x=22.45)
// and the office cabin (x starts 26.1), at x=24, walking due east (+x).
const r2 = await walkInto('jacked car (N back corner)', 24.0, 7.3, 1, 0, 4000);

// blocks car (donor): collider x[25.25,28.05] z[-4.1,-0.1], center (26.65,-2.1).
// Same x=24 clear gap, walking due east (+x).
const r3 = await walkInto('blocks car (S back corner, donor)', 24.0, -2.1, 1, 0, 4000);

const results = { hood: r1, jack: r2, blocks: r3 };
let allGood = true;
for (const [name, r] of Object.entries(results)) {
  if (r.start.drift > 0.3) { console.log(`WARNING ${name}: start point was not clear (drift ${r.start.drift.toFixed(2)}m) — retest with a different approach point`); allGood = false; }
  if (r.traveled > 3.5) { console.log(`FAIL ${name}: traveled ${r.traveled.toFixed(2)}m — not stopped, walked through`); allGood = false; }
}
console.log(allGood ? 'ALL THREE STOPPED CLEANLY' : 'SEE WARNINGS/FAILURES ABOVE');

await browser.close();

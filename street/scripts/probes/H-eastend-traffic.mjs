// H: does ANYBODY walk the east end? "0 on the new frontage leg" is worthless
// if no walker goes east of the midblock at all (GOTCHAS §34).
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const SECS = +(process.env.SECS ?? 150);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers, null, { timeout: 60000 });
const bands = { 'x<20': 0, '20-35': 0, '35-45': 0, '45-52': 0, '52-55 (road)': 0, '55.2-57 frontage': 0 };
let n = 0, inband = 0, maxX = -1e9;
const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  for (const [x, z] of await p.evaluate(() => window.__ct.walkers().map((q) => [q.x, q.z]))) {
    n++;
    // ONLY walkers inside the side street. My first version folded the whole
    // main-street crowd into the x<20 bucket, which made the band table
    // meaningless - 5166 samples that said nothing about this street.
    if (z > -94 || z < -112) continue;
    inband++;
    if (x > maxX) maxX = x;
    if (x < 20) bands['x<20']++;
    else if (x < 35) bands['20-35']++;
    else if (x < 45) bands['35-45']++;
    else if (x < 52) bands['45-52']++;
    else if (x < 55.2) bands['52-55 (road)']++;
    else if (x < 57) bands['55.2-57 frontage']++;
  }
  await p.waitForTimeout(130);
}
console.log(`${n} walker samples over ${SECS} s; ${inband} of them inside the side street (z -94..-112)\n  by x band:`);
for (const [k, v] of Object.entries(bands)) console.log(`   ${k.padEnd(18)} ${v}`);
console.log(`\n  furthest east any walker reached in the side street: x ${maxX.toFixed(2)}`);
await b.close();

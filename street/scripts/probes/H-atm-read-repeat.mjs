// H (verifier): M's bank walk dies on money(null) - its atmCash() returned null.
// Is the ATM read intermittent, or does it break after an interior visit?
// M reads it ONCE per call; D documented that a citizen crossing the sightline
// makes a single read a coin toss.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 60000 });
await p.mouse.click(400, 250); await p.waitForTimeout(200);
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const atm = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /use the machine|check balance/i.test(q.label || ''));
  return s ? { x: s.x, z: s.z } : null;
});
console.log('ATM spot:', JSON.stringify(atm));
// M's exact approach: stand at x+0.85, yaw -PI/2, ground 0.14
const readOnce = async () => {
  await p.evaluate(() => window.__ct.warp(-5.0, 20, 0, 0.14, 0));
  await p.waitForTimeout(200);
  await p.evaluate(([x, z]) => window.__ct.warp(x + 0.85, z, -Math.PI / 2, 0.14, 0), [atm.x, atm.z]);
  await p.waitForTimeout(240);
  const t = await prompt();
  const m = /\$([0-9]+\.[0-9]{2})/.exec(t || '');
  return { got: m ? +m[1] : null, prompt: t || '(nothing)' };
};
console.log('\nten reads at M\'s exact station, no bank visit between:');
let nulls = 0;
for (let i = 0; i < 4; i++) {
  const r = await readOnce();
  if (r.got === null) nulls++;
  console.log(`  ${i + 1}: ${r.got === null ? 'NULL  ' + r.prompt.slice(0, 42) : '$' + r.got.toFixed(2)}`);
}
console.log(`\n  ${nulls} of 4 reads returned null at the same station with no state change between.`);
await b.close();

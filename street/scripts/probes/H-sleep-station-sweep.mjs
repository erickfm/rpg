// H: at K's published sleep station, which spot wins - and does any facing give
// the sleep prompt? D's selector weighs screen centre, so yaw matters.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
await p.mouse.click(320, 200); await p.waitForTimeout(200);
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const S = [197.05, -17.20];
console.log(`K's station (${S}), 12 facings:`);
let sleep = 0, tv = 0, none = 0;
for (let i = 0; i < 12; i++) {
  const yaw = (i / 12) * Math.PI * 2;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0), [S[0], S[1], yaw]);
  await p.waitForTimeout(320);
  const t = await prompt() || '(nothing)';
  if (/sleep/i.test(t)) sleep++; else if (/watch TV/i.test(t)) tv++; else none++;
  console.log(`   yaw ${(yaw * 180 / Math.PI).toFixed(0).padStart(3)}°  ${t}`);
}
console.log(`\n  sleep ${sleep} / TV ${tv} / nothing ${none} of 12 facings`);
// and where DOES sleep win? sweep the squares round the bed
const grid = [];
for (let dx = -1.6; dx <= 1.6001; dx += 0.4) for (let dz = -1.6; dz <= 1.6001; dz += 0.4) {
  const x = 197.4 + dx, z = -15.8 + dz;
  await p.evaluate(([a, c]) => window.__ct.warp(a, c, 0, window.__ct.groundAt(a, c), 0), [x, z]);
  await p.waitForTimeout(150);
  const t = await prompt() || '';
  grid.push({ x: +x.toFixed(2), z: +z.toFixed(2), s: /sleep/i.test(t) ? 'S' : /watch TV/i.test(t) ? 'T' : '.' });
}
const S_ = grid.filter((g) => g.s === 'S');
console.log(`\n  swept ${grid.length} squares round the bed at yaw 0: sleep wins on ${S_.length}, TV on ${grid.filter(g=>g.s==='T').length}, neither on ${grid.filter(g=>g.s==='.').length}`);
if (S_.length) console.log(`  a square where SLEEP wins: (${S_[0].x}, ${S_[0].z})`);
await b.close();

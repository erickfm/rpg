// WHICH box is the ±1 between the flat and the street? Names it, rather than
// leaving "one collider differs" as a shrug.
//
// w104-ghosts-sees-the-street.mjs found the static census stable but ONE box
// apart, 5 round trips out of 5: 253 in apartment 301, 252 on the street. A
// difference that reproduces exactly is a fact about the world, not noise, and
// "one collider, probably harmless" is the sentence this project has paid for
// most often. So: diff the two sets by geometry and print the box.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w104-which-collider-moves.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4187/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(800);

const snap = () => p.evaluate(() => window.__ct.staticColliders()
  .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
  .map((c) => `${c.minX.toFixed(2)},${c.maxX.toFixed(2)},${c.minZ.toFixed(2)},${c.maxZ.toFixed(2)}`));

await p.evaluate(() => window.__ct.warp(198, 0, 0, 8, 0));
await p.waitForTimeout(1000);
const inFlat = await snap();
await p.evaluate(() => window.__ct.warp(0, -40, 0, 0, 0));
await p.waitForTimeout(1000);
const onStreet = await snap();
await b.close();

const S = new Set(onStreet), F = new Set(inFlat);
const onlyFlat = inFlat.filter((k) => !S.has(k));
const onlyStreet = onStreet.filter((k) => !F.has(k));

console.log(`  ${inFlat.length} static in apartment 301 · ${onStreet.length} static on the street\n`);
const show = (label, ks) => {
  console.log(`  present ONLY ${label}: ${ks.length}`);
  for (const k of ks) {
    const [x0, x1, z0, z1] = k.split(',').map(Number);
    console.log(`      x ${x0} … ${x1}   z ${z0} … ${z1}`
      + `   (${(x1 - x0).toFixed(2)} × ${(z1 - z0).toFixed(2)} m, centre ${((x0 + x1) / 2).toFixed(2)}, ${((z0 + z1) / 2).toFixed(2)})`);
  }
};
show('in the flat', onlyFlat);
show('on the street', onlyStreet);

// The corridor bands ghosts.mjs actually measures (ghosts.mjs:156): the two
// pavement lanes, x -6.7…-5.0 and 5.0…6.7, z -94…12. A box outside both cannot
// move its verdict however it comes and goes.
const touchesCorridor = (k) => {
  const [x0, x1, z0, z1] = k.split(',').map(Number);
  const band = (lo, hi) => x0 < hi && x1 > lo;
  return (band(-6.7, -5.0) || band(5.0, 6.7)) && z0 < 12 && z1 > -94;
};
const relevant = [...onlyFlat, ...onlyStreet].filter(touchesCorridor);
console.log(`\n  of those, inside ghosts.mjs's two corridor bands (x ±5.0…6.7, z -94…12): ${relevant.length}`);
console.log(relevant.length
  ? '  ** the difference CAN move the corridor verdict — ghosts.mjs must warp before it measures **'
  : '  none — the difference is outside everything ghosts.mjs measures, so its verdict is unaffected');
process.exit(0);

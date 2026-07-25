// feat/trash — look at the comparison rig the way a player does.
//
// The whole point, and the thing round one got wrong: these are judged from
// STANDING EYE HEIGHT AT WALKING DISTANCE, never from above. A flat decal seen
// from 1.7 m two metres away is at about 15-20 degrees off the ground, which
// squashes it to a quarter of its depth. So every shot here is taken from a
// player's eye, walking down the row.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/rig.mjs [shots|probe|all]
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(13, 0));       // flat daylight, no lamp tint
await page.waitForTimeout(600);

const EYE = 1.62;
const shot = async (n, x, z, tx, tz, p) => {
  await page.evaluate(([x, z, tx, tz, gy, p]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, EYE, p]);
  await page.waitForTimeout(340);
  await page.screenshot({ path: `shots/rig-${n}.png` });
};

if (mode === 'probe' || mode === 'all') {
  // nothing in the rig may be solid — you walk over litter — and nothing may
  // be buried in the alley floor, which sits at y = 0.005
  const r = await page.evaluate(() => {
    const sc = window.__ct.scene();
    let lowest = 9, groups = 0;
    sc.traverse((o) => {
      if (o.isGroup && o.position.x < -8 && o.position.x > -11 &&
          o.position.z < -38.5 && o.position.z > -43) {
        groups++;
        lowest = Math.min(lowest, o.position.y);
      }
    });
    return { groups, lowest: +lowest.toFixed(4) };
  });
  console.log(`\n  rig groups placed in the alley: ${r.groups}`);
  console.log(`  lowest base y: ${r.lowest} (alley floor is 0.005)`);
  console.log(`  ${r.groups === 12 ? 'OK  ' : 'FAIL'} twelve candidates on the floor`);
  console.log(`  ${r.lowest >= 0.005 ? 'OK  ' : 'FAIL'} nothing sunk into the alley slab`);
  if (r.groups !== 12 || r.lowest < 0.005) process.exit(1);
}

if (mode === 'shots' || mode === 'all') {
  // walking in off the street, both rows ahead of you
  await shot('approach', -7.6, -37.2, -9.4, -41.0, -0.26);
  // row A (1-6) from a standing walk-by, two metres off
  await shot('rowA-near', -7.3, -39.4, -8.5, -40.6, -0.34);
  await shot('rowA-far', -7.4, -42.6, -8.5, -40.2, -0.32);
  // row B (7-12)
  await shot('rowB-near', -9.2, -38.6, -10.3, -40.2, -0.34);
  await shot('rowB-far', -9.3, -43.0, -10.3, -40.4, -0.32);
  // and the numbering, read from the street side
  await shot('numbers', -7.0, -41.0, -9.6, -40.6, -0.40);
  console.log('shots -> shots/rig-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');

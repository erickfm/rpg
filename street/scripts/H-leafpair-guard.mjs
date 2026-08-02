// H (verifier): does G's leafPair guard actually fire, and is anyone told?
//
// The guard throws when a leaf's handle lands on its hinge. G says "the rooms
// refuse to build". This checks BOTH halves: that it fires (positive control,
// run by hand by inverting the mirror) and that a normal build is clean.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const pageErrs = [], consoleErrs = [];
p.on('pageerror', (e) => pageErrs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.doors, null, { timeout: 60000 });
for (const name of ['SEVENS', 'HOTEL ORPHEUS']) {
  const d = await p.evaluate((n) => window.__ct.doors().find((q) => q.building === n), name);
  await p.evaluate(([x, z, nx, nz]) => window.__ct.warp(x, z, Math.atan2(-nx, nz), window.__ct.groundAt(x, z), 0),
    [d.stand.x, d.stand.z, d.point.nx, d.point.nz]);
  await p.waitForTimeout(500);
  await p.mouse.click(400, 250); await p.waitForTimeout(200);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(1400);
}
const leafErrs = consoleErrs.filter((t) => /leaf mirror is inverted|handle is on the HINGE/i.test(t));
console.log(`entered both rooms.`);
console.log(`  pageerrors:            ${pageErrs.length}`);
console.log(`  console errors:        ${consoleErrs.length}`);
console.log(`  leafPair guard fired:  ${leafErrs.length}`);
for (const t of leafErrs) console.log('    ', t.slice(0, 180));
console.log(leafErrs.length ? '\n  FAIL — a leaf mirror is inverted.' : '\n  both leaf pairs build clean.');
await b.close();
process.exit(leafErrs.length ? 1 : 0);

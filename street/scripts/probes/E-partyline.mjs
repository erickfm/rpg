// NOTHING THE LIBRARY OWNS MAY CROSS ITS PARTY LINES.
//
// The user, on shots/user-libjunction.png: the library's pier and coping are
// "INTERSECTING the neighbour's red brick ... there is no clean joint anywhere
// along the boundary", and the principle they gave is general — *"a building's
// projections must stop at its OWN boundary."*
//
// The library was designed free-standing, with returns and a full classical
// kit. On a party wall every projection that overhangs its width lands inside
// somebody else's building, and BOTH ends are wrong the same way because both
// come out of one loop over s. So this checks both, by measurement, rather
// than trusting that the fix for the end in the screenshot did the other.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
const civ = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (((o.userData && o.userData.mod) || '?') !== 'civic') return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = bb.getCenter(new V3()), s = bb.getSize(new V3());
    if (c.z < -40 || c.z > 20) return;            // the library, not the church
    out.push({ minZ: bb.min.z, maxZ: bb.max.z, cy: +c.y.toFixed(2), sy: +s.y.toFixed(2) });
  });
  return out;
});
// the SLOT is the library's own mass — the full-height elevation boxes
const mass = civ.filter((o) => o.sy > 10);
if (mass.length < 2 || civ.length < 20) {
  console.log(`EXIT 3: found ${mass.length} mass meshes and ${civ.length} library meshes — cannot locate the slot`);
  await b.close(); process.exit(3);
}
const z0 = Math.min(...mass.map((o) => o.minZ)), z1 = Math.max(...mass.map((o) => o.maxZ));
const TOL = 0.002;                                 // 2 mm, not a design allowance
const over = civ.filter((o) => o.minZ < z0 - TOL || o.maxZ > z1 + TOL);
console.log(`library slot z ${z0.toFixed(2)} .. ${z1.toFixed(2)} = ${(z1 - z0).toFixed(2)} m across ${civ.length} meshes`);
for (const o of over) {
  const n = Math.max(z0 - o.minZ, o.maxZ - z1);
  console.log(`  FAIL  y ${o.cy} crosses by ${(n * 1000).toFixed(0)} mm`);
}
console.log(over.length ? `\n${over.length} member(s) cross a party line`
  : `\nnothing the library owns crosses either party line`);
await b.close();
process.exit(over.length ? 1 : 0);

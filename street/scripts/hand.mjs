// Does `side` really disagree with `uDir` on 7 of the 16 frontages?
//
// 2de9134d migrated the interiors onto world coordinates and says `alongU` is the
// only place handedness may be applied, because converting with the building's
// `side` instead applies the mirror TWICE — "side and uDir disagree on 7 of the
// 16 frontages". That number is the whole justification for the helper, so it is
// worth checking from outside rather than taking on trust.
//
// `side` is street.ts:548's -1|1, the side of the street the building sits on,
// which for a z-axis frontage is the sign of facePos.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__frontages !== undefined, { timeout: 20000 });
await reportWorld(p, URL);   // GOTCHAS 26: prove the world, do not name it
const r = await p.evaluate(() => globalThis.__frontages.map(f => ({
  name: f.name, axis: f.axis, uDir: f.uDir, outward: f.outward, face: f.facePos,
})));
const sgn = v => (v > 0 ? 1 : -1);
const cands = {
  'sign(facePos)  [= street.ts side]': f => sgn(f.face),
  'sign(outward)': f => sgn(f.outward),
};
console.log(`${r.length} frontages\n`);
for (const f of r)
  console.log(`  ${f.name.padEnd(16)} axis:${f.axis}  uDir:${String(f.uDir).padStart(2)}  ` +
    `outward:${String(f.outward).padStart(2)}  facePos:${String(f.face).padStart(7)}`);
console.log();
for (const [label, fn] of Object.entries(cands)) {
  const bad = r.filter(f => fn(f) !== sgn(f.uDir));
  console.log(`  ${label.padEnd(34)} disagrees with uDir on ${bad.length} of ${r.length}` +
    (bad.length ? `   (${bad.map(f => f.name).join(', ')})` : ''));
}
await b.close();

// feat/building-depth — is a building a building, or a stage flat?
//
// The complaint was *"every one is a 3.4 m box"*: every shell on the block was
// 3.4 m deep, so from any angle that showed a return you were looking at scenery
// rather than a building. `depthOf` now gives each one 14–23.5 m, varied per
// name.
//
// `9ca895b0`: guard the DEFECT, not the quality. The two halves of the
// complaint were **shallow** and **all the same**, so those are the two
// assertions, and neither is a restatement of `depthOf`:
//
//   1. no shell is shallower than 8 m — the rule is that below roughly a
//      room's depth a shell reads as a flat. 3.4 fails it; 8 would pass it,
//      which is deliberate. This is not "≥ 14" because 14 is `depthOf`'s own
//      floor, and asserting a constant against itself checks plumbing only.
//   2. at least four distinct depths — the other half of the complaint was
//      uniformity, and a world that made every shell 20 m deep would satisfy
//      (1) while reading exactly as wrong.
//
// HOW IT KNOWS WHICH DIMENSION IS DEPTH. It does not guess. `ct/street.ts`
// stamps `userData.facing` ('x' or 'z') on every shell it places, because a
// BoxGeometry carries world-axis width/depth and nothing that says which is
// the front. Inferring it from position misreads the alley's END WALL as a
// 1.2 m building and the bodega's side-street corner block as a 3.4 m one —
// I tried, and it is written up in notes/D-alley-report.md. Only real shells
// carry the stamp, which is also what keeps walls out without a list of
// exceptions.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/shells.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4231/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.waitForTimeout(900);

const shells = await page.evaluate(() => {
  const s = window.__ct.scene();
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.userData.facing) return;
    o.updateWorldMatrix(true, false);
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const at = new o.position.constructor();
    o.getWorldPosition(at);
    out.push({
      depth: +(o.userData.facing === 'x' ? bb.max.x - bb.min.x : bb.max.z - bb.min.z).toFixed(2),
      facing: o.userData.facing,
      at: [+at.x.toFixed(1), +at.z.toFixed(1)],
    });
  });
  return out;
});

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

const depths = shells.map((s) => s.depth).sort((a, b) => a - b);
const distinct = new Set(depths).size;
const shallow = shells.filter((s) => s.depth < 8);

say(shells.length >= 15, 'the block still has its shells',
  `${shells.length} carry a facing stamp`);
say(shallow.length === 0, 'no building is a stage flat',
  shallow.length
    ? `${shallow.length} under 8 m: ` + shallow.map((s) => `${s.depth} m at ${s.at}`).join(', ')
    : `shallowest is ${depths[0]} m`);
say(distinct >= 4, 'they are not all the same building',
  `${distinct} distinct depths, ${depths[0]}–${depths[depths.length - 1]} m`);
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Assert the DEFECT — that the block is full of 3.4 m flats — and require it
  // to fail. If it passes, this is reading something other than the world.
  console.log('\nselftest — asserting the original defect, which must FAIL');
  const before = fails;
  say(shells.filter((s) => s.depth < 8).length > 5, 'the block is 3.4 m flats (the bug)',
    `${shallow.length} shells under 8 m`);
  say(distinct <= 1, 'every shell is the same depth (the bug)', `${distinct} distinct`);
  const caught = fails - before;
  console.log(caught === 2
    ? '\nSELFTEST PASSED — both inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 2 caught`);
  await browser.close();
  process.exit(caught === 2 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe block is built, not flatted');
process.exit(fails ? 1 : 0);

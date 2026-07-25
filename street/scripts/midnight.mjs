// Is anything of mine bright at midnight with no record of why?
//
// `4955621e`: the alley graffiti rendered at full brightness at 23:00 while the
// wall behind it sat at 0.062 — spray paint sixteen times brighter than its
// wall. Nothing caught it. Every assertion about those tags passed, because the
// tags were exactly as bright as they were built to be; it took shooting the
// alley at night, which nobody had ever done.
//
// The cause is `ct/props.ts`'s `isGlass = m.transparent && !(m.alphaTest > 0)`,
// which is the sole gate into "never offered to the dimmer". That predicate was
// carrying three meanings — real glazing, self-lit signage, and decals that
// ought to dim — and `34a3ed95` has since split it.
//
// WHAT THIS ASSERTS, AND WHOSE. Only `mod=street`. A material that is visible,
// bright, and neither `userData.graded` nor `userData.selfLit` has nothing on
// record saying whether that is deliberate. For my module that is a defect, and
// it is the exact regression I introduced: add a transparent decal, forget
// `alphaTest`, and it glows all night.
//
// It does NOT assert on other modules. Neon is legitimately transparent,
// ungraded and bright at midnight — a casino that dimmed its own signs would be
// the bug — so a count there is a question, not a failure. The counts are
// printed because the sweep that produced them turned up three real defects
// (my graffiti, B's crates) and 91 declarations, and because a number nobody
// prints is a number nobody watches.
//
// OPACITY IS PART OF "BRIGHT". The first version of this sweep counted colour
// alone and reported 176. Nine of those were the lamp-splash sheets on the
// building line, which sit at opacity 0 — invisible, so their colour cannot
// matter — and six of vice's were the same. A material at opacity 0 is not
// bright however white it is.
//
// WATCHED FAILING ONLY BY SELFTEST, and here is why that is the honest status.
// The obvious source mutation is to remove the `alphaTest` I added to the alley
// tags — the exact defect this exists for. It no longer reproduces: B split
// `isGlass` in `34a3ed95`, so the tags come back graded either way, measured,
// still 0.115 at 23:00. The route from my file to the bug has been closed at
// the root, which is the best possible reason for a mutation to stop working
// and the worst possible one for claiming a guard is proven.
//
// So: the assertion is sound and inverting it is caught, but I cannot currently
// reach the failure from ct/street.ts. If the predicate in props.ts is ever
// widened again, this is what notices.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/midnight.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => {
  if (integrationNoise(e.message)) return;
  errors.push('pageerror: ' + String(e.message));
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await setClock(page, 23, 0);

const found = await page.evaluate(() => {
  const byMod = {};
  const mine = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x) > 100) return;                 // interiors keep their own light
    const mm = o.material;
    const ms = Array.isArray(mm) ? mm : (mm ? [mm] : []);
    for (const m of ms) {
      if (!m || !m.color) continue;
      if (m.userData?.graded || m.userData?.selfLit) continue;   // it SAID which it is
      const lum = (m.color.r + m.color.g + m.color.b) / 3;
      if (lum <= 0.5) continue;
      const op = m.transparent ? m.opacity : 1;
      if (op <= 0.05) continue;                        // invisible; colour cannot matter
      const mod = o.userData?.mod || '(unstamped)';
      byMod[mod] = (byMod[mod] || 0) + 1;
      if (mod === 'street') {
        mine.push(`lum ${lum.toFixed(2)} opacity ${op.toFixed(2)} `
          + `transparent=${m.transparent} alphaTest=${m.alphaTest} `
          + `${o.geometry.type} at [${wp.x.toFixed(1)},${wp.y.toFixed(1)},${wp.z.toFixed(1)}]`);
      }
    }
  });
  return { byMod, mine };
});

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

const others = Object.entries(found.byMod)
  .filter(([k]) => k !== 'street')
  .sort((a, b) => b[1] - a[1]);
console.log(`  elsewhere, not asserted here: ${others.map(([k, v]) => `${k}=${v}`).join('  ') || 'none'}`);

say(found.mine.length === 0, 'nothing of mine is bright at midnight without saying why',
  found.mine.length
    ? `${found.mine.length} undeclared:\n      ` + found.mine.slice(0, 5).join('\n      ')
    : 'every visible street material is graded or declares selfLit');
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Inverting proves the script reads the world. It does NOT prove the guard
  // catches a regression in ct/street.ts — that needs a source mutation, and
  // the one it was watched failing on is in notes/D-alley-report.md.
  console.log('\nselftest — asserting the defect, which must FAIL');
  const before = fails;
  say(found.mine.length > 0, 'street has undeclared bright materials (the bug)',
    `${found.mine.length} found`);
  const caught = fails - before;
  console.log(caught === 1
    ? '\nSELFTEST PASSED — the inverted assertion was caught'
    : '\nSELFTEST FAILED — the inverted assertion passed, so this measures nothing');
  await browser.close();
  process.exit(caught === 1 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe block keeps its hours after dark');
process.exit(fails ? 1 : 0);

// Item 284 side-finding — DOES `dist/artifact.html` BOOT AT ALL?
//
// The item's DONE WHEN includes "the artifact is clean", so the artifact had to
// be loaded to answer it. `scripts/pack-artifact.mjs:25` inlines
//
//     readdirSync('dist/assets').filter((f) => f.endsWith('.js'))[0]
//
// — THE FIRST JS FILE IN DIRECTORY ORDER. That was the only chunk once. The
// build now emits FOUR (`hud`, `index`, `slots`, `three.core`) and `[0]` is
// `hud-*.js`, not the 957 kB entry chunk `index-*.js` that `dist/index.html`
// actually references. Both of the packer's own guards still pass on the
// result: the module tag really was replaced, and the build stamp really is in
// the hud chunk too.
//
// Usage: SHOT_URL=http://localhost:4720/artifact.html node scripts/probes/w116-artifact-boots.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4720/artifact.html';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
page.on('requestfailed', (r) => errs.push(`REQFAILED: ${r.url().slice(-60)}`));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);

const state = await page.evaluate(() => ({
  hasCt: typeof window.__ct !== 'undefined',
  hasLab: typeof window.__lab !== 'undefined',
  canvases: document.querySelectorAll('canvas').length,
  painted: window.__ct?.painted?.() ?? null,
}));
console.log('URL          ', URL);
console.log('__ct present ', state.hasCt);
console.log('__lab present', state.hasLab, '  (main.ts ran at all?)');
console.log('canvases     ', state.canvases);
console.log('painted      ', JSON.stringify(state.painted));
console.log(`errors       ${errs.length}`);
for (const e of errs.slice(0, 8)) console.log('   ', e.slice(0, 160));

const booted = state.hasCt && state.canvases > 0;
console.log(booted ? 'ARTIFACT BOOTS' : 'ARTIFACT DOES NOT BOOT');
await b.close();
process.exit(booted ? 0 : 1);

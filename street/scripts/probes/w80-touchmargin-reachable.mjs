// CAN A HARNESS GET AT `TOUCH_MARGIN` AT ALL — and on WHICH world?
//
// Item 223 says TOUCH_MARGIN is "exported from fp.ts but NOT published on __ct,
// so no harness can derive it". Seven harnesses appear to contradict that: they
// do `await import('/src/proto/fp.ts')` inside the page and read the constant
// off the module (w40-301-grid, w40-301-who, w40-227-frame, w54-doorway-yaw,
// w54-firing-station, w54-turn-stability, w40-bed-vs-door).
//
// THAT PATH IS THE DEV SERVER ONLY. `vite preview` serves the BUILT bundle out
// of dist/, where `/src/proto/fp.ts` does not exist — so the import 404s and
// every one of those seven cannot answer its own question against the bundle
// the user actually ships. GOTCHAS 28: verify on the built bundle.
//
// This probe measures both worlds rather than asserting either. Point it at a
// `vite preview` and at a `vite dev` and read the two lines side by side.
//
//   SHOT_URL=http://localhost:4360/ node scripts/probes/w80-touchmargin-reachable.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4360/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const viaImport = await p.evaluate(async () => {
  try {
    const m = await import('/src/proto/fp.ts');
    return { ok: true, TOUCH_MARGIN: m.TOUCH_MARGIN, REACH_MARGIN: m.REACH_MARGIN };
  } catch (e) { return { ok: false, err: String(e).slice(0, 120) }; }
});
const viaCt = await p.evaluate(() => ({
  reachMargin: window.__ct.reachMargin ? window.__ct.reachMargin() : null,
  touchMargin: window.__ct.touchMargin ? window.__ct.touchMargin() : null,
}));

console.log(`world: ${URL}`);
console.log(`  import('/src/proto/fp.ts')  ${viaImport.ok
  ? `TOUCH_MARGIN=${viaImport.TOUCH_MARGIN} REACH_MARGIN=${viaImport.REACH_MARGIN}`
  : `UNAVAILABLE — ${viaImport.err}`}`);
console.log(`  __ct                        reachMargin()=${viaCt.reachMargin} touchMargin()=${viaCt.touchMargin}`);
await b.close();

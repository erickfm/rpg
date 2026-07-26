// DOES THE PARK GET WET? The field is `wet(flat(mownT))` and I set
// `vertexColors = true` on that material AFTERWARDS, for the slope shading and
// the dry-crest/damp-hollow tint.
//
// That ordering is the whole question. `wet()` in crosstown.ts captures
// `base: m.color.clone()` AT REGISTRATION, and `updateRain` later drives
// `m.color` between that base and a wet tint. Vertex colours multiply on top of
// `m.color`, so the two should compose — the material colour carries the wet
// state, the vertex colours carry the relief. Should. Every other "should" I
// have written today has cost me an hour, so this measures it.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// the world publishes its own rain rule — don't hand-copy it (props.ts says so)
const hours = await page.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  if (!f) return null;
  // BOTH HOURS IN BROAD DAYLIGHT, and adjacent if possible. The first cut took
  // the first raining hour and the first dry one — 00:30 and 02:30, both night —
  // so any difference it measured could have been the ambient falling between
  // them rather than the rain. A check that can pass for the wrong reason is a
  // check that will, eventually.
  const wet = [], dry = [];
  for (let h = 12; h < 12 + 240; h++) {
    const hh = h % 24;
    if (hh < 11 || hh > 15) continue;         // midday, where the ambient is flat
    (f(h) ? wet : dry).push(h);
  }
  return { wet: wet.slice(0, 6), dry: dry.slice(0, 6) };
});
report('the world publishes its rain rule, and it both rains and does not at midday',
  !!hours && hours.wet.length > 0 && hours.dry.length > 0,
  hours ? `raining at ${hours.wet.join(',')}; dry at ${hours.dry.join(',')} (all 11:00–15:00)`
    : 'scene.userData.rainAt missing');
if (!hours) { await b.close(); process.exit(1); }

// the field is the one mesh in the park carrying a per-vertex colour attribute
const fieldColour = () => page.evaluate(() => {
  let out = null;
  window.__ct.scene().traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.color && Math.abs(o.position.z + 83) < 12) {
      out = { hex: '#' + o.material.color.getHexString(), vc: !!o.material.vertexColors };
    }
  });
  return out;
});
const settle = async (h) => {
  await page.evaluate((h) => window.__ct.clock(h % 24, 30), h);
  await page.waitForTimeout(1400);          // let updateRain drive the colour
};

await settle(hours.dry[0]);
const dry = await fieldColour();
await settle(hours.wet[0]);
const wet = await fieldColour();
console.log(`   field material.color  dry ${dry?.hex}  wet ${wet?.hex}  (vertexColors ${dry?.vc})`);

report('the field still carries its per-vertex relief shading', dry?.vc === true,
  'vertexColors is on the field material');
report('…and the rain still darkens it', dry && wet && dry.hex !== wet.hex,
  dry && wet ? `${dry.hex} -> ${wet.hex}` : 'could not read the field material');

const lum = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16 & 255) + (n >> 8 & 255) + (n & 255)) / 3; };
if (dry && wet) {
  report('…in the right direction — wet ground is darker', lum(wet.hex) < lum(dry.hex),
    `mean channel ${lum(dry.hex).toFixed(0)} dry -> ${lum(wet.hex).toFixed(0)} wet`);
}
await page.evaluate((h) => window.__ct.clock(h % 24, 30), hours.wet[0]);
await page.waitForTimeout(1200);
await page.evaluate(() => window.__ct.warp(-19.0, -84.6, -Math.PI / 2, 0.14, -0.03));
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/E-rain/a-field-in-the-rain.png' });
console.log(fails ? `\n${fails} FAILED` : '\nthe park gets wet');
await b.close();
process.exit(fails ? 1 : 0);

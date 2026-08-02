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

// THE FIELD IS NOT "the vertex-coloured mesh near z -83" — there are TWO, and
// this kept the LAST one traverse happened to reach, which is a 36-vertex prop
// rather than the 728-vertex field. Every reading below was off the wrong mesh.
// Ask for the field by what makes it the field: it is the big one.
const fieldColour = () => page.evaluate(() => {
  let best = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.color) return;
    if (Math.abs(o.position.z + 83) >= 12) return;
    const n = o.geometry.attributes.position.count;
    if (!best || n > best.n) best = { o, n };
  });
  if (!best) return null;
  return { hex: '#' + best.o.material.color.getHexString(),
           vc: !!best.o.material.vertexColors, verts: best.n };
});

// MAKE IT RAIN, rather than asking for an hour when it ought to.
//
// `rainAt` takes the ABSOLUTE hour — `updateRain` calls it with `f.hourAbs`,
// which counts up from world start and never wraps. `clock(h, m)` sets the
// time of DAY. So setting the clock to an hour this scan called wet does not
// make it rain, and the two samples below were both taken in the dry: the
// check reported "the rain does not darken the field" about a world where it
// was not raining. It reads as a finding about the park and is a finding about
// the clock.
//
// So drive time forward and WATCH `rainLevel`, which is the world's own answer
// to "is it raining now". Exit 3 rather than fail if it never rains — that is
// a check that could not run, not a park that stopped getting wet (GOTCHAS 32).
const rainState = () => page.evaluate(() => {
  const u = window.__ct.scene().userData;
  return { rain: u.rainLevel ?? 0, wet: u.wetness ?? 0 };
});
// STAND IN THE PARK BEFORE ASKING WHETHER THE PARK GETS WET. `updateRain`
// gates on the player: `rainAt(hAbs) && px < 100`, and it cuts rainLevel to 0
// outright when px > 100, because it never rains indoors. Run this loop from
// wherever the world happens to drop you and it can spin 40 hours in a room
// and conclude the weather is broken.
await page.evaluate(() => window.__ct.warp(-19.0, -84.6, -Math.PI / 2, 0.24, -0.03));
await page.waitForTimeout(400);

const dry = await fieldColour();
let rainedAfter = null;
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => window.__ct.advanceClock(60, 0.35));    // +1 game hour
  await page.waitForTimeout(900);
  if ((await rainState()).rain > 0.02) { rainedAfter = i + 1; break; }
}
if (rainedAfter === null) {
  console.log('EXIT 3: 40 game hours passed and it never rained — this run cannot answer.');
  await b.close();
  process.exit(3);
}
await page.waitForTimeout(6000);        // wetness rises at ~0.55/s; 1.4 s was not enough
const soaked = await rainState();
const wet = await fieldColour();
console.log(`   rain arrived after ${rainedAfter} game hours; wetness ${soaked.wet.toFixed(2)}`);
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

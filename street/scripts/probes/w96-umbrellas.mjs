// DO UMBRELLAS GO UP WHEN IT RAINS, AND — THE HALF THAT MATTERS — DOWN WHEN IT
// STOPS?
//
// *"give people umbrellas if they're out walking and it rains."*
//
// BOTH SIGNS OR IT PROVES NOTHING. A check that only visits a wet hour cannot
// tell "the umbrellas track the weather" from "the umbrellas are always up",
// and always-up is the likelier bug — it is one inverted comparison away.
// So this walks the clock, classifies each hour by what the umbrellas DID, and
// fails unless it saw both kinds of hour.
//
// The clock is the world's own: `__ct.clock(h, 0)` sets `totalMin = h*60`, and
// `hourAbs` is `floor(totalMin/60)` (crosstown.ts:1877), which is what
// `rainAt(hourAbs)` is asked. So stepping h steps the weather.
//
// `rainLevel` EASES toward its target at dt·0.6 (ct/props.ts:2377) — about 1.7 s
// to cross — and the umbrella has hysteresis on top. So each hour is given real
// settling time; sampling straight after the clock jump reads the PREVIOUS
// hour's weather and would report the feature broken.
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-umbrellas.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4520/');
const HOURS = Number(process.env.HOURS ?? 26);
const SETTLE = 2600;            // ms — comfortably past the 1.7 s rain ramp
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(700);

if ((await p.evaluate(() => window.__ct.walkers()[0]?.umb)) === undefined) {
  console.log('REFUSING TO REPORT: walkers() publishes no `umb` — wrong build.');
  await b.close(); process.exit(3);
}

// out of the flat and onto the street, or it never rains on anybody
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await p.waitForTimeout(1800);

const wet = [], dry = [];
let shotWet = false, shotDry = false;
for (let h = 6; h < 6 + HOURS; h++) {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(SETTLE);
  const w = await p.evaluate(() => window.__ct.walkers());
  const up = w.filter((q) => q.umb > 0.5).length;
  const furled = w.filter((q) => q.umb < 0.05).length;
  (up > 0 ? wet : dry).push({ h, up, furled, n: w.length });
  if (up === w.length && !shotWet) { shotWet = true; await p.screenshot({ path: 'shots/w96-umbrella-rain.png' }); }
  if (furled === w.length && !shotDry) { shotDry = true; await p.screenshot({ path: 'shots/w96-umbrella-dry.png' }); }
  console.log(`hour ${String(h).padStart(3)}  umbrellas up ${up}/${w.length}  furled ${furled}`
    + (up > 0 && up < w.length ? '   ← MIXED' : ''));
}

console.log(`\nhours with umbrellas up:   ${wet.length}`);
console.log(`hours with them all furled: ${dry.length}`);
const mixed = [...wet, ...dry].filter((r) => r.up > 0 && r.up < r.n);
console.log(`hours where only SOME had one: ${mixed.length}`
  + (mixed.length ? `  (${mixed.map((r) => r.h).join(', ')}) — a settling artefact if it is 1-2` : ''));
console.log(`shots: ${shotWet ? 'shots/w96-umbrella-rain.png ' : ''}${shotDry ? 'shots/w96-umbrella-dry.png' : ''}`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
const bad = wet.length === 0 || dry.length === 0;
console.log(bad
  ? `\nFAIL — ${wet.length === 0 ? 'the umbrellas NEVER went up' : 'the umbrellas NEVER came down (always-up is the likely bug)'}`
  : '\nPASS — umbrellas go up in the rain and come down when it stops');
await b.close();
process.exit(bad ? 1 : 0);

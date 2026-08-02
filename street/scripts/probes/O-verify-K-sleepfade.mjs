// IS THE SLEEP FADE ACTUALLY WIRED? — verifying a row that is LANDED and, by
// its own text, was CONFIRMED while not being true.
//
// The row records the hazard exactly: *"K BUILT THE CAPABILITY AND THE BED
// NEVER CALLS IT."* A and D each reproduced that independently. So the only
// question worth asking now is whether C's one call site has landed since, and
// the honest way to ask is the way that found the fault: CONTROL FIRST, then
// the bed, sampling the FADE ELEMENT rather than the clock.
//
// Sampling the clock is what let this pass while being untrue — time really
// does advance, so a check that watches the clock sees a working sleep and a
// black screen that never happened.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-K-sleepfade.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

/** watch the fade overlay for `ms`, returning peak opacity and how many
 *  samples were dark. Reads the ELEMENT, never the clock. 25 ms, K's method. */
const watchFade = (page, ms) => page.evaluate((ms) => new Promise((res) => {
  const t0 = performance.now();
  let peak = 0, dark = 0, samples = 0;
  const tick = () => {
    const el = document.querySelector('#ct-fade')
      ?? [...document.querySelectorAll('div')].find((d) => {
        const s = getComputedStyle(d);
        return s.position === 'fixed' && /rgb\(0, ?0, ?0\)/.test(s.background)
            && parseFloat(s.zIndex || '0') > 0;
      });
    const o = el ? parseFloat(getComputedStyle(el).opacity || '0') : 0;
    peak = Math.max(peak, o); samples++; if (o > 0.9) dark++;
    if (performance.now() - t0 < ms) setTimeout(tick, 25); else res({ peak, dark, samples });
  };
  tick();
}), ms);

// ── CONTROL FIRST ─────────────────────────────────────────────────────────
//
// If the capability itself has gone, a bed that does not fade looks identical
// to one that does but has nothing to call — and the whole point of this row
// is that those two were once confused. GOTCHAS 34.
const hasApi = await p.evaluate(() => typeof window.__hud?.fade === 'function');
console.log(`window.__hud.fade present: ${hasApi}`);
if (!hasApi) {
  console.error('ABORT: no fade API to control against — cannot tell "the bed is not wired"');
  console.error('       from "the capability was removed". Nothing below measures either.');
  await b.close(); process.exit(3);
}
const [control] = await Promise.all([
  watchFade(p, 2600),
  p.evaluate(() => window.__hud.fade({ mid: async () => {} })),
]);
console.log(`CONTROL __hud.fade(): peak ${control.peak.toFixed(3)}, ${control.dark}/${control.samples} dark`);
ok(control.peak > 0.9, `the CAPABILITY works — control peak ${control.peak.toFixed(3)}`);

// ── now the bed ───────────────────────────────────────────────────────────
const sleepSpot = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /sleep/i.test(s.label ?? ''))
  .map((s) => ({ x: s.x, z: s.z, label: s.label }))[0] ?? null);
if (!sleepSpot) { console.error('ABORT: no sleep spot registered anywhere'); await b.close(); process.exit(3); }
console.log(`the sleep spot: ${JSON.stringify(sleepSpot)}`);

// Find the floor by ASKING. 301 is up the walk-up, and a ground-level warp
// stands you three storeys underneath the spot — that cost me five false reds
// on another builder's row earlier tonight.
const FLOOR = await p.evaluate(async ([sx, sz]) => {
  const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let gy = 0; gy <= 14; gy += 0.1) {
    window.__ct.warp(sx, sz, 0, gy, 0);
    await wait();
    const s = window.__ct.spots().filter((s) => /sleep/i.test(s.label ?? ''))[0];
    if (s?.ok) return +window.__ct.pos()[3].toFixed(2);
  }
  return null;
}, [sleepSpot.x, sleepSpot.z]);
if (FLOOR === null) { console.error('ABORT: the sleep spot never arms at any floor'); await b.close(); process.exit(3); }
console.log(`it arms at gy ${FLOOR}`);

await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [sleepSpot.x, sleepSpot.z, FLOOR]);
await afterFrames(p, 6);
const clockBefore = await p.evaluate(() => window.__ct.clockNow().totalMin);
const [bed] = await Promise.all([
  watchFade(p, 4500),
  p.keyboard.press('e'),
]);
const clockAfter = await p.evaluate(() => window.__ct.clockNow().totalMin);
const hours = ((clockAfter - clockBefore + 1440) % 1440) / 60;
console.log(`BED [E]: peak ${bed.peak.toFixed(3)}, ${bed.dark}/${bed.samples} dark, clock +${hours.toFixed(1)} h`);

// The clock moving is what made this pass while being untrue, so it is
// reported as CONTEXT and is deliberately not the claim.
ok(hours > 1, `the sleep itself happened — clock +${hours.toFixed(1)} h (context, not the claim)`);
ok(bed.peak > 0.9,
  `THE SCREEN FADES TO BLACK when you sleep — peak ${bed.peak.toFixed(3)}, ` +
  `${bed.dark}/${bed.samples} samples black, against a control of ${control.peak.toFixed(3)}`);

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);

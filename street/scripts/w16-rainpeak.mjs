// WHAT IS THE REAL CEILING ON rainLevel?
//
// Queue item 7 says "peak material opacity was 0.155 (0.55 * rainLevel), so
// rainLevel never exceeds ~0.28". 0.28 is exactly what the lerp
// `rainLevel += (1 - rainLevel) * dt * 0.6` reaches after ~0.55 s of real
// time — so the number is equally consistent with "the ceiling is 0.28" and
// with "the scan stepped the clock every half second and never let the lerp
// settle". Those are different worlds and only one of them needs a fix.
//
// So: sit OUTDOORS at an hour the world itself calls raining, hold it, and
// watch rainLevel every 250 ms until it stops moving. Report the settled
// value and how long it took. Traps guarded (both documented in rainlive.mjs):
//   · spawn is INDOORS at x ~198 and updateRain cuts rain above x 100
//   · rainLevel LERPS — one sample after a clock jump is meaningless
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4195/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await p.waitForTimeout(1200);

const hours = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  const out = [];
  for (let h = 0; h < 72; h++) if (f(h)) out.push(h);
  return out;
});
console.log(`rainAt() calls these absolute hours rainy (first 72): ${hours.join(', ')}`);

// the longest run of consecutive rainy hours — a real storm, not a single hour
let best = [hours[0]], run = [hours[0]];
for (let i = 1; i < hours.length; i++) {
  if (hours[i] === hours[i - 1] + 1) run.push(hours[i]);
  else run = [hours[i]];
  if (run.length > best.length) best = [...run];
}
console.log(`longest consecutive wet run in that window: hours ${best.join(',')} (${best.length} h)`);

await p.evaluate(() => window.__ct.warp(-6, -40, 0, 0.14, 0));
// THE ABSOLUTE HOUR, NOT h % 24. `hourAbs` is `Math.floor(totalMin / 60)`
// (crosstown.ts:999) and `rainAt` hashes it with murmur3's finalizer, which is
// not periodic in 24 — so `clock(h % 24)` asks a DIFFERENT question than
// `rainAt(h)` answered and lands on a dry hour. `clock()` takes any h, so pass
// the absolute one. (scripts/rainlive.mjs still has the `% 24` form.)
await p.evaluate(([h]) => window.__ct.clock(h, 5), [best[0]]);

const read = () => p.evaluate(() => {
  const s = window.__ct.scene();
  let rain = null;
  s.traverse((o) => { if (o.type === 'Points' && o.material?.map) rain = o; });
  return {
    rainLevel: s.userData.rainLevel,
    wetness: s.userData.wetness,
    opacity: rain?.material.opacity ?? null,
    visible: rain?.visible ?? null,
    size: rain?.material.size ?? null,
    count: rain?.geometry.getAttribute('position').count ?? null,
    x: window.__ct.pos()[0][0] ?? window.__ct.pos()[0],
    clock: window.__ct.clockNow(),
  };
});

const t0 = Date.now();
let prev = null, settledAt = null, r = null;
console.log('\n   t(s)  rainLevel  opacity  wetness');
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(250);
  r = await read();
  const t = (Date.now() - t0) / 1000;
  if (i % 2 === 0 || i < 6) {
    console.log(`  ${t.toFixed(2).padStart(5)}  ${r.rainLevel.toFixed(4).padStart(9)}  ${(r.opacity ?? 0).toFixed(4).padStart(7)}  ${r.wetness.toFixed(4).padStart(7)}`);
  }
  if (prev !== null && Math.abs(r.rainLevel - prev) < 0.0005 && settledAt === null && r.rainLevel > 0.05) settledAt = t;
  prev = r.rainLevel;
  if (settledAt !== null && t - settledAt > 3) break;
}
console.log(`\n  SETTLED rainLevel = ${r.rainLevel.toFixed(4)}  (material opacity ${r.opacity.toFixed(4)}, size ${r.size}, ${r.count} drops)`);
console.log(`  settled after ~${settledAt?.toFixed(1)} s of real time; a game hour is 60 real s`);
console.log(`  clock now ${JSON.stringify(r.clock)}   player x ${JSON.stringify(r.x)}`);
console.log(errs.length ? `\n  page errors: ${errs.join('\n')}` : '\n  no page errors');
await b.close();

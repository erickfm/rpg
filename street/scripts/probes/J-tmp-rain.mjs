import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(3000);
const rain = () => p.evaluate(() => {
  const u = window.__ct.scene().userData;
  return { level: u.rainLevel ?? -1, wet: u.wetness ?? -1 };
});
// WAIT FOR THE VALUE TO STOP MOVING, not for a fixed time (GOTCHAS §30).
// rainLevel eases at dt*0.6, so "4 seconds" is a bet on how busy the machine is
// -- my first pass read 0.56 at a hour that settles to 0.98 and I nearly filed it.
const settle = async (label, maxMs = 40000) => {
  let prev = await rain(), stable = 0, t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await p.waitForTimeout(500);
    const now = await rain();
    if (Math.abs(now.level - prev.level) < 0.0005 && Math.abs(now.wet - prev.wet) < 0.0005) stable++;
    else stable = 0;
    prev = now;
    if (stable >= 4) break;
  }
  return { ...prev, secs: ((Date.now() - t0) / 1000).toFixed(1) };
};
const go = async (x, h, m, label) => {
  await p.evaluate(([x, h, m]) => { window.__ct.warp(x, 0, 0, undefined, 0); window.__ct.clock(h, m); }, [x, h, m]);
  const r = await settle(label);
  console.log(`  ${label.padEnd(42)} rainLevel ${r.level.toFixed(4)}  wetness ${r.wet.toFixed(4)}   (settled in ${r.secs}s)`);
  return r;
};
console.log('THE CONTROL: does the signal TRACK the hour, or is it just always on?');
const w1 = await go(-6, 0, 30, 'outdoors x -6, hour 00:30  rainAt says WET');
const d1 = await go(-6, 12, 0, 'outdoors x -6, hour 12:00  rainAt says DRY');
const w2 = await go(-6, 16, 0, 'outdoors x -6, hour 16:00  rainAt says WET');
const d2 = await go(-6, 19, 0, 'outdoors x -6, hour 19:00  rainAt says DRY');
console.log(`\n  wet hours  -> ${w1.level.toFixed(4)}, ${w2.level.toFixed(4)}`);
console.log(`  dry hours  -> ${d1.level.toFixed(4)}, ${d2.level.toFixed(4)}`);
console.log(`  TRACKS THE HOUR: ${w1.level > 0.9 && w2.level > 0.9 && d1.level < 0.02 && d2.level < 0.02 ? 'YES' : 'NO'}`);
await b.close();

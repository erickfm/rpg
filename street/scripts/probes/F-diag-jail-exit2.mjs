import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4184/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => { (window).__F_DEBUG = true; });
p.on('console', (msg) => { if (msg.text().includes('F-DEBUG')) console.log('PAGE:', msg.text()); });
await afterFrames(p, 10); await p.waitForTimeout(900);

// Walk to the door for real
await p.evaluate(() => window.__ct.warp(53.5, -103.0, Math.PI / 2, 0, 0));
await afterFrames(p, 4);
await p.keyboard.down('w');
let last = null, still = 0;
for (let i = 0; i < 90 && still < 6; i++) {
  await afterFrames(p, 3);
  const q = await p.evaluate(() => window.__ct.pos());
  if (last !== null && Math.hypot(q[0] - last[0], q[2] - last[2]) < 0.01) still++; else still = 0;
  last = q;
}
await p.keyboard.up('w');
await p.evaluate(() => { (window).__F_frameLog.length = 0; });
await p.waitForTimeout(1000);
const fpsSampleE = await p.evaluate(() => (window).__F_frameLog.slice());
const fpsGapsE = fpsSampleE.slice(1).map((t, i) => t - fpsSampleE[i]);
const avgGapE = fpsGapsE.reduce((a, b) => a + b, 0) / (fpsGapsE.length || 1);
console.log(`STANDING AT ENTRANCE (d~0.25, fast path, no raycast): ${fpsSampleE.length} frames in 1000ms, avg gap ${avgGapE.toFixed(1)}ms => ~${(1000/avgGapE).toFixed(1)} fps`);
await p.evaluate(() => { (window).__F_frameLog.length = 0; });
await p.keyboard.press('e');
const frameLog0 = await p.evaluate(() => (window).__F_frameLog.slice());
console.log('ENTRANCE press: frames rendered during press():', frameLog0.length);
const crossed = await p.evaluate(() => new Promise((res) => {
  const t0 = performance.now();
  const tick = () => {
    if (window.__ct.pos()[0] > 400) return res(true);
    if (performance.now() - t0 > 25000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}));
console.log('crossed in:', crossed);
const inside = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log('inside at:', inside);
let landing0 = await p.evaluate(() => window.__ct.landing());
console.log('landing right after entering:', landing0);

// walk deep
await p.evaluate(([x, z]) => window.__ct.warp(x + 1.95, z - 1.0, 0, 0, 0), [inside[0], inside[2]]);
await afterFrames(p, 4);
await p.keyboard.down('w');
let l2 = null, s2 = 0;
for (let i = 0; i < 120 && s2 < 6; i++) {
  await afterFrames(p, 3);
  const q = await p.evaluate(() => window.__ct.pos());
  if (l2 !== null && Math.hypot(q[0] - l2[0], q[2] - l2[2]) < 0.01) s2++; else s2 = 0;
  l2 = q;
}
await p.keyboard.up('w');
const deep = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log('deep at:', deep, 'travelled', Math.abs(deep[2]-inside[2]));
let landing1 = await p.evaluate(() => window.__ct.landing());
console.log('landing after deep walk:', landing1);

// warp back to entrance
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0), [inside[0], inside[2]]);
await afterFrames(p, 5);

let landing2 = await p.evaluate(() => window.__ct.landing());
let pos2 = await p.evaluate(() => window.__ct.pos());
let spots2 = await p.evaluate(() => window.__ct.spots().filter(s => /street/i.test(s.label ?? '')));
console.log('after warp back: pos', pos2, 'landing', landing2);
console.log('nearby out-spots:', JSON.stringify(spots2.filter(s => Math.hypot(s.x-pos2[0], s.z-pos2[2]) < 3)));

const activeBefore = await p.evaluate(() => (window).__F_lastActive);
console.log('active spot right before E:', activeBefore);
await p.evaluate(() => { (window).__F_frameLog.length = 0; });
await p.waitForTimeout(1000);
const fpsSample = await p.evaluate(() => (window).__F_frameLog.slice());
const fpsGaps = fpsSample.slice(1).map((t, i) => t - fpsSample[i]);
const avgGap = fpsGaps.reduce((a, b) => a + b, 0) / (fpsGaps.length || 1);
console.log(`STANDING AT EXIT SPOT (d=0.78, needs raycast): ${fpsSample.length} frames in 1000ms, avg gap ${avgGap.toFixed(1)}ms => ~${(1000/avgGap).toFixed(1)} fps`);
await p.evaluate(() => { (window).__F_frameLog.length = 0; });
await p.keyboard.press('e');
const frameLog = await p.evaluate(() => (window).__F_frameLog.slice());
const gaps = frameLog.slice(1).map((t, i) => +(t - frameLog[i]).toFixed(2));
console.log('frame gaps (ms) around the press:', gaps.slice(0, 10), '... fps~', (1000/(gaps.reduce((a,b)=>a+b,0)/gaps.length)).toFixed(1));
console.log('pressed E (bare tap) to exit; polling...');
for (let i = 0; i < 15; i++) {
  await p.waitForTimeout(200);
  const pos = await p.evaluate(() => window.__ct.pos());
  const landing = await p.evaluate(() => window.__ct.landing());
  const act = await p.evaluate(() => (window).__F_lastActive);
  console.log(`  +${(i+1)*200}ms pos:`, pos, 'landing:', landing, 'active:', act);
  if (pos[0] < 100) { console.log('LEFT the room'); break; }
}

await b.close();

// THE PITCH CLAMP, BOTH SIGNS AND ALL THREE PATHS.
//
// Item 275 hoisted fp.ts's three hand-typed `1.3`s into one exported
// `PITCH_LIMIT` so the watch gate could measure back from it. That is a pure
// refactor of the LOOK code, and the failure mode of a pure refactor is a typo
// in the direction nobody tests: the item only ever needed pitch DOWN, and the
// up clamp and the mouse clamp would have stayed silently broken.
//
// So: hold ArrowUp, hold ArrowDown, and drag the mouse — the three sites that
// were literals — and require |74.485| on each. That number is MEASURED here,
// not asserted: the reference is whatever the ArrowDown path settles at, and
// the other two are compared against it, so this file has no copy of 1.3 in it
// either.
//
//   SHOT_URL=http://localhost:4661/ node scripts/probes/w110-pitch-clamp-both-signs.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4661/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.camera !== undefined, { timeout: 30000 });

const deg = () => p.evaluate(() => {
  const c = window.__ct.camera();
  const v = c.getWorldDirection(c.position.clone());
  return Math.asin(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI;
});
const level = async () => { await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, 0)); await p.waitForTimeout(300); };
const hold = async (key) => {
  await level();
  await p.keyboard.down(key);
  await p.waitForTimeout(2600);            // 1.2 rad/s needs 1.09 s for 1.3 rad
  await p.keyboard.up(key);
  await p.waitForTimeout(200);
  return deg();
};

const down = await hold('ArrowDown');
const up = await hold('ArrowUp');
await level();
await p.mouse.move(480, 300); await p.mouse.down();
for (let i = 0; i < 40; i++) await p.mouse.move(480, 300 - i * 30);   // drag up, hard
await p.mouse.up(); await p.waitForTimeout(200);
const mouseUp = await deg();
await level();
await p.mouse.move(480, 300); await p.mouse.down();
for (let i = 0; i < 40; i++) await p.mouse.move(480, 300 + i * 30);   // and down
await p.mouse.up(); await p.waitForTimeout(200);
const mouseDown = await deg();

const REF = Math.abs(down);
const rows = [['ArrowDown', down, -REF], ['ArrowUp', up, REF],
  ['mouse up', mouseUp, REF], ['mouse down', mouseDown, -REF]];
const fail = [];
for (const [n, got, want] of rows) {
  const ok = Math.abs(got - want) < 0.01;
  console.log(`${n.padEnd(11)} ${got.toFixed(3).padStart(8)} deg  want ${want.toFixed(3).padStart(8)}  ${ok ? 'ok' : 'MISMATCH'}`);
  if (!ok) fail.push(`${n} ${got.toFixed(3)} != ${want.toFixed(3)}`);
}
if (REF < 60 || REF > 80) fail.push(`reference clamp ${REF.toFixed(3)} deg is not a plausible neck`);
if (errs.length) fail.push(`${errs.length} console errors`);
console.log(fail.length ? `FAIL: ${fail.join('; ')}` : `PASS — clamp symmetric at +/-${REF.toFixed(3)} deg on all three paths`);
await b.close();
process.exit(fail.length ? 1 : 0);

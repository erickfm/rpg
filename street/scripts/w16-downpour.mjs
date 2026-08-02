// LOOK AT A DOWNPOUR AT PEAK, FACING FOUR WAYS — a shot sheet, plus the one
// number a picture cannot give you: how many drops are inside the frustum.
//
// Rides at a genuinely rainy ABSOLUTE hour (rainAt hashes hourAbs, which is
// not periodic mod 24 — pass the raw hour to __ct.clock, not h % 24) and waits
// for the lerp to settle before shooting anything.
//
// WHAT THIS DELIBERATELY NO LONGER DOES. It used to hide the drops and diff
// the two frames to report a "rain pixel budget". That number was worthless
// twice over and both failures are worth remembering:
//   · hiding with `points.visible = false` does nothing — updateRain writes
//     `rain.visible` every frame, so the "no rain" frame had rain in it.
//   · even with `scene.remove()`, the two frames are ~300 ms apart and cars
//     and pedestrians move far more pixels in that time than the rain does.
//     It reported 13% "rain" on a heading where a 3x native crop showed not
//     one streak — because the rain object was being frustum-culled outright.
// For "is the rain actually drawn", use scripts/w16-raindrawn.mjs, which reads
// onBeforeRender and is exact. This script is for LOOKING.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4195/';
const TAG = process.argv[2] ?? 'now';
const OUT = `shots/w16-rain-${TAG}`;
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await settle(p);

// A DAYTIME rainy hour. The original complaint (queue 5b) is that the streak
// dissolves into a PALE SKY — that reading only exists in daylight, and the
// first rainy hour in the sequence happens to be 06:10, pre-dawn, where every
// drop reads against near-black and the bug cannot be seen at all.
const hour = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  for (let h = 24; h < 4000; h++) {
    const d = ((h % 24) + 24) % 24;
    if (d >= 11 && d <= 15 && f(h)) return h;
  }
  return null;
});
if (hour === null) { console.error('no consecutive rainy hours found'); await b.close(); process.exit(1); }

await p.evaluate(() => window.__ct.warp(-6, -34, 0, 0.14, 0));
await p.evaluate(([h]) => window.__ct.clock(h, 10), [hour]);

// settle the lerp: do not sample once (this is the trap that produced the
// "peak opacity 0.155" reading the queue item was built on)
let lvl = 0;
for (let i = 0; i < 80; i++) {
  await p.waitForTimeout(250);
  lvl = await p.evaluate(() => window.__ct.scene().userData.rainLevel);
  if (lvl > 0.99) break;
}
console.log(`absolute hour ${hour} (${hour % 24}:10), settled rainLevel ${lvl.toFixed(4)}`);

const views = [
  ['N-along-street', 0],
  ['E-across', Math.PI / 2],
  ['S-along-street', Math.PI],
  ['W-across', -Math.PI / 2],
];

const rows = [];
for (const [name, yaw] of views) {
  await p.evaluate(([y]) => window.__ct.warp(-6, -34, y, 0.14, 0), [yaw]);
  await p.waitForTimeout(400);

  const inView = await p.evaluate(() => {
    const THREE = window.__ct.three ?? null;
    const s = window.__ct.scene();
    const cam = window.__ct.camera();
    let rain = null;
    s.traverse((o) => { if (o.type === 'Points' && o.material?.map) rain = o; });
    cam.updateMatrixWorld();
    const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
    const a = rain.geometry.getAttribute('position');
    const e = m.elements;
    let n = 0;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw <= 0) continue;
      const cx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / cw;
      const cy = (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw;
      const cz = (e[2] * x + e[6] * y + e[10] * z + e[14]) / cw;
      if (cx >= -1 && cx <= 1 && cy >= -1 && cy <= 1 && cz >= -1 && cz <= 1) n++;
    }
    return { n, opacity: rain.material.opacity, size: rain.material.size, total: a.count };
  });

  await p.screenshot({ path: `${OUT}/${name}.png` });
  rows.push({ name, ...inView });
}


console.log(`\n  view                drops inside the frustum`);
for (const r of rows) {
  console.log(`  ${r.name.padEnd(18)} ${String(r.n).padStart(10)} / ${r.total}`);
}
console.log(`\n  material opacity at peak ${rows[0].opacity.toFixed(4)}, point size ${rows[0].size}`);
console.log(`  shots in ${OUT}/`);
console.log(errs.length ? `  page errors: ${errs.join('\n')}` : '  no page errors');
await b.close();

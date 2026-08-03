// HOLD THE KEY AND WATCH IT COME UP — the item's own instruction, because a
// gate read out of the source is a hypothesis and an angle you reach by
// actually pitching down is the number the player has.
//
// Pitch is DERIVED from the camera's world direction (`asin(dir.y)` off
// `__ct.camera()`), not from `rig.pitch`, which `__ct` does not publish and
// which would be the same number twice anyway. "Up" is read off the live
// element's computed transform: the shown state translates by WATCH_DROP px,
// the stowed one by 140%, so the matrix' f term tells them apart without any
// constant being retyped here.
//
//   SHOT_URL=http://localhost:4661/ node scripts/probes/w110-watch-hold-the-key.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4661/');
const RUNS = Number(process.env.RUNS ?? 5);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 958 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.camera !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, 0));
await p.evaluate(() => window.__ct.clock(14, 37));
await p.waitForTimeout(1200);

const sample = () => p.evaluate(() => {
  const cam = window.__ct.camera();
  const d = new (cam.getWorldDirection(new cam.position.constructor()).constructor)();
  cam.getWorldDirection(d);
  const w = document.getElementById('ct-watch');
  const m = new DOMMatrix(getComputedStyle(w).transform);
  return { deg: -Math.asin(Math.max(-1, Math.min(1, d.y))) * 180 / Math.PI, ty: m.f };
});

const summary = [];
for (let run = 0; run < RUNS; run++) {
  await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, 0));
  await p.waitForTimeout(500);
  const stowedTy = (await sample()).ty;

  await p.keyboard.down('ArrowDown');
  let firstUp = null, maxDeg = 0, lastTy = stowedTy;
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    const s = await sample();
    if (s.deg > maxDeg) maxDeg = s.deg;
    // "up" = the wrapper is no longer parked at the stowed translate
    if (firstUp === null && Math.abs(s.ty - stowedTy) > 4) firstUp = s.deg;
    lastTy = s.ty;
  }
  await p.keyboard.up('ArrowDown');
  await p.waitForTimeout(400);
  const settled = await sample();
  summary.push({ run, stowedTy: +stowedTy.toFixed(1), firstUpDeg: firstUp === null ? null : +firstUp.toFixed(2),
    maxDeg: +maxDeg.toFixed(2), settledDeg: +settled.deg.toFixed(2), shownTy: +settled.ty.toFixed(1), lastTy: +lastTy.toFixed(1) });
}

// NEGATIVE CASE — pitch back UP above the gate and the watch must go away
// again. A check that only ever sees the watch arrive cannot tell a gate from
// a `true`.
await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, 0));
await p.waitForTimeout(600);
const up = await sample();

console.log('run stowedTy  first-up-deg  max-deg  settled-deg shownTy');
for (const s of summary) {
  console.log(String(s.run).padEnd(4), String(s.stowedTy).padStart(8),
    String(s.firstUpDeg).padStart(13), String(s.maxDeg).padStart(8),
    String(s.settledDeg).padStart(12), String(s.shownTy).padStart(7));
}
const ups = summary.map((s) => s.firstUpDeg).filter((v) => v !== null);
const maxs = summary.map((s) => s.maxDeg);
console.log(`first-up spread ${Math.min(...ups).toFixed(2)}..${Math.max(...ups).toFixed(2)} deg`);
console.log(`max-pitch spread ${Math.min(...maxs).toFixed(2)}..${Math.max(...maxs).toFixed(2)} deg`);
console.log(`NEGATIVE: back at level, deg ${up.deg.toFixed(2)}, ty ${up.ty.toFixed(1)} `
  + `(stowed was ${summary[0].stowedTy}) -> ${Math.abs(up.ty - summary[0].stowedTy) < 4 ? 'STOWED ok' : 'STILL SHOWN — BAD'}`);
console.log('errors', errs.length, errs.slice(0, 3));
await b.close();

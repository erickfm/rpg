// ITEM 156 — what IS the column the edge detector keeps landing on?
// Prints the night/day column profile across a window of columns, plus the
// nearest mesh each column's mid-row ray hits, so the jump can be attributed to
// a surface instead of guessed at from a picture.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const Z = Number(process.argv[2] ?? -50);
const LO = Number(process.argv[3] ?? 460), HI = Number(process.argv[4] ?? 540);
// ROW BAND, not the whole facade. Averaging rows 0..430 puts the upper storeys'
// LIT WINDOWS in the same column as the splash, and a lit window is genuinely
// bright with a genuinely hard edge — so the whole-facade profile's biggest jump
// is usually a window frame, which is correct behaviour and drowns the thing
// being measured. Rows 300..380 cross the wall splash and no window.
const W = 1000, H = 640;
const ROW0 = Number(process.env.ROW0 ?? 300), ROW1 = Number(process.env.ROW1 ?? 380);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);
await p.evaluate(([ZZ]) => window.__ct.warp(-2.0, ZZ, Math.PI / 2, 0, 0.08), [Z]);
await p.waitForTimeout(250);
const columns = () => p.evaluate(([w, h, r0, r1]) => {
  const c = document.querySelector('canvas');
  const g = document.createElement('canvas'); g.width = w; g.height = h;
  const cx = g.getContext('2d', { willReadFrequently: true });
  cx.drawImage(c, 0, 0, w, h);
  const d = cx.getImageData(0, r0, w, r1 - r0).data;
  const out = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < r1 - r0; y++) { const i = ((y * w) + x) << 2; s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; }
    out[x] = s / (r1 - r0);
  }
  return out;
}, [W, H, ROW0, ROW1]);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(450); await waitPainted(p);
const day = await columns();
await p.evaluate(() => window.__ct.clock(23, 0));
await p.waitForTimeout(450); await waitPainted(p);
const night = await columns();
const hits = await p.evaluate(([w, h, lo, hi]) => {
  const cam = window.__ct.camera(), s = window.__ct.scene();
  s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  const V = cam.position.constructor; const out = {};
  for (let px = lo; px <= hi; px++) {
    const far = new V((px / w) * 2 - 1, -((300 / h) * 2 - 1), 0.5).unproject(cam);
    const dir = far.clone().sub(cam.position).normalize();
    let best = null;
    s.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      for (let q = n; q; q = q.parent) if (q.visible === false) return;
      const g = n.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
      const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
      let t0 = 0.05, t1 = 400;
      for (const ax of ['x', 'y', 'z']) {
        const o = cam.position[ax], dd = dir[ax];
        if (Math.abs(dd) < 1e-9) { if (o < bb.min[ax] || o > bb.max[ax]) return; continue; }
        let a = (bb.min[ax] - o) / dd, c2 = (bb.max[ax] - o) / dd;
        if (a > c2) { const t = a; a = c2; c2 = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c2); if (t0 > t1) return;
      }
      if (!best || t0 < best.t) best = { t: t0, id: n.id };
    });
    out[px] = best ? best.id : -1;
  }
  return out;
}, [W, H, LO, HI]);
console.log(`column profile, z ${Z} looking east, rows ${ROW0}..${ROW1}, ratio = night/day\n`);
let prev = null; let mx = 0, mxAt = -1;
for (let x = LO; x <= HI; x++) {
  const r = day[x] < 14 ? NaN : night[x] / day[x];
  const jump = prev == null || !Number.isFinite(r) || !Number.isFinite(prev) ? 0 : Math.abs(r - prev);
  const bar = '#'.repeat(Math.max(0, Math.round((Number.isFinite(r) ? r : 0) * 40)));
  console.log(`  x ${String(x).padStart(3)}  ratio ${(Number.isFinite(r) ? r.toFixed(3) : ' NaN ')}  d ${jump.toFixed(3)}${jump > 0.15 ? ' <<<' : '   '}  mesh#${String(hits[x]).padStart(5)}  ${bar}`);
  if (jump > mx) { mx = jump; mxAt = x; }
  prev = r;
}
console.log(`\nbiggest adjacent-column jump in rows ${ROW0}..${ROW1}: ${mx.toFixed(3)} at x=${mxAt}`);
await b.close();

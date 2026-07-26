// LOOKING UP AT EVERY TREE — the view nobody tests, and the one the user has
// now reported twice: "tree looks transparent in parts that probably shouldnt
// be transparent?"
//
// TWO MEASUREMENTS, because two different things were suspected:
//   1. the canopy texture's ALPHA HISTOGRAM. board() cuts with alphaTest 0.5,
//      which is in-or-out with no partial coverage, so any texel band around
//      0.3-0.7 punches holes rather than feathering.
//   2. SKY SEEN FROM UNDERNEATH. Stand at each trunk, look straight up, and
//      count how much of the overhead view is sky. A canopy you can see the
//      sky through is the fault as the user sees it.
//
// Usage: SHOT_URL=http://localhost:PORT/ node scripts/treeholes.mjs [--shots]
import { chromium } from 'playwright';
import { goto } from './lib/reachable.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const SHOTS = process.argv.includes('--shots');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await setClock(page, 13, 0);

// ── 1. the alpha histogram of every distinct canopy texture ────────────────
const hist = await page.evaluate(() => {
  const seen = new Set(); const bins = new Array(10).fill(0); let total = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !(o.material?.alphaTest > 0)) return;
    const im = o.material.map?.image; if (!im || seen.has(o.material.map.uuid)) return;
    // canopies only: the tree sheet is the tall one
    if (im.height < 80) return;   // 64x64 crown undersides are not canopies
    seen.add(o.material.map.uuid);
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 4) { bins[Math.min(9, Math.floor(d[i] / 25.6))]++; total++; }
  });
  return { bins, total, sheets: seen.size };
});
const band = hist.bins.slice(3, 7).reduce((a, b) => a + b, 0);
console.log(`\n  ALPHA HISTOGRAM over ${hist.sheets} canopy sheets, ${hist.total} texels`);
hist.bins.forEach((n, i) => {
  const lo = (i / 10).toFixed(1), hi = ((i + 1) / 10).toFixed(1);
  const mark = i >= 3 && i <= 6 ? '  <- cut by alphaTest 0.5' : '';
  if (n) console.log(`    a ${lo}-${hi}  ${String(n).padStart(6)}${mark}`);
});
console.log(`  texels in the 0.3-0.7 danger band: ${band} (${(band / hist.total * 100).toFixed(2)}%)`);

// ── 2. stand under every tree and look straight up ─────────────────────────
const trees = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !(o.material?.alphaTest > 0)) return;
    const im = o.material.map?.image; if (!im || im.height < 80) return;
    o.updateMatrixWorld(true);
    const m = o.matrixWorld.elements;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    out.push({ x: +m[12].toFixed(2), z: +m[14].toFixed(2), mod: mod ?? '(unattributed)' });
  });
  return out;
});
console.log(`\n  ${trees.length} canopies found. Standing under each and looking UP:`);

let holed = 0; const rows = [];
for (let i = 0; i < trees.length; i++) {
  const t = trees[i];
  await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0.14, 1.45), [t.x, t.z]);
  // 140 ms was not enough: the read came back with the PREVIOUS tree still on
  // screen, so a canopy that fills the view reported 100% sky. Wait on rendered
  // frames instead of on a guess (GOTCHAS 30).
  await page.evaluate(() => new Promise((res) => {
    let n = 0; const tick = () => (++n >= 3 ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }));
  await page.waitForTimeout(120);
  // Count in the PAGE, off the renderer's own canvas — no image library, and
  // it reads exactly what was drawn rather than a re-encoded screenshot.
  const { sky, n } = await page.evaluate(() => {
    const src = document.querySelector('canvas');
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0);
    const x0 = cv.width * 0.28 | 0, x1 = cv.width * 0.72 | 0;
    const y0 = cv.height * 0.10 | 0, y1 = cv.height * 0.50 | 0;
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let sky = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      n++;
      if (b > 120 && b >= gg && gg >= r && r > 100) sky++;   // flat pale sky
    }
    return { sky, n };
  });
  const pct = sky / n * 100;
  if (pct > 2) holed++;
  rows.push({ x: t.x, z: t.z, mod: t.mod, pct: +pct.toFixed(1) });
  if (SHOTS && pct > 2) await page.screenshot({ path: `shots/treeup-${i}.png` });
}
rows.sort((a, b) => b.pct - a.pct);
for (const r of rows.slice(0, 6)) console.log(`    ${r.mod.padEnd(14)} (${r.x}, ${r.z})  ${r.pct}% sky`);
const byMod = {};
for (const r of rows) { byMod[r.mod] ??= { n: 0, holed: 0, worst: 0 };
  byMod[r.mod].n++; if (r.pct > 2) byMod[r.mod].holed++;
  byMod[r.mod].worst = Math.max(byMod[r.mod].worst, r.pct); }
console.log('\n  module          canopies   with sky   worst');
for (const [k, v] of Object.entries(byMod).sort((a, b) => b[1].holed - a[1].holed))
  console.log(`  ${k.padEnd(16)} ${String(v.n).padStart(6)} ${String(v.holed).padStart(10)}   ${v.worst.toFixed(0)}%`);
console.log(`\n  ${holed} of ${trees.length} canopies show sky overhead (over 2% of the view)\n`);
await browser.close();

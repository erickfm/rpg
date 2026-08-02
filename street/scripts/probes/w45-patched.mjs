// w45 / item 95 — WHICH materials carry the per-fragment pool.
//
// After the change, material colour no longer tells you whether something is
// lit: the pool is applied at the fragment, so m.color is only the ambient.
// (My own first check read m.color and reported the world had got DARKER,
// which is BUILDER-BRIEF section 7 exactly — the instrument, not the world.)
//
// This asks the structural question instead: does this material carry the
// injected shader at all? Reported per class of thing, so "cars are not in the
// patched set" is visible rather than inferred.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-patched.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setNight } from '../lib/clock.mjs';

const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await setNight(page, 23, 0);

const r = await page.evaluate(() => {
  const sc = window.__ct.scene();
  let total = 0, patched = 0, noLight = 0, selfLit = 0, graded = 0;
  const byY = { ground: [0, 0], low: [0, 0], high: [0, 0] };
  const cars = [];
  sc.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const wy = e[13];
    if (Math.abs(e[12]) > 100) return;                 // interiors keep their own light
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color) continue;
      total++;
      const p = typeof m.onBeforeCompile === 'function'
        && m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool';
      if (p) patched++;
      if (m.userData.noLight) noLight++;
      if (m.userData.selfLit) selfLit++;
      if (m.userData.graded) graded++;
      const b = wy < 1.0 ? 'ground' : wy < 4.5 ? 'low' : 'high';
      byY[b][0]++; if (p) byY[b][1]++;
    }
  });
  // every vehicle the world says is out, and whether its body took the shader
  const info = window.__ct.traffic ? window.__ct.traffic() : null;
  sc.traverse((o) => {
    if (!o.userData || !o.userData.carKind) return;
    let n = 0, p = 0;
    o.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      for (const m of (Array.isArray(c.material) ? c.material : [c.material])) {
        if (!m || !m.color) continue;
        n++;
        if (m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool') p++;
      }
    });
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    cars.push({ kind: o.userData.carKind, x: +e[12].toFixed(1), z: +e[14].toFixed(1), n, p });
  });
  return { total, patched, noLight, selfLit, graded, byY, cars,
           lampHeadCount: sc.userData.lampHeadCount,
           lampHeadsUploaded: sc.userData.lampHeadsUploaded, traffic: !!info };
});

console.log(`materials on the street block: ${r.total}`);
console.log(`  carrying the pool shader:    ${r.patched}`);
console.log(`  graded / selfLit / noLight:  ${r.graded} / ${r.selfLit} / ${r.noLight}`);
console.log(`lamp heads registered: ${r.lampHeadCount}  uploaded to the GPU: ${r.lampHeadsUploaded}`);
console.log(`\nby elevation (patched / total):`);
for (const [k, [t, p]] of Object.entries(r.byY)) console.log(`  ${k.padEnd(7)} ${p} / ${t}`);
console.log(`\nvehicles in the world: ${r.cars.length}`);
for (const c of r.cars) console.log(`  ${String(c.kind).padEnd(10)} (${c.x}, ${c.z})  body materials ${c.p}/${c.n} patched`);
await browser.close();

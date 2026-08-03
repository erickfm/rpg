// w90 / item 146 — "fix this chair". WHICH chair?
//
// The row lost its diagnosis and names no file: "the chair he photographed",
// described second-hand as a back panel floating above the seat with a separate
// rail above it, blue-grey wall, wood floor, maroon rug.
//
// Reading source found four chair families (apartment, tax waiting row, hotel
// lobby, library) and all four looked flush BY CONSTRUCTION — seat top and back
// bottom meet exactly. So rather than keep guessing rooms from a paraphrase,
// this measures the BUILT world.
//
// `__ct.seats()` is the population, so this cannot miss a chair by failing to
// recognise its shape: every sittable thing in the world is in it. For each
// seat it finds the pan and the panel behind it and reports the vertical GAP.
//
// Usage: SHOT_URL=http://localhost:4460/ node scripts/probes/w90-item146-floating-backs.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(1200);

const rows = await page.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const THREE = window.__three ?? null;
  // collect every mesh with a world AABB, once
  const parts = [];
  S.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox; if (!bb) return;
    // world AABB via the 8 corners, so rotation is honoured
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const v = new o.position.constructor();
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      v.set(cx, cy, cz).applyMatrix4(o.matrixWorld);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    const col = o.material && !Array.isArray(o.material) && o.material.color
      ? '#' + o.material.color.getHexString() : '(multi)';
    parts.push({ minX, maxX, minY, maxY, minZ, maxZ, col,
                 w: maxX - minX, h: maxY - minY, d: maxZ - minZ,
                 cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 });
  });
  void THREE;

  const out = [];
  for (const s of window.__ct.seats()) {
    const px = s.pose.x, pz = s.pose.z, ph = s.pose.h;
    // everything standing in this chair's own footprint
    const near = parts.filter((p) =>
      p.cx > px - 0.55 && p.cx < px + 0.55 && p.cz > pz - 0.55 && p.cz < pz + 0.55 &&
      p.minY > -0.2 && p.maxY < ph + 1.4 && p.w < 1.6 && p.d < 1.6);
    // THE PAN: a flat wide box whose TOP is where the seat says you sit.
    const pan = near.filter((p) => p.h <= 0.18 && p.w >= 0.25 && p.d >= 0.25 &&
                                   Math.abs(p.maxY - (s.pose.hAbs ?? p.maxY)) >= 0)
      .sort((a, b) => Math.abs(a.maxY - b.maxY))[0];
    // pick the pan whose top is highest but still below head height
    const pans = near.filter((p) => p.h <= 0.18 && p.w >= 0.25 && p.d >= 0.25)
      .sort((a, b) => b.maxY - a.maxY);
    const thePan = pans[0];
    if (!thePan) { out.push({ label: s.label, x: px, z: pz, why: 'no pan found' }); continue; }
    // THE BACK: a tall thin panel sitting above the pan's top, not the pan itself
    const backs = near.filter((p) => p !== thePan && p.h >= 0.20 &&
      (p.d <= 0.18 || p.w <= 0.18) && Math.max(p.w, p.d) >= 0.25 &&
      p.maxY > thePan.maxY + 0.10)
      .sort((a, b) => a.minY - b.minY);
    const back = backs[0];
    if (!back) { out.push({ label: s.label, x: px, z: pz, why: 'no back found', panTop: +thePan.maxY.toFixed(3) }); continue; }
    out.push({
      label: s.label, x: +px.toFixed(2), z: +pz.toFixed(2),
      panTop: +thePan.maxY.toFixed(3), backBottom: +back.minY.toFixed(3),
      gap: +(back.minY - thePan.maxY).toFixed(3),
      panCol: thePan.col, backCol: back.col,
      backH: +back.h.toFixed(2),
    });
  }
  return out;
});

const withGap = rows.filter((r) => r.gap !== undefined);
console.log(`${rows.length} seats, ${withGap.length} with a pan AND a back panel identified\n`);

const floating = withGap.filter((r) => r.gap > 0.015).sort((a, b) => b.gap - a.gap);
console.log(`── seats whose back FLOATS above the pan (gap > 15 mm): ${floating.length}`);
for (const r of floating.slice(0, 25))
  console.log(`  gap ${String(r.gap).padStart(6)} m  panTop ${r.panTop}  backBottom ${r.backBottom}  `
    + `${r.panCol}/${r.backCol}  (${r.x},${r.z})  ${r.label}`);

console.log(`\n── the flush ones, for contrast (first 8):`);
for (const r of withGap.filter((r) => r.gap <= 0.015).slice(0, 8))
  console.log(`  gap ${String(r.gap).padStart(6)} m  ${r.panCol}/${r.backCol}  (${r.x},${r.z})  ${r.label}`);

const noBack = rows.filter((r) => r.why);
console.log(`\n── not measured: ${noBack.length}`);
const byWhy = {};
for (const r of noBack) (byWhy[r.why] ??= []).push(r.label);
for (const [k, v] of Object.entries(byWhy)) console.log(`  ${k}: ${v.length}  e.g. ${[...new Set(v)].slice(0, 4).join(' · ')}`);

await browser.close();

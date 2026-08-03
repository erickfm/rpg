// w93 / item 92 — the rose window's PLANE is centred. Is its PAINT?
//
// `w93-item92-eastwall.mjs` measured every mesh on the church's altar wall and
// found all 14 at dx = 0.0000 from the room's centre line — the rose plane and
// the crucifix included. So the desk's account ("one of the two is wrong") is
// refuted in geometry, and the user is still right that it looks misaligned.
//
// The remaining place a window can sit off-centre is INSIDE ITS OWN TEXTURE.
// This reads the rose's canvas back out of the running world and computes the
// centroid of the painted glass against the canvas centre — in pixels, and in
// metres on the 2.4 m plane the texture is stretched over.
//
//   SHOT_URL=http://localhost:4490/ node scripts/probes/w93-item92-rose-centroid.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4490/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const out = await p.evaluate(() => {
  const dims = window.__ct.roomDims();
  const ch = dims.find((d) => d.id === 'church');
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let hit = null;
  s.traverse((o) => {
    if (hit || !o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const gp = o.geometry.parameters;
    // the rose by its declared size, not by a coordinate typed here
    if (Math.abs(gp.width - 2.4) > 1e-6 || Math.abs(gp.height - 3.6) > 1e-6) return;
    const e = o.matrixWorld.elements;
    if (Math.abs(e[12] - ch.cx) > ch.w) return;              // inside the church
    const map = o.material && o.material.map;
    if (!map || !map.image) return;
    const img = map.image;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    // The lead ground is #14120f. Anything appreciably brighter is glass.
    let sx = 0, sy = 0, n = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const lum = d[i] + d[i + 1] + d[i + 2];
      if (lum <= 0x14 + 0x12 + 0x0f + 12) continue;          // background
      sx += x + 0.5; sy += y + 0.5; n++;
      if (x < minX) minX = x; if (x + 1 > maxX) maxX = x + 1;
      if (y < minY) minY = y; if (y + 1 > maxY) maxY = y + 1;
    }
    hit = { w: img.width, h: img.height, n, cx: sx / n, cy: sy / n,
      minX, maxX, minY, maxY,
      planeW: gp.width, planeH: gp.height, worldX: e[12], roomCx: ch.cx };
  });
  return hit;
});

if (!out) { console.error('rose plane or its texture not found'); await b.close(); process.exit(3); }
// POPULATION FLOOR. A centroid over zero lit pixels is NaN, and "centred" would
// print happily. (GOTCHAS 34.)
if (out.n < 200) {
  console.error(`POPULATION FLOOR: only ${out.n} glass pixels found — nothing measured.`);
  await b.close(); process.exit(3);
}

const f = (v) => v.toFixed(3);
console.log(`rose canvas ${out.w} x ${out.h} px, on a ${out.planeW} x ${out.planeH} m plane`);
console.log(`plane world x ${out.worldX}  (room centre ${out.roomCx}) — the MESH is centred`);
console.log(`glass pixels: ${out.n}`);
console.log(`\n            painted        canvas centre     offset`);
const cxCanvas = out.w / 2, cyCanvas = out.h / 2;
const dxPx = out.cx - cxCanvas, dyPx = out.cy - cyCanvas;
console.log(`centroid x  ${f(out.cx).padStart(7)} px    ${f(cxCanvas).padStart(7)} px    ${f(dxPx).padStart(7)} px`);
console.log(`centroid y  ${f(out.cy).padStart(7)} px    ${f(cyCanvas).padStart(7)} px    ${f(dyPx).padStart(7)} px`);
const spanCx = (out.minX + out.maxX) / 2, spanCy = (out.minY + out.maxY) / 2;
console.log(`span x      ${out.minX}…${out.maxX}  -> mid ${f(spanCx)} px    ${f(spanCx - cxCanvas).padStart(7)} px`);
console.log(`span y      ${out.minY}…${out.maxY}  -> mid ${f(spanCy)} px    ${f(spanCy - cyCanvas).padStart(7)} px`);

const mPerPxX = out.planeW / out.w, mPerPxY = out.planeH / out.h;
console.log(`\nIN THE WORLD (${f(mPerPxX * 1000)} mm per px across, ${f(mPerPxY * 1000)} mm per px up):`);
console.log(`  the painted rose sits ${(dxPx * mPerPxX * 1000).toFixed(0)} mm off the window's own centre in x`);
console.log(`  and ${(dyPx * mPerPxY * 1000).toFixed(0)} mm in y`);
console.log(`  span midpoint:        ${((spanCx - cxCanvas) * mPerPxX * 1000).toFixed(0)} mm in x, `
  + `${((spanCy - cyCanvas) * mPerPxY * 1000).toFixed(0)} mm in y`);

// THE BAR IS DERIVED, NOT TYPED, AND IT IS NOT A LOOSENED ONE.
//
// A rose painted in 4 px tiles on a 5 px pitch fills a band of `5k - 1` px. On
// the 48 px axis, k = 9 gives 44 and a margin of exactly 2 — so x can be, and
// now is, PERFECT. On the 72 px axis, k = 14 gives 69 and a margin of 1.5, and
// there is no integer start that centres it; k = 13 would, at the cost of a row
// of glass. So half a source pixel is the finest offset this canvas can
// express, and a bar below it fails a texture that is as centred as it can be.
// That is the difference between a derived floor and a loosened check
// (BUILDER-BRIEF §7): this one is the quantisation, and it is stated, not
// discovered by nudging until green.
const BAR_X_MM = 0.5 * mPerPxX * 1000, BAR_Y_MM = 0.5 * mPerPxY * 1000;
const offX = Math.abs(dxPx * mPerPxX * 1000), offY = Math.abs(dyPx * mPerPxY * 1000);
console.log(`\nVERDICT — bar is HALF A SOURCE PIXEL: ${BAR_X_MM.toFixed(0)} mm across, ${BAR_Y_MM.toFixed(0)} mm up`);
console.log(`  x: ${offX.toFixed(0)} mm  ${offX > BAR_X_MM ? 'MISALIGNED' : 'centred (at the quantisation floor)'}`);
console.log(`  y: ${offY.toFixed(0)} mm  ${offY > BAR_Y_MM ? 'MISALIGNED' : 'centred (at the quantisation floor)'}`);
console.log(`  ${offX > BAR_X_MM || offY > BAR_Y_MM ? '*** the window is off its own centre ***'
  : 'the window is as centred as a 48x72 canvas can be'}`);

// SELF-TEST, BOTH SIGNS: the same centroid arithmetic on a synthetic disc that
// IS centred, and on one deliberately displaced by 2 px. If the centred case
// does not read ~0 and the displaced case does not read ~2, this measures nothing.
const st = await p.evaluate(([W, H]) => {
  const run = (shift) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#14120f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8a6a2a';
    for (let y = 2; y < H - 2; y += 5) for (let x = 2; x < W - 2; x += 5) {
      const dx = (x + shift - W / 2) / 22, dy = (y + shift - H / 2) / 34;
      if (dx * dx + dy * dy > 1) continue;
      g.fillRect(x, y, 4, 4);
    }
    const d = g.getImageData(0, 0, W, H).data;
    let sx = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i] + d[i + 1] + d[i + 2] <= 0x14 + 0x12 + 0x0f + 12) continue;
      sx += x + 0.5; n++;
    }
    return { dx: sx / n - W / 2, n };
  };
  // shift 2 = testing the tile's CENTRE (the fix); shift 0 = testing its CORNER
  return { corner: run(0), centre: run(2) };
}, [out.w, out.h]);
console.log(`\nself-test on a synthetic rose painted by the same loop:`);
console.log(`  membership tested on the tile CORNER (as shipped): centroid dx ${f(st.corner.dx)} px, ${st.corner.n} px lit`);
console.log(`  membership tested on the tile CENTRE (the fix)   : centroid dx ${f(st.centre.dx)} px, ${st.centre.n} px lit`);
const ok = Math.abs(st.corner.dx) > 1 && Math.abs(st.centre.dx) < 0.6;
console.log(`  ${ok ? 'PASS — the arithmetic separates the two, and names the cause'
  : '*** FAIL: the synthetic control does not reproduce the offset ***'}`);
await b.close();
if (!ok) process.exit(2);

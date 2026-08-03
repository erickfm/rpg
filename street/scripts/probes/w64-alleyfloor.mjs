#!/usr/bin/env node
// ITEM 186: WHICH mesh is the dark ground in the user's alley-mouth frame?
//
// The census (`w5-shadow-census.mjs`) reports only ONE unmapped outdoor
// ground-facing mesh, so either his surface is not what the census looks for,
// or the census misses it. Find the phone booth and the dumpster the way `aim`
// does — by signature, never by a remembered coordinate — then describe every
// ground-facing mesh around them: colour, map, map size, and how much CONTRAST
// that map actually carries.
//
//   SHOT_URL=http://localhost:4201/ node scripts/probes/w64-alleyfloor.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// STAND IN THE STREET FIRST. The world starts inside flat 301 and the region
// cull sets `visible = false` on the whole exterior while you are indoors — a
// probe that traverses from the spawn measures the apartment and reports the
// street as missing. (Cost me twenty minutes on item 156 before I saw it.)
await p.evaluate(() => { window.__ct.warp(-6, -30, 0, 0); window.__ct.clock(13, 0); });
await p.waitForTimeout(1200);

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const all = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox; if (!bb) return;
    const lo = bb.min.clone().applyMatrix4(o.matrixWorld);
    const hi = bb.max.clone().applyMatrix4(o.matrixWorld);
    const x0 = Math.min(lo.x, hi.x), x1 = Math.max(lo.x, hi.x);
    const y0 = Math.min(lo.y, hi.y), y1 = Math.max(lo.y, hi.y);
    const z0 = Math.min(lo.z, hi.z), z1 = Math.max(lo.z, hi.z);
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    all.push({ o, x0, x1, y0, y1, z0, z1, mod });
  });
  // THE PAYPHONE, which `ct/props.ts:2264` tags `userData.payphone = true`
  // precisely so nothing has to remember where it is. His frame is taken at it.
  const dump = all.find((q) => q.o.userData?.payphone);
  const px = dump ? (dump.x0 + dump.x1) / 2 : 0;
  const pz = dump ? (dump.z0 + dump.z1) / 2 : 0;
  const near = [];
  for (const q of all) {
    const w = q.x1 - q.x0, d = q.z1 - q.z0, h = q.y1 - q.y0;
    if (q.y1 > 0.9 || h > 0.6) continue;                   // ground-ish only
    if (w * d < 1) continue;
    const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    if (Math.hypot(cx - px, cz - pz) > 16) continue;
    const mats = Array.isArray(q.o.material) ? q.o.material : [q.o.material];
    const top = (q.o.geometry.type === 'BoxGeometry' && mats.length >= 3) ? mats[2] : mats[0];
    let contrast = null, mean = null, mapWH = null;
    if (top && top.map && top.map.image) {
      const im = top.map.image;
      mapWH = `${im.width}x${im.height}`;
      try {
        const cv = document.createElement('canvas');
        cv.width = im.width; cv.height = im.height;
        const g2 = cv.getContext('2d', { willReadFrequently: true });
        g2.drawImage(im, 0, 0);
        const px2 = g2.getImageData(0, 0, im.width, im.height).data;
        let sum = 0, sum2 = 0, n = 0;
        for (let i = 0; i < px2.length; i += 4) {
          const l = 0.299 * px2[i] + 0.587 * px2[i + 1] + 0.114 * px2[i + 2];
          sum += l; sum2 += l * l; n++;
        }
        mean = sum / n; contrast = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      } catch (e) { mapWH += ' (unreadable)'; }
    }
    near.push({
      mod: q.mod ?? '(unattributed)', type: q.o.geometry.type,
      w: +w.toFixed(2), d: +d.toFixed(2), area: +(w * d).toFixed(1),
      x: +cx.toFixed(2), z: +cz.toFixed(2), y: +((q.y0 + q.y1) / 2).toFixed(3),
      col: top && top.color ? '#' + top.color.getHexString() : '?',
      map: mapWH, mean: mean === null ? null : +mean.toFixed(1),
      sd: contrast === null ? null : +contrast.toFixed(2),
      nMat: mats.length, name: q.o.name || '',
    });
  }
  near.sort((a, c) => c.area - a.area);
  return { dumpster: dump ? { x: +px.toFixed(2), z: +pz.toFixed(2) } : null, near };
});
console.log(`payphone at ${JSON.stringify(out.dumpster)}`);
console.log('\n  area   w x d        at (x,z,y)          module        col      map        mean   sd   type');
for (const n of out.near) {
  console.log(`  ${String(n.area).padStart(6)}  ${String(n.w).padStart(6)}x${String(n.d).padEnd(6)} `
    + `(${String(n.x).padStart(7)},${String(n.z).padStart(8)},${String(n.y).padStart(6)}) `
    + `${n.mod.padEnd(14)} ${n.col.padEnd(8)} ${String(n.map ?? 'NO MAP').padEnd(10)} `
    + `${String(n.mean ?? '-').padStart(5)} ${String(n.sd ?? '-').padStart(5)}  ${n.type}`);
}
await b.close();

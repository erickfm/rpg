// Did I measure box faces wrong? A BoxGeometry has four side faces: two are
// parameters.width across, two are parameters.depth. My masonry check used
// width for all of them. If the stamp's painted-for width matches the DEPTH on
// these meshes, the texture is correct and the error is mine.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const res = [];
  s.traverse(o => {
    if (!o.isMesh || o.geometry?.type !== 'BoxGeometry') return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    const ms = m && m.map && m.map.userData && m.map.userData.masonry;
    if (!ms) return;
    const e=o.matrixWorld.elements, len=(a,b2,c)=>Math.hypot(e[a],e[b2],e[c]);
    const S=[len(0,1,2),len(4,5,6),len(8,9,10)], pr=o.geometry.parameters;
    const W=pr.width*S[0], H=pr.height*S[1], D=pr.depth*S[2];
    const img=m.map.image;
    res.push({ paintedFor:+ms.wMeters.toFixed(2), boxW:+W.toFixed(2), boxD:+D.toFixed(2),
      declared: ms.ppm, canvas: img.width,
      ppmVsW: +(img.width/W).toFixed(2), ppmVsD: +(img.width/D).toFixed(2) });
  });
  return res;
});
let matchD=0, matchW=0, neither=0;
for (const r of out) {
  const okD = Math.abs(r.ppmVsD - r.declared) < 0.6, okW = Math.abs(r.ppmVsW - r.declared) < 0.6;
  if (okD) matchD++; else if (okW) matchW++; else neither++;
}
console.log(`${out.length} stamped BoxGeometry faces`);
console.log(`   density correct against the box's DEPTH:  ${matchD}`);
console.log(`   density correct against the box's WIDTH:  ${matchW}`);
console.log(`   correct against NEITHER dimension:        ${neither}\n`);
for (const r of out.slice(0,8))
  console.log(`   painted for ${String(r.paintedFor).padStart(6)} m · box ${String(r.boxW).padStart(6)} × ${String(r.boxD).padStart(6)} · declared ${String(r.declared).padStart(2)} · vs W ${String(r.ppmVsW).padStart(6)} · vs D ${String(r.ppmVsD).padStart(6)}`);
await b.close();

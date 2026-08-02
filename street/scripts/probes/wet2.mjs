// The hour sweep conflated two things: ct/props.ts multiplies every wet surface
// by ambient(), so luminance across 24 h is mostly the day/night curve.
//
// Pin the clock instead. With the hour held fixed, ambient is constant and
// rainAt(hourAbs) is constant, so ANY movement in these materials is the
// wetness term alone. Then the two questions are answerable directly: does the
// ground change state at all, and does the gutter strip hold water longer than
// the broad road sheet (props.ts gives strips exponent 0.55 and broad sheets
// 1.7, so the strips should lag).
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.warp(0, -40, 0, 0.14, 0));
await p.waitForTimeout(400);
const probe = async () => await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let bN=0,bL=0,sN=0,sL=0,aN=0,aO=0;
  s.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.color) return;
    const img = m.map && m.map.image;
    const lum = 0.299*m.color.r+0.587*m.color.g+0.114*m.color.b;
    if (img && img.width===64 && img.height===64) { bN++; bL+=lum; }
    else if (img && img.height && img.height<32 && img.width>=16) { sN++; sL+=lum; }
    if (m.transparent && m.opacity>0.015 && m.visible!==false) { aN++; aO+=m.opacity; }
  });
  return { broad:bN?+(bL/bN).toFixed(4):null, strip:sN?+(sL/sN).toFixed(4):null,
           translucent:aN, meanOp:aN?+(aO/aN).toFixed(3):0 };
});
const out = {};
for (const h of [2, 8, 14, 20]) {
  const trace = [];
  for (let t = 0; t <= 20; t += 2) {
    // re-pin every sample so the sim cannot drift the hour out from under us
    for (let k = 0; k < 4; k++) { await p.evaluate((h)=>window.__ct.clock(h,0), h); await p.waitForTimeout(120); }
    await p.waitForTimeout(1400);
    trace.push({ t, ...(await probe()) });
  }
  out[h] = trace;
  const f = trace[0], l = trace[trace.length-1];
  const d = (a,c) => (a===null||c===null) ? '—' : (c-a >= 0 ? '+' : '') + (c-a).toFixed(4);
  console.log(`\nhour ${String(h).padStart(2)} pinned, 20 s:`);
  console.log(`   broad sheets  ${f.broad} → ${l.broad}   (${d(f.broad,l.broad)})`);
  console.log(`   kerb/gutter   ${f.strip} → ${l.strip}   (${d(f.strip,l.strip)})`);
  console.log(`   translucent   ${f.translucent} → ${l.translucent}   mean opacity ${f.meanOp} → ${l.meanOp}`);
}
writeFileSync('shots/wet2.json', JSON.stringify(out,null,2));
await b.close();

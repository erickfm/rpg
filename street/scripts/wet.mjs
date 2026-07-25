// DOES THE STREET REMEMBER THE RAIN? My two earlier puddle counts contradicted
// each other -- 57 decals many at opacity 1, then 0 above 0.02 -- and I reported
// that as an anomaly I could not resolve. ct/props.ts:1002 resolves it: puddle
// and splash opacity is a function of `wetness`, which rises fast and decays
// slowly, and `m.visible = m.opacity > 0.015` hides them when dry. Two readings
// at two points in one cycle SHOULD disagree.
//
// So the real question is not how many puddles exist, it is whether the decay
// behaves: does the street wet up in rain, stay wet after it stops, and does the
// GUTTER hold water longer than the road crown (props.ts uses the sheet's own
// texture height to tell them apart).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.warp(0, -40, 0, 0.14, 0));
await p.waitForTimeout(400);

// a wetness proxy read off the live materials: broad ground sheets are 64x64,
// the kerb/gutter strips are under 32 px tall. Both are in the wet registry and
// both are lerped toward WET, so their luminance IS the state.
const probe = async () => await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let broadN = 0, broadL = 0, stripN = 0, stripL = 0, alpha = 0, alphaN = 0;
  s.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.color) return;
    const img = m.map && m.map.image;
    const lum = 0.299*m.color.r + 0.587*m.color.g + 0.114*m.color.b;
    if (img && img.width === 64 && img.height === 64) { broadN++; broadL += lum; }
    else if (img && img.height && img.height < 32 && img.width >= 16) { stripN++; stripL += lum; }
    if (m.transparent && m.opacity > 0.015 && m.visible !== false) { alpha += m.opacity; alphaN++; }
  });
  return { broad: broadN ? +(broadL/broadN).toFixed(4) : null, broadN,
           strip: stripN ? +(stripL/stripN).toFixed(4) : null, stripN,
           translucent: alphaN, meanOpacity: alphaN ? +(alpha/alphaN).toFixed(3) : 0 };
});

console.log('hour sweep — mean luminance of the broad ground sheets and the kerb/gutter strips');
console.log('hour   broad   strip   translucent  meanOpacity');
const byHour = [];
for (let h = 0; h < 24; h++) {
  await p.evaluate((h) => window.__ct.clock(h, 0), h);
  await p.waitForTimeout(700);
  const r = await probe();
  byHour.push({ h, ...r });
  console.log(`  ${String(h).padStart(2)}   ${String(r.broad).padStart(6)}  ${String(r.strip).padStart(6)}   ${String(r.translucent).padStart(6)}      ${r.meanOpacity}`);
}
writeFileSync('shots/wet.json', JSON.stringify({ byHour }, null, 2));
await b.close();

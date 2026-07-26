// The library's refusal says "opening hours are on the board". The phrase
// exists nowhere in src except the message itself -- but a board could be drawn
// with pixel lettering rather than a string, so look before concluding.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
// stand at the library's door spot and look at the facade
const info = await p.evaluate(() => {
  // PUBLIC, not PVBLIC. ct/civic.ts:744 changed the frieze after the user read
  // the V as a typo twice — "if the reference is correct but every reader thinks
  // it is a mistake, it is a mistake" — and this find() has returned undefined
  // ever since, so the whole check has been measuring nothing. The label the
  // world publishes is `into the PUBLIC LIBRARY`.
  const s = window.__ct.spots().find(q => /PUBLIC LIBRARY/i.test(q.label||''));
  if (!s) return null;
  // small board-like meshes within 4 m of the door, between waist and head height
  const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
  const boards = [];
  sc.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2, cy=(bb.min.y+bb.max.y)/2;
    if (Math.hypot(cx-s.x, cz-s.z) > 4.5) return;
    if (cy < 0.7 || cy > 2.6) return;
    const w=bb.max.x-bb.min.x, h=bb.max.y-bb.min.y, d=bb.max.z-bb.min.z;
    if (Math.max(w,d) > 1.6 || h > 1.4) return;
    if (Math.max(w,d) < 0.25 || h < 0.25) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    boards.push({ size:[+w.toFixed(2),+h.toFixed(2),+d.toFixed(2)],
      at:[+cx.toFixed(2),+cy.toFixed(2),+cz.toFixed(2)],
      canvas: m&&m.map&&m.map.image ? [m.map.image.width,m.map.image.height] : null });
  });
  // stand BACK from the door and look at the whole entrance, not at the wood
  window.__ct.warp(-5.9, s.z, Math.atan2(s.x - (-5.9), 0), 0.14, 0.02);
  return { spot:[+s.x.toFixed(2),+s.z.toFixed(2)], boards };
});
if (!info) { console.log('library spot not found'); }
else {
  console.log(`library door spot (${info.spot.join(', ')})`);
  console.log(`board-sized meshes within 4.5 m, waist-to-head height: ${info.boards.length}`);
  for (const q of info.boards) console.log(`   ${q.size.join('×')}  canvas ${q.canvas}  at (${q.at.join(', ')})`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/libdoor.png' });
  console.log('   shot shots/libdoor.png');
}
await b.close();

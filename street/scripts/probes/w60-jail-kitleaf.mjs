// Is the kit's door leaf still visible behind the jail's own steel pair?
//
// `ct/int-jail.ts` hides it by matching a 32 x 64 canvas texture and setting
// `visible = false`, and warns on the console if it does not match exactly one.
// The interior photograph shows a pale blue-grey slab standing between the two
// steel leaves — which is what that slab looks like. So: capture the WARNING
// (not just errors), and enumerate every textured plane at the interior door.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
const logs = [];
p.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
// straight to the jail interior — it is built at load, not on entry
await p.evaluate(() => window.__ct.warp(1000, 9.85, Math.PI, 0, -0.05));
await p.waitForTimeout(2000);

const interior = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const e = n.matrixWorld.elements;
    // the doorway and whatever stands BEYOND it — the interior frames show a
    // pale slab between the two leaves and it is not the kit leaf (that one is
    // hidden), so widen far enough to catch whatever it actually is
    if (Math.abs(e[12] - 1000) > 4 || e[14] < 12.4 || e[14] > 22) return;
    const mat = Array.isArray(n.material) ? n.material[0] : n.material;
    const img = mat && mat.map && mat.map.image;
    let vis = n.visible;
    for (let q = n; q; q = q.parent) if (q.visible === false) vis = false;
    const g = n.geometry; g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    out.push({
      type: g.type,
      tex: img ? `${img.width}x${img.height}` : (mat && mat.color ? '#' + mat.color.getHexString() : 'none'),
      visible: vis,
      pos: [e[12], e[13], e[14]].map((v) => +v.toFixed(2)),
      size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((v) => +v.toFixed(2)),
    });
  });
  return out;
});
console.log(`\nmeshes within 3 m of the jail's interior doorway: ${interior.length}`);
for (const m of interior) {
  console.log(`   ${m.visible ? 'VISIBLE' : 'hidden '}  ${m.tex.padEnd(9)} ${m.type.padEnd(15)}`
    + ` ${m.size.join(' x ').padEnd(22)} at ${m.pos.join(', ')}`);
}

const warns = logs.filter((l) => /interior:jail|kit door leaf/i.test(l));
console.log(`\nthe file's own warning about hiding the kit leaf: ${warns.length ? '' : 'NOT FIRED'}`);
for (const w of warns) console.log('   ' + w);
await p.screenshot({ path: 'shots/w60-jail-kitleaf.png' });
console.log('shots/w60-jail-kitleaf.png');
await b.close();

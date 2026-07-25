// The one step left on the blade question: what ARE those faces made of?
// They pass every handedness filter except having a texture map. If the
// lettering is geometry, "is the UV mirrored" does not apply to them.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = [(bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2];
    if (c[0] < 25 || c[1] < 3) return;                 // the side-street signs only
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.fog !== false) return;                  // neon = fog off
    out.push({ c: c.map(v=>+v.toFixed(2)),
      size: [bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z].map(v=>+v.toFixed(2)),
      geo: g.type, hasMap: !!m.map, side: m.side, mat: m.type,
      colour: m.color ? '#'+m.color.getHexString() : null,
      verts: g.attributes.position ? g.attributes.position.count : 0 });
  });
  return out;
});
console.log(`${r.length} fog-disabled (neon) faces on the side street\n`);
console.log('geo             size            map    side  verts  colour     at');
for (const x of r.sort((a,b2)=>b2.size[1]-a.size[1]).slice(0,14))
  console.log(`${x.geo.padEnd(15)} ${x.size.join('×').padEnd(15)} ${(x.hasMap?'YES':'no').padEnd(6)} ${String(x.side).padEnd(5)} ${String(x.verts).padEnd(6)} ${(x.colour??'-').padEnd(10)} (${x.c.join(', ')})`);
await b.close();

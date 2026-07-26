// SIGN HANDEDNESS, read off the scene graph instead of photographed.
//
// Four camera attempts failed the same way: the SEVENS marquee canopy
// overhangs the pavement, so every street-level camera within ~8 m of a blade is
// underneath it. When a check fails twice the same way, change the instrument.
//
// The question is not "what do the letters look like" but "does this face's
// texture u axis run to the RIGHT of someone looking at it". That is exact:
//
//   normal  = the plane's +z, rotated into world space
//   uDir    = the plane's +x, rotated into world space   (texture u)
//   viewer looks along -normal, so their right hand is  cross(up, normal)
//   the face reads correctly iff  dot(uDir, right) > 0
//
// Any face where that dot product is negative is mirrored, whatever it depicts,
// and symmetrical letters can no longer hide it.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const RES = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  const skipped = { noMap: 0, tooLow: 0, notUpright: 0 };
  const tilted = [];
  const tfLocal = (o, v) => {
    const me = o.matrixWorld.elements;
    const x = me[0]*v.x + me[4]*v.y + me[8]*v.z;
    const y = me[1]*v.x + me[5]*v.y + me[9]*v.z;
    const z = me[2]*v.x + me[6]*v.y + me[10]*v.z;
    const L = Math.hypot(x,y,z) || 1;
    return { x: x/L, y: y/L, z: z/L };
  };
  s.traverse(o => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (!m.map) { skipped.noMap++; return; }
    // only signage: something that carries artwork and stands above head height
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.y < 1.2) { skipped.tooLow++; return; }
    // upright signs only: the world-up test is meaningless on a plane whose own
    // up is not roughly world up, so report those separately instead of guessing
    const up = tfLocal(o, { x: 0, y: 1, z: 0 });
    if (Math.abs(up.y) < 0.7) { skipped.notUpright++; tilted.push([
      +((bb.min.x+bb.max.x)/2).toFixed(2), +((bb.min.y+bb.max.y)/2).toFixed(2), +((bb.min.z+bb.max.z)/2).toFixed(2)]); return; }
    const e = new (o.matrixWorld.constructor)();
    const n = { x: 0, y: 0, z: 1 }, u = { x: 1, y: 0, z: 0 };
    const tf = (v) => {
      const me = o.matrixWorld.elements;
      const x = me[0] * v.x + me[4] * v.y + me[8] * v.z;
      const y = me[1] * v.x + me[5] * v.y + me[9] * v.z;
      const z = me[2] * v.x + me[6] * v.y + me[10] * v.z;
      const L = Math.hypot(x, y, z) || 1;
      return { x: x / L, y: y / L, z: z / L };
    };
    const N = tf(n), U = tf(u);
    // viewer's right = cross(up, normal), up = (0,1,0)
    const R = { x: 1 * N.z - 0 * N.y, y: 0, z: 0 * N.x - 1 * N.x };
    const right = { x: N.z, y: 0, z: -N.x };
    const dot = U.x * right.x + U.z * right.z;
    out.push({
      centre: [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2].map(v => +v.toFixed(2)),
      size: [+(bb.max.x - bb.min.x).toFixed(2), +(bb.max.y - bb.min.y).toFixed(2), +(bb.max.z - bb.min.z).toFixed(2)],
      normal: [+N.x.toFixed(2), +N.y.toFixed(2), +N.z.toFixed(2)],
      uDotRight: +dot.toFixed(3),
      side: m.side,           // 0 FrontSide, 1 BackSide, 2 DoubleSide
      mirrored: dot < -0.001,
      canvas: m.map.image ? [m.map.image.width, m.map.image.height] : null,
    });
  });
  return { out, skipped, tilted };
});
const rows = RES.out;
writeFileSync('shots/handed.json', JSON.stringify(RES, null, 2));
console.log('excluded:', JSON.stringify(RES.skipped));
if (RES.tilted.length) console.log('not upright (world-up test invalid, reported not guessed):', RES.tilted.slice(0,8).map(t=>`(${t.join(',')})`).join(' '));
const bad = rows.filter(r => r.mirrored);
console.log(`${rows.length} mapped sign faces above 1.8 m; ${bad.length} MIRRORED\n`);
console.log('u·right  mirrored  side  size            canvas      at');
for (const r of rows.sort((a, b2) => a.uDotRight - b2.uDotRight))
  console.log(`${String(r.uDotRight).padStart(7)}  ${(r.mirrored ? 'YES' : '.').padEnd(8)}  ` +
    `${String(r.side).padEnd(4)}  ${r.size.join('×').padEnd(15)} ${String(r.canvas).padEnd(11)} (${r.centre.join(', ')})`);
await b.close();

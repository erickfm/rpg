// Item 204 SCOPING — what is actually standing on the pavement in front of
// THRIFT? Found by POSITION, not by guessing a filename (the row is explicit).
//
//   SHOT_URL=http://localhost:4300/ node scripts/probes/w74-thrift-pavement.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4300/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

// The door, from the world's own registry — the anchor everything else is
// measured from, so no coordinate is retyped here.
const door = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /thrift/i.test(s.label))
  .map((s) => ({ x: s.x, z: s.z, r: s.r, label: s.label })));
console.log('thrift spots:', JSON.stringify(door));
if (!door.length) { console.log('REFUSING TO REPORT: no thrift spot found'); await b.close(); process.exit(3); }
const D = door[0];

const near = await p.evaluate(([dx, dz]) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const x = e[12], y = e[13], z = e[14];
    const d = Math.hypot(x - dx, z - dz);
    if (d > 6) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const sz = bb ? [
      +(bb.max.x - bb.min.x).toFixed(2),
      +(bb.max.y - bb.min.y).toFixed(2),
      +(bb.max.z - bb.min.z).toFixed(2)] : null;
    // pavement clutter only: standing on the ground, not part of a wall or sign
    if (y > 1.6) return;
    out.push({
      d: +d.toFixed(2), x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2),
      geo: o.geometry.type, sz, name: o.name || '', ud: Object.keys(o.userData ?? {}).join(','),
    });
  });
  return out.sort((a, c) => a.d - c.d).slice(0, 40);
}, [D.x, D.z]);
console.log(`\nmeshes within 6 m of the thrift door, y <= 1.6 (${near.length} shown):`);
for (const m of near) console.log(`  ${String(m.d).padStart(5)} m  (${m.x}, ${m.y}, ${m.z})  ${m.geo} ${JSON.stringify(m.sz)}  ${m.name} ${m.ud}`);

// and a look at it
const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [D.x, D.z + 3]);
await p.evaluate(([x, z, yaw, g]) => window.__ct.warp(x, z, yaw, g, 0), [D.x, D.z + 3.2, Math.PI, gy]);
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/w74-thrift-frontage.png' });
console.log('\nshot: shots/w74-thrift-frontage.png');
await b.close();

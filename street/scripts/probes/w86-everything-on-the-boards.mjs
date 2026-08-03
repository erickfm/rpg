// EVERY MESH LYING ON THE FLAT'S FLOOR, WITH ITS COLOUR AND SIZE. Item 169.
//
// The desk's "an outdoor prop landed in the room" hypothesis is DISCARDED —
// `w86-foreign-modules-in-rooms.mjs` finds zero outdoor-module meshes inside any
// of the 14 rooms. So the sliver, if it is geometry at all, belongs to a module
// that is supposed to be there. This lists everything flat and low across the
// whole flat so a pale-tan sliver can be picked out by its own numbers.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-everything-on-the-boards.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const out = [];
  S.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (x < 190 || x > 215 || z < -26 || z > -4) return;
    if (y < -0.2 || y > 0.45) return;            // lying on or just above the boards
    const g = o.geometry;
    g?.computeBoundingBox?.();
    const bb = g?.boundingBox;
    const sz = bb ? [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z] : [0, 0, 0];
    const mats = window.__mats(o);
    const m0 = mats[0];
    out.push({
      mod: o.userData?.mod ?? '?',
      geo: g?.type,
      at: [+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)],
      size: sz.map((v) => +v.toFixed(3)),
      rot: [+o.rotation.x.toFixed(2), +o.rotation.y.toFixed(2), +o.rotation.z.toFixed(2)],
      col: m0?.color ? '#' + m0.color.getHexString() : null,
      hasMap: !!m0?.map,
      alphaTest: m0?.alphaTest ?? 0,
      transparent: !!m0?.transparent,
      nMat: mats.length,
      vis: o.visible,
    });
  });
  return out;
});

// FLAT means one dimension near zero, or a very thin slab: that is the shape the
// user described — "a horizontal sliver lying flat".
const flat = r.filter((m) => Math.min(...m.size) < 0.06);
console.log(`\n${r.length} meshes on/near the boards in x 190..215, z -26..-4; ${flat.length} of them FLAT (min dim < 6 cm)\n`);
for (const m of flat.sort((a, b) => a.at[0] - b.at[0]))
  console.log(`  ${String(m.mod).padEnd(9)} ${String(m.geo).padEnd(15)} at ${JSON.stringify(m.at).padEnd(26)}`
    + ` size ${JSON.stringify(m.size).padEnd(26)} rot ${JSON.stringify(m.rot).padEnd(18)}`
    + ` ${m.col} map=${m.hasMap} aT=${m.alphaTest} tr=${m.transparent} vis=${m.vis}`);

console.log(`\n  --- and the non-flat ones, for completeness ---`);
for (const m of r.filter((m) => Math.min(...m.size) >= 0.06).sort((a, b) => a.at[0] - b.at[0]).slice(0, 30))
  console.log(`  ${String(m.mod).padEnd(9)} ${String(m.geo).padEnd(15)} at ${JSON.stringify(m.at).padEnd(26)}`
    + ` size ${JSON.stringify(m.size).padEnd(26)} ${m.col} map=${m.hasMap} vis=${m.vis}`);
await b.close();

// One-shot (item 220): WHAT IS THE POST at x −5.55…−5.15, z −65.2…−64.8?
// The item says to establish what it is before moving it, because a sign post, a
// lamp standard and a stanchion each want a different fix. So: find every
// collider and every mesh in that box, and print what they are made of.
//   SHOT_URL=http://localhost:4320/ node scripts/probes/w76-what-is-the-post.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — GOTCHAS 50'); })();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

// The box the item names, with a metre of slack so nothing is missed by rounding.
const BOX = { x0: -6.6, x1: -4.2, z0: -66.4, z1: -63.6 };

const out = await p.evaluate((B) => {
  const cols = window.__ct.colliders().map((c, i) => ({ i, ...c }))
    .filter((c) => c.maxX > B.x0 && c.minX < B.x1 && c.maxZ > B.z0 && c.minZ < B.z1)
    .map((c) => ({
      i: c.i,
      x: `${c.minX.toFixed(2)}…${c.maxX.toFixed(2)}`, z: `${c.minZ.toFixed(2)}…${c.maxZ.toFixed(2)}`,
      w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
      minY: c.minY ?? null, maxY: c.maxY ?? null, rot: c.rot ?? null, why: c.why ?? c.tag ?? null,
    }));
  const meshes = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const x = e[12], y = e[13], z = e[14];
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return;
    const g = o.geometry, P = g?.parameters ?? {};
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    meshes.push({
      name: o.name || '(unnamed)', parent: o.parent?.name || '(unnamed)',
      type: g?.type, w: P.width ?? P.radiusTop ?? null, h: P.height ?? null, d: P.depth ?? null,
      at: `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`,
      colour: mat?.color ? '#' + mat.color.getHexString() : null,
      ud: Object.keys(o.userData ?? {}).join(',') || null,
    });
  });
  return { cols, meshes };
}, BOX);

console.log(`colliders overlapping ${JSON.stringify(BOX)}: ${out.cols.length}`);
for (const c of out.cols) console.log(`  [${c.i}] x ${c.x} (${c.w} m)  z ${c.z} (${c.d} m)  y ${c.minY}…${c.maxY}  rot=${c.rot}  ${c.why ?? ''}`);
console.log(`\nmeshes centred in that box: ${out.meshes.length}`);
for (const m of out.meshes) {
  console.log(`  ${m.name} < ${m.parent} >  ${m.type} w=${m.w} h=${m.h} d=${m.d}  at ${m.at}  ${m.colour}  ud[${m.ud}]`);
}
await b.close();

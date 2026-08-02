// Confirm the LEDGER's "12 flat, unmapped slabs of 11.59 m2 each" in ct/lot.ts
// is the axis-aligned-bounding-box artifact commit 97dd4b7e3 already diagnosed
// (a 0.09 x 5.0 m painted bay-line stripe, rotated ~0.55 rad, whose AABB is
// 2.69 x 4.31 = 11.59 m2) — not a real flat ground slab.
//
//   SHOT_URL=http://localhost:4190/ node scripts/verify-lot-bay-stripes.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await p.evaluate(() => {
  const scene = window.__ct.scene();
  const hits = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    const pr = o.geometry.parameters;
    if (Math.abs(pr.width - 0.09) > 0.001 || Math.abs(pr.height - 5.0) > 0.001) return;
    const e = o.matrixWorld.elements;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    hits.push({
      realAreaM2: +(pr.width * pr.height).toFixed(3),
      rotZ: +o.rotation.z.toFixed(3),
      worldPos: [+e[12].toFixed(2), +e[13].toFixed(2), +e[14].toFixed(2)],
      hasMap: !!(mat && mat.map),
      transparent: mat ? mat.transparent : null,
      opacity: mat ? mat.opacity : null,
    });
  });
  return hits;
});

console.log(`found ${out.length} PlaneGeometry(0.09, 5.0) bay-line stripe meshes (real area ${out[0]?.realAreaM2 ?? '?'} m2 each)`);
for (const h of out) console.log(JSON.stringify(h));

// Reproduce the audit's own AABB-of-a-rotated-plane arithmetic for one of them.
if (out.length) {
  const w = 0.09, h = 5.0, rot = Math.abs(out[0].rotZ);
  const aabbW = Math.abs(w * Math.cos(rot)) + Math.abs(h * Math.sin(rot));
  const aabbH = Math.abs(w * Math.sin(rot)) + Math.abs(h * Math.cos(rot));
  console.log(`\nAABB of a ${w} x ${h} plane rotated ${rot.toFixed(3)} rad: ${aabbW.toFixed(2)} x ${aabbH.toFixed(2)} = ${(aabbW * aabbH).toFixed(2)} m2`);
  console.log(`(the audit's figure: 11.59 m2, x2 rows x6 = 12 count)`);
}

await b.close();

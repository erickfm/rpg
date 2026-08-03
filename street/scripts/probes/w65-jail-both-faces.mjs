// DO THE JAIL'S TWO DOORS AGREE NOW? — the item's headline claim, measured.
//
// The user: *"jail interior front door also looks bad and doesnt match
// outside."* Worker sixty measured the disagreement and named it exactly:
// *"appearance: agrees … state: differs. Exterior yaw 0° (shut), interior yaw
// ±31.5° (ajar). That is the whole of the disagreement."*
//
// So this asks for the STATE, on both faces, in one run. The two are 565 m
// apart and the world's region cull removes whichever one you are not standing
// near, so each is measured from its own side — a scan taken from one place
// would find one face and report the other as absent (GOTCHAS 79).
//
// The signature is `24x64`, which w59's note is explicit is NOT a fingerprint
// for a place: `ct/int-bank.ts` paints a 24x64 arch 566 m away. Proximity to
// the door being measured is what identifies these, not the texture alone.
//
// Run: SHOT_URL=http://localhost:4211/ node scripts/probes/w65-jail-both-faces.mjs
// Exit: 0 the two faces agree · 1 they do not · 2 nothing was measured
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? (() => {
  throw new Error('SHOT_URL required — GOTCHAS 50');
})();

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(900);

const scan = async (cx, cz, reach) => p.evaluate(([x, z, r]) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const P = o.geometry?.parameters ?? {};
    const h = P.height ?? 0, w = Math.max(P.width ?? 0, P.depth ?? 0);
    if (!(h >= 1.8 && h <= 4.2 && w >= 0.35 && w <= 3.0)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const img = mat?.map?.image;
    if (!img || img.width !== 24 || img.height !== 64) return;   // jailLeafTex()
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    if (Math.hypot(e[12] - x, e[14] - z) > r) return;
    const L = Math.hypot(e[8], e[9], e[10]) || 1;
    out.push({ deg: +((Math.atan2(e[8] / L, e[10] / L) * 180) / Math.PI).toFixed(1) });
  });
  return out;
}, [cx, cz, reach]);

const doors = await p.evaluate(() => window.__ct.doors());
const jd = doors?.find((d) => d.building === 'JAIL');
const dims = await p.evaluate(() => window.__ct.roomDims());
const jr = dims?.find((d) => d.id === 'jail');
if (!jd?.stand || !jr) {
  console.error('the world published no JAIL door or no jail room — nothing measured');
  await b.close();
  process.exit(2);
}

await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0.14), [jd.stand.x, jd.stand.z]);
await p.waitForTimeout(400);
const ext = await scan(jd.point.x, jd.point.z, 3.0);

const ix = jr.cx + (jr.door?.x ?? 0), iz = jr.cz + jr.d / 2;
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0), [ix, iz - 3.0]);
await p.waitForTimeout(400);
const ins = await scan(ix, iz, 2.4);
await b.close();

const fmt = (ls) => (ls.length ? ls.map((l) => `${l.deg.toFixed(1)}°`).join(' ') : 'NONE FOUND');
console.log(`street face  (${jd.point.x.toFixed(1)}, ${jd.point.z.toFixed(1)}): ${ext.length} leaves  ${fmt(ext)}`);
console.log(`lobby face   (${ix.toFixed(1)}, ${iz.toFixed(1)}): ${ins.length} leaves  ${fmt(ins)}`);

// A VERDICT OVER AN EMPTY SET IS NOT A PASS (GOTCHAS 34/71). Both faces have to
// have been seen before "they agree" means anything.
if (!ext.length || !ins.length) {
  console.error('\nFAIL — one of the two faces was never found, so nothing was compared');
  process.exit(2);
}
const worst = Math.max(...[...ext, ...ins].map((l) => Math.abs(l.deg)));
if (worst > 0.5) {
  console.error(`\nFAIL — a leaf stands ${worst.toFixed(1)}° open; the two faces do not agree`);
  process.exit(1);
}
console.log(`\nPASS — ${ext.length + ins.length} leaves across both faces, none more than ${worst.toFixed(1)}° off shut`);
process.exit(0);

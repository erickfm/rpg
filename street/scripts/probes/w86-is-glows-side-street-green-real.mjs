// IS glow.mjs's SIDE-STREET "OK 11.7x" MEASURING LAMPLIGHT, OR BASE COLOUR?
//
// One-shot, item 234. glow.mjs's pool clause reads `material.color` and reports
//   main street  0.0450 vs 0.0450 = 1.0x   FAIL
//   side street  1.0000 vs 0.0857 = 11.7x  OK
// The item (and worker eightyfour) explain the main-street 1.0x: `544053b20`
// moved the warm term and the gain into POOL_FRAG, so `props.ts:1494` now writes
// only `base * amb` and `amb` is per-FLOOR. Near and far on one floor are equal
// BY CONSTRUCTION.
//
// But then the SIDE street cannot be measuring lamplight either — the same line
// writes both. So what is its 11.7x? If it is base colour rather than light, the
// ratio must SURVIVE MIDDAY, when `night` is 0 and there is no pool anywhere.
//
// That is the negative control this asks for. It re-runs glow.mjs's own pool
// sampling verbatim (same window, same graded filter, same medians) at 13:00 and
// at 23:00 and prints both.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-is-glows-side-street-green-real.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 880, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await p.waitForTimeout(500);

// glow.mjs's pool sampling, copied so the two cannot disagree about method.
const sample = async () => p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const lamps = [];
  S.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      const e = o.matrixWorld.elements; lamps.push([e[12], e[14]]);
    }
  });
  const REG = { main: { near: [], far: [] }, side: { near: [], far: [] } };
  const NEARWHO = { main: [], side: [] };
  S.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const mat of window.__mats(o)) {
      if (!mat.map) continue;
      if (!o.userData.graded && !mat.userData?.graded) continue;
      const e = o.matrixWorld.elements, x = e[12], z = e[14];
      const main = Math.abs(x) <= 9 && z <= 2 && z >= -96;
      const side = x > 9 && z < -94;
      if (!main && !side) return;
      const c = mat.color, L = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      const d = Math.min(...lamps.map(([lx, lz]) => Math.hypot(x - lx, z - lz)));
      const key = main ? 'main' : 'side';
      if (d < 3.0) {
        REG[key].near.push(L);
        NEARWHO[key].push(`${o.userData.mod ?? '?'} ${o.geometry?.type ?? ''} L=${L.toFixed(4)} d=${d.toFixed(2)} poolLit=${!!mat.userData?.poolLit}`);
      } else if (d > 9) REG[key].far.push(L);
    }
  });
  const med = (a) => (a.length ? a.slice().sort((q, r) => q - r)[Math.floor(a.length / 2)] : null);
  const out = {};
  for (const [k, v] of Object.entries(REG))
    out[k] = { n: v.near.length, f: v.far.length, nearMed: med(v.near), farMed: med(v.far), who: NEARWHO[k].slice(0, 6) };
  return out;
});

for (const hour of [13, 23]) {
  await p.evaluate((h) => window.__ct.clock(h, 0), hour);
  await p.waitForTimeout(1200);
  const r = await sample();
  console.log(`\n── ${String(hour).padStart(2, '0')}:00 ${hour === 13 ? '(MIDDAY — night=0, NO pool exists anywhere)' : '(deep night)'} ──`);
  for (const k of ['main', 'side']) {
    const q = r[k];
    const ratio = q.nearMed / Math.max(q.farMed, 1e-4);
    console.log(`  ${k.padEnd(5)} near ${q.nearMed?.toFixed(4)}  far ${q.farMed?.toFixed(4)}  = ${ratio.toFixed(1)}x   (${q.n}/${q.f} samples)`);
  }
  if (hour === 23) {
    console.log(`\n  what the side street's NEAR samples actually are:`);
    for (const w of r.side.who) console.log(`      ${w}`);
  }
}

console.log(`
  READ IT LIKE THIS. If the side street's ratio is roughly the same at 13:00 as
  at 23:00, it is NOT lamplight — at 13:00 there is no pool at all. It is the
  base colours of two different populations of material, and the "OK" is free.`);
await b.close();

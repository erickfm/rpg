// A LIGHT FITTING SHOULD CAST BECAUSE IT IS A LIGHT FITTING, NOT BECAUSE ITS
// AUTHOR REMEMBERED TO SAY SO.
//
// The row: "lighting on this alley back door looks messed up like it gets
// cropped by door." My own diagnosis of the three lighting reports was that the
// pool is applied PER MESH and stops at mesh boundaries, and the desk's ruling
// on the shape of the fix was: receive by DEFAULT rather than opt in, so a new
// prop cannot be born broken.
//
// The receiving half is already default — `dimWorld` traverses the whole scene
// and offers every material. **The SOURCE half is not.** `lampHeads` only gets
// an entry where ct/props.ts pushes one, and `scene.userData.addLamp` — which I
// published so other modules could declare a light — is called by NOBODY
// (grep: one definition, zero callers). So D's wall fitting glows without
// casting, and it will keep doing that until somebody remembers a line.
//
// So this measures the predicate that would make it automatic, BEFORE anything
// is changed, because the danger is obvious: register too much and the whole
// street lights up, which is the opposite of what the user asked for.
//
//   A LAMP is a SMALL mesh whose material carries its own light.
//     · self-lit    isSelfLit's own verdict, stamped on the material as
//                   userData.selfLit, or declared with userData.lightSource
//     · small       under LAMP_MAX m in every dimension — a lit WINDOW is a
//                   sheet metres across and must never become a source
//     · at height   between LOW and HIGH: not a floor decal, not a roof sign
//
// It prints the candidates and what is already registered. An investigation.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const LAMP_MAX = +(process.env.LAMP_MAX ?? 0.9);
const LOW = 0.5, HIGH = 6.0;

const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1200);

const out = await p.evaluate(([MAX, LOW, HIGH]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const cand = [], big = [], lowHigh = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const emits = mats.some((m) => m && (m.userData?.selfLit || m.userData?.lightSource));
    if (!emits) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const dx = w.max.x - w.min.x, dy = w.max.y - w.min.y, dz = w.max.z - w.min.z;
    const at = [+((w.min.x + w.max.x) / 2).toFixed(2), +((w.min.y + w.max.y) / 2).toFixed(2),
                +((w.min.z + w.max.z) / 2).toFixed(2)];
    const row = { at, size: [+dx.toFixed(2), +dy.toFixed(2), +dz.toFixed(2)],
                  mod: n.userData.mod ?? '?', declared: mats.some((m) => m?.userData?.lightSource) };
    if (Math.max(dx, dy, dz) > MAX) { big.push(row); return; }
    if (at[1] < LOW || at[1] > HIGH) { lowHigh.push(row); return; }
    cand.push(row);
  });
  // what already pools: the private registry, read through the halo stamps the
  // lamp builder leaves, so this does not need props.ts to expose its array
  const heads = [];
  s.traverse((n) => {
    if (!n.isMesh) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m?.userData?.cLight && !n.userData?.lampHalo) return;
    n.geometry.computeBoundingBox();
    const w = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
    heads.push([+((w.min.x + w.max.x) / 2).toFixed(2), +((w.min.z + w.max.z) / 2).toFixed(2)]);
  });
  return { cand, big, lowHigh, heads };
}, [LAMP_MAX, LOW, HIGH]);

console.log(`\n── would a "small self-lit mesh IS a lamp" rule be safe? ──`);
console.log(`   small = under ${LAMP_MAX} m in every dimension; height ${LOW}..${HIGH} m\n`);
console.log(`  CANDIDATES (would become pool sources): ${out.cand.length}`);
const byMod = {};
for (const c of out.cand) byMod[c.mod] = (byMod[c.mod] ?? 0) + 1;
for (const [m, n] of Object.entries(byMod).sort((a, c) => c[1] - a[1])) console.log(`      ${String(n).padStart(4)}  ${m}`);
console.log(`\n  EXCLUDED — too big to be a fitting (a lit window is a sheet): ${out.big.length}`);
const bMod = {};
for (const c of out.big) bMod[c.mod] = (bMod[c.mod] ?? 0) + 1;
for (const [m, n] of Object.entries(bMod).sort((a, c) => c[1] - a[1]).slice(0, 8)) console.log(`      ${String(n).padStart(4)}  ${m}`);
console.log(`\n  EXCLUDED — outside ${LOW}..${HIGH} m: ${out.lowHigh.length}`);

console.log(`\n  the alley candidates (x < -7 or the second alley), which is what the row is about:`);
for (const c of out.cand) {
  if (c.at[0] < -6.9 || (c.at[0] > 40 && c.at[0] < 60)) {
    console.log(`      ${JSON.stringify(c.at)}  ${JSON.stringify(c.size)}  ${c.mod}${c.declared ? '  (declared)' : ''}`);
  }
}
console.log(`\n  ${out.heads.length} meshes already carry a lamp/lens stamp`);
await b.close();

// w93 / item 246 — WHAT WORLD IS `w64-lampwall.mjs` ACTUALLY AIMED AT?
//
// The queue row asserts two faults in that probe: it "filters `x > 300`" and
// it "looks up a `lampList` that does not exist". This measures both against
// the running world instead of arguing about them, and it prints the numbers
// the repair needs:
//
//   1. what lamp accessors scene.userData really publishes, and how many heads
//   2. the x histogram of every tall visible mesh, so the `x > 300` cut can be
//      judged against where the geometry actually is
//   3. how many meshes that cut removes, and how many the h>=6 cut removes
//
// SELF-TEST: run with `--selftest` and the x cut is moved to a value that must
// change the count; if it does not, this probe is not measuring the filter.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4490/';
const SELF = process.argv.includes('--selftest');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1064, height: 796 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1200);

const out = await p.evaluate((cut) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const ud = s.userData;
  const tall = [];
  let visMeshes = 0, allMeshes = 0;
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    allMeshes++;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    visMeshes++;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const h = bb.max.y - bb.min.y;
    if (h < 6) return;
    tall.push({ h: +h.toFixed(2), x0: +bb.min.x.toFixed(1), z0: +bb.min.z.toFixed(1),
      mod: o.userData?.mod ?? (o.parent?.userData?.mod ?? '?') });
  });
  return {
    udKeys: Object.keys(ud),
    lampList: typeof ud.lampList, lamps: typeof ud.lamps,
    addLamp: typeof ud.addLamp,
    headCount: ud.lampHeadCount, uploaded: ud.lampHeadsUploaded,
    allMeshes, visMeshes, tall, cut,
  };
}, SELF ? 0 : 300);

console.log(`world: ${out.allMeshes} meshes, ${out.visMeshes} visible`);
console.log(`lamp accessors — lampList: ${out.lampList}  lamps: ${out.lamps}  addLamp: ${out.addLamp}`);
console.log(`lampHeadCount = ${out.headCount}   lampHeadsUploaded = ${out.uploaded}`);
console.log(`userData keys: ${out.udKeys.join(' ')}`);

const cut = out.cut;
const kept = out.tall.filter(t => !(t.x0 > cut));
console.log(`\ntall (h>=6) visible meshes: ${out.tall.length}`);
console.log(`  the probe's cut  x0 > ${cut}  keeps ${kept.length}, drops ${out.tall.length - kept.length}`);
const bins = new Map();
for (const t of out.tall) {
  const k = Math.floor(t.x0 / 50) * 50;
  bins.set(k, (bins.get(k) ?? 0) + 1);
}
console.log('  x0 histogram (50 m bins):');
for (const k of [...bins.keys()].sort((a, c) => a - c)) console.log(`    x0 ${k}…${k + 50}: ${bins.get(k)}`);
const mods = new Map();
for (const t of kept) mods.set(t.mod, (mods.get(t.mod) ?? 0) + 1);
console.log('  modules among the KEPT set:', [...mods].map(([m, n]) => `${m}=${n}`).join(' '));
await b.close();

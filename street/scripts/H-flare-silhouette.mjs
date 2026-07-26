// H: the user's own predicate for the wheel-flare row, made runnable —
// "orbit and confirm NOTHING SITS OUTSIDE THE SILHOUETTE OF TYRE AND BODY".
//
// Re-evidencing a CONFIRMED that rested on two screenshots of two cars out of
// the fleet. The row said so honestly, but a 2-of-N visual cannot notice the
// flare coming back on the ninth car, and nothing else would either.
//
// Measured in each car's OWN frame: lateral = local x, so a car's yaw does not
// smear the number (the mistake that made me report the lot as square once).
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
console.log(`measuring ${URL}  build ${await p.evaluate(() => document.body.innerText.match(/[0-9a-f]{9}/)?.[0] ?? '?')}`);
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) {
  // Put the flare BACK, in the page only, and see the check go red. Injected at
  // runtime rather than in source so the selftest cannot leave a flare behind.
  const n = await p.evaluate(() => {
    const root = window.__ct.scene(); let hit = 0;
    root.traverse((g) => {
      if (hit || !g.userData || !g.userData.wheelbase) return;
      // Clone a BOX from the car, not a wheel. My first version cloned the
      // TYRE, so the injected flare was itself classified as a tyre and
      // excluded from the test - the selftest caught my selftest.
      const tyre = [], boxes = [];
      g.traverse((o) => {
        if (!o.isMesh) return;
        if (/Cylinder/.test(o.geometry?.type || '')) tyre.push(o);
        else if (/Box/.test(o.geometry?.type || '')) boxes.push(o);
      });
      if (!tyre.length || !boxes.length) return;
      const w = tyre[0], src = boxes[0];
      const box = src.clone();
      box.geometry = src.geometry.clone();
      box.position.set(Math.sign(w.position.x || 1) * 1.10, 0.45, w.position.z);
      box.scale.set(0.6, 0.6, 0.6);
      g.add(box); hit = 1;
    });
    return hit;
  });
  console.log(n ? '  selftest: a flare has been re-attached to one car in the page\n'
                : '  selftest: FOUND NO CAR TO MUTATE — nothing proved\n');
  if (!n) { await b.close(); process.exit(3); }
}
const cars = await p.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const out = [];
  root.traverse((g) => {
    if (!g.userData || !g.userData.wheelbase) return;
    const inv = g.matrixWorld.clone().invert();
    const parts = [];
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const q = o.geometry; if (!q.boundingBox) q.computeBoundingBox();
      const bb = q.boundingBox;
      const m = o.matrixWorld.clone().premultiply(inv).elements;  // into the CAR's frame
      let maxAbsX = 0, minY = Infinity, maxY = -Infinity, absZ = 0;
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
        const x = m[0]*X + m[4]*Y + m[8]*Z + m[12];
        const y = m[1]*X + m[5]*Y + m[9]*Z + m[13];
        const z = m[2]*X + m[6]*Y + m[10]*Z + m[14];
        maxAbsX = Math.max(maxAbsX, Math.abs(x));
        minY = Math.min(minY, y); maxY = Math.max(maxY, y); absZ = Math.max(absZ, Math.abs(z));
      }
      parts.push({ type: q.type, maxAbsX: +maxAbsX.toFixed(4), minY: +minY.toFixed(3), maxY: +maxY.toFixed(3), absZ: +absZ.toFixed(2) });
    });
    const pos = g.getWorldPosition(new (root.constructor === Object ? Object : g.position.constructor)());
    out.push({ at: [+g.matrixWorld.elements[12].toFixed(1), +g.matrixWorld.elements[14].toFixed(1)],
               wb: g.userData.wheelbase, parts });
  });
  return out;
});
console.log(`\ncars with userData.wheelbase: ${cars.length}\n`);
let worstCar = null, bad = 0;
for (const c of cars) {
  const tyres = c.parts.filter((q) => /Cylinder/.test(q.type) && q.maxAbsX > 0.5 && q.minY < 0.6);
  const tyreX = Math.max(0, ...tyres.map((q) => q.maxAbsX));
  // THE BODY MUST BE DEFINED WITHOUT REFERENCE TO THE SUSPECT PARTS. My first
  // version took bodyX as the widest non-tyre mesh, which INCLUDES a flare - so
  // a flare widened the silhouette it was about to be measured against and the
  // check passed by construction. The selftest caught it; that is the whole
  // reason to have one (and it is the auditor's "cannot be decided by its own
  // check", in my own file).
  // The shell is what stands TALL: cab, roof, panels reach above 0.75 m. A
  // flare sits at wheel height and never does, so it cannot define the bar.
  const bodyX = Math.max(0, ...c.parts.filter((q) => !tyres.includes(q) && q.maxY >= 0.75).map((q) => q.maxAbsX));
  const sil = Math.max(tyreX, bodyX);
  // The user's words are "the silhouette of TYRE AND BODY", so the bar is
  // max(tyre, body) - not the tyre alone. Comparing against the tyre alone
  // flagged the car on BLOCKS, which has no tyre at that corner by design and
  // whose blocks sit exactly at the body half-width. That was my filter being
  // wrong, not the world.
  const sil0 = Math.max(tyreX, bodyX);
  const outboard = c.parts.filter((q) => !tyres.includes(q) && q.minY < 0.75 && q.maxAbsX > sil0 + 0.005);
  const over = outboard.length ? Math.max(...outboard.map((q) => q.maxAbsX)) - sil0 : 0;
  if (outboard.length) bad++;
  if (!worstCar || over > worstCar.over) worstCar = { c, over, outboard };
  console.log(`  car at (${String(c.at[0]).padStart(6)},${String(c.at[1]).padStart(7)}) wb ${c.wb}  ${String(c.parts.length).padStart(3)} meshes` +
              `   tyre half-width ${tyreX.toFixed(3)}   body ${bodyX.toFixed(3)}   silhouette ${sil.toFixed(3)}` +
              (outboard.length ? `   <-- ${outboard.length} OUTSIDE THE SILHOUETTE by up to ${over.toFixed(3)} m` : '   ok'));
}
console.log(`\n${bad} of ${cars.length} cars carry a mesh at wheel height outside the silhouette of tyre and body.`);
if (worstCar && worstCar.outboard.length) {
  console.log('\nworst car, the offending parts:');
  for (const q of worstCar.outboard.slice(0, 8))
    console.log(`   ${q.type.padEnd(16)} half-width ${q.maxAbsX}  y ${q.minY}..${q.maxY}  |z| ${q.absZ}`);
}
await b.close();
if (SELFTEST) {
  console.log(bad ? '\n  SELFTEST PASSED — the re-attached flare was caught.'
                  : '\n  SELFTEST FAILED — a flare was added and the check stayed green.');
  process.exit(bad ? 0 : 1);
}
process.exit(bad ? 1 : 0);

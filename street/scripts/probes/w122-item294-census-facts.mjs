// Facts for item 294, before rewriting w72's census: who are the 20 sentinel
// boxes, which vehicles are lot cars by the world's OWN tag, and how many of
// each kind exist in each regime.
//
//   SHOT_URL=http://localhost:4181/ node scripts/probes/w122-item294-census-facts.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(aim('http://localhost:4181/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const f = await p.evaluate(() => {
  const cols = window.__ct.colliders();
  const degenerate = cols.filter((c) => c.maxX - c.minX < 0.001 && c.maxZ - c.minZ < 0.001);
  const tally = (arr) => arr.reduce((m, k) => (m[k] = (m[k] ?? 0) + 1, m), {});
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const cars = [];
  scene.traverse((o) => { if (o.userData?.carKind) cars.push(o); });
  return {
    total: cols.length,
    degenerate: degenerate.length,
    degenerateTags: tally(degenerate.map((c) => String(c.tag ?? '(untagged)'))),
    degenerateAt: tally(degenerate.map((c) => `${c.minX.toFixed(0)},${c.minZ.toFixed(0)}`)),
    lotTagged: cols.filter((c) => /@lot\d+$/.test(String(c.tag ?? ''))).length,
    lotBays: [...new Set(cols.map((c) => (String(c.tag ?? '').match(/@lot(\d+)$/) ?? [])[1]).filter(Boolean))].length,
    lotTagKinds: tally(cols.filter((c) => /@lot\d+$/.test(String(c.tag ?? '')))
      .map((c) => String(c.tag).split('-')[0])),
    sideTagged: cols.filter((c) => /@side$/.test(String(c.tag ?? ''))).length,
    otherCarTags: tally(cols.filter((c) => /^(sedan|hatch|pickup|van)-/.test(String(c.tag ?? '')))
      .map((c) => (String(c.tag).split('@')[1] ?? '(no instance label)').replace(/\d+$/, 'N'))),
    carsTagged: cars.length,
    carsByKind: tally(cars.map((o) => o.userData.carKind)),
  };
});
console.log(JSON.stringify(f, null, 2));
await b.close();

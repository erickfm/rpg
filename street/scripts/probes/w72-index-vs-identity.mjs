// w72 / item 209 — DOES THE COMPARE-BY-ARRAY-INDEX PATTERN ACTUALLY MISPAIR HERE?
//
// The three sites in item 209 all sample a BOX of the world into a flat array
// and then compare `a[i]` against `b[i]`. That is only sound if index N is the
// same material in both samples. This probe answers that directly, and it does
// it the cheapest possible way: TAKE BOTH SAMPLES AT THE SAME CLOCK TIME.
//
// Nothing about the night grade changed between them, so an honest comparison
// must report ZERO differences. Anything the index comparison reports is
// mispairing or animation — and by construction it is a number the real check
// would have attributed to the night sweep.
//
// The identity comparison (three's `material.uuid`, over the intersection of
// the two samples) runs side by side on the SAME two samples, so the two
// numbers are not two experiments — they are two readings of one.
//
// Usage: SHOT_URL=http://localhost:4280/ node scripts/probes/w72-index-vs-identity.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4280/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

/** sample a world box BOTH ways at once: ordered array and uuid map */
const sample = (box) => p.evaluate((bx) => {
  const arr = [], map = {};
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (wp.x < bx[0] || wp.x > bx[1] || wp.z < bx[2] || wp.z > bx[3]) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color || m.transparent) continue;
      arr.push(m.color.getHex());
      map[m.uuid] = m.color.getHex();
    }
  });
  return { arr, map };
}, box);

const dims = await p.evaluate(() => window.__ct.roomDims().map((d) => ({ id: d.id, cx: d.cx })));
const boxes = [];
for (const id of ['casino', 'hotel', 'tax', 'pawn']) {
  const d = dims.find((q) => q.id === id);
  if (d) boxes.push([`G-rooms-walk ${id}`, [d.cx - 7, d.cx + 7, -7, 7]]);
}
boxes.push(['G-vice-walk frontages', [33, 58, -99, -90]]);
const jail = dims.find((q) => q.id === 'jail');
if (jail) boxes.push(['O-jail-night-probe', [jail.cx - 8, jail.cx + 8, -8, 8]]);

// SIX samples spanning ~4 s at ONE clock time. Two samples can agree by luck —
// sixtyfour measured exactly that on interiors-walk, where two shots 450 ms
// apart landed on the same phase of the marquee chase three times in five.
const N = 6, GAP = 800;
console.log(`\n${N} SAMPLES, SAME CLOCK, ${GAP} ms apart — an honest compare must say 0\n`);
console.log('subject                        arr len(s)   uniq  UNSTABLE BY INDEX  UNSTABLE BY UUID');
let worstIdx = 0, pop = 0;
for (const [name, box] of boxes) {
  await p.evaluate(() => window.__ct.clock(2, 0));
  await p.waitForTimeout(900);
  const shots = [];
  for (let i = 0; i < N; i++) { shots.push(await sample(box)); if (i < N - 1) await p.waitForTimeout(GAP); }
  const lens = [...new Set(shots.map((s) => s.arr.length))];
  const a = shots[0];
  // by index: positions where any later shot disagrees (the `!== undefined` guard
  // the real checks use, so this is exactly their arithmetic)
  const byIndex = a.arr.filter((c, i) =>
    shots.some((s) => s.arr[i] !== undefined && s.arr[i] !== c)).length;
  // by uuid: only materials present in EVERY shot are judged
  const shared = Object.keys(a.map).filter((u) => shots.every((s) => s.map[u] !== undefined));
  const byId = shared.filter((u) => shots.some((s) => s.map[u] !== a.map[u])).length;
  pop += a.arr.length;
  worstIdx = Math.max(worstIdx, byIndex);
  console.log(`${name.padEnd(28)} ${lens.join('/').padStart(11)}`
    + ` ${String(Object.keys(a.map).length).padStart(6)}`
    + ` ${String(byIndex).padStart(17)}`
    + ` ${String(byId).padStart(17)} of ${shared.length}`);
}
console.log(`\nworst spurious "dimmed" from index pairing: ${worstIdx}`);
// GOTCHAS 34 / item 209: a probe that measured nothing must not read as good news.
if (pop === 0) { console.log('MEASURED NOTHING — exit 3'); await b.close(); process.exit(3); }
await b.close();

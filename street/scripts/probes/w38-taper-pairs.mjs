// w38 — ITEM 75. What (span, sizeW) pairs does the world actually publish?
//
// Written BEFORE deciding what scripts/wallpool.mjs may assert. A check can
// only test properties the data can show: if the world contains no mesh at a
// partial weight, "the cliff is a taper" is untestable however it is phrased,
// and asserting it anyway produces a guard that passes on an empty set.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(aim('http://localhost:4190/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2500);

const r = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && typeof o.userData.sizeW === 'number')
      out.push([+o.userData.poolSpan.toFixed(3), +o.userData.sizeW.toFixed(4)]);
  });
  return out;
});
await b.close();

console.log('pairs:', r.length);
const full = r.filter((q) => q[1] >= 0.999).length;
const zero = r.filter((q) => q[1] <= 0.001).length;
const mid = r.filter((q) => q[1] > 0.001 && q[1] < 0.999);
console.log(`full ${full}   zero ${zero}   partial ${mid.length}`);

console.log('\npartial-weight pairs, by span:');
for (const q of mid.sort((a, c) => a[0] - c[0])) console.log(`  span ${q[0]}  -> w ${q[1]}`);

const spans = [...new Set(r.map((q) => q[0]))].sort((a, c) => a - c);
console.log(`\ndistinct spans: ${spans.length}  min ${spans[0]}  max ${spans[spans.length - 1]}`);

console.log('\nevery pair in the knee region 4.5 .. 13 m:');
for (const q of r.filter((q) => q[0] > 4.5 && q[0] < 13).sort((a, c) => a[0] - c[0]))
  console.log(`  span ${q[0]}  -> w ${q[1]}`);

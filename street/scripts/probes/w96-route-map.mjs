// Which way does route position `s` run, and where is the crossing on it?
// One question, one answer, so the deadlock probe can spawn a taxi a known
// distance UPSTREAM of the crossing instead of guessing.
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-route-map.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4520/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.traffic !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);
const rows = await p.evaluate(async () => {
  const out = [];
  for (let s = 70; s <= 120; s += 5) {
    window.__ct.drive('NE', 'taxi', s);
    await new Promise((r) => requestAnimationFrame(r));
    const t = window.__ct.traffic()[0];
    if (t) out.push({ s, x: +t.x.toFixed(2), z: +t.z.toFixed(2), yaw: +t.yaw.toFixed(2) });
  }
  return out;
});
for (const r of rows) console.log(`s=${String(r.s).padStart(3)}  x=${String(r.x).padStart(6)}  z=${String(r.z).padStart(8)}  yaw=${r.yaw}`);
console.log('\ncrossing centre is z = -90.2');
await b.close();

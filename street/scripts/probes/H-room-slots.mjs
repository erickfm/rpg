// H: the CURRENT interior slot table, read from the world rather than inherited.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4187/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.roomDims, null, { timeout: 60000 });
const rs = await p.evaluate(() => window.__ct.roomDims().map((r) => ({ id: r.id, cx: r.cx, cz: r.cz, w: r.w, d: r.d })));
rs.sort((a, c) => a.cx - c.cx);
console.log(`${rs.length} interiors, by slot:`);
for (const r of rs) console.log(`   ${String(r.cx).padStart(6)}  ${r.id.padEnd(10)}  ${r.w} x ${r.d}`);
await b.close();

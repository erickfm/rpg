import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(900);
const d = await p.evaluate(() => (window.__ct.doors?window.__ct.doors():[]).map(q=>({
  b:q.building, x:+q.point.x.toFixed(2), z:+q.point.z.toFixed(2), chamfer:q.chamfer })));
console.log(`__ct.doors() returns ${d.length}:`);
for (const q of d) console.log(`   ${q.b.padEnd(16)} (${q.x}, ${q.z})${q.chamfer?'  chamfer':''}`);
const want = ['SEVENS','HOTEL ORPHEUS','BODEGA','DINER','THRIFT','PAWN','A-1 TAX','BURGER BARN'];
const missing = want.filter(w => !d.some(q => q.b.toUpperCase().includes(w.split(' ')[0])));
console.log(`\nmissing from the collected list: ${missing.length ? missing.join(', ') : 'none'}`);
await b.close();

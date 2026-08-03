// throwaway: what does __ct.roomDims() actually publish? (it is an ARRAY)
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto(process.env.SHOT_URL || 'http://localhost:4510/');
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const d = await p.evaluate(() => window.__ct.roomDims());
console.log('isArray:', Array.isArray(d), 'len:', d.length);
console.log(JSON.stringify(d.find((r) => r.id === 'church')));
console.log('ids:', d.map((r) => r.id).join(', '));
await b.close();

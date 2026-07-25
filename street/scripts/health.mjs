import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message)));
console.error(`[measuring ${process.env.SHOT_URL}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
let ok = true;
try { await p.waitForFunction(() => window.__ct !== undefined, { timeout: 12000 }); }
catch { ok = false; }
console.log(ok ? 'WORLD OK — __ct initialised' : 'WORLD BROKEN — __ct never appeared');
if (errs.length) console.log('errors:\n' + errs.slice(0,3).join('\n'));
await b.close();

// H (verifier): which verbs live near the 301 door on MY tree? The auditor saw
// "[E] sleep until morning" win the prompt a pace back on the integrated build.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.spots, null, { timeout: 60000 });
const all = await page.evaluate(() => window.__ct.spots().map(s => ({ label: s.label, x: +s.x.toFixed(2), z: +s.z.toFixed(2), r: s.r })));
const sleep = all.filter(s => /sleep/i.test(s.label));
console.log(`spots in the world: ${all.length}`);
console.log(`spots whose verb mentions "sleep": ${sleep.length}`);
for (const s of sleep) console.log(`   "${s.label}" at (${s.x}, ${s.z}) r ${s.r}`);
const near = all.filter(s => Math.hypot(s.x - 199.36, s.z + 17.45) < 6).sort((a,b)=>
  Math.hypot(a.x-199.36,a.z+17.45) - Math.hypot(b.x-199.36,b.z+17.45));
console.log(`\nevery spot within 6 m of the 301 door spot (199.36, -17.45):`);
for (const s of near) console.log(`   ${Math.hypot(s.x-199.36,s.z+17.45).toFixed(2)} m  "${s.label}"  r ${s.r}  at (${s.x}, ${s.z})`);
await b.close();

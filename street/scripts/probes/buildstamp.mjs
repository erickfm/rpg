// WHICH WORLD AM I WALKING? Reads the stamp the page renders and compares it to
// HEAD. I spent a session measuring c41170c7a while HEAD had moved on, so this
// is now the first thing every verification run does.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { execSync } from 'child_process';
const head=execSync('git rev-parse --short=9 HEAD').toString().trim();
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(1500);
const stamp=await p.evaluate(()=>{
  const t=document.body.innerText||'';
  const m=t.match(/\b[0-9a-f]{7,10}\+?\b/); return m?m[0].replace('+',''):null; });
await b.close();
console.log(`  HEAD  ${head}`);
console.log(`  page  ${stamp ?? '(no stamp found)'}`);
if(!stamp){ console.error('CANNOT ANSWER — no build stamp on the page.'); process.exit(3); }
if(!head.startsWith(stamp)&&!stamp.startsWith(head)){
  console.error(`STALE — the page is serving ${stamp}, HEAD is ${head}. Run: npm run build`);
  process.exit(1); }
console.log('  match — safe to measure');

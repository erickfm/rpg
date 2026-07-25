// The sit spot is in free space and ok=true, yet no prompt fires there. Stand
// on it and ask which spots are in range and which one the HUD is showing --
// the answer is either "none" (the spot is not doing its job) or "another one
// wins" (a nearer spot is stealing the prompt).
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const read = () => {
    const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/\[E\]/.test(e.textContent??''));
    if(!n) return null;
    for(let e=n;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden') return null;}
    return n.textContent.trim();
  };
  const res = [];
  for (const [x, z] of [[-8.65,-19.43],[-8.6,-19.43],[-8.65,-19.6],[-8.65,-19.2],[-8.65,-19.0],[-8.4,-19.43],[-8.9,-19.43]]) {
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>setTimeout(r,60));
    const q = window.__ct.pos();
    const landed = Math.abs(q[0]-x)<0.06 && Math.abs(q[2]-z)<0.06;
    const inRange = window.__ct.spots()
      .map(s => ({ label:s.label, ok:s.ok, d:+Math.hypot(s.x-x, s.z-z).toFixed(2), r:+s.r.toFixed(2) }))
      .filter(s => s.d <= s.r)
      .sort((a,c)=>a.d-c.d);
    res.push({ at:[x,z], landed, prompt: read(), inRange });
  }
  return res;
});
for (const r of out) {
  console.log(`at (${r.at.join(', ')})  landed=${r.landed}  HUD: ${r.prompt ?? '(nothing)'}`);
  if (!r.inRange.length) console.log('    no spot has this point inside its radius');
  for (const s of r.inRange) console.log(`    in range: "${s.label}"  d ${s.d} of r ${s.r}  ok=${s.ok}`);
}
await b.close();

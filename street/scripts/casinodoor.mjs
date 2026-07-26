// The casino's door is declared and never arrives (mainline e6c08482, a circular
// -import namespace resolving undefined). The declaration feeds the door
// PAINTER and the frontage; the [E] trigger is a separate registration. So:
// does a player at the casino still get a door, and still get a prompt?
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(async () => {
  const read = () => {
    const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/\[E\]/.test(e.textContent??''));
    if(!n) return null;
    for(let e=n;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden') return null;}
    return n.textContent.trim();
  };
  const hits = [];
  for (let x = 46; x <= 58; x += 0.5) {
    window.__ct.warp(x, -97.3, 0, 0.14, 0);
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    const s = read(); if (s) hits.push({ x:+x.toFixed(1), s });
  }
  const spots = window.__ct.spots().filter(q => /SEVENS/i.test(q.label||''))
    .map(q=>({label:q.label, x:+q.x.toFixed(2), z:+q.z.toFixed(2), r:+q.r.toFixed(2), ok:q.ok}));
  return { hits, spots, nDoors: (window.__ct.doors?window.__ct.doors():[]).length };
});
console.log(`__ct.doors(): ${out.nDoors}`);
console.log(`SEVENS spots registered: ${out.spots.length}`);
for (const s of out.spots) console.log(`   "${s.label}" at (${s.x}, ${s.z}) r ${s.r} ok=${s.ok}`);
const sevens = out.hits.filter(h => /SEVENS/i.test(h.s));
console.log(`\nwalking the side street x 46…58: ${out.hits.length} samples fired a prompt, ${sevens.length} of them SEVENS`);
if (sevens.length) console.log(`   SEVENS fires from x ${sevens[0].x} … ${sevens[sevens.length-1].x}`);
// and a look at the facade
await p.evaluate(() => window.__ct.warp(51.3, -105, Math.PI, 0.14, 0.05));
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/casino-facade.png' });
console.log('   shot shots/casino-facade.png from (51.3, -105) facing the casino');
await b.close();

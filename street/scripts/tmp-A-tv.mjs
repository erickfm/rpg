import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1000,height:620}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(3000);
const pr = () => p.evaluate(() => (document.getElementById('ct-prompt')?.textContent ?? '').trim() || null);
const pos = () => p.evaluate(() => window.__ct.pos().map(v=>+v.toFixed(2)));
const walk = async (k,f) => { await p.evaluate(x=>window.dispatchEvent(new KeyboardEvent('keydown',{key:x})),k);
  for(let i=0;i<f;i++) await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  await p.evaluate(x=>window.dispatchEvent(new KeyboardEvent('keyup',{key:x})),k); await p.waitForTimeout(200); };
const E = async () => { await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'e'})));
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'e'}))); await p.waitForTimeout(500); };
// clear the arrival latch, then take C's station
for (let k=0;k<8;k++){ await p.evaluate(([y])=>{const v=window.__ct.pos(); window.__ct.warp(v[0],v[2],y);},[k*Math.PI/4]);
  await walk('w',80); const v=await pos(); if (Math.hypot(v[0]-198.6,v[2]+16.3)>1.3) break; }
await p.evaluate(() => window.__ct.warp(198.30, -16.30, 0, 5.4, 0));
await p.waitForTimeout(400);
console.log('at C\'s station:', await pr(), 'pos', await pos());
await E();
console.log('after E       :', await pr(), 'pos', await pos());
await p.screenshot({ path: 'shots/A-tv-seated.png' });
// does the content CUT rather than loop? sample the screen texture over ~20 s
const frames = [];
for (let i=0;i<10;i++) {
  await p.waitForTimeout(2000);
  frames.push(await p.evaluate(() => {
    let sig = null;
    window.__ct.scene().traverse(o => {
      if (sig || !o.isMesh || !o.material?.map) return;
      const w = new o.position.constructor(); o.getWorldPosition(w);
      if (Math.abs(w.x-197.9) < 3 && Math.abs(w.z-(-13.9)) < 6 && w.y > 0.6 && w.y < 2.0)
        sig = o.material.map.uuid?.slice(0,8) + ':' + (o.material.map.version ?? 0);
    });
    return sig;
  }));
}
console.log('screen signature over 20 s:', frames.join(' '));
console.log('distinct:', new Set(frames.filter(Boolean)).size);
await E();
console.log('after standing:', await pr(), 'pos', await pos());
await b.close();

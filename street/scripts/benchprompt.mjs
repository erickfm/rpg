import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.25,-30,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// walk the lane centre south past the bench, as a player does
for(const z of [-33.0,-34.5,-35.45,-36.5]){
 await p.evaluate(([z])=>window.__ct.warp(6.25,z,Math.PI,0.14,-0.10),[z]);
 await afterFrames(p,3);
 const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/bn-${String(z).replace(/[.-]/g,'')}.png`});
 console.log(`  bn-${String(z).replace(/[.-]/g,'')}.png  at (6.25, ${z})  landed ${Math.abs(got[2]-z)<0.4}`);
}
// and seated, from the lane centre
await p.evaluate(()=>window.__ct.warp(6.25,-35.45,Math.PI/2*-1,0.14,-0.05));
await afterFrames(p,3); await p.locator('canvas').first().click({position:{x:640,y:400}}).catch(()=>{});
await p.keyboard.press('KeyE'); await afterFrames(p,4);
const st=await p.evaluate(()=>{try{return window.__ct.seated?.();}catch(e){return String(e);}});
console.log('  seated() from the lane centre:', JSON.stringify(st));
await p.screenshot({path:'shots/bn-seated.png'});
await b.close();

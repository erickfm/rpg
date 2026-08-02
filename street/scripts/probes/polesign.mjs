// "pole sign panel too small / skewed" — I says: verify legibility FROM THE FAR
// KERB, which is what it was enlarged for, and that it stays lit after dark
// while the printed sheets around it correctly do not.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
// find it: a raised panel out by the lot, well above head height
const sign0=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); let best=null;
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2;
    if(x<8||x>40||z<-60||z>-2) return;
    const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z), h=bb.max.y-bb.min.y;
    const cy=(bb.min.y+bb.max.y)/2;
    if(cy<3.0||cy>16||w<1.5||h<0.9) return;
    if(w>8||h>8) return;   // a building face is not a sign
    (globalThis.__cand=globalThis.__cand||[]).push({x:+x.toFixed(2),z:+z.toFixed(2),cy:+cy.toFixed(2),
      w:+w.toFixed(2),h:+h.toFixed(2),top:+bb.max.y.toFixed(2),bot:+bb.min.y.toFixed(2)}); });
  const c=globalThis.__cand||[]; globalThis.__cand=null;
  c.sort((a,b)=>b.cy-a.cy);
  return {list:c.slice(0,10)}; });
// THE PANEL, chosen and justified rather than "the tallest thing near the lot":
// my first pass took the highest candidate and got a ROOFTOP MASS at y 20.8,
// then aimed there while the actual sign sat at the edge of frame. Looking east
// from the far kerb, screen-right is +z, which is where the sign appeared - and
// this candidate is the only sign-sized panel on that side.
const sign=sign0.list.find(c=>c.z>-12&&c.x>24&&c.w>1.8&&c.w<4&&c.cy>4&&c.cy<10) || sign0.list[0];
if(!sign){ console.error('CANNOT ANSWER — no pole-sign panel found by the lot.'); process.exit(3); }
console.log(`panel at (${sign.x}, ${sign.z})  ${sign.w} x ${sign.h} m, y ${sign.bot}..${sign.top}`);
// the FAR KERB: the west walk, across the carriageway, at the sign's own z
const KX=-6.2, KZ=sign.z;   // straight across from it, on the west walk
const dist=Math.hypot(sign.x-KX,sign.z-KZ);
console.log(`far kerb at x ${KX}, so the read is from ${dist.toFixed(1)} m away`);
const pitch=Math.atan2(sign.cy-1.62, dist);
for(const [tag,h] of [['day',13],['night',22]]){
  await p.evaluate((h)=>window.__ct.clock(h,0),h); await afterFrames(p,8); await p.waitForTimeout(600);
  await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
    [KX,KZ,Math.atan2(sign.x-KX,-(sign.z-KZ)),pitch]);
  await afterFrames(p,5);
  const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  await p.screenshot({path:`shots/pole-${tag}.png`});
  console.log(`  pole-${tag}.png from (${g[0]}, ${g[2]}) pitch ${pitch.toFixed(2)}`);
}
await b.close();

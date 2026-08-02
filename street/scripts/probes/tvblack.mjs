// Where IS the set, and what colour is its casing? My first box found 0
// materials, which means my coordinates were wrong, not that the set is
// colourless. Locate it from the published tv state if possible, else from the
// screen mesh, then read the casing around it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
console.log('userData.tv keys:', await p.evaluate(()=>{const t=window.__ct.scene().userData.tv; return t?Object.keys(t).join(' '):'(none)';}));
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  // the SCREEN is the mesh whose material map is the redrawn canvas
  let screen=null;
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||!m.map||!m.map.image) return;
    if(!(m.map.image instanceof HTMLCanvasElement)) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2;
    if(cx<190||cx>210) return;                  // room 301
    if(!screen) screen={x:cx,y:(bb.min.y+bb.max.y)/2,z:(bb.min.z+bb.max.z)/2,
                        w:+(bb.max.x-bb.min.x).toFixed(2),h:+(bb.max.y-bb.min.y).toFixed(2)}; });
  if(!screen) return {screen:null};
  const near=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m||!m.color) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cy=(bb.min.y+bb.max.y)/2, cz=(bb.min.z+bb.max.z)/2;
    if(Math.hypot(cx-screen.x,cy-screen.y,cz-screen.z)>0.75) return;
    near.push({hex:m.color.getHexString(), lum:+((m.color.r+m.color.g+m.color.b)/3).toFixed(3),
               map:!!m.map}); });
  return {screen, near}; });
if(!r.screen){ console.error('CANNOT ANSWER — no canvas-textured screen found in room 301.'); process.exit(3); }
console.log(`\nscreen at (${r.screen.x.toFixed(2)}, ${r.screen.y.toFixed(2)}, ${r.screen.z.toFixed(2)}), ${r.screen.w} x ${r.screen.h} m`);
const cas=r.near.filter(q=>!q.map);
console.log(`materials within 0.75 m of the screen: ${r.near.length}  (casing, i.e. untextured: ${cas.length})`);
const seen=new Map();
for(const c of cas) if(!seen.has(c.hex)) seen.set(c.hex,c.lum);
for(const [hex,lum] of [...seen.entries()].sort((a,b)=>a[1]-b[1])) console.log(`   #${hex}  luminance ${lum}`);
const dark=[...seen.values()].filter(v=>v<0.22).length;
console.log(`\n   distinct casing colours: ${seen.size}, of which darker than 0.22: ${dark}`);
console.log(`   ${seen.size&&dark===seen.size ? 'the set is BLACK — every casing colour is dark' : dark ? 'mixed: some casing is dark, some is not' : '** no dark casing: the set is not black'}`);
await b.close();

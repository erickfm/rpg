// "strange corner for bodega, also collision is odd in this same corner"
// The building cuts the corner at 45 degrees. If the COLLIDER does not, you bump
// into air where the bay is cut away. Map collider occupancy against the visible
// bay, then shoot D's own check view.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.4,-97.4,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const map=await p.evaluate(()=>{
 const cols=window.__ct.colliders();
 const inside=(x,z)=>cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
 const rows=[];
 for(let z=-92.0;z>=-97.5;z-=0.25){ let line='';
  for(let x=5.0;x<=12.0;x+=0.25) line += inside(x,z)?'#':'.';
  rows.push({z:+z.toFixed(2),line});}
 // where does the VISIBLE bay sit? sample the shopfront meshes at the corner
 let vis=[1e9,-1e9,1e9,-1e9];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const wy=m[1]*X+m[5]*Y+m[9]*Z+m[13]; if(wy<0.5||wy>3.5) continue;
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   if(wx<5||wx>12||wz<-97.5||wz>-92) continue;
   if(wx<vis[0])vis[0]=wx; if(wx>vis[1])vis[1]=wx; if(wz<vis[2])vis[2]=wz; if(wz>vis[3])vis[3]=wz;}});
 return {rows, vis, door:window.__ct.doors().find(q=>q.building==='BODEGA')};});
console.log('collider occupancy around the bodega corner   (# = solid, . = walkable)');
console.log('              x 5.0 ------------------------> 12.0');
for(const r of map.rows) console.log(`  z ${String(r.z).padStart(6)}  ${r.line}`);
console.log(`\nvisible shopfront geometry spans x ${map.vis[0].toFixed(2)}..${map.vis[1].toFixed(2)}  z ${map.vis[2].toFixed(2)}..${map.vis[3].toFixed(2)}`);
console.log(`published door: point (${map.door.point.x}, ${map.door.point.z}) normal (${map.door.point.nx.toFixed(3)}, ${map.door.point.nz.toFixed(3)}) chamfer=${map.door.chamfer}`);
for(const [n,x,z,tx,tz,pi] of [['corner',6.4,-97.4,8.2,-95.2,-0.30],['paving',6.9,-96.9,8.0,-95.4,-0.62]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/bc-${n}.png`});
 console.log(`  bc-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.6?'landed':'** MISSED'}`);
}
await b.close();

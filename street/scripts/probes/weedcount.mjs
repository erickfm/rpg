// "a little too many grasses in the streets. like way too many."
// weeds.ts:101 builds every tuft the same way: a Group of exactly TWO
// PlaneGeometry quads, 0.30 x 0.35 * scale, each at position.y = height/2.
// That signature comes from the source, not from eyeballing a shape.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const groups=new Map();
 window.__ct.scene().traverse(o=>{
  if(!o.isMesh||o.geometry?.type!=='PlaneGeometry') return;
  const q=o.geometry.parameters; if(!q?.width||!q?.height) return;
  if(Math.abs(q.width/q.height - 0.30/0.35) > 0.004) return;      // the 0.857 ratio
  if(Math.abs(o.position.y - q.height/2) > 1e-6) return;          // sits ON the ground
  const par=o.parent; if(!par) return;
  if(!groups.has(par)) groups.set(par,{n:0,sc:+(q.height/0.35).toFixed(2)});
  groups.get(par).n++;});
 const out=[];
 for(const [g,v] of groups){ if(v.n!==2) continue;                 // a tuft is exactly two
  const e=g.matrixWorld.elements; out.push({x:+e[12].toFixed(2), y:+e[13].toFixed(2), z:+e[14].toFixed(2), sc:v.sc});}
 const odd=[...groups.values()].filter(v=>v.n!==2).length;
 return {out, odd, groups:groups.size};});
const {out,odd,groups}=r;
if(!out.length){console.error('CANNOT ANSWER — the tuft signature matched nothing. Empty set, not a pass.');process.exit(3);}
console.log(`tufts found: ${out.length}  (${groups} candidate groups, ${odd} not a 2-quad pair)`);
const inStreet=(o)=> (Math.abs(o.x)>=4.5&&Math.abs(o.x)<=8.0&&o.z>=-115&&o.z<=15);
const inSide=(o)=> (o.x>8&&o.x<57&&((o.z>-99&&o.z<-93)||(o.z>-113&&o.z<-107)));
const park=(o)=> o.x<-8;
const lot =(o)=> o.x>8 && !inSide(o);
const S=out.filter(inStreet), SS=out.filter(inSide), P=out.filter(park), L=out.filter(lot);
const other=out.filter(o=>!inStreet(o)&&!inSide(o)&&!park(o)&&!lot(o));
console.log(`\n  STREET kerbs (the user's complaint) : ${S.length}`);
console.log(`  side streets                       : ${SS.length}`);
console.log(`  park (x < -8)                      : ${P.length}`);
console.log(`  car lot                            : ${L.length}`);
console.log(`  elsewhere                          : ${other.length}`);
console.log(`\nstreet tufts, west kerb (x<0):`);
for(const o of S.filter(o=>o.x<0).sort((a,b)=>a.z-b.z)) console.log(`   x ${o.x}  z ${o.z}  scale ${o.sc}`);
console.log(`street tufts, east kerb (x>0):`);
for(const o of S.filter(o=>o.x>0).sort((a,b)=>a.z-b.z)) console.log(`   x ${o.x}  z ${o.z}  scale ${o.sc}`);
// spacing: is it a LINE or an exception?
const zs=S.map(o=>o.z).sort((a,b)=>a-b); const gaps=[];
for(let i=1;i<zs.length;i++) gaps.push(+(zs[i]-zs[i-1]).toFixed(1));
console.log(`\ngaps between street tufts along z: ${gaps.join(', ')||'(fewer than two)'}`);
console.log(`the old placement was every 2.4 m, which is a line; anything over ~10 m reads as an exception`);
await b.close();

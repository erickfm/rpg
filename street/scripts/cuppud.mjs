// Cups: rarer than the other three types? oversized? sitting on the joints?
// Trash: clipping through anything?
// The tag lives on the GROUP (props.ts:2597), not on a mesh — filtering by
// isMesh finds zero and then every downstream check passes off an empty set.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(4.78,-60.15,0,0.14,0));
await p.waitForTimeout(2500);
const lit=await p.evaluate(()=>{const out=[];
 // world bbox by hand: no THREE on window, so transform each mesh's 8 corners
 // by matrixWorld.elements (column-major) and union in plain JS.
 const wbox=(root)=>{let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  root.traverse(o=>{if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox,e=o.matrixWorld.elements;
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const v=[e[0]*X+e[4]*Y+e[8]*Z+e[12], e[1]*X+e[5]*Y+e[9]*Z+e[13], e[2]*X+e[6]*Y+e[10]*Z+e[14]];
    for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i]; if(v[i]>mx[i])mx[i]=v[i];}}});
  return mn[0]>1e8?null:{mn,mx};};
 window.__ct.scene().traverse(m=>{const n=m.userData?.litter; if(!n)return;
  const b=wbox(m); if(!b)return; const [x0,y0,z0]=b.mn,[x1,y1,z1]=b.mx;
  out.push({n,cx:+((x0+x1)/2).toFixed(2),cz:+((z0+z1)/2).toFixed(2),
   w:+(x1-x0).toFixed(3),d:+(z1-z0).toFixed(3),h:+(y1-y0).toFixed(3),ybot:+y0.toFixed(3),
   g:+(m.userData.groundY ?? window.__ct.groundAt((x0+x1)/2,(z0+z1)/2)).toFixed(3)});});
 return out;});
if(!lit.length){console.error('CANNOT ANSWER — no object carries userData.litter. Empty set, not a pass.');process.exit(3);}
const by={}; for(const o of lit)(by[o.n]??=[]).push(o);
console.log(`litter pieces: ${lit.length}, ${Object.keys(by).length} types\n`);
const rank=Object.entries(by).sort((x,y)=>y[1].length-x[1].length);
for(const [n,a] of rank){const f=k=>(a.reduce((s,o)=>s+o[k],0)/a.length).toFixed(3);
  console.log(`  ${n.padEnd(10)} n=${String(a.length).padStart(3)} ${(100*a.length/lit.length).toFixed(1).padStart(5)}%  mean w${f('w')} d${f('d')} h${f('h')}  max footprint ${Math.max(...a.map(o=>Math.max(o.w,o.d))).toFixed(3)}`);}
const ci=rank.findIndex(([n])=>/cup/i.test(n));
console.log(`\ncup rank by count: ${ci<0?'NO CUP TYPE':`${ci+1} of ${rank.length} (${ci===rank.length-1?'RAREST':'not rarest'})`}`);
const fl=lit.filter(o=>Math.abs(o.ybot-o.g)>0.03);
console.log(`sitting on the ground: ${lit.length-fl.length}/${lit.length}; off by >3 cm: ${fl.length}`);
for(const o of fl.slice(0,6))console.log(`   ${o.n} (${o.cx},${o.cz}) bottom ${o.ybot} ground ${o.g}`);
const clip=await p.evaluate((L)=>{const c=window.__ct.colliders?.()||[],out=[];
 for(const o of L)for(const b of c){const m1=b.min??b.box?.min,m2=b.max??b.box?.max; if(!m1||!m2)continue;
  if(o.cx>m1.x+0.05&&o.cx<m2.x-0.05&&o.cz>m1.z+0.05&&o.cz<m2.z-0.05){out.push({...o,in:b.name||'collider'});break;}}
 return {n:c.length,out};},lit);
console.log(`\ncolliders ${clip.n}; litter inside one: ${clip.out.length}  (over ${lit.length} real pieces)`);
for(const o of clip.out.slice(0,8))console.log(`   ** ${o.n} (${o.cx},${o.cz}) inside ${o.in}`);
await b.close();

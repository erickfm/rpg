// B: "span < 6 became a smoothstep - full to 6 m, nothing past 12", and "32
// slots now weighted instead of on/off". props.ts:658 computes
// sizeW = tw*tw*(3-2*tw) and stores it on the slot.
//
// wallpool.mjs REIMPLEMENTS that formula in the script, so it agrees with its
// own copy of the rule rather than with the world. Read the stored values.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const out=[]; const seen=new Set();
  const scan=(o)=>{ if(o&&typeof o==='object'){
    if(typeof o.sizeW==='number'){ const sp=(o.bx1!=null&&o.bz1!=null)
        ? Math.max(o.bx1-o.bx0, o.bz1-o.bz0) : null;
      out.push({w:+o.sizeW.toFixed(4), span: sp!=null? +sp.toFixed(2): null}); } } };
  const s=window.__ct.scene();
  s.traverse(o=>{ if(!o.userData) return;
    for(const k of Object.keys(o.userData)){ const v=o.userData[k];
      if(Array.isArray(v)) v.forEach(scan); else scan(v); } });
  for(const k of Object.keys(s.userData||{})){ const v=s.userData[k];
    if(Array.isArray(v)) v.forEach(scan); else scan(v); }
  return out; });
if(!r.length){ console.error('CANNOT ANSWER — no stored sizeW reachable from the scene.'); process.exit(3); }
const full=r.filter(q=>q.w>=0.999).length, zero=r.filter(q=>q.w<=0.001).length;
const mid=r.filter(q=>q.w>0.001&&q.w<0.999);
console.log(`\nslots carrying a stored sizeW: ${r.length}`);
console.log(`   full weight (1.0):     ${full}`);
console.log(`   excluded (0.0):        ${zero}`);
console.log(`   WEIGHTED in between:   ${mid.length}   — B reports 32`);
if(mid.length){
  const s2=[...mid].sort((a,b)=>a.w-b.w);
  console.log(`   their weights run ${s2[0].w} … ${s2[s2.length-1].w}`);
  const withSpan=mid.filter(q=>q.span!=null);
  if(withSpan.length){
    console.log(`\n   span vs stored weight, against smoothstep(6→12):`);
    for(const q of withSpan.sort((a,b)=>a.span-b.span).slice(0,10)){
      const tw=Math.max(0,Math.min(1,(12-q.span)/6));
      const want=tw*tw*(3-2*tw);
      console.log(`      span ${String(q.span).padStart(6)} m   stored ${q.w.toFixed(4)}   rule ${want.toFixed(4)}   ${Math.abs(want-q.w)<0.01?'agrees':'** DIFFERS'}`);
    }
  }
}
console.log(`\n  ${mid.length>0 ? 'the cliff is a taper — slots exist at partial weight, which an on/off rule cannot produce'
                                : '** every slot is 0 or 1: still on/off'}`);
await b.close();

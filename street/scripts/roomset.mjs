import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>({
  keys: Object.keys(window.__ct).sort(),
  rooms: typeof window.__ct.rooms==='function'?window.__ct.rooms():null,
  dims:  window.__ct.roomDims ?? null,
  doors: typeof window.__ct.doors==='function'?window.__ct.doors():null,
  front: window.__frontages ? window.__frontages.map(f=>({n:f.name,axis:f.axis,lo:f.loWorld,hi:f.hiWorld,face:f.facePos,out:f.outward,door:f.doorWorld})) : null,
}));
console.log('__ct keys:', r.keys.join(' '));
console.log('rooms:',JSON.stringify(r.rooms).slice(0,700));
console.log('\nroomDims:',JSON.stringify(r.dims||null).slice(0,1400));
console.log('\ndoors:',JSON.stringify(r.doors||null).slice(0,700));
console.log('\nfrontages:',(r.front||[]).length);
for(const f of (r.front||[])) console.log(`  ${String(f.n).padEnd(10)} axis ${f.axis}  world ${f.lo}..${f.hi}  face ${f.face}  out ${f.out}  door ${f.door}`);
await b.close();

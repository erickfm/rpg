// "side benches have backs which are backwards?" E: the bench faced the park and
// the SITTER faced the wall. My dot-to-centre test was ambiguous for a bench near
// the middle, so test what a sitter SEES: cast along the seat's own facing and
// measure how far before something blocks it. A wall is close; the park is not.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const seats=(window.__ct.seats?window.__ct.seats():[])
   .filter(q=>q.pose&&q.pose.x>-42&&q.pose.x<-8&&q.pose.z>-102&&q.pose.z<-58);
 const cols=window.__ct.colliders();
 // The seat pose sits INSIDE the bench's own collider, so a naive ray hits the
 // bench at 0.4 m in both directions and measures the furniture, not the view.
 // Exclude whatever box the sitter is already inside.
 const own=(x,z)=>cols.filter(c=>x>c.minX-0.05&&x<c.maxX+0.05&&z>c.minZ-0.05&&z<c.maxZ+0.05);
 const reach=(x,z,fx,fz)=>{ const skip=new Set(own(x,z));
  for(let t=0.4;t<=25;t+=0.25){ const px=x+fx*t, pz=z+fz*t;
   if(cols.some(c=>!skip.has(c)&&px>c.minX&&px<c.maxX&&pz>c.minZ&&pz<c.maxZ)) return +t.toFixed(2); }
  return 25; };
 let s=`park seats: ${seats.length}\n\n  seat position        sitter sees   behind them   verdict\n`;
 let bad=0;
 for(const q of seats){
  const yaw=q.pose.yaw, fx=Math.sin(yaw), fz=-Math.cos(yaw);   // camera convention
  const fwd=reach(q.pose.x,q.pose.z,fx,fz);
  const back=reach(q.pose.x,q.pose.z,-fx,-fz);
  const wrong = fwd < back - 1.0;                               // more room behind than in front
  if(wrong) bad++;
  s+=`  (${String(q.pose.x.toFixed(1)).padStart(6)}, ${String(q.pose.z.toFixed(1)).padStart(6)})  ${String(fwd).padStart(6)} m   ${String(back).padStart(6)} m   ${wrong?'** FACES THE CLOSER SIDE':'faces the open side'}\n`;
 }
 s+=`\n  seats whose sitter faces the closer side: ${bad} of ${seats.length}   (E: old yaw gave "4 of 9 face out")\n`;
 return s;}));
await b.close();

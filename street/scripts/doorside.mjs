// "the interior door doesnt match the exterior doorway". Walk in through a door
// that sits left of a shopfront's centre and, turning to face back out, it
// should be the same door in the same place - so the interior door's offset
// from the room's centre must MIRROR the exterior door's offset from the
// building's frontage centre.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const rooms=await p.evaluate(()=>window.__ct.roomDims());
const doors=await p.evaluate(()=>window.__ct.doors());
// THE CASINO IS CALLED SEVENS. This map keyed the casino on /ACES/i, and the
// rename to SEVENS left it matching nothing — so `ext.find(...)` returned
// undefined, the casino printed "no exterior frontage published — UNDECIDABLE"
// and dropped out of the count, which read `decidable rooms: 4` instead of 5.
// A room silently leaving a check is not a smaller check, it is a check that
// says nothing about that room while still printing a number.
//
// G caught exactly this shape in casinodoor.mjs and bigtwo.mjs when doing the
// rename and called it out as the real hazard of a bare `ACES`; this file was
// missed. Matching BOTH names so the check survives the next rename too.
const NAME={bodega:/BODEGA/i,burger:/BURGER/i,casino:/SEVENS|ACES/i,church:/BRIGID/i,diner:/DINER/i,
            hotel:/ORPHEUS/i,library:/LIBRARY/i,pawn:/PAWN/i,tax:/TAX/i,thrift:/THRIFT/i};
// and prove every pattern still matches something, so the next rename cannot
// silently drop a room the way this one nearly did.
const buildings=doors.map(d=>d.building);
const dead=Object.entries(NAME).filter(([,re])=>!buildings.some(b=>re.test(b))).map(([k])=>k);
if(dead.length){ console.error(`CANNOT ANSWER — these patterns match no building: ${dead.join(', ')}`);
  console.error(`  buildings present: ${buildings.join(', ')}`); process.exit(3); }
const ext=await p.evaluate((ds)=>ds.map(d=>{
  const cs=window.__ct.colliders(); let best=null,bestA=0;
  for(const c of cs){ const a=(c.maxX-c.minX)*(c.maxZ-c.minZ);
    if(a<40||a>4000) continue;
    if(!(d.point.x>c.minX-1.5&&d.point.x<c.maxX+1.5&&d.point.z>c.minZ-1.5&&d.point.z<c.maxZ+1.5)) continue;
    if(a>bestA){ bestA=a; best={minX:c.minX,maxX:c.maxX,minZ:c.minZ,maxZ:c.maxZ}; } }
  return best?{b:d.building, dx:d.point.x, dz:d.point.z, nx:d.point.nx, nz:d.point.nz, ...best}:null;
}).filter(Boolean), doors);
console.log(`\n room      ext door offset   int door offset   mirrored?`);
let decid=0, ok=0, bad=[];
for(const rm of rooms){
  const e=ext.find(q=>NAME[rm.id]&&NAME[rm.id].test(q.b));
  if(!e){ console.log(`  ${rm.id.padEnd(8)}  (no exterior frontage published — UNDECIDABLE)`); continue; }
  // EACH DOOR'S OWN NORMAL decides which component is the along-frontage offset.
  // My first version used the EXTERIOR normal for both, so for a room whose
  // interior door faces a different axis it read the room's half-DEPTH as an
  // offset - the church came out at 12.00, which is simply half of its 24 m.
  const eAlongX=Math.abs(e.nz)>Math.abs(e.nx);
  const cen = eAlongX ? (e.minX+e.maxX)/2 : (e.minZ+e.maxZ)/2;
  const eo  = eAlongX ? e.dx-cen : e.dz-cen;
  const iAlongX=Math.abs(rm.door.nz)>Math.abs(rm.door.nx);
  const io  = iAlongX ? rm.door.x : rm.door.z;
  // A CENTRED EXTERIOR DOOR CANNOT DECIDE ANYTHING - 0 has no side to mirror.
  // F's rule; mine required both to be centred, which made the library look
  // like a failure when its exterior door is dead centre.
  if(Math.abs(eo)<0.25||Math.abs(io)<0.25){ console.log(`  ${rm.id.padEnd(8)}  ${eo.toFixed(2).padStart(6)}          ${io.toFixed(2).padStart(6)}      centred both sides — UNDECIDABLE`); continue; }
  // A CHAMFERED DOOR HAS NO FRONTAGE AXIS. At 45 degrees both normal components
  // are equal, so "which way does the facade run" has no answer and the offset
  // cannot be decomposed. The bodega is the one such door and it came out as a
  // failure purely because I forced the question on it.
  if(Math.min(Math.abs(e.nx),Math.abs(e.nz))>0.3){
    console.log(`  ${rm.id.padEnd(8)}  ${eo.toFixed(2).padStart(6)}          ${io.toFixed(2).padStart(6)}      chamfered corner door — UNDECIDABLE`);
    continue; }
  decid++;
  // WHICH WAY THE FACADE FACES. "Opposite signs = correct" is only true for
  // buildings on ONE side of the street, and tax and thrift are on opposite
  // sides - so that rule fails tax for existing. F hit this exact bug and
  // documented the real relation in notes/F-doorside-tax.md:
  //     worldOffset = side * localOffset,   side = -outward normal
  // doors() publishes the OUTWARD normal, so side is its negation.
  const nAlong = eAlongX ? e.nx : e.nz;          // the normal's component along the frontage-perpendicular axis
  const nPerp  = eAlongX ? e.nz : e.nx;          // ...the one that actually points out of the facade
  const side   = -Math.sign(nPerp || nAlong);
  const mirrored=Math.sign(eo)===Math.sign(side*io);
  if(mirrored) ok++; else bad.push(`${rm.id}: exterior ${eo.toFixed(2)}, interior ${io.toFixed(2)}, side ${side} — expected world offset ${(side*io).toFixed(2)}`);
  console.log(`  ${rm.id.padEnd(8)}  ${eo.toFixed(2).padStart(6)}          ${io.toFixed(2).padStart(6)}   side ${String(side).padStart(2)}   ${mirrored?'yes':'** NO'}`);
}
console.log(`\n  decidable rooms: ${decid}, mirroring correctly: ${ok}`);
for(const q of bad) console.log(`   ** ${q}`);
if(!decid){ console.error('CANNOT ANSWER — no room was decidable.'); process.exit(3); }
await b.close();

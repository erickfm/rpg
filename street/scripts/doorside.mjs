// THE DOOR MUST BE ON OPPOSITE SIDES INSIDE AND OUT, for all EIGHT rooms.
//
// mirror-walk.mjs checks this by walking, and mainline reports it was dev-only
// and knew three of eight rooms, with PAWN reading wrong. This asks the same
// question from published data instead -- __ct.doors() for the interior side,
// globalThis.__frontages for the street side -- so it covers every room and
// needs no camera.
//
// A room and its facade are two faces of one wall, so the signed offset of the
// doorway from centre must have OPPOSITE signs on the two sides.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const doors = window.__ct.doors ? window.__ct.doors() : null;
  const fronts = globalThis.__frontages || null;
  return { doors, fronts: fronts ? fronts.map(f => ({ name:f.name, axis:f.axis, lo:f.loWorld, hi:f.hiWorld,
    door:f.doorWorld, facePos:f.facePos, w:f.frontageM })) : null };
});
if (!out.doors) { console.log('__ct.doors() unavailable'); }
else {
  console.log(`${out.doors.length} declared doors, ${out.fronts ? out.fronts.length : 0} frontages\n`);
  console.log(JSON.stringify(out.doors.slice(0, 3), null, 2));
  console.log('\nfrontage door offsets from frontage centre:');
  for (const f of (out.fronts||[])) {
    const c = (f.lo + f.hi) / 2;
    console.log(`   ${f.name.padEnd(16)} centre ${c.toFixed(2)}  door ${f.door.toFixed(2)}  offset ${(f.door - c).toFixed(2)}`);
  }
}
writeFileSync('shots/doorside.json', JSON.stringify(out,null,2));
await b.close();

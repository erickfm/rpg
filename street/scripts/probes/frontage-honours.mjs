// Did the painter paint the door where the ROOM said, or where it fancied?
//
// The frontage contract has three consumers and one number: the room declares a
// world coordinate, the painter reads it and paints there, the [E] spot stands
// in front of it. Two of those three are checked — mirror-walk walks the room
// against the declaration, doors-declared checks the declaration arrives at all.
//
// NOBODY CHECKED THE MIDDLE ONE. If a shop registers its frontage BEFORE its
// room declares, the painter takes its own fallback and the declaration is
// silently ignored: the room and the [E] spot agree with each other and the
// facade disagrees with both. That ordering is load-bearing and undocumented in
// any test — ct/doors.ts's own comment says publishDeclaredDoors() must run
// before buildStreet, which is exactly the kind of constraint that holds until
// somebody moves a line.
//
// `FrontageWorld.doorDeclared` records which happened, so this is now checkable
// from outside: every building that declares a door must have a frontage whose
// doorDeclared is true and whose doorWorld IS that number.
//
//   node scripts/frontage-honours.mjs
//   node scripts/frontage-honours.mjs --selftest
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (SELFTEST) {
  // Make one frontage forget it was told. Runtime only — the same shape as the
  // real fault, where the painter never received the declaration.
  const hit = await p.evaluate(() => {
    const f = (globalThis.__frontages ?? []).find((x) => x.doorDeclared);
    if (!f) return null;
    f.doorDeclared = false;
    f.doorWorld = f.doorWorld + 3;      // and paint it three metres off
    return f.name;
  });
  console.log(`selftest: made ${hit} forget its declaration — this MUST now go red`);
}

const rows = await p.evaluate(() => {
  const fr = globalThis.__frontages ?? [];
  return (window.__ct.doors() ?? []).map((d) => {
    if (d.chamfer) return { name: d.building, skip: 'canted bay — deliberately never handed to the painter' };
    const f = fr.find((x) => x.name === d.building);
    if (!f) return { name: d.building, skip: 'no registered frontage — the painter draws no door for it' };
    const declared = f.axis === 'z' ? d.point.z : d.point.x;
    return { name: d.building, declared: +declared.toFixed(2), painted: +f.doorWorld.toFixed(2),
             honoured: f.doorDeclared, off: +Math.abs(f.doorWorld - declared).toFixed(2) };
  });
});
await b.close();

const bad = rows.filter((r) => !r.skip && (!r.honoured || r.off > 0.02));
for (const r of rows) {
  if (r.skip) { console.log(`  ·  ${r.name.padEnd(12)} ${r.skip}`); continue; }
  const ok = r.honoured && r.off <= 0.02;
  console.log(`  ${ok ? '✓' : '✗'}  ${r.name.padEnd(12)} room said ${r.declared}, facade painted ${r.painted}`
    + (r.honoured ? '' : '   THE PAINTER USED ITS OWN FALLBACK'));
}

if (SELFTEST) {
  if (bad.length) { console.log(`\nSELFTEST PASSED — the ignored declaration was caught`); process.exit(0); }
  console.error('\nSELFTEST FAILED — a frontage was made to ignore its room and this did not notice.');
  process.exit(2);
}
if (!bad.length) { console.log(`\n${rows.filter((r) => !r.skip).length} declared doors, every one honoured by the facade`); process.exit(0); }
console.error(`\n${bad.length} facade(s) did not paint the door the room declared.`);
console.error('The room and the [E] spot will agree with each other and the facade will not —');
console.error("which is the user's original complaint. Check that publishDeclaredDoors() still");
console.error('runs before buildStreet (ct/doors.ts explains why that ordering is load-bearing).');
process.exit(1);

// A ROOM AND ITS FACADE ARE TWO FACES OF ONE WALL, SO THEIR DOORS MIRROR.
//
// An ASSERTION, and it exits non-zero. The user, standing in the tax office:
// "the interior of the tax service is on the right side of the interior so i
// would expect the exterior to match. so it should be on the left side of the
// building exterior representing this interior. this should be done for all
// buildings. make the exteriors match the interiors."
//
// Their test is to stand inside, note the side, walk out, turn round, and
// confirm it swapped. That is the right test and it is also the one nobody
// runs for all ten rooms, which is why this reads the same fact off the
// geometry instead.
//
// THE SIGN HERE IS CALIBRATED, NOT DERIVED, and that distinction cost me a
// false report. I first wrote the obvious thing — a room and its facade are
// two faces of one wall, so the offsets must have OPPOSITE sign — and it
// failed four buildings at once with the magnitudes matching to the
// centimetre. Magnitudes that exact across four independent rooms mean a
// working transform and a wrong expectation, not four broken rooms.
//
// So I ran the user's own test on the diner. Standing INSIDE facing the front
// wall the door is on the RIGHT and the window on the LEFT; standing outside
// facing the facade the door is on the LEFT. It mirrors, correctly, and it
// always did.
//
// The reason is that the mirror is in the VIEWING, not in the coordinate: you
// turn round to look at the other face of the wall, and room-local +x already
// runs the same way as the frontage's canvas u. `alongU` is where the one
// handedness conversion lives, and `ct/interior.ts` has already applied it —
// so a second negation here is GOTCHAS 35's trap word for word, a mirror the
// construction already performed being applied once more by hand.
//
// Hence: SAME sign, equal magnitude once scaled by room width over frontage
// width. Anything else means a room really has been built back to front.
//
// Both numbers come from published state — `__frontages` and `__ct.roomDims()`
// — so this checks what the world built, not what either side intended.
//
// REGISTERED in scripts/checks.mjs; its mutation is `door-mirror-skew` in
// scripts/canfail.mjs, which shifts what the ROOMS declare by 2 m so the
// facade door moves while the room's own hand-typed `at:` does not. It has to
// move ONE side only — a number both consumers read would move them together
// and this check would pass, which is the trap GOTCHAS 34 describes.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const TOL = 0.20;                       // metres, on a door about 1.05 wide

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const rows = await p.evaluate(() => {
  const fr = globalThis.__frontages || [];
  const rooms = window.__ct.roomDims();
  const out = [];
  for (const r of rooms) {
    // Match a room to its frontage by id. SUBSTRING EITHER WAY, not
    // startsWith: 'A-1 TAX' normalises to 'atax', which does not START with
    // 'tax', so a prefix match silently dropped the one building the user
    // actually complained about and reported it as "no frontage registered".
    // A checker that quietly excludes its subject is GOTCHAS 34 — the verdict
    // was free for that room.
    const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    const f = fr.find((q) => norm(q.name).includes(r.id) || r.id.includes(norm(q.name)));
    if (!f) { out.push({ id: r.id, skip: 'no frontage registered' }); continue; }
    // An UNDECLARED frontage has no door to mirror — `doorWorld` is the
    // painter's own fallback guess, so comparing a room against it measures
    // nothing about agreement. The BODEGA is the live case and it is by
    // design: its door is on the canted bay, which tex-world.ts says is
    // "deliberately never handed to the painter". Reporting it as a mirror
    // failure is a false finding against a documented exception.
    if (!f.doorDeclared) {
      out.push({ id: r.id, skip: `${f.name}: door not declared, so the facade has only a fallback` });
      continue;
    }
    const centre = (f.loWorld + f.hiWorld) / 2;
    // the facade door's offset from the frontage centre, measured along u so
    // the sign means the same thing on both sides of the street
    const facade = (f.doorWorld - centre) * (f.uDir > 0 ? 1 : -1);
    const roomOff = r.door.x;                       // room-local, from its centre
    const scale = r.w / f.frontageM;
    out.push({
      id: r.id, name: f.name, declared: f.doorDeclared,
      facade: +facade.toFixed(2), room: +roomOff.toFixed(2),
      expect: +(facade * scale).toFixed(2), scale: +scale.toFixed(3),
    });
  }
  return out;
});
await b.close();

const checked = rows.filter((r) => !r.skip);
// GOTCHAS 34: assert the population before the verdict — every "mirrors"
// below is free over an empty match set, and this id-matching is exactly the
// kind of predicate that quietly stops matching.
if (checked.length < 4) {
  console.error(`ABORT: only ${checked.length} of ${rows.length} rooms matched a frontage — `
    + 'the id match has stopped working, so the verdict would be free.');
  for (const r of rows) console.error(`   ${r.id}: ${r.skip ?? 'matched'}`);
  process.exit(3);
}

console.log(`\n  ${checked.length} rooms matched to a frontage (of ${rows.length} rooms)\n`);
const bad = [];
for (const r of checked) {
  const off = Math.abs(r.room - r.expect);
  const ok = off <= TOL;
  if (!ok) bad.push(r);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(13)} facade ${String(r.facade).padStart(6)} m from centre  ->  `
    + `room expects ${String(r.expect).padStart(6)}, has ${String(r.room).padStart(6)}  (off ${off.toFixed(2)} m`
    + `${r.declared ? '' : ', door NOT declared'})`);
}
for (const r of rows.filter((q) => q.skip)) console.log(`  --   ${r.id.padEnd(13)} ${r.skip}`);
console.log('');

if (bad.length) {
  console.error(`FAIL: ${bad.length} room(s) whose door does not mirror its facade — `
    + `${bad.map((r) => r.name).join(', ')}. Walk out, turn round, and the door has not swapped sides.`);
  process.exit(1);
}
console.log('OK  every matched room mirrors its facade door.');

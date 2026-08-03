// ITEM 98 — DID WIDENING THE CONE RE-BREAK THE BED/DOOR CASE, OR DID THE CHECK'S
// OWN TURN FAIL? Two candidates, one experiment.
//
// `w40-bed-vs-door.mjs` went from 5/5 green to 3/5 green after the ceiling moved
// 14.90° -> 25.00°, always on the same assertion: at the fire station it turns to
// face the door and reads "sit on the bed and watch TV". The row is explicit that
// this must not regress — *"i dont want sit on bed and watch tv to be the main
// option if im facing the door to leave"* — so it has to be settled, not counted.
//
// BUT THE SAME RUN PASSES THE BAND WALK AT THE SAME DISTANCES, three strides
// earlier, facing the same way. Something differs between those two poses, and
// the check itself has a candidate in it: `turnTo()` gives up after 120 attempts
// and RETURNS FALSE, and the fire station is one of the two places its return
// value is not asserted. A heading that was never reached would produce exactly
// this reading.
//
// So: take `turnTo` out of the question entirely. `warp` sets yaw exactly, so
// every pose here is the heading it claims to be, and the bed/door contest can be
// read across the whole band and a window of headings around the door instead of
// at one lucky pose. Same probe, both builds, and the difference — if there is
// one — is the world's.
//
// It PRINTS; it does not assert. The verdict belongs to `w40-bed-vs-door.mjs`,
// which walks. This says which of the two hypotheses to believe.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item98-fire-pose.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4482/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

// INTO THE FLAT FIRST, and a real settle. A warp that changes STOREY takes about
// 1.5 s to resolve (GOTCHAS 51); a probe that starts reading before that is
// reading the stairwell.
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([g]) => window.__ct.warp(199.36, -15.545, 0, g, 0), [gy]);
await p.waitForTimeout(2000);

const room = await p.evaluate(() => {
  const s = window.__ct.spots().filter((q) => q.ok && q.x > 190 && q.x < 210);
  const bed = s.find((q) => /bed/i.test(q.label));
  const door = s.find((q) => /the door/i.test(q.label));
  const pick = (q) => q && { x: q.x, z: q.z, r: q.r, label: q.label };
  return { bed: pick(bed), door: pick(door) };
});
if (!room.bed || !room.door) {
  console.error('CANNOT ANSWER — flat 301 does not register both a bed seat and a door spot.');
  await b.close(); process.exit(3);
}
const { bed, door } = room;
const TOUCH = await p.evaluate(() => window.__ct.touchMargin());
const RADIUS = await p.evaluate(() => window.__ct.playerRadius());
const sep = Math.hypot(bed.x - door.x, bed.z - door.z);
console.log(`world   ${URL}`);
console.log(`bed     "${bed.label}"  (${bed.x.toFixed(2)}, ${bed.z.toFixed(2)}) r${bed.r}`);
console.log(`door    "${door.label}" (${door.x.toFixed(2)}, ${door.z.toFixed(2)}) r${door.r}`);
console.log(`sep ${sep.toFixed(2)} m   RADIUS ${RADIUS}   TOUCH_MARGIN ${TOUCH}`);

const bearing = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));
const prompt = () => p.evaluate(() => {
  if (window.__ct.landing?.()) return '<<LANDING>>';
  const el = document.getElementById('ct-prompt');
  if (!el || getComputedStyle(el).display === 'none') return null;
  const t = (el.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const at = async (x, z, yaw) => {
  const g = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
  await p.evaluate(([a, c, y, gg]) => window.__ct.warp(a, c, y, gg, 0), [x, z, yaw, g]);
  for (let i = 0; i < 8; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  return prompt();
};

// THE BAND, derived from the two spots rather than typed: stations lie on the
// bed->door line, from the player's own capsule out to the edge of the bed's
// aim-free touch circle. That is precisely the contested band `w40` defines.
const ux = (door.x - bed.x) / sep, uz = (door.z - bed.z) / sep;
const REACH = bed.r + TOUCH;
const dists = [];
for (let d = RADIUS; d <= REACH + 1e-9; d += 0.05) dists.push(+d.toFixed(2));
// SELF-TEST, BOTH SIGNS: the oracle must be able to name the door and to name the
// bed, or a table of one answer proves nothing.
const sYes = await at(bed.x + ux * 0.6, bed.z + uz * 0.6, bearing(bed.x + ux * 0.6, bed.z + uz * 0.6, door.x, door.z));
const sNo = await at(bed.x + ux * 0.6, bed.z + uz * 0.6, bearing(bed.x + ux * 0.6, bed.z + uz * 0.6, bed.x, bed.z));
console.log(`\nself-test  aimed at the door -> ${JSON.stringify(sYes)}`);
console.log(`self-test  aimed at the bed  -> ${JSON.stringify(sNo)}`);
if (!/door/i.test(sYes ?? '') || !/bed/i.test(sNo ?? '')) {
  console.error('ABORT: the oracle cannot name both spots from the same station.');
  await b.close(); process.exit(3);
}

console.log(`\nband ${dists[0]} .. ${dists[dists.length - 1]} m from the bed, on the bed->door line`);
console.log('rows are distance from the bed; columns are yaw error from the EXACT door bearing\n');
const OFFS = [-30, -20, -10, -5, 0, 5, 10, 20, 30];
console.log('   d     ' + OFFS.map((o) => String(o).padStart(5)).join(''));
let door_n = 0, bed_n = 0, other_n = 0;
for (const d of dists) {
  const x = bed.x + ux * d, z = bed.z + uz * d;
  const base = bearing(x, z, door.x, door.z);
  const cells = [];
  for (const o of OFFS) {
    const got = await at(x, z, base + (o * Math.PI) / 180);
    const c = /door/i.test(got ?? '') ? 'DOOR' : /bed/i.test(got ?? '') ? ' bed' : '  - ';
    if (c === 'DOOR') door_n++; else if (c === ' bed') bed_n++; else other_n++;
    cells.push(c.padStart(5));
  }
  console.log(`  ${d.toFixed(2)}  ${cells.join('')}`);
}
const tot = door_n + bed_n + other_n;
console.log(`\nBETWEEN bed and door:  DOOR ${door_n}/${tot}   bed ${bed_n}/${tot}   neither ${other_n}/${tot}`);

// ── THE OTHER SIDE OF THE BED, which is where `w40` actually fires from ────
//
// Measured with `w114-item98-fire-turn.mjs`: the check's fire station sits at
// d(bed) 0.59-0.66 and **d(door) 1.78-1.83**, roughly 0.35 m off the bed->door
// line. That is BEHIND the bed, not between the two — its inward band walk
// leaves the player facing the bed and `walkUntil` then holds W straight into
// it, so the 0.55 m it wants is reached by being pushed through rather than by
// walking out. The door's own touch circle reaches 1.10 m, so that station is
// outside the overlap the check's prose describes.
//
// It matters because from back there the bed is nearly ON the line to the door:
// with |PB| 0.62, |PD| 1.81 and |BD| 1.27 the cosine rule puts the bed **24.2°**
// off the aim, which is inside a 25° cone and outside a 14.90° one. So this is
// the one pose where the user's chosen number costs something, and it deserves
// a table rather than an anecdote.
const OFFLINE = 0.35;
const nx = -uz, nz = ux;                       // unit normal to the bed->door line
console.log('\nBEHIND the bed (the pose w40 fires from), aimed at the door');
console.log('rows are distance BEHIND the bed; columns are yaw error from the door bearing\n');
console.log('   d     ' + OFFS.map((o) => String(o).padStart(5)).join('') + '    bed off-axis');
let d2 = 0, b2 = 0, o2 = 0;
for (const d of dists) {
  const x = bed.x - ux * d + nx * OFFLINE, z = bed.z - uz * d + nz * OFFLINE;
  const base = bearing(x, z, door.x, door.z);
  // the bed's own off-axis angle from this station, aimed at the door — the
  // quantity the ceiling is compared against, computed from the three measured
  // positions rather than from any constant in fp.ts
  const toBed = bearing(x, z, bed.x, bed.z);
  const off = Math.abs(Math.atan2(Math.sin(toBed - base), Math.cos(toBed - base))) * 180 / Math.PI;
  const cells = [];
  for (const o of OFFS) {
    const got = await at(x, z, base + (o * Math.PI) / 180);
    const c = /door/i.test(got ?? '') ? 'DOOR' : /bed/i.test(got ?? '') ? ' bed' : '  - ';
    if (c === 'DOOR') d2++; else if (c === ' bed') b2++; else o2++;
    cells.push(c.padStart(5));
  }
  console.log(`  ${d.toFixed(2)}  ${cells.join('')}      ${off.toFixed(1)}°`);
}
console.log(`\nBEHIND the bed:  DOOR ${d2}/${d2 + b2 + o2}   bed ${b2}/${d2 + b2 + o2}   neither ${o2}/${d2 + b2 + o2}`);
console.log(`console errors: ${errs.length}`);
await b.close();

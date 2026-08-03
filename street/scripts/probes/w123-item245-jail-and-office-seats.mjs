// Item 245 — the jail bench and the office chair.
//
// The row's premise was that both places registered seats and needed one
// `!seatTaken` clause each. MEASURED FIRST (scripts/probes/w123-item245-*.mjs):
//   · the jail registered ZERO seats — the bench was not sittable at all, and
//     the nearest registered spot to the woman waiting on it was 6.46 m away;
//   · the tax office registers five seats and has NOBODY SITTING IN IT, so
//     `seatTaken` there can only ever be a guard.
//
// EVERY ASSERTION IS TWO-SIDED. A one-sided "at least N suppressed" sleeps
// through the failure mode that actually matters here, which is not "it did
// nothing" but "it blanked the whole bench because one woman sat on the end".
// So each check pins a FLOOR and a CEILING on both the offered count and the
// suppressed count — exact equality where the number is knowable.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
let fails = 0, checks = 0;
const ok = (c, what, detail = '') => {
  checks++;
  if (!c) { fails++; console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`  ok    ${what}${detail ? ` — ${detail}` : ''}`);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

const frames = async (n = 6) => {
  for (let i = 0; i < n; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
};
const warpTo = async (x, z, yaw) => {
  const gy = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
  await p.evaluate(([a, c, y, g]) => window.__ct.warp(a, c, y, g, 0), [x, z, yaw ?? 0, gy]);
  await frames();
};
// Seats by label, near a point — a bare label match spans the world, and the
// casino's 87 stools would drown any count taken without a radius.
//
// ⚠ `spots()` PUBLISHES THE APPROACH POINT, NOT THE SEAT. crosstown.ts:449-458
// registers a seat as `{ x: at.x, z: at.z }` where `at = s.approach ?? s`, so a
// seat given an approach reports a coordinate 0.85 m away from the cushion. The
// first run of this probe compared the sitter against that and reported the
// wrong place suppressed — the world was right and the instrument was not
// (BUILDER-BRIEF §7). `__ct.seats()` carries both, so join on the approach and
// return the POSE, which is where somebody actually sits.
const seatsNear = (label, x, z, rad) => p.evaluate(([l, cx, cz, r]) => {
  const poses = window.__ct.seats();
  return window.__ct.spots()
    .filter((s) => (s.label ?? '') === l && Math.hypot(s.x - cx, s.z - cz) < r)
    .map((s) => {
      const m = poses.find((q) => q.label === l
        && Math.abs(q.at.x - s.x) < 1e-6 && Math.abs(q.at.z - s.z) < 1e-6);
      return { x: +(m ? m.pose.x : s.x).toFixed(2), z: +(m ? m.pose.z : s.z).toFixed(2),
        atX: +s.x.toFixed(2), atZ: +s.z.toFixed(2), ok: !!s.ok, joined: !!m };
    });
}, [label, x, z, rad]);
const seatedNear = (x, z, rad) => p.evaluate(([cx, cz, r]) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.citizen && o.userData?.seated
      && Math.hypot(o.position.x - cx, o.position.z - cz) < r) {
      out.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) });
    }
  });
  return out;
}, [x, z, rad]);

// ── walk into the jail through its own door, do not warp into the room ────
// A room's seats carry `room.inside()`, and `room.inside()` is false for a
// player who was teleported into the geometry without entering. Measuring from
// there scores a perfect suppression of everything and reads like a triumph
// (the trap w89 wrote up). So: stand on the door spot and press E.
const jailDoor = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /into the HOUSE OF DETENTION/i.test(q.label ?? ''));
  return s ? { x: s.x, z: s.z } : null;
});
ok(!!jailDoor, 'the jail has a way-in spot at all');
await warpTo(jailDoor.x, jailDoor.z, 0);
// HELD keypress: a press() can begin and end inside one animation frame and the
// [E] dispatch is an edge read once per rendered frame (BUILDER-BRIEF §5).
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await frames(12);
const inside = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log(`\nstood inside the jail at (${inside[0]}, ${inside[2]})`);
ok(inside[0] > 900 && inside[0] < 1100, 'we are on the jail slab, not on the street',
  `x ${inside[0]}`);

// ── the jail lobby benches ────────────────────────────────────────────────
console.log('\n── jail lobby benches ──');
const bench = await seatsNear('sit on the bench', inside[0], inside[2], 20);
const benchOk = bench.filter((s) => s.ok).length;
const sitters = await seatedNear(inside[0], inside[2], 20);
console.log(`  ${bench.length} bench places registered, ${benchOk} offered, ${bench.length - benchOk} suppressed`);
console.log(`  ${sitters.length} seated citizens within 20 m: ${sitters.map((s) => `(${s.x}, ${s.z})`).join(' ')}`);
// FLOOR AND CEILING, both exact. Two 4.6 m benches x 5 places = 10.
ok(bench.length === 10, 'both benches register 5 places each — 10 in the lobby', `${bench.length}`);
ok(bench.every((s) => s.joined), 'every one of them joined its spot to its pose (approach vs cushion)',
  `${bench.filter((s) => s.joined).length}/${bench.length}`);
ok(bench.length - benchOk === 1, 'EXACTLY ONE is suppressed — the woman waiting', `${bench.length - benchOk}`);
ok(benchOk === 9, 'and EXACTLY NINE are still offered (the bench was not blanked)', `${benchOk}`);
// …and the suppressed one is HERS, not an arbitrary one. Without this the two
// counts above would pass just as well if the wrong place went dark.
const gone = bench.find((s) => !s.ok);
// `gone` is undefined under the mutation that drops the clause entirely, and a
// probe that throws there reports a stack trace instead of a verdict.
const her = gone && sitters.find((s) => Math.hypot(s.x - gone.x, s.z - gone.z) < 0.30);
ok(!!her, 'the suppressed place is the one she is sitting on, within the 0.30 m tolerance',
  gone ? `suppressed (${gone.x}, ${gone.z}); nearest sitter ${her ? `(${her.x}, ${her.z})` : 'NONE'}` : 'none suppressed');
// NEGATIVE CASE, same kind of seat, same room: the EAST bench has nobody on it.
// If `seatTaken` were accidentally always-true every count above still reads as
// a success while the world quietly loses every seat in it.
const east = bench.filter((s) => s.x > inside[0]);
const west = bench.filter((s) => s.x < inside[0]);
const eastOk = east.filter((s) => s.ok).length;
console.log(`  west bench ${west.length} places / ${west.filter((s) => s.ok).length} offered · ` +
  `east bench ${east.length} / ${eastOk} offered`);
ok(east.length === 5 && eastOk === 5,
  'NEGATIVE: the east bench, nobody on it, offers ALL 5 of its places', `${eastOk}/${east.length}`);
ok(west.length === 5 && west.filter((s) => s.ok).length === 4,
  'and the west bench, one woman on it, offers 4 of 5', `${west.filter((s) => s.ok).length}/${west.length}`);

// ── ACTUALLY SIT DOWN, then stand up again ────────────────────────────────
// Movement/seats are walked, never screenshotted. And per BUILDER-BRIEF §11 a
// seat you cannot leave is the worst bug this project ships, so getting up is
// part of the check, not a courtesy.
console.log('\n── sit on it, and get up again ──');
// The free place nearest the door, walked to via its OWN approach point — the
// one crosstown.ts registered, not one this script reconstructs.
const free = bench.filter((s) => s.ok).sort((a, c) => Math.hypot(a.x - inside[0], a.z - inside[2])
  - Math.hypot(c.x - inside[0], c.z - inside[2]))[0];
// Guarded for the same reason as `gone` above: under the always-true mutation
// there is no free place, and the walk below must report that rather than throw.
ok(!!free, 'there is a free place to walk to at all');
if (!free) { console.log('  (no free place — skipping the walk)'); }
ok(await p.evaluate(() => window.__ct.seated() === null), 'we start STANDING, not seated');
if (free) {
await warpTo(free.atX, free.atZ, 0);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await frames(12);
const onSeat = await p.evaluate(() => {
  const s = window.__ct.seated();
  return s ? { x: +s.x.toFixed(2), z: +s.z.toFixed(2), h: s.h } : null;
});
const seatedAt = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log(`  after [E]: seated()=${JSON.stringify(onSeat)}  pos (${seatedAt[0]}, ${seatedAt[2]})`);
ok(!!onSeat, 'pressing [E] on the approach point SAT US DOWN');
// FLOOR AND CEILING on where we landed: the seat we aimed at, and no other. A
// bare "we are seated" would pass just as well on a neighbouring place.
const d = onSeat ? Math.hypot(onSeat.x - free.x, onSeat.z - free.z) : 99;
ok(d < 0.05, 'and it is THE place we aimed at, not a neighbour', `${d.toFixed(3)} m from it`);
// …and it is a BENCH we sat on, not a stool or the floor: 0.46 m, two-sided.
ok(!!onSeat && onSeat.h > 0.40 && onSeat.h < 0.52, 'the seat pan is the bench slat, 0.40-0.52 m',
  `h ${onSeat?.h}`);
// §11: a seat you cannot leave is the worst bug this project ships.
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await frames(12);
ok(await p.evaluate(() => window.__ct.seated() === null), 'and [E] again STANDS US BACK UP');
// …and Escape works from a seat too, since a modal you cannot close is the
// documented worst case. Sit again, then press Escape.
await warpTo(free.atX, free.atZ, 0);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await frames(12);
ok(await p.evaluate(() => window.__ct.seated() !== null), 'sat down a second time');
await p.keyboard.press('Escape');
await frames(12);
ok(await p.evaluate(() => window.__ct.seated() === null), 'and ESCAPE gets us out of it too');
}

// ── the tax office: NOTHING to suppress, and that is the point ────────────
// This half of the row was filed on a false premise. The check that matters
// here is the ceiling: the new clause must not have taken a single seat away.
console.log('\n── A-1 TAX SERVICE ──');
const taxDoor = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /into A-1 TAX SERVICE/i.test(q.label ?? ''));
  return s ? { x: s.x, z: s.z } : null;
});
ok(!!taxDoor, 'the tax office has a way-in spot at all');
await warpTo(taxDoor.x, taxDoor.z, 0);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await frames(12);
const tin = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log(`  stood inside the tax office at (${tin[0]}, ${tin[2]})`);
const wait = await seatsNear('sit and wait', tin[0], tin[2], 20);
const prep = await seatsNear('sit down with the preparer', tin[0], tin[2], 20);
const taxSitters = await seatedNear(tin[0], tin[2], 20);
const waitOk = wait.filter((s) => s.ok).length, prepOk = prep.filter((s) => s.ok).length;
console.log(`  ${wait.length} waiting chairs, ${waitOk} offered · ${prep.length} client chairs, ${prepOk} offered`);
console.log(`  ${taxSitters.length} seated citizens in the room`);
ok(taxSitters.length === 0,
  'the row said the registry already claims a figure here — it does not: ZERO seated citizens',
  `${taxSitters.length}`);
ok(wait.length === 3 && waitOk === 3, 'all 3 waiting chairs still offered (0 suppressed)', `${waitOk}/${wait.length}`);
ok(prep.length === 2 && prepOk === 2, 'both client chairs still offered (0 suppressed)', `${prepOk}/${prep.length}`);

// ── AND THE REST OF THE WORLD DID NOT MOVE ────────────────────────────────
// item 93's three fixed rooms, re-counted here, so a regression in the shared
// registry shows up as a failure of THIS item rather than as somebody else's
// problem next week.
console.log('\n── item 93s rooms, unchanged ──');
const pews = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /sit in the pew/i.test(s.label ?? '')).map((s) => ({ ok: !!s.ok })));
const pewOk = pews.filter((s) => s.ok).length;
console.log(`  ${pews.length} pew seats, ${pewOk} offered`);
ok(pews.length === 18 && pews.length - pewOk === 1,
  'the church still registers 18 pews with exactly 1 suppressed', `${pews.length}/${pewOk}`);
const street = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /^sit on the bench$/i.test(s.label ?? '') && s.x < 400).map((s) => ({ ok: !!s.ok })));
const streetOk = street.filter((s) => s.ok).length;
console.log(`  ${street.length} STREET benches (x < 400), ${streetOk} offered`);
ok(street.length === 10 && streetOk === 10,
  'NEGATIVE: the 10 street benches, nobody on them, are all still offered', `${streetOk}/${street.length}`);

console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 4)) console.log(`   ${e}`);
console.log(`\n${checks - fails}/${checks} checks passed`);
await b.close();
process.exit(fails || errs.length ? 1 : 0);

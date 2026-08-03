// Item 93, defect 2 — *"if you sit in his pew you sit where he sits and that
// just breaks immersion."*
//
// POPULATION FLOOR ON EVERY ASSERTION. The failure mode of a fix like this is
// not "it did nothing", it is "it blanked the whole bench": one over-generous
// radius and a row of eight seats becomes unusable because one man sat on the
// end. So every check below counts the seats that are STILL offered as well as
// the ones that went away, and the count that matters is the difference.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';
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

const seatsBy = (re) => p.evaluate((src) => window.__ct.spots()
  .filter((s) => new RegExp(src, 'i').test(s.label ?? ''))
  .map((s) => ({ x: +s.x.toFixed(2), z: +s.z.toFixed(2), ok: !!s.ok })), re.source ?? re);

const warpTo = async (x, z, gy = 0) => {
  await p.evaluate(([a, c, g]) => window.__ct.warp(a, c, 0, g, 0), [x, z, gy]);
  for (let i = 0; i < 6; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
};

// ── the church: 36 pews, one woman ────────────────────────────────────────
// The pew seat's `ok` is `!seatTaken(...)` with no `room.inside()` term, so it
// reads correctly from anywhere. Stand in the nave anyway — a check that only
// works from one pose is a check that will break when somebody moves it.
console.log('\n── church pews ──');
let pews = await seatsBy('sit in the pew');
if (pews.length) await warpTo(pews[0].x, pews[0].z - 2);
pews = await seatsBy('sit in the pew');
const pewOk = pews.filter((s) => s.ok).length;
console.log(`  ${pews.length} pew seats registered, ${pewOk} offered, ${pews.length - pewOk} suppressed`);
// 18, MEASURED. The first run of this asserted 36 because int-church.ts's own
// comment says "All 36 of these pews were registered with no approach" — that
// is the count of pew BENCHES (18 rows x 2 sides), not of registered seats, and
// `spots()` reports 18. The comment was not lying; I read a number out of prose
// instead of measuring it, which is the habit BUILDER-BRIEF §8 is about.
ok(pews.length === 18, 'all 18 pew seats are still REGISTERED (nothing was deleted)', `${pews.length}`);
ok(pews.length - pewOk === 1, 'exactly ONE pew seat is suppressed — the one she is in',
  `${pews.length - pewOk} suppressed`);
ok(pewOk === 17, 'and the other 17 are still sittable', `${pewOk} offered`);

// ── the casino: a lounge bench sitter and four slot players ───────────────
// These carry `room.inside()`, so they read false until we are actually in the
// room. Measuring them from outside would score a perfect suppression of
// everything and look like a triumph.
console.log('\n── casino ──');
const anyStool = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /sit at the slot/i.test(q.label ?? ''));
  return s ? { x: s.x, z: s.z, gy: window.__ct.groundAt(s.x, s.z) } : null;
});
ok(!!anyStool, 'the casino has slot stools at all');
if (anyStool) {
  await warpTo(anyStool.x, anyStool.z, anyStool.gy);
  const stools = await seatsBy('sit at the slot');
  const stoolOk = stools.filter((s) => s.ok).length;
  console.log(`  ${stools.length} slot stools, ${stoolOk} offered, ${stools.length - stoolOk} suppressed`);
  ok(stools.length - stoolOk === 4, 'exactly FOUR stools suppressed — the four slot players',
    `${stools.length - stoolOk} suppressed`);
  ok(stoolOk > 20, 'the rest of the floor is still sittable', `${stoolOk} offered`);

  // 'sit down' IS NOT A CASINO LABEL — it is the world's default seat label, so
  // an unfiltered match returned 40 seats of which 31 read as suppressed. Those
  // 31 are `room.inside()` saying "you are not in the hotel", nothing to do with
  // this change, and quoting that number as a win would have been the fix taking
  // credit for a gate that was always there. Restrict to the lounge, by
  // distance from where we are standing.
  const here = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  const all = await seatsBy('sit down');
  const bench = all.filter((s) => Math.hypot(s.x - here[0], s.z - here[2]) < 14);
  const benchIn = bench.filter((s) => s.ok).length;
  console.log(`  ${bench.length} lounge places within 14 m, ${benchIn} offered, ${bench.length - benchIn} suppressed`);
  ok(bench.length >= 8, 'the lounge bench places are registered', `${bench.length}`);
  ok(bench.length - benchIn === 1, 'exactly ONE lounge place is suppressed (the waiting man)',
    `${bench.length - benchIn} suppressed`);
}

// ── NEGATIVE CASE: does the predicate ever say yes to nothing? ────────────
// If `seatTaken` were accidentally always-true, every count above would still
// look "suppressed" and the fix would read as working while deleting the world.
// The `>= 30 offered` and `> 20 offered` floors above are that guard; this
// states it directly on a seat class with NO sitter anywhere near it.
console.log('\n── negative case: a seat class with no sitter ──');
const benches = await seatsBy('sit on the bench');
const benchOk = benches.filter((s) => s.ok).length;
console.log(`  ${benches.length} street benches, ${benchOk} offered`);
ok(benches.length > 0 && benchOk === benches.length,
  'street benches (nobody sitting on them) are ALL still offered', `${benchOk}/${benches.length}`);

console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 4)) console.log(`   ${e}`);
console.log(`\n${checks - fails}/${checks} checks passed`);
await b.close();
process.exit(fails || errs.length ? 1 : 0);

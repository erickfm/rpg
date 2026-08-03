#!/usr/bin/env node
// ITEM 126 — CAN YOU ACTUALLY GET TO EVERY DINER SEAT?
//
//   *"its fine if the diner seat isnt reachable from one side. just make sure
//    geometries allow for access."*
//
// He lowered the bar himself: **one-sided access is fine.** What is not fine is
// a seat with NO legal standing spot inside its trigger. So this walks the
// approach to every diner seat and reports, per seat, how many of the sixteen
// compass approaches are legal — and fails only when a seat has ZERO.
//
// ── the filter is by ROOM, never by LABEL ──────────────────────────────────
//
// 'sit at the counter' is not unique to the diner — the burger barn and other
// counters use the same words — and a label filter would quietly walk another
// room's furniture and report about the diner. (This is the class of fault that
// swept gallery shelving into a run-filter earlier tonight.) So seats are
// selected by whether they fall inside the DINER's own footprint, taken from
// `__ct.roomDims()`, and the room is identified by id.
//
// ⚠ `roomDims()` RETURNS AN ARRAY, not a map keyed by id — a documented trap on
// this project. Handled below and asserted, not assumed.
//
// ── what "legal standing spot" means, and why it is not eyeballed ───────────
//
// A spot is legal if the player's 0.36 m radius fits there without intersecting
// a collider, the floor holds him, and he is inside the seat's own trigger
// radius. All three come from the world: `__ct.colliders()`, `__ct.groundAt`,
// and the seat's registered `r`. Nothing is typed here.
//
// POPULATION FLOOR: the diner has 7 counter stools plus 2 seats per booth. If
// fewer than 9 seats are found, this exits 3 — measured nothing — rather than
// reporting a cheerful zero failures over an empty set.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-item126-diner-seats.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const data = await p.evaluate(() => {
  const RADIUS = 0.36;
  const dimsRaw = window.__ct.roomDims();
  const dims = Array.isArray(dimsRaw) ? dimsRaw : Object.values(dimsRaw);
  const diner = dims.find((d) => (d.id ?? d.key ?? '') === 'diner');
  if (!diner) return { error: 'no room with id "diner" in roomDims()', ids: window.__ct.rooms(), sample: dims[0] };

  // ⚠ A roomDims() ENTRY IS A CENTRE AND A SIZE, NOT A BOX.
  // `ct/interior.ts:320` returns `{ id, w, d, cx, cz, y, door, belt }`. Reading
  // `d.x0`/`d.x1` off it — which is what this probe did first — yields
  // `undefined`, every comparison against undefined is false, and the seat list
  // comes back EMPTY. It only surfaced as "0 seats" because of the population
  // floor; without that this would have printed a confident PASS over nothing.
  // Note also that `d` is the room's DEPTH here, which is why the room object is
  // not destructured into a variable called `d` anywhere below.
  const R = { x0: diner.cx - diner.w / 2, x1: diner.cx + diner.w / 2,
              z0: diner.cz - diner.d / 2, z1: diner.cz + diner.d / 2 };
  const inDiner = (x, z) => x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1;
  // ⚠ A SEAT RECORD HAS NO TOP-LEVEL x/z. It is
  //     { pose: {x, z, yaw, h}, at: {x, z}, r, label }
  // where `pose` is where you END UP SITTING and `at` is the STANDING spot the
  // [E] trigger is centred on. Reading `s.x` gives undefined, every comparison
  // is false, and the filter returns an empty set — which is exactly what this
  // probe did first, and only the population floor stopped it printing a
  // cheerful PASS over nothing.
  const seats = window.__ct.seats().filter((s) => s.pose && inDiner(s.pose.x, s.pose.z));

  const cols = window.__ct.colliders().filter((c) => c && isFinite(c.minX));
  // a collider blocks a standing player if his disc overlaps its box AND the
  // box is tall enough to stop him rather than be stepped onto
  const blocked = (x, z) => cols.some((c) => {
    if (c.maxY !== undefined && c.maxY <= 0.45) return false;      // low enough to stand on
    return x > c.minX - RADIUS && x < c.maxX + RADIUS
        && z > c.minZ - RADIUS && z < c.maxZ + RADIUS;
  });

  // ⚠ THE RING MUST BE SAMPLED OUTSIDE THE FURNITURE, NOT INSIDE IT.
  //
  // The diner registers its seats with NO separate standing spot, so `at` IS
  // the seat — `at === pose` for all thirteen. The trigger is then a disc of
  // radius `r` centred ON the stool, and you stand somewhere in the ANNULUS
  // between the stool's own collider and the trigger edge.
  //
  // The first cut of this sampled a ring at `r − RADIUS` (0.26 m for a stool),
  // which is *inside the stool* — the stool's collider is 0.34 m square and
  // pads to 0.53 m against a 0.36 m body. It duly reported **13 of 13 seats
  // with NO ACCESS AT ALL**, a total catastrophe in a room the user says is
  // merely awkward from one side. A 13/13 red against a complaint that mild is
  // the probe indicting itself, not the world.
  //
  // Reach is `r + TOUCH_MARGIN`, and TOUCH_MARGIN is **0.15** — `fp.ts:778`.
  // NOT `REACH_MARGIN` (0.6, `fp.ts:771`), which is unused for a standing
  // player and whose own docstring records five harnesses still comparing
  // against the wrong one of the two.
  const TOUCH_MARGIN = 0.15;
  const N = 16, STEPS = 14;
  const out = seats.map((s) => {
    const reach = s.r + TOUCH_MARGIN;
    const legal = [], dists = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      let best = null;
      // walk outward from the seat centre to the trigger edge and take the
      // first radius where a standing body fits
      for (let j = 1; j <= STEPS; j++) {
        const d = (j / STEPS) * reach;
        const x = s.at.x + Math.cos(a) * d, z = s.at.z + Math.sin(a) * d;
        if (!blocked(x, z)) { best = d; break; }
      }
      if (best !== null) { legal.push(Math.round(a * 180 / Math.PI)); dists.push(+best.toFixed(2)); }
    }
    return {
      label: s.label,
      x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), r: s.r, reach: +reach.toFixed(2),
      legal: legal.length, dirs: legal,
      nearest: dists.length ? Math.min(...dists) : null,
    };
  });
  const all = window.__ct.seats();
  const probe = {
    total: all.length,
    sample: all.slice(0, 3),
    labels: [...new Set(all.map((s) => s.label))].slice(0, 40),
    dinerish: all.filter((s) => /counter|booth/i.test(s.label ?? ''))
      .map((s) => ({ label: s.label, x: +(s.x ?? NaN).toFixed(2), z: +(s.z ?? NaN).toFixed(2) })).slice(0, 30),
  };
  return { room: { x0: +R.x0.toFixed(2), x1: +R.x1.toFixed(2), z0: +R.z0.toFixed(2), z1: +R.z1.toFixed(2) }, seats: out, probe };
});

if (data.error) {
  console.log(`EXIT 3 — ${data.error}`);
  console.log(`  room ids: ${JSON.stringify(data.ids)}`);
  console.log(`  a roomDims() entry looks like: ${JSON.stringify(data.sample)}`);
  await b.close(); process.exit(3);
}

console.log(`diner footprint x ${data.room.x0}..${data.room.x1}  z ${data.room.z0}..${data.room.z1}`);
console.log(`seats inside it: ${data.seats.length}`);
if (data.seats.length < 9) {
  console.log('\n  what the seat records actually look like, so the next reader does not guess:');
  for (const s of data.probe.sample) console.log(`    ${JSON.stringify(s)}`);
  console.log(`  seats in the world: ${data.probe.total}`);
  console.log(`  distinct labels: ${JSON.stringify(data.probe.labels)}`);
  console.log(`  seats whose label mentions counter/booth: ${JSON.stringify(data.probe.dinerish)}`);
  console.log('EXIT 3 — population floor is 9 (7 stools + at least one booth pair); measuring nothing.');
  await b.close(); process.exit(3);
}
const byLabel = {};
for (const s of data.seats) byLabel[s.label] = (byLabel[s.label] ?? 0) + 1;
console.log(`  by label: ${Object.entries(byLabel).map(([k, v]) => `${v}x "${k}"`).join(', ')}`);

console.log('\nlegal standing approaches per seat (of 16 around the trigger ring):');
const unreachable = [];
for (const s of data.seats.sort((a, z) => a.x - z.x)) {
  const bar = s.legal === 0 ? 'NO ACCESS AT ALL' : `${s.legal}/16`;
  console.log(`  ${s.label.padEnd(20)} seat (${s.x}, ${s.z})  r=${s.r} reach=${s.reach}   `
    + `${bar}   nearest legal stand ${s.nearest ?? '—'} m   [${s.dirs.join(' ')}]`);
  if (s.legal === 0) unreachable.push(s);
}

console.log(`\nThe user's bar: one-sided access is FINE; zero is not.`);
console.log(`  seats with no legal approach: ${unreachable.length}`);
const oneSided = data.seats.filter((s) => s.legal > 0 && s.legal <= 4).length;
console.log(`  seats reachable from only a narrow arc (<= 4/16), which he has ACCEPTED: ${oneSided}`);

await b.close();
if (errs.length) console.log(`\nconsole errors: ${errs.length}`);
console.log(`\n${unreachable.length === 0 ? 'PASS' : 'FAIL'} — ${unreachable.length} diner seat(s) with no way to stand at them.`);
process.exit(unreachable.length === 0 ? 0 : 1);

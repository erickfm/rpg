// FLAT 301'S SOUTH WALL, WALKED — item 309.
//
// Two walks, both with the arrow keys and W, both reading the live prompt:
//
//   THE PAGE'S COLUMN. Stand in the room square in front of the calendar, face
//     the wall, and hold W until the wall stops you. Print what `[E]` offers at
//     every step and the DEPTH OF THE BAND in which it is the calendar. That
//     band is the whole subject: *"i can t look at the calendar if im looking
//     right at it."*
//
//   THE WAY OUT. From the bed's approach, face 301's room-side door stand-point
//     and walk at it. Nothing but the DOOR may be offered on that walk — this is
//     `w40-bed-vs-door`'s END TWO restated for the calendar, and it is the check
//     that decides whether a reading spot in the page's column is legal at all.
//
// NUMBERS, NOT AN ABSENCE: it prints the band's near and far edge in metres off
// the wall, and the count of strides on the way out that offered something else.
// A run where the walk never moves reports 0.00 m of band, which is a visible
// failure and not a silent pass.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w134-301-column.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yawOf = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
async function turnTo(want) {
  for (let i = 0; i < 140; i++) {
    const err = norm(want - (await yawOf()));
    if (Math.abs(err) < 0.03) return true;
    const key = err > 0 ? 'ArrowRight' : 'ArrowLeft';
    await p.keyboard.down(key);
    await p.waitForTimeout(Math.min(240, Math.max(25, Math.abs(err) / 1.7 * 1000)));
    await p.keyboard.up(key);
    await frames(2);
  }
  return false;
}

const K = await p.evaluate(() => ({
  trim: window.__ct.reachTrim ? window.__ct.reachTrim() : 1,
  onIt: window.__ct.onItRadius ? window.__ct.onItRadius() : window.__ct.playerRadius(),
}));
const spots = await p.evaluate(() => window.__ct.spots().filter((s) => s.x > 195 && s.x < 203 && s.z > -19 && s.z < -14));
const cal = spots.find((s) => /calendar/.test(s.label));
const bed = spots.find((s) => /bed/.test(s.label));
const door = spots.filter((s) => /the door/.test(s.label)).sort((a, c) => a.x - c.x)[0];
if (!cal || !bed || !door) {
  console.error(`ABORT: found calendar=${!!cal} bed=${!!bed} door=${!!door} among ${spots.length} spots in 301`);
  await b.close(); process.exit(3);
}
// The page itself, so the column is the PAGE's and not the spot's — they are
// meant to be the same column and this is the only thing that can say so.
const page = await p.evaluate(() => {
  let hit = null;
  window.__ct.scene().traverse((o) => { if (o.userData && o.userData.calendar === 'page') hit = o; });
  return hit ? { x: hit.position.x, z: hit.position.z } : null;
});
if (!page) { console.error('ABORT: no mesh carries userData.calendar === "page"'); await b.close(); process.exit(3); }

console.log(`REACH_TRIM ${K.trim}  ON_IT ${K.onIt.toFixed(3)}`);
console.log(`page      (${page.x.toFixed(3)}, ${page.z.toFixed(3)})`);
console.log(`cal spot  (${cal.x.toFixed(3)}, ${cal.z.toFixed(3)}) r ${cal.r}   ${Math.abs(cal.x - page.x).toFixed(3)} m off the page's column`);
console.log(`door room (${door.x.toFixed(3)}, ${door.z.toFixed(3)}) r ${door.r} rank ${door.rank}   ${Math.hypot(cal.x - door.x, cal.z - door.z).toFixed(3)} m from the cal spot`);
console.log(`bed appr  (${bed.x.toFixed(3)}, ${bed.z.toFixed(3)}) r ${bed.r}`);

const WALL_Z = page.z;      // the page hangs ON the south wall
const fails = [];
const say = (ok, line) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${line}`); if (!ok) fails.push(line); };

// ── WALK 1: down the page's column, facing the wall ──────────────────────
{
  const start = { x: page.x, z: page.z + 1.75 };
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [start.x, start.z]);
  // YAW 0 FACES THE SOUTH WALL. `fp.ts` builds forward as `(sin yaw, -cos yaw)`,
  // so yaw 0 is -z and yaw PI is +z. The first cut used PI, walked AWAY from the
  // wall for ten samples and reported the calendar unreachable — a heading sign
  // is exactly the kind of error that reads as a world defect (GOTCHAS 56).
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [start.x, start.z, gy]);
  await p.waitForTimeout(500);
  await turnTo(0);
  const rows = [];
  await p.keyboard.down('w');
  for (let i = 0; i < 90; i++) {
    await p.waitForTimeout(45);
    const q = await pos();
    rows.push({ off: q.z - WALL_Z, x: q.x, t: await prompt() });
    if (i > 8 && Math.abs(rows[i].off - rows[i - 6].off) < 0.01) break;   // wall
  }
  await p.keyboard.up('w');
  console.log(`walk 1 — down the page's column facing the wall, ${rows.length} samples:`);
  let prev = '·';
  for (const r of rows) {
    const t = r.t ?? '—';
    if (t !== prev) { console.log(`    ${r.off.toFixed(2)} m off the wall  ->  ${t}`); prev = t; }
  }
  const calRows = rows.filter((r) => r.t && /calendar/.test(r.t));
  const near = calRows.length ? Math.min(...calRows.map((r) => r.off)) : NaN;
  const far = calRows.length ? Math.max(...calRows.map((r) => r.off)) : NaN;
  const stopped = rows[rows.length - 1].off;
  say(calRows.length > 0,
    `the calendar is offered over ${calRows.length ? (far - near).toFixed(2) : '0.00'} m of the column`
    + (calRows.length ? `, from ${near.toFixed(2)} to ${far.toFixed(2)} m off the wall` : ' — NEVER'));
  // REPORTED, NOT ASSERTED, and the difference matters. There IS a strip
  // against the wall where the door takes the prompt, because the door's
  // stand-point is 0.46 m off this wall and its `ON_IT` disc covers the floor
  // out to 0.70 m. **No calendar position can clear it** — it belongs to the
  // door, the user asked for the door back knowing what 308 had done, and an
  // assertion that can never hold is a red row nobody reads rather than a
  // measurement. What IS asserted is that the band exists and contains the
  // distance the panel's own camera ease derives (0.73 m), below.
  console.log(`  ..    the wall stops you at ${stopped.toFixed(2)} m off it; the door owns the strip`
    + ` from there to ${isNaN(near) ? 'n/a' : near.toFixed(2)} m — ${isNaN(near) ? 'n/a' : (near - stopped).toFixed(2)} m of floor`
    + ` where the calendar cannot be read. That is the price of the corner.`);
}

// ── WALK 2: the way out — from the bed's approach at the door ─────────────
{
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [bed.x, bed.z]);
  const bearing = Math.atan2(door.x - bed.x, -(door.z - bed.z));
  await p.evaluate(([x, z, gy, y]) => window.__ct.warp(x, z, 0, gy, y), [bed.x, bed.z, gy, bearing]);
  await p.waitForTimeout(500);
  await turnTo(bearing);
  const rows = [];
  await p.keyboard.down('w');
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(45);
    const q = await pos();
    const d = Math.hypot(q.x - door.x, q.z - door.z);
    rows.push({ d, t: await prompt() });
    if (d < 0.12) break;
  }
  await p.keyboard.up('w');
  console.log(`walk 2 — bed's approach to the door, facing the door, ${rows.length} samples:`);
  let prev = '·';
  for (const r of rows) {
    const t = r.t ?? '—';
    if (t !== prev) { console.log(`    ${r.d.toFixed(2)} m from the door  ->  ${t}`); prev = t; }
  }
  // THE FIRST TWO SAMPLES ARE STILL ON THE BED'S OWN APPROACH, and a spot under
  // your feet winning is the resolver working, not failing (fp.ts tier 1). What
  // this leg is about is the STRIDES AFTER that: once you have left the bed's
  // stand-point, nothing but the door may take the prompt.
  const wrong = rows.slice(2).filter((r) => r.t && !/the door/.test(r.t));
  say(wrong.length === 0,
    `${wrong.length} of ${Math.max(0, rows.length - 2)} strides out (after leaving the bed's own approach) offered something other than the door`
    + (wrong.length ? ` (worst: "${wrong[0].t}" at ${wrong[0].d.toFixed(2)} m)` : ''));
}

// ── AND THE SAME TWO LINES AT 2 cm, WARPED ───────────────────────────────
//
// ⚠ THE WALKS ABOVE CANNOT SEE THIS ROOM'S FEATURES AND I WATCHED THEM MISS ONE.
// A held W samples every 0.16-0.22 m at the rig's speed, and the stretch of the
// bed-to-door route where the calendar can steal the prompt is **0.09 m long**.
// Walk 2 came back green on a layout the arithmetic says is red, twice, because
// the sampler stepped straight over it. A walk is the right instrument for "can
// a player do this"; it is the wrong one for "is there a hole", and this is a
// hole 9 cm wide.
//
// So the same two lines are re-sampled by warping, at 2 cm, facing the same way.
// The walk stays — it is what proves the poses are reachable at all, which a
// warp can never say (a warp will happily stand you inside the TV crate).
{
  const yawTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));
  const sample = async (x, z, y) => {
    const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
    await p.evaluate(([x, z, gy, y]) => window.__ct.warp(x, z, 0, gy, y), [x, z, gy, y]);
    await frames(2);
    return prompt();
  };
  const rows = [];
  for (let off = 0.30; off <= 1.60; off += 0.02) {
    rows.push({ off, t: await sample(page.x, WALL_Z + off, 0) });
  }
  const calRows = rows.filter((r) => r.t && /calendar/.test(r.t));
  const near = calRows.length ? Math.min(...calRows.map((r) => r.off)) : NaN;
  const far = calRows.length ? Math.max(...calRows.map((r) => r.off)) : NaN;
  console.log(`scan 1 — the page's column at 2 cm, facing the wall (${rows.length} poses):`);
  let prev = '·';
  for (const r of rows) { const t = r.t ?? '—'; if (t !== prev) { console.log(`    ${r.off.toFixed(2)} m off the wall  ->  ${t}`); prev = t; } }
  say(calRows.length > 0 && far - near >= 0.20,
    `the calendar's band is ${calRows.length ? (far - near).toFixed(2) : '0.00'} m deep`
    + (calRows.length ? `, ${near.toFixed(2)}-${far.toFixed(2)} m off the wall` : '')
    + ' (want >= 0.20 m, and the panel eases in at 0.73 m so the band must contain it)');
  say(calRows.length > 0 && near <= 0.73 && far >= 0.73,
    `0.73 m — the distance the calendar panel itself eases the camera to — is ${calRows.length && near <= 0.73 && far >= 0.73 ? 'inside' : 'OUTSIDE'} the band`);

  const len = Math.hypot(door.x - bed.x, door.z - bed.z);
  const ux = (door.x - bed.x) / len, uz = (door.z - bed.z) / len;
  const yb = yawTo(bed, door);
  const out = [];
  for (let t = 0.30; t < len - 0.10; t += 0.02) {
    out.push({ t, d: len - t, r: await sample(bed.x + ux * t, bed.z + uz * t, yb) });
  }
  console.log(`scan 2 — the bed-to-door route at 2 cm, facing the door (${out.length} poses):`);
  prev = '·';
  for (const r of out) { const t = r.r ?? '—'; if (t !== prev) { console.log(`    ${r.d.toFixed(2)} m from the door  ->  ${t}`); prev = t; } }
  const wrong = out.filter((r) => r.r && !/the door/.test(r.r));
  // ⚠ THIS ONE IS KNOWINGLY RED AND MUST NOT BE LOOSENED TO MAKE IT GREEN.
  //
  // With 301's door stand-point in its corner — where the user asked for it
  // back — the calendar's reading spot is 0.26 m from it, so the last half
  // metre of the walk out passes through the calendar's own `ON_IT` disc while
  // only the last 0.29 m is inside the DOOR's. The stretch in between offers
  // *"read the calendar"* on your way out, and it is ~0.24 m long.
  //
  // IT IS NOT FIXABLE FROM THE CALENDAR'S SIDE. Scanned at 2 cm over the whole
  // column: every z that opens a readable band opens a route hole of the same
  // width, 1:1 (spot at -17.40 -> band 0.10 m, hole 0.09 m; -17.25 -> 0.24 and
  // 0.24; -17.175 -> 0.32 and 0.36), because both are the part of this spot's
  // disc that sticks out past the door's. And the south end of that range is
  // not available: below about -17.22 the spot's own centre falls inside the
  // door's `ON_IT` disc and the calendar cannot be read from its own spot,
  // which is the original complaint restated. The only thing that removes the
  // trade is moving the DOOR — item 308, which the user asked to have undone.
  // So the number is reported, the trade is named, and the row stays red:
  // GOTCHAS §27 is the entry about writing a paragraph explaining why a real
  // failure is unavoidable geometry and then quietly relaxing the bound.
  say(wrong.length === 0,
    `${wrong.length} of ${out.length} poses on the way out offer something other than the door`
    + (wrong.length ? ` — "${wrong[0].r}" over ${(wrong.length * 0.02).toFixed(2)} m, worst at ${wrong[0].d.toFixed(2)} m from the door` : ''));
  // …and the one that says whether it can actually cost you anything: however
  // long that stretch is, you must ARRIVE at the door on the door, because that
  // is where a player stops walking and presses the key.
  const lastLeg = out.filter((r) => r.d <= 0.29);
  say(lastLeg.length > 0 && lastLeg.every((r) => r.r && /the door/.test(r.r)),
    `the last ${lastLeg.length} poses (0.29 m) into the door: `
    + `${lastLeg.filter((r) => r.r && /the door/.test(r.r)).length} of ${lastLeg.length} offer the door`);
}

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
await b.close();
process.exit(fails.length ? 1 : 0);

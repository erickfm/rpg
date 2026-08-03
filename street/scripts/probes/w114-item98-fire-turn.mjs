// ITEM 98 — IS `w40`'s FIRE STATION FAILING BECAUSE OF THE WORLD, OR BECAUSE ITS
// OWN TURN DID NOT LAND?
//
// `w114-item98-fire-pose.mjs` settled the world half: across the whole contested
// band and a ±30° window of headings, the 25° ceiling offers the DOOR in 71 of 90
// poses against 61 of 90 at 14.90°, and **not one pose that named the door before
// names the bed now.** So the contest itself did not regress.
//
// That leaves the check's own preconditions, and there is exactly one that is not
// asserted. `w40-bed-vs-door.mjs` reaches its fire station like this:
//
//     await walkUntil((q) => dist(q, bed) > 0.55, 'the middle of the band');
//     await turnTo(bearing(fireAt, door));      // <- return value DISCARDED
//     const b0 = await prompt();
//
// `walkUntil` is entered facing the BED — the inward band walk left it that way —
// so it holds W straight into the bed and gets to 0.55 m only by being pushed off
// it, which is not a controlled position. And `turnTo` gives up after 120
// attempts and RETURNS FALSE; here nobody looks. Both would read exactly as the
// observed failure: `[E] sit on the bed and watch TV` while nominally "facing the
// door".
//
// So this reproduces that sequence with the SAME real key input and prints what
// the check does not: where the player actually ended up, and the yaw error it
// actually achieved, next to the prompt it got.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item98-fire-turn.mjs [n]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4482/');
const N = Number(process.argv[2] ?? 5);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yaw = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bearing = (f, t) => Math.atan2(t.x - f.x, -(t.z - f.z));

// COPIED, DELIBERATELY, from w40-bed-vs-door.mjs:80-106 — the point of this probe
// is to run THAT code and watch it, so a "better" turn here would measure nothing.
async function turnTo(want) {
  for (let i = 0; i < 120; i++) {
    const err = norm(want - (await yaw()));
    if (Math.abs(err) < 0.04) return true;
    const key = err > 0 ? 'ArrowRight' : 'ArrowLeft';
    await p.keyboard.down(key);
    await p.waitForTimeout(Math.min(260, Math.max(30, Math.abs(err) / 1.7 * 1000)));
    await p.keyboard.up(key);
    await frames(2);
  }
  return false;
}
async function walkUntil(done) {
  let last = await pos(), stalled = 0;
  await p.keyboard.down('w');
  for (let i = 0; i < 140; i++) {
    await p.waitForTimeout(55);
    const now = await pos();
    if (done(now)) { await p.keyboard.up('w'); return { ok: true, at: now }; }
    if (Math.hypot(now.x - last.x, now.z - last.z) < 0.004) { if (++stalled > 12) break; } else stalled = 0;
    last = now;
  }
  await p.keyboard.up('w');
  return { ok: false, at: await pos() };
}

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([g]) => window.__ct.warp(199.36, -15.545, 0, g, 0), [gy]);
await p.waitForTimeout(800);
const room = await p.evaluate(() => {
  const s = window.__ct.spots().filter((q) => q.ok && q.x > 190 && q.x < 210);
  const bed = s.find((q) => /bed/i.test(q.label));
  const door = s.find((q) => /the door/i.test(q.label));
  const pick = (q) => q && { x: q.x, z: q.z, r: q.r, label: q.label };
  return { bed: pick(bed), door: pick(door) };
});
if (!room.bed || !room.door) { console.error('CANNOT ANSWER — 301 lacks both spots.'); await b.close(); process.exit(3); }
const { bed, door } = room;
console.log(`world ${URL}`);
console.log(`bed (${bed.x.toFixed(2)}, ${bed.z.toFixed(2)}) r${bed.r}   door (${door.x.toFixed(2)}, ${door.z.toFixed(2)}) r${door.r}\n`);
console.log('  n   turnTo   yaw err   d(bed)  d(door)  off-line   prompt');

let bad = 0, badTurn = 0;
for (let i = 1; i <= N; i++) {
  // reproduce the approach: in to the bed facing it, which is the state w40's
  // fire station inherits from its inward band walk.
  await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0),
    [door.x, door.z, bearing(door, bed), gy]);
  await p.waitForTimeout(400);
  await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) < 0.30);
  // …then w40's own two lines, verbatim in behaviour
  await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) > 0.55);
  const fireAt = await pos();
  const want = bearing(fireAt, door);
  const turned = await turnTo(want);
  const err = Math.abs(norm(want - (await yaw()))) * 180 / Math.PI;
  const got = await prompt();
  const dBed = Math.hypot(fireAt.x - bed.x, fireAt.z - bed.z);
  const dDoor = Math.hypot(fireAt.x - door.x, fireAt.z - door.z);
  // how far the fire station sits OFF the bed->door line — the band my pose sweep
  // measured is that line, so a station far from it is a pose nothing has measured
  const sep = Math.hypot(door.x - bed.x, door.z - bed.z);
  const ux = (door.x - bed.x) / sep, uz = (door.z - bed.z) / sep;
  const px = fireAt.x - bed.x, pz = fireAt.z - bed.z;
  const offLine = Math.abs(px * uz - pz * ux);
  const ok = /door/i.test(got ?? '');
  if (!ok) bad++;
  if (!turned) badTurn++;
  console.log(`  ${String(i).padStart(2)}   ${turned ? 'ok   ' : 'FAILED'}   ${err.toFixed(2).padStart(6)}°  `
    + `${dBed.toFixed(2).padStart(6)}  ${dDoor.toFixed(2).padStart(6)}   ${offLine.toFixed(3).padStart(6)}    ${got}`);
}
console.log(`\n${bad}/${N} fire stations did NOT offer the door; ${badTurn}/${N} had a turn that never landed.`);
await b.close();

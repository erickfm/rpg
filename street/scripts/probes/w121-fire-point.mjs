// WHERE IS `w40-bed-vs-door`'s FIRE POINT, AND WHY DOES THE BED WIN THERE?
//
// After item 291's two changes the check's two walking legs went green and its
// FIRE leg went red: at ~0.6 m from the bed, TURNED TO FACE THE DOOR, the prompt
// reads "sit on the bed and watch TV". The walking leg samples that same band at
// 0.61 m facing the door and gets the door, so the two disagree and only one of
// them can be about the pose I think it is.
//
// The difference is WHERE. The walking leg samples along the bed-to-door line;
// the fire leg arrives by holding W into the bed and being pushed off it, so it
// ends up somewhere the line never goes. This prints the position and the full
// tier arithmetic for every candidate, so the answer is read rather than
// guessed.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w121-fire-point.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4189/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1500);
await reportWorld(p, URL);

if (await p.evaluate(() => typeof window.__ct.pickSpot) !== 'function') {
  console.error('ABORT: __ct.pickSpot missing — nothing measured.');
  await b.close(); process.exit(3);
}

const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yaw = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bearing = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));
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
    if (done(now)) { await p.keyboard.up('w'); return now; }
    if (Math.hypot(now.x - last.x, now.z - last.z) < 0.004) { if (++stalled > 12) break; } else stalled = 0;
    last = now;
  }
  await p.keyboard.up('w');
  return pos();
}

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(600);

const room = await p.evaluate(() => {
  const s = window.__ct.spots().filter((q) => q.ok && q.x > 190 && q.x < 210);
  const g = (re) => { const h = s.find((q) => re.test(q.label)); return h && { x: h.x, z: h.z, r: h.r, label: h.label }; };
  return { bed: g(/bed/i), door: g(/the door/i), cal: g(/calendar/i) };
});
console.log(`bed  ${JSON.stringify(room.bed)}`);
console.log(`door ${JSON.stringify(room.door)}`);
console.log(`cal  ${JSON.stringify(room.cal)}`);

// the check's own approach, step for step
await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
  [room.door.x, room.door.z, bearing(room.door, room.bed), gy]);
await p.waitForTimeout(400);
await walkUntil((q) => Math.hypot(q.x - room.bed.x, q.z - room.bed.z) < 0.30);
await turnTo(bearing(await pos(), room.bed));
await walkUntil((q) => Math.hypot(q.x - room.bed.x, q.z - room.bed.z) < 0.41);
const fireAt = await walkUntil((q) => Math.hypot(q.x - room.bed.x, q.z - room.bed.z) > 0.55);
await turnTo(bearing(fireAt, room.door));
await p.waitForTimeout(250);

const at = await pos(), y = await yaw();
console.log(`\nFIRE POINT (${at.x.toFixed(3)}, ${at.z.toFixed(3)})  yaw ${(y * 180 / Math.PI).toFixed(1)}deg`);
console.log(`  ${Math.hypot(at.x - room.bed.x, at.z - room.bed.z).toFixed(3)} m from the bed`);
console.log(`  ${Math.hypot(at.x - room.door.x, at.z - room.door.z).toFixed(3)} m from the door`);
console.log(`  wanted yaw ${(bearing(at, room.door) * 180 / Math.PI).toFixed(1)}deg`);
console.log(`  [E] ${await prompt()}`);

const rows = await p.evaluate(([x, z, yw]) => {
  const fx = Math.sin(yw), fz = -Math.cos(yw);
  const TOUCH = window.__ct.touchMargin(), RAD = window.__ct.playerRadius();
  return window.__ct.spots().filter((s) => s.ok).map((s) => {
    const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz);
    const offAxis = d < 1e-4 ? 0 : Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
    const looked = d < 6 && offAxis < window.__ct.lookTolerance(s.r, d);
    const near = d < s.r + TOUCH;
    return { label: s.label, d, r: s.r, rank: s.rank, offAxis, near, looked, onIt: d < RAD,
      tier: (near && (looked || d < RAD)) ? 1 : looked ? 2 : near ? 3 : 0 };
  }).filter((q) => q.tier).sort((a, c) => a.tier - c.tier || a.d - c.d);
}, [at.x, at.z, y]);
console.log('\n  tier  rank  d      off     what');
for (const q of rows) {
  console.log(`   ${q.tier}     ${q.rank}   ${q.d.toFixed(3)}  ${(q.offAxis * 180 / Math.PI).toFixed(0).padStart(3)}deg  `
    + `${q.onIt ? 'ONIT ' : ''}${q.near ? 'NEAR ' : ''}${q.looked ? 'LOOK ' : ''}${q.label}`);
}
const won = await p.evaluate(([x, z, yw]) => window.__ct.pickSpot({ x, z, yaw: yw, pitch: 0 }, { reach: 6 }), [at.x, at.z, y]);
console.log(`\n  pickSpot (NO line-of-sight filter): ${won ? won.label : '(none)'}`);
console.log('  the live prompt DOES apply line of sight, so a disagreement here names the raycast.');
await b.close();

// ITEM 285 — the CALENDAR is the one diegetic tenant `w114-item285-tenants.mjs`
// could not exercise, and I will not report a tenant as checked on the strength
// of eight stations that returned no prompt at all.
//
// WHY THOSE EIGHT WERE WORTHLESS: the calendar hangs ON A WALL, and that probe
// picks stations on the four compass points around a spot, filtered only for
// DRIFT. Half of them are inside the wall. A player standing in masonry sees
// nothing — not the calendar, not the bed, not the door — which is exactly what
// came back: `(none)` at 8 of 8. **That is a probe measuring nothing and saying
// so in green**, which is GOTCHAS 79's whole lesson, and it would have shipped as
// "calendar: no lying prompts found".
//
// So this walks instead, which is what the row asks for anyway (*"VERIFY BY
// WALKING UP AND PRESSING"*). Flat 301, from the door toward the bed, real
// collision, prompt read every stride. Wherever the calendar is the thing on
// offer, [E] is pressed and the panel watched across 1.2 s.
//
// A run in which the calendar was never offered is reported as CANNOT ANSWER and
// exits 3 — not as a pass.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item285-calendar-walk.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4482/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);

const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el && getComputedStyle(el).display !== 'none') ? (el.textContent ?? '').trim() : '';
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

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gg]) => window.__ct.warp(199.36, -15.545, 0, gg, 0), [gy]);
await p.waitForTimeout(1500);
const room = await p.evaluate(() => {
  const s = window.__ct.spots().filter((q) => q.x > 190 && q.x < 210);
  const f = (re) => { const q = s.find((v) => re.test(String(typeof v.label === 'function' ? v.label() : v.label))); return q && { x: q.x, z: q.z, r: q.r }; };
  return { cal: f(/calendar/i), bed: f(/bed/i), door: f(/the door/i) };
});
if (!room.cal || !room.bed || !room.door) {
  console.error(`CANNOT ANSWER — 301 lacks a spot: ${JSON.stringify(room)}`);
  await b.close(); process.exit(3);
}
console.log(`world    ${URL}`);
console.log(`calendar (${room.cal.x.toFixed(2)}, ${room.cal.z.toFixed(2)}) r${room.cal.r}`);
console.log(`bed      (${room.bed.x.toFixed(2)}, ${room.bed.z.toFixed(2)})   door (${room.door.x.toFixed(2)}, ${room.door.z.toFixed(2)})\n`);

// walk the door->bed line, facing the CALENDAR, reading every stride
await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0),
  [room.door.x, room.door.z, bearing(room.door, room.bed), gy]);
await p.waitForTimeout(600);
let offered = 0, opened = 0;
console.log('  d(cal)  prompt                              panel across 1.2 s');
for (let i = 0; i < 26; i++) {
  const at = await pos();
  await turnTo(bearing(at, room.cal));
  const pr = await prompt();
  const dc = Math.hypot(at.x - room.cal.x, at.z - room.cal.z);
  let seq = '';
  if (/calendar/i.test(pr ?? '')) {
    offered++;
    await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
    let got = null;
    for (let k = 0; k < 12; k++) { got = got ?? await panel(); await p.waitForTimeout(100); }
    if (got) opened++;
    seq = String(got ?? 'null');
    await p.evaluate(() => window.__hud.closePanels());
    await p.waitForTimeout(300);
  }
  console.log(`  ${dc.toFixed(2)}    ${String(pr ?? '(none)').padEnd(35)} ${seq}`);
  // face the bed to make progress, then read again facing the calendar
  await turnTo(bearing(await pos(), room.bed));
  await p.keyboard.down('w'); await p.waitForTimeout(40); await p.keyboard.up('w');
  await frames(2);
  if (Math.hypot((await pos()).x - room.bed.x, (await pos()).z - room.bed.z) < 0.3) break;
}
console.log(`\ncalendar offered at ${offered} strides; the press raised its panel at ${opened} of them`);
console.log(`console errors: ${errs.length}`);
if (!offered) {
  console.error('CANNOT ANSWER — the calendar was never offered on this walk, so nothing was tested.');
  await b.close(); process.exit(3);
}
await b.close();
process.exit(offered === opened ? 0 : 1);

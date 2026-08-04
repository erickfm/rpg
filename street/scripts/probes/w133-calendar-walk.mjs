// WALKED, NOT WARPED: can you read the calendar where it now hangs, and does
// your own front door still work? Item 308.
//
// Both of the item's "done when" facts, driven through real collision and real
// keys. It WARPS ONLY to get into flat 301 — everything after that is holding W
// and the arrow keys, because a check that warps onto its own subject and reads
// the prompt has never tested what it is named for (`w40-bed-vs-door`'s header).
//
// It asserts NUMBERS, not absences: the distance actually walked, the distance
// from the page's own column, which panel came up, and what the prompt said
// before and after each press.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w133-calendar-walk.mjs
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
const yaw = () => p.evaluate(() => window.__ct.yaw());
const panel = () => p.evaluate(() => (window.__hud ? window.__hud.panel() : 'no __hud'));
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const pressE = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(400);
};
const esc = async () => {
  await p.keyboard.down('Escape'); await p.waitForTimeout(90); await p.keyboard.up('Escape');
  await p.waitForTimeout(400);
};
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
  for (let i = 0; i < 160; i++) {
    await p.waitForTimeout(55);
    const now = await pos();
    if (done(now)) { await p.keyboard.up('w'); return now; }
    if (Math.hypot(now.x - last.x, now.z - last.z) < 0.004) { if (++stalled > 12) break; } else stalled = 0;
    last = now;
  }
  await p.keyboard.up('w');
  return await pos();
}

const fails = [];
const say = (ok, line) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${line}`); if (!ok) fails.push(line); };

// ── the page and the two stand-points, asked of the world ────────────────
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(600);
const W = await p.evaluate(() => {
  let page = null;
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.calendar === 'page') page = { x: o.position.x, z: o.position.z };
  });
  const s = window.__ct.spots().filter((q) => q.ok && q.x > 196 && q.x < 201);
  const g = (re) => s.find((q) => re.test(q.label));
  const c = g(/calendar/i), d = g(/the door/i);
  return { page, cal: c && { x: c.x, z: c.z, r: c.r }, door: d && { x: d.x, z: d.z, r: d.r },
    R: window.__ct.playerRadius() };
});
if (!W.page || !W.cal || !W.door) {
  console.error(`ABORT (exit 3): 301 did not publish page+calendar+door — ${JSON.stringify(W)}`);
  await b.close(); process.exit(3);
}
console.log(`page (${W.page.x.toFixed(2)}, ${W.page.z.toFixed(2)})   `
  + `calendar stand-point (${W.cal.x.toFixed(2)}, ${W.cal.z.toFixed(2)}) r${W.cal.r}   `
  + `door stand-point (${W.door.x.toFixed(2)}, ${W.door.z.toFixed(2)}) r${W.door.r}`);
console.log(`the page hangs ${(W.page.x - W.cal.x).toFixed(2)} m right of the spot you read it from `
  + `(the player's capsule is ${W.R} m)\n`);

// ── (1) WALK SQUARE UP TO THE PAGE AND READ IT ───────────────────────────
console.log('(1) walked square up to the page, facing the wall');
// START ON THE PAGE'S OWN COLUMN, derived from the mesh rather than typed —
// this probe scored a false red on the very move it was written for when the
// start x was a literal and the page moved out from under it.
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0),
  [W.page.x, W.cal.z + 1.10, gy]);
await p.waitForTimeout(500);
const start = await pos();
console.log(`    started at (${start.x.toFixed(3)}, ${start.z.toFixed(3)}), on the page's column`);
await turnTo(0);                                    // yaw 0 faces -z, the south wall
// STRIDE BY STRIDE, READING THE PROMPT AT EACH. The user's report is about a
// WALK — *"i can t look at the calendar if im looking right at it"* — so one
// sample at the end would be the pose that happens to work, which is exactly
// how item 298 shipped a calendar readable from one spot. Every stride from
// where he starts to where the wall stops him has to say the same thing.
const seen = [];
for (let i = 0; i < 40; i++) {
  const q = await pos();
  seen.push({ off: Math.abs(q.z - W.page.z), got: await prompt(),
    dDoor: Math.hypot(q.x - W.door.x, q.z - W.door.z) });
  if (q.z < W.page.z + 0.30) break;
  await p.keyboard.down('w'); await p.waitForTimeout(40); await p.keyboard.up('w');
  await frames(2);
}
for (const s of seen) console.log(`    ${s.off.toFixed(2)} m off the page `
  + `(${s.dDoor.toFixed(2)} m from the door's stand-point) -> [E] ${s.got ?? '(none)'}`);
// THE FIRST STRIDES ARE INSIDE THE DOOR'S OWN CAPSULE AND THE DOOR MUST WIN
// THEM. That is `onIt` and it is deliberate — `w40-bed-vs-door` END ONE(b)
// exists to keep exactly it, and the user asked for a door you can work
// without lining up on it. The claim being made here is the OTHER half: once
// you are off the door's own mat, every remaining stride up to the wall is the
// calendar. Both halves are asserted, as numbers, so neither can hide.
const onDoor = seen.filter((s) => s.dDoor < W.R);
const rest = seen.filter((s) => s.dDoor >= W.R);
const bad = rest.filter((s) => !/calendar/i.test(s.got ?? ''));
const badOn = onDoor.filter((s) => !/door/i.test(s.got ?? ''));
say(seen.length >= 5, `the approach was sampled (${seen.length} strides, `
  + `${seen[seen.length - 1].off.toFixed(2)}-${seen[0].off.toFixed(2)} m off the page)`);
say(rest.length >= 4 && badOn.length === 0,
  `the ${onDoor.length} stride(s) INSIDE the door's own capsule gave the DOOR, as END ONE(b) requires`);
say(bad.length === 0, `and the CALENDAR at every one of the ${rest.length} strides outside it`
  + (bad.length ? ` — ${bad.length} said "${bad[0].got}" at ${bad[0].off.toFixed(2)} m` : ''));
const at = await pos();
const walked = Math.hypot(at.x - start.x, at.z - start.z);
say(walked > 0.6, `the walk actually happened (${walked.toFixed(2)} m > 0.60)`);
console.log(`    stopped at (${at.x.toFixed(3)}, ${at.z.toFixed(3)}) — `
  + `${Math.abs(at.x - W.page.x).toFixed(3)} m off the page's own column, `
  + `${Math.hypot(at.x - W.cal.x, at.z - W.cal.z).toFixed(3)} m from the stand-point `
  + `(capsule ${W.R}), ${Math.hypot(at.x - W.door.x, at.z - W.door.z).toFixed(3)} m from the door's`);
const p1 = await prompt();
console.log(`    -> [E] ${p1 ?? '(none)'}`);
say(/calendar/i.test(p1 ?? ''), `standing square in front of the page, the CALENDAR is offered`);
await pressE();
const up = await panel();
console.log(`    panel up: ${up ?? '(none)'}`);
say(up === 'ct-calendar', `pressing E opened the calendar overlay (got ${JSON.stringify(up)})`);
await esc();
say((await panel()) === null, 'and Escape closed it again');

// ── (2) WALK TO THE DOOR AND FACE IT ─────────────────────────────────────
console.log('\n(2) walked to the door and faced it');
const from = await pos();
await turnTo(bearing(from, W.door));
const atD = await walkUntil((q) => Math.hypot(q.x - W.door.x, q.z - W.door.z) < W.R * 0.5);
const walkedD = Math.hypot(atD.x - from.x, atD.z - from.z);
say(walkedD > 0.4, `the walk to the door actually happened (${walkedD.toFixed(2)} m > 0.40)`);
console.log(`    stopped at (${atD.x.toFixed(3)}, ${atD.z.toFixed(3)}) — `
  + `${Math.hypot(atD.x - W.door.x, atD.z - W.door.z).toFixed(3)} m from the door's stand-point`);
await turnTo(bearing(atD, { x: 200.0, z: -16.50 }));   // face the doorway itself
const d0 = await prompt();
console.log(`    facing the doorway -> [E] ${d0 ?? '(none)'}`);
say(/door/i.test(d0 ?? ''), 'walking to the door and facing it still gives you the DOOR');
await pressE();
const d1 = await prompt();
say(/door/i.test(d1 ?? '') && d1 !== d0, `and it acted (${d0} -> ${d1})`);
await pressE();                                      // put the door back

console.log('');
if (fails.length) {
  console.log(`MEASURED WRONG — ${fails.length}:`);
  for (const f of fails) console.log(`   · ${f}`);
  await b.close(); process.exit(1);
}
console.log('MEASURED FINE — the page is readable where it hangs and the door still opens.');
await b.close(); process.exit(0);

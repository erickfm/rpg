// WALK INTO THE LIBRARY. The user asked for this interior in the same breath as
// nine others; nine were built and this one was not. So the test is the user's
// test: can you get in, is there something in there, can you sit down, and can
// you get back out without being sucked straight back in?
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const pos = () => page.evaluate(() => window.__ct.pos());
// PRESS E FOR LONGER THAN A FRAME.
//
// crosstown.ts dispatches E edge-triggered inside the frame loop:
//
//   const feedDown = input.keys.has('e');
//   if (feedDown && !feedHeld) { active.act(); }
//
// Playwright's `keyboard.press` sends keydown and keyup with no delay between
// them, so if both land inside one frame the loop samples `keys` before and
// after and never sees the key down at all. The press simply does not happen —
// intermittently, depending on where it falls against the frame boundary.
//
// That is the mechanism behind the seats-walk reds I reported to the desk this
// morning as "not reproducible": a seat that fails to take E once and works the
// next time is not a flaky seat, it is a press that fell between two frames.
// Holding it for 120 ms guarantees at least one frame sees it down.
const pressE = async () => {
  await page.keyboard.down('e');
  await page.waitForTimeout(120);
  await page.keyboard.up('e');
  await page.waitForTimeout(450);
};
const prompt = () => page.evaluate(() => {
  for (const el of document.querySelectorAll('div')) {
    const t = (el.textContent || '').trim();
    if (/^\[E\]/.test(t) && !el.children.length) return t;
  }
  return null;
});

report('the room exists in the belt', 
  (await page.evaluate(() => window.__ct.rooms().includes('library'))), 'rooms() lists "library"');

// climb the steps and stand at the doors, the way a player arrives
await page.evaluate(() => window.__ct.warp(-7.6, -13.0, -Math.PI / 2, 0.14, 0));
await page.waitForTimeout(200);
await page.keyboard.down('w'); await page.waitForTimeout(2000); await page.keyboard.up('w');
await page.waitForTimeout(300);
const atDoor = await pos();
const p1 = await prompt();
report('walking up the steps offers the way in', !!p1 && /LIBRARY/.test(p1),
  `${p1 ?? 'no prompt'} at x ${atDoor[0].toFixed(2)}, gy ${atDoor[3].toFixed(2)}`);

await pressE();
const inside = await pos();
report('…and puts you inside', inside[0] > 100, `x ${inside[0].toFixed(1)} (the interior belt is x > 100)`);
await page.screenshot({ path: 'shots/E-library/a-from-the-door.png' });

// is there anything in here?
const seats = await page.evaluate(() => window.__ct.seats()
  .filter((s) => s.pose.x > 100 && /table/.test(s.label)).length);
report('the reading table has seats', seats === 4, `${seats} chairs registered`);

// sit at one
await page.evaluate(() => {
  const s = window.__ct.seats().find((q) => q.pose.x > 100 && /table/.test(q.label));
  window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos()[3], 0);   // keep the room's floor
});
await page.waitForTimeout(250);
const p2 = await prompt();
report('…and you are offered one', !!p2 && /sit at the table/.test(p2), p2 ?? 'no prompt');
await pressE();
report('…and you sit', await page.evaluate(() => !!window.__ct.seated()), 'seated');
await page.screenshot({ path: 'shots/E-library/b-sat-at-the-table.png' });
await pressE();

// look back at the room from the far end
// stand in the aisle mouth and look down the stacks, rather than nose-first
// into whatever shelf the previous step left us against
await page.evaluate(() => {
  const me = window.__ct.pos();
  window.__ct.warp(me[0] - 3.0, me[2] + 3.2, 0, me[3], -0.02);
});
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/E-library/c-down-the-stacks.png' });

// and out again — the kit's own hazard: landing back inside the way-in trigger
// THE LIBRARY'S exit, and WALKED INTO rather than warped onto.
//
// Two corrections in one. Nine rooms register a spot labelled "out to the
// street" and the first cut took spots[0], which belonged to another room
// entirely and landed the check at x 5.20, z -44.00 — a failure that said
// nothing about the library. And teleporting exactly onto a spot and pressing E
// does not fire it, while walking into it does; that is the same behaviour that
// had seats-walk reporting reds this morning on seats a player can sit on
// perfectly well. So this arrives on foot, like a player.
const exit = await page.evaluate(() => {
  const me = window.__ct.pos();
  return window.__ct.spots()
    .filter((q) => /out to the street/.test(q.label) && q.x > 100)
    .map((q) => ({ x: q.x, z: q.z, d: Math.hypot(q.x - me[0], q.z - me[2]) }))
    .sort((a, c) => a.d - c.d)[0];
});
report('the library has its own way out', !!exit && Math.abs(exit.x - inside[0]) < 40,
  exit ? `nearest exit spot is ${exit.d.toFixed(1)} m away, in this room` : 'none found');
// yaw PI, not 0. The kit puts the door in the +z wall and says so: "facing away
// from it — INTO the room — is yaw 0". Walking forward from a point 2 m short of
// the exit with yaw 0 therefore walks you deeper into the stacks, which is how
// this check came to report the prompt as "[E] sit at the table".
await page.evaluate(([x, z]) => window.__ct.warp(x, z - 2.0, Math.PI, window.__ct.pos()[3], 0),
  [exit.x, exit.z]);
await page.waitForTimeout(250);
await page.keyboard.down('w'); await page.waitForTimeout(1100); await page.keyboard.up('w');
await page.waitForTimeout(300);
const p3 = await prompt();
report('the way out is offered from inside', !!p3 && /out to the street/.test(p3), p3 ?? 'no prompt');
await pressE();
const out = await pos();
report('…and you land back in the courtyard, not on the street', out[0] < 0 && out[0] > -9.5,
  `x ${out[0].toFixed(2)}, z ${out[2].toFixed(2)}, gy ${out[3].toFixed(2)}`);
const p4 = await prompt();
report('…and are NOT sucked straight back in', !p4 || !/into the PVBLIC/.test(p4),
  p4 ? `prompt is "${p4}"` : 'no way-in prompt where you land');
await page.screenshot({ path: 'shots/E-library/d-back-out.png' });

report('no console errors', errs.length === 0, errs.length ? errs.join(' | ') : 'clean');
console.log(fails ? `\n${fails} FAILED` : '\nthe library is open');
await b.close();
process.exit(fails ? 1 : 0);

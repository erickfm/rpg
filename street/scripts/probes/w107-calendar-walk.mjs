// WALK UP TO THE CALENDAR, OPEN IT, AND GET BACK OUT. Item 270.
//
// Asserts. Exit 1 on any failure, exit 3 if it could not measure at all
// (GOTCHAS 32 — "exit 3 means the check never ran").
//
// The three things that can be wrong here and cannot be seen in a screenshot:
//
//   1. THE PROMPT IS STOLEN. 301's door stand-point is 0.46 m off this same
//      wall and `fp.ts` tier 1 is "the spot's centre is inside your own body",
//      so a calendar spot placed carelessly hands you "close the door". The
//      bed's own comment in ct/apartment.ts records this exact bug in this
//      exact room. So the prompt is read at SEVEN stations and FOUR headings.
//   2. IT IS NOT ACTUALLY DIEGETIC. A panel whose `surface.mesh()` fails
//      degrades SILENTLY to the screen-space cabinet, which still opens, still
//      closes, and still passes any test that only asks "is the panel up".
//      So the calendar mesh's own material map is read: while the panel is
//      open it must be the panel's 288-px canvas, and after it must be back to
//      the 48-px wall page.
//   3. YOU CANNOT GET OUT. Both exits are pressed, separately, and after each
//      one the FEET are checked by actually walking.
//
// `[E]` is HELD, not tapped (BUILDER-BRIEF §5): the dispatch is an edge read
// once per rendered frame and a press that begins and ends inside one frame is
// never seen.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
mkdirSync('shots', { recursive: true });

// ct/apartment.ts:124 — APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7; the calendar is
// at AX(-0.80) on SOUTH_Z = AZI(2.085). Cited; a probe cannot import the .ts.
const APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7;
const CAL_X = APT_X0 - 0.80, SOUTH_Z = APT_Z0 + 2.085, GY = 2 * ST0;

let fails = 0, checks = 0;
const ok = (cond, what) => {
  checks++;
  if (!cond) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const warp = async (x, z, yaw, pitch = 0) => {
  await p.evaluate(([x, z, yaw, gy, pitch]) => window.__ct.warp(x, z, yaw, gy, pitch),
    [x, z, yaw, GY, pitch]);
  await waitPainted(p, { frames: 3 });
};
const prompt = () => p.evaluate(() => document.querySelector('#ct-prompt')?.textContent
  ?? window.__ct.prompt?.() ?? '');
const pressE = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await waitPainted(p, { frames: 3 });
};
// SETTLED, not sampled. A frameless panel cross-fades over 220 ms
// (`ct/hud.ts:947`), so reading opacity three painted frames after a keypress
// catches it mid-transition and reports the OLD state — which is how this check
// first said "[E] does not close it" about a panel that had closed. Wait for the
// value to stop moving, then read it. GOTCHAS 30, in a CSS transition's clothes.
const panelUp = async () => {
  await p.waitForFunction(() => {
    const el = document.getElementById('ct-calendar');
    if (!el) return true;
    const o = getComputedStyle(el).opacity;
    return o === '0' || o === '1';
  }, { timeout: 5000 });
  return p.evaluate(() => {
    const el = document.getElementById('ct-calendar');
    return !!el && getComputedStyle(el).opacity !== '0';
  });
};
// WHAT IS ON THE CALENDAR'S OWN FACE right now — 48 means the wall page, 288
// means the panel is painted onto the object. This is the diegetic assertion.
const faceMap = () => p.evaluate(() => {
  let w = null;
  window.__ct.scene().traverse((o) => {
    if (o.userData?.calendar) w = o.material?.map?.image?.width ?? null;
  });
  return w;
});
// `crosstown.ts:1605` publishes the rig as `__ct.pos() -> [x, y, z, gy]`.
// There is no `__ct.player`; asking for one returns undefined, and
// `undefined > 0.15` is false, so a check written that way FAILS A WORKING
// WORLD rather than erroring — which is what it did on the first run.
const feetMove = async () => {
  const a = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w'); await p.waitForTimeout(420); await p.keyboard.up('w');
  await waitPainted(p, { frames: 3 });
  const c = await p.evaluate(() => window.__ct.pos());
  return Math.hypot(c[0] - a[0], c[2] - a[2]);
};

// ── 1. the prompt, at seven stations and four headings ────────────────────
console.log('\n=== 1. WHO WINS THE PROMPT near the calendar ===');
const STATIONS = [
  { id: 'read 0.90 m out',  x: CAL_X,        z: SOUTH_Z + 0.90, yaw: 0 },
  { id: 'read 0.75 m out',  x: CAL_X,        z: SOUTH_Z + 0.75, yaw: 0 },
  { id: 'read 1.20 m out',  x: CAL_X,        z: SOUTH_Z + 1.20, yaw: 0 },
  { id: 'read 1.60 m out',  x: CAL_X,        z: SOUTH_Z + 1.60, yaw: 0 },
  { id: 'off left 0.35 m',  x: CAL_X - 0.35, z: SOUTH_Z + 0.95, yaw: 0 },
  { id: 'off right 0.25 m', x: CAL_X + 0.25, z: SOUTH_Z + 0.95, yaw: 0 },
  { id: 'from the middle',  x: CAL_X,        z: SOUTH_Z + 2.10, yaw: 0 },
];
let readable = 0;
for (const s of STATIONS) {
  await warp(s.x, s.z, s.yaw);
  const t = (await prompt()).trim();
  const got = /read the calendar/i.test(t);
  if (got) readable++;
  console.log(`  ${got ? 'CAL ' : 'no  '} ${s.id.padEnd(18)} -> "${t}"`);
}
ok(readable === STATIONS.length, `the calendar wins the prompt at ${readable}/${STATIONS.length} stations facing it`);

// the NEGATIVE case: standing on the door's own point, facing the door, the
// DOOR must still win. A calendar spot that swallows the door is the same bug
// with the sign flipped, and it is the one this check exists to catch.
await warp(199.36, -17.455, Math.PI / 2);
const atDoor = (await prompt()).trim();
console.log(`  door stand-point, facing the door -> "${atDoor}"`);
ok(/door/i.test(atDoor), 'facing 301\'s door from its own stand-point still offers THE DOOR');

// and facing away from the wall entirely, the calendar must NOT be offered
await warp(CAL_X, SOUTH_Z + 1.60, Math.PI);
const away = (await prompt()).trim();
console.log(`  turned away from the wall -> "${away}"`);
ok(!/read the calendar/i.test(away), 'turned 180 deg away, the calendar is NOT offered');

// ── 2. open it, and prove it is painted on the OBJECT ─────────────────────
console.log('\n=== 2. OPEN, and is it diegetic ===');
await warp(CAL_X, SOUTH_Z + 0.90, 0);
const mapBefore = await faceMap();
console.log(`  face map before: ${mapBefore} px`);
ok(mapBefore === 48, 'idle, the calendar wears its own 48 px wall page');
await pressE();
ok(await panelUp(), '[E] opens the calendar panel');
const mapOpen = await faceMap();
console.log(`  face map open:   ${mapOpen} px`);
ok(mapOpen === 288, 'open, the calendar wears the PANEL canvas — it is on the object, not over the camera');
await waitPainted(p, { frames: 4 });
let buf = await p.screenshot({ path: 'shots/w107-cal-overlay.png' });
console.log(`  shots/w107-cal-overlay.png  black ${(await blackFraction(p, buf) * 100).toFixed(1)}%`);

// ── 3. turning the page ───────────────────────────────────────────────────
console.log('\n=== 3. TURNING THE PAGE ===');
await p.keyboard.press('ArrowRight');
await waitPainted(p, { frames: 3 });
buf = await p.screenshot({ path: 'shots/w107-cal-overlay-next.png' });
ok(await panelUp(), 'still open after turning the page');
await p.mouse.wheel(0, -120);
await waitPainted(p, { frames: 3 });
ok(await panelUp(), 'still open after the wheel');
await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
await waitPainted(p, { frames: 3 });
buf = await p.screenshot({ path: 'shots/w107-cal-overlay-prev.png' });
ok(await panelUp(), 'still open after turning back');

// ── 4. BOTH EXITS, and the feet after each ────────────────────────────────
console.log('\n=== 4. GETTING OUT ===');
await pressE();
ok(!(await panelUp()), '[E] closes it');
ok((await faceMap()) === 48, 'closed, the wall page is restored on the mesh');
let moved = await feetMove();
console.log(`  walked ${moved?.toFixed(3)} m after [E]`);
ok(Number.isFinite(moved) && moved > 0.15, 'the feet move again after [E]');

await warp(CAL_X, SOUTH_Z + 0.90, 0);
await pressE();
ok(await panelUp(), 'it opens a second time');
await p.keyboard.press('Escape');
await waitPainted(p, { frames: 3 });
ok(!(await panelUp()), 'Escape closes it');
ok((await faceMap()) === 48, 'the wall page is restored after Escape too');
moved = await feetMove();
console.log(`  walked ${moved?.toFixed(3)} m after Escape`);
ok(Number.isFinite(moved) && moved > 0.15, 'the feet move again after Escape');

console.log(`\nconsole errors: ${errs.length}${errs.length ? '\n  ' + errs.join('\n  ') : ''}`);
ok(errs.length === 0, 'no page errors');
console.log(`\n${checks - fails}/${checks} passed`);
await b.close();
if (!checks) process.exit(3);
process.exit(fails ? 1 : 0);

// Item 155 — IS THE LETTER IN THE WORLD, AND CAN YOU ALWAYS GET OUT OF IT?
//
// This is the PROVING half; `w88-mail-shot.mjs` is the looking half. Everything
// here is read off the running world — the sheet mesh's own `visible` and
// `material.map`, the camera's fov and position, the panel canvas's `display`.
//
// WHY IT DOES NOT TRUST THE PROMPT. `ct/hud.ts` hides `#ct-prompt` with
// `display:none` and returns WITHOUT clearing `textContent`, so the last string
// lingers forever — measured 40 m from the jail door. Every read below checks
// `display` first (item 236 is the class fix).
//
//   SHOT_URL=http://localhost:4450/ node scripts/probes/w89-mail-diegetic.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';
const TAG = process.argv[2] ?? 'now';

let fails = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { fails++; console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`  ok    ${what}${detail ? ` — ${detail}` : ''}`);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
const frames = async (n = 8) => { for (let i = 0; i < n; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r))); };

// DAYLIGHT. A game day is 24 REAL MINUTES, so an unset clock lands wherever the
// wall clock puts it — a black frame at 02:29 is not a defect.
await p.evaluate(() => window.__ct.clock(12, 30));
await frames(4);

// ── the subject, found by NAME rather than inferred from a size ────────────
const sheet0 = await p.evaluate(() => {
  let m = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'tenancy-letter-sheet') m = o; });
  if (!m) return null;
  const g = m.geometry.parameters;
  return { visible: m.visible, map: !!m.material.map, arrayMat: Array.isArray(m.material),
           w: g.width, h: g.height, pos: [m.position.x, m.position.y, m.position.z] };
});
console.log('\n── the sheet ──');
ok(!!sheet0, 'the letter sheet exists in the scene');
if (!sheet0) { console.log('ABORT: no sheet.'); await b.close(); process.exit(3); }
console.log(`  sheet ${sheet0.w.toFixed(3)} x ${sheet0.h.toFixed(3)} m at (${sheet0.pos.map((v) => v.toFixed(2)).join(', ')})`);
ok(!sheet0.visible, 'it is INVISIBLE before anything is opened');
ok(!sheet0.map, 'and carries no canvas yet');
// item 150: a material ARRAY throws in ct/hud.ts when the canvas is hung on it.
ok(!sheet0.arrayMat, 'its material is single, not an array (queue item 150 cannot bite)');
// the aspect must match the canvas or the landlord's typewriter stretches
const aspect = sheet0.w / sheet0.h;
ok(Math.abs(aspect - 192 / 178) < 0.005, 'plane aspect matches the 192x178 canvas',
  `${aspect.toFixed(4)} vs ${(192 / 178).toFixed(4)}`);

// ── stand at the box. ON THE LOBBY FLOOR — `ok()` gates on gy < 0.5 and
// `groundAt` here returns 5.40, the flat directly above. ───────────────────
const all = await p.evaluate(() => window.__ct.spots()
  .filter((q) => /mailbox/i.test(q.label ?? ''))
  .map((q) => ({ x: q.x, z: q.z, r: q.r, label: q.label })));
console.log('\n── the spot ──');
ok(all.length === 1, 'exactly one /mailbox/ spot', `found ${all.length}`);
const spot = all[0];
// FACE THE SHEET, derived from where the sheet actually is rather than typed.
await p.evaluate(([sx, sz, hx, hz]) => {
  window.__ct.warp(sx, sz, Math.atan2(hx - sx, -(hz - sz)), 0, 0);
}, [spot.x, spot.z, sheet0.pos[0], sheet0.pos[2]]);
await frames();

const readPrompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  // DISPLAY FIRST — a hidden prompt keeps its stale text forever.
  if (!el || getComputedStyle(el).display === 'none') return null;
  return (el.textContent ?? '').trim();
});
const prompt = await readPrompt();
ok(!!prompt && /mail/i.test(prompt), 'the mailbox is offered where we stand', JSON.stringify(prompt));

const state = () => p.evaluate(() => {
  let m = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'tenancy-letter-sheet') m = o; });
  // `wrap.id = spec.id` (ct/hud.ts:854) and the CANVAS is its firstChild
  // (:883). The diegetic path hides the CANVAS and keeps the wrapper — that is
  // how the "how do I leave" caption survives onto the bottom of the frame. So
  // the wrapper's display answers a different question and is the wrong read.
  const wrap = document.getElementById('ct-letter');
  const cv = wrap ? wrap.firstChild : null;
  const cam = window.__ct.camera();
  return {
    visible: m.visible, map: !!m.material.map, color: m.material.color.getHex(),
    cvDisplay: cv ? getComputedStyle(cv).display : 'ABSENT',
    fov: +cam.fov.toFixed(2), cam: [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(3)),
    png: cv ? cv.toDataURL().length : 0,
    seated: !!window.__ct.seated(),
  };
});
const before = await state();

// HELD keypress — a tap can begin and end inside one frame (BUILDER-BRIEF §5).
//
// THEN WAIT FOR THE WORLD, NOT FOR A FRAME COUNT. Two reds on the first run
// were both this probe being impatient rather than the world being wrong:
//   - `crosstown.ts:1130` eases the eye in over FOCUS_IN = 0.40 s, so a fov
//     read 14 frames after the press catches it mid-flight (57.45, en route to
//     55) and looks like a wrong number.
//   - `ct/hud.ts:1028` refuses to reopen a panel within DISMISS_LOCKOUT = 500 ms
//     of it closing, so an immediate second `[E]` is swallowed by design.
// Loosening the assertions would have hidden both. Waiting is the honest fix.
const press = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(120); await p.keyboard.up(k);
  await p.waitForTimeout(650);          // past FOCUS_IN and past DISMISS_LOCKOUT
  await frames(6);
};
await press('e');
const open = await state();
console.log('\n── open ──');
ok(open.visible, 'the sheet is now VISIBLE in the world');
ok(open.map, 'the panel canvas is hung on it');
ok(open.color === 0xffffff, 'its colour is forced white so the evening cannot dim the page');
ok(open.cvDisplay === 'none', 'the screen-space canvas is NOT drawn over the camera', `display=${open.cvDisplay}`);
ok(open.fov === 55, 'the eye leaned in to fov 55', `${before.fov} -> ${open.fov}`);
const moved = Math.hypot(open.cam[0] - before.cam[0], open.cam[1] - before.cam[1], open.cam[2] - before.cam[2]);
ok(moved > 0.05, 'the camera eased onto the page', `moved ${moved.toFixed(3)} m`);
ok(open.seated, 'the feet are frozen (rig seated)');
// the eye ends up STANDOFF off the paper, along its -x normal
const gap = open.cam[0] - sheet0.pos[0];
ok(Math.abs(Math.abs(gap) - 0.42) < 0.06, 'the eye settles ~0.42 m off the paper', `${gap.toFixed(3)} m`);
await p.screenshot({ path: `shots/w89-mail-${TAG}-open.png` });

// ── the page turns, and the surface in the world updates with it ───────────
console.log('\n── turning the page ──');
const png0 = open.png;
await p.mouse.wheel(0, 120);
await frames(10);
const turned = await state();
ok(turned.png !== png0, 'the wheel repainted the sheet IN THE WORLD', `${png0} -> ${turned.png} bytes`);
ok(turned.visible && turned.map, 'and it is still hung and visible');
await p.screenshot({ path: `shots/w89-mail-${TAG}-page2.png` });

// ── ESCAPE, from a turned page. BUILDER-BRIEF §11. ────────────────────────
console.log('\n── escape ──');
await press('Escape');
const shut = await state();
ok(!shut.visible, 'the sheet is put away');
ok(!shut.map, 'the mesh got its own face back');
ok(shut.cvDisplay !== 'none', 'the screen-space canvas is restored for the next panel', `display=${shut.cvDisplay}`);
ok(Math.abs(shut.fov - before.fov) < 0.01, 'the fov is handed back', `${shut.fov}`);
ok(!shut.seated, 'the feet are given back');

// ── AND [E] CLOSES IT TOO — the key the caption advertises ────────────────
console.log('\n── [E] closes it as well ──');
await press('e');
const open2 = await state();
ok(open2.visible, 'reopened');
await press('e');
const shut2 = await state();
ok(!shut2.visible, '[E] closed it');
ok(!shut2.seated, 'and stood us back up');

// ── NEGATIVE CASE: would this probe notice if nothing were diegetic? ──────
// Assert the thing that is TRUE only on the diegetic path. If a future change
// dropped `surface`, `cvDisplay` would stay '' and `visible` would stay false,
// and the checks above are the ones that would go red. Prove the read is live
// rather than a constant by showing it takes BOTH values in one run:
console.log('\n── self-test: the readings are not constants ──');
ok(open.visible !== shut.visible, 'sheet visibility was observed BOTH ways');
ok(open.cvDisplay !== shut.cvDisplay, 'canvas display was observed BOTH ways');
ok(open.fov !== shut.fov, 'fov was observed BOTH ways');

console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 5)) console.log(`   ${e}`);
console.log(`\n${checks - fails}/${checks} checks passed`);
await b.close();
process.exit(fails || errs.length ? 1 : 0);

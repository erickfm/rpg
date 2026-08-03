// THE PIN SCREEN: CANCEL, AUTO-SUBMIT, AND ENROLMENT. Queue item 184.
//
// The user, three things about one screen: *"trying to hit cancel on the pin
// keypad doesnt work cause its also 5? once you enter 4 digits it auto submits
// please. also the first time you go to the atm it saves your pin."*
//
//   SHOT_URL=http://localhost:4230/ node scripts/w67-atm-pin.mjs
//
// Exits non-zero on failure. Six checks in this repo printed a failure and
// exited 0, so this one is loud and its exit code is the verdict.
//
// EVERYTHING IS DRIVEN WITH THE REAL POINTER — `page.mouse.move` / `.click` at a
// page point projected from the button's own place on its own mesh — because the
// complaint is about a control that LOOKED live and was not, and only the mouse
// path can catch that. `page.keyboard` is used for the keyboard half, which is a
// separate assertion, never as a stand-in for a click.
//
// The projection is the same one `scripts/probes/w57-pad-walk.mjs` uses for the
// physical keypad, pointed at the raked SCREEN face instead, and both ask the
// machine where its own controls are (`__atm.padPoint` / `__atm.buttonPoint`)
// rather than re-deriving the layout here.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4230/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

/**
 * A WAIT THAT FAILS RATHER THAN THROWS.
 *
 * Worth the six lines, because the first mutation run proved it: with CANCEL
 * broken the walk was left on a screen it did not expect, the next
 * `waitForFunction` threw, and node printed a stack trace instead of the verdict
 * — **losing the ten assertions after it and turning a precise red into an
 * "it crashed"**. A check whose failure mode is a stack trace tells the next
 * reader far less than one that says which of twenty things went wrong, and
 * this project has paid repeatedly for the difference between "could not
 * measure" and "measured, and it is wrong".
 */
const softWait = async (fn, what) => {
  try { await page.waitForFunction(fn, null, { timeout: 8000 }); return true; }
  catch { ok(false, `timed out waiting for ${what} — the walk is off its expected path`); return false; }
};

// ── stand at the machine, the way the player does ─────────────────────────
const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(
  x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(400);

const openMachine = async () => {
  // A HELD keypress — the [E] edge is read once per rendered frame (BRIEF §5).
  await page.keyboard.down('e');
  const up = await softWait(() => window.__hud.panel() === 'ct-atm', 'the ATM panel to open');
  await page.keyboard.up('e');
  await page.waitForTimeout(700);
  return up;
};

/**
 * END THE SESSION AND WALK BACK UP TO THE MACHINE.
 *
 * TAKE CARD flashes the farewell and then CLOSES THE PANEL on a timer — the user
 * asked for exactly that (*"just flash thank you farewell screen and release the
 * player"*). So a "later visit" is a genuinely new open, not another screen, and
 * a script that keeps typing into a shut panel is typing into the world. My
 * first pass did that and reported nine failures that were all one mistake.
 *
 * The 800 ms is past `hud.ts`'s DISMISS_LOCKOUT: reopen inside it and the
 * framework declines, leaving a walk measuring a panel that never came up.
 */
const takeCardAndReturn = async () => {
  await page.keyboard.press('1');                     // TAKE CARD (left row 0)
  await softWait(() => !window.__hud.panel(), 'the panel to close after TAKE CARD');
  await page.waitForTimeout(800);
  await openMachine();
  await page.keyboard.press('1');                     // INSERT CARD
  await page.waitForTimeout(250);
};

/** the same, from the MENU screen, where TAKE CARD is the right-hand row 4 */
const takeCardFromMenu = async () => {
  await page.keyboard.press('8');
  await softWait(() => !window.__hud.panel(), 'the panel to close after TAKE CARD');
  await page.waitForTimeout(800);
  await openMachine();
  await page.keyboard.press('1');                     // INSERT CARD
  await page.waitForTimeout(250);
};
await openMachine();

const snap = () => page.evaluate(() => ({
  screen: window.__atm.screen(), pin: window.__atm.pin(),
  panel: window.__hud.panel(), seated: !!window.__ct.seated(),
}));

/** page point over a control, projected from the mesh it is painted on.
 *  `which` is 'pad' (the physical keys) or 'screen' (the fascia soft keys). */
const pointOf = (which, arg) => page.evaluate(([which, arg]) => {
  const p = which === 'pad'
    ? window.__atm.padPoint(arg)
    : window.__atm.buttonPoint(arg.i, arg.right);
  if (!p) return null;
  const cam = window.__ct.camera();
  let m = null;
  if (which === 'screen') {
    m = window.__atm.surfaceMesh();
  } else {
    const scene = window.__ct.scene();
    let bd = Infinity;
    scene.traverse((o) => {
      if (o.userData?.atmPart !== 'keys') return;
      o.updateWorldMatrix(true, false);
      const v = new (o.position.constructor)().setFromMatrixPosition(o.matrixWorld);
      const d = (v.x - cam.position.x) ** 2 + (v.z - cam.position.z) ** 2;
      if (d < bd) { bd = d; m = o; }
    });
  }
  if (!m) return null;
  m.updateWorldMatrix(true, false);
  const pos = m.geometry.getAttribute('position'), uv = m.geometry.getAttribute('uv');
  const corner = (tu, tv) => {
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(uv.getX(i) - tu) < 1e-6 && Math.abs(uv.getY(i) - tv) < 1e-6) {
        return new (m.position.constructor)(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    return null;
  };
  const c00 = corner(0, 0), c10 = corner(1, 0), c01 = corner(0, 1), c11 = corner(1, 1);
  if (!c00 || !c10 || !c01 || !c11) return null;
  const a = c00.clone().lerp(c10, p.u);
  const b = c01.clone().lerp(c11, p.u);
  const world = a.lerp(b, p.v).applyMatrix4(m.matrixWorld);
  const ndc = world.clone().project(cam);
  const r = document.querySelector('canvas').getBoundingClientRect();
  return {
    x: r.left + (ndc.x * 0.5 + 0.5) * r.width,
    y: r.top + (-ndc.y * 0.5 + 0.5) * r.height,
    canvas: { x: p.x, y: p.y },
  };
}, [which, arg]);

const cursorKind = async () => {
  const c = await page.evaluate(() => document.body.style.cursor);
  return (c.split(',').pop() ?? '').trim() || '(none)';
};

/** click a physical pad key with the real mouse */
const clickPad = async (k) => {
  const p = await pointOf('pad', k);
  if (!p) { ok(false, `could not project pad key ${k}`); return null; }
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(120);
  return p;
};

// ── 0. the machine agrees where CANCEL is ─────────────────────────────────
// Prove the point we are about to click really is the CANCEL row, before any
// conclusion rests on it. A walk that clicks the wrong pixel and reports the
// screen unchanged looks exactly like a broken CANCEL.
await page.keyboard.press('1');                       // INSERT CARD
await page.waitForTimeout(250);
ok((await snap()).screen === 'pin', 'INSERT CARD reaches the PIN screen');

const cancelRow = await page.evaluate(() => {
  const p = window.__atm.buttonPoint(0, true);
  return window.__atm.buttonAt(p.x, p.y);
});
ok(cancelRow && cancelRow.i === 0 && cancelRow.right === true,
  `buttonPoint(0,right) hit-tests back to the CANCEL row: ${JSON.stringify(cancelRow)}`);

// ── 1. CANCEL BY CLICK, mid-PIN. THE HEADLINE. ────────────────────────────
// Type two digits with the real keys, then click CANCEL. Before this item that
// click ran `onKey('5')` and typed a 5 into the PIN — the screen stayed put and
// the digit count went UP, which is the user's exact complaint. So assert BOTH:
// the screen left, and no digit was added on the way out.
await clickPad('4');
await clickPad('9');
ok((await snap()).pin === 2, 'two digits are in before we try to cancel');

const cancelPt = await pointOf('screen', { i: 0, right: true });
ok(!!cancelPt, 'the CANCEL button projects to a point on the screen face');
await page.mouse.move(cancelPt.x, cancelPt.y);
await page.waitForTimeout(90);
const cancelCursor = await cursorKind();
ok(cancelCursor === 'pointer', `hand cursor over CANCEL (got ${cancelCursor})`);
await page.mouse.click(cancelPt.x, cancelPt.y);
await page.waitForTimeout(250);
const afterCancel = await snap();
ok(afterCancel.screen === 'card',
  `CLICKING CANCEL LEAVES THE PIN SCREEN (screen=${afterCancel.screen}) — page ${cancelPt.x.toFixed(0)},${cancelPt.y.toFixed(0)} canvas ${cancelPt.canvas.x},${cancelPt.canvas.y}`);
ok(afterCancel.pin === 0,
  `and CANCEL did not type a 5 on the way out (pin=${afterCancel.pin})`);

// ── 2. CANCEL BY KEY — CLR on an empty PIN ────────────────────────────────
// CANCEL's own number is 5 and 5 is a digit this screen is entitled to eat, so
// the keyboard's way out is the machine's own CLR key on an empty entry.
await takeCardAndReturn();
ok((await snap()).screen === 'pin', 'back on the PIN screen for the keyboard test');

await page.keyboard.press('Backspace');               // CLR, empty PIN
await page.waitForTimeout(250);
ok((await snap()).screen === 'card', 'CLR on an EMPTY PIN cancels from the keyboard');

// and CLR still deletes a digit when there is one — the regression guard
await takeCardAndReturn();
await page.keyboard.press('7');
await page.keyboard.press('7');
await page.waitForTimeout(150);
ok((await snap()).pin === 2, 'two digits in');
await page.keyboard.press('Backspace');
await page.waitForTimeout(150);
const afterClr = await snap();
ok(afterClr.pin === 1 && afterClr.screen === 'pin',
  `CLR still deletes a digit rather than cancelling (pin=${afterClr.pin}, screen=${afterClr.screen})`);
ok((await snap()).screen === 'pin', 'still on the PIN screen with one digit deleted');
await page.keyboard.press('Backspace');               // back to empty
await page.waitForTimeout(150);

// ── 3. AUTO-SUBMIT ON THE FOURTH DIGIT, and ENROLMENT ─────────────────────
// This is the first PIN this card has ever been given, so it is the one that
// gets saved. Nothing is pressed after the fourth digit.
await page.keyboard.press('Backspace');               // empty CLR — cancels out
await page.waitForTimeout(200);
await takeCardAndReturn();
for (const d of ['1', '2', '3', '4']) { await page.keyboard.press(d); await page.waitForTimeout(60); }
const rightAfter = await snap();
ok(rightAfter.screen === 'pin' || rightAfter.screen === 'menu',
  `the fourth digit is accepted (screen=${rightAfter.screen})`);
await page.waitForTimeout(500);                       // past SUBMIT_MS
const submitted = await snap();
ok(submitted.screen === 'menu',
  `THE FOURTH DIGIT SUBMITS ON ITS OWN — nothing was pressed after it (screen=${submitted.screen})`);

// ── 4. A LATER VISIT MUST MATCH ───────────────────────────────────────────
await takeCardFromMenu();
ok((await snap()).screen === 'pin', 'back at the PIN screen on a later visit');

for (const d of ['9', '9', '9', '9']) { await page.keyboard.press(d); await page.waitForTimeout(60); }
await page.waitForTimeout(500);
const wrong = await snap();
ok(wrong.screen === 'pin',
  `A WRONG PIN IS REJECTED and you stay on the PIN screen (screen=${wrong.screen})`);
ok(wrong.pin === 0, `and the entry is cleared to retry (pin=${wrong.pin})`);

// the enrolled PIN still works, straight after being refused
for (const d of ['1', '2', '3', '4']) { await page.keyboard.press(d); await page.waitForTimeout(60); }
await page.waitForTimeout(500);
ok((await snap()).screen === 'menu', 'THE ENROLLED PIN IS REMEMBERED and opens the menu on a retry');

// ── 5. ENT STILL WORKS, during the beat ───────────────────────────────────
// The auto-submit must not have made ENT a key that can never be live — the
// pad's affordance logic gates the hand cursor on exactly that.
await takeCardFromMenu();
for (const d of ['1', '2', '3']) { await page.keyboard.press(d); await page.waitForTimeout(50); }
await page.keyboard.press('4');                       // fourth digit — beat armed
const entPt = await pointOf('pad', 'ENT');
const entHot = await page.evaluate(() => {
  const p = window.__atm.padPoint('ENT');
  return window.__atm.hotAt(p.x, p.y);
});
ok(entHot === true, 'ENT is LIVE while the PIN is complete (the pad is not lying about itself)');
await page.mouse.click(entPt.x, entPt.y);
await page.waitForTimeout(250);
ok((await snap()).screen === 'menu', 'and clicking the real ENT key still accepts the PIN');

// ── 6. ESCAPE STILL RELEASES ──────────────────────────────────────────────
// BRIEF §11: a panel you cannot close is the worst bug this project ships.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const out = await snap();
ok(!out.panel, `Escape closed the panel (panel=${out.panel})`);
ok(out.seated === false, 'Escape gave the feet back');
ok((await page.evaluate(() => window.__atm.padLive())) === false,
  'and the CRT stops answering for the keypad');

await page.screenshot({ path: 'shots/w67-atm-pin-end.png' });
console.log(errs.length ? `\nconsole/page errors:\n  ${errs.join('\n  ')}` : '\nno console or page errors');
ok(errs.length === 0, 'no console or page errors');

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);

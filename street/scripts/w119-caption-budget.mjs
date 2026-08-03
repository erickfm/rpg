// THE PANEL CAPTION'S WIDTH BUDGET, AND THE PIN THAT LIVES ON THE PURSE.
// Queue item 216.
//
//   SHOT_URL=http://localhost:4750/ node scripts/w119-caption-budget.mjs
//   SHOT_URL=... node scripts/w119-caption-budget.mjs --selftest
//
// Two assertions, both about the ATM because the ATM is the reference tenant of
// the diegetic panel framework and four more are queued behind it (mail 155,
// library PC 157, loan 185, slots 208).
//
// 1. THE CAPTION FITS ITS STATED BUDGET, AT EVERY WINDOW SIZE, ON EVERY SCREEN.
//    `hud.ts` publishes the budget it used on `cap.dataset.budget` — the number
//    is READ, never retyped here (BUILDER-BRIEF §8). The assertion is a RANGE,
//    not a floor: the caption must be one line AND wider than nothing AND no
//    wider than the budget. A caption that measured 0 px would pass a bare
//    "fits" test while saying nothing at all.
//
// 2. THE PIN PERSISTS WHERE THE CASH DOES. `purse.pin`, not module state. The
//    discriminating observation is `__atm.enrolledOnPurse()` going false → true
//    across enrolment: under the module-state design it landed in a module `let`
//    and the purse stayed untouched, so this reads false forever. Verified in
//    both signs — see `--selftest`, and the handoff note for the run against the
//    pre-change build, which fails assertion 2 and passes assertion 1's shape.
//
// Exit code is the verdict. Six checks in this repo printed a failure and exited
// 0; this one does not.
import { chromium } from 'playwright';
import { waitPainted } from './lib/painted.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4750/';
const SELFTEST = process.argv.includes('--selftest');
// The default sweep straddles the point where the ATM's own longest caption
// (487.6 px measured) stops fitting in the OLD half-the-viewport limit, which is
// 976 px wide — 1024 is just above it and 800 well below, so a regression to
// shrink-to-fit shows up as a wrapped line rather than as nothing.
const SIZES = (process.env.SIZES ?? '1920x1080,1280x800,1024x640,800x600')
  .split(',').map((s) => s.split('x').map(Number));

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const browser = await chromium.launch();
const errs = [];

/** Read the caption box and the budget the code itself used. `lines` is derived
 *  from the font's own line box (13px × 1.4), not from a typed constant. */
const capMetrics = (page) => page.evaluate(() => {
  const wrap = document.getElementById('ct-atm');
  const cap = wrap && wrap.lastElementChild;
  if (!cap || cap.tagName !== 'DIV') return null;
  const cs = getComputedStyle(cap);
  const lineH = parseFloat(cs.lineHeight) || (13 * 1.4);
  const r = cap.getBoundingClientRect();
  // `scrollWidth` is what the TEXT wants; `clientWidth` is what it was given.
  // Compare the ink to the budget, not the box, or a box clamped to the budget
  // would report itself as fitting no matter how much it had to wrap.
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;left:-9999px;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing};`;
  probe.textContent = cap.textContent;
  document.body.appendChild(probe);
  const ink = probe.getBoundingClientRect().width;
  probe.remove();
  return {
    budget: Number(cap.dataset.budget),
    ink: +ink.toFixed(1),
    box: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
    lines: Math.round(r.height / lineH),
    text: cap.textContent,
    screen: window.__atm.screen(),
    vw: window.innerWidth,
  };
});

const assertCaption = (m, where) => {
  if (!m) { ok(false, `${where}: no caption element at all`); return; }
  ok(Number.isFinite(m.budget) && m.budget > 0,
    `${where}: the panel STATES a budget (dataset.budget=${m.budget})`);
  ok(m.ink > 0, `${where}: the caption has ink to measure (${m.ink} px)`);
  ok(m.ink <= m.budget,
    `${where}: the longest string FITS — ${m.ink} px of ink in a ${m.budget} px budget`
    + ` (${((m.ink / m.budget) * 100).toFixed(0)}% used)`);
  ok(m.lines === 1, `${where}: it is ONE line, not wrapped (h=${m.box.h}, lines=${m.lines})`);
  ok(m.box.x >= 0 && m.box.x + m.box.w <= m.vw,
    `${where}: the box is on screen (${m.box.x}..${(m.box.x + m.box.w).toFixed(1)} of ${m.vw})`);
};

for (const [width, height] of SIZES) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => errs.push(`${width}x${height} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${width}x${height} console.error: ${m.text()}`); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  if (width === SIZES[0][0]) await reportWorld(page, URL);
  await waitPainted(page);

  const spot = await page.evaluate(() => window.__ct.spots()
    .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
    .map((q) => ({ x: q.x, z: q.z }))[0]);
  await page.evaluate(([x, z]) => window.__ct.warp(
    x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
  await page.waitForTimeout(400);

  // A HELD keypress — the [E] edge is read once per rendered frame (BRIEF §5).
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 8000 })
    .catch(() => ok(false, `${width}x${height}: the ATM panel never opened`));
  await page.keyboard.up('e');
  await page.waitForTimeout(700);

  // ── the IDLE caption ('click a button, or press its number') ────────────
  assertCaption(await capMetrics(page), `${width}x${height} idle`);

  // ── and the PIN caption, which is the LONGEST string this panel has ─────
  // Driven with the REAL MOUSE on the machine's own INSERT CARD button, because
  // the item asks for it and because a keyboard-only walk cannot see a control
  // that looks live and is not (item 184's whole subject).
  const pt = await page.evaluate(() => {
    const p = window.__atm.buttonPoint(0, false);
    const m = window.__atm.surfaceMesh();
    if (!p || !m) return null;
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
    const a = c00.clone().lerp(c10, p.u), b = c01.clone().lerp(c11, p.u);
    const world = a.lerp(b, p.v).applyMatrix4(m.matrixWorld);
    const ndc = world.clone().project(window.__ct.camera());
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + (ndc.x * 0.5 + 0.5) * r.width, y: r.top + (-ndc.y * 0.5 + 0.5) * r.height };
  });
  ok(!!pt, `${width}x${height}: INSERT CARD projects onto the fascia`);
  if (pt) {
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(350);
  }
  const pinM = await capMetrics(page);
  ok(pinM && pinM.screen === 'pin',
    `${width}x${height}: CLICKING INSERT CARD reached the PIN screen (screen=${pinM && pinM.screen})`);
  assertCaption(pinM, `${width}x${height} pin`);

  if (SELFTEST && width === 1280) {
    // ── BOTH SIGNS ────────────────────────────────────────────────────────
    // The mutation lands AFTER the last write to the thing it mutates
    // (GOTCHAS 91): `paint()` is the only writer of `cap.textContent` and it
    // runs on state change, so with the machine sitting still on the PIN screen
    // this text survives to be measured. Verified by the second read below.
    const before = pinM.ink;
    await page.evaluate(() => {
      const cap = document.getElementById('ct-atm').lastElementChild;
      cap.dataset.real = cap.textContent;
      cap.textContent = 'click the keys below, or type it — CLR backs out, and then some, '
        + 'because a caption with no budget will happily run to the far side of the room';
    });
    await page.waitForTimeout(60);
    const bad = await capMetrics(page);
    ok(bad.ink > bad.budget && bad.lines > 1,
      `SELFTEST(+): an over-long caption is CAUGHT — ${bad.ink} px of ink over a ${bad.budget} px`
      + ` budget, wrapped to ${bad.lines} lines`);
    ok(bad.box.w <= bad.budget + 0.5,
      `SELFTEST(+): …and it WRAPS inside the budget rather than overhanging (box ${bad.box.w} px)`);
    await page.evaluate(() => {
      const cap = document.getElementById('ct-atm').lastElementChild;
      cap.textContent = cap.dataset.real;
    });
    await page.waitForTimeout(60);
    const back = await capMetrics(page);
    ok(Math.abs(back.ink - before) < 0.5 && back.lines === 1,
      `SELFTEST(−): the real caption measures the same again (${back.ink} px, ${back.lines} line)`);
  }

  // ── 2. THE PIN LIVES ON THE PURSE ───────────────────────────────────────
  if (width === 1280) {
    const pre = await page.evaluate(() => window.__atm.enrolledOnPurse());
    ok(pre === false, `a fresh card is NOT enrolled on the purse yet (${pre})`);
    for (const k of ['4', '9', '1', '7']) { await page.keyboard.press(k); await page.waitForTimeout(90); }
    await page.waitForTimeout(500);                    // past SUBMIT_MS = 240
    const post = await page.evaluate(() => ({
      enrolled: window.__atm.enrolledOnPurse(), screen: window.__atm.screen(),
    }));
    ok(post.screen === 'menu', `four digits enrol and open the menu (screen=${post.screen})`);
    ok(post.enrolled === true,
      `THE PIN LANDED ON THE PURSE, where the cash is — __atm.enrolledOnPurse()=${post.enrolled}`);

    // and it survives leaving the machine, the way the cash does
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    const stillThere = await page.evaluate(() => window.__atm.enrolledOnPurse());
    ok(stillThere === true, `and it is still on the purse after walking away (${stillThere})`);
  }

  await page.close();
}

ok(errs.length === 0, `no console or page errors (${errs.length})`);
for (const e of errs.slice(0, 8)) console.log('    ' + e);

console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await browser.close();
process.exit(fails.length ? 1 : 0);

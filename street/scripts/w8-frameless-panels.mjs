// THE CLAIM (queue item 0c): the ATM, slots, blackjack and library-PC panels
// no longer draw the framework's own moulded bezel/title/caption chrome
// around a screen that already paints a complete fascia of its own.
//
// Verifies, per panel: (1) it opens the same way it always did — the ATM's
// Spot, or SITTING at the seat for the other three, exactly as
// `L-slots-inworld.mjs` and its siblings already prove opens them, because
// chrome is the only thing that changed and the way IN must not have;
// (2) the DOM canvas is now exactly the caller's own w×h, with none of the
// BEZEL*2 + TITLE_H + CAPTION padding `makePanel` used to add — expected
// sizes cited from source: `atm.ts` W=300,H=214 (`const W = 300, H = 214`);
// `slots.ts` exports `FACE = { w: 320, h: 256 }`; `blackjack.ts` exports
// `FELT = { w: 320, h: 256 }`; `library-pc.ts` has `const W = 320, H = 220`;
// (3) ESC still closes it AND stands the player back up — no trap left
// behind; (4) zero console errors.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/w8-frameless-panels.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN server. No default (GOTCHAS §48).');
  process.exit(3);
}

const browser = await chromium.launch();
const errors = [];
// A FRESH PAGE PER SEAT, deliberately. Measured, not assumed: sitting at the
// slot stool, standing up, then walking straight to the blackjack table and
// pressing E offers the prompt but does NOT seat the player — reproduced
// identically on the UNMODIFIED code (`git stash` the five files this item
// touches and re-run the same sequence), so it predates this change and is
// not something `chrome:'none'` caused. Written up below, not chased here —
// this item's grant is `ct/hud.ts` + each panel's own module, and the fault
// looks like it lives in the shared seat/spot machinery (`crosstown.ts` /
// `fp.ts`), which this item does not name. One page per seat sidesteps it so
// this script measures MY change (chrome) rather than that pre-existing gap.
const freshPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
  } catch (e) {
    console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
    await browser.close();
    process.exit(3);
  }
  // slots/blackjack/library-pc reach `makePanel` through a DYNAMIC import (see
  // each file's own comment — GOTCHAS §28), so their panels register a tick
  // after `__ct` exists, not synchronously with it.
  await page.waitForFunction(() => {
    const p = window.__hud?.panels?.() ?? [];
    return p.includes('ct-slots') && p.includes('ct-blackjack') && p.includes('ct-library-pc');
  }, { timeout: 15000 });
  return page;
};

let page = await freshPage();
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };
const press = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(80); await page.keyboard.up(k); await page.waitForTimeout(160); };
// `fn` runs IN THE BROWSER (Playwright serialises it), so it cannot close
// over node-side variables — anything it needs is passed through `arg`.
const until = async (fn, arg, what, ms = 8000) => {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};
const panelUp = () => page.evaluate(() => window.__hud.panel());
const seatedNow = () => page.evaluate(() => !!window.__ct.seated());
const canvasSize = (id) => page.evaluate((id) => {
  const wrap = document.getElementById(id);
  const cv = wrap ? wrap.firstChild : null;
  return cv ? { w: cv.width, h: cv.height } : null;
}, id);

// ── ATM: Spot-triggered, no seat — its own test affordance stands in for E ──
{
  await page.evaluate(() => window.__atm.open());
  const opened = await until((id) => window.__hud.panel() === id, 'ct-atm', 'the ATM to open');
  ok(opened, 'ATM opens (via its own __atm.open() test affordance)');
  if (opened) {
    const size = await canvasSize('ct-atm');
    ok(!!size && size.w === 300 && size.h === 214,
      `ATM canvas is exactly its own 300x214, no added chrome (got ${JSON.stringify(size)})`);
  }
  await page.keyboard.press('Escape');
  ok(await until((id) => window.__hud.panel() !== id, 'ct-atm', 'the ATM to close'), 'ATM: Escape closes it');
}

// ── slots / blackjack / library-pc: SIT at the seat, exactly as a player would ──
const sitAndCheck = async (label, panelId, want) => {
  const seats = await page.evaluate((l) => window.__ct.seats().filter((s) => s.label === l), label);
  if (!seats.length) { ok(false, `${panelId}: no seat labelled '${label}' — nothing to sit on`); return; }
  const seat = seats[0];
  await page.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos().gy ?? 0, 0), seat);
  // `crosstown.ts:1048` prints `[E] ${active.label()}`, not the bare label.
  const offered = await until(
    (l) => {
      const d = document.getElementById('ct-prompt');
      return !!d && d.style.display !== 'none' && d.textContent === `[E] ${l}`;
    },
    label,
    `'[E] ${label}' to be offered`,
  );
  ok(offered, `${panelId}: walking to the seat's approach point offers '${label}'`);
  const beforePanel = await panelUp();
  await press('e');
  const seated = await until(() => !!window.__ct.seated(), null, `${panelId}: player seated`);
  const opened = await until((id) => window.__hud.panel() === id, panelId, `${panelId} to open`);
  ok(seated, `${panelId}: sitting actually seats the player`);
  ok(beforePanel === null, `${panelId}: no panel was up before sitting`);
  ok(opened, `${panelId}: SITTING opens the machine (the seat is still the trigger)`);
  if (opened) {
    const size = await canvasSize(panelId);
    ok(!!size && size.w === want.w && size.h === want.h,
      `${panelId} canvas is exactly its own ${want.w}x${want.h}, no added chrome (got ${JSON.stringify(size)})`);
  }
  await page.keyboard.press('Escape');
  const closed = await until((id) => window.__hud.panel() !== id, panelId, `${panelId} to close`);
  ok(closed, `${panelId}: Escape closes it`);
  const stoodUp = await until(() => !window.__ct.seated(), null, `${panelId}: standing up after Escape`);
  ok(stoodUp, `${panelId}: Escape also stands the player up — no trap left behind`);
  // Belt and braces: read it back directly too, not just via the poll that
  // already passed.
  ok(!(await seatedNow()), `${panelId}: confirmed off the seat`);
};

await sitAndCheck('sit at the slot', 'ct-slots', { w: 320, h: 256 });
page = await freshPage();
await sitAndCheck('sit at the blackjack table', 'ct-blackjack', { w: 320, h: 256 });

// ── library PC: NOT reachable by sitting yet — a PRE-EXISTING, unrelated gap ──
//
// `library-pc.ts` joins on seat label `'sit at the computer'` (queue item 3),
// but `int-library.ts:1261` still registers its chairs as `'sit at the
// terminal'` — item 3 has not landed. `library-pc.ts`'s own top-of-file
// comment documents this and ships `window.__librarypc.open()` as the way to
// test the panel until it does. Using that here rather than `sitAndCheck` so
// this check measures MY change (chrome) and not a gap belonging to a
// different, unclaimed item.
{
  page = await freshPage();
  await page.evaluate(() => window.__librarypc.open());
  const opened = await until((id) => window.__hud.panel() === id, 'ct-library-pc', 'library PC to open (via __librarypc.open())');
  ok(opened, 'library PC opens (via its own __librarypc.open() test affordance — its seat is not wired yet, a pre-existing gap)');
  if (opened) {
    const size = await canvasSize('ct-library-pc');
    ok(!!size && size.w === 320 && size.h === 220,
      `ct-library-pc canvas is exactly its own 320x220, no added chrome (got ${JSON.stringify(size)})`);
  }
  await page.keyboard.press('Escape');
  ok(await until((id) => window.__hud.panel() !== id, 'ct-library-pc', 'library PC to close'), 'library PC: Escape closes it');
}

ok(errors.length === 0, `zero console errors (${errors.length} found: ${errors.slice(0, 5).join(' | ')})`);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAIL(S)` : '\nALL OK');
process.exit(fails.length ? 1 : 0);

// ITEM 0e: the frameless panel caption is double-rendered.
//
// ROOT CAUSE (measured, not assumed): `crosstown.ts`'s per-frame loop calls
// `hud.prompt(...)` every frame with whatever the player is standing on or
// seated at — a world-owned "[E] ..." caption anchored near the bottom of the
// viewport. It never checked whether a panel was open. Item 0c gave the four
// frameless panels (atm, slots, blackjack, library-pc) their OWN caption line
// via a DOM div anchored just above the panel canvas's bottom edge. The two
// captions occupy nearly the same vertical band on screen — on the built
// slots panel, measured BEFORE the fix: prompt y 603.8-632.0 vs the panel's
// own caption y 610.9-629.1, a near-total overlap — and both text nodes
// render at once, reading as garbled overlapping text.
//
// FIX: `hud.ts`'s own `prompt()` setter now force-hides `ct-prompt` whenever
// `panelUp()` reports a panel open — entirely inside hud.ts, since it already
// owns both the panel registry and the prompt div.
//
// This script checks all four converted panels, not just the ATM (the one
// the desk's report named) — the item said to.
//
// Usage: SHOT_URL=http://localhost:4189/ node scripts/w10-caption-double.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL to YOUR OWN server (GOTCHAS §48).'); process.exit(3); }

const browser = await chromium.launch();
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const overlaps = (a, b) => a && b && a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h;

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => { throw e; });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
  return page;
}

async function dumpAfterOpen(page, wantPanel) {
  await page.waitForFunction((w) => window.__hud.panel() === w, wantPanel, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const prompt = document.getElementById('ct-prompt');
    const panelId = window.__hud.panel();
    const wrap = panelId ? document.getElementById(panelId) : null;
    const cap = wrap ? wrap.lastChild : null;
    const rects = {};
    for (const [k, el] of Object.entries({ prompt, cap })) {
      if (!el) { rects[k] = null; continue; }
      const r = el.getBoundingClientRect();
      rects[k] = {
        text: el.textContent, visible: getComputedStyle(el).display !== 'none' && !!el.textContent,
        rect: { y: r.y, h: r.height },
      };
    }
    return { panelId, ...rects };
  });
}

// ── ATM: opened by walking up to a Spot ────────────────────────────────────
{
  const page = await freshPage();
  const spot = await page.evaluate(() => window.__ct.spots()
    .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
    .map((q) => ({ x: q.x, z: q.z }))[0] ?? null);
  ok(!!spot, 'ATM: the machine offers an [E] spot');
  if (spot) {
    await page.evaluate(([x, z]) => window.__ct.warp(x + 1.1, z, Math.atan2(-1.1, 0), window.__ct.groundAt(x + 1.1, z), 0), [spot.x, spot.z]);
    // GOTCHAS §30: the prompt is rewritten once a FRAME from wherever the
    // player is; a fixed sleep after the warp bets on the frame rate rather
    // than waiting for the selection raycast to actually land on the ATM.
    await page.waitForFunction(() => {
      const e = document.getElementById('ct-prompt');
      const t = e && e.style.display !== 'none' ? e.textContent : '';
      return /FIRST FEDERAL/i.test(t || '');
    }, null, { timeout: 6000 }).catch(() => {});
    await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e');
    const d = await dumpAfterOpen(page, 'ct-atm');
    ok(d.panelId === 'ct-atm', `ATM: panel opened (got ${d.panelId})`);
    ok(d.prompt && !d.prompt.visible, `ATM: world [E] prompt is hidden while panel open (text=${JSON.stringify(d.prompt?.text)}, visible=${d.prompt?.visible})`);
    ok(d.cap && d.cap.visible, `ATM: panel's own caption is showing (${JSON.stringify(d.cap?.text)})`);
    ok(!overlaps(d.prompt, d.cap) , 'ATM: no vertical overlap between world prompt and panel caption');
  }
  await page.close();
}

// ── seat-opened panels: slots, blackjack ────────────────────────────────────
// library-pc is deliberately NOT in this list: its own file (library-pc.ts:20-30)
// documents that the library's seat still carries the OLD label
// ('sit at the terminal', int-library.ts:1261) and the panel joins on
// 'sit at the computer' — a queue item (3) not yet landed, unrelated to 0e.
// Checked separately below via the `__librarypc.open()` test affordance,
// which is how this project's own w2-library-pc.mjs drives it too.
const seats = [
  { seatLabel: 'sit at the slot', panelId: 'ct-slots', name: 'SLOTS' },
  { seatLabel: 'sit at the blackjack table', panelId: 'ct-blackjack', name: 'BLACKJACK' },
];
for (const { seatLabel, panelId, name } of seats) {
  const page = await freshPage();
  const found = await page.evaluate((label) =>
    window.__ct.seats().filter((s) => s.label === label), seatLabel);
  ok(found.length > 0, `${name}: a seat labelled '${seatLabel}' exists`);
  if (found.length) {
    const seat = found[Math.floor(found.length / 2)];
    await page.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos().gy ?? 0, 0), seat);
    await page.waitForFunction(() => !!window.__ct.seated(), { timeout: 8000 }).catch(() => {});
    await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e');
    const d = await dumpAfterOpen(page, panelId);
    ok(d.panelId === panelId, `${name}: panel opened (got ${d.panelId})`);
    ok(d.prompt && !d.prompt.visible, `${name}: world [E] prompt is hidden while panel open (text=${JSON.stringify(d.prompt?.text)}, visible=${d.prompt?.visible})`);
    ok(d.cap && d.cap.visible, `${name}: panel's own caption is showing (${JSON.stringify(d.cap?.text)})`);
    ok(!overlaps(d.prompt, d.cap), `${name}: no vertical overlap between world prompt and panel caption`);

    // stand up, ESC-close path: the world prompt must come back once the
    // panel is gone, or standing itself would be a second trap.
    await page.keyboard.down('Escape'); await page.waitForTimeout(120); await page.keyboard.up('Escape');
    await page.waitForFunction(() => window.__hud.panel() === null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => {
      const p = document.getElementById('ct-prompt');
      return { text: p.textContent, visible: getComputedStyle(p).display !== 'none' };
    });
    ok(after.visible, `${name}: world prompt returns after ESC closes the panel (${JSON.stringify(after)})`);
  }
  await page.close();
}

// ── library-pc: opened directly via its test affordance ───────────────────
// (seat wiring not yet landed — see comment above). This still exercises the
// exact thing item 0e is about: does the world's own [E] prompt hide once
// THIS panel is up.
{
  const page = await freshPage();
  const built = await page.evaluate(() => typeof window.__librarypc?.open === 'function');
  ok(built, 'LIBRARY-PC: __librarypc test affordance is live');
  if (built) {
    await page.evaluate(() => window.__librarypc.open());
    const d = await dumpAfterOpen(page, 'ct-library-pc');
    ok(d.panelId === 'ct-library-pc', `LIBRARY-PC: panel opened (got ${d.panelId})`);
    ok(!d.prompt || !d.prompt.visible, `LIBRARY-PC: world [E] prompt is hidden while panel open (${JSON.stringify(d.prompt)})`);
    ok(d.cap && d.cap.visible, `LIBRARY-PC: panel's own caption is showing (${JSON.stringify(d.cap?.text)})`);
    ok(!overlaps(d.prompt, d.cap), 'LIBRARY-PC: no vertical overlap between world prompt and panel caption');
  }
  await page.close();
}

await browser.close();
console.log(`\n${fails.length === 0 ? 'ALL OK' : `${fails.length} FAIL(S)`}`);
process.exit(fails.length ? 1 : 0);

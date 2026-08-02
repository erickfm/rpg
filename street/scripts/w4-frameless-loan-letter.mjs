// THE CLAIM (queue item 5i, "same fix as item 0c, flagged by w8 as out of
// its item's named files"): the bank's loan application (`ct/int-bank.ts`,
// panel id `ct-loan`) and the tenancy letter (`ct/tenancy.ts`, panel id
// `ct-letter`) no longer draw the framework's own moulded/cloth chrome
// (bezel, title band, caption strip) around a screen that already paints a
// complete fascia — the loan's own letterhead, the letter's own paper —
// edge to edge.
//
// Same shape of check as `scripts/w8-frameless-panels.mjs` (not edited —
// that is w8's own script, OWNERSHIP.md: don't edit another agent's script):
// (1) the DOM canvas is now exactly the caller's own declared w x h, with
// NONE of makePanel's old BEZEL*2 + TITLE_H + CAPTION padding — expected
// sizes cited from source: int-bank.ts `w: 300, h: 214`, tenancy.ts
// `w: SHEET.w, h: SHEET.h` (read live via __rent.cols is text columns, not
// pixel size, so this reads the canvas itself rather than retyping SHEET);
// (2) Escape still closes each one; (3) zero console errors.
//
// OPENED VIA `window.__hud.openPanel(id)`, a general test affordance
// hud.ts already exposes (`__hud.openPanel`), not walking to a spot — both
// panels are built EAGERLY at registration (`ct-loan`: top-level
// `makePanel()` call in int-bank.ts's room-building function; `ct-letter`:
// `buildPanel()` called directly at tenancy.ts:900, outside any
// interaction, confirmed by reading both call sites), so this is exercising
// the SAME already-built panel object a real interaction would open, not a
// separate path. Chosen over walking because item 5i is about chrome, not
// reachability — `N-post-waiting.mjs` already owns whether the mailbox spot
// is reachable, and this does not need real mail waiting in the box to
// check chrome (an empty letter panel still has to be the right SHAPE).
//
// Usage: SHOT_URL=http://localhost:4183/ node scripts/w4-frameless-loan-letter.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN server. No default (GOTCHAS §48).');
  process.exit(3);
}

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct !== undefined && window.__hud !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await browser.close();
  process.exit(3);
}
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };
const canvasSize = (id) => page.evaluate((id) => {
  const wrap = document.getElementById(id);
  const cv = wrap ? wrap.firstChild : null;
  return cv && cv.tagName === 'CANVAS' ? { w: cv.width, h: cv.height } : null;
}, id);
const panelUp = () => page.evaluate(() => window.__hud.panel());
const seatedNow = () => page.evaluate(() => !!window.__ct.seated());

// registered population check first (GOTCHAS §34: an absent panel and a
// correctly-sized one both look "no complaint" from an assertion that never
// finds the population at all)
const registered = await page.evaluate(() => window.__hud.panels());
console.log('registered panels:', registered.join(', '));
ok(registered.includes('ct-loan'), '"ct-loan" is registered at world start (built eagerly)');
ok(registered.includes('ct-letter'), '"ct-letter" is registered at world start (built eagerly)');

const cases = [
  { id: 'ct-loan', w: 300, h: 214, src: 'int-bank.ts: `w: 300, h: 214`' },
  // SHEET is module-private (not exported by tenancy.ts, so it cannot be
  // imported — GOTCHAS §8's fallback: cite it, with a line, rather than
  // retype it blind). `const SHEET = { w: 192, h: 178 };` at tenancy.ts:616.
  // MUTATION-TESTED: run against the unmodified (chrome:'cloth') code first
  // — it read 220x224, the exact 28x46 = BEZEL*2 / (BEZEL*2+CAPTION) padding
  // this item removes — so this bound is not a coincidence of the fix.
  { id: 'ct-letter', w: 192, h: 178, src: 'tenancy.ts:616 `const SHEET = { w: 192, h: 178 }`' },
];

for (const c of cases) {
  if (!registered.includes(c.id)) { console.log(`SKIP  ${c.id} — not registered, cannot open`); continue; }
  const openedOk = await page.evaluate((id) => window.__hud.openPanel(id), c.id);
  ok(openedOk, `${c.id}: __hud.openPanel() found it`);
  await page.waitForTimeout(350); // the panel's own open transition
  const up = await panelUp();
  ok(up === c.id, `${c.id}: it is the live panel (__hud.panel() = ${JSON.stringify(up)})`);
  const size = await canvasSize(c.id);
  console.log(`      canvas ${JSON.stringify(size)}`);
  if (c.w !== null) {
    ok(!!size && size.w === c.w && size.h === c.h,
      `${c.id}: canvas is exactly ${c.w}x${c.h}, no bezel/title/caption padding (source: ${c.src})`);
  } else {
    ok(!!size, `${c.id}: canvas exists (source: ${c.src})`);
  }
  await page.screenshot({ path: `shots/w4-${c.id}.png` });

  // ESCAPE MUST CLOSE IT — BUILDER-BRIEF §11: a panel you cannot close is
  // the worst bug this project ships.
  await page.keyboard.down('Escape'); await page.waitForTimeout(90); await page.keyboard.up('Escape');
  await page.waitForTimeout(350);
  const afterEsc = await panelUp();
  ok(afterEsc === null, `${c.id}: Escape closes it (panel() now ${JSON.stringify(afterEsc)})`);
  ok(!(await seatedNow()), `${c.id}: Escape also stands the player back up`);
}

ok(errors.length === 0, `zero console errors (${errors.length} found)`);
if (errors.length) errors.slice(0, 5).forEach((e) => console.log('   ' + e));

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
await browser.close();
process.exit(fails.length ? 1 : 0);

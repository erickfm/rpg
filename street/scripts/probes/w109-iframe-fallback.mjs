// Item 277 — DOES THE PUBLISHED ARTIFACT STILL WORK?
//
// The row: *"A SANDBOXED IFRAME CANNOT LOCK AT ALL — main.ts:32 catches that
// and falls back to drag-look. Do not break the published artifact; keep the
// try/catch and verify the fallback still works."*
//
// The fix adds a SECOND `requestPointerLock` call site, in `ct/hud.ts`'s
// `close()`. If that one throws uncaught in a sandbox, every overlay close in
// the artifact raises an error — and `close()` is the callback that un-traps the
// player, so a throw there is §11 territory rather than a cosmetic log line.
//
// Sandboxed WITHOUT `allow-pointer-lock`, which is what makes this a real test:
// the browser refuses the lock outright, so both call sites take their failure
// path for the genuine reason rather than because nothing tried.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-iframe-fallback.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4650/';
const fails = [];
const notes = [];
const ok = (c, m) => { (c ? notes : fails).push(`${c ? 'PASS' : 'FAIL'}  ${m}`); return c; };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1300, height: 820 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));

// `allow-same-origin` IS PRESENT AND `allow-pointer-lock` IS NOT, and that
// combination is the point. Dropping `allow-same-origin` too gives an opaque
// origin in which this world does not boot at all (measured: `__ct` never
// appears, 30 s timeout) — that is a different fault from the one under test and
// would make this probe report on a blank frame. What the row cares about is a
// frame where LOCKING IS REFUSED, and omitting `allow-pointer-lock` is exactly
// how a host refuses it.
const SANDBOX = process.env.SANDBOX ?? 'allow-scripts allow-same-origin';
await page.setContent(
  `<body style="margin:0"><iframe sandbox="${SANDBOX}" src="${URL}" `
  + `style="width:1280px;height:800px;border:0"></iframe></body>`);
await page.waitForTimeout(1500);
console.log(`iframe sandbox="${SANDBOX}"`);
console.log('frames:', page.frames().map((f) => f.url()).join(' | '));

const frame = page.frames().find((f) => f !== page.mainFrame());
if (!ok(!!frame, '0. FLOOR: the sandboxed iframe exists')) { console.log(fails.join('\n')); await b.close(); process.exit(1); }
await frame.waitForFunction(() => window.__ct !== undefined, { timeout: 25000 });
await page.waitForTimeout(1200);
ok(true, '0. FLOOR: the world INITIALISES inside a sandbox with no pointer lock');

// PROVE THE SANDBOX IS REAL. If locking silently worked here, everything below
// would be measuring the ordinary page and reporting it as the artifact.
const lockRefused = await frame.evaluate(async () => {
  const cv = document.querySelector('canvas');
  try { const r = cv.requestPointerLock(); if (r?.catch) await r; }
  catch { return 'threw'; }
  await new Promise((res) => setTimeout(res, 300));
  return document.pointerLockElement === cv ? 'LOCKED' : 'refused';
});
ok(lockRefused !== 'LOCKED', `1. FLOOR: the sandbox really does refuse pointer lock (${lockRefused})`);

// FOCUS THE FRAME FIRST. `page.keyboard` types into whatever has focus, which
// is the OUTER document until something in the iframe is clicked — the first cut
// of this probe pressed `[E]` at the loan desk and the cabinet never opened,
// which looked exactly like the world being broken in a sandbox. Mouse events
// route by coordinate and were fine; keys are not.
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(500);

const errsBefore = errs.length;
const panel = () => frame.evaluate(() => window.__hud?.panel?.() ?? null);

// Open and close a DIEGETIC overlay — the one that releases and re-acquires.
const spot = await frame.evaluate(() => (window.__ct.spots?.() ?? [])
  .map((s) => ({ label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z }))
  .find((s) => /read the loan application/i.test(s.label)));
if (ok(!!spot, '2. FLOOR: the loan spot is registered inside the sandbox')) {
  await frame.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [spot.x, spot.z]);
  await page.waitForTimeout(600);
  await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e');
  await page.waitForTimeout(1300);
  ok((await panel()) === 'ct-loan', '2. FLOOR: the cabinet opens in the sandbox');
  const yawBefore = await frame.evaluate(() => window.__ct.pos?.() && window.__ct.camera().rotation.y);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  ok((await panel()) === null, '3. the cabinet closes in the sandbox');
  ok(errs.length === errsBefore,
    `3. the close path threw NOTHING uncaught in a sandbox (${errs.length - errsBefore} new error(s))`);

  // DRAG-LOOK STILL WORKS — the fallback the artifact actually runs on.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(880, 400, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const yawAfter = await frame.evaluate(() => window.__ct.camera().rotation.y);
  ok(Math.abs(yawAfter - yawBefore) > 0.05,
    `4. drag-look still turns the camera after an overlay closed (yaw ${yawBefore?.toFixed(3)} -> ${yawAfter?.toFixed(3)})`);
}

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 8)) console.log('   ', e);
console.log(fails.length === 0 ? 'IFRAME FALLBACK OK' : `IFRAME FALLBACK BAD — ${fails.length} failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);

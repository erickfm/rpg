// Item 284 — DOES A CANVAS CLICK RAISE AN UNCAUGHT ERROR IN THE ARTIFACT?
//
// `src/main.ts:32` is the world's ONLY click-to-lock:
//
//     try { renderer.domElement.requestPointerLock(); } catch { /* sandboxed */ }
//
// `requestPointerLock()` returns a PROMISE in modern Chrome and throws nothing
// synchronously, so that `catch` catches NOTHING. Where the lock is refused —
// a sandboxed iframe without `allow-pointer-lock`, which is exactly the
// published artifact embedded in a page — the rejection surfaces as an UNCAUGHT
// pageerror on EVERY canvas click. Nothing is broken for the player (drag-look
// still works); the console just fills with errors that will be blamed on the
// game. Item 277 landed the same fix inside `ct/hud.ts`; this is the other site.
//
// ⚠ WHY THE FLOORS ARE HALF THIS FILE. "0 uncaught errors" is trivially true on
// a world where the click handler never ran, where `pointerLock` is false, or
// where the sandbox quietly allowed the lock. Each of those would be a GREEN
// THAT PROVES NOTHING (BUILDER-BRIEF §10, GOTCHAS 34/79). So before the
// assertion this counts the ACTUAL `requestPointerLock` calls the click
// produced, and proves separately that this frame refuses them.
//
// ⚠ THE COUNTER MUST NOT ATTACH A REJECTION HANDLER. `r.catch(...)` — even
// only to observe — marks the promise handled and SUPPRESSES the very
// pageerror under test, turning the red case green. The wrapper returns the
// original promise untouched and refusal is established by a separate call.
//
// Usage: SHOT_URL=http://localhost:4720/ node scripts/probes/w116-canvas-click-uncaught.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4720/';
const CLICKS = Number(process.env.CLICKS ?? 5);
const fails = [];
const notes = [];
const ok = (c, m) => { (c ? notes : fails).push(`${c ? 'PASS' : 'FAIL'}  ${m}`); return c; };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1300, height: 860 } });
const pageErrors = [];
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

// `allow-same-origin` present, `allow-pointer-lock` ABSENT — that combination is
// the point. Dropping `allow-same-origin` too gives an opaque origin where this
// world never boots (measured by w109-iframe-fallback), which is a different
// fault. A host that embeds the artifact refuses locking exactly this way.
await page.setContent(
  `<body style="margin:0"><iframe sandbox="allow-scripts allow-same-origin" src="${URL}" `
  + `style="width:1280px;height:840px;border:0"></iframe></body>`);
const frame = page.frames().find((f) => f !== page.mainFrame());
if (!ok(!!frame, '0. FLOOR: the sandboxed iframe exists')) {
  console.log(fails.join('\n')); await b.close(); process.exit(1);
}
await frame.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
// __ct exists before anything is DRAWN (GOTCHAS 78) and the click handler is
// only interesting once the proto is live, so wait for a painted frame.
await frame.waitForFunction(() => {
  const p = window.__ct?.painted?.();
  return !!p && p.frames > 0 && p.triangles > 0;
}, { timeout: 30000 });
ok(true, '0. FLOOR: the world PAINTS inside a sandbox with no pointer lock');

// FLOOR 1 — does this frame really refuse the lock? If it silently allowed it,
// every click below would take the success path and report a clean console for
// a world that was never in the failing case at all.
const refusal = await frame.evaluate(async () => {
  const cv = document.querySelector('canvas');
  try {
    const r = cv.requestPointerLock();
    if (r && typeof r.then === 'function') await r;   // deliberate: this call is ours to handle
  } catch { return 'refused'; }
  await new Promise((res) => setTimeout(res, 300));
  return document.pointerLockElement === cv ? 'LOCKED' : 'refused';
});
ok(refusal !== 'LOCKED', `1. FLOOR: this sandbox really refuses pointer lock (${refusal})`);

// FLOOR 2 — instrument the call site. COUNT ONLY; attaching `.catch` here would
// handle the rejection and hide the bug (see the header).
await frame.evaluate(() => {
  window.__lockCalls = 0;
  const proto = Object.getPrototypeOf(document.querySelector('canvas'));
  const orig = proto.requestPointerLock;
  proto.requestPointerLock = function (...args) { window.__lockCalls++; return orig.apply(this, args); };
});

const errsBefore = pageErrors.length;
const consBefore = consoleErrors.length;
for (let i = 0; i < CLICKS; i++) {
  await page.mouse.move(640, 420);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(280);
}
await page.waitForTimeout(900);

const calls = await frame.evaluate(() => window.__lockCalls);
ok(calls >= CLICKS,
  `2. FLOOR: the click handler actually asked for the lock (${calls} requestPointerLock calls from ${CLICKS} clicks)`);

const newPageErrors = pageErrors.slice(errsBefore);
const newConsole = consoleErrors.slice(consBefore);
ok(newPageErrors.length === 0,
  `3. ${CLICKS} canvas clicks raised ZERO uncaught errors (${newPageErrors.length} pageerror(s))`);

// The fallback the artifact actually runs on must survive the fix.
const yawBefore = await frame.evaluate(() => window.__ct.camera().rotation.y);
await page.mouse.move(640, 420);
await page.mouse.down();
await page.mouse.move(900, 420, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(500);
const yawAfter = await frame.evaluate(() => window.__ct.camera().rotation.y);
ok(Math.abs(yawAfter - yawBefore) > 0.05,
  `4. drag-look still turns the camera in the sandbox (yaw ${yawBefore.toFixed(3)} -> ${yawAfter.toFixed(3)})`);

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log(`\nuncaught pageerrors from the clicks: ${newPageErrors.length}`);
for (const e of newPageErrors.slice(0, 6)) console.log('    PAGEERROR:', e.slice(0, 150));
console.log(`console errors from the clicks: ${newConsole.length}`);
for (const e of newConsole.slice(0, 6)) console.log('    console:', e.slice(0, 150));
console.log(fails.length === 0 ? 'CANVAS CLICK CLEAN' : `CANVAS CLICK BAD — ${fails.length} failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);

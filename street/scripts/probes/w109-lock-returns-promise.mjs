// Item 277 — IS `try { el.requestPointerLock() } catch {}` ACTUALLY ENOUGH?
//
// The sandbox probe saw a PAGEERROR — an UNCAUGHT exception — reading
// "Failed to execute 'requestPointerLock': Blocked pointer lock ... the
// 'allow-pointer-lock' permission is not set", from a page whose only call site
// is wrapped in try/catch (`main.ts:32`).
//
// The suspicion: modern Chrome's `requestPointerLock()` returns a PROMISE, and a
// synchronous try/catch does not catch a rejected one — it becomes an unhandled
// rejection instead. If so, the guidance "keep the try/catch" is necessary and
// NOT sufficient, and any new call site must handle the rejection too.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-lock-returns-promise.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4650/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1300, height: 820 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));

await page.setContent(
  `<body style="margin:0"><iframe sandbox="allow-scripts allow-same-origin" src="${URL}" `
  + `style="width:1280px;height:800px;border:0"></iframe></body>`);
const frame = page.frames().find((f) => f !== page.mainFrame());
await frame.waitForFunction(() => window.__ct !== undefined, { timeout: 25000 });
await page.waitForTimeout(1000);

console.log('what does requestPointerLock RETURN here?');
console.log(' ', await frame.evaluate(() => {
  const cv = document.querySelector('canvas');
  let r, threw = null;
  try { r = cv.requestPointerLock(); } catch (e) { threw = String(e).slice(0, 60); }
  return JSON.stringify({ returned: Object.prototype.toString.call(r), isPromise: !!r?.then, threwSync: threw });
}));
await page.waitForTimeout(600);

// EXACTLY main.ts:32's shape — sync try/catch, nothing else.
const before = errs.length;
await frame.evaluate(() => {
  const cv = document.querySelector('canvas');
  try { cv.requestPointerLock(); } catch { /* main.ts:32's comment */ }
});
await page.waitForTimeout(800);
const afterBare = errs.slice(before);
console.log(`\nmain.ts:32's shape  ->  ${afterBare.length} new error(s)`);
for (const e of afterBare) console.log('   ', e);

// …and the shape that also takes the REJECTION.
const before2 = errs.length;
await frame.evaluate(() => {
  const cv = document.querySelector('canvas');
  try { const r = cv.requestPointerLock(); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch { /* */ }
});
await page.waitForTimeout(800);
const afterSafe = errs.slice(before2);
console.log(`\nsync catch + .catch()  ->  ${afterSafe.length} new error(s)`);
for (const e of afterSafe) console.log('   ', e);

console.log(`\nPAGEERRORS overall: ${errs.filter((e) => e.startsWith('PAGEERROR')).length}`);
await b.close();

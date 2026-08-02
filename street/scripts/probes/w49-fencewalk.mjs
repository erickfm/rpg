// w49 / item 114 — WALK the jail yard fence, do not warp at it.
//
// The fence's own comment (ct/jail.ts) records that its collider exists because
// `scripts/O-jail-walk-fix.mjs` caught the "it is decorative, the site ends in
// the void anyway" reasoning being wrong the first time anyone actually walked
// it. My change swapped the panel's material and added two rails; it did not
// touch `ctx.obstacle`, FENCE_X or FENCE_H — but "did not touch the collider"
// is an argument, and walking it is a measurement, so this walks it.
//
// Three things must hold:
//   1. you cannot walk THROUGH the fence  (stopped short of FENCE_X)
//   2. you CAN still cross the yard       (the rails did not wall it off)
//   3. you are not wedged when you stop   (backing away must work)
//
// EXITS NON-ZERO ON FAILURE. A check that prints "FAIL" and exits 0 is how six
// guards in this repo slept.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w49-fencewalk.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4193/');
const FENCE_X = 74.65, CZ = -103;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 20000 });

const pos = () => page.evaluate(() => { const p = window.__ct.pos(); return { x: +p[0].toFixed(3), z: +p[2].toFixed(3) }; });

// HELD keys, not press() — BUILDER-BRIEF §5. And a real duration: dt is clamped
// at 0.05 s, so a fixed wall-clock wait under load walks a shorter distance
// than it looks, which is why each leg re-reads the position rather than
// assuming it arrived.
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
};

const fails = [];

// ── 1. walk INTO the fence from the yard, facing +x ──────────────────────
await page.evaluate((a) => window.__ct.warp(a.x, a.z, Math.PI / 2, 0, 0), { x: 68.0, z: CZ });
await page.waitForTimeout(300);
const start = await pos();
await hold('w', 3000);
const hit = await pos();
console.log(`walk into fence:  start x=${start.x}  ended x=${hit.x}  (fence at ${FENCE_X})`);
if (hit.x >= FENCE_X) {
  fails.push(`WALKED THROUGH THE FENCE: ended x=${hit.x} at/past FENCE_X ${FENCE_X}`);
} else if (hit.x - start.x < 1.0) {
  fails.push(`DID NOT MOVE: start ${start.x} -> ${hit.x}; something is blocking the yard itself`);
} else {
  console.log(`  ok — stopped ${(FENCE_X - hit.x).toFixed(2)} m short of the panel`);
}

// ── 2. back away again: stopping must not be wedging ─────────────────────
await hold('s', 1500);
const back = await pos();
console.log(`back away:        ended x=${back.x}`);
if (back.x >= hit.x - 0.5) fails.push(`WEDGED at the fence: ${hit.x} -> ${back.x}, could not back off`);
else console.log(`  ok — reversed ${(hit.x - back.x).toFixed(2)} m`);

// ── 3. the yard is still crossable along z, past the new rails ───────────
await page.evaluate((a) => window.__ct.warp(a.x, a.z, 0, 0, 0), { x: 72.0, z: -107.0 });
await page.waitForTimeout(300);
const s2 = await pos();
await hold('w', 3000);
const e2 = await pos();
const travelled = Math.abs(e2.z - s2.z);
console.log(`cross yard (+z):  z ${s2.z} -> ${e2.z}  travelled ${travelled.toFixed(2)} m`);
if (travelled < 2.0) fails.push(`YARD NOT CROSSABLE beside the fence: only ${travelled.toFixed(2)} m in 3 s`);
else console.log('  ok — the strip beside the fence is still walkable');

await browser.close();
if (errors.length) { console.error('PAGE ERRORS:', errors.slice(0, 3)); fails.push(`${errors.length} page errors`); }

if (fails.length) { console.error('\nFAIL:'); for (const f of fails) console.error('  ' + f); process.exit(1); }
console.log('\nPASS — fence stops you, does not wedge you, and the yard still walks.');

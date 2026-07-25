// 301's door: does it open, does it shut, does it block, and does it refuse
// to shut ON you.
//
// The collider list is the proof, not the screenshots. `__ct.colliders()` is
// the live array, so `doorShutCap` sitting at 999 or sitting across the
// doorway is a yes/no answer to "is the door actually closed" that no picture
// of a door can give.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/door301.mjs [outdir]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
// argv[2] is NOT the output directory — argv is a mix of flags and paths, and
// `--selftest` landed here as a folder name and got a directory called
// `--selftest/` full of screenshots. Take the first argument that is not a
// flag.
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'shots/door301';
mkdirSync(outDir, { recursive: true });

// These MIRROR ct/apartment.ts. That is a copy, and a copy goes stale silently:
// change DOOR_GAP or move the building and this script keeps running, testing
// coordinates where nothing is, reporting "not blocked" for a doorway it is
// not looking at. Every assertion below would still pass. So the constants are
// checked against the world before any of them are used — see confirmPivot().
const APT_X = 200, APT_Z = -20, ST = 2.7, GAP = 0.95;
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;
const FLOOR = 2 * ST;
const Z0 = AZI(3.5 - GAP / 2), Z1 = AZI(3.5 + GAP / 2);
const PIV = [AX(-0.09), Z0 + 0.02];
const SPOT = [PIV[0] - 0.55, PIV[1] + 1.45];
const at = (dx, dz) => Math.atan2(dx, -dz);

// --selftest: jam a collider across the doorway in the LIVE list, so the
// doorway reads blocked while the door is open. Pushed onto __ct.colliders(),
// the same array the movement code tests.
const SELFTEST = process.argv.includes('--selftest');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.mouse.click(640, 360);                     // take pointer lock so keys land
await page.waitForTimeout(600);

/** Prove the mirrored constants still describe this world: 301's leaf is a
 *  0.045-thick box hung at the pivot, so if it is not within a few cm of where
 *  the arithmetic says, the arithmetic is stale and every result after this is
 *  about empty air. */
const confirmPivot = async () => {
  const near = await page.evaluate(([px, pz, fy]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true); let best = null;
    s.traverse((o) => {
      if (!o.isMesh) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'walkup') return;
      const g = o.geometry?.parameters; if (!g || Math.abs((g.depth ?? 0) - 0.045) > 0.005) return;
      const e = o.matrixWorld.elements;
      if (Math.abs(e[13] - (fy + 1.05)) > 0.3) return;
      const d = Math.hypot(e[12] - px, e[14] - pz);
      if (!best || d < best.d) best = { d, at: [+e[12].toFixed(2), +e[13].toFixed(2), +e[14].toFixed(2)] };
    });
    return best;
  }, [PIV[0], PIV[1], FLOOR]);
  if (!near || near.d > 0.25) {
    console.error(`\nTHE CONSTANTS IN THIS SCRIPT NO LONGER DESCRIBE THE WORLD.`);
    console.error(`  expected 301's leaf near (${PIV[0].toFixed(2)}, ${PIV[1].toFixed(2)})`);
    console.error(near ? `  nearest leaf-shaped mesh is ${near.d.toFixed(2)} m away at ${near.at.join(', ')}`
                       : `  no leaf-shaped mesh stamped 'walkup' on that floor at all`);
    console.error(`  Re-read APT_X / ST / DOOR_GAP from ct/apartment.ts.\n`);
    await browser.close();
    process.exit(1);
  }
  console.log(`301's leaf found ${near.d.toFixed(2)} m from the computed pivot — constants still hold`);
};
await confirmPivot();
if (SELFTEST) {
  await page.evaluate(([z0, z1]) => window.__ct.colliders()
    .push({ minX: 199.84, maxX: 200.06, minZ: z0, maxZ: z1 }), [Z0, Z1]);
  console.log('selftest: jammed the doorway shut — this MUST now go red');
}

const warp = (x, z, yaw, pitch = 0) =>
  page.evaluate(([a, b, c, d, e]) => window.__ct.warp(a, b, c, d, e), [x, z, yaw, FLOOR, pitch]);

/** is the doorway blocked right now? */
const shut = () => page.evaluate(([z0, z1]) => window.__ct.colliders().some((c) =>
  c.minX < 250 && c.minX > 199.5 && c.maxX < 200.5
  && Math.abs(c.minZ - z0) < 0.05 && Math.abs(c.maxZ - z1) < 0.05), [Z0, Z1]);

// The prompt has to be read from a VISIBLE node. The HUD keeps its last text
// in the element after hiding it, so a plain textContent search happily
// reports "close the door" while nothing is on screen — which is how the
// first run of this script produced a label that contradicted the collider.
const prompt = () => page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => {
    if (e.children.length || !/\[E\]/.test(e.textContent || '')) return false;
    const st = getComputedStyle(e);
    return st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.05;
  });
  return el ? el.textContent.trim() : null;
});

const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` });
const press = async () => { await page.keyboard.press('e'); await page.waitForTimeout(950); };

// ── assertions, because printing "must be true" is not checking it ────────
// This script used to print its five results with `<- must be true` beside
// them and exit 0 whatever they said. That made the READER the assertion: all
// five behaviours could break and it stayed green. Same fault as lotwalk's,
// and in the file that tests the most.
const FAIL = [];
const expect = (label, got, want) => {
  const ok = got === want;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}: ${got}${ok ? '' : `  (expected ${want})`}`);
  if (!ok) FAIL.push(`${label}: got ${got}, expected ${want}`);
};
const log = [];
const say = (s) => { log.push(s); console.log(s); };

// ── 1. stand at the spot, door open ────────────────────────────────────────
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(500);
expect('open at rest, doorway clear', await shut(), false);
await shot('01-open');

// ── 2. shut it ─────────────────────────────────────────────────────────────
await press();
expect('after E, doorway blocked', await shut(), true);
await shot('02-shut');

// close-ups of both jambs, to see whether the leaf clips either end
await warp(AX(-0.85), Z1 - 0.12, at(0.7, -0.35), -0.05); await page.waitForTimeout(350);
await shot('03-shut-strike');
await warp(AX(-0.85), Z0 + 0.30, at(0.7, -0.30), -0.05); await page.waitForTimeout(350);
await shot('04-shut-hinge');
await warp(AX(-1.9), AZI(3.5), at(1.8, 0), 0.0); await page.waitForTimeout(350);
await shot('05-shut-square');

// ── 3. open it again ───────────────────────────────────────────────────────
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(400);
await press();
expect('re-opened, doorway clear', await shut(), false);
await shot('06-open-again');
await warp(AX(-1.9), AZI(3.5), at(1.8, 0), 0.0); await page.waitForTimeout(350);
await shot('07-open-square');

// ── 4. the swept volume: stand where the leaf would hit you ────────────────
// This has to be a point that is BOTH inside the arc and inside the spot's
// own radius, or the test proves nothing: the first version stood 1.45 m from
// the spot, E did not reach it at all, and "the door refused to close" was
// really "there was no interaction there". Walk in from the spot toward the
// pivot until 0.9 of the way and you are 0.65 m off the hinge, squarely in
// the swing, and still in range.
const ux = (PIV[0] - SPOT[0]) / Math.hypot(PIV[0] - SPOT[0], PIV[1] - SPOT[1]);
const uz = (PIV[1] - SPOT[1]) / Math.hypot(PIV[0] - SPOT[0], PIV[1] - SPOT[1]);
const IN = [SPOT[0] + ux * 0.9, SPOT[1] + uz * 0.9];
say(`  test point is ${Math.hypot(IN[0] - SPOT[0], IN[1] - SPOT[1]).toFixed(2)} m from the spot (r 0.95)`
  + ` and ${Math.hypot(IN[0] - PIV[0], IN[1] - PIV[1]).toFixed(2)} m from the pivot (leaf 0.91)`);
await warp(IN[0], IN[1], at(PIV[0] - IN[0], PIV[1] - IN[1]), 0.0);
await page.waitForTimeout(400);
expect('standing in the swing, prompt refuses', await prompt(), '[E] step clear of the door');
await shot('08-in-the-swing');
await press();
expect('E from inside the swing does nothing', await shut(), false);

// back at the spot: outside the arc, must work
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(400);
expect('a pace back, prompt offers close', await prompt(), '[E] close the door');
await press();
expect('E from a pace back shuts it', await shut(), true);
await shot('09-shut-from-back');

// ── 5. the poster ──────────────────────────────────────────────────────────
await page.evaluate(() => window.__ct.warp(200 - 1.05, -20 + 3.55, 0.03, 5.4, 0.0));
await page.waitForTimeout(350);
await shot('10-poster-across');
await page.evaluate(() => window.__ct.warp(200 - 1.05, -20 + 2.75, 0.03, 5.4, 0.0));
await page.waitForTimeout(350);
await shot('11-poster-close');

await browser.close();
console.log(`door301 -> ${outDir}`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); FAIL.push('page errors'); }
if (FAIL.length) {
  console.error(`\nFAILED (${FAIL.length}):`);
  for (const f of FAIL) console.error(`  ${f}`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the jammed door was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the doorway was blocked and this did not notice.'); process.exit(2); }
console.log('all seven behaviours hold: opens, shuts, blocks, refuses to shut on you.');

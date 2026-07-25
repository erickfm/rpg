// Can a pedestrian get into the lot, and does the fence stop them everywhere
// else? Walks the rig east off the pavement across the frontage and reports
// how far it gets. The collider list alone cannot answer this — a gap in the
// fence is worth nothing if a blanket box is lying across it.
//
// IT ASKS WHERE THE LOT IS. The z values used to be a typed list, which was
// right when written and would have gone on passing after the lot moved — and
// this lot HAS moved, more than once, as D reordered the roster. A hardcoded
// coordinate is a check that quietly starts testing empty pavement. The span
// comes from ct/lot.ts's own `userData.mod` stamps, so the walk follows the
// building.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lotwalk.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
// --selftest: wall the mouth shut in the LIVE collider list and require this
// to go red. The mutation is a push onto __ct.colliders(), which is the same
// array the movement code tests, so it is the real thing being broken.
const SELFTEST = process.argv.includes('--selftest');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.mouse.click(640, 360); await p.waitForTimeout(500);

// Where is the lot? Read it off its own meshes rather than remembering it.
const span = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let z0 = 1e9, z1 = -1e9;
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]);
  });
  return z0 > z1 ? null : [z0, z1];
});
if (!span) { console.error('no meshes stamped `lot` — is the lot in this world at all?'); process.exit(1); }
console.log(`lot frontage z ${span[0].toFixed(1)} … ${span[1].toFixed(1)}, from its own stamps`);

// Sample across the frontage and a little past each end, so "the fence stops
// you" is tested outside the lot as well as along it.
const STEP = 1.0;
const ZS = [];
for (let z = span[0] - 2; z <= span[1] + 2; z += STEP) ZS.push(+z.toFixed(2));

if (SELFTEST) {
  const n = await p.evaluate(([z0, z1]) => {
    window.__ct.colliders().push({ minX: 6.9, maxX: 7.4, minZ: z0, maxZ: z1 });
    return 1;
  }, span);
  console.log(`selftest: walled the frontage shut (${n} collider) — this MUST now go red`);
}

// FACE is 7; the walk is west of it. Start on the pavement and hold W facing east.
const start = 5.6;
const RESULT = [];
for (const z of ZS) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0.14, 0), [start, z]);
  await p.waitForTimeout(250);
  await p.keyboard.down('w');
  await p.waitForTimeout(2600);
  await p.keyboard.up('w');
  await p.waitForTimeout(200);
  const [x2, , z2] = await p.evaluate(() => window.__ct.pos());
  const got = x2 - start;
  const inside = got > 3;
  RESULT.push([z, inside]);
  console.log(`z=${String(z).padStart(5)}  walked ${got.toFixed(2)} m east -> x=${x2.toFixed(2)} z=${z2.toFixed(2)}  ${inside ? 'IN' : 'blocked'}`);
}
await b.close();

// ── the verdict ───────────────────────────────────────────────────────────
// This used to print IN/blocked and exit 0 whatever it found, which made ME
// the assertion: every round I ran it and counted the lines by hand. A report
// that a human has to read is not a check — wall the mouth and it would have
// gone on being green.
//
// Two things have to hold, and they are different failures:
//   1. you can get IN somewhere        — or the lot is sealed
//   2. you are stopped at both ENDS    — or the fence is not doing anything
const ins = RESULT.filter((r) => r[1]);
const ends = [RESULT[0], RESULT[RESULT.length - 1]];
const fail = [];
if (!ins.length) fail.push('no opening at all — the lot cannot be entered');
if (ends.some((r) => r[1])) fail.push('walked in past the END of the frontage — the fence stops short');
if (ins.length && ins.length === RESULT.length) fail.push('every sample got in — there is no fence');
if (fail.length) {
  console.error(`\nFAILED:`);
  for (const f of fail) console.error(`  ${f}`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the sealed mouth was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the frontage was walled shut and this did not notice.'); process.exit(2); }
console.log(`\nopening at z ${ins[0][0]} … ${ins[ins.length - 1][0]}, ${ins.length} of ${RESULT.length} samples;`);
console.log(`stopped at both ends and everywhere else — the fence holds.`);

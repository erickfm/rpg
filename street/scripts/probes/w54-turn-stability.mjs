// HOW OFTEN DOES THE PROMPT CHANGE WHEN ONLY YOUR HEAD MOVES?
//
// Item 140: *"still feels weird to look around at the door frame to my room …
// its just from looking around."* The metric that matches those words is not a
// timing and not a screenshot — it is a COUNT: standing still at one cell, how
// many DIFFERENT prompts does a full 360-degree turn hand you?
//
// One is perfect. Two is a room with two things in it. Three or more, from a
// standing start, is the complaint.
//
// Reported over a grid of standable cells in flat 301 so a fix can be shown to
// help everywhere in the room rather than at the one cell it was tuned on.
// Counts transfer across hardware; frame times do not.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w54-turn-stability.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4185/');
const STEP = Number(process.env.YAW_STEP ?? 15);     // degrees between samples

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(700);

// same standability test as w40-301-grid.mjs — same floor, not inside a collider
const standable = (x, z) => p.evaluate(([x, z, gy]) => {
  if (Math.abs(window.__ct.groundAt(x, z) - gy) > 0.05) return false;
  return !window.__ct.staticColliders().some((c) =>
    x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3);
}, [x, z, gy]);

const tag = (s) => (s == null ? '·' : /sit on the bed/i.test(s) ? 'B'
  : /close the door/i.test(s) ? 'D' : /sleep until/i.test(s) ? 'S' : '?');

// HOW MANY SPOTS IS THIS CELL TOUCHING? A cell touching NOTHING has only
// aimed-at candidates, so its prompt SHOULD follow the crosshair and a high
// change count there is the resolver working, not the complaint. Reported so
// the difference is evidenced rather than argued. `TOUCH_MARGIN` comes off the
// world, never retyped — and it is READ FROM `__ct` rather than imported
// (item 232). `await import('/src/proto/fp.ts')` resolves on the dev server and
// **404s on `vite preview`**, which serves `dist/`; GOTCHAS 28 makes the bundle
// the thing that must be believed. Published at `crosstown.ts:1629`.
const fp = await p.evaluate(() => ({ TOUCH_MARGIN: window.__ct.touchMargin() }));
if (typeof fp.TOUCH_MARGIN !== 'number' || !isFinite(fp.TOUCH_MARGIN)) {
  console.error(`ABORT: touchMargin did not resolve off __ct — ${JSON.stringify(fp)}`);
  await b.close(); process.exit(3);
}
const allSpots = await p.evaluate(() =>
  window.__ct.spots().filter((s) => s.ok && s.x > 190 && s.x < 210 && s.z > -22 && s.z < -10));
const touchCount = (x, z) =>
  allSpots.filter((s) => Math.hypot(s.x - x, s.z - z) < s.r + fp.TOUCH_MARGIN).length;

const X0 = 197.4, X1 = 200.0, Z0 = -18.2, Z1 = -14.0, GSTEP = 0.4;
const rows = [];
let cells = 0, sum = 0, worst = 0, unstable = 0;
const worstCells = [];

for (let z = Z0; z <= Z1 + 1e-9; z += GSTEP) {
  let row = `z${z.toFixed(1).padStart(6)}  `;
  for (let x = X0; x <= X1 + 1e-9; x += GSTEP) {
    if (!(await standable(x, z))) { row += ' #'; continue; }
    const seen = [];
    for (let deg = 0; deg < 360; deg += STEP) {
      await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
        [x, z, (deg * Math.PI) / 180, gy]);
      await p.waitForTimeout(80);
      seen.push(await prompt());
    }
    // RUNS AROUND THE CIRCLE, not distinct labels: the player feels each
    // CHANGE, so A…A…B…B counts once but A…B…A…B counts twice.
    let runs = 0;
    for (let i = 0; i < seen.length; i++) if (seen[i] !== seen[(i - 1 + seen.length) % seen.length]) runs++;
    if (runs === 0) runs = 1;                       // never changed: one run
    cells++; sum += runs; worst = Math.max(worst, runs);
    if (runs >= 3) {
      unstable++;
      worstCells.push({ x, z, runs, touching: touchCount(x, z),
        seen: [...new Set(seen)].map(tag).join('') });
    }
    row += ' ' + (runs > 9 ? '+' : String(runs));
  }
  rows.push(row);
}

const hdr = '        ' + Array.from({ length: Math.round((X1 - X0) / GSTEP) + 1 },
  (_, i) => (X0 + i * GSTEP).toFixed(1).slice(-1)).join(' ');
console.log(`\nPROMPT CHANGES PER FULL 360° TURN, standing still  (yaw step ${STEP}°)`);
console.log('# = not standable.  1 = perfectly stable.  >=3 = the complaint.');
console.log(hdr);
for (const r of rows) console.log(r);

console.log(`\ncells measured            ${cells}`);
console.log(`mean changes per turn     ${(sum / cells).toFixed(2)}`);
console.log(`worst cell                ${worst}`);
console.log(`cells with >= 3 changes   ${unstable}  (${((unstable / cells) * 100).toFixed(0)}%)`);
for (const c of worstCells) {
  console.log(`   (${c.x.toFixed(1)}, ${c.z.toFixed(1)})  ${c.runs} changes   touching ${c.touching} spot(s)`
    + `${c.touching === 0 ? '  <- touches NOTHING, so aim SHOULD decide' : ''}   spots seen: ${c.seen}`);
}
await b.close();

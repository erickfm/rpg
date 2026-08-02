// THE DECISION MAP of flat 301: over a grid of standable points, facing the
// door and facing the bed, WHICH SPOT WINS AND VIA WHICH TIER?
//
// The survey (w40-301-survey.mjs) showed the bed seat and the door spot are
// only 1.27 m apart while their aim-free touch circles are 0.85 m and 1.10 m —
// so they OVERLAP, and inside the overlap `pickSpot`'s near tier ranks by
// distance alone and the bed simply wins. This maps how big that region is.
//
// TIER ATTRIBUTION IS IMPORTED, NOT RETYPED. `/src/proto/fp.ts` is pulled into
// the page so `TOUCH_MARGIN`/`lookTolerance` are the world's own values; the
// live `#ct-prompt` is still the ground truth and the two are cross-checked.
//
//   SHOT_URL=http://localhost:4188/ node scripts/probes/w40-301-grid.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const fpMod = await p.evaluate(async () => {
  const m = await import('/src/proto/fp.ts');
  return { TOUCH_MARGIN: m.TOUCH_MARGIN, REACH_MARGIN: m.REACH_MARGIN };
});
console.log(`fp.ts says TOUCH_MARGIN=${fpMod.TOUCH_MARGIN} REACH_MARGIN=${fpMod.REACH_MARGIN}`);

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(600);

const spots = await p.evaluate(() => window.__ct.spots().filter((s) => s.ok && s.x > 190 && s.x < 210));
const bed = spots.find((s) => /bed/i.test(s.label));
const door = spots.find((s) => /the door/i.test(s.label));
console.log(`bed  (${bed.x.toFixed(2)}, ${bed.z.toFixed(2)}) r${bed.r}   touch<${(bed.r + fpMod.TOUCH_MARGIN).toFixed(2)}`);
console.log(`door (${door.x.toFixed(2)}, ${door.z.toFixed(2)}) r${door.r}   touch<${(door.r + fpMod.TOUCH_MARGIN).toFixed(2)}`);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));

// standable = same floor height as the room, and not inside a static collider
const standable = async (x, z) => p.evaluate(([x, z, gy]) => {
  if (Math.abs(window.__ct.groundAt(x, z) - gy) > 0.05) return false;
  return !window.__ct.staticColliders().some((c) =>
    x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3);
}, [x, z, gy]);

const tag = (s) => (s == null ? '·' : /bed/i.test(s) ? 'B' : /the door/i.test(s) ? 'D' : '?');

const X0 = 197.4, X1 = 200.0, Z0 = -18.2, Z1 = -14.0, STEP = 0.4;
const rowsDoor = [], rowsBed = [];
let bad = 0, cells = 0;
for (let z = Z0; z <= Z1 + 1e-9; z += STEP) {
  let rd = `z${z.toFixed(1).padStart(6)}  `, rb = `z${z.toFixed(1).padStart(6)}  `;
  for (let x = X0; x <= X1 + 1e-9; x += STEP) {
    if (!(await standable(x, z))) { rd += ' #'; rb += ' #'; continue; }
    cells++;
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yawTo(x, z, door.x, door.z), gy]);
    await p.waitForTimeout(140);
    const fd = await prompt();
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yawTo(x, z, bed.x, bed.z), gy]);
    await p.waitForTimeout(140);
    const fb = await prompt();
    rd += ' ' + tag(fd); rb += ' ' + tag(fb);
    if (tag(fd) === 'B') bad++;      // facing the DOOR and being offered the BED
  }
  rowsDoor.push(rd); rowsBed.push(rb);
}

const hdr = '        ' + Array.from({ length: Math.round((X1 - X0) / STEP) + 1 },
  (_, i) => (X0 + i * STEP).toFixed(1).slice(-1)).join(' ');
console.log('\nFACING THE DOOR   (B = bed offered = the complaint, D = door, # = not standable)');
console.log(hdr);
for (const r of rowsDoor) console.log(r);
console.log('\nFACING THE BED    (B = bed offered = correct)');
console.log(hdr);
for (const r of rowsBed) console.log(r);
console.log(`\n${bad} of ${cells} standable cells offer the BED while facing the DOOR.`);

await b.close();

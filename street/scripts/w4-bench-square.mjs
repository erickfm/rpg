// w4 — item 5e, "these park benches are askew. they should be in line with
// the path."
//
// `E-benchface.mjs` already asserts the LOOSE property (does the sitter face
// roughly toward the park, dot > 0.30) and I am not touching or duplicating
// it — read first, per GOTCHAS 24. That check is loose ON PURPOSE and would
// pass even on the old radial-bearing bug, because "askew" is a much finer
// effect than "facing the wrong half of the world."
//
// This asserts the actual complaint: every perimeter bench's yaw is SQUARE TO
// ITS OWN LEG. The park's loop is an axis-aligned rectangle (chamfers carry
// no benches), so "square to the run" means the seat yaw is an exact multiple
// of PI/2 — not "close to a multiple", which the old
// atan2(loopCx-bx, loopCz-bz) bearing-to-a-point formula would also produce
// AT the midpoint of a leg, but drifted away from everywhere else. Checking
// every bench, not just one, is the point (GOTCHAS 41: verify every instance,
// not the one that happens to be right).
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 520 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const CX = (-32.5 + -13.25) / 2, CZ = (-92 + -74) / 2;
const seats = (await page.evaluate(() => window.__ct.seats()))
  .filter((s) => s.pose.x > -39 && s.pose.x < -7 && s.pose.z < -67 && s.pose.z > -99)
  .filter((s) => s.label === 'sit on the bench');

if (seats.length < 8) {
  console.error(`CANNOT ANSWER — only found ${seats.length} park benches, expected at least 8 (GOTCHAS 34: an empty/tiny population proves nothing)`);
  process.exit(3);
}

// axis-aligned within float slop from atan2, not "close to square" — a
// mutation that reintroduces even a small radial component off the midpoint
// must fail this
const AXIS_TOL = 1e-6;
let bad = 0;
for (const [i, s] of seats.entries()) {
  const yaw = s.pose.yaw;
  const onMound = Math.hypot(s.pose.x + 21.5, s.pose.z + 84.2) < 1.2;
  if (onMound) { console.log(`SKIP  bench ${i + 1} — the mound bench is a documented exception, faces the gate, not a leg`); continue; }
  // square to an axis-aligned leg <=> sin or cos of yaw is exactly 0
  const s2 = Math.sin(yaw), c2 = Math.cos(yaw);
  const axisAligned = Math.abs(s2) < AXIS_TOL || Math.abs(c2) < AXIS_TOL;
  if (!axisAligned) bad++;
  console.log(`${axisAligned ? 'PASS' : 'FAIL'}  bench ${i + 1} at ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)}  yaw ${yaw.toFixed(4)}  sin ${s2.toFixed(4)} cos ${c2.toFixed(4)}`);
}
console.log(bad ? `\n${bad} bench(es) are askew to their own leg` : `\nall perimeter benches are square to their leg`);
await b.close();
process.exit(bad ? 1 : 0);

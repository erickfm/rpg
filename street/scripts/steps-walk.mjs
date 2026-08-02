// Walk UP the civic steps and back DOWN.
//
// GOTCHAS §7: floor height comes from a picker, never from colliders, and the
// picker has hysteresis. E's note on COURT.climbable says the drawn steps ride
// within half a riser of the flight's gradient, so a wrong dispatch order in
// the picker either sinks you into the stone or stops you climbing — and both
// look like "the steps do not work".
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4185/'));   // GOTCHAS 26: prove it, do not just name it
const pos = () => p.evaluate(() => window.__ct.pos());
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(80); };

// The library forecourt is paved at 0.14 with a flight rising west to a 0.99
// landing at the doors; the churchyard has its own. Probed through the RIG,
// not by importing ct/civic.ts — a dynamic import in the page gets a second
// module instance with COURT still at its defaults, which reads as "there are
// no steps" and is a very convincing lie.
// ASK THE PICKER, do not warp and read the rig back.
//
// This warped to (x, z), waited 25 ms and returned `pos()[3]` — the rig's gy,
// which is a SHARED last-written value with several writers, the citizens among
// them. 9e59be123 found E-yard-walk deciding whether to run its climb from that
// same reading and SKIPPING the whole flight when it came back low, reporting
// "all walks passed" having tested nothing.
//
// It also explains a "dev/bundle ground discrepancy" I reported and routed to E
// two commits ago: the library kerb read 0.14 in dev and 0.00 in the bundle.
// That was this probe, not the world. `groundAt` is the same pick the rig uses
// and nothing else writes it, so it needs no settling time and no warp — which
// also means this no longer MOVES THE PLAYER to ask where the floor is.
const gyAt = async (x, z) =>
  p.evaluate(([x, z]) => window.__ct.groundAt(x, z) ?? 0, [x, z]);

// --selftest: block the middle of every flight in the LIVE collider array and
// require this to go red. The ground picker is untouched, so the "no rise"
// assertion still passes and only the WALK fails — which is the right shape:
// this check exists because a flight can report a 0.99 m landing and still not
// be climbable, and that is exactly the half being proven here.
// Unknown flags are REFUSED, not ignored — a mistyped `--selftest` would
// otherwise run the ordinary suite and exit 0, reporting a selftest pass for
// a selftest that never ran (GOTCHAS 34 shape one).
const SELFTEST = flags(['--selftest']).selftest;

const fails = [];
const FLIGHTS = [
  { nm: 'library', z: -13.5, fromX: -6.0, toX: -11.5, yawUp: -Math.PI / 2 },
  // ST BRIGID moved onto the main block: east side, z -68…-86, its forecourt
  // reached from the pavement walking +x. Same flight, same picker.
  { nm: 'church', z: -79.5, fromX: 6.5, toX: 9.4, yawUp: Math.PI / 2 },
];
if (SELFTEST) {
  for (const f of FLIGHTS) {
    const mid = (f.fromX + f.toX) / 2;
    await p.evaluate(([mx, z]) => window.__ct.colliders().push({
      minX: mx - 0.6, maxX: mx + 0.6, minZ: z - 3, maxZ: z + 3 }), [mid, f.z]);
  }
  console.log('selftest: walled the middle of both flights — this MUST now go red');
}

for (const f of FLIGHTS) {
  const bottom = await gyAt(f.fromX, f.z);
  // find the top by scanning, not by trusting a hand-typed x. The church's
  // yard ends before the number I first guessed and the sample past it reads
  // 0.00 — which looks exactly like "the flight is flat".
  let top = bottom, topX = f.fromX;
  const dir = Math.sign(f.toX - f.fromX);
  for (let x = f.fromX; dir > 0 ? x <= f.toX : x >= f.toX; x += dir * 0.2) {
    const g = await gyAt(x, f.z);
    if (g > top) { top = g; topX = x; }
  }
  console.log(`${f.nm}: highest tread at x=${topX.toFixed(1)}`);
  console.log(`${f.nm}: paving ${bottom.toFixed(2)} at the kerb, ${top.toFixed(2)} at the doors`);
  if (top - bottom < 0.3) { fails.push(`${f.nm}: the picker gives no rise — the flight is flat`); continue; }

  // CLIMB it, on foot
  // ASK where the foot of the flight is; do not remember 0.14. This script's
  // whole subject is ground that VARIES, so hard-coding the height it starts
  // from is the one number it least ought to assume — and a pinned run of this
  // file has already printed "paving 0.00 at the kerb" where I expected 0.14.
  // 716b21d13 made the same fix elsewhere: groundAt is the pick the rig uses.
  await p.evaluate(([x, z, yaw]) =>
    window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [f.fromX, f.z, f.yawUp]);
  await p.waitForTimeout(250);
  const a = await pos();
  await hold('w', 3000);
  const up = await pos();
  console.log(`${f.nm}: walked ${Math.abs(up[0] - a[0]).toFixed(2)} m up, gy ${a[3].toFixed(2)} -> ${up[3].toFixed(2)}`);
  if (up[3] - a[3] < 0.3) fails.push(`${f.nm}: walking at the steps gained only ${(up[3] - a[3]).toFixed(2)} m — you cannot climb them`);
  if (Math.abs(up[0] - a[0]) < 2.0) fails.push(`${f.nm}: only got ${Math.abs(up[0] - a[0]).toFixed(2)} m up the flight before stopping`);

  // and back DOWN, to the level you started on — the hysteresis test
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0), [up[0], up[2], f.yawUp + Math.PI]);
  await p.waitForTimeout(200);
  // just far enough to reach the bottom of the flight. Walking 3 s carries you
  // across the pavement and into the ROAD, where gy is legitimately 0 — which
  // reads as "you came down to the wrong level" and is the test overshooting.
  await hold('w', 1900);
  const dn = await pos();
  console.log(`${f.nm}: walked back down, gy ${up[3].toFixed(2)} -> ${dn[3].toFixed(2)}`);
  if (Math.abs(dn[3] - a[3]) > 0.06) fails.push(`${f.nm}: came down to ${dn[3].toFixed(2)}, not the ${a[3].toFixed(2)} you left`);

  // …and you are not sunk INTO the stone anywhere on the way up
  for (let t = 0; t <= 1; t += 0.2) {
    const x = f.fromX + (f.toX - f.fromX) * t;
    const g = await gyAt(x, f.z);
    if (g < bottom - 0.01) fails.push(`${f.nm}: the floor drops to ${g.toFixed(2)} at x=${x.toFixed(1)}, below the paving`);
  }
}
console.log('');
for (const x of fails) console.log(`  FAIL  ${x}`);
console.log(fails.length ? `${fails.length} problem(s)` : 'the steps climb and descend, and nothing sinks');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

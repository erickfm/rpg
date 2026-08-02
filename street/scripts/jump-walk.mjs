// Jump, and land on the storey you were on.
//
// The floor picker in ct/apartment.ts has hysteresis (GOTCHAS §7) — it is the
// only thing that knows which of four stacked storeys you are on, and a jump
// that carries you higher can hand it a height it reads as the floor above.
// So this is not "does the jump feel right", which is the user's call; it is
// "does the jump still put you back where you started" everywhere the ground
// changes height.
//
// ── THIS FILE SPENT ITS WHOLE LIFE NOT TESTING ITS OWN SUBJECT ────────────
//
// Its three "storey" spots were at (104, -16), (112, -16) and (120, -16),
// labelled *inside, ground floor* / *the apartment stairs* / *upstairs*. THE
// WALK-UP IS AT x = 200. Nothing stands at x 104-120; it is open ground between
// the street and the interior slab belt, and all three sampled the SAME height,
// so three spots named for three different storeys were one storey repeated.
//
// And the two whose storey was written `null` — meaning *leave the picker
// alone, that is the case under test* — were passed through `warp(x, z, gy ?? 0)`,
// which turns `null` into `setGy(0)`. So "upstairs" was pinned to storey 0
// before the jump it was supposed to measure. The picker this file is NAMED for
// has never once been exercised.
//
// What it does now, and why it is a walk and not a warp: the ground floor, the
// ramp and floor three are REACHED BY HOLDING W FROM THE LOBBY. A storey you
// warped onto proves the warp works. The ramp position in particular cannot be
// written down at all — it is wherever the climb had got to — which is exactly
// the property that makes it a real test of the picker.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4185/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);   // GOTCHAS 26: prove it, do not just name it

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const groundAt = (x, z) => p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
// STOREY IS OPTIONAL AND `null` MEANS LEAVE IT ALONE. `crosstown.ts`'s warp is
// `(x, z, yaw?, gy?, pitch?)` and only calls `setGy` when `gy !== undefined`,
// so the null case has to reach it as a MISSING argument. The old helper wrote
// `gy ?? 0` and collapsed every one of them onto the ground floor.
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => (
  gy === null || gy === undefined
    ? window.__ct.warp(x, z, yaw)
    : window.__ct.warp(x, z, yaw, gy, 0)
), [x, z, yaw, gy ?? null]);
const jump = async () => { await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' '); };

const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };

// ── the walk-up's frame, DERIVED from what the world publishes ────────────
// `ct/apartment.ts:114-119` builds SPAWN as
// `{ x: APT_X0 - 1.4, z: APT_Z0 + 3.7, gy: 2 * ST0 }` and the module publishes
// it on `scene.userData.spawn` precisely so a check can read it from a preview.
// Reading it back is how this file learns where the building is without a
// second copy of three coordinates that have already moved once.
const spawn = await p.evaluate(() => window.__ct.scene()?.userData?.spawn ?? null);
if (!spawn || !isFinite(spawn.x) || !isFinite(spawn.gy)) {
  console.error('ABORT: the world publishes no scene.userData.spawn — the walk-up'
    + ' cannot be located, and every storey verdict below would be free.');
  await b.close(); process.exit(3);                           // GOTCHAS §32
}
const APT_X = spawn.x + 1.4, APT_Z = spawn.z - 3.7, ST = spawn.gy / 2;
const AX = (lx) => APT_X + lx, AZ = (lz) => APT_Z + lz;
console.log(`walk-up at (${APT_X}, ${APT_Z}), storey ${ST} m — derived from the published spawn\n`);

// ── the outdoor spots: the kerb, the road, the stoop ──────────────────────
// These always worked and they are the control: if the jump itself regressed,
// these go red too and the storey rows below are not the story.
const spots = [
  ['the pavement', -6.0, -20.0, 0.14],
  ['the kerb edge', -5.1, -20.0, 0.14],
  ['the road', -2.0, -20.0, 0],
  ['the walk-up stoop', 6.2, -44.0, 0.14],
];

// what a jump does from wherever the player is standing right now
const jumpHere = async (what) => {
  const before = await pos();
  // THE REST HEIGHT IS MEASURED, not reconstructed. This read `apex - (gy + 1.62)`,
  // and 1.62 was a hand-typed copy of the rig's eye height (BUILDER-BRIEF §8).
  // `camY()` at rest already IS that number plus the storey, so the subtraction
  // needs no constant and cannot drift if the eye ever moves.
  //
  // NOT `pos()[1]`, which was my first attempt and is wrong: it is the rig's
  // height WITHIN its storey and does not include `gy`, so upstairs it read the
  // 5.4 m of building as a 5.875 m hop. Caught by the check going red on two
  // rows whose jump was fine — measure the instrument too.
  const eye0 = await camY();
  await jump();
  let apex = 0;
  for (let t = 0; t < 900; t += 30) { await p.waitForTimeout(30); apex = Math.max(apex, await camY()); }
  await p.waitForTimeout(700);
  const after = await pos();
  const rise = apex - eye0;
  const sameFloor = Math.abs(after[3] - before[3]) < 0.001;
  console.log(`${what.padEnd(24)} gy ${before[3].toFixed(2)} -> ${after[3].toFixed(2)}  apex +${rise.toFixed(3)} m  ${sameFloor ? 'same floor' : 'CHANGED FLOOR'}`);
  if (!sameFloor) fails.push(`${what}: jumping changed the floor from ${before[3].toFixed(2)} to ${after[3].toFixed(2)}`);
  if (rise < 0.45 || rise > 0.8) fails.push(`${what}: apex ${rise.toFixed(3)} m is outside the intended 0.6 m hop`);
  return { before, after, rise };
};

for (const [what, x, z, gy] of spots) {
  await warp(x, z, 0, gy);
  await p.waitForTimeout(350);
  await jumpHere(what);
}

// ── THE WALK-UP, ON FOOT ──────────────────────────────────────────────────
console.log('\n── the stacked storeys, reached by walking ──');

// 1. THE LOBBY. Storey 0 is stated, because you have to tell the picker which
//    of four stacked floors you arrived on — that is the one thing a warp into
//    this building legitimately must say. Everything after it is walked.
const LOBBY = [AX(0.6), AZ(6.0)];
await warp(LOBBY[0], LOBBY[1], Math.PI, 0);     // yaw PI faces +z, up the shaft
await p.waitForTimeout(450);
{
  const q = await pos();
  ok(Math.abs(q[3]) < 0.01, `the lobby is storey 0 — gy ${q[3].toFixed(2)}`);
  const g = await groundAt(LOBBY[0], LOBBY[1]);
  ok(Math.abs(g) < 0.01, `and groundAt agrees it is the ground floor — ${g.toFixed(2)}`);
  // IN THE BUILDING, not on open ground three hundred metres away, which is the
  // whole defect this file is being repaired for. The shaft is inside the
  // walk-up's footprint; assert the distance from the building's own origin.
  ok(Math.hypot(LOBBY[0] - APT_X, LOBBY[1] - APT_Z) < 12,
    `and it is inside the walk-up, ${Math.hypot(LOBBY[0] - APT_X, LOBBY[1] - APT_Z).toFixed(1)} m from its origin`);
}
await jumpHere('inside, ground floor');

// 2. WALK UP FLIGHT A. Hold W and watch the picker carry you up the ramp. Stop
//    the moment the storey is strictly between floors — that is the position
//    that cannot be written down, and the one the ramp exists to produce.
await warp(LOBBY[0], LOBBY[1], Math.PI, 0);
await p.waitForTimeout(400);
const climb = [];
await p.keyboard.down('w');
let onRamp = null;
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(150);
  const q = await pos();
  climb.push(+q[3].toFixed(2));
  if (onRamp === null && q[3] > 0.25 && q[3] < ST - 0.2) onRamp = q;
  if (q[3] >= 1.35 - 0.01) break;
}
await p.keyboard.up('w');
await p.waitForTimeout(300);
const top = await pos();
console.log(`  climbed: gy ${climb.filter((v, i, a) => i === 0 || v !== a[i - 1]).join(' -> ')}`);
ok(climb.some((v) => v > 0), 'holding W from the lobby CLIMBS — the storey picker follows the ramp');
ok(onRamp !== null, 'and it passes through heights that are BETWEEN storeys, so the ramp is a ramp');
ok(Math.abs(top[3] - 1.35) < 0.05, `and the half landing is reached on foot — gy ${top[3].toFixed(2)}`);

// 3. THE NULL-STOREY CASE, which is the bug this file shipped. Warp to where
//    the climb actually left us, WITHOUT naming a storey. The picker must keep
//    the storey it had; `gy ?? 0` used to slam it to the ground floor, three
//    floors down, and nothing noticed because no spot here was ever on a
//    storey other than 0 to begin with.
{
  const q = await pos();
  await warp(q[0], q[2], Math.PI, null);
  await p.waitForTimeout(350);
  const after = await pos();
  ok(Math.abs(after[3] - q[3]) < 0.001,
    `warping with a NULL storey leaves the storey alone — ${q[3].toFixed(2)} stayed ${after[3].toFixed(2)}`);
  ok(after[3] > 0.01, `and it is genuinely not the ground floor — gy ${after[3].toFixed(2)}`);
}

// 4. ON THE RAMP ITSELF. Walk back down to a height between floors and jump
//    there: a jump from a sloped floor is the case the hysteresis is for.
await warp(LOBBY[0], LOBBY[1], Math.PI, 0);
await p.waitForTimeout(400);
await p.keyboard.down('w');
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(120);
  const q = await pos();
  if (q[3] > 0.3 && q[3] < ST - 0.4) break;
}
await p.keyboard.up('w');
await p.waitForTimeout(400);
{
  const q = await pos();
  ok(q[3] > 0.01 && q[3] < ST, `standing on the stairs, between storeys — gy ${q[3].toFixed(2)}`);
  const g = await groundAt(q[0], q[2]);
  ok(g > 0.01, `and groundAt is NON-ZERO there — ${g.toFixed(2)}`);
}
await jumpHere('the apartment stairs');

// 5. UPSTAIRS. The published spawn is floor 3 inside 301 — the one upper-storey
//    position the world itself vouches for, and the one `scripts/door301.mjs`
//    already asserts stays standable. Storey named, because arriving on a
//    stacked floor is the case where naming it is correct.
await warp(spawn.x, spawn.z, spawn.yaw, spawn.gy);
await p.waitForTimeout(500);
{
  const q = await pos();
  ok(Math.abs(q[3] - 2 * ST) < 0.01, `upstairs is storey ${(2 * ST).toFixed(2)} — gy ${q[3].toFixed(2)}`);
  const g = await groundAt(spawn.x, spawn.z);
  ok(g > 0.01, `and groundAt is NON-ZERO up there — ${g.toFixed(2)}, not the 0.00 the old spots read`);
}
await jumpHere('upstairs');

console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\njump lands you on the floor you left, everywhere');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

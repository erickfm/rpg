// Builder E: WALK the park. Site x -14…-7, z -98…-68; gate z -87.2…-78.8.
// Every leg retries — citizens are solid and seeded (see E-walk.mjs).
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4182/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4182/');   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 20));
const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy = 0.14) => page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const f = (n) => n.toFixed(2);
// THE FLOOR AT A POINT, asked directly. `window.__ct.groundAt(x, z)` runs the
// world's own picker for an arbitrary point and returns the answer.
//
// What this replaces, and why it matters more than a tidy-up: every floor
// reading in my harnesses used to TELEPORT THE PLAYER there and read
// `pos()[3]`. That is `apt.gy()` — a last-written value with more than one
// writer, and the citizens on the pavement write it too. So the reading you get
// is whoever queried the picker last, which is usually not you.
//
// It cost a real diagnosis. `E-walk` decides which half of its checks to run by
// probing the library landing: 0.99 means the flight is wired and climbs, 0.14
// means it is still one solid block. The probe read 0.14 three times running on
// a world where `groundAt` says 0.99, so the harness ran the un-wired half and
// reported two reds for the world being CORRECT — and every green run before
// that was green for having asserted a world that had not existed for hours.
// A median of three does not save you from this: it is not noise, it is a
// different question being answered.
const gyAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);

let fails = 0;
const report = (n, ok, d, t = 1) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}${t > 1 ? `  [${t} tries]` : ''}`); };
const walk = async (n, { at, yaw, ms, ok, say }) => {
  let last, t = 0;
  for (; t < 3; t++) {
    if (t) await page.waitForTimeout(1100);
    await warp(at[0], at[1], yaw); await page.waitForTimeout(150);
    await page.keyboard.down('w'); await page.waitForTimeout(ms); await page.keyboard.up('w');
    await page.waitForTimeout(60);
    last = await pos();
    if (ok(last)) break;
  }
  report(n, ok(last), say(last), t + 1);
  return last;
};
const W = -Math.PI / 2;
// in through the gate, and out again
const inPark = await walk('in through the gate', {
  at: [-5.6, -83.0], yaw: W, ms: 2200,
  ok: (p) => p[0] < -11.5, say: (p) => `x -5.60 -> ${f(p[0])} (the site runs back to x -39)`,
});
report('…and the spur reaches the circuit', inPark[0] < -11.5,
  `stopped at x ${f(inPark[0])}; the street leg is at -13.25`);
await page.keyboard.down('s'); await page.waitForTimeout(2200); await page.keyboard.up('s');
await page.waitForTimeout(60);
report('back out to the pavement', (await pos())[0] > -6.5, `x -> ${f((await pos())[0])}`);
// the fence holds either side of the gate
for (const [n, z] of [['north of the gate', -75.0], ['south of the gate', -92.0]]) {
  await walk(`the boundary holds ${n}`, {
    at: [-5.7, z], yaw: W, ms: 1400,
    ok: (p) => p[0] < -6.1 && p[0] > -6.9,
    say: (p) => `stopped at x ${f(p[0])} against the boundary`,
  });
}
// THE LOOP. Each leg is walked from its own corner to the next one, which is
// what proves the circuit is clear — a single timed lap just tells you how
// fast you were going. Legs: street x=-8.15, back x=-12.5, ends z=-96.3/-69.7.
// THE WHOLE CIRCUIT. F moved bounds.minX to -40, so the loop closes on foot
// for the first time — 27 m legs, not 6 m of them. Each leg is walked from
// its own corner to the next, which is what proves the circuit rather than
// how fast you were going.
// The loop was brought 6 m in off the boundary so it reads as a circuit
// rather than as a path along the railings, and its corners are chamfered.
// Legs: back x -32.5, street x -13.25, ends z -92.0 and -74.0, chamfer 2.6.
const LEG = { x0: -32.5, x1: -13.25, z0: -92.0, z1: -74.0, cham: 2.6 };
for (const [name, at, yaw, ms, ok, say] of [
  ['street leg, south to north', [LEG.x1, LEG.z0 + LEG.cham], Math.PI, 6000,
    (p) => p[2] > LEG.z1 - LEG.cham - 0.9, (p) => `z ${f(p[2])} (turn begins at ${(LEG.z1 - LEG.cham).toFixed(1)})`],
  ['north end, street to back', [LEG.x1 - LEG.cham, LEG.z1], -Math.PI / 2, 8000,
    (p) => p[0] < LEG.x0 + LEG.cham + 1.0, (p) => `x ${f(p[0])} (turn begins at ${(LEG.x0 + LEG.cham).toFixed(1)})`],
  ['back leg, north to south', [LEG.x0, LEG.z1 - LEG.cham], 0.0, 6000,
    (p) => p[2] < LEG.z0 + LEG.cham + 0.9, (p) => `z ${f(p[2])} (turn begins at ${(LEG.z0 + LEG.cham).toFixed(1)})`],
  ['south end, back to street', [LEG.x0 + LEG.cham, LEG.z0], Math.PI / 2, 8000,
    (p) => p[0] > LEG.x1 - LEG.cham - 1.0, (p) => `x ${f(p[0])} (turn begins at ${(LEG.x1 - LEG.cham).toFixed(1)})`],
]) {
  await walk(`the loop: ${name}`, { at, yaw, ms, ok, say });
}


// ── the floor ────────────────────────────────────────────────────────────
//
// The park is no longer flat, so "every sample reads 0.14" is the wrong test
// and would now fail on purpose. Three questions instead, and they are the
// three ways relief goes wrong:
//
//   the PATHS are still dead level        — a decal on a slope buries itself
//   the RELIEF is actually there          — a picker that answers flat means
//                                           the mesh and the floor have drifted
//   nothing in it is STEEP ENOUGH TO TRIP — GOTCHAS §7, the whole constraint
//
// FIELD is the grass inside the loop: the legs at ±PATH_W/2.
const FIELD = { x0: LEG.x0 + 0.75, x1: LEG.x1 - 0.75, z0: LEG.z0 + 0.75, z1: LEG.z1 - 0.75 };
const inField = (x, z) => x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1;

const s = [];
for (let x = -38.0; x <= -7.4; x += 2.2) for (let z = -96; z <= -70; z += 4) {
  if (inField(x, z)) continue;
  s.push([x, z, await gyAt(x, z)]);
}
const bad = s.filter(([, , gy]) => Math.abs(gy - 0.14) > 0.001);
// `bad.length === 0` is also true of an empty `s`. The grid skips anything
// inside the field, so a field that grew to fill the site would empty it
// silently and this would go green having sampled nothing (§34).
report('…and the level grid sampled something', s.length >= 40,
  `${s.length} points off the grass`);
report('the paths and the perimeter are still dead level', bad.length === 0,
  bad.length ? `${bad.length}/${s.length} off: ${JSON.stringify(bad.slice(0, 3))}` : `${s.length} samples off the grass, all at gy 0.14`);

// The mound has to be findable by walking onto it. Sampled across the crest,
// not at one point: a single reading cannot tell a mound from a spike.
const crest = [];
for (let x = -30.0; x <= -16.0; x += 1.0) crest.push([x, await gyAt(x, -84.6)]);
const peak = crest.reduce((a, b) => (b[1] > a[1] ? b : a));
report('the mound is under your feet, not just on screen', peak[1] > 0.38,
  `highest floor across the crest line: gy ${f(peak[1])} at x ${f(peak[0])} (flat would be 0.14)`);

// …and the dish, which is the same test with the sign flipped — but measured
// AGAINST ITS OWN SURROUNDINGS, not against KERB_H.
//
// It used to assert `dip < 0.12`, i.e. lower than the paving. That was only
// ever true by accident: the field is now crowned by 0.10 m, because the park
// site's flat base plane is drawn by ct/street.ts at KERB_H and anything below
// it is simply hidden. A hollow is a hollow relative to the ground around it,
// which is what the eye reads and what water would do, so that is what this
// measures. Held against the old wording it would now fail on a dish that is
// 86 mm deep and perfectly visible.
// The ring is 4.5 m, chosen from the geometry rather than from what passes:
// the dish is a σ 2.6 gaussian, so at 3 m the ring still sits on half its own
// shoulder and understates the hollow, and past 5 m it starts running out over
// the rim fade instead. Between those the measured depth plateaus at ~50 mm.
//
// That is less than the 90 mm the dish is drawn as, and honestly so — the crown
// falls away toward the same edge, so the ground around it is already lower
// than the middle of the field. 50 mm over 5 m is what a player sees and what
// water would do; the threshold is 35, well under it and well over the ~20 at
// which a dip stops reading at all.
const DX = -19.5, DZ = -80.2;
const dip = await gyAt(DX, DZ);
const ring = [];
for (const [dx, dz] of [[4.5, 0], [-4.5, 0], [0, 4.5], [0, -4.5]]) ring.push(await gyAt(DX + dx, DZ + dz));
const around = ring.reduce((a, b) => a + b, 0) / ring.length;
report('the dish would hold a puddle', around - dip > 0.035 && dip > 0.0,
  `gy ${f(dip)} in the hollow against ${f(around)} on the ring — ${((around - dip) * 1000).toFixed(0)} mm deep`);

// GENTLE. Adjacent samples 0.5 m apart, straight over the crest and down the
// far side: the biggest rise per half-metre is the number that decides whether
// this is landscape or a trip hazard.
const line = [];
for (let z = -90.0; z <= -78.0; z += 0.5) line.push([z, await gyAt(-23.6, z)]);
let steep = [0, 0];
for (let i = 1; i < line.length; i++) {
  const d = Math.abs(line[i][1] - line[i - 1][1]);
  if (d > steep[0]) steep = [d, line[i][0]];
}
// Same trap with the sign flipped: if the transect ever stopped crossing the
// relief, every step would be 0 and "nothing is steep" would be trivially true.
const span = Math.max(...line.map((q) => q[1])) - Math.min(...line.map((q) => q[1]));
report('…and the transect actually crossed the relief', span > 0.10,
  `it rises and falls ${(span * 1000).toFixed(0)} mm end to end`);
report('nothing in the relief is steep enough to trip on', steep[0] < 0.06,
  `steepest half-metre is ${f(steep[0])} m at z ${f(steep[1])} — 1 in ${(0.5 / (steep[0] || 1e-9)).toFixed(0)}`);

// The proof that is not a number: WALK it. Straight over the mound, gate side
// to back side. A relief the picker disagrees with stops you dead.
//
// z -82.2, not the crest line at -84.6: the bench on the mound is a collider
// from z -85.08 to -83.32 and this would have walked into the back of it —
// which is the fourth time this session a test line has been drawn through my
// own furniture. It still crosses the mound, 0.26 m lower over the top.
await walk('you can walk straight over the mound', {
  at: [-17.0, -82.2], yaw: -Math.PI / 2, ms: 6000,
  ok: (p) => p[0] < -30.0,
  say: (p) => `x ${f(p[0])} (set off at -17.0, over the crest at -23.6)`,
});

// ── the edge line ────────────────────────────────────────────────────────
//
// The user's standing rule: nothing the park owns may stand on the pavement.
// This is that rule as a test — every collider inside the park's z-span is
// checked against the line at x = -7.00. The only thing allowed across it is
// ct/street.ts's boundary wall, which IS the boundary and carries the
// railings (x -7.00…-6.64).
const over = await page.evaluate(() => window.__ct.colliders()
  // straddling the line, on the west side. ct/street.ts's boundary wall
  // starts exactly ON the line (minX = -7.00) so it is excluded by <.
  .filter((c) => c.minZ >= -98.5 && c.maxZ <= -67.5 && c.minX > -20 && c.minX < -7.0 && c.maxX > -7.0)
  .map((c) => [+c.minX.toFixed(2), +c.maxX.toFixed(2), +c.minZ.toFixed(2), +c.maxZ.toFixed(2)]));
// THE §9 CHECK, and the one that most needs to be shown to have looked.
// `over.length === 0` is equally true if the park has no colliders at all, if
// `colliders()` came back empty, or if these bounds stopped matching the park —
// and it would read green in every one of those cases. So: count what is
// actually in the park's z-span first.
const parkCols = await page.evaluate(() => window.__ct.colliders()
  .filter((c) => c.minZ >= -98.5 && c.maxZ <= -67.5 && c.maxX < -7.0).length);
report('…and there were park colliders to check', parkCols >= 20,
  `${parkCols} colliders inside the park's z-span`);
report('nothing the park owns stands on the pavement', over.length === 0,
  over.length ? `${over.length} over the line: ${JSON.stringify(over)}` : 'every park collider is west of x = -7.00');

// ── the full frontage, walked ────────────────────────────────────────────
//
// Not eyeballed: the capsule goes the whole 30 m in the building-side lane
// and the position is read every step, so a squeeze shows up as a stall
// rather than as something that looked fine in a screenshot.
await warp(-6.2, -66.0, 0.0);
await page.waitForTimeout(150);
// a stall is only real if it survives a pause — citizens are solid and they
// walk on (E-walk.mjs learned this the hard way)
let stall = null, lastZ = -66.0, patience = 0;
for (let i = 0; i < 40; i++) {
  await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
  await page.waitForTimeout(40);
  const p = await pos();
  if (p[2] < -98.5) { lastZ = p[2]; break; }
  if (Math.abs(p[2] - lastZ) < 0.05) {
    if (++patience >= 3) { stall = p; break; }
    await page.waitForTimeout(1300);
  } else patience = 0;
  lastZ = p[2];
}
report('the full 30 m frontage walks without a squeeze', !stall,
  stall ? `stalled at z ${f(stall[2])}, x ${f(stall[0])}` : `walked z -66.00 -> ${f(lastZ)} in the building-side lane`);

console.log(fails ? `\n${fails} FAILED` : '\nall walks passed');
await b.close();
process.exit(fails ? 1 : 0);

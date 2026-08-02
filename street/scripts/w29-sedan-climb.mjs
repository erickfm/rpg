// ITEM 54'S ACCEPTANCE TEST: walk a full route from the road onto the parked
// SEDAN's roof and back down to the street, proving every surface on the way
// holds you at its own real height.
//
//     road 0.00 -> trailer deck 0.50 -> boot lid 0.93 -> cab roof 1.46
//                                                     -> hood 0.94 -> street 0
//
// This is a WALK, not a screenshot and not a warp: BUILDER-BRIEF §10, and the
// project has already had a check that warped to a coordinate and so never
// tested the thing it was named for. Nothing but driving the real input loop
// proves `standTop`/`blocked` agree about a surface — which matters more here
// than it did for the pickup, because this route's whole reason for existing
// is that those two functions DISAGREE about how wide a surface is (`blocked`
// pads by RADIUS, `standTop` by nothing) and that is what made the tyre route
// impossible. See scripts/probes/w29-ledge-band.mjs.
//
// Every coordinate is READ from `window.__ct.colliders()` by the `tag` the
// world stamps on each standable box, never typed here: the sedan is placed by
// a seeded draw and nudged again by settleParking(), so a hand-typed spot is
// wrong the first time the parking rule moves it.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/w29-sedan-climb.mjs
import { chromium } from 'playwright';

const EYE = 1.62;          // fp.ts's standing eye height
const TOL = 0.06;          // how close to a surface's own maxY counts as on it

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const need = ['sedan-trailer-deck', 'sedan-boot-lid', 'sedan-body'];
const missing = need.filter((t) => !byTag[t]);
if (missing.length) { console.log('FAIL: no such surface:', missing.join(', ')); process.exit(1); }
for (const t of need) console.log(`  ${t.padEnd(20)} ${JSON.stringify(byTag[t])}`);

const deck = byTag['sedan-trailer-deck'];
const boot = byTag['sedan-boot-lid'];
const body = byTag['sedan-body'];

// THE GREENHOUSE MUST NOT BE STANDABLE. A boot-lid -> roof hop is a 0.53 m
// rise, which clears the height threshold by 21 mm and still lands you back on
// the boot: at the dt clamp only two frames are above the threshold, and two
// frames of walking is 0.33 m against the 0.36 m of RADIUS you have to cross
// before `standTop` will credit the roof. Asserting the ABSENCE here is what
// stops someone "fixing" that by adding a tier nobody can reliably reach.
if (body.maxY !== undefined) {
  console.log(`FAIL: sedan-body carries maxY ${body.maxY} — the greenhouse must stay a wall`);
  process.exit(1);
}

// Which way along z is "towards the nose"? The trailer is hitched at the boot
// end by construction, so deck -> body IS forward — derived, so this still
// holds if the car is ever parked facing the other way.
const mid = (b) => (b.minZ + b.maxZ) / 2;
const fwd = mid(body) > mid(deck) ? 1 : -1;
const tailEnd = fwd > 0 ? deck.minZ : deck.maxZ;
const midX = (deck.minX + deck.maxX) / 2;
// forward is (sin yaw, -cos yaw), so yaw = PI walks towards +z
const yawFwd = fwd > 0 ? Math.PI : 0;
console.log(`sedan: trailer tail at z=${tailEnd.toFixed(2)}, nose is ${fwd > 0 ? '+z' : '-z'}, centre x=${midX.toFixed(2)}`);

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const feet = async () => (await camY()) - EYE;
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };

/** Jump, then push while already rising, releasing the push the moment you are
 *  over the box you are aiming at rather than after a fixed number of
 *  milliseconds — a player watches where he is and lets go. The boot lid's
 *  standable band is 0.71 m and a walk crosses it in ~230 ms, so a fixed push
 *  either falls short or sails over.
 *
 *  SPACE IS HELD THROUGH THE WHOLE HOP (BUILDER-BRIEF §5): fp.ts reads the key
 *  set once per rendered frame, so a short press vanishes whole if the machine
 *  produces a frame longer than it. `jumpHeld` refuses to re-jump until it is
 *  released, so holding costs nothing.
 *
 *  The watch loop runs IN-PAGE, one animation frame at a time: polling with
 *  p.evaluate costs a round trip per sample, which is most of a frame here. */
const hopOnto = async (key, riseMs, box, maxMs = 900) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key);
  await p.evaluate(([lo, hi, ms]) => new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const v = window.__ct.pos()[2];
      if ((v > lo && v < hi) || performance.now() - t0 > ms) return done(v);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [box.minZ, box.maxZ, maxMs]);
  await p.keyboard.up(key);
  await p.keyboard.up(' ');
  await p.waitForTimeout(450);   // let the fall settle
};

let steps = [];
const check = async (label, want, inside) => {
  const f = await feet(); const P = await pos();
  const okY = Math.abs(f - want) < TOL;
  const okXZ = !inside || (P[0] > inside.minX && P[0] < inside.maxX && P[2] > inside.minZ && P[2] < inside.maxZ);
  steps.push({ label, want, got: +f.toFixed(3), ok: okY && okXZ });
  console.log(`  ${okY && okXZ ? 'ok  ' : 'MISS'} ${label.padEnd(30)} feet ${f.toFixed(3)} (want ${want.toFixed(2)})  at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
  return okY && okXZ;
};

/** THE WHOLE ROUTE, ONCE.
 *
 *  Run up to three times, because a mistimed hop is a miss and not a broken
 *  world — a dropped frame swallows the space bar and you land back where you
 *  started, which w21 measured at 7/8 on a world where nothing had moved. A
 *  player mistimes a jump and jumps again. What is NOT relaxed is the
 *  assertion: every surface must hold the feet at its own `maxY`, inside its
 *  own footprint, and three misses in a row still fail. */
const route = async (shoot) => {
  steps = [];
  // ── 0. START IN THE ROAD, BEHIND THE TRAILER ────────────────────────────
  await warp(midX, tailEnd - fwd * 1.4, yawFwd);
  // WAIT FOR THE FLOOR TO SETTLE BEFORE MEASURING. You spawn in room 301,
  // three storeys up, and ct/apartment.ts's storey picker walks down over
  // several frames rather than snapping. Sample too early and the first
  // reading is the APARTMENT's eye height — which is what makes
  // scripts/jump-walk.mjs report a 5.260 m hop at its first spot.
  await p.evaluate(() => new Promise((done) => {
    let last = NaN, still = 0, frames = 0;
    const tick = () => {
      const y = window.__ct.camY();
      still = Math.abs(y - last) < 1e-4 ? still + 1 : 0;
      last = y;
      if (still >= 5 || ++frames > 240) return done(y);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  if (!await check('start: down in the road', 0)) return false;

  // ── 1. road -> trailer deck ─────────────────────────────────────────────
  await hold('w', 600);                 // walk up flush against the trailer
  await p.waitForTimeout(200);
  await hopOnto('w', 220, deck);
  if (!await check('1. trailer deck', deck.maxY, deck)) return false;

  // ── 2. deck -> boot lid ─────────────────────────────────────────────────
  await hold('w', 420);                 // forward across the deck, flush to the boot
  await p.waitForTimeout(200);
  await hopOnto('w', 200, boot);
  if (!await check('2. boot lid', boot.maxY, boot)) return false;

  // ── 3. the boot lid holds you right up against the glass ────────────────
  //
  // Walk forward until the greenhouse stops you and confirm you are STILL on
  // the lid at its own height. This is the step that would silently rot if the
  // seam ever drifted forward into the cabin, and it is also where the roof
  // hop was attempted from.
  await hold('w', 300);
  await p.waitForTimeout(250);
  if (!await check('3. still on the lid, at the glass', boot.maxY, boot)) return false;

  // LOOK at it, once, from up there — a still is worthless as proof but it is
  // the only way to answer "does standing on the boot of a car read as
  // standing on the boot of a car". Pitch is nudged with the CURRENT x/z read
  // back first: warp writes every argument it is given, so passing `undefined`
  // for a coordinate sets the rig to NaN and silently poisons every
  // measurement after it.
  if (shoot) {
    const P = await pos();
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, -0.25), [P[0], P[2], yawFwd]);
    await p.waitForTimeout(200);
    await p.screenshot({ path: 'shots/w29-on-the-sedan-boot.png' });
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [P[0], P[2], yawFwd]);
  }

  // ── 4. and back down to the street the way you came ─────────────────────
  await warp((await pos())[0], (await pos())[2], yawFwd + Math.PI);
  await p.waitForTimeout(200);
  await hold('w', 2600);                // back over the deck and off the tail
  await p.waitForTimeout(400);
  return await check('4. back down on the street', 0);
};

let climbed = false;
for (let attempt = 1; attempt <= 3 && !climbed; attempt++) {
  console.log(`attempt ${attempt}:`);
  climbed = await route(attempt === 1);
}
if (!climbed) console.log('FAIL: three attempts, never completed the route');

// ── 6. and it is still a wall from the outside ────────────────────────────
//
// The whole mechanism is opt-in on height, so the thing that could silently
// break is the OTHER direction: a tier that stopped blocking at head height
// would let a walking player stroll through the car. Walk into the flank at
// ground level and confirm you are still stopped outside it.
await warp(body.maxX + 1.5, mid(body), -Math.PI / 2);
await p.waitForTimeout(300);
await hold('w', 1600);
await p.waitForTimeout(200);
const q = await pos();
const stillSolid = q[0] < body.minX || q[0] > body.maxX;
console.log(`${stillSolid ? 'ok  ' : 'FAIL'} 5. flank is still a wall on foot   stopped at x ${q[0].toFixed(2)} (box ${body.minX.toFixed(2)}..${body.maxX.toFixed(2)})`);

// ── 6. AND YOU CAN GET OFF THE BOOT LID IN EVERY DIRECTION ────────────────
//
// BUILDER-BRIEF §11 aimed at a surface instead of a panel: something you
// cannot get off is the same bug as a panel you cannot close, and the user has
// been trapped twice — *"no im telling you i can't get up anything i do once i
// sit down"*. Walk off all four ways and confirm the feet end lower. Forward
// is into the glass, so that one is EXPECTED to hold you: it is a wall, and a
// wall you can walk through would be the other failure. The other three must
// let you down.
let exits = 0;
const ways = [['back', yawFwd + Math.PI], ['left', yawFwd + Math.PI / 2], ['right', yawFwd - Math.PI / 2]];
for (const [name, yaw] of ways) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [midX, mid(boot), yaw]);
  await p.waitForTimeout(300);
  await hold('w', 2400);
  await p.waitForTimeout(400);
  const f = await feet(); const P = await pos();
  const off = f < boot.maxY - 0.2;
  if (off) exits++;
  console.log(`  ${off ? 'ok  ' : 'STUCK'} 6.${name.padEnd(8)} feet ${f.toFixed(2)} at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
}

if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
const allOk = climbed && stillSolid && exits === ways.length && errs.length === 0;
console.log(allOk ? 'PASS: road -> trailer deck -> boot lid -> street, and off it three ways'
  : `FAIL: climbed=${climbed} solid=${stillSolid} exits=${exits}/${ways.length} errs=${errs.length}`);
await browser.close();
process.exit(allOk ? 0 : 1);

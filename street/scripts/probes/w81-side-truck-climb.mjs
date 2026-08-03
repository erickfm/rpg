// ITEM 202c'S ACCEPTANCE WALK, ON THE TRUCK THAT DID NOT HAVE ONE.
//
// The user, V overlay on: *"truck collision isnt accurate to the truck but the
// other truck is? it seems odd. seems like all trucks should be one object that
// are all the same no?"* The truck he could climb — the main street's — has had
// a walk since item 29 (scripts/w21-roof-climb.mjs). THE OTHER TRUCK, on the
// side street, had a single full-height box and no walk at all, and item 202c
// gives it the same five tiers. A collider nobody has walked is a claim, so
// this walks it.
//
// EVERYTHING IS DERIVED FROM THE COLLIDERS, NOTHING TYPED. The side street runs
// EAST, so this truck's length lies along x where the main street's lies along
// z — and a walk with a hand-typed axis in it would pass on one street and
// measure nothing on the other. The length axis, which end is the tailgate and
// which way is "towards the cab" are all read from the `@side` tiers.
//
// Usage: SHOT_URL=http://localhost:4370/ node scripts/probes/w81-side-truck-climb.mjs
import { chromium } from 'playwright';

const EYE = 1.62;          // fp.ts's standing eye height
const TOL = 0.06;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4370/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const need = ['pickup-bed-floor@side', 'pickup-cab-roof@side', 'pickup-hood@side',
  'pickup-rail-left@side', 'pickup-rail-right@side'];
const missing = need.filter((t) => !byTag[t]);
if (missing.length) {
  console.log('FAIL: the side street truck has no such standable surface:', missing.join(', '));
  await browser.close();
  process.exit(1);
}
for (const t of need) console.log(`  ${t.padEnd(24)} ${JSON.stringify(byTag[t])}`);

const bed = byTag['pickup-bed-floor@side'];
const roof = byTag['pickup-cab-roof@side'];
const hood = byTag['pickup-hood@side'];

// ── THE TIERS MUST MATCH A TRUCK, NOT MERELY MATCH THEMSELVES ─────────────
//
// w21-roof-climb.mjs's lesson, applied here: asserting `feet === box.maxY`
// reads the expectation out of the collider under test, so flattening a tier
// leaves the check green. Pin each height against a FRESHLY BUILT pickup,
// measured off its own drawn panels — `__ct.carVariant` goes through the same
// `makeCar` the street uses and touches no collider code, so it cannot agree
// with a mutation in the spec.
const panelTops = await p.evaluate(() => {
  const g = window.__ct.carVariant('pickup', {}, 400, 0, 400);
  const tops = [];
  for (const c of g.children) {
    if (!c.geometry) continue;
    c.updateMatrix(); c.geometry.computeBoundingBox();
    tops.push(+c.geometry.boundingBox.clone().applyMatrix4(c.matrix).max.y.toFixed(4));
  }
  g.parent.remove(g);
  return [...new Set(tops)].sort((a, b) => a - b);
});
console.log(`\nflat tops on a freshly built pickup: ${panelTops.join(', ')}`);
const unpinned = need.filter((t) => !panelTops.some((y) => Math.abs(y - byTag[t].maxY) < 1e-3));
if (unpinned.length) {
  for (const t of unpinned) console.log(`FAIL: tier ${t} stands at ${byTag[t].maxY} — the truck has no panel there`);
  await browser.close();
  process.exit(1);
}
console.log('every tier stands at a height the truck actually has a panel at');

// ── WHICH WAY IS THIS TRUCK POINTING? ────────────────────────────────────
//
// The bed is behind the cab by construction, so the vector from the roof tier's
// centre to the bed tier's centre points at the TAIL. Its dominant component is
// the truck's length axis. Derived, so this file works on either street.
const mid = (b, ax) => (ax === 'x' ? (b.minX + b.maxX) : (b.minZ + b.maxZ)) / 2;
const dx = mid(bed, 'x') - mid(roof, 'x'), dz = mid(bed, 'z') - mid(roof, 'z');
const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z';   // the truck's length
const cross = axis === 'x' ? 'z' : 'x';                  // across it
const toTail = (axis === 'x' ? dx : dz) >= 0 ? 1 : -1;   // + along `axis` is the tail
const tailAt = toTail > 0 ? (axis === 'x' ? bed.maxX : bed.maxZ)
  : (axis === 'x' ? bed.minX : bed.minZ);
const crossMid = mid(bed, cross);
// forward is (sin yaw, -cos yaw): +x is pi/2, -x is -pi/2, +z is pi, -z is 0
const YAW = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 };
const dirName = (ax, sgn) => `${sgn > 0 ? '+' : '-'}${ax}`;
const yawFwd = YAW[dirName(axis, -toTail)];              // from the tail towards the cab
console.log(`\ntruck: length runs along ${axis}, tail at ${axis}=${tailAt.toFixed(2)},`
  + ` centre ${cross}=${crossMid.toFixed(2)}, climbing towards ${dirName(axis, -toTail)}`);

const pos = () => p.evaluate(() => window.__ct.pos());
const feet = async () => (await p.evaluate(() => window.__ct.camY())) - EYE;
const at = (P, ax) => (ax === 'x' ? P[0] : P[2]);
const warp = (a, c, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
  axis === 'x' ? [a, c, yaw] : [c, a, yaw]);
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
// BUILDER-BRIEF §5 and w21's own note: hold the key through the whole hop. The
// key set is read once per RENDERED frame, so a fixed press vanishes whole if
// the machine produces a long frame.
const hopInto = async (key, riseMs, pushMs) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key); await p.waitForTimeout(pushMs);
  await p.keyboard.up(key); await p.keyboard.up(' ');
  await p.waitForTimeout(450);
};
/** The same hop, but the push stops the moment you are over the box you are
 *  aiming at — a rail's standable band is 0.31 m and a fixed push either falls
 *  short or sails over. Watched from INSIDE the page, one animation frame at a
 *  time: polling over CDP costs most of a frame per sample. */
const hopOnto = async (key, riseMs, box, ax, maxMs = 800) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key);
  const lo = ax === 'x' ? box.minX : box.minZ, hi = ax === 'x' ? box.maxX : box.maxZ;
  await p.evaluate(([lo, hi, ax, ms]) => new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const P = window.__ct.pos();
      const v = ax === 'x' ? P[0] : P[2];
      if ((v > lo && v < hi) || performance.now() - t0 > ms) return done(v);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [lo, hi, ax, maxMs]);
  await p.keyboard.up(key); await p.keyboard.up(' ');
  await p.waitForTimeout(450);
};
const settle = () => p.evaluate(() => new Promise((done) => {
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

let ok = true;
const check = async (label, want, inside) => {
  const f = await feet(); const P = await pos();
  const okY = Math.abs(f - want) < TOL;
  const okXZ = !inside || (P[0] > inside.minX && P[0] < inside.maxX && P[2] > inside.minZ && P[2] < inside.maxZ);
  console.log(`  ${okY && okXZ ? 'ok  ' : 'MISS'} ${label.padEnd(30)} feet ${f.toFixed(3)}`
    + ` (want ${want.toFixed(2)})  at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
  return okY && okXZ;
};

// which rail is on which side, in world terms, and which strafe key reaches it
const railA = byTag['pickup-rail-left@side'], railB = byTag['pickup-rail-right@side'];
const rail = mid(railA, cross) > crossMid ? railA : railB;   // either will do
const railSide = mid(rail, cross) > crossMid ? 1 : -1;
// strafing 'd' moves along +right, where right = (cos yaw, sin yaw) in (x, z)
const rightVec = { x: Math.cos(yawFwd), z: Math.sin(yawFwd) };
const strafe = (rightVec[cross] > 0) === (railSide > 0) ? 'd' : 'a';
console.log(`rail on the ${cross}=${mid(rail, cross).toFixed(2)} side, strafing '${strafe}'`);

/** The whole route, from the road behind the tailgate to the cab roof.
 *  Three attempts, like w21's: a mistimed hop is a miss, not a broken world. */
const route = async (stopAt = 'roof') => {
  await warp(tailAt + toTail * 1.7, crossMid, yawFwd);
  await settle();
  if (!await check('start: in the road, at the tail', 0)) return false;
  await hold('w', 700);                        // flush against the tailgate
  await p.waitForTimeout(200);
  await hopInto('w', 220, 900);
  if (!await check('1. bed floor', bed.maxY, bed)) return false;
  if (stopAt === 'bed') return true;
  await hold(strafe, 400);
  await p.waitForTimeout(200);
  await hopOnto(strafe, 200, rail, cross);
  if (!await check('2. bed rail', rail.maxY, rail)) return false;
  await hold('w', 500);                        // forward along the rail, to the cab
  await p.waitForTimeout(200);
  if (!await check('   rail, flush to the cab', rail.maxY, rail)) return false;
  await hopOnto('w', 200, roof, axis);
  if (!await check('3. CAB ROOF', roof.maxY, roof)) return false;
  if (stopAt === 'roof') return true;
  await hold('w', 620);
  await p.waitForTimeout(250);
  if (!await check('4. hood', hood.maxY, hood)) return false;
  await hold('w', 1400);
  await p.waitForTimeout(400);
  return await check('5. back down on the street', 0);
};

let climbed = false;
for (let a = 1; a <= 3 && !climbed; a++) {
  console.log(`\nattempt ${a}: road -> bed -> rail -> ROOF -> hood -> street`);
  climbed = await route('street');
}
if (!climbed) { ok = false; console.log('FAIL: three attempts, never made the full route'); }

// ── AND IT IS STILL A WALL AT GROUND LEVEL ───────────────────────────────
//
// The whole mechanism is opt-in on height, so what could silently break is the
// OTHER direction: a tier that stops blocking at head height lets a walking
// player stroll through the truck. Walk into the flank and confirm you stop.
const flankAt = mid(bed, cross) + 1.5 * (crossMid >= 0 ? 1 : 1);
const intoFlank = rightVec[cross];   // unused sign guard, kept explicit below
void intoFlank;
{
  const standC = mid(bed, cross) + 1.5;
  const yawIn = YAW[dirName(cross, -1)];   // face back towards the truck's centre
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
    axis === 'x' ? [mid(bed, 'x'), standC, yawIn] : [standC, mid(bed, 'z'), yawIn]);
  await p.waitForTimeout(300);
  await hold('w', 1600);
  await p.waitForTimeout(200);
  const P = await pos();
  const v = at(P, cross);
  const solid = v < (cross === 'x' ? bed.minX : bed.minZ) || v > (cross === 'x' ? bed.maxX : bed.maxZ);
  if (!solid) ok = false;
  console.log(`${solid ? 'ok  ' : 'FAIL'} 6. flank is still a wall on foot   stopped at ${cross} ${v.toFixed(2)}`
    + ` (box ${(cross === 'x' ? bed.minX : bed.minZ).toFixed(2)}..${(cross === 'x' ? bed.maxX : bed.maxZ).toFixed(2)})`);
}
void flankAt;

// ── AND YOU CAN GET OFF THE ROOF IN EVERY DIRECTION ──────────────────────
//
// BUILDER-BRIEF §11 aimed at a surface instead of a panel: a roof you cannot
// leave is the same bug as a panel you cannot close. You cannot WARP onto a
// tier (warp writes x and z but not height, so it drops you into the box at
// street level and `unstick()` shoves you out) — so each direction is climbed
// for real.
let exits = 0;
const ways = [['forward', yawFwd], ['back', yawFwd + Math.PI],
  ['left', yawFwd + Math.PI / 2], ['right', yawFwd - Math.PI / 2]];
for (const [name, yaw] of ways) {
  let up = false;
  for (let t = 0; t < 4 && !up; t++) up = await route('roof');
  if (!up || Math.abs((await feet()) - roof.maxY) > 0.06) {
    console.log(`  MISS 7.${name.padEnd(8)} could not get onto the roof in 4 tries — direction untested`);
    ok = false;
    continue;
  }
  const here = await pos();
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [here[0], here[2], yaw]);
  await p.waitForTimeout(300);
  await hold('w', 2400);
  await p.waitForTimeout(400);
  const f = await feet(); const P = await pos();
  const off = f < roof.maxY - 0.2;
  if (off) exits++; else ok = false;
  console.log(`  ${off ? 'ok  ' : 'STUCK'} 7.${name.padEnd(8)} feet ${f.toFixed(2)} at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
}

if (errs.length) { ok = false; console.log('page errors:', errs.slice(0, 5).join(' | ')); }
console.log(ok
  ? `PASS: the SIDE STREET truck climbs road -> bed -> rail -> ROOF -> hood -> street, is still a wall on foot, and comes off it ${exits}/4 ways`
  : `FAIL: climbed=${climbed} exits=${exits}/4 errs=${errs.length}`);
await browser.close();
process.exit(ok ? 0 : 1);

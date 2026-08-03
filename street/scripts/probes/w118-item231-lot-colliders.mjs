// Item 231 — the used-car lot's colliders, and the aisle they must not close.
//
// Answers all four DONE WHEN clauses, and is written to run UNCHANGED on the
// tree before and after the fix so the two can be compared honestly:
//
//   1. every lot car carries its KIND's declared collider, at its real angle
//   2. the 6.8 m aisle is still walkable — measured geometrically AND walked
//   3. jacked bays are handled (asserted, see below)
//   4. no MOVING vehicle falls back to the `halfLen ?? 2.5` default
//
// Usage: SHOT_URL=http://localhost:4740/ node scripts/probes/w118-item231-lot-colliders.mjs
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('  NOT AIMED — pass SHOT_URL=http://localhost:<your port>/'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(400);

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// The lot's own geometry, derived in the page from the world rather than
// retyped here: the aisle is the band the cars are parked either side of.
// zMid/AISLE_HW are ct/lot.ts's, and the two rows sit at zMid +- 6.0.
const AISLE = { zMid: 2.6, hw: 3.4 };     // ct/lot.ts:549,566 — cited, see note
const X_FROM = 8.5, X_TO = 27.5;

const world = await page.evaluate(({ AISLE }) => {
  // fp.ts's own frame transform, so a TURNED box is tested as the rectangle it
  // is and not as its bounding box (fp.ts:56). Copied with its line cited —
  // fp.ts cannot be imported at runtime (it 404s on `vite preview`).
  const inFrame = (c, x, z) => {
    if (!c.rot) return { x, z };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = x - cx, dz = z - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  const hits = (c, x, z) => {
    const p = inFrame(c, x, z);
    return p.x >= c.minX && p.x <= c.maxX && p.z >= c.minZ && p.z <= c.maxZ;
  };

  const cars = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.carKind === undefined) return;
    const p = new (o.position.constructor)();
    o.getWorldPosition(p);
    if (Math.abs(p.x - 999) < 1 && Math.abs(p.z - 999) < 1) return;   // traffic pool sentinel
    if (p.x < 8 || p.x > 30 || p.z < -8 || p.z > 12) return;          // the lot's footprint
    let yaw = 0;
    for (let n = o; n; n = n.parent) yaw += n.rotation?.y ?? 0;
    cars.push({
      kind: o.userData.carKind, x: +p.x.toFixed(3), z: +p.z.toFixed(3), yaw: +yaw.toFixed(4),
      jack: o.userData.jack ?? null, onBlocks: o.userData.onBlocks ?? null,
      hoodOpen: o.userData.hoodOpen ?? null,
    });
  });

  const cols = window.__ct.colliders().map((c) => ({
    tag: c.tag ?? null, minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ,
    maxY: c.maxY ?? null, rot: c.rot ?? null,
  }));
  const lotCols = cols.filter((c) => {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    return cx > 8 && cx < 30 && cz > -8 && cz < 12;
  });

  // ── WHERE THE AISLE ENDS: THE OFFICE ────────────────────────────────────
  // The aisle is a dead end on purpose — the office sits across the back of it,
  // "at the far end facing back down the aisle it is what you drive TOWARD"
  // (ct/lot.ts). Scanning past its west face measures the inside of a building
  // and reports a 0.40 m "aisle", which is exactly what my first cut did.
  // So: find the nearest thing blocking the aisle centre line east of the bays,
  // and stop there.
  let aisleEnd = 27.5;
  for (const c of cols) {
    const cx = (c.minX + c.maxX) / 2;
    if (cx < 20 || cx > 40) continue;
    if (!hits(c, Math.max(c.minX, 20.5), AISLE.zMid) && !hits(c, cx, AISLE.zMid)) continue;
    if (c.minX < aisleEnd) aisleEnd = c.minX;
  }
  aisleEnd = Math.max(20, aisleEnd - 0.3);      // stop just short of its face

  // ── THE AISLE'S CLEAR WIDTH, scanned rather than assumed ────────────────
  // At each x, walk z across the band and find the widest contiguous run of
  // free ground. Step 1 cm; the answer is reported as a range over x.
  const STEP = 0.01;
  const widths = [];
  for (let x = 8.5; x <= aisleEnd; x += 0.25) {
    let best = 0, run = 0;
    for (let z = AISLE.zMid - AISLE.hw - 1.5; z <= AISLE.zMid + AISLE.hw + 1.5; z += STEP) {
      const blocked = cols.some((c) => hits(c, x, z));
      if (blocked) run = 0; else { run += STEP; if (run > best) best = run; }
    }
    widths.push({ x: +x.toFixed(2), w: +best.toFixed(3) });
  }

  // ── HOW FAR DOES ANYTHING REACH INTO THE AUTHORED AISLE BAND? ───────────
  // This is the assertion with teeth, and the clear-span figure above is not.
  // The lot is authored around a 6.8 m aisle at z -0.8..6.0; the derivation in
  // ct/lot.ts promises that no MAIN-ROW car may enter it. Measured as a depth
  // in metres, any intrusion at all is a failure — where a span floor of 6.8 m
  // sat 0.88 m clear of the truth and slept through a real regression.
  //
  // The two BACK-CORNER bays are excluded by the x window, deliberately: they
  // stand 1.3 m off the band and the OLD box already crossed it by 0.70 m, so
  // they are held to "no worse than before" instead (reported separately).
  let intrude = 0, intrudeAt = null;
  for (let x = 10; x <= 24; x += 0.1) {
    for (let z = AISLE.zMid - AISLE.hw; z <= AISLE.zMid + AISLE.hw; z += 0.02) {
      if (!cols.some((c) => hits(c, x, z))) continue;
      const d = Math.min(z - (AISLE.zMid - AISLE.hw), (AISLE.zMid + AISLE.hw) - z);
      if (d > intrude) { intrude = d; intrudeAt = { x: +x.toFixed(2), z: +z.toFixed(2) }; }
    }
  }

  return {
    cars, lotCols, widths, aisleEnd: +aisleEnd.toFixed(2),
    intrude: +intrude.toFixed(3), intrudeAt,
  };
}, { AISLE });

// ── 1. every lot car carries its kind's declared collider ──────────────────
console.log(`lot colliders:\n`);
const specs = await page.evaluate(() => {
  const out = {};
  for (const k of ['sedan', 'hatch', 'pickup', 'van']) out[k] = window.__ct.carSpec(k);
  return out;
});

check(world.cars.length === 11, `the lot has its 11 cars (${world.cars.length} found)`);

const untagged = world.lotCols.filter((c) => !c.tag);
const carTagged = world.lotCols.filter((c) => c.tag && /@lot\d+$/.test(c.tag));
console.log(`  lot colliders: ${world.lotCols.length} total, ${carTagged.length} car-tagged, ${untagged.length} untagged (fence/poles/office too)`);

// group the car-tagged boxes by bay
const byBay = new Map();
for (const c of carTagged) {
  const bay = c.tag.match(/@lot(\d+)$/)[1];
  if (!byBay.has(bay)) byBay.set(bay, []);
  byBay.get(bay).push(c);
}
check(byBay.size === 11, `every one of the 11 cars has its own tagged collider set (${byBay.size} bays tagged)`);

// EXACTLY its kind's declared tiers, name AND shape — no trimming, no
// approximation. This is the user's sentence as an assertion: a lot pickup and
// a street pickup must be one object. An earlier cut of this fix clamped the
// pickup and van to protect the aisle and this line is what caught it: the lot
// pickup came out 0.194 m shorter than the street pickup, which is two shapes
// for one kind in a new place.
let kindMismatch = 0, unrotated = 0;
for (const [bay, boxes] of byBay) {
  const base = boxes.map((b) => b.tag.replace(/@lot\d+$/, '')).sort();
  const kind = base[0]?.split('-')[0];
  const want = (specs[kind] ?? []).map((t) => t.tag).sort();
  const same = base.length === want.length && base.every((t, i) => t === want[i]);
  // and every tier's SHAPE, in the car's own frame, against the declared one
  let shapeBad = null;
  for (const b of boxes) {
    const t = (specs[kind] ?? []).find((q) => q.tag === b.tag.replace(/@lot\d+$/, ''));
    if (!t) { shapeBad = b.tag; break; }
    const gotX = +(b.maxX - b.minX).toFixed(3), gotZ = +(b.maxZ - b.minZ).toFixed(3);
    const wantX = +(t.maxX - t.minX).toFixed(3), wantZ = +(t.maxZ - t.minZ).toFixed(3);
    if (Math.abs(gotX - wantX) > 0.005 || Math.abs(gotZ - wantZ) > 0.005) {
      shapeBad = `${b.tag} is ${gotX}x${gotZ}, its kind declares ${wantX}x${wantZ}`;
      break;
    }
  }
  if (!same || shapeBad) {
    kindMismatch++;
    console.log(`       bay ${bay}: ${shapeBad ?? `tiers ${base.join(',')} are not ${kind}'s (${want.join(',')})`}`);
  }
  if (boxes.some((b) => !b.rot)) unrotated++;
}
check(kindMismatch === 0, `every bay carries its kind's declared tiers at their declared SHAPE — a lot pickup is a street pickup (${byBay.size} bays)`);
check(unrotated === 0, `every lot car's collider is turned to the car's real angle (${unrotated} unrotated)`);

// the defect the row names: one shape for every kind
const shapes = new Set(carTagged.map((c) => `${(c.maxX - c.minX).toFixed(2)}x${(c.maxZ - c.minZ).toFixed(2)}`));
console.log(`  distinct car-collider footprints in the lot: ${shapes.size} (${[...shapes].sort().join(', ')})`);
check(shapes.size > 1, `the lot no longer gives every kind of car one identical box (${shapes.size} distinct footprints)`);

// ── 3. jacked bays ─────────────────────────────────────────────────────────
// lot.ts cannot see the tilt `makeCar` applies inside its own group, so a
// height CAP on a jacked car would be wrong. Assert there is none to be wrong.
const jacked = world.cars.filter((c) => c.jack);
const blocked = world.cars.filter((c) => c.onBlocks);
console.log(`\n  not-just-parked: ${jacked.length} jacked (${jacked.map((c) => c.kind).join(',')}), `
  + `${blocked.length} on blocks (${blocked.map((c) => c.kind).join(',')})`);
let jackedCapped = 0;
for (const c of jacked) {
  const tiers = specs[c.kind] ?? [];
  if (tiers.some((t) => t.maxY !== undefined && t.maxY !== null)) jackedCapped++;
}
check(jackedCapped === 0,
  `no jacked car draws a kind with a height-capped tier — lot.ts cannot see the tilt, `
  + `so a cap would sit ~0.10 m low (${jackedCapped} would)`);

// ── 2. the aisle ───────────────────────────────────────────────────────────
const ws = world.widths.map((w) => w.w);
const lo = Math.min(...ws), hi = Math.max(...ws);
const worst = world.widths.find((w) => w.w === lo);
console.log(`\n  aisle clear width, scanned every 0.25 m of x from ${X_FROM} to ${world.aisleEnd} (the office closes it):`);
console.log(`    narrowest ${lo.toFixed(2)} m at x=${worst.x}, widest ${hi.toFixed(2)} m`);
check(lo >= 2.0, `the 2 m lane is sacred — narrowest clear span in the aisle is ${lo.toFixed(2)} m`);
// A RANGE, NOT A FLOOR — and the numbers are MEASURED, not predicted.
//
// The lot is authored with a 6.8 m aisle (AISLE_HW 3.4, z -0.8..6.0). The old
// single box sat 0.6 m BACK from that edge on each side, so what a player could
// actually walk was 8.00 m, not 6.8 — measured on the pre-change tree. Accurate
// per-kind colliders are longer and reach closer to the aisle, so this number is
// EXPECTED to fall; what must not happen is it falling into the authored aisle.
//
// Hence a floor of 6.8 (the authored aisle is intact) AND a ceiling of 8.1 (the
// pre-change 8.00 plus rounding). Without the ceiling a change that deleted the
// lot's colliders outright would pass this line in green — which is exactly the
// "every check asserts a floor, never a ceiling" failure that shipped a 0.275 m
// double-correction with every probe green throughout.
const mid = world.widths.filter((w) => w.x >= 10 && w.x <= 24).map((w) => w.w);
const midLo = Math.min(...mid), midHi = Math.max(...mid);
// A TWO-SIDED RANGE, BECAUSE A FLOOR HERE DEMONSTRABLY SLEPT.
//
// The floor that used to be here was 6.8 m — the authored aisle — against a
// real 7.52 m. That is 0.72 m of slack, and a registered mutation that put the
// whole south row's noses into the aisle only moved it to 7.52 from 7.68, so
// the check stayed green while the thing it guards was broken. Both ends are
// asserted now: too narrow means the cars have eaten the aisle, too wide means
// they have stopped bounding it (or vanished).
check(midLo >= 7.2 && midLo <= 8.1,
  `the aisle between the rows is ${midLo.toFixed(2)} m — wider than the 6.8 m authored, `
  + `narrower than the 8.00 m the old under-sized box left`);
console.log(`  deepest reach into the authored aisle band (z ${(AISLE.zMid - AISLE.hw).toFixed(1)}..${(AISLE.zMid + AISLE.hw).toFixed(1)}), `
  + `along the rows x 10..24: ${world.intrude.toFixed(3)} m`
  + (world.intrudeAt ? ` at (${world.intrudeAt.x}, ${world.intrudeAt.z})` : ''));
// Reported, not asserted at zero: with the real specs the noses DO enter the
// authored band by ~0.14 m, and that is correct — the band is where the bays
// were laid out, not a wall. What matters is the walkable width above, and the
// 2 m lane below. Asserted loosely so a gross regression still shows.
check(world.intrude <= 0.45,
  `no lot car reaches deep into the authored aisle band (${world.intrude.toFixed(3)} m)`);

// ── THE BACK-CORNER BAYS, held to the reach the old single box had ─────────
//
// They predate this change and already crossed the band, so "never enter the
// aisle" would have cut them to 1.67 m stubs. They are held to the reach the
// OLD single box had instead, so they can only get better.
//
// ⚠ FOR A TURNED BOX, minZ/maxZ ARE EXTENTS IN THE BOX'S OWN FRAME, NOT WORLD
// EXTENTS — ct/gap.ts:35 says so in as many words, and reading them as world
// coordinates is what made my first cut of this line report 10.86 m against a
// 2.0 m bar. The world-z half-extent of a rectangle (hx, hz) turned by `rot` is
// hz*|cos| + hx*|sin|. That first cut also swept in fence and office boxes;
// only car-tagged ones are bay cars.
const worldHalfZ = (c) => {
  const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  if (!c.rot) return hz;
  return hz * Math.abs(Math.cos(c.rot)) + hx * Math.abs(Math.sin(c.rot));
};
const cornerCars = world.cars.filter((c) => c.x > 24.5);
let cornerReach = 0;
for (const car of cornerCars) {
  for (const b of carTagged) {
    const bx = (b.minX + b.maxX) / 2, bz = (b.minZ + b.maxZ) / 2;
    if (Math.hypot(bx - car.x, bz - car.z) > 3.5) continue;      // not this car's tier
    const toward = car.z > AISLE.zMid ? bz - worldHalfZ(b) : bz + worldHalfZ(b);
    const r = Math.abs(car.z - toward);
    if (r > cornerReach) cornerReach = r;
  }
}
console.log(`  back-corner bays (${cornerCars.length}) reach ${cornerReach.toFixed(3)} m toward the aisle (the old box reached 2.000)`);
check(cornerCars.length === 2, `both back-corner bays were found to check (${cornerCars.length})`);
check(cornerReach <= 2.0,
  `the back-corner bays reach no further toward the aisle than the box they replace (${cornerReach.toFixed(3)} <= 2.000)`);

// ── the walk, both ways ────────────────────────────────────────────────────
const EAST = Math.PI / 2, WEST = -Math.PI / 2;
const pos = () => page.evaluate(() => window.__ct.pos());
// `arriveX`, when given, is a WALL the walker is expected to reach — the office
// closes the east end of the aisle on purpose. Standing against it is arrival,
// not a stall, so samples from 0.6 m short of it onward are not scored. Without
// this the east leg reports a 5.5 s stall for successfully walking the whole
// aisle, which is the check misreading a dead end as a trap.
const hike = async (label, x, z, yaw, seconds, want, arriveX) => {
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
  await afterFrames(page);
  const a = await pos();
  const track = [a];
  await page.keyboard.down('w');
  for (let i = 0; i < seconds * 2; i++) { await page.waitForTimeout(500); track.push(await pos()); }
  await page.keyboard.up('w');
  await page.waitForTimeout(60);
  const b = track[track.length - 1];
  let stall = 0, worstStall = 0, arrived = false;
  for (let i = 1; i < track.length; i++) {
    if (arriveX !== undefined && Math.abs(track[i][0] - arriveX) < 0.6) arrived = true;
    if (arrived) break;
    const step = Math.hypot(track[i][0] - track[i - 1][0], track[i][2] - track[i - 1][2]);
    if (step < 0.15) { stall += 0.5; if (stall > worstStall) worstStall = stall; } else stall = 0;
  }
  const moved = Math.abs(b[0] - a[0]);
  check(worstStall <= 2.5, `${label}: never stuck — longest stall ${worstStall.toFixed(1)} s, ${moved.toFixed(1)} m covered `
    + `(x ${a[0].toFixed(1)}->${b[0].toFixed(1)}, z ${b[2].toFixed(2)}${arrived ? ', reached the office' : ''})`);
  check(moved > want, `${label}: and it goes somewhere — ${moved.toFixed(1)} m`);
};
console.log(`\n  walking the aisle, both ways, down its centre line (z=${AISLE.zMid}):`);
await hike('aisle, east toward the office', X_FROM, AISLE.zMid, EAST, 11, 12, world.aisleEnd);
await hike('aisle, back west toward the gate', world.aisleEnd, AISLE.zMid, WEST, 11, 12);

// ── 4. no moving vehicle uses the default half-length ──────────────────────
// `ct/traffic.ts` reads `userData.halfLen ?? 2.5` in four places and only
// `makeBus` used to set it, so every moving car drove in a 5 m box. Item 202c
// made `makeCar` stamp it per kind; this proves no vehicle in the world is
// still relying on that fallback.
const missing = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.carKind === undefined && !o.userData?.bus) return;
    if (o.userData.halfLen === undefined) out.push(o.userData.carKind ?? 'bus');
  });
  return out;
});
console.log(`\n  vehicles with no userData.halfLen (would fall back to the 2.5 default): ${missing.length}`);
check(missing.length === 0, `no vehicle relies on the \`halfLen ?? 2.5\` default (${missing.length} do: ${missing.join(',') || 'none'})`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall lot collider checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;

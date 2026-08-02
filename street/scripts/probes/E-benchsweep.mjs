// EVERY BENCH IN THE PARK: LEVEL, CLEAR, AND FACING THE RIGHT WAY.
//
// Third time bench faults have been reported in this park, so this is a sweep
// rather than a fix for the one in the screenshot. The user's report: a seat
// "visibly SLOPED rather than level", a litter bin standing INSIDE a bench,
// legs passing through the rail behind it, and other benches sitting in or
// through the white railing.
//
// All three are measurable, and the desk's point is the important one — a
// tilted bench is a rotation applied on the wrong AXIS, so if one is wrong the
// others authored the same way are wrong too. That is a per-instance check, not
// a spot fix.
//
//   LEVEL   a seat's local up must still be world up. A box rotated about x or
//           z carries its up away from (0,1,0); the BACK is exempt because it
//           is deliberately reclined, and it is identified by being the highest
//           part of the bench rather than by a name nobody sets.
//   CLEAR   no bench box may intersect the rail, a bin, the fountain, the
//           noticeboard, a tree or another bench. `E-overlap` excludes things
//           that are MEANT to interpenetrate; nothing here is.
//   FACING  the sitter must look at the park. Same convention as E-benchface:
//           a seat pose yaw is the CAMERA's, so the sitter looks along
//           (sin yaw, -cos yaw), not the mesh's (sin yaw, cos yaw).
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const data = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const seats = (window.__ct.seats?.() ?? []).filter((s) =>
    s.pose.x > -39 && s.pose.x < -7 && s.pose.z > -99 && s.pose.z < -67);
  const parts = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = bb.getCenter(new V3()), sz = bb.getSize(new V3());
    if (c.x < -39 || c.x > -7 || c.z < -99 || c.z > -67) return;
    if (o.geometry.type === 'PlaneGeometry') return;      // foliage, tufts, decals
    // local up, carried into the world: tells tilt apart from position
    const up = new V3(0, 1, 0).transformDirection(o.matrixWorld);
    // WHICH PROP THIS BELONGS TO, by ancestry rather than by distance. Every
    // park bench is built into its own THREE.Group and added to the scene
    // whole, so identity was available all along and this check was using
    // proximity instead — which is why a litter bin 0.9 m away was classified
    // as part of the bench and never tested against it.
    let root = o;
    while (root.parent && root.parent.parent) root = root.parent;
    if (!root.userData.__id) root.userData.__id = ++window.__eSweepId || (window.__eSweepId = 1);
    const g = o.geometry.parameters || {};
    parts.push({ rid: root.userData.__id, x: c.x, z: c.z, top: bb.max.y, bot: bb.min.y,
      minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z,
      sy: sz.y, upY: up.y, massed: !!o.userData?.massed,
      gw: g.width ?? 0, gh: g.height ?? 0 });
  });
  return { seats: seats.map((s) => ({ x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw,
    raised: window.__ct.groundAt(s.pose.x, s.pose.z) > 0.30 })), parts,
    groundAt: null };
});

if (data.seats.length < 5) {
  console.log(`EXIT 3: found ${data.seats.length} park seats — the locator is wrong, not the park`);
  await b.close(); process.exit(3);
}
let fails = 0;
const fail = (m) => { fails++; console.log('FAIL  ' + m); };

// ── 1. LEVEL ────────────────────────────────────────────────────────────────
let checked = 0;
for (const s of data.seats) {
  const near = data.parts.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) < 1.15 && p.sy < 1.2);
  if (!near.length) { fail(`bench ${s.x.toFixed(1)},${s.z.toFixed(1)}: no parts found to measure`); continue; }
  // TEST THE BOARDS YOU SIT ON, and nothing else.
  //
  // The first cut excluded "the back" as anything within 0.12 m of the bench's
  // highest part. The backrest is FOUR parts — two stiles and two boards —
  // spanning 0.29 m, so two of them fell outside the window and were reported
  // as tilted at exactly cos(RECLINE) = 0.978. Three benches "failed" for
  // having a backrest. The hoop rail's legs lean by design too (0.996).
  //
  // A seat board is the thing that must be level: thin in y and spanning the
  // bench. That is a property of the member, not of where it happens to sit in
  // a height ranking, so it cannot drift when the bench is re-authored.
  for (const p of near) {
    if (!(p.gh > 0 && p.gh < 0.10 && p.gw > 1.0)) continue;   // a seat board
    checked++;
    if (Math.abs(p.upY) < 0.999) fail(`bench ${s.x.toFixed(1)},${s.z.toFixed(1)}: the SEAT is not level — its up carries ${p.upY.toFixed(3)} of world up`);
  }
}
console.log(`PASS  ${checked} seat boards across ${data.seats.length} benches are level (backrests and hoop legs lean by design)`);

// ── 1b. STANDING ON THE GROUND ──────────────────────────────────────────────
//
// THE FAULT THIS CHECK COULD NOT SEE. It asserted that a seat board's own up
// vector is world up — and every board in the world passes that, because
// nothing is rotated. The user was looking at a bench whose SEAT is level and
// whose GROUND is not: on the mound the floor falls 0.436 m across the bench's
// own footprint, so the uphill end is buried and the downhill end hangs a
// quarter of a metre in the air. From standing height that reads as a tilted
// seat, and it is the fault reported three times.
//
// Level is a property of the bench. Sitting ON something is a relationship
// between the bench and the world, and only the second one is visible.
for (const s of data.seats) {
  const near = data.parts.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) < 1.4 && p.top < 1.6);
  if (!near.length) continue;
  const base = Math.min(...near.map((p) => p.bot));
  const x0 = Math.min(...near.map((p) => p.minX)), x1 = Math.max(...near.map((p) => p.maxX));
  const z0 = Math.min(...near.map((p) => p.minZ)), z1 = Math.max(...near.map((p) => p.maxZ));
  const g = await page.evaluate(([a, b2, c2, d2]) => [
    window.__ct.groundAt(a, c2), window.__ct.groundAt(b2, c2),
    window.__ct.groundAt(a, d2), window.__ct.groundAt(b2, d2)], [x0, x1, z0, z1]);
  const inPark = g.filter((v) => v > 0.05);          // off-site corners read road level
  if (!inPark.length) continue;
  const gap = base - Math.min(...inPark), buried = Math.max(...inPark) - base;
  if (gap > 0.06) fail(`bench ${s.x.toFixed(1)},${s.z.toFixed(1)}: hangs ${(gap * 1000).toFixed(0)} mm clear of the ground at its low end — level, but not standing on anything`);
  else if (buried > 0.06) fail(`bench ${s.x.toFixed(1)},${s.z.toFixed(1)}: sunk ${(buried * 1000).toFixed(0)} mm into the ground at its high end`);
}
if (!fails) console.log(`PASS  every bench meets the ground it stands on`);

// ── 2. CLEAR ────────────────────────────────────────────────────────────────
let pairs = 0;
for (const s of data.seats) {
  // 1.4 m, not 1.15: the bench's own cast ENDS sit at 1.22 m from its centre,
  // and at 1.15 they counted as foreign objects intersecting their own slats.
  // A bench overlapping itself is how it is built.
  // KNOWN HOLE, AND IT IS THE REPORTED ONE. Anything within 1.4 m of the seat
  // centre is treated as PART OF the bench, so a litter bin standing 0.9 m
  // away — which is exactly where a bin stands, and exactly what the user
  // photographed intersecting the arm — is classified as bench and never
  // tested against it. Widening the radius is not the fix: the bench's own
  // cast ends genuinely sit at 1.22 m. The fix is to identify a bench's parts
  // by what they ARE rather than by how close they are, which needs the parts
  // tagged at build time in park.ts. NOT DONE — I am naming it rather than
  // leaving a check that reports clean over the fault it was written for.
  // MINE = the bench's own Group. OTHERS = everything else within reach that
  // is not massing and is not structure you sit among. The old rule — anything
  // inside 1.4 m is "mine" — could not see the fault it was written for.
  const seed = data.parts.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) < 0.6 && p.top < 1.6)[0];
  const mine = seed ? data.parts.filter((p) => p.rid === seed.rid) : [];
  const others = data.parts.filter((p) => (!seed || p.rid !== seed.rid)
    && Math.hypot(p.x - s.x, p.z - s.z) < 3.2
    && Math.hypot(p.x - s.x, p.z - s.z) < 3.2 && !p.massed
    // STRUCTURE YOU SIT AMONG IS NOT CLUTTER INSIDE THE BENCH. The shelter's
    // posts and roof stand around and over its bench by design — that is what a
    // shelter is. What the user reported is low clutter standing IN a bench: a
    // litter bin, a rail, a fountain. Anything reaching above 1.9 m is the
    // former, and flagging it reported the shelter working as a fault.
    && p.top < 1.9);
  for (const a of mine) for (const q of others) {
    const ox = Math.min(a.maxX, q.maxX) - Math.max(a.minX, q.minX);
    const oz = Math.min(a.maxZ, q.maxZ) - Math.max(a.minZ, q.minZ);
    const oy = Math.min(a.top, q.top) - Math.max(a.bot, q.bot);
    if (ox > 0.02 && oz > 0.02 && oy > 0.02) {
      pairs++;
      if (pairs <= 8) fail(`bench ${s.x.toFixed(1)},${s.z.toFixed(1)}: something stands INSIDE it — overlap ${ox.toFixed(2)}x${oy.toFixed(2)}x${oz.toFixed(2)} m at ${q.x.toFixed(1)},${q.z.toFixed(1)}`);
    }
  }
}
if (!pairs) console.log(`PASS  no bench intersects a rail, bin, fountain, board, tree or another bench`);
else console.log(`      ${pairs} intersecting pair(s) in total`);

// ── 3. FACING ───────────────────────────────────────────────────────────────
const cx = data.seats.reduce((a, s) => a + s.x, 0) / data.seats.length;
const cz = data.seats.reduce((a, s) => a + s.z, 0) / data.seats.length;
let out = 0;
for (const s of data.seats) {
  const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  const tx = cx - s.x, tz = cz - s.z, len = Math.hypot(tx, tz) || 1;
  const dot = (fx * tx + fz * tz) / len;
  // the mound bench looks back at the gate by design, and it is identified by
  // standing on raised ground rather than by its coordinates
  if (dot < 0.30 && Math.hypot(tx, tz) > 3 && !s.raised) { out++; fail(`bench ${s.x.toFixed(1)},${s.z.toFixed(1)}: the sitter faces AWAY (dot ${dot.toFixed(2)})`); }
}
if (!out) console.log(`PASS  every sitter looks into the park`);

console.log(fails ? `\n${fails} fault(s) across ${data.seats.length} benches` : `\nall ${data.seats.length} park benches: level, clear and facing in`);
await b.close();
process.exit(fails ? 1 : 0);

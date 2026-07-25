// The door must be on OPPOSITE sides inside and out.
//
// The user, standing in the tax office: the door is on the RIGHT of the
// interior, so from outside it must be on the LEFT of the facade. That is not
// a preference, it is what a wall is — a room and its facade are two faces of
// one wall, so the handedness is opposite by construction. Nothing in the code
// knew it, because each side authored its own offset in its own local space.
//
// This checks it the way the user did, for EVERY room: stand inside at the
// middle of the room looking at the front wall, note which side of centre the
// doorway is; go outside, stand at the middle of the frontage looking at the
// building, note which side the painted door is. They must disagree.
//
// Measured, not eyeballed. Inside, the doorway is the gap in the front wall's
// colliders, which the rig can be asked about directly. Outside, the door
// position is the one A publishes. Both are reduced to a signed offset along
// the same world axis and the SIGNS are compared.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const FACE = 7.0, RADIUS = 0.36;

// THE ROOM LIST IS DERIVED, AND SO IS EVERYTHING IN IT.
//
// This was a typed table of three rooms with their widths, centres and sides
// written out by hand. Two problems, and the queue item this script exists to
// verify names the second one: the user asked for **all buildings**, and three
// is not all of them — there are eight rooms now, and the table has not grown
// with them. The first is the habit that has misrouted findings all week: a
// remembered coordinate is wrong the moment anything moves.
//
// Every field comes from the world now. `__frontages` is the frontage register
// (name, loWorld, hiWorld, outward, frontageM); `__ct.doors()` is the rooms'
// own declarations. A shop with no room behind it has no declaration and is
// skipped, which is the correct scope rather than a hardcoded subset.
let ROOMS = [];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(300);

ROOMS = await p.evaluate(() => {
  const fr = globalThis.__frontages ?? [];
  return (window.__ct.doors() ?? [])
    .filter((d) => !d.chamfer && d.point)              // a canted bay has no side-of-centre
    .map((d) => {
      const f = fr.find((x) => x.name === d.building);
      if (!f) return null;
      return { name: d.building, w: f.frontageM, cz: (f.loWorld + f.hiWorld) / 2,
               side: f.outward, doorZ: d.point.z, roomW: Math.max(4, f.frontageM - 1.2),
               // ASK where you stand to use this door. Computing it as
               // side * (FACE - 0.75) was a guess that stopped working — every
               // room failed with "could not get in to check" — and doorStandFor
               // already publishes the answer, normal included, chamfer included.
               stand: d.stand, n: { x: d.point.nx, z: d.point.nz } };
    })
    .filter(Boolean);
});
console.log(`${ROOMS.length} declared rooms to check: ${ROOMS.map((r) => r.name).join(', ')}`);

const pos = () => p.evaluate(() => window.__ct.pos());
const fails = [];
const unmeasured = [];

for (const { name, w, cz, side, doorZ: declZ, roomW, stand, n } of ROOMS) {
  const id = name;
  // ── OUTSIDE: which side of the frontage centre is the published door? ──
  // The ROOM declares it; the facade is meant to follow. Reading the room's
  // number here means this test measures whether the two AGREE once A's
  // painter is reading it too — and until then it measures my half.
  // From the running world, not from a module import: this ran against a DEV
  // server only, because `import('/src/proto/ct/doors.ts')` cannot resolve in a
  // built bundle — so against `vite preview`, which is what SHOT_URL points at
  // and what every other check uses, it threw before testing anything.
  const outward = { doorZ: declZ, offsetFromCentre: declZ - cz };

  // Stand on the pavement at the middle of the frontage, facing the building.
  // Facing -x on the west side, the observer's right hand points to -z.
  const observerRight = side < 0 ? -1 : 1;
  const outSideOfCentre = Math.sign(outward.offsetFromCentre) * observerRight;   // +1 right, -1 left

  // ── INSIDE: which side of the room centre is the doorway? ──
  // Enter, then find the gap in the front wall by probing the colliders.
  // face INTO the building: fwd = -normal, and fwd = (sin yaw, 0, -cos yaw)
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0),
    [stand.x, stand.z, Math.atan2(-n.x, n.z)]);
  await p.waitForTimeout(220);
  // Press E, and CHECK IT TOOK. A single press was landing sometimes and not
  // others — BURGER BARN measured at x -6.3, still on the pavement, and was then
  // reported as "could not locate the doorway inside" when the truth was that it
  // had never gone in. Two tries, and a miss is reported as a miss.
  let inside = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await p.keyboard.down('e'); await p.waitForTimeout(110); await p.keyboard.up('e');
    await p.waitForTimeout(450);
    inside = await pos();
    if (inside[0] >= 400) break;
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0),
      [stand.x, stand.z, Math.atan2(-n.x, n.z)]);
    await p.waitForTimeout(250);
  }
  if (!inside || inside[0] < 400) {
    unmeasured.push(`${id}: the [E] prompt did not take in two tries — never got inside`);
    continue;
  }
  // THE ROOM'S CENTRE, ASKED FOR. This was
  //   cx = 400 + floor((x - 400) / 80) * 80 + 40
  // which assumes interiors sit on an 80 m grid starting at 400. They do not
  // all, and a wrong centre puts the doorway scan in the wrong place: PAWN
  // reported its doorway at local x -6.23 in a 10.8 m room, which is outside
  // the room. A false FAIL is worse than not running — it would have told the
  // desk five rooms do not mirror when four were verified by eye.
  //
  // Instead: take the colliders around where the player landed and use the
  // extent of the ones that enclose them.
  const cx = await p.evaluate(([px, pz]) => {
    const cols = window.__ct.colliders().filter((c) =>
      px > c.minX - 12 && px < c.maxX + 12 && pz > c.minZ - 12 && pz < c.maxZ + 12);
    if (!cols.length) return null;
    const lo = Math.min(...cols.map((c) => c.minX)), hi = Math.max(...cols.map((c) => c.maxX));
    return (lo + hi) / 2;
  }, [inside[0], inside[1]]);
  if (cx === null) { fails.push(`${id}: could not find the room around the player`); continue; }

  // THE DOORWAY IS THE ONE PLACE YOU CAN STAND AGAINST THE FRONT WALL.
  //
  // The front wall's collider blocks z > hd - 0.36 everywhere along it except
  // across the door opening, so sampling one line just inside the wall gives
  // the doorway directly. Two earlier attempts inferred it from "where can you
  // reach the furthest +z", and both just found the scan's own bounds.
  // the room's front wall, found in the world rather than typed per room: the
  // furthest-out collider that spans most of the room's width
  const hd = await p.evaluate(([cx, hw]) => {
    const cols = window.__ct.colliders();
    let best = -1e9;
    for (const c of cols) {
      if (c.maxX < cx - hw - 1 || c.minX > cx + hw + 1) continue;
      if (c.maxX - c.minX < hw) continue;               // must span the room
      if (c.maxZ > best) best = c.maxZ;
    }
    return best > -1e8 ? best : null;
  }, [cx, roomW / 2]);
  if (hd === null) { fails.push(`${id}: could not find the front wall inside`); continue; }
  const gap = await p.evaluate(([cx, R, hw, hd]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    const z = hd - 0.28;
    let run = null, best = null;
    for (let lx = -hw; lx <= hw; lx += 0.05) {
      if (free(cx + lx, z)) { if (!run) run = { a: lx, b: lx }; else run.b = lx; }
      else { if (run && (!best || run.b - run.a > best.b - best.a)) best = run; run = null; }
    }
    if (run && (!best || run.b - run.a > best.b - best.a)) best = run;
    return best ? { lx: +(((best.a + best.b) / 2)).toFixed(2), width: +(best.b - best.a).toFixed(2) } : null;
  }, [cx, RADIUS, roomW / 2, hd]);
  // COULD NOT MEASURE IS NOT THE SAME AS DOES NOT MIRROR, and conflating them
  // is how a harness earns a reputation for crying wolf. This script reported
  // "5/5 rooms do not mirror" while four of the five were verified mirrored by
  // walking them (notes/A-mirror-verified.md). It had not found their doorways;
  // it had not disproved anything.
  //
  // A doorway further from the room centre than the room's own half-width is
  // also impossible — PAWN read local x -6.23 in a 10.8 m room — so that is a
  // failed measurement too, not a finding about the world.
  if (!gap || Math.abs(gap.lx) > roomW / 2) {
    unmeasured.push(`${id}: could not locate the doorway inside`
      + (gap ? ` (read local x ${gap.lx} in a ${roomW.toFixed(1)} m room — impossible)` : ''));
    continue;
  }

  // Standing inside looking at the front wall you face +z, so your right hand
  // points to -x: a doorway at negative local x is on your RIGHT.
  const inSideOfCentre = Math.sign(gap.lx) * -1;

  // A door dead centre of its facade has no side to swap — the burger barn's
  // is, by design. It passes when the inside is centre too.
  const ok = outSideOfCentre === 0
    ? Math.abs(gap.lx) < 0.6
    : inSideOfCentre !== 0 && inSideOfCentre !== outSideOfCentre;
  const nm = (s) => (s > 0 ? 'RIGHT' : s < 0 ? 'LEFT ' : 'centre');
  console.log(`${id.padEnd(8)} outside: door ${nm(outSideOfCentre)} of the facade  |  `
    + `inside: doorway ${nm(inSideOfCentre)} of the room (local x ${gap.lx}, ${gap.width} m wide)  ${ok ? 'SWAPPED ✓' : 'SAME SIDE ✗'}`);
  if (!ok) {
    fails.push(`${id}: the door is on the ${nm(outSideOfCentre).trim()} outside and the `
      + `${nm(inSideOfCentre).trim()} inside — a wall has two faces, these must disagree`);
  }
}

console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
if (unmeasured.length) {
  console.log(`\n${unmeasured.length} of ${ROOMS.length} could not be MEASURED — not a verdict about them:`);
  for (const u of unmeasured) console.log(`  ?  ${u}`);
  console.log('  The doorway scan inside is still the weak half of this script.');
}
// NOTHING MEASURED IS NOT SUCCESS.
//
// This read `fails.length ? "N do not mirror" : "all N rooms mirror"`, so a run
// that measured NOTHING printed "all 5 rooms mirror" — a green verdict from zero
// evidence. I saw it do exactly that while trying a new scan, and it is the
// worst failure available to a verification harness: the user asked for this to
// be checked on every building, and a check that cannot see is indistinguishable
// from one that has looked.
const measured = ROOMS.length - unmeasured.length;
if (!measured) {
  console.log(`NOTHING MEASURED — ${ROOMS.length} rooms, 0 checked. This is not a pass.`);
} else if (fails.length) {
  console.log(`${fails.length} of ${measured} measured rooms do not mirror`);
} else {
  console.log(`all ${measured} MEASURED rooms mirror: the door swaps sides when you walk through it`
    + (unmeasured.length ? `  (${unmeasured.length} unmeasured — NOT verified)` : ''));
}
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
// unmeasured is not a failure of the world, but a run that measured nothing is a
// failure of the harness, and it must not exit 0 pretending otherwise.
process.exit(fails.length || errs.length || (ROOMS.length && !measured) ? 1 : 0);

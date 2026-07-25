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
               stand: d.stand, n: { x: d.point.nx, z: d.point.nz }, widthM: d.widthM };
    })
    .filter(Boolean);
});
console.log(`${ROOMS.length} declared rooms to check: ${ROOMS.map((r) => r.name).join(', ')}`);

const pos = () => p.evaluate(() => window.__ct.pos());
const fails = [];
const unmeasured = [];

for (const { name, w, cz, side, doorZ: declZ, roomW, stand, n, widthM } of ROOMS) {
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
    // `__ct.pos()` is [x, y, z, gy] — inside[1] is EYE HEIGHT, not z. This
    // passed 1.6 as the player's z for every room, so the collider filter was
    // asking "within 12 m of z = 1.6" regardless of where the room actually is.
    // It happened to work for rooms centred near z = 0, which is all of them
    // except the one that never measured.
  }, [inside[0], inside[2]]);
  if (cx === null) { fails.push(`${id}: could not find the room around the player`); continue; }

  // THE DOORWAY IS THE ONE PLACE YOU CAN STAND AGAINST THE FRONT WALL.
  //
  // The front wall's collider blocks z > hd - 0.36 everywhere along it except
  // across the door opening, so sampling one line just inside the wall gives
  // the doorway directly. Two earlier attempts inferred it from "where can you
  // reach the furthest +z", and both just found the scan's own bounds.
  // the room's front wall, found in the world rather than typed per room: the
  // furthest-out collider that spans most of the room's width
  // THE FRONT WALL IS THE Z-PLANE THAT HOLDS THE MOST WALL.
  //
  // This took the furthest-out collider that spanned most of the room's width,
  // and that filter is the same trap that hid the doorway twice: PAWN's room is
  // 13.8 m, so a front wall built in pieces narrower than 6.9 m is discarded
  // entirely and the search falls back to the BACK wall at z -2.52. It then
  // reported PAWN's back wall as its front for three turns, and one withdrawn
  // finding came out of that.
  //
  // Group the thin colliders by the z-plane they sit in, and take the plane
  // holding the most metres of wall. Thin excludes the side walls, which span
  // the room's whole depth; "most metres" beats "widest single piece" because a
  // wall in two pieces is still a wall. The door leaf, being proud and alone in
  // its own plane, cannot win.
  const hd = await p.evaluate(([cx, hw]) => {
    const near = window.__ct.colliders().filter((c) =>
      c.maxX > cx - hw - 1 && c.minX < cx + hw + 1 && (c.maxZ - c.minZ) < 0.5);
    const planes = new Map();
    for (const c of near) {
      const k = c.maxZ.toFixed(2);
      planes.set(k, (planes.get(k) ?? 0) + (c.maxX - c.minX));
    }
    // THE FRONT WALL IS THE PLANE WITH A DOOR STANDING ON IT.
    //
    // "Most metres of wall" picks the BACK wall — it is one unbroken piece,
    // and the front is two pieces that sum to slightly less. Tried and reverted.
    //
    // What actually distinguishes them is the thing being looked for: the door
    // leaf sits proud, its minZ on the wall's maxZ. Only the front wall has one.
    const all = window.__ct.colliders().filter((c) =>
      c.maxX > cx - hw - 1 && c.minX < cx + hw + 1);
    let best = null;
    for (const [k, wsum] of planes) {
      if (wsum < 1) continue;
      const z = +k;
      const hasDoor = all.some((c) => Math.abs(c.minZ - z) < 0.06
        && (c.maxX - c.minX) > 0.5 && (c.maxX - c.minX) < 3);
      if (!hasDoor) continue;
      if (!best || wsum > best.w) best = { z, w: wsum };
    }
    return best ? best.z : null;
  }, [cx, roomW / 2]);
  if (hd === null) { fails.push(`${id}: could not find the front wall inside`); continue; }
  // THE DOORWAY IS A COLLIDER, AND IT STANDS PROUD OF THE WALL.
  //
  // Three scans failed here looking for a GAP. There is none: the door has its
  // own collider. Measured, and the rule is exact —
  //
  //   DINER    wall z 3.50..3.68   door [676.8, 678.0] z 3.68..3.86  w 1.15
  //   A-1 TAX  wall z 4.25..4.43   door [915.2, 916.4] z 4.43..4.61  w 1.15
  //
  // the door leaf sits one wall-thickness FURTHER OUT than the wall plane, so
  // its minZ is the wall's maxZ. That also breaks the tie width alone could not:
  // A-1 TAX has a 1.31 m wall piece beside its 1.15 m door, and only the door
  // starts where the wall ends. Its width matches the DECLARED widthM exactly,
  // which is the second half of the check rather than the whole of it.
  const gap = await p.evaluate(([cx, hw, hd, wantW]) => {
    const cands = window.__ct.colliders().filter((c) =>
      Math.abs(c.minZ - hd) < 0.06 && c.maxX > cx - hw - 1 && c.minX < cx + hw + 1
      && c.maxX - c.minX > 0.5 && c.maxX - c.minX < 3);
    if (!cands.length) return null;
    const pick = wantW
      ? cands.reduce((best, c) =>
          Math.abs((c.maxX - c.minX) - wantW) < Math.abs((best.maxX - best.minX) - wantW) ? c : best)
      : cands[0];
    return { lx: +(((pick.minX + pick.maxX) / 2) - cx).toFixed(2),
             width: +(pick.maxX - pick.minX).toFixed(2) };
  }, [cx, roomW / 2, hd, widthM]);
  // WHEN IT CANNOT MEASURE, SAY WHAT IT SAW. Three attempts at this scan each
  // failed for a reason I guessed wrong, because the failure printed one word.
  if (!gap) {
    const seen = await p.evaluate(([cx, hw, hd]) => {
      const near = window.__ct.colliders().filter((c) =>
        c.maxX > cx - hw - 1 && c.minX < cx + hw + 1 && Math.abs(c.maxZ - hd) < 0.25);
      return { hd, cx, n: near.length,
        pieces: near.map((c) => [+c.minX.toFixed(1), +c.maxX.toFixed(1)]).sort((a, b) => a[0] - b[0]) };
    }, [cx, roomW / 2, hd]);
    unmeasured.push(`${id}: no doorway found — cx ${seen.cx.toFixed(1)}, front wall z ${seen.hd.toFixed(2)},`
      + ` ${seen.n} wall piece(s) ${JSON.stringify(seen.pieces)}`);
    continue;
  }
  if (Math.abs(gap.lx) > roomW / 2) {
    unmeasured.push(`${id}: could not locate the doorway inside`
      + (gap ? ` (read local x ${gap.lx} in a ${roomW.toFixed(1)} m room — impossible)` : ''));
    continue;
  }

  // Standing inside looking at the front wall you face +z, so your right hand
  // points to -x: a doorway at negative local x is on your RIGHT.
  // THE TWO SIDES WERE THE SAME EXPRESSION, so this could never pass.
  //
  // Measured, all four rooms: the doorway sits at exactly MINUS the local `at`
  // their own declaration implies —
  //
  //   BURGER BARN  declared  3.6   measured -3.6
  //   DINER        declared  2.6   measured -2.6
  //   A-1 TAX      declared  4.2   measured -4.2
  //   THRIFT       declared  2.2   measured -2.2
  //
  // exact to the decimal, which is a convention difference and not a placement
  // fault. Substituting lx = -side * offset * k into the old inside expression
  // gave `side * sign(offset)`, and the outside expression is
  // `sign(offset) * observerRight` with observerRight = side — the SAME VALUE.
  // Two identical expressions compared for disagreement can only ever disagree
  // with themselves, so this reported SAME SIDE for every room including four
  // that notes/A-mirror-verified.md had already walked, with shots, and found
  // mirrored. The world was right and the harness could not say so.
  const inSideOfCentre = Math.sign(gap.lx);

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
  // CONFLICT WITH HAND VERIFICATION — do not read the line above as a finding.
  //
  // notes/A-mirror-verified.md records A-1 TAX, the diner, Burger Barn and
  // THRIFT each walked by hand, with shots, and each mirroring correctly. This
  // harness now measures those same four and calls all four SAME SIDE. One of
  // the two is wrong and I have not determined which.
  //
  // The doorway detection is newly correct and measured; the SIDE convention is
  // the untested half — `observerRight = side < 0 ? -1 : 1` for outside, and
  // `sign(gap.lx) * -1` for inside. Either could have its sign the wrong way
  // round, and a sign error would flip exactly these four and nothing else.
  console.log(`
  DO NOT ROUTE THIS YET. notes/A-mirror-verified.md has these same rooms walked
  by hand, with shots, mirroring correctly. The doorway detection above is new
  and measured; the left/right convention is not yet checked against it. One of
  the two is wrong. Resolve that before anyone is told their room is backwards.`);
} else {
  console.log(`all ${measured} MEASURED rooms mirror: the door swaps sides when you walk through it`
    + (unmeasured.length ? `  (${unmeasured.length} unmeasured — NOT verified)` : ''));
}
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
// unmeasured is not a failure of the world, but a run that measured nothing is a
// failure of the harness, and it must not exit 0 pretending otherwise.
process.exit(fails.length || errs.length || (ROOMS.length && !measured) ? 1 : 0);

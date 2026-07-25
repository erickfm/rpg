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

const FACE = 7.0, RADIUS = 0.36;

// name, frontage width, centre z, side (-1 west, +1 east), room id
const ROOMS = [
  ['DINER', 12, -49.5, -1, 'diner', 7.0],
  ['BURGER BARN', 16, -29, -1, 'burger', 8.5],
  ['THRIFT', 12.5, -61.75, -1, 'thrift', 6.5],
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4185/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(300);

const pos = () => p.evaluate(() => window.__ct.pos());
const fails = [];

for (const [name, w, cz, side, id, D] of ROOMS) {
  // ── OUTSIDE: which side of the frontage centre is the published door? ──
  // The ROOM declares it; the facade is meant to follow. Reading the room's
  // number here means this test measures whether the two AGREE once A's
  // painter is reading it too — and until then it measures my half.
  const outward = await p.evaluate(async ([name]) => {
    const dm = await import('/src/proto/ct/doors.ts');
    const decl = dm.declaredDoors().find((x) => x.building === name);
    const doorZ = dm.doorWorldFor(name);
    return { doorZ, offsetFromCentre: doorZ - decl.cz };
  }, [name]);

  // Stand on the pavement at the middle of the frontage, facing the building.
  // Facing -x on the west side, the observer's right hand points to -z.
  const observerRight = side < 0 ? -1 : 1;
  const outSideOfCentre = Math.sign(outward.offsetFromCentre) * observerRight;   // +1 right, -1 left

  // ── INSIDE: which side of the room centre is the doorway? ──
  // Enter, then find the gap in the front wall by probing the colliders.
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, 0.14, 0),
    [side * (FACE - 0.75), outward.doorZ]);
  await p.waitForTimeout(220);
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(380);
  const inside = await pos();
  if (inside[0] < 400) { fails.push(`${id}: could not get in to check`); continue; }
  const cx = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;

  // THE DOORWAY IS THE ONE PLACE YOU CAN STAND AGAINST THE FRONT WALL.
  //
  // The front wall's collider blocks z > hd - 0.36 everywhere along it except
  // across the door opening, so sampling one line just inside the wall gives
  // the doorway directly. Two earlier attempts inferred it from "where can you
  // reach the furthest +z", and both just found the scan's own bounds.
  const roomW = Math.max(4, (await p.evaluate(async ([name, w]) => {
    const m = await import('/src/proto/ct/tex-world.ts');
    return m.frontageOf(name, w).frontageM;
  }, [name, w])) - 1.2);
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
  }, [cx, RADIUS, roomW / 2, D / 2]);
  if (!gap) { fails.push(`${id}: found no doorway inside`); continue; }

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
console.log(fails.length ? `${fails.length}/${ROOMS.length} rooms do not mirror`
  : `all ${ROOMS.length} rooms mirror: the door swaps sides when you walk through it`);
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

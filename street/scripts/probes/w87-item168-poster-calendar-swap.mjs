// ITEM 168 — DID THE POSTER AND THE CALENDAR ACTUALLY SWAP WALLS?
//
// The user: *"put the calendar where the poster is and the poster where the
// calendar is."*
//
// Four ways this fails, and THREE OF THEM ARE INVISIBLE TO "is the mesh there?":
//
//   ENTOMBED   each wall is a BOX 0.14 deep and AZI(2)/AZI(5.5) are its
//              CENTRELINES, not its faces. A hanging at the centreline is
//              inside the plaster: present, visible:true, right x and y, and
//              you cannot see it. So this checks the hanging is on the ROOM
//              side of its own wall's face, with a real clearance.
//   MIRRORED   `texM` is DoubleSide, so the wrong `rotation.y` does not remove
//              anything — it shows the artwork REVERSED. Checked by taking the
//              plane's own +z basis vector out of `matrixWorld` and asking
//              whether it points INTO the room. A rotation check against a
//              literal PI would pass a plane on the wrong wall; this cannot.
//   OVERLAP    the flyer (0.52 x 0.70) is moving into the slot the calendar
//              (0.30 x 0.40) vacated, on the wall that also carries the three
//              snapshots. Bigger object into a smaller slot is the direction
//              that fouls, so their footprints are intersected explicitly.
//   WRONG WALL the swap is the point. Each is checked against the wall it is
//              supposed to have moved TO, not merely against "a wall".
//
// POPULATION FLOOR. Everything is scoped to room 301's own volume and each
// object must be found EXACTLY ONCE. A selector that matches 0 things reports
// green in a probe that only ever loops over what it found (GOTCHAS 34), and
// one that matches 5 is measuring the wrong world.
//
// SELF-TEST BOTH SIGNS (`--selftest`). Three deliberate breakages are applied
// in the page and each must be CAUGHT by the check that owns it — un-rotate the
// poster (mirrored), push it back to its wall's centreline (entombed), and slide
// it onto the snapshots (overlap). A check that has never been watched failing
// is a check you will argue with (GOTCHAS 27).
//
//   SHOT_URL=http://localhost:4430/ node scripts/probes/w87-item168-poster-calendar-swap.mjs
//   SHOT_URL=http://localhost:4430/ node scripts/probes/w87-item168-poster-calendar-swap.mjs --selftest
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const SELFTEST = process.argv.includes('--selftest');
mkdirSync('shots', { recursive: true });

// ct/apartment.ts:124 — the room's origin, and the only numbers copied here.
// Everything else below is derived from them the way the source derives it.
const APT_X = 200, APT_Z = -20, ST = 2.7;
const AX = (lx) => APT_X + lx, AZI = (lz) => APT_Z + lz;
const RY = 2 * ST + 0.007;
// Each wall is a 0.14-deep box; these are the ROOM-SIDE FACES, not centrelines.
const SOUTH_FACE = AZI(2 + 0.07);        // room is at +z from here
const NORTH_FACE = AZI(5.5 - 0.07);      // room is at -z from here
const ROOM_MID_Z = (SOUTH_FACE + NORTH_FACE) / 2;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 740 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(page);
await page.evaluate(() => window.__ct.clock(13, 30));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

/** Find the three wall hangings of 301 by their PlaneGeometry footprint,
 *  scoped to the room's own volume. Returns world position + the plane's own
 *  +z basis vector, which is what "which way does it face" actually means. */
const findAll = () => page.evaluate(([ax, ry]) => {
  const want = { poster: [0.52, 0.70], cal: [0.30, 0.40], snaps: [0.40, 0.153] };
  const out = { poster: [], cal: [], snaps: [] };
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'PlaneGeometry') return;
    const gp = n.geometry.parameters, e = n.matrixWorld.elements;
    const x = e[12], y = e[13], z = e[14];
    // room 301's own volume — west wall face to the doorway, floor to ceiling
    if (x < ax - 3.2 || x > ax + 0.1) return;
    if (y < ry || y > ry + 2.6) return;
    if (z < -18.1 || z > -14.4) return;
    for (const [k, [w, h]] of Object.entries(want)) {
      if (Math.abs(gp.width - w) < 0.005 && Math.abs(gp.height - h) < 0.005) {
        // third column of matrixWorld = the plane's local +z axis in world space
        const nx = e[8], ny = e[9], nz = e[10];
        const len = Math.hypot(nx, ny, nz) || 1;
        out[k].push({ x, y, z, w: gp.width, h: gp.height,
                      n: { x: nx / len, y: ny / len, z: nz / len },
                      visible: n.visible });
      }
    }
  });
  return out;
}, [AX(0), RY]);

const run = async (label) => {
  const f = await findAll();
  console.log(`\n── ${label} ──`);
  for (const k of ['poster', 'cal', 'snaps']) {
    console.log(`  ${k.padEnd(7)} found ${f[k].length}` +
      (f[k].length === 1 ? `  at x ${f[k][0].x.toFixed(3)} y ${f[k][0].y.toFixed(3)} z ${f[k][0].z.toFixed(3)}  normal z ${f[k][0].n.z.toFixed(2)}` : ''));
  }
  // ── population floor, before a single claim is made about any of them ──
  const pop = ['poster', 'cal', 'snaps'].every((k) => f[k].length === 1);
  report('exactly one poster, one calendar and three-snapshot strip in 301',
    pop, `poster ${f.poster.length}, cal ${f.cal.length}, snaps ${f.snaps.length} (each must be 1)`);
  if (!pop) return f;

  const P = f.poster[0], C = f.cal[0], S = f.snaps[0];

  // ── THE SWAP ITSELF ────────────────────────────────────────────────────
  report('the POSTER is on the NORTH wall (it was on the south)',
    Math.abs(P.z - (NORTH_FACE - 0.015)) < 0.004,
    `poster z ${P.z.toFixed(3)}, north hanging plane ${(NORTH_FACE - 0.015).toFixed(3)}`);
  report('the CALENDAR is on the SOUTH wall (it was on the north)',
    Math.abs(C.z - (SOUTH_FACE + 0.015)) < 0.004,
    `calendar z ${C.z.toFixed(3)}, south hanging plane ${(SOUTH_FACE + 0.015).toFixed(3)}`);
  report('they took each other\'s x/y — the poster has the calendar\'s',
    Math.abs(P.x - AX(-2.45)) < 0.004 && Math.abs(P.y - (RY + 1.66)) < 0.004,
    `poster x ${P.x.toFixed(3)} y ${P.y.toFixed(3)}, want ${AX(-2.45).toFixed(3)} / ${(RY + 1.66).toFixed(3)}`);
  report('…and the calendar has the poster\'s',
    Math.abs(C.x - AX(-1.05)) < 0.004 && Math.abs(C.y - (RY + 1.55)) < 0.004,
    `calendar x ${C.x.toFixed(3)} y ${C.y.toFixed(3)}, want ${AX(-1.05).toFixed(3)} / ${(RY + 1.55).toFixed(3)}`);

  // ── ENTOMBED: is it proud of its own wall's face, on the room side? ────
  const pClear = NORTH_FACE - P.z;          // room is at -z from the north face
  const cClear = C.z - SOUTH_FACE;          // room is at +z from the south face
  report('the poster is PROUD of the north wall, not entombed in the plaster',
    pClear > 0.005 && pClear < 0.05, `${(pClear * 1000).toFixed(1)} mm into the room (want 5…50)`);
  report('the calendar is PROUD of the south wall, not entombed in the plaster',
    cClear > 0.005 && cClear < 0.05, `${(cClear * 1000).toFixed(1)} mm into the room (want 5…50)`);

  // ── MIRRORED: does each plane's own +z axis point INTO the room? ────────
  const faces = (m) => m.n.z * (ROOM_MID_Z - m.z) > 0;
  report('the poster is not MIRRORED — its face turns into the room',
    faces(P), `normal z ${P.n.z.toFixed(2)} from z ${P.z.toFixed(3)} toward room mid ${ROOM_MID_Z.toFixed(3)}`);
  report('the calendar is not MIRRORED — its face turns into the room',
    faces(C), `normal z ${C.n.z.toFixed(2)} from z ${C.z.toFixed(3)} toward room mid ${ROOM_MID_Z.toFixed(3)}`);
  report('the snapshots still face into the room (untouched control)',
    faces(S), `normal z ${S.n.z.toFixed(2)}`);

  // ── OVERLAP: the flyer against the snapshots it now shares a wall with ──
  const gapX = Math.abs(P.x - S.x) - (P.w + S.w) / 2;
  const gapY = Math.abs(P.y - S.y) - (P.h + S.h) / 2;
  report('the poster does not overlap the three snapshots',
    gapX > 0 || gapY > 0,
    `clear by ${(Math.max(gapX, gapY) * 1000).toFixed(0)} mm (x gap ${(gapX * 1000).toFixed(0)}, y gap ${(gapY * 1000).toFixed(0)}; either one clears it)`);
  report('the poster stays clear of the west wall',
    P.x - P.w / 2 > AX(-3.2), `left edge ${(P.x - P.w / 2).toFixed(3)} vs wall face ${AX(-3.2).toFixed(3)}`);
  report('both hangings are visible:true', P.visible && C.visible,
    `poster ${P.visible}, calendar ${C.visible}`);
  return f;
};

await run('301, as built');

// ── THE NEGATIVE CASES ────────────────────────────────────────────────────
if (SELFTEST) {
  console.log('\n════ SELFTEST: three deliberate breakages, each must be CAUGHT ════');
  const before = fails;
  const mutate = (kind) => page.evaluate(([k, nf]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let m = null;
    s.traverse((n) => {
      if (n.isMesh && n.geometry?.type === 'PlaneGeometry'
        && Math.abs(n.geometry.parameters.width - 0.52) < 0.005
        && Math.abs(n.geometry.parameters.height - 0.70) < 0.005
        && n.matrixWorld.elements[14] < -14.4 && n.matrixWorld.elements[14] > -18.1) m = n;
    });
    if (!m) return 'no poster to mutate';
    if (k === 'mirror') m.rotation.y = 0;                 // the DoubleSide trap
    if (k === 'entomb') m.position.z = nf;                // into the plaster
    if (k === 'overlap') m.position.x = 200 - 1.62;       // onto the snapshots
    m.updateMatrixWorld(true);
    return 'ok';
  }, [kind, NORTH_FACE + 0.02]);

  for (const [kind, owner] of [['mirror', 'MIRRORED'], ['entomb', 'ENTOMBED'], ['overlap', 'OVERLAP']]) {
    const f0 = fails;
    console.log(`\n  ${await mutate(kind)} — mutation: ${kind}`);
    await run(`selftest: ${kind}`);
    console.log(fails > f0
      ? `  SELFTEST ${owner}  CAUGHT (${fails - f0} check(s) went red)`
      : `  SELFTEST ${owner}  *** NOT CAUGHT — THE CHECK IS ASLEEP ***`);
    if (fails === f0) console.log('  ^ this is a broken instrument, not a clean world');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
    await waitPainted(page);
  }
  console.log(`\nselftest raised ${fails - before} failures against a world that is fine — that is the point.`);
  console.log(errors.length ? `console errors: ${errors.length}` : 'console errors: 0');
  await browser.close();
  process.exit(0);
}

// ── LOOK AT IT. Two shots, because the walls FACE EACH OTHER ──────────────
// No single camera can hold both: the poster's wall and the calendar's wall are
// opposite faces of the same room, so a view containing one has the other
// behind it. Two stations from the middle of 301, turning on the spot.
// The rig's forward is (sin yaw, 0, -cos yaw): yaw PI looks +z (north wall,
// the poster), yaw 0 looks -z (south wall, the calendar).
for (const [tag, yaw, what] of [['north-poster', Math.PI, 'the poster, above the bed'],
                                ['south-calendar', 0, 'the calendar, over the TV']]) {
  await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0.13),
    [AX(-1.9), ROOM_MID_Z, yaw]);
  await page.waitForTimeout(450);
  await waitPainted(page);
  await page.screenshot({ path: `shots/w87-168-${tag}.png` });
  console.log(`  shots/w87-168-${tag}.png — ${what}`);
}

console.log(`\nconsole errors: ${errors.length}`);
console.log(fails === 0
  ? '\nSWAP GREEN — calendar south, poster north, both proud of their wall, neither mirrored, nothing overlapping'
  : `\n${fails} FAILURE(S)`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);

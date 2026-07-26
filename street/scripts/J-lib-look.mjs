// PICTURES OF THE LIBRARY INTERIOR — an investigation, not an assertion.
// Named per GOTCHAS §24: owner-prefixed, and "-look" so nobody mistakes it for
// a check. It walks in the way a player does and stands where the user's three
// 2026-07-25 22:0x screenshots were taken from.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('J-lib-look', ['shots', 'all']);
void mode;
const URL = process.env.SHOT_URL ?? 'http://localhost:4192/';
const OUT = process.argv[3] ?? 'shots/J-lib';

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1034, height: 757 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));

// A WARM-UP, ONCE, BEFORE THE FIRST SHOT.
//
// `__ct` existing means the world has been BUILT, not that it has been DRAWN.
// The first frames after load are compiling shaders and uploading ~950
// textures, and a screenshot taken inside that window comes back BLACK with a
// perfectly correct HUD painted over it — which is exactly what fooled me into
// hunting a regression in ct/civic.ts. Measured here: black at 0.3 s from load,
// correct at 3 s, from the identical warp. Per-shot settling does not help,
// because the cost is paid once and it is paid at the beginning.
await page.waitForTimeout(3000);

// WAIT FOR THE THING TO STOP MOVING, NOT FOR MILLISECONDS — GOTCHAS §30.
//
// This shot the library forecourt BLACK three runs in a row on a busy machine
// and I spent a round looking for a regression in somebody else's file before
// measuring what was actually happening. A warp sets x and z and asks for a
// ground height; the FLOOR PICKER then walks the camera to it over frames, and
// on the library's flight that is a 0.85 m climb:
//
//   warp(-6, -13, …, gy 0.14)   after 300 ms   gy 0.14   picture BLACK
//                               after 3000 ms  gy 0.99   picture correct
//
// So the camera was still under the forecourt when the shutter went. Sleeping
// longer would have "fixed" it on this machine and lost it again on a busier
// one, which is the whole of §30. Poll gy until it stops changing instead —
// and START by waiting for it to move, or a warp that needs no climb is
// satisfied instantly by the value it began with.
const settle = async (capMs = 6000) => {
  const t0 = Date.now();
  let last = null, still = 0;
  while (Date.now() - t0 < capMs) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const gy = (await page.evaluate(() => window.__ct.pos()))[3];
    still = (last !== null && Math.abs(gy - last) < 0.001) ? still + 1 : 0;
    last = gy;
    if (still >= 5) return;
  }
  console.warn(`  settle: gy never stopped moving in ${capMs} ms — shot may be mid-climb`);
};

const pressE = async () => {
  await page.keyboard.down('e');
  await page.waitForTimeout(120);
  await page.keyboard.up('e');
  await page.waitForTimeout(450);
};

// THE OUTSIDE FIRST. "Library entrance doesn't match exterior" cannot be
// answered from inside alone, and E owns ct/civic.ts — so the exterior is
// read, never edited, and the only honest way to read it is to stand in the
// forecourt and look at it.
for (const [name, x, z, yaw, pitch] of [
  ['x1-forecourt', -6.0, -13.0, -Math.PI / 2, 0.05],
  ['x2-at-the-foot', -8.2, -13.0, -Math.PI / 2, 0.10],
  ['x3-on-the-platform', -10.6, -13.0, -Math.PI / 2, 0.02],
]) {
  await page.evaluate(([a, c, y, p]) => window.__ct.warp(a, c, y, 0.14, p), [x, z, yaw, pitch]);
  await settle();
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}`);
}

// in through the front doors, the way a player arrives
await page.evaluate(() => window.__ct.warp(-7.6, -13.0, -Math.PI / 2, 0.14, 0));
await page.waitForTimeout(200);
await page.keyboard.down('w'); await page.waitForTimeout(2000); await page.keyboard.up('w');
await page.waitForTimeout(300);
await pressE();
const inside = await page.evaluate(() => window.__ct.pos());
if (inside[0] < 100) { console.error('never got inside; pos', inside); await b.close(); process.exit(3); }
console.log(`inside at x ${inside[0].toFixed(2)} z ${inside[2].toFixed(2)} gy ${inside[3].toFixed(2)}`);

// the room's own origin, so every shot below is expressed in ROOM-local terms
// and not hand-typed world coordinates (GOTCHAS §20).
const R = await page.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'library'));
console.log('roomInfo:', JSON.stringify(R));

// fall back to measuring the room from where the door put us: the way-in spot
// is just inside the +z wall on the door axis.
const cx = R?.cx ?? inside[0], cz = R?.cz ?? (inside[2] - 10.45);

// CAMERA yaw, not mesh yaw (GOTCHAS §33): the rig looks along (sin t, -cos t),
// so yaw 0 looks toward -z — INTO the room — and yaw PI looks back at the door.
const shots = [
  ['a-in-the-vestibule', 0, 9.3, 0, 0],             // through the opening into the hall
  ['b-from-the-arch', 0, 6.2, 0, 0],                // just inside the hall, looking down it
  ['c-the-structure', 0, 0.0, Math.PI, 0],          // mid-hall, looking BACK at the vestibule
  ['d-the-entrance', 0, 8.0, Math.PI, 0],           // the front door from inside
  ['e-the-desk', -1.0, 8.0, 0.45, 0],               // toward the circulation desk
  ['f-the-librarian-served', -3.5, 7.4, 0, 0],      // face to face across the counter
  ['f2-the-librarian-behind', -3.5, 2.6, Math.PI, 0], // …and from the reading room
  ['g-the-hall-wide', 6.0, 6.0, 0.6, 0],            // the stair and gallery
];
for (const [name, lx, lz, yaw, pitch] of shots) {
  await page.evaluate(([x, z, y, p]) => window.__ct.warp(x, z, y, window.__ct.pos()[3], p),
    [cx + lx, cz + lz, yaw, pitch]);
  await settle();
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}`);
}

if (errs.length) console.log('CONSOLE ERRORS:', errs.slice(0, 4));
await b.close();

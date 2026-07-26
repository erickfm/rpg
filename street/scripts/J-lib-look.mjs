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
  await page.waitForTimeout(320);
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
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}`);
}

if (errs.length) console.log('CONSOLE ERRORS:', errs.slice(0, 4));
await b.close();

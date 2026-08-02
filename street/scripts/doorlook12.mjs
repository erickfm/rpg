// TWELVE ROOMS, BOTH FACES OF EACH DOOR — pictures, not an assertion.
//
// `doormatch12.mjs` already answers "which side is the door on" for all
// twelve rooms, correctly, because GOTCHAS 45 says that is what "match the
// exterior" means. It never asked whether the two faces are the same DOOR —
// same leaf count, same material, same glazing, same hardware — and the bank
// turned out to fail exactly that, 12/12 on position. This script is the
// investigation for the follow-up survey: it stands outside each door and
// looks at it, then stands inside and looks back at the same door, and saves
// both. The verdict is read by eye from the pairs, same as the user's own
// bank-door-out.png / bank-door-in.png that started this.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = aim('http://localhost:4195/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await setClock(p, 14, 20);

const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));

// building name (as declared in DOOR.building) -> room id (buildRoom's spec.id)
const ROOMS = [
  ['FIRST FEDERAL', 'bank'],
  ['BODEGA', 'bodega'],
  ['BURGER BARN', 'burger'],
  ['SEVENS', 'casino'],
  ['ST BRIGID', 'church'],
  ['DINER', 'diner'],
  ['HOTEL ORPHEUS', 'hotel'],
  ['JAIL', 'jail'],
  ['LIBRARY', 'library'],
  ['PAWN', 'pawn'],
  ['A-1 TAX', 'tax'],
  ['THRIFT', 'thrift'],
];

const doors = await p.evaluate(() => window.__ct.doors());
const rooms = await p.evaluate(() => window.__ct.roomDims());

for (const [building, id] of ROOMS) {
  const d = doors.find((x) => x.building === building);
  const r = rooms.find((x) => x.id === id);
  if (!d || !r) {
    console.log(`SKIP ${id}: ${d ? '' : 'no door() entry '}${r ? '' : 'no roomDims() entry'}`);
    continue;
  }
  // outside: stand BACK from the published stand point, along the same
  // point->stand direction, so the door reads as an object rather than
  // filling the frame edge to edge from 0.75 m away.
  const dx = d.stand.x - d.point.x, dz = d.stand.z - d.point.z;
  const dl = Math.hypot(dx, dz) || 1;
  const backX = d.point.x + (dx / dl) * 3.2, backZ = d.point.z + (dz / dl) * 3.2;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0.02),
    [backX, backZ, yawTo(backX, backZ, d.point.x, d.point.z)]);
  await p.waitForTimeout(450);
  await p.screenshot({ path: `shots/doorlook-${id}-out.png` });
  const closeX = d.point.x + (dx / dl) * 1.6, closeZ = d.point.z + (dz / dl) * 1.6;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0.02),
    [closeX, closeZ, yawTo(closeX, closeZ, d.point.x, d.point.z)]);
  await p.waitForTimeout(450);
  await p.screenshot({ path: `shots/doorlook-${id}-out-close.png` });

  // inside: stand a little back from the room's own door centre, look at it.
  // `door.x` is LOCAL x along the front wall for a flat frontage; for a
  // chamfered room it is the cut-corner point instead, which is still "the
  // door" as far as looking at it goes.
  const wx = r.cx + r.door.x, wz = r.cz + r.d / 2 - 3.2;
  const twz = r.cz + r.d / 2;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0.02),
    [wx, wz, yawTo(wx, wz, r.cx + r.door.x, twz)]);
  await p.waitForTimeout(450);
  await p.screenshot({ path: `shots/doorlook-${id}-in.png` });
  console.log(`  ${id}: out + in saved`);
}
await b.close();

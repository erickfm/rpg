// STAND WHERE THE PLAYER STANDS AND LOOK AT THE THING HE COMPLAINED ABOUT.
//
// The 0.18 m wall return is the reveal you see edge-on walking through a
// doorway, so a shot of the room's middle will not show it and a shot from
// outside the door will not either. This puts the camera a step back from the
// jail's own door, at eye height, square on — which is the last thing you see
// before you walk through it.
//
//   node scripts/probes/w62-doorway-shot.mjs <tag>
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'now';
const URL = aim('http://localhost:4183/');
mkdirSync('shots/w62', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1200);

const rooms = await p.evaluate(() => window.__ct.roomDims());
const want = ['jail', 'bank', 'church'];
for (const id of want) {
  const r = rooms.find((q) => q.id === id);
  if (!r) { console.log(`no room '${id}'`); continue; }
  // The room states its own door and that door's outward normal — ct/interior.ts
  // publishes `door` precisely so a harness does not assume the front wall.
  // Stand INSIDE, 1.6 m back along the inward normal, looking at the opening.
  // `door` is stated in ROOM-LOCAL coordinates (interior.ts:1485 pushes
  // `{x: dAt, z: hd, ...}`), so it has to be lifted into the belt by the
  // room's own centre. Standing at the raw local z put the camera on the
  // street at (0, 14.7) — outdoors, 1000 m from the room it named.
  //
  // And the sign of the stated normal is not worth guessing: step BOTH ways
  // and keep whichever lands inside the room's own footprint. Guessing it
  // wrong put the camera 1.7 m behind the front wall and produced a frame of
  // flat grey that looked exactly like a rendering bug.
  const dx = r.cx + r.door.x, dz = r.cz + r.door.z;
  const inside = (x, z) => Math.abs(x - r.cx) < r.w / 2 - 0.3 && Math.abs(z - r.cz) < r.d / 2 - 0.3;
  let sgn = null;
  for (const s of [1, -1]) if (inside(dx + r.door.nx * s * 1.7, dz + r.door.nz * s * 1.7)) sgn = s;
  if (sgn === null) { console.log(`could not stand inside '${id}'`); continue; }
  const px = dx + r.door.nx * sgn * 1.7, pz = dz + r.door.nz * sgn * 1.7;
  // look back at the door, i.e. along the OUTWARD direction from where I stand
  const yaw = Math.atan2(-(-r.door.nx * sgn), -(-r.door.nz * sgn));
  await p.evaluate(([x, z, y]) => { window.__ct.clock(13, 0); window.__ct.warp(x, z, y, 0, 0); },
                   [px, pz, yaw]);
  await p.waitForTimeout(700);                 // GOTCHAS 78: let a frame draw
  await p.screenshot({ path: `shots/w62/${id}-door-${TAG}.png` });
  console.log(`shots/w62/${id}-door-${TAG}.png   stood at (${px.toFixed(1)}, ${pz.toFixed(1)}) facing the ${id} door`);
}
await b.close();

// THE LINTEL, HEAD-ON. The doorway shot shows the fault but small: the header
// over a door is 0.24 m of a 2.9 m wall, so at eye level it is forty pixels of
// a seven-hundred-pixel frame. This backs off and pitches UP at it, which is
// where the difference between "the wall continues over the door" and "the
// whole room's canvas is crushed into 24 cm" is actually legible.
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
for (const id of ['jail', 'bank']) {
  const r = rooms.find((q) => q.id === id);
  if (!r) continue;
  const dx = r.cx + r.door.x, dz = r.cz + r.door.z;
  const inside = (x, z) => Math.abs(x - r.cx) < r.w / 2 - 0.3 && Math.abs(z - r.cz) < r.d / 2 - 0.3;
  let sgn = null;
  for (const s of [1, -1]) if (inside(dx + r.door.nx * s * 3.2, dz + r.door.nz * s * 3.2)) sgn = s;
  if (sgn === null) continue;
  const px = dx + r.door.nx * sgn * 3.2, pz = dz + r.door.nz * sgn * 3.2;
  const yaw = Math.atan2(r.door.nx * sgn, r.door.nz * sgn);
  await p.evaluate(([x, z, y]) => { window.__ct.clock(13, 0); window.__ct.warp(x, z, y, 0, 0.34); },
                   [px, pz, yaw]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/w62/${id}-lintel-${TAG}.png` });
  console.log(`shots/w62/${id}-lintel-${TAG}.png`);
}
await b.close();

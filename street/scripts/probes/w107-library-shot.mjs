// LOOK AT THE LIBRARY STACKS. Item 273 — *"some bookshelves are flat?"*
//
// The complaint is about what a FACE SHOWS, so a frame answers it and a mesh
// count does not. Five vantages: his standing position at the door, down an
// aisle, inside the cross aisle item 115 cut, square onto a stack end, and the
// west wall run.
//
// Waits for a PAINTED frame (GOTCHAS 80) and reports the black fraction, so a
// timeout cannot be mistaken for a picture of an empty room.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
const TAG = process.argv[2] || 'before';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const lib = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => /libr/i.test(r.id)));
if (!lib) { console.log('NO LIBRARY IN roomDims()'); process.exit(3); }
const { cx, cz, y } = lib;
console.log(`library at (${cx}, ${cz}), ${lib.w} x ${lib.d}, floor ${y}`);

// Stack geometry read off ct/int-library.ts, cited not guessed:
//   STACK_PITCH 2.15, five runs at lx = -W/2 + 2.4 + i*2.15  ->  -7.6 … 0.999
//   zBack = -D/2 + 1.3 = -9.7, zFront = -2.0, zMid = -5.85, CROSS 1.70
const RUN_X = [0, 1, 2, 3, 4].map((i) => cx - lib.w / 2 + 2.4 + i * 2.15);
const ZMID = cz + (-lib.d / 2 + 1.3 + -2.0) / 2;

const VIEWS = [
  // where he stands: in the hall, looking into the stack block (-z)
  { id: 'hall', x: cx - 3.2, z: cz + 3.0, yaw: 0, pitch: -0.02 },
  // down an aisle, between runs 2 and 3
  { id: 'aisle', x: (RUN_X[1] + RUN_X[2]) / 2, z: cz - 2.6, yaw: 0, pitch: -0.02 },
  // standing IN the cross aisle item 115 cut, looking along it (+x)
  { id: 'cross', x: RUN_X[0] - 0.6, z: ZMID, yaw: Math.PI / 2, pitch: 0 },
  // square onto one stack END, 1.2 m off it
  { id: 'end', x: RUN_X[2], z: ZMID + 1.75, yaw: 0, pitch: 0 },
  // the west wall run
  { id: 'westwall', x: cx - lib.w / 2 + 2.2, z: cz + 0.0, yaw: -Math.PI / 2, pitch: 0 },
];

for (const v of VIEWS) {
  await p.evaluate(([v, y]) => window.__ct.warp(v.x, v.z, v.yaw, y ?? 0, v.pitch), [v, y]);
  await waitPainted(p, { frames: 4 });
  const path = `shots/w107-lib-${TAG}-${v.id}.png`;
  const buf = await p.screenshot({ path });
  console.log(`${path}  at (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) yaw ${v.yaw.toFixed(2)}  black ${(await blackFraction(p, buf) * 100).toFixed(1)}%`);
}
await b.close();

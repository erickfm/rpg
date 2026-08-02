// Eye-height shots of the HOTEL ORPHEUS lobby, for grading it by looking.
//
// GOTCHAS 1: these prove nothing. They are for seeing whether the room reads —
// "less, arranged, aligned" is a judgement, and the only way to make it is to
// stand in the room. Structure is proved by G-rooms-walk.mjs, not by these.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4186/');
const EYE = 0.0;                       // warp's gy is the GROUND; eye height is fixed

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);                                        // GOTCHAS 26

const room = await p.evaluate((id) =>
  (window.__ct.roomDims?.() ?? []).find((r) => r.id === id), 'pawn');
if (!room) { console.log('FAIL  no hotel slab published'); await b.close(); process.exit(3); }
console.log(`hotel slab  cx=${room.cx}  cz=${room.cz}  ${room.w} x ${room.d}`);

const { cx, cz, d } = room;
const hd = d / 2;
// local -> world: cx + lx, cz + lz.  yaw 0 looks -z (into the room), PI looks +z.
const S = [
  ['door',    0,   hd - 0.9,  0,            0.02],
  ['west',    0,   1.6,      -Math.PI / 2,  0.0 ],   // the bare west run: clocks + bikes
  ['clocks', -4.6, 2.2,      -Math.PI / 2,  0.10],   // close up on the clock line
  ['corner',  2.0, 0.6,       Math.atan2((6.35) - 2.0, -((hd - 0.72) - 0.6)), 0.0],
  ['counter', 1.6, -1.6,      Math.PI,      0.0 ],
];

await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
for (const [label, lx, lz, yaw, pitch] of S) {
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0, pi),
    [cx + lx, cz + lz, yaw, pitch]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/G-pawn-${label}.png` });
}
await b.close();
console.log(`ok  ${S.length} shots  shots/G-pawn-*.png`);

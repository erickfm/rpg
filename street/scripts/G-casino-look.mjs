// Eye-height shots of the HOTEL ORPHEUS lobby, for grading it by looking.
//
// GOTCHAS 1: these prove nothing. They are for seeing whether the room reads —
// "less, arranged, aligned" is a judgement, and the only way to make it is to
// stand in the room. Structure is proved by G-rooms-walk.mjs, not by these.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';
const EYE = 0.0;                       // warp's gy is the GROUND; eye height is fixed

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);                                        // GOTCHAS 26

const room = await p.evaluate((id) =>
  (window.__ct.roomDims?.() ?? []).find((r) => r.id === id), 'casino');
if (!room) { console.log('FAIL  no hotel slab published'); await b.close(); process.exit(3); }
console.log(`hotel slab  cx=${room.cx}  cz=${room.cz}  ${room.w} x ${room.d}`);

const { cx, cz, d } = room;
const hd = d / 2;
// local -> world: cx + lx, cz + lz.  yaw 0 looks -z (into the room), PI looks +z.
const S = [
  ['entry',   0,   hd - 0.9,  0,            0.02],   // just inside, down the avenue
  ['entry-e', 0,   hd - 0.9, -Math.PI / 2,  0.0 ],   // the east banquette
  ['entry-w', 0,   hd - 0.9,  Math.PI / 2,  0.0 ],   // the west banquette
  ['avenue',  0,   hd - 4.5,  0,            0.02],   // walking in, banks both sides
  ['bankside', 1.9, hd - 5.6, 0,            0.0 ],   // alongside a bank, at its flank
  ['back',    0,  -hd + 3.0,  Math.PI,      0.02],   // from the pit, looking back
];

await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);
for (const [label, lx, lz, yaw, pitch] of S) {
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0, pi),
    [cx + lx, cz + lz, yaw, pitch]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/G-casino-${label}.png` });
}
await b.close();
console.log(`ok  ${S.length} shots  shots/G-casino-*.png`);

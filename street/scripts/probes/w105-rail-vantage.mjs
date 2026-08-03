// Item 267 — the user's vantage: standing in the CASINO looking at the party
// doorway, where a gold band "cuts across the entry way".
//
// ⚠ THIS IS A LOOKING ITEM, so the frame is the deliverable and the frame has
// to be of the right thing. Nothing here is typed: the room comes from
// `__ct.roomDims()` and the opening from `__ct.party()` — the same declaration
// `ct/interior.ts` cuts the hole from — so the camera cannot drift from the
// doorway it is pointed at.
//
// ⚠ WAIT FOR A PAINTED FRAME, NOT A TIMEOUT (GOTCHAS 78/80): a probe that waits
// on a clock photographs a solid room. And the hour is FIXED so before and
// after are comparable — the night wash would otherwise change the picture on
// its own.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const TAG = process.env.TAG ?? 'before';
const HOUR = Number(process.env.HOUR ?? 13);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });
await p.evaluate((h) => window.__ct.clock(h, 0), HOUR);

const geo = await p.evaluate(() => {
  // `roomDims()` returns an ARRAY of rows keyed by `id`, not a map — worth
  // stating because indexing it like a map yields `undefined` and then a
  // TypeError forty lines later, which is how this probe failed first time.
  const rooms = window.__ct.roomDims();
  const pw = window.__ct.party()[0];
  const by = (id) => rooms.find((r) => r.id === id);
  // ── ITEM 281: THE ROOMS ARE NOT RENAMED HERE ANY MORE ───────────────────
  //
  // This used to read `{ casino: by(pw.east), hotel: by(pw.west) }` — i.e. it
  // TYPED the answer to the question item 268 made the world derive. Measured
  // on this tree the world says the opposite of what that line assumed:
  //
  //     party  {"rooms":["hotel","casino"],"at":-9,"west":"casino","east":"hotel"}
  //
  // so `pw.east` is the HOTEL, and every line below it was labelling the hotel
  // "casino". The camera happened to land in roughly the right place — the
  // hotel's low-x face IS the party wall — but it stood in the WRONG ROOM and
  // said so in the log, and `SIDE=hotel` stood in the casino. A shot probe that
  // photographs the wrong room and prints a confident caption is the exact
  // "green that means nothing" BUILDER-BRIEF §10a is about.
  //
  // So the sides keep the world's own names. Nothing here decides which is
  // which; `handedness()` already did, and `party()` publishes the result.
  return { east: by(pw.east), west: by(pw.west), pw };
});
const pw = geo.pw;
console.log(`party  ${JSON.stringify(pw)}`);
console.log(`  west = ${pw.west}  ${JSON.stringify(geo.west)}`);
console.log(`  east = ${pw.east}  ${JSON.stringify(geo.east)}`);

// THE PARTY WALL, FROM BOTH ROOMS RATHER THAN FROM ONE. It used to be "the
// casino's low-x face", which is only true for one hand — the other hand puts
// the wall on that room's HIGH-x face and the camera four metres inside solid
// masonry. Taking the midpoint of the two rooms' facing edges is true either
// way, and it agrees with the sills `w85-item230-party-threshold.mjs` finds at
// x 879.91 / 880.09 to within a millimetre.
const openWorldZ = geo.east.cz + pw.at;
const wallX = ((geo.west.cx + geo.west.w / 2) + (geo.east.cx - geo.east.w / 2)) / 2;
console.log(`  party wall at x ${wallX.toFixed(3)}, opening centre z ${openWorldZ.toFixed(3)}`);

// Stand back in the casino, on the doorway's centreline, looking at the wall —
// which is what "cuts across the entry way" is a complaint about.
// SIDE=hotel stands in the OTHER room and looks back through the same opening.
// The row asked for it and it was right to: the hotel carries a picture rail at
// y = 2.35 on the very same wall, and the opening is 2.6 m tall, so that band
// crosses it too — the user simply happened to be standing in the casino.
//
// ── SIDE NAMES A ROOM, NOT A COMPASS POINT (item 281) ────────────────────────
//
// `SIDE=casino` stands in the casino whichever hand the world is currently
// solving, because it is resolved against `party()`'s own `west`/`east` ids
// rather than assumed. `SIDE` defaults to the room the user was standing in
// when he filed item 267 — the CASINO — which is not what this probe did
// before: it defaulted to `pw.east`, which is the hotel.
//
// Every shot is named for the room it was TAKEN IN, so a frame cannot be filed
// under the wrong caption again.
const SIDE = (process.env.SIDE ?? 'casino').toLowerCase();
if (SIDE !== pw.west && SIDE !== pw.east) {
  console.error(`SIDE=${SIDE} is not one of this party wall's rooms (${pw.west}, ${pw.east}).`
    + '\nNothing was measured, so this is not a pass. (GOTCHAS 32.)');
  await b.close(); process.exit(3);
}
// Standing in the WEST room you look east (+x, yaw +π/2); in the EAST room you
// look west. Derived from which side `SIDE` resolved to, never typed.
const inWest = SIDE === pw.west;
const sgn = inWest ? -1 : 1;                 // step back from the wall, into your room
const yaw = inWest ? Math.PI / 2 : -Math.PI / 2;
const shots = [
  [`${SIDE}-head-on`, wallX + sgn * 4.2, openWorldZ, yaw],
  [`${SIDE}-oblique`, wallX + sgn * 3.4, openWorldZ + 3.0, yaw + sgn * 0.55],
  [`${SIDE}-close`, wallX + sgn * 1.8, openWorldZ, yaw],
];
// ⚠ A WARP INTO AN INTERIOR IS NOT INSTANTLY A PICTURE, and the first run of
// this probe saved three SOLID BLACK frames. `warp` + a 500 ms timeout gave
// `painted().triangles = 982`; the casino only renders once the region cull has
// revealed it, and the same station a moment later reads **10434**. A timeout is
// not a wait for a painted frame (GOTCHAS 78/80) — this waits for the triangle
// count to actually come up.
//
// AND THEN IT LOOKS AT THE IMAGE, because "the renderer says it drew" is still
// not "the picture has something in it" — the last line of defence on a looking
// item is the pixels. A frame over 85% black is REFUSED rather than saved: an
// all-black before/after pair would compare beautifully and mean nothing.
const TRI_FLOOR = 5000;   // the room reads ~10.4k; the culled view reads ~1k
let black = 0;
for (const [name, x, z, yaw] of shots) {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0), [x, z, yaw]);
  await p.waitForFunction((floor) => (window.__ct.painted?.()?.triangles ?? 0) > floor,
    TRI_FLOOR, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(350);
  const path = `shots/w105-rail-${name}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const q = await p.evaluate(() => window.__ct.pos());
  const tri = await p.evaluate(() => window.__ct.painted().triangles);
  // crude but sufficient: fraction of bytes that are near-zero in the raw PNG
  // is not meaningful, so sample the framebuffer through the page instead.
  const dark = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas');
    g.width = 160; g.height = 100;
    const cx = g.getContext('2d');
    cx.drawImage(c, 0, 0, 160, 100);
    const d = cx.getImageData(0, 0, 160, 100).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 24) n++;
    return n / (160 * 100);
  });
  if (dark > 0.85) black++;
  console.log(`${path}   stood (${q[0].toFixed(2)}, ${q[2].toFixed(2)}) gy ${q[3].toFixed(2)}`
    + `  tri ${tri}  black ${(dark * 100).toFixed(1)}%${dark > 0.85 ? '   ⚠ REFUSED — this frame shows nothing' : ''}`);
  void buf;
}
if (black) {
  console.error(`\n${black} of ${shots.length} frames are >85% black — they are not evidence of anything.`);
  await b.close();
  process.exit(2);
}
await b.close();

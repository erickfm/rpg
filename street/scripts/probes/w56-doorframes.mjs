// Item 105. Stand INSIDE a room, at the way-out spot, LOOKING AT the interior
// door leaf — and shoot it. Then stand on the street in front of the same
// building and shoot the exterior. Two frames per building, same subject.
//
// The user judges these two frames side by side and says "doesn't match".
// `doormatch12.mjs` never rendered either one; it printed a hand-typed prose
// column. So this exists to put the actual pixels in front of a human.
//
// Rooms live in a belt out along +x; `roomDims()` gives each slab's centre and
// its door in LOCAL x/z, which is what we add to cx/cz to get the world point.
//
// Run: SHOT_URL=http://localhost:4184/ node scripts/probes/w56-doorframes.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? (() => {
  throw new Error('SHOT_URL required — GOTCHAS 50, an instrument that defaults to a port is a silent wrong answer');
})();

// interior: which room, and how far back from its own door to stand.
// The EXTERIOR standing point is NOT typed — it is derived from the world's own
// `__ct.doors()`, which publishes each door as a point plus an outward normal.
// Step out along that normal and look back down it. Typing a coordinate here is
// how the last three probes shot the sky (BUILDER-BRIEF §8).
const SHOTS = {
  jail: { building: 'JAIL', back: 3.2, out: 7.0 },
  church: { building: 'ST BRIGID', back: 3.6, out: 9.0 },
  bank: { building: 'FIRST FEDERAL', back: 3.6, out: 7.0 },
};

mkdirSync('shots/w56', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);

const dims = await p.evaluate(() => window.__ct.roomDims());
const doors = await p.evaluate(() => window.__ct.doors());

for (const [id, S] of Object.entries(SHOTS)) {
  const rd = dims.find((d) => d.id === id);
  if (!rd || !rd.door) { console.log(`${id}: no room/door in roomDims — skipped`); continue; }
  // The kit's door sits in the front wall at local +d/2. Stand `back` metres
  // in from it, on the door's own x, and look straight at it.
  const wx = rd.cx + rd.door.x;
  const wz = rd.cz + rd.d / 2 - S.back;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [wx, wz, Math.PI]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/w56/${id}-inside.png` });
  console.log(`${id}  inside  stood (${wx.toFixed(2)}, ${wz.toFixed(2)}) looking +z at its own door`);

  const dd = doors.find((d) => d.building === S.building);
  if (!dd) { console.log(`${id}: __ct.doors() has no ${S.building} — outside skipped`); continue; }
  // the door point, and the outward normal it publishes. Chamfer doors carry
  // nx/nz; a flat frontage's normal is its `side` on x.
  // `stand` IS the published "where you stand to use this door". Push further
  // back along the same ray so the whole doorcase is in frame, and look at it.
  const P = dd.point, ST = dd.stand;
  const ux = ST.x - P.x, uz = ST.z - P.z, ul = Math.hypot(ux, uz) || 1;
  const ex = P.x + (ux / ul) * S.out, ez = P.z + (uz / ul) * S.out;
  const yaw = Math.atan2(P.x - ex, -(P.z - ez));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [ex, ez, yaw]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/w56/${id}-outside.png` });
  console.log(`${id}  outside stood (${ex.toFixed(2)}, ${ez.toFixed(2)}) `
    + `looking back at the door at (${P.x.toFixed(2)}, ${P.z.toFixed(2)})`);
}
await b.close();

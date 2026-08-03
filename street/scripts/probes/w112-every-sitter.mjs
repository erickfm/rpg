// ITEM 272 — EVERY SEATED CITIZEN IN THE WORLD, MEASURED AND PHOTOGRAPHED.
//
// The fix is in `ct/citizens.ts`, which every seated figure shares, so the diner
// is the complaint and the rest of the world is the blast radius. This finds
// them all, says which room each is in, and shoots each one from a standing
// player 2 m out — the only way to know a booth fix did not wreck a bar stool.
//
// ⚠ THE CULL, GOTCHAS 79/79b. Interiors are hidden unless you are inside them,
// and the player spawns in apartment 301 past the cull, so a census from spawn
// finds NOTHING. This does not filter on `visible` at all — being seated is an
// authoring fact — and it warps into each room before shooting it.
//
// POPULATION FLOOR: 2 in the diner + the casino/library/church adopters. Under
// 6 total this exits 3 rather than reporting a clean sweep of an empty set.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const TAG = process.env.TAG || 'now';
const FLOOR = Number(process.env.FLOOR ?? 6);
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const all = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    const r = rooms.find((m) => Math.abs(q.x - m.cx) <= m.w / 2 && Math.abs(q.z - m.cz) <= m.d / 2);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox;
    out.push({
      room: r ? r.id : 'OUTSIDE',
      x: q.x, y: q.y, z: q.z,
      cz: r ? r.cz : q.z,
      // the sprite's painted band, scaled — the leg band runs from the bottom
      // of it up to the origin (the hip), which is the seat top
      bottom: q.y + g.min.y * o.scale.y,
      facing: o.userData.citizenFacing,
    });
  });
  return out;
});

console.log(`seated citizens in the world: ${all.length}`);
const byRoom = {};
for (const s of all) byRoom[s.room] = (byRoom[s.room] ?? 0) + 1;
for (const [r, n] of Object.entries(byRoom)) console.log(`  ${r.padEnd(14)} ${n}`);
if (all.length < FLOOR) {
  console.log(`EXIT 3 — population floor is ${FLOOR}; measuring nothing.`);
  await b.close(); process.exit(3);
}

// one shot per room, from 2 m out on the room-centre side of the first sitter
const seen = new Set();
let idx = 0;
for (const s of all) {
  idx++;
  if (!process.env.ALL && seen.has(s.room)) continue;
  seen.add(s.room);
  const dir = Math.sign(s.cz - s.z) || -1;
  const sx = s.x, sz = s.z + dir * 2.0;
  const yaw = Math.atan2(s.x - sx, -(s.z - sz));      // rig yaw: 0 looks down −z
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.14), [sx, sz, yaw]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w112-room-${s.room}${process.env.ALL ? `-${idx}` : ''}-${TAG}.png`;
  await p.screenshot({ path });
  console.log(`${path}   sitter (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) facing ${(s.facing ?? NaN).toFixed(2)}  sprite bottom y ${s.bottom.toFixed(3)}`);
}
await b.close();
if (errs.length) console.log(`console errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);

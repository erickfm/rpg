// LOOK AT THE RELAID LIBRARY — the two views that judge item 115.
//
// Screenshots are for LOOKING, never for proving (CLAUDE.md). The proof that
// the layout walks is w98-library-relayout-walk.mjs; this is so a human can see
// what the numbers describe:
//
//   cross-aisle   standing IN the new cross aisle, looking east along it. This
//                 is the route the relayout adds and the thing a plan view
//                 cannot show you.
//   hall          standing in the reading hall looking back at the entrance,
//                 which is where the issue desk now is. This is the view the
//                 user was in when he filed "crowded in some areas and spacious
//                 in others" — the earlier library complaints were all shot
//                 from the body of the room looking back.
//
// Positions are DISCOVERED from the colliders, not typed: the cross aisle is
// the gap between the two banks of a split run. GOTCHAS 78 — wait for a frame
// the renderer actually drew, not for `__ct` or for rAF.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4540/');
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /library/i.test(r.id)));
if (!room) { console.log('ABORT no library'); await b.close(); process.exit(3); }

const boxes = await p.evaluate(([cx, cz, w, d]) => {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  return window.__ct.colliders()
    .filter((c) => c.maxX > x0 && c.minX < x1 && c.maxZ > z0 && c.minZ < z1)
    .map((c) => ({ x0: c.minX - cx, x1: c.maxX - cx, z0: c.minZ - cz, z1: c.maxZ - cz }));
}, [room.cx, room.cz, room.w, room.d]);

// the free-standing stack banks, and the cross aisle between them
const runs = boxes.filter((c) => (c.x1 - c.x0) < 0.8 && (c.z1 - c.z0) > 1.5 && c.z1 < 0
  && Math.abs((c.x0 + c.x1) / 2) < room.w / 2 - 1.0);
const byX = new Map();
for (const r of runs) {
  const k = ((r.x0 + r.x1) / 2).toFixed(2);
  if (!byX.has(k)) byX.set(k, []);
  byX.get(k).push(r);
}
const pair = [...byX.values()].find((v) => v.length === 2);
if (!pair) { console.log('ABORT no split run — no cross aisle to look down'); await b.close(); process.exit(3); }
const [a, c] = pair.sort((m, n) => m.z0 - n.z0);
const CROSS_Z = (a.z1 + c.z0) / 2;
const westmost = Math.min(...[...byX.keys()].map(Number));

const shots = [
  ['cross-aisle', westmost - 0.95, CROSS_Z, Math.PI / 2],   // in the aisle, looking east
  ['hall', 0, -1.0, Math.PI],                               // in the hall, looking back at the doors
];

for (const [name, lx, lz, yaw] of shots) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
    [room.cx + lx, room.cz + lz, yaw]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w98-library-${name}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`${path}  at local (${lx.toFixed(2)}, ${lz.toFixed(2)}) yaw ${yaw.toFixed(2)}  black ${black}`
    + (black > 0.98 ? '   <-- YOU PHOTOGRAPHED THE VOID' : ''));
}
await b.close();

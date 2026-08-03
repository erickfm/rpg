// ITEM 272 — LOOK AT THE SEATED CUSTOMERS THE WAY THE USER DOES.
//
//   *"people sitting still looks bad because they have no legs??"*
//
// This is an APPEARANCE complaint, so a number that says the legs are painted
// does not answer it — a frame does (BUILDER-BRIEF §12.2). Three vantages, all
// from a standing player in the diner aisle, all DERIVED from where the seated
// sprites and their benches actually are rather than typed:
//
//   booth-face   square on to the occupied booth from the aisle
//   booth-angle  the walk-past view, from down the aisle
//   booth-near   close, the way you look when you notice something is wrong
//
// Pass TAG=before / TAG=after to name the files.
//
// ⚠ WARP FIRST (GOTCHAS 79b) and wait for a PAINTED frame (GOTCHAS 78/80).
import { chromium } from 'playwright';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const TAG = process.env.TAG || 'now';
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
if (!room) { console.log('EXIT 3 — no diner'); await b.close(); process.exit(3); }
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

// WHERE ARE THE SITTERS? Derived from the scene, never typed.
const sitters = await p.evaluate(([cx, cz, w, d]) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (q.x < cx - w / 2 || q.x > cx + w / 2 || q.z < cz - d / 2 || q.z > cz + d / 2) return;
    out.push({ x: q.x, y: q.y, z: q.z });
  });
  return out;
}, [room.cx, room.cz, room.w, room.d]);

if (sitters.length < 2) {
  console.log(`EXIT 3 — population floor is 2 seated diner customers, found ${sitters.length}.`);
  await b.close(); process.exit(3);
}
// the pair share a z and straddle the table; the booth centre is between them
const bx = sitters.reduce((s, q) => s + q.x, 0) / sitters.length;
const bz = sitters.reduce((s, q) => s + q.z, 0) / sitters.length;
console.log(`occupied booth centre (${bx.toFixed(2)}, ${bz.toFixed(2)})  sitters ${sitters.length}`);

// The aisle is on the room-centre side of the booth. Which side that is comes
// from the room centre, not from an assumption about +z.
const aisleDir = Math.sign(room.cz - bz) || -1;
// ⚠ THE RIG'S YAW ZERO IS NOT THE CITIZEN'S (GOTCHAS 62). `fp.ts:575` is
// `fwd = (sin yaw, 0, -cos yaw)`, so yaw 0 looks down −z, while a citizen's
// facing is `atan2(vx, vz)` with 0 down +z. Using the citizen form here pointed
// the camera at the counter on the first run and photographed the wrong wall.
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));

// `booth-side` is the one that matters most: square out from a single sitter,
// which is 90 deg off his facing and therefore the PROFILE column — the view a
// player gets walking the aisle, and the only one whose horizontal axis maps
// onto the direction he is actually facing.
const one = sitters.reduce((a, q) => (q.x < a.x ? q : a));
const shots = [
  ['booth-side', one.x, bz + aisleDir * 1.25, one.x, bz],
  ['booth-face', bx, bz + aisleDir * 1.6, bx, bz],
  ['booth-angle', bx - 2.4, bz + aisleDir * 1.5, bx, bz],
  ['booth-near', sitters[0].x + (bx - sitters[0].x) * 0.2, bz + aisleDir * 0.95, bx, bz],
];

for (const [name, sx, sz, tx, tz] of shots) {
  const yaw = yawTo(sx, sz, tx, tz);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.10), [sx, sz, yaw]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w112-${name}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`${path}   stand (${sx.toFixed(2)}, ${sz.toFixed(2)}) yaw ${yaw.toFixed(2)}   black ${black}`
    + (black > 0.9 ? '   <-- PHOTOGRAPHED THE VOID' : ''));
}
await b.close();
if (errs.length) console.log(`console errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);

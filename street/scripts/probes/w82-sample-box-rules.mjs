// Item 226. Leg 6's sample box is a hardcoded +/-8 m around the room centre.
// That is roughly room-sized for a shop and FIVE TIMES the size of apt301, whose
// half-extents are 1.53 x 1.68 — which is why the flat's first ever run of this
// leg reported a material dimming at (202.15, 8.23, -17.32), 3.75 m east of a
// room 3.06 m wide. That fixture is not in the flat.
//
// Proposed rule: clamp the box to the room's OWN published size, capped at the
// existing 8 so no room can LOSE coverage it has today:
//
//     box = min(8, half-extent + 0.5)
//
// Before changing a leg that runs on 13 rooms, measure what it does to all 13:
// judged counts, and whether anything that passes today would start failing.
// A check that goes red on a world that is fine is the expensive failure.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const MARGIN = 0.5;   // wall thickness 0.18 and a little air
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

const DIMS = await p.evaluate(() => window.__ct.roomDims());

const sample = (cx, cz, bx, bz) => p.evaluate(([cx, cz, bx, bz]) => {
  const out = {};
  window.__ct.scene().updateMatrixWorld(true);
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > bx || Math.abs(wp.z - cz) > bz) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && m.color && !m.transparent) out[m.uuid] = m.color.getHex();
  });
  return out;
}, [cx, cz, bx, bz]);

const steadyAt = async (cx, cz, bx, bz, h, settle) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(settle);
  const shots = [];
  for (let i = 0; i < 4; i++) { shots.push(await sample(cx, cz, bx, bz)); if (i < 3) await p.waitForTimeout(500); }
  const steady = {}, moved = new Set();
  for (const u of Object.keys(shots[0])) {
    if (shots.every((s) => s[u] === shots[0][u])) steady[u] = shots[0][u]; else moved.add(u);
  }
  return { steady, moved };
};

const verdict = async (d, bx, bz) => {
  const day = await steadyAt(d.cx, d.cz, bx, bz, 12, 500);
  const dark = await steadyAt(d.cx, d.cz, bx, bz, 2, 900);
  const judged = Object.keys(day.steady).filter((u) => dark.steady[u] !== undefined);
  const dimmed = judged.filter((u) => dark.steady[u] !== day.steady[u]).length;
  const seen = Object.keys(day.steady).length + new Set([...day.moved, ...dark.moved]).size;
  const floorOk = judged.length >= Math.max(8, Math.round(seen * 0.5));
  return { judged: judged.length, dimmed, seen, floorOk };
};

console.log('room        box now      box proposed   judged now/prop   dimmed now/prop   pop-floor now/prop');
for (const d of DIMS) {
  const bx = Math.min(8, d.w / 2 + MARGIN), bz = Math.min(8, d.d / 2 + MARGIN);
  const now = await verdict(d, 8, 8);
  const prop = await verdict(d, bx, bz);
  const flag = (now.dimmed === 0) !== (prop.dimmed === 0) ? '   <== VERDICT CHANGES' : '';
  console.log(`${d.id.padEnd(10)}  8.0 x 8.0    ${bx.toFixed(2)} x ${bz.toFixed(2)}    `
    + `${String(now.judged).padStart(4)}/${String(prop.judged).padEnd(4)}      `
    + `${String(now.dimmed).padStart(3)}/${String(prop.dimmed).padEnd(3)}          `
    + `${now.floorOk ? 'ok' : 'FAIL'}/${prop.floorOk ? 'ok' : 'FAIL'}${flag}`);
}
await p.evaluate(() => window.__ct.clock(13, 20));
await b.close();

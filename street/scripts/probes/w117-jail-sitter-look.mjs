// LOOK AT THE ONE SITTER w112-legs-below-the-seat.mjs FAILS (item 288).
//
// Improving that probe's coverage from 43% to 90% surfaced a sitter that had
// been sitting in the UNJUDGED set: jail (994.02, 10.00) reads 2,742 visible
// pixels and ZERO below its own seat line. Item 286's run reported 0 bad, but it
// judged only 6 of 14 — this one was not among them.
//
// A number is not a verdict on something the user judges by eye, so this shoots
// the same vantage the check uses, plus two more, and a human decides.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-jail-sitter-look.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4190/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 60000 });
await reportWorld(p, URL);
await waitPainted(p, { quiet: true });
await p.evaluate(() => window.__ct.clock(13, 0));

const sitters = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    const r = rooms.find((m) => Math.abs(q.x - m.cx) <= m.w / 2 && Math.abs(q.z - m.cz) <= m.d / 2);
    out.push({ room: r ? r.id : 'OUTSIDE', x: q.x, y: q.y, z: q.z,
      cz: r ? r.cz : q.z - 2, cx: r ? r.cx : q.x,
      facing: o.userData.citizenFacing ?? null });
  });
  return out;
});

for (const s of sitters.filter((q) => q.room === 'jail')) {
  const tag = `${s.x.toFixed(0)}-${s.z.toFixed(0)}`;
  console.log(`\njail sitter @ ${s.x.toFixed(2)}, ${s.z.toFixed(2)}  y ${s.y.toFixed(2)}  facing ${s.facing === null ? '-' : (s.facing * 180 / Math.PI).toFixed(0) + '°'}`);
  // 1. EXACTLY the vantage the check uses (w112-legs-below-the-seat.mjs:104-107)
  const dir = Math.sign(s.cz - s.z) || -1;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.14), [s.x, s.z + dir * 2.0, Math.atan2(0, -(s.z - (s.z + dir * 2.0)))]);
  await waitPainted(p, { quiet: true });
  let buf = await p.screenshot({ path: `shots/w117-jail-${tag}-checkvantage.png` });
  console.log(`  shots/w117-jail-${tag}-checkvantage.png  black ${(100 * await blackFraction(p, buf)).toFixed(1)}%`);
  // 2. from the room centre, whatever direction that is
  const yaw = Math.atan2(s.x - s.cx, -(s.z - s.cz));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.10), [s.cx, s.cz, yaw]);
  await waitPainted(p, { quiet: true });
  buf = await p.screenshot({ path: `shots/w117-jail-${tag}-fromcentre.png` });
  console.log(`  shots/w117-jail-${tag}-fromcentre.png  black ${(100 * await blackFraction(p, buf)).toFixed(1)}%`);
  // 3. close, along the facing the sprite is drawn for
  if (s.facing !== null) {
    const fx = s.x + Math.sin(s.facing) * 1.6, fz = s.z + Math.cos(s.facing) * 1.6;
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.18),
      [fx, fz, Math.atan2(s.x - fx, -(s.z - fz))]);
    await waitPainted(p, { quiet: true });
    buf = await p.screenshot({ path: `shots/w117-jail-${tag}-infront.png` });
    console.log(`  shots/w117-jail-${tag}-infront.png  black ${(100 * await blackFraction(p, buf)).toFixed(1)}%`);
  }
}
await b.close();

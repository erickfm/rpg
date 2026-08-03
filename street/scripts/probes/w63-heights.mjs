#!/usr/bin/env node
// ITEM 187: HOW MANY PEOPLE ARE THERE, AND HOW MANY HEIGHTS?
//
// *"make people different heights pls."*
//
// The row says a street with twenty people shows six heights repeated. Before
// widening anything, count it — BUILDER-BRIEF §6: a queue item is a hypothesis.
// Two populations exist and they are not the same code:
//
//   · `ct/crowd.ts`'s walkers, which carry `hs`/`ws` per CAST MEMBER
//   · every OTHER figure in the world — shop keepers, seated readers, park
//     sitters — placed by `citizenSprite()` from `ct/citizens.ts`
//
// The second set is invisible to `__ct.people()`, so this walks the scene for
// anything wearing `userData.citizen` as well.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w63-heights.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ct?.people !== undefined, { timeout: 20000 });
await waitPainted(p, { quiet: true });

const r = await p.evaluate(() => {
  const crowd = window.__ct.people().map((q) => ({ hs: +q.hs.toFixed(4), ws: +q.ws.toFixed(4), sp: q.sp }));
  const sprites = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen) return;
    o.updateWorldMatrix(true, false);
    const s = o.scale;
    const g = o.geometry;
    g.computeBoundingBox?.();
    const bb = g.boundingBox;
    sprites.push({
      sy: +s.y.toFixed(4), sx: +s.x.toFixed(4),
      // the DRAWN height in metres: the plane's own y extent times its scale.
      // geometry.parameters would be wrong wherever a translate was baked into
      // the vertices, and citizenPlane() bakes exactly that (origin at the feet).
      h: bb ? +((bb.max.y - bb.min.y) * s.y).toFixed(4) : null,
      seated: !!o.userData.seated,
      y: +o.matrixWorld.elements[13].toFixed(3),
    });
  });
  return { crowd, sprites };
});

const uniq = (a) => [...new Set(a)].sort((x, y) => x - y);
console.log(`\n  CROWD WALKERS (ct/crowd.ts): ${r.crowd.length}`);
console.log(`    hs values: ${JSON.stringify(r.crowd.map((c) => c.hs))}`);
console.log(`    distinct : ${uniq(r.crowd.map((c) => c.hs)).length}`
  + `   range ${Math.min(...r.crowd.map((c) => c.hs))} .. ${Math.max(...r.crowd.map((c) => c.hs))}`);
console.log(`    ws values: ${JSON.stringify(r.crowd.map((c) => c.ws))}`);

console.log(`\n  EVERY citizenSprite IN THE SCENE: ${r.sprites.length}`);
const hs = r.sprites.map((s) => s.h).filter((v) => v !== null);
const u = uniq(hs);
console.log(`    distinct DRAWN heights: ${u.length} of ${hs.length}`);
console.log(`    range ${Math.min(...hs)} .. ${Math.max(...hs)} m`);
const tally = {};
for (const h of hs) tally[h] = (tally[h] ?? 0) + 1;
const rep = Object.entries(tally).filter(([, n]) => n > 1).sort((a, c) => c[1] - a[1]);
console.log(`    heights shared by more than one person: ${rep.length}`);
for (const [h, n] of rep.slice(0, 12)) console.log(`      ${h} m  x${n}`);
console.log(`    seated: ${r.sprites.filter((s) => s.seated).length}`);
console.log(`    seated figures never move and never scale here: ct/crowd.ts has no`
  + ` 'seated' anywhere, and its six meshes carry no userData at all`);

// ── AND A STREET-LEVEL FRAME WITH A CROWD IN IT ──────────────────────────
//
// The item asks for one, and it is the only part of "different heights" a
// number cannot settle. Aimed by WALKING THE ANSWER OUT rather than by typing a
// coordinate (GOTCHAS §20): ask the world where the walkers actually are, take
// the tightest cluster of three, stand back from its centre and look at it.
// LET THEM WALK FIRST, because at t=0 the six are parked 16 m apart down the
// block (`z = 4 - i * 16` in the spawn) and no frame has two of them in it at a
// comparable distance. A picture of one person cannot answer "are they
// different heights". `SETTLE=30` seconds of wall time is the difference
// between a street and a line-up.
const SETTLE = Number(process.env.SETTLE ?? 0);
if (SETTLE > 0) {
  console.log(`  letting them walk for ${SETTLE} s…`);
  for (let i = 0; i < SETTLE; i++) await p.waitForTimeout(1000);
}

const shot = await p.evaluate(() => {
  const w = window.__ct.walkers();
  if (!w.length) return null;
  // the two closest together right now, and a viewpoint square to the line
  // between them so neither is favoured by distance
  let best = null;
  for (let i = 0; i < w.length; i++) {
    for (let j = i + 1; j < w.length; j++) {
      const d = Math.hypot(w[i].x - w[j].x, w[i].z - w[j].z);
      if (!best || d < best.d) best = { i, j, d };
    }
  }
  if (best && best.d < 7) {
    const a = w[best.i], c = w[best.j];
    const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    // perpendicular to the pair, 6 m back, on whichever side is the road
    const ux = (c.x - a.x) / best.d, uz = (c.z - a.z) / best.d;
    const px = mx - uz * 6, pz = mz + ux * 6;
    return { cx: px, cz: pz, pair: +best.d.toFixed(2), lookX: mx, lookZ: mz,
      all: w.map((q) => ({ x: +q.x.toFixed(1), z: +q.z.toFixed(1) })) };
  }
  // Stand on the road's centre line at the near end of the block and look down
  // it: the six spawn 16 m apart alternating sides, so this is the one view
  // that has all of them in it at once. Both numbers come from where they
  // ACTUALLY are — nothing about the block is typed here (GOTCHAS §20).
  const cx = w.reduce((s, q) => s + q.x, 0) / w.length;
  const cz = Math.max(...w.map((q) => q.z)) + 9;
  return { cx, cz, all: w.map((q) => ({ x: +q.x.toFixed(1), z: +q.z.toFixed(1) })) };
});
if (shot) {
  // yaw 0 looks down -z: the rig's forward is (sin yaw, -cos yaw), fp.ts:477.
  // With a pair to look AT, aim at it instead of down the block.
  await p.evaluate(({ cx, cz, lookX, lookZ }) => {
    const yaw = lookX === undefined ? 0 : Math.atan2(lookX - cx, -(lookZ - cz));
    window.__ct.warp(cx, cz, yaw, window.__ct.groundAt(cx, cz), -0.05);
  }, shot);
  await waitPainted(p, { quiet: true });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `/tmp/w63-crowd-${process.argv[2] ?? 'now'}.png` });
  console.log(`\n  street frame from (${shot.cx.toFixed(1)}, ${shot.cz.toFixed(1)}) looking down the block`);
  console.log(`  everybody: ${JSON.stringify(shot.all)}`);
  console.log(`  /tmp/w63-crowd-${process.argv[2] ?? 'now'}.png`);
}
console.log('');
await b.close();

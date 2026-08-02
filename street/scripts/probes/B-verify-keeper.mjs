// VERIFYING F's ROW: "make sure the people in the buildings are in the right
// orientation (bodega keeper faces away)".
//
// This row does NOT need a third measurement of the same thing. H measured all
// ten keepers from each room's own customer spot and owns the atlas; the
// auditor could not corroborate because its finder took "the first atlas-framed
// figure in the room" and picked up a customer sitting in a booth. Two
// instruments, one of them known wrong.
//
// What is actually unsettled is ONE disagreement about ONE room, and it is
// decidable by eye:
//
//   H:       bodega keeper = sector 4, "the only one actually facing away"
//   AUDITOR: bodega keeper = column 3, "in profile ... he is not dead away"
//
// So: stand where a customer stands, at the counter, and look at him. A third
// filter would just be a third population.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// THE BODEGA, BY ITS DECLARED DEPTH — not by "the lowest ceiling in the world".
//
// That superlative was true when I wrote this and is not any more: M has since
// built ct/int-bank.ts, and this probe walked straight into FIRST FEDERAL and
// reported its teller as the bodega keeper. A finder keyed on "the -est in the
// world" is a claim about every OTHER room, so anyone adding a room can falsify
// it without touching mine. ct/int-bodega.ts declares `d: 12.6, h: 2.6`; the
// depth is the room's own fact and nobody else's.
const room = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    m.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
             pl: n.geometry.type === 'PlaneGeometry' });
  });
  const xs = m.map((q) => (q.x0 + q.x1) / 2).sort((a, c) => a - c);
  const spans = []; let st = xs[0], pv = xs[0];
  for (const v of xs) { if (v - pv > 12) { spans.push([st, pv]); st = v; } pv = v; }
  spans.push([st, pv]);
  let best = null;
  for (const [s0, s1] of spans) {
    const inR = m.filter((q) => (q.x0 + q.x1) / 2 >= s0 - 6 && (q.x0 + q.x1) / 2 <= s1 + 6);
    if (inR.length < 30) continue;
    let ceil = null;
    for (const q of inR) {
      if (q.y0 < 2.0 || q.y1 - q.y0 > 0.4) continue;
      if ((q.x1 - q.x0) * (q.z1 - q.z0) > 8 && (ceil === null || q.y0 < ceil)) ceil = q.y0;
    }
    if (ceil === null) continue;
    // THE FLOOR's depth, not the mesh cluster's bounding box. The cluster
    // includes signage, awnings and anything overhanging, so the bank measured
    // 13.74 against its floor's 12.0 and beat the bodega's 12.6 — picking the
    // wrong room by 1.1 m of shopfront.
    let fl = null;
    for (const q of inR) {
      const a = (q.x1 - q.x0) * (q.z1 - q.z0);
      if (q.y1 <= 0.35 && (!fl || a > (fl.x1 - fl.x0) * (fl.z1 - fl.z0))) fl = q;
    }
    if (!fl) continue;
    const depth = fl.z1 - fl.z0;
    const err = Math.abs(depth - 12.6) + Math.abs(ceil - 2.6) * 4;
    if (!best || err < best.err) {
      // THE KEEPER IS THE FIGURE BEHIND A COUNTER, which is a positional
      // definition and not "the first figure I matched". A counter is a box
      // topping out between 0.85 and 1.20 m with a horizontal run over 1.5 m;
      // a figure is a standing plane about 1.5-1.9 m tall.
      const counters = inR.filter((q) => q.y1 > 0.85 && q.y1 < 1.25
        && Math.max(q.x1 - q.x0, q.z1 - q.z0) > 1.5 && q.y1 - q.y0 > 0.3);
      const figs = inR.filter((q) => q.pl && q.y1 - q.y0 > 1.3 && q.y1 - q.y0 < 2.1
        && q.y0 < 0.4 && Math.max(q.x1 - q.x0, q.z1 - q.z0) < 1.4);
      const scored = figs.map((f) => {
        const fx = (f.x0 + f.x1) / 2, fz = (f.z0 + f.z1) / 2;
        let d = Infinity, at = null;
        for (const c of counters) {
          const dx = Math.max(c.x0 - fx, 0, fx - c.x1), dz = Math.max(c.z0 - fz, 0, fz - c.z1);
          const dd = Math.hypot(dx, dz);
          if (dd < d) { d = dd; at = [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2]; }
        }
        return { fx: +fx.toFixed(2), fz: +fz.toFixed(2), d: +d.toFixed(2), counter: at };
      }).sort((a, c) => a.d - c.d);
      best = { err, ceil, depth: +depth.toFixed(2), x0: Math.min(...inR.map((q) => q.x0)), x1: Math.max(...inR.map((q) => q.x1)),
               z0: Math.min(...inR.map((q) => q.z0)), z1: Math.max(...inR.map((q) => q.z1)),
               counters: counters.length, figs: scored };
    }
  }
  return best;
});

console.log(`\nbodega (by ct/int-bodega.ts's own d: 12.6, h: 2.6 -> depth ${room.depth}, ceiling ${room.ceil.toFixed(2)}):` +
  ` x ${room.x0.toFixed(1)}..${room.x1.toFixed(1)}  z ${room.z0.toFixed(1)}..${room.z1.toFixed(1)}`);
console.log(`  ${room.counters} counter-height runs, ${room.figs.length} standing figures`);
for (const f of room.figs) {
  console.log(`    figure at (${f.fx}, ${f.fz})  ${f.d} m from the nearest counter` +
    (f.counter ? `  centred (${f.counter[0].toFixed(2)}, ${f.counter[1].toFixed(2)})` : ''));
}
const keeper = room.figs[0];
console.log(`\n  THE KEEPER is the figure behind a counter: (${keeper.fx}, ${keeper.fz}), ${keeper.d} m from it.`);
console.log(`  A positional definition, not "the first atlas figure in the room" — which is`);
console.log(`  what put a customer in a diner booth into the auditor's reading.`);

// stand at the counter, customer side, and look at him
// THE CUSTOMER SIDE IS THE SIDE THE SHOP FLOOR IS ON, which is toward the room
// centre — not simply "the far side of the counter from the keeper". My first
// version took that shortcut and put the camera at x 444.0, hard against the
// back wall, in a room that only reaches 444.6. It photographed the wall.
const cx = keeper.counter[0], cz = keeper.counter[1];
const rcx = (room.x0 + room.x1) / 2, rcz = (room.z0 + room.z1) / 2;
const dx = rcx - cx, dz = rcz - cz;
const L = Math.hypot(dx, dz) || 1;
// "Toward the room centre" is not the same as "on the shop floor": at 2.4 m it
// put the camera inside a gondola run and photographed the back of a shelf.
// The counter's own SERVED SIDE is the axis the keeper stands off — he is at
// CTR_X - 0.55 in ct/int-bodega.ts's own words — so a customer stands on the
// opposite side of that same axis, and stepping back means stepping further
// along it, not turning toward the middle of the room.
// AND STEPPING FURTHER BACK ALONG IT IS ALSO WRONG — at 2.6 m the camera is
// inside a gondola run and photographing the back of a shelf. Three geometric
// stations, two of them useless, which is the auditor's own failure on this
// same row and the reason I stopped generating them.
//
// USE THE WORLD'S OWN ANSWER. The at-counter frame carries the "[E] buy soda"
// prompt, so the game itself says a customer stands there. That is the station.
// The variants below only change the head angle from that one point.
const ax = Math.sign(cx - keeper.fx) || 1;
for (const [name, back, dzz, pitch] of [
  ['at-counter', 1.1, 0, -0.02],
  ['head-and-shoulders', 1.5, 0, -0.10],
  ['oblique', 1.4, 1.1, -0.08],
]) {
  const sx = cx - ax * back, sz = cz + dzz;
  const yaw = Math.atan2(keeper.fx - sx, -(keeper.fz - sz));
  void dx; void dz; void L;
  await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0, P), [sx, sz, yaw, pitch]);
  const lum = await settle(p);
  const f = `shots/B-verify-F/keeper-${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(40)} from (${sx.toFixed(2)}, ${sz.toFixed(2)})  mean ${lum.toFixed(4)}`);
}
await b.close();

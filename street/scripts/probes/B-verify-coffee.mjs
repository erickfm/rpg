// VERIFYING F's ROW: "what is this in the corner of the bodega" — the coffee
// station. F's own test is quoted in the source and it is the right one:
// "stand at the door and name it in one second."
//
// F's fix was two things and the second is the one that mattered: detail (taps,
// lids, drip tray, cup stack) AND a MOVE, from the back-left corner behind a
// gondola run to the front-left ahead of the shelving. So the verification has
// to be from the DOOR, because occlusion is what the move was for — a shot
// taken from beside the object would confirm the detail and miss the point.
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

// Find the bodega by what ct/int-bodega.ts DECLARES about it — 11.0 m deep and
// "the lowest ceiling in the world" at 2.6 — rather than by a coordinate.
const room = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    m.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z });
  });
  // cluster on x with a gap rule, the same way scripts/B-verify-floaters.mjs
  // does. My first attempt rounded centres to the nearest 20 m, which lands
  // between two rooms as often as on one and found nothing at all.
  const xs = m.map((q) => (q.x0 + q.x1) / 2).sort((a, c) => a - c);
  const spans = []; let start = xs[0], prev = xs[0];
  for (const v of xs) { if (v - prev > 12) { spans.push([start, prev]); start = v; } prev = v; }
  spans.push([start, prev]);
  let best = null;
  for (const [s0, s1] of spans) {
    const c = (s0 + s1) / 2;
    const inR = m.filter((q) => (q.x0 + q.x1) / 2 >= s0 - 6 && (q.x0 + q.x1) / 2 <= s1 + 6);
    if (inR.length < 30) continue;
    let ceil = null;
    for (const q of inR) {
      if (q.y0 < 2.0 || q.y1 - q.y0 > 0.4) continue;
      if ((q.x1 - q.x0) * (q.z1 - q.z0) > 8 && (ceil === null || q.y0 < ceil)) ceil = q.y0;
    }
    if (ceil === null) continue;
    if (!best || ceil < best.ceil) best = { c: +c.toFixed(1), ceil, x0: Math.min(...inR.map((q) => q.x0)),
      x1: Math.max(...inR.map((q) => q.x1)), z0: Math.min(...inR.map((q) => q.z0)),
      z1: Math.max(...inR.map((q) => q.z1)) };
  }
  return best;
});
console.log(`\nlowest-ceilinged room in the world: centre x ${room.c}, ceiling y ${room.ceil.toFixed(2)}`);
console.log(`  x ${room.x0.toFixed(1)}..${room.x1.toFixed(1)}   z ${room.z0.toFixed(1)}..${room.z1.toFixed(1)}`);
console.log(`  ct/int-bodega.ts declares 2.6 m — "the lowest ceiling in the world". Match: ${Math.abs(room.ceil - 2.6) < 0.1}`);

const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
const hd = (room.z1 - room.z0) / 2;
// stand just inside each end and look down the room, so whichever end the door
// is at, one of these IS the door station
// Straight in from each end tells you which end the door is; then the two
// views a player actually gets on the way in. The station sits front-LEFT by
// design ("where a corner shop actually puts coffee: by the door, where you
// pick it up on the way in"), so a shot straight down the room is the one view
// that is guaranteed to miss it, and confirming from that frame alone would be
// confirming the wrong thing.
for (const [name, x, z, yaw] of [
  ['from-plusZ', cx, cz + hd - 1.4, 0],
  ['from-minusZ', cx, cz - hd + 1.4, Math.PI],
  ['door-left', cx, cz + hd - 1.4, -Math.PI / 2],
  ['door-quarter', cx + 1.2, cz + hd - 0.9, -Math.PI / 3.2],
]) {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0.02), [x, z, yaw]);
  const lum = await settle(p);
  const f = `shots/B-verify-F/bodega-${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(40)} mean ${lum.toFixed(4)}${lum < 0.02 ? '  <-- BLACK' : ''}`);
}
await b.close();

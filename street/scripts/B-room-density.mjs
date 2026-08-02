// VERIFYING F's ROW: "thrift interior too thin".
//
// The row's ENTIRE evidence cell is four words — "thinnest room in the world" —
// with no number, no predicate and no station, against the ledger's own rule
// that a LANDED row says where to stand. So there is nothing to read; it has to
// be measured.
//
// The claim is a RANKING, so a ranking is what this produces: props per square
// metre of floor, every interior room, one predicate applied to all of them.
// A ranking is also the honest shape here — my absolute count depends on how a
// module happens to split its meshes, but "is the thrift still last?" survives
// that, because the same bias applies to every room.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const rooms = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    m.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z });
  });
  const xs = m.map((q) => (q.x0 + q.x1) / 2).sort((a, c) => a - c);
  const spans = []; let st = xs[0], pv = xs[0];
  for (const v of xs) { if (v - pv > 12) { spans.push([st, pv]); st = v; } pv = v; }
  spans.push([st, pv]);
  const out = [];
  for (const [s0, s1] of spans) {
    const inR = m.filter((q) => (q.x0 + q.x1) / 2 >= s0 - 6 && (q.x0 + q.x1) / 2 <= s1 + 6);
    if (inR.length < 25) continue;
    let floor = null, ceil = null;
    for (const q of inR) {
      const a = (q.x1 - q.x0) * (q.z1 - q.z0);
      if (q.y1 <= 0.35 && q.y1 - q.y0 <= 0.35 && (!floor || a > (floor.x1 - floor.x0) * (floor.z1 - floor.z0))) floor = q;
      if (q.y0 >= 2.0 && q.y1 - q.y0 <= 0.4 && a > 8 && (ceil === null || q.y0 < ceil)) ceil = q.y0;
    }
    if (!floor) continue;
    const W = floor.x1 - floor.x0, D = floor.z1 - floor.z0, A = W * D;
    // A PROP: something standing in the room. Not the shell (floor, walls,
    // ceiling), not a decal, not a fitting flat against a surface.
    const props = inR.filter((q) => {
      if (q === floor) return false;
      const w = q.x1 - q.x0, h = q.y1 - q.y0, d = q.z1 - q.z0;
      if (Math.min(w, h, d) < 0.02) return false;          // decals and painted marks
      if (w > W * 0.9 || d > D * 0.9) return false;         // walls, ceiling, the shell
      if (h > 2.4) return false;                            // full-height structure
      if (q.y0 > 2.2) return false;                         // ceiling fittings
      return w * d * h > 0.0015;                            // above a matchbox
    });
    out.push({ cx: +((floor.x0 + floor.x1) / 2).toFixed(0),
               cz: +((floor.z0 + floor.z1) / 2).toFixed(2), W: +W.toFixed(1), D: +D.toFixed(1),
               A: +A.toFixed(0), ceil: ceil === null ? null : +ceil.toFixed(2),
               n: props.length, per: +(props.length / A).toFixed(2) });
  }
  return out;
});

console.log('\n── props per square metre of floor, every interior room ──');
console.log('   (one predicate for all of them; the RANKING is the claim, not the absolute)\n');
console.log('   centre  floor        area   ceiling   props   per m2');
for (const r of rooms.sort((a, c) => a.per - c.per)) {
  console.log(`   x ${String(r.cx).padStart(4)}   ${String(r.W).padStart(5)} x ${String(r.D).padEnd(5)}` +
    ` ${String(r.A).padStart(4)} m2   ${String(r.ceil).padStart(5)}   ${String(r.n).padStart(5)}   ${r.per}`);
}
// int-thrift.ts declares 11.3 x 9.4 — find it by that, not by memory
const thrift = rooms.reduce((best, r) => {
  const e = Math.abs(r.W - 11.3) + Math.abs(r.D - 9.4);
  return !best || e < best.e ? { ...r, e } : best;
}, null);
console.log(`\n  ct/int-thrift.ts declares 11.3 x 9.4 m. Best match: ${thrift.W} x ${thrift.D} at x ${thrift.cx}` +
  `  (error ${thrift.e.toFixed(2)} m)`);
const rank = rooms.sort((a, c) => a.per - c.per).findIndex((r) => r.cx === thrift.cx) + 1;
console.log(`  THE THRIFT RANKS ${rank} of ${rooms.length} from the thin end, at ${thrift.per} props/m2.`);
console.log(`  "thinnest room in the world" would be rank 1.`);

for (const [name, dx, dz, yaw] of [['in', 0, 3.0, 0], ['back', 0, -3.0, Math.PI]]) {
  // THE ROOM'S OWN z CENTRE, not 0. Passing an absolute z put the camera
  // outside the building looking at the back of a clapboard wall — the third
  // station I have got wrong today by assuming a coordinate instead of reading
  // one, and the reason every probe here now returns the centre it measured.
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, -0.02),
    [thrift.cx + dx, thrift.cz + dz, yaw]);
  const lum = await settle(p);
  const f = `shots/B-verify-F/thrift-${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(38)} mean ${lum.toFixed(4)}`);
}
await b.close();

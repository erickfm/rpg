// VERIFYING G's ROW: "need a bit of space on entry area. maybe instead of slot
// we kill a row and add seat of some sort."
//
// The row makes four claims that can each be settled with a number, so none of
// them needs an opinion:
//
//   1. the front of the house is 4.95 m clear across the full 11 m width
//   2. eight places, ALL registered through ctx.seat()
//   3. a body sits ~0.16 m forward of the cushion's centre, and the SEAT is
//      registered at that same point so the two cannot drift
//   4. the slot-bank flanks AND TOPS are no longer untextured flat masses
//
// (4) is the half of this row that is easy to forget, because it came from the
// same screenshot but is a different complaint — "the black slot-bank sides are
// large untextured flat masses" — and it is the exact class A published helpers
// for. A verification that only checked the seating would pass a row half done.
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

const res = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    m.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
             mats, mod: n.userData.mod ?? '?' });
  });
  const xs = m.map((q) => (q.x0 + q.x1) / 2).sort((a, c) => a - c);
  const spans = []; let st = xs[0], pv = xs[0];
  for (const v of xs) { if (v - pv > 12) { spans.push([st, pv]); st = v; } pv = v; }
  spans.push([st, pv]);
  // the casino, by ct/int-casino.ts's own d: 36.0 — much the longest room
  let room = null;
  for (const [s0, s1] of spans) {
    const inR = m.filter((q) => (q.x0 + q.x1) / 2 >= s0 - 6 && (q.x0 + q.x1) / 2 <= s1 + 6);
    if (inR.length < 25) continue;
    let floor = null;
    for (const q of inR) {
      const a = (q.x1 - q.x0) * (q.z1 - q.z0);
      if (q.y1 <= 0.35 && (!floor || a > (floor.x1 - floor.x0) * (floor.z1 - floor.z0))) floor = q;
    }
    if (!floor) continue;
    const D = floor.z1 - floor.z0;
    if (!room || Math.abs(D - 36) < Math.abs(room.D - 36)) room = { inR, floor, D, };
  }
  const f = room.floor;
  const W = f.x1 - f.x0, D = f.z1 - f.z0;
  // THE SLOT BANKS: waist-high solids a couple of metres long standing on the
  // floor, which is what a bank of cabinets is.
  const banks = room.inR.filter((q) => q.y0 < 0.3 && q.y1 > 0.7 && q.y1 < 2.2
    && Math.max(q.x1 - q.x0, q.z1 - q.z0) > 1.2 && Math.min(q.x1 - q.x0, q.z1 - q.z0) > 0.4
    && (q.x1 - q.x0) < W * 0.8 && (q.z1 - q.z0) < D * 0.5);
  // the entry end is the one with the door; take the end with the most floor
  // clear of any bank, and report BOTH so the answer is not chosen by me
  const zs = banks.map((q) => [q.z0, q.z1]);
  const nearZ0 = Math.min(...zs.map((q) => q[0])), nearZ1 = Math.max(...zs.map((q) => q[1]));
  // UNTEXTURED FLAT MASSES: any face of a bank whose material carries no map
  let untex = 0, texd = 0;
  const untexArea = [];
  for (const q of banks) {
    for (const mm of q.mats) {
      if (!mm || !mm.color) continue;
      if (mm.map) { texd++; continue; }
      untex++;
      untexArea.push(+((q.x1 - q.x0) * (q.z1 - q.z0)).toFixed(2));
    }
  }
  return {
    room: { W: +W.toFixed(2), D: +D.toFixed(2), x0: +f.x0.toFixed(2), x1: +f.x1.toFixed(2),
            z0: +f.z0.toFixed(2), z1: +f.z1.toFixed(2) },
    banks: banks.length,
    frontClear: +(nearZ0 - f.z0).toFixed(2), backClear: +(f.z1 - nearZ1).toFixed(2),
    untex, texd, untexArea: untexArea.sort((a, c) => c - a).slice(0, 6),
    // SEATS entries are { pose, at, r, label } — the position is on `pose`,
    // not on the entry. Reading q.x directly threw; crosstown.ts:226 is the
    // shape, and guessing it is how you measure nothing.
    seats: (window.__ct.seats ? window.__ct.seats() : []).map((q) => ({
      x: +q.pose.x.toFixed(2), z: +q.pose.z.toFixed(2),
      ax: +q.at.x.toFixed(2), az: +q.at.z.toFixed(2),
      label: q.label ? String(q.label).slice(0, 30) : '' })),
  };
});

const R = res.room;
console.log(`\ncasino (longest room, by ct/int-casino.ts's own d: 36.0): ${R.W} x ${R.D} m` +
  `  x ${R.x0}..${R.x1}  z ${R.z0}..${R.z1}`);
console.log(`  ${res.banks} slot-bank-shaped solids`);
console.log(`\n── (1) clear floor at each end, across the full width ──`);
console.log(`  front (low z):  ${res.frontClear} m      back (high z): ${res.backClear} m`);
console.log(`  G claims 4.95 m clear at the entry. The larger of these two is ${Math.max(res.frontClear, res.backClear)} m.`);

// G's claim is EIGHT places IN THE ENTRY LOUNGE, not eight in the building.
// My first pass counted every seat in the casino and got 121, which does not
// contradict the row — it answers a different question. The entry lounge is
// the clear band at the front, so that is the band to count.
const band = Math.max(res.frontClear, res.backClear);
const atFront = res.frontClear >= res.backClear;
const lo = atFront ? R.z0 : R.z1 - band, hi = atFront ? R.z0 + band : R.z1;
const inRoom = res.seats.filter((q) => q.x > R.x0 - 2 && q.x < R.x1 + 2 && q.z >= lo - 0.6 && q.z <= hi + 0.6);
const allRoom = res.seats.filter((q) => q.x > R.x0 - 2 && q.x < R.x1 + 2 && q.z > R.z0 - 2 && q.z < R.z1 + 2);
console.log(`\n── (2) seats registered through ctx.seat() ──`);
console.log(`  ${res.seats.length} in the world, ${allRoom.length} in this room,` +
  ` ${inRoom.length} in the ENTRY BAND (z ${lo.toFixed(2)}..${hi.toFixed(2)})`);
for (const q of inRoom) console.log(`      seat (${q.x}, ${q.z})  approach (${q.ax}, ${q.az})  ${q.label}`);
console.log(`  G claims EIGHT places in the entry lounge. Entry-band count: ${inRoom.length}`);

console.log(`\n── (4) the slot banks: untextured flat masses? ──`);
console.log(`  bank materials with a map: ${res.texd}    with NO map: ${res.untex}`);
if (res.untexArea.length) console.log(`  largest untextured footprints (m2): ${JSON.stringify(res.untexArea)}`);

// ── and SIT ON ONE, because a seat is verified by sitting ─────────────────
if (inRoom.length) {
  const st = inRoom[0];
  // stand on the seat's OWN approach point, which crosstown.ts registers
  // beside it — not a metre off in an arbitrary direction
  await p.evaluate(([X, Z]) => window.__ct.warp(X, Z, 0, 0, 0.02), [st.ax, st.az]);
  await settle(p);
  const before = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  await p.keyboard.press('e');
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  console.log(`\n── (3) sat on the nearest registered place ──`);
  console.log(`  stood at ${JSON.stringify(before)}  ->  after [E] ${JSON.stringify(after)}`);
  console.log(`  eye dropped ${(before[1] - after[1]).toFixed(2)} m` +
    (before[1] - after[1] > 0.25 ? '   SEATED' : '   <-- did not sit'));
  await p.screenshot({ path: 'shots/B-verify-G/entry-seated.png' });
}
for (const [name, z, yaw] of [['entry', R.z0 + 2.0, Math.PI], ['banks', R.z0 + 6.0, Math.PI]]) {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0.03), [(R.x0 + R.x1) / 2, z, yaw]);
  const lum = await settle(p);
  const f = `shots/B-verify-G/entry-${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(36)} mean ${lum.toFixed(4)}`);
}
await b.close();

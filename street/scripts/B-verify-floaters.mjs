// VERIFYING F's ROW: "why are these decorations simply floating in the air in
// the diner?" — LANDED with the evidence *"floaters-walk: ZERO in the diner.
// The world's only four are at x=834.84, in the hotel."*
//
// THERE IS A NAMED REASON TO DOUBT THAT EVIDENCE, which is why this row is
// worth a verifier's time rather than a glance. A's own ledger row reports that
// `scripts/floaters-walk.mjs` **ignored its room argument** — "a filter that
// silently does not filter" — so a run asking about the diner swept the whole
// world instead. A "ZERO in the diner" from that instrument is not a
// measurement of the diner; it is a measurement of wherever it happened to
// look, reported under the diner's name.
//
// So this asks the question again with an instrument of my own, and does not
// import anything of F's or A's.
//
// WHAT A FLOATER IS, stated before measuring so the predicate cannot be tuned
// to the answer: a mesh whose lowest point is clear of the floor by more than a
// hand's width, with NOTHING BENEATH IT holding it up. Wall-mounted things are
// not floaters — a clock, a sign, a shelf bracketed to the wall are all
// supported — so anything whose footprint touches a wall band is excluded and
// SAID SO, rather than silently dropped.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const CLEAR = 0.12;      // a hand's width above the floor
const WALL = 0.40;       // how close to a wall still counts as bracketed

const res = await p.evaluate(([CLEAR, WALL]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // Find the interior rooms by their own floor slabs rather than by a
  // coordinate I remember: every room sits far out on +x, and its floor is the
  // widest horizontal surface in its neighbourhood.
  const meshes = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox;
    if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;                       // the interiors only
    meshes.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
                  mod: n.userData.mod ?? '?', type: n.geometry.type });
  });
  // cluster into rooms on x, which is how the interiors are laid out
  const xs = meshes.map((m) => (m.x0 + m.x1) / 2).sort((a, c) => a - c);
  const rooms = [];
  let start = xs[0], prev = xs[0];
  for (const v of xs) { if (v - prev > 12) { rooms.push([start, prev]); start = v; } prev = v; }
  rooms.push([start, prev]);

  const out = [];
  for (const [rx0, rx1] of rooms) {
    const inRoom = meshes.filter((m) => (m.x0 + m.x1) / 2 >= rx0 - 6 && (m.x0 + m.x1) / 2 <= rx1 + 6);
    if (inRoom.length < 20) continue;
    // the floor: the largest horizontal surface in the lowest 0.3 m
    let floor = null;
    for (const m of inRoom) {
      if (m.y1 - m.y0 > 0.35) continue;
      if (m.y1 > 0.35) continue;
      const a = (m.x1 - m.x0) * (m.z1 - m.z0);
      if (!floor || a > (floor.x1 - floor.x0) * (floor.z1 - floor.z0)) floor = m;
    }
    if (!floor) continue;
    const fy = floor.y1;
    const bx0 = floor.x0, bx1 = floor.x1, bz0 = floor.z0, bz1 = floor.z1;
    const supports = inRoom.filter((m) => m !== floor);
    const floaters = [], bracketed = [], hung = [], decal = [];
    // the ceiling: the largest horizontal surface ABOVE head height
    let ceilY = null;
    for (const m of inRoom) {
      if (m.y0 < 2.0 || m.y1 - m.y0 > 0.4) continue;
      const a = (m.x1 - m.x0) * (m.z1 - m.z0);
      if (a > 8 && (ceilY === null || m.y0 < ceilY)) ceilY = m.y0;
    }
    for (const m of inRoom) {
      if (m === floor) continue;
      if (m.y0 - fy <= CLEAR) continue;                       // standing on the floor
      // MY FIRST PREDICATE REPORTED 326 FLOATERS WORLD-WIDE and I am not
      // publishing that number, because it is my filter and not the world.
      // Two whole classes were being swept in:
      //   · things hung from the CEILING — pendants, fans, signboards — which
      //     are supported from above, so "nothing underneath" says nothing
      //     about them at all
      //   · zero-thickness PLANES: light pools, decals, painted marks. A decal
      //     has no underside to hold up.
      // Both are excluded and counted out loud below, rather than quietly.
      if (ceilY !== null && m.y1 > ceilY - 0.55) { hung.push(m); continue; }
      if (Math.min(m.x1 - m.x0, m.y1 - m.y0, m.z1 - m.z0) < 0.012) { decal.push(m); continue; }
      // is it against a wall? then something is holding it
      const nearWall = m.x0 - bx0 < WALL || bx1 - m.x1 < WALL
                    || m.z0 - bz0 < WALL || bz1 - m.z1 < WALL;
      if (nearWall) { bracketed.push(m); continue; }
      // is anything underneath it, overlapping in plan and topping out at or
      // above its base? a table leg, a counter, a shelf, another box
      // A LIP PROUD OF A COUNTER IS STILL ON THE COUNTER. The plan overlap is
      // taken with a 0.15 m allowance either way, or every edge trim, rail and
      // nosing in the world reads as hanging in mid-air — which is what the
      // diner's one and only "floater" turned out to be, a 7.8 m counter edge.
      const G = 0.15;
      const held = supports.some((q) => q !== m
        && q.x1 > m.x0 - G && q.x0 < m.x1 + G
        && q.z1 > m.z0 - G && q.z0 < m.z1 + G
        && q.y1 >= m.y0 - 0.08 && q.y0 < m.y0 - 0.01);
      if (!held) floaters.push(m);
    }
    out.push({ room: [+rx0.toFixed(1), +rx1.toFixed(1)],
               cx: +((bx0 + bx1) / 2).toFixed(1), cz: +((bz0 + bz1) / 2).toFixed(1),
               size: [+(bx1 - bx0).toFixed(1), +(bz1 - bz0).toFixed(1)],
               floorY: +fy.toFixed(3), n: inRoom.length,
               bracketed: bracketed.length, hung: hung.length, decal: decal.length,
               ceilY: ceilY === null ? null : +ceilY.toFixed(2),
               floaters: floaters.map((m) => ({
                 at: [+((m.x0 + m.x1) / 2).toFixed(2), +m.y0.toFixed(2), +((m.z0 + m.z1) / 2).toFixed(2)],
                 gap: +(m.y0 - fy).toFixed(2),
                 size: [+(m.x1 - m.x0).toFixed(2), +(m.y1 - m.y0).toFixed(2), +(m.z1 - m.z0).toFixed(2)],
                 mod: m.mod })) });
  }
  return out;
}, [CLEAR, WALL]);

console.log(`\n── every interior room: things in mid-air with nothing under them ──`);
console.log(`   (clear of the floor by more than ${CLEAR} m, and not within ${WALL} m of a wall)\n`);
let total = 0;
for (const r of res.sort((a, c) => c.floaters.length - a.floaters.length)) {
  console.log(`  room at x ${r.room[0]}..${r.room[1]}  centre (${r.cx}, ${r.cz})  ${r.size[0]} x ${r.size[1]} m` +
    `  floor y ${r.floorY}  ceiling y ${r.ceilY}  ${r.n} meshes`);
  console.log(`    excluded: ${r.bracketed} wall-mounted, ${r.hung} ceiling-hung, ${r.decal} decals`);
  console.log(`    FLOATERS: ${r.floaters.length}`);
  for (const f of r.floaters.slice(0, 8)) {
    console.log(`      at ${JSON.stringify(f.at)}  ${f.gap} m clear   ${JSON.stringify(f.size)}  ${f.mod}`);
  }
  total += r.floaters.length;
}
console.log(`\n  ${res.length} rooms, ${total} floaters world-wide`);

// ── and stand in the diner and look, because a number is not a picture ────
// The diner's door is declared in ct/int-diner.ts (building DINER, cz -49.5),
// and its interior slab is found above rather than remembered.
const diner = res.reduce((best, r) =>
  Math.abs(r.size[1] - 7.0) < Math.abs((best?.size[1] ?? 99) - 7.0) && r.size[0] > 10 && r.size[0] < 14 ? r : best, null);
if (diner) {
  console.log(`\n  the 12 x 7 m room (the diner, by ct/int-diner.ts's own d: 7.0 and w: 12) is at (${diner.cx}, ${diner.cz})`);
  for (const [name, dx, dz, yaw, pitch] of [
    ['mid', 0, -2.4, Math.PI, 0.10],
    ['back', 0, 2.4, 0, 0.10],
    ['up', 0, 0, Math.PI, 0.42],
  ]) {
    await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0, P),
      [diner.cx + dx, diner.cz + dz, yaw, pitch]);
    const lum = await settle(p);
    const f = `shots/B-verify-F/diner-${name}.png`;
    await p.screenshot({ path: f });
    console.log(`  ${f.padEnd(36)} mean ${lum.toFixed(4)}${lum < 0.02 ? '  <-- BLACK' : ''}`);
  }
}
await b.close();

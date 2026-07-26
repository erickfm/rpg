// SECOND VERIFIER (A) for E's ledger row "needs grass variation and more random
// placing. some clustering potential".
//
// E claims: 89 clumps of 1-15 tufts, 1.40 m apart, 57 with a clear metre beside
// them, sizes 0.55-1.45, and — the one with a player consequence —
//
//   "no tuft sits inside 94% of the half-width — nothing grows down the middle
//    of a path people walk on"
//
// STATION: the park gate, arriving on foot, which is the canonical one for the
// park. The look is judged from there; the keep-out is judged from the geometry,
// because a weed 20 cm into a 1.5 m path is not something a screenshot settles.
//
// IDENTIFIED STRUCTURALLY, not by name. A tuft is `weedTuft`'s output: a Group
// of exactly two crossed PlaneGeometry quads, 0.30 x 0.35 before scale, so the
// scale reads back as width/0.30. A park path is a horizontal PlaneGeometry
// whose width is PATH_W (1.5 m). Neither carries a userData tag — park meshes
// are unstamped, which is a gap I have already flagged to the desk — so the
// geometry IS the identifier here.
//
// The keep-out is tested in each path's OWN local frame rather than against an
// axis-aligned box, because the park's corner pieces are rotated in plan and an
// AABB around a rotated path would claim ground the path does not cover. That
// is the mistake that produced a false leak for me on D's row today.
//
//   node scripts/A-verify-park-weeds.mjs [port]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';

const PATH_W = 1.5, KEEP = 0.94;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 660 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13));
await p.waitForTimeout(600);

const r = await p.evaluate(([PATH_W, KEEP]) => {
  const scene = window.__ct.scene();
  const V = scene.position.constructor;
  const tufts = [], paths = [];
  // THE PARK IS ITS FIELD, not the spread of anything I collected. Deriving the
  // box from "every 1.5 m plane" put its east edge at x 1012 — interiors have
  // 1.5 m planes too — so the box became the whole world and every tuft and
  // every corridor floor fell inside it. That is the fourth time today a
  // predicate has been wider than the thing it names. The field is one
  // 32 x 30 m plane and it is the park's actual extent.
  let field = null;
  scene.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const g = o.geometry.parameters;
    if (g.width === 32 && g.height === 30) {
      const w = new V(); o.getWorldPosition(w);
      field = { x0: w.x - 16, x1: w.x + 16, z0: w.z - 15, z1: w.z + 15 };
    }
  });
  if (!field) return { fatal: 'no 32 x 30 m park field found — nothing measured' };
  const within = (x, z) => x >= field.x0 && x <= field.x1 && z >= field.z0 && z <= field.z1;
  scene.traverse((o) => {
    if (o.isGroup && o.children.length === 2 && o.children.every((c) => c.isMesh
        && c.geometry?.type === 'PlaneGeometry')) {
      const g = o.children[0].geometry.parameters;
      const sc = g.width / 0.30;
      if (Math.abs(g.height / 0.35 - sc) < 1e-6 && sc > 0.2 && sc < 3) {
        const w = new V(); o.getWorldPosition(w);
        if (within(w.x, w.z)) tufts.push({ x: w.x, z: w.z, sc });
      }
    }
    if (o.isMesh && o.geometry?.type === 'PlaneGeometry'
        && Math.abs(o.geometry.parameters.width - PATH_W) < 1e-6) {
      o.updateWorldMatrix(true, false);
      const w = new V(); o.getWorldPosition(w);
      // ON THE GROUND. Ten 1.5 x 1.5 m planes hang at y 3.74 in the park and
      // are not paths; a width match alone would have called them walked
      // surface. The real set is 2 runs of 12.8 m and 4 corners of 4.28 m.
      if (w.y > 1) return;
      if (within(w.x, w.z))
        paths.push({ x: w.x, z: w.z, len: o.geometry.parameters.height,
                     inv: o.matrixWorld.clone().invert().elements });
    }
  });
  const box = field, T = tufts;

  // KEEP-OUT, in each path's own local frame. A PlaneGeometry laid flat maps
  // local x across the path and local y along it.
  const half = PATH_W / 2, limit = half * KEEP;
  const bad = [];
  for (const t of T) {
    for (const q of paths) {
      const e = q.inv;
      const lx = e[0] * t.x + e[8] * 0 + e[12] + e[4] * 0;
      // full transform of (t.x, y, t.z) by the inverse matrix
      const vx = t.x, vy = 0, vz = t.z;
      const ax = e[0]*vx + e[4]*vy + e[8]*vz + e[12];
      const ay = e[1]*vx + e[5]*vy + e[9]*vz + e[13];
      const az = e[2]*vx + e[6]*vy + e[10]*vz + e[14];
      // laid flat by rotation.x = -PI/2, so local y runs along the path and
      // local z is the surface normal; "across" is local x either way.
      const along = Math.max(Math.abs(ay), Math.abs(az));
      if (Math.abs(ax) < limit && along <= q.len / 2) {
        bad.push({ x: +t.x.toFixed(2), z: +t.z.toFixed(2), across: +Math.abs(ax).toFixed(3),
                   piece: `${q.len.toFixed(2)}m @ ${q.x.toFixed(1)},${q.z.toFixed(1)}` });
        break;
      }
    }
  }

  // CLUMPS by single-link at 0.7 m — E's clumps have spread 0.34-0.64, so
  // tufts of one clump sit well inside that and separate clumps are metres off.
  const used = new Array(T.length).fill(false);
  const clumps = [];
  for (let i = 0; i < T.length; i++) {
    if (used[i]) continue;
    const q = [i]; used[i] = true; const mem = [];
    while (q.length) {
      const k = q.pop(); mem.push(T[k]);
      for (let j = 0; j < T.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(T[k].x - T[j].x, T[k].z - T[j].z) <= 0.7) { used[j] = true; q.push(j); }
      }
    }
    clumps.push({ n: mem.length,
      x: mem.reduce((s, m) => s + m.x, 0) / mem.length,
      z: mem.reduce((s, m) => s + m.z, 0) / mem.length });
  }
  // nearest-neighbour between clump centres, and how many have a clear metre
  const nn = clumps.map((c) => {
    let d = Infinity;
    for (const o of clumps) if (o !== c) d = Math.min(d, Math.hypot(c.x - o.x, c.z - o.z));
    return d;
  });
  const clear = nn.filter((d) => d >= 1).length;
  const sorted = [...nn].sort((a, b) => a - b);
  return {
    park: box, nAll: tufts.length, nPark: T.length, paths: paths.length,
    scMin: Math.min(...T.map((t) => t.sc)), scMax: Math.max(...T.map((t) => t.sc)),
    clumps: clumps.length, sizes: clumps.map((c) => c.n),
    nnMed: sorted[sorted.length >> 1], nnMean: nn.reduce((a, c) => a + c, 0) / nn.length,
    clear, bad: bad.slice(0, 12), nBad: bad.length, pieces: [...new Set(bad.map(x=>x.piece))],
  };
}, [PATH_W, KEEP]);

const f = (v) => (typeof v === 'number' ? v.toFixed(2) : v);
console.log(`\npark taken from its own paths: x ${f(r.park.x0)}..${f(r.park.x1)}  z ${f(r.park.z0)}..${f(r.park.z1)}`);
console.log(`pieces violated: ${(r.pieces||[]).join(' | ') || 'none'}`);
console.log(`${r.paths} path pieces ${PATH_W} m wide · ${r.nPark} tufts in the park (${r.nAll} in the world)\n`);
console.log(`  E said                          measured`);
console.log(`  sizes 0.55-1.45                 ${f(r.scMin)}-${f(r.scMax)}`);
console.log(`  89 clumps                       ${r.clumps}   of ${Math.min(...r.sizes)}-${Math.max(...r.sizes)} tufts (E said 1-15)`);
console.log(`  1.40 m apart                    median ${f(r.nnMed)}  mean ${f(r.nnMean)}`);
console.log(`  57 with a clear metre           ${r.clear}`);
console.log(`  nothing inside 94% of half      ${r.nBad} tuft(s) closer than ${(PATH_W / 2 * KEEP).toFixed(3)} m to a path centre`);
if (r.nBad) {
  console.log(`\n  worst:`);
  for (const t of r.bad) console.log(`    (${t.x}, ${t.z})  ${t.across} m from centre  — path ${t.piece}`);
}

// THE LOOK, from the gate, on foot. The gate is on the park's +x side at its
// z centre; walk in from the pavement rather than warping to the middle.
const gx = r.park.x1 - 6 + 2.5, gz = (r.park.z0 + r.park.z1) / 2;
for (const [tag, x, z, tx, tz] of [
  ['gate',   gx + 3, gz,        gx - 6, gz],
  ['inside', gx - 4, gz,        gx - 14, gz],
  ['path',   gx - 8, gz + 5,    gx - 14, gz - 2],
]) {
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
    [x, z, Math.atan2(tx - x, -(tz - z))]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/A-park-weeds-${tag}.png` });
}
console.log(`\nshots/A-park-weeds-{gate,inside,path}.png`);
await b.close();
if (r.nBad) {
  console.error(`\nMEASURED WRONG — ${r.nBad} tuft(s) grow inside the walked width of a path.`);
  process.exit(1);
}
console.log(`\nMEASURED FINE — nothing grows down the middle of a path.`);

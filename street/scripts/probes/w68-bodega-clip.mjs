// Item 177 — WHAT ACTUALLY INTERPENETRATES INSIDE THE BODEGA?
//
// The user: *"bodega is a bit crowded and lots of clipping inside."* Plural.
// The pair in his screenshot is a SAMPLE, so this sweeps the whole room rather
// than looking at the one he framed.
//
// TWO MEASUREMENTS, because the complaint has two halves and only one of them
// is objective:
//
//   A. COLLIDER OVERLAP — two fixtures claiming the same floor. Objective, and
//      it is also the crowding measurement in disguise: floor a collider owns
//      is floor the player cannot stand on.
//   B. MESH-BOX OVERLAP between separate FIXTURES — the visible clipping. The
//      hard part is that a fixture is many meshes on purpose (a counter body,
//      its top, its register) and those are MEANT to touch. So meshes are
//      clustered into fixtures first, by the `put()` call that placed them,
//      and only cross-cluster overlap is reported.
//
// It PRINTS; it does not assert. This is the look that comes before the fix
// (BUILDER-BRIEF §6 — measure the world before you change it).
//
// Usage: SHOT_URL=http://localhost:4240/ node scripts/probes/w68-bodega-clip.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4240/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);

// Where IS the bodega? Asked, never typed — interiors have moved +80 m once
// already and ~15 CONFIRMED rows still cite the room that used to be there.
// `roomDims()` publishes clear size wall-face to wall-face plus world centre,
// which is exactly the band, and it is the room's OWN account of itself.
const room = await p.evaluate(() => {
  const rs = window.__ct.roomDims?.() ?? [];
  const r = rs.find((q) => /bodega/i.test(q.id ?? ''));
  return r ? JSON.parse(JSON.stringify(r)) : { ids: rs.map((q) => q.id) };
});
console.log('bodega room:', JSON.stringify(room));
if (!room || room.ids) { console.log('cannot locate the room; stopping'); await b.close(); process.exit(3); }

const R = { x0: room.cx - room.w / 2, x1: room.cx + room.w / 2,
            z0: room.cz - room.d / 2, z1: room.cz + room.d / 2 };
console.log('room band:', JSON.stringify(R));

const data = await p.evaluate((R) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const inRoom = (x, z) => x > R.x0 - 1 && x < R.x1 + 1 && z > R.z0 - 1 && z < R.z1 + 1;

  // ── A. the colliders that live in this room ──────────────────────────────
  const cols = (window.__ct.colliders?.() ?? [])
    .filter((c) => inRoom((c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2))
    .map((c, i) => ({ i, minX: +c.minX.toFixed(3), maxX: +c.maxX.toFixed(3),
                      minZ: +c.minZ.toFixed(3), maxZ: +c.maxZ.toFixed(3),
                      w: +(c.maxX - c.minX).toFixed(3), d: +(c.maxZ - c.minZ).toFixed(3) }));

  // ── B. the meshes ────────────────────────────────────────────────────────
  const M = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (!inRoom(cx, cz)) return;
    const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
    // WALLS ARE NOT FURNITURE, and "spans most of the room" does not catch
    // them: the chamfer leaf is a 1.48 x 1.48 plane at 45 degrees and the front
    // wall comes in 5.25 m segments, both well under the room's 8.8 x 12.6.
    // FULL HEIGHT is the discriminator that works — the room is 2.6 m and every
    // wall runs floor to ceiling, while the tallest fixture in here is a
    // gondola carcass at 1.95 (`int-bodega.ts:270`, BoxGeometry(GOND_W, 1.95,
    // GOND_L)). 2.4 sits between the two with 0.45 m of daylight either side.
    // My first cut used the span rule alone and reported 15 "interpenetrating
    // fixtures", of which the top four were all the same door-corner wall.
    const spanX = w > (R.x1 - R.x0) * 0.8, spanZ = d > (R.z1 - R.z0) * 0.8;
    const kind = (spanX || spanZ || h >= 2.4) ? 'structure' : (h < 0.02 ? 'sheet' : 'fixture');
    M.push({
      name: o.name || '(unnamed)', kind,
      x0: +bb.min.x.toFixed(3), x1: +bb.max.x.toFixed(3),
      y0: +bb.min.y.toFixed(3), y1: +bb.max.y.toFixed(3),
      z0: +bb.min.z.toFixed(3), z1: +bb.max.z.toFixed(3),
      w: +w.toFixed(3), h: +h.toFixed(3), d: +d.toFixed(3),
      vol: +(w * h * d).toFixed(4),
      geo: o.geometry.type,
    });
  });
  return { cols, meshes: M };
}, R);

const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// ── A. colliders sharing floor ─────────────────────────────────────────────
console.log(`\n=== A. COLLIDERS in the bodega: ${data.cols.length}`);
const colPairs = [];
for (let i = 0; i < data.cols.length; i++) for (let j = i + 1; j < data.cols.length; j++) {
  const a = data.cols[i], c = data.cols[j];
  const ax = ov(a.minX, a.maxX, c.minX, c.maxX), az = ov(a.minZ, a.maxZ, c.minZ, c.maxZ);
  if (ax > 0.001 && az > 0.001) colPairs.push({ i, j, area: +(ax * az).toFixed(4), ax: +ax.toFixed(3), az: +az.toFixed(3), a, c });
}
colPairs.sort((x, y) => y.area - x.area);
console.log(`colliders sharing floor: ${colPairs.length}`);
for (const q of colPairs) {
  console.log(`  ${q.area} m2  [${q.i}] ${q.a.w}x${q.a.d} @ (${((q.a.minX + q.a.maxX) / 2).toFixed(2)}, ${((q.a.minZ + q.a.maxZ) / 2).toFixed(2)})`
    + `  X  [${q.j}] ${q.c.w}x${q.c.d} @ (${((q.c.minX + q.c.maxX) / 2).toFixed(2)}, ${((q.c.minZ + q.c.maxZ) / 2).toFixed(2)})`);
}

// ── B. fixtures interpenetrating ───────────────────────────────────────────
const fx = data.meshes.filter((m) => m.kind === 'fixture' && m.vol > 0.004);
console.log(`\n=== B. FIXTURE MESHES (vol > 0.004 m3, not structure): ${fx.length} of ${data.meshes.length}`);

// CLUSTER FIRST. A fixture is many meshes on purpose and they are meant to
// touch; only cross-fixture overlap is a defect. Union-find over "boxes that
// overlap in all three axes" would merge everything, so the link is the weaker
// and more honest one: boxes whose CENTRES are within 0.45 m horizontally and
// which overlap in y. That keeps a counter with its top and its register, and
// keeps two gondolas 0.95 m apart separate.
const parent = fx.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const link = (i, j) => { const a = find(i), c = find(j); if (a !== c) parent[a] = c; };
for (let i = 0; i < fx.length; i++) for (let j = i + 1; j < fx.length; j++) {
  const a = fx[i], c = fx[j];
  const cxa = (a.x0 + a.x1) / 2, cza = (a.z0 + a.z1) / 2;
  const cxc = (c.x0 + c.x1) / 2, czc = (c.z0 + c.z1) / 2;
  if (Math.hypot(cxa - cxc, cza - czc) < 0.45 && ov(a.y0, a.y1, c.y0, c.y1) > 0) link(i, j);
}
const cluster = new Map();
fx.forEach((m, i) => {
  const k = find(i);
  if (!cluster.has(k)) cluster.set(k, { members: [], x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 });
  const g = cluster.get(k);
  g.members.push(m);
  g.x0 = Math.min(g.x0, m.x0); g.x1 = Math.max(g.x1, m.x1);
  g.y0 = Math.min(g.y0, m.y0); g.y1 = Math.max(g.y1, m.y1);
  g.z0 = Math.min(g.z0, m.z0); g.z1 = Math.max(g.z1, m.z1);
});
const groups = [...cluster.values()];
console.log(`clustered into ${groups.length} fixtures`);

const pairs = [];
for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
  const a = groups[i], c = groups[j];
  const ix = ov(a.x0, a.x1, c.x0, c.x1), iy = ov(a.y0, a.y1, c.y0, c.y1), iz = ov(a.z0, a.z1, c.z0, c.z1);
  if (ix > 0.005 && iy > 0.005 && iz > 0.005) {
    pairs.push({ vol: +(ix * iy * iz).toFixed(4), ix: +ix.toFixed(3), iy: +iy.toFixed(3), iz: +iz.toFixed(3), a, c });
  }
}
pairs.sort((x, y) => y.vol - x.vol);
console.log(`FIXTURE PAIRS THAT INTERPENETRATE: ${pairs.length}`);
const nm = (g) => `${g.members.length}m ${(g.x1 - g.x0).toFixed(2)}x${(g.y1 - g.y0).toFixed(2)}x${(g.z1 - g.z0).toFixed(2)}`
  + ` @ (${((g.x0 + g.x1) / 2).toFixed(2)}, ${((g.y0 + g.y1) / 2).toFixed(2)}, ${((g.z0 + g.z1) / 2).toFixed(2)})`;
for (const q of pairs) {
  console.log(`  ${q.vol} m3  (${q.ix} x ${q.iy} x ${q.iz})`);
  console.log(`        A: ${nm(q.a)}   [${q.a.members.map((m) => m.geo).join(',')}]`);
  console.log(`        B: ${nm(q.c)}   [${q.c.members.map((m) => m.geo).join(',')}]`);
}

console.log(`\nconsole errors: ${errs.length}`);
await b.close();

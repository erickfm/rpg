// Close-up, line-of-sight verification of every interior person: is the
// atlas adopted, does the figure read (not flat), is it floating or clipping
// its seat? bugsweep's entry/far/wide stations are generic room-shape
// cameras and often do not have the shopkeeper in frame at all — this script
// finds each citizen-tagged mesh directly (userData.citizen, set only by
// ct/interior.ts's room.person()) and aims a standable, sight-verified
// camera at it, the same technique aim.mjs uses for cars and benches.
//
// Grouped by room via roomDims() so the output reads "one shot per keeper
// per room" rather than one shot per mesh (a room with three tellers would
// otherwise get three near-identical frames).
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4177/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);

const data = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const people = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.userData?.citizen) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    people.push({
      cx: (bb.min.x + bb.max.x) / 2, cz: (bb.min.z + bb.max.z) / 2,
      y0: bb.min.y, y1: bb.max.y,
      seated: !!o.userData.seated,
    });
  });
  const rooms = window.__ct.roomDims();
  return { people, rooms };
});

console.log(`FOUND ${data.people.length} citizen-tagged meshes across ${data.rooms.length} rooms`);

// bucket each person into the nearest room by centre distance
const buckets = new Map();
for (const person of data.people) {
  let best = null, bestD = Infinity;
  for (const r of data.rooms) {
    const d = Math.hypot(person.cx - r.cx, person.cz - r.cz);
    if (d < bestD) { bestD = d; best = r; }
  }
  if (!best) continue;
  if (!buckets.has(best.id)) buckets.set(best.id, []);
  buckets.get(best.id).push(person);
}

for (const r of data.rooms) {
  const list = buckets.get(r.id) ?? [];
  console.log(`  ${r.id.padEnd(10)} ${list.length} tagged person(es)` +
    (list.length ? `  y0 ${list.map(q => q.y0.toFixed(2)).join(',')}` : '  — NONE TAGGED'));
}

async function shoot(label, subj) {
  const r = await p.evaluate(([subj]) => {
    const R = 0.36, cols = window.__ct.colliders().filter(c => c && isFinite(c.minX));
    const inside = (x, z, pad) => cols.some(c =>
      x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad);
    const own = cols.filter(c => subj.cx > c.minX - 0.3 && subj.cx < c.maxX + 0.3 && subj.cz > c.minZ - 0.3 && subj.cz < c.maxZ + 0.3);
    const blocked = (x, z) => {
      const n = Math.ceil(Math.hypot(subj.cx - x, subj.cz - z) / 0.2);
      for (let i = 1; i < n; i++) {
        const t = i / n, px = x + (subj.cx - x) * t, pz = z + (subj.cz - z) * t;
        if (cols.some(c => !own.includes(c) && px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ)) return true;
      }
      return false;
    };
    const cands = [];
    const PREF = 2.6;   // a natural "standing across the counter" distance
    for (let a = 0; a < 360; a += 10) {
      const rad = a * Math.PI / 180;
      for (const dist of [2.0, 2.6, 3.2, 4.0]) {
        const x = subj.cx + Math.sin(rad) * dist, z = subj.cz + Math.cos(rad) * dist;
        if (inside(x, z, R)) continue;
        if (blocked(x, z)) continue;
        cands.push({ x, z, dist });
      }
    }
    if (!cands.length) return { ok: false, why: 'no standable line-of-sight point' };
    cands.sort((u, v) => Math.abs(u.dist - PREF) - Math.abs(v.dist - PREF));
    const c = cands[0];
    const yaw = Math.atan2(subj.cx - c.x, -(subj.cz - c.z));
    const eye = 0.14 + 1.6;
    const aimY = (subj.y0 + subj.y1) / 2;
    const pitch = Math.atan2(aimY - eye, c.dist);
    window.__ct.warp(c.x, c.z, yaw, 0.14, pitch);
    return { ok: true, x: +c.x.toFixed(2), z: +c.z.toFixed(2) };
  }, [subj]);
  if (!r.ok) { console.log(`   MISS  ${label}: ${r.why}`); return; }
  await p.waitForTimeout(280);
  const land = await p.evaluate(() => window.__ct.pos());
  const drift = Math.hypot(land[0] - r.x, land[2] - r.z);
  await p.screenshot({ path: `shots/people-${label}.png` });
  console.log(`   shot  ${label}  from (${r.x}, ${r.z})  drift ${drift.toFixed(2)} m`);
}

// Within a room, don't average people who are far apart (e.g. jail's guard
// desk vs. a separate cell) into one meaningless midpoint camera — cluster by
// proximity (<3.5 m) first, the same connected-components idea aim.mjs uses,
// and shoot each cluster on its own.
const cluster = (list, gap = 3.5) => {
  const seen = new Array(list.length).fill(false), out = [];
  for (let i = 0; i < list.length; i++) {
    if (seen[i]) continue;
    const stack = [i], mem = []; seen[i] = true;
    while (stack.length) {
      const k = stack.pop(); mem.push(list[k]);
      for (let j = 0; j < list.length; j++) {
        if (seen[j]) continue;
        if (Math.hypot(list[k].cx - list[j].cx, list[k].cz - list[j].cz) < gap) { seen[j] = true; stack.push(j); }
      }
    }
    out.push(mem);
  }
  return out;
};

for (const [id, list] of buckets) {
  if (!list.length) continue;
  const groups = cluster(list);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const cx = g.reduce((a, q) => a + q.cx, 0) / g.length;
    const cz = g.reduce((a, q) => a + q.cz, 0) / g.length;
    const y0 = Math.min(...g.map(q => q.y0)), y1 = Math.max(...g.map(q => q.y1));
    const label = groups.length > 1 ? `${id}-${gi}` : id;
    await shoot(label, { cx, cz, y0, y1 });
  }
}

const untagged = data.rooms.filter((r) => !(buckets.get(r.id) ?? []).length);
if (untagged.length) console.log(`\nROOMS WITH NO TAGGED PERSON: ${untagged.map(r => r.id).join(', ')}`);
await b.close();

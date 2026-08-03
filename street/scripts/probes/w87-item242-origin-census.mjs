// ITEM 242 — WHAT ACTUALLY IDLES AT THE WORLD ORIGIN?
//
// The row says five pooled vehicle boxes sit at (0,0). ct/traffic.ts:236 creates
// every pooled box at 999 and :256 returns it to 999 when idle, so before moving
// anything, count what is really there — the desk's stated cause has been wrong
// often enough that BUILDER-BRIEF §6a exists.
//
// Reports every collider and every citAvoid box that CONTAINS the origin or sits
// within 2 m of it, with its extents, so a degenerate point-box at (0,0) is
// distinguishable from a real building wall that happens to span it.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const SECS = Number(process.env.SECS ?? 0);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 520 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
if (SECS) await p.waitForTimeout(SECS * 1000);

const out = await p.evaluate(() => {
  const near = (b) => {
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const contains = b.minX <= 0 && b.maxX >= 0 && b.minZ <= 0 && b.maxZ >= 0;
    return { contains, d: Math.hypot(cx, cz), cx, cz };
  };
  const fmt = (b) => ({
    minX: +b.minX.toFixed(3), maxX: +b.maxX.toFixed(3),
    minZ: +b.minZ.toFixed(3), maxZ: +b.maxZ.toFixed(3),
    w: +(b.maxX - b.minX).toFixed(3), d: +(b.maxZ - b.minZ).toFixed(3),
  });
  const scan = (arr, label) => {
    const hits = [];
    for (const b of arr || []) {
      if (!b || typeof b.minX !== 'number') continue;
      const n = near(b);
      if (n.contains || n.d < 2) hits.push({ label, ...fmt(b), contains: n.contains, centre: [+n.cx.toFixed(3), +n.cz.toFixed(3)] });
    }
    return hits;
  };
  const cols = window.__ct.colliders ? window.__ct.colliders() : [];
  const av = window.__ct.citAvoid ? window.__ct.citAvoid() : [];
  // how many boxes sit exactly at the 999 parking spot, for comparison
  const parked999 = (cols || []).filter((b) => b && b.minX === 999 && b.minZ === 999).length;
  const parked999av = (av || []).filter((b) => b && b.minX === 999 && b.minZ === 999).length;
  return {
    colliders: (cols || []).length, citAvoid: (av || []).length,
    parked999, parked999av,
    atOrigin: scan(cols, 'collider').concat(scan(av, 'citAvoid')),
  };
});
// ── AND THE SCENE GRAPH, which is a different question ───────────────────
// The row says "boxes". Eightyfive's own note says "car-BODY boxes … bbox
// centred on x 0, z 0", found by `world-contained.mjs`, which traverses the
// SCENE and deliberately ignores `visible` (GOTCHAS 79). Colliders and meshes
// are two different populations and only one of them can be the subject.
const meshes = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const hits = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const g = n.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (Math.hypot(cx, cz) > 3) return;
    let vis = true; for (let q = n; q; q = q.parent) if (q.visible === false) vis = false;
    hits.push({
      w: +(bb.max.x - bb.min.x).toFixed(2), h: +(bb.max.y - bb.min.y).toFixed(2),
      d: +(bb.max.z - bb.min.z).toFixed(2),
      y: [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)],
      c: [+cx.toFixed(2), +cz.toFixed(2)], vis, own: n.visible,
      parent: n.parent && n.parent.type, mod: (n.userData && n.userData.mod) || '',
    });
  });
  return hits;
});
console.log(`colliders ${out.colliders}   citAvoid ${out.citAvoid}`);
console.log(`boxes parked exactly at 999: colliders ${out.parked999}, citAvoid ${out.parked999av}`);
console.log(`\nboxes containing (0,0) or centred within 2 m of it: ${out.atOrigin.length}`);
for (const h of out.atOrigin) {
  console.log(`  ${h.label.padEnd(8)} x[${h.minX}, ${h.maxX}] z[${h.minZ}, ${h.maxZ}]  ${h.w} x ${h.d} m  centre (${h.centre})  contains-origin=${h.contains}`);
}
console.log(`\nMESHES whose bbox centre is within 3 m of the origin: ${meshes.length}`);
const visN = meshes.filter((m) => m.vis).length;
console.log(`  of those, currently visible: ${visN}   hidden by a visible=false: ${meshes.length - visN}`);
for (const m of meshes.slice(0, 14)) {
  console.log(`  ${m.w} x ${m.h} x ${m.d} m  y[${m.y}]  centre (${m.c})  visible=${m.vis} (own ${m.own})  mod=${m.mod}`);
}
await b.close();

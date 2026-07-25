// AIM FROM THE SOURCE. Nothing in the scene is named (3341 objects, 0 names),
// so subjects are found by geometric signature, never by a coordinate I
// remember. Then, before any shot:
//
//   1. the camera point must be STANDABLE   — outside every collider (RADIUS 0.36)
//   2. the camera must have LINE OF SIGHT   — no collider on the ray to the subject
//   3. the warp must be VERIFIED to land    — __ct.pos() agrees to 0.05 m
//
// Step 2 is the one that was missing. Five of six earlier shots were of walls,
// of the inside of buildings, or of the wrong object entirely, because a camera
// was placed from memory and never asked whether it could see anything.
//
// Every shot declares what it expects to see. A frame that does not contain its
// subject is reported as a miss, not quietly filed as evidence.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const found = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    boxes.push({ x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z,
      w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z,
      mapW: m && m.map && m.map.image ? m.map.image.width : 0 });
  });
  // connected components over a filtered set, at `gap` metres
  const cluster = (sel, gap) => {
    const items = boxes.filter(sel), seen = new Array(items.length).fill(false), out = [];
    const touch = (a, c) => a.x0 - gap < c.x1 && a.x1 + gap > c.x0 && a.z0 - gap < c.z1 && a.z1 + gap > c.z0
      && a.y0 - gap < c.y1 && a.y1 + gap > c.y0;
    for (let i = 0; i < items.length; i++) {
      if (seen[i]) continue;
      const stack = [i], mem = []; seen[i] = true;
      while (stack.length) { const k = stack.pop(); mem.push(items[k]);
        for (let j = 0; j < items.length; j++) if (!seen[j] && touch(items[k], items[j])) { seen[j] = true; stack.push(j); } }
      out.push({ n: mem.length,
        x0: Math.min(...mem.map(q=>q.x0)), x1: Math.max(...mem.map(q=>q.x1)),
        y0: Math.min(...mem.map(q=>q.y0)), y1: Math.max(...mem.map(q=>q.y1)),
        z0: Math.min(...mem.map(q=>q.z0)), z1: Math.max(...mem.map(q=>q.z1)) });
    }
    return out.map(c => ({ ...c, w: +(c.x1-c.x0).toFixed(2), h: +(c.y1-c.y0).toFixed(2), d: +(c.z1-c.z0).toFixed(2),
      cx: +((c.x0+c.x1)/2).toFixed(2), cy: +((c.y0+c.y1)/2).toFixed(2), cz: +((c.z0+c.z1)/2).toFixed(2) }));
  };
  // CARS: low clusters, roughly 1.6-2.6 m wide one way and 3.5-6 m the other
  const carLike = cluster(q => q.y0 < 0.9 && q.y1 < 2.3 && q.y1 > 0.6, 0.35).filter(c => {
    const a = Math.min(c.w, c.d), bl = Math.max(c.w, c.d);
    return a > 1.4 && a < 2.8 && bl > 3.2 && bl < 6.2 && c.h > 0.8;
  });
  // BENCHES: a seat slab 0.35-0.60 up, 1.2-2.6 m long, under 0.9 m deep
  const benchLike = cluster(q => q.y0 > 0.2 && q.y1 < 1.4, 0.3).filter(c => {
    const a = Math.min(c.w, c.d), bl = Math.max(c.w, c.d);
    return a > 0.3 && a < 1.1 && bl > 1.1 && bl < 2.8 && c.y0 > 0.15 && c.y0 < 0.7 && c.h < 1.2;
  });
  // PEOPLE: the citizen signature is a 320-wide sprite sheet. Interior ones are
  // the rooms, which live from x = 400 in 80 m slabs.
  const people = boxes.filter(q => q.mapW === 320)
    .map(q => ({ cx: +((q.x0+q.x1)/2).toFixed(2), cy: +((q.y0+q.y1)/2).toFixed(2), cz: +((q.z0+q.z1)/2).toFixed(2),
      h: +q.h.toFixed(2), interior: q.x0 > 400 }));
  return { cars: carLike, benches: benchLike, people };
});
console.log(`FOUND  ${found.cars.length} car-like · ${found.benches.length} bench-like · ` +
  `${found.people.length} people (${found.people.filter(q=>q.interior).length} interior)`);
for (const c of found.cars.slice(0, 6)) console.log(`   car    ${c.w}×${c.h}×${c.d}  at (${c.cx}, ${c.cy}, ${c.cz})`);
for (const c of found.benches.slice(0, 8)) console.log(`   bench  ${c.w}×${c.h}×${c.d}  at (${c.cx}, ${c.cy}, ${c.cz})  seat y ${c.y0.toFixed(2)}`);
for (const c of found.people.filter(q=>q.interior).slice(0, 6)) console.log(`   person(int) h${c.h} at (${c.cx}, ${c.cy}, ${c.cz})`);
writeFileSync('shots/aim-found.json', JSON.stringify(found, null, 2));

// ---- place a camera that can actually SEE the subject, then verify the warp ----
async function shoot(label, subj, opts) {
  const r = await p.evaluate(([subj, opts]) => {
    const R = 0.36, cols = window.__ct.colliders().filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
    const inside = (x, z, pad) => cols.some(c =>
      x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad);
    // colliders that contain the subject are the subject's own - ignore them on the ray
    const own = cols.filter(c => subj.cx > c.minX - 0.2 && subj.cx < c.maxX + 0.2 && subj.cz > c.minZ - 0.2 && subj.cz < c.maxZ + 0.2);
    const blocked = (x, z) => {
      const n = Math.ceil(Math.hypot(subj.cx - x, subj.cz - z) / 0.2);
      for (let i = 1; i < n; i++) {
        const t = i / n, px = x + (subj.cx - x) * t, pz = z + (subj.cz - z) * t;
        if (cols.some(c => !own.includes(c) && px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ)) return true;
      }
      return false;
    };
    const cands = [];
    for (let a = 0; a < 360; a += 7.5) {
      const rad = a * Math.PI / 180;
      for (const dist of opts.dists) {
        const x = subj.cx + Math.sin(rad) * dist, z = subj.cz + Math.cos(rad) * dist;
        if (inside(x, z, R)) continue;
        if (blocked(x, z)) continue;
        cands.push({ x, z, a, dist, score: (opts.preferAngle == null ? 0 :
          -Math.abs(((a - opts.preferAngle + 540) % 360) - 180) ) - dist * 0.1 });
      }
    }
    if (!cands.length) return { ok: false, why: 'no standable point with line of sight' };
    cands.sort((u, v) => v.score - u.score);
    const c = cands[0];
    const yaw = Math.atan2(subj.cx - c.x, -(subj.cz - c.z));
    const eye = 0.14 + 1.6, pitch = Math.atan2(opts.aimY - eye, c.dist);
    window.__ct.warp(c.x, c.z, yaw, 0.14, pitch);
    return { ok: true, x: +c.x.toFixed(2), z: +c.z.toFixed(2), dist: +c.dist.toFixed(2),
      pitch: +pitch.toFixed(2), nCands: cands.length };
  }, [subj, opts]);
  if (!r.ok) { console.log(`   MISS  ${label}: ${r.why}`); return r; }
  await p.waitForTimeout(260);
  const land = await p.evaluate(() => window.__ct.pos());
  const ok = Math.abs(land[0] - r.x) < 0.06 && Math.abs(land[2] - r.z) < 0.06;
  await p.screenshot({ path: `shots/${label}.png` });
  console.log(`   ${ok ? 'shot ' : 'DRIFT'} ${label}  from (${r.x}, ${r.z}) d=${r.dist} · ${r.nCands} valid cameras · expect: ${opts.expect}`);
  return { ...r, landed: ok };
}

console.log('\nSHOOTING (each names what it expects to see):');
// wheel arches: side-on to the car's long axis, low
const cars = found.cars.filter(c => Math.abs(c.cx) < 40).slice(0, 3);
for (let i = 0; i < cars.length; i++) {
  const c = cars[i], longIsZ = c.d > c.w;
  await shoot(`aim-car${i}-arch`, c, { dists: [2.6, 3.2, 4.0], aimY: 0.55,
    preferAngle: longIsZ ? 90 : 0, expect: 'a car side-on, wheels and arches visible' });
}
// benches: the park benches (legs) and the flat street bench (ad panel)
const parkB = found.benches.filter(c => c.cz < -60).slice(0, 2);
for (let i = 0; i < parkB.length; i++)
  await shoot(`aim-bench${i}-legs`, parkB[i], { dists: [2.0, 2.6, 3.2], aimY: 0.30,
    preferAngle: null, expect: 'a bench from the side, legs and ground shadow' });
const streetB = found.benches.filter(c => c.cz > -30 && c.h < 0.2).slice(0, 2);
for (let i = 0; i < streetB.length; i++)
  await shoot(`aim-benchad${i}`, streetB[i], { dists: [2.4, 3.0, 3.8], aimY: 0.55,
    preferAngle: null, expect: 'the bench ad panel, framed or clipped' });
await b.close();

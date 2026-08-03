// w72 / item 202 — ARE TWO VEHICLES OF THE SAME KIND CARRYING THE SAME BOX?
//
// The user, with the V collision view on: *"truck collision isnt accurate to
// the truck but the other truck is? it seems odd. seems like all trucks should
// be one object that are all the same no?"* and, earlier, *"not all car and
// object collidable boxes are consistent. some cars have full height others are
// aligned with the vehicle."*
//
// This measures it rather than reading it out of the source. For every vehicle
// group in the scene it finds the collider(s) covering that vehicle's centre
// and reports the box's footprint, whether it carries a `maxY` at all (no
// `maxY` = FULL HEIGHT, which is the user's "some cars have full height"), and
// how much bigger the footprint is than the vehicle's own drawn bounding box.
//
// Usage: SHOT_URL=http://localhost:4280/ node scripts/probes/w72-car-collider-consistency.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4280/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(800);

const rows = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const cols = window.__ct.colliders();
  // A vehicle is a group whose userData names its kind, or failing that a group
  // whose drawn extent is car-sized. `makeCar` tags the group; read that first
  // and fall back to geometry so the probe cannot silently find zero.
  const V = scene.position.constructor;
  const Box3 = scene.userData.__box3ctor ?? null;
  const out = [];
  scene.traverse((o) => {
    if (!o.isGroup) return;
    const kind = o.userData && (o.userData.carKind || o.userData.kind);
    // measure the drawn body
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mxy = -1e9, meshes = 0;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return;
      meshes++;
      for (const sx of [bb.min.x, bb.max.x]) {
        for (const sy of [bb.min.y, bb.max.y]) {
          for (const sz of [bb.min.z, bb.max.z]) {
            const w = new V(sx, sy, sz).applyMatrix4(m.matrixWorld);
            mnx = Math.min(mnx, w.x); mxx = Math.max(mxx, w.x);
            mnz = Math.min(mnz, w.z); mxz = Math.max(mxz, w.z);
            mxy = Math.max(mxy, w.y);
          }
        }
      }
    });
    if (meshes < 6) return;
    const w = mxx - mnx, d = mxz - mnz;
    const long = Math.max(w, d), short = Math.min(w, d);
    // car-shaped: 3.4-5.6 m long, 1.5-2.4 m wide, under 2.6 m tall
    if (!(long > 3.4 && long < 5.6 && short > 1.4 && short < 2.5 && mxy < 2.6)) return;
    const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
    const hits = cols.filter((c) => cx > c.minX - 0.05 && cx < c.maxX + 0.05
      && cz > c.minZ - 0.05 && cz < c.maxZ + 0.05);
    out.push({
      kind: kind || '(untagged)',
      x: +cx.toFixed(2), z: +cz.toFixed(2),
      bodyLong: +long.toFixed(2), bodyShort: +short.toFixed(2), bodyTop: +mxy.toFixed(2),
      boxes: hits.length,
      tiers: hits.filter((c) => c.maxY !== undefined).length,
      tags: hits.map((c) => c.tag).filter(Boolean),
      fullHeight: hits.filter((c) => c.maxY === undefined).length,
      // THE UNION of every covering box, not the widest one. A tiered vehicle's
      // footprint is what all its tiers cover together — quoting one tier makes
      // a correctly-hugging collider look 2.8 m too SMALL, which is a probe
      // artefact and would have been read as a finding.
      boxLong: hits.length ? +Math.max(
        Math.max(...hits.map((c) => c.maxX)) - Math.min(...hits.map((c) => c.minX)),
        Math.max(...hits.map((c) => c.maxZ)) - Math.min(...hits.map((c) => c.minZ))).toFixed(2) : null,
      boxShort: hits.length ? +Math.min(
        Math.max(...hits.map((c) => c.maxX)) - Math.min(...hits.map((c) => c.minX)),
        Math.max(...hits.map((c) => c.maxZ)) - Math.min(...hits.map((c) => c.minZ))).toFixed(2) : null,
      rot: hits.some((c) => c.rot),
    });
  });
  return out;
});

console.log(`\n${rows.length} car-shaped groups in the scene`);
console.log('NOTE, so the numbers are not over-read: `boxes` counts colliders covering the');
console.log('vehicle CENTRE. A tiered vehicle has tiers front and back of its centre that this');
console.log('test does not reach, so its "box L x S" understates it — read `tiers`/`tags` for');
console.log('whether it is tiered at all. The `full-h` column is the load-bearing one: a box');
console.log('with no maxY is FULL HEIGHT, which is the user\'s "some cars have full height".');
console.log('Groups at (0, 0) are the traffic pool; their boxes are parked at x 999 while idle.\n');
console.log('kind          at (x, z)        body L x S x H     boxes tiers full-h   box L x S   over');
for (const r of rows.sort((a, c) => String(a.kind).localeCompare(String(c.kind)) || a.x - c.x)) {
  const over = r.boxLong === null ? '—' : `${(r.boxLong - r.bodyLong).toFixed(2)} m`;
  console.log(`${String(r.kind).padEnd(13)} ${`${r.x}, ${r.z}`.padEnd(16)}`
    + ` ${`${r.bodyLong} x ${r.bodyShort} x ${r.bodyTop}`.padEnd(18)}`
    + ` ${String(r.boxes).padStart(5)} ${String(r.tiers).padStart(5)} ${String(r.fullHeight).padStart(6)}`
    + `   ${String(`${r.boxLong} x ${r.boxShort}`).padEnd(11)} ${over}`
    + (r.tags.length ? `  [${r.tags.join(' ')}]` : ''));
}

// The question the item actually asks: do two vehicles of ONE kind agree?
const byKind = {};
for (const r of rows) (byKind[r.kind] ??= []).push(r);
console.log('\nDO TWO INSTANCES OF ONE KIND CARRY THE SAME COLLIDER?');
let disagree = 0;
for (const [k, list] of Object.entries(byKind)) {
  const sig = (r) => `${r.boxes}box/${r.tiers}tier/${r.fullHeight}full/${r.boxLong}x${r.boxShort}`;
  const sigs = [...new Set(list.map(sig))];
  if (sigs.length > 1) disagree++;
  console.log(`  ${String(k).padEnd(13)} ${list.length} instance(s), ${sigs.length} distinct collider signature(s)`
    + (sigs.length > 1 ? `  ← DISAGREE: ${sigs.join('  |  ')}` : ''));
}
console.log(`\n${disagree} kind(s) have instances that do NOT agree.`);
// GOTCHAS 34: a probe that found no cars has established nothing either way.
if (!rows.length) { console.log('MEASURED NOTHING — no car-shaped groups found — exit 3'); await b.close(); process.exit(3); }
await b.close();

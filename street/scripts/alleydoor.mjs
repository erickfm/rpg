// THE ALLEY BACK DOOR: what is actually there, and what is actually lit?
//
// shots/user-alley-door-light-crop.png settles the symptom and it is not what
// the row's history says. There IS light: a warm dome of glow on the brick
// above the door, feathering out onto the courses either side. And the DOOR —
// the mesh directly under it — is dead black, with the glow stopping at its top
// edge. "it gets cropped by door" is literally accurate.
//
// So the question is which of two things is true, and they need different fixes:
//
//   A. nothing is CASTING, the glow is painted into the wall sheet, and the
//      door is black because no pool exists — the auditor's reading
//   B. something IS casting and the door cannot RECEIVE — my per-mesh
//      diagnosis, which is what the desk asked me to fix at the root
//
// Both would look like this crop. So: find the door and the fitting, then read
// every mesh around them — is it in the night grade at all, is it poolable, and
// what tint is it actually carrying at 22:30?
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1500);

const found = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const all = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const m = mats[0];
    all.push({
      x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
      mod: n.userData.mod ?? '?', ud: Object.keys(n.userData).join(','),
      graded: !!m?.userData?.graded, selfLit: !!m?.userData?.selfLit,
      noLight: !!m?.userData?.noLight, tint: m?.color ? +m.color.r.toFixed(4) : null,
      map: m?.map?.image ? `${m.map.image.width}x${m.map.image.height}` : 'none',
    });
  });
  // A BACK DOOR: a tall thin upright, 0.7-1.3 m wide, 1.8-2.4 m tall, standing
  // on the ground, in an alley — which is anywhere the roadway is not.
  const doors = all.filter((q) => {
    const w = q.x1 - q.x0, h = q.y1 - q.y0, d = q.z1 - q.z0;
    if (h < 1.7 || h > 2.5) return false;
    if (q.y0 > 0.35) return false;
    const foot = Math.max(w, d), thin = Math.min(w, d);
    if (foot < 0.6 || foot > 1.5) return false;
    if (thin > 0.35) return false;
    return true;
  });
  return { doors, n: all.length, all: all.length };
});

console.log(`\n${found.doors.length} door-shaped uprights in the world`);
for (const d of found.doors) {
  console.log(`  ${d.mod.padEnd(10)} x[${d.x0.toFixed(2)}..${d.x1.toFixed(2)}] y[${d.y0.toFixed(2)}..${d.y1.toFixed(2)}]` +
    ` z[${d.z0.toFixed(2)}..${d.z1.toFixed(2)}]  tint ${d.tint}  graded ${d.graded}  map ${d.map}  ud:${d.ud}`);
}

// take the darkest one that is NOT on the street frontage — the black door in
// the crop is the darkest thing in frame
const cand = found.doors.filter((d) => d.tint !== null).sort((a, c) => a.tint - c.tint);
if (!cand.length) { console.log('\n  no candidate — widen the predicate rather than guessing'); await b.close(); process.exit(0); }
const door = cand[0];
console.log(`\nDARKEST DOOR: tint ${door.tint} at (${((door.x0 + door.x1) / 2).toFixed(2)},` +
  ` ${((door.y0 + door.y1) / 2).toFixed(2)}, ${((door.z0 + door.z1) / 2).toFixed(2)})  mod ${door.mod}`);

// everything within 2.5 m of it, and what each of those is carrying
const near = await p.evaluate(([X, Y, Z]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const cx = (w.min.x + w.max.x) / 2, cy = (w.min.y + w.max.y) / 2, cz = (w.min.z + w.max.z) / 2;
    if (Math.hypot(cx - X, cy - Y, cz - Z) > 2.5) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    out.push({ at: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
               size: [+(w.max.x - w.min.x).toFixed(2), +(w.max.y - w.min.y).toFixed(2), +(w.max.z - w.min.z).toFixed(2)],
               mod: n.userData.mod ?? '?', tint: m?.color ? +m.color.r.toFixed(4) : null,
               graded: !!m?.userData?.graded, selfLit: !!m?.userData?.selfLit,
               map: m?.map?.image ? `${m.map.image.width}x${m.map.image.height}` : 'none' });
  });
  return out.sort((a, c) => c.at[1] - a.at[1]);
}, [(door.x0 + door.x1) / 2, (door.y0 + door.y1) / 2, (door.z0 + door.z1) / 2]);

console.log(`\n── everything within 2.5 m of that door, at 22:30 ──`);
console.log('   tint 1.0 = held at full brightness; the night floor for ground-level stuff is ~0.045\n');
for (const q of near) {
  console.log(`  y ${String(q.at[1]).padStart(6)}  ${JSON.stringify(q.size).padEnd(22)} tint ${String(q.tint).padEnd(8)}` +
    ` graded ${q.graded ? 'Y' : 'n'} selfLit ${q.selfLit ? 'Y' : 'n'}  ${q.map.padEnd(9)} ${q.mod}`);
}
await b.close();

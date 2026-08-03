// Does the INSIDE face of the jail door have the same coplanar fault as the
// outside did? Read-only: ct/int-jail.ts is not item 104's file, so this
// measures and reports rather than changes anything.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const Z_EPS = 0.002;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

// walk in through the real door, so the room is built the way play builds it
await p.evaluate(() => window.__ct.warp(56.5, -103, Math.PI / 2, 0.14, 0));
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1200);
await p.keyboard.down('w'); await p.waitForTimeout(2600); await p.keyboard.up('w');
await p.waitForTimeout(400);
await p.keyboard.down('e'); await p.waitForTimeout(140); await p.keyboard.up('e');
await p.waitForTimeout(2200);
const pos = await p.evaluate(() => window.__ct.pos());
console.log('inside at', pos.map((v) => (+v).toFixed(2)).join(', '));

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    boxes.push({
      x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z,
      w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z,
      mapW: mats[0] && mats[0].map && mats[0].map.image ? mats[0].map.image.width : 0,
      mapH: mats[0] && mats[0].map && mats[0].map.image ? mats[0].map.image.height : 0,
    });
  });
  return boxes;
});

// NOT SHOT FROM HERE. Two attempts to frame the inside face by warping to a
// guessed spot in the room came back a flat blank — the camera was inside a
// wall, which `scripts/aim.mjs` exists to prevent and this probe does not do.
// Rather than file a picture of nothing as evidence, this stops at the
// measurement and hands the interior face over as unmeasured. (BUILDER-BRIEF
// §12: reporting what you could not do is worth more than a silent workaround.)
await b.close();

// The room's own leaves share `jailLeafTex` — literally the same THREE.Texture
// (ct/int-jail.ts:317) — but live in the interior coordinate space.
//
// SELECT BY THE ROOM THE PLAYER IS STANDING IN, not by `x > 400`. That first
// cut matched `ct/int-bank.ts:583`'s 24x64 arch 570 m away and printed a
// confident PASS about two meshes in a different building. Interiors are all
// out past x=400, so "past 400" identifies nothing.
const [px, , pz] = pos.map(Number);
const near24 = out.filter((o) => o.mapW === 24 && o.mapH === 64);
console.log(`\nevery 24x64-mapped mesh in the world (${near24.length}), distance from the player:`);
for (const o of near24) {
  const dist = Math.hypot((o.x0 + o.x1) / 2 - px, (o.z0 + o.z1) / 2 - pz);
  console.log(`  ${o.w.toFixed(2)}x${o.h.toFixed(2)}x${o.d.toFixed(2)}  at x ${o.x0.toFixed(2)} z ${o.z0.toFixed(2)}  ${dist.toFixed(1)} m away`);
}
// The interior pair is at x 998.80 and 1000.20, z 12.27 — 1.0 m from where the
// player lands. Each has a bounding box of 1.00 x 3.00 x 0.61, which is NOT a
// thin axis-aligned slab: a 1.18 m leaf (the same width as the exterior pair)
// canted about 31 deg gives exactly that footprint. So the room's leaves stand
// OPEN while the street's pair is shut and flush.
//
// That is ct/int-jail.ts's geometry, which item 104 does not name, so this
// probe stops at reporting it. The coplanarity arithmetic below is written for
// axis-aligned slabs and would be meaningless on a canted plane — running it
// anyway is how a check ends up "measuring nothing" (notes item 105).
const leaves = near24.filter((o) => Math.hypot((o.x0 + o.x1) / 2 - px, (o.z0 + o.z1) / 2 - pz) < 40
  && Math.min(o.w, o.d) < 0.2 && o.h > 1.8);
console.log('\nNOTE: the interior pair is canted (bbox 1.00 x 3.00 x 0.61 each) — they stand');
console.log('      open. Axis-aligned coplanarity does not apply; see the comment above.');
console.log(`interior leaves by 24x64 signature: ${leaves.length}`);
let bad = 0;
for (const L of leaves) {
  const thinX = L.w < L.d;                       // which axis is the leaf's thickness
  console.log(`\nleaf  x ${L.x0.toFixed(3)}…${L.x1.toFixed(3)}  y ${L.y0.toFixed(2)}…${L.y1.toFixed(2)}  z ${L.z0.toFixed(3)}…${L.z1.toFixed(3)}  (${L.w.toFixed(2)}x${L.h.toFixed(2)}x${L.d.toFixed(2)})`);
  const near = out.filter((o) => o !== L
    && o.y0 < L.y1 - 0.05 && o.y1 > L.y0 + 0.05
    && (thinX ? (o.z0 < L.z1 - 0.05 && o.z1 > L.z0 + 0.05 && o.x1 > L.x0 - 0.4 && o.x0 < L.x1 + 0.4)
              : (o.x0 < L.x1 - 0.05 && o.x1 > L.x0 + 0.05 && o.z1 > L.z0 - 0.4 && o.z0 < L.z1 + 0.4)));
  for (const o of near) {
    const a = thinX ? [o.x0, o.x1, L.x0, L.x1] : [o.z0, o.z1, L.z0, L.z1];
    const d0 = Math.abs(a[0] - a[2]), d1 = Math.abs(a[1] - a[3]);
    const hit = Math.min(d0, d1) < Z_EPS;
    if (hit) bad++;
    if (hit || Math.min(d0, d1) < 0.03) {
      console.log(`   near: ${o.w.toFixed(2)}x${o.h.toFixed(2)}x${o.d.toFixed(2)} map ${o.mapW}x${o.mapH}  Δ ${Math.min(d0, d1).toFixed(4)}${hit ? '  <<< COPLANAR' : ''}`);
    }
  }
  const across = 24 / (thinX ? L.d : L.w), up = 64 / L.h;
  console.log(`   density ${across.toFixed(1)} px/m across, ${up.toFixed(1)} px/m up`);
}
console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'}: ${bad} coplanar face(s) on the interior leaves`);
process.exit(bad === 0 ? 0 : 1);

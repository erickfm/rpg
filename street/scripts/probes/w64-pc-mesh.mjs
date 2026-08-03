#!/usr/bin/env node
// ITEM 157, MEASUREMENT ONE: what is actually in front of a library terminal
// chair, and can `PanelSpec.surface` hang a canvas on it?
//
// Three questions decide the whole item, and all three are about the WORLD, not
// about `ct/library-pc.ts`:
//
//   1. Which seats carry `sit at the computer`, and which terminal is each at?
//   2. Does the thing the player faces have ONE material or an array? (item 150
//      — `ct/hud.ts` THROWS on a multi-material mesh rather than degrading, and
//      the slots had to supply their own plane because of it.)
//   3. What is that face's ASPECT? A canvas cut to a different one stretches,
//      which is the difference w55 measured between "there is a UI here" and
//      "the interface is on the machine".
//
//   SHOT_URL=http://localhost:4201/ node scripts/probes/w64-pc-mesh.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const r = await p.evaluate(() => {
  const seats = window.__ct.seats().filter((s) => s.label === 'sit at the computer');
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const out = [];
  for (const seat of seats) {
    const near = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const x = e[12], y = e[13], z = e[14];
      const d = Math.hypot(x - seat.pose.x, z - seat.pose.z);
      if (d > 1.8) return;
      const g = o.geometry;
      g.computeBoundingBox?.();
      const bb = g.boundingBox;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      near.push({
        d: +d.toFixed(3), x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3),
        type: g.type,
        params: g.parameters ? JSON.stringify(g.parameters) : null,
        size: bb ? [+(bb.max.x - bb.min.x).toFixed(3), +(bb.max.y - bb.min.y).toFixed(3), +(bb.max.z - bb.min.z).toFixed(3)] : null,
        matCount: mats.length,
        mapWH: mats.map(m => (m && m.map && m.map.image ? `${m.map.image.width}x${m.map.image.height}` : '-')).join(','),
        col: mats.map(m => (m && m.color ? '#' + m.color.getHexString() : '-')).join(','),
        graded: mats.map(m => !!(m && m.userData && m.userData.graded)).join(','),
        rotY: +(o.rotation.y).toFixed(4),
        name: o.name || '',
        ud: JSON.stringify(o.userData ?? {}),
      });
    });
    near.sort((a, c) => a.d - c.d);
    out.push({ seat, near: near.filter(m => m.type === 'PlaneGeometry' || m.d < 1.35).slice(0, 14) });
  }
  return { nSeats: seats.length, out, allLabels: [...new Set(window.__ct.seats().map(s => s.label))] };
});

console.log(`\n  ${r.nSeats} seat(s) labelled "sit at the computer"`);
for (const g of r.out) {
  const s = g.seat;
  console.log(`\n  SEAT at (${s.pose.x.toFixed(2)}, ${s.pose.z.toFixed(2)}) yaw ${s.pose.yaw.toFixed(3)} h ${s.pose.h}`);
  for (const m of g.near) {
    console.log(`   ${m.d.toFixed(2)} m ${m.type.padEnd(14)} size ${JSON.stringify(m.size)} at (${m.x}, ${m.y}, ${m.z}) ryaw ${m.rotY}`);
    console.log(`        mats ${m.matCount}  map ${m.mapWH}  col ${m.col}  graded ${m.graded}  ${m.params ?? ''}`);
  }
}
await b.close();

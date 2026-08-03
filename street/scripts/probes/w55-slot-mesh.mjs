#!/usr/bin/env node
// ITEM 100, MEASUREMENT ONE: what is actually in front of a slot stool?
//
// The ATM had a mesh tagged `userData.atmPart === 'screen'` and a single
// material, which is what made `PanelSpec.surface` a one-line adoption there.
// Before assuming the same of the slots, ask the world: what mesh does the
// player face from the stool, what are its dimensions, and — the question that
// decides everything — is its material one material or an array of six?
//
//   SHOT_URL=http://localhost:4183/ node scripts/probes/w55-slot-mesh.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const seats = window.__ct.seats().filter((s) => s.label === 'sit at the slot');
  const seat = seats[Math.floor(seats.length / 2)];
  const scene = window.__ct.scene();
  // Everything within 1.6 m of the stool, so the cabinet cannot be missed and
  // its neighbours are visible for context.
  const near = [];
  const V = window.__three ?? null;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const x = e[12], y = e[13], z = e[14];
    const d = Math.hypot(x - seat.pose.x, z - seat.pose.z);
    if (d > 1.6) return;
    const g = o.geometry;
    g.computeBoundingBox?.();
    const bb = g.boundingBox;
    near.push({
      d: +d.toFixed(3),
      x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3),
      type: g.type,
      params: g.parameters ? JSON.stringify(g.parameters) : null,
      size: bb ? [+(bb.max.x - bb.min.x).toFixed(3), +(bb.max.y - bb.min.y).toFixed(3), +(bb.max.z - bb.min.z).toFixed(3)] : null,
      matIsArray: Array.isArray(o.material),
      matCount: Array.isArray(o.material) ? o.material.length : 1,
      matType: Array.isArray(o.material) ? o.material.map((m) => m.type).join(',') : o.material.type,
      hasMap: Array.isArray(o.material) ? o.material.map((m) => !!m.map).join(',') : !!o.material.map,
      userData: JSON.stringify(o.userData ?? {}),
      name: o.name || '',
    });
  });
  near.sort((a, c) => a.d - c.d);
  return { seat, nSeats: seats.length, near: near.filter((m) => m.type === 'BoxGeometry').slice(0, 8) };
});

console.log(`\n  ${r.nSeats} slot stools.  measuring the one at`
  + ` (${r.seat.pose.x.toFixed(2)}, ${r.seat.pose.z.toFixed(2)}) yaw ${r.seat.pose.yaw.toFixed(3)}`);
console.log(`  its approach spot is at (${r.seat.at.x.toFixed(2)}, ${r.seat.at.z.toFixed(2)})\n`);
for (const m of r.near) {
  console.log(`  ${m.d.toFixed(2)} m  ${m.type.padEnd(14)} size ${JSON.stringify(m.size)}`
    + `  at (${m.x}, ${m.y}, ${m.z})`);
  console.log(`          materials: ${m.matCount} [${m.matType}]  map? ${m.hasMap}`);
  if (m.params) console.log(`          params: ${m.params}`);
}
await b.close();

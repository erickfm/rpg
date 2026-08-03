#!/usr/bin/env node
// ITEM 157, MEASUREMENT ONE: what is in front of a library terminal chair?
//
// The question the ATM (w41) and the slots (w55) each had to answer before
// adopting `PanelSpec.surface`, asked for the third tenant. Two things decide
// the whole shape of the work:
//
//   1. is there already a SCREEN MESH, or does this file have to supply one
//      the way `ct/slots.ts` did?
//   2. is its material ONE material or an array? `ct/hud.ts:1059` casts to a
//      single `MeshBasicMaterial` and calls `.color.getHex()` on it, so an
//      array throws inside `open()` — item 150, still open.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w63-pc-mesh.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const seats = window.__ct.seats().filter((s) => s.label === 'sit at the computer');
  const scene = window.__ct.scene();
  const out = [];
  for (const seat of seats) {
    const fx = Math.sin(seat.pose.yaw), fz = -Math.cos(seat.pose.yaw);
    const near = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const x = e[12], y = e[13], z = e[14];
      const dx = x - seat.pose.x, dz = z - seat.pose.z;
      const ahead = dx * fx + dz * fz;             // metres in front of the chair
      const side = dx * fz - dz * fx;              // metres to one side of it
      if (ahead < 0 || ahead > 2.0 || Math.abs(side) > 1.2) return;
      const g = o.geometry;
      g.computeBoundingBox?.();
      const bb = g.boundingBox;
      near.push({
        ahead: +ahead.toFixed(3), side: +side.toFixed(3),
        y: +y.toFixed(3),
        type: g.type,
        params: g.parameters ? JSON.stringify(g.parameters) : null,
        size: bb ? [+(bb.max.x - bb.min.x).toFixed(3), +(bb.max.y - bb.min.y).toFixed(3), +(bb.max.z - bb.min.z).toFixed(3)] : null,
        matCount: Array.isArray(o.material) ? o.material.length : 1,
        matType: Array.isArray(o.material) ? o.material.map((m) => m.type).join(',') : o.material.type,
        hasMap: Array.isArray(o.material) ? o.material.map((m) => !!m.map).join(',') : !!o.material.map,
        side2: Array.isArray(o.material) ? '-' : o.material.side,
        userData: JSON.stringify(o.userData ?? {}),
        name: o.name || '',
      });
    });
    near.sort((a, c) => a.ahead - c.ahead);
    out.push({ seat, planes: near.filter((m) => m.type === 'PlaneGeometry'), all: near.slice(0, 10) });
  }
  return { n: seats.length, out };
});

console.log(`\n  ${r.n} seats labelled 'sit at the computer'\n`);
for (const s of r.out) {
  console.log(`  ── chair at (${s.seat.pose.x.toFixed(2)}, ${s.seat.pose.z.toFixed(2)}) yaw ${s.seat.pose.yaw.toFixed(3)}`);
  console.log(`     PLANES in front of it: ${s.planes.length}`);
  for (const m of s.planes) {
    console.log(`       ahead ${m.ahead}  side ${m.side}  y ${m.y}  size ${JSON.stringify(m.size)}`
      + `  mats ${m.matCount} [${m.matType}] map ${m.hasMap} side=${m.side2}`);
    if (m.params) console.log(`         params: ${m.params}`);
    if (m.userData !== '{}') console.log(`         userData: ${m.userData}`);
  }
  console.log(`     everything else, nearest first:`);
  for (const m of s.all) {
    console.log(`       ahead ${String(m.ahead).padEnd(7)} side ${String(m.side).padEnd(7)} y ${String(m.y).padEnd(6)} ${m.type.padEnd(14)} size ${JSON.stringify(m.size)} mats ${m.matCount}`);
  }
  console.log('');
}
await b.close();

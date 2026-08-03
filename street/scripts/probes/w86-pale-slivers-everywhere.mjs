// FIND THE PALE SLIVER, IN WHICHEVER ROOM IT IS. Item 169.
//
// The desk placed this in apartment 301 by inference (it grepped apartment.ts).
// Six downward shots of 301's boards show clean floor, and the only two flat
// slivers there are near-BLACK (rgb 33,34,39), not the pale tan the user
// described. So rather than keep hunting one room by eye, search EVERY room for
// the shape and colour he reported:
//
//   * lying flat, within 12 cm of the room's own floor
//   * thin (one dimension under 8 cm) and small (nothing over 2.5 m)
//   * PALE: mean texture luminance over 0.45, and warmer in red than in blue
//
// Colour is taken from the texture's own canvas, averaged — `material.color` is
// #ffffff on nearly everything here and says nothing (the same lesson item 234
// just paid for one level up).
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-pale-slivers-everywhere.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const rooms = window.__ct.roomDims();
  const meanCol = (m) => {
    const img = m?.map?.image;
    if (!img || !img.getContext) {
      const c = m?.color;
      return c ? { r: c.r, g: c.g, b: c.b, src: 'material.color' } : null;
    }
    const g = img.getContext('2d');
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let R = 0, G = 0, B = 0, A = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255; if (a < 0.35) { A++; continue; }
      R += d[i] / 255; G += d[i + 1] / 255; B += d[i + 2] / 255; n++;
    }
    if (!n) return null;
    return { r: R / n, g: G / n, b: B / n, src: `tex ${img.width}x${img.height}`, clearFrac: A / (d.length / 4) };
  };
  const hits = [];
  for (const rm of rooms) {
    const x0 = rm.cx - rm.w / 2, x1 = rm.cx + rm.w / 2;
    const z0 = rm.cz - rm.d / 2, z1 = rm.cz + rm.d / 2;
    S.traverse((o) => {
      if (!o.isMesh) return;
      const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
      if (x < x0 || x > x1 || z < z0 || z > z1) return;
      if (y < rm.y - 0.05 || y > rm.y + 0.12) return;
      const g = o.geometry; g?.computeBoundingBox?.();
      const bb = g?.boundingBox; if (!bb) return;
      const sz = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
      if (Math.min(...sz) > 0.08) return;          // not thin
      if (Math.max(...sz) > 2.5) return;           // that is a floor, not a sliver
      for (const m of window.__mats(o)) {
        const c = meanCol(m); if (!c) continue;
        const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        if (lum < 0.45 || c.r <= c.b) continue;    // not pale, or not warm
        hits.push({
          room: rm.id, at: [+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)],
          size: sz.map((v) => +v.toFixed(3)), mod: o.userData?.mod ?? '?',
          geo: g.type, lum: +lum.toFixed(3),
          rgb: [c.r, c.g, c.b].map((v) => +v.toFixed(3)), src: c.src,
          clearFrac: c.clearFrac !== undefined ? +c.clearFrac.toFixed(2) : null,
          rotX: +o.rotation.x.toFixed(2),
        });
      }
    });
  }
  return { rooms: rooms.map((q) => q.id), hits };
});

console.log(`\nsearched ${r.rooms.length} rooms: ${r.rooms.join(', ')}`);
console.log(`\n${r.hits.length} pale flat slivers lying on a floor:\n`);
for (const h of r.hits)
  console.log(`  ${h.room.padEnd(9)} mod=${String(h.mod).padEnd(9)} ${h.geo.padEnd(14)} at ${JSON.stringify(h.at).padEnd(24)}`
    + ` size ${JSON.stringify(h.size).padEnd(24)} lum ${h.lum} rgb ${JSON.stringify(h.rgb)} ${h.src} clear=${h.clearFrac} rotX=${h.rotX}`);
await b.close();

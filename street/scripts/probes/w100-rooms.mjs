// w100 — every interior room's resolved footprint, sorted along x, so a builder
// can tell which room is on the other side of a wall. Written because the hotel
// lobby's east opening looks into a room and no note says which.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL || 'http://localhost:4177/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 30000 });
const rooms = await p.evaluate(() => window.__ct.roomDims());
rooms.sort((a, c) => a.cx - c.cx);
for (const r of rooms) {
  console.log(`${r.id.padEnd(12)} w=${String(r.w).padStart(6)} d=${String(r.d).padStart(6)}`
    + ` cx=${String(r.cx).padStart(9)} cz=${String(r.cz).padStart(7)} y=${r.y} belt=${r.belt}`
    + `  x:[${(r.cx - r.w / 2).toFixed(2)}, ${(r.cx + r.w / 2).toFixed(2)}]`
    + ` z:[${(r.cz - r.d / 2).toFixed(2)}, ${(r.cz + r.d / 2).toFixed(2)}]`);
}
await b.close();

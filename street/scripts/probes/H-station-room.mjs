// H: which room does a coordinate actually land in? Reads roomDims() LIVE
// rather than trusting any published slot table.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4187/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.roomDims, null, { timeout: 60000 });
const rs = await p.evaluate(() => window.__ct.roomDims());
const where = (x, z) => {
  for (const r of rs) if (Math.abs(x - r.cx) <= r.w / 2 + 0.5 && Math.abs(z - r.cz) <= r.d / 2 + 0.5) return r.id;
  const near = rs.reduce((a, r) => Math.abs(x - r.cx) < Math.abs(x - a.cx) ? r : a);
  return `(outside any room; nearest slot ${near.id} at ${near.cx})`;
};
const CASES = JSON.parse(process.env.CASES);
for (const [label, x, z, expect] of CASES) {
  const got = where(x, z);
  const ok = got === expect;
  console.log(`  ${ok ? 'ok  ' : 'WRONG'} ${label.padEnd(34)} (${x}, ${z}) -> ${got.padEnd(10)} expected ${expect}`);
}
await b.close();

// H: where exactly is the walkable band at the closed east end, now the jail
// has given it a frontage? The graph must follow the ground, not the reverse.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders, null, { timeout: 60000 });
const grid = await p.evaluate(() => {
  const cols = window.__ct.colliders();
  const free = (x, z) => {
    for (const c of cols) if (x > c.minX - 0.36 && x < c.maxX + 0.36 && z > c.minZ - 0.36 && z < c.maxZ + 0.36) return false;
    return true;
  };
  const rows = [];
  for (let z = -96; z >= -111; z -= 1) {
    const line = [];
    for (let x = 52; x <= 59; x += 0.25) line.push([+x.toFixed(2), free(x, z), +window.__ct.groundAt(x, z).toFixed(2)]);
    rows.push({ z, line });
  }
  return rows;
});
// GROUND HEIGHT is what separates pavement from carriageway. Collider-free is
// not pavement - the road has no collider either, which is precisely the fault
// the removed east-end edge had.
console.log('ground profile across the closed end (kerb shows as a step):');
for (const z of [-97, -100, -103, -106, -109]) {
  const r = grid.find((q) => q.z === z);
  const prof = r.line.filter((_, i) => i % 2 === 0).map(([x, , g]) => `${x}:${g}`).join('  ');
  console.log(`  z ${String(z).padStart(5)}  ${prof}`);
}
console.log();
console.log('walkable band at the closed east end   ( # = standable, . = blocked )');
console.log('        x: ' + [52,53,54,55,56,57,58,59].map(v=>String(v).padEnd(4)).join(''));
for (const r of grid) {
  const s = r.line.map(([, f]) => f ? '#' : '.').join('');
  const free = r.line.filter(([, f]) => f).map(([x]) => x);
  const span = free.length ? `${Math.min(...free).toFixed(2)}..${Math.max(...free).toFixed(2)}` : 'none';
  console.log(`  z ${String(r.z).padStart(5)}: ${s}   free x ${span}`);
}
await b.close();

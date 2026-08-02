// Is the floor picker sticky ENOUGH to read floor 3 out on the pavement?
// If groundAt(-6,-20) can read 5.400 while apt.gy() reads 0.14, then camY is
// 7.02 out on the street and jump-walk reports exactly 5.260.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const at = (x, z) => p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
console.log('--- untouched (picker still on the spawn storey, floor 3) ---');
for (const [x, z] of [[-6, -20], [-5.1, -20], [-2, -20], [6.2, -44], [104, -16], [120, -16]]) {
  console.log(`  groundAt(${String(x).padStart(6)}, ${z}) = ${(await at(x, z)).toFixed(3)}`);
}
console.log(`  apt.gy() = ${(await p.evaluate(() => window.__ct.pos()[3])).toFixed(3)}`);

console.log('\n--- where are the interior rooms actually? ---');
const rooms = await p.evaluate(() => window.__ct.roomDims());
for (const [id, d] of Object.entries(rooms).slice(0, 24)) {
  console.log(`  ${String(id).padEnd(14)} ${JSON.stringify(d)}`);
}
await b.close();

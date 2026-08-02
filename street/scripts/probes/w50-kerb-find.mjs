// Where is there a real kerb edge — a terrain step of about 0.14 m — that a
// player can walk across? Item 112's control case needs one, and the first
// attempt at it measured HEAD BOB (0.035 amplitude, 0.07 peak-to-peak) instead.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4187/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const scan = await p.evaluate(() => {
  const out = [];
  for (let z = -40; z <= 10; z += 2) {
    const row = [];
    for (let x = -14; x <= 14; x += 0.5) row.push(+window.__ct.groundAt(x, z).toFixed(3));
    out.push([z, row]);
  }
  return out;
});
const xs = [];
for (let x = -14; x <= 14; x += 0.5) xs.push(+x.toFixed(1));

console.log('terrain steps along +x (z: x -> from -> to):');
const seen = new Set();
for (const [z, row] of scan) {
  for (let i = 1; i < row.length; i++) {
    const d = row[i - 1] - row[i];
    if (Math.abs(d) > 0.05) {
      const key = `${xs[i]}|${row[i - 1]}|${row[i]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  z=${String(z).padStart(4)}  x=${String(xs[i]).padStart(6)}`
        + `  ${row[i - 1].toFixed(3)} -> ${row[i].toFixed(3)}  (drop ${d.toFixed(3)})`);
    }
  }
}
console.log('\ndistinct ground heights seen:',
  [...new Set(scan.flatMap(([, r]) => r))].sort((a, b) => a - b).join(' '));
await b.close();

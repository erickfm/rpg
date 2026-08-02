import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 30000 });
console.log(await p.evaluate(() => {
  const cols = window.__ct.colliders();
  // everything solid in the roulette neighbourhood
  const near = cols.filter(c => c.maxX > 673 && c.minX < 681 && c.maxZ > -2 && c.minZ < 6);
  const lines = near.sort((a,c)=>a.minZ-c.minZ).map(c =>
    `  x ${c.minX.toFixed(2)} … ${c.maxX.toFixed(2)}   z ${c.minZ.toFixed(2)} … ${c.maxZ.toFixed(2)}   (${(c.maxX-c.minX).toFixed(2)} x ${(c.maxZ-c.minZ).toFixed(2)} m)`);
  // the clear lane on the wheel's centre line, x = 676.9
  const onLine = near.filter(c => 676.9 > c.minX && 676.9 < c.maxX).sort((a,c)=>a.minZ-c.minZ);
  const gaps = [];
  for (let i = 0; i + 1 < onLine.length; i++) gaps.push(`  gap ${(onLine[i+1].minZ - onLine[i].maxZ).toFixed(3)} m  between z ${onLine[i].maxZ.toFixed(2)} and z ${onLine[i+1].minZ.toFixed(2)}`);
  return `solids near the roulette wheel:\n${lines.join('\n')}\n\nON THE WHEEL'S CENTRE LINE (x = 676.9):\n${gaps.join('\n')}`;
}));
await b.close();

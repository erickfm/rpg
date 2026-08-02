// Is the lost door a LOTTERY or a constant? All eight rooms sit in the same
// glob cycle, so which one resolves undefined is decided by evaluation order.
// If it varies between loads it is a lottery and any room can vanish; if it is
// stable, it is deterministic per build and only the casino is affected today.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const seen = [];
for (let i = 0; i < 6; i++) {
  const p = await b.newPage();
  await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  if (i === 0) await reportWorld(p);
  await p.waitForTimeout(700);
  const names = await p.evaluate(() => (window.__ct.doors?window.__ct.doors():[]).map(d=>d.building).sort());
  seen.push(names);
  console.log(`load ${i+1}: ${names.length} doors — ${names.join(', ')}`);
  await p.close();
}
const all = new Set(seen.flat());
const missing = seen.map(s => [...all].filter(n => !s.includes(n)));
console.log(`\ndistinct buildings ever collected: ${all.size}`);
const sets = new Set(seen.map(s => s.join('|')));
console.log(sets.size === 1
  ? `STABLE — the same ${seen[0].length} doors every load; missing: ${missing[0].length?missing[0].join(', '):'none'}`
  : `** VARIES ** across loads — ${sets.size} different door sets in 6 loads`);
await b.close();

// Does the scene name anything? If it does, aiming from the source is a lookup.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const named = {}; let total = 0, unnamed = 0;
  s.traverse(o => { total++; if (o.name) (named[o.name] ??= []).push(o.type); else unnamed++; });
  return { total, unnamed, names: Object.entries(named).map(([k, v]) => [k, v.length]).sort((a,b2)=>b2[1]-a[1]) };
});
console.log(`${r.total} objects, ${r.unnamed} unnamed, ${r.names.length} distinct names`);
for (const [n, c] of r.names.slice(0, 60)) console.log(`  ${String(c).padStart(4)}  ${n}`);
await b.close();

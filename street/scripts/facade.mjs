// How close can the player actually get to each facade, along its length?
//
// D's "collision follows geometry" made each module register its own footprint.
// If a module registers at the true facade (x = +/-7) the player stops 0.36
// short, at +/-6.64, and a door spot at +/-6.55 is REACHABLE. If a stretch is
// still registered inset at +/-6.7 the player stops at +/-6.34 and the same
// spot is 0.21 m inside solid. So the limiting x, sampled along z, is a map of
// which stretches the refactor has actually reached.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const r = await p.evaluate(async () => {
  const out = [];
  const probe = async (z, side) => {           // side -1 = west wall, +1 = east
    window.__ct.warp(side * 4.0, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, 0.14, 0);
    await new Promise(r => setTimeout(r, 90));
    for (let i = 0; i < 90; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise(r => requestAnimationFrame(r));
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    return +window.__ct.pos()[0].toFixed(2);
  };
  for (let z = 12; z >= -96; z -= 4) out.push({ z, west: await probe(z, -1), east: await probe(z, 1) });
  return out;
});
const W = r.map(x => x.west), E = r.map(x => x.east);
console.log(' z     west-limit  east-limit');
for (const x of r) console.log(String(x.z).padStart(4), String(x.west).padStart(11), String(x.east).padStart(11));
const tally = a => { const m = {}; for (const v of a) m[v] = (m[v] ?? 0) + 1; return m; };
console.log('\nwest limits:', JSON.stringify(tally(W)));
console.log('east limits:', JSON.stringify(tally(E)));
await b.close();

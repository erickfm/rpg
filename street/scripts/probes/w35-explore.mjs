// w35 — what does the scene call things? A finder, so the verification probe
// selects objects by the world's own names instead of by a box I guessed.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const out = await p.evaluate(() => {
  const s = window.__ct.scene();
  const names = new Map();
  const udKeys = new Map();
  let meshes = 0;
  s.traverse((o) => {
    if (o.isMesh) meshes++;
    if (o.name) names.set(o.name, (names.get(o.name) || 0) + 1);
    for (const k of Object.keys(o.userData || {})) udKeys.set(k, (udKeys.get(k) || 0) + 1);
  });
  return {
    meshes,
    names: [...names.entries()].sort((a, c) => c[1] - a[1]).slice(0, 120),
    udKeys: [...udKeys.entries()].sort((a, c) => c[1] - a[1]).slice(0, 60),
    sites: Object.keys(window.__ct.sites()),
    rooms: window.__ct.rooms(),
  };
});
console.log('meshes', out.meshes);
console.log('\nsites:', out.sites.join(', '));
console.log('\nrooms:', JSON.stringify(out.rooms));
console.log('\nuserData keys:');
for (const [k, n] of out.udKeys) console.log(`  ${n}\t${k}`);
console.log('\nobject names:');
for (const [k, n] of out.names) console.log(`  ${n}\t${k}`);
await b.close();

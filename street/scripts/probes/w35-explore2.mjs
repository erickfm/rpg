// w35 — second finder: which modules own meshes, and where do the objects the
// sampled ledger rows name actually sit today?
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const out = await p.evaluate(() => {
  const THREE_Box3 = window.__ct.scene().constructor; // unused, kept for clarity
  const s = window.__ct.scene();
  const mods = new Map();
  s.traverse((o) => {
    const m = o.userData && o.userData.mod;
    if (m) mods.set(m, (mods.get(m) || 0) + 1);
  });
  // where is the cat?
  let cat = null, catShadow = null;
  s.traverse((o) => {
    if (o.userData && o.userData.catShadow) catShadow = o.position.toArray().map(n => +n.toFixed(2));
  });
  // atm parts
  const atm = [];
  s.traverse((o) => {
    if (o.userData && (o.userData.atmPart || o.userData.atmTilt !== undefined)) {
      const w = o.getWorldPosition(new o.position.constructor());
      atm.push({ part: o.userData.atmPart ?? null, tilt: o.userData.atmTilt ?? null,
        pos: [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)],
        rotx: +o.rotation.x.toFixed(3) });
    }
  });
  return { mods: [...mods.entries()].sort((a, c) => c[1] - a[1]), catShadow, atm };
});
console.log('meshes by module:');
for (const [k, n] of out.mods) console.log(`  ${String(n).padStart(5)}  ${k}`);
console.log('\ncatShadow at', out.catShadow);
console.log('\natm parts:', JSON.stringify(out.atm, null, 1));
await b.close();

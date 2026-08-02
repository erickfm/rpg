// w47 — NAME the two boxes that block the hotel and church approaches, and say
// whether the lane they block is pavement or roadway.
//
// This is the "is it the world or is it my instrument" step. approach-band.mjs
// starts every leg 8 m out along the door's normal, and 8 m out from a
// side-street door is IN THE ROAD. A parked car there is scenery working
// correctly, not an obstruction — so a "blocked" verdict is only a defect if
// the blocker sits on the pavement the player would actually walk.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w47-id-blockers.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4185/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const BOXES = [
  { what: 'blocks HOTEL ORPHEUS', minX: 36.1, maxX: 40.2, minZ: -100.16, maxZ: -98.06 },
  { what: 'blocks ST BRIGID',     minX: 5.15, maxX: 5.55, minZ: -79.2,   maxZ: -78.8 },
];

for (const b of BOXES) {
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const info = await page.evaluate(([cx, cz, minX, maxX, minZ, maxZ]) => {
    const sc = window.__ct.scene();
    sc.updateMatrixWorld(true);
    const V = sc.position.constructor;
    const found = [];
    sc.traverse((o) => {
      if (!o.isMesh && !o.isGroup) return;
      const p = new V();
      o.getWorldPosition(p);
      if (p.x > minX - 1.2 && p.x < maxX + 1.2 && p.z > minZ - 1.2 && p.z < maxZ + 1.2) {
        // walk up for a named ancestor — the leaf mesh is usually anonymous
        let n = o, chain = [];
        while (n && chain.length < 5) { if (n.name) chain.push(n.name); n = n.parent; }
        found.push({ name: o.name || '(anon)', type: o.type, chain, ud: Object.keys(o.userData || {}), y: +p.y.toFixed(2) });
      }
    });
    return {
      ground: window.__ct.groundAt(cx, cz),
      // is a parked/traffic vehicle sitting here?
      traffic: window.__ct.traffic ? window.__ct.traffic() : null,
      names: [...new Set(found.map((f) => f.chain.filter(Boolean).join(' < ')).filter(Boolean))].slice(0, 12),
      count: found.length,
      userData: [...new Set(found.flatMap((f) => f.ud))].slice(0, 12),
    };
  }, [cx, cz, b.minX, b.maxX, b.minZ, b.maxZ]);

  console.log(`\n── ${b.what}   box centre (${cx.toFixed(2)}, ${cz.toFixed(2)})  size ${(b.maxX - b.minX).toFixed(2)} x ${(b.maxZ - b.minZ).toFixed(2)} m`);
  console.log(`   groundAt centre = ${info.ground}`);
  console.log(`   ${info.count} scene objects near it`);
  if (info.names.length) for (const n of info.names) console.log(`     ${n}`);
  else console.log('     (nothing named — all anonymous meshes)');
  if (info.userData.length) console.log(`   userData keys seen: ${info.userData.join(', ')}`);
}

// Where is the kerb on the side street? The lane the player really walks is the
// pavement, and "the 2 m sidewalk lane is sacred" is the standing rule — so the
// question for each blocker is which side of the kerb it is on.
const profile = await page.evaluate(() => {
  const out = [];
  for (let z = -104; z <= -95; z += 0.5) out.push([+z.toFixed(1), +window.__ct.groundAt(39.51, z).toFixed(3)]);
  return out;
});
console.log(`\n── ground height crossing the HOTEL ORPHEUS approach (x = 39.51), road -> door:`);
console.log('   ' + profile.map(([z, y]) => `${z}:${y}`).join('  '));

const profile2 = await page.evaluate(() => {
  const out = [];
  for (let x = 3; x <= 10; x += 0.5) out.push([+x.toFixed(1), +window.__ct.groundAt(x, -79.5).toFixed(3)]);
  return out;
});
console.log(`\n── ground height crossing the ST BRIGID approach (z = -79.5), road -> door:`);
console.log('   ' + profile2.map(([x, y]) => `${x}:${y}`).join('  '));

await browser.close();

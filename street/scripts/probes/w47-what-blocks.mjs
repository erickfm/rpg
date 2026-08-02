// w47 — WHAT stops the walk to the HOTEL ORPHEUS and ST BRIGID doors?
//
// scripts/approach-band.mjs reports 9 legs that never reach their entrance. A
// blocked walk is a finding, but "something stopped me" is not actionable and
// half of all defects in this project turn out to be the instrument (§7). So
// this names the collider, from the world's own registry, and separates STATIC
// geometry from ACTORS — a citizen standing in a doorway is a pedestrian, not a
// bug, and `__ct.actorColliders()` exists precisely so the two are not confused
// (crosstown.ts records four false defects from exactly that confusion).
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w47-what-blocks.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4185/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const TARGETS = [
  { name: 'HOTEL ORPHEUS', x: 39.51, z: -96.75, nx: 0, nz: -1 },
  { name: 'ST BRIGID',     x: 8.85,  z: -79.50, nx: -1, nz: 0 },
  { name: 'SEVENS (ok, as a control)', x: 51.29, z: -96.75, nx: 0, nz: -1 },
];

for (const t of TARGETS) {
  console.log(`\n── ${t.name}  door spot (${t.x}, ${t.z}), approach along the normal (${t.nx}, ${t.nz})`);
  const out = await page.evaluate(([tx, tz, nx, nz]) => {
    const cols = window.__ct.colliders();
    const actors = window.__ct.actorColliders();
    // identity does not survive the boundary — key an actor box by its extents,
    // the same way the red-dump probes do
    const key = (b) => `${b.minX.toFixed(3)},${b.maxX.toFixed(3)},${b.minZ.toFixed(3)},${b.maxZ.toFixed(3)}`;
    const actorKeys = new Set(actors.map(key));
    const hits = [];
    // sample the approach lane at 0.1 m and ask which boxes contain the point,
    // inflated by the player's own radius (fp.ts moves a 0.36 m capsule)
    const R = 0.36;
    for (let s = 8.0; s >= 0; s -= 0.1) {
      const px = tx + nx * s, pz = tz + nz * s;
      for (const b of cols) {
        if (px > b.minX - R && px < b.maxX + R && pz > b.minZ - R && pz < b.maxZ + R) {
          hits.push({
            s: +s.toFixed(1), actor: actorKeys.has(key(b)),
            box: [+b.minX.toFixed(2), +b.maxX.toFixed(2), +b.minZ.toFixed(2), +b.maxZ.toFixed(2)],
            minY: b.minY ?? null, maxY: b.maxY ?? null,
          });
        }
      }
    }
    return { total: cols.length, actors: actors.length, hits };
  }, [t.x, t.z, t.nx, t.nz]);

  if (!out.hits.length) { console.log('   nothing on the lane — the walk was not stopped by a collider'); continue; }
  // collapse consecutive samples of the same box
  const seen = new Map();
  for (const h of out.hits) {
    const k = h.box.join(',');
    const e = seen.get(k) ?? { ...h, from: h.s, to: h.s };
    e.from = Math.max(e.from, h.s); e.to = Math.min(e.to, h.s);
    seen.set(k, e);
  }
  for (const e of seen.values()) {
    console.log(`   ${e.actor ? 'ACTOR ' : 'STATIC'}  blocks the lane from ${e.from.toFixed(1)} m out to ${e.to.toFixed(1)} m` +
      `   box x[${e.box[0]}, ${e.box[1]}] z[${e.box[2]}, ${e.box[3]}]  y[${e.minY}, ${e.maxY}]`);
  }
}

await browser.close();

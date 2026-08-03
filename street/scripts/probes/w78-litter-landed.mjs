// Item 219. Where does every piece of litter actually LAND, once dimWorld's
// push-out pass has had its way with it? Dumps one line per litter group so a
// before/after pair can be diffed as text rather than looked at.
//
// The authored coordinates live in `ct/props.ts` (`drop(...)`); this reports the
// world position the group ends up at, which is the only number that matters to
// the user. It also reports, per group, how many solids in dimWorld's own
// `solidsNear` set are DESCENDANTS OF THE GROUP ITSELF — the bug: a prop in its
// own obstacle set.
//
// Usage: SHOT_URL=http://localhost:4340/ node scripts/probes/w78-litter-landed.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4340/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const rows = await p.evaluate(() => {
  // A WORLD-AXIS-ALIGNED BOX, COMPUTED BY HAND — and the first version of this
  // probe got it wrong, which is worth leaving in the file. `dimWorld` uses
  // `Box3.setFromObject`, i.e. the box of the WORLD-TRANSFORMED vertices. My
  // first cut read `geometry.boundingBox` instead — LOCAL space, before the
  // mesh's own rotation — and so reported a flat sheet of cardboard lying on
  // the pavement as 0.5 m TALL, because its plane is 0.5 m across in local y
  // and only laid flat by its rotation. That put every piece of litter in the
  // world into the "would have entered its own obstacle set" list, which is the
  // exact opposite of the finding: flat litter never enters, and that is why
  // only crates were being shoved. Measure what dimWorld measures.
  const worldBox = (m) => {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) return null;
    m.updateMatrixWorld(true);
    const e = m.matrixWorld.elements;
    let loY = Infinity, hiY = -Infinity;
    for (const cx of [bb.min.x, bb.max.x]) {
      for (const cy of [bb.min.y, bb.max.y]) {
        for (const cz of [bb.min.z, bb.max.z]) {
          const y = e[1] * cx + e[5] * cy + e[9] * cz + e[13];
          if (y < loY) loY = y;
          if (y > hiY) hiY = y;
        }
      }
    }
    return hiY - loY;
  };
  const out = [];
  window.__ct.scene().traverse((o) => {
    const kind = o.userData?.litter;
    if (!kind) return;
    // SELF-OVERLAP, measured the way dimWorld measures it: how many of this
    // group's own meshes clear dimWorld's `h >= 0.25` gate and would therefore
    // have entered the group's OWN obstacle set under the old group-only tag
    // test at ct/props.ts:1268.
    let ownSolids = 0;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      const h = worldBox(m);
      if (h !== null && h >= 0.25) ownSolids++;
    });
    const w = o.getWorldPosition(new o.position.constructor());
    out.push({ kind, x: +w.x.toFixed(3), y: +w.y.toFixed(3), z: +w.z.toFixed(3),
      yaw: +o.rotation.y.toFixed(3), halfX: +(o.userData.halfX ?? 0).toFixed(3), ownSolids });
  });
  return out.sort((a, c) => a.kind.localeCompare(c.kind) || a.z - c.z || a.x - c.x);
});

await b.close();
// GOTCHAS 34: measuring nothing must FAIL, not print an empty table in green.
if (rows.length < 10) {
  console.log(`\nMEASURED ALMOST NOTHING — ${rows.length} litter group(s); the world places 14. exit 3`);
  process.exit(3);
}
console.log(`\n${rows.length} litter groups\n`);
console.log('kind                        x        y        z      yaw   halfX  own-solids');
for (const r of rows) {
  console.log(`${r.kind.padEnd(22)} ${String(r.x).padStart(8)} ${String(r.y).padStart(8)}`
    + ` ${String(r.z).padStart(8)} ${String(r.yaw).padStart(7)} ${String(r.halfX).padStart(6)}`
    + `  ${r.ownSolids}`);
}
const selfy = rows.filter((r) => r.ownSolids > 0);
console.log(`\n${selfy.length} of ${rows.length} groups carry geometry tall enough (h >= 0.25 m) to have`);
console.log('entered dimWorld\'s own obstacle set under the old GROUP-ONLY tag test:');
for (const r of selfy) console.log(`  ${r.kind} at z ${r.z} — ${r.ownSolids} mesh(es)`);

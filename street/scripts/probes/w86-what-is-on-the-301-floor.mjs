// WHAT IS THE PALE SLIVER LYING ON APARTMENT 301's FLOORBOARDS?
//
// Item 169. The user, 2026-08-02, looking down at the boards indoors: *"what is
// this weird grass on the ground."* The desk explicitly did NOT diagnose it, so
// the first deliverable is an IDENTIFICATION: name the mesh and the module that
// made it. `ct/apartment.ts` has no grass geometry of its own.
//
// So: stand where the player spawns (GOTCHAS 51 — that IS inside 301), find the
// floor, and dump every mesh lying near it with its module stamp, world
// position, size and material. No guessing about which module; the stamp says.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-what-is-on-the-301-floor.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await waitPainted(p, { quiet: true });

const where = await p.evaluate(() => {
  const c = window.__ct;
  return { pos: c.pos ? c.pos() : null, room: c.roomDims ? c.roomDims() : null };
});
console.log('\nplayer spawn (x,y,z,yaw):', JSON.stringify(where.pos));

// Everything lying flat and low, anywhere near the spawn.
const near = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  // `pos()` RETURNS AN ARRAY [x, y, z, yaw], NOT AN OBJECT. Reading `.x` off it
  // gives undefined, every distance comes out NaN, `NaN > 8` is false, and the
  // filter silently passes the entire world — 7865 "nearby" meshes on the first
  // run of this probe. GOTCHAS 56, and it cost one run to notice.
  const pr = window.__ct.pos();
  const me = { x: pr[0], y: pr[1], z: pr[2] };
  const out = [];
  S.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (Math.hypot(x - me.x, z - me.z) > 6) return;
    // the floor is ~1.7 m below the eye; take anything lying within half a metre
    // of it. NOT filtered on `visible` — GOTCHAS 79, that is a rendering fact.
    if (y > me.y - 1.1 || y < me.y - 2.4) return;
    const g = o.geometry;
    const par = g?.parameters ?? {};
    g?.computeBoundingBox?.();
    const bb = g?.boundingBox;
    const mats = window.__mats(o).map((m) => ({
      type: m.type,
      col: m.color ? `#${m.color.getHexString()}` : null,
      map: m.map?.name || (m.map ? 'tex' : null),
      transparent: !!m.transparent, alphaTest: m.alphaTest ?? 0, side: m.side,
    }));
    out.push({
      mod: o.userData?.mod ?? '?',
      name: o.name || '(unnamed)',
      geo: g?.type,
      at: [+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)],
      size: bb ? [+(bb.max.x - bb.min.x).toFixed(3), +(bb.max.y - bb.min.y).toFixed(3), +(bb.max.z - bb.min.z).toFixed(3)] : null,
      par: par.width !== undefined ? [par.width, par.height] : null,
      rotX: +o.rotation.x.toFixed(3),
      visible: o.visible,
      mats,
      parents: (() => { const t = []; let q = o.parent; while (q && t.length < 4) { if (q.name) t.push(q.name); q = q.parent; } return t; })(),
    });
  });
  return out;
});

console.log(`\n${near.length} meshes within 8 m of spawn and at/below knee height:\n`);
// group by module so a foreign module stands out immediately
const byMod = {};
for (const m of near) (byMod[m.mod] ??= []).push(m);
for (const [mod, list] of Object.entries(byMod).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ── mod=${mod}  (${list.length}) ──`);
  for (const m of list.slice(0, 14))
    console.log(`     ${m.geo?.padEnd(16)} ${m.name.padEnd(22)} at ${JSON.stringify(m.at).padEnd(26)}`
      + ` size ${JSON.stringify(m.size)} rotX=${m.rotX} vis=${m.visible} ${JSON.stringify(m.mats[0])}`);
  if (list.length > 14) console.log(`     … and ${list.length - 14} more`);
}

await b.close();

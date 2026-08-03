// DOES ANY OUTDOOR MODULE HAVE GEOMETRY STANDING INSIDE AN INTERIOR? Item 169.
//
// The desk's hypothesis, offered explicitly as a hypothesis: "the interiors are
// PARKED AT x ~ 199 … so an outdoor prop positioned in raw world coordinates, or
// scattered over a range that runs past the street's end, can land inside a
// room." This tests it for EVERY room at once rather than hunting one sliver by
// eye, which also answers the row's other question — one stray or a systematic
// leak — without a second pass.
//
// Method: take each room's rectangle from `__ct.roomDims()` (GOTCHAS 86 — ASK
// for `cx`, never derive it), then list the DISTINCT `userData.mod` stamps of
// every mesh whose world x/z falls inside it, with counts and a floor-level
// breakdown. A foreign module shows up as a name that does not belong.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-foreign-modules-in-rooms.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const rooms = window.__ct.roomDims();
  // the player's own flat is not in roomDims — it is the walkup. Add it from
  // the spawn, which GOTCHAS 51 says is inside 301.
  const pr = window.__ct.pos();
  const all = rooms.concat([{ id: 'apt301(spawn)', w: 9, d: 11, cx: pr[0] + 1.5, cz: pr[2] + 1.5, y: 0 }]);
  const out = [];
  for (const rm of all) {
    const x0 = rm.cx - rm.w / 2, x1 = rm.cx + rm.w / 2;
    const z0 = rm.cz - rm.d / 2, z1 = rm.cz + rm.d / 2;
    const mods = {}, low = {};
    let n = 0;
    S.traverse((o) => {
      if (!o.isMesh) return;
      const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
      if (x < x0 || x > x1 || z < z0 || z > z1) return;
      // inside the room's plan, and within 3 m above its floor
      if (y < rm.y - 0.5 || y > rm.y + 3) return;
      n++;
      const m = o.userData?.mod ?? '?';
      mods[m] = (mods[m] || 0) + 1;
      if (y <= rm.y + 0.25) (low[m] = low[m] || []).push({
        geo: o.geometry?.type, at: [+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)],
        rotX: +o.rotation.x.toFixed(2),
        alphaTest: window.__mats(o)[0]?.alphaTest ?? 0,
        col: window.__mats(o)[0]?.color ? '#' + window.__mats(o)[0].color.getHexString() : null,
      });
    });
    out.push({ id: rm.id, box: [x0.toFixed(1), z0.toFixed(1), x1.toFixed(1), z1.toFixed(1)], n, mods, low });
  }
  return out;
});

// Which module SHOULD own each room is not something to hardcode; instead flag
// the modules the row named as grass/weed producers, plus anything that is a
// clear outdoor module.
const OUTDOOR = new Set(['props', 'tex-world', 'street', 'weeds', 'lot', 'park', 'civic', 'alley', 'cars']);
console.log('');
let flagged = 0;
for (const rm of r) {
  const foreign = Object.keys(rm.mods).filter((m) => OUTDOOR.has(m));
  const tag = foreign.length ? '  <<< OUTDOOR MODULE INSIDE' : '';
  console.log(`  ${rm.id.padEnd(16)} ${String(rm.n).padStart(5)} meshes  [${rm.box.join(',')}]  ${Object.entries(rm.mods).map(([k, v]) => `${k}:${v}`).join(' ')}${tag}`);
  for (const f of foreign) {
    flagged++;
    for (const item of (rm.low[f] ?? []).slice(0, 6))
      console.log(`        FLOOR-LEVEL  mod=${f}  ${item.geo} at ${JSON.stringify(item.at)} rotX=${item.rotX} alphaTest=${item.alphaTest} col=${item.col}`);
  }
}
console.log(`\n  ${flagged} room/outdoor-module pairs flagged`);
await b.close();

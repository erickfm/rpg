// Item 226. Leg 6 now runs for apt301 for the first time and reports
// `1/156 interior materials dimmed by the night sweep`. Before that is written
// down as a defect in the flat, NAME THE MATERIAL AND THE MESH CARRYING IT.
//
// It matters which, because leg 6's sample box is deliberately unbounded in y
// (see interiors-walk.mjs): at apt301 it takes in the whole walk-up stack, so a
// dimming material could belong to the stairwell or to 302 rather than to 301.
// "One material dimmed somewhere in this building" and "the player's own flat
// goes dark" are different findings and only one of them is the user's problem.
//
// Same question asked of the jail, which reports 1/97 and whose sampler this
// item did not change (cz is 0 there), to establish whether that red is mine.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);

const DIMS = await p.evaluate(() => window.__ct.roomDims());

// the same sample leg 6 takes, but keeping the MESH each material sits on
const sample = (cx, cz) => p.evaluate(([cx, cz]) => {
  const out = {};
  window.__ct.scene().updateMatrixWorld(true);
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z - cz) > 8) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color || m.transparent) continue;
      out[m.uuid] = { hex: m.color.getHex(), mesh: o.name || '(unnamed)',
                      mat: m.name || '(unnamed)',
                      at: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)] };
    }
  });
  return out;
}, [cx, cz]);

const steadyAt = async (cx, cz, h, settle) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(settle);
  const shots = [];
  for (let i = 0; i < 4; i++) { shots.push(await sample(cx, cz)); if (i < 3) await p.waitForTimeout(500); }
  const steady = {};
  for (const u of Object.keys(shots[0])) {
    if (shots.every((s) => s[u] && s[u].hex === shots[0][u].hex)) steady[u] = shots[0][u];
  }
  return steady;
};

for (const id of ['apt301', 'jail']) {
  const d = DIMS.find((r) => r.id === id);
  const day = await steadyAt(d.cx, d.cz, 12, 500);
  const dark = await steadyAt(d.cx, d.cz, 2, 900);
  console.log(`\n=== ${id} (cx ${d.cx}, cz ${d.cz}, floor y ${d.y}) ===`);
  let n = 0;
  for (const u of Object.keys(day)) {
    if (dark[u] === undefined) continue;
    n++;
    if (dark[u].hex === day[u].hex) continue;
    console.log(`  DIMMED  mesh="${day[u].mesh}" material="${day[u].mat}"`);
    console.log(`          at ${JSON.stringify(day[u].at)}   (room floor y=${d.y})`);
    console.log(`          day #${day[u].hex.toString(16).padStart(6, '0')} -> night #${dark[u].hex.toString(16).padStart(6, '0')}`);
    console.log(`          y offset from this room's floor: ${(day[u].at[1] - d.y).toFixed(2)} m`);
  }
  console.log(`  judged ${n} materials`);
}
await p.evaluate(() => window.__ct.clock(13, 20));
await b.close();

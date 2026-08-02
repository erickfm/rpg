// ARE THE SCENE'S OTHER `Points` SETS CULLED THE WAY THE RAIN WAS?
//
// Item 24 (3). w16 fixed the rain by turning frustum culling off: its object
// transform never moves, but its VERTICES are rewritten in world space every
// frame, and three caches `geometry.boundingSphere` once — so the sphere stayed
// at the world origin while the drops walked away, and the cull test became
// "can you see the middle of the map". They flagged that the other two Points
// sets are also `frustumCulled` and also read as sitting at the origin, and
// asked whether either follows the player.
//
// BOTH DO — and that is exactly why neither has the bug. They are children of
// `starDome`, which `ct/props.ts:2033` moves to the player every frame
// (`starDome.position.set(px, 0, pz)`). A PARENT TRANSFORM is the safe way to
// follow the player: three culls against the local sphere transformed by
// `matrixWorld`, so it follows too, for free and every frame. Rewriting
// vertices is what defeats the cache.
//
// So this measures the thing that would actually hurt: with the culling left
// ON, are the stars still DRAWN from the far corners of the world at night?
// `onBeforeRender` fires only for objects that survive the cull.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const out = await p.evaluate(async () => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const sets = [];
  s.traverse((o) => { if (o.type === 'Points') sets.push(o); });
  const label = (o) => `${String(o.geometry.getAttribute('position').count).padStart(4)}pt ` +
    `${o.material?.map ? 'rain ' : 'stars'}`;
  // 1. STRUCTURE: does a PARENT move it, and does the world-space sphere follow?
  const worldCentre = (o) => {
    o.geometry.computeBoundingSphere();
    const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
    return [c.x, c.y, c.z];
  };
  window.__ct.clock(25, 30);                       // night, absolute hour
  window.__ct.warp(-6, -20, 0, 0.14, 0);
  await new Promise((r) => setTimeout(r, 700));
  s.updateMatrixWorld(true);
  const at20 = sets.map(worldCentre);
  window.__ct.warp(-6, -95, 0, 0.14, 0);           // 75 m away
  await new Promise((r) => setTimeout(r, 700));
  s.updateMatrixWorld(true);
  const at95 = sets.map(worldCentre);

  // 2. BEHAVIOUR: with culling as it ships, is each set actually DRAWN from
  //    four corners at night? onBeforeRender fires only past the cull.
  const drawn = sets.map(() => 0);
  sets.forEach((o, i) => { o.onBeforeRender = () => { drawn[i]++; }; });
  const spots = [[-6, -20], [-6, -95], [60, -103], [-30, -75]];
  for (const [x, z] of spots) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      window.__ct.warp(x, z, yaw, 0.14, 0);
      await new Promise((r) => setTimeout(r, 260));
    }
  }
  sets.forEach((o) => { o.onBeforeRender = () => {}; });
  return sets.map((o, i) => ({
    label: label(o), culled: o.frustumCulled,
    parent: o.parent?.type + (o.parent?.name ? `:${o.parent.name}` : ''),
    moved: Math.hypot(at95[0] - at20[0], at95[2] - at20[2]).toFixed(1),
    dz: (at95[i][2] - at20[i][2]).toFixed(1),
    drawn: drawn[i],
  }));
});
console.log(`\n  set     frustumCulled  parent          sphere centre dz over a 75 m walk   frames drawn (16 views)`);
let bad = 0;
for (const r of out) {
  const follows = Math.abs(+r.dz) > 50;
  console.log(`  ${r.label}  ${String(r.culled).padEnd(13)}  ${r.parent.padEnd(14)}  ` +
    `${String(r.dz).padStart(8)} m ${follows ? '(FOLLOWS the player)' : '(fixed in the world)'}   ${r.drawn}`);
  // The verdict that can fail: anything still culled must nonetheless be drawn.
  if (r.culled && r.drawn === 0) { bad++; console.log(`     ^ CULLED AWAY — this is the rain's bug in a second place`); }
}
console.log(bad ? `\nFAIL: ${bad} set(s) culled away` : `\nPASS: every Points set is drawn from all four corners at night`);
await b.close();
process.exit(bad ? 1 : 0);

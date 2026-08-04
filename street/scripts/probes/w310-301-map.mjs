// WHAT IS OFFERED WHERE, over the whole south-west corner of flat 301.
//
// The user, after item 310: *"i have access to cal while im close to door, then
// i walk toward cal, away from door and somehow i lose access to cal"*.
//
// The desk twice reasoned about the LINE between two stand-points and twice got
// the shape wrong. This prints the actual REGION: a grid of poses, each warped
// and each reading the live prompt, drawn as a map. No theory, no interpolation.
//
//   C = read the calendar     D = close the door     B = bed     . = nothing
//   * = the calendar's stand-point   # = the door's room-side stand-point
//
// Facing is an argument because the answer depends on it:
//   node scripts/probes/w310-301-map.mjs wall    (default: facing the south wall)
//   node scripts/probes/w310-301-map.mjs door    (facing the door's stand-point)
//
//   SHOT_URL=http://localhost:5177/ node scripts/probes/w310-301-map.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const MODE = (process.argv[2] ?? 'wall').toLowerCase();
const URL = aim('http://localhost:5177/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1800);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

const K = await p.evaluate(() => ({
  onIt: window.__ct.onItRadius ? window.__ct.onItRadius() : window.__ct.playerRadius(),
}));
const spots = await p.evaluate(() =>
  window.__ct.spots().filter((s) => s.x > 195 && s.x < 203 && s.z > -19 && s.z < -14));
const cal = spots.find((s) => /calendar/.test(s.label));
const door = spots.filter((s) => /the door/.test(s.label)).sort((a, c) => a.x - c.x)[0];
const page = await p.evaluate(() => {
  let hit = null;
  window.__ct.scene().traverse((o) => { if (o.userData && o.userData.calendar === 'page') hit = o; });
  return hit ? { x: hit.position.x, z: hit.position.z } : null;
});
if (!cal || !door || !page) {
  console.error(`ABORT: cal=${!!cal} door=${!!door} page=${!!page}`);
  await b.close(); process.exit(3);
}

console.log(`ON_IT ${K.onIt.toFixed(3)}   facing: ${MODE}`);
console.log(`page (${page.x.toFixed(3)}, ${page.z.toFixed(3)})   cal spot * (${cal.x.toFixed(3)}, ${cal.z.toFixed(3)})   door spot # (${door.x.toFixed(3)}, ${door.z.toFixed(3)})`);

// fp.ts builds forward as (sin yaw, -cos yaw), so yaw 0 looks toward -z.
const yawTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

const X0 = 198.60, X1 = 200.10, Z0 = -17.50, Z1 = -16.30, STEP = 0.10;
const nx = Math.round((X1 - X0) / STEP) + 1;
const nz = Math.round((Z1 - Z0) / STEP) + 1;

const glyph = (t) => t == null ? '.'
  : /calendar/.test(t) ? 'C'
  : /door/.test(t) ? 'D'
  : /bed|TV/.test(t) ? 'B'
  : /package/.test(t) ? 'P' : '?';

const rows = [];
let placed = 0, total = 0, calCells = 0;
for (let iz = 0; iz < nz; iz++) {
  const z = Z0 + iz * STEP;
  let line = '';
  for (let ix = 0; ix < nx; ix++) {
    const x = X0 + ix * STEP;
    // `page` is the pose that matters: the player LOOKING AT THE CALENDAR, which
    // is what "i want to read the calendar" means. `wall` looks straight ahead
    // from wherever you stand, which aims at the calendar only in one column.
    const look = MODE === 'door' ? { x: door.x, z: door.z }
      : MODE === 'page' ? { x: page.x, z: page.z }
        : { x, z: page.z - 1 };
    const gy = await p.evaluate(([qx, qz]) => window.__ct.groundAt(qx, qz), [x, z]);
    const yaw = yawTo({ x, z }, look);
    await p.evaluate(([qx, qz, qy, g]) => window.__ct.warp(qx, qz, qy, g, 0), [x, z, yaw, gy]);
    await p.waitForTimeout(120);
    const at = await p.evaluate(() => { const v = window.__ct.pos(); return { x: v[0], z: v[2] }; });
    total++;
    const moved = Math.hypot(at.x - x, at.z - z);
    if (moved < 0.25) placed++;
    let g = moved < 0.25 ? glyph(await prompt()) : 'x';   // x = could not stand here
    if (g === 'C') calCells++;
    if (Math.hypot(x - cal.x, z - cal.z) < STEP / 2) g = g === 'C' ? '*' : g.toLowerCase();
    if (Math.hypot(x - door.x, z - door.z) < STEP / 2) g = g === 'D' ? '#' : g.toLowerCase();
    line += g;
  }
  rows.push({ z, line });
}

console.log(`\n        x ${X0.toFixed(1)} ${' '.repeat(Math.max(0, nx - 12))} ${X1.toFixed(1)}`);
for (const r of rows) console.log(`  z ${r.z.toFixed(2)}  ${r.line}`);
console.log(`\n  the south wall is at z ${page.z.toFixed(2)} (bottom of the map)`);
console.log(`  ${placed}/${total} cells were standable; ${calCells} offer the calendar`);
console.log('  C=calendar D=door B=bed P=package .=nothing x=could not stand  *,#=the two stand-points');

await b.close();
if (placed === 0) { console.error('\nNOTHING WAS MEASURED — every warp failed'); process.exit(3); }

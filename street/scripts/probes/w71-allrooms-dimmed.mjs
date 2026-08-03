// Item 210 — LEG 6'S OWN QUANTITY, for every room, in one pass.
//
// The row's DONE WHEN includes *"no other room regresses"*. `interiors-walk.mjs`
// is the registered check that owns that sentence, but it walks all twelve rooms
// through their doors and exceeded 25 minutes twice on this machine; and it
// cannot run against a built preview at all (item 164 — it imports doors.ts
// inside the page), so it only ever answers about the DEV server.
//
// This measures exactly what leg 6 measures — materials that are STEADY at each
// hour and DIFFERENT between noon and 02:00 — for every room, against the BUILT
// BUNDLE. Same sampling rule as `w64-jail-dimmed.mjs`, which is sixtyfour's
// repaired-by-material-identity version of the leg itself: four samples at each
// hour with the clock held, so animation is not mistaken for the night sweep.
//
// It does NOT replace interiors-walk — it cannot walk a door or open a panel.
// It replaces exactly one leg of it, which is the leg this item is about.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-allrooms-dimmed.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4270/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const rooms = await p.evaluate(() => window.__ct.roomDims());
// ⚠ CENTRED ON THE ROOM'S OWN (cx, cz), NOT ON (cx, 0).
//
// `interiors-walk.mjs` leg 6 and `w64-jail-dimmed.mjs` both test
// `Math.abs(wp.z) > 8`, i.e. they assume every room sits on z = 0. That holds
// for the twelve rooms of the interior BELT and is false for `apt301`, which is
// `belt: false` at cz -16.25, y 5.4. Measured: the z=0 rule finds **1 mesh** in
// apt301; the room's own centre finds 440. So that leg has been sampling a patch
// of empty slab beside the walk-up rather than the walk-up — GOTCHAS 79's shape,
// a check examining almost nothing and reporting green. Reported, not fixed
// there: `scripts/interiors-walk.mjs` is not named by item 210.
const sample = (c) => p.evaluate((r) => {
  const out = {};
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - r.cx) > 8 || Math.abs(wp.z - r.cz) > 8) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color || m.transparent) continue;
      out[m.uuid] = { hex: m.color.getHex(), at: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)] };
    }
  });
  return out;
}, c);

const steadyAt = async (rm, h, settle) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(settle);
  const shots = [];
  for (let i = 0; i < 4; i++) { shots.push(await sample(rm)); if (i < 3) await p.waitForTimeout(450); }
  const steady = {};
  for (const u of Object.keys(shots[0])) {
    if (shots.every((s) => s[u] && s[u].hex === shots[0][u].hex)) steady[u] = shots[0][u];
  }
  return steady;
};

let total = 0, floors = 0;
const rows = [];
for (const r of rooms) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, 0, y), [r.cx, r.cz, r.y]);
  await p.waitForTimeout(400);
  const day = await steadyAt(r, 12, 500);
  const night = await steadyAt(r, 2, 900);
  const judged = Object.keys(day).filter((u) => night[u] !== undefined);
  const bad = judged.filter((u) => night[u].hex !== day[u].hex);
  total += bad.length;
  if (judged.length >= 8) floors++;
  rows.push({ id: r.id, judged: judged.length, dimmed: bad.length,
    where: bad.map((u) => `#${day[u].hex.toString(16).padStart(6, '0')}->#${night[u].hex.toString(16).padStart(6, '0')} at (${day[u].at.join(', ')})`) });
}

console.log('\n  room        judged  dimmed');
for (const r of rows) {
  console.log(`  ${r.id.padEnd(10)}  ${String(r.judged).padStart(6)}  ${String(r.dimmed).padStart(6)}`);
  for (const w of r.where) console.log(`                        ${w}`);
}
// FLOOR: a room that judged nothing would report 0 dimmed and look perfect.
console.log(`\n  ${floors}/${rows.length} rooms judged at least 8 materials`);
console.log(`  total dimmed across the world: ${total}`);
const ok = floors === rows.length;
console.log(ok ? 'MEASURED — every room had a real population' : 'INVALID — some room judged too little to mean anything');
await b.close();
process.exit(ok ? 0 : 1);

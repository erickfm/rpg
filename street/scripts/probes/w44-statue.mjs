// WHAT IS THE FLOATING THING IN THE CHURCH?
//
// The user, with a screenshot: "what is this floating thing in the church?"
// The desk's framing: the statue reads, the bracket does not — either drawn too
// small to read, or drawn behind the wall plane.
//
// This measures rather than assumes. It walks in through the church's street
// door, walks up the north aisle to the votive stand, and reports:
//   · the bracket's and statue's real world AABBs
//   · the nearest wall face behind them, and the GAP between bracket and wall
//   · whether the statue's foot actually rests on the bracket's top
//
// Usage: node scripts/w44-statue.mjs [label]   (SHOT_URL selects the server)
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto, settle } from '../lib/reachable.mjs';

const label = process.argv[2] ?? 'now';
const URL = aim('http://localhost:4192/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1164, height: 819 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 20));

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const press = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(90);
  await p.keyboard.up('e'); await p.waitForTimeout(400);
};
const hold = async (k, ms) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms);
  await p.keyboard.up(k); await p.waitForTimeout(140);
};

// ── get to the church door, then WALK the last stretch and press E ──────
// ASK THE RUNNING WORLD, not the source tree. This first imported
// `/src/proto/ct/doors.ts` directly, which works on the dev server and dies on
// the BUILT bundle ("Failed to fetch dynamically imported module") — where the
// change actually has to be proved. `__ct.spots()` is published by both.
const stand = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /BRIGID/.test(q.label ?? ''));
  return s ? { x: s.x, z: s.z } : null;
});
if (!stand) { console.error('no BRIGID door spot published — nothing measured'); process.exit(3); }
console.log('church door stand spot:', stand);
// The face normal is -x, so the forecourt is at SMALLER x. Stand back 2.2 m
// out along it and WALK in (+x, yaw +PI/2), so arrival is by foot not by warp.
await p.evaluate(([x, z]) => window.__ct.warp(x - 2.2, z, Math.PI / 2, 0.14, 0), [stand.x, stand.z]);
await p.waitForTimeout(300);
await hold('w', 900);
let pr = await prompt();
console.log('prompt after walking up:', JSON.stringify(pr));
if (!pr || !/BRIGID/.test(pr)) { await hold('w', 500); pr = await prompt(); console.log('retry prompt:', JSON.stringify(pr)); }
await press();
const inside = await pos();
console.log('inside at:', inside.slice(0, 3).map((n) => +n.toFixed(2)));

// the room's slab centre: interiors live in an 80 m belt from x = 400
const cx = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;
console.log('slab centre cx =', cx);

// ── find the votive assembly ────────────────────────────────────────────
// Room is W 13.0 x D 24.0 -> hw 6.5, hd 12.0. The stand is authored at
// CX = -hw + 0.95, CZ = hd - 4.1 in ROOM-LOCAL coords; the room sits at the
// slab centre, so local x = world x - cx. z is authored about 0.
const r = await p.evaluate(([cx]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const lx0 = w.min.x - cx, lx1 = w.max.x - cx;
    // only things in this room's slab
    if (lx1 < -30 || lx0 > 30) return;
    out.push({
      lx0: +lx0.toFixed(3), lx1: +lx1.toFixed(3),
      y0: +w.min.y.toFixed(3), y1: +w.max.y.toFixed(3),
      z0: +w.min.z.toFixed(3), z1: +w.max.z.toFixed(3),
      type: n.geometry.type,
      col: n.material && n.material.color ? '#' + n.material.color.getHexString() : '?',
    });
  });
  return out;
}, [cx]);
console.log('meshes in slab:', r.length);

const near = (q) => q.lx0 > -6.6 && q.lx1 < -4.6 && q.z0 > 6.8 && q.z1 < 9.0;
const cluster = r.filter(near).sort((a, b) => a.y0 - b.y0);
console.log('\n── everything in the votive corner (local x -6.6..-4.6, z 6.8..9.0) ──');
for (const q of cluster) {
  console.log(`  y ${String(q.y0).padStart(7)}..${String(q.y1).padEnd(7)}  x ${String(q.lx0).padStart(7)}..${String(q.lx1).padEnd(7)}  z ${String(q.z0).padStart(7)}..${String(q.z1).padEnd(7)}  ${q.type.replace('Geometry', '').padEnd(9)} ${q.col}`);
}

// THE SHELF, not merely the lowest lump of corbel. The corbel is three boxes
// now and picking "the first box above 1.2 m" grabbed the wedge underneath —
// which then reported the figure as 0.07 m clear of a thing it does not stand
// on, i.e. a floating statue that is not floating. Name the parts properly:
// the shelf is the WIDEST box in the corbel band; the figure's foot is the
// lowest cylinder above it.
const corbel = cluster.filter((q) => q.type === 'BoxGeometry' && q.y0 > 1.15 && q.y1 < 1.55
  && (q.lx1 - q.lx0) < 0.6);
const bracket = corbel.length
  ? corbel.reduce((a, q) => ((q.z1 - q.z0) > (a.z1 - a.z0) ? q : a))
  : undefined;
const body = cluster.filter((q) => q.type === 'CylinderGeometry' && q.y0 > 1.3 && q.y1 < 2.2)
  .sort((a, b) => a.y0 - b.y0)[0];
const head = cluster.filter((q) => q.type === 'SphereGeometry' && q.y0 > 1.8)
  .sort((a, b) => b.y1 - a.y1)[0];
console.log(`\ncorbel is ${corbel.length} box(es); the shelf is the widest in z`);

// ── what is BEHIND it? find the west wall face ──────────────────────────
// the wall is a big thing spanning y from the floor upward at local x ~ -6.5
const walls = r.filter((q) => q.y1 - q.y0 > 3 && q.lx1 < -5.0 && (q.z1 - q.z0) > 3);
console.log('\n── candidate west-wall meshes ──');
for (const q of walls.slice(0, 8)) {
  console.log(`  x ${q.lx0}..${q.lx1}  y ${q.y0}..${q.y1}  z ${q.z0}..${q.z1}  ${q.type} ${q.col}`);
}
const wallFace = walls.length ? Math.max(...walls.map((q) => q.lx1)) : null;

console.log('\n════ THE MEASUREMENT ════');
if (bracket) {
  console.log(`bracket   x ${bracket.lx0}..${bracket.lx1}   y ${bracket.y0}..${bracket.y1}   z ${bracket.z0}..${bracket.z1}`);
}
if (body) console.log(`statue    x ${body.lx0}..${body.lx1}   y ${body.y0}..${body.y1}   z ${body.z0}..${body.z1}`);
if (head) console.log(`head      x ${head.lx0}..${head.lx1}   y ${head.y0}..${head.y1}`);
console.log(`west wall inner face at local x = ${wallFace}`);
if (bracket && wallFace !== null) {
  const gap = bracket.lx0 - wallFace;
  console.log(`\nGAP between the bracket's back edge and the wall: ${gap.toFixed(3)} m`);
  console.log(gap > 0.05
    ? '  -> THE BRACKET TOUCHES NOTHING. The whole assembly hangs in mid-air.'
    : '  -> the bracket meets the wall.');
}
if (bracket && body) {
  const rest = body.y0 - bracket.y1;
  console.log(`statue foot vs bracket top: ${rest.toFixed(3)} m  ${Math.abs(rest) < 0.01 ? '(rests on it)' : '(NOT resting)'}`);
}

// ── now WALK to it and look, from the player's own standing position ────
//
// THE WORLD'S YAW CONVENTION (lib/viewof.mjs): yaw 0 looks along -z, and a
// heading y points along (sin y, -cos y). So yaw = PI walks toward +z, and
// looking AT a point is yaw = atan2(dx, -dz) — NOT atan2(dx, dz) + PI, which
// is a reflection and is what pointed the first run of this at the altar.
//
// Start in the open floor behind the last pew and walk up the west aisle.
await p.evaluate(([cx]) => window.__ct.warp(cx - 4.5, 5.2, Math.PI, 0.14, 0), [cx]);
await p.waitForTimeout(250);
const a = await pos();
await hold('w', 1200);           // walk toward +z, up the aisle to the stand
const bpos = await pos();
console.log(`\nwalked the aisle: ${a.slice(0, 3).map((n) => +n.toFixed(2))} -> ${bpos.slice(0, 3).map((n) => +n.toFixed(2))}`);
console.log(`  travelled ${Math.hypot(bpos[0] - a[0], bpos[2] - a[2]).toFixed(2)} m`);

// face the statue from where the walk stopped
await p.evaluate(([cx, px, pz]) => {
  const tx = cx - 5.55, ty = 1.78, tz = 7.74;
  const d = Math.hypot(tx - px, tz - pz);
  const yaw = Math.atan2(tx - px, -(tz - pz));
  window.__ct.warp(px, pz, yaw, 0.14, Math.atan2(ty - 1.62, d));
}, [cx, bpos[0], bpos[2]]);
await settle(p);
await p.screenshot({ path: `shots/w44-statue-${label}.png` });
console.log(`\nwrote shots/w44-statue-${label}.png from x=${bpos[0].toFixed(2)} z=${bpos[2].toFixed(2)}`);

// AND FROM WHERE YOU FIRST SEE IT, which is not where you end up. You come in
// at the door end and walk up the nave; if the shrine only reads once your
// nose is 2 m from it, it does not read. Same aim, from the back of the room.
await p.evaluate(([cx]) => {
  const px = cx - 3.0, pz = 2.6;
  const tx = cx - 6.33, ty = 1.80, tz = 7.74;
  const d = Math.hypot(tx - px, tz - pz);
  window.__ct.warp(px, pz, Math.atan2(tx - px, -(tz - pz)), 0.14, Math.atan2(ty - 1.62, d));
}, [cx]);
await settle(p);
await p.screenshot({ path: `shots/w44-statue-far-${label}.png` });
console.log(`wrote shots/w44-statue-far-${label}.png (from 5.5 m down the nave)`);

await b.close();

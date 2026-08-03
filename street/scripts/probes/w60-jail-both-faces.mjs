// ITEM 153 — the jail door, from BOTH sides, in one run.
//
// Three things the item asks and nobody has answered:
//   1. what state is each face actually in — measured, not eyeballed
//   2. can the interior leaves collide with the exterior assembly that w59
//      moved forward by one leaf thickness
//   3. a photograph of the INTERIOR face from a LEGAL standing position; the
//      last attempt put its camera inside a wall and the face is unmeasured
//
// The standing position is not computed here. The game is asked to put the
// player inside, and then the camera turns around ON THE SPOT — whatever the
// door spot hands you is by construction somewhere a player can stand.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  page error:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));

// GOTCHAS 76 / w59: the FIRST frame after load is black. Wait for a real one.
await p.waitForFunction(() => {
  const c = document.querySelector('canvas'); if (!c) return false;
  const g = document.createElement('canvas'); g.width = 64; g.height = 40;
  const cx = g.getContext('2d'); cx.drawImage(c, 0, 0, 64, 40);
  const d = cx.getImageData(0, 0, 64, 40).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4) / 3 > 8;
}, { timeout: 30000 });

// the jail's own out-spot, from ct/int-jail.ts: JAIL_DOOR.x - 0.88, z + 2.2
const OUT = await p.evaluate(() => ({ x: 61.55 - 0.88, z: -103.0 + 2.2 }));
void OUT;

// ── the door leaves, wherever they are ─────────────────────────────────────
// jailLeafTex() is ONE texture shared by both faces, so both sides' leaves
// carry the same map image. That is the signature — but it is a signature for
// LEAVES, not for a place, so report every one and let position separate them.
const findLeaves = () => p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    const mat = Array.isArray(n.material) ? n.material[0] : n.material;
    const img = mat && mat.map && mat.map.image;
    if (!img) return;
    // the jail leaf canvas, and nothing else of that size nearby
    if (!(img.width === 24 && img.height === 64)) return;
    const g = n.geometry; g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const e = n.matrixWorld.elements;
    // the leaf's own facing: local +z, normalised
    const l = Math.hypot(e[8], e[9], e[10]) || 1;
    out.push({
      type: g.type,
      pos: [e[12], e[13], e[14]].map((v) => +v.toFixed(3)),
      size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((v) => +v.toFixed(3)),
      normal: [e[8] / l, e[9] / l, e[10] / l].map((v) => +v.toFixed(3)),
      // the yaw of the leaf about Y, in degrees off the world Z axis
      yawDeg: +((Math.atan2(e[8] / l, e[10] / l) * 180) / Math.PI).toFixed(1),
    });
  });
  return out;
});

// stand OUTSIDE the jail first — the world culls by region and the jail is not
// in the scene at all until you are near it (w59's note; a MISS here would read
// as "the door is fine")
await p.evaluate(() => window.__ct.warp(61.55 - 2.6, -103.0 + 2.2, -Math.PI / 2, 0.14, 0));
await p.waitForTimeout(1500);
const outside = await findLeaves();
console.log(`\n── OUTSIDE, standing on the pavement ──  ${outside.length} jail leaf/leaves in scene`);
for (const l of outside) console.log(`   at ${l.pos}  ${l.size[0]} x ${l.size[1]} x ${l.size[2]}  yaw ${l.yawDeg}°`);
await p.screenshot({ path: 'shots/w60-jail-outside.png' });

// ── GO IN. FIND THE SPOT, DO NOT GUESS AT IT ───────────────────────────────
// The first run of this pressed E from 3.4 m away, nothing happened, the player
// never moved, and the three "interior" frames it then filed were the OUTSIDE
// of the door photographed from the pavement. Nothing in the output said so.
// So: hunt for the position where the world actually offers the way in, and
// prove the press worked by watching the player MOVE.
const hint = () => p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
// THE EXTERIOR PAIR ONLY. Averaging z over every leaf the signature matched —
// including the interior pair 1000 m away and a third door at x 434 — put the
// scan at z -27, nowhere near the jail, and the probe then reported "never
// found a position offering the way in" about a door it had never approached.
const ext = outside.filter((l) => Math.abs(l.pos[0] - 61.5) < 6);
if (ext.length !== 2) console.log(`   *** expected 2 exterior leaves, matched ${ext.length} ***`);
const doorX = ext.length ? ext[0].pos[0] : 61.505;
const doorZ = ext.length ? ext.reduce((a, l) => a + l.pos[2], 0) / ext.length : -103.0;
let stand = null;
for (const back of [0.75, 0.9, 1.1, 1.4, 1.8]) {
  for (const dz of [0, -0.4, 0.4]) {
    await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0.14, 0),
      [doorX - back, doorZ + dz]);
    await p.waitForTimeout(320);
    const h = await hint();
    if (/HOUSE OF DETENTION/i.test(h)) { stand = { x: doorX - back, z: doorZ + dz, h }; break; }
  }
  if (stand) break;
}
if (!stand) { console.error('MISS: never found a position offering the way in'); process.exit(3); }
console.log(`\n   the way in is offered at (${stand.x.toFixed(2)}, ${stand.z.toFixed(2)}): "${stand.h}"`);

const before = await p.evaluate(() => window.__ct.pos());
await p.keyboard.down('e'); await p.waitForTimeout(140); await p.keyboard.up('e');
await p.waitForTimeout(1800);
const inPos = await p.evaluate(() => window.__ct.pos());
const moved = Math.hypot(inPos[0] - before[0], inPos[2] - before[2]);
console.log(`\n── INSIDE ──  the game put the player at (${inPos[0].toFixed(2)}, ${inPos[2].toFixed(2)}), gy ${inPos[3]}`);
console.log(`   the press moved the player ${moved.toFixed(1)} m — `
  + `${moved > 5 ? 'we are somewhere else, so we went in' : '*** WE DID NOT GO ANYWHERE ***'}`);
if (moved <= 5) process.exit(4);

const inside = await findLeaves();
console.log(`   ${inside.length} jail leaf/leaves in scene now`);
for (const l of inside) console.log(`   at ${l.pos}  ${l.size[0]} x ${l.size[1]} x ${l.size[2]}  yaw ${l.yawDeg}°`);

// the interior pair: the ones near the player, not the ones 500 m away
const near = inside.filter((l) => Math.hypot(l.pos[0] - inPos[0], l.pos[2] - inPos[2]) < 12);
const far = inside.filter((l) => Math.hypot(l.pos[0] - inPos[0], l.pos[2] - inPos[2]) >= 12);
console.log(`\n   ${near.length} within 12 m of the player (the interior pair)`);
console.log(`   ${far.length} further off`);
if (near.length && far.length) {
  const d = Math.hypot(near[0].pos[0] - far[0].pos[0], near[0].pos[2] - far[0].pos[2]);
  console.log(`   interior pair is ${d.toFixed(1)} m from the exterior pair`);
  console.log(`   COLLISION WITH THE EXTERIOR ASSEMBLY: ${d > 5 ? 'IMPOSSIBLE — different places entirely'
    : '*** possible, they are close enough to touch ***'}`);
}

// ── PHOTOGRAPH THE INTERIOR FACE, from where the game itself put the player ──
// Turn around on the spot: whatever the door spot handed us is by construction
// a legal standing position, which is exactly what the last attempt could not
// guarantee when it computed a camera and landed inside a wall.
if (near.length) {
  const cx = near.reduce((a, l) => a + l.pos[0], 0) / near.length;
  const cz = near.reduce((a, l) => a + l.pos[2], 0) / near.length;
  const dx = cx - inPos[0], dz = cz - inPos[2];
  const yaw = Math.atan2(dx, -dz);
  console.log(`\n   the interior pair centres on (${cx.toFixed(2)}, ${cz.toFixed(2)}), `
    + `${Math.hypot(dx, dz).toFixed(2)} m from the player — turning to yaw ${yaw.toFixed(3)}`);
  for (const [tag, back] of [['atdoor', 0], ['back2m', 2.0], ['back4m', 4.0]]) {
    const ux = dx / Math.hypot(dx, dz), uz = dz / Math.hypot(dx, dz);
    const sx = inPos[0] - ux * back, sz = inPos[2] - uz * back;
    await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, -0.05),
      [sx, sz, yaw, inPos[3]]);
    await p.waitForTimeout(600);
    const at = await p.evaluate(() => window.__ct.pos());
    await p.screenshot({ path: `shots/w60-jail-inside-${tag}.png` });
    console.log(`   shots/w60-jail-inside-${tag}.png  stood (${at[0].toFixed(2)}, ${at[2].toFixed(2)})`
      + `  ${Math.hypot(at[0] - cx, at[2] - cz).toFixed(2)} m from the door`);
  }
}
await b.close();

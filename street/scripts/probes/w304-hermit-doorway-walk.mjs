// ITEM 304 — CAN YOU WALK THROUGH THE HERMIT'S DOOR LEAF?
//
// The row: *"NOTHING STOPS YOU AT THE HERMIT'S DOORWAY — 302's door leaf has NO
// COLLIDER IN EITHER POSE, open or shut."*
//
// Half of that is measurably wrong and the other half is measurably right, and
// the two halves want opposite conclusions — which is why this walks rather
// than reads a list. `scripts/solid-leaf-vs-collider.mjs` reports, on the built
// bundle:
//
//     SHUT (the world's opening pose)   41/41 covered, worst uncovered 0.000 m
//     OPEN (hermit forced out)           2/41 covered, worst uncovered 0.887 m
//
// So the SHUT leaf is not uncovered at all — it stands at x AX(2.52), inside
// the east wall's own unsplit collider `AX(2.40)…AX(2.55) × AZI(0)…AZI(13.2)`,
// the run that `apartment.ts` says in a comment "is what holds all four east
// doorways shut, and it is deliberate". The OPEN leaf swings back into the
// 1.2 m recess, out to AX(3.40), and leaves that box behind.
//
// A LEAF WITH NO COLLIDER ON IT IS ONLY A DEFECT IF THE PLAYER CAN REACH IT.
// That is the question a collider list cannot answer and this probe can: with
// the hermit forced OUT and the leaf fully open, stand in the shaft, face east
// and walk. If the wall stops you west of AX(2.40) the leaf is behind a wall in
// its open pose and there is nothing to pass through; if you reach AX(2.52) the
// row is right and the leaf needs a collider that swings with it.
//
// ⚠ `w`, not `d` — see w101-flatdoor-plug.mjs, whose first cut strafed and
// reported eight identical numbers that were the probe never moving.
//
// Usage: SHOT_URL=http://localhost:4188/ node scripts/probes/w304-hermit-doorway-walk.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.warp && window.__ct.colliders, null, { timeout: 60000 });

const spawn = await p.evaluate(() => window.__ct.scene()?.userData?.spawn ?? null);
if (!spawn) { console.log('ABORT no scene.userData.spawn (GOTCHAS 32)'); await b.close(); process.exit(3); }
const APT_X = spawn.x + 1.4, APT_Z = spawn.z - 3.7, ST = spawn.gy / 2;
console.log(`walk-up (${APT_X.toFixed(2)}, ${APT_Z.toFixed(2)}), storey ${ST.toFixed(2)} m`);

/** Where the leaf's free tip actually is, in the building's own local x. */
const leafTip = async () => p.evaluate((ax) => {
  const s = window.__ct.scene();
  let leaf = null;
  s.traverse((o) => { if (o.name === 'leaf302') leaf = o; });
  if (!leaf) return null;
  leaf.updateMatrixWorld(true);
  const g = leaf.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const e = leaf.matrixWorld.elements, bb = g.boundingBox;
  const tip = { x: bb.min.x, y: 0, z: 0 };                 // the free edge, hinge is at local x 0
  const X = e[0] * tip.x + e[4] * tip.y + e[8] * tip.z + e[12];
  const Z = e[2] * tip.x + e[6] * tip.y + e[10] * tip.z + e[14];
  return { localX: X - ax, worldX: X, worldZ: Z, rot: leaf.rotation.y,
           travel: s.userData.doorTravel?.leaf302, hermit: s.userData.hermit };
}, APT_X);

/** Stand in the shaft on the hermit's landing, face east (+x), walk forward. */
const pushEast = async (ms = 2200) => {
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, Math.PI / 2, gy, 0),
    [APT_X + 1.6, APT_Z + 3.5, 2 * ST]);
  await p.waitForTimeout(400);
  const q = await p.evaluate(async (ms) => {
    const ev = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k }));
    ev('keydown', 'w');
    await new Promise((r) => setTimeout(r, ms));
    ev('keyup', 'w');
    await new Promise((r) => setTimeout(r, 250));
    const P = window.__ct.pos();
    return [P[0], P[2]];
  }, ms);
  return { x: q[0], z: q[1] };
};

const report = async (label) => {
  const L = await leafTip();
  console.log(`\n${label}`);
  console.log(`   leaf302 rot ${L.rot.toFixed(3)} rad  (shut ${L.travel.shut.toFixed(3)}, open ${L.travel.open.toFixed(3)})`
    + `   free tip at local x ${L.localX.toFixed(3)}`);
  console.log(`   hermit ${JSON.stringify(L.hermit)}`);
  const r = await pushEast();
  const lx = r.x - APT_X, lz = r.z - APT_Z;
  if (Math.abs(lx - 1.6) < 0.02) {
    console.log(`   DID NOT MOVE (local x still ${lx.toFixed(3)}) — this measured NOTHING`);
    return null;
  }
  console.log(`   walked east to local x ${lx.toFixed(3)} (z ${lz.toFixed(2)})`);
  console.log(lx > 2.40
    ? `   <-- PAST THE WALL FACE (2.40). ${lx >= L.localX ? 'AND PAST THE LEAF TIP — you walked through the door.' : 'Inside the reveal.'}`
    : `   stopped ${(2.40 - lx).toFixed(3)} m short of the wall face (2.40); the leaf tip is `
      + `${(L.localX - lx).toFixed(3)} m further east again`);
  return lx;
};

// 1. as the world loads: hermit in, leaf SHUT
await p.evaluate(() => window.__ct.hermit(false));
await p.waitForFunction(() => {
  const s = window.__ct.scene();
  return Math.abs(s.userData.hermit.door - s.userData.doorTravel.leaf302.shut) < 0.01;
}, null, { timeout: 30000 });
const shutX = await report('SHUT — the pose the world loads in:');

// 2. hermit forced out, leaf fully OPEN — the pose that measured 2/41 covered
await p.evaluate(() => window.__ct.hermit(true));
await p.waitForFunction(() => {
  const s = window.__ct.scene();
  return Math.abs(s.userData.hermit.door - s.userData.doorTravel.leaf302.open) < 0.01;
}, null, { timeout: 30000 });
const openX = await report('OPEN — hermit out, leaf swung back into the recess:');

// 3. HOW FAR EAST CAN THE PLAYER EVER GET? The two runs above are both bounded
// by something that MOVES — the plug (2.25…2.40) in the shut run, the hermit's
// own 0.52 m capsule in the open one — and a bound from a moving box is not a
// bound. So park the plug and send him home, leaving only the unsplit east wall,
// which is a plain static push present in every pose and on every floor.
//
// ⚠ DO NOT TRY TO PARK `hermitCap` — it is a CAP, and `updateHermitAt` re-sets
// it from his x on the very next frame, so parking it changes nothing and the
// run silently re-measures the man instead of the wall. The first cut of this
// probe did exactly that and reported 1.655 as "the east wall alone", which is
// his capsule at 2.06 less the rig's 0.36 radius. Send him IN instead: `in` is
// the one phase with no capsule at all.
// ⚠ AND STAND CLEAR FIRST. `blockedAt` stops him taking a step while the player
// is within 0.72 m of it, so a player left where run 2 ended is standing in his
// only path home and he waits there for ever — the first cut of this timed out
// at 30 s in phase `out` for exactly that reason. He is polite, not stuck.
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0),
  [APT_X + 0.6, APT_Z + 8.0, 2 * ST]);
await p.waitForTimeout(500);
await p.evaluate(() => window.__ct.hermit(false));
await p.waitForFunction(() => window.__ct.scene().userData.hermit.phase === 'in',
  null, { timeout: 30000 });
const parked = await p.evaluate((ax) => {
  const near = (a, b) => Math.abs(a - b) < 0.02;
  let n = 0;
  for (const c of window.__ct.colliders()) {
    if (near(c.minX, ax + 2.25) && near(c.maxX, ax + 2.40)) {
      c.minX = c.maxX = c.minZ = c.maxZ = 9999; n++;
    }
  }
  return n;
}, APT_X);
if (parked !== 1) { console.log(`\nABORT expected to park exactly 1 reveal plug, parked ${parked}`
  + ' — the run below would not isolate the wall'); await b.close(); process.exit(3); }
console.log('\nparked the 0.15 m reveal plug; hermit sent home so he carries no capsule');
const bareX = await report('EAST WALL ALONE — the only box left across the doorway:');

console.log('\n──');
if (bareX !== null) {
  console.log(bareX <= 2.40
    ? `   the unsplit east wall alone stops you at local x ${bareX.toFixed(3)}, and it is a STATIC push —`
      + ' identical in both poses. That is the hard ceiling on how far east the player can ever reach.'
    : `   WITHOUT the plug you reach ${bareX.toFixed(3)} — the wall does NOT hold on its own`);
}
if (shutX === null || openX === null) {
  console.log('INCONCLUSIVE — a run did not move.');
  await b.close(); process.exit(3);
}
const worst = Math.max(shutX, openX, bareX ?? -Infinity);
const OPEN_LEAF_NEAR = 2.52;     // the open leaf's hinge edge, its westmost point
console.log(worst <= 2.40
  ? `THE DOORWAY HOLDS: stopped at local x ${shutX.toFixed(3)} shut (the plug), ${openX.toFixed(3)} open`
    + ` (the hermit)${bareX === null ? '' : `, ${bareX.toFixed(3)} with both removed (the east wall)`}.`
    + `\nThe furthest east the player can EVER reach is ${worst.toFixed(3)}; the open leaf's nearest point`
    + ` is ${OPEN_LEAF_NEAR.toFixed(3)}, so ${(OPEN_LEAF_NEAR - worst).toFixed(3)} m of solid wall separates`
    + ' them. The open leaf is uncovered and unreachable, which are different things.'
  : `REACHABLE: furthest east reached is local x ${worst.toFixed(3)} — past the 2.40 wall face.`);

if (errs.length) console.log(`\nPAGE ERRORS (${errs.length}):\n  ` + errs.join('\n  '));
else console.log('no page errors');
await b.close();
process.exit(worst <= 2.40 ? 0 : 1);

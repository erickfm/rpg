// RE-EVIDENCING MY OWN CONFIRMED ROWS THAT REST ON NOTHING.
//
// AUDIT swept the 171 CONFIRMED rows for what their status actually rests on
// and found 28 naming nobody and nothing. Four of mine are on that list, and
// the desk's instruction is the right one: go and look, write what you saw,
// WHERE YOU STOOD, and the predicate that would catch it going false. A row
// that no longer holds goes back to LANDED, and that is the valuable outcome.
//
// The four:
//   1. "i dont think we need the bottom wood part. also the tonys pizza part
//       needs a bezel"
//   2. "the tonys pizza sign should go on the back of the bench also the bench
//       back should lean back a lil"
//   3. "should not be cutting off the actual ad for tonys pizza, strange
//       graphical bug on the legs"
//   4. tree pit: trunk off-centre toward the kerb
//
// Three of them are the SAME OBJECT, so one trip settles them — but each gets
// its OWN predicate, because "the bench looks right" is exactly the kind of
// evidence that let these rows rot in the first place.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const all = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    all.push({ n, ud: n.userData, mats,
      x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z,
      rot: [+n.rotation.x.toFixed(4), +n.rotation.y.toFixed(4), +n.rotation.z.toFixed(4)] });
  });

  // ── THE BENCH, found by the ad it carries rather than by a coordinate ────
  const ad = all.find((q) => q.ud.benchAd);
  const out = { ad: null };
  if (ad) {
    const AX = (ad.x0 + ad.x1) / 2, AZ = (ad.z0 + ad.z1) / 2;
    // everything within 1.4 m of the ad IS the bench
    const parts = all.filter((q) => Math.hypot((q.x0 + q.x1) / 2 - AX, (q.z0 + q.z1) / 2 - AZ) < 1.4
      && q.y1 > 0.05 && q.y1 < 2.0);
    const box = (q) => ({ x: [+q.x0.toFixed(3), +q.x1.toFixed(3)], y: [+q.y0.toFixed(3), +q.y1.toFixed(3)],
                          z: [+q.z0.toFixed(3), +q.z1.toFixed(3)] });
    // the SEAT: the widest horizontal run at 0.35-0.60 m
    const slats = parts.filter((q) => q.y1 - q.y0 < 0.09 && q.y1 > 0.35 && q.y1 < 0.62
      && (q.z1 - q.z0) > 1.0);
    const seatY = slats.length ? Math.max(...slats.map((q) => q.y1)) : null;
    // the LEGS: thin uprights reaching the ground
    const legs = parts.filter((q) => q.y0 < 0.20 && q.y1 > 0.30
      && Math.max(q.x1 - q.x0, q.z1 - q.z0) < 0.30);
    // ANYTHING between the ground and the seat that is NOT a leg — that is the
    // "bottom wood part" the user asked to be removed
    // MY FIRST PREDICATE STARTED AT y 0.12, WHICH IS THE PAVEMENT. sidewalkY
    // is 0.14, so it swept in the bench's own contact shadow and the litter
    // decals lying under it — four "solids" of 0 to 4.8 cm height, all resting
    // on the ground. That is not a lower slatted panel; it is the floor. A
    // panel is a real solid, standing clear of the pavement and tall enough to
    // be a panel.
    const underSeat = parts.filter((q) => !legs.includes(q) && !slats.includes(q)
      && q.y0 > 0.20 && q.y1 < (seatY ?? 0.5) - 0.02
      && (q.y1 - q.y0) > 0.05
      && Math.max(q.x1 - q.x0, q.z1 - q.z0) > 0.35);
    // the BEZEL: bars around the ad, in its group
    const bezel = parts.filter((q) => q !== ad && q.n.parent === ad.n.parent
      && Math.min(q.x1 - q.x0, q.y1 - q.y0, q.z1 - q.z0) < 0.09
      && q !== ad);
    out.ad = {
      at: [+AX.toFixed(2), +((ad.y0 + ad.y1) / 2).toFixed(2), +AZ.toFixed(2)],
      adBox: box(ad), seatY, nSlats: slats.length, nLegs: legs.length,
      underSeat: underSeat.map(box), nBezel: bezel.length,
      bezelBoxes: bezel.map(box),
      // the RECLINE: the ad's group rotation about z (the bench faces ±x)
      groupRot: ad.n.parent ? [+ad.n.parent.rotation.x.toFixed(4),
                               +ad.n.parent.rotation.y.toFixed(4),
                               +ad.n.parent.rotation.z.toFixed(4)] : null,
      legBoxes: legs.map(box), slatBoxes: slats.map(box),
      label: ad.ud.benchAd,
    };
  }

  // ── THE TREE PITS: is the trunk centred in its dirt square? ─────────────
  // A pit is a flat dirt square on the walk; a trunk is a thin upright in it.
  const pits = all.filter((q) => q.y1 - q.y0 < 0.10 && q.y1 > 0.10 && q.y1 < 0.22
    && (q.x1 - q.x0) > 0.5 && (q.x1 - q.x0) < 1.6 && (q.z1 - q.z0) > 0.5 && (q.z1 - q.z0) < 1.6
    && Math.abs((q.x0 + q.x1) / 2) > 4 && Math.abs((q.x0 + q.x1) / 2) < 9);
  // A TREE IS A BILLBOARD, so its bounding box swings with the camera and its
  // WIDTH is the whole canopy, not a trunk. Reading it as "a thin upright" found
  // nothing at all — and "0 pits, worst offset 0.000, HOLDS" is a check passing
  // because it found nothing, which is GOTCHAS 34 and the exact failure this
  // whole re-evidencing round exists to catch. So take the sprite's own
  // POSITION, which is fixed however it spins, and find it by being a tall
  // board standing on the walk rather than by its box.
  const trunks = all.filter((q) => (q.y1 - q.y0) > 1.5 && q.y0 < 0.35
    && Math.abs(q.x0 - q.x1) + Math.abs(q.z0 - q.z1) > 0.4
    && Math.abs((q.x0 + q.x1) / 2) > 4 && Math.abs((q.x0 + q.x1) / 2) < 9)
    .map((q) => { const e = q.n.matrixWorld.elements; return { ...q, wx: e[12], wz: e[14] }; });
  // DEDUPE: a pit is drawn as a dirt square AND a stone frame, within a
  // centimetre of each other, and my first pass counted both — then paired each
  // with "the nearest trunk", which for a pit with no tree in it is a tree
  // eight metres away. Offsets of 6.8 m are that, not a leaning tree.
  const uniq = [];
  for (const q of pits) {
    const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    if (uniq.some((u) => Math.hypot((u.x0 + u.x1) / 2 - cx, (u.z0 + u.z1) / 2 - cz) < 0.3)) continue;
    uniq.push(q);
  }
  out.pits = uniq.map((q) => {
    const px = (q.x0 + q.x1) / 2, pz = (q.z0 + q.z1) / 2;
    let best = null, bd = 9;
    for (const t of trunks) {
      const tx = t.wx, tz = t.wz;
      // THE TRUNK MUST STAND IN THIS PIT, not merely be the closest one in the
      // world. A pit with no tree reports nothing rather than borrowing one.
      if (tx < q.x0 - 0.15 || tx > q.x1 + 0.15 || tz < q.z0 - 0.15 || tz > q.z1 + 0.15) continue;
      const d = Math.hypot(tx - px, tz - pz);
      if (d < bd) { bd = d; best = { tx, tz, w: t.x1 - t.x0 }; }
    }
    if (!best) return null;
    // clearance from the trunk to each edge of its own dirt square
    return { pit: [+px.toFixed(3), +pz.toFixed(3)], size: [+(q.x1 - q.x0).toFixed(3), +(q.z1 - q.z0).toFixed(3)],
             trunk: [+best.tx.toFixed(3), +best.tz.toFixed(3)],
             offX: +(best.tx - px).toFixed(3), offZ: +(best.tz - pz).toFixed(3),
             kerbSide: +(px > 0 ? (q.x0 - 0) : (0 - q.x1)).toFixed(3) };
  }).filter(Boolean);
  return out;
});

const A = r.ad;
console.log('\n════ THE BUS BENCH — three rows rest on this object ════');
if (!A) { console.log('  NOT FOUND — the ad carries userData.benchAd; if that is gone, so is the row.'); }
else {
  console.log(`  found by its own userData.benchAd = ${JSON.stringify(A.label)}, at ${JSON.stringify(A.at)}`);
  console.log(`  seat top y ${A.seatY}   ${A.nSlats} seat slats   ${A.nLegs} legs`);

  console.log('\n  ROW 1a — "we dont need the bottom wood part"');
  console.log(`     PREDICATE: no solid wider than 0.35 m between the ground and the seat, legs excepted.`);
  console.log(`     solids found under the seat: ${A.underSeat.length}` +
    (A.underSeat.length ? `   ${JSON.stringify(A.underSeat)}` : '   HOLDS — you can see under the bench'));

  console.log('\n  ROW 1b — "the tonys pizza part needs a bezel"');
  console.log(`     PREDICATE: >= 4 thin bars in the ad's own group, framing it.`);
  console.log(`     bars in the ad group: ${A.nBezel}   ${A.nBezel >= 4 ? 'HOLDS' : '<-- NO BEZEL'}`);

  console.log('\n  ROW 2a — "the sign should go on the BACK of the bench"');
  const onBack = A.seatY !== null && A.adBox.y[0] > A.seatY - 0.05;
  console.log(`     PREDICATE: the ad's lowest point is at or above the seat top (${A.seatY}).`);
  console.log(`     ad spans y ${JSON.stringify(A.adBox.y)}   ${onBack ? 'HOLDS — it is on the backrest' : '<-- IT IS BELOW THE SEAT'}`);

  console.log('\n  ROW 2b — "the bench back should lean back a lil"');
  const rot = A.groupRot;
  const lean = rot ? Math.max(Math.abs(rot[0]), Math.abs(rot[2])) : 0;
  console.log(`     PREDICATE: the backrest group is tilted 8-20 degrees off vertical.`);
  console.log(`     group rotation ${JSON.stringify(rot)} -> ${(lean * 180 / Math.PI).toFixed(1)} deg` +
    (lean * 180 / Math.PI >= 8 && lean * 180 / Math.PI <= 20 ? '   HOLDS' : '   <-- OUT OF RANGE'));

  console.log('\n  ROW 3a — "should not be cutting off the actual ad"');
  console.log(`     PREDICATE: the ad face sits INSIDE the bezel opening on all four sides.`);
  if (A.nBezel >= 4) {
    const zs = A.bezelBoxes.flatMap((q) => q.z), ys = A.bezelBoxes.flatMap((q) => q.y);
    const inZ = A.adBox.z[0] >= Math.min(...zs) - 1e-6 && A.adBox.z[1] <= Math.max(...zs) + 1e-6;
    const inY = A.adBox.y[0] >= Math.min(...ys) - 1e-6 && A.adBox.y[1] <= Math.max(...ys) + 1e-6;
    console.log(`     ad z ${JSON.stringify(A.adBox.z)} inside bezel z [${Math.min(...zs)}, ${Math.max(...zs)}] -> ${inZ}`);
    console.log(`     ad y ${JSON.stringify(A.adBox.y)} inside bezel y [${Math.min(...ys)}, ${Math.max(...ys)}] -> ${inY}`);
  }

  console.log('\n  ROW 3b — "strange graphical bug on the legs, same plane as the wood"');
  console.log(`     PREDICATE: no leg shares a z-plane with a seat slat (GOTCHAS 6, abut never overlap).`);
  let worst = 9, pair = null;
  for (const L of A.legBoxes) for (const S of A.slatBoxes) {
    for (const a of L.z) for (const c of S.z) {
      if (Math.abs(a - c) < worst) { worst = Math.abs(a - c); pair = [a, c]; }
    }
  }
  console.log(`     closest leg face to a slat face, in z: ${worst.toFixed(4)} m at ${JSON.stringify(pair)}` +
    (worst > 0.004 ? '   HOLDS — no coplanar pair' : '   <-- COPLANAR'));
}

console.log('\n════ ROW 4 — tree pit: trunk off-centre toward the kerb ════');
console.log(`  PREDICATE: |trunk - pit centre| under 0.05 m on both axes, every pit.`);
// THE ROW IS ABOUT THE STREET TREE PITS, which ct/props.ts builds at a single
// size. Anything else that matches the shape — a lot planter, a park bed — is a
// different object with a different owner, so it is reported separately rather
// than either folded into the verdict or quietly dropped.
const STREET = (q) => Math.abs(q.size[0] - 0.56) < 0.06 && Math.abs(q.size[1] - 1.40) < 0.10;
const mine = r.pits.filter(STREET), other = r.pits.filter((q) => !STREET(q));
let worstOff = 0;
for (const q of mine) {
  const off = Math.max(Math.abs(q.offX), Math.abs(q.offZ));
  worstOff = Math.max(worstOff, off);
  console.log(`  pit ${JSON.stringify(q.pit)} ${JSON.stringify(q.size)}  trunk off centre  x ${q.offX}  z ${q.offZ}`);
}
for (const q of other) console.log(`  (not a street pit: ${JSON.stringify(q.pit)} ${JSON.stringify(q.size)}` +
  `  off centre x ${q.offX} z ${q.offZ} — different object, different owner)`);
console.log(`  ${mine.length} STREET tree pits with a tree in them, worst offset ${worstOff.toFixed(3)} m`);
console.log(mine.length === 0
  ? '  CANNOT ANSWER — no pit/tree pair found. A check that passes by finding\n' +
    '  nothing is GOTCHAS 34, and this row is on the list precisely because\n' +
    '  nothing was watching it. Fix the finder before believing either answer.'
  : (worstOff < 0.05 ? '  HOLDS' : '  <-- OFF CENTRE'));

// ── and stand where a verifier should ─────────────────────────────────────
if (A) {
  // FACE IT. The bench stands on the EAST walk facing the road, so a verifier
  // stands WEST of it looking east — yaw +PI/2, because forward is
  // (sin yaw, -cos yaw). My first three stations were all east of it looking
  // away, and the frames showed the far shopfronts with the bench in a corner.
  for (const [name, dx, dz, yaw, pitch] of [
    ['bench-front', -1.9, 0, Math.PI / 2, -0.06],
    ['bench-low', -1.5, -1.1, Math.PI / 2.4, -0.20],
    ['bench-under', -1.2, 0, Math.PI / 2, -0.34],
  ]) {
    await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0.14, P),
      [A.at[0] + dx, A.at[2] + dz, yaw, pitch]);
    const lum = await settle(p);
    const f = `shots/re-${name}.png`;
    await p.screenshot({ path: f });
    console.log(`  ${f.padEnd(26)} mean ${lum.toFixed(4)}`);
  }
}
if (r.pits.length) {
  const q = r.pits[0];
  await p.evaluate(([X, Z]) => window.__ct.warp(X, Z, Math.PI, 0.14, -0.35), [q.pit[0] - 1.4, q.pit[1] - 1.6]);
  const lum = await settle(p);
  await p.screenshot({ path: 'shots/re-pit.png' });
  console.log(`  shots/re-pit.png             mean ${lum.toFixed(4)}`);
}
await b.close();

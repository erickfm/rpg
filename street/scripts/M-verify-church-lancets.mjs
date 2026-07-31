// VERIFIER (M) — E's LANDED row: "pillars of the church seem not fully thought
// out. they block the windows i thin[k]".
//
// I did not build this and I am not E. E's evidence is unusually complete: it
// gives the pier positions, the three stages, the bay widths at lancet height, a
// station, and a positive control. So re-measuring alone would add little.
//
// WHAT A VERIFIER ADDS HERE IS THE USER'S ACTUAL QUESTION, ASKED GEOMETRICALLY.
// "They block the windows" is a LINE-OF-SIGHT claim, and E settled it with a
// screenshot from the far pavement — which is the right thing to look at and
// cannot be a proof in this world, where two runs differ in 20% of pixels
// (GOTCHAS 1). This casts the ray instead: from the player's eye on the far
// pavement to a spread of points across each lancet, against the world-space
// boxes of every mesh standing in front of the facade. A pier either intervenes
// or it does not, and that is a number.
//
// It re-measures the geometry too, from `matrixWorld` and NOT from E's constants,
// because a verifier quoting the builder's numbers back has verified nothing.
//
// AND IT CARRIES ITS OWN POSITIVE CONTROL rather than only running E's, with the
// trap E documented: these piers hang off a ROTATED GROUP, so `position.z` is
// local and nudging it moves the mesh somewhere else entirely — E's first control
// "did not move the mesh at all and everything came back green off an unmutated
// world". So the nudge is applied in WORLD space through the parent's inverse,
// and it refuses to run unless the world position actually changed.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/flags.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('usage: SHOT_URL=http://localhost:<your own preview>/ node scripts/M-verify-church-lancets.mjs [--selftest]');
  process.exit(2);
}
const SELFTEST = flags(['--selftest']).selftest;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(900);

const results = [];
const say = (ok, name, detail) => results.push([ok, name, detail]);
const f2 = (n) => +n.toFixed(2);

// ── the selftest mutation, FIRST, so every claim below is measured on it ────
if (SELFTEST) {
  const moved = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    // the four base stages: the widest, shortest tier of each pier
    const cands = [];
    s.traverse((o) => {
      if (!o.isMesh || !o.geometry || (o.userData.mod || '') !== 'civic') return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld);
      const d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;
      if (bb.max.x < 5 || bb.min.x > 12) return;
      if (d > 0.85 && d < 1.0 && h > 5 && h < 8) cands.push({ o, z: (bb.min.z + bb.max.z) / 2 });
    });
    cands.sort((a, b2) => a.z - b2.z);
    if (cands.length < 4) return { ok: false, why: `found ${cands.length} base stages, need 4` };
    // MOVE THE WHOLE PIER, all three stages, 0.6 m into its bay — in WORLD space.
    const target = cands[1].z;                          // the second pier from -z
    const before = [], after = [];
    s.traverse((o) => {
      if (!o.isMesh || !o.geometry || (o.userData.mod || '') !== 'civic') return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld);
      if (bb.max.x < 5 || bb.min.x > 12) return;
      const zc = (bb.min.z + bb.max.z) / 2;
      if (Math.abs(zc - target) > 0.5) return;           // not this pier
      // world -> nudge -> back through the PARENT's inverse. `position.z` is
      // LOCAL and this group is rotated, which is the trap E hit: setting it
      // moves the mesh along a different world axis, or not at all.
      const wp = o.getWorldPosition(o.position.clone());
      before.push(+wp.z.toFixed(3));
      wp.z += 0.6;
      o.position.copy(o.parent.worldToLocal(wp));
      o.updateMatrixWorld(true);
      after.push(+o.getWorldPosition(o.position.clone()).z.toFixed(3));
    });
    return { ok: true, before, after,
      shifted: before.length && before.every((z, i) => Math.abs(after[i] - z - 0.6) < 0.02) };
  });
  if (!moved.ok || !moved.shifted) {
    console.error(`selftest ABORT: the nudge did not move the pier in world space `
      + `(${moved.why ?? `before ${moved.before} -> after ${moved.after}`}).`);
    console.error('  A mutation that does not move anything looks exactly like a check that works.');
    await b.close(); process.exit(3);
  }
  console.log(`selftest: slid one pier's ${moved.before.length} stages +0.6 m in WORLD z `
    + `(${moved.before.join(', ')} -> ${moved.after.join(', ')}) — the clearance and `
    + 'visibility claims MUST now go red\n');
}

// ── the geometry, measured from matrixWorld ─────────────────────────────────
const G = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || (o.userData.mod || '') !== 'civic') return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld);
    if (bb.max.x < 5 || bb.min.x > 12) return;
    boxes.push({ minX: bb.min.x, maxX: bb.max.x, minY: bb.min.y, maxY: bb.max.y,
      minZ: bb.min.z, maxZ: bb.max.z, flat: (bb.max.x - bb.min.x) < 0.02 });
  });
  return boxes;
});
// A PIER STAGE is a tall, thin-in-x, ~0.6-0.95 m deep box standing proud of the
// facade. Found by shape, not by a z I typed.
const stages = G.filter((x) => !x.flat && x.maxY - x.minY > 5
  && x.maxZ - x.minZ > 0.5 && x.maxZ - x.minZ < 1.0 && x.maxX - x.minX < 0.4);
say(stages.length === 12, 'the front carries four piers of three stages each',
  `${stages.length} pier stages found (4 x 3 expected)`);
if (!stages.length) {
  console.error('ABORT: no pier stages — nothing below measures the church');
  await b.close(); process.exit(3);
}

// group them into piers by z centre
const piers = [];
for (const st of stages.slice().sort((a, c) => (a.minZ + a.maxZ) - (c.minZ + c.maxZ))) {
  const zc = (st.minZ + st.maxZ) / 2;
  const near = piers.find((q) => Math.abs(q.zc - zc) < 0.6);
  if (near) { near.stages.push(st); near.zc = (near.zc + zc) / 2; } else piers.push({ zc, stages: [st] });
}
say(piers.length === 4, 'and they group into exactly four piers',
  piers.map((q) => f2(q.zc)).join(' / '));

// ── THE LANCET HEIGHT IS THE WHOLE POINT ──────────────────────────────────
//
// E's own insight, and it is the thing that makes the user's complaint testable:
// each pier is STEPPED, so the width that matters is the width AT THE WINDOW.
// Testing the 0.92 m base against a window nine metres above it measures a
// clearance that does not exist.
const LANCET_LO = 9.2, LANCET_HI = 13.4, LANCET_MID = (LANCET_LO + LANCET_HI) / 2;
const widthAt = (pier, y) => {
  const live = pier.stages.filter((st) => st.minY <= y && st.maxY >= y);
  if (!live.length) return null;
  return { minZ: Math.min(...live.map((st) => st.minZ)), maxZ: Math.max(...live.map((st) => st.maxZ)) };
};
const atMid = piers.map((q) => widthAt(q, LANCET_MID));
say(atMid.every(Boolean), `every pier is present at the lancets' mid height (${LANCET_MID} m)`,
  atMid.map((w, i) => w ? `${f2(w.maxZ - w.minZ)} m` : `pier ${i} ABSENT`).join(' · '));
const bays = [];
for (let i = 0; i + 1 < atMid.length; i++) {
  if (!atMid[i] || !atMid[i + 1]) continue;
  bays.push({ lo: atMid[i].maxZ, hi: atMid[i + 1].minZ, w: atMid[i + 1].minZ - atMid[i].maxZ });
}
say(bays.length === 3, 'three bays between the four piers',
  bays.map((y) => `${f2(y.w)} m`).join(' / '));
if (bays.length === 3) {
  say(Math.abs(bays[0].w - bays[2].w) < 0.05, 'the two side bays are the same width',
    `${f2(bays[0].w)} m and ${f2(bays[2].w)} m`);
  say(bays[1].w > bays[0].w && bays[1].w > bays[2].w,
    'and the CENTRE bay is the widest, which is where the doorway is',
    `centre ${f2(bays[1].w)} m against sides ${f2(bays[0].w)} / ${f2(bays[2].w)} m`);
  const LANCET_W = 1.30;
  const tight = bays.filter((y) => y.w < LANCET_W + 0.1);
  say(tight.length === 0, `every bay clears a ${LANCET_W} m lancet with room each side`,
    bays.map((y) => `${f2((y.w - LANCET_W) / 2)} m each side`).join(' · '));
}

// ── AND THE USER'S ACTUAL QUESTION: CAN YOU SEE THE WINDOW? ────────────────
//
// E's station, verbatim — the FAR pavement at (-5.4, -79.5) — and E is right that
// it is the only one that works: their first stations stood 3.5 m from a wall
// whose windows start 9.2 m up, "you cannot see a lancet from there".
//
// Rays from a standing eye to a spread of points across each side-bay lancet,
// tested against the world boxes of everything standing in front of the facade.
// A slab test, so it answers with WHICH box blocks and at what distance rather
// than with a picture.
{
  const EYE = { x: -5.4, y: 1.62, z: -79.5 };
  const hit = (o, d, box) => {                       // ray/AABB slabs
    let t0 = 0, t1 = Infinity;
    for (const ax of ['x', 'y', 'z']) {
      const lo = box[`min${ax.toUpperCase()}`], hi = box[`max${ax.toUpperCase()}`];
      if (Math.abs(d[ax]) < 1e-9) { if (o[ax] < lo || o[ax] > hi) return null; continue; }
      let a = (lo - o[ax]) / d[ax], c = (hi - o[ax]) / d[ax];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) return null;
    }
    return t0;
  };
  const blockers = G.filter((x) => !x.flat);          // the facade plane is not a blocker
  const report = [];
  for (const [name, bay] of [['north side bay', bays[0]], ['south side bay', bays[2]]]) {
    if (!bay) continue;
    const zc = (bay.lo + bay.hi) / 2;
    let clear = 0, total = 0;
    for (const fz of [-0.45, -0.2, 0, 0.2, 0.45]) {   // across a 1.30 m lancet
      for (const y of [LANCET_LO + 0.8, LANCET_MID, LANCET_HI - 0.8]) {
        total++;
        const tgt = { x: 9.55, y, z: zc + fz };       // the facade plane
        const d = { x: tgt.x - EYE.x, y: tgt.y - EYE.y, z: tgt.z - EYE.z };
        const len = Math.hypot(d.x, d.y, d.z);
        for (const k of ['x', 'y', 'z']) d[k] /= len;
        const t = blockers.map((bx) => hit(EYE, d, bx)).filter((v) => v !== null && v < len - 0.05);
        if (!t.length) clear++;
      }
    }
    report.push([name, clear, total, f2(zc)]);
  }
  for (const [name, clear, total, zc] of report) {
    say(clear === total, `nothing blocks the ${name}'s lancet from the far pavement`,
      `${clear} of ${total} sight lines clear, lancet centred at z ${zc}`);
  }
  say(report.length === 2, 'both side bays were tested, not one',
    `${report.length} bays sampled at 15 points each`);
}

say(errs.length === 0, 'no page errors', errs.length ? errs.slice(0, 3).join(' | ') : 'clean');

await b.close();
let bad = 0;
for (const [ok, name, detail] of results) {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}\n        ${detail}`);
}
console.log(`\n${results.length - bad} of ${results.length} passed`);
if (SELFTEST) {
  if (bad > 0) { console.log('selftest CAUGHT the mutation'); process.exit(0); }
  console.log('selftest NOT CAUGHT — this check is decoration'); process.exit(2);
}
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// ITEM 252 — DO THE ROAD WHEELS TOUCH THE ROAD, AND HOW MUCH CLIMB IS LEFT?
//
// The row: *"EVERY car tyre floats 16.6 mm — a decagon stands on its FLAT, not
// its vertex."* True, and w98-wheels.mjs proved it. This probe is the one that
// has to stay honest AFTER the fix, so it measures the two numbers that move
// together and that the row says must be worked out together:
//
//   BOTTOM GAP   lowest point of the tyre  −  groundAt underneath it
//   TOP / MARGIN highest point of the tyre − the 0.14 m pavement it is the
//                first step up from (the car-roof climb route, w21/w29)
//
// WHY BOTH. Seating a wheel by dropping it spends the climb margin 1:1; seating
// it by turning the polygon so a VERTEX is down (which is what the trailer
// already does, gap 0.0000) buys the margin instead. A probe that only printed
// the gap would call both fixes identical.
//
// ── THREE WAYS THIS PROBE COULD LIE, AND WHAT STOPS EACH ────────────────────
//
// 1. MEASURING NOTHING. `w98`'s first cut ranked every cylinder in the world and
//    led with a ceiling fixture 9.3 m up. So: a POPULATION FLOOR per geometry —
//    if a kind of wheel that should exist is absent, this exits 3, not 0.
// 2. ONE-SIDED. It reports FLOATS and SINKS and fails on either. A wheel driven
//    into the tarmac is as wrong as one hovering over it.
// 3. UNFAILABLE. `--selftest` lifts every wheel 25 mm in the live scene and
//    re-measures; the run is only trusted if the check goes RED there and GREEN
//    again after the lift is undone.
//
// THE JACKED CAR IS DELIBERATE (ct/cars.ts, "a car on a jack TILTS") and is
// reported on its own line, never folded into the fleet spread.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-tyre-seating.mjs
//   SHOT_URL=...                      node scripts/probes/w99-tyre-seating.mjs --selftest
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }
const SELFTEST = process.argv.includes('--selftest');

// The pavement the tyre is the first step up from. Not retyped for fun: it is
// what `groundAt` returns over the kerb, and every gap below is measured
// against `groundAt` under that particular wheel, so this is only used for the
// CLIMB line and is re-read from the world rather than assumed.
const TOL = 0.004;                       // 4 mm: below this a gap is contact

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const measure = async (lift) => p.evaluate((liftBy) => {
  const scene = window.__ct.scene();
  // A ROAD WHEEL, declared rather than guessed: the car tyre and the bus tyre
  // are the two cylinders in this file that are supposed to touch tarmac.
  // Trailer wheels (r 0.22, 12-gon) live in crosstown.ts and are item 253's.
  const KINDS = [
    { name: 'car tyre', r: 0.34, seg: 10, h: 0.24, floor: 60 },
    { name: 'bus tyre', r: 0.44, seg: 10, h: 0.28, floor: 4 },
    { name: 'trailer',  r: 0.22, seg: 12, h: 0.14, floor: 2 },
  ];
  const near = (a, c) => Math.abs(a - c) < 1e-6;

  const found = [];
  scene.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const q = n.geometry.parameters || {};
    if (n.geometry.type !== 'CylinderGeometry') return;
    const k = KINDS.find((K) => near(q.radiusTop, K.r) && q.radialSegments === K.seg
      && near(q.height, K.h));
    if (!k) return;
    found.push({ mesh: n, kind: k.name });
  });

  if (liftBy) for (const f of found) f.mesh.position.y += liftBy;
  scene.updateMatrixWorld(true);

  const rows = [];
  for (const f of found) {
    const g = f.mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    f.mesh.updateWorldMatrix(true, false);
    const m = f.mesh.matrixWorld.elements;
    let lo = Infinity, hi = -Infinity, xs = 0, zs = 0, nc = 0;
    let zlo = Infinity, zhi = -Infinity;
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      const x = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
      const y = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
      const z = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
      lo = Math.min(lo, y); hi = Math.max(hi, y);
      zlo = Math.min(zlo, z); zhi = Math.max(zhi, z);
      xs += x; zs += z; nc++;
    }
    const cx = xs / nc, cz = zs / nc;
    const ground = window.__ct.groundAt(cx, cz) ?? 0;
    rows.push({
      kind: f.kind, cx: +cx.toFixed(2), cz: +cz.toFixed(2),
      low: +lo.toFixed(4), top: +hi.toFixed(4), ground: +ground.toFixed(4),
      gap: +(lo - ground).toFixed(4), overGround: +(hi - ground).toFixed(4),
      zExtent: +(zhi - zlo).toFixed(4),
    });
  }

  if (liftBy) { for (const f of found) f.mesh.position.y -= liftBy; scene.updateMatrixWorld(true); }
  return { rows, floors: KINDS.map((K) => ({ name: K.name, floor: K.floor })) };
}, lift);

const report = (label, data) => {
  console.log(`\n─── ${label} ─────────────────────────────────────────`);
  let bad = 0, short = 0;
  for (const { name, floor } of data.floors) {
    const rs = data.rows.filter((r) => r.kind === name);
    if (rs.length < floor) {
      console.log(`  ${name.padEnd(9)} POPULATION FLOOR MISS: ${rs.length} < ${floor} — measuring nothing`);
      short++; continue;
    }
    // the jacked car: reported separately, never folded into the spread
    const gaps = rs.map((r) => r.gap).sort((a, z) => a - z);
    const jack = rs.filter((r) => r.gap > gaps[Math.floor(gaps.length / 2)] + 0.05);
    const fleet = rs.filter((r) => !jack.includes(r));
    const fg = fleet.map((r) => r.gap);
    const lo = Math.min(...fg), hi = Math.max(...fg);
    const tops = fleet.map((r) => r.overGround);
    const worst = fleet.filter((r) => Math.abs(r.gap) > TOL);
    console.log(`  ${name.padEnd(9)} n=${String(fleet.length).padStart(3)}  `
      + `gap ${lo >= 0 ? '+' : ''}${lo.toFixed(4)}..${hi >= 0 ? '+' : ''}${hi.toFixed(4)}  `
      + `top-over-ground ${Math.min(...tops).toFixed(4)}..${Math.max(...tops).toFixed(4)}  `
      + `z-extent ${fleet[0].zExtent.toFixed(4)}  `
      + (worst.length === 0 ? 'ALL CONTACT'
        : `${worst.length} ${worst[0].gap > 0 ? 'FLOAT' : 'SINK'}`));
    if (worst.length) {
      bad += worst.length;
      for (const r of worst.slice(0, 3)) {
        console.log(`      (${r.cx}, ${r.cz})  low ${r.low.toFixed(4)} ground ${r.ground.toFixed(4)}  `
          + `gap ${r.gap > 0 ? '+' : ''}${r.gap.toFixed(4)} ${r.gap > 0 ? 'FLOATS' : 'SINKS'}`);
      }
    }
    for (const j of jack) {
      console.log(`      DELIBERATE (jacked corner) (${j.cx}, ${j.cz}) gap +${j.gap.toFixed(4)} — not counted`);
    }
  }
  return { bad, short };
};

const base = await measure(0);
const r0 = report('AS BUILT', base);

// The car tyre is the first step of the car-roof climb. State the margin.
const carTops = base.rows.filter((r) => r.kind === 'car tyre').map((r) => r.overGround);
if (carTops.length) {
  const t = Math.min(...carTops);
  console.log(`\n  CLIMB: car tyre top stands ${t.toFixed(4)} m over the ground beneath it.`);
  console.log(`         against a guaranteed standing reach of 0.551 → margin ${(t - 0.551).toFixed(4)} m`);
}

let selfOk = true;
if (SELFTEST) {
  console.log('\n═══ SELF-TEST — the check must go RED when the world is wrong ═══');
  const up = await measure(0.025);
  const rUp = report('EVERY WHEEL LIFTED +25 mm', up);
  const down = await measure(-0.025);
  const rDn = report('EVERY WHEEL DROPPED −25 mm', down);
  const after = report('LIFT UNDONE (must match AS BUILT)', await measure(0));
  selfOk = rUp.bad > 0 && rDn.bad > 0 && after.bad === r0.bad;
  console.log(`\n  lifted → ${rUp.bad} bad (want >0) · dropped → ${rDn.bad} bad (want >0) · `
    + `restored → ${after.bad} bad (want ${r0.bad})   ${selfOk ? 'SELF-TEST PASSES' : 'SELF-TEST FAILED — do not trust this run'}`);
}

await b.close();
if (r0.short) { console.log('\nEXIT 3 — a population floor was missed; nothing was measured.'); process.exit(3); }
if (!selfOk) { console.log('\nEXIT 3 — the check could not be made to fail; it proves nothing.'); process.exit(3); }
console.log(`\n${r0.bad === 0 ? 'PASS' : 'FAIL'} — ${r0.bad} road wheel(s) not in contact with the ground.`);
process.exit(r0.bad === 0 ? 0 : 1);

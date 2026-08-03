#!/usr/bin/env node
// ONE VEHICLE OF EVERY KIND, PARKED AND MOVING. Item 252's acceptance line.
//
// w99-tyre-seating measures whatever happens to be standing in the world when
// the page settles. Two things it cannot answer on its own:
//
//   EVERY KIND   the street's draw is seeded, so a kind can simply be absent
//                from the sample. `__ct.carVariant` builds one of each through
//                the same makeCar the street uses, so nothing can be missed.
//   MOVING       a traffic vehicle's wheels are children of a group that is
//                re-positioned every frame. A fix that only holds at t=0 is not
//                a fix. So the live scene is re-measured after the world has
//                been running, and the vehicles that MOVED between samples are
//                reported separately from the parked ones.
//
// The bus is included deliberately: it is built in the same file, it floated
// for the same reason (21.5 mm, r 0.44), and the earlier diagnosis missed it
// because its probe filtered wheels to r 0.34 and r 0.22.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-tyre-kinds.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }
const TOL = 0.004;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

let bad = 0;

// ── 1. every KIND, freshly built ───────────────────────────────────────────
console.log('freshly built, one of each kind — the wheel\'s lowest point in car-local y:');
console.log('(the caller seats the car with its origin ON the ground, so this IS the gap)');
const kinds = await p.evaluate(() => {
  const out = [];
  for (const k of ['sedan', 'hatch', 'pickup', 'van']) {
    const g = window.__ct.carVariant(k, {}, 400, 400, 0);
    g.updateMatrixWorld(true);
    let lo = Infinity, hi = -Infinity, n = 0, r = 0, segs = 0;
    for (const c of g.children) {
      if (!c.geometry || c.geometry.type !== 'CylinderGeometry') continue;
      const q = c.geometry.parameters;
      if (Math.abs(q.radiusTop - 0.34) > 1e-9) continue;
      c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox.clone().applyMatrix4(c.matrix);
      lo = Math.min(lo, bb.min.y); hi = Math.max(hi, bb.max.y); n++;
      r = q.radiusTop; segs = q.radialSegments;
    }
    g.parent.remove(g);
    out.push({ kind: k, n, low: +lo.toFixed(4), top: +hi.toFixed(4), r, segs });
  }
  return out;
});
for (const k of kinds) {
  if (k.n < 4) { console.log(`  ${k.kind.padEnd(7)} POPULATION FLOOR MISS: ${k.n} wheels < 4`); bad++; continue; }
  // pinned against the geometry's OWN parameters, not a typed 0.68 — a vertex-
  // phased N-gon reaches exactly r above and below its hub.
  const want = 2 * k.r;
  const okLo = Math.abs(k.low) <= TOL, okTop = Math.abs(k.top - want) <= TOL;
  if (!okLo || !okTop) bad++;
  console.log(`  ${k.kind.padEnd(7)} ${k.n} wheels  low ${k.low >= 0 ? '+' : ''}${k.low.toFixed(4)} `
    + `(want 0.0000)  top ${k.top.toFixed(4)} (want 2r = ${want.toFixed(4)})  `
    + `${okLo && okTop ? 'ok' : 'WRONG'}`);
}

// ── 2. the bus, and the world's moving vehicles ────────────────────────────
const sample = () => p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'CylinderGeometry') return;
    const q = o.geometry.parameters || {};
    const isCar = Math.abs(q.radiusTop - 0.34) < 1e-6 && q.radialSegments === 10;
    const isBus = Math.abs(q.radiusTop - 0.44) < 1e-6 && q.radialSegments === 10 && Math.abs(q.height - 0.28) < 1e-6;
    if (!isCar && !isBus) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    out.push({
      what: isBus ? 'bus' : 'car', cx: +cx.toFixed(3), cz: +cz.toFixed(3),
      gap: +(bb.min.y - (window.__ct.groundAt(cx, cz) ?? 0)).toFixed(4),
    });
  });
  return out;
});

const s1 = await sample();
await p.waitForTimeout(4000);          // let traffic drive
const s2 = await sample();

// A wheel that MOVED between the two samples is on a driving vehicle.
const key = (w) => `${w.what}`;
const moved = [], parked = [];
const s1set = new Set(s1.map((w) => `${w.cx},${w.cz}`));
for (const w of s2) (s1set.has(`${w.cx},${w.cz}`) ? parked : moved).push(w);

const verdict = (label, rows) => {
  if (rows.length === 0) { console.log(`  ${label.padEnd(22)} none in this sample`); return 0; }
  const g = rows.map((r) => r.gap);
  const off = rows.filter((r) => Math.abs(r.gap) > TOL);
  const kindsSeen = [...new Set(rows.map(key))].join('+');
  console.log(`  ${label.padEnd(22)} n=${String(rows.length).padStart(3)} (${kindsSeen})  `
    + `gap ${Math.min(...g).toFixed(4)}..${Math.max(...g).toFixed(4)}  `
    + `${off.length === 0 ? 'ALL CONTACT' : `${off.length} OFF THE GROUND`}`);
  for (const r of off.slice(0, 4)) console.log(`      ${r.what} (${r.cx}, ${r.cz}) gap ${r.gap > 0 ? '+' : ''}${r.gap}`);
  return off.length;
};

console.log('\nthe live world, sampled 4 s apart:');
// the jacked corner is a single wheel deliberately in the air; excluded by name
// of its number, not by position, and reported so it cannot hide a real fault.
const jacked = parked.filter((w) => w.gap > 0.05);
bad += verdict('PARKED', parked.filter((w) => !jacked.includes(w)));
bad += verdict('MOVING (drove 4 s)', moved.filter((w) => w.gap <= 0.05));
for (const j of jacked) console.log(`      DELIBERATE (jacked corner) (${j.cx}, ${j.cz}) gap +${j.gap} — not counted`);
if (moved.length === 0) console.log('  NOTE: nothing moved in 4 s — the MOVING row proves nothing this run.');

await b.close();
if (errs.length) { console.log(`\nconsole errors: ${errs.length}`); for (const e of errs.slice(0, 5)) console.log(`  ${e}`); }
console.log(`\n${bad === 0 && errs.length === 0 ? 'PASS' : 'FAIL'} — ${bad} wheel(s) off the ground, ${errs.length} console error(s).`);
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);

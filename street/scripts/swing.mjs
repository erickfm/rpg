// THE LANDING WALK, as geometry: drive both hung doors through their whole
// arc and ask what the leaf passes through on the way.
//
// The desk's ask was "open every door on the landing and confirm it swings the
// way its hinges say, and that it does not sweep through the wall, the frame or
// a neighbouring door". A screenshot of a door at rest cannot answer that — the
// sweep is the thing, and the interesting angles are the ones in between. So
// this steps the leaf and tests the leaf's own surface against the world's
// colliders at every step.
//
// Only 301 and 302 are hung; the other six doors are flat panels in a recess
// and have no arc to check.
//
// NOTE FOR ANYONE COPYING FROM ANOTHER SCRIPT IN HERE: there is no `THREE` on
// `window`. `scripts/bunting.mjs` appears to use `window.THREE_V` but the
// helper it defines is never called, so it has never been exercised. Do the
// matrix maths by hand, as below.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 900));

const R = await p.evaluate(() => {
  const s = window.__ct.scene();
  // column-major 4x4 applied to a point, by hand
  const xf = (e, x, y, z) => [
    e[0] * x + e[4] * y + e[8] * z + e[12],
    e[1] * x + e[5] * y + e[9] * z + e[13],
    e[2] * x + e[6] * y + e[10] * z + e[14]];
  // world AABB of an object, from its descendants' box geometry corners
  const aabb = (o) => {
    o.updateMatrixWorld(true);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    o.traverse((m) => {
      const g = m.geometry?.parameters;
      if (!m.isMesh || !g) return;
      const w = (g.width ?? 0) / 2, h = (g.height ?? 0) / 2, d = (g.depth ?? 0) / 2;
      const e = m.matrixWorld.elements;
      for (const sx of [-w, w]) for (const sy of [-h, h]) for (const sz of [-d, d]) {
        const q = xf(e, sx, sy, sz);
        for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; }
      }
    });
    return { lo, hi };
  };

  // the module publishes its own travel; a harness that guesses it swept 76deg
  // of a 166deg arc, in the wrong direction, and reported "ok".
  const travel = s.userData.doorTravel;
  if (!travel) return { noTravel: true, doors: [], hits: [], missing: [] };
  const out = { doors: [], hits: [], missing: [], travel };
  // A door's OWN cap is a collider that comes and goes with the swing, and a
  // leaf is trivially inside its own cap. Both doorways are excluded by their
  // z span rather than by name.
  const cols = window.__ct.colliders().filter((c) => c.minX > 150);

  for (const nm of ['leaf301', 'leaf302']) {
    const o = s.getObjectByName(nm);
    if (!o) { out.missing.push(nm); continue; }
    const start = o.rotation.y;
    o.rotation.y = start;
    const rest = aabb(o);
    // how far the leaf reaches from its pivot, measured not restated
    const piv = xf(o.matrixWorld.elements, 0, 0, 0);
    const span = Math.max(
      Math.hypot(rest.hi[0] - piv[0], rest.hi[2] - piv[2]),
      Math.hypot(rest.lo[0] - piv[0], rest.lo[2] - piv[2]));
    // the cap that closes THIS doorway — found by which collider the shut leaf
    // sits inside, so it is excluded on its own merits
    const mine = cols.filter((c) => piv[0] > c.minX - 0.35 && piv[0] < c.maxX + 0.35
      && piv[2] > c.minZ - 0.35 && piv[2] < c.maxZ + 0.35);
    const test = cols.filter((c) => !mine.includes(c));
    const t = travel[nm];
    if (!t) { out.missing.push(nm + ' (no published travel)'); continue; }
    const arc = t.open - t.shut;                       // signed, and it is 166deg for 301

    for (let i = -7; i <= 55; i++) {
      // -7..55 of 48 walks the REAL travel shut->open and 15% past each end, so
      // the stops are shown to be doing work rather than assumed.
      const a = t.shut + (i / 48) * arc;
      o.rotation.y = a;
      o.updateMatrixWorld(true);
      const e = o.matrixWorld.elements;
      for (let u = 0.08; u <= 1.001; u += 0.115) {
        for (const vy of [0.15, 1.0, 1.95]) {
          for (const sgn of [-1, 1]) {          // the leaf runs one way; try both
            const q = xf(e, sgn * span * u, vy - 1.05, 0);
            for (const c of test) {
              if (q[0] > c.minX + 0.03 && q[0] < c.maxX - 0.03
                && q[2] > c.minZ + 0.03 && q[2] < c.maxZ - 0.03
                && q[1] > (c.minY ?? -99) + 0.03 && q[1] < (c.maxY ?? 99) - 0.03) {
                out.hits.push({ door: nm, deg: +((a - t.shut) * 180 / Math.PI).toFixed(0),
                  frac: (a - t.shut) / arc,
                  u: +u.toFixed(2), y: vy, at: q.map((v) => +v.toFixed(2)),
                  col: [+c.minX.toFixed(2), +c.maxX.toFixed(2), +c.minZ.toFixed(2), +c.maxZ.toFixed(2)] });
              }
            }
          }
        }
      }
    }
    o.rotation.y = start; o.updateMatrixWorld(true);
    out.doors.push({ name: nm, span, start, shut: t.shut, open: t.open, arc, excluded: mine.length });
  }

  // the two leaves against EACH OTHER, every combination of angles
  const a1 = s.getObjectByName('leaf301'), a2 = s.getObjectByName('leaf302');
  out.pair = null;
  if (a1 && a2) {
    const s1 = a1.rotation.y, s2 = a2.rotation.y;
    let worst = Infinity, at = null;
    for (let i = 0; i <= 16; i++) {
      a1.rotation.y = travel.leaf301.shut + (i / 16) * (travel.leaf301.open - travel.leaf301.shut);
      const b1 = aabb(a1);
      for (let j = 0; j <= 16; j++) {
        a2.rotation.y = travel.leaf302.shut + (j / 16) * (travel.leaf302.open - travel.leaf302.shut);
        const b2 = aabb(a2);
        // SAT on two AABBs: separated if a gap exists on ANY axis, so it is the
        // MAX of the per-axis gaps, not the min. (Got this backwards once on
        // the car lot and reported a 3.5 m overlap that was 0.42 m of clearance.)
        const gap = Math.max(
          Math.max(b1.lo[0] - b2.hi[0], b2.lo[0] - b1.hi[0]),
          Math.max(b1.lo[1] - b2.hi[1], b2.lo[1] - b1.hi[1]),
          Math.max(b1.lo[2] - b2.hi[2], b2.lo[2] - b1.hi[2]));
        if (gap < worst) {
          worst = gap;
          at = [+(i / 16 * (travel.leaf301.open - travel.leaf301.shut) * 180 / Math.PI).toFixed(0),
                +(j / 16 * (travel.leaf302.open - travel.leaf302.shut) * 180 / Math.PI).toFixed(0)];
        }
      }
    }
    a1.rotation.y = s1; a2.rotation.y = s2;
    a1.updateMatrixWorld(true); a2.updateMatrixWorld(true);
    out.pair = { worst, at };
  }
  return out;
});

if (R.missing.length) {
  console.error(`\nNOT FOUND: ${R.missing.join(', ')} — nothing was swept, so this proves nothing.`);
  await b.close(); process.exit(3);
}
if (R.noTravel) { console.error('\nscene.userData.doorTravel is missing — the doors publish nothing, so nothing was checked.'); await b.close(); process.exit(3); }
if (!R.doors.length) { console.error('\nNO DOORS SWEPT.'); await b.close(); process.exit(3); }

console.log('');
for (const d of R.doors)
  console.log(`  ${d.name}: reaches ${d.span.toFixed(2)} m from its pivot; shut ${(d.shut * 180 / Math.PI).toFixed(0)}deg -> open ${(d.open * 180 / Math.PI).toFixed(0)}deg = ${Math.abs(d.arc * 180 / Math.PI).toFixed(0)}deg of travel, at rest ${(d.start * 180 / Math.PI).toFixed(0)}deg (own doorway cap excluded: ${d.excluded})`);
console.log('');

let bad = 0;
for (const d of R.doors) {
  const h = R.hits.filter((x) => x.door === d.name);
  const lim = Math.abs(d.arc * 180 / Math.PI);
  const real = h.filter((x) => x.frac >= -1e-9 && x.frac <= 1 + 1e-9);
  if (real.length) {
    bad++;
    console.log(`  FAIL  ${d.name} sweeps through solid at ${real.length} sampled points inside its real travel`);
    for (const x of real.slice(0, 3))
      console.log(`          ${x.deg}deg, ${x.u} along the leaf, y ${x.y} -> (${x.at}) inside [${x.col}]`);
  } else {
    console.log(`  ok    ${d.name} sweeps its whole ${lim.toFixed(0)}deg, shut to open, touching nothing — wall, frame or neighbour`);
    if (h.length) console.log(`          (and fouls only PAST a stop, at ${h.map((x) => x.deg).sort((m, n) => Math.abs(m) - Math.abs(n))[0]}deg — so both stops are doing work)`);
    else console.log('          (nothing fouls even 15% past either stop — the arc is clear, not merely stopped in time)');
  }
}
console.log('');
if (R.pair) {
  const ok = R.pair.worst > 0;
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  301 and 302 never meet: closest approach ${R.pair.worst.toFixed(2)} m over 289 angle pairs (worst at 301 ${R.pair.at[0]}deg / 302 ${R.pair.at[1]}deg)`);
}
await b.close();
console.log(bad ? '\nA leaf passes through something solid.\n' : '\nboth hung doors swing clear through their whole travel.\n');
process.exit(bad ? 1 : 0);

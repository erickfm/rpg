// WHICH FACE POINTS WHICH WAY — every door in the walk-up, from both sides.
//
// The user, standing in his own flat: *"the 301 number plate is facing him"*.
// A flat number belongs on the HALL side; from inside your own home you never
// see your own number. That is the fourth attribute of a door — hinge edge,
// handle, swing, and FACE — and the first three were derived from one rule
// while the fourth was not.
//
// This asserts the face STRUCTURALLY rather than from a viewpoint, because the
// whole lesson of this class is that a door reads correctly from the landing
// and wrong from inside: the numbered material is stamped `userData.plate`,
// and the check computes which way that face's normal points at the SHUT
// angle and compares it with the side the hall is actually on.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4190/');
const HALL_X0 = 200, HALL_X1 = 202.4;                 // the landing, in world x
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 660 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 900));

let fails = 0;
const rep = (n, ok, d) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${d}`); };

const R = await p.evaluate(([hx0, hx1]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const travel = s.userData.doorTravel ?? {};
  const out = { hung: [], flat: [], missing: [] };
  // ── the two HUNG leaves, driven to SHUT so the faces mean something ──
  for (const nm of ['leaf301', 'leaf302']) {
    const o = s.getObjectByName(nm);
    if (!o || !travel[nm]) { out.missing.push(nm); continue; }
    const save = o.rotation.y;
    o.rotation.y = travel[nm].shut;
    o.updateMatrixWorld(true);
    let rec = null;
    o.traverse((m) => {
      if (!m.isMesh || !Array.isArray(m.material)) return;
      const idx = m.material.findIndex((mm) => mm?.userData?.plate === true);
      if (idx < 0) return;
      // materials run [+x, -x, +y, -y, +z, -z]; 4 is +z, 5 is -z
      const e = m.matrixWorld.elements;
      const zcol = [e[8], e[9], e[10]];               // world direction of local +z
      const sgn = idx === 4 ? 1 : idx === 5 ? -1 : 0;
      rec = { nm, idx, plateX: sgn * zcol[0], both: m.material.filter((mm) => mm?.userData?.plate === true).length };
    });
    o.rotation.y = save; o.updateMatrixWorld(true);
    if (rec) out.hung.push(rec); else out.missing.push(nm + ' (no stamped plate)');
  }
  // ── the six FLAT doors: single planes, normal is local +z ──
  s.traverse((m) => {
    const g = m.geometry?.parameters;
    if (!m.isMesh || !g || g.depth !== undefined || g.width === undefined) return;
    if (Math.abs(g.width - 1.11) > 0.01 || Math.abs(g.height - 2.1) > 0.01) return;
    const e = m.matrixWorld.elements;
    if (e[12] < hx0 - 1 || e[12] > hx1 + 1) return;
    out.flat.push({ x: e[12], z: e[14], y: e[13], normX: e[8] });
  });
  return out;
}, [HALL_X0, HALL_X1]);

if (R.missing.length) {
  console.error(`\nNOT MEASURED: ${R.missing.join(', ')} — this proves nothing.`);
  await b.close(); process.exit(3);                    // GOTCHAS 32
}

console.log(`\n  ${R.hung.length} hung leaves, ${R.flat.length} flat doors\n`);
// A door's hall side: the landing runs x 200.0..202.4, so a door west of the
// middle has its hall to +x and one east of it to -x.
const hallDir = (x) => (x < (HALL_X0 + HALL_X1) / 2 ? 1 : -1);
for (const q of R.hung) {
  const want = hallDir(q.nm === 'leaf301' ? 200.0 : 202.4);
  const ok = Math.sign(q.plateX) === want && q.both === 1;
  rep(`${q.nm}: the number faces the hall`, ok,
    `plate is on material ${q.idx} (${q.idx === 4 ? '+z' : '-z'}), its normal points x ${q.plateX > 0 ? '+' : '-'}` +
    `, hall is x ${want > 0 ? '+' : '-'}${q.both !== 1 ? `, and ${q.both} faces carry a number` : ''}`);
}
let flatBad = 0;
for (const q of R.flat) {
  const want = hallDir(q.x);
  if (Math.sign(q.normX) !== want) flatBad++;
}
rep('every flat door faces the hall too', flatBad === 0,
  `${R.flat.length} checked on all landings, ${flatBad} pointing into their own flat`);

// ── and LOOK, from both sides of 301, which is the one he was standing in ──
const shot = async (name, x, z, yaw) => {
  await p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 2 * 2.7, 0), [x, z, yaw]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/doorfaces-${name}.png` });
};
await p.evaluate(() => { const s = window.__ct.scene(); const o = s.getObjectByName('leaf301');
  o.rotation.y = s.userData.doorTravel.leaf301.shut; o.updateMatrixWorld(true); });
await shot('inside-301', 198.9, -16.5, Math.PI / 2);   // in the room, looking at the door
await shot('on-the-landing', 200.9, -16.5, -Math.PI / 2);
await b.close();
console.log(fails ? `\n  ${fails} failed\n` : '\n  every number plate faces the corridor, and none faces a room.\n');
process.exit(fails ? 1 : 0);

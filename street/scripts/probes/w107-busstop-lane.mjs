// WHAT IS THE ACTUAL WALKING LANE AT THE 42 STOP, and what bounds it?
//
// Item 269 says the east walk is 1.15 m at the bus stop against a sacred 2 m,
// that the bench (ct/props.ts, BENCH_Z = -35.0) blocks the player at x <= 6.05,
// and that "the shopfront alone leaves only 1.63 m". Every one of those is a
// number to re-derive, not to inherit: the row's stamp is over an hour old.
//
// This PRINTS. It does not assert — an investigation.
//
// Reads `staticColliders()`, never `colliders()` (GOTCHAS 73): citizens walk
// this pavement and a paused one scores as masonry. Reads authoring facts only,
// never `visible` (GOTCHAS 79/79b) — the census would otherwise be empty,
// because the player spawns inside apartment 301 at x = 198, past the cull.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';

const URL = aim('http://localhost:4188/');
const Z0 = -46, Z1 = -27, STEP = 0.05;

const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const out = await p.evaluate(([Z0, Z1, STEP]) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const cols = window.__ct.staticColliders();

  // name a collider by the mesh whose world AABB matches its footprint best
  const objs = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, m = o.matrixWorld.elements;
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, mxy = -1e9;
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const wx = m[0]*X + m[4]*Y + m[8]*Z + m[12];
      const wy = m[1]*X + m[5]*Y + m[9]*Z + m[13];
      const wz = m[2]*X + m[6]*Y + m[10]*Z + m[14];
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
      if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
      if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
    }
    objs.push({ mnx, mxx, mnz, mxz, mny, mxy, ud: o.userData || {}, name: o.name || '' });
  });
  const nameOf = (c) => {
    let best = null, bd = 1e9;
    for (const o of objs) {
      const d = Math.abs(o.mnx - c.minX) + Math.abs(o.mxx - c.maxX)
              + Math.abs(o.mnz - c.minZ) + Math.abs(o.mxz - c.maxZ);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || bd > 1.5) return { label: 'unmatched', d: +bd.toFixed(2) };
    const u = best.ud;
    const tag = best.name || u.groundProp || u.kind || u.prop || u.litter
      || Object.keys(u).filter((k) => k !== 'mod' && k !== 'groundY').join(',') || '(untagged)';
    return { label: tag, mod: u.mod || null, top: +best.mxy.toFixed(2), d: +bd.toFixed(2) };
  };

  // everything static that overlaps the east-walk corridor at all
  const near = cols.filter((c) => c.maxZ > Z0 && c.minZ < Z1 && c.maxX > 4.0 && c.minX < 10.0);
  const census = near.map((c) => ({
    minX: +c.minX.toFixed(3), maxX: +c.maxX.toFixed(3),
    minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2), ...nameOf(c),
  })).sort((a, b2) => a.minZ - b2.minZ);

  // the clear span at each z: walk out from the kerb and find the first
  // occupied interval, then the widest gap between kerb-side limit and the
  // first thing on the building side.
  const prof = [];
  for (let z = Z0; z <= Z1 + 1e-9; z += STEP) {
    const iv = [];
    for (const c of near) if (c.minZ <= z && c.maxZ >= z) iv.push([c.minX, c.maxX, c]);
    iv.sort((u, v) => u[0] - v[0]);
    // widest free run inside [4.0, 10.0]
    let cur = 4.0, best = 0, bl = null, br = null, last = null;
    for (const [lo, hi, c] of iv) {
      if (lo > cur && lo - cur > best) { best = lo - cur; bl = last; br = c; }
      if (hi > cur) { cur = hi; last = c; }
    }
    if (10.0 - cur > best) { best = 10.0 - cur; bl = last; br = null; }
    prof.push({ z: +z.toFixed(2), clear: +best.toFixed(3),
      l: bl ? +bl.maxX.toFixed(3) : null, r: br ? +br.minX.toFixed(3) : null,
      lName: bl ? nameOf(bl).label : null, rName: br ? nameOf(br).label : null });
  }
  return { census, prof, nStatic: cols.length, nAll: window.__ct.colliders().length };
}, [Z0, Z1, STEP]);

console.log(`static colliders ${out.nStatic} / all ${out.nAll}`);
console.log('\n=== STATIC COLLIDERS overlapping east walk, z ' + Z0 + '..' + Z1 + ' ===');
for (const c of out.census) {
  console.log(`  x ${c.minX.toFixed(3)}..${c.maxX.toFixed(3)}  z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}  ${c.label}${c.mod ? ' [' + c.mod + ']' : ''}  (match ${c.d})`);
}
console.log('\n=== CLEAR SPAN by z (widest free run in x 4.0..10.0) ===');
let run = null;
for (const r of out.prof) {
  const key = `${r.clear.toFixed(3)}|${r.lName}|${r.rName}`;
  if (!run || run.key !== key) { if (run) console.log(`  z ${run.z0.toFixed(2)}..${run.z1.toFixed(2)}  clear ${run.clear.toFixed(3)}  between ${run.l ?? 'x=4.0'} (${run.lName}) and ${run.r ?? 'x=10.0'} (${run.rName})`); run = { key, z0: r.z, z1: r.z, ...r }; }
  else run.z1 = r.z;
}
if (run) console.log(`  z ${run.z0.toFixed(2)}..${run.z1.toFixed(2)}  clear ${run.clear.toFixed(3)}  between ${run.l ?? 'x=4.0'} (${run.lName}) and ${run.r ?? 'x=10.0'} (${run.rName})`);

const worst = out.prof.reduce((a, b2) => (b2.clear < a.clear ? b2 : a));
console.log(`\nNARROWEST: ${worst.clear.toFixed(3)} m at z ${worst.z.toFixed(2)} — between ${worst.lName} (x ${worst.l}) and ${worst.rName} (x ${worst.r})`);
await b.close();

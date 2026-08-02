// w38 — ITEM 78. WHAT IS STANDING NEXT TO THE PLAYER WHEN §4a STALLS?
//
// §4a of w24-chamfer-walk.mjs walks the diagonal at yaw pi/4. That heading is
// EXACTLY parallel to the 45-degree cut — fwd = (+1,-1)/sqrt2, so d(x+z) = 0 —
// which is why a healthy run holds `perp` constant at 0.800 the whole way along
// the face.
//
// In the runs that fail, perp does not hold: it collapses 0.800 -> 0.596 ->
// 0.387 and the player wedges. The only way perp can fall is for the -z step to
// be refused while the +x step is allowed (fp.ts tests the axes separately), and
// x+z then climbs toward the wall. So the question is not "is the chamfer built
// wrong" — 2a measures the surface flat to 0.0 mm on the same runs — but
// WHAT REFUSED THE -Z STEP. Nothing in the static corner geometry sits south of
// the player there.
//
// So: walk 4a's leg repeatedly and, the moment it stalls, dump every collider
// near the player, with whether that box MOVED over the following second. A box
// that moves is an actor (citizens and vehicles are spread into the same array
// by crosstown.ts) and is not a statement about how the wall is built.
//
// Lean on purpose: no 2a bisection, so a sample costs seconds rather than ~97 s.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w38-chamfer-stall-neighbours.mjs [N]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const N = Number(process.argv[2] ?? 12);
const URL = aim();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// The bay, the same way w24-chamfer-walk finds it: the canted group IS the face.
const bay = await p.evaluate(() => {
  const found = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isGroup || Math.abs(o.rotation.y + Math.PI * 0.75) > 1e-6) return;
    const w = o.children.filter((k) => k.geometry?.type === 'PlaneGeometry')
      .map((k) => k.geometry.parameters.width);
    if (w.length >= 2) found.push({ x: o.position.x, z: o.position.z, w: Math.max(...w) });
  });
  return found;
});
if (bay.length !== 1) { console.log(`no single bay group (${bay.length})`); await b.close(); process.exit(3); }
const C = bay[0], FW = C.w, S2 = Math.SQRT2;
const CUT = C.x + C.z;
const A = { x: C.x - FW / 2 / S2, z: C.z + FW / 2 / S2 };
const along = (x, z) => ((x - A.x) - (z - A.z)) / S2;
const perp = (x, z) => (CUT - x - z) / S2;
console.log(`bay centre (${C.x}, ${C.z})  faceWidth ${FW.toFixed(3)}  cut x+z=${CUT}\n`);

const YAW = Math.PI / 4;
let stalls = 0;
for (let i = 1; i <= N; i++) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [A.x - 1.1, A.z + 1.3, YAW]);
  await p.waitForTimeout(300);
  await p.keyboard.down('w');
  const r = await p.evaluate(([ax, az, target, eps, stallFrames, budget]) => new Promise((resolve) => {
    const S = Math.SQRT2;
    let n = 0, still = 0, moved = false, lx = null, lz = null;
    const tick = () => {
      const [x, , z] = window.__ct.pos();
      const a = ((x - ax) - (z - az)) / S;
      if (lx !== null) {
        const d = Math.hypot(x - lx, z - lz);
        if (d > eps) moved = true;
        still = (moved && d <= eps) ? still + 1 : 0;
      }
      lx = x; lz = z;
      if (a > target) return resolve({ why: 'cleared', x, z, frames: n });
      if (still >= stallFrames) return resolve({ why: 'stalled', x, z, frames: n });
      if (++n > budget) return resolve({ why: 'budget', x, z, frames: n });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [A.x, A.z, FW + 0.5, 0.002, 30, 600]);
  await p.keyboard.up('w');

  const a = along(r.x, r.z), s = perp(r.x, r.z);
  if (r.why === 'cleared') { console.log(`run ${String(i).padStart(2)}  cleared  along ${a.toFixed(2)}`); continue; }

  stalls++;
  console.log(`run ${String(i).padStart(2)}  ${r.why.toUpperCase()}  at x ${r.x.toFixed(3)} z ${r.z.toFixed(3)}  along ${a.toFixed(3)}  perp ${s.toFixed(3)}`);

  // WHO IS NEXT TO ME — and does it move? Sampled twice a second apart, so an
  // actor that merely happened to be still for one instant is still caught.
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  const snap = (px, pz, R, k) => p.evaluate(([px, pz, R, ks]) => {
    const kf = eval(`(${ks})`);
    return window.__ct.colliders()
      .filter((c) => {
        const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
        const rx = (c.maxX - c.minX) / 2 + (c.maxZ - c.minZ) / 2 + R;
        return Math.abs(cx - px) < rx && Math.abs(cz - pz) < rx;
      })
      .map((c) => ({ k: kf(c), minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, rot: c.rot ?? 0 }));
  }, [px, pz, R, k.toString()]);

  const n1 = await snap(r.x, r.z, 1.2, key);
  await p.waitForTimeout(1000);
  const n2 = await snap(r.x, r.z, 1.2, key);
  const keys2 = new Set(n2.map((c) => c.k));
  console.log(`      ${n1.length} collider(s) within 1.2 m of the stall:`);
  for (const c of n1) {
    const moving = !keys2.has(c.k);
    // Which face of it faces the player, and is it SOUTH of them (the -z step
    // that must have been refused)?
    const southOfPlayer = c.maxZ <= r.z + 0.05;
    console.log(`        x ${c.minX.toFixed(3)}..${c.maxX.toFixed(3)}  z ${c.minZ.toFixed(3)}..${c.maxZ.toFixed(3)}` +
      `  rot ${c.rot.toFixed(4)}  ${moving ? 'MOVING (an actor)' : 'static'}` +
      `${southOfPlayer ? '   <-- SOUTH of the player: this is what can refuse the -z step' : ''}`);
  }
}
console.log(`\n${stalls} stall(s) in ${N} runs`);
await b.close();

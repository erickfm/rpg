// ITEM 141: HOW MUCH IS DRAWN facing the window in 301, facing away, and on the street?
//
// The user: *"facing the window in my room makes the game feel slow. like my
// mouse moving across the screen feels like it drags."*
//
// BUILDER-BRIEF §10 and the desk both say the same thing and they are right:
// no frame time from headless software GL transfers to the user's machine.
// So this counts instead, and it counts TWO things that are true on any
// hardware:
//
//   1. REAL GPU DRAW CALLS — `drawElements`/`drawArrays` and their instanced
//      forms are wrapped on the WebGL context prototype in an init script, so
//      they are hooked before the app ever constructs its renderer. This is
//      not three's `renderer.info` (which is not exposed here anyway); it is
//      the actual call count into the driver, plus the triangle total that
//      goes with it. Nothing is imported from the app and no constant is
//      retyped.
//   2. FRUSTUM-VISIBLE MESHES, computed here from `__ct.scene()` and
//      `__ct.camera()` the same way three's own `projectObject` decides what
//      goes in the render list: visible, and either not frustum-culled or
//      intersecting the frustum. This is the DIAGNOSIS — it says what is being
//      drawn, grouped by top-level scene child, so "the exterior draws through
//      the window" is a claim with a name attached rather than a theory.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w53-drawcount.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4183/');
const SETTLE = Number(process.env.W53_SETTLE ?? 2500);
const SAMPLE = Number(process.env.W53_SAMPLE ?? 3000);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

// ── hook the GL context BEFORE the app builds its renderer ────────────────
await p.addInitScript(() => {
  const st = { calls: 0, tris: 0, frames: 0 };
  window.__gl = st;
  const wrap = (proto) => {
    if (!proto) return;
    const de = proto.drawElements, da = proto.drawArrays;
    const dei = proto.drawElementsInstanced, dai = proto.drawArraysInstanced;
    if (de) proto.drawElements = function (mode, count, ...r) {
      st.calls++; st.tris += count / 3; return de.call(this, mode, count, ...r);
    };
    if (da) proto.drawArrays = function (mode, first, count, ...r) {
      st.calls++; st.tris += count / 3; return da.call(this, mode, first, count, ...r);
    };
    if (dei) proto.drawElementsInstanced = function (mode, count, t, o, n, ...r) {
      st.calls++; st.tris += (count / 3) * n; return dei.call(this, mode, count, t, o, n, ...r);
    };
    if (dai) proto.drawArraysInstanced = function (mode, first, count, n, ...r) {
      st.calls++; st.tris += (count / 3) * n; return dai.call(this, mode, first, count, n, ...r);
    };
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);
  const tick = () => { st.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));

// ── where is 301's window? Read it out of the world, never typed. ─────────
// Same locator A-verify-301-window.mjs uses: the 1.3 x 1.3 glass pane on the
// third floor of the walk-up.
const win = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'PlaneGeometry') return;
    const gp = n.geometry.parameters;
    if (Math.abs(gp.width - 1.3) > 0.01 || Math.abs(gp.height - 1.3) > 0.01) return;
    const e = n.matrixWorld.elements;
    if (e[13] < 5 || e[13] > 9) return;
    if (!best || e[13] > best.y) best = { x: e[12], y: e[13], z: e[14] };
  });
  return best;
});
if (!win) { console.error('could not find the 301 window pane'); await browser.close(); process.exit(3); }

const spawn = await p.evaluate(() => window.__ct.pos());
console.log(`301 window pane  x ${win.x.toFixed(2)}  y ${win.y.toFixed(2)}  z ${win.z.toFixed(2)}`);
console.log(`spawn (301)      (${spawn[0].toFixed(2)}, ${spawn[2].toFixed(2)}) gy ${spawn[3].toFixed(2)}\n`);

// The window wall is at -x from inside the room, so facing it is yaw -PI/2
// (the rig's forward is (sin yaw, 0, -cos yaw)). Facing away is +PI/2.
const STATIONS = [
  ['301 FACING THE WINDOW', [win.x + 2.4, win.z, -Math.PI / 2, spawn[3]]],
  ['301 facing away',       [win.x + 2.4, win.z,  Math.PI / 2, spawn[3]]],
  ['the street',            [0, 0, 0, 0]],
];

const rows = [];
for (const [name, warp] of STATIONS) {
  await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), warp);
  await p.waitForTimeout(SETTLE);
  const a = await p.evaluate(() => ({ ...window.__gl }));
  await p.waitForTimeout(SAMPLE);
  const b = await p.evaluate(() => ({ ...window.__gl }));
  const frames = b.frames - a.frames;

  // what is in the frustum, and whose is it?
  const vis = await p.evaluate(() => {
    const THREE = window.__three;
    const s = window.__ct.scene(), cam = window.__ct.camera();
    s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    // Build the frustum by hand from the view-projection matrix — no THREE
    // import is available in page scope, so the six planes are extracted from
    // the matrix directly (Gribb/Hartmann), which is what Frustum does.
    const e = [];
    const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
    const pl = [
      [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
      [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
      [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
      [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
      [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]],
      [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]],
    ].map(([a, b, c, d]) => { const n = Math.hypot(a, b, c); return [a / n, b / n, c / n, d / n]; });

    const hidden = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return true; return false; };
    const inFrustum = (mesh) => {
      const g = mesh.geometry;
      if (!g) return true;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere; if (!bs) return true;
      const c = bs.center.clone().applyMatrix4(mesh.matrixWorld);
      const sc = mesh.matrixWorld;
      const el = sc.elements;
      const sx = Math.hypot(el[0], el[1], el[2]);
      const sy = Math.hypot(el[4], el[5], el[6]);
      const sz = Math.hypot(el[8], el[9], el[10]);
      const r = bs.radius * Math.max(sx, sy, sz);
      for (const [a, b2, c2, d] of pl) if (a * c.x + b2 * c.y + c2 * c.z + d < -r) return false;
      return true;
    };

    // whose is it? label by the top-level scene child it descends from
    const topOf = (o) => { let q = o; while (q.parent && q.parent !== s) q = q.parent; return q; };
    let meshes = 0, drawn = 0;
    const by = new Map();
    s.traverse((o) => {
      if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
      meshes++;
      if (hidden(o)) return;
      if (o.frustumCulled !== false && !inFrustum(o)) return;
      drawn++;
      const t = topOf(o);
      const key = t.name || t.userData?.tag || t.type;
      by.set(key, (by.get(key) ?? 0) + 1);
    });
    const top = [...by.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
    return { meshes, drawn, top };
  });

  rows.push({ name, frames,
    calls: (b.calls - a.calls) / frames,
    tris: (b.tris - a.tris) / frames,
    drawn: vis.drawn, meshes: vis.meshes, top: vis.top });
}

console.log('station                    draw calls/frame   triangles/frame   frustum-visible');
console.log('-------------------------  ----------------   ---------------   ---------------');
for (const r of rows) {
  console.log(`${r.name.padEnd(25)}  ${r.calls.toFixed(0).padStart(16)}   ${Math.round(r.tris).toLocaleString().padStart(15)}   ${String(r.drawn).padStart(6)} / ${r.meshes}`);
}
console.log('');
for (const r of rows) {
  console.log(`${r.name}  — biggest contributors:`);
  for (const [k, n] of r.top) console.log(`    ${String(n).padStart(5)}  ${k}`);
  console.log('');
}
if (errs.length) console.log(`console errors: ${errs.length}\n${errs.slice(0, 5).join('\n')}`);
await browser.close();

// ITEM 274, the optional half: "consider whether a hint of the inner wall
// catching light sells the depth."
//
// DECIDED BY LOOKING, NOT BY REASONING -- the item is explicit that reasoning
// about appearance is what failed the last two mug fixes. This mutates the
// interior disc's vertex colours LIVE IN THE PAGE (no build, no source churn)
// so the flat tone and the graded one can be photographed from the same spot,
// in the same session, and put side by side.
//
// The gradient direction is DERIVED, not typed: the mug sits on the sill of
// the window at WIN_LX = -3.2 and the room extends to +x, so the player is
// always at +x of the mug. From 22 deg you see almost nothing of the bottom --
// the sightline crosses the 64 mm mouth and drops only 26 mm of a 95 mm cup --
// so the whole mouth IS the FAR inner wall, at -x. Lighter at -x (the far wall
// you actually see), darker at +x (the near wall, in the shade of its own rim).
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w111-mug-gradient-look.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4672/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(13, 30));
await waitPainted(p, { quiet: true });

// same station as w111-mug-empty: inside the bed prompt, 22 deg down
const st = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let mug = null;
  s.traverse((n) => {
    if (n.isMesh && n.geometry?.type === 'CylinderGeometry'
      && Math.abs(n.geometry.parameters.radiusTop - 0.038) < 1e-4
      && Math.abs(n.geometry.parameters.height - 0.095) < 1e-4) {
      const e = n.matrixWorld.elements; mug = { x: e[12], y: e[13] + 0.0475, z: e[14] };
    }
  });
  const bed = window.__ct.spots().find((q) => /sleep until morning/.test(q.label || ''));
  return { mug, bed, gy: window.__ct.groundAt(mug.x, mug.z) };
});
const bearing = Math.atan2(st.bed.x - st.mug.x, st.bed.z - st.mug.z);
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [st.bed.x, st.bed.z, st.gy]);
await waitPainted(p, { quiet: true });
const eyeY = await p.evaluate(() => window.__ct.camY());
const range = (eyeY - st.mug.y) / Math.tan((22 * Math.PI) / 180);
const sx = st.mug.x + Math.sin(bearing) * range, sz = st.mug.z + Math.cos(bearing) * range;
const yaw = Math.atan2(st.mug.x - sx, -(st.mug.z - sz));
await p.evaluate(([x, z, y, gy, pi]) => window.__ct.warp(x, z, y, gy, pi),
  [sx, sz, yaw, st.gy, -Math.atan2(eyeY - st.mug.y, range)]);
await waitPainted(p, { quiet: true });
await p.waitForTimeout(400);

const clip = await p.evaluate((m) => {
  const cam = window.__ct.camera(); cam.updateMatrixWorld(true);
  const V = cam.position.constructor;
  let mn = null, mx = null;
  for (const dx of [-0.038, 0.038]) for (const dz of [-0.038, 0.038]) for (const dy of [-0.05, 0.05]) {
    const v = new V(m.x + dx, m.y + dy, m.z + dz).project(cam);
    const X = (v.x * 0.5 + 0.5) * innerWidth, Y = (-v.y * 0.5 + 0.5) * innerHeight;
    if (!mn) { mn = { x: X, y: Y }; mx = { x: X, y: Y }; }
    mn.x = Math.min(mn.x, X); mn.y = Math.min(mn.y, Y);
    mx.x = Math.max(mx.x, X); mx.y = Math.max(mx.y, Y);
  }
  const pad = Math.max(20, (mx.x - mn.x) * 0.8);
  return { x: Math.round(mn.x - pad), y: Math.round(mn.y - pad),
    width: Math.round(mx.x - mn.x + pad * 2), height: Math.round(mx.y - mn.y + pad * 2) };
}, st.mug);

async function zoom(tag) {
  await waitPainted(p, { quiet: true });
  await p.evaluate(([cl, Z]) => {
    const src = document.querySelector('canvas');
    const sx2 = src.width / src.clientWidth, sy2 = src.height / src.clientHeight;
    let g = document.getElementById('w111-zoom');
    if (!g) {
      g = document.createElement('canvas'); g.id = 'w111-zoom';
      g.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;image-rendering:pixelated';
      document.body.appendChild(g);
    }
    g.width = cl.width * Z; g.height = cl.height * Z;
    const cx = g.getContext('2d'); cx.imageSmoothingEnabled = false;
    cx.drawImage(src, cl.x * sx2, cl.y * sy2, cl.width * sx2, cl.height * sy2, 0, 0, cl.width * Z, cl.height * Z);
  }, [clip, 8]);
  const z = await p.$('#w111-zoom');
  await z.screenshot({ path: `shots/w111-grad-${tag}-zoom8.png` });
  await p.evaluate(() => document.getElementById('w111-zoom')?.remove());
  console.log(`  shots/w111-grad-${tag}-zoom8.png`);
}

await zoom('flat');

for (const spread of [0.16, 0.30]) {
  const n = await p.evaluate(([sp]) => {
    const s = window.__ct.scene();
    let hits = 0;
    s.traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'CircleGeometry') return;
      if (Math.abs((o.geometry.parameters || {}).radius - 0.032) > 1e-4) return;
      const g = o.geometry, pos = g.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const R = g.parameters.radius;
      // A PURE MULTIPLIER. three MULTIPLIES material.color by the vertex colour,
      // so baking the base tone in here squares it -- the first run of this
      // probe did exactly that and produced a near-black mouth that looked like
      // a finding. It was arithmetic, not the world.
      for (let i = 0; i < pos.count; i++) {
        // local +x is the NEAR side (the room); -x is the FAR wall you see
        const t = -pos.getX(i) / R;                 // -1 near .. +1 far
        const k = 1 + t * sp;
        cols[i * 3] = k; cols[i * 3 + 1] = k; cols[i * 3 + 2] = k;
      }
      g.setAttribute('color', new (pos.constructor)(cols, 3));
      o.material.vertexColors = true; o.material.needsUpdate = true;
      hits++;
    });
    return hits;
  }, [spread]);
  console.log(`gradient +-${(spread * 100).toFixed(0)}% on ${n} mesh`);
  await zoom(`spread${Math.round(spread * 100)}`);
}
await b.close();

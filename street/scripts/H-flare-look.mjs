import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene, null, { timeout: 60000 });
const target = await p.evaluate(() => {
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  let best = null;
  root.traverse((g) => {
    if (!g.userData || !g.userData.wheelbase) return;
    const e = g.matrixWorld.elements, x = e[12], z = e[14];
    if (Math.abs(x) > 60 || Math.abs(z) > 130) return;
    if (x === 0 && z === 0) return;
    if (!best || g.userData.wheelbase > best.wb) best = { x, z, wb: g.userData.wheelbase };
  });
  return best;
});
console.log('widest on-street vehicle:', JSON.stringify(target));
for (const [d, tag] of [[3.2, 'near'], [5.5, 'back']]) {
  const st = await p.evaluate(([tx, tz, dd]) => {
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const x = tx + Math.sin(a) * dd, z = tz + Math.cos(a) * dd;
      const gy = window.__ct.groundAt(x, z);
      if (!Number.isFinite(gy)) continue;
      let hit = false;
      for (const c of window.__ct.colliders())
        if (x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35) { hit = true; break; }
      if (!hit) return { x, z };
    }
    return null;
  }, [target.x, target.z, d]);
  if (!st) { console.log(`  no clear stand at ${d} m`); continue; }
  const yaw = Math.atan2(target.x - st.x, -(target.z - st.z));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), -0.18), [st.x, st.z, yaw]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/H-flare-${tag}.png` });
  console.log(`  ${tag}: stood ${d} m out at (${st.x.toFixed(2)}, ${st.z.toFixed(2)})`);
}
await b.close();

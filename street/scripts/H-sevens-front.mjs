import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 60000 });
const sp = await p.evaluate(() => window.__ct.spots().find((s) => /sevens/i.test(s.label)));
console.log('SEVENS spot at', sp.x.toFixed(2), sp.z.toFixed(2));
// stand out in the street and look back at the frontage
for (const [d, tag] of [[6, 'front6'], [10, 'front10']]) {
  const st = await p.evaluate(([sx, sz, dd]) => {
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const x = sx + Math.sin(a) * dd, z = sz + Math.cos(a) * dd;
      const gy = window.__ct.groundAt(x, z);
      if (Math.abs(gy - window.__ct.groundAt(sx, sz)) > 0.4) continue;
      let hit = false;
      for (const c of window.__ct.colliders())
        if (x > c.minX - .4 && x < c.maxX + .4 && z > c.minZ - .4 && z < c.maxZ + .4) { hit = true; break; }
      if (!hit) return { x, z };
    }
    return null;
  }, [sp.x, sp.z, d]);
  if (!st) { console.log(`  no clear stand at ${d} m`); continue; }
  const yaw = Math.atan2(sp.x - st.x, -(sp.z - st.z));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0.12), [st.x, st.z, yaw]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/H-sevens-${tag}.png` });
  console.log(`  ${tag}: stood ${d} m out at (${st.x.toFixed(2)}, ${st.z.toFixed(2)})`);
}
await b.close();

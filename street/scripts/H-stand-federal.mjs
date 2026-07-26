// H (verifier): stand at FIRST FEDERAL by hand. Not D's protocol - a player
// walking up, stopping, looking, and turning away.
import { chromium } from 'playwright';
import { installSee } from './lib/D-see.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.spots, null, { timeout: 60000 });
await installSee(page);
console.log('build', await page.evaluate(() => window.__ct.build?.() ?? '?'));

const sp = await page.evaluate(() =>
  window.__ct.spots().find((s) => /FIRST FEDERAL/.test(s.label)));
console.log('spot:', sp.label, 'at', sp.x.toFixed(2), sp.z.toFixed(2), 'r', sp.r);

const read = async (d, turn, tag) => {
  // stand d metres away on the clear bearing, facing the spot (+turn)
  const st = await page.evaluate(([sx, sz, dd]) => {
    // walk out along +x from the spot and take whatever the world allows
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const x = sx + Math.sin(a) * dd, z = sz + Math.cos(a) * dd;
      // standable, or it is a station no player can reach - which I have
      // already once mistaken for evidence
      const gy = window.__ct.groundAt(sx, sz);
      if (Math.abs(window.__ct.groundAt(x, z) - gy) > 0.30) continue;
      let hit = false;
      for (const c of window.__ct.colliders()) {
        if (x > c.minX - 0.36 && x < c.maxX + 0.36 && z > c.minZ - 0.36 && z < c.maxZ + 0.36) { hit = true; break; }
      }
      if (hit) continue;
      if (window.__dSee([x, 1.6, z], [sx, gy + 1.1, sz]).t < 0) return { x, z };
    }
    return null;
  }, [sp.x, sp.z, d]);
  if (!st) { console.log(`  ${tag}: no clear standing bearing at ${d} m`); return; }
  const yaw = Math.atan2(sp.x - st.x, -(sp.z - st.z)) + turn;
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [st.x, st.z, yaw, sp.gy]);
  await page.waitForTimeout(500);
  // READ THE PROMPT THE WAY THE PAGE ACTUALLY SHOWS IT. My first version
  // queried #prompt/.prompt and got "(nothing)" at every station INCLUDING the
  // one D's script reads a prompt at - a reader that never reads anything
  // (GOTCHAS §34). A "not offered" claim would have passed vacuously.
  const p = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/\[E\][^\n]*/);
    return m ? m[0] : '';
  });
  const dist = Math.hypot(st.x - sp.x, st.z - sp.z);
  console.log(`  ${tag}: standing ${dist.toFixed(2)} m away -> ${p ? JSON.stringify(p) : '(nothing)'}`);
  await page.screenshot({ path: `shots/H-fed-${tag}.png` });
};

await read(5, 0, '5m-facing');
await read(5, Math.PI / 2, '5m-turned');
await read(3, 0, '3m-facing');
await read(8, 0, '8m-facing');
await b.close();

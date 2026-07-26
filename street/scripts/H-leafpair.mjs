// H (verifier): G's leaf-pair row, at G's own station — "stand inside either
// room on the door's own x, 4.2 m back, facing the doors — both pulls must
// flank the MEETING LINE with daylight between them, not sit out at the jambs".
// BOTH rooms, because the row is about a mirrored pair (GOTCHAS §27).
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.doors, null, { timeout: 60000 });
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
for (const name of ['SEVENS', 'HOTEL ORPHEUS']) {
  const d = await p.evaluate((n) => window.__ct.doors().find((q) => q.building === n), name);
  await p.evaluate(([x, z, nx, nz]) => window.__ct.warp(x, z, Math.atan2(-nx, nz), window.__ct.groundAt(x, z), 0),
    [d.stand.x, d.stand.z, d.point.nx, d.point.nz]);
  await p.waitForTimeout(600);
  await p.mouse.click(480, 300); await p.waitForTimeout(200);
  console.log(`${name}: outside prompt ${await prompt() || '(nothing)'}`);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(1100);
  const inside = await p.evaluate(() => window.__ct.pos());
  console.log(`  arrived inside at (${inside[0].toFixed(2)}, ${inside[2].toFixed(2)})`);
  // back up along the room's inward axis and turn to face the doors
  const back = await p.evaluate(([ix, iz, dist]) => {
    // the door we came through is behind us; sample 8 bearings for the one that
    // is clear to stand 4.2 m along and still on the same floor
    const gy = window.__ct.groundAt(ix, iz);
    for (const s of [1, -1]) for (const ax of ['z', 'x']) {
      const x = ax === 'x' ? ix + s * dist : ix, z = ax === 'z' ? iz + s * dist : iz;
      if (Math.abs(window.__ct.groundAt(x, z) - gy) > 0.3) continue;
      let hit = false;
      for (const c of window.__ct.colliders())
        if (x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3) { hit = true; break; }
      if (!hit) return { x, z };
    }
    return null;
  }, [inside[0], inside[2], 4.2]);
  if (!back) { console.log('  no clear stand 4.2 m back'); continue; }
  const yaw = Math.atan2(inside[0] - back.x, -(inside[2] - back.z));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0), [back.x, back.z, yaw]);
  await p.waitForTimeout(700);
  const tag = name.split(' ')[0].toLowerCase();
  await p.screenshot({ path: `shots/H-leaf-${tag}.png` });
  console.log(`  stood 4.2 m back at (${back.x.toFixed(2)}, ${back.z.toFixed(2)}) facing the doors -> shots/H-leaf-${tag}.png`);
}
await b.close();

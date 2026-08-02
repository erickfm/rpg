// H (verifier): O's jail, at O's own stations.
// (1) anywhere in the side street facing east - can you tell what it is before
//     you can read the plate?  (2) on the pavement at its foot, looking up.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
const at = async (x, z, yaw, pitch, tag) => {
  const ok = await p.evaluate(([a, c]) => {
    for (const q of window.__ct.colliders())
      if (a > q.minX - 0.35 && a < q.maxX + 0.35 && c > q.minZ - 0.35 && c < q.maxZ + 0.35) return false;
    return true;
  }, [x, z]);
  await p.evaluate(([a, c, y, pi]) => window.__ct.warp(a, c, y, window.__ct.groundAt(a, c), pi), [x, z, yaw, pitch]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/H-jail-${tag}.png` });
  console.log(`  ${tag}: (${x}, ${z}) yaw ${yaw.toFixed(2)} pitch ${pitch}  standable=${ok}`);
};
// down the side street from well back, facing east at the closed end
await at(20, -103, Math.PI / 2, -0.02, 'from-street');
await at(40, -103, Math.PI / 2, -0.02, 'closer');
// on the new pavement at its foot, looking up
await at(56, -103, Math.PI / 2, 0.30, 'at-foot');
await b.close();

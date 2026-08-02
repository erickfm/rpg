// Ad-hoc: count car groups vs registered colliders in the used-car lot, to
// measure the gap the debug overlay found (bay 1's hood-up car has no box).
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4198/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 10000 });

const out = await page.evaluate(() => {
  const scene = window.__ct.scene();
  // Find the lot module's marker: top-level children whose userData.mod === 'lot'
  const lotTop = scene.children.filter((c) => c.userData?.mod === 'lot');
  // Car groups: THREE.Group objects directly under the lot mark that contain a
  // car body (heuristic: has >0 children and one descendant is a Group itself,
  // since makeCar returns a Group added into g0). We'll instead just count
  // Groups whose position.y is near the lot's Y and that have children.
  const groups = lotTop.filter((o) => o.type === 'Group');
  const carLike = groups.map((g) => ({
    x: +g.position.x.toFixed(2), y: +g.position.y.toFixed(2), z: +g.position.z.toFixed(2),
    children: g.children.length,
  }));

  const colliders = window.__ct.colliders();
  // Car-sized colliders per the loop: minX: x-1.4, maxX: x+1.4, minZ: z-2.0, maxZ: z+2.0
  // => size 2.8 x 4.0
  const carColliders = colliders.filter((c) => {
    const sx = c.maxX - c.minX, sz = c.maxZ - c.minZ;
    return Math.abs(sx - 2.8) < 0.05 && Math.abs(sz - 4.0) < 0.05;
  }).map((c) => ({ x: +((c.minX + c.maxX) / 2).toFixed(2), z: +((c.minZ + c.maxZ) / 2).toFixed(2) }));

  return { totalLotTop: lotTop.length, groupCount: groups.length, carLike, colliderCount: colliders.length, carColliders };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();

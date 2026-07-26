// The shelter at the far end of the park: the roof, and the bench under it.
//
// Both were findings in `notes/E-civic-report.md` and both are about the same
// mistake — a thing built by hand instead of through the helper every other
// one goes through. The roof was pitched and drawn under a slab; the bench was
// a bench that never called `ctx.seat`.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
// DOES THE ROOF SIT ON THE POSTS. This script took four photographs and
// asserted nothing, so it watched the roof float 0.20 m clear of all four
// posts through two rebuilds and a user complaint. Photographs are for
// looking; this is the part that can fail.
const shelter = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const posts = [], roofs = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = bb.getCenter(new V3()), s = bb.getSize(new V3());
    if (c.x > -32 || c.x < -40 || c.z > -79 || c.z < -87) return;
    // A post: square, thin, and 2.4 m tall. The height BOUND matters — without
    // an upper one this caught B's 3.4 m lamp columns standing nearby and
    // reported six posts of two different heights, which is a fault in the
    // locator being read as a fault in the shelter.
    if (s.y > 2.0 && s.y < 3.0 && s.x < 0.4 && s.z < 0.4) posts.push({ x: c.x, z: c.z, top: bb.max.y });
    if (s.x > 3 && s.z > 3 && bb.max.y > 2.5) roofs.push({ bb, minY: bb.min.y, maxY: bb.max.y, cx: c.x, cz: c.z });
  });
  if (!posts.length || !roofs.length) return { posts, roofs: roofs.length };

  return { posts, roof: roofs[0] ? { minY: roofs[0].minY, maxY: roofs[0].maxY, cx: roofs[0].cx, cz: roofs[0].cz } : null };
});
if (!shelter.posts?.length) {
  console.log('EXIT 3: found no shelter posts to measure — the locator is wrong, not the park');
  await b.close(); process.exit(3);
}
{
  const tops = shelter.posts.map((p) => +p.top.toFixed(3));
  const same = Math.max(...tops) - Math.min(...tops);
  console.log(`${shelter.posts.length} posts, tops ${Math.min(...tops).toFixed(2)}-${Math.max(...tops).toFixed(2)}`);
  console.log(`roof underside ${shelter.roof.minY.toFixed(2)}, apex ${shelter.roof.maxY.toFixed(2)}`);
  const fails = [];
  if (shelter.posts.length !== 4) fails.push(`POSTS: ${shelter.posts.length}, not four`);
  if (same > 0.01) fails.push(`POSTS: tops differ by ${same.toFixed(2)} m — they must be identical`);
  // the eaves must hang BELOW the post top: that is what makes it read as a
  // roof over you rather than a parasol above you
  if (shelter.roof.minY >= Math.min(...tops)) {
    fails.push(`ROOF: underside ${shelter.roof.minY.toFixed(2)} is at or above the post tops ${Math.min(...tops).toFixed(2)} — it floats`);
  }
  for (const f of fails) console.log('FAIL ', f);
  if (!fails.length) console.log(`PASS  four identical posts, eaves ${(Math.min(...tops) - shelter.roof.minY).toFixed(2)} m below their tops`);
  if (fails.length) { await b.close(); process.exit(1); }
}
await page.evaluate(() => window.__ct.clock(13, 20));
const shot = async (n, x, z, yaw, pitch = 0.0) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/E-shelter/${n}.png` });
};
// the view that matters: down the park's axis from the gate, 26 m away
await shot('a-from-the-gate', -8.6, -83.0, -Math.PI / 2, 0.02);
await shot('b-half-way', -22.0, -83.0, -Math.PI / 2, 0.03);
await shot('c-standing-under-it', -35.9, -83.0, Math.PI / 2, 0.55);
// three-quarter, off the back leg: yaw = atan2(dx, -dz) in this world's
// convention, which is worth writing down — the first attempt at this shot
// guessed it and put the camera inside the boundary hedge.
await shot('d-three-quarter', -33.0, -79.4, Math.atan2(-2.9, 3.6), 0.05);
await b.close();

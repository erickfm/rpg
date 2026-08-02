// ITEM 128: what is the scene graph SHAPED like, so a prune can be designed
// against it rather than guessed at? Prints the top-level children of the scene
// with their descendant mesh counts and world bounding boxes.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w52-scene-shape.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(3000);

const out = await p.evaluate(() => {
  const scene = window.__ct.scene();
  const rows = [];
  for (const c of scene.children) {
    let meshes = 0, objs = 0;
    c.traverse((o) => { objs++; if (o.isMesh) meshes++; });
    rows.push({ name: c.name || '(unnamed)', type: c.type, meshes, objs });
  }
  let meshes = 0;
  scene.traverse((o) => { if (o.isMesh) meshes++; });
  return { total: meshes, kids: scene.children.length, rows };
});
console.log(`scene: ${out.kids} top-level children, ${out.total} meshes total\n`);
out.rows.sort((a, b) => b.meshes - a.meshes);
for (const r of out.rows.slice(0, 30)) {
  console.log(`  ${String(r.meshes).padStart(5)} meshes  ${String(r.objs).padStart(5)} objs  ${r.type.padEnd(10)} ${r.name}`);
}
await browser.close();

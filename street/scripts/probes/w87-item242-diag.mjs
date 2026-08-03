// ITEM 242 diagnostic — exactly which top-level groups my traffic probe is
// counting as "vehicles", and where each one is. Written because the probe
// reported 450 "hidden vehicles not at the idle coord" against a world whose
// origin census says the pool moved correctly, and a disagreement between two
// of my own instruments has to be settled before either is quoted.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 520 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(6000);
const out = await p.evaluate(() => {
  const s = window.__ct.scene();
  const rows = [];
  for (const c of s.children) {
    if (!c.userData || c.userData.wheelbase === undefined) continue;
    rows.push({ vis: c.visible, x: +c.position.x.toFixed(2), z: +c.position.z.toFixed(2),
      wb: c.userData.wheelbase, kind: c.userData.kind || '', lane: c.userData.laneX ?? null,
      children: c.children.length });
  }
  return { total: s.children.length, rows };
});
console.log(`scene top-level children: ${out.total}`);
console.log(`groups carrying userData.wheelbase: ${out.rows.length}\n`);
for (const r of out.rows) {
  console.log(`  visible=${String(r.vis).padEnd(5)} pos (${String(r.x).padStart(8)}, ${String(r.z).padStart(8)})  wheelbase ${r.wb}  laneX ${r.lane}  kids ${r.children}`);
}
await b.close();

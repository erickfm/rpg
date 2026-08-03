// ITEM 280 — the jail bunk, from far enough back to SEE it.
//
// The 14-camera sweep stands 1.8 m from each sitter's ORIGINAL position. The
// man on the bunk moves 0.70 m — the largest offset in the change — so in the
// after frame he is 1.1 m from the lens and his legs fall outside the viewport.
// That is a framing artifact, not a verdict, and a cropped frame is exactly the
// kind of picture this project keeps mistaking for evidence.
//
// The camera below is anchored to the CELL, not to the man, and stands back far
// enough to hold him whole in both states.
//
// Usage: SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-bunk-look.mjs <label>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const label = process.argv[2] ?? 'now';
const URL = aim('http://localhost:4690/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p, { quiet: true });
await reportWorld(p, URL);

// The bunk MATTRESS is the anchor: 1.84 x 0.09 x 0.64, and it does not move.
// THE CELL BLOCK HAS SEVERAL, and only one has a man in it — taking whichever
// the traversal happened to reach last photographed an empty cell 8 m from the
// figure this item is about. So: collect them all, and keep the one nearest the
// seated sprite. (The sprite MOVES between the two runs, by 0.70 m; the
// mattress it picks is 2.4 m from its nearest neighbour, so the choice is
// stable either way.)
const anchor = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const mats = []; let man = null;
  s.traverse((n) => {
    if (!n.isMesh) return;
    const e = n.matrixWorld.elements;
    if (n.userData?.seated && e[12] > 900 && e[12] < 1100 && Math.abs(e[13] - 0.595) < 0.05)
      man = { x: e[12], z: e[14] };
    if (n.geometry?.type !== 'BoxGeometry') return;
    const g = n.geometry.parameters || {};
    if (Math.abs(g.width - 1.84) > 1e-3 || Math.abs(g.depth - 0.64) > 1e-3) return;
    if (e[12] > 900 && e[12] < 1100) mats.push({ x: e[12], y: e[13], z: e[14] });
  });
  if (!man || !mats.length) return null;
  mats.sort((a, c) => Math.hypot(a.x - man.x, a.z - man.z) - Math.hypot(c.x - man.x, c.z - man.z));
  return { ...mats[0], man };
});
if (!anchor) { console.error('MISS: no jail bunk mattress'); process.exit(3); }
console.log(`bunk mattress at (${anchor.x.toFixed(2)}, ${anchor.z.toFixed(2)})`);

// Stand in the corridor, out from the foot of the bunk, looking back down it.
// CAM_D / CAM_DZ are tunable because the CELL DOOR'S BARS are between you and
// him: the first vantage put a 0.035 m bar straight down the figure, and the
// question "does he have legs" cannot be answered through one. Sidestep until
// he is in a gap. Both runs read the same env, so the pair stays comparable.
const CAM = { x: anchor.x + (+process.env.CAM_D || 3.0),
  z: anchor.z + (+process.env.CAM_DZ || 0) };
const yaw = Math.atan2(anchor.x - CAM.x, -(anchor.z - CAM.z));
let at = null;
for (let k = 0; k < 8; k++) {
  await p.evaluate((v) => window.__ct.warp(v.x, v.z, v.yaw, 0, -0.16), { ...CAM, yaw });
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(260);
  at = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(at[0] - CAM.x, at[2] - CAM.z) < 0.7) break;
}
console.log(`asked (${CAM.x.toFixed(2)}, ${CAM.z.toFixed(2)}) stood (${at[0].toFixed(2)}, ${at[2].toFixed(2)})`);
await p.waitForTimeout(600);
await waitPainted(p, { quiet: true });
await p.screenshot({ path: `shots/w113-280-bunk-${label}.png` });
console.log(`  shots/w113-280-bunk-${label}.png`);
await b.close();

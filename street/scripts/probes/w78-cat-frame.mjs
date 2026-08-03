// Item 219. Is `ct/cat.ts`'s user-approved alley frame unchanged?
//
// That frame was settled over SEVEN iterations against the user's own
// screenshots (`ct/cat.ts:239-300`), from the viewpoint that reproduces his
// landmarks — (-8.5, -39.5) yaw -0.785, "KOBRA on the left wall, SNAK right of
// the wall corner, both crates, the grate below centre".
//
// IT CANNOT BE ANSWERED BY DIFFING TWO SCREENSHOTS. Two runs of identical code
// differ ~20% of pixels (CLAUDE.md), and `fp` is a pure-refactor tool that this
// change is not eligible for. So the proof is STRUCTURAL and the image is only
// for looking: list every litter group that is actually INSIDE THIS CAMERA'S
// FRUSTUM, with its position, and let that list be diffed as text.
//
// Usage: SHOT_URL=http://localhost:4340/ node scripts/probes/w78-cat-frame.mjs out.png
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4340/');
const OUT = process.argv[2] ?? 'shots/w78-cat-frame.png';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
// the exact viewpoint ct/cat.ts:259 names
await p.evaluate(() => window.__ct.warp(-8.5, -39.5, -0.785, 0.14, 0));
// SET THE CLOCK AFTER THE WARP, AND CHECK IT TOOK. Setting it first produced a
// completely BLACK frame with the HUD reading 00:35 — the warp had put the hour
// back. The frustum list below is unaffected (positions do not depend on the
// light) but the picture was worthless, and a black picture is exactly the kind
// of "evidence" that gets filed without being looked at.
await p.evaluate(() => window.__ct.clock(13, 0));
// GOTCHAS 78/80: afterFrames does not mean PAINTED — ask the renderer.
await p.waitForFunction(() => window.__ct.painted?.() ?? true, { timeout: 15000 });
await p.waitForTimeout(600);

const seen = await p.evaluate(() => {
  const cam = window.__ct.camera?.() ?? null;
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.litter) return;
    const w = o.getWorldPosition(new o.position.constructor());
    out.push({ kind: o.userData.litter, x: +w.x.toFixed(3), z: +w.z.toFixed(3) });
  });
  if (!cam) return { cam: false, all: out };
  // in-frustum, asked of the real camera rather than reasoned about from a yaw
  cam.updateMatrixWorld(true);
  const inView = [];
  for (const o of out) {
    const v = new (window.__ct.scene().position.constructor)(o.x, 0.2, o.z);
    v.project(cam);
    if (v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1 && v.z > -1 && v.z < 1) inView.push(o);
  }
  return { cam: true, all: out, inView };
});

await p.screenshot({ path: OUT });
await b.close();

if (!seen.all.length) { console.log('MEASURED NOTHING — no litter in the scene. exit 3'); process.exit(3); }
console.log(`\nfrom (-8.5, -39.5) yaw -0.785 — ct/cat.ts's approved viewpoint`);
if (!seen.cam) {
  console.log('\n  __ct publishes no camera(), so the frustum test could not run.');
  console.log(`  ${seen.all.length} litter groups in the world; image at ${OUT}. exit 3`);
  process.exit(3);
}
console.log(`\n${seen.inView.length} of ${seen.all.length} litter groups are INSIDE this frame:\n`);
for (const r of seen.inView.sort((a, c) => a.x - c.x)) {
  console.log(`  ${r.kind.padEnd(22)} x ${String(r.x).padStart(8)}   z ${String(r.z).padStart(8)}`);
}
console.log(`\nimage: ${OUT}  — LOOK at it; this list is the proof, the picture is the sanity check.`);

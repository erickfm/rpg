// LOOK AT THE SIX INTERIOR FRONT DOORS item 159 closes.
//
// Screenshots are for LOOKING, never for PROVING (CLAUDE.md). The proof that
// the angle changed is `w65-leaf-angles.mjs`, which reads the world normals;
// this exists so a person can say whether a shut door in a lobby looks right,
// which no number answers.
//
// The camera is not computed from the room's furniture: the world is asked for
// the room's own door (`__ct.roomDims()`), the player is warped 3.2 m back from
// it on the room's centre line, and turned to face it. A hand-typed camera is
// how three probes photographed the inside of a wall.
//
// THE FIRST FRAME AFTER A WARP IS THROWN AWAY. GOTCHAS 78: `__ct` publishes
// before anything is drawn, and the first shot after a page load comes back
// solid black — which reads exactly like a broken room.
//
// Run: SHOT_URL=http://localhost:4211/ OUT=/tmp/w65-after node scripts/probes/w65-leaf-shot.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? (() => {
  throw new Error('SHOT_URL required — GOTCHAS 50');
})();
const OUT = process.env.OUT ?? '/tmp/w65-shots';
mkdirSync(OUT, { recursive: true });

const WANT = ['bank', 'casino', 'church', 'hotel', 'jail', 'library'];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1000);
await p.screenshot({ path: `${OUT}/_discard-first-frame.png` });

const dims = await p.evaluate(() => window.__ct.roomDims());
if (!dims?.length) { console.error('no rooms published — nothing shot'); await b.close(); process.exit(2); }

let shot = 0;
for (const id of WANT) {
  const rd = dims.find((d) => d.id === id);
  if (!rd) { console.log(`${id.padEnd(9)} MISS — the world published no room by that id`); continue; }
  const ix = rd.cx + (rd.door?.x ?? 0), iz = rd.cz + rd.d / 2;
  // yaw Math.PI faces +z, which is the wall every one of these doors is in.
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI, undefined, 0), [ix, iz - 3.2]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${id}-door.png` });
  shot++;
  console.log(`${id.padEnd(9)} shot from (${(iz - 3.2).toFixed(2)}) 3.2 m back, facing its front wall`);
}
await b.close();
console.log(`\n${shot} of ${WANT.length} doors photographed into ${OUT}`);
process.exit(shot === WANT.length ? 0 : 1);

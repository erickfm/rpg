// Item 267 — the rail stopped at the jamb; can you still WALK through?
//
// A rail is decoration and should carry no collider, but "should" is not a
// measurement and BUILDER-BRIEF §10 is explicit: movement, collision and floors
// are verified by WALKING them. Splitting one box into two created two new
// meshes either side of the opening, and the cheap way to be wrong here is to
// have put one of them across the threshold.
//
// Every coordinate is read from `__ct.roomDims()` and `__ct.party()` — the same
// declaration `ct/interior.ts` cuts the hole from — so this cannot walk at a
// doorway that has moved.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const RUNS = Number(process.env.RUNS ?? 5);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const geo = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const pw = window.__ct.party()[0];
  const by = (id) => rooms.find((r) => r.id === id);
  return { east: by(pw.east), west: by(pw.west), pw };
});
const { east, west, pw } = geo;
const z = east.cz + pw.at;
const wallX = east.cx - east.w / 2;
console.log(`\nparty doorway between ${pw.west} and ${pw.east} at world z ${z.toFixed(2)},`
  + ` wall x ${wallX.toFixed(2)}, opening ${pw.w} m wide\n`);

const walk = async (x0, yaw, ms = 2600) => {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0), [x0, z, yaw]);
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w');
  await p.waitForTimeout(ms);
  await p.keyboard.up('w');
  await p.waitForTimeout(150);
  const c = await p.evaluate(() => window.__ct.pos());
  return { x0: a[0], x1: c[0] };
};

// yaw −π/2 walks toward −x (fwd = (sin yaw, 0, −cos yaw), crosstown.ts:1195).
let bad = 0;
for (const [name, x0, yaw, want] of [
  [`${pw.east} -> ${pw.west}`, wallX + 3.0, -Math.PI / 2, (x) => x < wallX - 0.6],
  [`${pw.west} -> ${pw.east}`, wallX - 3.0, Math.PI / 2, (x) => x > wallX + 0.6],
]) {
  const ends = [];
  for (let r = 0; r < RUNS; r++) ends.push((await walk(x0, yaw)).x1);
  const through = ends.filter(want).length;
  if (through !== RUNS) bad++;
  console.log(`  ${through === RUNS ? 'ok  ' : 'FAIL'}  ${name.padEnd(18)}`
    + ` ${through}/${RUNS} got through   ended x ${ends.map((e) => e.toFixed(2)).join(' ')}`);
}
console.log(bad ? '\nFAIL — the doorway does not walk both ways' : '\nthe doorway walks both ways');
await b.close();
process.exit(bad ? 1 : 0);

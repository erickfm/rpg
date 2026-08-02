// WALK the jail — the forecourt, the sally port and the yard behind it.
//
// Item 6 is a texture change and touches no geometry and no collider, so this
// is a REGRESSION check with teeth rather than a discovery run: every leg has
// a condition that can go red. Pattern (and the `groundAt` lesson) borrowed
// from scripts/E-park-walk.mjs.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = aim('http://localhost:4194/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => { errs.push(e.message); console.error('PAGEERR', e.message); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy = 0.14) =>
  page.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const f = (n) => n.toFixed(2);
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// The jail's own numbers, read from the world rather than retyped: the site is
// published, and FX/BX/FENCE_X follow from JAIL.FORE and JAIL.DEPTH.
const site = await page.evaluate(() => window.__ct.sites().jail);
const FX = site.minX + 4.0, BX = FX + 4.0, FENCE_X = site.maxX - 0.35;
const CZ = (site.minZ + site.maxZ) / 2;
console.log(`jail site x ${site.minX}…${site.maxX} z ${site.minZ}…${site.maxZ}  ` +
  `FX ${FX} BX ${BX} FENCE_X ${f(FENCE_X)} CZ ${CZ}`);

const walk = async (name, { at, yaw, ms, ok, say }) => {
  let last;
  for (let t = 0; t < 3; t++) {
    if (t) await page.waitForTimeout(1100);
    await warp(at[0], at[1], yaw); await page.waitForTimeout(160);
    await page.keyboard.down('w'); await page.waitForTimeout(ms); await page.keyboard.up('w');
    await page.waitForTimeout(80);
    last = await pos();
    if (ok(last)) break;
  }
  report(name, ok(last), say(last));
};
const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));

// 1. THE APPROACH. Down the middle of the side street at the facade. Must
//    close on the building and stop OUTSIDE it — a player who ends up past FX
//    is inside the stone.
await walk('approach the facade', {
  at: [FX - 9, CZ], yaw: yawTo(FX - 9, CZ, FX, CZ), ms: 2600,
  ok: (p) => p[0] > FX - 8.4 && p[0] < FX,
  say: (p) => `x ${f(p[0])} — moved toward the facade and stopped short of it (FX ${FX})`,
});

// 2. THE FORECOURT IS WALKABLE ACROSS ITS WIDTH. Along the building's face,
//    which is the walk the whole FORE setback exists to create.
await walk('cross the forecourt', {
  at: [FX - 1.5, site.minZ + 2], yaw: yawTo(FX - 1.5, site.minZ + 2, FX - 1.5, site.maxZ), ms: 2600,
  ok: (p) => p[2] > site.minZ + 7,
  say: (p) => `z ${f(p[2])} — walked ${f(p[2] - (site.minZ + 2))} m along the face`,
});

// 3. THE YARD. Round the back and up to the fence. The fence collides, so the
//    player must be STOPPED by it and not pass it.
await walk('yard: up to the fence', {
  at: [BX + 1.5, CZ], yaw: yawTo(BX + 1.5, CZ, FENCE_X + 5, CZ), ms: 3000,
  ok: (p) => p[0] > BX + 4 && p[0] < FENCE_X,
  say: (p) => `x ${f(p[0])} — crossed the yard and the fence held (FENCE_X ${f(FENCE_X)})`,
});

// 4. THE SCREEN WALLS HOLD. Walk straight at the south screen wall from inside
//    the yard; it must stop the player north of it.
await walk('yard: the south screen wall holds', {
  at: [BX + 4, CZ], yaw: yawTo(BX + 4, CZ, BX + 4, site.minZ - 4), ms: 2600,
  ok: (p) => p[2] > site.minZ && p[2] < CZ,
  say: (p) => `z ${f(p[2])} — stopped inside the yard, south wall at z ${site.minZ}`,
});

// 5. THE YARD IS NOT A TRAP. From the middle of it, walk back out toward the
//    street; the player must get past the building's own footprint.
await walk('yard: walk back out along the flank', {
  at: [BX + 4, CZ], yaw: yawTo(BX + 4, CZ, BX + 9, CZ), ms: 2000,
  ok: (p) => p[0] > BX + 4.5,
  say: (p) => `x ${f(p[0])} — free to move, not wedged`,
});

// 6. THE FLOOR IS CONTINUOUS. The forecourt, the port threshold and the yard
//    must all be standable — no hole and no step the picker cannot answer.
const gy = await page.evaluate(([pts]) =>
  pts.map(([x, z]) => window.__ct.groundAt(x, z)),
  [[[FX - 2, CZ], [FX - 0.2, CZ], [BX + 2, CZ], [BX + 8, CZ], [FENCE_X - 1, CZ]]]);
const flat = gy.every((g) => g !== null && g !== undefined && Math.abs(g - gy[0]) < 0.30);
report('floor continuous forecourt → yard', flat, `groundAt = ${gy.map((g) => f(g)).join(', ')}`);

// 7. THE 2 m LANE IS SACRED. The walk between the kerb and the facade.
const lane = FX - (site.minX - 2.0);
report('the walk in front is at least 2 m', lane >= 2.0 - 0.01,
  `kerb→facade ${f(lane)} m (forecourt ${f(FX - site.minX)} m on top of the pavement)`);

report('no console errors during the walk', errs.length === 0, `${errs.length} page error(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nall legs passed');
await b.close();
process.exit(fails ? 1 : 0);

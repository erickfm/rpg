// C's second respawn matrix. `scripts/respawn.mjs` is another agent's and
// stays theirs — this does not replace it, it covers the case that one
// cannot distinguish: theirs asserts a lost floor inside the walk-up sends
// you home, which was RED because the floor picker caught the player on the
// top landing before the lost-test ran. This separates ABOVE from BELOW and
// adds the controls that stop the bug being 'fixed' by respawning everybody.
// RESPAWN PUTS YOU IN 301 — the user, twice: *"also make me spawn in my room"*
// and *"i want the respawn to be my room"*.
//
// Spawn was delivered and respawn was not, and the way it failed is worth
// stating because it is not the obvious one: nothing teleported the player to
// the roof. The walk-up's floor picker CAUGHT them there. `consider()` refuses
// to step up more than 0.6 m and puts no limit on stepping down, so a player
// above the building is snapped onto the nearest candidate — the top landing —
// and by the time the respawn hook is handed a `gy` there is no longer a bad
// one to see.
//
// So this tests from ABOVE as well as below, and from several places, because
// a respawn that only fires when you fall through the floor is the half that
// already worked.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 660 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 900));

const SP = await p.evaluate(() => window.__ct.scene().userData.spawn);
if (!SP) {
  console.error('\nscene.userData.spawn is missing — nothing to compare against.');
  await b.close(); process.exit(3);                  // GOTCHAS 32: 3, not 1
}
let fails = 0;
const rep = (n, ok, d) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${d}`); };
const pos = () => p.evaluate(() => window.__ct.pos());
const home = (q) => Math.hypot(q[0] - SP.x, q[2] - SP.z) < 1.0 && Math.abs(q[3] - SP.gy) < 0.3;

console.log(`\n  SPAWN, which is also the respawn point and the coordinate the desk asked for:`);
console.log(`    x ${SP.x}  z ${SP.z}  gy ${SP.gy}  yaw ${SP.yaw.toFixed(4)}  (room 301, third floor)\n`);

const q0 = await pos();
rep('the player starts there', home(q0), `loaded at (${q0[0].toFixed(2)}, ${q0[2].toFixed(2)}) gy ${q0[3].toFixed(2)}`);

// LOST, from a range of places and both directions. Each is left long enough
// for the hook's own debounce plus a few frames, not a fixed guess at a frame
// rate — GOTCHAS 30.
const lose = async (tag, x, z, gy, wantHome = true) => {
  await p.evaluate(([a, c, g]) => window.__ct.warp(a, c, 0, g, 0), [x, z, gy]);
  const t0 = Date.now();
  let q = await pos();
  while (Date.now() - t0 < 2500) {
    q = await pos();
    if (home(q)) break;
    await p.waitForTimeout(100);
  }
  rep(tag, home(q) === wantHome,
    `ended (${q[0].toFixed(2)}, ${q[2].toFixed(2)}) gy ${q[3].toFixed(2)} — ${home(q) ? 'in 301' : 'not in 301'}`);
  return q;
};

console.log('  ABOVE the building — the case that was broken:');
await lose('dropped in over the stairwell', 198.6, -16.3, 12);
await lose('dropped in over the landing', 201.0, -16.5, 9.8);
await lose('dropped in far above', 199.5, -18.0, 40);

console.log('\n  BELOW it — the half that already worked, kept honest:');
await lose('fell through the third floor', 198.6, -16.3, -3);
await lose('fell through the lobby', 201.2, -13.0, -12);

console.log('\n  and the floors that are REAL must not bounce you:');
await lose('standing on the top landing', 198.6, -16.3, 8.1, false);
await lose('standing in the lobby', 198.6, -16.3, 0, false);
await lose('standing on the second floor', 198.6, -16.3, 2.7, false);

// The street cannot lose you at all — its picker answers everywhere — so the
// walk-up hook deliberately returns early outside it. Stated rather than
// assumed, because "respawn only works in the building" should be a decision
// somebody can see, not something a reader has to infer from an early return.
await p.evaluate(() => window.__ct.warp(0, 0, 0, -30, 0));
await p.waitForTimeout(900);
const st = await pos();
rep('the street cannot lose you (so nothing to respawn from)', Math.abs(st[3]) < 0.5,
  `warped to gy -30 on the street and the ground picker put you at gy ${st[3].toFixed(2)}`);

await p.evaluate(([a, c, g]) => window.__ct.warp(a, c, -Math.PI / 2, g, 0), [SP.x, SP.z, SP.gy]);
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/respawn-301.png' });
await b.close();
console.log(fails ? `\n  ${fails} failed\n` : '\n  lost anywhere in the walk-up, above or below, and you wake up in 301.\n');
process.exit(fails ? 1 : 0);

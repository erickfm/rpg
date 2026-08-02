// PICTURES OF THE FIRST FEDERAL INTERIOR — an investigation, not an assertion.
//
// Named `-shots` on purpose (GOTCHAS 24): the assertion suite for this room is
// `M-bank-int-walk.mjs`, and a screenshot script that took the name `bankint`
// would be the thing that quietly replaces it on some future rebase.
//
// Every station is found by ASKING the world where the room is — `roomDims()`
// publishes the resolved centre and size — so it cannot be aimed at a stale
// offset the way five hand-typed room coordinates in this project have been.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { setClock } from '../lib/clock.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4204/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const R = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => r.id === 'bank'));
if (!R) { console.error('no room with id "bank" — the belt did not build it'); process.exit(3); }
console.log(`bank room: cx ${R.cx.toFixed(2)} cz ${R.cz.toFixed(2)} `
  + `${R.w.toFixed(2)} x ${R.d.toFixed(2)} m, door local x ${R.door.x.toFixed(2)}`);

const wx = (lx) => R.cx + lx, wz = (lz) => R.cz + lz;
const hd = R.d / 2, hw = R.w / 2;
// yaw 0 = looking -z (into the room). Same convention as the rig.
const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));

// The stations a PLAYER stands in, in the order they meet them walking in.
const shots = [
  ['arrive',    0,        hd - 1.15,  0,        -hd + 1,   0.00],
  ['counter',   0,        -1.6,       0,        -hd,       0.00],
  ['window2',   1.8,      -3.0,       1.8,      -hd,      -0.06],
  ['vault-far', -1.0,     0.4,        -5.4,     -3.0,      0.00],
  ['vault-mouth', -5.4,   -2.0,       -5.4,     -hd,       0.00],
  ['vault-in',  -5.4,     -4.6,       -4.2,     -4.2,      0.00],
  ['east',      hw - 1.6, 1.0,        -hw,      -1.0,      0.02],
  ['back-to-door', 0,     -2.4,       0,        hd,        0.04],
  ['loandesk',  4.4,      4.2,        4.4,      0.8,      -0.04],
  ['loandesk-seat', 4.4,  2.62,       4.4,      0.8,      -0.10],
  ['the-form',  4.0,      2.9,        3.75,     1.9,      -0.34],
  ['waiting',   3.6,      -1.2,       hw,       -1.2,      0.06],
  ['island',    -0.6,     3.2,        -2.4,     1.2,      -0.10],
  ['queue',     0.4,      0.4,        0.4,      -hd,       0.00],
  ['vault-door-back', -6.2, -4.4,     -4.6,     -2.1,      0.00],
];
for (const [tag, sx, sz, tx, tz, pitch] of shots) {
  await setClock(p, 14, 20);
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0, pi),
    [wx(sx), wz(sz), yawTo(sx, sz, tx, tz), pitch]);
  await p.waitForTimeout(420);
  await p.screenshot({ path: `shots/M-bankint-${tag}.png` });
  console.log(`  M-bankint-${tag}  from local (${sx.toFixed(1)}, ${sz.toFixed(1)})`);
}
// and once after dark, because an interior keeps its own light around the clock
// and a room that only works at 14:20 is half checked
await setClock(p, 23, 10);
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
  [wx(0), wz(hd - 1.15), 0]);
await p.waitForTimeout(420);
await p.screenshot({ path: 'shots/M-bankint-night.png' });
console.log('  M-bankint-night');
await b.close();

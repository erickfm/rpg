// The front door from both sides, one after the other — the only way to see
// whether it is the same door. Report finding 1.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const out = process.argv[2] ?? 'shots/lobbydoor';
mkdirSync(out, { recursive: true });
const at = (dx, dz) => Math.atan2(dx, -dz);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(600);
const SH = [
  // street side: FACE is 7, the door is at z -44
  ['01-street',      4.6, -44.0, at(2.6, 0),    0.10, 0.14],
  ['02-street-close',5.6, -44.0, at(1.4, 0),    0.16, 0.14],
  ['03-street-obliq',5.2, -46.4, at(1.9, 2.4),  0.10, 0.14],
  // lobby side: APT_X 200, APT_Z -20
  ['04-lobby',      201.2, -18.6, at(0, -1.5), 0.10, 0],
  ['05-lobby-close',201.2, -19.3, at(0, -1.0), 0.14, 0],
  ['06-lobby-obliq',201.9, -18.9, at(-0.7, -0.9), 0.08, 0],
  ['07-lobby-back', 201.2, -16.0, at(0, -4.0), 0.06, 0],
  ['08-mailboxes',  201.3, -18.7, at(1.0, 0),   0.02, 0],
  ['09-mail-obliq', 201.1, -17.2, at(1.2, -1.5),0.02, 0],
  // 301's window: room is west of the hall, floor 3 (gy 5.4)
  ['10-301-window', 197.6, -16.25, at(-1.4, 0), 0.06, 5.4],
  ['11-301-win-obl',197.9, -17.4, at(-1.7, 1.1),0.04, 5.4],
  ['12-301-win-far',198.9, -16.25, at(-2.7, 0), 0.02, 5.4],
  ['13-knob-201',   200.9, -16.5, at(-0.85, 0),  -0.04, 2.7],
  ['14-knob-obliq', 201.3, -17.3, at(-1.2, 0.8), -0.02, 2.7],
  ['15-radiator',   197.9, -16.4, at(-0.9, 0.2), -0.34, 5.4],
  ['16-drawer',     198.7, -17.2, at(-1.3, -0.5), -0.36, 5.4],
  ['17-radiator-ft',198.3, -16.4, at(-1.2, 0.1), -0.52, 5.4],
  // the top landing guard: floor 3, east half of the shaft
  ['18-top-guard',  201.6, -12.4, at(-1.0,  2.0), -0.16, 8.1],
  ['19-top-guard-2',200.6, -12.0, at(0.0,   1.6), -0.22, 8.1],
  // the cellar gate: under the stairs, CXM 201.8, at z = AZI(8.4) = -11.6
  ['20-cellar-gate',201.8, -13.9, at(0.0,  2.3), -0.10, 0],
  ['21-cellar-lock',201.8, -12.4, at(0.0,  0.8), -0.06, 0],
  ['22-cellar-obliq',201.0,-13.2, at(0.8,  1.6), -0.08, 0],
  // half landing 1 (y = RISE = 1.35): the turn is at AZI(10.6) = -9.4
  ['23-landing-turn',201.2, -7.6, at(0.0,  -2.4), 0.10, 1.35],
  ['24-landing-up',  201.2, -6.4, at(0.0,  -3.6), 0.26, 1.35],
  ['25-landing-arriv',200.6, -9.9, at(0.6,   1.2), 0.14, 1.35],
];
for (const [n, x, z, yaw, pitch, gy] of SH) {
  await p.evaluate(([a,b2,c,d,e]) => window.__ct.warp(a,b2,c,d,e), [x, z, yaw, gy, pitch]);
  await p.waitForTimeout(340);
  await p.screenshot({ path: `${out}/${n}.png` });
}
await b.close();
console.log(`lobbydoor -> ${out}`);
if (errs.length) { console.error('PAGE ERRORS:\n' + errs.join('\n')); process.exit(1); }

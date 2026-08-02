// B's curb cut at the car lot, from the street and from on it. SHOTS ONLY.
//
// Renamed from curbcut.mjs. It collided with an existing measurement script of
// the same name and, on a rebase, mine won and theirs vanished — silently,
// because a script that is gone does not fail, it stops being run. The kerb
// profile and the control walk went with it, and the curb cut could have been
// deleted whole without a check going red (a84cf885). Theirs is back as
// scripts/kerbcut.mjs. Theirs measures; this one takes the pictures.
// The cut is z 2.6, half-width 3.4, with 0.9 m flares — the same centre and
// width as ct/lot.ts's drive aisle, so the two have to line up exactly.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';
const URL = aim('http://localhost:4190/');
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'shots/curbcut';
mkdirSync(out, { recursive: true });
const at = (dx, dz) => Math.atan2(dx, -dz);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await setClock(p, 13, 0);   // waits for the frame that applies it, not a guess
const SH = [
  ['01-from-road',    -1.0,  2.6, at(9.0,  0.0), -0.10, 0.14],
  ['02-oblique-s',    -1.0, -4.0, at(9.0,  7.0), -0.12, 0.14],
  ['03-oblique-n',    -1.0,  9.0, at(9.0, -7.0), -0.12, 0.14],
  ['04-close',         4.2,  2.6, at(4.0,  0.0), -0.34, 0.14],
  ['05-along-walk',    6.1,  9.0, at(0.0, -7.0), -0.22, 0.14],
  ['06-along-walk-s',  6.1, -4.0, at(0.0,  7.0), -0.22, 0.14],
  ['07-from-inside',   9.5,  2.6, at(-8.0, 0.0), -0.16, 0.14],
  ['08-gutter',        3.6,  2.6, at(3.0,  0.0), -0.52, 0.14],
];
for (const [n, x, z, yaw, pitch, gy] of SH) {
  await p.evaluate(([a, b2, c, d, e]) => window.__ct.warp(a, b2, c, d, e), [x, z, yaw, gy, pitch]);
  await p.waitForTimeout(340);
  await p.screenshot({ path: `${out}/${n}.png` });
}
await b.close();
console.log(`curbcut -> ${out} (${SH.length})`);
if (errs.length) { console.error('PAGE ERRORS:\n' + errs.join('\n')); process.exit(1); }

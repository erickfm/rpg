// D's INVESTIGATION camera. Not an assertion — it takes pictures from named
// viewpoints so a placement can be judged by eye, which is the only way the
// user's placement notes have ever been settled (five cat positions, four
// crate attempts). GOTCHAS §24: named for what it does, not for its subject.
//
//   SHOT_URL=http://localhost:4181/ node scripts/D-look.mjs <view> [<view>…]
//
// A view is `name:x,z,yaw[,pitch][,gy]` — yaw and pitch in radians, world
// metres. `--list` prints the built-in ones.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { setClock } from '../lib/clock.mjs';

const URL = aim('http://localhost:4181/');
const OUT = process.env.SHOT_DIR ?? 'shots';

// The viewpoints the user's own screenshots were taken from, as near as they
// can be reproduced. Each one is the frame a request was made in.
//
// YAW CONVENTION, measured rather than assumed — forward is
// `(sin yaw, 0, −cos yaw)`, so yaw 0 looks −z, yaw π looks +z, yaw −π/2 looks
// −x, and SCREEN RIGHT is `cross(forward, up)`. Getting this backwards is how
// a "move it right" note gets built as a move left (GOTCHAS §33).
const VIEWS = {
  // the two produce crates on the side-street frontage. The wall they stand
  // against is the bodega wing's front at z = −96.0, so this looks +z at it.
  crates: [9.6, -98.3, Math.PI, -0.20],
  cratesq: [10.5, -97.6, Math.PI, -0.32],   // square on, close, the user's own angle
  // the bodega's canted bay, from the crossing it addresses — the awning and
  // the sign band over the door only read from out here
  bay: [5.0, -98.2, 2.356, 0.14],
  baylow: [5.9, -97.3, 2.356, 0.22],
  // the alley: stand at the mouth and look in, which is the cat's own test
  mouth: [-6.2, -40.1, -Math.PI / 2, -0.06],
  // closer, and pitched down onto the drain and the litter beside it
  drain: [-8.4, -40.6, -1.75, -0.30],
};

const args = process.argv.slice(2);
if (args[0] === '--list' || !args.length) {
  for (const [k, v] of Object.entries(VIEWS)) console.log(`  ${k}  ${v.join(', ')}`);
  process.exit(args.length ? 0 : 2);
}

const views = args.map((a) => {
  const [name, spec] = a.includes(':') ? [a.slice(0, a.indexOf(':')), a.slice(a.indexOf(':') + 1)] : [a, null];
  const v = spec ? spec.split(',').map(Number) : VIEWS[name];
  if (!v) { console.error(`unknown view "${name}" — --list to see them`); process.exit(2); }
  return { name, v };
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);         // GOTCHAS §26
// The hour is an argument now. Default 13:00 — a DAY hour, where the settle is
// not a coin flip (D-walk measured that: at a NIGHT hour, 600 ms reads the
// ungraded world one run in eight). SHOT_HOUR=23 to look after dark; the clock
// helper returns when the grade is actually on screen rather than after a sleep.
const HOUR = Number(process.env.SHOT_HOUR ?? 13);
await setClock(page, HOUR, 0);
await page.mouse.click(640, 360);
await page.waitForTimeout(500);
// the warm-up warp D-walk documents — the first warp of a session lands wrong
await page.evaluate(() => window.__ct.warp(0, -40, 0, 0, 0));
await page.waitForTimeout(300);

for (const { name, v } of views) {
  const [x, z, yaw, pitch = 0, gy = 0] = v;
  await page.evaluate(([a, c, y, p, g]) => window.__ct.warp(a, c, y, g, p), [x, z, yaw, pitch, gy]);
  await page.waitForTimeout(420);
  const at = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(2)));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png  from ${at.join(', ')}  yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)}`);
}

await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(1); }

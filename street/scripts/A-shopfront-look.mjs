// PICTURES OF ANY NAMED SHOPFRONT, from the pavement. An investigation.
//
//   node scripts/A-shopfront-look.mjs "A-1 TAX"
//   node scripts/A-shopfront-look.mjs "BURGER BARN"
//
// `A-diner-front-shots.mjs` came first and is cited from
// notes/A-diner-facade-look.md, so it stays where it is; this is the same idea
// with the shop as an argument, because the user named FOUR fronts and only one
// of them had ever been stood in front of.
//
// Every camera position is DERIVED from `__frontages` — GOTCHAS 20, aim from
// the source. The rig's forward is `(sin yaw, 0, -cos yaw)`, so aiming is
// `atan2(dx, -dz)`; both wrong versions of that produced perfectly plausible
// photographs of the wrong building, because a square-on shot has dz = 0 and
// cannot tell them apart.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const WANT = (process.argv[2] || '').toUpperCase();
if (!WANT) { console.error('usage: A-shopfront-look.mjs "<SHOP NAME>"'); process.exit(2); }
const URL = aim('http://localhost:4188/');
const slug = WANT.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));
await p.waitForTimeout(700);

const f = await p.evaluate((n) => (globalThis.__frontages || []).find((q) => q.name === n), WANT);
if (!f) {
  const names = await p.evaluate(() => (globalThis.__frontages || []).map((q) => q.name));
  console.error(`no frontage named "${WANT}". Registered: ${names.join(', ')}`);
  process.exit(3);
}
console.log(JSON.stringify(f, null, 1));

const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
const mid = (lo + hi) / 2;
const OUT = f.facePos < 0 ? 1 : -1;
const face = f.facePos;
const yawTo = (sx, sz, tx, tz) => (f.axis === 'z'
  ? Math.atan2(tx - sx, -(tz - sz))
  : Math.atan2(tz - sz, -(tx - sx)));

// For a side-street frontage the roles of x and z swap; `across` is the axis
// the street runs away along, `along` is the frontage's own axis.
const at = (across, along) => (f.axis === 'z' ? [across, along] : [along, across]);
const NEAR = face + OUT * 1.7, MIDW = face + OUT * 1.1, ROAD = face + OUT * 7.5;

const shots = [
  ['square', ...at(NEAR, mid), mid, 0.06],
  ['low', ...at(MIDW, mid), mid, -0.10],
  ['lo-end', ...at(MIDW, lo - 0.5), mid, 0.02],
  ['hi-end', ...at(MIDW, hi + 0.5), mid, 0.02],
  ['door', ...at(MIDW, f.doorWorld), f.doorWorld, -0.02],
  ['elevation', ...at(ROAD, mid), mid, 0.10],
];

for (const [tag, sx, sz, target, pitch] of shots) {
  const [tx, tz] = at(face, target);
  const yaw = yawTo(sx, sz, tx, tz);
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0.14, pi), [sx, sz, yaw, pitch]);
  await p.waitForTimeout(320);
  await p.screenshot({ path: `shots/A-${slug}-${tag}.png` });
  console.log(`  A-${slug}-${tag}  from (${sx.toFixed(2)}, ${sz.toFixed(2)}) yaw ${yaw.toFixed(2)}`);
}
await b.close();

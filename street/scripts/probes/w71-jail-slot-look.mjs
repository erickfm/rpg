// Item 210 — LOOK AT THE CELL SLOTS, at night, from inside the jail.
//
// The row's DONE WHEN says "verify by looking at night, from inside the jail",
// and it is the right instruction here: the complaint is what a window looks
// like at 2 a.m., which is a matter of appearance, not of geometry.
//
// Shoots the cell run at 13:20 and at 02:00 so the pair can be compared. It
// also prints the slot material's colour beside each shot, because the eye
// cannot read a hex off a JPEG and the whole question is which hex it is.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-jail-slot-look.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4270/');
const TAG = process.argv[2] || 'now';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const room = await p.evaluate(() => window.__ct.roomDims().find((d) => d.id === 'jail') ?? null);
if (!room) { console.error('no jail room'); await b.close(); process.exit(3); }

// The slot the check names is at world (1006.37, 2.42, -5.6) — the back wall of
// an EAST cell (room half-width is 6.4). The corridor runs along z at local
// x ~ 0, so stand in the corridor level with that cell and look across at it.
// Yaw is swept rather than assumed: worker sixtyeight lost five routes to
// guessing this convention (`yaw = PI` walked into a wall), so the probe shoots
// every quarter turn and the pick is made by LOOKING.
const YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

// the slot material, found the same way the check finds it: by position, in the
// world's own scene, not by a name typed here.
const slotHex = () => p.evaluate(() => {
  let hex = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || hex !== null) return;
    const g = o.geometry.parameters;
    if (!g || g.width !== 0.04 || g.height !== 0.44 || g.depth !== 0.80) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.color) hex = '#' + m.color.getHex().toString(16).padStart(6, '0');
  });
  return hex;
});

for (const [h, mm, label] of [[13, 20, 'day'], [2, 0, 'night']]) {
  await p.evaluate(([hh, m]) => window.__ct.clock(hh, m), [h, mm]);
  await p.waitForTimeout(900);
  const hex = await slotHex();
  for (let i = 0; i < YAWS.length; i++) {
    await p.evaluate(([x, z, yaw, y]) => window.__ct.warp(x, z, yaw, y), [room.cx, -5.6, YAWS[i], room.y]);
    await p.waitForTimeout(400);
    const file = `shots/w71-jailslot-${label}-y${i}-${TAG}.png`;
    await p.screenshot({ path: file });
    console.log(`${label.padEnd(6)} ${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}  yaw ${YAWS[i].toFixed(2).padStart(5)}  slot ${hex}  -> ${file}`);
  }
}
await b.close();

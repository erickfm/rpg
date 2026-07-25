// Entrance-facade quality review — No. 227, the walk-up's front door.
//
// Every angle the brief asks for, plus the grazing shots that are the only
// way to SEE a seam or a z-fight: straight on, both obliques, hard grazing
// down the wall in both directions, looking up at the transom/lintel, and
// close on the door, the stoop, the plaque and the buzzer.
//
// Camera convention (ct/fp.ts): fwd = (sin yaw, 0, -cos yaw), so aiming at a
// point dx east / dz north of you is yaw = atan2(dx, -dz).
//
// Usage: SHOT_URL=http://localhost:4180/ node scripts/entrance.mjs [outdir]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const outDir = process.argv[2] ?? 'shots/entrance';
mkdirSync(outDir, { recursive: true });

const DOOR_Z = -44;          // ct/apartment.ts — the entrance centreline
const WALK = 0.14;           // sidewalk top (KERB_H)
const at = (dx, dz) => Math.atan2(dx, -dz);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });

await reportWorld(page, URL);   // GOTCHAS 26
// clear early afternoon — no rain sheen, no night lamps confusing the read
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(700);

// [name, x, z, yaw, pitch]
const SHOTS = [
  // ── the composition, straight on ────────────────────────────────────────
  ['straight', 3.2, DOOR_Z, at(4, 0), 0.10],
  ['straight-near', 5.4, DOOR_Z, at(1.6, 0), 0.14],
  ['facade-wide', -4.2, DOOR_Z, at(11, 0), 0.06],

  // ── both obliques ───────────────────────────────────────────────────────
  ['oblique-n', 4.6, DOOR_Z + 1.4, at(2.3, -1.4), 0.00],
  ['oblique-s', 4.6, DOOR_Z - 1.4, at(2.3, 1.4), 0.00],
  ['oblique-n-far', 3.0, DOOR_Z + 4.5, at(4.0, -4.5), 0.02],
  ['oblique-s-far', 3.0, DOOR_Z - 4.5, at(4.0, 4.5), 0.02],

  // ── grazing: eye almost ON the wall, looking along it. Any element that
  //    floats off the brick or sinks into it shows up here and nowhere else.
  ['graze-n', 6.35, DOOR_Z + 6.0, at(0.5, -6.0), 0.02],
  ['graze-s', 6.35, DOOR_Z - 6.0, at(0.5, 6.0), 0.02],
  ['graze-n-low', 6.5, DOOR_Z + 4.0, at(0.35, -4.0), -0.30],
  ['graze-s-low', 6.5, DOOR_Z - 4.0, at(0.35, 4.0), -0.30],

  // ── looking up: transom, lintel, and the seam to the brick above ────────
  ['lookup', 5.6, DOOR_Z, at(1.4, 0), 0.85],
  ['lookup-near', 6.2, DOOR_Z, at(0.8, 0), 1.15],
  ['lookup-oblique', 6.1, DOOR_Z + 1.8, at(0.9, -1.8), 0.80],

  // ── close on the door ───────────────────────────────────────────────────
  ['door', 5.9, DOOR_Z, at(1.1, 0), 0.05],
  ['door-low', 6.1, DOOR_Z, at(0.9, 0), -0.35],

  // ── close on the stoop / step ───────────────────────────────────────────
  ['stoop', 6.0, DOOR_Z, at(1.0, 0), -0.72],
  ['stoop-oblique', 5.9, DOOR_Z + 1.3, at(1.1, -1.3), -0.55],
  ['stoop-graze', 6.4, DOOR_Z + 2.6, at(0.5, -2.6), -0.45],

  // ── close on the signage. The building has no nameplate; 227 on the
  //    transom is the only identification. The two west-jamb shots are
  //    there to prove the brick where the old plaque hung is unbroken —
  //    no hole, no fixing left floating, no gap.
  ['jamb-west', 5.9, DOOR_Z - 1.55, at(1.1, 0), 0.06],
  ['jamb-west-near', 6.3, DOOR_Z - 1.55, at(0.7, 0), 0.06],
  ['buzzer', 5.9, DOOR_Z + 1.55, at(1.1, 0), 0.02],
  ['transom', 6.0, DOOR_Z, at(1.0, 0), 0.55],

  // ── the rest of the residential facade (z -35 … -53) ────────────────────
  ['res-north-end', 4.2, -36.0, at(2.8, -1.6), 0.05],
  ['res-south-end', 4.2, -52.0, at(2.8, 1.6), 0.05],
  ['res-windows-n', 4.6, -39.5, at(2.4, 0), 0.08],
  ['res-windows-s', 4.6, -48.5, at(2.4, 0), 0.08],
];

for (const [name, x, z, yaw, pitch] of SHOTS) {
  await page.evaluate(([a, b, c, d]) => window.__ct.warp(a, b, c, 0.14, d), [x, z, yaw, pitch]);
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

// the door still opens: stand on the spot and read the HUD prompt
await page.evaluate(() => window.__ct.warp(6.55, -44, Math.PI / 2, 0.14, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/prompt.png` });
const prompt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 300));

await browser.close();
console.log(`entrance shots -> ${outDir} (${SHOTS.length} angles)`);
console.log('HUD text at the door spot:', JSON.stringify(prompt));
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }

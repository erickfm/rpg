// The jail sally port, from the user's own approach. Daylight.
//
//   node scripts/probes/w59-jaildoor-shot.mjs before
//   node scripts/probes/w59-jaildoor-shot.mjs after
//
// Several distances on purpose. The defect under investigation is two opaque
// faces at the SAME depth, and how a depth buffer resolves a tie changes with
// range — so one frame from one spot can miss it entirely. `d75` is the
// standing spot the [E] prompt uses (`standOf(DOOR, 0.75)`, ct/int-jail.ts).
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const TAG = process.argv[2] || 'shot';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const DIR = 'shots/w59';
mkdirSync(DIR, { recursive: true });

// Derived from ct/jail.ts, cited rather than reinvented (BUILDER-BRIEF §8):
//   JAIL_FACE_X = JAIL.SITE_X (57) + JAIL.FORE (4) = 61   — jail.ts:140, :72, :95
//   CZ          = (Z_S -110 + Z_N -96) / 2       = -103   — jail.ts:98, :147
//   outward normal nx = -1, so the pavement is at x < 61  — jail.ts:148
const FACE_X = 61, CZ = -103;
const EAST = Math.PI / 2;      // measured, not remembered: this is the yaw that
                               // puts the sally port in frame from x < FACE_X

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

// WARM UP BEFORE THE FIRST REAL FRAME.
//
// The first warp+screenshot after page load renders a 100% BLACK canvas while
// the DOM HUD paints normally — the world has not drawn yet, so `[E] into the
// HOUSE OF DETENTION` sits over nothing. It cost a false "my fix blacked out
// the door" until the same frame was reproduced on stashed mainline, and then
// reproduced at a DIFFERENT x, which is what proved it was the shot order and
// not the position. GOTCHAS 76: a state-based trigger does not make a
// screenshot atomic. So throw the first frame away.
await p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0.14, 0), [FACE_X - 2.2, CZ, EAST]);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1500);
await p.screenshot();

const shot = async (name, x, z, yaw, pitch = 0) => {
  await p.evaluate(([a, c, y, t]) => window.__ct.warp(a, c, y, 0.14, t), [x, z, yaw, pitch]);
  await p.evaluate(() => window.__ct.clock(13, 0));       // daylight, AFTER the warp
  await p.waitForTimeout(900);
  const pos = await p.evaluate(() => window.__ct.pos());
  const file = `${DIR}/${TAG}-${name}.png`;
  writeFileSync(file, await p.screenshot());
  console.log(`${file}  stood ${pos.map((v) => (+v).toFixed(2)).join(', ')}`);
};

await shot('d075-at-the-prompt', FACE_X - 0.75, CZ, EAST);
await shot('d220-arriving',      FACE_X - 2.2,  CZ, EAST);
await shot('d500-on-the-walk',   FACE_X - 5.0,  CZ, EAST);
await shot('d220-oblique',       FACE_X - 2.2,  CZ + 2.4, EAST - 0.55);
await b.close();

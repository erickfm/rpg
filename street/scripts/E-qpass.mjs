// THE QUALITY PASS: my three areas, shot from where a player actually stands.
//
// The desk's method ruling is the whole point of this file, and it is a method
// instruction rather than a feature one: *"take screenshots yourself and grade
// it and make sure you are impressed with it. be skeptical."*
//
// So the stations here are not chosen to flatter. Each one is somewhere a
// player arrives at under their own steam:
//
//   the park      THE GATE, on foot from the pavement — the desk's canonical
//                 station, and the one the user's own screenshots are taken
//                 from. A verdict from beside the memorial is not evidence:
//                 the auditor withdrew a CONFIRMED for exactly that.
//   the library   the pavement outside it, which is where its facade is read
//   the church    the pavement outside it, same
//
// Every frame is shot in daylight AND at night, because half the complaints
// this block has taken were about things that only exist in one of the two.
//
//   node scripts/E-qpass.mjs
//   SHOT_URL=http://localhost:4182/ node scripts/E-qpass.mjs
//
// LOOKS ONLY — asserts nothing. It writes frames for me to grade by eye and
// prints the station under each one so a finding can name where it was seen.
// Do not cite this file as evidence that anything is correct; cite the frame,
// and say which station it was taken from.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const OUT = 'shots/E-qpass';
mkdirSync(OUT, { recursive: true });

// yaw: the PLAYER at yaw t looks along (sin t, -cos t). Not the mesh
// convention, which is (sin t, cos t) — they differ by a z-flip, and getting
// this backwards has been the single most repeated bug on this block.
const W = -Math.PI / 2;   // look -x  (west, into the park from the pavement)
const E_ = Math.PI / 2;   // look +x  (east, into the church from the pavement)
const N = 0;              // look -z
const S = Math.PI;        // look +z

const STATIONS = [
  // ── the park, arriving on foot ────────────────────────────────────────
  { k: 'park-gate-approach', at: [-5.2, -83.0], yaw: W, gy: 0.14,
    what: 'the gate from the pavement, the way you arrive' },
  { k: 'park-gate-inside', at: [-9.5, -83.0], yaw: W, gy: 0.24,
    what: 'just through the gate, first view of the field' },
  { k: 'park-field-across', at: [-14.0, -83.0], yaw: W, gy: 0.24,
    what: 'the field down its long axis — the mowing stripes' },
  { k: 'park-field-along', at: [-22.0, -78.0], yaw: S, gy: 0.24,
    what: 'across the stripes, where banding reads strongest' },
  { k: 'park-shelter', at: [-30.5, -83.0], yaw: W, gy: 0.24,
    what: 'the shelter from the loop, its posts and eaves' },
  { k: 'park-shelter-under', at: [-34.9, -84.6], yaw: N, gy: 0.24,
    what: 'stood under the shelter — the boarded ceiling' },
  { k: 'park-bench-row', at: [-18.6, -88.5], yaw: S, gy: 0.24,
    what: 'a path-side bench: does the sitter face the park' },
  { k: 'park-fence-out', at: [-5.2, -75.0], yaw: W, gy: 0.14,
    what: 'the boundary railing from the pavement — pickets and bottom rail' },
  { k: 'park-mound', at: [-19.0, -84.6], yaw: W, gy: 0.24,
    what: 'the relief: is it visible as ground that rises' },
  { k: 'park-path', at: [-12.0, -78.8], yaw: W, gy: 0.24,
    what: 'the path surface and its edging, close' },

  // ── the library, read from the pavement ───────────────────────────────
  { k: 'lib-pavement', at: [-5.0, -13.0], yaw: W, gy: 0.14,
    what: 'the library facade from the pavement' },
  { k: 'lib-forecourt', at: [-8.2, -13.0], yaw: W, gy: 0.14,
    what: 'the forecourt landing and flight — the plazaTex adoption' },
  { k: 'lib-name', at: [-8.6, -13.0], yaw: W, gy: 0.14, pitch: 0.22,
    what: 'the frieze: PUBLIC LIBRARY, and the fanlight arch' },
  { k: 'lib-north-junction', at: [-5.0, -5.6], yaw: W, gy: 0.14,
    what: 'the north party line — where the library meets its neighbour' },
  { k: 'lib-south-junction', at: [-5.0, -20.4], yaw: W, gy: 0.14,
    what: 'the south party line — the BURGER BARN junction' },

  // ── the church, read from the pavement ────────────────────────────────
  //
  // THESE COORDINATES WERE GUESSED THE FIRST TIME AND ONE OF THEM WAS WRONG.
  // `church-tower` stood at z -88 and photographed the BODEGA — I graded a
  // corner shop as a church until I opened the frame. Measured off the world
  // instead: the tall meshes on this side sit at x 9.5-11.3, z -73.5…-86, the
  // tower being the 17 m one at (11.3, -79.5). The gate is on that axis, so
  // z -79.5 is where a player arrives, not z -83 or -88.
  //
  // Same lesson as the rest of today, one level out: I filtered on a
  // coordinate I remembered rather than one the world reported.
  { k: 'church-pavement', at: [5.4, -79.5], yaw: E_, gy: 0.14,
    what: 'the church from the pavement, on the gate axis — the way you arrive' },
  { k: 'church-yard', at: [8.6, -79.5], yaw: E_, gy: 0.20,
    what: 'inside the churchyard, the flight up to the door' },
  { k: 'church-tower', at: [5.4, -79.5], yaw: E_, gy: 0.14, pitch: 0.5,
    what: 'the tower, 17 m at (11.3, -79.5) — the stone texture up its face' },
  { k: 'church-nave', at: [5.4, -84.0], yaw: E_, gy: 0.14, pitch: 0.25,
    what: 'the nave side wall, the face that was flat until I textured it' },
];

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);      // GOTCHAS 26: prove which world this is

// ── PROVE EACH FRAME CAPTURED A WORLD ────────────────────────────────────
//
// The first run of this file wrote 36 frames and the one I opened was a blank
// white page with the HUD on it. Nothing in the run said so: the frames were
// the right size, written to the right paths, and it reported "36 frames" and
// exited 0. I would have graded a white rectangle as "the park".
//
// That is GOTCHAS 34 one level up — not a check that passes having examined
// nothing, but a LOOK that produces nothing and says it looked. This file
// asserts nothing about the world by design; it must still assert that it
// captured one, because a frame gets cited as evidence.
//
// TWO WRONG PREDICATES BEFORE THIS ONE, both my standing failure mode — I
// filtered on a property that is not stable for the thing I am looking for:
//
//   "the intro card is up"        there is no intro card. `main.ts:88` writes
//                                 that strapline into a PERMANENT HUD, so the
//                                 text is present on every good frame too.
//   "the click did not land"      the world needs no click. Shot with no click
//                                 at all it renders the park correctly.
//
// So ask the FRAME what is in it, rather than the page what state it claims.
// A rendered world is many colours; a failed capture is one flat colour with
// the HUD on it. Sample the canvas above the HUD band and count distinct
// coarse colours — that is a property of "did anything draw", which is the
// actual question, and it holds whatever the cause turns out to be.
// A THIRD wrong predicate, and the most instructive, so it is written down
// rather than quietly deleted: the first version of this guard sampled the
// LIVE CANVAS with `drawImage`. It reported one colour on a world that was
// visibly drawing — because a WebGL canvas discards its drawing buffer after
// compositing unless `preserveDrawingBuffer` is set, so reading it from
// outside a frame callback gets you a cleared buffer BY DESIGN. The guard was
// not seeing a blank world; it was seeing a place where the world is never
// visible. It would have failed every run forever, on a correct world.
//
// So measure THE ARTIFACT — the PNG that was just written, which is the thing
// I am actually going to grade. `page.screenshot` goes through the compositor
// and is unaffected. Decode it back through the browser, which already has a
// PNG decoder, and sample that.
const framePaint = async (png) => page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const g = document.createElement('canvas');
  g.width = 100; g.height = 50;
  const x = g.getContext('2d');
  // top 78% only: below that is the permanent HUD, which paints on a dead frame too
  x.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.78), 0, 0, 100, 50);
  const d = x.getImageData(0, 0, 100, 50).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
  return { n: seen.size, why: `${seen.size} distinct colours` };
}, png.toString('base64'));

// POSITIVE CONTROL: `E_BLANK=1` shoots with the canvas hidden, which produces
// exactly the blank frame this guard exists for. It must exit 3. A guard
// nobody has watched fail is one you will argue with later.
if (process.env.E_BLANK) await page.evaluate(() => { document.querySelector('canvas').style.visibility = 'hidden'; });

// DEAD versus DARK, and they are not the same frame.
//
// At 12 this called `church-yard-night` a failed capture. That frame is real:
// it is the churchyard at 22:30, which has no light source in it at all, so it
// renders six near-blacks and nothing else. Calling that "nothing drew" would
// have thrown away the single clearest piece of evidence for the oldest open
// finding I have — that the courtyard and the churchyard are UNLIT.
//
// A dead capture is one or two colours; a dark place is a handful. So the
// threshold catches only the dead, and anything under 12 is called out as
// worth looking at rather than discarded.
const MIN_COLOURS = 4;
const DIM_COLOURS = 12;
await page.waitForTimeout(1200);          // the first frames render after __ct exists
const first = await framePaint(await page.screenshot());
if (first.n < MIN_COLOURS) {
  console.log(`\nEXIT 3: ${first.why} — under ${MIN_COLOURS}, so nothing drew.`);
  console.log('This run captured no world, so it cannot answer anything. GOTCHAS 32.');
  await b.close();
  process.exit(3);
}
console.log(`the world draws: ${first.why}\n`);

let blank = 0;

const shoot = async (s, tag, h, m) => {
  await page.evaluate(([h, m]) => window.__ct.clock(h, m), [h, m]);
  await page.evaluate(([x, z, yaw, gy, p]) => window.__ct.warp(x, z, yaw, gy, p),
    [s.at[0], s.at[1], s.yaw, s.gy ?? 0.14, s.pitch ?? 0]);
  await page.waitForTimeout(700);          // let the crowd and the sky settle
  const f = `${OUT}/${s.k}-${tag}.png`;
  const png = await page.screenshot({ path: f });
  // per-frame, not just once at the top: the failure I actually hit was a
  // single station coming out blank in a run whose other frames were fine
  const paint = await framePaint(png);
  if (paint.n < MIN_COLOURS) { blank++; console.log(`  ${f}  ** DEAD — ${paint.why}, do not grade this`); }
  else if (paint.n < DIM_COLOURS) console.log(`  ${f}  (${paint.n} colours — VERY DARK OR VERY FLAT, look at it)`);
  else console.log(`  ${f}  (${paint.n} colours)`);
};

for (const s of STATIONS) {
  console.log(`── ${s.k}: ${s.what}`);
  console.log(`   station: (${s.at[0]}, ${s.at[1]}) yaw ${s.yaw.toFixed(2)} — a player stands here`);
  await shoot(s, 'day', 13, 20);
  await shoot(s, 'night', 22, 30);
}

console.log(`\n${STATIONS.length} stations, ${STATIONS.length * 2} frames in ${OUT}/`);
console.log('LOOKS ONLY — asserts nothing about the world. Grade these by eye; cite the frame and the station.');
if (blank) {
  console.log(`\nEXIT 3: ${blank} frame(s) captured nothing. Those stations are unanswered.`);
  await b.close();
  process.exit(3);
}
console.log('every frame drew a world.');
await b.close();

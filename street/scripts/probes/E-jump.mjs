// CAN YOU GET OUT? The park's boundary is a 0.62 m wall with a 0.95 m railing
// on it, and the churchyard's is 0.62 + 0.72. Neither was ever tested against
// the JUMP key, and I have since RAISED THE GROUND: the crown lifts the whole
// field 0.10 m and the mound reaches 0.37 m above the paving.
//
// Raised ground next to a fixed barrier is exactly how a barrier stops working,
// and nothing in the world would complain — you would simply find yourself in
// the dead ground behind the park one day. The relief is far from the boundary
// by design; this is the check that says so rather than the reasoning.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [x, z, yaw]);
let fails = 0;
// COUNT WHAT YOU TESTED. This printed "every boundary holds against the jump
// key" without ever saying how many boundaries that was — so if a `chargeAt`
// call were deleted, or an early `await` threw and the rest never ran, the
// green would read exactly the same. GOTCHAS 34.
//
// Four bad numbers today all came from the same habit: a plausible result off a
// set nobody stated the size of. The committed checks that report their counts
// were never the ones that lied.
let tested = 0;
const report = (n, ok, d) => { tested++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// run at the barrier holding jump, several times — a single hop can be unlucky
const chargeAt = async (name, from, yaw, held, ok, say) => {
  let last;
  for (let t = 0; t < 3; t++) {
    await warp(from[0], from[1], yaw);
    await page.waitForTimeout(160);
    await page.keyboard.down('w');
    for (let j = 0; j < held; j++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(340);
    }
    await page.keyboard.up('w');
    await page.waitForTimeout(400);         // land
    last = await pos();
    if (!ok(last)) break;                   // an escape is worth reporting at once
  }
  report(name, ok(last), say(last));
};

// 1 ── the park's street boundary, from the highest ground I can start on
await chargeAt('you cannot jump out of the park over the street railing',
  [-8.6, -76.0], Math.PI / 2, 5,
  (p) => p[0] < -7.0,
  (p) => `ended at x ${p[0].toFixed(2)}, gy ${p[3].toFixed(2)} — the boundary is x -7.00`);

// 2 ── the back wall, the one the user called dead ground beyond
await chargeAt('you cannot jump over the park back wall',
  [-37.0, -83.0], -Math.PI / 2, 5,
  (p) => p[0] > -39.5,
  (p) => `ended at x ${p[0].toFixed(2)} — the site stops at -39`);

// 3 ── from the MOUND, the highest ground in the park, toward the nearest edge
await chargeAt('the mound does not launch you anywhere',
  [-23.6, -84.6], Math.PI / 2, 6,
  (p) => p[0] < -7.0,
  (p) => `set off from the crest at gy 0.51, ended at x ${p[0].toFixed(2)}`);

// 4 ── the churchyard's low wall, SOUTH OF THE GATE. z -79.0 is inside the
// gate opening (-81.05…-77.95), so the first cut of this walked the player
// straight out of the entrance and called it an escape. The wall is only a wall
// where there is no gate in it.
await chargeAt('you cannot jump out of the churchyard',
  [7.6, -84.0], -Math.PI / 2, 5,
  (p) => p[0] > 6.9,
  (p) => `ended at x ${p[0].toFixed(2)} — the wall face is 7.00`);

// 5 ── the library courtyard's party walls
await chargeAt('you cannot jump through the courtyard party wall',
  [-8.5, -6.6], Math.PI, 5,
  (p) => p[2] < -5.0,
  (p) => `ended at z ${p[2].toFixed(2)} — the party line is -5.00`);

const EXPECTED = 5;                      // the boundaries this file charges at
if (tested < EXPECTED) {
  console.log(`\nEXIT 3: only ${tested} of ${EXPECTED} boundaries were charged — this run did not test what it claims`);
  await b.close(); process.exit(3);
}
console.log(fails ? `\n${fails} of ${tested} FAILED — something can be jumped`
  : `\nall ${tested} boundaries hold against the jump key`);
await b.close();
process.exit(fails ? 1 : 0);

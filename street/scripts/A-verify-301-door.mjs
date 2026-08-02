// SECOND VERIFIER (A) for C's row "i want to be able to close this door and
// also what is this poster on the wall?"
//
// E watched half of it and stopped, which was right — but E could not test the
// CLOSING half and gave a reason that is not true:
//
//   "I tested for the [E] prompt with document.body.innerText, and this world
//    draws that prompt ON THE CANVAS — so my prompt check could never have
//    seen it"
//
// The prompt is a DOM element. `ct/hud.ts:218` builds `<div id="ct-prompt">`,
// and the file's own header says "All DOM + 2D canvas". So E's instrument was
// sound and the closing half can be tested after all. (`innerText` on a fixed,
// transformed div can still come back empty in a headless browser, which may be
// what E actually hit — so this reads `textContent` of the element by id rather
// than scraping the body.)
//
// STATION: standing on C's own "close the door" spot inside 301, third floor.
//
// The test is a full CYCLE rather than one press, because "the door closed" and
// "the door is stuck" look identical after a single E: closed, then open again,
// then closed. A door that only shuts is not the thing the user asked for.
//
// SECOND STATION, added for queue item 1: this room-side cycle is not the
// whole door. It only ever warped to x 199.3 — inside 301 — so it could not
// see that the door was unopenable from the LANDING once shut: the interior
// spot's r0.95 reach died at x 200.31, short of the hall floor (which starts
// past the wall at x 200.07) and blocked further still by the shut leaf
// itself. Shut the door from the room, walk out via a hall-side spot, and
// confirm the SAME "open the door" prompt is offered and works there too.
//
//   node scripts/A-verify-301-door.mjs [port]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
await reportWorld(p, URL);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

// The spot, from the world rather than from a coordinate I typed.
const spot = await p.evaluate(() => {
  const s = window.__ct.spots().find((q) => /close the door/i.test(q.label));
  return s ? { x: s.x, z: s.z, r: s.r } : null;
});
if (!spot) { console.error('CANNOT ANSWER — no "close the door" spot in this world.'); await b.close(); process.exit(3); }
console.log(`\n"close the door" at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) r${spot.r}`);

// gy matters: 301 is on the third floor and warping with the ground of the
// street puts the player under the building.
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, Math.PI / 2, gy, 0), [spot.x, spot.z, gy]);
await p.waitForTimeout(500);
const at = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log(`standing at (${at[0]}, ${at[2]}) floor ${at[3]}\n`);

// EDGE-TRIGGERED, inside the frame loop: the dispatch is `feedDown && !feedHeld`,
// so the key must be down across at least one rendered frame and then released,
// or the press falls between frames and nothing happens. That is the trap E
// named and it is a real one.
const pressE = async () => {
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' })));
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' })));
  await p.waitForTimeout(400);
};

const seen = [];
const step = async (tag) => {
  const t = await prompt();
  seen.push(t);
  console.log(`  ${tag.padEnd(22)} ${t ? `[E] ${t}` : 'no prompt'}`);
  await p.screenshot({ path: `shots/A-301-${tag.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
};

await step('before any press');
await pressE();
await step('after 1st E');
await pressE();
await step('after 2nd E');

console.log('');
const [s0, s1, s2] = seen;
const ok = /close/i.test(s0 ?? '') && /open/i.test(s1 ?? '') && /close/i.test(s2 ?? '');
if (ok) {
  console.log(`MEASURED FINE — the door closes and opens again from the same spot.`);
} else {
  console.log(`MEASURED WRONG — expected close -> open -> close, got:`);
  console.log(`  ${JSON.stringify(seen)}`);
}

// ── STATION 2: the hall side ────────────────────────────────────────────
// Room cycle above left the door OPEN (close -> open -> close means it is
// back where it started). Shut it from the room, THEN warp to whichever
// registered door-spot sits on the far side of the wall from the one we
// just used, and see whether the landing can reopen it.
console.log('\n-- hall side --');
await pressE();                              // room spot: 'close the door' -> shuts it
const hallSeen = [];
const hallStep = async (tag) => {
  const t = await prompt();
  hallSeen.push(t);
  console.log(`  ${tag.padEnd(22)} ${t ? `[E] ${t}` : 'no prompt'}`);
  await p.screenshot({ path: `shots/A-301-hall-${tag.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
};

const hallSpot = await p.evaluate((roomX) => {
  const cands = window.__ct.spots().filter((q) => /the door/i.test(q.label));
  return cands.find((q) => Math.abs(q.x - roomX) > 0.1) ?? null;
}, spot.x);
if (!hallSpot) {
  console.error('CANNOT ANSWER — only one door-spot registered; no hall-side station exists.');
  await b.close();
  process.exit(3);
}
console.log(`"the door" (hall side) at (${hallSpot.x.toFixed(2)}, ${hallSpot.z.toFixed(2)}) r${hallSpot.r}`);
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, -Math.PI / 2, gy, 0), [hallSpot.x, hallSpot.z, gy]);
await p.waitForTimeout(500);
const hallAt = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
console.log(`standing at (${hallAt[0]}, ${hallAt[2]}) floor ${hallAt[3]}\n`);

await hallStep('door shut, on the landing');       // this is the exact bug: used to be "no prompt"
await pressE();
await hallStep('after E from the hall');
await pressE();
await hallStep('after 2nd E from the hall');

const [h0, h1, h2] = hallSeen;
const hallOk = /open/i.test(h0 ?? '') && /close/i.test(h1 ?? '') && /open/i.test(h2 ?? '');
console.log('');
if (hallOk) {
  console.log('MEASURED FINE — the door opens and closes from the hall side too.');
} else {
  console.log('MEASURED WRONG — expected open -> close -> open from the landing, got:');
  console.log(`  ${JSON.stringify(hallSeen)}`);
}

await b.close();
process.exit(ok && hallOk ? 0 : 1);

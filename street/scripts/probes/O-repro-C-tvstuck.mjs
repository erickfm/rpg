// CAN I REPRODUCE "the player is STUCK in the TV-watching state"?
//
// C's row, open and severe — this project has had the user say *"im literally
// stuck here"* once already, and a player who cannot leave a chair is the worst
// class of bug it ships.
//
// I am not fixing it: `ct/apartment.ts` is C's. This is a VERIFIER handing the
// owner a measurement, because I verified that same room earlier tonight and
// found getting up working, which means either the fault is new or it is
// CONDITIONAL — and which of those it is changes where C looks first.
//
// So this does not ask "does E work". It asks WHEN it stops working, by trying
// the ways a player can arrive at the seat that a happy-path test never does.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-repro-C-tvstuck.mjs
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

const seat = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /watch tv/i.test(s.label ?? ''))
  .map((s) => ({ x: s.x, z: s.z, r: s.r }))[0] ?? null);
if (!seat) { console.error('ABORT: no watch-TV spot registered'); await b.close(); process.exit(3); }

// 301 is up the walk-up: a ground-level warp stands you three storeys under
// the seat and its own ok() is false there. Found by asking, not by knowing —
// this cost me five false reds on C's other row earlier tonight.
const FLOOR = await p.evaluate(async ([sx, sz]) => {
  const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let gy = 0; gy <= 14; gy += 0.1) {
    window.__ct.warp(sx, sz, 0, gy, 0);
    await wait();
    if (window.__ct.spots().filter((s) => /watch tv/i.test(s.label ?? ''))[0]?.ok) {
      return +window.__ct.pos()[3].toFixed(2);
    }
  }
  return null;
}, [seat.x, seat.z]);
if (FLOOR === null) { console.error('ABORT: the seat never arms at any floor'); await b.close(); process.exit(3); }
console.log(`the seat: (${seat.x}, ${seat.z}) r ${seat.r}, arms at gy ${FLOOR}\n`);

const state = () => p.evaluate(() => ({
  seated: !!window.__ct.seated?.(),
  tv: !!window.__ct.scene()?.userData?.tv?.on,
  pos: window.__ct.pos().map((v) => +v.toFixed(2)),
}));

/** wait for the SEAT SPOT to arm — not for N frames. The entry point latches a
 *  spot you have just used until you leave its volume, and pressing E into an
 *  unarmed spot does nothing. Four frames is not that wait, and reading the
 *  result as "the television is broken" is how I lost an hour earlier. */
const armed = () => p.evaluate(() => new Promise((res) => {
  const t0 = performance.now();
  const tick = () => {
    if (window.__ct.spots().filter((s) => /watch tv/i.test(s.label ?? ''))[0]?.ok) return res(true);
    if (performance.now() - t0 > 6000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}));

/** press E and wait for the seated flag to become `want`, or time out */
const pressAndWait = async (want) => {
  await p.keyboard.press('e');
  return p.evaluate((want) => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      if (!!window.__ct.seated?.() === want) return res(true);
      if (performance.now() - t0 > 6000) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  }), want);
};

const trials = [];
/** sit by whatever route, then try to get up with E, up to `tries` presses */
const trial = async (name, arrive, tries = 3) => {
  await arrive();
  const armedOk = await armed();
  const satOk = armedOk ? await pressAndWait(true) : false;
  if (!satOk) { trials.push({ name, sat: false, escaped: null, presses: 0 });
    console.log(`  ${name.padEnd(34)} COULD NOT SIT (armed ${armedOk}) — trial says nothing`);
    return; }
  let escaped = false, presses = 0;
  for (; presses < tries && !escaped; ) { presses++; escaped = await pressAndWait(false); }
  const s = await state();
  trials.push({ name, sat: true, escaped, presses, tv: s.tv });
  console.log(`  ${name.padEnd(34)} sat, ${escaped ? `GOT UP after ${presses} press(es)` : `STUCK after ${presses} presses`}` +
              `  (tv ${s.tv})`);
  if (!escaped) await p.screenshot({ path: `shots/O-repro-C-stuck-${trials.length}.png` });
  // leave cleanly for the next trial whatever happened
  await p.evaluate(([x, z, g]) => window.__ct.warp(x - 3, z + 3, 0, g, 0), [seat.x, seat.z, FLOOR]);
  await afterFrames(p, 20);
};

const atSeat = (yaw) => async () => {
  await p.evaluate(([x, z, g, y]) => window.__ct.warp(x, z, y, g, 0), [seat.x, seat.z, FLOOR, yaw]);
  await afterFrames(p, 6);
};

console.log('trials — each sits, then presses E up to three times to get up:');
await trial('plain: sit, then E', atSeat(0));
await trial('facing the other way', atSeat(Math.PI));
await trial('sit twice in a row', async () => {
  await atSeat(0)(); await armed(); await pressAndWait(true);
  await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [seat.x, seat.z, FLOOR]);
  await afterFrames(p, 8);
});
// the case a happy path never reaches: the clock jumps while you are sitting,
// which is what sleeping does and what every timed thing in this world reads
await trial('clock advanced while seated', async () => {
  await atSeat(0)(); await armed(); await pressAndWait(true);
  await p.evaluate(() => window.__ct.advanceClock(8 * 60, 0));
  await afterFrames(p, 20);
});

const stuck = trials.filter((t) => t.sat && !t.escaped);
console.log(`\n${trials.filter((t) => t.sat).length} trials sat, ${stuck.length} could not get up`);
if (!stuck.length) {
  console.log('NOT REPRODUCED on any route tried. That is NOT "the row is wrong" —');
  console.log('it narrows where C should look: not the plain sit/stand path.');
} else {
  console.log('REPRODUCED: ' + stuck.map((t) => t.name).join(', '));
}
await b.close();
// exit 0 either way — this reports for an owner, it does not grade C's row

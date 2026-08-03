// ITEM 289 — THE THREE SEATS THAT GAINED A VERB THAT WERE NOT THE POINT.
//
// `w120-seated-reach-census.mjs` says the +0.36 m of seated reach lets exactly
// four things in across all 219 seats. One is the bank's loan officer, which is
// the item. The other three are in BURGER BARN, and a side effect nobody asked
// for has to be walked before it is called harmless:
//
//   seat 23 "sit down" -> "out to the street"          d 1.91
//   seat 26 "sit down" -> "order a barn burger $1.89"  d 1.94
//   seat 34 "sit down" -> "order fries $0.99"          d 1.88
//
// THE ONE THAT COULD REALLY BITE IS THE DOOR. `crosstown.ts:1246-1252` stands
// the player up before any jump, and its comment says *"no seat is currently
// that close to a door; this is here so that the first one somebody registers
// is not a bug"* — that guard has been dead code until now and this is the run
// that fires it. If it did not exist, taking the door from a chair would
// teleport you to the pavement still sitting on furniture in another building.
//
// So, per BUILDER-BRIEF §10, this WALKS it rather than reading the geometry:
// sits by identity, turns the head to find the offer, presses a HELD [E] (§5),
// and asserts on where the player ends up and whether he is still on a chair.
//
//   SHOT_URL=http://localhost:4193/ node scripts/probes/w120-gained-verbs-walk.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4193/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const fails = [];
const note = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };
// BUILDER-BRIEF §5: HELD, not pressed. The dispatch is an edge read once per
// rendered frame and a tap can begin and end inside one.
const tap = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(120);
  await p.keyboard.up(k); await p.waitForTimeout(280);
};
const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const state = () => p.evaluate(() => {
  const q = window.__ct.pos();
  return { seated: !!window.__ct.seated(), x: q[0], z: q[2], cash: window.__ct.purse?.().cash ?? null };
});

const n = await p.evaluate(() => window.__ct.seats().length);
console.log(`${n} seats registered`);
if (n < 200) { console.log(`REFUSING TO REPORT: only ${n} seats visible`); await b.close(); process.exit(3); }

// The seats are found BY THE VERB THEY GAINED, not by index — an index moves
// the moment anybody registers a seat earlier in the world (BRIEF §8).
const WANT = [
  { re: /out to the street/i, kind: 'door' },
  { re: /barn burger/i, kind: 'buy' },
  { re: /order fries/i, kind: 'buy' },
];

for (const w of WANT) {
  console.log(`\n── the seat that can now reach ${w.re} ──`);
  // find it: sit on each seat, sweep the head, look for the verb
  const hit = await p.evaluate(async ([src]) => {
    const re = new RegExp(src, 'i');
    const seats = window.__ct.seats();
    for (let i = 0; i < seats.length; i++) {
      window.__ct.stand();
      window.__ct.sit(window.__ct.seats()[i].pose);
      if (!window.__ct.seated()) continue;
      const q = window.__ct.pos();
      const live = (window.__ct.spots() || []).filter((s) => s.ok && re.test(s.label));
      for (const s of live) {
        const d = Math.hypot(s.x - q[0], s.z - q[2]);
        if (d < s.r + window.__ct.playerRadius() + window.__ct.reachMargin()) {
          return { i, label: seats[i].label, yaw: Math.atan2(s.x - q[0], -(s.z - q[2])), d, spot: s.label };
        }
      }
    }
    return null;
  }, [w.re.source]);
  await p.evaluate(() => window.__ct.stand());
  note(!!hit, `a seat can reach "${w.re.source}"`);
  if (!hit) continue;
  console.log(`     seat ${hit.i} "${hit.label}", spot "${hit.spot}" at ${hit.d.toFixed(2)} m`);

  await p.evaluate((k) => { window.__ct.stand(); window.__ct.sit(window.__ct.seats()[k].pose); }, hit.i);
  const before = await state();
  note(before.seated, 'sat on it');
  // turn the head onto the spot — `warp` to the player's OWN coordinates moves
  // him 0 m, so it can only set yaw (w117's idiom)
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [before.x, before.z, hit.yaw]);
  await waitPainted(p, { frames: 4 });
  const offered = await promptNow();
  console.log(`     prompt: ${JSON.stringify(offered)}`);
  note(/\[ESC\]/.test(offered ?? ''),
    'the way off the chair is still named on screen (BUILDER-BRIEF §11)');
  note(new RegExp(w.re.source, 'i').test(offered ?? ''), 'and the new verb is what [E] would spend on');

  await tap('e');
  await waitPainted(p, { frames: 6 });
  const after = await state();
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  console.log(`     after [E]: seated=${after.seated} moved ${moved.toFixed(2)} m  cash ${before.cash} -> ${after.cash}`);
  if (w.kind === 'door') {
    note(moved > 1, 'taking the door from the chair actually moved you');
    note(!after.seated, 'and it STOOD YOU UP first — you are not sitting on furniture in another building');
  } else {
    note(after.seated, 'ordering from the table left you in your chair');
    note(after.cash !== before.cash || /you have|cannot|afford/i.test(await promptNow() ?? ''),
      `the order was transacted or refused for a stated reason — cash ${before.cash} -> ${after.cash}`);
  }
  // and you can always get up
  await p.evaluate(() => window.__ct.stand());
  await waitPainted(p, { frames: 4 });
  note(!(await state()).seated, 'and you can get back up afterwards');
}

console.log(`\n${errs.length} page error(s)`);
for (const e of errs.slice(0, 5)) console.log(`  ${e}`);
console.log(`\n${fails.length} failing assertion(s)`);
for (const f of fails) console.log(`  ${f}`);
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);

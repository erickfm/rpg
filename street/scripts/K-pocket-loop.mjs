// THE CLAIM: a newspaper on the pavement can be taken, it LEAVES THE GROUND
// when it does, it is in your pockets, and dropping it puts it back where you
// stand and re-offers it.
//
// Named for the claim and not for the subject (GOTCHAS §24): `newspaper.mjs`
// and `inventory.mjs` are subjects, and more than one agent will look at them.
//
// The world's own state is the proof, not a screenshot: `__ct.spots()` for what
// the `[E]` offers, the mesh's own `visible` for whether it left the ground,
// and `__inv.pockets()` for what you are carrying. A picture of a pavement
// cannot distinguish "taken" from "hidden behind you".
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-pocket-loop.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = aim('http://localhost:4292/');
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;

// Every newspaper in the world would do; the check needs at least one and says
// so out loud, because every verdict below is FREE over an empty set.
const MIN_TAKEABLES = 1;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);          // exit 3 rather than measure the wrong build

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

// ── 0. is the module even in this bundle? ────────────────────────────────
//
// `ct/world.ts` collects modules from an EAGER GLOB, and GOTCHAS §28 is that a
// module in an import cycle can resolve to an undefined namespace at collection
// time and be silently dropped — in the BUILT bundle only, which is what ships.
// So this is asked of the world rather than assumed from the file existing.
const mods = await page.evaluate(() => window.__ct.modules());
const mine = mods.find((m) => m.path === './inventory.ts');
ok(!!mine, `ct/inventory.ts is registered in this build (${mods.length} modules found)`);
// and AFTER ct/props.ts, or there would be no litter in the scene to adopt.
ok(!!mine && mine.order > 40, `it builds after the props (ORDER ${mine ? mine.order : '—'} > 40)`);
const hasInv = await page.evaluate(() => typeof window.__inv === 'object' && window.__inv !== null);
ok(hasInv, '__inv is published — the module ran, it did not merely load');
if (!hasInv) { console.log('nothing further can be measured'); await browser.close(); process.exit(3); }

// ── 1. the population, before any absence is asserted ────────────────────
const takeables = await page.evaluate(() => window.__inv.takeables());
ok(takeables >= MIN_TAKEABLES,
  `${takeables} newspaper(s) adopted as takeables (floor ${MIN_TAKEABLES})`);
if (takeables < MIN_TAKEABLES) {
  console.log('EMPTY SUBJECT SET — nothing below would have been measured');
  await browser.close(); process.exit(3);
}

// ── 2. find one, by asking the world where its [E] is ────────────────────
//
// Not by hand-typed coordinates. GOTCHAS §20: every hand-typed coordinate in
// this project has gone stale at least once, and the newspapers are placed by
// ct/props.ts from ITS layout, not from anything this file can know.
const spot = await page.evaluate(() => {
  const s = window.__ct.spots().filter((q) => /take the folded newspaper/.test(q.label));
  return s.length ? { ...s[0], n: s.length } : null;
});
ok(spot !== null, 'at least one [E] offers "take the folded newspaper"');
if (!spot) { await browser.close(); process.exit(1); }
console.log(`      offered at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) r=${spot.r}, ${spot.n} in the world`);

// stand ON it, facing it, on the ground it is on
await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z)), [spot.x, spot.z]);
await page.waitForTimeout(120);

const before = await page.evaluate(() => ({
  pockets: window.__inv.pockets(),
  slots: window.__inv.slots().length,
  offered: window.__ct.spots().filter((q) => q.ok && /take the folded newspaper/.test(q.label)).length,
}));
ok((before.pockets.NEWSPAPER ?? 0) === 0, 'pockets start with no newspaper in them');
ok(before.offered >= 1, 'standing on it, the take is live');

// ── 3. take it ────────────────────────────────────────────────────────────
//
// Held down and then POLLED, never slept on. The `[E]` dispatch is edge
// triggered inside the render loop, so a press-and-release can land entirely
// between two frames on a loaded machine — GOTCHAS §30, which cost door301.mjs
// four reds on a door that worked.
await page.keyboard.down('e');
await page.waitForFunction(() => (window.__inv.pockets().NEWSPAPER ?? 0) > 0, { timeout: 8000 })
  .catch(() => {});
await page.keyboard.up('e');

const after = await page.evaluate(() => ({
  pockets: window.__inv.pockets(),
  slots: window.__inv.slots().length,
  // did it LEAVE THE GROUND? Ask the scene, by the tag ct/props.ts stamps.
  visible: (() => {
    let vis = 0, hid = 0;
    window.__ct.scene().traverse((o) => {
      if (o.userData?.litter === 'folded newspaper') (o.visible ? vis++ : hid++);
    });
    return { vis, hid };
  })(),
  offered: window.__ct.spots().filter((q) => q.ok && /take the folded newspaper/.test(q.label)).length,
}));
ok((after.pockets.NEWSPAPER ?? 0) === 1, `it is in your pockets (NEWSPAPER x${after.pockets.NEWSPAPER ?? 0})`);
ok(after.slots === before.slots + 1, `it took one pocket (${before.slots} -> ${after.slots} of ${await page.evaluate(() => window.__inv.limit)})`);

// THE MUTATION (--selftest): put the newspaper back on the ground while it is
// in your pocket — a pickup that leaves a ghost behind, which is the exact
// thing rule 3 forbids and the exact thing a screenshot of a pavement could
// not tell you. If the check stays green through this it is decoration.
if (SELFTEST) {
  await page.evaluate(() => {
    window.__ct.scene().traverse((o) => { if (o.userData?.litter === 'folded newspaper') o.visible = true; });
  });
  console.log('      --selftest: every newspaper forced back to visible while carried');
}
const ghost = await page.evaluate(() => {
  let hid = 0;
  window.__ct.scene().traverse((o) => { if (o.userData?.litter === 'folded newspaper' && !o.visible) hid++; });
  return hid;
});
ok(ghost === 1, `the one you took LEFT THE GROUND (${ghost} hidden, expected 1)`);
ok(after.offered === before.offered - 1, `its [E] stopped offering (${before.offered} -> ${after.offered} live)`);

// ── 4. drop it, and it comes back ─────────────────────────────────────────
const standing = await page.evaluate(() => { const p = window.__ct.pos(); return { x: p[0], z: p[2], gy: p[3] }; });
await page.keyboard.down('g');
await page.waitForFunction(() => (window.__inv.pockets().NEWSPAPER ?? 0) === 0, { timeout: 8000 })
  .catch(() => {});
await page.keyboard.up('g');

const dropped = await page.evaluate(() => {
  let vis = 0, hid = 0, near = null;
  const p = window.__ct.pos();
  window.__ct.scene().traverse((o) => {
    if (o.userData?.litter !== 'folded newspaper') return;
    o.visible ? vis++ : hid++;
    const d = Math.hypot(o.position.x - p[0], o.position.z - p[2]);
    if (near === null || d < near.d) near = { d, y: o.position.y, gy: p[3] };
  });
  return {
    vis, hid, near,
    pockets: window.__inv.pockets(),
    offered: window.__ct.spots().filter((q) => q.ok && /take the folded newspaper/.test(q.label)).length,
  };
});
ok((dropped.pockets.NEWSPAPER ?? 0) === 0, 'it is out of your pockets');
ok(dropped.hid === 0, `nothing is left hidden — it CAME BACK (${dropped.hid} hidden)`);
ok(dropped.near.d < 0.5, `it landed at your feet (${dropped.near.d.toFixed(2)} m from where you stand)`);
// on the floor you are on, not buried and not floating: litter sits within a
// few cm of the ground, and ct/props.ts places every piece within 3 cm.
const lift = dropped.near.y - standing.gy;
ok(lift >= -0.02 && lift <= 0.10, `it is ON the ground you are on (${lift.toFixed(3)} m above your floor)`);
ok(dropped.offered === before.offered, `its [E] is live again (${dropped.offered} of ${before.offered})`);

// ── 5. and it can be taken a second time ─────────────────────────────────
await page.keyboard.down('e');
await page.waitForFunction(() => (window.__inv.pockets().NEWSPAPER ?? 0) > 0, { timeout: 8000 })
  .catch(() => {});
await page.keyboard.up('e');
const again = await page.evaluate(() => window.__inv.pockets().NEWSPAPER ?? 0);
ok(again === 1, 'the loop closes — you can pick it up again after dropping it');

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught the ghost' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);

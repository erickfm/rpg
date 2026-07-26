// PACKAGES ON THE LANDINGS — the user: *"every neighbor in the building has a
// small chance of getting a package · every night all packages go away ·
// packages never go in front of a door, only to the sides · you have the
// option to steal one · stealing gives you a random item."*
//
// The placement rule is the one worth guarding hardest, because it is the one
// that fails silently and only on some floor nobody walked: a parcel on a
// threshold looks fine from three of four angles. So this checks the parcel's
// NEAR EDGE against the door's own opening, on every door in the building,
// rather than eyeballing one landing.
//
// The world publishes `scene.userData.packages`; nothing here infers state.
import { chromium } from '/home/erick/projects/rpg-entrance/street/node_modules/playwright/index.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const PKG_D = 0.34, ST = 2.7;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 900));

const API = () => p.evaluate(() => !!window.__ct.scene().userData.packages);
if (!(await API())) {
  console.error('\nscene.userData.packages is missing — nothing was checked. Not a pass.');
  await b.close(); process.exit(3);                    // GOTCHAS 32
}
let fails = 0;
const rep = (n, ok, d) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${d}`); };
const list = () => p.evaluate(() => window.__ct.scene().userData.packages.list());
const force = (v) => p.evaluate((q) => window.__ct.scene().userData.packages.force(q), v);
const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find((x) => !x.children.length
    && /\[E\]/.test(x.textContent || '') && getComputedStyle(x).display !== 'none');
  return e ? e.textContent.trim() : null;
});

// ── 1. the building knows its own doors ────────────────────────────────────
await force(true);
await p.waitForTimeout(400);
const all = await list();
rep('every door in the building is declared', all.length === 8,
  `${all.length} doors across ${new Set(all.map((q) => q.floor)).size} landings`);

// ── 2. NEVER IN FRONT OF A DOOR, on every floor ────────────────────────────
// The near edge of the parcel against the near jamb. Centre-to-centre would
// pass with a parcel half in the opening.
let worst = Infinity, offender = null;
for (const q of all) {
  const clear = Math.abs(q.z - q.doorZ) - PKG_D / 2 - q.doorW / 2;
  if (clear < worst) { worst = clear; offender = q; }
}
rep('no parcel overlaps its own doorway, on any floor', worst > 0,
  `tightest is ${offender.num} with ${worst.toFixed(3)} m between the parcel's near edge and the jamb`);
rep('and they sit to the SIDE, not centred on the door', all.every((q) => Math.abs(q.z - q.doorZ) > q.doorW / 2),
  `offsets ${[...new Set(all.map((q) => Math.abs(q.z - q.doorZ).toFixed(2)))].join(', ')} m from each door's centre`);
rep('both sides get used', new Set(all.map((q) => q.side)).size === 2,
  `${all.filter((q) => q.side > 0).length} to one side, ${all.filter((q) => q.side < 0).length} to the other`);

// ── 3. RARE — appearing rarely rather than every night ─────────────────────
await force(null);
const days = [];
for (let d = 0; d < 40; d++) {
  await p.evaluate(() => window.__ct.advanceClock(24 * 60, 0));
  await p.waitForTimeout(90);
  days.push((await list()).filter((q) => q.present).length);
}
const withAny = days.filter((n) => n > 0).length;
const total = days.reduce((a, c) => a + c, 0);
rep('packages are rare, not nightly', withAny < days.length && total > 0,
  `${total} parcels over ${days.length} days — ${withAny} days had any at all, most ever on one day was ${Math.max(...days)}`);

// ── 4. THE NIGHTLY CLEAR, on the real clock ────────────────────────────────
// Same verb `ctx.clock.advance` that the bed calls, so this covers sleeping
// through the night as well as walking through it — the bed's act() is one
// call to it. Forced ON first so there is definitely something to clear.
await force(true);
await p.waitForTimeout(300);
const before = (await list()).filter((q) => q.present).length;
await force(null);
await p.evaluate(() => window.__ct.advanceClock(24 * 60, 0));
await p.waitForTimeout(300);
const after = (await list()).filter((q) => q.present).length;
rep('a night wipes the landings', before === 8 && after < 8,
  `${before} parcels before midnight, ${after} after — the roll is a hash of the day, so a new day IS a new set`);

// ── 5. STEALING ────────────────────────────────────────────────────────────
// Ground floor only, and that is not a choice: every [E] above gy 0 is
// currently unselectable (the sight ray is cast from a constant eye height —
// filed, and now an OPEN row against DESK). 101 and 102 are on gy 0.
await force(true);
await p.waitForTimeout(300);
const g = (await list()).find((q) => q.floor === 0 && q.present);
await p.evaluate(([x, z]) => window.__ct.warp(x - 0.75, z, Math.PI / 2, 0, 0), [g.x, g.z]);
await p.waitForTimeout(700);
const pr = await prompt();
rep('a parcel on the ground floor offers to be taken', !!pr && /take the package/.test(pr),
  pr ?? 'no prompt — check the sight ray regression before blaming the spot');
if (pr) {
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(600);
  const gone = (await list()).find((q) => q.num === g.num);
  rep('taking it removes it from the landing', !gone.present, `${g.num} present=${gone.present}`);
  await p.waitForTimeout(900);
  const still = (await list()).find((q) => q.num === g.num);
  rep('and it does not come back the same day', !still.present, `${g.num} still gone`);
}
await force(null);
await b.close();
console.log(fails ? `\n  ${fails} failed\n` : '\n  parcels arrive beside doors, never in them, clear overnight, and can be taken.\n');
process.exit(fails ? 1 : 0);

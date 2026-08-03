// A HIDDEN PROMPT MUST BE AN EMPTY PROMPT. Item 236.
//
// `ct/hud.ts`'s `prompt()` used to hide `#ct-prompt` and return **without
// clearing `textContent`**, so the last caption lingered indefinitely. Measured
// by worker eightyeight: `[E] into the HOUSE OF DETENTION` still readable
// **40 m from the jail door**, element hidden, after a real `w` nudge.
//
// **77 scripts read that element and 16 never look at `display`.** Every one of
// them could report that the world was offering an interaction it was not, and
// it cost an hour of "making a correct world look impossible".
//
// The fix is one line at the source. This is the guard that stops it coming
// back, and it asserts the INVARIANT rather than the one symptom:
//
//   hidden  <=>  empty
//
// Both directions matter. "Hidden but full" is the ghost. "Shown but empty" is
// its mirror — a caption bar with nothing in it — and a check that only tested
// one direction would pass on a `prompt()` that cleared the text and forgot to
// hide the box.
//
//   SHOT_URL=http://localhost:4410/ node scripts/prompt-not-a-ghost.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4410/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

const read = () => page.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  if (!el) return null;
  return { shown: el.style.display !== 'none', text: (el.textContent ?? '').trim() };
});
const go = async (x, z, yaw) => {
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);
  // a HELD key, not a tap: the [E] dispatch is an edge read once per rendered
  // frame, and the prompt is recomputed on the same per-frame pass
  await page.keyboard.down('w'); await page.waitForTimeout(70); await page.keyboard.up('w');
  await page.waitForTimeout(120);
  return read();
};

// ── the population: every published spot, plus open ground far from any ───
const spots = await page.evaluate(() => (window.__ct.spots?.() ?? []).map((s) => [s.x, s.z]));
report('there are spots to stand on at all', spots.length >= 10, `${spots.length} published spot(s)`);

let onSpotShown = 0, offSpotHidden = 0, ghosts = [], mirrors = [];
const sample = spots.slice(0, 40);
for (const [x, z] of sample) {
  const r = await go(x, z, 0);
  if (!r) continue;
  if (r.shown && r.text) onSpotShown++;
  if (r.shown && !r.text) mirrors.push({ where: [x, z], why: 'shown but EMPTY' });
  if (!r.shown && r.text) ghosts.push({ where: [x, z], text: r.text });
}
// …and open ground, deliberately visited RIGHT AFTER a spot so a stale value
// would still be in the element if one could survive
for (const [x, z] of [[0, -30], [0, -50], [20, -103], [3, -70], [-2, -20], [0, 5]]) {
  const r = await go(x, z, 0);
  if (!r) continue;
  if (!r.shown) offSpotHidden++;
  if (!r.shown && r.text) ghosts.push({ where: [x, z], text: r.text });
  if (r.shown && !r.text) mirrors.push({ where: [x, z], why: 'shown but EMPTY' });
}

// POPULATION FLOOR. "No ghosts" over a run where the prompt never appeared at
// all is the same sentence as "no ghosts", and a world that stopped offering
// anything would produce exactly that.
report('the prompt was actually SHOWN somewhere during the run', onSpotShown >= 5,
  `${onSpotShown} of ${sample.length} sampled spots showed a caption`);
report('and HIDDEN somewhere during the run', offSpotHidden >= 3,
  `${offSpotHidden} of 6 open-ground points hid it`);

report('a HIDDEN prompt is always an EMPTY prompt (no ghost text)', ghosts.length === 0,
  ghosts.length ? `${ghosts.length} ghost(s), e.g. ${JSON.stringify(ghosts.slice(0, 3))}`
    : 'every hidden reading had empty textContent — a reader that forgets to check display is safe');
report('a SHOWN prompt is never empty (the mirror case)', mirrors.length === 0,
  mirrors.length ? `${mirrors.length}, e.g. ${JSON.stringify(mirrors.slice(0, 3))}` : 'no empty caption bars');

report('no console errors', errs.length === 0, `${errs.length} page error(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nthe prompt is not a ghost');
await b.close();
process.exit(fails ? 1 : 0);

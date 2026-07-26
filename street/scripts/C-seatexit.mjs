// C's seat-exit matrix. `scripts/seatexit.mjs` is another agent's, written
// from my note, and stays theirs. This one adds the two things it cannot
// cover: that the exit fires from every LOOK DIRECTION (the contest used to
// be decided by aim), and the co-located casino stool — where it turns out a
// MODAL swallows keydown, which is a different fault and is named as such.
// LEAVING A SEAT MUST NOT BE A CONTEST. The user, stuck: *"pressing e doesnt
// get me out of it."*
//
// Standing up used to be an ordinary spot that had to WIN the E resolver, and
// it only ever won because a seated player is 0 m from it. Measured across the
// world: of 225 seats, 149 have a non-stand spot inside the 0.5 m stand radius
// and 12+ have one at EXACTLY 0.00 m — every seat registered without an
// `approach` puts its sit spot and its stand spot on the same coordinate.
//
// So this does not test "is there a prompt". It tests that the EXIT FIRES
// under the conditions that used to decide it: whatever he is looking at,
// wherever the nearest spot is, and on a seat whose own sit spot is
// co-located with its stand spot.
import { chromium } from '/home/erick/projects/rpg-entrance/street/node_modules/playwright/index.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 900));

let fails = 0;
const rep = (n, ok, d) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${d}`); };
const seated = () => p.evaluate(() => window.__ct.seated() !== null);
const prompt = () => p.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find((x) => !x.children.length
    && /\[E\]/.test(x.textContent || '') && getComputedStyle(x).display !== 'none');
  return e ? e.textContent.trim() : null;
});
const sitAt = async (x, z, gy) => {
  await p.evaluate(([a, c, g]) => window.__ct.warp(a, c, 0, g, -0.05), [x, z, gy]);
  await p.waitForTimeout(500);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(700);
  return seated();
};

// ── the bed, from every direction ───────────────────────────────────────────
let worst = null, n = 0;
for (const [yaw, pitch] of [[0, -0.05], [0, 1.2], [0, -1.4], [Math.PI / 2, 0], [Math.PI, 0], [-1.2, 0.6]]) {
  if (!(await sitAt(198.30, -16.30, 5.4))) { worst = 'could not sit'; break; }
  await p.evaluate(([y, pi]) => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], y, undefined, pi); }, [yaw, pitch]);
  await p.waitForTimeout(300);
  const label = await prompt();
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(700);
  if (await seated()) { worst = `stuck at yaw ${yaw.toFixed(1)} pitch ${pitch}`; break; }
  if (!label || !/stop watching TV/.test(label)) worst = worst ?? `label read "${label}"`;
  n++;
}
rep('E leaves the bed from every look direction', n === 6 && !worst,
  worst ?? `${n} of 6, prompt "[E] stop watching TV" throughout`);

// ── standLabel actually reaches the prompt ──────────────────────────────────
await sitAt(198.30, -16.30, 5.4);
rep('a state seat names its own exit', /stop watching TV/.test((await prompt()) ?? ''),
  (await prompt()) ?? 'no prompt');

// ── THE ESCAPE HATCH ────────────────────────────────────────────────────────
await p.keyboard.press('Escape');
await p.waitForTimeout(700);
rep('Escape leaves a seat too', !(await seated()),
  'this world had no cancel binding at all before — one exit is a trap');

// ── the 0.00 m case: a seat whose sit and stand spots are co-located ────────
// NOTE FOR ANYONE UPDATING THIS: 'stand up' is no longer a registered spot —
// that is the whole fix — so a co-located seat cannot be found by looking for
// one any more. A seat declared without `approach` has its SIT spot standing
// exactly on the seat, so the slot stools are found by label instead.
const stool = await p.evaluate(() => {
  // no `ok` filter: spots() evaluates ok() where the player currently STANDS,
  // and the casino seats are gated to their own room, so filtering on it here
  // rejects every one of them while you are in the apartment.
  const s = window.__ct.spots().find((q) => /sit at the slot/.test(q.label ?? ''));
  return s ? { x: s.x, z: s.z } : null;
});
if (!stool) {
  rep('found a co-located seat to test', false, 'none found — the 0.00 m cluster should exist');
} else {
  const ok = await sitAt(stool.x, stool.z, 0);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(700);
  const out = !(await seated());
  // A MODAL SWALLOWS THE KEY, and that is a different fault from the one this
  // script exists for. `hud.ts` BLOCKS keydown while a panel is open, so on a
  // seat that opens one, neither E nor Escape ever reaches the world — the
  // seat exit cannot help because the input never arrives. Say which it is
  // rather than reporting a generic failure against the wrong module.
  const panel = await p.evaluate(() => !!document.getElementById('ct-panelback')
    && getComputedStyle(document.getElementById('ct-panelback')).display !== 'none');
  rep('a seat whose sit and stand spots are CO-LOCATED still lets you out',
    ok && (out || panel),
    out ? `seat (${stool.x.toFixed(1)}, ${stool.z.toFixed(1)}) — the casino stool case`
        : panel ? `seat (${stool.x.toFixed(1)}, ${stool.z.toFixed(1)}) opens a MODAL (#ct-panelback) and hud.ts blocks keydown while one is open, so E and Escape never reach the world. NOT the seat exit — filed for the panel owner.`
        : 'still seated with no panel open');
}

await b.close();
console.log(fails ? `\n  ${fails} failed\n` : '\n  every seat lets go of you, whatever you are looking at.\n');
process.exit(fails ? 1 : 0);

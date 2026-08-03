// CAN THE PLAYER PICK THE SLIP UP AND FIND OUT WHAT IT IS? Item 169.
//
// The slip IS the "weird grass" (ct/tenancy.ts:1120-1141) and it is a deliberate
// feature, not litter. So the question that decides this item is not "delete it"
// — it is whether the user could have answered his own question in the world.
// `ctx.spot` registers "pick up the slip of paper" on it; this WALKS to it and
// presses E, rather than warping onto it (GOTCHAS 83a: a teleport suppresses the
// spot it drops you on) and rather than tapping E (BUILDER-BRIEF §5: the tap can
// begin and end inside one frame and never be observed).
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-can-you-pick-up-the-slip.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);

const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const slipVisible = () => p.evaluate(() => {
  let v = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    if (Math.hypot(e[12] - 199.85, e[14] + 16.5) < 0.3 && Math.abs(e[13] - 5.412) < 0.1) v = o.visible;
  });
  return v;
});
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(140); };

for (let d = 0; d < 30; d++) {
  await p.evaluate(() => window.__ct.advanceClock(1440, 0));
  await p.waitForTimeout(120);
  if (await slipVisible()) break;
}
await p.evaluate(() => window.__ct.clock(11, 0));
for (let d = 0; d < 30; d++) {
  await p.evaluate(() => window.__ct.advanceClock(1440, 0));
  await p.waitForTimeout(120);
  if (await slipVisible()) break;
}
console.log(`\nslip on the boards: ${await slipVisible()}   owed ${await p.evaluate(() => window.__rent.owed())}`);

// STAND IN THE MIDDLE OF THE ROOM AND WALK OVER — never warp onto the spot.
await p.evaluate(() => window.__ct.warp(198.4, -16.25, Math.atan2(199.85 - 198.4, -(-16.5 + 16.25)), 5.4, -0.5));
await p.waitForTimeout(1800);
await waitPainted(p, { quiet: true });
console.log(`from the room centre, prompt = ${JSON.stringify(await prompt())}`);

// KEEP WALKING UNTIL THE SLIP'S OWN LABEL APPEARS — not until ANY prompt does.
// The first cut of this broke on the first non-null prompt and stopped on "[E]
// sit on the bed and watch TV", which is a different spot entirely and would
// have reported the slip reachable when nothing of the sort was shown.
let got = null;
const seen = [];
for (let step = 0; step < 14; step++) {
  await hold('w', 130);
  const pr = await prompt();
  const at = await p.evaluate(() => window.__ct.pos());
  const d = Math.hypot(at[0] - 199.85, at[2] + 16.5);
  seen.push(`      step ${String(step + 1).padStart(2)}  at ${at[0].toFixed(2)},${at[2].toFixed(2)}  ${d.toFixed(2)} m from the slip  prompt ${JSON.stringify(pr)}`);
  if (pr && /slip of paper/.test(pr)) { got = { pr, at, step }; break; }
}
console.log(seen.join('\n'));
console.log(got
  ? `\n  GOT IT after ${got.step + 1} steps at ${JSON.stringify(got.at)} -> ${JSON.stringify(got.pr)}`
  : `\n  walked 14 steps and the slip's own prompt NEVER appeared`);

await p.screenshot({ path: 'shots/w86-slip-prompt.png' });

if (got && /slip of paper/.test(got.pr)) {
  const before = await p.evaluate(() => window.__rent.waiting().length);
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/w86-slip-picked-up.png' });
  const panel = await p.evaluate(() => document.body.innerText.slice(0, 700));
  console.log(`\n  picked up. slip still on the boards: ${await slipVisible()}`);
  console.log(`  letters waiting before: ${before}`);
  console.log(`  --- what the screen now says ---\n${panel.split('\n').filter(Boolean).slice(0, 14).map((l) => '      ' + l).join('\n')}`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  console.log(`\n  after Escape, prompt = ${JSON.stringify(await prompt())} (a panel you cannot close is the worst bug this project ships)`);
}
if (errors.length) console.log('\nPAGE ERRORS:\n' + errors.join('\n'));
await b.close();

// THE CLAIM: *"you get letters at the mailboxes ON ENTRY"* — the user's own
// words, and the one motion nothing else tests. Walk in the front door of
// No. 227 and go to your box. The prompt must be reachable.
//
// IT IS RED TODAY, AND IT IS DELIBERATELY NOT REGISTERED IN `scripts/checks.mjs`.
// The cause is in `src/proto/crosstown.ts`, which is desk-owned, so registering
// it would redden the shared suite over something I cannot fix — C's rule, and
// C held `mods-dim` back for exactly this reason and then registered it the day
// the fix landed. Same here: `notes/N-mail-on-entry-BLOCKED.md` has the finding,
// and this goes into the suite the day the latch changes.
//
// WHY MY OTHER CHECK MISSES IT. `N-post-waiting` walks to the mailbox from up
// the lobby, which passes. The defect only exists after a TRANSITION, and the
// transition is the whole of the user's sentence.
//
// Usage: SHOT_URL=http://localhost:<a port you own>/ node scripts/N-mail-on-entry.mjs
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { flags } from '../lib/args.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4195/';
const ARGS = flags(['--selftest']);
if (ARGS.rest.length) {
  console.error(`\nUNRECOGNISED ARGUMENT: ${ARGS.rest.join(', ')}`);
  console.error('  This script takes no positional argument. It accepts --selftest.\n');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  await page.goto(URL, { waitUntil: 'networkidle' });
} catch (e) {
  // A dead server is NOTHING MEASURED, not a failure (GOTCHAS §32).
  console.error(`\nNOTHING IS SERVING ${URL}  (${e.message.split('\n')[0]})\n`);
  await browser.close();
  process.exit(3);
}
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.waitForTimeout(2000);

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };

// THE PROMPT IS READ FROM ITS VISIBILITY, NOT ITS TEXT. `#ct-prompt` keeps the
// last thing it said and is hidden with `display:none`, so `textContent` alone
// reports a prompt that is not on screen. That cost me a full round: I read the
// stale text, concluded the wrong prompt was showing, and started diagnosing a
// bug that was in my probe.
const visiblePrompt = () => page.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  if (!d) return null;
  return getComputedStyle(d).display === 'none' ? null : d.textContent.trim();
});

// ── THE CONTROL FIRST, and on a page that has not transitioned ────────────
//
// It has to come first or it is not a control. I wrote it at the BOTTOM and it
// went red with everything else — because by then the page had already made the
// transition the test is about, and a warp of less than the latch radius does
// not clear it. A control that inherits the condition it is controlling for
// measures nothing. Third ordering fault of this shape I have made today.
{
  const st = await page.evaluate(() => window.__rent.box().stand);
  await page.evaluate((s) => window.__ct.warp(s.x, s.z, Math.PI / 2, s.gy, 0), st);
  await page.waitForTimeout(400);
  ok(await visiblePrompt() !== null,
    'CONTROL: standing at the box WITHOUT having just transitioned shows the prompt');
}

// ── walk in through the front door, as a player does ──────────────────────
const enter = await page.evaluate(() =>
  window.__ct.spots().find((q) => /enter No\. 227/.test(q.label)) ?? null);
ok(!!enter, "the street offers [E] enter No. 227");
if (!enter) { await browser.close(); process.exit(3); }

await page.evaluate((e) => window.__ct.warp(e.x, e.z, Math.PI / 2, window.__ct.groundAt(e.x, e.z), 0), enter);
await page.waitForTimeout(350);
await page.keyboard.down('e');
await page.waitForFunction(() => window.__ct.pos()[0] > 200, { timeout: 8000 }).catch(() => {});
await page.keyboard.up('e');
await page.waitForTimeout(800);

const land = await page.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2], gy: q[3] }; });
ok(land.x > 200 && land.gy < 0.5, `you are in the lobby (${land.x.toFixed(2)}, ${land.z.toFixed(2)})`);

// the population, before any absence: there must BE post to be offered
const waiting = await page.evaluate(() => window.__rent.waiting().length);
ok(waiting > 0, `${waiting} letters are waiting — otherwise every clause below is free`);

// the spot is LIVE and in range from where the door put you …
const reach = await page.evaluate((l) => {
  const s = window.__ct.spots().find((q) => /mailbox|read your mail/.test(q.label));
  return s ? { ok: s.ok, d: Math.hypot(s.x - l.x, s.z - l.z), r: s.r } : null;
}, land);
ok(reach && reach.ok && reach.d <= reach.r,
  `the mailbox [E] is live and ${reach ? reach.d.toFixed(2) : '?'} m away, inside its ${reach ? reach.r : '?'} m trigger`);

// … AND THE PROMPT MUST BE ON SCREEN. This is the clause that fails.
ok(await visiblePrompt() !== null,
  'the prompt is VISIBLE where the door puts you — the user asked for the post ON ENTRY');

// AND THE INTERACTION ITSELF IS SUPPRESSED, not merely its prompt. This is the
// clause that decides the triage (GOTCHAS §23, real vs visible): a hidden prompt
// over a working key is a cosmetic fault; a key that does nothing is the feature
// not being there. Press E blind, from where the door put you.
{
  const before = await page.evaluate(() => window.__rent.waiting().length);
  await page.keyboard.down('e');
  await page.waitForTimeout(1100);
  await page.keyboard.up('e');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    reading: window.__rent.reading(), waiting: window.__rent.waiting().length }));
  ok(after.reading !== null || after.waiting < before,
    `pressing E where the door puts you actually collects the post `
    + `(${before} waiting before, ${after.waiting} after, panel ${after.reading ? 'open' : 'shut'})`);
}

// walking to the boxes must reach it, which is the motion anybody would make
await page.evaluate(() => { const q = window.__ct.pos(); window.__ct.warp(q[0], q[2], Math.PI / 2, q[3], 0); });
await page.waitForTimeout(200);
let got = null;
for (let i = 0; i < 6 && !got; i++) {
  await page.keyboard.down('w'); await page.waitForTimeout(110); await page.keyboard.up('w');
  await page.waitForTimeout(200);
  got = await visiblePrompt();
}
const at = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(2)));
ok(got !== null,
  `walking to the boxes reaches the prompt (ended at ${at[0]}, ${at[2]} — ${got ?? 'still nothing'})`);

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall green');
await browser.close();
process.exit(fails.length ? 1 : 0);

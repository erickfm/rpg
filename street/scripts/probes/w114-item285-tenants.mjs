// ITEM 285, the half nobody had touched — DO THE FIVE DIEGETIC TENANTS THAT COPY
// THE ATM SHOW A PROMPT THE PRESS WILL NOT DELIVER?
//
// The row: *"The ATM is the reference implementation of the diegetic framework —
// five tenants now follow it (slots, mail, library PC, loan, calendar) — so
// whatever is wrong here may be copied."* onehundredfifteen's scoping note records
// them as **"not examined at all"**. This examines them.
//
// THE TEST IS THE ROW'S OWN "DONE WHEN": *the prompt appears exactly where the
// press works.* So for every tenant, at four cardinal yaws from a real stand-off:
//
//   prompt names the tenant  AND  the press raises its panel        -> honest
//   prompt names the tenant  AND  the press raises nothing          -> A LIE
//   prompt names something else / nothing, press raises nothing     -> honest
//
// The third row is the one this row got wrong twice: at the ATM, `[E] into FIRST
// FEDERAL` at yaw 0 is the bank DOOR, and `panel = null` after pressing a door is
// correct — it moves you 445 m instead. So travel is recorded beside the panel and
// a station that moved is never scored as a dead press.
//
// STAND-OFF, NOT SPOT-CENTRE. Warping onto a spot's own coordinates lands you
// inside whatever the spot is attached to, and `pickSpot`'s tier 1 is
// `d < RADIUS` — the spot's centre inside your own body — which wins regardless of
// yaw. A yaw sweep from in there is not a yaw sweep. Every station below is
// checked for drift and skipped if the world moved the player.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item285-tenants.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4482/');
// The five named by the row, plus the ATM itself as the reference. Matched on the
// label the world publishes, so a renamed tenant shows up as MISSING rather than
// silently passing by not being tested.
const TENANTS = [
  ['ATM (reference)', /use the machine/i],
  // /slot machine/ FOUND NOTHING and that was MY regex, not the world:
  // `ct/slots.ts:2356` writes 'play the slot machine' but the registered spot
  // is a SEAT, labelled 'sit at the slot' (17 of them, measured by
  // `w114-item285-casino-labels.mjs`). A tenant reported MISSING because the
  // probe asked for the wrong string is a probe measuring nothing in green.
  ['slots', /slot/i],
  ['library PC', /the computer/i],
  ['calendar', /calendar/i],
  ['loan', /loan/i],
  ['mail', /mail|letter|post/i],
];
// STAND-OFFS. 1.0 and 1.4 alone left the CALENDAR untested — r 0.6, and it is
// not offered at either distance, so every one of its stations scored "n/a" and
// the tenant was reported on without ever having been exercised. 0.7 is inside
// its band. A row of n/a is not a pass.
const STANDOFF = [0.7, 1.0, 1.4];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);
await p.waitForTimeout(700);

const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  return el && getComputedStyle(el).display !== 'none' ? (el.textContent ?? '').trim() : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });

// EVERY spot, not only the ok() ones: an interior tenant's `ok()` is false until
// you are inside, and the whole point is to go there.
const all = await p.evaluate(() => (window.__ct.spots?.() ?? []).map((s) => ({
  label: String(typeof s.label === 'function' ? s.label() : s.label),
  x: s.x, z: s.z, r: s.r, ok: !!(typeof s.ok === 'function' ? s.ok() : s.ok),
})));
console.log(`world  ${URL}\nspots registered: ${all.length}\n`);

const rows = [];
for (const [name, re] of TENANTS) {
  const hits = all.filter((s) => re.test(s.label));
  if (!hits.length) { rows.push([name, 'MISSING', '—', '—', 'no spot matches this label']); continue; }
  const s = hits[0];
  console.log(`── ${name}: "${s.label}" at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r${s.r}  [${hits.length} spot(s)]`);
  // Get into the room first: warp ONTO the spot, settle long enough for a storey
  // change (GOTCHAS 51 puts that at ~1.5 s), then step back off it.
  const gy0 = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [s.x, s.z]);
  await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [s.x, s.z, gy0]);
  await p.waitForTimeout(1800);

  let tested = 0;
  for (const d of STANDOFF) {
    for (let k = 0; k < 4; k++) {
      // stations on the four cardinal offsets, each AIMED AT THE SPOT — the row
      // asks for four yaws; four approach directions all facing the tenant is the
      // player's version of that, and it is the pose his complaint describes.
      const th = (k / 4) * Math.PI * 2;
      const x = s.x + Math.sin(th) * d, z = s.z + Math.cos(th) * d;
      const gy = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
      const yaw = Math.atan2(s.x - x, -(s.z - z));
      await p.evaluate(() => window.__hud.closePanels());
      await p.waitForTimeout(400);
      await p.evaluate(([a, c, y, g]) => window.__ct.warp(a, c, y, g, 0), [x, z, yaw, gy]);
      await p.waitForTimeout(700);
      const at = await pos();
      // DRIFT DISQUALIFIES A STATION. If the world moved the player, the pose
      // measured is not the pose requested and tier 1 may be firing on a body
      // overlap rather than on aim.
      if (Math.hypot(at.x - x, at.z - z) > 0.15) continue;
      const pr = await prompt();
      const before = at;
      await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
      let opened = null;
      for (let i = 0; i < 12; i++) { opened = opened ?? await panel(); await p.waitForTimeout(100); }
      const after = await pos();
      const moved = Math.hypot(after.x - before.x, after.z - before.z);
      const names = re.test(pr ?? '');
      tested++;
      const verdict = !names ? 'n/a (prompt is something else)'
        : opened ? 'HONEST — prompt named it, panel opened'
          : moved > 1.0 ? 'HONEST — prompt named it, it moved you'
            : 'A LIE — prompt named it and the press did nothing';
      rows.push([name, `d${d.toFixed(1)} dir${k}`, String(pr ?? '(none)').slice(0, 34),
        `${opened ?? 'null'} / moved ${moved.toFixed(2)}`, verdict]);
    }
  }
  if (!tested) rows.push([name, 'UNREACHED', '—', '—', 'every station drifted; could not stand near it']);
}

console.log('\n  tenant           station        prompt                              panel / travel        verdict');
for (const r of rows) {
  console.log(`  ${r[0].padEnd(16)} ${r[1].padEnd(14)} ${r[2].padEnd(35)} ${r[3].padEnd(21)} ${r[4]}`);
}
const lies = rows.filter((r) => /A LIE/.test(r[4]));
console.log(`\nLYING PROMPTS: ${lies.length} of ${rows.filter((r) => /HONEST|A LIE/.test(r[4])).length} stations where the prompt named the tenant`);
console.log(`console errors: ${errs.length}`);
await b.close();

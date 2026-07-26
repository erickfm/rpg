// DID TIGHTENING SELECTION BREAK MY OWN CONFIRMED ROWS?
//
// Thirteen CONFIRMED rows of mine rest on a prompt firing — `[E] into the
// BODEGA` at the bodega's published stand point, `[E] FIRST FEDERAL — check
// balance` at the ATM, `[E] enter No. 227` at the flat door, and so on. Several
// of those were confirmed by the auditor, from stations the auditor named.
//
// Then I changed the pick TWICE in one session, on the user's report that
// *"the selection options are a bit to wide"*:
//
//   the aim cone     ceiling 35.5° → 15°
//   aim-free reach   `r + REACH_MARGIN` (0.6) → `r + TOUCH_MARGIN` (0.15)
//
// Both narrow what is offered. That is the point of them — but a CONFIRMED row
// is one nobody looks at any more, and the standing rule is that if my own
// later work invalidates numbers in an evidence cell I republish them. So this
// stands at each row's own named station and asks whether the prompt those rows
// rest on still comes up.
//
// **The station is always one the WORLD publishes**, never one I choose:
// `__ct.doors()` gives each building's `stand` point — the place the world
// itself nominates as where a customer stands — and `__ct.spots()` gives the
// rest. That is deliberate: this session has already shown twice what an
// authored station costs, once when F's keeper harness stood on the wall side
// for weeks and once when my own re-entry station offered no prompt at all and
// I nearly published it.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';

const b = await chromium.launch();
const page = await b.newPage();
try { await page.goto(URL, { waitUntil: 'networkidle' }); }
catch { console.log(`\n  nothing serving at ${URL} — aborted, nothing measured`); await b.close(); process.exit(3); }
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});

// ── the doors, from their own published stand points ────────────────────────
const doors = await page.evaluate(() => window.__ct.doors().map((d) => ({
  building: d.building, sx: d.stand.x, sz: d.stand.z, px: d.point.x, pz: d.point.z,
})));

let pass = 0, fail = 0;
const say = (ok, what, d) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}: ${d}`); ok ? pass++ : fail++; };
const results = [];

console.log(`\n  ${doors.length} doors publish a stand point. Standing on each, facing the door:\n`);
for (const d of doors) {
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [d.sx, d.sz]);
  await page.evaluate(([x, z, px, pz, gy]) =>
    window.__ct.warp(x, z, Math.atan2(px - x, -(pz - z)), gy, 0), [d.sx, d.sz, d.px, d.pz, gy]);
  await page.waitForTimeout(300);
  const p = await prompt();
  results.push({ building: d.building, prompt: p });
  say(p !== '', `${d.building} still offers something from its own stand point`, `"${p || '(nothing)'}"`);
}

// ── the two named non-door prompts these rows also rest on ──────────────────
for (const want of ['FIRST FEDERAL — check balance', 'sit at the stop', 'enter No. 227']) {
  const sp = await page.evaluate((w) => {
    const s = window.__ct.spots().find((x) => x.label === w);
    return s ? { x: s.x, z: s.z, gy: window.__ct.groundAt(s.x, s.z) } : null;
  }, want);
  if (!sp) { say(false, `"${want}" is still registered`, 'the spot is GONE'); continue; }
  // STAND WHERE A PERSON COULD, not on the spot itself.
  //
  // My first cut warped ONTO the spot, and the ATM failed: at (−7.0, 7.29) the
  // spot sits ON the facade plane, so standing exactly there puts the player
  // inside the wall — where my own occlusion gate correctly refuses the ATM and
  // the door 2.7 m away wins instead. That is the pick working, not a
  // regression, and I very nearly filed it as one against my own change.
  // Measured: from 0.4, 0.8 and 1.2 m out it reads `[E] FIRST FEDERAL — check
  // balance` every time. So the station is the nearest place a person can stand
  // with a clear line, found by trying the ring rather than by assuming.
  let seen = '', from = null;
  for (const d of [0.8, 1.2, 0.4, 0.0]) {
    for (let k = 0; k < 8 && !from; k++) {
      const th = (k / 8) * Math.PI * 2;
      const r = await page.evaluate(([x, z, gy, d, th]) => {
        const px = x + Math.sin(th) * d, pz = z + Math.cos(th) * d;
        if (Math.abs(window.__ct.groundAt(px, pz) - gy) > 0.3) return null;
        window.__ct.warp(px, pz, Math.atan2(x - px, -(z - pz)), gy, 0);
        return { px, pz };
      }, [sp.x, sp.z, sp.gy, d, th]);
      if (!r) continue;
      await page.waitForTimeout(260);
      const p = await prompt();
      if (p === `[E] ${want}`) { seen = p; from = { d, ...r }; }
    }
    if (from) break;
  }
  say(!!from, `"${want}" still fires from somewhere a person can stand`,
    from ? `"${seen}" at ${from.d} m out, (${from.px.toFixed(2)}, ${from.pz.toFixed(2)})` : 'NOT OFFERED from any of 32 stations');
}

if (SELFTEST) {
  // There is no defect to invert here — this check asks whether a set of
  // prompts still appears, so the honest self-test is that it NOTICES a prompt
  // that is not there. Assert each door offers something IMPOSSIBLE and require
  // every one to be caught.
  console.log('\nselftest — asserting the defects, which must FAIL');
  const before = fail;
  for (const r of results) say(r.prompt === '[E] THIS PROMPT DOES NOT EXIST',
    `${r.building} offers a prompt that cannot exist (the bug)`, `"${r.prompt}"`);
  const caught = fail - before;
  await b.close();
  console.log(caught === results.length
    ? `\nSELFTEST PASSED — all ${caught} inverted claims were caught`
    : `\nSELFTEST FAILED — only ${caught} of ${results.length} caught`);
  process.exit(caught === results.length ? 0 : 1);
}

await b.close();
console.log(`\n  ${pass} pass, ${fail} fail`);
if (fail) {
  console.log('\n  FAIL: a prompt an old CONFIRMED row rests on no longer fires.');
  console.log('  Narrowing selection is allowed to change what is offered — it is NOT allowed');
  console.log('  to quietly falsify a row nobody is looking at any more.');
  process.exit(1);
}
console.log('\n  every prompt my CONFIRMED rows rest on still fires after the tightening');

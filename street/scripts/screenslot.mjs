// CAN A DIEGETIC PANEL HANG ON A MULTI-MATERIAL MESH? (item 150)
//
// `THREE.Mesh.material` is legally `Material | Material[]`. `ct/hud.ts` used to
// cast it to a single material when borrowing a face for a panel, and on an
// array that cast is a lie with teeth: `mat.color` is `undefined`, so
// `savedColor = mat.color.getHex()` threw **out of `open()`** — and it threw
// AFTER `gateUp(true)` had already frozen the player's feet. `close()` then
// threw the `setHex` mirror, so the machine was left wearing a frozen copy of
// the last thing it said. A panel that cannot be closed cleanly is the worst
// bug this project ships.
//
// A box with a screen on one face is the ORDINARY way to build a cabinet, so
// this is not an exotic input.
//
// WHAT THIS ASSERTS, and both legs would have caught the original bug because
// the original THREW on both:
//
//   1. a ONE-slot array still hangs the panel on the mesh — that is the
//      unambiguous case and it must keep working, not merely not-crash
//   2. a MULTI-slot array with no `materialIndex` DEGRADES: no throw, the panel
//      opens as the screen-space cabinet, and the console says which mesh needs
//      the index
//   3. a SIX-slot box carcass does not FREEZE THE WORLD WITH NO PANEL UP —
//      the leg that matters most, and the one the row understated. The throw
//      site sat after `gateUp(true)` and outside any `try`, so the failure was
//      not "a check throws", it was the player frozen with input captured and
//      nothing on screen, Escape the only way out
//   4. in every case the panel still CLOSES, and no case leaves a page error
//
// Watched failing on the real pre-fix `hud.ts`: 13 assertions red, including
// `panel()=ct-atm while the wrapper is at opacity 0`.
//
// Usage: SHOT_URL=http://localhost:4460/ node scripts/screenslot.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = aim('http://localhost:4177/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await goto(page, URL);
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, URL);   // GOTCHAS 26: prove which world, do not name it
await page.waitForTimeout(800);

let bad = 0;
const say = (ok, line, detail) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${line}`);
  if (!ok) { bad++; if (detail) console.log(`       ${detail}`); }
};

// ── which panels actually hang on a mesh in this world? ────────────────────
//
// ⚠ THE 700 ms IS LOAD-BEARING. `hud.ts` DISMISS_LOCKOUT is 500: `open()` is a
// SILENT no-op for half a second after a close. At 120 ms every re-open below
// never happens, every assertion passes vacuously, and this file certifies
// nothing. That is not hypothetical — it is how the probe behind this check
// reported a multi-material mesh as FINE while the bug was live.
//
// hud.ts:854 puts the panel id on the WRAP; the hidden element is its unnamed
// child CANVAS (hud.ts:864, hidden at 1106). Reading the wrap says "not
// diegetic" for every panel in the world.
const survey = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = [];
  for (const id of window.__hud.panels()) {
    let up = null, diegetic = null;
    try {
      window.__hud.openPanel(id);
      await sleep(150);
      up = window.__hud.panel();
      const cv = document.getElementById(id)?.querySelector('canvas');
      diegetic = cv ? cv.style.display === 'none' : null;
    } catch { /* recorded as a page error */ }
    try { window.__hud.closePanels(); } catch { /* ignore */ }
    await sleep(700);
    res.push({ id, up, diegetic });
  }
  return res;
});
const diegetic = survey.filter((r) => r.diegetic === true).map((r) => r.id);
console.log(`\n${survey.length} panels, ${diegetic.length} hang on a mesh: ${diegetic.join(', ') || 'NONE'}`);

// POPULATION FLOOR. Every assertion below is "do this to a diegetic panel", so
// over an empty set they are all free. Measured on this tree: 3 of 7 panels are
// diegetic (ct-atm, ct-letter, ct-loan). If that goes to zero the surfaces have
// stopped resolving and this file must say so rather than print green.
if (diegetic.length < 1) {
  console.error(`\n  FAIL no panel in this world hangs on a mesh, so every case below`);
  console.error(`  measures nothing. Has \`surface.mesh()\` stopped resolving, or is the`);
  console.error(`  screen focus controller unregistered?`);
  console.log('\nSCREENSLOT: FAIL');
  await browser.close();
  process.exit(1);
}

for (const id of diegetic) {
  console.log(`\n── ${id} ──`);
  const r = await page.evaluate(async (id) => {
    const nap = (ms) => new Promise((res) => setTimeout(res, ms));
    // find the mesh this panel hangs on: it wears a texture whose image IS the
    // panel's own canvas element
    window.__hud.openPanel(id); await nap(150);
    const cv = document.getElementById(id)?.querySelector('canvas');
    let mesh = null;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && !Array.isArray(m) && m.map && m.map.image === cv) mesh = o;
    });
    window.__hud.closePanels(); await nap(700);
    if (!mesh) return { found: false };

    const original = mesh.material;
    const isDiegetic = () => {
      const c = document.getElementById(id)?.querySelector('canvas');
      return c ? c.style.display === 'none' : null;
    };
    const run = async (material) => {
      mesh.material = material;
      let threw = null, diegetic = null, closed = null, up = null, opacity = null;
      try {
        window.__hud.openPanel(id); await nap(250);
      } catch (e) { threw = String((e && e.message) || e); }
      // ⚠ READ THE STATE OUTSIDE THE `try`, AND THIS IS THE WHOLE POINT.
      //
      // These three reads used to sit INSIDE it. When `open()` threw — which is
      // precisely the case this is here to catch — they never ran, `up` stayed
      // null, and `frozenBlind` was false BY ABSENCE. The freeze assertion then
      // printed OK against the pre-fix source, which is a check that cannot
      // fail. Watched: 12 other assertions went red on that run and this one
      // stayed green.
      //
      // THE FREEZE OBSERVABLE. `gateUp(true)` runs BEFORE the surface work, so a
      // throw after it leaves the panel logically OPEN (`panel() === id`, input
      // captured, feet frozen) while the wrapper is still at opacity 0 from the
      // last close — the player frozen, looking at the world, nothing on screen.
      diegetic = isDiegetic();
      up = window.__hud.panel();
      opacity = document.getElementById(id)?.style.opacity ?? null;
      try { window.__hud.closePanels(); await nap(700); } catch (e) { closed = String((e && e.message) || e); }
      return { threw, diegetic, closedThrew: closed, upWhileOpen: up, opacity,
               frozenBlind: !!up && opacity !== '1', panelAfter: window.__hud.panel() };
    };

    // 1. ONE slot — unambiguous, must still hang on the mesh
    const one = await run([original]);
    // 2. TWO slots, no materialIndex — must degrade, not throw
    const two = await run([original, original.clone()]);
    // 3. SIX slots — a real box carcass. `ct/apartment.ts:1534` builds the
    //    mailbox bank exactly like this, and its own comment names face 1 as
    //    the one turned into the hall, so this is the shape a future diegetic
    //    surface will actually meet.
    const six = await run([original, original.clone(), original.clone(),
                           original.clone(), original.clone(), original.clone()]);

    mesh.material = original;                   // put the world back
    window.__hud.closePanels(); await nap(300);
    return { found: true, name: mesh.name || '(unnamed)', one, two, six };
  }, id);

  if (!r.found) { say(false, `could not identify the mesh ${id} hangs on`); continue; }
  console.log(`  mesh: ${r.name}`);

  say(r.one.threw === null, `a ONE-slot material array does not throw`, `threw: ${r.one.threw}`);
  say(r.one.diegetic === true, `a ONE-slot material array still hangs the panel on the mesh`,
    `diegetic=${r.one.diegetic} — it fell back to the screen-space cabinet`);
  say(r.one.panelAfter === null, `and it closes`, `panel still up: ${r.one.panelAfter}`);

  say(r.two.threw === null, `a TWO-slot array with no materialIndex does not throw`, `threw: ${r.two.threw}`);
  say(r.two.diegetic === false, `a TWO-slot array with no materialIndex degrades to the cabinet`,
    `diegetic=${r.two.diegetic} — it guessed a slot instead of degrading`);
  say(r.two.panelAfter === null, `and it closes`, `panel still up: ${r.two.panelAfter}`);

  // ── THE FREEZE, WHICH IS THE REAL DANGER (desk escalation on item 150) ────
  // The row said "it throws rather than degrading". The consequence was worse:
  // the throw sat after `gateUp(true)` and outside any try, so the world froze
  // with input captured and NOTHING ON SCREEN. Asserting "did not throw" does
  // not cover that — a future refactor could swallow the throw and still leave
  // the panel invisible. So this asserts the state directly.
  say(r.six.threw === null, `a SIX-slot box carcass does not throw`, `threw: ${r.six.threw}`);
  say(r.six.frozenBlind === false,
    `a SIX-slot box carcass does not FREEZE THE WORLD WITH NO PANEL UP`,
    `panel()=${r.six.upWhileOpen} while the wrapper is at opacity ${r.six.opacity} — `
    + `input is captured and there is nothing on screen`);
  say(r.six.diegetic === false, `and it degrades to the cabinet rather than guessing a face`,
    `diegetic=${r.six.diegetic}`);
  say(r.six.panelAfter === null, `and it closes`, `panel still up: ${r.six.panelAfter}`);
}

// The degrade must SAY which mesh needs the index — a silent fallback is how a
// screen quietly stops being diegetic and nobody finds out for a month.
const named = errors.filter((e) => /does not say which slot is the screen/.test(e));
console.log('');
say(named.length >= diegetic.length * 2,
  `each degrade names the mesh and asks for materialIndex (${named.length} of ${diegetic.length * 2})`,
  'expected one console.error per degraded panel');

// Everything else on the console is a real fault. The degrade messages above are
// this check's own expected output and are excluded by exact match.
const unexpected = errors.filter((e) => !/does not say which slot is the screen/.test(e));
if (unexpected.length) {
  console.log('\nUNEXPECTED CONSOLE/PAGE ERRORS:');
  for (const e of unexpected) console.log('  ' + e);
  bad++;
}

console.log(`\nSCREENSLOT: ${bad ? 'FAIL' : 'OK'}`);
await browser.close();
process.exit(bad ? 1 : 0);

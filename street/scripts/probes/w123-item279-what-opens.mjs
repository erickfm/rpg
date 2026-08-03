// Item 279 — `D-walk`'s ATM leg reads `3 full-screen panels -> 3`. Is the CHECK
// wrong or is the WORLD wrong?
//
// Read-only. Stands where D-walk stands, presses E the same way, and prints
// every reading that could settle it: the DOM overlay count the old check uses,
// `__hud.panel()`, `__atm.screen()`, `__atm.padLive()`, and whether the panel
// has a surface mesh in the scene.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

// the old check's own predicate, lifted verbatim so the comparison is fair
const overlays = () => p.evaluate(() => [...document.querySelectorAll('canvas,div')]
  .filter((e) => { const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    return r.width > 300 && r.height > 200 && st.display !== 'none' && st.visibility !== 'hidden'
      && +st.opacity !== 0 && (st.position === 'fixed' || st.position === 'absolute'); })
  .map((e) => `${e.tagName.toLowerCase()}#${e.id || '(none)'}`));
const state = async (tag) => {
  const o = await overlays();
  const s = await p.evaluate(() => ({
    hudPanel: window.__hud?.panel() ?? null,
    hudPanels: window.__hud?.panels() ?? null,
    atmScreen: window.__atm?.screen() ?? null,
    padLive: window.__atm?.padLive?.() ?? null,
    surfaceMesh: (() => { const m = window.__atm?.surfaceMesh?.(); return m ? m.name || m.type : null; })(),
    ctAtmStyle: (() => { const e = document.getElementById('ct-atm'); if (!e) return null;
      const st = getComputedStyle(e), r = e.getBoundingClientRect();
      return { display: st.display, opacity: st.opacity, w: Math.round(r.width), h: Math.round(r.height) }; })(),
    prompt: ((document.body.innerText || '').match(/\[E\][^\n]*/) ?? [''])[0],
  }));
  console.log(`\n${tag}`);
  console.log(`  DOM overlays >300x200 : ${o.length}  ${JSON.stringify(o)}`);
  console.log(`  __hud.panel()         : ${JSON.stringify(s.hudPanel)}`);
  console.log(`  __hud.panels()        : ${JSON.stringify(s.hudPanels)}`);
  console.log(`  __atm.screen()        : ${JSON.stringify(s.atmScreen)}  padLive ${s.padLive}`);
  console.log(`  __atm.surfaceMesh()   : ${JSON.stringify(s.surfaceMesh)}`);
  console.log(`  #ct-atm computed      : ${JSON.stringify(s.ctAtmStyle)}`);
  console.log(`  prompt                : ${JSON.stringify(s.prompt)}`);
  return s;
};

// D-walk's own stand: warp(-6.0, 7.29, -PI/2)
await p.evaluate(() => window.__ct.warp(-6.0, 7.29, -Math.PI / 2, 0, 0));
await p.waitForTimeout(420);
await state('BEFORE [E]');

// exactly as D-walk does it: a bare press()
await p.keyboard.press('e');
await p.waitForTimeout(900);
await state('AFTER  page.keyboard.press("e")   ← what D-walk does');

// …and the way BUILDER-BRIEF §5 says to do it, in case the tap is the fault
await p.keyboard.press('Escape'); await p.waitForTimeout(700);
await p.evaluate(() => window.__ct.warp(-6.0, 7.29, -Math.PI / 2, 0, 0));
await p.waitForTimeout(420);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(900);
await state('AFTER  a HELD e (BUILDER-BRIEF §5)');

await p.keyboard.press('Escape'); await p.waitForTimeout(700);
await state('AFTER  Escape');

console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 4)) console.log(`   ${e}`);
await b.close();

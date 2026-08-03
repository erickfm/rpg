// w90 / item 150 — does hanging a diegetic panel on a MULTI-MATERIAL mesh throw?
//
// hud.ts:1081 reads `(onMesh as THREE.Mesh).material as THREE.MeshBasicMaterial`
// — a single material. `Mesh.material` is legally `Material | Material[]`.
//
// This reproduces it against the real world rather than reasoning about it:
// take a panel that really does hang on a mesh, wrap that mesh's material in a
// one-element ARRAY (which changes nothing about how it renders), and open it.
//
// Usage: SHOT_URL=http://localhost:4460/ node scripts/probes/w90-item150-multimat-repro.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(800);

console.log('panels in this world:');
console.log('  ' + (await page.evaluate(() => window.__hud.panels())).join(', '));

// Which panels actually resolve a diegetic surface? Open each, ask what the HUD
// did with it, close it again. `__ct.panel()` reports the live one by id.
const out = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = [];
  for (const id of window.__hud.panels()) {
    let threw = null, up = null, diegetic = null;
    try {
      window.__hud.openPanel(id);
      await sleep(120);
      up = window.__hud.panel();
      // hud.ts:854 puts spec.id on the WRAP; the canvas (hud.ts:864) is an
      // unnamed child, and it is the CANVAS that is hidden when the panel goes
      // onto a mesh (hud.ts:1106). Reading the wrap's display says "false"
      // for every panel in the world, which is how this probe lied to me once.
      const cv = document.getElementById(id)?.querySelector('canvas');
      diegetic = cv ? cv.style.display === 'none' : null;
    } catch (e) { threw = String(e && e.message || e); }
    try { window.__hud.closePanels(); } catch { /* ignore */ }
    await sleep(700);   // DISMISS_LOCKOUT is 500 (hud.ts:1017)
    res.push({ id, up, diegetic, threw });
  }
  return res;
});
for (const r of out)
  console.log(`  ${r.id.padEnd(22)} up=${String(r.up).padEnd(22)} diegetic=${r.diegetic} ${r.threw ? 'THREW ' + r.threw : ''}`);

const diegetic = out.filter((r) => r.diegetic === true).map((r) => r.id);
console.log(`\ndiegetic panels (hang on a mesh): ${diegetic.join(', ') || 'NONE'}`);

// ── now the mutation: wrap that mesh's material in an array ────────────────
for (const id of diegetic) {
  const r = await page.evaluate(async (id) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // open once to learn WHICH mesh the HUD picked: it is the one wearing a
    // CanvasTexture whose image is the panel's own canvas element
    window.__hud.openPanel(id); await sleep(150);
    const cv = document.getElementById(id)?.querySelector('canvas');
    let target = null;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && !Array.isArray(m) && m.map && m.map.image === cv) target = o;
    });
    // ⚠ 700 ms, NOT 120. hud.ts:1017 DISMISS_LOCKOUT = 500 makes `open()` a
    // silent no-op for half a second after a close. At 120 ms the re-open below
    // never happens, every field reads "no", and this probe reports that a
    // multi-material mesh is FINE. It lied to me exactly that way once.
    window.__hud.closePanels(); await sleep(700);
    if (!target) return { id, found: false };
    const before = { isArray: Array.isArray(target.material), name: target.name || '(unnamed)' };
    // ONE element, same material object — renders identically, still an array.
    target.material = [target.material];
    let threw = null, restored = null, savedMapWasFn = null, reallyOpened = null;
    try {
      window.__hud.openPanel(id); await sleep(250);
      reallyOpened = window.__hud.panel() === id;   // proof the open TOOK
    } catch (e) { threw = String(e && e.message || e); }
    // what did it do to the material?
    const m0 = Array.isArray(target.material) ? target.material[0] : target.material;
    const wearing = m0 && m0.map ? (m0.map.image === cv ? 'the panel canvas' : 'something else') : 'no map';
    try { window.__hud.closePanels(); await sleep(250); } catch (e) { restored = String(e && e.message || e); }
    const m1 = Array.isArray(target.material) ? target.material[0] : target.material;
    savedMapWasFn = typeof (m1 && m1.map) === 'function';
    return { id, found: true, before, threw, wearing, restored, savedMapWasFn, reallyOpened,
             stillArray: Array.isArray(target.material) };
  }, id);
  console.log(`\n── ${r.id} ──`);
  if (!r.found) { console.log('  could not identify the mesh the HUD hangs on'); continue; }
  console.log(`  mesh ${r.before.name}, was array: ${r.before.isArray}`);
  console.log(`  open really took:    ${r.reallyOpened}`);
  console.log(`  open threw:          ${r.threw ?? 'no'}`);
  console.log(`  slot 0 ends up wearing: ${r.wearing}`);
  console.log(`  close threw:         ${r.restored ?? 'no'}`);
  console.log(`  map restored to a FUNCTION (Array.prototype.map): ${r.savedMapWasFn}`);
}

console.log('\npage errors:\n' + (errs.length ? errs.join('\n') : '  none'));
await browser.close();

// Item 185 — WHAT DOES THE LOAN FORM ACTUALLY LOOK LIKE WHEN YOU OPEN IT?
//
// One-shot measurement, so it lives in scripts/probes (BUILDER-BRIEF §7a).
// It answers the three things I could only have guessed at:
//
//   1. does the panel go DIEGETIC at all, or silently degrade to the old
//      screen-space rectangle? (`ct/hud.ts` degrades rather than throws when
//      the mesh cannot be found, which is right and is also silent)
//   2. where does `poseFor` actually put the eye over a HORIZONTAL face, and
//      does the 1.05–1.75 m clamp bite?
//   3. is the sheet legible in the frame, or is it a stamp-sized rectangle on
//      a desk halfway across the room?
//
// It does NOT assert. It photographs and prints numbers, which is what a look
// is for; the assertions go in a check once the design is settled.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4220/');
const OUT = process.argv[2] ?? '/tmp/w66-loan';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(1500);

// WHERE IS THE FORM? Found by its own geometry, not by a coordinate typed here:
// a PlaneGeometry 0.30 x 0.40 inside the bank's interior band.
const form = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((o) => {
    if (best || !o.isMesh) return;
    const pr = o.geometry?.parameters;
    if (!pr || pr.width === undefined || pr.height === undefined) return;
    if (Math.abs(pr.width - 0.30) > 1e-6 || Math.abs(pr.height - 0.40) > 1e-6) return;
    const v = new (window.__three ?? Object)();
    const m = o.matrixWorld.elements;
    best = { name: o.name || '(unnamed)', x: +m[12].toFixed(3), y: +m[13].toFixed(3), z: +m[14].toFixed(3),
             multi: Array.isArray(o.material) };
  });
  return best;
});
console.log('the 0.30 x 0.40 sheet:', JSON.stringify(form));

// Stand where the officer's spot is and see what the world offers.
const spots = await p.evaluate(() => (window.__ct.spots?.() ?? [])
  .map((s) => ({ label: typeof s.label === 'function' ? s.label() : s.label,
                 x: +s.x.toFixed(2), z: +s.z.toFixed(2), r: s.r }))
  .filter((s) => /loan|application|window 2|client chair/i.test(String(s.label))));
console.log('loan-ish spots:', JSON.stringify(spots, null, 1));

// Warp next to the form and open it the way the player does.
if (form) {
  // `warp(x, z, yaw, gy, …)` — the ground y is NOT optional, and leaving it off
  // silently leaves you in flat 301 at y 7.02 reading "[E] sit on the bed and
  // watch TV". Cost me one run; the interior floor is gy 0.
  //
  // Standing ON the form's own spot rather than near it: the `[E]` dispatch
  // sorts on `offAxis + d * 0.02`, so a spot you are standing on wins outright
  // and the press cannot pick up a neighbour (GOTCHAS 20).
  const spot = spots.find((s) => /read the loan application/.test(s.label)) ?? { x: form.x, z: form.z + 0.6 };
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [spot.x, spot.z]);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}-1-standing.png` });
  // look at the desk, then press E for real (BUILDER-BRIEF §5 — a HELD press)
  const before = await p.evaluate(() => ({
    prompt: document.querySelector('#ct-prompt')?.textContent ?? '',
  }));
  console.log('prompt on arrival:', JSON.stringify(before.prompt));
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(900);                       // the 0.40 s fly-in, plus slack
  await p.screenshot({ path: `${OUT}-2-open.png` });
  const st = await p.evaluate(() => {
    const cam = window.__ct.camera?.();
    const el = document.querySelector('#ct-loan');
    return {
      panelInDom: !!el,
      // A DIEGETIC panel hides its own canvas and keeps only the caption.
      canvasHidden: el ? getComputedStyle(el.querySelector('canvas') ?? el).display === 'none' : null,
      cam: cam ? { x: +cam.position.x.toFixed(3), y: +cam.position.y.toFixed(3),
                   z: +cam.position.z.toFixed(3), fov: +cam.fov.toFixed(1) } : null,
      seated: window.__ct.seated?.() ? true : false,
    };
  });
  console.log('after E:', JSON.stringify(st, null, 1));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}-3-after-escape.png` });
}
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 8)) console.log('   ', e);
console.log(`shots at ${OUT}-*.png`);
await b.close();

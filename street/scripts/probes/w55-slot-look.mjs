#!/usr/bin/env node
// ITEM 100: WALK TO A MACHINE, SIT DOWN, AND LOOK AT WHAT YOU GET.
//
// Frames from the player's own standing position — before the stool, on it with
// the machine live, and after Escape — plus what the world says about the screen
// plane it hung the canvas on.
//
//   SHOT_URL=http://localhost:4183/ node scripts/probes/w55-slot-look.mjs [outdir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const OUT = process.argv[2] ?? '/tmp/w55';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const press = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(90); await p.keyboard.up(k);
  await p.waitForTimeout(220);
};
const until = async (fn, what, ms = 10000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`   (timed out waiting for ${what})`); return false; }
};

// Stand where the stool says to stand — its OWN approach point, never a typed
// coordinate (GOTCHAS §20).
const seat = await p.evaluate(() => {
  const s = window.__ct.seats().filter((x) => x.label === 'sit at the slot');
  return s[Math.floor(s.length / 2)];
});
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos?.().gy ?? 0, 0), seat);
await until(() => {
  const d = document.getElementById('ct-prompt');
  return !!d && d.style.display !== 'none' && /sit at the slot/.test(d.textContent ?? '');
}, 'the stool to offer itself');
await p.screenshot({ path: `${OUT}/1-standing.png` });

await press('e');
await until(() => window.__hud.panel() === 'ct-slots', 'the machine to open');
await p.evaluate(() => window.__slots.insert(60));
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/2-seated.png` });

const info = await p.evaluate(() => {
  let found = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'ct-slots-screen') found = o; });
  if (!found) return { plane: null };
  found.updateWorldMatrix(true, false);
  const g = found.geometry.parameters;
  const e = found.matrixWorld.elements;
  const mat = found.material;
  return {
    plane: {
      w: +g.width.toFixed(4), h: +g.height.toFixed(4),
      aspect: +(g.width / g.height).toFixed(4),
      world: [+e[12].toFixed(3), +e[13].toFixed(3), +e[14].toFixed(3)],
      visible: found.visible,
      parent: found.parent?.geometry?.type ?? '?',
      parentSize: found.parent?.geometry?.parameters ?? null,
      hasMap: !!mat.map,
      mapW: mat.map?.image?.width ?? null,
      mapH: mat.map?.image?.height ?? null,
    },
    panel: window.__hud.panel(),
    seated: !!window.__ct.seated(),
    domCanvasShown: (() => {
      const c = document.getElementById('ct-slots');
      if (!c) return 'no element';
      return getComputedStyle(c).display;
    })(),
  };
});
console.log(JSON.stringify(info, null, 1));

// spin it, so a frame catches the reels turning
await press(' ');
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/3-spinning.png` });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/4-settled.png` });

await press('Escape');
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  let found = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'ct-slots-screen') found = o; });
  return {
    panel: window.__hud.panel(), seated: !!window.__ct.seated(),
    planeVisible: found ? found.visible : null,
    planeHasMap: found ? !!found.material.map : null,
  };
});
console.log('after escape:', JSON.stringify(after));
await p.screenshot({ path: `${OUT}/5-after-escape.png` });

console.log(errs.length ? `\nPAGE ERRORS:\n  ${errs.join('\n  ')}` : '\nno page errors');
await b.close();

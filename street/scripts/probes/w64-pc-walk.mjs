#!/usr/bin/env node
// ITEM 157: A WHOLE SITTING AT THE LIBRARY TERMINAL, BY REAL PAGE CLICKS.
//
// *"i need the pc in the library to be like the atm too. intergrated overlay.
// realistic setup."*
//
// Nothing here calls `__librarypc.key()` for a mouse action: every one of them
// is a `page.mouse.click` at a screen coordinate, so it travels through
// `main.ts`'s listeners, `ct/hud.ts`'s gate, `crosstown.ts`'s raycast and back
// into `ct/library-pc.ts`'s own canvas-pixel hit test. If any link is wrong the
// screen does not change.
//
// THE SCREEN COORDINATE IS DERIVED, NEVER TYPED — canvas pixel -> the plane's
// own local metres -> world -> the LIVE camera. And the layout comes from
// `__librarypc.rects()`, which is the same object the painter draws from, so
// this cannot click where a button used to be.
//
// AND IT PROVES THE ONE THING THE OTHER THREE TENANTS DID NOT HAVE TO:
// **typing still types, including the letter `e`.** Item 143's `typing` opt-out
// exists because a global `[E]`-to-close made `Emma` and `Frankenstein`
// unsearchable, and the diegetic gate is the same gate.
//
//   SHOT_URL=http://localhost:4201/ node scripts/probes/w64-pc-walk.mjs
//
// Exit 0 fine, 1 measured and wrong, 3 nothing measured (house convention).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN server. A default port is'
    + " somebody else's world (GOTCHAS §26, §48).");
  process.exit(3);
}
const SHOTS = process.env.W64_SHOTS || '/tmp/w64-pc';
mkdirSync(SHOTS, { recursive: true });

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await b.close(); process.exit(3);
}
await p.waitForTimeout(600);

const until = async (fn, what, ms = 10000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

// ── sit down, which is how this machine opens ────────────────────────────────
const seat = await p.evaluate(() => {
  const s = window.__ct.seats().filter((x) => x.label === 'sit at the computer');
  return s.length ? s[0] : null;
});
if (!seat) {
  console.error("ABORTED: no seat is labelled 'sit at the computer' — the library did not build.");
  await b.close(); process.exit(3);
}
const sitDown = async () => {
  await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos()[3], 0), seat);
  await until(() => {
    const d = document.getElementById('ct-prompt');
    return !!d && d.style.display !== 'none' && /sit at the computer/.test(d.textContent ?? '');
  }, 'the terminal chair to offer itself');
  // BUILDER-BRIEF §5: a HELD keypress. `press('e')` can start and finish inside
  // one animation frame and the [E] dispatch is an edge read once per frame.
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  const ok = await until(() => window.__hud.panel() === 'ct-library-pc', 'the terminal to open');
  // WAIT FOR THE FLY-IN TO STOP, and it is not a courtesy — w55 lost an hour to
  // projecting through one camera and clicking through the next.
  await until(() => {
    const c = window.__ct.camera();
    const k = `${c.position.x.toFixed(4)},${c.position.y.toFixed(4)},`
      + `${c.position.z.toFixed(4)},${c.fov.toFixed(3)}`;
    const same = window.__w64cam === k;
    window.__w64cam = k;
    return same;
  }, 'the fly-in to settle');
  return ok;
};
check(await sitDown(), 'sitting at the chair opens the terminal');

// ── is the picture actually ON the CRT? ─────────────────────────────────────
const dieg = await p.evaluate(() => {
  const m = window.__librarypc.screenMesh();
  const cv = document.querySelector('#ct-library-pc canvas');
  const back = document.getElementById('ct-panelback');
  return {
    onMesh: window.__librarypc.onMesh(),
    mapIsCanvas: !!(m && m.material && m.material.map && m.material.map.image
      && String(m.material.map.image.constructor.name) === 'HTMLCanvasElement'),
    mapW: m && m.material.map && m.material.map.image ? m.material.map.image.width : 0,
    mapH: m && m.material.map && m.material.map.image ? m.material.map.image.height : 0,
    white: m ? '#' + m.material.color.getHexString() : null,
    domCanvasHidden: !cv || getComputedStyle(cv).display === 'none',
    backdrop: back ? Number(getComputedStyle(back).opacity) : 0,
    face: window.__librarypc.face(),
    pointerLocked: !!document.pointerLockElement,
  };
});
check(dieg.onMesh && dieg.mapIsCanvas,
  "the terminal's own CRT carries the live canvas — the panel is ON THE OBJECT");
check(dieg.domCanvasHidden, 'no DOM panel is drawn — *"integrated overlay"*');
check(dieg.backdrop === 0, 'the room behind is NOT dimmed');
check(!dieg.pointerLocked, 'the pointer is released, so the screen can be clicked');
const a = dieg.face;
const err = a.meshAspect === null ? 1 : Math.abs(a.meshAspect - a.canvasAspect) / a.canvasAspect;
check(err <= 0.02,
  `the canvas is cut to the CRT: canvas ${a.w}x${a.h} = ${a.canvasAspect.toFixed(4)}:1,`
  + ` the glass measures ${a.meshAspect === null ? 'n/a' : a.meshAspect.toFixed(4)}:1`
  + ` — ${(err * 100).toFixed(2)}% apart (must be <= 2%)`);
check(dieg.mapW === a.w && dieg.mapH === a.h,
  `the texture on the glass is this canvas, ${dieg.mapW}x${dieg.mapH}`);

/** Where on the page is this CANVAS pixel? Through the live plane and the live
 *  camera; nothing about the pose is assumed. Local bounding box rather than
 *  `geometry.parameters`, which lies wherever a rotation was baked in. */
const at = (cx, cy) => p.evaluate(({ cx, cy }) => {
  const m = window.__librarypc.screenMesh();
  if (!m) return null;
  const cam = window.__ct.camera();
  const f = window.__librarypc.face();
  const g = m.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  const gw = bb.max.x - bb.min.x, gh = bb.max.y - bb.min.y;
  const v = cam.position.clone().set((cx / f.w - 0.5) * gw, (0.5 - cy / f.h) * gh, 0);
  m.updateWorldMatrix(true, false);
  m.localToWorld(v);
  v.project(cam);
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (0.5 - v.y * 0.5) * r.height };
}, { cx, cy });

const R = await p.evaluate(() => {
  const r = window.__librarypc.rects();
  return { icons: r.icons, close: r.close, clear: r.clear, field: r.field, flag: r.flag, newGame: r.newGame };
});
const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const clickCanvas = async (cx, cy) => {
  const q = await at(cx, cy);
  if (!q) return false;
  await p.mouse.move(q.x, q.y);
  await p.waitForTimeout(60);
  await p.mouse.click(q.x, q.y);
  await p.waitForTimeout(140);
  return true;
};
const cursorAt = async (cx, cy) => {
  const q = await at(cx, cy);
  if (!q) return null;
  await p.mouse.move(q.x, q.y);
  await p.waitForTimeout(90);
  return p.evaluate(() => document.body.style.cursor);
};

await p.screenshot({ path: `${SHOTS}/1-desktop.png` });

// ── the cursor tells the truth ───────────────────────────────────────────────
const overIcon = await cursorAt(...mid(R.icons[0]));
const overWall = await cursorAt(160, 200);           // bare teal desktop
check(/pointer/.test(overIcon ?? ''), 'the hand shows over an icon');
check(/default/.test(overWall ?? '') && !/pointer/.test(overWall ?? ''),
  'and the ARROW over bare desktop — a hand where nothing happens is the machine lying');

// ── open MINESWEEP by clicking its icon ─────────────────────────────────────
await clickCanvas(...mid(R.icons[1]));
check(await p.evaluate(() => window.__librarypc.screen()) === 'minesweeper',
  'clicking the MINESWEEP icon opens it — a real page click, not __librarypc.key()');
await p.screenshot({ path: `${SHOTS}/2-minesweeper.png` });

// ── play it with the mouse ──────────────────────────────────────────────────
const cell = (r, c) => p.evaluate(({ r, c }) => {
  const q = window.__librarypc.rects().cell(r, c);
  return [q.x + q.w / 2, q.y + q.h / 2];
}, { r, c });
await clickCanvas(...(await cell(4, 5)));
let ms = await p.evaluate(() => window.__librarypc.minesweeper());
check(!ms.dead && ms.open > 0, `clicking a square digs it (${ms.open} open, dead=${ms.dead})`);
check(ms.cz === 4 && ms.cx === 5, `and the keyboard cursor followed the click to (4,5) — one dispatch, not two`);

// THE BOTTOM ROW IS ON THE CANVAS NOW. At 320x220 row 8 ran to y 223 and was
// clipped off a 220-tall canvas; the re-cut is what makes this reachable.
const last = await p.evaluate(() => {
  const q = window.__librarypc.rects().cell(8, 10);
  const f = window.__librarypc.face();
  return { bottom: q.y + q.h, h: f.h };
});
check(last.bottom <= last.h,
  `the bottom-right square ends at y ${last.bottom} inside a ${last.h}-tall canvas — nothing is clipped`);

await clickCanvas(...mid(R.flag));
check(await p.evaluate(() => window.__librarypc.flagMode()) === true, 'FLAG turns the pointer into a flag');
await clickCanvas(...(await cell(0, 0)));
ms = await p.evaluate(() => window.__librarypc.minesweeper());
const flagged = await p.evaluate(() => {
  const s = window.__librarypc.minesweeper();
  return s.cz === 0 && s.cx === 0;
});
check(flagged, 'and a click in FLAG mode flags rather than digs (cursor moved to 0,0, board not dead)');
check(!ms.dead, 'flagging never blows the board up');
await clickCanvas(...mid(R.newGame));
ms = await p.evaluate(() => window.__librarypc.minesweeper());
check(ms.open === 0 && !ms.dead && !ms.won, 'NEW deals a fresh board');
check(await p.evaluate(() => window.__librarypc.flagMode()) === false, 'and drops FLAG mode with it');

// ── the window close box goes back to the desktop, NOT out of the machine ───
await clickCanvas(...mid(R.close));
check(await p.evaluate(() => window.__librarypc.screen()) === 'desktop',
  'the title bar close box returns to the desktop');
check(await p.evaluate(() => window.__hud.panel()) === 'ct-library-pc',
  'and does NOT leave the machine — only [E]/ESC does that');

// ── the catalogue, and the letter `e` ───────────────────────────────────────
await clickCanvas(...mid(R.icons[0]));
check(await p.evaluate(() => window.__librarypc.screen()) === 'catalog',
  'clicking CARD CATALOG opens it');
// TYPED AS A HUMAN TYPES, through the page — this is the whole of item 143's
// worry, and `e` is in every one of these words.
for (const ch of 'frankenstein') { await p.keyboard.press(ch); await p.waitForTimeout(20); }
let q = await p.evaluate(() => window.__librarypc.catalogQuery());
let res = await p.evaluate(() => window.__librarypc.catalogResults());
check(q === 'frankenstein', `typing "frankenstein" into the search field lands all 12 characters (got "${q}")`);
check(await p.evaluate(() => window.__hud.panel()) === 'ct-library-pc',
  'and the three `e`s did NOT eject the player — the `typing` opt-out survives the diegetic gate');
check(res.length === 1 && res[0] === 'Frankenstein', `and it finds the book (${JSON.stringify(res)})`);
await p.screenshot({ path: `${SHOTS}/3-catalog.png` });

await clickCanvas(...mid(R.clear));
q = await p.evaluate(() => window.__librarypc.catalogQuery());
check(q === '', 'CLEAR empties the field');
for (const ch of 'emma') { await p.keyboard.press(ch); await p.waitForTimeout(20); }
res = await p.evaluate(() => window.__librarypc.catalogResults());
check(res.includes('Emma'), `"emma" finds Emma too (${JSON.stringify(res)})`);

// ── ESCAPE, from the one screen where it is the only way out ────────────────
await p.keyboard.press('Escape');
check(await until(() => window.__hud.panel() !== 'ct-library-pc', 'the panel to close'),
  'ESC closes the terminal from the CATALOGUE, where [E] is deliberately disabled');
check(await until(() => window.__ct.seated() === null, 'standing up'),
  'and stands the player up — no modal trap (BUILDER-BRIEF §11)');
const after = await p.evaluate(() => {
  const c = window.__ct.camera();
  return { fov: c.fov, onMesh: window.__librarypc.onMesh(), cursor: document.body.style.cursor };
});
check(!after.onMesh, 'the CRT is off the panel again');
check(after.fov > 60, `the fov is handed back (${after.fov.toFixed(1)}°, not the 46° lock)`);
// FEET ACTUALLY MOVE. A screenshot cannot prove you are not wedged.
const before = await p.evaluate(() => window.__ct.pos());
await p.keyboard.down('s'); await p.waitForTimeout(420); await p.keyboard.up('s');
const moved = await p.evaluate(() => window.__ct.pos());
const d = Math.hypot(moved[0] - before[0], moved[2] - before[2]);
check(d > 0.15, `and the feet move again — walked ${d.toFixed(2)} m backwards after leaving`);
await p.screenshot({ path: `${SHOTS}/4-after-escape.png` });

// ── [E] leaves from the two screens that are not typing ─────────────────────
check(await sitDown(), 're-sitting opens it again');
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
check(await until(() => window.__hud.panel() !== 'ct-library-pc', '[E] to close from the desktop'),
  '[E] closes it from the DESKTOP');
check(await sitDown(), 're-sitting again');
await clickCanvas(...mid(R.icons[1]));
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
check(await until(() => window.__hud.panel() !== 'ct-library-pc', '[E] to close from minesweeper'),
  '[E] closes it from MINESWEEPER');

check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
await b.close();
console.log(bad === 0 ? `\n  all ${'checks'} pass. frames in ${SHOTS}\n` : `\n  ${bad} FAILED\n`);
process.exit(bad === 0 ? 0 : 1);

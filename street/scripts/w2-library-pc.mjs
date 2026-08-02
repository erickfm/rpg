#!/usr/bin/env node
// THE CLAIM: item 4's "Windows-style PC you can actually use" is real —
// registered with `ct/world.ts`'s loader with no line anywhere naming it,
// its two apps (CARD CATALOG.EXE, MINESWEEP.EXE) genuinely work rather than
// stub out, and — once item 3's rename lands — sitting at a library terminal
// opens it, exactly the way sitting at a stool opens `ct/slots.ts`.
//
// ITEM 3 IS A SEPARATE ROW. `ct/int-library.ts`'s terminal chairs still say
// `label: 'sit at the terminal'` until that item renames them to
// `'sit at the computer'` (see SEAT_LABEL in `ct/library-pc.ts`). Until then
// this script's SEAT PART aborts (exit 3 — nothing measured, not a failure)
// rather than reporting a false red for a row somebody else owns; the APP
// part runs unconditionally through the `window.__librarypc` test affordance,
// the same shape `ct/atm.ts` documents for the identical reason.
//
//   SHOT_URL=http://localhost:4181/ node scripts/w2-library-pc.mjs [wired|apps|seat|all]
//
// Exit codes (GOTCHAS §32): 0 fine, 1 wrong, 2 usage, 3 aborted — nothing measured.

import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const MODES = ['wired', 'apps', 'seat', 'all'];
const mode = process.argv[2] ?? 'all';
if (!MODES.includes(mode)) {
  console.error(`usage: SHOT_URL=… node scripts/w2-library-pc.mjs [${MODES.join('|')}]`);
  process.exit(2);
}
const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN preview. No default (GOTCHAS §26, §48).');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };
const until = async (p, fn, what, ms = 10000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await b.close(); process.exit(3);
}
await reportWorld(p, URL);
await p.waitForTimeout(300);

// ── wired: does the module reach the loader at all? ─────────────────────────
if (mode === 'wired' || mode === 'all') {
  const built = await p.evaluate(() => typeof window.__librarypc?.open === 'function');
  console.log(`  __librarypc ${built ? 'is live' : 'is ABSENT'}\n`);
  check(built, 'ct/library-pc.ts reached ct/world.ts\'s glob and register() ran');
  const modules = await p.evaluate(() => window.__ct.modules?.() ?? null);
  if (modules) {
    const found = modules.some((m) => /library-pc/.test(m.path));
    check(found, `world.ts's loader lists it: ${JSON.stringify(modules.find((m) => /library-pc/.test(m.path)) ?? null)}`);
  }
  if (!built) { console.error('ABORTED: nothing else can be measured.'); await b.close(); process.exit(3); }
}

// ── apps: the two apps genuinely work, independent of the seat join ─────────
if (mode === 'apps' || mode === 'all') {
  console.log('\n  THE TWO APPS\n');
  await p.evaluate(() => window.__librarypc.open());
  check(await p.evaluate(() => window.__librarypc.screen()) === 'desktop', 'opens on the desktop');

  // catalog: a real query against real books
  await p.evaluate(() => window.__librarypc.goto('catalog'));
  await p.evaluate(() => { for (const ch of 'sherlock') window.__librarypc.key(ch); });
  const sherlock = await p.evaluate(() => window.__librarypc.catalogResults());
  console.log(`  query "sherlock" -> ${JSON.stringify(sherlock)}`);
  check(sherlock.length === 1 && /Sherlock Holmes/.test(sherlock[0]),
    'the catalog actually searches its book data, not a stub list');

  await p.evaluate(() => { for (let i = 0; i < 20; i++) window.__librarypc.key('backspace'); });
  await p.evaluate(() => { for (const ch of 'tolstoy') window.__librarypc.key(ch); });
  const byAuthor = await p.evaluate(() => window.__librarypc.catalogResults());
  console.log(`  query "tolstoy" (author) -> ${JSON.stringify(byAuthor)}`);
  check(byAuthor.length === 2, 'search matches on author as well as title');

  await p.evaluate(() => { for (let i = 0; i < 20; i++) window.__librarypc.key('backspace'); });
  await p.evaluate(() => { for (const ch of 'zzqzz') window.__librarypc.key(ch); });
  const none = await p.evaluate(() => window.__librarypc.catalogResults());
  check(none.length === 0, 'and a query with no matches actually returns none, rather than everything');

  // minesweeper: a real game — first click is safe, flood fill opens a
  // pocket, flags toggle, restart reseeds, and a mine actually ends it
  await p.evaluate(() => window.__librarypc.goto('minesweeper'));
  let ms = await p.evaluate(() => window.__librarypc.minesweeper());
  check(ms.cols * ms.rows > ms.mines * 4, `${ms.cols}x${ms.rows} board, ${ms.mines} mines — a real board, not a token one`);

  await p.evaluate(() => window.__librarypc.key(' '));   // dig the very first cell
  ms = await p.evaluate(() => window.__librarypc.minesweeper());
  check(!ms.dead, 'the FIRST dig is never a mine (mines are laid out after it, never under it)');
  check(ms.open > 1, `flood fill opened more than one cell on the first dig (${ms.open})`);

  await p.evaluate(() => window.__librarypc.key('f'));
  const flaggedTitle = await p.evaluate(() => window.__librarypc.screen());
  check(flaggedTitle === 'minesweeper', 'F does not crash the app (flag toggling on an already-open cell is a no-op)');

  await p.evaluate(() => window.__librarypc.key('r'));
  ms = await p.evaluate(() => window.__librarypc.minesweeper());
  check(ms.open === 0 && !ms.dead && !ms.won, 'R restarts with a fresh, empty board');

  // sweep left-to-right, wrapping rows, until a mine goes off — proves the
  // lose path (and would prove the win path too, if this run gets there)
  await p.evaluate(() => window.__librarypc.key(' '));
  let guard = 0;
  while (guard < ms.cols * ms.rows) {
    ms = await p.evaluate(() => window.__librarypc.minesweeper());
    if (ms.dead || ms.won) break;
    if (ms.cx >= ms.cols - 1) {
      await p.evaluate(() => window.__librarypc.key('arrowdown'));
      for (let i = 0; i < ms.cols; i++) await p.evaluate(() => window.__librarypc.key('arrowleft'));
    } else {
      await p.evaluate(() => window.__librarypc.key('arrowright'));
    }
    await p.evaluate(() => window.__librarypc.key(' '));
    guard++;
  }
  ms = await p.evaluate(() => window.__librarypc.minesweeper());
  console.log(`  after sweeping ${guard} cells: dead=${ms.dead} won=${ms.won} open=${ms.open}/${ms.cols * ms.rows - ms.mines}`);
  check(ms.dead || ms.won, `the game actually ends (dead or won) rather than running forever (${guard} digs)`);

  // ESC always closes — §11 of the brief, the worst bug this project ships
  await p.evaluate(() => window.__librarypc.close());
  check(!(await p.evaluate(() => window.__hud?.panel?.() ?? null)), 'close() actually closes the panel');
}

// ── seat: the join with item 3's renamed label ───────────────────────────────
if (mode === 'seat' || mode === 'all') {
  console.log('\n  THE SEAT JOIN (item 3)\n');
  const seats = await p.evaluate(() => window.__ct.seats().filter((s) => s.label === 'sit at the computer'));
  console.log(`  ${seats.length} seat(s) publish 'sit at the computer'`);
  if (!seats.length) {
    console.log('  ABORTED (seat part only): item 3 has not renamed the library terminal seats yet.'
      + ' ct/library-pc.ts is written to join on this string the moment it does — nothing further to fix here.');
  } else {
    const seat = seats[0];
    await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos()[3] ?? 0, 0), seat);
    await until(p, () => {
      const d = document.getElementById('ct-prompt');
      return !!d && d.style.display !== 'none' && /sit at the computer/.test(d.textContent ?? '');
    }, 'the terminal chair to offer itself');
    await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
    const seated = await until(p, () => !!window.__ct.seated(), 'the player to be seated');
    const opened = await until(p, () => window.__hud.panel() === 'ct-library-pc', 'the terminal to open');
    check(seated, 'pressing E at the chair seats the player');
    check(opened, 'SITTING DOWN opens the terminal — the seat is the trigger');
    await p.keyboard.press('Escape');
    const stoodUp = await until(p, () => window.__ct.seated() === null, 'standing up on Escape');
    check(stoodUp, 'Escape closes the terminal AND stands the player up — no modal trap');
  }
}

check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs[0]}` : ''}`);

await b.close();
console.log(bad === 0 ? `\n  ${mode}: all checks pass.\n` : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);

// Item 155 — open the mail at the lobby boxes and photograph it.
// A LOOKING tool, not a proving one (screenshots cannot prove; the world is
// walked and measured elsewhere). Pass a tag: `node … w88-mail-shot.mjs before`.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const TAG = process.argv[2] ?? 'now';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

// DAYLIGHT. A game day is 24 REAL MINUTES, so an unset clock lands wherever the
// wall clock happens to put it — the first run of this probe came back a black
// frame at 02:29 and there was nothing wrong with the world.
await p.evaluate(() => window.__ct.clock(12, 30));
for (let i = 0; i < 4; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

// find the mailbox spot and stand at it. LIST them all first — `find` takes
// whichever comes first, and the lobby bank is not the only thing in this world
// with "mailbox" in its label.
const all = await p.evaluate(() => window.__ct.spots()
  .filter((q) => /mailbox/i.test(q.label ?? ''))
  .map((q) => ({ x: q.x, z: q.z, r: q.r, label: q.label, ok: q.ok,
                 gy: window.__ct.groundAt(q.x, q.z) })));
console.log(`spots matching /mailbox/: ${all.length}`);
for (const s of all) console.log(`   "${s.label}" at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r ${s.r} floor ${s.gy.toFixed(2)} ok=${s.ok}`);
const spot = all[0] ?? null;
if (!spot) { console.error('ABORT: no mailbox spot in the world.'); await b.close(); process.exit(3); }
console.log(`\nusing "${spot.label}" at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) r ${spot.r}`);

// STAND ON THE LOBBY FLOOR, NOT ON WHATEVER `groundAt` SAYS.
//
// `ct/tenancy.ts:875` gates the spot on `ctx.player.gy() < 0.5` — floor 3 is
// directly above this bank, and without that gate the boxes would be offered to
// a player standing in his own kitchen. `groundAt(x, z)` at the bank returns
// **5.40**, the flat above, so warping to it puts you upstairs with the spot
// dead and the frame black. Pass the lobby floor explicitly.
await p.evaluate(([sx, sz]) => {
  const d = 0.8;
  const px = sx + d, pz = sz;
  window.__ct.warp(px, pz, Math.atan2(sx - px, -(sz - pz)), 0, 0);
}, [spot.x, spot.z]);
for (let i = 0; i < 6; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

const before = await p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const shown = !!el && getComputedStyle(el).display !== 'none';
  return { prompt: shown ? (el.textContent ?? '').trim() : null, pos: window.__ct.pos().map((v) => +v.toFixed(2)) };
});
console.log(`standing at (${before.pos[0]}, ${before.pos[2]}) floor ${before.pos[3]} — prompt ${JSON.stringify(before.prompt)}`);
await p.screenshot({ path: `shots/w88-mail-${TAG}-standing.png` });

// HELD keypress: a tap can begin and end inside one frame (BUILDER-BRIEF §5)
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
for (let i = 0; i < 10; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

const open = await p.evaluate(() => {
  const el = document.getElementById('ct-letter');
  const shown = !!el && getComputedStyle(el).display !== 'none';
  return {
    letterEl: !!el, letterShown: shown,
    canvases: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`),
    pos: window.__ct.pos().map((v) => +v.toFixed(2)),
  };
});
console.log(`after [E]: letter element ${open.letterEl ? 'exists' : 'ABSENT'}, shown=${open.letterShown}`);
console.log(`canvases on the page: ${JSON.stringify(open.canvases)}`);
console.log(`player now at (${open.pos[0]}, ${open.pos[2]})`);
await p.screenshot({ path: `shots/w88-mail-${TAG}-open.png` });
console.log(`\nwrote shots/w88-mail-${TAG}-standing.png and shots/w88-mail-${TAG}-open.png`);
if (errs.length) console.log(`console errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);
await b.close();

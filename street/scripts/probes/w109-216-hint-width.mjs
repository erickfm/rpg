// Item 216 — DOES THE ATM HINT LINE ACTUALLY OVERLAP ANYTHING?
//
// The row says the hint "already overlaps" and is PRE-EXISTING. 184's builder
// says the same in `ct/atm.ts`: *"it already overlaps the `[E] leave` label and
// the CLR/0/ENT key row"*. Before budgeting anything, measure WHAT it overlaps
// and HOW WIDE it really is — the caption is a DOM div, not canvas text, and for
// a DIEGETIC panel `hud.ts` hides the canvas and leaves the div free-floating at
// `bottom:7%`, so its width is decided by the string and nothing else.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/probes/w109-216-hint-width.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4650/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(700);

const spots = await p.evaluate(() => (window.__ct.spots?.() ?? []).map((s) => ({
  label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z,
})));
const atm = spots.find((s) => /use the machine/i.test(s.label));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0, 0), [atm.x, atm.z]);
await p.waitForTimeout(600);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(1400);

/** every visible HUD box, so an overlap is found rather than guessed at */
const boxes = () => p.evaluate(() => {
  const out = {};
  const add = (name, el) => {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    out[name] = { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), text: (el.textContent ?? '').slice(0, 70) };
  };
  const wrap = document.getElementById('ct-atm');
  add('caption', wrap?.lastElementChild?.tagName === 'DIV' ? wrap.lastElementChild : null);
  add('canvas', wrap?.querySelector('canvas'));
  add('prompt', document.getElementById('ct-prompt'));
  add('watch', document.getElementById('ct-watch'));
  add('note', document.getElementById('ct-note'));
  out._vw = window.innerWidth; out._vh = window.innerHeight;
  return out;
});

console.log('MENU screen:');
console.log(JSON.stringify(await boxes(), null, 1));

// …now the PIN screen, which carries the LONGER of the two hints.
await p.evaluate(() => window.__hud.closePanels());
await p.waitForTimeout(700);
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(1400);
// INSERT CARD is the left soft key on the idle screen; press it to reach 'pin'.
await p.keyboard.press('1');
await p.waitForTimeout(700);
console.log('\nafter pressing 1 (INSERT CARD):');
const after = await boxes();
console.log(JSON.stringify(after, null, 1));

console.log(`\nconsole errors: ${errs.length}`);
await b.close();

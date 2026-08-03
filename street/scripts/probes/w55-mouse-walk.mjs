#!/usr/bin/env node
// ITEM 100: A WHOLE SITTING AT THE SLOT MACHINE, BY REAL PAGE CLICKS.
//
// *"embedded interactable overlay"* — the claim is that the buttons drawn on the
// machine can be pressed WHERE THEY ARE. Nothing here calls `__slots`; every
// action is a `page.mouse.click` at a screen coordinate, which means it goes
// through `main.ts`'s listeners, `ct/hud.ts`'s gate, `crosstown.ts`'s raycast
// and back into `ct/slots.ts`'s own canvas-pixel hit test. If any link in that
// chain is wrong the money does not move.
//
// THE SCREEN COORDINATE IS DERIVED, NEVER TYPED. A canvas pixel is turned into a
// point on the plane in the plane's own local space, pushed to world through the
// mesh's matrix, and projected through the live camera. So this keeps working if
// the pose, the stand-off, the fov, the cabinet or the layout move — which is
// the whole reason GOTCHAS §20 exists.
//
//   SHOT_URL=http://localhost:4183/ node scripts/probes/w55-mouse-walk.mjs
//
// Exit 0 fine, 1 measured and wrong, 3 nothing measured (house convention).
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN server. A default port is'
    + " somebody else's world (GOTCHAS §26, §48).");
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
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
  const s = window.__ct.seats().filter((x) => x.label === 'sit at the slot');
  return s.length ? s[Math.floor(s.length / 2)] : null;
});
if (!seat) {
  console.error("ABORTED: no seat is labelled 'sit at the slot' — the casino did not build.");
  await b.close(); process.exit(3);
}
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos()[3], 0), seat);
await until(() => {
  const d = document.getElementById('ct-prompt');
  return !!d && d.style.display !== 'none' && /sit at the slot/.test(d.textContent ?? '');
}, 'the stool to offer itself');
// §5: a HELD keypress. `press('e')` can begin and end inside one frame and the
// [E] dispatch is an edge read once per rendered frame.
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
await until(() => window.__hud.panel() === 'ct-slots', 'the machine to open');

const diegetic = await p.evaluate(() => {
  let m = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'ct-slots-screen') m = o; });
  const cv = document.querySelector('#ct-slots canvas');
  return {
    onMesh: !!m && m.visible && !!m.material.map,
    domCanvasHidden: !cv || getComputedStyle(cv).display === 'none',
    backdrop: (() => {
      const d = document.getElementById('ct-panelback');
      return d ? Number(getComputedStyle(d).opacity) : 0;
    })(),
  };
});
check(diegetic.onMesh, 'the machine\'s own screen carries the live canvas — the panel is ON THE OBJECT');
check(diegetic.domCanvasHidden,
  'and the screen-space canvas is not drawn — *"no DOM panel appears"*');
check(diegetic.backdrop === 0,
  'the world behind is NOT dimmed — a screen you are standing at has not stopped being in the world');

/** Where on the page is this CANVAS pixel? Derived through the live plane and
 *  the live camera; nothing about the pose is assumed. */
const at = (cx, cy) => p.evaluate(({ cx, cy }) => {
  let m = null;
  window.__ct.scene().traverse((o) => { if (o.name === 'ct-slots-screen') m = o; });
  if (!m) return null;
  const cam = window.__ct.camera();
  const g = m.geometry.parameters;
  const FW = m.material.map.image.width, FH = m.material.map.image.height;
  // canvas px -> uv -> the plane's own local metres. v is flipped because a
  // canvas counts down from the top and a uv counts up from the bottom.
  const v = cam.position.clone().set(
    (cx / FW - 0.5) * g.width,
    (0.5 - cy / FH) * g.height,
    0,
  );
  m.updateWorldMatrix(true, false);
  m.localToWorld(v);
  v.project(cam);
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (0.5 - v.y * 0.5) * r.height };
}, { cx, cy });

// THE LAYOUT COMES FROM THE MACHINE. `__slots.face()` publishes the same `DECK`
// and bill-acceptor rectangles the painter draws from, so this probe cannot
// click somewhere the buttons used to be — which they did, twice, while this
// face was being re-cut. BUILDER-BRIEF §8.
const FACE = await p.evaluate(() => window.__slots.face());
/** the centre of a named deck button, in canvas pixels */
const btn = (label) => {
  const d = FACE.deck.find((q) => q.label === label);
  if (!d) throw new Error(`no deck button labelled ${label}`);
  return [d.x + d.w / 2, d.y + d.h / 2];
};
const billMid = [FACE.bill.x + FACE.bill.w / 2, FACE.bill.y + FACE.bill.h / 2];
const glassMid = [FACE.glass.x + FACE.glass.w / 2, FACE.glass.y + FACE.glass.h / 2];

const money = () => p.evaluate(() => ({
  cash: window.__slots.cash(), credits: window.__slots.view().credits,
  bet: window.__slots.view().bet, state: window.__slots.view().state,
}));

// ── the hand cursor ──────────────────────────────────────────────────────────
//
// *"the mouse cursor should be like a lil hand almost like win98 cursor"*, and
// w41's rule that it must be true ONLY where a click does something.
const cursorAt = async (cx, cy) => {
  const q = await at(cx, cy);
  if (!q) return null;
  await p.mouse.move(q.x, q.y);
  await p.waitForTimeout(90);
  return p.evaluate(() => document.body.style.cursor);
};
const overSpin = await cursorAt(...btn('SPIN'));   // dead at 0 credits
const overGlass = await cursorAt(...glassMid);    // the reel glass — nothing to press
check(/pointer/.test(overSpin ?? '') === false,
  'SPIN with an empty meter shows the ARROW, not the hand — a hand over a dead'
  + ' key is a machine lying about what it will do');
check(/default/.test(overGlass ?? ''),
  'and the reel glass shows the arrow too — only controls get the hand');

// ── INSERT, by clicking the bill acceptor ────────────────────────────────────
const before = await money();
const bill = await at(...billMid);
check(!!bill, 'a canvas pixel projects to a page coordinate — the screen is pickable');
await p.mouse.move(bill.x, bill.y); await p.waitForTimeout(90);
const overBill = await p.evaluate(() => document.body.style.cursor);
check(/pointer/.test(overBill),
  'the bill acceptor shows the WIN98 HAND when your pockets can fill it');
await p.mouse.click(bill.x, bill.y);
await until(() => window.__slots.view().credits > 0, 'the note to be taken');
const afterBill = await money();
console.log(`\n  bill acceptor: $${before.cash.toFixed(2)} -> $${afterBill.cash.toFixed(2)},`
  + ` meter ${before.credits} -> ${afterBill.credits} credits\n`);
check(afterBill.credits > before.credits,
  'CLICKING THE BILL ACCEPTOR PUTS CREDITS ON THE METER — the mouse can start a'
  + ' sitting, which four deck buttons alone could not');
check(afterBill.cash < before.cash, 'and it is charged to the ONE wallet');

// ── BET ONE and MAX BET ──────────────────────────────────────────────────────
const betBefore = (await money()).bet;
const betOne = await at(...btn('BET ONE'));
await p.mouse.click(betOne.x, betOne.y);
await p.waitForTimeout(200);
const betAfter = (await money()).bet;
check(betAfter > betBefore, `clicking BET ONE raises the stake (${betBefore} -> ${betAfter})`);
const maxBet = await at(...btn('MAX BET'));
await p.mouse.click(maxBet.x, maxBet.y);
await p.waitForTimeout(200);
const betMax = (await money()).bet;
check(betMax >= betAfter, `clicking MAX BET takes it to the top (${betMax})`);

// ── SPIN ─────────────────────────────────────────────────────────────────────
const spin = await at(...btn('SPIN'));
await p.mouse.move(spin.x, spin.y); await p.waitForTimeout(90);
check(/pointer/.test(await p.evaluate(() => document.body.style.cursor)),
  'SPIN shows the hand once the meter can pay for a spin — the same `deckLive`'
  + ' the paint reads');
const creditsPre = (await money()).credits;
await p.mouse.click(spin.x, spin.y);
const spun = await until(() => window.__slots.view().state === 'spinning', 'the reels to start');
check(spun, 'CLICKING SPIN TURNS THE REELS — the button works where it is drawn');
check((await money()).credits < creditsPre, 'and the stake really left the meter');
await until(() => window.__slots.view().state === 'idle', 'the spin to finish', 20000);

// ── the keys STILL work, which is half the point ─────────────────────────────
//
// *"The current keyboard shortcuts (SPACE spin, B bet, M max, I insert, C cash
// out) should keep working — this is about not forcing a menu, not about
// removing the keys."*
const keyPre = await money();
await p.keyboard.down(' '); await p.waitForTimeout(90); await p.keyboard.up(' ');
const keySpun = await until(() => window.__slots.view().state === 'spinning', 'SPACE to spin');
check(keySpun, 'SPACE still spins — the keyboard path is untouched by the mouse one');
check((await money()).credits < keyPre.credits, 'and it staked through the same machine');
await until(() => window.__slots.view().state === 'idle', 'the spin to finish', 20000);

// V FIRST, THEN B, AND THE ORDER IS THE POINT. MAX BET above left the stake at
// the top of the ladder, so pressing B there is a no-op — the machine is right
// and the check would have been measuring its own bad setup. (It did, once:
// "B and V still walk the stake" went red against a working world.)
const bPre = (await money()).bet;
await p.keyboard.down('v'); await p.waitForTimeout(90); await p.keyboard.up('v');
await p.waitForTimeout(150);
const bDown = (await money()).bet;
await p.keyboard.down('b'); await p.waitForTimeout(90); await p.keyboard.up('b');
await p.waitForTimeout(150);
const bUp = (await money()).bet;
check(bDown < bPre && bUp === bPre,
  `V and B still walk the stake down and back up (${bPre} -> ${bDown} -> ${bUp})`);

// ── CASH OUT, by clicking it ─────────────────────────────────────────────────
const cashPre = await money();
const out = await at(...btn('CASH OUT'));
await p.mouse.click(out.x, out.y);
await until(() => window.__slots.view().credits === 0, 'the meter to empty');
const cashPost = await money();
console.log(`\n  cash out: meter ${cashPre.credits} -> ${cashPost.credits},`
  + ` wallet $${cashPre.cash.toFixed(2)} -> $${cashPost.cash.toFixed(2)}\n`);
check(cashPost.credits === 0 && cashPost.cash > cashPre.cash,
  'CLICKING CASH OUT empties the meter into the one wallet');

check(errs.length === 0, `no page errors (${errs.length})`);
if (errs.length) console.log(`   ${errs.join('\n   ')}`);

console.log(`\n  ${bad === 0 ? 'all checks pass' : `${bad} FAILED`}.\n`);
await b.close();
process.exit(bad ? 1 : 0);

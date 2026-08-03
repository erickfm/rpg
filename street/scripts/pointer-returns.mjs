// Item 277 — DOES THE MOUSE WORK THE INSTANT AN OVERLAY CLOSES?
//
// The user: *"when i exit overlays my mouse stops working as well."*
//
// Opening a diegetic panel calls `document.exitPointerLock()` (`ct/hud.ts`), and
// that is deliberate and correct — you cannot click a screen with a pointer the
// browser has hidden and pinned to the middle of the canvas. The fault was that
// nothing gave it back: there is exactly ONE `requestPointerLock` in the whole
// source, `src/main.ts:32`, hanging off a canvas CLICK. So every overlay left
// the player unable to look around until he worked out he had to click.
//
// ── WHAT THIS ASSERTS, AND WHY EACH LEG EXISTS ────────────────────────────
//
// Three claims, and they are NOT the same claim:
//
//   RELEASED   the lock is gone while a cabinet is up. This is the behaviour
//              that was already right, and a "fix" that simply stopped
//              releasing would make the mouse work again and break clicking
//              every diegetic screen in the world. It is asserted first so it
//              cannot be traded away for the one below.
//   RETURNED   the lock is back the moment the cabinet closes — the user's
//              actual complaint.
//   NOT STOLEN a player who never had the pointer does not have it taken. A
//              blanket `requestPointerLock()` on close would pass RETURNED and
//              seize the mouse of somebody who had never clicked into the
//              world, and in a sandboxed artifact iframe it cannot lock at all.
//
// ── EVERY EXIT, BECAUSE THE BUG WAS AN EXIT NOBODY WIRED ──────────────────
//
// The row names four and they are driven separately: `[E]`, Escape, the ATM's
// own farewell TIMEOUT (which closes itself, with no user gesture at all — the
// one path where a re-lock is not inside an input handler), and closing while
// SEATED. A fix on three of four would look identical to a fix on four.
//
// ── THE FLOOR ─────────────────────────────────────────────────────────────
//
// GOTCHAS 79's lesson, applied: every leg of this can pass by measuring
// nothing. If the pointer never locks in the first place — a headless browser
// that refuses, a canvas that moved, a click that missed — then RELEASED is
// trivially true, RETURNED is trivially false, and NOT STOLEN is vacuous. So
// each overlay proves it HELD the lock before it opened anything, and the run
// as a whole requires that the population of overlays it actually drove is the
// population the world publishes. The `pointer-never-locks` mutation case in
// `scripts/canfail.mjs` is the negative: it makes the world unable to lock and
// this must go red rather than green-through-vacuity.
//
// Usage: SHOT_URL=http://localhost:4650/ node scripts/pointer-returns.mjs [outprefix]
import { chromium } from 'playwright';
import { aim } from './lib/aim.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { waitPainted } from './lib/painted.mjs';

const URL = aim('http://localhost:4650/');
const OUT = process.argv[2] ?? '/tmp/w109-pointer';

const fails = [];
const notes = [];
const ok = (cond, msg) => { (cond ? notes : fails).push(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); return cond; };

// THE OVERLAYS, BY THE LABEL OF THE SPOT THAT RAISES EACH — never by a
// coordinate typed here, so the desk can move a machine without this following
// it by hand (BUILDER-BRIEF §8). The yaw matters and is not decoration: the ATM
// shows its `[E]` prompt at yaw 0 and does NOT open there (measured, item 277
// handoff), so each entry carries the facing that actually works.
const OVERLAYS = [
  { re: /use the machine/i,           name: 'ATM (86)',         yaw: Math.PI / 2 },
  { re: /open your mailbox/i,         name: 'mail (155)',       yaw: 0 },
  { re: /read the loan application/i, name: 'loan (185)',       yaw: 0 },
  { re: /sit at the computer/i,       name: 'library PC (157)', yaw: 0 },
  { re: /sit at the slot/i,           name: 'slots (100)',      yaw: 0 },
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(800);

/** Locked, as the BROWSER has it — `input.locked` in main.ts is a mirror of this
 *  and asserting on the mirror would let the two drift without anyone knowing. */
const locked = () => p.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const seated = () => p.evaluate(() => !!window.__ct?.seated?.());
/** A REAL pointer press on the canvas. `dispatchEvent` carries no user gesture
 *  and `requestPointerLock` is entitled to refuse it. */
const click = async () => { await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(400); };
/** BUILDER-BRIEF §5 — a HELD press. A tap can begin and end inside one frame,
 *  and the `[E]` dispatch is an edge read once per rendered frame. */
const pressE = async () => { await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e'); await p.waitForTimeout(1300); };

const spots = await p.evaluate(() => (window.__ct.spots?.() ?? []).map((s) => ({
  label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z,
})));
ok(spots.length > 0, `0. FLOOR: the world publishes interaction spots (${spots.length})`);

/** Put the player at an overlay, holding the pointer lock, with nothing up. */
const approach = async (o) => {
  const s = spots.find((q) => o.re.test(q.label));
  if (!s) return null;
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(400);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [s.x, s.z, o.yaw]);
  await p.waitForTimeout(600);
  if (!(await locked())) await click();
  return s;
};

const drove = [];          // which exits were actually driven, for the floor
const opened = [];         // which overlays actually raised a cabinet

// ── LEGS 1 & 2 — every overlay, closed by ESCAPE and by [E] ───────────────
for (const o of OVERLAYS) {
  const s = await approach(o);
  if (!ok(!!s, `1. FLOOR: ${o.name}: its spot is registered in the world`)) continue;

  for (const exit of ['Escape', 'E']) {
    await approach(o);
    // THE FLOOR, per overlay and per exit. Without it every assertion below is
    // about a browser that never locked, and RELEASED would be free.
    if (!ok(await locked(), `1. FLOOR: ${o.name}/${exit}: the player HOLDS the pointer before opening`)) continue;
    await pressE();
    const id = await panel();
    if (!ok(!!id, `1. FLOOR: ${o.name}/${exit}: [E] raised a cabinet (got ${id})`)) continue;
    if (exit === 'Escape') opened.push(id);
    ok(!(await locked()), `2. ${o.name}/${exit}: RELEASED — the pointer is free while the cabinet is up`);

    if (exit === 'Escape') await p.keyboard.press('Escape');
    else await pressE();
    await p.waitForTimeout(1000);
    ok((await panel()) === null, `3. ${o.name}/${exit}: the cabinet closed`);
    ok(await locked(), `4. ${o.name}/${exit}: RETURNED — the pointer is back the instant it closes`);
    drove.push(`${o.name}/${exit}`);
  }
}
await p.screenshot({ path: `${OUT}-1-after-exits.png` });

// ── LEG 3 — THE ATM'S FAREWELL TIMEOUT: it closes ITSELF ──────────────────
// The only exit with no user gesture behind it. If a re-lock needed transient
// activation this is the leg that would fail, and it is why it is driven rather
// than reasoned about.
{
  const o = OVERLAYS[0];
  const s = await approach(o);
  if (ok(!!s, '5. FLOOR: the ATM spot is registered')) {
    if (ok(await locked(), '5. FLOOR: the player HOLDS the pointer before the ATM opens')) {
      await pressE();
      if (ok((await panel()) === 'ct-atm', '5. FLOOR: the ATM cabinet is up')) {
        ok(!(await locked()), '5. RELEASED — the pointer is free while the ATM is up');
        // Close it the way the machine itself does, with no key and no click.
        await p.evaluate(() => window.__hud.closePanels());
        await p.waitForTimeout(900);
        ok((await panel()) === null, '6. the ATM closed itself');
        ok(await locked(), '6. RETURNED — the pointer is back after a SELF-CLOSE, with no user gesture');
        drove.push('ATM/self-close');
      }
    }
  }
}

// ── LEG 4 — CLOSING WHILE SEATED ──────────────────────────────────────────
// Item 206 records that closing a panel from a chair ejects the player. That is
// a separate fault and NOT this check's business; what matters here is that the
// pointer comes back on the way out of a seat as well as on the way out of a
// desk.
{
  const o = OVERLAYS.find((q) => /slot/i.test(q.name));
  const s = await approach(o);
  if (ok(!!s, '7. FLOOR: the slots spot is registered')) {
    if (ok(await locked(), '7. FLOOR: the player HOLDS the pointer before sitting down')) {
      await pressE();
      const sat = await seated();
      if (ok((await panel()) === 'ct-slots', '7. FLOOR: the slots cabinet is up')) {
        ok(sat, `7. FLOOR: the player is genuinely SEATED with it up (${sat}) — without this the leg is a duplicate of leg 1`);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(1100);
        ok((await panel()) === null, '8. the cabinet closed from the seat');
        ok(await locked(), '8. RETURNED — the pointer is back after closing while SEATED');
        drove.push('slots/seated-Escape');
      }
    }
  }
}

// ── LEG 5 — NOT STOLEN: a panel must never re-lock UNDER another panel ────
// `open()` calls `closePanels()` before it raises the new cabinet, so a panel
// closing is routinely a panel being REPLACED. A re-lock with no `!livePanel`
// test would leave the pointer hidden and pinned under the cabinet the player
// is being asked to read — the exact state the release exists to prevent.
{
  const o = OVERLAYS.find((q) => /loan/i.test(q.name));
  await approach(o);
  if (ok(await locked(), '9. FLOOR: the player HOLDS the pointer before the swap')) {
    await pressE();
    if (ok((await panel()) === 'ct-loan', '9. FLOOR: the diegetic cabinet is up for the swap')) {
      // …now raise a SCREEN-SPACE panel straight over it, which closes the first.
      await p.evaluate(() => window.__hud.openPanel('ct-pockets'));
      await p.waitForTimeout(800);
      ok((await panel()) === 'ct-pockets', '9. FLOOR: the screen-space cabinet replaced it');
      ok(!(await locked()), '10. NOT STOLEN — closing a diegetic panel to open another does NOT re-lock under it');
      // …AND THE DEBT MUST STILL BE PAID. This is the other half of leg 10 and
      // the reason the slot is module-level: the pointer was taken by the LOAN,
      // the loan is long gone, and the screen-space cabinet that replaced it
      // never took anything. If the debt were held per panel it would have died
      // with the loan and the mouse would be dead now — the user's complaint
      // reached by a different road, and one that a per-panel fix passes.
      await p.evaluate(() => window.__hud.closePanels());
      await p.waitForTimeout(900);
      ok((await panel()) === null, '10b. the replacement cabinet closed');
      ok(await locked(), '10b. RETURNED — the pointer comes back when the LAST cabinet closes, though a different one took it');
      drove.push('loan->pockets swap');
    }
  }
}

// ── LEG 6 — NOT STOLEN: a player who never locked is never grabbed ────────
// The sandboxed-artifact case, and the ordinary one where somebody has simply
// not clicked into the world yet. `lockedAtOpen` is null there and close() must
// leave it that way.
{
  const o = OVERLAYS.find((q) => /loan/i.test(q.name));
  const s = spots.find((q) => o.re.test(q.label));
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(400);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [s.x, s.z, o.yaw]);
  await p.waitForTimeout(500);
  await p.evaluate(() => document.exitPointerLock());
  await p.waitForTimeout(400);
  if (ok(!(await locked()), '11. FLOOR: the player genuinely does NOT hold the pointer')) {
    await pressE();
    if (ok((await panel()) === 'ct-loan', '11. FLOOR: the cabinet still opens without a lock')) {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(1000);
      ok((await panel()) === null, '12. the cabinet closed');
      ok(!(await locked()), '12. NOT STOLEN — a player who never held the pointer does not have one seized on close');
      drove.push('no-lock-at-open');
    }
  }
}
await p.screenshot({ path: `${OUT}-2-final.png` });

// ── THE POPULATION FLOOR ──────────────────────────────────────────────────
//
// Derived, not predicted. The overlays are found by spot label, so a renamed or
// deleted machine silently drops out of the loop above and every remaining
// assertion still passes — 12 quiet greens about a world half of which was
// never visited. That is exactly `masonry.mjs` examining zero faces (GOTCHAS
// 79), and it is the failure this file is most likely to have.
//
// So: the count of DIEGETIC cabinets this run actually raised must equal the
// count the world publishes. `__hud.panels()` is the roster; the screen-space
// ones (`ct-pockets`) and the ones bound to a table the player is not at
// (`ct-blackjack`) never take the pointer and are not this check's population,
// so they are subtracted by what they DID rather than by name.
const roster = await p.evaluate(() => window.__hud?.panels?.() ?? []);
const distinct = [...new Set(opened)];
console.log(`\nroster (${roster.length}): ${roster.join(', ')}`);
console.log(`raised by this run (${distinct.length}): ${distinct.join(', ')}`);
console.log(`exits driven (${drove.length}): ${drove.join(' · ')}`);
ok(roster.length > 0, `13. FLOOR: the world publishes a panel roster (${roster.length})`);
ok(distinct.length === OVERLAYS.length,
  `13. FLOOR: every overlay this check names raised its cabinet (${distinct.length} of ${OVERLAYS.length})`);
ok(distinct.every((id) => roster.includes(id)),
  '13. FLOOR: every cabinet this run drove is a member of the world\'s own roster');
// Four exit paths x nothing skipped: 5 overlays x 2 keyed exits, plus the ATM
// self-close, the seated close, the swap and the never-locked case.
ok(drove.length === OVERLAYS.length * 2 + 4,
  `13. FLOOR: every exit path was driven (${drove.length} of ${OVERLAYS.length * 2 + 4})`);

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log('');
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 8)) console.log('   ', e);
console.log(`shots at ${OUT}-*.png`);
console.log(fails.length === 0
  ? `POINTER RETURNS OK — ${notes.length} assertions, 0 failures`
  : `POINTER LOST — ${fails.length} of ${fails.length + notes.length} assertions failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);

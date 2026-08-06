import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { BUILD } from './ctx';
import { makePanel, UI, type Panel, type Purse } from './hud';
// THE PHYSICAL KEYPAD'S GRID, published by a module neither this file nor
// `ct/bank.ts` imports the other through. `ct/bank.ts:8` imports `openAtm` from
// here, so importing the layout back from there would close a cycle, and
// GOTCHAS §28 is that a module in a cycle can be dropped from the BUILT BUNDLE
// ONLY — dev perfect, no ATM in the artifact.
import { PAD_KEYS, padCells, padKeyAtUV, PAD_V_SCALE, setPadPickable, padPickable } from './atm-face';

// ── FIRST FEDERAL, the machine you actually use ───────────────────────────
//
// *"i also want an atm interface and an inventory interface. equally try hard."*
//
// The MACHINE — the niche in the bank wall, the raked screen, the keypad, the
// reveal — is builder A's, in `ct/bank.ts`, and the user has said he likes it.
// It is not touched here and this file draws none of it. This is only what
// happens when you press `[E]` on it: the screen you stand in front of.
//
// It is a 1997 bank machine and it behaves like one, which mostly means it is
// SLOW AND LITERAL. Insert card. Enter PIN. A menu whose items line up against
// chunky buttons down both sides. Balance. Withdraw in fixed notes. Take your
// cash. Take your card. It asks about a receipt and the answer is always the
// same, because the machine on that corner has never had paper in it.
//
// Everything about money goes through the ONE purse in `ct/hud.ts` — cash you
// withdraw lands in the same wallet the bodega spends from. There is no second
// model here and there is not going to be one.

export const ORDER = BUILD.PROPS + 6;

// ── the cabinet's own palette, READ rather than reinvented ─────────────────
//
// *"i hate the look of the atm. i want it to look more like the graphics of
// the atm we already designed"* — there are two ATMs (the charcoal-and-green
// cabinets on the bank facade, and this interface) and they used to disagree,
// the exact class of fault he had just caught on the bank door: one object
// that does not agree with itself. The desk asked, and the answer was the
// CABINETS — this file is the one that has to change.
//
// Every value below is copied VERBATIM out of `ct/bank.ts`'s own
// `atmPanelTex`/`atmNiche` (A's file, the machine in the wall), not matched
// by eye, so a fresh guess at "charcoal" and "phosphor green" cannot drift a
// half-step from what is actually built. Cited by line, as of `40ee8400a`:
//
//   CAB_BODY      bank.ts:324  '#414a52'                  the gunmetal cabinet body
//   CAB_BEZEL     bank.ts:328  '#1c2026'                   CRT surround
//   CAB_GLASS     bank.ts:329  '#0d1418'                   CRT glass, near black
//   CAB_PHOSPHOR  bank.ts:330  '#3f6a4a'                   the green tube itself
//   CAB_TEXT_DIM  bank.ts:336  rgba(180,255,190,0.32)      dim phosphor text
//   CAB_TEXT_LIT  bank.ts:340  rgba(180,255,190,0.5)       bright phosphor text/cursor
//   CAB_SLOT      bank.ts:347  '#2b3036'                   card/cash slot housing
//   CAB_SLOT_DARK bank.ts:348  '#0a0c0e'                   slot opening
//   CAB_LIT       bank.ts:349  '#63c27a'                   the lit card-slot arrow
//   CAB_SHELF     bank.ts:356  '#363d44'                   keypad shelf
//   CAB_KEY_HI    bank.ts:363  '#c6cbcf'                   a worn (pale) key face
//   CAB_KEY_LO    bank.ts:363  '#aab0b6'                   an unworn key face
//
// NOT AN IMPORT, and the reason has CHANGED — the note that used to stand here
// is now wrong in a way that would send the next reader into a trap.
//
// It said there was "nothing today to export": the values were inline literals
// inside a closure in `ct/bank.ts`. That has since been fixed. A hoisted them
// into an exported `ATM_PALETTE` (bank.ts:62) and left a docstring inviting
// this file to "import instead of duplicate", noting it is this file's call
// when to switch.
//
// **Taking that invitation would create an import cycle, and this codebase has
// a documented way of dying from exactly that.** `ct/bank.ts:8` already does
// `import { openAtm } from './atm'` — it has to, it owns the `[E]` spot — so
// `atm -> bank` closes the loop. GOTCHAS §28: a module in an import cycle can
// resolve to an undefined namespace at `ct/world.ts`'s eager-glob collection
// time and be **silently dropped from the BUILT BUNDLE ONLY**, which is the
// worst way round — dev would look perfect and the ATM would simply not exist
// in the artifact the user plays. `ct/hud.ts`'s own header block records the
// same hazard being designed around for the pockets.
//
// So the twelve literals below STAY, and the real fix is a third module that
// neither of these two imports — `ct/atm-palette.ts`, or a slot in an existing
// desk-owned shared file — which both can then import without a loop. That is
// a one-file change and it is queued rather than taken here, because creating
// it and rewriting `bank.ts`'s references is A's file, not this row's.
//
// Verified identical to `ATM_PALETTE` value-for-value as of `ce0f3b2c3`, so the
// duplication is currently harmless and only the FRAGILITY is outstanding.
const CAB_BODY = '#414a52';
const CAB_BEZEL = '#1c2026';
const CAB_GLASS = '#0d1418';
const CAB_PHOSPHOR = '#3f6a4a';
const CAB_TEXT_DIM = 'rgba(180,255,190,0.32)';
const CAB_TEXT_LIT = 'rgba(180,255,190,0.5)';
const CAB_SLOT = '#2b3036';
const CAB_SLOT_DARK = '#0a0c0e';
const CAB_LIT = '#63c27a';
const CAB_SHELF = '#363d44';
const CAB_KEY_HI = '#c6cbcf';
const CAB_KEY_LO = '#aab0b6';
/** Highlight/shadow variants of the ONE sourced body colour, for the plastic
 *  edges the cabinet conveys with real 3D shading and this flat panel has to
 *  fake with paint. Derived arithmetically from CAB_BODY rather than picked
 *  by eye, so the only judgement call here is "how much", not "which colour". */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (shift: number) => Math.min(255, Math.max(0, ((n >> shift) & 255) + amt));
  return `#${((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1)}`;
}
const CAB_BODY_HI = shade(CAB_BODY, 24);
const CAB_BODY_LO = shade(CAB_BODY, -20);
const CAB_BODY_EDGE = shade(CAB_BODY, -36);
/** ink for the printed button numbers — the cabinet's own keys carry no
 *  labels to cite, so these are the same one-source derivation as above,
 *  dark enough on a lit key and light enough on an unlit one. */
const CAB_INK_LIT = shade(CAB_BODY, -46);
const CAB_INK_DIM = shade(CAB_BODY, 40);

/** What the bank holds for you before you have ever touched the machine. */
const OPENING_BALANCE = 312.4;
/** Notes it will actually give you. A machine has a stock of twenties. */
const NOTES = [40, 100, 200, 400];

type Screen = 'idle' | 'pin' | 'menu' | 'balance' | 'withdraw' | 'wait' | 'cash' | 'receipt' | 'card' | 'thanks';

/** Left buttons are 1–4 top to bottom, right buttons 5–8. */
interface Row { left?: string; right?: string; act?: () => void; actR?: () => void }

let panel: Panel | null = null;
let PURSE: Purse | null = null;
let screen: Screen = 'idle';
let pin = '';
let pending = 0;              // notes counted out, waiting in the mouth
let message = '';
let timer = 0;

/**
 * THE PIN THE CARD IS ENROLLED WITH — now `purse.pin`, not module state.
 *
 * *"also the first time you go to the atm it saves your pin."*
 *
 * Item 184 kept this in a module `let` and filed the reason: it belongs on the
 * purse beside `account` and `card`, because it is a property of the CARD rather
 * than of this screen, but `Purse` lives in `ct/hud.ts` and 184 did not name
 * that file. Item 216 names it, so this is the hoist.
 *
 * **It is not a no-op, and the difference is where the PIN can now go wrong.**
 * As module state the PIN outlived the purse: anything that hands `register` a
 * fresh purse — a new game, a second world in one page, a test harness building
 * its own — got a machine still enrolled with the last card's PIN, while the
 * cash and the balance started over. The card's secret now has exactly the
 * lifetime of the card, which is the invariant the item asks for: the ATM, the
 * wallet and the loan desk all read one purse, and the PIN is on it.
 *
 * `undefined` means "never enrolled" and is what draws `CHOOSE A PIN`. Read
 * through `enrolled()` so the null-purse case has one answer in one place.
 */
const enrolled = (): string | undefined => PURSE?.pin;

/**
 * How long the fourth asterisk sits on the tube before the machine acts on it.
 *
 * *"once you enter 4 digits it auto submits please."*
 *
 * Not zero, and the beat is load-bearing rather than decorative. Submitting on
 * the keystroke itself would mean the PIN screen is never once observed holding
 * four digits — and `padActs` gates the ENT key on exactly that
 * (`pin.length === 4`), so ENT would become a key that can never be live, drawn
 * unlit, refusing the hand cursor. The item warns against breaking that logic
 * and it is right to: a real machine takes both, and a dead ENT on a cash
 * machine's pad is the machine lying about itself.
 *
 * So the fourth digit arms a short timer instead. You see the star land, ENT and
 * CLR are both still live and still meaningful during it, and if you touch
 * neither the machine goes on by itself. Under a quarter of a second reads as
 * "it submitted on its own", not as a wait.
 */
const SUBMIT_MS = 240;

/**
 * A SOFT-KEY PRESS, as a token no digit can be mistaken for.
 *
 * **This is the fix for the user's first complaint** — *"trying to hit cancel on
 * the pin keypad doesnt work cause its also 5?"* — and he diagnosed it exactly.
 *
 * The eight fascia buttons used to be dispatched by sending `onKey` the STRING
 * OF THEIR NUMBER: `clickAt` turned a click on the top-right button into
 * `onKey('5')`. On every screen but one that is unambiguous. On the PIN screen
 * `onKey`'s first line is `if (/^[0-9]$/.test(k) …) { pin += k; return }` — so
 * the digit handler shadowed the shortcut and **CANCEL typed a 5 into the PIN**.
 *
 * Note what that means for the mouse, which is the part worth being precise
 * about: because `clickAt` deliberately routes through `onKey` rather than
 * keeping a second dispatch, **CANCEL was broken by CLICK as well as by key** —
 * clicking it typed a 5 too. And `hotAt` still offered a hand cursor over it,
 * because it asks `rows()` whether a label is there, which it is. The machine
 * showed you a live button that did the wrong thing.
 *
 * The single-dispatch principle is right and is kept. What was wrong was the
 * ENCODING: one namespace doing two jobs. A soft key now says so.
 */
const SOFT = 'soft';
const softKey = (i: number, right: boolean) => `${SOFT}${right ? i + 4 : i}`;

const money = (n: number) => `$${n.toFixed(2)}`;
const acct = (p: Purse) => (p.account ?? (p.account = OPENING_BALANCE));

function go(s: Screen, msg = ''): void {
  screen = s; message = msg;
  panel?.repaint();
}

/** A step the machine takes on its own, because a real one makes you wait. */
function after(ms: number, then: () => void): void {
  clearTimeout(timer);
  timer = setTimeout(then, ms) as unknown as number;
}

/** Long enough to read two words, short enough that nobody waits for it. */
const FAREWELL_MS = 1100;

/**
 * Hand the machine back: close the view and leave a FRESH ATM behind.
 *
 * Resetting `screen` matters as much as closing. `go('thanks')` used to be the
 * last thing that ran, so without this the machine would sit on its farewell
 * screen forever and the next player would walk up to the tail of somebody
 * else's transaction.
 *
 * GUARDED, because `after()` fires on a wall clock that knows nothing about the
 * panel. If the player leaves during the flash — Escape, or walking away — the
 * timer is still armed, and an unguarded close would fire into whatever is open
 * a second later. Only close if we are still standing on the farewell.
 */
function endSession(): void {
  if (screen !== 'thanks') return;
  screen = 'idle';
  pin = '';
  panel?.close();
}

function rows(p: Purse): Row[] {
  switch (screen) {
    case 'idle':
      return p.card === false
        ? [{ left: 'NO CARD' }]
        : [{ left: 'INSERT CARD', act: () => { pin = ''; go('pin'); } }];
    case 'pin':
      // CANCEL DISCARDS THE ENTRY. Caught by the walk: it used to `go('card')`
      // and leave the half-typed digits sitting in `pin`. Nothing user-visible
      // depended on it — `INSERT CARD` clears the buffer on the way back in —
      // but a cancelled PIN that is still in memory is exactly the kind of thing
      // that becomes a bug the moment anything else reads it, and now that a PIN
      // can be ENROLLED there is something else that reads it.
      return [{ right: 'CANCEL', actR: () => { pin = ''; go('card'); } }];
    case 'menu':
      return [
        { left: 'BALANCE', act: () => go('balance') },
        { left: 'WITHDRAW', act: () => go('withdraw') },
        {},
        // ONE PRESS, NOT TWO. The user: *"theres still 2 take card options. it
        // should be take card and then the exit not take card > take card"*.
        //
        // This used to `go('card')` — a screen whose ONLY button is also
        // labelled TAKE CARD, so ending a session meant pressing the same words
        // twice. The `card` screen still exists and is still right on the path
        // that reaches it after a withdrawal (`receipt` -> NO -> `card`), where
        // the machine really is handing your card back and TAKE CARD is the
        // first time you have been asked. From the MENU there is nothing to
        // hand back yet, so it goes straight to the farewell.
        { right: 'TAKE CARD', actR: () => { go('thanks'); after(FAREWELL_MS, endSession); } },
      ];
    case 'balance':
      return [{ right: 'BACK', actR: () => go('menu') }];
    case 'withdraw':
      return NOTES.map((n, i) => ({
        left: money(n),
        act: () => {
          if (acct(p) < n) { go('withdraw', 'INSUFFICIENT FUNDS'); return; }
          p.account = acct(p) - n;
          pending = n;
          go('wait');
          after(1400, () => go('cash'));
        },
        right: i === 3 ? 'BACK' : undefined,
        actR: i === 3 ? () => go('menu') : undefined,
      }));
    case 'cash':
      return [{
        left: 'TAKE CASH',
        act: () => {
          p.cash += pending;
          const took = pending; pending = 0;
          go('receipt', `${money(took)} TAKEN`);
        },
      }];
    case 'receipt':
      // YES and NO on the TOP PAIR, facing each other across the tube. A yes
      // four rows above its no is a machine asking two questions.
      return [{
        left: 'YES', act: () => go('receipt', 'NO PAPER'),
        right: 'NO', actR: () => go('card'),
      }];
    case 'card':
      // TAKE CARD: FLASH THE FAREWELL, THEN LET GO ON ITS OWN.
      //
      // Two rounds with the user. First: *"take card from atm should
      // immediately get us out of the menu"* — because the farewell screen sat
      // there until you pressed ANOTHER key, the close for it living inside the
      // key handler. That was the machine asking a question nobody has.
      //
      // Then, on seeing it skipped entirely: *"im just saying after we click the
      // first take card, just flash thank you farewell screen and release the
      // player"*. So the screen is right and WAITING FOR INPUT was the fault.
      // `after()` already exists for exactly this — "a step the machine takes on
      // its own, because a real one makes you wait".
      return [{ left: 'TAKE CARD', act: () => {
        go('thanks');
        after(FAREWELL_MS, endSession);
      } }];
    default:
      return [];
  }
}

// ── the screen ────────────────────────────────────────────────────────────
//
// 300 × 190 of fascia: a button column down each side and the CRT between
// them, with the card slot and the cash mouth under it. The buttons are drawn
// INSIDE the panel's screen area rather than on its bezel, because the bezel is
// the shared cabinet — the slots machine and the pockets get the same one, and
// neither of them has eight buttons.
// THE CANVAS IS THE RAKED SCREEN FACE ITSELF, so it is cut to that face's own
// proportions rather than to a shape chosen for a floating rectangle. Measured
// off the mesh `ct/bank.ts` builds: 0.62 m across by 0.4243 m down the rake,
// which is 1.461:1 — so 300 × 205. It used to be 300 × 214 (1.402:1), a 4%
// vertical stretch nobody could see while it floated in screen space and which
// becomes a real distortion once it is wrapped onto the object.
const W = 300, H = 205;
const CRT = { x: 32, y: 9, w: 236, h: 187 };
// Pushed DOWN from y 22. At 22 the first menu label printed straight across the
// FIRST FEDERAL rule at the top of the tube — legible in a still, wrong in the
// way a real fascia never is, because on a real machine the top button is below
// the header for exactly this reason.
//
// Re-spaced for the taller tube, and the 18 px of clear air between the header
// band and the first button label is the number being PRESERVED here, not the
// button positions: scaling the old rows to the new height proportionally left
// only 6 px there and printed `ENTER YOUR PIN` into `CANCEL ▶`.
const BTN_Y = [56, 92, 128, 164], BTN_H = 15, BTN_W = 26;
/** the three horizontal bands every screen lays out on */
const HEAD = 39, BODY = 115, SUB = 141;

// ── the PIN pad: THE REAL ONE, on the machine ─────────────────────────────
//
// *"for the atm why do we not use the number button at the bottom?"* — and he
// is right, there were two keypads. The machine has a real twelve-key pad in
// 3-D directly below the tube; this file used to draw a SECOND one in phosphor
// on the tube, because that was the only surface the pointer could reach.
//
// The reason was honest and is now gone. The framework picks one mesh, the
// keypad is a different mesh at a different rake, and the pad's layout was
// twelve literals inside a closure in `ct/bank.ts` — invisible here. Both halves
// now read `ct/atm-face.ts`: `ct/bank.ts` paints the keys from `padCells()`,
// this file hit-tests the same rectangles, and `linkPadPick` is what lets a
// pointer over a physical key arrive here at all.
//
// SO THE DRAWN PAD IS RETIRED and the PIN screen shows only what a real machine
// shows: the prompt and the four asterisks filling in as you press keys you can
// see. The keyboard still works and still gets a mention in the caption.
//
// WHERE THE PHYSICAL KEYS ARRIVE. `ct/hud.ts` hands clicks over in this canvas's
// own pixels; `ct/atm-face.ts` maps the shelf into the SAME pixel space,
// immediately below the tube — `H` .. `H * (1 + PAD_V_SCALE)`, about 70 rows,
// which is what 0.1442 m of shelf measures at this canvas's 484 px/m. Nothing
// is ever painted down there. The canvas is `H` tall and the strip is hit-test
// only, which is why `drawScreen` never mentions it.
const PAD_STRIP = H * PAD_V_SCALE;

function drawScreen(g: CanvasRenderingContext2D): void {
  const p = PURSE!;
  const r = rows(p);

  // THE FASCIA ITSELF, and it has to be PAINTED rather than left bare. A panel
  // floating over the page could leave its background transparent and let the
  // world show through; a canvas wrapped onto a mesh cannot, because an
  // untouched canvas is rgba(0,0,0,0) and a MeshBasicMaterial with no
  // `transparent` flag renders that as flat BLACK. The first shot of this on
  // the machine had the tube sitting in a black slab where the cabinet's own
  // gunmetal should have been.
  g.fillStyle = CAB_BODY; g.fillRect(0, 0, W, H);
  // the moulding: a lit top edge and a shadowed bottom, so the face reads as a
  // panel set into the niche rather than as a sticker on it
  g.fillStyle = CAB_BODY_HI; g.fillRect(0, 0, W, 2);
  g.fillStyle = CAB_BODY_EDGE; g.fillRect(0, H - 2, W, 2);

  // the two button columns. A physical nub with a lit edge, not a rectangle:
  // these are the only thing on the fascia you are meant to press.
  for (let i = 0; i < 4; i++) {
    for (const side of [0, 1]) {
      const bx = side ? W - BTN_W - 1 : 1;
      const live = side ? !!r[i]?.right : !!r[i]?.left;
      g.fillStyle = CAB_BODY_EDGE; g.fillRect(bx, BTN_Y[i], BTN_W, BTN_H);
      g.fillStyle = live ? CAB_KEY_HI : CAB_SHELF;
      g.fillRect(bx + 1, BTN_Y[i], BTN_W - 2, BTN_H - 2);
      g.fillStyle = live ? '#eef2ee' : CAB_BODY_HI;
      g.fillRect(bx + 1, BTN_Y[i], BTN_W - 2, 2);
      // the number you actually press, since there is no cursor in this world
      g.fillStyle = live ? CAB_INK_LIT : CAB_INK_DIM;
      g.font = UI.font(7, true); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(side ? i + 5 : i + 1), bx + BTN_W / 2, BTN_Y[i] + BTN_H / 2);
    }
  }

  // the CRT: green phosphor on near-black, with a bezel of its own and
  // scanlines — CAB_BEZEL/CAB_GLASS/CAB_PHOSPHOR, read off the cabinet's own
  // tube rather than kept as the amber this used to be.
  g.fillStyle = CAB_BEZEL; g.fillRect(CRT.x - 2, CRT.y - 2, CRT.w + 4, CRT.h + 4);
  g.fillStyle = CAB_GLASS; g.fillRect(CRT.x, CRT.y, CRT.w, CRT.h);
  // the phosphor itself — the cabinet fills nearly the whole glass with it
  // (bank.ts's `atmPanelTex`, a few percent of margin either side)
  g.fillStyle = CAB_PHOSPHOR; g.fillRect(CRT.x + 3, CRT.y + 3, CRT.w - 6, CRT.h - 6);
  g.save();
  g.beginPath(); g.rect(CRT.x, CRT.y, CRT.w, CRT.h); g.clip();
  g.translate(CRT.x, CRT.y);

  const line = (s: string, y: number, c: string = CAB_TEXT_LIT, size = 9, align: CanvasTextAlign = 'center') => {
    g.fillStyle = c; g.font = UI.font(size, true); g.textAlign = align; g.textBaseline = 'alphabetic';
    g.fillText(s, align === 'center' ? CRT.w / 2 : align === 'left' ? 6 : CRT.w - 6, y);
  };

  line('FIRST FEDERAL', 14, CAB_TEXT_DIM, 8);
  g.fillStyle = CAB_TEXT_DIM; g.fillRect(6, 18, CRT.w - 12, 1);

  if (screen === 'idle') {
    line(p.card === false ? 'NO CARD' : 'WELCOME', BODY, CAB_TEXT_LIT, 15);
    line(p.card === false ? 'SEE YOUR BRANCH FOR A NEW ONE' : 'PLEASE INSERT YOUR CARD', SUB, CAB_TEXT_LIT, 8);
  } else if (screen === 'pin') {
    // THE TUBE SHOWS WHAT A CASH MACHINE'S TUBE SHOWS, and nothing else. The
    // twelve phosphor keys that used to sit under this line were a keypad
    // drawn on a screen six inches above a keypad, and the user asked why.
    // The keys are on the machine; this is the readout.
    // FIRST VISIT ASKS YOU TO CHOOSE ONE; every later visit asks you to enter
    // it. The machine has to say which of the two it is doing, or enrolment is
    // a silent event that only announces itself when a later visit rejects you.
    line(p.pin === undefined ? 'CHOOSE A PIN' : 'ENTER YOUR PIN', HEAD, CAB_TEXT_LIT, 10);
    line(''.padStart(pin.length, '*').padEnd(4, '_').split('').join(' '), BODY, CAB_TEXT_LIT, 22);
    if (message) line(message, SUB, '#e06a3c', 8);
    else if (p.pin === undefined) line('THIS WILL BE YOUR PIN', SUB, CAB_TEXT_DIM, 8);
    else line('CLR CANCELS', SUB, CAB_TEXT_DIM, 8);
  } else if (screen === 'menu') {
    line('SELECT A SERVICE', HEAD, CAB_TEXT_LIT, 10);
    if (message) line(message, SUB, CAB_TEXT_DIM, 8);
  } else if (screen === 'balance') {
    line('AVAILABLE BALANCE', HEAD, CAB_TEXT_DIM, 8);
    line(money(acct(p)), BODY, CAB_TEXT_LIT, 20);
    line(`IN POCKET ${money(p.cash)}`, SUB, CAB_TEXT_DIM, 7);
  } else if (screen === 'withdraw') {
    line('SELECT AMOUNT', HEAD, CAB_TEXT_LIT, 10);
    if (message) line(message, BODY, '#e06a3c', 10);
  } else if (screen === 'wait') {
    line('PLEASE WAIT', BODY, CAB_TEXT_LIT, 15);
    line('COUNTING NOTES', SUB, CAB_TEXT_DIM, 8);
  } else if (screen === 'cash') {
    line('CASH READY', HEAD, CAB_TEXT_LIT, 10);
    line(money(pending), BODY, CAB_TEXT_LIT, 20);
    line('TAKE IT FROM THE MOUTH BELOW', SUB, CAB_TEXT_DIM, 7);
  } else if (screen === 'receipt') {
    line(message || '', HEAD, CAB_TEXT_LIT, 10);
    line('DO YOU WANT A RECEIPT?', BODY, CAB_TEXT_LIT, 11);
    if (message === 'NO PAPER') line('NO PAPER IN THIS MACHINE', SUB, '#e06a3c', 8);
  } else if (screen === 'card') {
    line('TAKE YOUR CARD', BODY, CAB_TEXT_LIT, 15);
  } else if (screen === 'thanks') {
    line('THANK YOU', BODY, CAB_TEXT_LIT, 16);
    line('FIRST FEDERAL SAVINGS', SUB, CAB_TEXT_DIM, 8);
  }

  // the menu items, lined up against the buttons — the whole point of the
  // layout, and the reason the labels are drawn at the buttons' own y
  const r2 = rows(p);
  for (let i = 0; i < 4; i++) {
    const y = BTN_Y[i] + BTN_H / 2 + 3 - CRT.y;
    if (r2[i]?.left) line(`◀ ${r2[i].left}`, y, CAB_TEXT_LIT, 9, 'left');
    if (r2[i]?.right) line(`${r2[i].right} ▶`, y, CAB_TEXT_LIT, 9, 'right');
  }

  // scanlines last, over everything, so the text sits IN the tube
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < CRT.h; y += 3) g.fillRect(0, y, CRT.w, 1);
  g.restore();

  // THE CARD SLOT AND THE CASH MOUTH USED TO BE PAINTED HERE AND ARE NOT ANY
  // MORE. This canvas is the raked SCREEN face now, and the machine already has
  // both of those as real geometry: the card slot down the right of this same
  // face, the cash mouth on the apron a few centimetres below it, built by
  // `ct/bank.ts` and visible in the same frame as this. Drawing them again gave
  // the cabinet two card slots and two cash mouths, one of them a picture — the
  // same "one object that does not agree with itself" the user caught on the
  // bank door and on the ATM's own palette.
  //
  // `CASH READY` still says TAKE IT FROM THE MOUTH BELOW, and below is now a
  // place that exists.
  const lamp = screen === 'idle' || screen === 'thanks' ? CAB_BODY_LO : CAB_LIT;
  g.fillStyle = lamp;
  g.fillRect(CRT.x, H - 6, CRT.w, 2);        // the fascia's one live lamp
}

// ── keys ──────────────────────────────────────────────────────────────────
//
// DIGITS WORK IN HERE, which they do nowhere else in this world: `src/main.ts`
// spends every digit switching prototypes, and the panel gate swallows keydown
// before main.ts's own listener ever sees it. That is a property of the
// framework rather than a trick — a panel genuinely owns the keyboard while it
// is up — and it is what makes a PIN pad possible at all.
function onKey(k: string): void {
  const p = PURSE!;
  // SOFT KEYS FIRST, AND ON EVERY SCREEN. A fascia button is a fascia button
  // whatever the tube is showing, and nothing below may shadow one — that
  // shadowing is the whole of the user's first complaint. See `softKey`.
  if (k.startsWith(SOFT)) {
    const n = Number(k.slice(SOFT.length));
    const r = rows(p);
    if (n < 4) r[n]?.act?.();
    else r[n - 4]?.actR?.();
    return;
  }
  if (screen === 'pin') {
    if (/^[0-9]$/.test(k) && pin.length < 4) {
      pin += k;
      panel?.repaint();
      // THE FOURTH DIGIT SUBMITS ON ITS OWN, after a beat. See `SUBMIT_MS`.
      if (pin.length === 4) after(SUBMIT_MS, submitPin);
      return;
    }
    if (k === 'backspace') {
      // CLR ON AN EMPTY PIN IS THE KEYBOARD'S CANCEL, and it is how this screen
      // is escaped without a mouse.
      //
      // The fascia CANCEL is reachable by CLICK again (see `softKey`), but it
      // CANNOT be reached by its number here: its number is 5, and 5 is a digit
      // the PIN screen is entitled to eat. That collision is real and no
      // encoding fixes it — the user spotted it himself.
      //
      // So the escape hatch is the machine's OWN key rather than an invented
      // one. CLR on an empty entry ending the session is what cash machines of
      // this vintage do, it is a key the player can see on the pad, and it works
      // by click and by keyboard through the same path everything else does.
      // CLR on a part-typed PIN still deletes a digit, exactly as before.
      if (pin === '') { go('card'); return; }
      pin = pin.slice(0, -1); panel?.repaint(); return;
    }
    // ENT STILL SUBMITS. It is redundant with the auto-submit above by design,
    // not by accident: during the `SUBMIT_MS` beat the PIN is complete and this
    // is the key that says "now", which is what the pad's own affordance logic
    // has always promised.
    if (k === 'enter' && pin.length === 4) { submitPin(); return; }
    return;
  }
  // A key during the farewell skips the wait rather than being swallowed —
  // and goes through `endSession` so the machine is reset the same way the
  // timer would have reset it. Two paths, one teardown; they used to differ,
  // and the version that only closed left the ATM stuck on its farewell.
  if (screen === 'thanks') { endSession(); return; }
  // A DIGIT ON A MENU SCREEN *IS* A SOFT-KEY PRESS, so it says so and re-enters
  // above rather than carrying a second copy of the dispatch beside it. The two
  // used to be written out twice; one namespace, one implementation.
  const i = '12345678'.indexOf(k);
  if (i >= 0) onKey(`${SOFT}${i}`);
}

/**
 * Read the four digits the player just entered.
 *
 * **ENROLMENT, which is new** — *"the first time you go to the atm it saves your
 * pin."* Read as a request, because it was not what happened: `onKey` used to
 * open the menu on ANY four digits and no PIN was stored anywhere in the file.
 * First visit sets the PIN; every later visit has to match it.
 *
 * A WRONG PIN SAYS SO AND LETS YOU TRY AGAIN, with no strike count and no
 * lockout. Three-strikes-and-it-eats-the-card is period-true and tempting, and
 * it is deliberately not built: nobody asked for a way to lose their card to a
 * typo, and the same session that added enrolment also added the auto-submit
 * that makes a typo unfixable once the fourth digit lands.
 *
 * GUARDED on `screen` and on length, because the caller may be a wall-clock
 * timer that knows nothing about the panel — the same reason `endSession` is
 * guarded. Press ENT during the beat and this runs twice; the second one must
 * do nothing rather than re-read a PIN that has already been accepted.
 */
function submitPin(): void {
  if (screen !== 'pin' || pin.length !== 4) return;
  const entered = pin;
  pin = '';
  if (enrolled() === undefined) { if (PURSE) PURSE.pin = entered; go('menu', 'PIN SET'); return; }
  if (entered === enrolled()) { go('menu'); return; }
  go('pin', 'INCORRECT PIN');
}

// ── the mouse ─────────────────────────────────────────────────────────────
//
// The framework raycasts the pointer onto this machine's screen mesh and hands
// back the hit in THIS canvas's own pixels — the same coordinates everything
// above is drawn in — so the machine hit-tests its own layout and the framework
// never has to be told where anything is.
//
// The pressable area of a soft key is the NUB PLUS ITS LABEL. The nub is 26 px
// wide on a 300 px fascia; on screen that is a target about 8 mm across, and
// the thing the player is actually reading and aiming at is the `◀ WITHDRAW`
// beside it. So each row claims its whole end of the fascia out to
// `LABEL_REACH` into the tube. The two ends cannot meet: the CRT is 236 wide
// and they reach 100 each.
const LABEL_REACH = 100;
const L_EDGE = CRT.x + LABEL_REACH;                  // 132
const R_EDGE = CRT.x + CRT.w - LABEL_REACH;          // 168

function buttonAt(x: number, y: number): { i: number; right: boolean } | null {
  for (let i = 0; i < 4; i++) {
    if (y < BTN_Y[i] - 5 || y > BTN_Y[i] + BTN_H + 5) continue;
    if (x <= L_EDGE) return { i, right: false };
    if (x >= R_EDGE) return { i, right: true };
    return null;
  }
  return null;
}

/** which physical key is under this canvas pixel? `null` anywhere on the tube,
 *  and `null` on the shelf between the keys — that is metal, not a button.
 *
 *  NOT GATED ON `screen === 'pin'` any more, and that is deliberate: these are
 *  keys the player can SEE on the machine at every screen, and a real key that
 *  does nothing must at least not claim it will (see `hotAt`). What each key
 *  does is `onKey`'s business, exactly as it is for the keyboard. */
function padAt(x: number, y: number): string | null {
  const dy = y - H;
  if (dy < 0 || dy > PAD_STRIP) return null;
  return padKeyAtUV(x / W, dy / PAD_STRIP);
}

/** is there something PRESSABLE here? Drives the hand cursor, so it must be
 *  true only where a click actually does something — a hand over a dead key is
 *  a machine lying about what it will do. */
function hotAt(x: number, y: number): boolean {
  if (!PURSE) return false;
  // THANK YOU is dismissed by any key, so it is dismissed by any click too —
  // the keyboard path has always ended that way and a mouse user reaching the
  // last screen of the session must not be the one person who has to hunt for
  // the way out of it.
  if (screen === 'thanks') return true;
  const k = padAt(x, y);
  if (k) return padActs(k);
  const b = buttonAt(x, y);
  if (!b) return false;
  const r = rows(PURSE);
  return b.right ? !!r[b.i]?.right : !!r[b.i]?.left;
}

/** would pressing this physical key do anything on the screen that is up?
 *
 *  ASKED OF `onKey`'s OWN RULES, not of a second table beside them. The pad is
 *  live on every screen — `1`-`8` pick the soft-key rows exactly as the number
 *  row on the keyboard always has, which is how a real machine with a numeric
 *  pad and a `1) BALANCE` menu works — but `9`, `0`, `CLR` and `ENT` mean
 *  nothing outside the PIN screen, and the hand cursor must not appear over
 *  them there. Same for `ENT` on a half-typed PIN, and `CLR` on an empty one. */
function padActs(k: string): boolean {
  if (screen === 'pin') {
    if (/^[0-9]$/.test(k)) return pin.length < 4;
    // CLR IS LIVE EVEN ON AN EMPTY PIN NOW, because on an empty PIN it cancels
    // the session rather than doing nothing. It was `pin.length > 0`, which was
    // correct while empty-CLR was dead and would now hide the one key that
    // escapes this screen from the keyboard.
    if (k === 'CLR') return true;
    if (k === 'ENT') return pin.length === 4;
    return false;
  }
  const i = '12345678'.indexOf(k);
  if (i < 0) return false;
  const r = rows(PURSE!);
  return i < 4 ? !!r[i]?.act : !!r[i - 4]?.actR;
}

/** ROUTED THROUGH `onKey`, not through a second copy of the dispatch. A click
 *  on `3` and a press of `3` are the same event as far as this machine is
 *  concerned, and the one thing worse than two input paths is two input paths
 *  that disagree about what button 3 does. */
function clickAt(x: number, y: number): void {
  if (!PURSE) return;
  if (screen === 'thanks') { onKey('1'); return; }        // any key ends it
  const k = padAt(x, y);
  if (k) { onKey(k === 'CLR' ? 'backspace' : k === 'ENT' ? 'enter' : k); return; }
  const b = buttonAt(x, y);
  if (!b) return;
  // A SOFT-KEY TOKEN, not the string of the button's number. Sending `'5'` here
  // is what made clicking CANCEL type a 5 into the PIN. See `softKey`.
  onKey(softKey(b.i, b.right));
}

// ── the way in ────────────────────────────────────────────────────────────

/**
 * THE HOOK, for builder A.
 *
 * `ct/bank.ts` already registers the machine's `[E]` and already reads the
 * purse; this replaces the one-line balance readout with the machine itself.
 * In `ct/bank.ts`, the ATM spot becomes:
 *
 *     import { openAtm } from './atm';
 *     …
 *     label: () => 'FIRST FEDERAL — use the machine',
 *     act: () => openAtm(),
 *
 * Nothing else changes, and `ct/atm.ts` never draws or moves any part of the
 * machine A built.
 *
 * (A: your current label says `balance $${purse.cash}`. That number is the cash
 * in the player's pocket; the ACCOUNT is now `purse.account`. Worth swapping if
 * you keep a readout at all — but the machine says it on its own screen now.)
 */
/**
 * WHICH machine you walked up to. Both ATMs of the pair carry the same
 * interface, so the one that lights up has to be the one you are standing at.
 *
 * Found by ASKING THE WORLD, not by importing the bank's coordinates: `ct/bank.ts`
 * tags every panel it builds with `userData.atmPart`, and the raked screen faces
 * are the ones tagged `'screen'`. That tag is the only thing this file knows
 * about the machine — no position, no size, no tilt — so A can move, re-rake or
 * re-texture the cabinets and this keeps working. Nearest to the player wins.
 *
 * BUILDER-BRIEF §8, and the alternative is the second copy of the truth this
 * file already carries once (see the palette block at the top) and got a
 * follow-up filed against it.
 */
let SCENE: THREE.Scene | null = null;
let PLAYER: { x: () => number; z: () => number } | null = null;
function screenMesh(): THREE.Object3D | null {
  if (!SCENE || !PLAYER) return null;
  const px = PLAYER.x(), pz = PLAYER.z();
  let best: THREE.Object3D | null = null;
  let bestD = Infinity;
  const p = new THREE.Vector3();
  SCENE.traverse((o) => {
    if (o.userData?.atmPart !== 'screen') return;
    o.updateWorldMatrix(true, false);
    p.setFromMatrixPosition(o.matrixWorld);
    const d = (p.x - px) ** 2 + (p.z - pz) ** 2;
    if (d < bestD) { bestD = d; best = o; }
  });
  // Nothing tagged means the cabinets are not in this world (a prototype
  // harness, a future refactor). The panel framework falls back to the
  // screen-space cabinet on a null, so this is a downgrade and not a break.
  return best;
}

export function openAtm(): void {
  if (!panel || !PURSE) return;
  clearTimeout(timer);
  screen = 'idle'; pin = ''; pending = 0; message = '';
  panel.open();
}

export function register(ctx: CtxBuild): void {
  PURSE = ctx.purse;
  SCENE = ctx.scene;
  PLAYER = ctx.player;
  acct(ctx.purse);                              // seed the balance once
  if (ctx.purse.card === undefined) ctx.purse.card = true;

  panel = makePanel({
    // FRAMELESS. `drawScreen` already paints a complete fascia — the two
    // button columns, the CRT in its own bezel and recess, the card slot and
    // cash mouth — filling the whole W×H canvas edge to edge, `FIRST FEDERAL`
    // printed on the tube itself (line 240 below). The framework's moulded
    // 'machine' chrome drew a SECOND cabinet around that picture of a first
    // one, stamping the bank's name a second time in its title bar: two
    // machines, two labels, for a screen that already carries both. Item 0c,
    // *"i never want there to be menus popping up unless they are embedded to
    // look as if they are in the actual game"* — `caseTint` above used to
    // exist so this second cabinet matched the real one on the bank facade;
    // with no second cabinet there is nothing left to match.
    id: 'ct-atm', w: W, h: H, scale: 2, chrome: 'none',
    // ON THE MACHINE, not over the camera. *"i want … the screen on the literal
    // atm be the overlay"*. The panel above already paints a complete fascia
    // into its own canvas; naming the mesh that canvas belongs on is the whole
    // of the change here — this file draws exactly what it drew before.
    // 0.75 m and 58° rather than the framework's default 0.55/60: at 0.55 the
    // face filled the whole frame and you could no longer tell you were at a
    // cash machine — the niche, the keypad and the cash mouth all fell outside
    // it, which is most of what makes the thing read as an object. Backing off
    // 0.20 m puts the cabinet back in its wall and still leaves the tube at
    // roughly 44% of frame width, ~1.9 screen pixels per texel.
    surface: { mesh: screenMesh, standoff: 0.75, fov: 58, hot: hotAt, click: clickAt },
    // The mouse is the way in now, so it is what the caption offers; the keys
    // still work and still get a mention, because a player who learned this
    // machine on the keyboard must not be told it stopped listening.
    // The PIN screen's hint names CLR, because it is the one screen where
    // "press its number" is NOT true of every fascia button — CANCEL's number
    // is 5 and 5 is a digit this screen eats, so CLR is the keyboard's way out.
    //
    // KEPT SHORT ON PURPOSE, and I have looked at it. This line is drawn across
    // the bottom of the viewport and it already overlaps the `[E] leave` label
    // and the CLR/0/ENT key row — visible on the MENU screen too, with the
    // original 34-character text, so the overlap is not mine. A 74-character
    // version made it markedly worse. CANCEL does not need to be in here: it is
    // drawn on the tube, against its own lit button.
    hint: () => (screen === 'pin'
      ? 'click the keys below, or type it — CLR backs out'
      : 'click a button, or press its number'),
    draw: (g) => drawScreen(g),
    key: (k) => onKey(k),
    // THE PHYSICAL KEYS BECOME PICKABLE ONLY NOW, and pairing it with `onClose`
    // is the whole point. `openAtm` is the wrong place and I put it there first
    // and the walk caught it: `panel.open()` DECLINES in two documented cases —
    // a panel already up, and the 500 ms lockout that stops a just-dismissed
    // panel springing back — so a caller that raises the flag before asking
    // leaves the CRT answering for a shelf nobody is standing at, with no close
    // coming to lower it. The framework only calls this if it really opened.
    onOpen: () => setPadPickable(true),
    onClose: () => {
      clearTimeout(timer);
      // THE CRT STOPS ANSWERING FOR THE KEYPAD. First line of the handler, and
      // before anything that could throw: leaving this up would put a phantom
      // hit 20 cm below the tube into every scene-wide raycast in the world.
      setPadPickable(false);
      // WALKING AWAY DOES NOT EAT YOUR CARD, and it does not eat notes it has
      // already counted out either. A 1997 machine really would keep both, and
      // that is a good detail and a bad rule: the framework promises ESC always
      // works, so ESC must never be the expensive choice. Anything in the mouth
      // goes in your pocket and the card comes back.
      if (pending > 0) { ctx.purse.cash += pending; pending = 0; ctx.refreshWallet(); }
      ctx.refreshWallet();
      screen = 'idle'; pin = '';
    },
  });

  // Test affordance, same shape as __ct / __inv / __hud. `ct/bank.ts` is A's
  // and the [E] hook is theirs to add, so until it lands this is the only way
  // in — and it is how scripts/K-atm-walk.mjs drives the machine either way.
  (window as unknown as { __atm: unknown }).__atm = {
    open: () => openAtm(),
    screen: () => screen,
    /**
     * WHERE A PHYSICAL KEY IS, in the canvas pixels clicks arrive in.
     *
     * A harness that wanted to click `7` on the real pad would otherwise have
     * to re-derive the grid and the shelf's place under the tube — a second
     * hand-typed copy of the very thing this change exists to stop having two
     * of (BUILDER-BRIEF §8). It asks the machine instead, and a check built on
     * it fails when the pad moves, which is exactly what it is for.
     */
    padPoint: (k: string) => {
      const i = (PAD_KEYS as readonly string[]).indexOf(k);
      if (i < 0) return null;
      const c = padCells()[i];
      const u = c.u + c.w / 2, vTop = c.v + c.h / 2;
      // `x`/`y` are canvas pixels, which is what `hot`/`click` speak. `u`/`v`
      // are the KEYPAD MESH's own uv (origin bottom-left, three's convention),
      // which is what a harness needs to turn a key into a point on the glass
      // it can actually move a real mouse to.
      return { x: u * W, y: H + vTop * PAD_STRIP, u, v: 1 - vTop };
    },
    /** every key face, so a check can sweep all twelve without knowing any */
    padKeys: () => PAD_KEYS.slice(),
    /**
     * WHERE A FASCIA SOFT KEY IS, in the same canvas pixels `padPoint` speaks.
     *
     * Same argument as `padPoint`'s, and the ATM's CANCEL is the case that
     * proves it: a harness that wanted to click CANCEL would otherwise re-derive
     * `BTN_Y`, `BTN_H` and `R_EDGE` by hand, and a second hand-typed copy of a
     * layout is how `doorside2.mjs` failed a door that was fine
     * (BUILDER-BRIEF §8). The point returned is the middle of the NUB, which is
     * inside `buttonAt`'s band by construction.
     *
     * `v` is flipped to the mesh's bottom-left origin exactly as `padPoint`
     * does, so a caller can lerp the screen mesh's own corners with it.
     */
    buttonPoint: (i: number, right: boolean) => {
      if (i < 0 || i > 3) return null;
      const x = right ? W - BTN_W / 2 - 1 : BTN_W / 2 + 1;
      const y = BTN_Y[i] + BTN_H / 2;
      return { x, y, u: x / W, v: 1 - y / H };
    },
    /** the mesh a click on the fascia has to be projected onto — the raked
     *  screen face, which is the panel's own `surface.mesh()`. */
    surfaceMesh: () => screenMesh(),
    /** which soft-key row is under this canvas pixel, so a harness can prove the
     *  point it is about to click really is the button it means */
    buttonAt: (x: number, y: number) => buttonAt(x, y),
    /** what the machine believes is under this canvas pixel */
    padAt: (x: number, y: number) => padAt(x, y),
    hotAt: (x: number, y: number) => hotAt(x, y),
    /** is the CRT answering for the keypad right now? Must be false whenever
     *  the panel is shut, or every raycast in the world sees a phantom. */
    padLive: () => padPickable(),
    /** how many digits are in, so a harness can tell "the pad did nothing" from
     *  "the pad worked and ENTER did nothing" — two failures that look identical
     *  from outside and cost a debugging round to tell apart */
    pin: () => pin.length,
    account: () => ctx.purse.account,
    cash: () => ctx.purse.cash,
    /**
     * IS THE CARD ENROLLED — read off `ctx.purse`, which is the object
     * `crosstown.ts` built and the wallet and the loan desk are also holding.
     * That is the whole assertion of item 216 part 1: the PIN has to persist on
     * the same thing the cash does, and a check has to be able to see WHERE it
     * lives, not just that the machine behaves.
     *
     * A boolean, not the PIN. The value is already reachable by anyone with a
     * console, but a test hook that prints the secret into every log is a habit
     * worth not starting, and no check needs more than "did enrolment land".
     *
     * `__ct.purse()` — the neutral view of the same object — does NOT publish
     * this; `crosstown.ts` is not this item's file. Queued in the handoff.
     */
    enrolledOnPurse: () => ctx.purse.pin !== undefined,
    pending: () => pending,
    setCard: (v: boolean) => { ctx.purse.card = v; panel?.repaint(); },
    /**
     * MUTATION, for `--selftest` only: jam the dispenser. The account has been
     * debited and the notes vanish — the one failure of a cash machine that
     * matters, and the only one every screen of this thing would sail through
     * looking perfectly correct.
     *
     * A destructive hook in shipped code earns its place the same way
     * `__ct.debugSpots` does: the check that guards conservation has to be able
     * to watch itself go red, and there is no way to break conservation from
     * outside a closure that owns the number. Nothing in the world calls it.
     */
    jam: () => { pending = 0; },
  };
}

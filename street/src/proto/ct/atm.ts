import type { CtxBuild } from './ctx';
import { BUILD } from './ctx';
import { makePanel, UI, type Panel, type Purse } from './hud';

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
// NOT AN IMPORT, and that is a finding rather than a shortcut. `ct/bank.ts`
// never names these — they are inline literals inside a closure, not
// module-level constants — so there is nothing today to `export` and
// `import`. Turning them into a shared, named palette means adding an
// export to a file OWNERSHIP.md gives to A, and this row's own brief draws
// the line at reading A's file to source the palette, not editing it — the
// user explicitly wants the cabinets untouched, and OWNERSHIP.md's one
// file/one owner rule does not carve out "just an export" the way it does
// for the desk-owned shared modules. So: reported here rather than forced.
// The fragility that leaves behind is real and has a precedent already on
// record — `ct/vice.ts` declares GOLD/RED for the hotel and `int-hotel.ts`
// duplicates two of the three as literals rather than importing them, and
// the ledger already flags it as agreeing today with nothing keeping it
// agreeing. Recommended follow-up for the desk: ask A to hoist this file's
// own ATM colours into a named, exported `ATM_PALETTE` in `bank.ts`, so this
// block can become an import and stop being a second copy of the truth.
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
const NOTES = [20, 40, 60, 100];

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

function rows(p: Purse): Row[] {
  switch (screen) {
    case 'idle':
      return p.card === false
        ? [{ left: 'NO CARD' }]
        : [{ left: 'INSERT CARD', act: () => { pin = ''; go('pin'); } }];
    case 'pin':
      return [{ right: 'CANCEL', actR: () => go('card') }];
    case 'menu':
      return [
        { left: 'BALANCE', act: () => go('balance') },
        { left: 'WITHDRAW', act: () => go('withdraw') },
        {},
        { right: 'TAKE CARD', actR: () => go('card') },
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
      return [{ left: 'TAKE CARD', act: () => go('thanks') }];
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
const W = 300, H = 214;
const CRT = { x: 34, y: 8, w: 232, h: 162 };
// Pushed DOWN from y 22. At 22 the first menu label printed straight across the
// FIRST FEDERAL rule at the top of the tube — legible in a still, wrong in the
// way a real fascia never is, because on a real machine the top button is below
// the header for exactly this reason.
const BTN_Y = [50, 82, 114, 146], BTN_H = 14, BTN_W = 24;
/** the three horizontal bands every screen lays out on */
const HEAD = 34, BODY = 100, SUB = 122;

function drawScreen(g: CanvasRenderingContext2D): void {
  const p = PURSE!;
  const r = rows(p);

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
    line('ENTER YOUR PIN', HEAD, CAB_TEXT_LIT, 10);
    line(''.padStart(pin.length, '*').padEnd(4, '_').split('').join(' '), BODY, CAB_TEXT_LIT, 18);
    line('THEN PRESS ENTER', SUB, CAB_TEXT_DIM, 7);
  } else if (screen === 'menu') {
    line('SELECT A SERVICE', HEAD, CAB_TEXT_LIT, 10);
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

  // under the CRT: the card slot and the cash mouth, which is where the
  // machine tells you something is physically happening
  const fy = CRT.y + CRT.h + 8;
  g.fillStyle = CAB_SLOT; g.fillRect(40, fy, 92, 12);
  g.fillStyle = CAB_SLOT_DARK; g.fillRect(43, fy + 3, 86, 5);
  g.fillStyle = screen === 'idle' || screen === 'thanks' ? CAB_BODY_LO : CAB_LIT;
  g.fillRect(43, fy + 9, 86, 2);                        // the slot's little lamp
  g.fillStyle = CAB_KEY_LO; g.font = UI.font(6); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('CARD', 86, fy + 20);

  g.fillStyle = CAB_SLOT; g.fillRect(168, fy, 92, 14);
  g.fillStyle = CAB_SLOT_DARK; g.fillRect(171, fy + 3, 86, 8);
  if (screen === 'cash') {                              // notes in the mouth
    g.fillStyle = '#6a8a5a'; g.fillRect(176, fy + 4, 76, 6);
    g.fillStyle = '#7a9a68'; g.fillRect(176, fy + 4, 76, 2);
  }
  g.fillStyle = CAB_KEY_LO; g.fillText('CASH', 214, fy + 20);
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
  if (screen === 'pin') {
    if (/^[0-9]$/.test(k) && pin.length < 4) { pin += k; panel?.repaint(); return; }
    if (k === 'backspace') { pin = pin.slice(0, -1); panel?.repaint(); return; }
    // ANY four digits are accepted, and that is deliberate. It is YOUR card and
    // your PIN; a machine that can reject you turns a piece of texture into a
    // guessing game with nothing on the other side of it.
    if (k === 'enter' && pin.length === 4) { go('menu'); return; }
    return;
  }
  if (screen === 'thanks') { panel?.close(); return; }
  const i = '12345678'.indexOf(k);
  if (i < 0) return;
  const r = rows(p);
  if (i < 4) r[i]?.act?.();
  else r[i - 4]?.actR?.();
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
export function openAtm(): void {
  if (!panel || !PURSE) return;
  clearTimeout(timer);
  screen = 'idle'; pin = ''; pending = 0; message = '';
  panel.open();
}

export function register(ctx: CtxBuild): void {
  PURSE = ctx.purse;
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
    hint: () => (screen === 'pin' ? 'digits, then ENTER' : 'press the numbered buttons'),
    draw: (g) => drawScreen(g),
    key: (k) => onKey(k),
    onClose: () => {
      clearTimeout(timer);
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
    account: () => ctx.purse.account,
    cash: () => ctx.purse.cash,
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

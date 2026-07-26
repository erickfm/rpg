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
      g.fillStyle = UI.caseEdge; g.fillRect(bx, BTN_Y[i], BTN_W, BTN_H);
      g.fillStyle = live ? '#b9b5aa' : UI.caseLo;
      g.fillRect(bx + 1, BTN_Y[i], BTN_W - 2, BTN_H - 2);
      g.fillStyle = live ? '#d6d2c6' : UI.case;
      g.fillRect(bx + 1, BTN_Y[i], BTN_W - 2, 2);
      // the number you actually press, since there is no cursor in this world
      g.fillStyle = live ? '#2a2b2e' : '#7c7970';
      g.font = UI.font(7, true); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(side ? i + 5 : i + 1), bx + BTN_W / 2, BTN_Y[i] + BTN_H / 2);
    }
  }

  // the CRT: amber on near-black, with a bezel of its own and scanlines
  g.fillStyle = '#101114'; g.fillRect(CRT.x - 2, CRT.y - 2, CRT.w + 4, CRT.h + 4);
  g.fillStyle = '#16181c'; g.fillRect(CRT.x, CRT.y, CRT.w, CRT.h);
  g.save();
  g.beginPath(); g.rect(CRT.x, CRT.y, CRT.w, CRT.h); g.clip();
  g.translate(CRT.x, CRT.y);

  const line = (s: string, y: number, c: string = UI.amber, size = 9, align: CanvasTextAlign = 'center') => {
    g.fillStyle = c; g.font = UI.font(size, true); g.textAlign = align; g.textBaseline = 'alphabetic';
    g.fillText(s, align === 'center' ? CRT.w / 2 : align === 'left' ? 6 : CRT.w - 6, y);
  };

  line('FIRST FEDERAL', 14, UI.amberDim, 8);
  g.fillStyle = UI.amberDim; g.fillRect(6, 18, CRT.w - 12, 1);

  if (screen === 'idle') {
    line(p.card === false ? 'NO CARD' : 'WELCOME', BODY, UI.amber, 15);
    line(p.card === false ? 'SEE YOUR BRANCH FOR A NEW ONE' : 'PLEASE INSERT YOUR CARD', SUB, UI.amber, 8);
  } else if (screen === 'pin') {
    line('ENTER YOUR PIN', HEAD, UI.amber, 10);
    line(''.padStart(pin.length, '*').padEnd(4, '_').split('').join(' '), BODY, UI.amber, 18);
    line('THEN PRESS ENTER', SUB, UI.amberDim, 7);
  } else if (screen === 'menu') {
    line('SELECT A SERVICE', HEAD, UI.amber, 10);
  } else if (screen === 'balance') {
    line('AVAILABLE BALANCE', HEAD, UI.amberDim, 8);
    line(money(acct(p)), BODY, UI.amber, 20);
    line(`IN POCKET ${money(p.cash)}`, SUB, UI.amberDim, 7);
  } else if (screen === 'withdraw') {
    line('SELECT AMOUNT', HEAD, UI.amber, 10);
    if (message) line(message, BODY, '#e06a3c', 10);
  } else if (screen === 'wait') {
    line('PLEASE WAIT', BODY, UI.amber, 15);
    line('COUNTING NOTES', SUB, UI.amberDim, 8);
  } else if (screen === 'cash') {
    line('CASH READY', HEAD, UI.amber, 10);
    line(money(pending), BODY, UI.amber, 20);
    line('TAKE IT FROM THE MOUTH BELOW', SUB, UI.amberDim, 7);
  } else if (screen === 'receipt') {
    line(message || '', HEAD, UI.amber, 10);
    line('DO YOU WANT A RECEIPT?', BODY, UI.amber, 11);
    if (message === 'NO PAPER') line('NO PAPER IN THIS MACHINE', SUB, '#e06a3c', 8);
  } else if (screen === 'card') {
    line('TAKE YOUR CARD', BODY, UI.amber, 15);
  } else if (screen === 'thanks') {
    line('THANK YOU', BODY, UI.amber, 16);
    line('FIRST FEDERAL SAVINGS', SUB, UI.amberDim, 8);
  }

  // the menu items, lined up against the buttons — the whole point of the
  // layout, and the reason the labels are drawn at the buttons' own y
  const r2 = rows(p);
  for (let i = 0; i < 4; i++) {
    const y = BTN_Y[i] + BTN_H / 2 + 3 - CRT.y;
    if (r2[i]?.left) line(`◀ ${r2[i].left}`, y, UI.amber, 9, 'left');
    if (r2[i]?.right) line(`${r2[i].right} ▶`, y, UI.amber, 9, 'right');
  }

  // scanlines last, over everything, so the text sits IN the tube
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < CRT.h; y += 3) g.fillRect(0, y, CRT.w, 1);
  g.restore();

  // under the CRT: the card slot and the cash mouth, which is where the
  // machine tells you something is physically happening
  const fy = CRT.y + CRT.h + 8;
  g.fillStyle = UI.caseLo; g.fillRect(40, fy, 92, 12);
  g.fillStyle = '#26282c'; g.fillRect(43, fy + 3, 86, 5);
  g.fillStyle = screen === 'idle' || screen === 'thanks' ? '#4a4842' : '#6ad07a';
  g.fillRect(43, fy + 9, 86, 2);                        // the slot's little lamp
  g.fillStyle = UI.dim; g.font = UI.font(6); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('CARD', 86, fy + 20);

  g.fillStyle = UI.caseLo; g.fillRect(168, fy, 92, 14);
  g.fillStyle = '#1a1b1d'; g.fillRect(171, fy + 3, 86, 8);
  if (screen === 'cash') {                              // notes in the mouth
    g.fillStyle = '#6a8a5a'; g.fillRect(176, fy + 4, 76, 6);
    g.fillStyle = '#7a9a68'; g.fillRect(176, fy + 4, 76, 2);
  }
  g.fillStyle = UI.dim; g.fillText('CASH', 214, fy + 20);
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
    id: 'ct-atm', w: W, h: H, scale: 2, chrome: 'machine',
    title: 'FIRST FEDERAL SAVINGS',
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

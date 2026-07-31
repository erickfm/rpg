# The panel framework — one cabinet, three machines

**L: this is callable now.** `makePanel` and `UI` are exported from
`src/proto/ct/hud.ts` on `feat/inv`. Build the slots' maths and its reels; do
not build a window, a bezel, an open/close, an input freeze or an exit — you get
all five from here, identical to the ATM's and the pockets'.

Three full-screen interfaces are in flight at once — the slots (L), the ATM (K)
and the pockets (K). Three panels built three times is three different-looking
UIs in one small hand-made world, and this user reads a screenshot faster than
we can explain one.

---

## Call it

```ts
import { makePanel, UI } from './hud';

const slots = makePanel({
  id: 'ct-slots',                // also what __hud.panel() reports
  w: 320, h: 220,                // the SCREEN. The cabinet is added around it.
  chrome: 'machine',             // moulded plastic | 'cloth' for a held thing
  title: 'LUCKY SEVENS',         // stamped into the bezel
  hint: () => 'SPACE  spin   ·   1-3  hold',
  draw: (g, w, h) => { /* your screen, origin at its top left */ },
  key: (k) => { /* 'a', ' ', '1', 'enter'… already lower-cased */ },
  wheel: (dir) => { /* +1 forward, −1 back */ },
  onOpen: () => {}, onClose: () => {},
});

slots.open();      // .close() .toggle() .isOpen() .repaint()
```

`repaint()` is the one you will call most: change your own state, then ask for a
redraw. The framework never redraws on its own, because a panel that repaints on
a timer is a panel that flickers.

## What you get, and what you must not re-do

- **One cabinet at a time.** Opening any panel closes every other, *and* puts
  away the wallet and the pockets. Do not write your own exclusion.
- **The world is frozen behind it.** No walking, looking, interacting or
  opening anything else. A key the player was already **holding** is released,
  not merely blocked — otherwise stepping up to your machine mid-stride leaves
  them walking on the spot behind it.
- **ESC always closes**, from every panel, without you writing a line. Do not
  add your own quit key and do not swallow ESC.
- **One bezel, one typeface, one palette.** `UI` has the case greys, the two
  screen phosphors (amber and green), the ink colours and `UI.font(px, bold)`.
  **Use them rather than picking your own** — that is the entire point.

## Two things worth knowing before you start

**DIGITS WORK INSIDE A PANEL.** They work nowhere else in this world:
`src/main.ts` spends every digit switching prototypes, so `1` normally reloads
the world. The gate takes keydown before main.ts's listener sees it, so a panel
genuinely owns the keyboard while it is up. The ATM's PIN pad exists only
because of this. Your hold buttons can be `1 2 3`.

**Your screen area is yours and the framework never draws in it.** The ATM puts
its eight physical buttons *inside* its screen rect rather than on the bezel,
precisely so the bezel can stay the shared one — a cabinet with eight buttons
moulded into it would be an ATM-shaped cabinet, and you would not want it.

## The layout it builds

```
┌──────────────────────────┐  ← case, screws at the corners
│        TITLE             │  ← stamped, 14 px band (omit `title` to drop it)
│  ┌────────────────────┐  │  ← the recess: this is what makes it set IN
│  │                    │  │
│  │   YOUR draw()      │  │     w × h, origin top-left, clipped
│  │                    │  │
│  └────────────────────┘  │
│  hint()             ESC  │  ← caption strip, 18 px
└──────────────────────────┘
```

`scale` (default 2) is css pixels per canvas pixel. Author at 1 px = 1 texel and
leave it alone unless the art needs otherwise.

## One bug it has already had, so you do not re-find it

The first version installed **two** capture listeners — a generic input blocker
for the freeze, and the gate that dispatches your keys. Capture listeners on the
same target fire in **registration order**, so the blocker ran first and
`stopImmediatePropagation()`'d the gate out of existence. The ATM opened, drew
perfectly, and answered no key at all *including ESC*: a cabinet you could not
use and could not leave.

The gate is now the only listener and it swallows exactly what the blocker did.
Worth knowing because it is the failure mode of anything you add to `window` in
capture — **if you find yourself adding a listener alongside the framework's,
you are probably fighting it.**

## What I still owe

- the **pockets** raised onto this (they are currently their own held canvas
  with their own key handling — same idiom, older plumbing)
- `ct/atm.ts` needs one line from **A** in `ct/bank.ts` to be reachable from the
  world; see `notes/K-atm.md`

**STATION:** `window.__hud.panel()` names the cabinet that is up.
`window.__atm.open()` opens the ATM from anywhere — press `1`, four digits,
ENTER — and it is the working example to read.

— K

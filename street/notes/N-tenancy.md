# N — rent, the mailboxes, the letters and the landlord

> *"rent that must be paid to a landlord, and letters waiting at the mailboxes
> when he comes in off the street"* — and, in the same stretch, *"numbered to
> match the doors upstairs"*.

One new file, `src/proto/ct/tenancy.ts`. Nothing in `ct/apartment.ts` (C's) or
`ct/inventory.ts` / `ct/hud.ts` (K's) is edited. Guarded by
`scripts/N-post-waiting.mjs`, registered in `scripts/checks.mjs`.

**Where to stand to see it:** warp to `__rent.box().stand` — the position the
world publishes, `gy` included. The `[E]` reads *"open your mailbox — 3
letters"* the moment you are there, and the post is sticking out of 301's box on
the middle row of C's bank, third from the door.

> **CORRECTED 2026-07-26.** This said *"come in the front door of No. 227 … before
> you have taken a step"*, and that is true of a **warp** and false of a **walk**.
> Walking in through the door leaves you inside `crosstown.ts:932`'s landing
> latch — 1.2 m — and the bank of boxes is 1.03 m from where the door puts you,
> so **neither the prompt nor the key works until you have moved 1.2 m away and
> come back.** The spot is live throughout; the interaction is what is held off.
> Finding, the exact line and a held-back guard: `notes/N-mail-on-entry-BLOCKED.md`.
>
> I found it by re-measuring my own claims with an empty queue, which is the only
> instrument that finds this class (GOTCHAS §44). It had been wrong here and in
> the ledger for four hours, and the verifier who confirmed the row read it
> correctly from the published position — a warp — so nothing contradicted it.

---

## What is in the world

| | |
|---|---|
| **301's mailbox** | a bottom-hinged brass door proud of C's painted face, with a pull rail, hinge knuckles, a keyhole in an escutcheon and a name card behind glass |
| **The post** | envelopes riding out of the slot above the door when there is any — up to three, which is the cap, because beyond that they read as a white block |
| **Eight number plates** | 101/201/301/401 and 102/202/302/402, a column per floor reading away from the street door. The top row is bare: four boxes that have never been let |
| **The letters** | a sheet in K's shared `chrome: 'cloth'` panel — same bezel, caption strip and frozen world as the ATM and the slots. Fourteen kinds of 1997 junk, a rent notice two days before each rent day, a second notice every third day it goes unpaid. Wheel turns the page, ESC puts it away |
| **The landlord** | V. OKONKWO, in the hall between the front door and the stairs, on days you owe him, 07:00–22:00. Atlas sprite, eight angles, grey overcoat |
| **Paying** | `[E]` on him. Enough and he writes a receipt; short and he tears you a note of account. Either way you get paper |
| **Being late** | a slip pushed under 301's door, on your own boards, visible from where C wakes you. The morning AFTER the rent day, not on it |

## The lease

`RENT` in `ct/tenancy.ts` is the single place any of it is stated. **$45 a week,
first due on day 2, weekly after that, notice two days ahead.**

Day 2 rather than day 7 is deliberate: the game opens at 13:20 on day 0, so a
clean weekly cycle would put the first demand two and a half real hours away and
nobody would ever meet the landlord. Day 2 says you moved in most of a week ago,
which is also why there is a notice in the box the first time you walk in.

$45 is set against the economy that exists, not against 1997: a realistic $325 a
month would be a debt you could never clear.

## The clock rule, which is the whole design

**Nothing here accumulates.** Every quantity is a pure function of
`ctx.clock.now().totalMin`:

    what day is it       floor(totalMin / 1440)
    what is in the box   mailFor(day), for every day since you last emptied it
    what do you owe      the rent days that have passed, less what you paid

A per-frame `if (hour === 11) deliverTheMail()` would drop a day every time the
player slept — and sleeping runs to 07:00 through a ramp that crosses eleven
o'clock in a frame or two, **every single night**. Deriving makes sleeping
through a week and walking through a week the same code path, and it is the only
version a probe can test by snapping the clock.

`N-post-waiting` snaps four days forward without going near the box and requires
the mail of every delivery day in between, from four distinct days.

## THE DECISIONS YOU ASKED TO SEE FIRST

The queue said *"decide and tell me before you build it: how often, how much,
what happens when it is late, and whether the landlord ever appears."* Your
steer arrived in the same file — *"keep it small, keep it regular, make being
late feel like a consequence rather than a game-over"* — and every one of these
follows it. Built, because the queue file reached me after the work; **all four
are one constant each and cheap to overrule.**

| | | why |
|---|---|---|
| **how often** | weekly | first due **day 2**, not day 7. The game opens 13:20 on day 0, so a clean weekly cycle puts the first demand two and a half real hours away and nobody ever meets the landlord. Day 2 says you moved in most of a week ago |
| **how much** | **$45** | set against the economy that EXISTS, not against 1997. You start with $14.50 and cereal is $2.50; a realistic $325 a month is a debt you could never clear |
| **when it is late** | a second notice in the box every third day, **and a slip under your door every morning**. No lockout, nothing seized | your steer, verbatim |
| **does he appear** | **yes** — in the hall, on days you owe, 07:00–22:00 | his own notice says *"I collect in person"*. He is not there when you are square, and not at four in the morning |

## What I would not trust yet

**The check's `--selftest` caught NEITHER of its two mutations on the first
run**, and finding that is most of what writing it bought:

- `__rent.box()` reported `door.position` — the local position inside the group
  the mutation was dragging — so a box moved three metres reported as unmoved.
  It reports the world position now
- the walk set out **0.90 m from a spot with a 0.95 m radius**: already inside,
  arrived on its first sample, and passed **without the player moving at all**,
  so a wall across the lobby changed nothing

Both are GOTCHAS §27 exactly. If you add a clause here, break it on purpose
before you believe it.

## Open, and not mine to close

**No consequence for not paying.** The notices escalate and the man keeps
appearing, and that is all. The obvious next step is that he stands at the foot
of the stairs and will not let you up — legible, recoverable, no eviction. I
have not built it because until very recently there was **no income in this
world at all** (`ct/atm.ts` has since landed and is the only thing that adds to
`purse.cash`). Blocking the stairs over a debt a player has no way to clear is a
dead end, so this wants a desk ruling on the economy first, not a builder
deciding it.

**Two copies I would rather not hold** — `notes/N-asks.md` has both, and neither
blocks me. (The two asks I had filed with K are WITHDRAWN: `makePanel` landed and
answered both properly.)

- C's bank-of-boxes geometry (seven numbers, expressed off C's exported
  `APT_X0`/`APT_Z0`, and `findBank()` snaps to the real mesh and warns if it has
  moved — so this fails loudly, it does not fail silently)
- C's 3×5 numeral bitmap, copied glyph for glyph, because *"numbered to match
  the doors upstairs"* means the same font and that table is private to
  `ct/apartment.ts`

**I built my own panel before reading my queue**, which said to use K's. K's is
better and moving onto it deleted the DOM element, the transforms, the ESC
handler, the wheel listener and two painted thumbs — and bought a thing I had
not built and had not noticed was missing: the world FREEZES behind it. Reading
your post while the street walked on behind you was wrong.

## Two things worth stealing

**A plate is not a texel density, it is a glyph.** Matching C's door numbers at
C's ~30 px/m put `301` at 0.44 m wide — wider than the 0.28 m mailbox door. What
had to be matched was the five-texel glyph; the density followed from making it
fit. GOTCHAS §4 is a floor, not a ceiling.

**Look at it from where a player stands, early.** Five of the faults on this
feature were invisible in the source and obvious in one frame: post lying flat
so every envelope was a white line, the box at eye level, the fold crease
striking through the body text, a notice reading "PAID IN FULL" two days before
any money was due, and a number plate so much brighter than the bank that it
pulled the eye off the one box with post in it — which is the exact mistake C
had already written down and fixed on the flat doors.

Shots: `shots/N/`.

— N

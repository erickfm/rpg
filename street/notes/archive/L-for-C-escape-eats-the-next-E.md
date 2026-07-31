# L → C (and K): pressing ESCAPE to leave a seat eats the NEXT [E] press

**Reproducible, player-visible, and not in a file of mine.** The slots are only
the vehicle — this is the one panel in the world you enter by SITTING, so it is
the only place Escape has to both close a panel and leave a seat.

```
sit at a slot machine  ->  press ESCAPE  ->  walk away  ->  come back
press E                ->  NOTHING HAPPENS
press E again          ->  you sit down
```

## How it surfaced, and why it did not look like this

N's `notes/N-verify-K-slot-modal-trap.md` closed the seat-trap row correctly and
recorded one thing it did not chase:

> *"3 of the 8 stools never seated me at all… much more likely my harness than
> the world… If somebody does, it is stools 19, 47 and 79 by index."*

**It is not three bad stools.** Sweeping all 96 gives **48 of 96, alternating** —
every second sit. The three N named are simply the ones that fell on an even
count in an eight-stool sample. Each of them, visited first from a clean page,
seats you perfectly:

```
stool #47 alone:  landed at (685.00, 7.43), prompt "[E] sit at the slot"
                  after E -> seated: true, panel: ct-slots
stool #47 after #19:  same position, same prompt, after E -> seated: FALSE
```

N was right to suspect the harness and right not to file it. The harness was
wrong in two ways I had to fix before the real fault was visible — a prompt read
before the frame caught up with the warp, and a reset that pressed E "belt and
braces", which is ambiguous (E stands you when seated and SITS you when
standing). Neither of those was the fault. The fault survived both.

## Narrowed to ESCAPE, each step by a control

| | |
|---|---|
| bench, then bench | **8/8 sit** — no panel involved, fine |
| pockets panel (`I`), then a bench | **sits** — a panel alone does not do it |
| slot, then a BENCH | **swallowed** — not about the stool, or the casino |
| slot, closed by `__hud.closePanels()` | **sits** |
| slot, closed by **ESCAPE** | **swallowed** |
| …and walking 1.5 s in between | **still swallowed** |

The last two rows are the finding. **`closePanels()` and Escape leave the
identical end state** — `seated:false, panel:null` in both — and only the Escape
path breaks the next E. Walking does not clear it, so it is not a stale trigger
volume or a landing latch (`__ct.landing()` reads `null` throughout).

## Three more discriminators, added after the first pass

**It is E-SPECIFICALLY, not "the first keydown after Escape".** Holding `w` in
between moves the player 0.38 m — input reaches the world perfectly — and the
following E is *still* swallowed. So the gate is gone and the freeze has lifted;
it is the `[E]` dispatch alone that misses.

**It is not `DISMISS_LOCKOUT`.** `ct/hud.ts:500` refuses to re-open a panel
within 500 ms of a dismissal, which was my first suspect and is the right shape.
It is not this: waiting **1.2 s** after Escape, and separately walking for 1.5 s,
both still swallow the next E. It also would not explain the SEAT failing — the
lockout gates `panel.open()`, and what actually fails is `rig.sit()`.

**The world is entirely healthy at the moment of the failing press**, which is
what makes this an input-layer fault rather than a world one. Measured at the
stool immediately before pressing:

```
2nd: before E   seated=false  panel=null  landing=null   "[E] sit at the slot"
    spots within 1 m:  0m ok=true · 0.34m ok=true · 0.64m ok=true · 0.72m ok=true
2nd: after E    seated=false  panel=null  landing=null   "[E] sit at the slot"
    …identical. Nothing moved.
```

The spot is live, selected and prompting; there is no landing latch; the player
is standing in the right place. The key simply does not arrive at the dispatch.

**Exactly ONE press is lost** — the one after it always works. That is the
signature of an edge-trigger that has missed its edge: `crosstown.ts:984` fires
on `feedDown && !feedHeld`, and `:1015` sets `feedHeld = feedDown` each frame.

**I have deliberately stopped there.** I can see the shape but I have not traced
which side leaves `input.keys` or `feedHeld` in that state, and guessing inside
`main.ts`, `crosstown.ts` and `ct/hud.ts` — three files, none of them mine — is
how a confident wrong answer gets written down. The controls above should point
at it quickly for whoever owns that path.

## Why I think it is yours rather than K's, and how sure I am

`f110b7f5a` — *"ESCAPE HATCH FIRST: force-stand from any seated state, at the
lowest level"* — is the commit that made Escape leave a seat, and the fault is
Escape-specific. That is the whole of my reasoning and it is circumstantial:
**I have not read the input plumbing and I am not going to guess at the
mechanism.** The two-way discriminator above is the useful thing; it should
localise it in minutes for whoever owns that code.

K is cc'd because the panel gate at `ct/hud.ts:299` handles Escape upstream of
`input.keys`, and N's note already established that the gate blocks `keydown`
while a panel is open but deliberately not `keyup`. Whatever the answer is, it
is somewhere across those two.

**What I am NOT claiming:** that the escape hatch is wrong. It closed a real
trap — N verified 0 of 8 stools stuck, where the row said reloading was the only
exit — and that is a much bigger win than this is a loss. This is a rough edge on
a good fix.

## How to know it is fixed

```
SHOT_URL=http://localhost:<yours>/ node scripts/L-every-stool-seats-you.mjs twice
```

Two warps, about ten seconds: sit at a stool, Escape, sit at the same stool
again. It must seat on ONE press both times. `… all` sweeps all 96 for the
population number if you want it.

It is **red on the board right now**, deliberately — the runner's own line is
*"Something above is red. It is not gating the build; it is telling you."* I
would rather it say so than sit unregistered until somebody remembers.

## Why it matters more than the press count suggests

The user got stuck in a seat tonight and the desk treated it as urgent. This is
the same family: a player sits at a machine, gets nothing, and has no way to
know the fix is "press it again". They conclude the machine is broken — and it
is the entry point to the only two games on that floor.

---

*L. `ct/slots.ts`, `ct/blackjack.ts`. I have touched neither `crosstown.ts`,
`fp.ts` nor `ct/hud.ts`.*

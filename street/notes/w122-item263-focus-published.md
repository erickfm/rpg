# w122 — item 263: `__ct.focus()`, and the end of the 109/115/89 number

**Commits `d785d9b4a`** (`src/proto/crosstown.ts`, the accessor) **and
`4a0cc6bda`** (`scripts/seats-walk.mjs`, the two notes). Probe:
`scripts/probes/w122-item263-focus-shape.mjs`. Port **4181**, built bundle.

## Root cause, one line

`focus` was a **closure local** in `crosstown.ts` with no accessor, so no
harness could tell a **machine station** — a stool that seats you and hands the
machine its screen — from an **ordinary chair**. `seats-walk.mjs` models a chair
in all five of its legs, so every machine seat in `__ct.seats()` failed at
whichever leg it reached first, and no fix inside that file could do more than
move the count from one leg to another. It did exactly that: **83 identical
0.350 m "seated eye" errors became 89 identical "no stand up" errors** when item
255 fixed the eye read.

## What the world actually does, measured through the new accessor

`probes/w122-item263-focus-shape.mjs`, one slot stool:

```
just sat   camY 1.152  focus {t:0.6405, settled:false, fromChair:true, mesh:"ct-slots-screen"}
+900 ms    camY 1.050  settled:true t:1   its own target 1.050   err 0.000
seated prompt: null                    <- the screen has the camera
after ESC  focus null, STILL SEATED, camY back to 1.395
           prompt "[E] play the slot machine   ·   [ESC] stand up"
after ESC  stood up
```

An ordinary chair (`"sit down"`) reports `focus: null` and holds its height for
the full window. **So a machine seat is not missing its way out — its way out is
Escape, and the world says so in the prompt as soon as the screen closes.**

## THE REAL FIGURE: 189 of 219 pass, 30 fail

Full run, built bundle, **~15 min** (15:15 → 15:30:50):

| count | kind |
|---|---|
| 17 | `[E]` seated you on a **different** seat |
| 8 | another `[E]` spot answered instead of the seat |
| **4** | **`"sit at the blackjack table"` — seated, NO screen focus, and no prompt offering a way up** |
| 1 | no `[E]` prompt at all from the standable point |

**All 87 slot stools pass**, and they pass *more* than a chair does: the fly-in
must settle, the eye must land on the world's own published target, Escape must
return the chair, and a second Escape must return the floor.

The history of this number: **109** (before item 255) → **115, of which 89 were
one modelling gap** (after it) → **30**. ninetysix's estimate of "26 worth
acting on" was right to within the 4 blackjack seats it had grouped with the 89.

## The blackjack seats are a REAL defect, and now visible

They are the only seats in the world that seat you, register **no focus at all**,
and show **no prompt**. Escape does get you up, so it is not a trap — but nothing
tells the player that, and `[E]` offers nothing. This is not the machine-seat
class; it is four seats that behave like neither a chair nor a machine. Worth a
row.

## The selftest could not certify anything, and now can

Two faults, both found while adding to it:

1. It buried a seat and required **THE RUN** to go red. This check is
   legitimately red on this world, so that was already true before the mutation
   — GOTCHAS 34, a check that cannot fail. It asserts **the buried seat's own
   verdict** now.
2. It exited **1 when it CAUGHT**, where `masonry.mjs` and `check-artifact.mjs`
   exit 0. `checks.mjs --selftest` therefore scored the `seats-walk` row FAILED
   whether the mutation was caught or slept through — the row could not go
   green. Inverted to match.

Watched: `selftest: caught it — "sit on the bed and watch TV" came back
"UNREACHABLE — no standable point within its 0.7 m trigger"`, **exit 0**.

## On the coordinator's new §10a — cheap tests, not failure-prone ones

- **Nothing new and expensive was built.** `seats-walk` already existed and was
  already registered slow-tier; my change cost it roughly **one minute** of its
  ~15 (two Escapes and a settle wait on 87 stools) and removed 89 false reds.
- **The new legs are `__ct` reads, not timing or pixels** — `focus()`,
  `seated()`, the prompt element. The one wait is
  `waitForFunction(() => focus().settled)`, which waits on a **world state
  flag** rather than sleeping, which is the shape §10a asks for and the
  opposite of the fixed 800 ms sleep that caused this whole number.
- **The honest gap, stated rather than papered over:** *the new machine-seat legs
  have no negative case of their own.* The natural one is a `canfail` source
  mutation (drop the chair restore at `crosstown.ts:1428` and closing a screen
  stands you up) — but **canfail cannot certify a check that is legitimately
  red**: its pre-pass scores it `PRE-RED` and refuses to score the case. So the
  four legs are unmutated. I have left them unchecked and said so rather than
  registering a case that would report `PRE-RED` for ever. It becomes possible
  the day the 30 real failures are down to zero.

## Derive vs copy

Nothing copied. The accessor reads the world's own `focus` object; the harness
reads the accessor; the eye target compared against is the world's own published
number rather than a restatement of it.

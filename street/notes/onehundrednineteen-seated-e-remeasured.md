# Item 290 — item 188's contract, re-measured through the REAL `[E]` dispatch

Worker onehundrednineteen, 2026-08-03. Port **4750**, built bundle.
Added: `scripts/probes/w119-290-seated-e-really.mjs`. **No world code changed.**

**Wrapped early at the desk's instruction** — the user has been waiting on this
wave. Step (1) is done and is the valuable half; **step (2), the contrast and
lamp-brightness ceilings, is NOT done and should be re-queued.** Declared, not
hidden.

---

## The row's finding is correct: item 188's number never measured its mechanism

`w69-seated-offers.mjs` seats through `__ct.sit()` and then **reads the prompt
text and presses Escape**. It never presses `[E]` while seated. So *"29 seats
released by `[E]`, 0 trapped"* was a statement about strings, not about the key.
The proof it was blind: item 283 (a latch armed by sitting could never
discharge — `canSee` false for every spot until you stood) was fixed and item
188's figures **did not move by one seat**.

## What the key actually does, pressed 219 times

`scripts/probes/w119-290-seated-e-really.mjs` — sits by identity in the page,
waits for the world to publish a prompt, then **holds `e`** (§5: the dispatch is
an edge read once per rendered frame).

| | run 1 | run 2 |
|---|---|---|
| **TRAPPED (seated, no panel, no way named)** | **0** | **0** |
| RELEASED (stood up) | 127 | 132 |
| OPENED a panel | 40 | 37 |
| `[E]` did nothing | 8 | 6 |
| never offered a prompt | 44 | 44 |
| would not seat | 0 | 0 |
| console/page errors | 0 | 0 |

**Read the first row and treat the rest as soft.** `TRAPPED = 0` is stable across
runs and is the thing item 188's contract is actually for — *"i cant get up,
ANYTHING i do, once i sit down"*. **The split between RELEASED / OPENED / NOTHING
is not stable** (127↔132, 40↔37, 8↔6) because it depends on which frame the
press lands in relative to the seated poll, and this machine has several
browsers on it. **Do not quote those three as a contract.** That instability is
itself the finding: they are exactly the "failure prone" shape BUILDER-BRIEF
§10a says not to enshrine.

**And the honest headline against item 188: 127–132 seats release on `[E]`, not
29.** The old figure counted prompts that *said* "stand up"; the world releases
four times that many.

### One number I could not resolve, and it is the next question

**44 of 219 seats never publish a prompt at all within 4 s of sitting.** They are
not trapped — Escape frees them — but a seated player looking at nothing is told
nothing. I did not chase whether that is correct-by-design (a seat with nothing
in reach) or the tail of item 283. `w69-what-a-seat-can-reach.mjs` measured *"6
of 219 seats have anything inside arm's reach at any heading"*, which does not
obviously square with 175 seats producing a prompt — **worth a row.**

### A probe artifact I caught, worth recording

The first cut pressed 110 ms after sitting and reported **89 seats where `[E]`
did nothing** — every one a slot stool whose prompt read `null` at the moment of
the press and `[E] play the slot machine` immediately after. **That was my
timing, not the world's** (GOTCHAS 30). Waiting for the prompt took it from 89 to
8. Had I shipped the first number it would have read as a large real defect.

## What I did NOT do

- **No standing check added.** Per §10a and the desk's explicit instruction, this
  is a measurement taken once, living in `probes/`. The stable thing worth
  asserting later is `TRAPPED === 0`; the rest would cry wolf.
- **Step (2) — the CONTRAST and LAMP-BRIGHTNESS ceilings from item 288 — is not
  started.** Both overshoot in ways the user has complained about in his own
  words (a too-bright church, a too-dark hotel ceiling), so a floor alone cannot
  catch what he notices. **Re-queue it.**
- The `takenSeats()` hook was already cut from the row and step (1) did not need
  it.

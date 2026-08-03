# Item 188 — a seat can carry an interaction now

Worker sixtynine. Ports **4250** (built bundle, `vite preview`) and **4251**
(dev, for the one probe that dynamically imports `src/proto/fp.ts`). Both proved
free with `ss -ltn` before binding, both bound `--strictPort`.

> *"you sit and its the loan process as an integrated overlay"* ·
> *"like the atm too. intergrated overlay. realistic setup"*

---

## THE ITEM'S STATED CAUSE WAS STALE, AND THE REAL ONE IS SMALLER

The row quotes `ct/int-bank.ts:1414`:

> *"the stand-up spot is registered at the seat itself, so while you are seated
> it is at d 0 and NOTHING else can ever win"*

and names `fp.ts`'s `offAxis + d * 0.02` as the mechanism. **That was true when
it was written and it is not true now.** The exit stopped being a spot when it
became a state exit — `crosstown.ts`'s `ctx.seat` says so in its own comment:
*"the exit is now a STATE EXIT handled in the dispatch below: while seated, E
stands, full stop — no selection, no proximity, no aim cone."*

So nothing was out-scoring anything. **The whole engine limit was one
unconditional `if` in `crosstown.ts`**: the dispatch computed `picked` every
frame and then, while seated, threw it away.

```
if (rig.seated) { rig.stand(); }        // before — E is spent, whatever you aim at
else if (active) { … }
```

The desk's instinct was right about *where the user was blocked* and wrong about
*what was blocking him*, which is BUILDER-BRIEF §6a's whole point. Nobody had to
touch the scoring key.

---

## What changed — two files, and the second one is three lines

**`src/proto/fp.ts` — `pickSpot` gains `opts?: { seated?: boolean }`.**

Seated is a different body, so it gets a different rule, and both halves of it
are *removals*:

- **The aim-free proximity tiers are off.** `near = touching` exists so *"a door
  you are standing at opens without looking at it"* — that is about your FEET,
  and a seated player's feet are not going anywhere. It is also exactly what
  made the seated case useless: the thing nearest a sitting man is the chair he
  is in.
- **Reach shrinks from the room to arm's length.** Standing, `looked` runs to
  the caller's 6 m because pointing across a room at a door is a feature asked
  for by name; from a chair it is a bug, because you cannot cross the room
  without getting up. The bound is `s.r + REACH_MARGIN` — **not a new
  constant.** It is the one this file's own comment has always said that margin
  means (*"how far outside its radius a spot can be selected when you ARE
  looking at it"*), applied in the one case where it is the right question.

**With `opts` absent the function is unchanged** — `near = touching`, `looked`
unchanged — so no standing selection moves by a float. That is why the
doorway-turn number could not regress, and it did not (below).

**`src/proto/crosstown.ts`** — the dispatch consults the pick while seated,
passes `{ seated: true }`, and joins the exit to the prompt rather than
replacing it. Plus `__ct.sit`, a test affordance (see below).

---

## §11: THE WAY OUT IS NEVER TAKEN AWAY, AND IT IS NEVER OFF THE SCREEN

The old code's reason for making the seated prompt the exit still holds — *"the
label must not be able to disappear while the key that works is still E. A state
with an invisible exit reads as being stuck."* So the exit is **joined**, not
replaced:

```
[E] read the loan application   ·   [ESC] stand up
```

Three independent ways out, and the change can only add options, never remove
one:

1. **`[ESC]` stands you up unconditionally**, from two listeners in `fp.ts` —
   `update()`'s seated branch and the capture-phase `keydown` above it — neither
   of which this dispatch can reach.
2. **Look away and `[E]` is the exit again.** Yaw is unclamped while seated
   (`fp.ts:474-495` returns before the movement code but after the look block),
   so the head turns 360°.
3. The seated pick needs **real aim inside arm's length**, which is empty almost
   everywhere — measured below.

---

## The numbers

| | |
|---|---|
| `scripts/probes/w69-seated-offers.mjs` | **219/219 seats, head straight: still `[E] stand up` and nothing else. 0 seats lost their prompt.** This is the regression answer and it is the whole population, not a sample |
| `scripts/probes/w69-what-a-seat-can-reach.mjs` | **6 of 219 seats have anything inside arm's reach at any heading** — see the list below |
| `scripts/probes/w69-seated-loan.mjs` | the user's own case end to end: sits, head straight offers the exit, turn to the form and `[E]` names it with `[ESC]` still shown, `[E]` opens it **on the paper** (`canvasHidden: true`, fov 45, eye 1.354), **one** ESC closes it and leaves the chair. 0 console errors |
| `scripts/probes/w54-turn-stability.mjs` | **mean 3.26 changes per turn, worst cell 6, 19 cells** — identical to what `notes/archive/w54-doorway-turn.md:59` records for mainline. See the correction below |
| `scripts/K-no-panel-traps.mjs` | **all good** — 5 of 7 panels opened, each froze the world, closed on ESCAPE and gave the feet back; slots and blackjack did not open and are skipped, not failed |
| `scripts/seats-walk.mjs` | before **112/219**, after **112/219** — same 107 inherited FAILs, same classes (see the inherited-reds table) |
| `npx tsc --noEmit` | clean |

### CORRECTION: the "3.26 → 1.42" the item tells you not to regress is NOT LANDED

The row says *"the doorway-turn work is scored in prompt changes per 360°
(3.26 → 1.42) and you must not regress it."* Read the note it comes from:
**1.42 is a CANDIDATE held at `notes/w54-item140-candidate.patch`**, never
applied — `notes/archive/w54-doorway-turn.md:124` *"The candidate fix, held at
…"*, with *"To land it: `git apply …`"* at line 180. Mainline is 3.26 and has
been all along.

So the right reading of the bar is *"3.26 must not get worse"*, and it did not:
my run reads **3.26 mean, worst cell 6, 14 of 19 cells unstable** — the same
three figures the note records. It could not have moved: with `opts` absent the
standing path is the same expressions.

### The six seats that gained a verb, and why each is right

```
sit on the bed and watch TV  ->  sleep until morning        (1.06 m)
sit at the stop              ->  take the folded newspaper  (0.65 m)
sit at the stop              ->  take the folded newspaper  (0.25 m)
sit in the client chair      ->  read the loan application  (0.95 m)   <- the ask
sit down (diner)             ->  order fries — $0.99        (1.16 m)
sit down (diner)             ->  order fries — $0.99        (0.74 m)
```

Sleeping from the bed you are sitting on, taking the paper off the bench beside
you, ordering from a diner seat, and the loan. **None of them is a thing you
would have to stand up to do in life, which is the test the rule is supposed to
encode**, and the other 213 seats are untouched at every heading because there
is nothing registered within `r + REACH_MARGIN` of them.

The bank case is the tight one and it clears with room: chair (444.40, 2.62),
form (443.75, 1.93), **0.952 m against the form's own 0.70 + 0.60 = 1.30**. The
loan officer, r 1.0 at 1.67 m from the chair, does **not** clear his own 1.60 —
so the client chair reaches the paperwork and not the man behind the desk, which
is also the right answer. Both derived from `__ct.seats()`/`__ct.spots()` at
runtime; no coordinate is retyped in any probe (BUILDER-BRIEF §8).

---

## `__ct.sit` — the missing half of a published affordance

`__ct.stand()` has been published since the seat mechanic shipped; there was no
`sit`. So the only way onto a seat from a script was to walk up and press E,
about ten minutes for all 219 — which is why **nothing had ever asked the whole
population what a seated `[E]` offers**, and why an engine limit that blocked a
repeated user request could sit in a comment for days. It goes through
`rig.sit`, so it inherits the guard that a seated player cannot hop seats.

---

## WHAT I DID NOT DO, precisely enough to queue

**1. The library terminal still cannot be reached with `[E]`, and it is not an
engine problem any more.** The item asks to *"sit at the library PC, reach the
PC"*. Measured: the two `sit at the computer` seats at (1082.60, 4.00) and
(1082.60, 5.05) have **NOTHING registered within reach at any heading** — the
only spot near either is its own sit spot, which `ctx.seat` kills while you are
seated. `ct/library-pc.ts` **registers no `ctx.spot` at all**; it opens the
panel from a per-frame hook that watches `seatedAtComputer()`
(`ct/library-pc.ts:831-841`), which is the polling workaround worker sixtysix
declined to copy.

The engine now supports the diegetic version, and the fix is one `ctx.spot` on
the CRT in `ct/library-pc.ts` plus deleting that hook. **I did not do it:
`ct/library-pc.ts` is not named by item 188, and it is the file GOTCHAS 82
records two builders colliding in over item 157.** One row, one file, and the
capability it needs is landed.

Same for `ct/slots.ts`, which polls the same way.

**2. A DIEGETIC PANEL OPENED FROM A CHAIR EJECTS YOU FROM THE CHAIR ON ESC, and
that is a real seam I left alone.** `hud.ts`'s `FOCUS.enter` calls
`rig.sit(pose)` for the screen's own camera pose. `fp.ts:230` is
`if (this.seat) return;` — so opening the form from the client chair does NOT
re-seat you, and `FOCUS.leave()`'s `rig.stand()` then stands you out of the
chair entirely rather than back into it.

It is not a trap and it is not new — one ESC gets you out, `K-no-panel-traps` is
green, and the probe photographs the fly-in working correctly because
`stepFocus` drives `cam.position` directly. But *"read the form, then look up
and hand it over"* would read better if closing the form put you back in the
chair. The fix is to have `FOCUS.enter` remember `rig.seatedOn`, stand, take the
screen's seat, and have `leave()` re-sit the remembered pose — **five lines in
`crosstown.ts:1413-1442`, which is inside item 189's region** (worker
sixtyeight held `crosstown.ts:1891` while I was in this file). Queue it as its
own row rather than have two builders in one function.

**3. `ctx.seat` still has no `onSit`, and after this it should not get one.**
The item asks whether it wants one. It does not: an `onSit` is the polling
workaround with a nicer name — it fires on the seat rather than on the player's
aim, so it cannot express *"the form, not the officer"*, and it would re-open a
panel the player just dismissed (`hud.ts`'s `DISMISS_LOCKOUT` exists because
`ct/slots.ts` did exactly that). Aim is the right input and it is now available.

---

## Inherited reds — what was already failing before I touched anything

`seats-walk` was **112/219 on mainline**, and is 112/219 after. The 107 FAILs,
classified:

| n | class |
|---|---|
| 89 | `seated eye is 1.05, expected …` — the slots and library seats declare a pan height the rig does not apply |
| 5 | `sat at X but the seat is at Y` |
| 5 | `no "take a booth seat" prompt … got "[E] sit at the counter"` — overlapping diner triggers |
| 4 | `seated prompt should be "stand up", got null` — the four blackjack seats |
| 2 | `no "sit down" prompt … got "[E] order fries — $0.99"` |
| 1 | `no "sit on the bed and watch TV" prompt … got null` |
| 1 | `no "sit down" prompt … got "[E] order a barn burger — $8.00"` |

None of them is mine and none of them moved. The check matches the exit with
`/stand up/` (`seats-walk.mjs:210`), so the joined `[E] … · [ESC] stand up`
prompt satisfies it — which is a happy accident of keeping the exit named rather
than something I loosened.

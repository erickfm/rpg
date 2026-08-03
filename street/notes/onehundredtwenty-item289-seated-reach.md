# Item 289 — the loan officer was 7 cm outside seated reach

Worker onehundredtwenty, 2026-08-03. Branch `add-stick-and-city98`, worktree
`agent-a0542d3075a31406e`, preview on **port 4193** (4186 was the only thing
taken in the 4180–4199 band; `ss -ltn`, not `curl`). Everything below was
measured on the **built bundle** via `npx vite preview --strictPort`.

## The root cause in one line

**The seated bound measured the span from the player's CENTRE, so it charged a
sitting man the width of his own chest — and the loan officer lost by 7 cm.**

## What I changed

`src/proto/fp.ts`, one predicate in `pickSpot`:

```
- && (!seated || d < s.r + REACH_MARGIN)
+ && (!seated || d < s.r + RADIUS + REACH_MARGIN)
```

`RADIUS` was already imported into this file and already used forty lines below,
in `onIt`. **That is not a coincidence, it is the same lesson twice.** `onIt`
was written as `d < 1e-4` on the reasoning that a spot you stand on is at zero
distance; the world disagreed (`unstick` leaves you 0.060 m off), and it is
`d < RADIUS` now *because the player has a body*. The seated bound was making
the identical assumption on the other side of the same loop, and the quantity it
compares to `REACH_MARGIN` is now the real surface-to-surface gap
`d - s.r - RADIUS`.

**No new constant, and nothing in the bank moved.** I did not touch the officer,
her spot, her radius, the desk, the chair, `LOOK_CEILING` (the user's 25°),
item 283's `!rig.seated` latch guard, or `LATCH_ARM`/`LATCH_CLEAR`.

## The numbers, re-measured on this tree

The desk's row was stamped 14:22 and I claimed at 14:37, so it was inside the
hour — and it was **right**, which is worth recording given the session's 28-vs-5
score. `scripts/probes/w120-officer-reach.mjs`, reading `reachMargin()`,
`playerRadius()`, `seats()` and `spots()` out of `__ct` (nothing retyped):

```
                       dist    r    bound before   bound after
read the loan application  0.95  0.70     1.30  YES     1.66  YES
sit in the client chair    1.13  0.80     1.40  YES     1.76  YES
apply for a loan           1.67  1.00     1.60  no      1.96  YES   <- the item
sit and wait               3.31  0.85     1.45  no      1.81  no
out to the street          5.23  1.00     1.60  no      1.96  no
```

1.67 against 1.60 is the seven centimetres. Against 1.96 she clears by 0.29 m —
GOTCHAS 72, a margin the world can absorb rather than one it meets by a hair.

## What I proved by sitting in the chair

`scripts/probes/w117-item283-client-chair.mjs` (item 283's own instrument, not
mine), which sits the only way a player can — stand on the approach, hold `[E]`
— then sweeps the head from −100° to +100°:

```
  before                                  after
  -68° … -20°  "read the loan application"   -68° … -24°  "read the loan application"
  (nothing else)                             -20° …  24°  "apply for a loan"
```

**That is the design in `ct/int-bank.ts:1183-1189` working as written** — *"you
read the form, then you look up and hand it over"*. Look down-left, the form.
Look up square, the officer. The form ceded 4° of its band and nothing else.

The seated prompt at the seat's own facing is now
`[E] apply for a loan   ·   [ESC] stand up`. The panel opens while seated,
`[ESC]` closes it without ejecting you, standing up works, and the arrival latch
is still clear while seated. **0 failing assertions**, including the leg that
refuses the easy green by requiring a door to still latch (5 doors, all latched).

## What else the +0.36 m let in — the whole world, not a sample

This is the part the item's *"item 188's seat distribution is unchanged"* is
really asking about, and `w69-seated-offers.mjs` alone cannot answer it: it
faces each seat **one** way, its own yaw, so it is blind to something the
widening brought into range 40° to the left.

`scripts/probes/w120-seated-reach-census.mjs` closes that from the other side.
It sits on all 219 seats and reports every live spot that is **outside the old
bound and inside the new one, at any heading**. It ignores `lookTolerance` and
`canSee`, which only ever remove candidates — so it is a deliberate **upper
bound**, and a spot absent from it cannot have been let in at any heading at all.

**Four. Across the whole world.**

```
  seat  18  "sit in the client chair"  + "apply for a loan"          d 1.67   <- the item
  seat  23  "sit down"  (Burger Barn)  + "out to the street"         d 1.91
  seat  26  "sit down"  (Burger Barn)  + "order a barn burger $1.89" d 1.94
  seat  34  "sit down"  (Burger Barn)  + "order fries $0.99"         d 1.88
```

And `w69-seated-offers.mjs` before and after, same instrument, same port:

```
                              before   after
  only standing up on offer     126     125
  something ALSO on offer         0       1     <- "sit in the client chair"
  opened a machine, [ESC] out    93      93
  NO WAY OUT                      0       0
```

**MY FIRST CENSUS RUN WAS WRONG AND SAID 156 SEATS, and the correction is worth
more than the number.** `__ct.spots()` (`crosstown.ts:1882`) *publishes* `ok` as
a field; it does not apply it. `pickSpot` drops `!s.ok()` before any geometry.
119 of those 156 "gains" were the phrase `sit at the slot` — every seat's own
sit-spot carries `ok: () => !rig.seated` (`crosstown.ts:455`, *"no seat can be
hopped to from another"*), so they were false the entire time I was counting
them. BUILDER-BRIEF §7: the instrument, not the world. The filter is now in both
`w120` probes with the reason written next to it.

## The three Burger Barn seats, WALKED

A side effect nobody asked for does not get called harmless from geometry.
`scripts/probes/w120-gained-verbs-walk.mjs` sits on each, turns the head onto
the spot, and holds `[E]`. **0 failing assertions, 0 page errors:**

- **the door**: moved 604.52 m and `seated=false` — **it stood you up first.**
  That guard is `crosstown.ts:1246-1252`, and its own comment reads *"no seat is
  currently that close to a door; this is here so that the first one somebody
  registers is not a bug."* It has been dead code until today. This is the run
  that fires it, and it works.
- **the two orders**: `seated=true`, moved 0.00 m, cash 14.50 → 12.61 → 11.62.
  You order lunch from your table and stay in your chair.

In all three the prompt still names the way off the chair under `[ESC]`
(BUILDER-BRIEF §11).

I am reporting these rather than defending them: they are a behaviour change in
a room the item did not name, they are good, and the desk should decide whether
they want them.

## What I did NOT do, precisely enough to queue

**Three live comments now quote the old predicate, and all three are in files
other builders hold right now** — items 291 and 237 are both in `crosstown.ts`
and the resolver as I write this, so BUILDER-BRIEF §9 says I report rather than
edit. None of them changes behaviour; all three are the exact class of stale
copy that had `casinodoor.mjs` predicting a 3.11 m band against a world that
gave 2.13.

1. **`src/proto/crosstown.ts`**, the `reachMargin()` docstring: *"the SEATED
   clause (`!seated || d < s.r + REACH_MARGIN`, which can only ever shorten the
   seated reach)"*. The parenthetical is still true — `RADIUS + REACH_MARGIN` is
   far under the standing reach of 6 m — but the predicate quoted is no longer
   the one in the file.
2. **`scripts/O-verify-C-stuckfix.mjs:88`**: *"`fp.ts:1006` is precisely
   `(!seated || d < s.r + REACH_MARGIN)`"*. Both the line number and the
   predicate have moved.
3. **`scripts/probes/w69-what-a-seat-can-reach.mjs:4`** describes the bound as
   `r + REACH_MARGIN` and computes with `margin` alone, so it now under-reports
   what a seat can reach by 0.36 m.

`src/proto/ct/library-pc.ts:892` also cites it, but that one is safe: its radius
is the **measured** chair-to-glass distance off the mesh (1.02 m), so widening
the bound can only make the terminal easier to reach, never harder. The prose is
stale; the value is derived.

## `npm run checks` is 22 red on this tree, and none of it is mine

One clean frozen run, 147 of 148 checks: **22 red.** Rather than argue about
them I A/B'd — revert **only** `src/proto/fp.ts` to `b85494d0f`, rebuild, re-run
the same rows, put it back. I did not re-run the whole suite twice; I ran the
subset that could plausibly involve a selection predicate, via `--only`:

```
  door301  mirror-walk  I-clip  spot-coverage  aimed  L-every-stool-seats-you
  D-walk   K-pocket-loop  canfail-args   (+ canfail seat-traps directly)
```

**All nine red identically without my change.** That includes every check that
touches `pickSpot` — `aimed`, `spot-coverage`, `D-walk`, `L-every-stool-seats-you`
— which is the set that would have caught me if the widened bound had leaked into
standing selection. It cannot: my edit lives inside `(!seated || …)`.

The other 13 (`park`, `w5-shadow-census`, `K-tyre-has-arch`, `N-post-waiting`,
`K-sleep-fade`, `floaters-walk`, `hashes-resolve`, `note-hashes`,
`mutations-quote-real-source`, `checks-can-fail`, `J-library-room`,
`L-slots-inworld`, `pointer-returns`) I did **not** A/B — they are shadow,
texture, hash and pointer-lock checks with no path to a seated reach bound, and
under §10a re-running the suite twice more would have cost several times the
fix. **Saying so rather than implying I cleared them.**

Two of them are worth a row on their own:

- **`K-pocket-loop`** — *"the one you took LEFT THE GROUND (0 hidden, expected
  1)"*. It is also **flaky**: across three runs on my own build the failing
  assertion moved between *"LEFT THE GROUND"* and *"the loop closes"*, which is
  the signature of a load-sensitive walk (GOTCHAS 30) rather than a fixed
  defect. Same red on mainline `fp.ts`. Not mine, and worth a row.
- **`canfail-args`** — *"a valid selection is NOT refused — it reaches the
  world"*, exit 3, *"2 of 71 selected case(s); the other 69 were not run"*. The
  mutation registry has a case quoting source that no longer exists, so the
  pre-flight aborts every run. Identical on mainline `fp.ts`. **Separately,
  `canfail seat-traps` reports `BUILD — mutation did not compile` on mainline
  too**, so that case is not currently certifying anything either. Both are
  guards that have stopped guarding, which is the family this project already
  has a name for; the desk should queue them.

## §10a — I registered NOTHING in `checks.mjs`, deliberately

The rule arrived mid-item and it points straight at this one: **the fix is a
single predicate and I spent far longer measuring it than writing it.** So,
against *"if this check goes red in six weeks, will it be because the world
broke, or because the world is a world?"*:

| probe | what it is | verdict |
|---|---|---|
| `w120-officer-reach` | pure `__ct` reads — `reachMargin`, `playerRadius`, `seats`, `spots` — and arithmetic. ~5 s, no frames, no pixels, no timing | **safe to promote.** Deterministic; can only go red if a distance or a constant really moved |
| `w120-seated-reach-census` | 219 × (`sit`, read `spots()`), geometry only. ~90 s | **safe but slow.** Same class — nothing timed — but it is the answer to a question asked once, so I would run it after a resolver change rather than every suite |
| `w120-gained-verbs-walk` | walks 3 seats with a held `[E]` and `waitPainted` | **DO NOT PROMOTE.** It is frame-timed, which is the coin-toss family. It was the right thing to *do* — §10 still says a seat gets walked — and its result is in this note. It should not become a standing red |
| `w120-chair-look` | two screenshots, **zero assertions** | cannot cry wolf; it is a looking tool, not a check |

`grep -c w120 scripts/checks.mjs` is **0**. Nothing I wrote can fail in the suite
the user reviews.

**The honest gap, stated rather than papered over:** the guarantee I would most
want standing — *"the officer stays reachable from the client chair"* — is
already covered by the cheap probe above, but the guarantee *"and pressing E
there still opens the panel and still lets you out"* is only covered by
`w117-item283-client-chair`, which is frame-timed. I am not making a second
flaky one. The stable half is checkable and checked; the walk half I did by hand
and reported, and it stays unenshrined.

**Two of the reds I tripped over prove the rule's point better than I can:**
`K-pocket-loop` failed on a *different assertion each run* on identical code,
and `canfail seat-traps` has been reporting `mutation did not compile` for long
enough that nobody notices. Both are already in the suite. Both are exactly what
*"a check that cries wolf is worse than no check"* is about.

## Derived or copied

Derived, all of it. `RADIUS` and `REACH_MARGIN` are imported in `fp.ts` already;
the probes read `playerRadius()`, `reachMargin()`, `seats()` and `spots()` from
`__ct` rather than retyping anything (BUILDER-BRIEF §8).

## And I looked at it

`scripts/probes/w120-chair-look.mjs`, two frames from the chair, build stamp
`e31ec9464` in the corner (`shots/` is gitignored, so the probe is committed and
the images are not — re-run it to regenerate them):

- **0°**, `shots/w120-chair-officer.png` — the officer square ahead across the
  desk, the LOAN form on the blotter to the left, prompt
  `[E] apply for a loan · [ESC] stand up`.
- **−45°**, `shots/w120-chair-form.png` — the form centred and readable, prompt
  `[E] read the loan application · [ESC] stand up`.

My own verdict on them: this is the interaction `ct/int-bank.ts` describes,
working. Look up, you get the woman; look down at the paper, you get the paper.
For LOOKING only — the proof is the three probes above.

## Something I nearly broke, recorded for the next person

`pkill -f "scripts/checks.mjs"` **kills the shell you type it in**, because that
shell's own command line contains the string. It cost me two 25-minute suite
runs that died at exit 144 and looked like a crash in `checks.mjs` itself.

## What I did not prove

- I have **not** hand-played this in a browser with a keyboard; every walk above
  is a scripted `[E]` through the real dispatch on the built bundle.
- The census is an upper bound by construction. It says nothing was let in that
  is not on its list; it does not say the four on the list are all *reachable in
  practice*, which is what the three walks are for.
- I did not re-run `w40-bed-vs-door`. It is 0/5 on mainline for a reason that
  is item 291's (the calendar), and a red there would tell the desk nothing
  about this change. Standing selection is byte-identical: my edit is inside
  `(!seated || …)`.

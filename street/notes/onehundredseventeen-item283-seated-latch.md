# Item 283 — the bank client chair, and the latch that could never discharge

Worker onehundredseventeen, 2026-08-03. Port **4190** (4186 was taken; `ss -ltn`,
not `curl`). Verified on the **built bundle** via `vite preview`.

## What was wrong

The desk's row was **right**, and worker onehundredseven's diagnosis behind it
was right in full. Reproduced before changing anything, on the built bundle at
`66555ca60`:

```
219 seats registered
2 of them move the player MORE than 1 m when you sit
     1x  sit in the shelter
     1x  sit in the client chair
the sit moves you 1.13 m (latch is 1)
landing after sitting:  {"x":444.4,"z":2.62,"clearIn":1.2}
seated true, prompt "[E] stand up"
```

One correction to the row's wording, and it matters for anyone reading it later:
**1.13 m is not the seat's height, it is the distance from its approach point to
its pose.** `ct/int-bank.ts:1421` registers `approach: { DESK_X + 1.10, CLI_Z +
0.25 }` — the chair is taken from its right so the player does not stand on the
loan officer — and `hypot(1.10, 0.25) = 1.128`. The seat pan is `h: 0.49`.

**The root cause is an asymmetry between the two halves of one latch.**
`crosstown.ts` arms `landing` when an act moves the player past **1.0 m**, and
discharges it only when they have **WALKED 1.2 m** clear. `fp.ts`'s seated
branch returns before movement is integrated, so a seated player's x/z is
frozen at the seat. A latch armed by *sitting down* therefore has no discharge
path at all: `canSee` returns false for every spot in the world until you stand,
so the seated `[E]` item 188 landed is dead — and dead in the one chair the user
asked for by name, *"you sit and its the loan process as an integrated
overlay."*

A residue, also measured: standing up moves you back **1.13 m**, which is short
of the 1.2 m discharge — so even after getting up, nothing is selectable until
you take another step. The mutated-world run caught this as
`clearIn: 1.09`.

## The fix

`src/proto/crosstown.ts`, one predicate and three hoisted numbers.

```ts
if (!rig.seated && Math.hypot(rig.pos.x - wasX, rig.pos.z - wasZ) > LATCH_ARM) {
```

**Arm the latch only on a player who still has legs to clear it with.** Derived
from the discharge condition rather than from any distance: moving either
threshold rescues these two seats and breaks at the next `approach` anybody
writes. `LATCH_ARM = 1.0` and `LATCH_CLEAR = 1.2` are now named — **1.2 was
typed in three places**, one of them `__ct.landing()`'s `clearIn`, which is the
number every harness reads.

Reading `rig.seated` *after* the act is deliberate and correct in both
directions: sit down → still seated → no latch; use something from a chair that
stands you up and moves you → not seated → latch arms, exactly as a door does.
`landing` is provably null on entry to that branch, because `canSee` gates
`picked`, so the guard cannot mask an older latch.

## Proof

Two probes, both on the built bundle. **I did not confirm my own work — the
desk should re-run these.**

- `scripts/probes/w117-item283-client-chair.mjs` — 22 assertions. Sits every
  at-risk seat **through the `[E]` dispatch**, sweeps the head in the chair, opens
  the loan, closes it, stands up, **and proves a door still latches** (5 doors,
  446–765 m moves, all latch). `--expect-broken` inverts the verdict.
- `scripts/probes/w117-item283-walk-to-the-chair.mjs` — 12 assertions, **walked**:
  in off the street on `[E]`, across the banking hall on held `W`, sit, take the
  loan.
- `scripts/probes/w117-item283-shots.mjs` — four frames, for looking at.

**Both signs.** Mutating the guard back out (rebuild confirmed `built in`, so no
GOTCHAS 77 stale-`dist/` pass) fails **6 of 22** assertions — and the door leg
stays green, so the check is specific rather than blanket:

```
FAIL  "sit in the shelter": the arrival latch is CLEAR while seated
FAIL  "sit in the client chair": the arrival latch is CLEAR while seated
FAIL  you are sitting in it
FAIL  something other than standing up is on offer from the client chair
FAIL  the LOAN is among them
FAIL  standing up leaves no latch behind — clearIn 1.09
```

**Five runs each, and the spread is nil.**

| probe | runs | result | spread |
|---|---|---|---|
| client-chair | 5 | 22/22 ok, exit 0 | band `-56°…-32°` identical, panel `ct-loan` every run |
| walk-to-the-chair | 5 | 12/12 ok, exit 0 | walked 5.51–5.82 m, ended 0.09–0.39 m from the approach, offer at `-56°` every run |

**Item 188's own figures are unchanged — measured, not reasoned.** Built the
pre-fix behaviour and the fixed one and ran `w69-seated-offers.mjs` against both:

```
                              before   after
only standing up on offer :     126     126
something ALSO on offer   :       1       1
opened a machine, [ESC] out:     92      92
could not be seated       :       0       0
NO WAY OUT                :       0       0
```

**And that identity is itself the finding.** w69 seats the player with
`__ct.sit()`, a direct call on the rig; `landing` is armed in the `[E]`
**dispatch**, which that path never enters. So item 188's acceptance test reads
green with this bug fully present and fully absent — **its contract of "29
released, 0 trapped" was measured on a route no player takes.** That is why the
regression survived, and it is a gap the desk should know about: nothing in
`scripts/` sat a seat by walking to it and pressing E until this item.

Other checks: `tsc --noEmit` clean · `health.mjs` exit 0, WORLD OK ·
`npm run sweep` **0 STATION MISS, 0 COVERAGE**, no new console errors.

## What I found and did NOT fix

1. **`npm run walk` (`scripts/D-walk.mjs`) fails one assertion, and it is
   pre-existing** — identical with my fix in and out, measured both ways. It is
   the **check**, not the ATM. Evidence in
   `scripts/probes/w117-atm-tap-vs-held.mjs`; my own first hypothesis
   (BUILDER-BRIEF §5's tapped `press('e')`) was **wrong** and the probe says so.
   - `D-walk.mjs:443-452` infers "a panel opened" by **counting DOM elements**
     over 300×200 with `position: fixed|absolute`. K's shared full-screen panel
     is one persistent element that is shown and repainted, so opening it moves
     no count: **3 → 3**, on a tap *and* on a held press. Meanwhile
     `__hud.panel()` goes `null → "ct-atm"` both ways. It wants `__hud.panel()`.
   - Same leg, `D-walk.mjs:428`: "the ATM offers itself" passes on
     `prompt.includes('FIRST FEDERAL')` — which **the door prompt `"[E] into
     FIRST FEDERAL"` also satisfies**. Stand on the ATM spot's own centre
     (−7.00, 7.29) and the door wins the pick, so that clause can pass while the
     player is being offered the door. It wants the `use the machine` wording.
   - Not mine: item 283 does not name `D-walk.mjs` (BUILDER-BRIEF §9).

2. **The loan officer is 7 cm outside seated reach, so the loan is taken off the
   FORM, at a −56°…−32° head turn.** The officer spot sits at
   `DESK_Z − DESK_D/2 − 0.30` = z 0.95 with `r: 1.0`; the seat is at z 2.62, so
   d = **1.67 m** against a seated reach of `r + REACH_MARGIN` = **1.60 m**. The
   form (`r: 0.7`, d 0.95 m) is what wins. Functionally identical — both call
   `openApplication` — but **facing the officer square on, the prompt reads
   `[E] stand up`**, and the user's instinct on sitting down will be to press E
   at the person opposite him. Worth a look by his eye; I have not touched it
   because the item is about the latch and the officer's radius is `int-bank.ts`.
   See `shots/w117-283-2-seated-facing-the-desk.png` versus `-3-`.

3. **`[ESC]` from the loan panel closes it *and* stands you up** (measured
   `seated=false`). That is **item 206's** subject — two unconditional stand-ups,
   `ct/hud.ts:1331` the second — which is live with another builder, so both my
   probes **report it and deliberately do not assert it** either way.

4. **The loan panel's footer hint wraps out of the panel**, the word "leave"
   landing below the cabinet's bottom edge over the world
   (`shots/w117-283-4-the-loan-open-from-the-chair.png`). Adjacent to item 216,
   which was scoped-not-fixed as "the hint already fits the only derived budget
   there is" — this is a second instance, on a different panel.

## Derived, not retyped

`LATCH_ARM`/`LATCH_CLEAR` are now the single source for both halves. Every
number in the probes comes from `__ct.seats()`, `__ct.spots()` and
`__ct.landing()` at runtime; the only hand-copied value is `ARM = 1.0` in
`w117-item283-client-chair.mjs`, which restates `LATCH_ARM` because
`crosstown.ts` does not publish it — **a `__ct.latch()` hook would close that,
and is worth queueing.** `D-walk.mjs:423`'s `(-6.0, 7.29, -π/2)` is cited with
its line number in the ATM probe rather than reinvented.

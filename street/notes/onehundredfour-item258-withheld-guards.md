# onehundredfour / item 258 — the guard that was withheld for a reason that expired

Three things: the `unstick-off` canfail case, a `WITHHELD` register that makes
the next deferral visible, and `ghosts.mjs` in a tier. All three landed. The
most useful finding is the one nobody asked for — see §4.

Port **4187** (4186 and 4191 were taken; `ss -ltn`, not `curl`). Everything
below is against a **built bundle** on `vite preview`, build `415dafdb1`.

---

## 1. `unstick-off` — the case w37 wrote, tested, and correctly refused to add

**The precondition was re-measured before anything was written, because the
whole point of the item is that a precondition went stale unnoticed.**

```
586 traps found (inside-a-collider + every sub-0.97 m gap)
537 colliders = 525 static + 12 that walk
543 were genuinely stuck; 543 freed themselves
6 also driven for real: 6 walked away under their own steam
all 543 traps release the player, and all 6 driven cross-checks walked away    exit 0
```

That is the third independent green — onehundred measured it twice on
`210891b5f`, this is `415dafdb1`. w37's blocker (a trap at 8.50, −94.50) was
diagnosed away as `unstick-walk.mjs`'s own rotation-blindness and the check has
been green ever since.

**And `canfail.mjs` now guards this itself, which I did not know going in.** Its
pre-pass prints:

```
  pre-pass: 1 distinct check invocation(s) across 1 case(s),
  on the UNMUTATED tree — a check already red here cannot certify anything.
  1 of 1 green before any mutation.
```

So the specific failure w37 feared — a case certifying itself against an
already-red check — **cannot happen any more**. Worth knowing: it means the bar
for adding a withheld case back is lower than the withholding comment implies.

**AND IT FIRES — that is the point of the item, so it was run rather than
declared.** `SHOT_URL=http://localhost:4187/ node scripts/canfail.mjs unstick-off`,
**13 min 40 s**, against the built bundle:

```
  OK   unstick-off CAUGHT  the stuck-protection switched off entirely —
                           both the push and the lastGood rescue

1/1 checks caught their mutation
every mutated file restored byte-for-byte
```

The mutated run is *slower* than the green one and that is the mutation working:
every trap now stalls to the 40-frame limit instead of freeing in ~12.

**The mutation, and the only interesting thing about it.** The rig has TWO
redundant rescues: `unstick` pushes you out at `UNSTICK_SPEED`, and after
`PATIENCE` seconds of getting nowhere it teleports you back to `lastGood`. Kill
only the push and the timer still frees the player, so the check stays **green on
a world with no push at all**. Both have to go. `canfail` applies exactly one
needle, so the needle spans all three constant lines at `fp.ts:453-455`
(`PASSES` unchanged, carried through the replacement).

## 2. `WITHHELD` — the convention, and why it is shaped this way

`scripts/checks-can-fail.mjs`. A name here is a guard somebody **looked at,
decided against, and wrote down why and what would change the answer**:

```js
const WITHHELD = {
  gaps: { since: '2026-07-25', why: '…', expiresWhen: '…', where: '…' },
};
```

**It prints on EVERY run, green or red, with the age in days.** That is the whole
mechanism and it is deliberately not an automatic expiry. A machine cannot tell
that a phantom trap was diagnosed away; a human reading *"withheld 9 days ago
because the check was red"* asks *"is it still red?"* and that costs thirty
seconds. The failure being fixed is not a wrong entry, it is **an entry nobody
re-reads** — six days was enough to lose one.

**`gaps` moved off `NO_PROOF_YET` into it.** It was never "nobody has looked":
w37 looked, tried a one-coordinate mutation, watched the check correctly stay
green with the car 2.6 m away on the carriageway, and wrote down why no single
find/replace can express it. Those are opposite claims and the file now refuses
to hold a name on both lists.

**Four new red paths, and I watched all four fire** —
`scripts/probes/w104-withheld-selftest.mjs`, 10 cases, **7 of them the red
side**, run against a synthetic 4-row registry in a scratch tree so the live one
is never written to:

| case | asserts |
|---|---|
| 0 | the fixture parses 4 rows — population floor before anything else |
| 1, 2 | a complete withholding is accepted, printed on a green run, and suppresses the undeclared complaint |
| 3 | a withheld guard that **has since been written** goes red |
| 4 | a withheld name no longer in the registry goes red |
| 5, 5b | an entry missing `expiresWhen` / `since` goes red — *that is the prose comment again* |
| 6 | a name on **both** registers goes red |
| 7 | the **pre-existing** complaint still fires — adding a register must not swallow it |
| 8 | a parser matching nothing still exits 2 |

**And the self-test has teeth, proven by breaking the guard.** Changing
`const staleWithheld = WITHHELD_NAMES.filter(settled)` to `= []` turns **exactly
cases 3 and 4 red and leaves the other 8 green** — a narrow, discriminating
mutation rather than a wholesale collapse. Restored byte-identical (`diff` clean).

## 3. `ghosts.mjs` in a tier — and the fix it needed first

Registered in the **default tier** at a measured **26.1 s**, which is this file's
own rule rather than a preference: it does not walk, and 26 s sits below the 36 s
that moved `lotwalk` to slow. Nearly all of it is the deliberate 22 s `LONG_MS`
sampling window — the measurement itself, not overhead.

This clears the red **onehundred turned on for exactly this purpose**:
`checks-registered` went `exit 1` → **`exit 0`, 165 registered**.

**⚠ IT WOULD HAVE BEEN A BROKEN REGISTRATION WITHOUT A ONE-LINE FIX, AND I ONLY
FOUND IT BY TRYING.** `shots/` is **gitignored**, so a fresh worktree has none,
and the script's last act before its exit code is `writeFileSync('shots/…')`.
Measured rather than assumed — `mv shots /tmp && node scripts/ghosts.mjs`:

```
EXIT=1   code: 'ENOENT', syscall: 'open', path: 'shots/ghosts.json'
```

**A missing directory, reported to the suite as a corridor defect.** Exit 1 with
no verdict line is indistinguishable from "the corridor answer differs" — GOTCHAS
65's *could not measure ≠ measured and broken* arriving through the back door.
`mkdirSync('shots', { recursive: true })` fixes it; re-measured **exit 0** with
`shots/` absent. Nothing had ever run this file from a clean checkout.

## 4. ⚠ THE PART I DID NOT EXPECT — my own probe lied twice, and the controls caught it

GOTCHAS 79b says a probe reading from spawn reads from inside apartment 301.
`ghosts.mjs` never warps, so before registering it I asked whether it is measuring
the street at all. **My first two answers were both wrong, in opposite directions,
and only a control caught each.**

**Liar #1 — two samples read as a catastrophe.** Comparing raw `colliders()`:

```
at spawn 257 · on the street 258 · back at spawn 259
FAIL the census MOVES with the player
```

That is **not** the cull. It is **monotonic** — the third reading is 259, not the
257 it would have to be if position were the cause — so it is traffic and
citizens registering as they spawn in. **A two-sample probe would have shipped
"ghosts.mjs is culled" as a finding.** The return trip is what killed it.

**Liar #2 — the right instrument aimed too wide.** Asked of the static set it
reported a *stable* ±1, **5 round trips out of 5** (253 in the flat, 252 on the
street), which looks far more like a real finding than the drift did.
`scripts/probes/w104-which-collider-moves.mjs` names the three boxes instead of
shrugging at the count:

```
only in the flat    1.20 × 3.60 m at (200.60, -8.60)    ← apartment 301's own
only in the flat    0.27 × 0.35 m at (202.14, -17.31)   ┐ one 0.27 m box
only on the street  0.27 × 0.34 m at (200.25, -15.69)   ┘ that MOVED
```

**All three are at x ≈ 200, inside the apartment block. None is in either
corridor band.** So the honest question was never "does any collider anywhere
differ" — interiors register on entry and always will — it is *does anything
`ghosts.mjs` measures differ*. Asked of the two pavement lanes it actually
sweeps, over 5 round trips:

```
IN THE CORRIDOR (x ±5.0…6.7, z -94…12): from the flat 18, from the street 18
the corridor is IDENTICAL from both positions, box for box
```

Compared as a **set**, not a count — a count can agree while a kerb has swapped
for a bench. Population floor asserted on both sides, because an agreement
between two empty censuses is the loudest vacuous pass there is.

**Verdict: `ghosts.mjs` does not need to warp.** `colliders()` is an authoring
read and the cull is a rendering fact. But that is now *measured*, not reasoned —
and the reasoning was wrong twice on the way there.

---

## ⚠ FOUND AND NOT FIXED — for the desk to queue

1. **A 0.27 m box inside apartment 301 is in `staticColliders()` and MOVES**
   (202.14, −17.31) → (200.25, −15.69) between two readings a second apart.
   `staticColliders()` is supposed to separate actors **by object identity**
   against the registration hooks (GOTCHAS 73). Something in the flat — the cat
   is the obvious suspect, `ct/cat.ts` — is registering as furniture. Harmless
   for every check I ran, since all of them measure the street, but it is
   precisely the class of bug that hook exists to prevent.
2. **`unstick-walk` still has no population floor.** `process.exit(fails.length
   || errs.length ? 1 : 0)` with nothing asserting `tested > 0`: if `traps` ever
   came back empty it would print `all 0 traps release the player` and exit 0.
   w37 flagged this as *suspected* in July and it is still there. It is now more
   worth fixing than it was, because a registered canfail case makes this check
   look proven. **Not in item 258's named files** — one line, wants a row.
3. **`checks-can-fail` is still red on 5 rows, and it was before I started** —
   `w40-bed-vs-door`, `world-contained`, `prompt-not-a-ghost`, and
   `w75-site-contained` **listed twice**. Untouched — a different item — but
   **onehundred's open question about that duplicate is now answered, and the
   answer is not what it guessed.** It wondered whether it was "a duplicated
   registration or a duplicated report". It is **neither**: `checks.mjs:1315-1317`
   registers the same script **three** times with different args, which is a
   legitimate pattern —

   ```
   ['w75-site-contained', '…at the jail?', 'jail-forecourt-open', ['jail'], true],
   ['w75-site-contained', '…at the park?', false,                 ['park'], true],
   ['w75-site-contained', '…at the lot?',  false,                 ['lot'],  true],
   ```

   `checks-can-fail` reports **by name**, so it names the two rows that carry
   `false` and stays silent about the one that declares `jail-forecourt-open`.
   The output is correct and the finding is the real one underneath it: **the
   park and lot variants of the world-containment check have no failing path
   while the jail variant does.** Whoever takes that row should give those two a
   case rather than de-duplicate a registration that is not duplicated.
4. **`scripts/checks.mjs` overlap.** `onehundredthree` held item 257 against this
   same file while I held 258. My edits are two isolated blocks (the
   `unstick-walk` row, and a new `ghosts` row next to `floaters-walk`); 257's are
   a comment at :902 and a park-lamp canfail case. Distinct regions, but the desk
   should expect a merge and check both landed.

## Verification

| | |
|---|---|
| `unstick-walk` baseline | 543/543, 6/6 driven, **exit 0** |
| **`canfail unstick-off`** | **CAUGHT, 1/1**, 13 m 40 s, every file restored byte-for-byte |
| `canfail unstick-off` pre-pass | 1 of 1 green on the unmutated tree |
| `npm run sweep` | **0 STATION MISS, 0 COVERAGE**, exit 0 |
| `health.mjs` | WORLD OK, exit 0 |
| `checks-can-fail` debt register | **15 → 13** (unstick-walk cleared, gaps moved to WITHHELD) |
| `w104-withheld-selftest` | 10/10, 7 on the red side, **exit 0** — and 2/10 red when the guard is broken |
| `ghosts --selftest` | 5/5, 2 pass + 3 fail cases, **exit 0** |
| `ghosts` vs the world | 26.1 s, 0 ghosts, corridor identical, **exit 0** |
| `ghosts` with `shots/` absent | **exit 1 → exit 0** after the mkdir |
| `checks-registered` | **exit 1 → exit 0**, 165 registered |
| `w104-ghosts-sees-the-street` | 18/18 corridor boxes identical, 5 round trips, **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `node --check` | clean on all 7 touched files |

# w37 — item 77: the six walking-tier checks with no failing path

**All 6 cleared.** One of them was a real sleeper and needed fixing before its
case could mean anything: **`I-seat-exit` is the sixth member of the
`health.mjs` family** — it printed its own clean bill of health over a sample of
zero and exited 0.

Port **4180**, proved `000` free before use, dev server (`npx vite --port 4180
--strictPort`), shut down at the end. Debt register **20 → 14**.

Every status below was read **unpiped**, as `echo "UNPIPED EXIT=$?"` on the line
after the command, never after a pipeline.

## The scoreboard

| check | mutation | status | verdict |
|---|---|---|---|
| `w21-roof-climb` | cab roof lifted 1.415 → 1.62 | **1** | cleared, `roof-unreachable` |
| `I-seat-exit` | seats that trap / nothing sittable | **1** and **0** | **FIXED**, `seat-traps` + `seat-nosit` |
| `side-walk` | side-street walks sealed at every tree | **1** | cleared, `sidewalk-sealed` |
| `crowd-net` | walk line laid inside the roadway | **1** | cleared, `crowd-net-inroad` |
| `corner-traffic` | cars lean INTO the turn | **1** | cleared, `corner-lean-into` |
| `unstick-walk` | safety net switched off | **1** | cleared, `unstick-off` — but **slow, see below** |

## The headline: `I-seat-exit` could not fail over an empty sample

Its whole verdict was:

```js
process.exit(stuck.length ? 1 : 0);
```

`stuck` counts seats that no key releases. Nothing anywhere set a floor under
the sample, so **an absence was free over an empty set**. Measured — with
`FPRig.sit()` refusing every seat in the world:

```
  could not sit  : 6  (aim or reach, not a verdict either way)
  no seat traps the player: 0 released by E, 0 by Escape.        exit 0
```

219 seats published, six sampled, **not one of them sittable**, and the check
that exists to guard seating reported green. `integration-doors` carries a
careful, well-commented guard against exactly this shape (w36 quotes it) and
this file had none.

`nosit` really is "not a verdict either way" for **one** seat — aim and reach
are genuinely ambiguous — which is why this was easy to miss. It stops being
ambiguous when it swallows the whole sample: there is then no verdict left to
pass.

### Proved twice, on the same broken world

| | pre-fix script | fixed script |
|---|---|---|
| nothing in the world sittable | prints `no seat traps the player: 0 released by E, 0 by Escape.`, **exit 0** | **exit 1** |
| world restored | — | **exit 0**, `5 released by E` |

The third row matters as much as the first: the fix is not a check that is now
permanently red.

Two cases registered rather than one, because **they fail apart**:
`seat-traps` breaks what the check is named for (the user's own *"pressing e
doesnt get me out of it — stuck in the TV seat"* — 5 of 5 sampled seats
trapped, teleport distance 1.18–1.40 m, the same 1.0–1.4 m trap band the
script's header recorded when it was written); `seat-nosit` breaks the hole.
A single case against the trap alone would have left the hole **registered as
proven**.

## The item's premise was half wrong, in both directions

The item says all six "still have no failing path". That is **not** what a
behavioural test found:

- **Five of the six already had a sound verdict.** `side-walk`, `crowd-net` and
  `corner-traffic` all increment `fails` in `check()` and end
  `process.exitCode = fails ? 1 : 0`; `unstick-walk` ends
  `process.exit(fails.length || errs.length ? 1 : 0)`; `w21-roof-climb` was given
  its exit code by item 64. What they lacked was **a mutation anyone had watched
  them catch** — which is what the debt register actually tracks, and a different
  thing from having no failing path.
- **One had a genuine hole** (`I-seat-exit`), and it was not one a reading of the
  exit line would have found: `process.exit(stuck.length ? 1 : 0)` looks like a
  working verdict.

### w33's ready-made roof mutation does NOT reproduce

The item hands on `notes/archive/w33-roof-hop-frames.md`: raising
`PICKUP_CAB.roofY` (`src/proto/ct/cars.ts:148`) by **100 nanometres** took the
hop from 4/4 to 0/4, "so the hard part is done". It is not.

I applied it, **confirmed the dev server was serving `1.4150001`** (`curl
localhost:4180/src/proto/ct/cars.ts`, so this is not the wrong-world trap), and
the check **passed**:

```
    frames needed to cross it: 4   frames available above 1.335: 5
    ok   8. spare frames: 1 (need >= 1, so a dropped frame still lands)
PASS: ... the roof hop clears with 1 spare frame(s) at the dt clamp
```

w33's world was sitting **exactly on a frame boundary**, so a rounding-width
nudge flipped an integer. Today there is a whole spare frame and `1e-7` cannot
cross it. **A case that depends on the world being knife-edged stops proving
anything the moment the margin moves — and it looks exactly like a passing
case.** The registered case is a decisive one instead: 1.415 → 1.62 leaves the
bed rail at 0.97 and makes the last step 0.65 m, past what the rig climbs.

## `unstick-walk` — cleared, but it is over every timeout in the harness

The mutation switches the stuck-protection off. **Both halves have to go**, and
that is the interesting part of the case: zeroing `UNSTICK_SPEED` stops the push
out of a box, but the `PATIENCE` timer would still teleport the player back to
`lastGood` after 0.45 s and free them — so the check would have stayed **green
on a world with no push at all**. A mutation that breaks only one of two
redundant mechanisms proves nothing. Measured with both gone:

```
537/531 traps are still traps
  FAIL  DRIVEN inside @ 7.18,-5.37 — rig could not walk away (0.00 m)     (x6)
```

The `DRIVEN` lines are the strong evidence: that leg walks the rig out for real
rather than asking the collider predicate, so it cannot be fooled by a mutation
that only changes what the predicate sees.

> **The clean baseline for this one is the weakest evidence in this note, and it
> is the only case here whose green run I did not get to watch.** The first
> baseline attempt crashed the page at 4 m 40 s; the second was killed by the
> 10-minute cap; the third was still running when I finished. So the red above
> is compared against *no* observed green. I am registering it anyway because
> the mutation is a one-line switch-off of the exact mechanism the check is
> named for and the failure is near-total (537 of 531), but **if the desk wants
> one thing re-checked from this session, make it a clean `unstick-walk` run on
> unmutated source.**

**It takes 11 m 15 s, and that is arithmetic rather than bad luck.** The loop
waits a fixed 1.1 s per trap and the world now offers **582 traps** — 640 s of
pure waiting before the driven cross-check even starts. Consequences the desk
should know about:

- It is **over the 10-minute cap** on this harness's foreground runs. It has to
  be run detached, or on its own.
- **One run crashed the page outright** at 4 m 40 s —
  `page.waitForTimeout: Page crashed`, an uncaught exception at
  `unstick-walk.mjs:89`, no verdict printed at all. That run exits **1**, which
  is indistinguishable from "measured and broken". It did not recur on the two
  later full runs, so I am recording it rather than diagnosing it.
- `537/531` is not a typo in this note — the script prints
  `${fails.length}/${tested}`, and the six `DRIVEN` failures are pushed onto
  `fails` after `tested` has stopped counting. Cosmetic, but it makes a verdict
  line read as nonsense.

**What I did NOT do, deliberately:** I did not add a sample cap to make it fit.
Capping 582 traps to 30 would make it complete and would be **loosening a check
until it agrees with me**, which BUILDER-BRIEF §7 forbids. The right fix keeps
the coverage and cuts the per-trap cost — pull `colliders()` once instead of
twice per trap, and end on world state rather than a fixed 1.1 s wait, which is
a lie under load anyway since `dt` is clamped at 0.05 s. That wants its own item.

**And it has the same hole `I-seat-exit` had — unproven.** Its verdict is
`process.exit(fails.length || errs.length ? 1 : 0)` with **no floor on
`tested`**. If `traps` ever came back empty it would print `all 0 traps release
the player` and exit 0. I did not watch that happen and **I have not fixed it** —
flagging it as suspected only, on the strength of the identical hole found and
proved in `I-seat-exit` this session. Worth a cheap follow-up item.

## Also found, not fixed

- **`w21-roof-climb.mjs` has `process.exit(allOk ? 0 : 1);` on lines 492 AND
  493.** The second is dead code. Harmless, and it looks like a bad merge —
  left alone because the file is not mine beyond this item, but somebody should
  delete a line.
- **The 3-status problem is still whole-suite.** Every one of the six exits **1**
  when it cannot measure, so a builder who forgot to start a preview is
  indistinguishable from a broken world. w36 measured this at 20 of 23 checks
  across both tiers and filed it as its own item; I have **not** fixed it in the
  files I touched, because fixing it in one file makes the fleet less consistent,
  not more. `I-seat-exit`'s new guard says so in a comment rather than hiding it.
- **`unstick-walk`'s runtime and page crash** — the item above.

## Method note, since the item asked for it

Everything was run against a **dev server**, not a built bundle. `canfail.mjs`'s
own header licenses this: *"A DEV server serves source rather than a hashed
asset; there the mutation reaches the world through HMR by construction."* It is
also why five checks fit in one session — `guards.sh` rebuilds per case, and
`npm run build` wipes `dist/artifact.html` (GOTCHAS 63, which w36 watched
happen). **Nothing in this session ran a build, so the packed artifact was never
at risk.**

I verified the served world carried each mutation rather than assuming it, at
least once, by `curl`-ing the module off the dev server — that is what caught
w33's case as non-reproducing rather than as "the check slept".

Every mutated file was restored and confirmed byte-exact with
`git diff --stat src/` (empty) before each commit.

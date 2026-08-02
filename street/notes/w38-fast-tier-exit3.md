# w38 — item 76: a dead port read as a broken world in 12 of 15 fast-tier checks

**Root cause in one line:** `scripts/lib/reachable.mjs` has had a `goto` that
exits 3 on a refused connection since it was written — **none of the twelve
imported it**, so their bare `page.goto` threw uncaught and node turned that into
exit 1, which in this project's convention means "measured, and the world is
wrong".

Ports: **4191** (`vite preview`) and **4192** (kept deliberately dead as the
"no server" case). Both proved with `curl` first. Shut down at the end.

## Reproduced before changing anything — the premise was exactly right

w35's audit (`notes/archive/w35-fast-tier-failpaths.md`) named the 15 and left
the tooling. Re-ran its own sweep, `scripts/probes/w35-status-sweep.sh`, which
reads status **unpiped** because `$?` after a pipeline is the pipeline's last
command:

```
dead port, BEFORE:  12 x exit=1   (lot-frontage mirror-walk I-apron-grain
                                   people-walk floaters-walk jump-walk gaps
                                   feet-check side-night A-eye-height-holds
                                   K-seat-lets-you-up O-jail-door-agree)
                     3 x exit=3   (L-slots-inworld L-every-stool-seats-you
                                   L-blackjack-inworld)
```

Identical to w35's numbers. Every one of the twelve died the same way:
`page.goto: net::ERR_CONNECTION_REFUSED` as an uncaught throw.

The item's other premise checks out too: `checks.mjs:1107` already reads
`r.status === 3` as `WRONG WORLD` rather than `FAILED`, so the suite was ready
for this and only the checks were not.

## What changed

Nothing was written that did not already exist. `scripts/lib/reachable.mjs`
already says *"A DEAD SERVER IS NOT A FAILED CHECK"* and already exits 3 with the
fix printed instead of a stack. The twelve simply did not use it. All **13 call
sites** (A-eye-height-holds has two) now read:

```js
await goto(p, URL);          // was: await p.goto(URL, { waitUntil: 'networkidle' })
```

Done as a **codemod** (`scripts/probes/w38-route-goto-through-lib.mjs`) rather
than 13 hand edits: the change is character-for-character identical everywhere,
and the failure mode of doing it by hand is a typo in exactly one file — which
would be the one check still reporting a dead port as a broken world, and the
hardest to spot. The full diff is 13 call sites and 12 imports and nothing else;
I read it line by line before committing.

## Both halves of DONE WHEN, demonstrated on one check rather than argued

Same check, same port, same instrument — only the world differs:

| world | exit | what it printed |
|---|---|---|
| **nothing serving 4192** | **3** | `THE CHECK NEVER RAN — nothing is serving …` |
| **live, deliberately broken** | **1** | `MEASURED WRONG — the player spawns in 301 and CANNOT USE ANYTHING IN IT` |
| **live, correct** | **0** | — |

The broken world is canfail's own registered `eye-gate-flat` mutation applied by
hand at `crosstown.ts:1579` (`apt.gy() + 1.6` → `1.6`), rebuilt and re-served.
**By hand and not through `canfail.mjs` on purpose:** canfail reports CAUGHT/SLEPT
on any non-zero status, so it cannot tell 1 from 3 — which is the entire question
this item asks. Mutation byte-verified with `git diff --numstat` (`1 1`), then
reverted and the check confirmed back to exit 0.

**Full sweep after the change: all 15 exit 3 on the dead port.**

## The change is status-neutral on a live world — and a trap I nearly fell into

Against a healthy, build-matched preview, before and after are identical:
**12 exit 0, and `mirror-walk`, `floaters-walk`, `L-every-stool-seats-you` exit 1.**

Those three reds are **pre-existing and not mine**. `mirror-walk` says so in its
own output — *"DO NOT ROUTE THIS YET … the left/right convention is not yet
checked against it. One of the two is wrong."* They are measured-and-wrong
verdicts, which is exactly the exit-1 case this item wants preserved, so they
double as evidence for the second half of the acceptance test.

**The trap:** my first attempt to prove they were pre-existing reverted the three
files and got **exit 3**, which looks exactly like "my change caused it". It was
not. I had committed in between, so `dist/` no longer matched HEAD and the
stale-build guard fired — a *third* meaning of exit 3 that has nothing to do with
the port. Rebuilding and re-running reproduced the same 12/3 split on both sides.
**A status compared across two different builds is not a comparison.**

## Found and NOT fixed — for the desk to queue

1. **`mirror-walk` and `floaters-walk` are red on a healthy world today**, and
   `mirror-walk` carries an explicit "do not route this yet" from its author: its
   new doorway detection and its left/right convention disagree and one of them
   is wrong. That is a real open question, untouched by this item.
2. **`w35-status-sweep.sh` does not pass the registry's `extra` args.**
   `L-slots-inworld`, `L-blackjack-inworld` (`['all']`) and
   `L-every-stool-seats-you` (`['twice']`) get them from `checks.mjs` but not
   from the sweep, so the sweep runs them in their default mode. It did not
   affect this item's answer — all three already exit 3 — but anyone reading
   sweep output as equivalent to suite output will be wrong.
3. **The remaining 14 fast-tier checks still have no failing path** (w35 cleared
   1 of 15). That is item 72's leftover, not this one's.
4. This item's row named **no files at all** — just prose. The 15 names came
   from w35's note; without it this would have started at an inventory. Rows
   that name a note are worth more than rows that name a symptom.

## Derived or copied?

**Derived.** The 15 names came from w35's registry-reading probe rather than
being retyped; the exit-3 behaviour is the shared helper's, not a reimplementation
in 12 places — which is the same fault as item 75's retyped smoothstep, in a
different costume.

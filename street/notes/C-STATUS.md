# Builder C — status at a glance

One screen, current as of 2026-07-25 18:30. Written because C's state was spread
over four notes and a stale queue file, and the desk re-briefed me three times on
work that was already in mainline.

## Everything C owns is landed and verified

Nothing of mine is unlanded. Every user row routed to C is closed in
`FEATURE-REQUESTS.md` with the number it was checked against. The items most
recently re-briefed to me, all in mainline:

| item | evidence |
|---|---|
| left row of cars backwards | heading derived per side of the aisle, `mirrorYaw(θ) = π − θ`; **18 of 18 nose-out** |
| cars clipping | OBB/SAT at real dimensions; closest pair **0.422 m**, closest to a fixture **0.290 m** |
| pole sign simpler | phone number dropped; CROSSTOWN 0.31 → 0.51 m, AUTO 0.31 → **1.19 m**; read at 13.7 m and 24.2 m |
| garlands disconnected | string endpoints on all four post tops to **0.000 m** (was 0.31); sag 8.5% of span |
| light well | real geometry, **1.9 m across x 1.2 m deep**, no far window, pipe untouched |
| 301 door | jambs **+0.020** each, head **+0.050**, undercut 0.030; the stand-back gate is gone, it never refuses |
| spawn in room 301 | walked bed → lobby: 5.40, 4.05, 2.70, 1.35, 0.00 |
| grass tufts | shipped as `ct/weeds.ts` for B and E rather than placed by me |

**Verified in all three builds**, not just dev: dev server, `npm run build` +
preview, and the packed `dist/artifact.html`. Six checks and the spawn walk green
in each, 0 console errors. `notes/C-entrance-report.md` has the runs.

## Not blocked — routed, with owners

Nothing is waiting on me. Each of these is a ledger row with measurements
attached; see `notes/BLOCKED-C.md` for the evidence.

| what | owner |
|---|---|
| `isSelfLit` holds ~40 printed sheets and one citizen at full daylight; and contradicts itself on identical citizens | **B** |
| `slow-pinned.sh` cannot start its server, so the whole slow tier is unrunnable by anyone | **H** |
| `reach.mjs` declares the world unwalkable, at exit 0 so it never goes red | **AUDIT** |
| `ctx.advanceTime` for "sleep in your room" | **DESK** |
| **`ct/lot.ts` has no owner** — most of the lot's user-facing surface lives in it | nobody to route to |

## The queue file is stale

`notes/queues/C-entrance.md` was last written at 10:58 and every item under its
"Now" heading has been delivered since. I only read that file; the desk writes
it. It is the most likely reason work already in mainline keeps coming back to
me as new.

## What I have been doing without a queue

Verification of my own shipped work, which has been worth it: it found a **third
gap in 301's door at the head** (0.025 m of lit hall over the leaf, invisible at
eye height and missed by two head-on screenshots), and it found that
`slow-pinned.sh` has been silently unusable. It also produced four findings I had
to withdraw after measuring — the lot chairs twice, an office sign overlap, and
an arrow direction. The pattern: my sign-offs are reliable when I measure and
unreliable when I look.

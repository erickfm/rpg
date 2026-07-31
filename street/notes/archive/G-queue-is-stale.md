# My queue file is stale — all ten open items, and what closed each

`scripts/live.sh G` reports **0 live, 0 awaiting a check**. My queue file
`notes/queues/G-interiors2.md` still shows **ten unchecked boxes**, last written
`63ef1ecf3`, 2026-07-25 20:49. The standing rule is *"If your queue file still
lists work, it is STALE — say so in a note rather than building it again"*, and
this is that note.

**The desk owns that file and I have not edited it.** This is the read-side
record so that neither the next builder nor a future me rebuilds any of these.
Every one is either landed and confirmed, or reassigned. **None of them is work.**

| line | item | why it is not work |
|---|---|---|
| 54 | LIBRARY INTERIOR moves to you | **REASSIGNED to builder J**, with all four library rows (partition, librarian, computers, entrance). I do not own `ct/int-library.ts`. |
| 83 | The CHURCH is 'locked' and the user wants in | **LANDED and CONFIRMED.** Unlocked, reversed-orientation fixed, narthex, crucifix, rear pews cleared, 0 overlapping fitting pairs, walked both ways. Pews since given an `approach` (`9f78b0b8f`). |
| 100 | The vertical blade signs read BACKWARDS (GOTCHAS §10) | **CONFIRMED, and re-evidenced by me on 07-26** after the auditor's sweep found the row resting on 32 characters. Both blades read from both ends of the street on asymmetric letters; guarded by two clauses in `G-vice-walk` with a `--selftest` positive control. |
| 129 | The casino interior must match that exterior's vibe | **LANDED and CONFIRMED**, then extended twice by later user rows: the entry row killed and the entry lounge added, slot flanks and tops painted, and the whole building renamed SEVENS. |
| 144 | The pawn shop is unreadable from inside | **LANDED and CONFIRMED.** Counter re-planned, and since raised from 0.47 to 0.71 objects/m² with the clock wall, the bicycles, the corner and the LOANS box. Its door leaf also fixed — it was eating its own exit prompt. |
| 180 | The casino and hotel EXTERIORS are yours | **LANDED and CONFIRMED.** Marquee, blades staggered, blade moved to the far end, lettering re-set for the shorter name and sharpened through `hardLayer`. |
| 236 | THE CASINO — GOLDEN ACES | **BUILT, and the name in this line is now wrong** — the user renamed it **SEVENS** on 2026-07-25 and I carried that through 52 occurrences in 28 files, verified in the built bundle. Anything still reading GOLDEN ACES in the queue or in `notes/` is history, not instruction. |
| 248 | HOTEL ORPHEUS lobby | **BUILT and CONFIRMED**, then rebuilt to answer *"rugs all over, off center and stuff, furniture strewn about. awful"* — carpet re-drawn as a half-drop damask, runner and ceiling squared, two deliberate seating groups. |
| 257 | PAWN SHOP interior | **BUILT.** Same room as line 144. |
| 264 | A-1 TAX SERVICE interior | **BUILT**, then given the working-office pass after *"the tax office is nearly empty"*, and its plant redrawn after *"whats wrong with this plant"*. |

## The two rulings in that file that ARE still live, and worth keeping

The file is stale on *tasks* but two of its notes are standing rules I still work
to, and they should survive whenever the desk rewrites it:

- **"match the exterior" never meant the dimensions.** *"by matching the exterior
  i really mean in general positioning. no one is going to take a ruler and
  measure the width of the inner and outer."* What must match is the door's
  situation, not the width, depth or ceiling height. GOTCHAS 45.
- **"cramped" is a statement about SHAPE, not area** — measure the largest
  continuous free run with `scripts/roomaisle.mjs`, not the square metres.

## What I am actually waiting on

One item, in `notes/BLOCKED-G.md`: the **church lancet window numbers** from the
desk, asked five times. Not stopping me — everything else in that room is built
and walked.

And two things routed away from me that I am not going to chase:

- **F** — 41 seats still at 0.00 m, burger 28 and diner 13, registered with no
  `approach` so the sit spot and the stand spot share a coordinate.
  `node scripts/G-seat-spot-clash.mjs` exits 1 while any remain.
- **desk / O** — `scripts/interiors-walk.mjs` **refuses to run world-wide** until
  the `jail` room is in its ROOMS list. That is the check behaving correctly
  (GOTCHAS 34) and it means nobody currently has world-wide interior coverage.

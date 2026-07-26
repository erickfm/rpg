# D's queue, item by item, with what each one measures at HEAD

**Line counts and citations in this file were re-verified after the three splits** — see GOTCHAS §44. `ct/street.ts` is 1002 lines now, not the 979 it was when the splits landed, and the ATM citation below had rotted into a different function.

`notes/queues/D-alley.md` has not been written since `eb936125e` and shows
eleven unchecked boxes. **None of them is work.** This note is the evidence for
that claim, one line of proof per box, so the desk can refresh the file in a
minute instead of re-deriving it.

Measured at build `cbbabdd3e` unless a row says otherwise. I am not marking
anything CONFIRMED — that is the desk's or the auditor's, never the builder's.

## `## Now`

| queue item | at HEAD |
|---|---|
| the cat is jammed in the corner | **CONFIRMED in the ledger** by the auditor, and superseded twice since — the cat is on its sixth position |
| the alley grate is lazy | **CONFIRMED in the ledger.** B exported `floorDrain()`, I drew nothing |
| the bank ATM is too high and does nothing | **LANDED.** `[E] FIRST FEDERAL — check balance` answers with the real purse (D-walk leg 5), screen 1.37, keypad 1.10. Both halves of the desk's ruling are in at `ct/bank.ts:134`, and the user's later revision of the fascia bottom to 0.75 at `ct/bank.ts:146`. **This cited `ct/street.ts:810` until now** — correct when written, wrong the moment I split the bank out of that file, and `citations-resolve` cannot catch it because line 810 still EXISTS (it is the EAST roster loop now). The check asserts the weak claim on purpose; this is the gap it leaves. |
| THE BANK FLANK — flat brown returns | **DONE in my file, and now done in G's too.** `0x53382e` appears on **zero faces anywhere in the world**; the twelve that survived the vice split are gone |
| set the open-site depths | **DONE.** `placePark` takes `depth: 32.0`; `placeLot` takes `depth: w`, so the lot is square BY CONSTRUCTION rather than by a constant that has to be kept in step with the frontage — which is what the item asked for |
| buildings are 3.4 m deep | **DONE**, including the two that did not travel with the vice split: GOLDEN ACES and HOTEL ORPHEUS both measure 14 m deep now, against the 3.4 recorded in the ledger |
| CAFE and HARDWARE become a used car lot | **DONE.** The roster entry is `'lot'` and C's `ct/lot.ts` is built on it |

## `## Next`

| queue item | at HEAD |
|---|---|
| the bodega corner bay has no shared rhythm | **ASSESSED, and it is three things not four** — `notes/D-bodega-corner.md`. The OPEN neon and the shopfront rhythm are already fixed; "panels at different widths" is the corner's brick piers, which is what a cut corner looks like; the paving is `ct/tex-ground.ts`, B's, and is written up with the user's own reference shot. **Nothing here is mine to build.** |
| signs — (a) GOLDEN ACES marquee | **G's** since the vice split, and G landed it (`Move the ACES blade to the far end of its own frontage`) |
| signs — (b) audit every other sign for the same | **DONE this session.** 46 meshes in the world carry a tilt about x or z above head height; exactly ONE declares surface `sign`, and it is the bodega awning I had just fixed. The rest are stair flights, banner stays, flagpoles and braces. No other sign in the world is tilted at all |
| shop resizing | **FOUR OF FIVE LANDED EXACTLY**, and the fifth is arithmetically incompatible with the other two at a 4.2 m band — the working is in `notes/D-shop-resize.md`. It needs a ruling, not a builder |
| window lights baked into `facadeTex` | **DONE.** `eveAt`/`lateAt` at `ct/street.ts:411` are two continuous curves across midnight driving the opacity of additive overlays: nothing at noon, full 20:00–22:30, a late tail to about four |
| move your `[E]` spots out of `crosstown.ts` | **DONE.** The hand-written `SPOTS` block is gone; the only `SPOTS.push` left in the entry point is inside `ctx.spot` and `ctx.seat` themselves, which is the registration API |

## The two things that are genuinely somebody's, and neither is mine

- **The corner paving against the canted bay.** `ct/tex-ground.ts` scores the
  corner diagonally, as a square 90° arris; the bodega cuts that corner off at
  45°. Neither is wrong alone — the interaction is. Written up with the user's
  own shot in `notes/D-bodega-corner.md`, for B.
- **The fifth shop-resize number.** 2.7 m of glazing cannot coexist with a 0.9 m
  sign band and a 0.35 m stallriser inside 4.2 m. What landed keeps the two
  dimensions a person reads against their own body and lets the glass take the
  shortfall. If that is the wrong trade it is a decision, not a bug.

## One thing I did NOT build, and why

The awning was the sixth facing bug, and the obvious response is a check. I did
not write one. Its population is **one** — the only tilted declared `sign` in
the world — and the other five instances of GOTCHAS §33 were an interior against
its facade, two mirrored blade signs, a mirrored row of cars and two people
facing the wrong way. Nothing that catches a tilted awning would have caught any
of those, so the check would guard a single object against a regression nobody
is likely to make, and `npm run checks -- --selftest` would report it green
forever. GOTCHAS §27's own argument: a check that cannot really fail is
decoration. Recorded rather than written, per §23 — a latent guard that is
written down costs nothing.

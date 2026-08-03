# Item 267 — the rail that cut across the entry way

Worker onehundredfive, 2026-08-03. Port **4611**, built bundle, hour 13 fixed
for every frame so before and after are comparable.

> The user: *"theres this here that cuts across the entry way."*

## Root cause, in one line

**A band drawn before an opening existed will not know to stop.** Item 196 cut
the party doorway through both flanks, but each room's horizontal banding is one
continuous box the full room depth, and nobody told it there is now a hole.

The row offered that as a lead and it is exactly right.

## It was TWO rails, not one — and he could only see one of them

| file | what | height | vs the 2.6 m opening |
|---|---|---|---|
| `ct/int-casino.ts` | brass rail, 0.09 m tall | **y 1.00** | crossed the doorway at waist height — **what he photographed** |
| `ct/int-hotel.ts` | picture rail, 0.07 m tall | **y 2.35** | crossed the **head** of the doorway |

The row asked me to *"check the OTHER side too … and the user is looking from the
casino"*, and that is precisely the situation: the hotel's picture rail has been
running through the top of the same opening the whole time, invisible to him
because he was standing on the other side of it.
`shots/w105-rail-hotel-head-on-before.png` is that line crossing the opening.

## The fix

Both rails break at the opening. **The gap is derived from `PARTY`** — the same
declaration `ct/interior.ts` cuts the hole from (`at: -9.0, w: 2.6`) — so the
break and the doorway cannot drift apart. Spans are written as spans and
converted to centre + length once, so there is no second chance to get a
half-length wrong.

**Which flank is the party wall is derived too**, not assumed to be −x:

> **⚠ item 268 is open against this same doorway's handedness** — *"the hotel is
> right of the casino outside and left of it inside"* — and its fix may re-hand
> this wall. Reading the side from `PARTY` means the break follows the opening,
> instead of leaving a broken rail on the wrong wall and an unbroken one on the
> right. The row warned about the collision; this is the cheapest way to be
> immune to it. **268 was TODO and unclaimed when I looked**, so there was nobody
> to coordinate with.

### The import that would have been a cycle

`ct/doors.ts` looks like the right home for shared door state and is a **trap**:
it eagerly globs `int-*.ts`, and every one of those imports only `type DoorDecl`
precisely so no runtime edge exists. A runtime import closes the cycle and
**GOTCHAS 28 drops the module from the BUILT BUNDLE ONLY** — source looks fine
and the world is broken.

`./interior` is a different matter: **both files already import it at runtime**
(`buildRoom`, line 4 in each), so `PARTY` rides an edge that has always been
there and adds nothing. Checked before writing it, then confirmed the only way
that counts — `npm run build` → `node scripts/health.mjs` → **WORLD OK**.

## The frames, and my verdict on them

| | before | after |
|---|---|---|
| casino, head-on | `shots/w105-rail-head-on-before.png` | `…-after.png` |
| casino, oblique | `shots/w105-rail-oblique-before.png` | `…-after.png` |
| casino, close | `shots/w105-rail-close-before.png` | `…-after.png` |
| hotel, head-on | `shots/w105-rail-hotel-head-on-before.png` | `…-after.png` |
| hotel, close | `shots/w105-rail-hotel-close-before.png` | `…-after.png` |

**I have looked at all of them.** Both rails now die into the gold architrave at
the reveal — brass into brass on the casino side, mahogany into brass on the
hotel side — which is how a real rail returns into a frame, and it is what the
row was worried about when it said *"a rail that stops flush at a bare edge can
read worse than one that runs through"*. It does not stop in mid-air; the
architrave was already there and catches it. The close-up
(`w105-rail-close-after.png`) is the one to look at: the two stubs meet the frame
at exactly the same height on both jambs. The entrance is no longer bisected.

> ### ⚠ THE SHOT PROBE SAVED THREE SOLID BLACK FRAMES ON ITS FIRST RUN
>
> A warp into an interior is not instantly a picture. Right after the warp
> `painted().triangles` read **982**; once the region cull had revealed the
> casino, the same station read **10 434**. A timeout is not a wait for a painted
> frame (GOTCHAS 78/80).
>
> `w105-rail-vantage.mjs` now waits for the triangle count to come up **and then
> looks at the pixels**, refusing any frame over 85% black with exit 2. An
> all-black before/after pair would have compared beautifully and meant nothing —
> and on a *looking* item that is the whole deliverable.

## Walked, not eyeballed

`scripts/probes/w105-party-doorway-walk.mjs` — **5/5 each way**, casino → hotel
and hotel → casino, coordinates read from `roomDims()` and `party()` so it cannot
walk at a doorway that has moved. Splitting one box into two puts two new meshes
either side of the threshold, and the cheap way to be wrong here is to have laid
one across it.

`interiors-walk.mjs` on the built bundle: **365/369**, the same four failures as
the baseline I measured earlier today for item 193 —
`jail: keeps its own light after dark`, and `casino`/`hotel`/`tax`:
`the customer station comes from the world, not from memory`. **Pre-existing, and
unchanged by this.**

## Found and NOT fixed

1. **The four `interiors-walk` failures above.** Two of them name the casino and
   the hotel, which are the files I touched — but they are identical to the
   baseline taken before this change, and the third names `tax`, which I did not
   touch. Three identical "customer station" failures look like one cause.
2. **Item 268 will move this wall** if it re-hands the doorway. The derivation
   above should carry the break across for free; whoever takes 268 should still
   re-shoot `w105-rail-vantage.mjs` from both sides, because "should" is not a
   measurement.
3. **Other rooms may have the same shape of bug and nothing looks for it.** Any
   continuous band on a wall that later gained an opening is the same defect;
   `PARTY` currently declares only one opening, so today it is only these two,
   but nothing would catch the third.

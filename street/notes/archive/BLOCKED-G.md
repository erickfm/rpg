# BLOCKED — builder G

**One item, and it is not stopping me.** Two of the three that were here have
landed while I was working and are struck out below with what closed them, so
nobody re-files them.

`G-rooms-walk` is **114/114** as of this note — the first fully green run — and
`G-vice-walk` is 18/18.

---

## 1. Window numbers for the church lancets — desk

Asked five times now, and the queue itself says to ask rather than read them out
of E's file: *"the windows must agree with the exterior E built — same spacing,
same heights. Ask through the desk rather than reading E's file for numbers that
may move."*

**Church — the lancets:** sill and head height above the interior floor, clear
width, count per wall, spacing. The rose is already in and sits at centre 6.6 in
the gable; if the exterior's rose is at a different height, that is the number I
need.

I checked whether these could be derived instead of asked. A's `Frontage`
publishes `glazingBottomM` and `glazingTopM` through `frontageOf()`, which would
have been the right authority — but that is the shopfront layout system and
`ct/civic.ts` does not use it for either civic building. So the route is closed
and the numbers have to come from the desk.

The library half of this ask is gone from here: `ct/int-library.ts` is builder
J's now, and the arched-window numbers go with it.

Everything else in the church is built and walked.

---

## ~~2. `room.person()` does not forward `seated`~~ — CLOSED

Landed upstream in `1c588e78e`, "room.person() takes H's seated pose; and the
standing half was already done", and tagged in `b86e98165`. The kit takes it now,
so the church's praying figure and anything else in a pew can stop being a
standing sprite scaled down.

My rooms reached the pose without it, through the public `room.put` plus the same
LATE frame hook `person()` registers — four slot players, one on the casino's
entry banquette. Those can migrate to `person()` now that it forwards the flag;
noting it rather than doing it in the same breath, because it is a refactor of
working geometry and a user request outranks it.

## ~~3. The kit's default landing sits inside its own way-in reach~~ — CLOSED

I filed this as "one number in `ct/interior.ts`" — `spotOnStreet.z + 1.5` giving
1.566 m against a spot live to `r + REACH_MARGIN` = 1.65 m, so pressing `[E]` to
leave a shop dropped you where `[E]` put you straight back in.

**The measurement was right and my proposed fix was the wrong one.** It was closed
upstream in `4d50e8a1a` and `04f28e031` by HYSTERESIS instead: a spot you have
just used is latched off until you have physically left its volume. That is the
better answer, because moving the landing only fixes the rooms somebody remembers
to move and the latch fixes every door in the world, including ones nobody has
built yet. F's note names the same regression I did and traces it to the same
cause, `REACH_MARGIN` 0.6 from *"widen the volumes"*.

I had also bumped `int-hotel.ts` and `int-casino.ts` from 1.55 to 2.05 m along
the walk before that landed. Keeping it: it is correct on its own terms and the
two mechanisms do not fight. Not extending it to the other rooms, because the
latch already covers them and a second authority for the same property is how
these things drift.

# BLOCKED — builder E

**Blocked on: one ledger row whose two instructions contradict each other.**
Everything else I own is landed. This is not a stall — it is a decision I am
not entitled to make alone, because whichever way I go I am overriding
somebody.

## The row

`park: "some way to represent a grass field" (mowing stripes)` — the last
genuinely open item routed to me.

## The contradiction

| source | instruction |
|---|---|
| the **auditor**, on the row | *"widen them so one band is legible at close range"* |
| the **desk**, ruling of 19:41 | *"cut the contrast hard and **narrow** the bands"* |

I followed the desk, as the later instruction and the one quoting the user's
own frame. Measured on the mown texture (16 px/m, so a band's width in texels
IS its width in metres), with a positive control that reproduces the old
numbers:

| | contrast | band |
|---|---|---|
| before | 11.4% | 1.65 m |
| **now** | **6.9%** | **1.03 m** |

Widening now would undo a change the desk asked for by name three hours ago.

## The auditor's other two options, and why neither is open to me

1. **"Carry the stripes to the entrance lawn."** There is no entrance lawn of
   mine. What you stand on between the gate and the loop is the site's grey
   slab — `openSite` in `ct/street.ts`, **D's**. My field is the panel inside
   the loop, and it is striped.
2. **"Clear the entry sightline."** Measured at the auditor's own station,
   **(−9, −72)**: the gate spur is at **z −83** and the war memorial stands at
   **(−9.55, −73.03)**. That station is **1.1 m from the memorial and 11 m from
   the gate** — beside the railings, not at the way in. The *"grey mass filling
   the left third of frame"* is the memorial from a metre away. From the actual
   gate the view down the field is clear.

   `shots/E-grade/entry-auditor.png` — their station.
   `shots/E-shelter2/day-gate.png` — the gate.

   I raise this carefully: the auditor withdrew their own CONFIRMED on this row
   for judging from a chosen viewpoint rather than the one a player arrives at.
   That correction is right, and it applies in both directions.

## What unblocks it

One word. **WIDEN** and I widen the bands and tell the desk their ruling was
overridden; **NARROW** and the row is already done and can be marked. Either is
a one-line change and I will take whichever I am given.

## Meanwhile

The other live row, `public library still says pv`, is not blocked on a
decision — it is waiting on **F**. My half (the frieze) reads `PUBLIC` and is
verified; the two remaining player-visible strings are in `ct/civic-doors.ts`
and `ct/int-library.ts`, which the desk told me not to reach into.

_Builder E, 2026-07-25 21:15._

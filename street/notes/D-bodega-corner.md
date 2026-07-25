# Bodega corner bay — unblocked, assessed, started

`BLOCKED-D` withdrew the "blocked on A" claim: `HI`, `reveal`, `proud`, `glazed`
and `mullions` are all exported from `ct/tex-world.ts` (lines 973-1009). This is
mine to do.

## The four reported defects, checked against the bay rather than the note

Shot from the door stand point, `/tmp/bod-a.png`:

| reported | at HEAD |
|---|---|
| *"OPEN neon still over glass rather than over the door"* | **already fixed** — the neon sits in the door's upper panel |
| *"panels at different depths and widths"* | **real** — the pier left of the door is narrow, the one right of it is visibly wider |
| *"kick plates at three different heights"* | **real** — the door's base panel, and the stallrisers either side of it, sit at three levels |
| *"the sidewalk scoring runs under the building"* | **real** — the paving joints run straight into the wall base |

So one of the four is done and three stand. Worth saying, because the item reads
as four and is three.

## Corrected: two of the four are already done, not one

**The shopfront rhythm is fixed and the code says so in the past tense.** The bay
painter at `street.ts:~1188` reads: *"Every panel used to sit at its own depth
and its own width, with three different kick-plate heights, so the bay read as
several unrelated fronts jammed into a corner. Now there is one fascia line, one
opening, one reveal depth, one cill and one stallriser running the full width."*
Built from A's `proud`/`reveal`/`glazed`/`mullions`, which is what the item asks
for. The photograph agrees — one fascia, one opening, one stallriser.

What I read as "panels at different widths" in my first pass is the **brick
piers** either side of the recessed door, which are the corner's structure
(R1/R2 in the plan comment), not shopfront panels. Different object, and it is
what a cut corner looks like.

## The scoring: measured, and it is not geometry

No ground plane extends under the bodega. Every ground-facing plane overlapping
its footprint (x 7..10.4, z -96..-86):

```
civic  x[7.00,9.60] z[-86.00,-68.00] y 0.140
```

— E's, north of the bodega, touching only at the z = -86 boundary. **Nothing is
under the building.** So the scoring does not "run under" it in the sense of
geometry poking through; the walk texture's joint grid is continuous and the
building sits on it wherever it happens to land, so joints meet the wall at
arbitrary offsets. That is a texture-alignment question between B's paving and
my building line, not a plane clipping through.

## Where that leaves the item

Of the four reported defects, **two are already fixed** (the OPEN neon, the
shopfront rhythm), one is a misreading of the corner's structure, and one is a
real but different problem from the one described. Worth the desk knowing before
more time goes into it.

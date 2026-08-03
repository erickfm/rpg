# w64 — the flaky casino-light leg, and the three places the pattern also lives

Item 192. Port: **4201** (dev). `interiors-walk` cannot run against a built
preview at all — it imports `doors.ts` inside the page, which is item 164 and is
recorded in the file already.

> Worker sixtyfive: *"I nearly reported the 0 as my fix."*

## The cause, and there were TWO of them

`scripts/interiors-walk.mjs`'s leg 6 sampled every non-transparent material
within 8 m of the room's centre into a flat array and compared
`noon.filter((c, i) => night[i] !== c)`. **By array index.** It returned 109,
109, 110 and then 0 across four runs of the same source.

Index N was not the same material twice for two independent reasons, and the row
names only the second:

1. **THE ROOM MOVES.** The sample is a box, not a list of objects, and citizens
   walk in and out of it between the two samples. One extra mesh at the front of
   the traverse shifts every index after it, so the comparison silently pairs a
   bulb against a coat. This is what produces a wholesale number like 109.
2. **THE BULBS ANIMATE.** The casino's marquee chases on its own clock, so a
   bulb legitimately differs between two samples taken at the same hour.

## The fix

**By material identity, and the animated set is derived rather than listed.**

- The sample is now a map keyed by `material.uuid` — what makes a material the
  same material — and only materials present at *both* hours are judged. A
  citizen who walked out of the box is not a dimmed surface.
- **Four samples are taken at each hour with the clock held still**, and a
  material that is not identical across all four is excluded as self-animating.
  Nothing here has to know which meshes the casino chases, and the exclusion
  stays correct if somebody animates something new.

**Two samples were not enough, and that is measured rather than assumed.** My
first fix took one extra sample 450 ms after the first: still flaky, three reds
in five runs, every one of them `2/58 dimmed` with `0 excluded as
self-animating`. Two samples 450 ms apart can land on the same phase of the
chase and agree. Four spanning ~1.5 s cannot.

**And a population floor**, because every exclusion above is a way for the
sample to shrink and a leg that passes on an empty set is the failure this whole
row is about (GOTCHAS 34). The floor is `max(8, 50% of what was sampled)` —
a fraction of what was actually there, so it scales with the room rather than
being a typed count.

## Proof

**Five runs in a row on unchanged source, identical every time** (the row is
explicit that a single green run is not evidence here):

```
 ok   casino: the room keeps its own light after dark
 ok   casino: …and it judged enough of the room to mean anything
```

Six earlier runs of the same build gave `0/58` five times and `0/56` once — the
`56` being two bulbs caught mid-chase and correctly excluded. **The verdict is
constant; only the size of the excluded set moves, which is the exclusion
working.**

**And it still goes red for the right reason.** The file's existing
`--selftest` walls every declared door shut, which reddens the ENTRY legs and
says nothing about leg 6 — so a rewrite of leg 6 could have passed the selftest
while measuring nothing. The selftest now also hands interior meshes to
`scene.userData.addLit`, `ct/props.ts`'s one runtime way into the night grade,
so the dimmer's own registry takes them:

```
selftest: handed 2625 interior meshes to the night dimmer — leg 6 MUST now go red
FAIL  casino: the room keeps its own light after dark
      55/56 interior materials dimmed by the night sweep (2 excluded as self-animating…)
```

**The first version of that mutation missed.** It took the first 40 interior
meshes past `x = 300` and the casino stayed green, because those 40 were in
somebody else's room. It is aimed at the room centres `__ct.roomDims()`
publishes now, at the same 8 m box leg 6 samples.

## THE FIXED CHECK IMMEDIATELY FOUND A REAL DEFECT — the jail

The full suite is **325/330**, and leg 6 is green on eleven of the twelve rooms.
**The jail is red at a stable `1/97`** — three separate runs, `0 excluded as
self-animating, 0 not steady at both hours`, so it is neither a moving object
nor a chase phase. The population floor passes on all twelve.

`scripts/probes/w64-jail-dimmed.mjs` names it:

```
#f0f3f6 -> #b3b7ba   at (1006.37, 2.42, -5.6)  BoxGeometry
    userData.graded=false  selfLit=true
    geometry: {"width":0.04,"height":0.44,"depth":0.8}
```

A 0.8 m × 0.44 m panel 40 mm thick at 2.42 m up — a light fitting's diffuser on
the jail wall. **It carries `userData.selfLit = true`, so it has DECLARED itself
a light source, and the night sweep dims it to 0.746 anyway.** That is the exact
class `ct/props.ts` records paying for once already: *"A LIGHT REGISTERED
THROUGH lit() WAS BEING DIMMED LIKE MASONRY … The payphone's backlit header
graded to 0.0933 at 23:00 with the enamel beside it, which is the opposite of
what it is for."*

**The old by-index version could never have reported this.** One material out of
97 is far below the index-shift noise floor that produced 109 and 110, and the
run that returned 0 would have called the jail clean. **A flaky check was not
merely noisy here — it was hiding a defect.** This wants its own row against
`ct/int-jail.ts`; it is not mine and I have not touched it.

The other four reds are **pre-existing and self-documented** — casino, hotel,
pawn and tax fail *"the customer station comes from the world, not from
memory"* with *"no served-spot published in this room … see
F-keeper-stations-audit.md"*. My diff contains zero lines mentioning that leg.

## ⚠ THE PATTERN IS IN THREE MORE PLACES, TWO OF THEM REGISTERED CHECKS

The row asks for this explicitly, and it is the real size of the problem.

| file | line | registered? |
|---|---|---|
| `scripts/G-rooms-walk.mjs` | 977 — `noon.filter((c, i) => night[i] !== undefined && night[i] !== c)` | **YES**, `checks.mjs:742`, slow tier |
| `scripts/G-vice-walk.mjs` | 400 — `day.dull.filter((v, i) => nite.dull[i] !== undefined && nite.dull[i] !== v)` | **YES**, `checks.mjs:741`, slow tier |
| `scripts/O-jail-night-probe.mjs` | 56 — `if (night[i].hex !== noon[i].hex)` | no, a probe |

`G-rooms-walk.mjs` is the same line, character for character, over the same
kind of sample. It is **partly** protected — it has a population floor of 40 and
a positive control, and its own comment records reasoning carefully about a
short second sample — but **neither of those addresses the pairing**: a floor
proves the sample was big, not that index N is the same material twice. Its four
rooms sample 441, 155, 137 and 123 materials, so an index shift there is a much
bigger number than the casino's 109.

I did not touch any of the three. They are not named by this item and each wants
its own row; the fix is the one above and it transfers directly.

## Found and NOT fixed

1. **The three sites above.** `G-rooms-walk` is the urgent one — it is
   registered, it is slow tier so it runs less often and is watched less, and
   its populations are 4x the casino's.
2. **`interiors-walk` still cannot run against a built preview** (imports
   `doors.ts` in the page). That is item 164, recorded in the file, untouched.
3. **The jail's self-lit diffuser**, above. `ct/int-jail.ts` and `ct/props.ts`,
   not mine, and the most valuable thing this row produced.
4. **The suite takes over twenty minutes on a loaded machine**, so the five-run
   stability proof was run against the `casino` room alone (and three more
   against `jail`), with the whole suite run once. That is the right trade but
   it is worth saying out loud. Note also that redirecting the suite to a file
   block-buffers its output — the file stays at the header for the whole run and
   then lands at once, which looks exactly like a hang.

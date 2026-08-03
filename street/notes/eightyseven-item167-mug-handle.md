# eightyseven / item 167 — the mug handle, third report

**The user, three times:** *"mug looks messed up"* → *"the mug is messed up"* →
*"mug handle still looks off, please try."*

**The item's instruction was to stop measuring and LOOK.** I did — and looking is
what found the cause, which then turned out to be measurable in one line.

---

## Root cause, one line

**The handle was painted in the colour of the surface it is seen against.**

Item 108 fixed the *geometry* and fixed it correctly. It then chose the handle's
*tone* by reasoning about what would be behind it, and **wrote its assumption
down in its own note**:

> *"It is close to the sill's `0xa8a091`, which would matter if the handle were
> ever seen against the sill; **it is not, because it hangs 27–84 mm above it
> with the window behind.**"*

**It is seen against the sill.** He does not look at the mug level — he stands at
the window and looks **down** at the sill at close range, at a pitch of **22°–49°**
across the three stations. From there the sightline past the handle, *and through
its hole*, lands on **the sill top**, not on the dark glass.

**Measured in the rendered pixels of his own frame**, not argued:

| | |
|---|---|
| sill `#a8a091` in the at-sill crop | **6,921 px — the most common colour in the frame** |
| handle `#a79f8f` | **176 px** |
| difference | **(1, 1, 2) out of 255** |

The world is unlit `MeshBasicMaterial`, so **material colour IS rendered colour** —
there is no lighting to rescue it. A 176-pixel object drawn in its background's
colour is not a handle. **The shape was right and simply could not be seen**,
which is exactly why two rounds of structural verification passed while the user
kept saying it looked wrong.

## What changed — `ct/apartment.ts`, the sill block

| | was | now | why |
|---|---|---|---|
| handle colour | `0xa79f8f` | **`0xd0c9ba`** | reads against the sill instead of vanishing into it |
| `H_R` | 0.022 | **0.028** | ring 58 → **70 mm** against a 95 mm cup — a mug's real proportion |
| offset | `MUG_R + (H_R − H_TUBE)` | same **− `HANDLE_BITE` 0.010** | sinks the ring **24 mm** through the wall, was **7 mm** |

**Contrast, channel-sum against the two things it must separate from:**

```
handle vs SILL   4  ->  122      the cup itself gets 149, and reads fine
handle vs CUP   53  ->   27      still enough to round the form, no longer a seam
```

**Painting it as ceramic rather than as a separate part is the point.** Separating
the handle from the *cup* was never the problem — a real handle **is** the same
ceramic, and what says "handle" is **the hole**, not a tonal seam. What has to
separate is the handle from its **background**. It now reads for the same reason
the cup already read.

**The 7 mm bite is the other half.** At this range 1 mm ≈ 0.25 px, so the old
ring overlapped the cup by **under 2 pixels** — which is why a handle that was
*genuinely joined* (item 108 proved it) still read as a hoop parked beside the
cup. At 24 mm the two ends visibly merge into the wall.

**Item 108's fix is NOT reverted.** `|hole axis · offset| = 0.0000` still, and
the probe still reports **ATTACHED: yes**. Footing unchanged: 0.0000 m on the
sill top, 0.172 m clear of the nearer end, fully on the sill.

## My verdict on the pictures — which is what this item asked for

I looked at all three stations, **1:1 and cropped**, before and after, plus a 16×
nearest-neighbour blow-up of the handle region so I was judging pixels rather
than an impression.

- **At the sill (53 × 52 px, his actual vantage):** before, a faint pale smear
  merging into the sill line, hole indistinguishable. After, **an unmistakable
  ceramic loop with an open hole**, merging into the cup top and bottom. It reads
  as a coffee mug.
- **Mid (39 × 38 px):** reads cleanly as a mug.
- **Spawn (26 × 25 px, the hardest):** before, a ghost. After, **a crisp loop with
  a visible dark hole.** This is the one I was least sure would survive and it does.
- **Full 1:1 frame from his standing position** (`w60-mug-after-atsill.png`): the
  handle reads as a handle in the unmagnified frame, which is the item's
  done-when.

Shots: `shots/w60-mug-{before,after}-{spawn,mid,atsill}.png` and the `-crop`
pairs. (`shots/` is gitignored — these are on my worktree's disk only.)

**I did not touch the cup.** He has never complained about it, and the item says
not to gold-plate it. Segment counts are unchanged for the same reason: in an
unlit world segment count buys silhouette only, and at 26 px the 6/14 ring
silhouette is already smooth.

## ⚠ AN INSTRUMENT THAT NOW PRINTS A FALSE CONCLUSION — reported, not silenced

`scripts/probes/w60-mug-geometry.mjs:137` prints:

```
the HOLE spans 0.0280…0.0700 from the axis: PARTLY BEHIND THE CUP — the hole will not read
```

**That conclusion is false, and the pixels disprove it.** The hole spans 42 mm of
which **32 mm (76%) is open daylight**; only the inner 10 mm falls behind the cup
wall — **which is what a real mug handle looks like**, its hole bounded by the cup
on the inside. The magnified frames show the hole reading clearly at all three
distances.

The probe treats *any* partial occlusion as fatal, because it was written when
the design put the hole's inner edge exactly **on** the wall. **It needs a
threshold (what fraction of the hole is open), not a binary.**

**I did not change it.** It is not registered in `checks.mjs` or `package.json`,
so it gates nothing, and it is outside this item's named file (BUILDER-BRIEF §9).
**Loosening a check so my change passes is the forbidden move** — so this is
reported for the desk to queue instead. It is a one-line fix to that probe.

## Suite

`npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**. `node scripts/health.mjs`
**WORLD OK, exit 0**, build `de5bb65f5`. `npx tsc --noEmit` **clean**.

## Found and not fixed

- The probe's false hole conclusion, above.
- **A note for whoever gets the fourth report, if there is one.** The remaining
  weakness is that the handle is pale-on-pale where it crosses the **cup**
  (channel-sum 27). That is deliberate — it is one piece of ceramic — but if he
  still says "off", the next lever is a *darker* handle (separating from cup and
  sill both) at the cost of looking like a different material. I chose the
  realistic reading over the maximally-legible one, and that is a judgement the
  desk can overturn cheaply: it is one hex value.

## Derived or copied

**Derived where it matters.** `HANDLE_OFF` is still computed from the cup
(`MUG_R + (H_R − H_TUBE) − HANDLE_BITE`), so the handle follows the cup if the
cup ever changes — the new `HANDLE_BITE` is a named, commented offset rather than
a retyped position. The contrast figures are **measured from the rendered PNGs**
with PIL, not computed from the hex values I intended, so they describe what was
actually drawn. The sill colour `0xa8a091` is cited from `ct/apartment.ts:1966`
rather than assumed.

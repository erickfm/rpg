# The four fronts the user named, measured against each other

The user: *"we need much better facades for the tax service, diner, burger
barn, thrift shop, casino, and hotel especially."* The casino and hotel are E's.
Of the four that are mine, only the **diner** had ever been stood in front of —
`notes/A-diner-facade-look.md` and `notes/A-diner-facade-fixed.md` cover it.

This is the other three, and the useful move was **measuring the whole street
before touching anything**, rather than looking at each front in turn and
forming an opinion.

## The measurement that found them

Modal tone across each shop band's mid rows, at 13:30, against a sky at luma
**149**:

```
BURGER BARN   234   BRIGHTER than the sky by 85    one tone over 22.3%
A-1 TAX       209   BRIGHTER by 60                 one tone over 46.8%
DINER          85   ok                                          17.0%
LIQUOR         49 · CHOP SUEY 49 · DELI 49 · RECORDS 49 · GARAGE 49
BILLIARDS      49 · SMOKES 49 · LOANS 49 · RADIO 49
THRIFT         44 · PAWN 39
```

Two shops sat 150 luma clear of the other twelve. **They were exactly the two
of the four I had not looked at**, and the comparison said so in one table —
which no amount of staring at either front on its own would have.

## What was wrong, and it was the same thing both times

**Outside is brighter than inside.** Both fronts were painting an interior
surface as though it were lit from the camera's side.

**A-1 TAX** — vertical blinds at `#cfd2c8` drawn evenly across 12 m of window.
A slat lit by an office fluorescent, seen from a sunlit street, is a mid grey.
And a blind the file itself calls *"permanently half-shut"* is never even across
a whole shopfront; one panel is always pulled back, which is where the depth
comes from.

- slat tone set by measurement: **209 → 127**, below the sky
- one panel **drawn back** onto a desk, a chair and a filing cabinet
- a few slats hang at other angles so the run cannot read as a printed pattern
- single-tone coverage **46.8% → 25.5%**, in line with the street

The drawn-back panel sits at the end **furthest from the door**, derived from
`doorAlongU` rather than fixed — the lesson the diner's glass block taught,
where a side was chosen by a constant and nothing recomputed it when the door
moved.

**BURGER BARN** — the backlit menu was `bw2 = (c - a) - 0.6`, the whole glazing
run, so on a 16 m frontage the brightest surface in the world was an unbroken
seven-metre band of `#f2ead0`, twice. A backlit menu *is* a light source; what
it should not be is the length of the shop.

- bounded to 4.2 m, anchored at each run's door-side end, where the counter is
- split by dark stiles so it reads as a made object
- modal **234 → 62**; brightest tone over 2% of the mid rows **234 → 210**, its
  coverage **22.3% → 11.7%**

**Checked the night behaviour**, because shrinking a lit object is exactly how
you would silently lose it. `ct/props.ts` decides what carries its own light by
looking at the sheet — `mx > 199 && mx - mn > 26` over 8% of texels (GOTCHAS
22). Still **36.11%** passes, because the red light-box fascia dominates that
count rather than the menu, and 210 still clears `mx > 199` with chroma 41.

## What I did NOT touch, on purpose

**THRIFT** now measures the brightest large tone on the block: **220 over
10.7%**. It is a window crammed with white price cards, the auditor has
confirmed that front, and nobody has complained about it. GOTCHAS 23 — a front
that measures bright because it is FULL is not the same defect as one that
measures bright because it is EMPTY. Recorded rather than churned.

Same reasoning as leaving A-1 TAX's navy mouldings alone in the joinery commit.

## The diner's door leaf, finally

Left undone when the diner work landed and flagged as the weakest thing on the
front. Its bottom 0.85 m was one flat fill with a cream stripe. It is now a
frame: stiles, a lock rail with its shadow, a kicked kick plate, a push bar
with brackets, an hours card taped inside the glass.

**The alignment check went blind and said so**, which is the part worth keeping.
`A-diner-door-aligns` samples a row it expects to be plain steel; the new kick
plate took that row, so the predicate stopped matching and it **aborted with
exit 3** rather than reporting a failure. The door had not moved. A `1` there
would have sent someone hunting an alignment bug that does not exist. The row
moved, not the tolerance, and the header now records all three rows that have
been wrong and how each failed.

## Artifact

`street/dist/artifact.html`, **891,678 bytes**, build `36b3b91d7`.
`check-artifact` opens it standalone: `__ct` up, 5075 meshes, mean luminance
61.2. **Handed to the desk to publish**, per the queue.

**Does it still earn its keep?** The queue asked. My answer: *marginally, and
only as a keepsake.* Pages auto-deploys on push and is current; the user
playtests `localhost:5177`; the artifact is a hand-packed 0.9 MB single file
that goes stale the moment anything lands and has to be republished by hand.
Its one real advantage is that it is a fixed, shareable snapshot that cannot
break — worth keeping for exactly that, worth republishing at milestones rather
than on a queue item. That is a recommendation, not a decision; the desk owns it.

## Scripts

- `scripts/A-shopfront-look.mjs "<SHOP>"` — the diner look script with the shop
  as an argument, because four fronts were named and one had been looked at.
  `A-diner-front-shots.mjs` stays, since two notes cite it.
- Nothing new is registered in `checks.mjs`. I deliberately did **not** turn
  the brighter-than-sky table into a check: the only threshold that passes
  today's street is one tuned to today's street, and GOTCHAS 27 is explicit
  that a tolerance set by argument measures your patience rather than the
  world. It stays an investigation you run and read.

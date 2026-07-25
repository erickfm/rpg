# Builder A — the mirror harness could not run, and only knew three rooms

Landed in **`c064a9b2`**, `scripts/mirror-walk.mjs`.

## Why I went back to it

The queue item *"Interiors and exteriors must agree on HANDEDNESS"* ends with a
clause I had only half satisfied:

> **Verify it the way the user did**: stand inside, note which side the door is
> on, walk out, turn round, and confirm it swapped. Do that for **every room,
> not just the tax office** — the user asked for all buildings.

I verified four rooms by hand and wrote them up. I never went back for the rest,
and I had stopped re-reading the item — the third time in three turns that work
was sitting in my own queue behind an assumption that it was done.

## Two reasons it was verifying nothing

**It could not run.** `await import('/src/proto/ct/doors.ts')` inside the page
resolves against a **dev server only**. Against `vite preview` — what `SHOT_URL`
points at and what every other check uses — it threw before testing anything.

**Its room list was a hardcoded table of three**, with widths, centres and sides
typed out. There are eight rooms; five declare doors. The user asked for all
buildings.

Both answered by asking the world: rooms from `__ct.doors()` joined to
`__frontages`, and the stand point from `doorStandFor` via `d.stand` instead of
`side * (FACE - 0.75)` — a guess that had stopped working, so every room failed
*"could not get in to check"*.

## The part I nearly got wrong

Mid-fix it printed **"5/5 rooms do not mirror"** — while four of those five are
verified mirrored by walking them (`A-mirror-verified.md`). It had not found
their doorways. It had disproved nothing.

**"Could not measure" is not "does not mirror",** and conflating them is how a
harness earns a reputation for crying wolf. It reports them separately now, and
a doorway further from the room centre than the room's own half-width is treated
as a failed measurement rather than a finding.

## Where it stands, honestly

```
4 of 5 UNMEASURED — the doorway scan inside is still the weak half
1 of 1 measured rooms does not mirror: PAWN
```

I would rather ship it saying "I could not measure four of these" than have it
quietly pass, or quietly fail, on all five.

## Second pass (`86d14c2f`): entry fixed, scan still weak

BURGER BARN was landing at **x −6.3** — still on the pavement, never inside —
and being reported as *"could not locate the doorway inside"*. A single `E`
press takes sometimes and not others, and the guard meant to catch that read
once and trusted it. Two tries with a re-warp between, and a miss is reported as
a miss. **All four previously-unentered rooms now get in.**

That moved the failure rather than removing it. The doorway scan still misses in
four of five. Rather than guess, the measurement for whoever finishes it — DINER,
from the running world:

```
room x 674.4 .. 685.6, cx 680.0, roomW 10.8
back wall   [674.4, 685.6]  z -3.68 .. -3.50   full width
front wall  [678.0, 685.6]  z  3.50 ..  3.68   PARTIAL — gap is 674.4 .. 678.0
also spanning [678.9, 684.8] z  1.74 ..  3.36   furniture in front of the wall
```

The doorway is the missing 3.6 m of front wall at the low-x end. The scan line
at `maxZ − 0.28 = 3.40` sits inside the collision pad of that **furniture**
collider as well as the wall's, which is my best explanation for an empty run —
**a hypothesis, not a finding.** I have not tested it, and saying which is which
is the point.

### What is fixed and worth having now

- five rooms discovered instead of three hardcoded
- runs against `preview` at all — it was dev-server-only, i.e. never
- enters reliably, and says so when it does not
- reports *"could not measure"* separately from *"does not mirror"*, so it
  cannot claim four verified rooms are broken

## One real finding: PAWN

The first measurement ever taken of that room — it was unreachable until the
`[E]` work landed.

- its **declared** door is at world z **−60.50**
- its frontage runs −68 .. −53, so the centre is **−60.50** — the declaration is
  exactly centre
- its **room** builds the doorway **6.23 m to one side**

So the room is not putting its door where the room itself declared it. In range
and therefore not an artefact: PAWN's frontage is 15 m, so ±6.9 m is valid.

**F's or G's to confirm.** I have not touched it.

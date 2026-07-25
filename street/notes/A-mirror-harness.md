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

## Third pass: the scan method is NOT the problem — a negative result

I said the likely cause was the scan line sitting inside the furniture
collider's pad, and called it a hypothesis. **Tested, and it is wrong.**

I rewrote the scan to stop probing free space entirely and instead read the gap
in the **front wall colliders themselves** — union their x spans, and the doorway
is what the room's width has that the wall does not. No radius, no furniture,
no air.

**The same four rooms still come back empty**, and PAWN's reading shifted only
slightly (`lx −6.23 / 1.35 m wide` → `−5.95 / 1.9 m`). Two independent methods
failing on exactly the same four rooms is not a scan problem: the common inputs
are `cx` (the room centre) and `hd` (the front wall's z), and one of those must
be wrong for those four while being right for PAWN.

**I reverted it.** It is arguably the more principled method, but committing a
change that does not improve the outcome and that I cannot explain is how a file
accumulates plausible-looking code nobody can reason about later.

What the next attempt should do, and should not repeat: instrument `cx` and `hd`
per room and print them, rather than changing the scan again. Both scan methods
are now known good on PAWN and known useless on the other four, so the fault is
upstream of both.

## The false green, and PAWN withdrawn (`96d8e049`)

**The worst thing in this file was the summary line.** It read

```js
fails.length ? "N do not mirror" : "all N rooms mirror"
```

so a run that measured **nothing** printed *"all 5 rooms mirror"* — a green
verdict from zero evidence. I watched it do that while trying a third scan
method. For a harness whose whole job is answering *"the user asked for this on
every building"*, that is the worst failure available: **a check that cannot see
is indistinguishable from a check that has looked.** It says so now, and exits
non-zero.

### What the third attempt measured, before I reverted it

```
the diner's front wall is TWO pieces; the doorway is the gap between them
  [674.4, 676.8]  z 3.50..3.68
  [678.0, 685.6]  z 3.50..3.68
  doorway 676.8 .. 678.0  —  1.20 m
```

**Free-space probing cannot work here.** A 1.20 m doorway minus the 0.36 m
player radius each side leaves 0.48 m, and a frame or threshold closes it — the
scan finds no free run at all. Both of my earlier explanations, furniture pads
and then `cx`/`hd`, were wrong about the mechanism. Three wrong guesses; the
data settled it in one run.

And the thing that hid the wall from me twice: **the left-hand piece is 2.4 m
wide**, so any filter keeping only colliders that span most of the room throws it
away and takes the doorway with it.

### ~~PAWN~~ — withdrawn

I reported last turn that PAWN's room builds its doorway 6.23 m off its declared
centre. **Not confirmed, and I am withdrawing it.** PAWN's two spanning
colliders are both at **negative z**, so `hd` resolved to −2.52 and the
"doorway" measured was in the **back wall**. It was the one room that appeared
to measure, and it was the one measuring the wrong wall.

## The answer, in one run, once it printed what it saw (`832d2651`)

Three attempts, three wrong explanations, all because the failure printed one
word: *"could not locate the doorway inside"*. I made it print the wall it
found instead, and the diagnosis arrived immediately:

```
DINER    front wall z 3.68, 5 pieces
         [674.4,674.6] [674.4,676.8] [676.8,678] [678,685.6] [685.4,685.6]
A-1 TAX  [913.9,914.1] [913.9,915.2] [915.2,916.4] [916.4,926.1] [925.9,926.1]
```

**The doorway has its own collider.** `[676.8, 678]` is 1.20 m and sits exactly
where the diner's door is. **There is no gap in the wall to find** — which is
why every method failed, mine included: all three were looking for *absence*,
and the thing they were looking for is *present*.

That also retires my previous explanation. I said free-space probing could not
work because 1.20 m minus two 0.36 m radii leaves 0.48 m. True, and **not the
reason** — the reason is that the doorway is solid to a collider query at all.

### What the next attempt must do differently

Identify the door **piece**, not a gap. `__ct.doors()` publishes `widthM` per
building, so the candidate is the piece whose width matches the declared door.

**Not free:** A-1 TAX has pieces of 1.3 m and 1.2 m side by side, so width alone
is ambiguous there. Something else — the piece's z depth, or which side of it you
can stand — has to break the tie. Recording that rather than guessing a fourth
time.

## Found it (`e7a23bdd`): the doorway is a collider standing proud of the wall

```
DINER    wall z 3.50..3.68   door [676.8, 678.0] z 3.68..3.86  w 1.15
A-1 TAX  wall z 4.25..4.43   door [915.2, 916.4] z 4.43..4.61  w 1.15
```

The door leaf sits **one wall-thickness further out** than the wall plane, so
its `minZ` is the wall's `maxZ`. Exact, and it breaks the tie width alone could
not — A-1 TAX has a 1.31 m wall piece beside its 1.15 m door, and only the door
starts where the wall ends. The declared `widthM` then confirms it.

**Rooms measured: 0 → 4 of 5.** PAWN is still unmeasured, its front wall still
reading at z −2.52, which is the back wall — a separate fault.

### And the result CONFLICTS with hand verification, so it is not a finding

The harness now calls all four measured rooms **SAME SIDE**.
`A-mirror-verified.md` records those same four — A-1 TAX, diner, Burger Barn,
THRIFT — walked by hand **with shots**, each mirroring correctly.

**One of the two is wrong and I have not determined which.** The doorway
detection is new and measured; the *side convention* is the untested half:
`observerRight = side < 0 ? -1 : 1` outside, `sign(gap.lx) * -1` inside. A single
sign error would flip exactly these four and nothing else.

The script prints that conflict in its own output and tells the reader **not to
route it**. I am not going to assert a defect over my own verified evidence, and
I am not going to quietly suppress the disagreement either — the next person to
run this must see both halves.

**This is the next thing to do here:** validate the side convention against the
four hand-verified rooms. If the convention is wrong, four rooms are fine and the
harness needed one sign flipped. If the convention is right, four rooms are
backwards and my earlier walk-through read them wrong.

## RESOLVED (`bc717cf8`): the harness could never have passed

I refused to route the conflict last turn because it contradicted verified
evidence. Resolving it took one measurement.

All four rooms build the doorway at exactly **minus** the local `at` their own
declaration implies:

```
BURGER BARN  declared  3.6   measured -3.6
DINER        declared  2.6   measured -2.6
A-1 TAX      declared  4.2   measured -4.2
THRIFT       declared  2.2   measured -2.2
```

Exact to the decimal — a **convention difference, not a placement fault**. And
that made the algebra checkable. Substituting `lx = −side·offset·k` into the
inside expression `sign(lx) · −1` gives `side · sign(offset)`; the outside
expression is `sign(offset) · observerRight` with `observerRight = side`.

**The same value.** Two identical expressions compared for disagreement can only
ever agree, so this script reported SAME SIDE for **every room it ever measured**
— including four already walked with shots and found correct.

One sign, and it independently confirms the hand verification:

```
BURGER BARN  outside RIGHT | inside LEFT   SWAPPED ✓
DINER        outside RIGHT | inside LEFT   SWAPPED ✓
A-1 TAX      outside RIGHT | inside LEFT   SWAPPED ✓
THRIFT       outside RIGHT | inside LEFT   SWAPPED ✓
```

**That satisfies the queue item's verification clause** — *"do that for every
room, not just the tax office"* — with something re-runnable, rather than four
screenshots and my word.

## 5 OF 5 (`309d84d9`) — and PAWN was never wrong

```
BURGER BARN  outside RIGHT  | inside LEFT    SWAPPED ✓
DINER        outside RIGHT  | inside LEFT    SWAPPED ✓
PAWN         outside centre | inside centre  SWAPPED ✓
A-1 TAX      outside RIGHT  | inside LEFT    SWAPPED ✓
THRIFT       outside RIGHT  | inside LEFT    SWAPPED ✓
```

**The queue item's verification clause is satisfied** — every declared room,
re-runnable, not four screenshots and my word.

Finding PAWN's front wall took two wrong rules, and they were **the same wrong
rule twice**:

| rule | why it failed |
|---|---|
| "the widest collider" | PAWN's room is 13.8 m; its front wall is pieces narrower than half that, so all were discarded and the search fell back to the **back** wall at z −2.52 |
| "the plane holding the most wall" | the back wall is one unbroken piece; the front is two pieces summing to slightly less. Regressed all five rooms to zero — tried, seen, reverted inside the turn |

**That is where the withdrawn PAWN finding came from.** "Its door is 6.23 m off
the centre it declared" was the back wall being measured. Withdrawing it last
turn on the grounds that it was unconfirmed was right, and now it is settled:
PAWN's door is dead centre inside *and* out.

What works is the thing being looked for: **the front wall is the plane with a
door standing on it.** The leaf sits proud, `minZ` on the wall's `maxZ`, and only
the front wall has one. **No width filter anywhere** — a width filter is what hid
the doorway three separate times.

## The coverage claim was wrong (`994426ea`)

`5 of 5` is a statement about five. **The world has eight rooms.**

The harness can only reach rooms whose door reaches `declaredDoors()`, and it
was printing *"all 5 rooms mirror"* as though that settled the ask — which was
*"this should be done for all buildings"*. It now names the gap in its own
output:

```
5 declared rooms to check: BURGER BARN, DINER, PAWN, A-1 TAX, THRIFT
  NOTE: the world has 8 rooms. 3 cannot be checked here
  because their door never reaches declaredDoors() — see doors-declared.mjs.
  "All declared rooms mirror" is not "the world mirrors".
```

### CORRECTED (`05f3cd99`): one reason for three rooms, wrong for two

`9c4fa019` corrects me — the casino's `DOOR` **does** reach `declaredDoors()`,
measured twice, at `709ddfed` and `cb696d3d`. And my scope line claimed all
three unreachable rooms shared that reason. Wrong twice over:

| rooms | actual reason |
|---|---|
| 2 | **canted bays** — the bodega and the hotel, deliberately never handed to the painter. Design, not a fault |
| 1 | a declaration that did not arrive |

Calling a deliberate exclusion a missing declaration invents a fault out of a
decision someone made on purpose. The scope line computes all three now instead
of asserting one.

**On the remaining one, for whoever owns `ct/doors.ts`:** it reproduces at HEAD —
7 of 8, six runs, including detached at the same commit. Not intermittent *here*.
`9c4fa019` measured 8 of 8 seven commits earlier, so it regressed inside that
range rather than being absent. Which is exactly that note's own framing: the
dependence is on module evaluation **order**, so "it works at my HEAD" and "it
fails at yours" are both true and neither settles it. Its recommended fix — move
the lookup into a leaf that globs nothing — removes the dependence rather than
the symptom, and should land regardless of who measures what.

I checked whether my own commits caused it. **My branch is mainline** — the desk
has landed everything — so there is no version without them to compare against.
The honest answer to "did I do this" is not "no", it is "unanswerable from
here", and that is worth saying rather than implying the first.

### ~~GOLDEN ACES, named for its owner~~ (mechanism stands, presence corrected)

`scripts/doors-declared.mjs` is red on it: the room declares a door that never
arrives. `ct/int-casino.ts` imports a **value** from `ct/doors.ts` —

```ts
import { doorStandFor, type DoorDecl } from './doors';
```

— where its siblings import `type DoorDecl` only, which erases at build and
creates no runtime edge. The value import makes a genuine cycle, so its
namespace is undefined when the eager glob is read and its `DOOR` is skipped.

**One caveat I am not going to skip:** `ct/int-hotel.ts` imports the same value
and *does* arrive. So the cycle is necessary but not sufficient, and whoever owns
that file should establish why before assuming the fix.

### ~~Why this matters on my side~~ — I got this wrong, corrected in `eedeacff`

I wrote that GOLDEN ACES *"gets a painted door wherever the painter would have
put it, while its room has one somewhere else"*. **That is wrong, and I did not
check it before writing it.**

`GOLDEN ACES is not in the frontage register at all` — there are 16 frontages
and it is not one of them. My painter paints no door for it, so the
painted-vs-room disagreement I described does not exist.

The `doors-declared` failure is still real: the casino's `DOOR` never reaches
`declaredDoors()`, so the `[E]` census and anything driven by it does not know
that building has a door. **But the consequence I attached to it was invented.**

`FrontageWorld.doorDeclared` now records which facades were told and which
guessed, which is the flag that would have told me before I wrote it:

```
declared (5):  BURGER BARN, DINER, THRIFT, A-1 TAX, PAWN
fell back (11): LIQUOR, BODEGA, FLOWERS, CHOP SUEY, DELI, RECORDS,
                GARAGE, BILLIARDS, SMOKES, LOANS, RADIO
```

**Second time this week I reasoned a consequence into existence rather than
measuring it** — the diner's blank wall was the other, and that one reached
another builder before I caught it.

Not my file, not fixing it. Naming it precisely, and making my own check stop
implying coverage it does not have.

### One more bug found in passing

`__ct.pos()` is `[x, y, z, gy]`, and this passed `inside[1]` — **eye height** —
as the player's z to the collider filter. It had been asking "within 12 m of
z = 1.6" for every room. Latent only because every room sits near z = 0.

### ~~PAWN, the one left~~ (closed above)

Still unmeasured. Its front wall reads at z −2.52, which is its **back** wall:
the room has no front-wall colliders where the other four have them. A real
difference in that room, and the last thing between this and 5 of 5. Not mine to
fix — recorded for whoever owns it.

### The lesson, which cost three turns

I changed the *method* three times and the *diagnostics* once. The diagnostics
change is what solved it, and it was the cheapest of the four. **A check that
fails with one word will be debugged by guessing** — and I did exactly that,
having spent this week telling other people's tools to name what they found.

## ~~One real finding: PAWN~~ (superseded — see above)

The first measurement ever taken of that room — it was unreachable until the
`[E]` work landed.

- its **declared** door is at world z **−60.50**
- its frontage runs −68 .. −53, so the centre is **−60.50** — the declaration is
  exactly centre
- its **room** builds the doorway **6.23 m to one side**

So the room is not putting its door where the room itself declared it. In range
and therefore not an artefact: PAWN's frontage is 15 m, so ±6.9 m is valid.

**F's or G's to confirm.** I have not touched it.

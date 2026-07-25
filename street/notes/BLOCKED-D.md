# Builder D — blocked on one thing, and it is a bug I put there

`7b100b65` closes its bodega tally with *"canted bay → **no `__frontages`
entry** → prompt off the walk line → trigger disc centred in the recess. Four
anomalies, one cause."*

I went to publish that missing entry. **There is one already, and it is worse
than missing: it describes the wrong face.**

## Measured, both channels, same build

```
__frontages BODEGA   axis "x"  loWorld 10.4  hiWorld 16.45  facePos -96
                     frontageM 6.05          doorWorld 12.82

doorStandFor('BODEGA')                       (7.47, -95.53)
```

Those are not the same door. They are not even the same wall.

- `__frontages` describes the bodega's **side-street wing** — `BODEGA_WING`
  6.05 m, placed by my `placeBldZ(FACE + 3.4, -94.3, …)` at x 10.4 → 16.45
  facing z = −96 — and puts a door at x 12.82 on it.
- The bodega's actual customer door is on the **canted bay** at (8.0, −95.0),
  normal (−√½, −√½), which is what `DOOR.face` declares and what
  `declaredDoors()` publishes.

**They are about 5 m apart.**

### How bad, measured rather than asserted

I wrote "anything deriving a trigger disc, a stand point or a camera from
`__frontages['BODEGA']` aims at a blank shopfront". Checked it, and it wants
qualifying twice:

**Nothing reads it today.** `frontageWorld()` has no callers outside
`ct/tex-world.ts`, and `__frontages` appears exactly once elsewhere — in a
`crosstown.ts:611` comment which already says the quiet part: *"`__frontages`
is A's and covers flat shopfronts only, so the BODEGA — whose door is on a
canted bay and is deliberately never handed to the painter — was invisible to
anything auditing doors."* The `doors:` affordance beside it exists to cover
exactly this case. So the wrong entry is **latent, not live**.

**And it is not aimed at a blank wall.** Shot the wing square on: it is a
proper shopfront — BODEGA sign band, glazing, stallriser, crates outside — with
a painted door roughly centred. The frontage entry describes that wall
accurately.

So the defect is narrower and stranger than I first wrote: the wing carries a
**painted door you cannot open**, and the frontage published under the name
`BODEGA` points at it. Nothing is broken until something believes it.

## Whose

**Mine.** `ct/street.ts` calls `placeBldZ` for the wing with `nm: 'BODEGA'`,
and the shopfront system registers a frontage under whatever name it is given.
The wing legitimately *displays* the name — it is the bodega's side elevation
and its band reads BODEGA correctly — but it should not be the thing that
answers "where is the bodega's door".

## Why I cannot just fix it

`Placement` (`ct/tex-world.ts:322`) is axis-aligned by construction:

```ts
axis: 'x' | 'z';  loWorld / hiWorld;  facePos;  outward: 1 | -1;  uDir: 1 | -1;
```

A 45° face has no `axis` and no single `facePos`. So the bay cannot register a
frontage that is *correct*, and the choice is between three things I should not
make alone:

1. **Stop the wing claiming the name** — ~~one line in my file~~. **It is not.
   I checked, and this is the thing that decides the whole item.**

   `b.nm` drives BOTH ends:

   ```
   ct/street.ts:936   shopfrontTex(b.brick, b.nm, …)     paints BODEGA on the band
   ct/street.ts:933   shopfrontRelief({ name: b.nm, … })
   ct/tex-world.ts:744  registerFrontage(o.name, …)      registers under BODEGA
   ```

   So renaming the wing to stop it answering for the bodega also **repaints its
   sign**, and the sign is correct — the wing IS the bodega's side elevation and
   should read BODEGA. There is no way to separate the two from my file.

   The smallest thing that would work is an **optional `frontageName` on
   `shopfrontRelief`'s options**, defaulting to `name`: additive, no existing
   caller changes, and the wing then passes `frontageName: 'BODEGA WING'` or
   opts out of registration entirely. That is `ct/tex-world.ts` — A's file and
   A's API shape, not something I should decide by writing it.
2. **Teach `Placement` about a canted face** — an `angle`, or a
   `(origin, along, outward)` vector form. Correct, reusable, and A's type in
   A's file.
3. **Let `declaredDoors()` be the answer for cut faces** and have consumers
   check it — it already carries `face: {x, z, nx, nz}` and already returns
   the right point for BODEGA today.

My preference is 1 now and 2 when someone is next in that type — 1 removes a
wrong answer immediately, which is worth more than adding a right one later.
But 1 alone will make a tool that expects nine frontages find eight, so it
wants saying out loud rather than doing quietly.

**Who:** the desk to pick, A if it is 2. **Not urgent** on the evidence above —
but it becomes urgent the moment `7b100b65`'s shared door-disc arithmetic is
written, because that is a consumer, and it is the one thing that would make
this live.

## Not blocked, and worth folding in

`7b100b65`'s proposed fix — derive every door spot from the published frontage,
radius reaching the kerb and stopping — cannot include the bodega under any of
the three options except 2. Under 1 or 3 the bodega needs its own arm, which is
the thing that note was trying to eliminate. Worth knowing before someone
writes the shared arithmetic and finds it is shared by eight.

---

## The audit found the same thing from the other side, and it agrees

`request-audit.md` §"One gap in the roster itself": *"The BODEGA has no
published frontage. Probing (6, −95.4) … returns nothing from `__frontages`,
while every other shopfront I probed resolves."*

Both true, and worth reconciling because they imply different fixes: there IS a
BODEGA entry, and it does not cover the bay. Probing the bay finds nothing;
probing by name finds the wing. "No frontage" and "a frontage on the wrong
wall" look the same from a point probe and are not the same bug.

The audit also anticipates the state option 1 would produce and accepts it in
advance: *"a roster that covers every shopfront but one is still a large
improvement, and the one it misses is the one shaped differently … but a future
finding on the bodega's face will come back `(no frontage covers it)` and look
unattributable when it is not."*

So the consumer who would most notice the missing entry has already said the
missing entry is preferable to the wrong one — provided it is written down,
which this note is.

---

## `10f8da2d` withdraws "no frontage" — and this blocker is NOT what it closed

The auditor has corrected their own claim: *"I reported twice that the BODEGA
has no published frontage and built a narrative on it… One of those three
[probes] was my own bug."* Their probes assumed every frontage was axis-z and
compared a z coordinate against an x span, so `route.mjs` returned "(no
frontage covers it)" for one that covers it perfectly well.

That matches what I measured, and my note already anticipated the confusion:
*"'No frontage' and 'a frontage on the wrong wall' look the same from a point
probe and are not the same bug."*

**So the existence question is settled and the placement question is untouched.**
The entry is real, it is axis-x on the side street's north face at z = −96, and
its `doorWorld` is **12.82** — the wing's painted door, the one that opens onto
nothing. The customer door is on the canted bay at (8.0, −95.0), which is what
`declaredDoors()` publishes and what the `[E]` uses.

Anyone reading `10f8da2d` alone would reasonably conclude the bodega frontage
item is closed. It is not. What changed is that one of the three reasons the
bodega looked odd was an artefact; the other two — the canted bay having no
representable `Placement`, and the frontage naming the wrong door — are the
ones this file is about, and neither has moved.

**Still needs the same decision**: an optional `frontageName` on
`shopfrontRelief` (A's file), or a `Placement` that can express a 45° face, or
a documented rule that `declaredDoors()` is the answer for cut faces.

---

## `eba406e1` makes the wrong answer DETECTABLE — which changes which option is cheapest

`FrontageWorld.doorDeclared` now records whether a frontage's door came from a
room's declaration or from the painter's fallback layout. Measured at HEAD:

```
BODEGA frontage:  { doorWorld: 12.8234, doorDeclared: false }
16 frontages, 5 with doorDeclared
```

**So the bodega's frontage door is not merely on the wrong wall — it is flagged
as a guess.** x 12.82 is where the painter would put a door on a 6.05 m
frontage, not where any room said its door is. The bodega's room declares its
door on the canted bay through `DOOR.face`, and that declaration cannot reach a
frontage whose `Placement` has no way to describe a 45° wall.

That does not close this item — the entry still answers for the bodega and
still points at the wing — but it changes the shape of the risk and therefore
the cost of each option:

- **Option 3 (document that `declaredDoors()` is the authority for cut faces)
  just got much cheaper.** A consumer no longer has to know about the bodega
  specifically; it can check `doorDeclared` and decline to trust any frontage
  door that was guessed. That is a general rule with a general signal behind it,
  which is what was missing when I wrote the three options.
- **Option 1 (stop the wing claiming the name)** still needs the
  `frontageName` split, because `b.nm` drives paint and registration together.
- **Option 2 (a `Placement` that can express 45°)** is still the only one that
  produces a *correct* entry rather than an absent or ignorable one.

My preference has moved to **3 now, 2 whenever someone is next in that type**.
1 buys least: it removes a guessed answer that is already labelled as a guess.

Still the desk's call, and A's if it is 2.

---

## Timing: the contract is being handed to F, and it does not mention cut faces

`cb696d3d` publishes `notes/A-frontage-signature.md` — the exact frontage export,
extracted from source, *"for the desk to hand to F"*. It is a good document and
it carries `doorDeclared` with its meaning spelled out.

It mentions `declaredDoors`, `cut face`, `canted` and `bodega` **zero times**.

That matters right now rather than eventually, because F is about to build
against it. What a reader takes from that contract today:

```
__frontages is where a shop's door is.
doorDeclared tells you whether a room said so or the painter guessed.
```

Both true. What is missing is the third case:

```
For a CUT FACE the room DID say — and its answer is not in this record at all.
It is in declaredDoors() / doorStandFor(), because Placement cannot describe
a 45° wall.
```

Without that, `doorDeclared: false` on BODEGA reads as *"no room declared this
door"*. The room declared it precisely; the declaration simply cannot reach a
frontage whose `axis` is `'x' | 'z'`. A consumer following the contract
faithfully will conclude the bodega has no authored door and either use the
painter's guess at x 12.82 — the wing's decorative door, 5 m from the real one —
or skip the shop.

**One sentence in that document would close it**, and it is A's document:

> A shop whose door is on a cut face has no representable `Placement`, so its
> door is not here. `declaredDoors()` is the authority for those.

This is not a new blocker and it does not change the three options. It is the
same item, arriving at the moment it is cheapest to fix — before a second
consumer is written against the gap rather than after.

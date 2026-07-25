# Builder F — nothing is blocked

**Every item on this page is resolved or withdrawn as of 2026-07-25.** I am
leaving the file rather than deleting it, because how the two live ones ended
is the useful part: neither was fixed by the owner I routed it to. One was
already gone when I re-measured, and one never had the evidence I claimed.

Both rested on the SAME arithmetic slip — subtracting the player capsule from
one side of a comparison and not the other, or quoting a figure without a
control that reproduces it. I filed both as "measured rather than guessed",
which was true and not sufficient: a measurement compared against the wrong
thing is a guess with a number on it.

Nothing here needs anyone's attention. **Do not action items 1 or 2.** One OPEN DECISION is recorded at the bottom —
it is not blocking me and it is not mine to settle.

---

## 1. RESOLVED — the post is gone, and my number was the wrong unit anyway

Re-measured 2026-07-25. **There is no collider within 1 m of (50.0, −97.65)
any more**, and the narrowest continuous standable band anywhere across the
casino frontage (x 44…56) is **1.30 m**, with no x position under 1.00 m. That
is measured with the 0.36 m capsule inflated on both sides, so it is room the
player actually has. Somebody's encroachment work removed it.

**And the way I stated it was wrong, which is worth more than the fix.** I
wrote:

> there is 1.15 m between them — **0.43 m of standing room** once the 0.72 m
> player is subtracted … tighter than the **0.90 m** squeeze the auditor's
> triage calls the tightest in the world.

Those are two different units. The auditor's row reads *"leaves 0.90 m of walk
… 0.90 m against a 0.72 m capsule is the tightest squeeze in the world"* — a
RAW GAP, quoted against the capsule, not with it subtracted. Builder B uses the
same convention: *"1.15 m against a 0.72 m capsule is comfortable."*

So the comparable figure for my pinch was **1.15 m, not 0.43 m** — and
`AUDIT-TRIAGE.md` records the tightest walk in the world being raised *to*
1.15 m as the fix that closed the whole encroachment audit. Mine was not
tighter than the tightest; it was exactly the value the audit had just
celebrated reaching.

Subtracting the capsule and then comparing against a number that had not been
is the same mistake as §2 below: an arithmetic step applied to one side of a
comparison. Both of my open blockers turned out to rest on it.

**If you quote a clearance on this project, say whether the capsule is in it.**

## 2. The church flight — MY MEASUREMENT DOES NOT SUPPORT MY CLAIM

**Re-measured 2026-07-25 and I am withdrawing the number, not renewing it.**

I filed this as "the flight stops 0.44 m short of its doors", blaming
`placeChurchEast`'s footprint box in `ct/street.ts` for eating the upper
landing. Re-running the same sweep over BOTH civic forecourts on a 0.25 m grid:

```
church    114 raised cells,  60 standable,  stand out to x  9.00, ground ends  9.50   -> 0.50 m
library   238 raised cells, 156 standable,  stand out to x 11.50, ground ends 12.00   -> 0.50 m
```

**The library shows the identical 0.50 m**, and the library is the flight I
verified reaching its doors — it climbs 0.14 -> 0.99 and back down, and its
locked-door prompt at the top is reachable and answers.

0.50 m is what the 0.36 m capsule costs you against a wall face. You cannot
stand inside a wall, so the last half-metre of any raised ground that runs up
to a building is unstandable on both flights, working or not. It does not
distinguish the two, so it is not evidence of anything.

**What that means for the claim.** I have now been wrong about this forecourt
twice in the same way — once probing a single point and declaring the whole
thing unreachable (corrected in `edc034d`), and now with a figure that the
control case reproduces exactly. The honest position is that I do not have a
measurement showing the church is defective.

What is still TRUE and unexplained is the proportion: the church has 47% of its
raised cells unstandable against the library's 34%, and the church tops out at
gy 0.55 where the library reaches 0.99. Either of those could be the two
flights simply being different flights. Neither is a defect I can demonstrate.

**So nobody should act on this.** D should not go cutting a hole in a
deliberate footprint box — its comment records that a missing one let you walk
through the nave — on the strength of a number its control case also produces.
If the church forecourt is wrong, it needs diagnosing again from scratch, by
someone who can say what the intended top of that flight IS.

The locked-door prompt at the top answers today, from where the flight ends,
so a player is not standing in front of a silent building either way.

---

## RESOLVED — the flights lead somewhere now

I had this filed as "needing a decision, not a fix", with the recommendation
already written: a locked-door response rather than two more rooms. That was
wrong twice. It was not blocked on anyone, and the user had already made the
call — *"Do NOT leave a flight of steps that leads to nothing."*

Done in `ct/civic-doors.ts` (`0ecfd662`). Both doors answer; `claimed()` hands
the door over automatically the moment a real room registers for that
building, so E's library interior needs no coordination with me.

Note the church's prompt sits at its doors and is reachable **today**, from
0.44 m short of them — so blocker 2 below no longer costs the player a
response, only the last stride. It is still worth fixing.

---

## 3. RESOLVED — the descriptor could describe a side-street frontage all along

I wrote this up as needing a type change: `DoorDecl` carries `cz` and
`side`, computes along z, puts the normal on x, and GOLDEN ACES and HOTEL
ORPHEUS front the side street laid out along x facing −z.

It needed reading my own type properly, not changing it. `face` — a world
point plus an outward normal — was added for the bodega's canted bay, and it
is not a chamfer special case: it is the GENERAL form, and the main block's
`cz`/`side` is shorthand for the common one. `doorPointFor` already derives
one from the other. Both side-street rooms now declare with `face`, using G's
own already-walked door positions, so all eight rooms publish and nothing
moved.


---

## OPEN DECISION — the door guard runs in the mode where the bug cannot happen

Not a blocker, and not something I can close on my own. Written here because it
is the one hole left in a subsystem I own.

`scripts/doors-declared.mjs` is the check that catches a declared DOOR failing
to reach `declaredDoors()`. It is registered in the DEFAULT tier of
`npm run checks`, which runs against `$SHOT_URL` — a dev server.

**The bug it guards is bundle-only.** Circular imports resolve differently in a
build; GOLDEN ACES's door was dropped in the bundle while dev reported all
eight, and the check says so itself:

```
mode: DEV SERVER (unbundled ESM)
  WARNING: dev resolves circular imports differently from the bundle.
  This check has read 8 of 8 in dev and 7 of 8 in the bundle at the same commit.
  The bundle is what ships — measure that.
```

So `npm run checks` can report `✓ doors-declared` while a door is missing from
the artifact the user plays. The row asserts the question was answered; in dev
it was not.

**Why I have not just fixed it.** The three obvious moves each cost something
that is not mine to spend:

1. **Make it exit non-zero in dev.** Then the default suite is permanently red,
   which is the fastest way to teach people to stop reading it — GOTCHAS 27.
2. **Move it to the slow tier under `PINNED_MODE=preview`.** Correct, and it
   takes a check that is currently seconds and puts it behind a flag almost
   nobody passes.
3. **Have the runner set the mode per check.** The right answer, and it is a
   change to how `scripts/checks.mjs` invokes things — shared, and a desk call.

**What exists meanwhile.** `PINNED_MODE=preview ./scripts/slow-pinned.sh
doors-declared` answers it properly against a built bundle, in about a minute,
and is green at HEAD: 8 declare, 8 arrive, zero undefined namespaces. The cycle
that caused the original drop is cut, so the risk today is latent rather than
live. It stops being latent the moment a non-`int-` module declares a door.

My recommendation is (3), and (2) as a stopgap that someone must remember —
which by this project's own history is the weaker half of the pair.

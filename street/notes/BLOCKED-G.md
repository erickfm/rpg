# BLOCKED — builder G

Three items, none of them stopping me: I am building the hotel and the pawn shop
meanwhile. The previous version of this file was deleted by the desk in
`bbf6076ae` when the library stair unblocked, which was right for that item and
took the window ask with it — so this is that ask restated plus two new ones.

The library items are gone from here: `ct/int-library.ts` moved to builder J.

---

## 0. THE KIT'S DEFAULT LANDING IS INSIDE ITS OWN WAY-IN REACH — one number, F's kit

**This is a shipped behavioural bug in every interior that does not override the
landing, not a tooling complaint.** You press `[E]` to leave a shop, arrive on
the pavement already being offered the way back in, and a second `[E]` bounces
you straight inside.

`ct/interior.ts:1105` puts the flat-frontage landing at

```ts
{ x: (fr ? fr.side : -1) * (FACE - 1.2), z: spotOnStreet.z + 1.5, ... }
```

The way-in spot is at `side * (FACE - 0.75)` on `spotOnStreet.z`, so the two are
`hypot(0.45, 1.5)` = **1.566 m** apart.

**A spot's reach is not its radius.** `fp.ts:425` adds `REACH_MARGIN = 0.6` on
top of `r` — added deliberately, from the user's *"easier in general. Widen the
volumes."* So an `r 1.05` door is live out to **1.65 m**, and the landing is
inside it by **8.4 cm**.

Measured, not argued:

| room | landing → way-in | reach | |
|---|---|---|---|
| pawn | 1.566 m | 1.65 m | inside by 0.084 |
| tax  | 1.563 m | 1.65 m | inside by 0.087 |

**The ask is one number: `+ 1.5` → `+ 2.1`** on that line, which gives
`hypot(0.45, 2.1)` = 2.148 m and clears by half a metre. It is along the walk,
so the sacred 2 m lane is untouched.

**Why I am not working around it.** I could declare explicit `outX`/`outZ` in
`int-pawn.ts` and `int-tax.ts`. That means copying `FACE - 1.2` and
`spotOnStreet.z` — derived kit geometry — into two rooms, and the next time the
frontage moves those two rooms are left behind while the other eight follow.
Same shape as `doorLeafFor()` and `person()`; same answer.

I fixed the two rooms that already own their landing, because there the number
is mine: `int-hotel.ts` and `int-casino.ts` went from `+1.55` to `+2.05` along
the walk. **This also means the other builders' rooms have it** — anything using
the kit default, which is most of them.

**Costing me:** `G-rooms-walk` is 110/114, and all four red are these two checks
on pawn and tax. They have been red for a while and I had answered them by
hand-measuring against `r` alone, which is how a real bug survived a real check
for several sessions. Written up in full because that mistake is worth more than
the fix.

---

## 1. `room.person()` does not forward `seated` — one line, F's kit

H landed the seated pose in `b6bd1dfd9`: `citizenSprite(look, { seated: true })`,
with the origin moving to the hip so a room places a sitter on the seat it has
already registered and never computes an offset.

I cannot reach it. `ct/interior.ts:1169` builds every room figure as:

```ts
const s = citizenSprite(look, { facing: o.facing ?? 0, h: o.h, w: o.w });
```

`seated` is not in `person()`'s option type (`:427-431`) and is not passed.
**The ask is one line in each place** — add `seated?: boolean` to the options and
forward it.

**Why I am not working around it.** I could import `citizenSprite` directly and
re-implement what `person()` does: `put` the mesh at y 0 and register the LATE
frame hook myself. That is kit internals copied into a room, and the next change
to how figures are placed would leave my church behind. Same shape as calling
`doorLeafFor()` from a room instead of reading the room's own declaration — which
my own harness caught me doing, with the reason that it drops the building's door
from the bundle.

**Waiting on it:** the church's praying figure, my only seated one, still a
standing sprite scaled to `h: 0.62`. The casino's 120 stools have no occupants
and need none — the user asked for stools, not players.

---

## 2. Window numbers for the library and the church

Asked four times now, and the queue itself says to ask rather than read them out
of E's file: *"the windows must agree with the exterior E built — same spacing,
same heights. Ask through the desk rather than reading E's file for numbers that
may move."*

**Library — the high arched windows:** sill and head height above the interior
floor, clear width and the arch's rise, how many, on which walls, and their
centres.

**Church — the lancets:** sill and head height, clear width, count per wall,
spacing. The rose is already in and now sits at centre 6.6 in the gable; if the
exterior's rose is at a different height, that is the number I need.

I checked whether these could be derived instead of asked. A's `Frontage` now
publishes `glazingBottomM` and `glazingTopM` through `frontageOf()`, which would
have been the right authority — but that is the shopfront layout system and
`ct/civic.ts` does not use it for either building. So the route is closed and the
numbers have to come from the desk.

Everything else in both rooms is built and walked.

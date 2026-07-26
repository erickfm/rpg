# BLOCKED — builder G

Two items, neither stopping me: I am building the casino residual meanwhile. The
previous version of this file was deleted by the desk in `bbf6076ae` when the
library stair unblocked, which was right for that item and took the window ask
with it — so this is that ask restated plus one new one.

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

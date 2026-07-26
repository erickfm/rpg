# I MOVED FOUR ROOMS 80 m, and my handoff said I had not

**For the desk, against the open row *"~15 CONFIRMED rows cite interior
coordinates that now name a different room"*.** From O. **I am a direct cause of
part of it and this is me saying so with the numbers.**

## The measurement

Interior slabs are handed out in **path-sorted order** by `ct/interior.ts`'s
glob of `./int-*.ts`, 80 m apart from x = 400. `int-jail.ts` sorts between
`int-hotel.ts` and `int-library.ts` — **not last**. Measured by building the
world with the file present and with it moved out of the tree:

```
                    WITHOUT int-jail.ts     WITH it        moved
  bank                        440              440           —
  bodega                      520              520           —
  burger                      600              600           —
  casino                      680              680           —
  church                      760              760           —
  diner                       840              840           —
  hotel                       920              920           —
  jail                          —             1000          new
  library                    1000             1080         +80
  pawn                       1080             1160         +80
  tax                        1160             1240         +80
  thrift                     1240             1320         +80
```

**Four rooms moved 80 m each the moment the jail's room landed.**

## The repair rule, so this part is mechanical

Any interior coordinate written **before `ct/int-jail.ts` landed** that names
library, pawn, tax or thrift is now **80 m short**:

```
  library   1000 -> 1080        tax      1160 -> 1240
  pawn      1080 -> 1160        thrift   1240 -> 1320
```

Anything at x ≤ 920 — bank, bodega, burger, casino, church, diner, hotel — and
anything outside the slab belt is untouched. **I checked my own citations
first**: the only x ≥ 1000 numbers in my notes and ledger evidence are a
viewport size (`1000 × 640`) and a timing (`1200 ms`), so none of mine need
repairing. That is luck, not care.

## What I got wrong, corrected where I wrote it

`notes/O-jail-handoff.md` said:

> *"`jail.ts` sorts after every existing `int-*.ts` and after `interior.ts` and
> `inventory.ts`, so it takes the last slab and moves no existing room."*

**That was wrong.** I reasoned about the wrong glob. `jail.ts` — the exterior —
does sort last in `ct/world.ts`'s `./*.ts`. The ROOM is `int-jail.ts` and it
sorts inside `ct/interior.ts`'s `./int-*.ts`, where "int-jail" falls between
"int-hotel" and "int-library". Two globs, two orderings, and I checked the one
that did not matter. Corrected in place rather than quietly, per GOTCHAS §44.

## The structural half, which is the part worth your attention

**This is not a one-off and the row reads as though it is.** Slab addresses are
a function of the SET of interior filenames, so **every future `int-*.ts` that
sorts before an existing one moves every room after it**, silently, and
invalidates every coordinate anybody has written down about those rooms. The
next builder to add `int-diner2.ts` or `int-garage.ts` does it again.

`ct/interior.ts:153` says slab addresses are sorted by path *"so a room that
moves slab between builds is a room whose saved position means nothing"* — the
determinism is real, but it is determinism of the whole set, not stability of
any one room.

Three ways out, cheapest first, none of them mine to choose:

1. **Stop citing raw interior x at all.** `__ct.roomDims()` already answers
   `{id, cx, cz, w, d}`. Every probe I wrote tonight finds its room by id and
   would have survived this without noticing — `scripts/O-jailroom-look.mjs`
   and `O-verify-M-vault.mjs` both do. A row that says *"at the bank's local
   (+5.3, −3.6)"* never rots.
2. **Assign slabs from a stable key** — a hash of the id, or an explicit index
   in each `int-*.ts` — so a new room takes a free slab instead of inserting.
3. **Accept the drift and re-measure on every add**, which is what just
   happened, except by accident and a day late.

`ct/interior.ts` is F's and the ledger is the desk's, so this is a report.

— O

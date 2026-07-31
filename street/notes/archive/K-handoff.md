# K — handoff

Builder K, worktree `../rpg-inv`, branch `feat/inv`.
**Owns:** `ct/hud.ts` (transferred from D), `ct/inventory.ts`, and — pending a
row in `OWNERSHIP.md` — `ct/atm.ts`.

> **Port note for the desk:** my assigned port **4192 is occupied by builder J's
> preview** (`/proc/…/cwd -> ../rpg-civicint/street`). Measuring against it would
> have been GOTCHAS §26 exactly. Everything below was measured on **4292**, my
> own, with `reportWorld` confirming the stamp on every run.

**Queue: empty.** Four items, three built and one reported stale rather than
built twice. Two things are outstanding and neither is mine — `notes/BLOCKED-K.md`.

---

## What landed

**The pockets** (`ct/inventory.ts`) — one model, not two: `Purse` in `ct/hud.ts`
has held them since the wallet shipped. Six slots, a slot is a KIND.
`takeable(ctx, {obj, id})` is one line in any owner's file; the four newspapers
are **adopted** through the `userData.litter` tag `props.ts` already publishes,
so B's file was never edited. Taking removes the object from the world; `G` puts
it back with its `[E]` following it. Full pockets **refuse**, visibly, three ways.

**The API for C's packages** (`notes/K-inventory-api.md`) — `giveRandom(ctx)`
over a 1997 mail-order table with the disappointment weighted.

**The sleep fade** (`notes/K-screen-fade.md`) — `screenFade({ mid })`, general
rather than sleep-specific. C has wired it; the bed measures 575 minutes of
clock with the overlay at peak opacity 1.000.

**The panel framework** (`notes/K-panel-framework.md`) — `makePanel` + `UI`,
built once because three full-screen interfaces were in flight with three
authors. Open/close, one-at-a-time, world frozen, ESC always works, one bezel and
typeface. L is building the slots on it and M's loan application already uses it.

**FIRST FEDERAL** (`ct/atm.ts`, `notes/K-atm.md`) — card, PIN, menu, balance,
notes counted, take your cash, receipt (NO PAPER), take your card. A has wired
the `[E]`, so it is reachable from the pavement.

**The pockets on the framework** — same cabinet in canvas, items drawn as
objects, and a pane that holds one thing up at 3×.

## Checks — seven, all registered, all with selftests except the two deliberate reds

| | asserts | state |
|---|---|---|
| `K-pocket-loop` | take → it leaves the ground → drop → it comes back | green |
| `K-pocket-panel` | the panel opens, and G drops what you CHOSE | green |
| `K-atm-walk` | the money is conserved, opened through the world's own `[E]` | green |
| `K-sleep-fade` | the screen goes black **and the bed actually does it** | green |
| `K-tyre-has-arch` | verifying F: every tyre has bodywork over it | green |
| `K-seat-lets-you-up` | you can get back UP off a seat | **RED — real bug** |
| `K-tv-off-unless-seated` | verifying C: the TV is off unless seated | **RED — same bug** |

## The thing worth reading first: you cannot get up off a seat

Found while verifying C's television row, and the user hit it himself the same
hour. **All 225 seats.** `crosstown.ts` latches `landing` when an `[E]` moves you
more than a stride; `canSee` then refuses every spot until you walk 1.2 m clear;
**a seated player cannot walk.** Sitting is itself a move of more than a stride.
Measured on the bench: **0.97 m of travel gets up, 1.03 m and beyond are stuck.**
`crosstown.ts` is desk-owned and untouched — the diagnosis is in the row and in
`notes/BLOCKED-K.md`, with the two shapes that close it.

## The lesson I paid for twice

**A check that proves a kit works is not a check that the kit is USED.**
`K-sleep-fade` was green while the world had no fade in it, which is why a
CONFIRMED row was untrue and had to be re-opened. `K-atm-walk` was green on a
machine no player could reach, for the same reason. Both now press the world's
own `[E]`.

And three false reds, all mine, all one root — a wall clock or a fixed count
standing in for render-loop progress (GOTCHAS §30/§43). **A control that fails
spuriously is the worst kind of red: it discredits the real verdict beside it.**

## Verification done for other builders

- **F, wheel arches** — reproduced by an unrelated filter (a tyre is a cylinder
  lying on its SIDE, which no barstool can imitate): 84 by axis against F's 83 by
  skin, 84/84 arched. Watched it fail by lifting every car body.
- **F, interior keepers** — the bodega keeper faces the customer today; B's
  station coordinates were stale. **Only 3 of 11 rooms publish a service `[E]`**,
  so the row is decidable in three rooms and undecidable in eight until a keeper
  declares itself. The **thrift keeper is not on screen at all** — filed as a
  limit, not a fault.
- **C, the television** — everything measurable holds; the stand-up half is
  blocked by the seat bug, and I did not file that against C.

## Eight checks, all green, all with a watched failure

| | asserts |
|---|---|
| `K-no-panel-traps` | **every** panel can be left, and leaving it frees the player |
| `K-seat-lets-you-up` | you can get back UP off a seat, swept across the band |
| `K-pocket-loop` | take → it leaves the ground → drop → it comes back |
| `K-pocket-panel` | the panel opens, and G drops what you CHOSE |
| `K-atm-walk` | the money is conserved, opened through the world's own `[E]` |
| `K-sleep-fade` | the screen goes black **and the bed actually does it** |
| `K-tyre-has-arch` | verifying F: every tyre has bodywork over it |
| `K-tv-off-unless-seated` | verifying C: the TV is off unless you are seated |

Two of them were registered **RED ON PURPOSE** and both have since gone green
because somebody fixed what they named — the seat latch and the sleep fade's
missing call site. That is the whole argument for writing a check red rather
than waiting: a red row that names the missing line gets it added.

## The lessons this cost me, in order of what they cost

1. **A check that proves a kit works is not a check that the kit is USED.**
   `K-sleep-fade` was green while the world had no fade in it — which is why a
   CONFIRMED row was untrue — and `K-atm-walk` was green on a machine no player
   could reach. Both now press the world's own `[E]`.
2. **A fix below the layer that eats the input cannot be reached.** The modal
   trap: two correct fixes had already landed and neither could run, because the
   panel gate swallowed the keydown above them.
3. **A wall clock standing in for render-loop progress.** Four times, all mine —
   a walk control, a sample count, a keydown that never arrived, and a prompt
   read 200 ms after a warp that still described the last place I stood. The
   last of those nearly became a false report that a player at a casino slot is
   teleported into their apartment.
4. **A control that fails spuriously is the worst kind of red** — it discredits
   the real verdict standing beside it.

## Outstanding## Outstanding — `notes/BLOCKED-K.md`

1. **DESK** — the seat latch in `crosstown.ts`. 225 seats, a live user report.
2. **DESK** — `src/proto/ct/atm.ts` still has no row in `OWNERSHIP.md`.
3. **M/D** — my ATM label change broke `M-bank-int-walk.mjs`; the fix is to read
   the money as data (`notes/K-money-is-data.md`). Their script, not mine.
4. Not blocking: `ctx.player` publishes no facing, so a dropped item lands at
   your feet; and the watch's forearm is bare skin because `drawWatch` never
   reads the `sleeve`/`cuff` the config carries — that one wants a ruling.

— K

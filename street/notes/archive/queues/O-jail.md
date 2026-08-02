# Queue — builder O  ·  worktree `../rpg-jail`  ·  port 4196

**Owns:** `ct/jail.ts` — the jail, outside and in.
**Desk writes this file. Do not edit it.**

> *"also we need a jail. the jail should be extremely try hard and should be
> somewhere it makes sense. probably over by the casino tbh lol"*

He said **extremely try hard**. That is the bar, and it is the highest he has
set for anything tonight.

Rebase on `add-stick-and-city98` before each item. Commit each item alone.
Keep `notes/status/O` current — one line, `STATE | what I am on | waiting on`.

## Read first

- `street/START-HERE.md`, then all of `notes/GOTCHAS.md`. **45** decides your
  floor plan and will save you a rejected pass.
- **`ct/interior.ts` is F's room kit** — `buildRoom(ctx, spec)`, slabs from
  x=400, real wall thickness, `[E]` in and out registered by the kit. Read
  `int-tax.ts` as a worked example. **Never fork the kit**; ask F through a note.
- **`ct/street.ts` (D) and `ct/sidestreet.ts` (H) own the rosters.** Your
  building has to go somewhere on one of them — **ask, do not insert yourself.**
  Read D's comments first: the roster runs have load-bearing totals, and one of
  them is why the bodega lands on its corner.
- **`ct/vice.ts` is G's** — the casino and hotel exteriors, which is the
  neighbourhood he is pointing at.

## Where it goes

He said *"probably over by the casino"* and he is right for a reason worth
building to: the **side street's east end** is a dead end that this project has
already had trouble justifying — H found the walkable graph crossing ten metres
of open carriageway there, and the user has just had the crossing removed. **A
municipal building at a closed end is exactly what makes that end make sense.**

Propose the position in a note **before** you build it, with D and H copied,
and let me rule. Do not push any roster run without agreement — moving one
shifts every building after it.

## What "extremely try hard" means here

A 1997 city lock-up, not a fantasy dungeon and not a modern precinct.

**Outside:** civic and unwelcoming. Heavy stone or dark brick, small high
windows with real bars, a sally-port door, a lamp over it, a municipal plate.
It should look like the one building on the block you do not want to enter.

**Inside:** a front counter with a desk sergeant behind glass, a bench for
people waiting, a corridor, and **cells you can see into** — bars you can look
through, a bunk, a basin. The interesting part of a jail is the threshold
between the public half and the locked half; build that.

**Two rules that have cost other rooms a pass:**
- **A flat colour is not a material.** Every big surface takes a real texture —
  A's `slabTex` keeps your colour. A blank grey wall in a jail will read as
  unfinished, not as institutional.
- **Anything with a front ends up backwards** (GOTCHAS 23). Bars, doors, the
  counter, the bench, the desk sergeant. Stand where a visitor stands.

**People:** H's `citizenSprite` has standing and **seated** poses
(`notes/H-seated-sprite.md` — one line, `seated: true`, placed at the **seat**
not the floor). A sergeant at the desk and someone on the bench is most of what
makes it feel like a place that processes people. If a placement seems to need
a y fudge, **stop and tell H**.

## Now

> ## DESK RULING — 2026-07-26 · SITE APPROVED, and all four asks granted.
>
> **1. THE SITE IS YOURS: the closed east end of the side street**, west-facing
> frontage on `x = 57`, `z −96 … −110`, replacing the anonymous east cross
> building. Approved on your own reasoning: it costs neither roster run a metre
> because both `NORTH2` and `SOUTH2` already stop dead on `x = 57` and the cap
> is on neither cursor, so the bodega keeps its corner. It is also what the user
> pointed at — *"probably over by the casino tbh lol"* — and it answers a dead
> end this project has failed to justify twice.
>
> **2. `ct/int-jail.ts` IS YOURS TOO.** You were right and you found it by
> reading rather than by hitting it, which is the better way to find it.
> `doors.ts:146` globs `./int-*.ts` and nothing else, so a `DOOR` declared in
> `ct/jail.ts` would be silently dropped and the facade would fall back to
> defaults; and `world-wired.mjs:123` fails outright on an id with no matching
> `int-<id>.ts`. Widening that glob is not on the table — its narrowness is the
> fix for the import cycle that lost SEVENS from the built bundle. Recorded in
> `OWNERSHIP.md`. Exterior in `jail.ts`, room in `int-jail.ts`, both yours,
> which is exactly how G holds `vice.ts` against `int-casino.ts`.
>
> **3. D IS ROUTED** for the east cross building and for `ctx.site('jail')`.
> You were right to ask rather than hand-type a coordinate out of D's file.
> Build against `ctx.site('jail')` when it lands; derive from `SIDE_X1` only if
> you would otherwise be blocked, and say so in the row if you do.
>
> **4. THE CAP COLLIDER: DELETE IT, AND REGISTER YOUR OWN.** You offered two
> options and the second is right. `crosstown.ts:491`'s
> `minX: SIDE_X1 + 1.7` stops the player at `x = 56.35`, which makes a door on
> `x = 57` unreachable — and a collider in the entry point standing in for a
> building that is about to be replaced is exactly the wiring the registration
> pattern exists to remove. **Bounded mandate on `crosstown.ts:491` for the
> deletion of that collider and nothing else in that file.** Your building then
> registers its own footprint through `ctx.obstacle`, which is how every other
> module does it and which keeps the wall and the collider in one place where
> they cannot drift apart.
>
> **Do not widen the mandate.** Anything else in `crosstown.ts` comes back to me.
>
> ## And the thing you did right, which I want repeated
>
> You proposed, you named four owners, you copied H for information rather than
> as a blocker, and **you built nothing.** That is what I asked for and it has
> just saved a rebuild: had you started on the fallback slot you would have got
> a worse building AND left the dead end unanswered. The fallback reasoning was
> worth writing down even though I did not take it.


- [ ] **1. Propose the site.** A note with the position, why, and what it does
      to the roster. Copy D and H. Wait for my ruling.
- [ ] **2. The exterior**, on the agreed site, with its door declared so the
      facade painter follows the room and not the other way round.
- [ ] **3. The interior** — enter from the street, walk it, get back out.
- [ ] **4. Then make it good.** The counter, the cells, the corridor, the
      light. This is where "extremely try hard" lands.

**Do not build a way to get arrested unless I route it.** He asked for a jail,
not a crime system. Build the place; the gameplay is a separate decision and
mine to route.

## How it gets confirmed

Rows you move to LANDED name **where to stand, or what predicate settles it**.
Grade it yourself, skeptically, before reporting — he asked for that by name:
*"take screenshots yourself and grade it and make sure you are impressed with
it. be skeptical."*

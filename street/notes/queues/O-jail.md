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

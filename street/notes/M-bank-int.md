# FIRST FEDERAL, inside — handoff

> ## MY QUEUE FILE IS STALE — all three items are built and CONFIRMED
>
> `notes/queues/M-bank-int.md` still shows items 1, 2 and 3 unticked. `live.sh M`
> reports **0 live, 0 awaiting a check**, and both ledger rows are **CONFIRMED**.
> The queue README's rule applies — *"if your queue file lists something live.sh
> does not, it is finished or void. File a one-line note naming it. Do not build
> it a second time"* — so this is that note, at the top of the handoff where a
> restarted me will read it before the checkboxes:
>
> | item | state |
> |---|---|
> | **1. the room, walkable, entered from the street** | built · `M-bank-int-walk.mjs` walks it in from the pavement from three approaches |
> | **2. very nice inside** | built · teller line, walk-in vault, terrazzo, rate board, 20 painted faces, three atlas people |
> | **3. the loan** | built · on K's shared panel, design and the one open question in `notes/M-loan-design.md` |
>
> The only thing outstanding is not mine to do: the two kit changes in
> `notes/BLOCKED-M.md`.

**M, 2026-07-26.** `src/proto/ct/int-bank.ts` is new and is the only source file
I touched. Both of my ledger rows are built: you can walk in off the pavement,
and you can apply for a loan.

---

## TWO THINGS ONLY F CAN CLOSE — please route them

Neither blocks me and neither is urgent, but the first is **user-visible on an
object the user singled out for praise**, so it should not sit in a note nobody
opens.

### 1. The interior door leaf ignores the `DoorLeaf` the room declares

`DoorLeaf` exists precisely so that *"a single-leaf room door in a double-door
building becomes impossible rather than something a builder has to remember."*
The **position** half works perfectly. The **leaf** half does not: `buildRoom`
paints a fixed 32×64 `leafT` — brown timber, one pale vision panel, a small gold
knob — and never reads `LEAF.frame.colour`, `LEAF.glazing` or `LEAF.leaves` for
a flat-wall door. (It *does* read `frame.colour` for a **chamfered** door, which
is what makes this look like an oversight rather than a decision.)

So FIRST FEDERAL declares `clearW 1.9, h 2.6, leaves 2, frame brass #7a6a44,
glazing 'full'`, the **opening** is correctly 1.9 × 2.6 — and the thing hanging
in it is a domestic timber door. Outside, A's facade has a bronze double with a
meeting stile, two pull handles and a kick rail, and the user has said
*"i love the doors of the bank too."*

**Stand inside at room-local (0, −2.4) looking at the front wall** —
`shots/M-bankint-back-to-door.png`. Read `ct/interior.ts`'s leaf block against
`ct/doors.ts`'s `DoorLeaf`.

I have not touched the kit. This is the fourth instance of the exact fault
`DoorLeaf` was written to kill, and closing it fixes every room at once.

### 2. The front wall takes ONE opening besides the door

`RoomSpec.window` is singular and `addHole` is internal, so a room cannot ask
for two. A's ground band paints **two** deep-set windows, at u 0.18 and u 0.82
of the frontage. The bank has the u 0.82 one — the right-hand side as you walk
in, so the daylight falls on the loan desk where somebody actually sits and
reads — and **the left of the front wall is solid where the facade has glass.**

A `windows?: Window[]` taking the existing shape would be additive and would fix
it. Until then this is the one thing about this room the exterior does not get
back, and I would rather it were written down than quietly absorbed.

### And one finding that is nobody's bug but matters to L

**No seat in this world can carry an interaction you use while sitting on it.**
`ctx.seat` registers the stand-up spot **at the seat**, so while seated it sits
at distance 0, and the `[E]` dispatch sorts on `offAxis + d * 0.02` — nothing
can ever beat it. I hit this by putting the loan officer across a chair you can
sit in: E sat you down and then the only thing on offer was "stand up".

That matters for **L's slots**, whose ask is *"when i sit down i enter the slots
interface"*. As things stand that has to happen **in the sit act itself**, and
`ctx.seat` takes no `act`. Worth a one-line addition to `Seat` if L needs it.

---

## What is in the room

**14 × 12 m at 3.6 m** — the tallest interior in the world, because a 1997
savings bank lobby is meant to be overbuilt and height is most of how that
reads. GOTCHAS 45 governs it: the door's **situation** matches (centred, and the
same 1.9 m bronze double the facade hangs, declared once in `DOOR` and read by
both sides), and the dimensions are the room's own.

- **The teller line** — 10.8 m of oak fielded panelling under a polished stone
  top with a proud lip; three bronze-screened windows with grilles at talking
  height and dished deal trays; a foot rail; a back bench with cash drawers, two
  adding machines and a coin tray. **Window 3 is closed**, its card tented on
  the counter and the overflow boxes of slips stacked behind it. The staff side
  is sealed in one collider from the counter face to the back wall.
- **The vault, and you can walk into it** — a poured strongroom in the back-left
  corner with a 0.30 m steel door standing open at 100° on three barrel hinges,
  a combination dial, a four-spoke handle and five throw bolts down the edge; a
  steel architrave, a sill you step over, three walls of safe-deposit boxes with
  two keyholes each, a coupon table with a chair you can sit at, and a caged
  bulb. **Every other interior in this world is one space; this one has a room
  inside it.**
- **The loan desk** — see `notes/M-loan-design.md` for the mechanic.
- **The public half** — a writing island with raked slip holders and two pens on
  bead chains, a chrome-and-maroon queue line, three linked waiting chairs, the
  **rate board** (MORTGAGE 7.75, AUTO 9.25, PERSONAL 12.50, PASSBOOK 4.10,
  6 MONTH CD 5.15), a brochure rack, two brass-planted ficus at the doors, a
  bin, two camera domes, and the MEMBER FDIC notice that tells you the hours the
  loan desk enforces.
- **Terrazzo with brass dividers** on the bay grid, a marble dado through the
  kit's wainscot, an acoustic-tile ceiling, and three rows of troffers.
- **Three people**, all from H's atlas through `room.person`, every facing
  derived from what they are looking at: a teller behind window 2, a customer
  being served at window 1, and the loan officer **seated** at her desk.

## Is it cramped? Measured, not asserted

`scripts/roomaisle.mjs`, since *"cramped" is a statement about SHAPE, not area*:

    bank   168 m2   aisle min 2.80   med 10.35   max 14   0 samples < 0.72 m   80% free

The **2.80 m minimum is the widest of any furnished room in the world** bar the
jail and the hotel — against bodega 0.6, thrift 0.7, tax 0.97, pawn 0.0 — and
**zero samples are under the player's width**. The 80 % free floor is the lowest
in the set, which is the right direction for a brief that said "very nice
inside".

## How to check it

    SHOT_URL=http://localhost:<yours>/ node scripts/M-bank-int-walk.mjs
    SHOT_URL=http://localhost:<yours>/ node scripts/M-bank-int-walk.mjs --selftest

**52 claims, 52 passing — on the dev server AND on `vite preview`**, which
matters because the bundle is what ships (GOTCHAS 37) and this room imports
`ct/hud.ts`. The selftest removes the teller line's collider and walls the vault
throat, and reddens 7.

`doors-declared.mjs` against the **built bundle**: 12 modules declare a DOOR, 12
arrive. Importing `ct/hud.ts` from an `int-*.ts` does **not** put it in a cycle
with `ct/doors.ts` — hud imports three.js and the build stamp and nothing else —
and that is checked rather than assumed, because a cycle there drops the
declaration silently and only in the bundle (GOTCHAS 28).

Pictures: `scripts/M-bank-int-shots.mjs` (12 stations) and
`scripts/M-loan-panel-shots.mjs` (the five frames of an application).

## Where a verifier should stand

| what | stand at (room-local) | and |
|---|---|---|
| the room reads as a bank | **(0, 4.85)**, arriving | the teller line, the vault and the rate board are all in the frame |
| the vault is a room | **(−5.4, −1.2)** | walk north, through the door, and keep going |
| the teller line seals | **(1.8, −3.15)** | walk north; you stop at the counter's face and cannot pass it |
| **the loan** | **(4.4, 3.5)** facing the officer | E · W W ENTER (declined) · S S ENTER (approved) · ESC · then window 2 |
| the door leaf fault | **(0, −2.4)** facing the front wall | compare with the facade from the pavement |

## Two things I want to flag about my own work

**The slab shift was mine.** `int-bank.ts` sorts before `int-bodega.ts`, so the
belt handed it slab 0 and every existing room moved +80 m in x. I said so in the
commit; the desk has since landed a pass over the stale stations. Anything that
asks `roomDims()` was fine.

**The port in my brief was already taken.** 4194 is builder I's `rpg-lot`
worktree. I used **4204** and every number above was measured there or on a
`vite preview` of my own tree, with `reportWorld` printing the build on every
run.

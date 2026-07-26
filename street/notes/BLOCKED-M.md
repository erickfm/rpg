# BLOCKED-M — two things in `ct/interior.ts` only F can change

**I AM NOT STALLED AND MY QUEUE IS EMPTY.** Both bank rows are CONFIRMED and I
have verified L's slots row. This file exists because `desk.sh` surfaces it as an
ACTION and a note nobody opens is silence — the protocol's own words: *"a builder
once sat blocked on a one-line export that another builder could have added in a
minute, and the desk only discovered it by chance."*

Neither of these stops me building. Both are gaps between what FIRST FEDERAL
declares and what the kit does with the declaration, and the first is
**user-visible on an object the user has said he loves.**

---

## 1. `buildRoom` ignores the `DoorLeaf` the room declares — I need F

**What I need:** the flat-wall door leaf painted from the published `DoorLeaf`
rather than from a constant — its `frame.colour`, its `glazing`, and `leaves: 2`.

**Why it is not mine:** it is `ct/interior.ts`, F's kit, and the standing rule is
that a room reads the kit and asks F through the desk for what it does not do. I
have not touched it.

**The state of it.** `DoorLeaf` exists precisely so *"a single-leaf room door in a
double-door building becomes impossible rather than something a builder has to
remember."* The **position** half of that works perfectly — my door is centred to
the millimetre on A's facade because both sides read `doorWorldFor`. The **leaf**
half does not: the kit paints a fixed 32×64 texture — brown timber, one pale
vision panel, a small gold knob — and never consults the declaration. It *does*
read `frame.colour` for a **chamfered** door, which is what makes this look like
an oversight rather than a decision.

So FIRST FEDERAL declares

    clearW 1.9 · h 2.6 · leaves 2 · frame { brass, #7a6a44 } · glazing 'full'

the **opening** comes out correctly at 1.9 × 2.6 — and the thing hanging in it is
a domestic timber door. Outside, A's facade has a bronze double with a meeting
stile, two pull handles and a kick rail, and the user has said **"i love the doors
of the bank too."**

**Where to stand:** inside, room-local **(0, −2.4)**, looking at the front wall —
`shots/M-bankint-back-to-door.png`. Then the pavement outside for the comparison.

**Why it is worth F's time rather than mine:** this is the fourth instance of the
exact fault `DoorLeaf` was written to kill, and fixing it in the kit fixes every
room at once. Ten interiors inherit that leaf.

## 2. `RoomSpec.window` is singular, so a facade with two windows loses one

**What I need:** `windows?: NonNullable<RoomSpec['window']>[]` — the existing
shape, as a list. Purely additive; `window` keeps working.

**The state of it.** `addHole` is internal and the spec takes one window, so a
room cannot ask for a second opening. A's ground band paints **two** deep-set
windows, at u 0.18 and u 0.82 of the frontage. The bank has the u 0.82 one — the
right-hand side as you walk in, chosen so the daylight falls on the loan desk
where somebody actually sits and reads — and **the left of the front wall is solid
where the facade has glass.**

This is the one thing about the room the exterior does not get back, and I would
rather it were written down than quietly absorbed. GOTCHAS 45 says width and area
are free; **which side the openings are on is exactly what is not.**

---

## And one for the desk rather than for F: `ctx.seat` cannot tell its owner it was taken

Not a blocker for me — the bank works standing, like every other counter here —
but it is a real limit and **two builders reached it independently within a day**,
which is the strongest case for the field that anybody is going to make.

`ctx.seat` registers its stand-up spot **at the seat**, so while seated the
dispatch is won by "stand up" at distance 0 (`key = offAxis + d * 0.02`) and
**nothing else can ever be offered.** No seat in this world can carry an
interaction you use while sitting on it.

- **I hit it** putting a loan officer across a chair you can sit in: E sat you
  down and then the only thing on offer was "stand up". The loan was unreachable
  from the one position every player arrives in. My chair's approach moved to the
  side and its label no longer promises a conversation.
- **L hit it** from the other end — *"when i sit down i enter the slots
  interface"* — and worked round it with a `watchSeat` poll, because the sit
  cannot call back. `ct/slots.ts` says so in as many words and asks for
  `onSit`/`onStand`, two optional fields.

I verified L's row today and it works, so nothing is broken. But the workaround
is a poll standing in for a callback, and the next person who wants a verb at a
seat will write a second one.

---

*Delete this file when both are closed. — M*

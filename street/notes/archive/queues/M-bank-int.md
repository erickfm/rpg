# Queue — builder M  ·  worktree `../rpg-bankint`  ·  port 4194

**Owns:** `ct/int-bank.ts` — the FIRST FEDERAL interior, which does not exist yet.
**Desk writes this file. Do not edit it.**

Two user requests, one room:

> *"i would like to enter the bank and be able to apply for a loan"*
> *"create a whole interior for the bank. it should be very nice inside."*

Rebase on `add-stick-and-city98` before each item. Commit each item alone.
Keep `notes/status/M` current — one line, `STATE | what I am on | waiting on`.

## Read first, before you write anything

- `street/START-HERE.md`, then all of `notes/GOTCHAS.md`. **45** governs this
  room and will save you a rejected pass.
- **`ct/interior.ts` is F's room kit and it is how rooms get built here** —
  `buildRoom(ctx, spec)`, slabs from x=400, walls with real thickness and
  jambs, `[E]` in and out registered by the kit. Read `int-tax.ts` or
  `int-diner.ts` as a worked example. Ask F through a note for anything the kit
  does not do; do not fork it.
- **`ct/bank.ts` is A's** — the facade, the doors and the ATM. The user has
  said he **likes the ATM and loves the doors**, so read that file to learn
  what the outside promises, and never edit it.
- `ct/doors.ts` is F's registry. Your room declares its door; the painter
  follows. **The interior declares, the facade follows** — that direction is
  load-bearing and getting it backwards is the single thing that has annoyed
  the user most on this project.

## GOTCHAS 45, because it decides your floor plan

*"Match the exterior"* means **which side the door is on**, not the dimensions.
The user, in his own words: *"no one is going to take a ruler and measure the
width of the inner and outer."* And: *"you can make it wider than it actually
is outside too."*

**So take the room a bank needs.** Interiors that were built to fit their
facades came back as "cramped" three times — the bodega, the casino, the hotel.
Do not repeat it. But note the counter-lesson from the library: **"cramped" is
about SHAPE, not area.** It doubled to 326 m² and its clear aisle *fell* to
2.10 m because the floor got cut into strips. Measure the largest continuous
free run with `scripts/roomaisle.mjs`, not just the square metres.

## Now

- [ ] **1. The room, empty, walkable, entered from the street.** Door declared,
      `[E]` in and out, floor registered, you can walk in from the pavement and
      back out. Commit that alone — everything else sits on it.

      **Walk it in from the street, not by teleporting.** And check the
      arrival: you should end up facing INTO the room, square to it. F built an
      arrival heading for exactly this; ask for it.

- [ ] **2. Make it very nice inside.** This is a 1997 savings bank and the
      outside is already telling you what it should be: stone, solid, slightly
      overbuilt, brass doors the user says he loves.

      What makes a bank read as a bank: a **teller line** behind glass or a
      grille with two or three positions, a counter with a worn top, a **rope
      queue barrier**, a writing desk with deposit slips and a chained pen, a
      floor that is stone or terrazzo rather than carpet, a **high ceiling**,
      and a big clock. Something institutional on the wall — a rate board, a
      framed licence, a portrait. Perhaps a vault door, closed, visible.

      Two hard-won rules from other rooms: **a flat colour is not a material** —
      any big blank surface takes A's `slabTex`, which keeps your colour; and
      **anything with a front ends up backwards** (GOTCHAS 23), so stand where
      a customer stands and check every fitting from there.

      **People:** H's `citizenSprite` has both a standing and a **seated** pose
      (`notes/H-seated-sprite.md`, one line: `seated: true`, placed at the
      **seat**, not the floor). A teller behind the counter and someone waiting
      is most of what makes a bank feel open for business. If a placement seems
      to need a y fudge, **stop and tell H** — that means the atlas is wrong.

- [ ] **3. The loan.** *"apply for a loan"* — this is a gameplay verb, so make
      it one, not a sign.

      Sit or stand at a desk, `[E]`, and an application: how much, what for,
      and an answer. **The money is K's** — `ct/inventory.ts` holds the
      player's pockets and the wallet is a view onto it. Ask K for the give
      and take calls; **do not invent a second wallet.**

      Decide and tell me what you chose: does the loan get approved on
      anything, is there a credit check, does it have to be repaid, and what
      happens if it is not? **My steer: keep it simple and a little sleazy** —
      this is a neighbourhood savings bank in a block with a pawn shop and a
      used car lot. An approval that is too easy, and interest that is
      obviously bad for you, is more in keeping than a real credit model. But
      it is your design; propose it in a note before you build it.

      K is building **one shared full-screen panel framework** in `ct/hud.ts`
      for the ATM, the inventory and the slot machine. **Use it** — a loan
      application on a different-looking panel would stand out immediately.

## How it gets confirmed

Rows you move to LANDED name **where to stand, or what predicate settles it**.
And grade it yourself, skeptically, before reporting — the user asked for that
by name: *"take screenshots yourself and grade it and make sure you are
impressed with it. be skeptical."*

He said **"very nice inside"**. That is the bar.

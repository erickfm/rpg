# Queue — builder N  ·  worktree `../rpg-tenancy`  ·  port 4195

**Owns:** `ct/tenancy.ts` — rent, the mailboxes, the letters, the landlord.
**Desk writes this file. Do not edit it.**

Your reason for existing:

> *"implement rent that needs to get paid to your landlord and you get letters
> at the mailboxes on entry."*

Rebase on `add-stick-and-city98` before each item. Commit each item alone.
Keep `notes/status/N` current — one line, `STATE | what I am on | waiting on`.

## Read first

- `street/START-HERE.md`, then `notes/GOTCHAS.md`.
- **`ct/apartment.ts` is C's** — room 301, the landings, the stairwell, the
  neighbour, and the landing packages C is building now. The mailboxes live in
  C's building. **Read it, never edit it**; ask C through a note for a place to
  put them and for anything the building must expose.
- **`ct/inventory.ts` and `ct/hud.ts` are K's.** The player's money is there and
  the wallet is a view onto it. **Ask K for the take/give calls — do not invent
  a second wallet.** K is also building **one shared full-screen panel
  framework**; if rent needs a screen, use that rather than rolling your own.
- The game clock is on `ctx` — `hourAbs`, and C wired `ctx.advanceTime` for
  sleeping. **Rent is a clock feature**, so it must behave when the player
  SLEEPS through days as well as walks through them.

## The shape

**Two halves that meet in the lobby.** Letters arrive in your mailbox; rent has
to be paid. The mailbox is where you find out you owe it.

- [ ] **1. The mailboxes, physical and readable.** A bank of small brass or
      steel boxes in the entry lobby, numbered to match the flats — 301 is
      yours and the numbering must agree with the doors upstairs. `[E]` to
      check yours.

      **He said "on entry"** — so checking the mail is a thing you do coming in
      off the street, and finding one should be visible at a glance: a flag, a
      corner of envelope showing, a box slightly ajar. Do not make him press E
      on every box to discover an empty one.

- [ ] **2. Letters.** A letter is a thing you can read. Rent demand first,
      because that is the one the feature turns on — then whatever else makes
      the building feel lived in: a utility bill, a flyer, something addressed
      to the previous tenant, a postcard.

      If a letter should end up in the player's pockets, that is **K's
      inventory** — ask, do not build a parallel one.

- [ ] **3. Rent.** Due on a schedule, owed to a landlord, paid from the
      player's money. Decide and **tell me before you build it**: how often,
      how much, what happens when it is late, and whether the landlord ever
      appears. **My steer** — this is a walk-up above a pawn shop in 1997, so
      keep it small, keep it regular, and make being late feel like a
      consequence rather than a game-over. A second notice under the door is
      more in keeping than a lockout.

      **The money is K's.** The clock is `ctx`. Neither is yours.

## Two traps this project has already fallen into

**Anything with a front ends up backwards** (GOTCHAS 23) — a bank of mailboxes
has a front, and so does every letter. Stand where a tenant stands.

**A flat colour is not a material.** A blank metal panel will read as a grey
rectangle; A's `slabTex` and the world's 8–32 px/m densities are how everything
else avoids that.

## How it gets confirmed

Rows you move to LANDED name **where to stand, or what predicate settles it**.
Grade it yourself, skeptically, before reporting — he asked for that by name.

**Walk in off the street and check your mail.** That is the station.

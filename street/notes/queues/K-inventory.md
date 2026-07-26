# Queue — builder K  ·  worktree `../rpg-inv`  ·  port 4192

**Owns:** `ct/hud.ts` (transferred from D) and `ct/inventory.ts` (new, yours).
**Desk writes this file. Do not edit it.**

You exist for one user request: **"ok i want the player to have an inventory"**.
It is a system, not a prop, and D — who owned `hud.ts` — is carrying the
interaction rework the user is actively walking. So the screen layer is yours.

Rebase on `add-stick-and-city98` before each item. Commit each item alone.

Keep `notes/status/K` current — one line, `STATE | what I am on | waiting on`.
See `notes/status/README.md`. The desk watches it and will notice if it lies.

`scripts/live.sh K` is what the LEDGER owes you. This file says HOW.

## Read first

- `street/START-HERE.md`, then `notes/GOTCHAS.md`. **7** (floor-picker
  hysteresis) and **34** (a check that measures the wrong thing) both bite here.
- `notes/OWNERSHIP.md` — and note the SHARED section. `ct/ctx.ts` and
  `crosstown.ts` are the desk's. **Ask me for what you need there; do not
  reach in.** I grant bounded mandates for exactly this and have four times
  today.
- **`ct/hud.ts` already has a pockets model.** Line 14: *"The player's pockets
  — the wallet is a view onto this, nothing more."* There is money, a bifold
  wallet on right-click, and a repaint after a buy or a feed. **Extend that.
  Do not build a second, parallel model** — the wallet and the inventory are
  two views onto one set of pockets.

## The shape I want, before any pixels

**1. THE VERB GOES THROUGH `ctx.spot()`.** A module offers a takeable the same
way it offers a seat or a door — one line, in its own file, no edit to the
entry point. If picking things up requires each owner to register in
`crosstown.ts`, it will be half-adopted forever and the user will keep finding
objects he cannot take. That is the registration pattern and it is why `ctx`
exists.

**2. IT IS POCKETS, NOT AN RPG BAG.** This is a 1997 street, not a dungeon.
Small and finite — a handful of slots, no weight system, no crafting, no
sorting UI. If it needs a scrollbar, it is too big.

**3. TAKING SOMETHING MUST CHANGE THE WORLD.** The object leaves the ground
when it enters your pocket, and comes back when you drop it. A pickup that
leaves a ghost behind is worse than no pickup.

**4. THE PANEL IS A VIEW, LIKE THE WALLET.** Same idiom, same DOM + 2D canvas,
same period look. It should feel like the wallet's sibling, not like a game
menu bolted on.

## Now

- [ ] **Land the model and ONE takeable, alone, before anything else.** Pick
      the newspaper — it already exists, the user approved it (*"i like
      newspaper as well"*), and it is the obvious thing to pocket. Prove the
      whole loop: see it, take it, it leaves the ground, it is in your pocket,
      you can look at it, you can drop it and it comes back.

- [ ] **Then the panel.** Opened and closed like the wallet, and it must not
      fight the wallet — decide whether they share a key or sit side by side,
      and say which you chose and why.

- [ ] **Then propose the item list — do not invent twenty.** Write me a short
      note naming the things in the world a person would actually pocket, with
      one line each on why. My instinct: the newspaper, a coffee cup, a bodega
      item you have paid for, a library book, a flyer, something from the
      alley. **Route the adoption to their owners rather than reaching into
      their files** — you publish the call, they add the line.

- [ ] **The fist on the watch wrist** — transferred with `hud.ts`, still open.
      The user designed it himself: *"really minimal considering it would be
      the top of the fist. no fingers would actually show so i kinda expect a
      square larger in width than the wrist attached to the right side of the
      wrist."* Build exactly that — one box, wider than the wrist, butted to
      its right end. Same skin tone and shading, and it must bob with the wrist
      as one piece at walk, run and jump. **He said minimal twice in one
      sentence; do not add fingers.**

## How this gets confirmed

Rows you move to LANDED must name **where to stand, or what predicate settles
it** — that is policy now, and it was paid for: a verifier without a station
built five generic filters and got five wrong sets and zero real faults.

And grade your own work skeptically before reporting. The user asked for that
by name: *"take screenshots yourself and grade it and make sure you are
impressed with it. be skeptical."*

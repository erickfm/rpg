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

### 1. The pockets model, and a newspaper you can take (`ct/inventory.ts`)

`ORDER 45`, joins the world through `ct/world.ts`'s glob. **One model, not two:**
`Purse { cash, inv }` in `ct/hud.ts` has held the pockets since the wallet
shipped and everything here reads and writes that same object.

- `takeable(ctx, { obj, id })` — the published call, one line in your own file.
- Six pockets; a slot is a KIND, stacking to the item's own limit.
- **Full pockets REFUSE.** Dropping the oldest destroys something the player
  chose to carry in response to an action meant to gain something.
- The four newspapers are **adopted** by the `userData.litter` tag `ct/props.ts`
  already publishes — B's file was not edited.
- Taking it **removes it from the world**; `G` puts it back at your feet and its
  `[E]` follows it there.

### 2. The API for C's packages — `notes/K-inventory-api.md`

`giveRandom(ctx)` → `{ id, def, taken }`, over a 1997 mail-order table with the
disappointment weighted. Two things the caller must do: gate the **label** on
`pocketsFull`, gate the **destroy** on `got.taken`.

### 3. The sleep fade — `notes/K-screen-fade.md`

`screenFade({ mid })` from `ct/hud.ts`. A general capability, not a sleep effect.
`mid` runs **while the screen is black**; black is **held**; nothing moves or
interacts through it, including a key already held when it starts. **Overturns
the desk's earlier NO FADE ruling**, correctly.

### 4. The panel framework — `notes/K-panel-framework.md`

`makePanel` + `UI`, on the desk's instruction, because three full-screen
interfaces were in flight with three authors. Every caller gets open/close,
one-thing-at-a-time, the world frozen behind it, ESC always working, and one
bezel/palette/typeface. **L is building the slots on it.**

### 5. FIRST FEDERAL — `ct/atm.ts`, `notes/K-atm.md`

Card, PIN, menu, balance, notes counted out, take your cash, receipt (NO PAPER),
take your card. Amber CRT, eight buttons with the menu lined up against them.
Money moves `purse.account` → `purse.cash`, the same wallet the bodega spends.
**Draws nothing A built** and needs one line from A to be reachable.

### 6. The pockets raised onto the framework

Same cabinet as the ATM in canvas rather than plastic, items drawn as objects,
six slots at a glance, and a pane holding one thing up at 3× with whether it can
be put down — said **before** you press the key.

## Checks — four, all registered in `checks.mjs`, all with selftests

| | asserts | its mutation |
|---|---|---|
| `K-pocket-loop` | take → it leaves the ground → drop → it comes back | the taken paper forced back to visible |
| `K-pocket-panel` | the panel opens, and G drops what you CHOSE | the selection moved behind the assertion's back |
| `K-sleep-fade` | the screen goes black and the world changes while it is | the clock advanced BEFORE the fade |
| `K-atm-walk` | the money is conserved end to end | the dispenser jammed — debit stands, notes vanish |

All four green, all four selftests red on their mutations, `K-sleep-fade` green
**4 of 4 run concurrently** (GOTCHAS §30). `node scripts/health.mjs` WORLD OK,
`check-wiring` 29 of 29.

**The world did not move**, checked at every step: `fp` before/after, textures
and structure hashes identical each time, only walkers differing.

## Five things the checks caught, all mine

1. **The framework killed its own gate.** Two capture listeners on `window` fire
   in registration order, so the generic input blocker ran first and
   `stopImmediatePropagation()`d the key dispatcher out of existence. The ATM
   opened, drew perfectly, and answered no key **including ESC**.
2. **A synthetic `KeyboardEvent` on `window` is not a key.** Window is then the
   TARGET, so capture and bubble fire in registration order and `main.ts` wins.
   My probe reported the fade's input lock broken; the lock was fine.
3. **A CSS transition starts on a FRAME, not when you set the property.** Timing
   the middle of the fade from t0 ran the world change at **opacity 0.842**.
4. **`wheel` on `window` is passive by default**, so its `preventDefault` is
   refused — one console warning per event, seen only by a "no page errors" line.
5. **A visibility predicate that was right for one presentation** (a held object
   parks off the viewport) was **silently wrong for the other** (a cabinet is
   always centred and only fades). Both checks would have gone on passing while
   measuring nothing.

## Outstanding — `notes/BLOCKED-K.md`

- **A:** one line in `ct/bank.ts` (`act: () => openAtm()`) and the ATM is
  reachable from the world.
- **Desk:** `src/proto/ct/atm.ts` has no row in `OWNERSHIP.md`. `ownership.sh`
  passes it by default rather than by decision.
- **Not blocking:** `ctx.player` publishes no facing, so a dropped thing lands at
  the player's **feet** rather than in front of them. One field on `PlayerRef`
  (`yaw: () => number`) fixes it.
- **Wants a ruling, not an assumption:** the watch's forearm is bare skin —
  `drawWatch` never reads the `player.sleeve`/`cuff` the config carries for it.
  That watch has had two unasked-for redraws reverted, so I have not touched it.
  `notes/K-queue-item-4-is-stale.md`.

— K

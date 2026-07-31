# The pockets API — for C's packages, and for anyone else with something to give

**Status: LANDED on `feat/inv`, commit above `23419cc98`** (my own, so it is not
yet an ancestor of mainline — GOTCHAS §36; rebase and it will be). Everything
below is in `src/proto/ct/inventory.ts` and works in the **built bundle**, not
just in dev.

C: you asked for one call and an honest answer about full pockets. Here they are.

---

## The one call

```ts
import { giveRandom, pocketsFull } from './inventory';

ctx.spot({
  x, z, r: 0.9,
  ok: () => theBoxIsStillThere,
  label: () => (pocketsFull(ctx.purse)
    ? 'pockets full — you cannot carry it'
    : 'steal the package'),
  act: () => {
    const got = giveRandom(ctx);      // rolls, pockets it, posts the line
    if (got.taken) removeTheBox();    // ← gate the world change on this
  },
});
```

`giveRandom(ctx)` returns `{ id, def, taken }`:

| | |
|---|---|
| `id` | `'VHS'`, `'SOCKS'`, … the key in `ctx.purse.inv` |
| `def` | `{ id, name, stack, blurb }` — `name` is how a prompt says it |
| `taken` | **false if it did not fit.** Nothing entered the pockets. |

It already calls `ctx.refreshWallet()` and already posts the player's line
(`"pair of trainers — two sizes too big, and white."`), so you do not have to.

**Two lines you must write yourself, and they are the whole contract:**

1. **Gate the LABEL on `pocketsFull(ctx.purse)`** so a player reads the refusal
   *before* pressing the key rather than after.
2. **Gate whatever you destroy on `got.taken`.** If the package vanishes on a
   refused steal, the item is gone and so is the box — which is the one outcome
   worse than either.

## What happens when the pockets are full: WE REFUSE

Asked directly, so answered directly. **Six pockets. A pocket is a KIND, not a
thing** — three cereal boxes are one pocket, up to that item's own `stack`. When
all six are in use and you are carrying none of what is being offered,
`give()` takes nothing and returns 0.

The alternative on the table was dropping the oldest item to make room, and it
is worse: it **destroys something the player chose to carry**, in response to an
action whose entire point was to gain something, and it does it silently. A
refusal leaves the player exactly as they were, and it is legible.

**Refusing is only honest if it is visible**, so it is visible three ways:

- the **prompt** says so before you press — if you gate the label as above
- `hud.note()` posts *"no room — 6 of 6 pockets full"* when you press anyway
- the **wallet** carries `n/6 pockets` on its left leaf, so the limit is
  something you can see coming rather than something you discover by being told no

## What is in a package

`PACKAGE_TABLE`, in `ct/inventory.ts`. 1997 mail order, and the disappointment
is weighted (repeated entries are the weight) because it should be the likeliest
single outcome without being the only one:

| id | name | the line you get |
|---|---|---|
| `VHS` | video tape | no label. Somebody taped over something. |
| `TRAINERS` | pair of trainers | two sizes too big, and white. |
| `TOASTER` | toaster | a toaster. You have stolen a toaster. |
| `CHEQUES` | book of cheques | someone else's name on every one. |
| `SOCKS` | pack of tube socks | six pairs, tube, white. |
| `CATALOGUE` | mail-order catalogue | the thing that sells the things. |

`SOCKS` and `CATALOGUE` appear twice, so between them they are half the rolls.

**Say if this list is wrong for what you are building.** It is a table in one
file and it costs nothing to change; what would cost something is you building a
second one. If a package should be able to hold something a package *shouldn't*
— a stolen library book, say — `giveRandom(ctx, MY_TABLE)` takes any array of
ids, and `defineItem()` declares a new one from your own file.

## If you have a specific thing rather than a random one

```ts
import { give, itemOf } from './inventory';
if (give(ctx.purse, 'CHEQUES', 1) > 0) { …it fit… }   // returns how many went in
```

## And if you have an OBJECT in the world rather than an item id

```ts
import { takeable } from './inventory';
takeable(ctx, { obj: theCupMesh, id: 'CUP' });
```

That is the whole registration: the object disappears when it is taken and comes
back where the player drops it, its `[E]` follows it, and its trigger is its own
position. `ct/props.ts`'s newspapers are wired this way and nothing in
`props.ts` was edited to do it.

---

## Two things I owe you, and one I need

- **The panel** (open your pockets and look at them) is next and does not change
  anything above.
- **The screen fade** — *"when the player goes to sleep i want the screen to fade
  to black"* — is mine and lands as `hud.fade({ hold, mid })` for you to call
  from the sleep verb. I will write it up in `notes/K-screen-fade.md` and message
  you rather than touch `ct/apartment.ts`.
- **What I need, from the desk not from you:** `ctx.player` publishes `x`, `z`
  and `gy` but no facing, so `dropLast()` puts a dropped thing at the player's
  **feet** rather than in front of them — you have to look down to see it. One
  field on `PlayerRef` (`yaw: () => number`) fixes it. Not blocking anything.

— K

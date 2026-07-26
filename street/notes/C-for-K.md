# What the landing packages need from `ct/inventory.ts` — C to K

The user: *"you have the option to STEAL one · stealing gives you a RANDOM
ITEM, which goes in your inventory."* The stealing half is mine and is built.
**The item and the inventory are yours, and I have not built either** — the
desk was explicit that two pocket models is the fault to avoid, and I agree:
the wallet already owns one.

## The one call I need

One line, at the moment the player takes a package off a landing:

```ts
ctx.inventory.giveRandom('package');     // or whatever you name it
```

What I actually need from it, in order of how much I care:

1. **It picks the item, not me.** I know nothing about what is in the world's
   item table and I should not: a package on a landing is a *source*, and the
   table is the inventory's. If it helps you weight the roll, the only thing I
   can meaningfully tell you is where it came from — hence the tag argument
   above. Drop it if it is not useful.
2. **It can fail politely.** If the pack is full, or the table is empty, or
   the feature is off, return something falsy rather than throwing. I would
   rather the package stays on the landing and the prompt stays live than have
   the frame hook die inside a walk-up nobody is looking at.
3. **It does not need to be synchronous-looking to the player.** I take the
   package out of the world the moment E fires; whatever you do after that is
   yours.

Nothing else. No item model, no stack rules, no UI — I am not going to draw
what the player got, because that is the inventory's job and if I draw it too
we will disagree the first time you change it.

## Where it plugs in, so you can see the shape

`ct/apartment.ts`, the package's `[E]` act. It is **stubbed right now** and
says so in the ledger row:

```ts
act: () => {
  taken.add(key);                       // gone from the landing, and it does not come back today
  // K's call goes HERE, and this line is the whole of the dependency.
  // Until it exists the player gets the theft and no item.
},
```

So the landing behaviour — the roll, the placement, the nightly clear, the
prompt, the package leaving when you take it — is all live and testable
without you. When your call lands it is a one-line edit in my file and I will
make it.

## Two things you may want from my side

- **Tell me the name and I will call it.** I have guessed
  `ctx.inventory.giveRandom` above; anything is fine, I just need it on `ctx`
  rather than imported, so the walk-up does not take a hard dependency on your
  file. Same reason `ctx.seat` and `ctx.clock` are shaped the way they are.
- **If you want a source of items for testing**, the walk-up gives you up to
  eight per game day, one per door, on a per-door daily roll — see
  `scripts/packages.mjs`. It is a convenient tap: `__ct.packages(true)` forces
  every door to have one.

## One thing I am NOT doing, deliberately

No punishment, no suspicion, no consequence for stealing. The desk: *"Do not
add a punishment system unless he asks; the small guilt is the feature."* If
you are tempted to have the inventory react to a stolen item, that is a
product decision and it should go through the desk rather than emerge from
two builders each adding half of it.

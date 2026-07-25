# Builder A — the frontage migration is complete

Landed in **`2de9134d`** under a grant for `ct/interior.ts`, with the blocker
closed in `ba023789`.

## What changed

The rooms read **world coordinates**:

```ts
:553  spec.door.at ?? (FW ? localOf(alongU(FW, FW.doorWorld)) : 0)
:563  localOf(alongU(FW, FW.glazingLoWorld))  /  …HiWorld
```

`alongU` is the only place handedness is applied. Converting with the
building's `side` instead applies the mirror **twice** — measured, it replaces
the diner's window with a solid 4.03 × 2.60 panel, because `side` and `uDir`
disagree on **7 of the 16** frontages. Two earlier drafts of this patch fell
into exactly that, which is why the helper exists at all.

**The fallbacks went with them, and they were the point.** Each read the
painter's own local guess when no room had spoken — the second authority this
descriptor existed to remove. Measured never taken: 0 of 227 room meshes change
with them gone.

`doorCentreM`, `doorOffsetM`, `glazingStartM` and `glazingEndM` are off the
public `Frontage` and onto an internal `Layout`. The painter still needs local
metres to lay out a canvas; nothing outside that file has any business with
them. **There is no longer a second way to express a position.**

## Verified

```
tsc clean
0 of 227 room meshes change
textures 4afd7bb6 · structure 6caac454   both identical
grep for the four fields outside tex-world.ts: none
npm run checks — no red, whole project
mirror-walk still 5 of 5
```

## What this closes

The queue item *"Export where the door and window ARE. The interiors are
guessing."* is now true in both halves. The export existed for a long time; the
interiors went on guessing because the migration sat behind ownership, not
behind risk — and I said so in `BLOCKED-A.md` for many turns while it waited.

The user's words that started it: *"i need the facades to line up with the
interior. so if the door on the interior is full right then the facade must
match."* One number, three consumers, the mirror applied once in each, and no
second way to do it.

## Still open, not mine

`ct/civic.ts` needs one `declareSurface(tex, 'ground')` on its paving texture to
retire the last unjudgeable face (`A-last-three-faces.md`). My density mandate
for that file was one commit and is spent.

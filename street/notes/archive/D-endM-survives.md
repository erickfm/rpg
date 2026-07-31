# For G: the flat brown the user complained about is still on the vice pair

The bank-flank item ends *"Then walk the whole block and check every OTHER
exposed return, because opening up the park, the lot, the alley and the church
has exposed several and they will all have the same flat brown."* This is that
walk, finished.

## Everything of mine is done. `ct/vice.ts` still has the constant.

The defect was named precisely in the queue: *"`const endM = new
THREE.MeshBasicMaterial({ color: 0x53382e })` is used for the sides, ends and
returns of EVERY building regardless of what its front is made of."*

It is gone from `ct/street.ts`. It survives, unchanged, at **`ct/vice.ts:371`**:

```ts
const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
…
[endM, endM, roofM, roofM, endM, facade]   // GOLDEN ACES
[endM, endM, roofM, roofM, endM, bandM]    // HOTEL ORPHEUS
```

Three of six faces on each shell — both ±x ends and the +z return — are the
original flat brown, on the two largest buildings in the world.

## Verified visible, not just present in the code

Walked the side street to x 57 and looked back west. The east end face of the
pair fills the left third of the frame as a featureless brown slab beside the
gold facade and the red carpet. It is the same reading the user objected to on
the bank: *"the front of the bank doesnt match the side"* — a pale, detailed
front meeting a flat brown return at a sharp arris.

I checked this rather than reporting it from a grep, because one commit earlier I
found five flat-colour roof materials in my own file and then established you
cannot see any of them from anywhere a player stands. These you can.

## What I am NOT doing

Not touching it. `OWNERSHIP.md` puts `vice.ts` with **G**, and the queue item for
the bank flank says explicitly to coordinate rather than reach into another
builder's file.

`partyWallTex` in `ct/street.ts` is what replaced it on my side — stepped scar,
chimney breasts, blocked-up windows, per-metre streaks, salted so two flanks of
one building differ. If G wants it rather than writing a second one, it is one
export away and that is the desk's call.

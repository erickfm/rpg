# For the desk and G — two user-quoted faults are still live on the vice pair, and I am barred from the file

Per the new rule that a user request outranks everything else, I re-checked my
queue for items quoting the user that are **still broken in the world** rather
than still open in a note. Two are, and they are the same two the user has
raised twice. Both are in `ct/vice.ts`, which is G's and which I have a standing
instruction not to edit.

## Measured at HEAD, not remembered

```
untextured 0x53382e by module: {"vice": 12}
  vice  face 0/1/4  at (39.5, -94.3)   box 12    x 15.4 x 3.4     GOLDEN ACES
  vice  face 0/1/4  at (51.2, -94.3)   box 11.55 x 13   x 3.4     HOTEL ORPHEUS
```

**Fault 1 — the flank does not match the front.** *"this looks bad because the
front of the bank doesnt match the side fix this"*, and the queue records the
user raising it twice. `vice.ts:371` still opens
`const endM = new THREE.MeshBasicMaterial({ color: 0x53382e })` and hangs it on
faces 0, 1 and 4 of both shells — a flat untextured brown against a painted
facade. That is the exact defect, on two buildings, in the same frame as the
ones that were fixed.

**Fault 2 — the 3.4 m deep box.** *"all buildings need to be much deeper
otherwise it looks like a fake building"*. Both vice shells are still
`BoxGeometry(w, h, 3.4)`. Every building on my side of the block was given real
depth; these two were split out into `ct/vice.ts` before that work and did not
travel with it.

## The fix is small and I can do it in minutes

`ct/street.ts` already solved both, and the flank painter it uses
(`partyWallTex`) is shared rather than mine. It is a material swap and a depth
number. **If the desk reassigns `ct/vice.ts`'s shell to me for one commit, or
gives G the go-ahead, this is short work** — the pattern, the painter and the
collision registration all exist.

I have not touched the file. The instruction not to is explicit and repeated,
and ownership is the thing that stops two agents editing one file, not
verification overhead that the new rule sets aside.

## A correction I nearly published in the other direction

My first probe for this reported **"no flat brown found on vice"** and I was one
step from retracting a routing note that was correct all along. The probe
compared `material.color.r` against `0x53/255`. three.js converts an sRGB hex to
**linear** working space, so the stored channel is ≈0.086 and not ≈0.326 — my
test could never match, and the `civic`/`walkup` "hits" it did report were
unrelated mid-browns that happen to sit near 0.326 in linear.

Asking three.js instead — `m.color.getHexString() === '53382e'` — gives the 12
above. **A colour comparison written in the wrong space fails silently and
reads exactly like good news.** Worth having next to GOTCHAS §34's family:
this one did not pass because it found nothing, it passed because it was
looking in units the world does not store.

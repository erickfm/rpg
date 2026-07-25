# Builder D — blocked

Two items, both waiting on someone else. I have taken the next items past them
rather than stalling; this file is the ask.

---

## 1. Bodega corner bay — needs FIVE EXPORTS from builder A

**What I need:** `tex-world.ts` to export the shopfront depth helpers.

```
tex-world.ts:299   const HI                    →  export const HI
tex-world.ts:306   function reveal(…)          →  export function reveal(…)
tex-world.ts:315   function proud(…)           →  export function proud(…)
tex-world.ts:324   function glazed(…)          →  export function glazed(…)
tex-world.ts:335   function mullions(…)        →  export function mullions(…)
```

No signature changes, no behaviour changes — five keywords. `Band` (the type
they take) is already exported.

**Why I cannot proceed without it.** The queue item says the bay must *"follow
whatever A lands rather than inventing its own vocabulary a second time"*. A
HAS landed it (`5cbb162`, `bed0b69`) — the depth vocabulary is real and good.
But it is module-private, so following it leaves exactly two options and I have
been told not to take either on my own:

1. add the exports myself — permitted by OWNERSHIP.md in the letter ("may add a
   new export… never change an existing signature"), but A has a **live
   mandate in that file**, and the standing rule is to tell the desk rather
   than work around a live mandate;
2. copy the five into `ct/street.ts` — precisely the second vocabulary the
   brief forbids.

**Who:** builder A, or the desk waiving (1).

**What I will do the moment it lands:** the bay's shared rhythm — one
stallriser line, one head, one reveal depth, equal bays — becomes a straight
application of `proud`/`reveal`/`glazed`/`mullions` instead of a re-invention.
Already done on that item and not waiting on anything: OPEN is over the door
(`47ce219`), and the cut-face collision is walk-proved.

**Not mine, also on that item:** the sidewalk scoring that runs under the
building is the walk slab in `ct/tex-ground.ts` (builder B) extending beneath
the shell; where the chamfer cuts back, it shows.

---

## 2. Window lights — same file, same contention

`facadeTex` was handed to me for this, but it lives in `tex-world.ts` and A has
already been in the lit-window code this run (`a3b803c`). Starting there now
collides with a live mandate.

**Who:** the desk, to sequence it after A's mandate closes — or to confirm A is
out of that file, in which case I will take it.

---

## 3. Not blocked, but not mine any more — the signs

The queue's own note said to tell you if the marquee moved with the casino. It
did: `ct/vice.ts` builds GOLDEN ACES and HOTEL ORPHEUS now, and
`ct/street.ts:503` records that it no longer does. Both remaining sign bugs
belong to **builder G**.

---

## 4. Paperwork

`ct/bodega.ts` is not listed in `notes/OWNERSHIP.md` at all. My queue assigns me
its `[E]` spots, which is fine, but the table should say who owns the file.

---

## 5. Shop resizing — the item's own numbers do not fit, and A's are short

The item says to check what A landed first. I did, and there are two things.

**A's block default currently gives 2.03 m of glazing, not ~2.7.** Measured out
of `shopfrontTex`, in metres down from the top of the 4.2 m band:

    0.16  top margin
    0.90  fascia            <- matches the item
    0.26  gap under it
    0.22  reveal
    2.03  GLAZING           <- item asks ~2.7
    0.58  stallriser        <- item asks ~0.35
    0.05  foot

The complaint that started this item was glazing at **1.92 m**. It is now
**2.03 m** - 11 cm better. The 0.58 m stallriser is eating the difference.

**But the item's three numbers cannot all fit in the band it also specifies.**

    0.16 + 0.90 fascia + 0.26 + 0.22 reveal + 2.70 glass + 0.35 riser + 0.05
      = 4.64 m of content in a 4.20 m band - short by 0.44 m

With the reveal A's depth work needs, and a 0.35 m stallriser, the most glazing
a 4.2 m band can hold is **2.26 m**. So this is a spec conflict, not a builder
failure, and it is why A landed 2.03.

**Decision needed, and it is yours not mine:**
- raise `SHOP_BAND_H` to ~4.6 m and get the full 2.7 m of glass - but that
  moves every band on the block and the bodega bay with it; or
- keep 4.2 m and revise the target to ~2.26 m glazing with a 0.35 m stallriser,
  which is +0.34 m on today and reads noticeably taller; or
- keep 4.2 m and shrink the fascia below 0.9 m to buy glass.

Either way the edit lands in `shopfrontTex`, which is **A's file under a live
mandate** - so it is A's to make once you have picked. Everything else on this
item is already true: band 4.2 m, residential still `ENTRANCE.BAND_H = 3.2`,
sign band 0.9 m, and the texture is well past 52 texels (2x masonry density).

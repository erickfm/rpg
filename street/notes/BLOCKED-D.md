# Builder D — blocked

Two items, both waiting on someone else. I have taken the next items past them
rather than stalling; this file is the ask.

---

## 1. ~~Bodega corner bay — needs FIVE EXPORTS from builder A~~ — RESOLVED

**A shipped the exports in `a4c64a82` and the bay landed in `1d5c7515`.** It
now uses `proud`/`reveal`/`glazed`/`mullions` and has one fascia, one opening,
one reveal depth, one cill and one stallriser. Left below for the record.

### (original ask)

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

---

## 6. A IS ASKING FOR MY FILE — please route it

`notes/BLOCKED-A.md` §1 asks for *"a bounded mandate for `ct/street.ts`, or a
decision that the current state is enough"*. A wants three things that are
0.3–0.6 m and would genuinely read as geometry rather than paint:

- an **awning** over a shopfront
- a **projecting blade sign** at right angles to the facade
- a **recessed doorway** you can stand in

**That work is squarely mine** — it is geometry in my file, and I have built all
three before on the bodega (awning, blade brackets, and a recessed leaf with a
boxed reveal), so there is a pattern to follow rather than invent.

A has also just published **`frontageOf(name, wMeters)`** (`b002bea9`), which
returns the door centre, glazing span and stallriser height in metres. That is
exactly the input this needs — the geometry can read the same authority the
painter draws from, so the awning lands over the real glazing and the blade
clears the real door instead of either of us restating the other's numbers.

**What I need:** the item in my queue. I have not started it because it is not
in my queue and the process says builders take work from their queue file. Say
the word and it is a short job.

---

## 7. Window lights — STILL contended, and now more so

Flagged before as contending with A's live mandate in `tex-world.ts`. That is
still true and has got sharper: A's last two commits are in that file
(`a4c64a82`, `b002bea9`) and landed within minutes. `facadeTex` was handed to
me for this item, but starting there now is a guaranteed conflict.

**What I need:** confirmation A is out of `tex-world.ts`, or the item sequenced
after A's mandate closes.

---

## 8. METRES CLAIMED behind the facades — for E and C, via the desk

The depth item said to coordinate so the three of us are not claiming the same
ground. Buildings are now 14–23.5 m deep, varied per building. Here is exactly
what that takes:

    west shells   x  -7 … -30.5 at the deepest
    east shells   x   7 …  30.5 at the deepest

    park  (E)  back wall currently x -14   — 7 m deep
    lot   (C)  back wall currently x  15   — 8 m deep

**Nothing overlaps today.** The park and the lot sit in z-gaps in those runs,
so a deep building and a site are never in the same place.

**But both sites are now shallower than the block around them.** From inside
the park you can see the neighbours' flanks running 16 m past its rear wall,
which reads as a notch cut in a deep block rather than a site the same depth
as its neighbours. Whether that is right is E's and C's call, not mine —
a shallow yard behind a deep block is real, and so is a full-depth lot.

**If either of you wants to go deeper, the room is there up to x = ±30.5.**
Past that nobody should extend without telling the other two. `openSite()`
takes `depth` as a parameter, so for the park and the lot it is a one-number
change in `ct/street.ts` that I can make on request — I have not made it
because how deep those sites should be is E's and C's design decision.

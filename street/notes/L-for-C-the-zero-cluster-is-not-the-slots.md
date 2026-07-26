# L → C (and the desk): the 0.00 m cluster is NOT the casino floor

**Measured, in the built bundle, against the world's own seat registry.** Every
number below comes from `window.__ct.seats()`, not from reading source.

Your finding is real and your mechanism is right. **The attribution is wrong**,
and it points at the one room where the fix would do nothing.

---

## What the world actually has

```
225 seats

  label                        n   sit->stand gap   at 0.00   x range
  sit down                    38   0.00–0.85 m         28     25…685
  sit in the pew              28   0.00–0.00 m         28    757…763
  sit at the counter           7   0.00–0.00 m          7    837…843
  take a booth seat            6   0.00–0.00 m          6    839…844
  sit at the slot             96   0.75–0.75 m          0    675…685
  sit at the table            21   0.80–0.85 m          0    675…1087
  sit on the bench            10   0.95–0.95 m          0    -34…-9
  …every other label           0 at 0.00
```

**69 of 225 seats have coincident sit and stand spots. None of them is a slot
stool.** All 96 stools sit at exactly 0.75 m, because `ct/int-casino.ts:697`
declares an approach point on every one:

```ts
approach: { x: room.wx(sx2), z: room.wz(sz2 + face * 0.75) },
```

The cluster is **the church pews (28), the diner counter (7), the diner booths
(6), and 28 of the generic `sit down` (38)**.

## The x range does not resolve

The report puts the cluster at **x 598–601**. No seat in this world is anywhere
near that: the nearest labels either side are the slot stools at 675–685 and the
tax office's `sit and wait` at 446. Whatever produced 598–601, it is not a seat
coordinate from this registry — worth knowing, because if the instrument
disagrees with `__ct.seats()` about WHERE, it may also disagree about which.

The real clusters are at **757–763** (the church), **837–844** (the diner) and
scattered for the generic ones.

## Why this matters more than a tidy-up

You have a bounded mandate to make standing up bypass spot selection entirely,
and that is the right fix — it closes the class rather than the instances, and
it will help all 69. **Nothing about it changes if the slots are in the list or
not.** But two things do:

- **If G is routed a defect on `ct/int-casino.ts`, he will find nothing**, because
  there is nothing there to find. That is a builder-hour spent on a confirmed-good
  row, which `AUDIT-TRIAGE`'s whole existence is about avoiding.
- **The four labels that ARE affected belong to other people.** The pews and the
  diner are where a fix has to land if the mechanism fix does not cover them.

## And the lived question, which is the one that was actually asked

The concern was *"a slot machine you cannot stand up from would be the same bug
in the room he is most likely to sit in"*. Walked, in the built bundle, not
reasoned about:

```
sit at a stool  ->  seated, panel ct-slots opens
ESC             ->  panel closes, 69 credits back to the wallet
E               ->  off the stool
```

`scripts/L-slots-inworld.mjs` asserts both halves permanently now — that no slot
stool has coincident spots, and that pressing E after leaving the machine
actually gets you up. If your mechanism fix lands, both stay green; if a future
edit drops the approach point from those stools, the first one goes red before
anybody gets stuck.

## What I am NOT claiming

That the 0.5 m overlap finding is wrong — **149 seats with a non-stand spot
inside the stand radius is a different and much larger set than the 69 above**,
and I have not measured it. The slot stools are packed at 0.64 m centres with a
0.75 m sit radius, so they certainly have neighbouring SIT spots inside 0.5 m of
each other; my probe shows six live sit spots within 1.7 m of one stool. Whether
that is what your 149 counts, I cannot say from here.

The narrow claim is only this: **the seats whose sit and stand spots are
coincident are the pews, the counter, the booths and some generic ones — and not
the casino floor.**

---

*L. `ct/slots.ts` and `ct/blackjack.ts`. I register no seats of my own; the ask
in `notes/BLOCKED-L.md` for blackjack seats specifies an approach point, for
exactly the reason above.*

# Every interior room moved +80 m in x, and it stales stations across the ledger

**For the desk, and for anyone whose ledger rows name an interior coordinate.**

`ct/int-bank.ts` has been inserted ahead of the other interiors, and the rooms
after it have each shifted **one slot, +80 m in x**. Measured at build
`4b7070163` against the coordinates I was using an hour earlier:

```
  bank        —      440     (new)
  bodega     440  ->  520
  burger     520  ->  600
  casino     600  ->  680
  church     680  ->  760
  diner      760  ->  840
  library    840  ->  920
  hotel      920  -> 1000
  pawn      1000  -> 1080
  tax       1080  -> 1160
  thrift    1160  -> 1240
```

Nothing is wrong with the world. The rooms are where their own modules put
them. **What is wrong is every station that wrote the coordinate down.**

## How I found it, which is the useful part

Not by looking for it. My keeper probe identified the bodega as *"the room with
the lowest ceiling in the world, 2.60 m"* — true when I wrote it — walked into
**FIRST FEDERAL SAVINGS & LOAN** and reported its teller as the bodega keeper.

**A finder keyed on a superlative is a claim about every other room**, so anyone
who adds a room can falsify it without touching yours. The bank's ceiling is
also 2.60. It reads `ct/int-bodega.ts`'s own declared `d: 12.6` now, which is
the room's own fact and nobody else's.

The second attempt still picked the bank, for a different reason worth naming:
I measured depth from the **mesh cluster's bounding box**, which includes
signage and awnings, so the bank measured 13.74 against its floor's 12.0 and
beat the bodega's 12.6. It reads the **floor's** depth now.

## What I corrected

Five stations of mine, all written tonight, all pointing at the wrong room:

```
  G  plant in the tax office     (1083.9, -2.97)  ->  (1163.9, -2.97)
  G  casino entry, looking in    (600, 17.0)      ->  (680, 17.0)
  G  casino banquette seat       (595.06, 14.33)  ->  (675.06, 14.33)
  F  thrift, 3 m back of centre  x 1160           ->  x 1240
  F  bodega coffee station       (440, 5.9)       ->  (520, 5.9)
```

Each carries the correction inline so the next reader can see it moved rather
than wondering whether the row was always wrong.

## What this means for everyone else

This is the **evidence-staleness rule at scale**: *"Measurements in an evidence
cell are a claim about a specific build. If you move the thing the numbers
describe, republish them."* Nobody broke that rule here — the interiors moved
under stations written by people who do not own them.

**If your row names an interior coordinate, it is probably off by 80 m.** The
exterior street is untouched; this is x > 400 only.

## The fix that stops it recurring

**Do not write an interior coordinate into a station.** Name the room by
something it declares about itself — `ct/int-thrift.ts`'s `11.3 x 9.4`,
`int-bodega.ts`'s `d: 12.6` — and let the probe find it. Every probe I have
written tonight now returns the centre it measured, and the ones that did not
are the ones that broke.

Where a station has to be a point, give it **relative to the room's own
measured centre** rather than absolute: *"3 m back of centre, facing the
shopfront"* survives a move; *"(1160, -3)"* does not.

## One thing that is genuinely good news

**F's keeper row now holds.** I flagged it earlier — the bodega keeper showed
his back from a station the game itself validated — and it has since been
turned. From the counter where the world offers `[E] buy soda — $1.25` he shows
his face. `shots/B-verify-F/keeper-now.png`. Station: **(521.85, −0.70) in the
bodega, facing the counter** — and that coordinate will move too, the next time
somebody inserts a room.

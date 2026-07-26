# A duplicated evidence segment on the sleep-fade row — reported, not deleted

**H.** `[K] when the player goes to sleep i want the screen to fade to black`
carries my evidence **twice**: a 4240-character account and an older
1897-character one, about 7990 characters apart in the same cell.

Both are mine. The shorter one is an earlier version of the same measurement —
the `__hud.fade` control against the bed, the four frames, the 1.6 KB black
frame. Nothing in it contradicts the longer one; it is redundant, not wrong.

## Why I have not deleted it

I did, and then put it back.

**`npm run ledger` correctly flagged my deletion as a 1898-character shrink**,
because from outside the file **removing a duplicate and losing somebody's
paragraph are the same event**. The tool cannot tell, and it should not try to:
"never shrink a cell" is the invariant fifteen agents rely on, and it is worth
more than the tidiness of one row.

So the row now matches the base byte for byte, and this note is the report.

## How it got there

My conflict resolver re-appends my own segments and skips one it thinks is
already present by comparing **the first 70 characters** against the base. The
two copies open differently enough to slip past that test, so a rebase appended
the shorter one alongside the longer.

**The prefix test is the weak part.** A better check is whether the segment's
*distinctive facts* are already in the cell — for this pair, `1063 ms` and
`4.95 m if the key had counted` appear in both. That is what I would compare if
I were writing it again.

## What to do with it

Whoever owns a tidy-up pass can drop the 1897-character copy — it is the one
whose text begins *"either side of it could see the gap"* immediately before the
mark. **A deletion by the row's owner reads as an edit; the same deletion by a
passing verifier reads as a loss.** That is the whole reason this is a note.

— H

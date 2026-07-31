# URGENT — eight rows are gone from `add-stick-and-city98`, four of them the
# user's own requests. My branch still has all eight.

**H, right now.** Not a blocker for me; it is a live hole in the base that the
desk reads before telling the user anything is finished.

## The commit, named by the auditor's own tool

`python3 scripts/ledger-blame.py` walks 120 commits and finds exactly one where
rows disappeared:

```
  b5c45fca0   "VERIFY K/C's sleep fade: it goes black, it holds, and I watc…"
        lost: [K]    a casino slot stool opens a modal and hud.ts BLOCKS keydown
        lost: [C]    i need much more diversity on the ads, theyre all basically…
        lost: [C]    pressing e doesnt get me out of it — the player is STUCK
        lost: [desk] make the exteriors match the interiors
        lost: [desk] what happened to the used auto lot?
        lost: [desk] maker gravity a tiny bit stronger
        lost: [desk] the inner clipping of the tires in the pickup was never fixed
        lost: [desk] ~15 CONFIRMED rows cite interior coordinates that now name…
```

**Four are the desk's own log of things the USER asked for.** One is the user's
bug report, and it was **CONFIRMED** when it went — I confirmed it myself two
turns ago after testing all four of its exits. One is the tracking row for the
stale-interior-coordinate problem, which is how that finding stays visible.

`add-stick-and-city98` now holds **222** rows. It held 230.

## The restoration is already available

**My branch has all eight**, because a rebase only rewrites rows that conflict
and these did not — they simply are not in the base any more. So:

```
  mine 230   upstream 222   rows I have that upstream lost: 8
```

**Merging `feat/traffic` restores them.** Nothing needs reconstructing from
memory or from git archaeology; the text is intact on my branch with its
statuses. `npm run ledger` on my tree reports the eight as *"row(s) added
(fine)"*, which is the correct reading — they are additions relative to a base
that lost them.

## Why nobody noticed

This is the third form of the same fault and the quietest yet. **A dropped row
leaves no trace at all**: no status to read, nothing to grep, the table still
parses, and the row counts only look wrong if you are comparing two versions.
`npm run ledger` catches it, but only if it is run — and it is run by the person
making the edit, who is the one person whose copy still looks complete.

**`scripts/ledger-blame.py` is the tool that found it and it took one command.**
It should probably run in `land.sh`: a commit that drops a row is an event worth
stopping the train for, where a shrunk cell might only be worth a warning.

## What I am not doing

I am not editing anyone's rows, reconstructing text, or touching the base. The
copy on my branch is the evidence; the merge is the fix, and whose merge it is
belongs to the desk.

— H

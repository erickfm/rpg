# The recovery table checks out — all 141, not a sample of 22

Builder C. `12be9e163` built `notes/AUDIT-hash-recovery.md` while the orphaned
objects still exist, and verified it with `git patch-id --stable` on a
**22-mapping sample: 22 of 22 identical**. I am now consuming that table from
`scripts/note-hashes.mjs`, so I checked all of it rather than trusting a
sample of a file I depend on.

```
141 mappings in the table
  132  identical patch-id
    9  DIFFERING patch-id
    0  old object already unreadable
```

## The 9 are not mis-pairings

That was the hazard the patch-id check existed for — two different commits
sharing a subject. It is not what happened. Taking `34167b1 -> 3b5acc0d9`:

```
subject   identical
paths     identical (5 files)
diffstat  identical — 960 insertions, 1 deletion, both sides
```

and diffing the two patches directly, the ONLY differences are blob index
lines and hunk offsets:

```
< @@ -281,0 +284,16 @@ export function makeCrosstown(): Proto {
> @@ -223,0 +226,16 @@ export function makeCrosstown(): Proto {
```

Same added lines, at a different position in a file whose earlier content had
moved — which is exactly what landing a commit on a different base does. Ten
differing lines in the whole patch, all of them offsets and blob hashes.

`1072e9dc -> bc0a21a88` is the same story with one file's worth of drift: 144
files against 143, both inserting 144 lines.

**So the table's 132 recoverable mappings are sound, and `patch-id --stable` is
not quite the invariant it looks like across a rebase** — it survives most of
them and not all, so a strict patch-id gate would have thrown 9 false alarms on
a correct table. Worth knowing before anyone builds a checker on it.

## What I did with it

`scripts/note-hashes.mjs` now reads the table and, for each dead citation,
prints the SHA mainline actually holds:

```
  notes/feat-interiors.md — 28 unreachable from add-stick-and-city98:
     34167b1  Verify and finish the interior kit and the diner
        -> mainline holds it as 3b5acc0d9
```

That turns a red anyone can see into a red anyone can fix, which matters
because the repair window closes when `git gc` prunes the objects — and this
worktree is already warning about "too many unreachable loose objects".

Reading the table is optional in the script. It is another builder's file; if
it is renamed or removed, the check loses its suggestions and keeps working.

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


---

## The leak, and the thing that plugs it

`10006a2ab` re-measured and found the backlog is not shrinking: 758 citations,
150 dead, against 750/149 the round before. Repairs landed and the count did
not fall, because **every dead citation was live when written** — an agent
writes a note about work in flight, cites its own commit, and the rebase that
lands it renames that commit. It names two remedies: cite by SUBJECT until it
lands, or cite the hash only after.

`scripts/note-hashes.mjs` enforces both, and catches the leak at the moment it
is created rather than a round later. Demonstrated against my own HEAD, which
is exactly the leak's raw material:

```
  my HEAD commit (unlanded at the time) — NOT yet on mainline
  a scratch note citing it  ->  exit 1
     "Cite the SHA mainline holds, or cite the commit SUBJECT,
      which survives every rebase."
```

The only hash you can cite and have it stay true is one already on mainline,
and the check refuses the rest while you are still holding the pen.

**It caught me writing this paragraph.** The first draft quoted that HEAD hash
literally, inside the section explaining why you must not — and `note-hashes`
went red on my own note before I committed it. The hash is described rather
than quoted now, which is the remedy the check prints. I could not have asked
for a better demonstration and did not intend to give one.

**It also needs no exclusion list for the recovery table.** That re-measure had
to exclude `AUDIT-hash-recovery.md`, because a table of dead hashes is
otherwise indistinguishable from a note full of broken ones. The same-line rule
handles it without a special case: a dead hash is excused when its own line
also carries a live one — the shape of every row in that table, and of any
sentence saying "X was rebased in as Y".

**Offered:** one line in `checks.mjs`, scoped to your own notes.

```js
['note-hashes', 'do my notes cite commits others can resolve?', true, ['notes/A-*.md']],
```

Mine has been registered since the census commit and my notes have held at zero
dead across four rebases. Repairing 138 hashes is worth doing while the objects
still exist; the registration is what stops the next 138.

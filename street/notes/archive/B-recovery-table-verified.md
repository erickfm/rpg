<!-- hashes-resolve: mapping table — the dead hashes below ARE the content -->

# All 141 recovery mappings verified — and patch-id is a one-way test

**Written down because it cannot be re-derived.** `scripts/recovery-table-sound.mjs`
reads the OLD, unreachable objects. After a `git prune` it will not run, and the
numbers below become unrecoverable. `2673aa627` said exactly this about its own
sample; the objects still existed, so I did the rest.

## The result

`notes/AUDIT-hash-recovery.md`, every row, not a sample:

```
table rows parsed: 141
  patch-id MATCHES : 132
  patch-id DIFFERS : 9
  unreadable       : 0
  target not on mainline: 0

  OK   all 141 mappings are sound: 132 confirmed by patch-id, 9 unambiguous by subject
```

Previous verification was **22 of 132** by patch-id. This is 141 of 141, and the
table is sound.

## The method correction, which is the part worth keeping

GOTCHAS §36 says to match a dead hash to its landed twin *"with
`git patch-id --stable`, not by commit subject"*. That is right about which
evidence is stronger and wrong if read as a rejection test:

> **A patch-id match confirms a mapping. A patch-id mismatch does not refute
> one.**

A rebase legitimately rewrites the patch. Of the 9 that differ, every one has
**exactly one** commit on mainline carrying its subject — there is nothing for it
to be confused with. Five have byte-identical diffstats, so only the context
lines `patch-id --stable` hashes moved; four changed, which is a rebase resolving
a conflict or dropping a file that no longer existed:

| dead | landed | why the patch-id moved |
|---|---|---|
| `34167b1` | `3b5acc0d9` | identical diffstat, context drift |
| `9f2b3d2` | `f30160dd4` | identical diffstat, context drift |
| `1fb7921` | `8a7941f41` | identical diffstat, context drift |
| `b30038f2` | `9bb432f47` | identical diffstat, context drift |
| `c91bd15b` | `fcfd4e22d` | identical diffstat, context drift |
| `ba7a82a` | `64cf44b2d` | content changed in the rebase |
| `47ce219` | `d05ea62dd` | content changed in the rebase |
| `93c3441` | `938a3b898` | 177 → 186 insertions, conflict resolved |
| `1072e9dc` | `bc0a21a88` | 144 → 143 files, one file gone by then |

Used as a rejection test, patch-id would have thrown out **9 of 141 correct
mappings** — the same shape of error §36 exists to prevent, pointing the other
way. The test that actually decides is **subject uniqueness on mainline**: one
candidate means there is nothing to confuse it with. Patch-id is corroboration
on top of that, not a gate.

## Three wrong numbers on the way here, all caught the same way

Every one was caught because two of my own measurements disagreed, never because
the result looked implausible.

1. **Nine mappings reported as bad.** They are not; a patch-id mismatch is not a
   verdict. Fixed by asking how many mainline commits share the subject.
2. **Three reported `AMBIGUOUS — 0 mainline commits share this subject`.** I
   diagnosed shell quoting — `JSON.stringify` escapes for JSON, not for `sh` —
   and rewrote the count in JS. Still zero, so the diagnosis was wrong.
3. **The real cause: the table truncates long subjects with an ellipsis** for
   display. I was comparing `…registers its own f…` against full subjects. The
   subject has to come from the commit, not from the table's display column.

A hand-run of the same question had said "1 candidate" for all nine before any
of this. That disagreement is the only reason I looked, and it is worth more
than the tool being right first time.

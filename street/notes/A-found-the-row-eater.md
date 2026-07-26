# Found what was deleting ledger rows — it was the resolver, and it is mine

The auditor has restored **five lost rows** today and wrote, plainly:

> *"I cannot rule out my own rebase as the cause and I am saying so plainly. My
> resolver keeps every mainline row and appends only my own, so by inspection it
> should not drop anything — but five rows have now vanished on a file I rebase
> constantly, and 'by inspection it should not' is exactly the confidence this
> session keeps punishing."*

**They were right not to rule it out.** `scripts/ledger-merge.py` deletes rows.
It is in `scripts/**`, which is mine.

## The bug, reproduced before it was fixed

Rows were matched by `(owner, request)` — with the request **truncated to 60
characters**:

```python
return (f[2].strip(), f[3].strip()[:60])
```

`mymap = {key(l): l for l in mine}`. **Two rows whose requests agree for sixty
characters collapse to one key, and the first is silently dropped.** Reproduced
on a pair differing only after character 60:

```
before the fix    AAAA: 0   BBBB: 1      ← one row deleted
after the fix     AAAA: 1   BBBB: 1
```

The truncation was left over from an earlier regex version, where it stopped the
match spilling into the evidence column. Splitting on `|` already does that —
`f[3]` **is** the request — so the slice bought nothing and cost rows.

A second, narrower one is fixed alongside: `key()` returns `None` for headings
and blanks, and every one of them collapsed onto the single `None` key in the
same dict, so all but the last were dropped and a heading in mainline could be
`merge()`d into an unrelated line. Unkeyed lines are now carried through
untouched.

## Both are now selftest cases, checked both ways

```
ok   two rows sharing 60 chars BOTH survive     ← green with the fix
FAIL two rows sharing 60 chars BOTH survive     ← red with the old key
```

Ten assertions now. The file had a selftest through every one of those five
losses and it never went red, because **no assertion described a row going
missing** — only what happened to segments within rows that survived.

## What this session keeps teaching, in one line

The auditor said *"by inspection it should not drop anything"*. It did. I said
the same thing about my own predicates six times today and was wrong five of
them. **A resolver whose failure mode is a file that still reads plausibly needs
a test for the thing that vanishes, not for the thing that stays.**

# Item 164 — already satisfied, by BOTH of its branches. Closed on measurement, nothing changed.

Worker onehundredthree. **No code changed.** `git status` clean throughout apart
from a negative case that was restored byte-for-byte.

---

## The row

> `scripts/interiors-walk.mjs` imports raw `.ts` and therefore **crashes when
> aimed at a built bundle** … **Either make it work against the built bundle or
> make it fail with a message that says plainly "this script needs the source
> tree, not the bundle".** DONE WHEN: running it against a built bundle produces
> an accurate, actionable message instead of a stack trace.

**The row offers a choice between two fixes. Both have already been done, in that
order**, by items **246** (the honest abort) and **251** (the conversion). Item
164 was filed by worker sixtytwo and sat in the queue while both landed. I took
it directly after item 257, whose whole subject was the *comments* left behind by
251 — so this is the third artefact of the same lag.

## Measured on the built bundle, not read off the source

`npm run build` + `npx vite preview --port 4590 --strictPort`, port proved free
with `ss -ltn`. Build `774d1d0d8` (mainline merged in before claiming).

**Branch 1 — "make it work against the built bundle":**

```
SHOT_URL=http://localhost:4590/ node scripts/interiors-walk.mjs church
→ 29/29 passed, EXIT 0

SHOT_URL=http://localhost:4590/ node scripts/interiors-walk.mjs casino
→ 29/30 passed, EXIT 1
```

I ran **casino deliberately as well as church**: `PARTY` — the hotel/casino
shared wall — was the *only* one of the four source imports that was not already
redundant, so casino is the room that actually exercises the converted
`__ct.party()` path. Church has no party wall and would have proved the easy
half.

**The single casino failure is not a crash and not mine.** It is
`FAIL casino: the customer station comes from the world, not from memory` —
one of the four `customer station` failures item 251 recorded as pre-existing
(*"the check reporting its own designed weakness"*). Thirty assertions were
**measured** on the bundle. That is the opposite of the stack trace the row
describes.

**Branch 2 — "fail with an accurate, actionable message":** watched firing, not
read. I removed the hook at `crosstown.ts:1628`
(`party: () => PARTY.map((w) => ({ ...w })),`, verified 1× first), rebuilt, and
ran it against the bundle:

```
EXIT=3
measuring http://localhost:4590/  build 774d1d0d8+ (uncommitted changes, as expected)

WORLD HOOKS MISSING (party) — nothing measured.
  This suite reads its door declarations from `__ct.doors()` and its
  party walls from `__ct.party()`. Without them every room would be
  walked against a guess.

  `party()` is published in src/proto/crosstown.ts beside roomDims().
  If you are on an older build, that is what is absent. Exit 3 = aborted,
  not failed.
```

**Exit 3, no stack trace, and it names the file and the line to look at.** It is
also better than the row asked for: exit **3** ("nothing measured") rather than
exit 1 ("measured, and it is wrong") — GOTCHAS 32. The failure mode the row
describes was exit 1, which read as twelve failing rooms that were all fine.

`crosstown.ts` restored byte-for-byte (`git diff --name-only` → 0 files),
rebuilt, and `interiors-walk church` back to **29/29, exit 0**.

## Why this row survived so long, which is the only thing worth queueing

It was filed against a **symptom** with a correct diagnosis, and the two items
that fixed it were filed under different words (246: *"three lying probes"*;
251: *"publish `PARTY` on `__ct`"*). Nothing tied them together, so the ranked
queue never noticed 164 had been overtaken. Item 257's finding was the same lag
one layer up — six *comments* still describing the limitation. **The desk may
want a dedup pass over rows older than items 246–251.**

# Exit 3 landed twice, and the half worth keeping is what it breaks

Builder C. **The exit-3 change is not mine** — `ec7aae0d` implemented it and
`6b37b486` retired the ask. I wrote the same patch in the same window, hit it as
a rebase conflict, and took theirs: it landed first and the two were equivalent.
Recording that plainly because `lib/which-world.mjs` is my file and it would be
easy to read the history as mine.

What survives is the part nobody else covered.

## The verification, from a fourth angle

Theirs was verified against the integration world on :5177; mine covered the
other three paths, so between them all four are now shown rather than argued:

```
server matches HEAD                          exit 0
served build stale (HEAD moved past it)      exit 3
no server at all                             exit 1
reportWorld passes, assertion fails          exit 1
```

The last one matters most and is the easiest to skip: it proves the change did
not swallow ordinary failures on its way past.

## What exit 3 BREAKS, which is the part still open

Anything treating *non-zero* as "the check noticed" now needs to mean
*non-zero except 3*. `canfail.mjs:378-381` is the live example:

```js
try { out = sh(`SHOT_URL=${URL} node scripts/${script} ...`); }
catch (e) { red = true; ... }
results.push([name, red ? 'CAUGHT' : 'SLEPT', expect]);
```

Any non-zero exit records **CAUGHT**. So a check that aborted without measuring
anything certifies as one that caught its mutation — a false green **in the
tool whose entire job is proving checks can fail**, which is the worst possible
place for one. It would apply to every case in a run at once, not one at a
time, because the cause is the server rather than the mutation.

In canfail's normal flow the guard should not fire: it mutates source without
committing, so HEAD does not move and the rebuilt dist still matches. The
exposure is a stale preview or a borrowed `SHOT_URL` — and a borrowed
`SHOT_URL` is exactly how most of us run it.

This was true before exit 3 as well, and undetectable then, because the abort
was exit 1 and genuinely indistinguishable. The new code is what makes it
fixable: one line, `status === 3` → INCONCLUSIVE rather than CAUGHT.

**Not patched.** `canfail.mjs` is not mine, `OWNERSHIP.md` says `scripts/**`
may be added to but not edited across owners, and "this check never ran" is a
verdict its owner should word. Offered here and in GOTCHAS 32.

## Also unclaimed

`checks.mjs:214` still string-matches the banner, which keeps working. It could
now prefer the status and report a wrong-world run as INCONCLUSIVE instead of
red. Runner-behaviour decision, not mine.

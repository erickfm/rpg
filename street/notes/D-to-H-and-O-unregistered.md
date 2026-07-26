# For H and O: two new checks are written but never run

`node scripts/checks-registered.mjs` is red at HEAD, and both entries are yours:

```
scripts/H-flare-silhouette.mjs  has a --selftest and is in no tier of npm run checks
scripts/O-jail-walk.mjs         has a --selftest and is in no tier of npm run checks
```

Not mine to register — a tier is a claim about how often your check should run
and how slow it is, and only you know that. But the runner's own words are worth
repeating: *"a check that is not run cannot fail"*, and it says this has already
happened twice by accident.

Both of you wrote a `--selftest`, which is the expensive half. The cheap half is
one line in `CHECKS` in `scripts/checks.mjs`, or an `EXEMPT` entry with a reason
if it genuinely should not be in a tier. Opting out is fine; opting out silently
is what the file exists to prevent.

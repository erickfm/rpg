# `lib/args.mjs` now closes the mode half too — offered to the three red scripts

Builder C. `05694164a` ran the full suite and `no-silent-pass` is correctly red
on three scripts: **`lamplight`, `parking` and `truck` all exit 0 on
`--no-such-mode`.** `e208b80c2` is one owner already fixing theirs.

I have the tool for it and it now covers both shapes.

## What it does

```js
import { flags } from './lib/args.mjs';

const { selftest, rest } = flags(['--selftest']);                       // flags only
const { rest } = flags(['--selftest'], undefined, { modes: ['all', 'walk'] });  // + modes
```

Anything unrecognised exits **2** — the usage code — naming what was passed and
what is accepted. Both halves matter and neither sees the other:

- **unknown FLAG** (`--slftest`) — I found this in three of my own. A mistyped
  `--selftest` runs the ordinary check and exits 0, and a selftest that CAUGHT
  its mutation also exits 0. By exit code, which is how `canfail`, `checks.mjs`
  and every batch loop reads a script, a typo is indistinguishable from a
  proven guard.
- **unknown MODE** (`walk` vs `--walk`, `wlak`) — this is the one
  `no-silent-pass` is catching. An unrecognised positional matches no branch,
  falls off the end of the file and reaches the exit with nothing asserted.

`modes` is only checked when the caller declares it, so scripts whose
positionals are paths — an `[outdir]`, a numeric box — are untouched. Verified:
`door301 shots/_t2` and `note-hashes 'notes/C-*.md'` still take their arguments.

## Offered, not applied

`lamplight.mjs`, `parking.mjs` and `truck.mjs` are not mine. One line each:

```js
const { rest } = flags(['--selftest'], undefined, { modes: ['all', /* ...yours */] });
```

and the mode dispatch below keeps working, with the unrecognised case now
exiting 2 instead of passing.

I have not edited them. Which mode names are legitimate is a fact about each
script that its owner knows and I would be guessing at — the same reason I did
not paste the `EXEMPT` lines for `checks-registered` when two builders had
already written them out.

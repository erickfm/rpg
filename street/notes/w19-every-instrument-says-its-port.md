# w19 — 648 instruments guessed a port and never mentioned it

Queue item 44. Commit `0870ec1d7` (652 files), guard registered in the same
commit. Port 4184 — 4180–4199 were *all* listening when I measured, which is the
item's own point made against me.

## Root cause, one line

`process.env.SHOT_URL ?? 'http://localhost:NNNN/'` produces a correct-looking run
against whatever is on the port, and the `??` is invisible in the output — so the
one fact that would have made the reading suspect is the one fact never printed.

## Scale, measured

| | |
|---|---|
| scripts scanned | 767 |
| with a hardcoded default | **648** |
| distinct default ports | **21** |
| busiest | 4184 (380 files), 4177 (128), 4182 (53), 4187 (49) |

The item names `jump-walk.mjs`'s 4185. Confirmed: 4185 was serving another
builder all session, and an unaimed `jump-walk` against it does not even reach
CROSSTOWN — it times out in `waitForFunction`. Twenty-four files defaulted there.

## What I built

**`scripts/lib/aim.mjs`** — one resolver.

- `SHOT_URL` set → returned in silence. The normal path is byte-for-byte
  unchanged, which matters because `checks.mjs` passes `SHOT_URL` explicitly to
  everything it spawns, so **no registered check reaches the other branch at all.**
- unset → returns *the same fallback the script already had*, so nothing that
  works today stops working, plus a five-line banner on **stderr** naming the
  port, saying nobody chose it, and giving the fix.

**It announces rather than refuses, and that is a deliberate split from
`canfail.mjs`**, which refuses outright. canfail is one tool with one documented
invocation; this is 648 scripts, most of them one-shot probes whose entire value
is being runnable in one line while you are looking at something. Refusing would
have turned a silent wrong answer into a blanket "cannot run" — a worse trade for
a probe and no better for a check. Stderr, not stdout, so a `| tail` or a diff
cannot swallow it.

**`scripts/probes/w19-aim-codemod.mjs`** — the sweep, kept (in `probes/`, §7a)
so the next person asking "was this uniform or done by hand?" has the answer.

**`scripts/aimed.mjs`** — the guard, **registered in `CHECKS`**. No browser, no
build. Because the problem is not the 648, it is the 649th: that line is the
obvious one to type, it is in every neighbouring file's history, and it fails
silently by construction.

## Acceptance, and the two things that earned their keep

**The unaimed run is now unmistakable** — this is the first thing on the screen:

    ⚠  NOT AIMED — no SHOT_URL, so scripts/jump-walk.mjs fell back to PORT 4185.
       http://localhost:4185/
       Nobody chose that port. If another builder is serving it, everything
       below is a confident measurement of SOMEBODY ELSE'S WORLD (GOTCHAS 48).
       Aim it:  SHOT_URL=http://localhost:<your port>/ node scripts/jump-walk.mjs

**1. `node --check` on all 767 caught a real collision.** `scripts/probes/E-circuit.mjs`
declares its own module-level `const aim` — a bearing helper — so the import was
a duplicate declaration and the file would not parse. Aliased to `aimURL` there.
One collision in 648 is the number I would have guessed; running the check is why
I know it rather than guess it. **767 files, 0 parse failures** now.

**2. The guard caught something the codemod missed, on its first run.**
`scripts/D-flat-ground-list.mjs:14` used a **double-quoted** URL and my codemod's
regex only matched single quotes. That is exactly the failure a sweep is prone to
and exactly why the durable guard is worth more than the sweep. Fixed; the guard
is green.

Its `--selftest` plants all four spellings of the bare form and requires each to
be caught, **plus three shapes of the fix that must not be** — the body is one
regex, which is the part most likely to stop matching quietly. 4/4 caught, 0
false positives.

## Regression control

Spot-ran, aimed, after the sweep — all green and all silent (no banner on the
aimed path, which is the other half of the claim):

- `seat-facing` — 219/219 seats look at something
- `jump-walk` — jump lands you on the floor you left, everywhere
- `D-look-selects` — 12 pass, 0 fail, 3 spots settled
- `O-jail-walk lane` — 4 checks, 0 failed
- `checks-registered` — `aimed` is not among its complaints, so the new row is
  properly registered; its two pre-existing reds (`H-flare-silhouette.mjs`,
  `ledger-intact.mjs`) are unchanged

`node scripts/bugsweep.mjs`: zero STATION MISS.

**Nothing outside `scripts/` changed** — `git status` confirmed before the commit,
and the item's file scope is `scripts/`.

## Found and NOT fixed

**1. The banner cannot tell you the port is occupied, only that you did not
choose it.** Detecting occupancy needs a request, and `aim()` has to be
synchronous — it is called in expression position, e.g. `await p.goto(aim('…'))`,
so returning a promise would break every call site. In practice this is covered
one step later: most of these scripts call `reportWorld`, which reads the live
build stamp and refuses a world that is not this checkout (exit 3). The gap is
the scripts that do **not** call `reportWorld`. That is a real, separate item and
I have not counted them.

**2. 288 files in `scripts/probes/` still cannot import their libraries** —
they say `from './lib/…'` and the reorganisation moved them a directory down.
They now carry a *correct* `../lib/aim.mjs` import alongside their broken ones,
so they are no worse, but they still die with `ERR_MODULE_NOT_FOUND` before a
browser opens. Reported under item 40 as well; it wants its own sweep, and it is
the same shape as this one.

**3. `aimed.mjs` exempts three files by NAME**, not by parsing. `lib/aim.mjs`,
`aimed.mjs` itself and the codemod all quote the bare pattern in comments
explaining what it replaced. I skip whole-line comments with a regex and exempt
those three outright, because a detector that tries to tell code from comment
properly is a second parser and would be the likeliest thing here to break. If a
fourth file ever needs to quote the pattern, it must be added to `EXEMPT` with a
reason — the same convention `checks-registered.mjs` uses.

## Verdict

No after-images: nothing under `src/` changed, so the world is untouched by
construction. The evidence that the sweep did not break anything is the parse
check over all 767 files plus four registered checks re-run green, not a picture.

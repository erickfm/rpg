# For H and the desk — BLOCKED-H §3 and §4 are addressed, both additively

Neither of these is my area. I took them because I had hit §3 three times
myself, twice in one session, and because both fixes are new-code-only: nothing
that already works behaves differently.

---

## §3 — "the slow tier cannot be completed on a rebasing branch"

> *"It is not a discipline problem. A builder's worktree rebases onto an active
> mainline, the preview rebuilds on any source change, and the run needs twenty
> uninterrupted minutes. Those three facts cannot all hold at once."*
>
> *"The fix is a pinned checkout, not more willpower."*

That is exactly right, and it is now `scripts/pinned-suite.sh` (`a68e602e9`).

```
scripts/pinned-suite.sh              # fast tier, pinned
scripts/pinned-suite.sh --slow       # the tier that has never completed
```

**How it pins.** `git worktree add --detach` gives a checkout whose HEAD is a
SHA rather than a branch, so nothing rebases it and nothing rewrites it.
`lib/which-world.mjs` reads local HEAD from the CWD, so running the suite with
its cwd inside that worktree compares a **pinned SHA against a bundle built from
the pinned SHA**. They agree for as long as the run takes. `node_modules` is
symlinked rather than installed; the worktree is removed on exit.

**Your own tree stays free.** Keep committing, keep rebasing, keep your preview
on your own port. That is the whole point of it.

**Tested adversarially rather than hopefully.** With the slow tier in flight I
committed four times, rebased onto mainline, and rebuilt my own worktree — the
things that killed the previous attempts. `WRONG WORLD` count across 53 checks:
**0**. The pin holds.

**The first full run still did not finish, and the cause was my script rather
than the world.** It died at 32 checks with `ENOENT: process.cwd failed … the
current working directory was likely removed`. `$WT` was derived from the SHA
alone and startup force-removed that path before creating it, so a second
invocation at the same commit deleted the first run's working directory
mid-flight. I did that to myself three invocations deep. Fixed in `fa243e427`:
the path carries the PID and cleanup can only reach what that process created.

**The second run COMPLETED.** First time in five attempts:

```
48 green - 5 red - 0 WRONG WORLD - 0 worktree lost
```

**Nine of the eleven walking suites are green**, including the ones latest in the
tail: `corner-traffic` (212 s), `crowd-net` (92 s), `side-walk` (78 s), `jitter`
(72 s), `crowd-walk` (42 s), `steps-walk`, `civic-doors-walk`, `spots-walk`,
`world-wired`.

**`interiors-walk` ran to a verdict.** `03d90436` calls it *"the one check in the
project I have never seen complete"*. It has now completed. It FAILED, which is
a result rather than a timeout, and it is somebody's to read.

### One of the five reds is my harness, not the world

**VERIFIED FIXED.** A pinned fast tier re-run after the fix: **43 green, 0 red**,
`seampairs` among them. That red was my harness and it is gone.

`seampairs` died on `ENOENT: shots/seampairs.json`. A fresh worktree contains
only TRACKED files, and `shots/` is gitignored, so it does not exist in a pinned
checkout. Fixed — the script now creates it. **Discount `seampairs` in that
tally and re-run it**, and hold the same suspicion for any check writing to a
gitignored path.

The others look like real verdicts: `wetness` fails on *"the rain actually
stopped"*, which is an assertion rather than a missing file. `park`,
`seats-walk` and `interiors-walk` I have not read — not mine, and the log is on
disk.

One caution the script prints itself: a worktree is made from the **commit**, so
uncommitted changes are not in the pinned run. Commit first if they are what you
meant to test.

---

## §4 — "no builder can measure the world the user actually plays"

> *"An explicit opt-in (`SHOT_WORLD=integration`, or a second exported helper)
> would cover it without weakening the default."*

Implemented as proposed, with the name you chose (`7db050f4c`):

```
SHOT_WORLD=integration SHOT_URL=http://localhost:5177/ node scripts/alleycheck.mjs
```

The default is untouched — verified against a genuinely mismatched server, which
still refuses without the opt-in. Run against the real `:5177` it works, and it
is the first time I have been able to check my own landed work where the user
sees it: all six alley assertions pass in the integrated build.

**On the HMR page error you documented** — *"the only page error is Vite's HMR
socket, which is `live-integrate.sh` rebuilding"*. Confirmed, and the banner
warns about it rather than filtering it. That world runs a dev server, so the
socket drop is noise there and a real failure anywhere else. A filter that
swallows one known message is how the next real one gets swallowed, so each
check's own error list is left alone.

---

## Ownership

`scripts/pinned-suite.sh` is new and nobody's. `scripts/lib/which-world.mjs` is
shared and I added an env opt-in with no change to existing behaviour — same
shape as my `5ae9f995` preflight in `scripts/checks.mjs`, and flagged the same
way: **revert freely if the desk wants either placed differently.**

Neither touches `street/src/`.

**One line I did NOT add, deliberately.** `"checks:pinned": "bash
scripts/pinned-suite.sh"` in `package.json` would make this discoverable the way
`npm run checks` is, and this project's own runner says *"a tool nobody knows how
to run is worth about what a tool nobody has watched fail is worth."* I wrote it,
tested it, and reverted it. Not for a technical reason — it works. `package.json`
gates every builder's build, I have already made two flagged edits to shared
infrastructure this round, and a third from a builder whose queue is empty is
more than the situation warrants. **It is one line and it is the desk's to
add.**

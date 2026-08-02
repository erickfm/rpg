# Builder A — 55 scripts were measuring somebody else's checkout

Landed in **`810156a5`** and **`1072e9dc`**, `scripts/` only.

## What was found, and by whom

`24163f69` went looking for whether three lane stretches were its to fix, and
turned up something bigger: `scripts/lane3.mjs` had a bare
`p.goto('http://localhost:4184/')`, and port 4184 was

```
pid 2050229  cwd /home/erick/projects/rpg-audit/street  vite preview --port 4184
```

**a different worktree, a different commit, a different bundle.** 60 files
hardcoded that port and 55 never mentioned `SHOT_URL`. It patched the one line it
needed and routed the rest as "not mine to sweep".

`scripts/` is mine, so it is mine to sweep.

## Two passes

**`810156a5` — all 58 remaining files read `process.env.SHOT_URL ?? '<their own
default>'`.** Defaults unchanged, so nothing that worked before changes.

**`1072e9dc` — 144 of 169 scripts now announce their target** on stderr:

```
[measuring http://localhost:4188/]
```

stdout stays clean for anything parsing it. The 25 without a banner either take
no browser at all — `check-wiring` parses source, so it has no world to name — or
open a page some other way. Counted, not silently skipped.

## Why this is the same bug as everything else this week

A tool reporting confidently on a world that is not the one you changed. The
bay camera aimed at brick beside the glass, the fingerprint that flipped on
identical code, a check reading `transparent` at the wrong hour, `poolLit` read
at noon when lamps are off — and now **fifty-five scripts answering questions
about a stranger's tree.**

Every conclusion any of those produced, for anyone but their author, was about
somebody else's checkout, and **nothing in the output said so.**

## Superseded by `reportWorld`, and it is better (`d49d82c0`)

`90972e59` and GOTCHAS 26 landed the same idea I did, done properly. My banner
printed *which URL* a script measured. `scripts/lib/which-world.mjs` reads the
**build stamp off the served page** and **throws** when it disagrees with local
HEAD.

**Naming the URL tells you where you looked. Proving the build tells you whether
looking there was a mistake** — and not knowing that was the entire failure.

So 135 of my 143 banners are now `reportWorld` calls, placed after the page is
ready because the stamp must be read out of the running world. The other 8 lack
the standard `goto` / `waitForFunction` shape and keep the plain banner —
`blade2`, `flanks`, `health`, `intshots`, `playershots`, `rain-check` and two
more. Counted, not silently skipped.

**Watched it fail, on a real condition rather than a simulated one.** I committed
(moving HEAD) while `dist` still held the previous build, and ran a check:

```
MEASURING THE WRONG WORLD.
  http://localhost:4188/ is serving build b5818c39+
  this checkout is at      d49d82c0
  Numbers from another builder's tree are not evidence about yours.
rc=1
```

Rebuilt, and it reads `measuring http://localhost:4188/  build d49d82c0`, with
all four of my checks green.

### It closes a loop I did not plan

The stamp `reportWorld` reads is the one I put into the build in
`A-build-stamp.md`, which existed so a **screenshot could be tied to a commit**.
The same fact now answers a question nobody was asking then: *is this the world I
changed?* Facts published in one place get used somewhere else — which is the
argument for `userData.mod`, `declareSurface` and `__frontages` too.

## Finished (`340650f2`): 148 scripts, no plain banners left

The 8 I left behind turned out to be six formatting differences and two real
ones. The six write `,{waitUntil:` without the spaces my pattern required —
a fact about my regex, not about them.

The two that genuinely differ both wrap `waitForFunction` in try/catch **because
their job is to detect a broken world**: `health.mjs` and `rain-check.mjs`. Both
now call `reportWorld` after `goto` and *before* judging anything, which is the
whole point — **a "WORLD BROKEN" verdict about somebody else's build is worse
than no verdict**, and the stamp lives in the bundle, so it reads even when
`__ct` never appears.

**`health.mjs` had no default URL at all** — bare `process.env.SHOT_URL`, so
running it without the variable called `goto(undefined)`. That script is the
first thing anyone runs to ask "is the world alive", and until today, run
plainly, it asked that of nothing.

```
scripts with a plain banner:  0
scripts calling reportWorld:  148
```

## What is still true, and I would rather say it than bury it

The defaults still point elsewhere — 54 files at 4184, 47 at 4177, 11 at 4185.
**Running one without `SHOT_URL` still measures whichever tree is serving that
port.** The banner does not prevent that; it makes it visible.

That is deliberate: changing 58 defaults is a behaviour change I cannot verify
for scripts I did not write, and a wrong default you can see beats a "right"
default that silently moves under someone. If the desk wants the defaults
unified on one port, that is a five-minute follow-up and a decision I should not
take alone.

## How it was checked, because a 58-file regex is where silent mistakes hide

- no bare `goto` literal remains anywhere
- all 169 files parse
- `exits.mjs` measures 4188 when told to, and returns **this** checkout's rooms
- a dead port throws rather than falling back to a default that happens to be up
- `density` prints data on stdout and its target on stderr
- my own five checks still pass: seethrough, density, nightgrade, wiring, seampairs

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

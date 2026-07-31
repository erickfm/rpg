# Builder A — `npm run checks`, and the two gaps writing it found

Landed in **`42d83b39`**: `scripts/checks.mjs`, a `checks` npm entry, and 14
scripts swept.

## Why

Four of my six checks had **no npm entry**. You could run them only if you had
read the note that introduced them. A tool nobody knows how to run is worth
about what a tool nobody has watched fail is worth, and I spent this week
arguing the second half while leaving the first.

```
npm run checks                 every check, against SHOT_URL
npm run checks -- --selftest   break each one on purpose, require it to fail
```

**Not a gate.** `npm run build` stays `tsc --noEmit && vite build`. The desk
stood the wiring gate down deliberately — *a contract that cannot be skipped
beats a check that fails* — and that reasoning covers all six. This is one
command instead of six remembered ones.

## It found two things in its first run, which is the argument for writing it

**1. Sixteen scripts read `SHOT_URL` and never verified the build** — including
`check-seethrough`, one of my primary checks.

The sweep two commits earlier rewrote scripts with a **bare `goto` literal**.
These already used `SHOT_URL`, so the pattern skipped every one of them. **They
were the scripts that had done the right thing early, and the fix quietly left
them behind.** 14 swept; the other two are false positives — `E-verify` names
`SHOT_URL` only in a usage comment, `capture` spawns children with it set and
they verify.

That is worth remembering as a shape: *a fix aimed at the broken cases can miss
the half-fixed ones, and those are the ones that look fine.*

**2. `nightgrade --selftest` printed `SELFTEST PASSED` and returned 1**, because
it fell through to the normal verdict afterwards. I had run that selftest, read
the word PASSED, and never looked at the exit code. The runner prints status in
a column, so it was visible immediately.

## It outgrew its own reporting within a day (`04e85e53`)

`3dfe0217` registered three more checks — which is what the runner is for — and
the suite immediately broke its own reporting. It printed **nothing** until every
check finished. Fine at six; not fine at nine, because the run now takes about
three minutes, so a caller with a two-minute limit sees **no output at all** and
cannot tell a slow check from a hung one.

I hit that twice in one turn and my first assumption both times was that
something had broken. **A runner that looks hung gets killed, and a killed suite
reports nothing** — a worse failure than any check it contains.

- a line on stderr as each check starts
- 180 s per check, reported as `TIMED OUT` with the check named
- elapsed shown for anything over 20 s

```
9/9 green,  lotwalk 99s
```

That 99 s was invisible before and is worth seeing. It is not a fault — it is
the one check that walks a pedestrian around the lot — but anyone waiting three
minutes deserves to know what they are waiting for.

## Where it stands

```
npm run checks              6/6 green
npm run checks --selftest   5 broken on purpose, 5 caught; health has no selftest
```

`health` has none because its subject is "does the world initialise", and the
honest mutation for that is breaking the world — which is not something a check
should do to a tree someone is working in. Listed as `·`, not silently omitted.

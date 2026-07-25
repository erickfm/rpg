# For E, the desk, and whoever owns floatlit — two checks were running exactly never

`checks-registered` exists to catch this and it was catching it. It has been
**red for every builder on every run**, naming two orphans:

```
scripts/E-walk.mjs    has a --selftest and is in no tier of npm run checks
scripts/floatlit.mjs  has a --selftest and is in no tier of npm run checks
```

Its own text says why that matters: *"a check that is not run cannot fail."*
And a check that is permanently red stops being read — which is how it survived
long enough for me to find it while doing something else entirely.

They wanted **opposite** fixes, which is probably why neither got one.

## `E-walk.mjs` — registered, slow tier

Nothing structural was stopping it. One invocation, no arguments, ~55 s, and it
answers things only a walk can: the flight rises under your feet, the cheek
walls hold you on the steps, the courtyard floor is walk level off the flight.
It had simply never been added. Now in the slow tier beside `steps-walk`,
`seats-walk` and the `G-*-walk` pair.

**Green at HEAD** — 19 PASS, *"all walks passed"*, seven consecutive clean runs.

**One caveat I am not smoothing over.** An earlier run — one of eight — printed
`1 FAILED`, and I did not capture which assertion before it scrolled. I could
not reproduce it in seven attempts. E should know that before the first
intermittent red arrives, because the honest reading is *"flakes about 1 in 8,
cause unknown"* and not *"green"*. `fddab2e20` makes the same point about
`nightgrade` — the repeat test only got run on the red somebody already doubted.

## `floatlit.mjs` — exempted, with the reason written down

This one genuinely cannot be a CHECKS row. Run alone it says so itself:

```
CANNOT ANSWER — no day capture to pair against.
Make one:  JSON_OUT=1 NIGHT_H=13 node scripts/floatlit.mjs > day.json
Then:      PAIRED=day.json node scripts/floatlit.mjs
```

It needs two invocations, the second fed the first's output. A single row cannot
express that, so it sat unregistered — not by anyone's choice. Exempted in the
same shape as `check-artifact` (*"needs dist/artifact.html packed first"*), which
is the existing precedent for exactly this.

**The better fix is a wrapper** that does both passes and exits on the verdict,
which would make it registerable like anything else. That is its author's call.
The exemption is the cheap fix and it should be overruled freely.

## Why I touched scripts that are not mine

`OWNERSHIP.md` says *"`scripts/**` and `notes/**` — anyone may add files. Do not
edit another agent's script or handoff note."* I have not edited either check.
What I edited is the two **registries** — `checks.mjs`, which I was already in,
and the `EXEMPT` table in `checks-registered.mjs`, whose own text asks for
exactly this: *"Either add it to CHECKS in scripts/checks.mjs, or add it to
EXEMPT in this file WITH A REASON. Opting out is fine. Opting out silently is
not."*

`checks-registered` is green again: **68 registered**, 0 orphans.

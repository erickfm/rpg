# w22 — canfail run end to end: 42 CAUGHT, 1 SLEPT, and two faults in the harness

Queue item 41. Ports: `guards.sh` aims itself at **4290**; the controlled runs
used a preview I held on **4288**.

## The result

```
42/43 checks caught their mutation
FAIL  wetness   SLEPT   the street bone dry on the last drop of rain
every mutated file restored byte-for-byte      exit 1
```

`.canfail-last.json` is written and now says `caught 42, total 43,
asleep ["wetness"], unprovable []`. Every one of the 43 cases has a real
CAUGHT/SLEPT verdict from an actual run. Nothing is unscored.

**The item's premise was right and the static audit was wrong.** It said 35/35
needles aim true. Running it found one aiming at bytes that do not exist, and
two separate faults in the harness itself — neither of which any static audit
could see, because both only appear while it is running.

## Fault 1 — `rain` had never run, and then lied about corrupting the tree

`rain`'s needle was `const RAIN_N = 500;`. `props.ts` has said **2600** since the
storm was made heavier. It matched 0 bytes, so `scripts/rain.mjs` has never once
been shown a broken world.

Re-aimed to the current text; `rain` now CAUGHT. 6 must stay under 100, because
`rain.mjs` finds the storm with `isPoints && position.count > 100` — noted at
the case so the next person does not have to re-derive it.

**The worse half.** That stale needle made the run end with:

```
RESTORE FAILED — src/proto/ct/props.ts does not hold its original text.
```

and exit 3. **The tree was byte-perfect.** The end-of-run integrity assertion
verified restoration by re-reading each case's *needle*:

```js
const stillWrong = CASES.filter(([, file, needle]) =>
  run.some((r) => r[1] === file) && !readFileSync(file, 'utf8').includes(needle));
```

A needle that never matched cannot match afterwards either, so a fault in
`canfail.mjs` was reported as a corrupted source file. That is the worst thing a
tool that edits your source can say when it is not true: the natural response is
`git checkout --`, and this file's own header explains that it stopped using git
precisely so uncommitted work would survive a run.

Now it digests each file's bytes before the run and compares after — a real
restore check, independent of the needles — and a stale needle prints a named
`NEVER RAN … those guards are UNPROVEN, not passing` block and exits 1.

Mutation-tested both ways, unpiped:

| I broke | result |
|---|---|
| put the stale needle back | exit **1**, `NEVER RAN`, "restored byte-for-byte" — no false alarm |
| poisoned the saved baseline digest | exit **3**, `RESTORE FAILED … does not hold its original bytes` |

## Fault 2 — a dead socket was scoring sleeping guards as "could not be scored"

`wetness` came back `NOT-RUN … served null` on both full runs and on a four-case
run, while scoring CAUGHT on three single-case runs. That reads like the flaky
guard the file's own header documents. It was not.

`servedEntry()` swallowed its error. Surfacing it gave **`UND_ERR_SOCKET`**:
undici pools a keep-alive socket at startup, `vite preview` closes it while
minutes go by rebuilding and running browsers, and the next fetch throws before
it ever reaches the server.

**That fetch is only reached when a case does NOT go red** — a red case returns
before it. So the failure lands *precisely and only* on a sleeping guard, and
turns the harness's most valuable finding into "could not be scored". This is
also why single-case runs looked clean: when wetness caught, the code never got
there.

`servedEntry()` now retries once on a fresh connection and reports why it failed.
With that in, `wetness` scores **SLEPT 5/5** — three times against a preview I
held, twice through `guards.sh`.

The server was never actually dead. I checked directly: `HTTP 200` before and
after a run that reported `served null`. So the 31 CAUGHTs that follow `wetness`
in the full run are sound, not casualties of a dead preview — worth stating,
because a dead server would have made every one of them a false green.

## The one SLEPT — `wetness`, with its reason

**Not mine to fix** (item 41's file is `scripts/canfail.mjs`; this is
`ct/props.ts` and `scripts/wetness.mjs`, and canfail's own header routes the
wetness non-determinism to B). Queued here with the evidence.

The mutation drops `dryFor` from 48 to 0.24 — the street dries ~200x faster,
which is the exact bug the user reported: *"make wetness last a lil after it
stops raining"*. `scripts/wetness.mjs probe` on the mutated world:

```
  during the storm: rain opacity 0.611, puddles 2/2 showing
  + 6s after the rain stops:  road 141618  gutter 131518
  + 8s after the rain stops:  road 3c3c3c  gutter 3c3c3c
  +14s after the rain stops:  road 3c3c3c  gutter 3c3c3c

  OK   the rain actually stopped
  OK   the street is still wet, not bone dry on the last drop      <-- while it is
  FAIL the gutter and the road crown dry at different rates
```

`3c3c3c` is the dry road. The street is bone dry from +8s and the verdict that
**names that exact property** passes. Its predicate is:

```js
const streetStillWet = samples[samples.length - 1].broad !== wet.broad ||
                       samples[samples.length - 1].strip !== wet.strip;
```

It asks whether the surface colour **differs from the storm**, which is what
drying does. The faster the street dries, the more certainly it passes. It
cannot fail for the reason it exists.

The only verdict that catches the mutation is `gutterHolds`
(`samples[3].strip !== samples[3].broad`), and it catches it by accident:
`samples[3]` is the +8s sample, which the trace above shows is the exact moment
road and gutter converge. Land one sample earlier and everything passes. **That
is the documented "CAUGHT, CAUGHT, SLEPT, SLEPT, CAUGHT" non-determinism, and
this is its mechanism** — not noise in the world, a verdict decided by which
side of a convergence a 2-second sample falls on.

Suggested fix, for whoever owns it: `streetStillWet` should compare against the
DRY reference, not against the storm — the street is still wet if its surface at
+14 s is nearer the storm value than the dry one, or simply if `wetness > 0`
where `props.ts` already holds the number. And `gutterHolds` should assert the
gutter is still darker than the crown at a fixed wetness level, not that two
colours differ at one arbitrary sample. DONE WHEN: `guards.sh wetness` reports
CAUGHT five times running.

## Found and NOT fixed

1. **`wetness` above.** The sleeping verdict is `streetStillWet` in
   `scripts/wetness.mjs`; the world is fine.
2. **A NEEDLE case is a `????` row among forty greens.** I added an explicit
   end-of-run block naming each stale needle, because `rain`'s was only noticed
   at all because it also triggered the false RESTORE FAILED. If that false
   alarm had not existed, an unproven guard would have scrolled past unread —
   and it evidently did, for however long `RAIN_N` has been 2600.
3. **43 cases, and the audit that cleared this file covered 35.** Whatever
   produced "35/35" was not looking at the whole list. Worth knowing before the
   next static audit is trusted.
4. **`guards.sh` is not on any routine path.** `checks.mjs` does not run canfail
   and `land.sh` only reads the stamp. A guard can rot for weeks between runs —
   which is exactly what `rain` did. Not a code fix; a scheduling decision for
   the desk.

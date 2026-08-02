# Telling a casualty from a real failure costs one line — for the check-suite row

The row: *"roughly half the red is an artefact and half is not, and a reader of
the summary cannot tell which."* That is the expensive part, and there is a
cheap discriminator I stumbled into rather than looked for.

## The observation

Running my eight guards back to back against one dev server, three went red:

```
  C-seatexit  rc=1     door301  rc=1     hermit  rc=1
```

Run individually with a few seconds between them, **all eight pass**. That much
is just contention and it is what the row already says. The useful part is what
the red runs printed:

```
  door301   rc=1   FAIL lines: 0   ok lines: 0     <- died, measured nothing
  door301   rc=0   FAIL lines: 0   ok lines: 11    <- same script, run alone
```

**A casualty exits non-zero having printed no failing assertion at all.** A
real failure prints the assertion that failed — that is what the assertion
helper is for. The two are trivially separable and nothing currently separates
them.

## The suggestion, and it is one line in the summariser

Split the tally three ways instead of two:

```
  passed        exit 0
  FAILED        exit non-zero AND at least one FAIL line   <- real, wants an owner
  DID NOT RUN   exit non-zero AND zero FAIL lines          <- casualty, re-run it
```

A check that dies before asserting anything is **not evidence of a defect**, and
counting it as one is the same fault as GOTCHAS 34 in the other direction: there
it was a check that found nothing and reported green; here it is a check that
measured nothing and reports red. Both lie about what was tested.

`scripts/health.mjs` and exit code 3 already encode this idea for a single
check — *3 means never ran*. The suite summary just does not read it.

## Honest caveat

**I cannot reproduce the contention on demand.** Re-running the same eight back
to back just now, with no gap at all, gave `rc=0` and zero FAIL lines on every
one of them. So the trigger is load or timing, not the scripts, and my sample of
red runs is three observations rather than a controlled experiment.

That does not weaken the discriminator, which is about how failures are
*reported* rather than why they happen — but it does mean I cannot hand anyone
a reliable reproduction of the underlying flakiness, and I am not going to
pretend otherwise.

## Not mine

The suite and its summariser are the desk's. I am supplying the measurement
rather than changing anything.

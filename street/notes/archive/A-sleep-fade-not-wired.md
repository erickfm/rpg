# The sleep fade row is CONFIRMED and the user's sentence is not met

Row: *"when the player goes to sleep i want the screen to fade to black"* (K).
Status: **CONFIRMED**. D has recorded on it that the wiring is missing. Both of
those are true at once, which is the hazard the auditor named this session — a
row titled with the user's request, reading CONFIRMED, that does not do the
thing when you go and try it.

I am not changing another verifier's status. This is the plain statement so the
desk can route it.

## Independently reproduced, with the control taken first

```
CONTROL  window.__hud.fade({ mid })   peak opacity 1.000, 21 of 26 samples black
BED      [E] sleep until morning      peak opacity 0.000,  0 of 25, clock +16.5 h
```

Sampled on `#ct-fade` **in-page at 25 ms** (K's own method), same run, control
before the test. So: **the capability K built works, and the bed does not call
it.** That is D's *"301 today ramps the clock with no fade at all"*, from a
second pair of hands.

**K's half should not be reopened.** The fix is one call site in
`ct/apartment.ts`: `screenFade({ mid })` with the clock advance inside `mid`,
which is the shape K published in `notes/K-screen-fade.md`.

## I measured the opposite first, and it was my instrument twice over

Worth writing down, because the wrong answer nearly went on the ledger and only
D's disagreement made me check.

1. **I scanned for "a large fixed black div" and got `#app`** — the page
   container, permanently at opacity 1. It read 1.000 at rest, 1.000 during a
   real fade, and 1.000 afterwards, and I read that as proof the bed faded. A
   detector that returns the same value in every state is not a detector.
2. **Then I measured nothing at all**, because `__hud.fade()` returns a promise
   and Playwright's `evaluate` awaits it. The call did not return until the fade
   had finished, so I began sampling after it was over — and read 0.000 for a
   fade that had definitely happened.

Both were caught by one thing: **running the control**. Drive the capability
directly, confirm the instrument moves, and only then test the case. I have
insisted on positive controls twice today — on the 301 door and on the park
benches — and did not run one here until a disagreement forced it. The
disagreement should not have been what triggered it.

## A process note that is not about this row

**Two of my ledger appends were silently dropped by rebase merges today**,
including the first version of this finding. `scripts/ledger-merge.py` warns in
its own header that it has "failed SILENTLY twice — once losing one row's
evidence, once losing four passes at a stroke — and both times the file still
read plausibly afterwards."

It is still the right tool and better than my hand-merges. But an append that
vanishes leaves no trace, so **a finding that matters should go in a note as
well as a cell** — which is why this file exists.

# VERIFY the slot-stool modal trap — the MECHANISM still holds, the CONCLUSION no longer does

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle on 4195, HEAD `7eaa56db4`.

The row (evidenced by I, on build `5d997cbe5`) ends:

> *"A player who sits at a slot machine cannot leave by any key, and reloading
> is the only exit."*

**That is no longer true, and it was closed by somebody else's row.**

## At the row's own station, with the row's own predicate

96 slot stools in the world. Sampled 8 spread across the floor, warping to each
published `at`:

```
ONE press of Escape from a slot stool:  out 5 · STILL STUCK 0 · never sat 3
```

Zero stuck. And the step-by-step on the first stool shows why:

```
before            seated=false  panelback=false
after E (sit)     seated=true   panelback=true(1)   slots-op=1
after E again     seated=true   panelback=true(1)   slots-op=1     <- E is still swallowed
after Escape      seated=FALSE  panelback op 0      slots-op=0     <- panel AND seat, one press
```

**Escape now leaves the panel and the stool together.**

## The row's mechanism is still exactly right, and worth keeping

`ct/hud.ts:168` still lists `keydown` in `BLOCKED`, so while a panel is open
`input.keys` never sees `e` — measured, not read: pressing E with the machine up
leaves you seated with the panel still open, every time. I's analysis of *why*
the E dispatch cannot reach the seat is correct and unchanged.

What changed is that **Escape was never downstream of that block.** It is
handled by the panel gate itself at `ct/hud.ts:299`, upstream of `input.keys` —
and C's escape-hatch work has since made that handler release the seat as well
as the panel.

## The two rows nobody has connected

I verified C's *"how do i stop watching the tv"* row in the item immediately
before this one. Its third claim is *"Escape leaves any seat too — this world
had no cancel binding at all before"*, and I checked it on the bed and on a
church pew. **This row is the same fix arriving at the 96 stools**, which is
where it mattered most: I sized this as *"43% of every seat in the game"* and
*"the only seat trap left in the world"*.

So the urgent row is closed by a landed row of C's, and the two cells do not
mention each other. That is the whole of what a verifier can add here.

## What I am NOT claiming

**3 of the 8 stools never seated me at all.** E did nothing from the published
`at` and I stayed standing. That is much more likely my harness than the world —
a warp that lands outside the trigger, or a neighbouring spot winning — and I am
recording it rather than filing it, because I did not chase it down. If somebody
does, it is `sit at the slot` stools 19, 47 and 79 by index in
`__ct.seats().filter(s => s.label === 'sit at the slot')`.

**I did not re-run `scripts/I-seat-exit.mjs`**, which is the row's own instrument
and would sample all 32 rather than my 8. That is the cheaper confirmation of
everything above and it belongs to I.

**And the row's history should not be deleted.** It was accurate when measured
and the mechanism it documents is live — this is a GOTCHAS §44 case, wanting the
outcome written beside the measurement in the past tense, not the measurement
removed.

— N

# A finding of mine is wrong, it is cited in 8 places, and the retraction never left my branch

**`3d71b035` — "A jumped clock is 7.4% brighter than the night the player
reaches" — is withdrawn in full.** It is mine. Both halves were rain: the helper
routed via 20:00, 20:00 rained under that day's `rainAt`, and I compared a wet
night with a dry one believing I was comparing two clock paths. `e0c68e46`
replaced `rainAt`, 20:00 went dry, and the same measurement re-ran at **0.2%**.

I withdrew it several commits ago. It did not travel. Here is the damage.

## It is cited in 8 places, by five agents, including two scripts

```
notes/C-lot.md:242              notes/BLOCKED-H.md:90
notes/AUDIT-INSTRUMENTS.md:1183 notes/C-weather-is-periodic.md:90
notes/G-interiors2-handoff.md:77
scripts/wetsweep.mjs:59         scripts/glow.mjs:172
scripts/lib/clock.mjs:80        (mine, fixed in this commit)
```

Several are re-measurement work people did **because of it** — G re-ran every
published interior figure, H ran a control on the car, AUDIT-INSTRUMENTS re-ran
its whole night table under `STEP=1`. That is the real cost, and it has already
been paid.

## What each site should do — they are NOT the same

**`scripts/wetsweep.mjs` — KEEP STEPPING. Do not read this note as license to
delete it.** Its effect is real and large: `94ca3664` measured the dry-night
baseline **3.4× too bright jumped** (0.04500 vs 0.01335) while the wet reading is
identical to five decimals. That is not path-dependent grading, it is **wetness
history**, and wetness is the thing wetsweep exists to measure. The `STEP=1`
default is correct; only the stated reason on line 59 is wrong.

**`scripts/glow.mjs` — conclusion untouched, and it corroborates the
withdrawal.** It ran the control instead of assuming: jumped near 0.6103 / far
0.045 = 13.6×, stepped 0.6103 / 0.045 = 13.6×, *identical to four decimals*.
It reported that as "a ratio is immune to what an absolute reading is not." The
better reading is that **there was no effect to be immune to.** The instinct to
measure rather than argue was right and it is why this site needs nothing but a
one-line reattribution.

**`notes/C-weather-is-periodic.md:90` — C found the true mechanism and credited
it to me.** The note says:

> *"jump to an hour and the street has never rained; step to the same hour and it
> rained within the last eight hours, always, because there is no longer gap to
> arrive through."*

**That is the whole explanation, and it is better than anything I wrote.** It
says why stepping ever appeared to matter, predicts exactly where it will and
will not reproduce — wetsweep yes, glow no — and does not depend on a particular
day's weather. `C-lot.md:242` carries the same insight one line below its
citation of me. The conclusions in both are untouched; only the attribution
wants deleting. **C's finding is the load-bearing one. Mine was noise around it.**

**`BLOCKED-H.md`, `G-interiors2-handoff.md`, `AUDIT-INSTRUMENTS.md`** — all three
ran controls and all three found their numbers held. Attribution only.

## Re-measured at HEAD, because a withdrawal is worth less than a number

Every transparent material in the world, jumped straight to 23:00 versus stepped
via 20:00:

```
381 compared        0 differ
```

With the control that stops that zero being vacuous — day versus jumped 23:00,
same 381 materials:

```
296 differ    vice=210  props=50  street=34  lot=2
```

props's 50 splash sheets — the ones I claimed only arm by stepping — are inside
that 296. The probe sees them change. They do not care how the clock arrived.

## The retraction was unlanded the entire time, and so were the other three

This is the part worth keeping.

```
3d71b035   "A jumped clock is 7.4% brighter…"        MERGED    — everyone can cite it
9241a2f06  "WITHDRAWN: the whole finding was rain"   UNLANDED  — nobody can read it
```

**The false claim is on mainline and its correction is not.** A builder running
`git log --oneline | grep clock` is offered the wrong half and no other. Checked
the rest of my session and it is not one commit:

```
9241a2f06  WITHDRAWN: the jumped-clock finding was rain          UNLANDED
17b1b4489  RETRACT "the brown is the library"                    UNLANDED
14df834b0  RETRACTED: the park's back wall was never a flat slab  UNLANDED
4aa16a9c9  My correction was the error: the figure is −83%        UNLANDED
```

**Every correction I have made this session is invisible to every other agent.**
Four claims I no longer believe are, from outside my worktree, still standing —
and one of them has been copied into eight places while I was busy withdrawing it.

## For the desk — §36 does not catch this, and one line would

§36 landed while I was writing this and it is the right rule, but it is about
citations that are **dead**. This one is in perfect health: `3d71b035` passes
`git merge-base --is-ancestor` cleanly. **A hash resolving says nothing about
whether the sentence attached to it still stands.** Every one of the 750
citations `5fae9ec5b` counted could be perfectly reachable and some fraction
would still repeat a claim their author has abandoned. Second leak, same pipe.

§36 also says *"waiting costs nothing."* For a finding, true. **For a retraction
it is exactly inverted:** the claim is already merged, already citable, already
being copied, and every turn the correction spends unlanded is a turn the world
holds only the false half. The line I would add, the desk's to place:

> **A retraction is the one commit that must not wait.** The claim it corrects is
> already merged and already citable; until the retraction lands, `git log` offers
> builders the wrong half and nothing else. Land it before the work that prompted
> it. And when you withdraw a finding, `grep` the project for its hash — a
> retraction reaches the commit that made the claim, never the notes that already
> repeated it.

I have not edited `GOTCHAS.md`: §35 and §36's own author flagged that the file's
ownership is unsettled and offered to revert both, and a third section from a
third builder while that is open is how the question stops being answerable. I
have not edited anyone's notes or `wetsweep.mjs`/`glow.mjs` either — the changes
are one line each and they are their owners'.

**Land my four retractions ahead of the rest of my branch if you land nothing
else of mine.**

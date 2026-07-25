# BLOCKED — builder B

## Nothing assigned. Not blocked on a dependency; blocked on having no item.

Second time in two rounds. In between, one item was routed to me from
`notes/AUDIT-TRIAGE.md` and it is done, so this note is re-stated rather than
repeated — the state has changed, the conclusion has not.

---

## FIRST: two rows in AUDIT-TRIAGE.md are already closed

The desk has said it routes from that file now. **It currently lists two things
of mine that are finished**, so the next route from it will be a repeat. Not
editing it — it is the auditor's analysis — but recording the closures here,
with evidence, so they can be reconciled.

### Route #1, "sign/meter post leaves 0.90 m of walk at z −71.4" — CLOSED

Fixed in `2d2f3f9`-era commit *"Triage #1: the 0.90 m squeeze was my street
tree, and it is 1.10 m now"*.

Two corrections for the audit's own record:

- **It is not a sign or a meter post.** It is my street tree's trunk collider,
  0.16 × 0.24 at x ±5.66, z −71.62…−71.38 — which is exactly what the tree loop
  builds at `pz2 = −71.5`. The label is wrong; the collider and the measurement
  were exactly right.
- **Free span is now 1.10 m**, the predicted number to the centimetre, walked in
  three lanes (16.5 / 18.9 / 15.8 m northbound past the point).

The audit could not have known this constant also carries a user request —
`PIT_CLEAR`, from *"i dont like how close the tree bases are to the edge"*. The
trunk and the well are decoupled now: trunk in at 5.46 for the lane, well left
at 5.56 keeping a 0.218 m strip of pavement at the kerb. Both promises kept.

### "Blocked: the bench ad" — CLOSED

*"Needs its owner to say whether it was ever built."* It was. Answered in
*"Unblock the bench audit: the ad panel exists, and now it has a name"*.

It was searched for as "a roughly 1.8 × 0.6 upright board" and it is a
**1.73 × 0.37 plate 4 mm thick, reclined 12° with the backrest and inset in a
bezel** — nothing about it answers to that description, so the search was sound
and the shape was not findable. It carries `userData.benchAd` now, and
`npm run bus bench` answers both of the questions that were open:

```
ad panel 1.73 m long, 0.36 m tall; 4 bezel bars, 0.015 m clear margin both ends
OK  the ad is FRAMED by a four-sided bezel, not clipped by it
OK  leg tops are BURIED in the slat — coplanar with nothing (GOTCHAS §6)
```

### Nothing else on that file is mine

`#0` masonry is `tex-world.ts` (A) and its callers are `civic`, `vice`,
`street`. `#2` is `int-thrift.ts`, `#3` is G's rooms, `#4` is `int-casino.ts`.
My files only mention masonry in comments.

---

## The queue itself

`notes/queues/B-ground.md` — **md5 `b5f65064`, last modified 2026-07-24 23:30**,
byte-identical for eleven rounds. All 16 items on mainline; the table in
`notes/B-ground-report.md` has a commit for each.

---

## Still needing routing, not self-assignment

Unchanged from the last note, and none of them is mine to take:

1. **The fog line**, `crosstown.ts:504` — `multiplyScalar(1 - 0.5 * lampNight)`
   leaves grey fog closing off a dark street. `1 - 0.82 * lampNight` fixes it.
   One line, DESK-owned, raised every round since the night pass.
2. **Findings B and D need a verdict.** B ("mid-block dark") I recommend closing
   as superseded by night five. D ("parking never re-rolls") is `ct/rng.ts` and
   `ct/cars.ts`.
3. **The lamp-pool flat top** — measured, deliberately not acted on. The pool
   cap returns anything near a lamp to *exactly* daylight, so pools have no
   gradient at the top: at 23:00, **77 materials at full daylight, median
   1.25 m from a lamp, median height 2.07 m**. Ground level never saturates.
   It may be right — a lit thing should look lit — but it was never an explicit
   decision, and this system has been reverted once for a unilateral change.

---

*Updated 2026-07-25 after triage #1 landed. Report at
`notes/B-ground-report.md`.*

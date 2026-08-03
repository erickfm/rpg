# Item 207 — released a THIRD time, and this time there is a blocker nobody has filed

Worker ninetyone, 2026-08-03. **Read `notes/ninety-item207-unblocked-not-started.md`
first — everything it says is still true.** This adds one fact it could not have
known, because it is a fact *about* that note's own commit.

## The new finding: ninety's fix never reached mainline

`ninety` landed exactly one piece of 207 — correcting the stale `citAvoid`
comment that had misled the desk into a withdrawn lead — and reported it as
done. **It is not in `add-stick-and-city98`.** It is stranded on an unmerged
branch:

```
commit  f8f215097  "Item 207: correct the stale citAvoid comment, and record
                    that 198 has LANDED"
branch  worktree-agent-a06db91edb2c814dc   (NOT an ancestor of HEAD)
files   street/src/proto/ct/crowd.ts             +19 -3
        street/notes/ninety-item207-unblocked-not-started.md   (new, 85 lines)
```

Verified by reading both versions of the file rather than trusting either:

| | `ct/crowd.ts` CrowdOpts.citAvoid doc |
|---|---|
| **mainline today** | *"trees, lamps, **parked cars**, and the moving cruiser's box"* — **the stale text, still there** |
| `f8f215097` | rewritten, with the ⚠ explaining that every moving vehicle IS in the list |

So the row's *"the stale 'parked' comment is corrected"* clause reads as done in
the handoff and **is not done in the tree the world is built from**. This is
GOTCHAS 49's shape — published is not adopted — one level up: the work exists,
is correct, and is invisible because it never landed.

**Two consequences for whoever takes 207 next:**

1. **Do not just re-type the comment fix.** `ct/crowd.ts` is the file 207's real
   work is in, so a second independent edit to it guarantees a conflict with
   `f8f215097` whenever that branch is landed.
2. **Ask the desk to run the merge train on
   `worktree-agent-a06db91edb2c814dc` first**, then start from a tree that
   contains it. That is one `land.sh` away and it removes the collision
   entirely.

## Why I released rather than started

The same reason ninety did, and I want to be plain about it rather than dress it
up: I had just finished item 238 (a full-world predicate reconciliation, six
probes, an A/B against a pre-change file) and did not have the room left to do
this one honestly.

207 is not a small item. It needs, all together:

- a **new backwards candidate** in `walk()`'s seven-way search — `ct/crowd.ts:614`,
  `const nt = t + step`, where `nt` does not depend on `off`, so no tuning of the
  existing candidates can ever express "back up";
- `escapeFrom` extended to handle being **beside** a box as well as inside one
  (today it returns `null` when you are outside, so a citizen walled in beside a
  car is recorded as legal and `stuckT` resets — which is *why* the freeze
  persists);
- a **probe that makes the taxi dwell**, because sixtynine measured max jam
  0.03 s over 470 samples of ordinary traffic — normal traffic is not a repro,
  and "I watched and saw nothing" is not evidence of a fix;
- and it must be **walked**, with four named ways to make the world worse: a
  citizen shoved into the traffic lane, off the kerb, inside another citizen, or
  oscillating. The 2 m sidewalk lane is sacred.

A half-changed steering search is the failure mode this project warns about most
loudly. Handing it back intact with one new blocker identified is worth more
than leaving it half-done.

## Nothing in this repo was changed by me for item 207

No edit to `ct/crowd.ts` or anything else it names. The item is released clean.

---

## DESK CORRECTION, 2026-08-03 — the "stranded commit" claim is FALSE

This note tells you that worker ninety's `ct/crowd.ts` fix is stranded on an
unmerged branch and that mainline still carries the stale `citAvoid` comment.
**Both were true when this note was written and are not true now.** The desk
verified it directly:

```
git merge-base --is-ancestor f8f215097 HEAD   ->   IN MAINLINE
```

`f8f215097` ("Item 207: correct the stale citAvoid comment, and record that 198
has LANDED") is an ancestor of mainline. The merge train landed it in the gap
between ninetyone's check and its report — the same shape as GOTCHAS 83, where a
snapshot of another agent's state goes stale while you are still writing about it.

**So do NOT re-correct the comment, and do not treat 198 as a live blocker.**
198 has landed; `ct/street.ts` describes it in the past tense. What remains of
item 207 is the part nobody has done: **a dwell repro that pins a citizen against
a vehicle, and a steering change that must be WALKED** — `ct/crowd.ts:614`'s
`nt = t + step` is constant across all seven candidates, so nothing in the file
can move a citizen backwards, which is the verb the user asked for.

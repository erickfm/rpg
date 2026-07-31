# A verifier's ledger commits replay on every rebase, and that is now the cost

**H.** Not a blocker, and nothing is wrong with anyone's work. It is a shape
worth naming because it has become the largest single cost of my turns.

## What happens

I verify a row, append evidence to `notes/LEDGER.md`, commit. Then I rebase onto
`add-stick-and-city98`, and **my commit replays and conflicts**, because the
ledger has been rewritten by other agents in the meantime. I resolve it. Next
turn, the same commit replays and conflicts again — and so does every earlier
verify commit still sitting on my branch.

Measured on this session's last four cycles: **three of my commits replaying,
one conflict each, every cycle**, and the resolution is the delicate part —
I have twice damaged rows doing it (a deleted row, then four shrunk ones), and
`ledger-intact.mjs` caught a third where the row grew while losing two accounts.

**The verification itself is the cheap half.** Standing at a station and reading
a prompt takes one run. Getting the sentence safely into a file fifteen agents
are rewriting takes three.

## Why it does not resolve itself

My commits only stop replaying once they are **merged into the base**. Until
then every rebase re-applies them over a newer ledger. So the longer my evidence
sits unmerged, the more times it must survive a hand-resolution — and each one
is a chance to shrink somebody's cell.

## What would actually help, in preference order

1. **Merge verifier evidence promptly.** A verify commit that reaches the base
   stops replaying. This is the whole fix; everything below is mitigation.
2. **One ledger commit per turn, not per row.** I have been committing each
   confirmation separately, which is better for reading and worse for replay —
   three commits is three conflicts. I will batch from here.
3. **`npm run ledger` after every resolution.** Already my habit; it has caught
   my own damage twice and the auditor's once. It is the only reason I know the
   file is currently intact.

**I am not asking for a process change** — the desk may well prefer many small
commits, and that is a fair trade. I am recording that the cost has moved: it is
no longer verification, it is getting verification safely into the ledger.

— H

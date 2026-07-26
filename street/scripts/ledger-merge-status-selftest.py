#!/usr/bin/env python3
"""A demotion must survive the resolver. Four cases, run me after touching merge().

WHY THIS FILE EXISTS. `ledger-merge.py` carried a rule described as *take the
stronger status*: if my side said CONFIRMED and the merged row did not, force
CONFIRMED. CONFIRMED IS NOT STRONGER — it is only newer or older. That rule made
the resolver silently undo other people's work: an owner who demotes their own
row because the evidence stopped holding gets the demotion reversed by the next
agent who rebases, and the row goes back to CONFIRMED still carrying a cell that
says, in the owner's words, that nothing can decide it. Nobody re-reads a
CONFIRMED, so it stays that way.

SECOND TIME I SHIPPED THIS. `ledger-recover.py` restored statuses as well as
evidence and un-rejected the sleep-fade row. I fixed it there, wrote down that a
tool must never rewrite a status, and left the same rule standing in the script
that runs on EVERY rebase. A note is not a guard. This file is the guard.

The fix is three-way: only the merge base separates my new promotion from
mainline's deliberate demotion. Both look identical from the two lines alone.
"""
import sys

src = open(__file__.replace('-status-selftest.py', '.py')).read().split('\n')
cut = [i for i, l in enumerate(src) if l.startswith('def resolve')][0]
ns = {'PATH': 'notes/LEDGER.md'}
exec('\n'.join(src[:cut]), ns)
merge = ns['merge']

R = "| %s | F | wheel arches read as arches | %s |"
DEMOTED = R % ("OPEN", "F: MOVED BACK FROM CONFIRMED BY ME, nothing can decide this")
STALE   = R % ("CONFIRMED", "old cell — **AUDITOR** it holds")

CASES = [
    ("owner demoted on mainline, my copy is stale", DEMOTED, STALE, "CONFIRMED", "OPEN"),
    ("I am promoting it now, mainline has not seen it",
     R % ("OPEN", "builder text"), R % ("CONFIRMED", "— **AUDITOR** walked it"), "OPEN", "CONFIRMED"),
    ("base unknown — resurrecting is the worse error", DEMOTED, STALE, None, "OPEN"),
    ("nobody moved it", R % ("CONFIRMED", "x"), R % ("CONFIRMED", "— **AUDITOR** y"),
     "CONFIRMED", "CONFIRMED"),
]

ok = True
for name, theirs, mine, base, want in CASES:
    got = merge(theirs, mine, base).split('|')[1].strip()
    if got != want:
        ok = False
    print(f"  {'ok  ' if got == want else '** FAIL'} {name:46s} base={str(base):10s} -> {got:10s} want {want}")

# THE PROPERTY THIS FILE MUST NOT TRADE AWAY. Respecting a demotion is worthless
# if it drops my account in the process — the demoter needs to read what I found.
kept = 'AUDITOR' in merge(DEMOTED, STALE, "CONFIRMED")
print(f"  {'ok  ' if kept else '** FAIL'} my evidence is still appended to the demoted row")
ok = ok and kept

print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)

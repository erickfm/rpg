#!/usr/bin/env python3
"""User requests in FEATURE-REQUESTS.md that have no row in LEDGER.md.

A request with no row cannot be reported on, reprioritised, or chased. This
found nine untracked requests early in the session and the pattern has recurred
every time work arrives by direct dispatch instead of through the desk.

Matching is deliberately loose - a ledger row's request text is often an
abbreviation of the user's words - so it reports SUSPECTS, not verdicts.
"""
import re, sys

def words(s):
    return set(w for w in re.findall(r"[a-z']+", s.lower()) if len(w) > 3)

reqs = []
for l in open('FEATURE-REQUESTS.md').read().split('\n'):
    # QUOTED ITEMS ONLY. Matching any bold bullet swept in the changelog -
    # "Hoodie final fixes", "Pickup rebuilt again" - and reported 91 untracked
    # requests, most of which were COMPLETED WORK, not asks. The user's own
    # words are quoted; that is the signal.
    m = re.match(r'^\s*[-*]\s+\*\*"(.+?)"', l)
    if m:
        t = m.group(1).strip()
        if len(t) > 12:
            reqs.append(t)

rows = []
for l in open('notes/LEDGER.md').read().split('\n'):
    if l.startswith('| '):
        f = l.split('|')
        if len(f) > 3 and f[3].strip():
            rows.append(f[3].strip())

rowwords = [words(r) for r in rows]
missing = []
for t in reqs:
    tw = words(t)
    if not tw:
        continue
    best = max((len(tw & rw) / max(1, min(len(tw), len(rw))) for rw in rowwords), default=0)
    if best < 0.45:
        missing.append((round(best, 2), t))

print(f'user requests parsed from FEATURE-REQUESTS.md: {len(reqs)}')
print(f'ledger rows with a request: {len(rows)}')
print(f'requests with no plausible ledger row (overlap < 0.45): {len(missing)}\n')
for score, t in sorted(missing)[:25]:
    print(f'  [{score:.2f}] {t[:96]}')
sys.exit(1 if missing else 0)

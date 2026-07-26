#!/usr/bin/env python3
"""CONFIRMED rows with nothing behind them.

Matches "auditor" CASE-INSENSITIVELY. The first version did not, and counted
rows whose evidence reads "- auditor -" in lower case as having none - three
false positives out of five on the file it was measuring. A sweep for
unsupported claims that is itself unsupported is the joke this repo keeps
telling about me.

AND IT MATCHES THE WORD FORMS PEOPLE ACTUALLY WRITE, which is the same bug a
second time. The pattern had `VERIFIED` and `STATION:`; J's library-entrance row
says "VERIFIER (C) CONFIRMED" and "STATIONS: walked the library on foot". Both
of those are a named verifier and a station, and neither matched - so this
reported 1 bare row against one of the best-evidenced entries in the file: 2,665
characters, a verifier, two stations and a screenshot.

The first fix was about CASE and this one is about INFLECTION, but they are one
mistake: a checker whose pattern only recognises its author's own phrasing. The
words are written by eleven people and nobody is consulting this regex first.

  E, verifying the AUDIT row, 2026-07-26. Found by reading the row the check
  flagged instead of believing it - the auditor's own correction note is the
  precedent, and it says the same thing.

Self-test: `python3 scripts/ledger-evidence.py --selftest` builds rows with
known answers and requires the classification to be right, so the pattern can
be changed without wondering what it used to catch.
"""
import re, sys

MARK = re.compile(
    r'CONFIRMED by|VERIFIED|VERIFIER|STATIONS?:|STAND AT|desk ruling|Desk \d'
    r'|— desk|CHECK FROM|verified by|PREDICATE',
    re.I)


def bare_rows(lines):
    conf = [l for l in lines if l.startswith('| CONFIRMED |')]
    return conf, [l for l in conf
                  if 'auditor' not in l.lower() and not MARK.search(l)]


if '--selftest' in sys.argv:
    # Each case is (row body, should_be_flagged). A checker nobody has watched
    # get an answer wrong is one you argue with when it matters.
    CASES = [
        ('nothing behind this at all, just a claim', True),
        ('— AUDITOR: walked it, shots/x.png', False),
        ('— auditor —, lower case, still evidence', False),
        ('CONFIRMED by H (verifier), STATION: the gate', False),
        ('VERIFIER (C) CONFIRMED. STATIONS: walked it on foot', False),
        ('STAND AT (920, 8.0) looking +z at the doors', False),
        ('PREDICATE: the seat top is above the ad', False),
        ('a long account of the work with no evidence marker whatsoever '
         'running on for many characters to prove length is not the test', True),
    ]
    bad = 0
    for body, want in CASES:
        row = f'| CONFIRMED | X | a request | {body} |'
        _, flagged = bare_rows([row])
        got = bool(flagged)
        if got != want:
            bad += 1
            print(f'SELFTEST FAIL: wanted flagged={want} got={got} for {body[:52]!r}')
    print(f'selftest: {len(CASES) - bad}/{len(CASES)} cases correct — '
          f'{"PASS" if not bad else "BROKEN"}')
    sys.exit(0 if not bad else 2)

L = open(sys.argv[1] if len(sys.argv) > 1 else 'notes/LEDGER.md').read().split('\n')
conf, bare = bare_rows(L)
print(f'CONFIRMED rows: {len(conf)}   with no auditor evidence and no verifier named: {len(bare)}')
for l in bare:
    f = l.split('|')
    print(f'  [{f[2].strip():5}] {f[3].strip()[:56]:58} {len(f[4].strip()) if len(f) > 4 else 0} chars')
sys.exit(1 if bare else 0)

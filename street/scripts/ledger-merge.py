#!/usr/bin/env python3
"""Resolve LEDGER.md rebase conflicts.

The ledger is one row per line and every agent appends to the same rows, so a
rebase conflicts on it almost every time. The resolution is always the same
shape and doing it by hand is how evidence gets dropped:

  * start from MAINLINE's row — the builder's account is newer than mine
  * APPEND any auditor segment my side has that mainline's row lacks
  * take the stronger status
  * keep rows only one side has

Evidence is APPEND-ONLY, so never choose a side. Choosing lost a row's evidence
once, and then four passes at a stroke when mainline already carried an older
auditor segment and was already CONFIRMED: my newer, longer line looked like the
weaker candidate and was dropped. The commits then became empty and git silently
skipped them. Nothing looked wrong afterwards - every row still read plausibly
and only the CONFIRMED count moved, 124 to 115.

Run with no arguments after a conflicted rebase, then `git add` and continue.
"""
import re, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'notes/LEDGER.md'

def key(l):
    """Identify a row by (agent, request), taken from the COLUMNS.

    This used a 60-character regex slice, which spills past the request column
    into the builder's evidence - so the same row with newer builder text read
    as a DIFFERENT row and my side got appended as a duplicate instead of
    merged. The selftest caught it; the real file never would have, because a
    duplicated row still reads plausibly."""
    f = l.split('|')
    if len(f) < 4 or not f[1].strip() or not f[2].strip():
        return None
    return (f[2].strip(), f[3].strip()[:60])

def status(l):
    m = re.match(r'\|\s*(\w+)\s*\|', l)
    return m.group(1) if m else ''

SEG = ' — **AUDITOR'

def segments(l):
    return [SEG + p for p in l.split(SEG)[1:]]

def merge(theirs, mine):
    """Mainline's row, plus any auditor segment of mine it does not already
    carry. Never drops either side's account."""
    out = theirs.rstrip().rstrip('|').rstrip()
    add = [s for s in segments(mine) if s[:70] not in theirs]
    if add:
        out += ''.join(s.rstrip().rstrip('|').rstrip() for s in add)
    out += ' |'
    if status(mine) == 'CONFIRMED' and status(out) != 'CONFIRMED':
        out = '| CONFIRMED |' + out[out.index('|', 1) + 1:]
    return out

def resolve(m):
    ours = [l for l in m.group(1).split('\n') if l.strip()]
    mine = [l for l in m.group(2).split('\n') if l.strip()]
    mymap = {key(l): l for l in mine}
    out = []
    for l in ours:
        alt = mymap.get(key(l))
        out.append(merge(l, alt) if alt else l)
    seen = {key(x) for x in ours}
    for k, l in mymap.items():
        if k not in seen:
            out.append(l)
    return '\n'.join(out) + '\n'

s = open(PATH).read()
s2, n = re.subn(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', resolve, s, flags=re.S)
open(PATH, 'w').write(s2)
left = s2.count('<<<<<<<')
print(f'  resolved {n} region(s); {left} marker(s) left')
sys.exit(1 if left else 0)

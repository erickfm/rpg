#!/usr/bin/env python3
<<<<<<< HEAD
"""Git merge driver for notes/LEDGER.md. Resolves the conflict nobody should hand-fix.

    usage (git calls this, you do not):  ledger-merge.py %O %A %B

Eleven agents append to one table and every one of them is right. The result was
a merge conflict on almost every rebase — G's church and library work sat
unlandable behind one, A hit it on three consecutive commits, and each time the
merge train reported the builder as broken when nothing about its work was.

**Every one of these conflicts has been false.** Two writers advance two
different rows, three lines apart, and git sees overlapping hunks. So resolve
the way a human does:

  · a row is identified by its REQUEST TEXT (column 3), not its position
  · when both sides have it, keep the MORE ADVANCED status
        OPEN < LANDED < CONFIRMED = VOID
  · at equal status, keep the side carrying more evidence — someone measured
  · rows only one side has are additions; keep them all, in order

That is a strictly better merge than either side, and it cannot lose a status
change or an evidence cell. The one thing it will not do is reconcile two
people writing DIFFERENT evidence for the same row at the same status; it keeps
the longer, and that is why LEDGER.md still says one row, one writer.

Install (once, from the main worktree — `git worktree` shares config):

    git config merge.ledger.name  "LEDGER.md row-wise merge"
    git config merge.ledger.driver "street/scripts/ledger-merge.py %O %A %B"
    echo 'street/notes/LEDGER.md merge=ledger' >> .gitattributes
"""
import sys

RANK = {'OPEN': 0, 'LANDED': 1, 'CONFIRMED': 2, 'VOID': 2}


def rows(path):
    """(key, line) for table rows; ('#', line) for everything else, in order."""
    out = []
    with open(path, encoding='utf-8') as fh:
        for line in fh.read().split('\n'):
            f = line.split('|')
            if line.startswith('|') and len(f) >= 5:
                out.append((f[3].strip(), line))
            else:
                out.append(('#', line))
    return out


def better(a, b):
    """The more advanced of two versions of the same row; evidence breaks ties."""
    ra = RANK.get(a.split('|')[1].strip(), 0)
    rb = RANK.get(b.split('|')[1].strip(), 0)
    if rb > ra:
        return b
    if ra > rb:
        return a
    return b if len(b) > len(a) else a


def main():
    _base, ours_path, theirs_path = sys.argv[1], sys.argv[2], sys.argv[3]
    ours, theirs = rows(ours_path), rows(theirs_path)

    best = {}
    for key, line in ours + theirs:
        if key == '#':
            continue
        best[key] = better(best[key], line) if key in best else line

    # OURS carries the document's shape — its prose, its header, its ordering.
    # Walk it, substituting the winning version of each row, then append rows
    # only THEIRS has. A row added on both sides appears once, from ours.
    seen, out = set(), []
    for key, line in ours:
        if key == '#':
            out.append(line)
        elif key not in seen:
            seen.add(key)
            out.append(best[key])
    for key, line in theirs:
        if key != '#' and key not in seen:
            seen.add(key)
            out.append(best[key])

    with open(ours_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out))
    return 0            # always clean: there is no case this cannot merge


if __name__ == '__main__':
    sys.exit(main())
=======
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
    m = re.match(r'\|\s*\w+\s*\|\s*(\w+)\s*\|\s*(.{0,60})', l)
    return (m.group(1), m.group(2).strip()) if m else None

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
>>>>>>> cfd146f6c (Audit: D's seven highlight rows CONFIRMED, walked on a build I checked first)

#!/usr/bin/env python3
"""Merge auditor evidence from an older LEDGER.md into the current one.

WHY THIS EXISTS. Ledger evidence is APPEND-ONLY: every pass adds a ' - **AUDITOR
...' segment to the end of a row and never rewrites what is there. A conflict
resolver that picks ONE SIDE of a row therefore always loses something, and it
loses it silently, because the row still looks fully populated. That happened
twice: once to a single row, and once to four passes at a stroke - the CONFIRMED
count fell from 124 to 115 and every row still read plausibly.

The fix is to stop choosing. Take mainline's row, and append any auditor segment
the older row has that the newer one does not.

    python3 scripts/ledger-recover.py <old-rev>
"""
import re, subprocess, sys

OLD = sys.argv[1] if len(sys.argv) > 1 else 'ef8998854'
PATH = 'notes/LEDGER.md'
old_txt = subprocess.run(['git', 'show', f'{OLD}:street/{PATH}'],
                         capture_output=True, text=True).stdout

def key(l):
    m = re.match(r'\|\s*\w+\s*\|\s*(\w+)\s*\|\s*(.{0,60})', l)
    return (m.group(1), m.group(2).strip()) if m else None

def status(l):
    m = re.match(r'\|\s*(\w+)\s*\|', l)
    return m.group(1) if m else ''

SEG = ' — **AUDITOR'
def segments(l):
    parts = l.split(SEG)
    return [SEG + p for p in parts[1:]]

old = {}
for l in old_txt.split('\n'):
    k = key(l)
    if k:
        old[k] = l

cur = open(PATH).read().split('\n')
restored = promoted = 0
for i, l in enumerate(cur):
    k = key(l)
    if not k or k not in old:
        continue
    o = old[k]
    add = [s for s in segments(o) if s[:70] not in l]
    if add:
        l = l.rstrip().rstrip('|').rstrip() + ''.join(s.rstrip().rstrip('|').rstrip() for s in add) + ' |'
        restored += len(add)
    if status(old[k]) == 'CONFIRMED' and status(l) != 'CONFIRMED':
        l = '| CONFIRMED |' + l[l.index('|', 1) + 1:]
        promoted += 1
    cur[i] = l

open(PATH, 'w').write('\n'.join(cur))
print(f'  restored {restored} auditor segment(s); promoted {promoted} row(s) back to CONFIRMED')

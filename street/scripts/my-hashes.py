#!/usr/bin/env python3
"""How many SHAs in MY OWN evidence can another builder resolve?

note-hashes reports 162 of 1395 citations across the notes pointing at commits
nobody else can resolve: builders rebase every item, the merge train rebases
again, and a SHA written down before that lands is a SHA that no longer exists.
The note still reads perfectly.

I cite build SHAs in nearly every evidence cell - "build 4b0a1c1da", "restored
from 3c55d1222". If those do not resolve on mainline, my stations are
unreproducible in exactly the way I keep filing against other people.
"""
import re, subprocess, sys

BR = 'add-stick-and-city98'
txt = open('notes/LEDGER.md').read()
segs = [s for s in txt.split(' — **AUDITOR')[1:]]
shas = set()
for s in segs:
    for m in re.finditer(r'\b([0-9a-f]{7,10})\b', s):
        h = m.group(1)
        if not re.fullmatch(r'\d+', h):      # not a plain number
            shas.add(h)
print(f'distinct SHAs cited in my evidence: {len(shas)}')
gone = []
for h in sorted(shas):
    r = subprocess.run(['git', 'merge-base', '--is-ancestor', h, BR],
                       capture_output=True)
    if r.returncode != 0:
        exists = subprocess.run(['git', 'cat-file', '-e', h + '^{commit}'],
                                capture_output=True).returncode == 0
        gone.append((h, 'exists locally, NOT on mainline' if exists else 'does not resolve at all'))
print(f'resolvable on {BR}: {len(shas) - len(gone)}')
print(f'NOT resolvable for another builder: {len(gone)}\n')
for h, why in gone[:20]:
    print(f'   {h}  {why}')
sys.exit(1 if gone else 0)

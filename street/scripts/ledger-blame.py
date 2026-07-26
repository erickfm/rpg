#!/usr/bin/env python3
"""WHICH COMMIT dropped a ledger row?

Five rows vanished in a day and I could not exonerate my own rebase. This walks
mainline's history commit by commit and names the first commit in which each row
is missing, together with that commit's author and subject. If the losses happen
in commits that are not mine, it is not my rebase.
"""
import re, subprocess, sys

BR = sys.argv[1] if len(sys.argv) > 1 else 'add-stick-and-city98'
N  = sys.argv[2] if len(sys.argv) > 2 else '120'
SHOW = 'street/notes/LEDGER.md'

def keys(t):
    out = {}
    for l in t.split('\n'):
        if not l.startswith('| '):
            continue
        f = l.split('|')
        if len(f) < 4 or not f[2].strip() or not f[3].strip():
            continue
        out[(f[2].strip(), f[3].strip()[:56])] = f[1].strip()
    return out

revs = subprocess.run(['git', 'rev-list', '--reverse', f'-{N}', BR],
                      capture_output=True, text=True).stdout.split()
if not revs:
    print('CANNOT ANSWER — no revisions listed.'); sys.exit(3)

prev, prevrev, losses = None, None, []
for r in revs:
    t = subprocess.run(['git', 'show', f'{r}:{SHOW}'], capture_output=True, text=True).stdout
    if not t:
        continue
    cur = keys(t)
    if prev is not None:
        gone = [k for k in prev if k not in cur]
        if gone:
            info = subprocess.run(['git', 'show', '-s', '--format=%h|%an|%s', r],
                                  capture_output=True, text=True).stdout.strip()
            losses.append((info, gone))
    prev, prevrev = cur, r

print(f'walked {len(revs)} commits of {BR}')
print(f'commits in which a row disappeared: {len(losses)}\n')
for info, gone in losses:
    h, an, sub = info.split('|', 2)
    print(f'  {h}  {an:22} {sub[:60]}')
    for k in gone:
        print(f'        lost: [{k[0]}] {k[1][:58]}')
sys.exit(1 if losses else 0)

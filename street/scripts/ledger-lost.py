#!/usr/bin/env python3
"""Rows that have DISAPPEARED from LEDGER.md.

Written after a CONFIRMED row - a real user request, already verified - was
deleted upstream and nobody noticed. The ledger is what the desk reads before
telling the user something is finished, so a row that stops existing is a
request that stops existing.

Compares every commit that touched the file against the current one and reports
keys that were present and are now gone.

    python3 scripts/ledger-lost.py [how-many-commits]
"""
import re, subprocess, sys

N = sys.argv[1] if len(sys.argv) > 1 else '60'
# git log pathspecs are CWD-RELATIVE; git show paths are REPO-ROOT-RELATIVE.
# Passing the root path to log matched nothing and the script printed
# "0 rows ever seen" as though that were a finding. An empty history is a
# broken query, not a clean bill of health, so it now exits 3.
SHOW = 'street/notes/LEDGER.md'      # for `git show rev:path`
LOG  = 'notes/LEDGER.md'             # for `git log -- path`, from street/

def keys(text):
    out = {}
    for l in text.split('\n'):
        if not l.startswith('| '):
            continue
        f = l.split('|')
        if len(f) < 4 or not f[2].strip() or not f[3].strip():
            continue
        out[(f[2].strip(), f[3].strip()[:56])] = f[1].strip()
    return out

cur = keys(open('notes/LEDGER.md').read())
revs = subprocess.run(['git', 'log', f'-{N}', '--format=%h', '--', LOG],
                      capture_output=True, text=True).stdout.split()
seen, first = {}, {}
for r in revs:
    t = subprocess.run(['git', 'show', f'{r}:{SHOW}'], capture_output=True, text=True).stdout
    if not t:
        continue
    for k, st in keys(t).items():
        if k not in seen:
            seen[k] = st
            first[k] = r

if not seen:
    print('CANNOT ANSWER — no historical revision of the ledger was readable.')
    sys.exit(3)
# RENAMED IS NOT LOST. The key is (agent, first 56 chars of the request), so
# EDITING a request text changes the key and the old one reads as deleted. That
# happened on "pressing e doesnt get me out of it", which had simply gained
# "- stuck in the TV seat" and was sitting in the file the whole time. Report a
# probable rename separately instead of crying wolf.
def overlap(a, b):
    wa, wb = set(a.lower().split()), set(b.lower().split())
    return len(wa & wb) / max(1, min(len(wa), len(wb)))

missing = {k: v for k, v in seen.items() if k not in cur}
renamed, gone = {}, {}
for k, v in missing.items():
    cand = [c for c in cur if c[0] == k[0] and overlap(c[1], k[1]) >= 0.6]
    (renamed if cand else gone)[k] = (v, cand[0] if cand else None)
if renamed:
    print(f'rows that look RENAMED rather than lost: {len(renamed)}')
    for k, (st, c) in sorted(renamed.items()):
        print(f'   [{st:9}] {k[0]:5} {k[1][:50]}')
        print(f'                    now: {c[1][:50]}')
    print()
gone = {k: v[0] for k, v in gone.items()}
print(f'rows now: {len(cur)}   rows ever seen in the last {N} commits: {len(seen)}')
print(f'rows that existed and are now GONE: {len(gone)}')
for k, st in sorted(gone.items()):
    print(f'   [{st:9}] {k[0]:5} {k[1][:60]}   (last seen {first[k]})')
sys.exit(1 if gone else 0)

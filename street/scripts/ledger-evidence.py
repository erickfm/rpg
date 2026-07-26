#!/usr/bin/env python3
"""CONFIRMED rows with nothing behind them.

Matches "auditor" CASE-INSENSITIVELY. The first version did not, and counted
rows whose evidence reads "- auditor -" in lower case as having none - three
false positives out of five on the file it was measuring. A sweep for
unsupported claims that is itself unsupported is the joke this repo keeps
telling about me.
"""
import re, sys
MARK = re.compile(r'CONFIRMED by|VERIFIED|STATION:|desk ruling|Desk \d|— desk|CHECK FROM|verified by|PREDICATE', re.I)
L = open(sys.argv[1] if len(sys.argv) > 1 else 'notes/LEDGER.md').read().split('\n')
conf = [l for l in L if l.startswith('| CONFIRMED |')]
bare = [l for l in conf if 'auditor' not in l.lower() and not MARK.search(l)]
print(f'CONFIRMED rows: {len(conf)}   with no auditor evidence and no verifier named: {len(bare)}')
for l in bare:
    f = l.split('|')
    print(f'  [{f[2].strip():5}] {f[3].strip()[:56]:58} {len(f[4].strip()) if len(f) > 4 else 0} chars')
sys.exit(1 if bare else 0)

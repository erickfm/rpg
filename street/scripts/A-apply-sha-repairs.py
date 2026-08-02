#!/usr/bin/env python3
"""AUDIT one-off: repair dead build-SHA citations in notes/LEDGER.md.

Append-only: never removes or edits existing evidence text. For every row
(line starting with "| ") that cites one or more dead/unreachable SHAs, it
inserts a short repair note just before the row's closing "|", listing:
  - dead SHA -> landed SHA it was matched to (method: patchid/subject/pickaxe)
  - dead SHA that could not be recovered, with a resolving anchor instead

Run from street/.
"""
import re

LEDGER = 'notes/LEDGER.md'
CURRENT_TIP = '57d824e1d'  # add-stick-and-city98 tip at audit time; resolves today

mapping = {}
with open('/tmp/final_mapping.tsv', encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line:
            continue
        dead, landed, method = line.split('\t')
        mapping[dead] = (landed, method)

# unrecoverable, with a short reason each
unrecoverable = {
    '3c8b6ec07': 'cites a `live: rpg-alley` integration-loop snapshot merge — those commits are minted every 15s by live-integrate.sh, subject-tagged [not for merge], and never intended to land; no landed twin exists by design',
    'c5e47c3b2': 'cites a `live: rpg-alley` integration-loop snapshot merge — same as 3c8b6ec07, not for merge, no landed twin exists by design',
    'dd35b833e': 'cites a `live: rpg-alley` integration-loop snapshot merge — same as 3c8b6ec07, not for merge, no landed twin exists by design',
    'e7c71873a': 'cites a `live: rpg-alley` integration-loop snapshot merge — same as 3c8b6ec07, not for merge, no landed twin exists by design',
    '33c2ab90c': 'no patch-id match and no unambiguous content match found in add-stick-and-city98 history; the object itself is a dangling commit, present only in this local odb',
    '5d58c182f': 'no patch-id match and no unambiguous content match found in add-stick-and-city98 history; the object itself is a dangling commit, present only in this local odb',
    '5b1b8e0d4': 'git object does not exist anywhere in this repo\'s odb (not merely unreachable — genuinely absent); content-search for its four citations returned multiple candidate commits, none unambiguous',
    '7a2c9befc': 'git object does not exist anywhere in this repo\'s odb; content-search for its citations returned multiple candidate commits, none unambiguous',
    '8c1b58dbb': 'git object does not exist anywhere in this repo\'s odb; content-search found no matching commit',
    'bbd8dd151': 'git object does not exist anywhere in this repo\'s odb; content-search returned multiple candidate commits, none unambiguous',
    '88e790882': 'git object does not exist anywhere in this repo\'s odb; cited alongside b5ebb9a60 and 788e73773 (both of which DO resolve as ancestors) as examples of a stale-row failure — the citation is to the AUDITOR\'S OWN now-gone commit, not to the finding itself',
}

with open(LEDGER, encoding='utf-8') as f:
    lines = f.read().split('\n')

sha_re = re.compile(r'\b([0-9a-f]{9})\b')

n_rows_touched = 0
n_repairs = 0
for i, line in enumerate(lines):
    if not line.startswith('| '):
        continue
    found = sha_re.findall(line)
    dead_here = []
    seen = set()
    for h in found:
        if len(h) != 9:
            continue
        if h in seen:
            continue
        if h in mapping or h in unrecoverable:
            dead_here.append(h)
            seen.add(h)
    if not dead_here:
        continue
    parts = []
    for h in dead_here:
        if h in mapping:
            landed, method = mapping[h]
            parts.append(f'`{h}` now resolves as `{landed}` (matched by {method}; same content, a rebase renamed it — GOTCHAS 36)')
            n_repairs += 1
        else:
            reason = unrecoverable[h]
            parts.append(f'`{h}` UNRECOVERABLE — {reason}. Re-verify this paragraph\'s claim fresh; the ledger text itself is intact and reachable at `{CURRENT_TIP}` (add-stick-and-city98, checked 2026-08-01)')
            n_repairs += 1
    note = ' **AUDITOR SHA REPAIR (2026-08-01):** ' + ' · '.join(parts) + '.'
    # insert before the trailing "|" if the line ends with one, else just append
    if line.endswith('|'):
        lines[i] = line[:-1].rstrip() + note + ' |'
    else:
        lines[i] = line + note
    n_rows_touched += 1

with open(LEDGER, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'rows touched: {n_rows_touched}')
print(f'citations repaired/annotated: {n_repairs}')

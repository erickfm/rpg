#!/usr/bin/env python3
"""Evidence that names a ROOM and an X that no longer belong together.

Two rooms were inserted into the interior belt today (a bank at 440, a jail at
1000) and every room after each insertion moved +80 m. A cell reading "the casino
at cx 600" was true when written and now names the burger. The measurement is not
wrong; its ADDRESS is, and a reader who goes to the coordinate arrives in the
wrong room.

Reports rows where a room name appears within 60 characters of an x coordinate
that currently sits in a DIFFERENT room.
"""
import re, sys, subprocess, json

belt = open('/tmp/belt.txt').read()
rooms = {}
for m in re.finditer(r'(\w+)@(\d+)', belt):
    rooms[m.group(1)] = int(m.group(2))
if not rooms:
    print('CANNOT ANSWER — no room belt supplied.'); sys.exit(3)
HALF = 40   # rooms are 80 m apart; anything within 40 m is "in" that room

def room_at(x):
    best, bd = None, 1e9
    for r, cx in rooms.items():
        d = abs(x - cx)
        if d < bd:
            bd, best = d, r
    return best if bd <= HALF else None

bad = []
for i, l in enumerate(open('notes/LEDGER.md').read().split('\n')):
    if not l.startswith('| CONFIRMED'):
        continue
    for m in re.finditer(r'\b(' + '|'.join(rooms) + r')\b', l, re.I):
        name = m.group(1).lower()
        window = l[max(0, m.start() - 60): m.end() + 60]
        # A NUMBER IS NOT A COORDINATE. The loose pattern matched areas
        # ("library 440 m2"), hex colours (#8d949b -> 949), build hashes
        # (974d16648 -> 974) and plain counts, and reported 29 rows of mostly
        # noise. Require an explicit coordinate marker: "x 834", "x=834",
        # "cx 440", or an opening bracket "(834.8,".
        for xm in re.finditer(r'(?:\bx\s*=?\s*|\bcx\s*|\()(\d{3,4})(?:\.\d+)?(?=[,\s)])', window):
            x = int(xm.group(1))
            if x < 400 or x > 1400:
                continue
            here = room_at(x)
            if here and here != name:
                bad.append((i + 1, name, x, here, window.strip()[:80]))
                break

print(f'rooms now: {" ".join(f"{k}@{v}" for k, v in sorted(rooms.items(), key=lambda t: t[1]))}')
print(f'CONFIRMED rows whose evidence names a room beside an x now in ANOTHER room: {len(set(b[0] for b in bad))}\n')
seen = set()
for row, name, x, here, ctx in bad:
    if row in seen:
        continue
    seen.add(row)
    print(f'  row {row}: says "{name}" near x {x} — x {x} is now the {here}')
    print(f'      …{ctx}…')
sys.exit(1 if bad else 0)

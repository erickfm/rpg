#!/usr/bin/env python3
"""Mirror the auditor's evidence out of LEDGER.md, and put it back.

WHY. Ten ledger rows and four of my own confirmations have been deleted by bulk
edits today, and every recovery so far has been archaeology: walk the commits,
find one that still has the text, merge it back. That works but it is slow, and
it fails the moment the losing commit is old enough that I no longer suspect it.

This keeps a MIRROR of my own segments in notes/audit-evidence.md - a file no
bulk ledger pass touches - keyed by (agent, request). Recovery stops being an
investigation and becomes one command.

    python3 scripts/audit-mirror.py save      # after any verification pass
    python3 scripts/audit-mirror.py restore   # merge missing segments back
    python3 scripts/audit-mirror.py check     # what is in the mirror and not the ledger

It never writes a STATUS. A verdict is a judgement and only a person restores it;
this carries the evidence the judgement rested on. Losing that is what makes a
verdict unrecoverable.
"""
import re, sys, os

LEDGER = 'notes/LEDGER.md'
MIRROR = 'notes/audit-evidence.md'
SEG = ' — **AUDITOR'

def key(l):
    f = l.split('|')
    if len(f) < 4 or not f[2].strip() or not f[3].strip():
        return None
    return (f[2].strip(), f[3].strip()[:56])

def segments(l):
    # The LAST segment of a row carries the row's closing ' |'. Storing that and
    # writing it back inserts a pipe into the evidence cell and silently splits
    # the row into an extra column - the recovered row then looks fine and is
    # malformed. Strip any trailing cell separator from each segment.
    out = []
    for p in l.split(SEG)[1:]:
        p = p.rstrip()
        while p.endswith('|'):
            p = p[:-1].rstrip()
        out.append(SEG + p)
    return out

def read_ledger():
    out = {}
    for l in open(LEDGER).read().split('\n'):
        if not l.startswith('| '):
            continue
        k = key(l)
        if k:
            segs = segments(l)
            if segs:
                out[k] = segs
    return out

def read_mirror():
    if not os.path.exists(MIRROR):
        return {}
    out, cur = {}, None
    for l in open(MIRROR).read().split('\n'):
        m = re.match(r'^## \[(.+?)\] (.*)$', l)
        if m:
            cur = (m.group(1), m.group(2)[:56]); out[cur] = []
        elif cur and l.startswith(SEG.strip()[:12]):
            out[cur].append(l)
    return {k: v for k, v in out.items() if v}

mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
led, mir = read_ledger(), read_mirror()

if mode == 'save':
    # COMPARE ON NORMALISED TEXT. The mirror is written with each segment
    # stripped, and the ledger's copies carry a leading space, so a raw prefix
    # compare never matched and every save duplicated the whole file - 154
    # segments became 308 in one run, silently, and would have doubled again on
    # the next. Dedupe on the stripped text.
    norm = lambda x: ' '.join(x.split())[:90]
    merged = dict(mir)
    for k, segs in led.items():
        have = set(norm(s) for s in merged.get(k, []))
        merged.setdefault(k, [])
        for s in segs:
            if norm(s) not in have:
                merged[k].append(s)
                have.add(norm(s))
    with open(MIRROR, 'w') as f:
        f.write('# Auditor evidence — mirror of every `— **AUDITOR` segment in LEDGER.md\n\n')
        f.write('Written by `scripts/audit-mirror.py save`. Restore with `restore`.\n')
        f.write('Append-only: segments are added, never rewritten, and STATUSES ARE NEVER STORED.\n\n')
        for k in sorted(merged):
            if not merged[k]:
                continue
            f.write(f'## [{k[0]}] {k[1]}\n\n')
            for s in merged[k]:
                f.write(s.strip() + '\n\n')
    print(f'mirrored {sum(len(v) for v in merged.values())} segment(s) across {len(merged)} row(s) -> {MIRROR}')

elif mode == 'restore':
    lines = open(LEDGER).read().split('\n')
    put, skipped = 0, []
    for i, l in enumerate(lines):
        k = key(l) if l.startswith('| ') else None
        if not k or k not in mir:
            continue
        add = [s for s in mir[k] if s[:70] not in l]
        if add:
            # REFUSE A MALFORMED ROW rather than repair one. A well-formed row
            # splits into exactly 6 fields: ['', status, agent, request,
            # evidence, '']. Anything else has lost or gained a column, and my
            # attempts to patch that produced a row with a stray seventh field -
            # a recovery tool must not corrupt what it is recovering. Report it
            # and let a person look.
            f = l.split('|')
            if len(f) != 6:
                skipped.append((key(l), len(f)))
                continue
            f[4] = f[4].rstrip() + ''.join(' ' + s.strip() for s in add) + ' '
            lines[i] = '|'.join(f)
            put += len(add)
    open(LEDGER, 'w').write('\n'.join(lines))
    print(f'restored {put} segment(s) from the mirror; statuses untouched')
    for k, n in skipped:
        print(f'  ** SKIPPED malformed row ({n} fields, expected 6): [{k[0] if k else "?"}] {(k[1] if k else "")[:44]}')
    if skipped:
        sys.exit(1)

else:
    missing = {k: [s for s in v if not any(s[:70] in l for l in open(LEDGER).read().split('\n'))]
               for k, v in mir.items()}
    missing = {k: v for k, v in missing.items() if v}
    print(f'mirror holds {sum(len(v) for v in mir.values())} segment(s) across {len(mir)} row(s)')
    print(f'segments in the mirror but NOT in the ledger: {sum(len(v) for v in missing.values())}')
    for k, v in missing.items():
        print(f'   [{k[0]}] {k[1][:50]} — {len(v)} missing')
    sys.exit(1 if missing else 0)

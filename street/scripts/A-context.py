#!/usr/bin/env python3
import re, sys

with open('notes/LEDGER.md', encoding='utf-8') as f:
    text = f.read()

targets = sys.argv[1:]
for h in targets:
    print(f"===== {h} =====")
    for m in re.finditer(re.escape(h), text):
        start = max(0, m.start() - 150)
        end = min(len(text), m.end() + 150)
        snippet = text[start:end].replace('\n', ' ')
        print(f"  ...{snippet}...")
    print()

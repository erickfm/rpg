#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
echo "== 06f0a1eca: 'stepped 2.2 m along the inward normal' =="
git log add-stick-and-city98 --format='%H %s' -S'stepped 2.2 m along the inward normal' -- notes/LEDGER.md

echo "== 0c9b5cd7f: 'floaters-walk.mjs diner' + 'exit codes checked one by one' =="
git log add-stick-and-city98 --format='%H %s' -S'exit codes checked one by one' -- notes/LEDGER.md

echo "== 5b1b8e0d4: 'My sweep matched the word' =="
git log add-stick-and-city98 --format='%H %s' -S'My sweep matched the word' -- notes/LEDGER.md

echo "== 7a2c9befc: 'my own mid-flight warning on this row is now RESOLVED' =="
git log add-stick-and-city98 --format='%H %s' -S'my own mid-flight warning on this row is now RESOLVED' -- notes/LEDGER.md

echo "== 8c1b58dbb: 'the casino'"'"'s reason was wrong, the verdict is not' =="
git log add-stick-and-city98 --format='%H %s' -S"the casino's reason was wrong, the verdict is not" -- notes/LEDGER.md

echo "== 9d0eaa3d7: 'THE 28 ARE 0' =="
git log add-stick-and-city98 --format='%H %s' -S'THE 28 ARE 0' -- notes/LEDGER.md

echo "== bbd8dd151: 'it settles the one claim only walking can settle' =="
git log add-stick-and-city98 --format='%H %s' -S'it settles the one claim only walking can settle' -- notes/LEDGER.md

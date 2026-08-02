#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
for h in 06f0a1eca 0c9b5cd7f 5b1b8e0d4 7a2c9befc 88e790882 8c1b58dbb 9d0eaa3d7 bbd8dd151; do
  echo "== $h =="
  git cat-file -t "$h" 2>&1
done

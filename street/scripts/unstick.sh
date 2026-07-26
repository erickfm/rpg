#!/usr/bin/env bash
# Rebase every worktree the merge train reported as CONFLICTS, resolving the
# ledger automatically. One command, because the desk has now done this by hand
# five times in one session.
#
#   scripts/unstick.sh            every conflicted worktree
#   scripts/unstick.sh rpg-lot    just that one
#
# Sixteen agents append to one LEDGER.md, so a rebase conflicts on it almost
# every time — and **every one of those conflicts has been false**: two writers
# advancing two different rows, three lines apart, which git sees as overlapping
# hunks. `ledger-merge.py` resolves them the way a human does (start from
# mainline's row, APPEND any auditor segment ours has that it lacks, take the
# stronger status, never choose a side).
#
# Meanwhile the builder is stalled and `land.sh` reports it as broken when
# nothing about its work is wrong.
#
# THE BUG THIS SCRIPT WAS WRITTEN AROUND, twice, by two different people:
# `grep -c` prints 0 AND EXITS 1 when there is no match, so the natural
# `n=$(grep -c ... || echo 0)` yields the two-line string "0\n0" and every
# numeric test against it reads as non-zero. It made the desk report two
# perfectly resolvable worktrees as STUCK, and it made a flat-colour census
# count 74 surfaces instead of 27. Assign it plainly and default with `${n:-0}`.
set -u
ROOT=/home/erick/projects
BASE=add-stick-and-city98
cd "$ROOT/rpg" || exit 1

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  for wt in "$ROOT"/rpg-*; do
    [ -d "$wt" ] || continue
    n=$(basename "$wt"); [ "$n" = rpg-live ] && continue
    # would this rebase cleanly? ask cheaply: is it behind, and does it differ
    git -C "$wt" merge-base --is-ancestor "$BASE" HEAD 2>/dev/null && continue
    targets+=("$n")
  done
fi

for n in "${targets[@]}"; do
  wt="$ROOT/$n"
  [ -d "$wt" ] || { echo "  $n: no worktree"; continue; }
  cd "$wt" || continue

  if [ -n "$(git status --porcelain 2>/dev/null | grep -v node_modules)" ] \
     && [ ! -d .git/rebase-merge ] && [ ! -d .git/rebase-apply ]; then
    echo "  $n: DIRTY — its owner must commit first, not mine to throw away"
    continue
  fi

  git rebase "$BASE" >/dev/null 2>&1 && { echo "  $n: clean"; continue; }

  for _ in $(seq 1 20); do
    files=$(git diff --name-only --diff-filter=U)
    if [ -n "$files" ]; then
      case "$files" in
        *LEDGER.md*) python3 street/scripts/ledger-merge.py street/notes/LEDGER.md >/dev/null 2>&1;;
      esac
      # checks.mjs is the same shape as the ledger: a REGISTRATION LIST that
      # every agent appends to. Two builders each registering a new check
      # conflict on adjacent lines and neither replaces the other, so union
      # them. K's tyre-arch check and N's mailbox check collided exactly this
      # way; keeping both is the only correct resolution.
      case "$files" in
        *checks.mjs*) python3 - "$PWD/street/scripts/checks.mjs" <<'UNION'
import sys
p=sys.argv[1]; L=open(p).read().split('\n')
out=[]; i=0
while i < len(L):
    if L[i].startswith('<<<<<<<'):
        head=[]; theirs=[]; i+=1
        while not L[i].startswith('======='): head.append(L[i]); i+=1
        i+=1
        while not L[i].startswith('>>>>>>>'): theirs.append(L[i]); i+=1
        i+=1
        out.extend(head); out.extend(theirs)
    else:
        out.append(L[i]); i+=1
open(p,'w').write('\n'.join(out))
UNION
        ;;
      esac
      m=$(grep -c '^<<<<<<<' street/notes/LEDGER.md 2>/dev/null); m=${m:-0}
      c=$(grep -c '^<<<<<<<' street/scripts/checks.mjs 2>/dev/null); c=${c:-0}
      m=$(( m + c ))
      other=$(echo "$files" | grep -vE 'LEDGER\.md|checks\.mjs' || true)
      if [ "$m" -ne 0 ] || [ -n "$other" ]; then
        echo "  $n: NEEDS A HUMAN — $(echo "$files" | tr '\n' ' ')"
        break
      fi
      git add -A street
    fi
    out=$(GIT_EDITOR=true git rebase --continue 2>&1)
    case "$out" in
      *"Successfully rebased"*|*"No rebase in progress"*) echo "  $n: resolved"; break;;
    esac
  done
done

cd "$ROOT/rpg" && ./street/scripts/land.sh 2>&1 | head -8

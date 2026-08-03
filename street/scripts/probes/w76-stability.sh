#!/bin/sh
# Five runs of casinodoor.mjs on unchanged source, for the stability claim
# (item 213). One run proves nothing here: this project has had a check score
# 109/109/110/0 across four runs of the same tree.
#   SHOT_URL=http://localhost:4320/ sh scripts/probes/w76-stability.sh
i=1
while [ $i -le 5 ]; do
  node scripts/casinodoor.mjs > /tmp/w76-cd-run$i.txt 2>&1
  code=$?
  line=$(grep -o '[0-9]*/[0-9]* passed' /tmp/w76-cd-run$i.txt)
  echo "run $i  exit=$code  $line"
  i=$((i + 1))
done

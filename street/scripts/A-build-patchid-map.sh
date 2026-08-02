#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
git log -p add-stick-and-city98 > /tmp/landed_log.patch 2>/tmp/landed_log.err
git patch-id --stable < /tmp/landed_log.patch > /tmp/patchids_landed.txt
wc -l /tmp/patchids_landed.txt

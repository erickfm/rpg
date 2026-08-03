#!/bin/sh
# Block until scripts/interiors-walk.mjs has written more than its header line.
# It buffers its whole 12-room report to the end, so "still one line" is the
# only signal available that it is still walking.
until [ "$(wc -l < /tmp/w65-walk-final.txt)" -gt 1 ]; do sleep 20; done
echo "interiors-walk finished"

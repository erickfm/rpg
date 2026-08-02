# ITEM 132 — remove the SEVENS blade (lines 938..1053 of ct/vice.ts as of
# 720f98399) and leave a tombstone in its place. Spliced by line number rather
# than by a 116-line exact-match edit, so the removal is exact and reviewable
# as a diff. One-shot; kept because the note cites it.
import io, sys, pathlib

p = pathlib.Path('src/proto/ct/vice.ts')
lines = p.read_text().split('\n')

FIRST, LAST = 938, 1053          # 1-indexed, inclusive
assert lines[FIRST - 1].strip().startswith('// ── the blade: full height'), lines[FIRST - 1]
assert lines[LAST - 1].strip() == '}', lines[LAST - 1]
assert 'riser(BL_X' in lines[LAST - 2], lines[LAST - 2]

TOMB = '''      // ═══ THE BLADE IS GONE — AND THE SKYLINE MARK IS NOT ═══════════════
      //
      // The user, on the now-legible facade: *"casino sign still a lil janky.
      // maybe we get rid of the one on the side here? add more flair to the
      // bulbs themselves instead?"*
      //
      // He phrased it as a question, so it was answered with a frame before it
      // was answered with a deletion — `scripts/probes/w51-frontage-without-
      // blade.mjs` hides the blade at runtime and shoots three stations. The
      // verdict from his own station is not close: the blade stood edge-on to
      // the road, so what it showed him was its 0.34 m cabinet laid down the
      // left third of the elevation, cutting the parapet run in half and
      // occluding the west chevron outright. Off, the frontage reads as one lit
      // rectangle — CASINO, the framed name, 777 between two chevrons, the
      // marquee — which is the composition item 97 built and the blade was
      // standing in front of.
      //
      // THE COST, MEASURED RATHER THAN ASSUMED. The worry was that this is the
      // tallest thing on the building and the only thing that reads from down
      // the street. It is NOT the tallest thing: the blade topped out at 21.4 m
      // and the rooftop board tops out at 26.0 m, 4.6 m above it, and that board
      // carries SEVENS in bulb-outlined letters on both faces. The skyline mark
      // was never the blade's job — the comment on the pylon below has said so
      // all along ("the blade below it does a different job"). So the long view
      // keeps its vertical, and what it loses is a second SEVENS three metres
      // from the first, competing with HOTEL ORPHEUS' blade for the same corner.
      //
      // Item 97 gave this blade a lit leading edge and that fix was correct —
      // it is why the black bar stopped being a black bar. Removing the object
      // does not retire the idiom: `riser`'s `z`/`w` parameters and the leading
      // edge treatment stay, and the rooftop board still uses both.
      //
      // ITEM 121 IS STILL LIVE. It gives HOTEL ORPHEUS' blade the same
      // leading-edge fix. ORPHEUS is a different building on a different
      // frontage, the user has not commented on it, and its blade does not
      // duplicate a name already painted two metres away — so nothing here
      // cancels it.'''

out = lines[:FIRST - 1] + TOMB.split('\n') + lines[LAST:]
p.write_text('\n'.join(out))
print(f'removed {LAST - FIRST + 1} lines, inserted {len(TOMB.split(chr(10)))}')

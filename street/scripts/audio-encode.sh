#!/usr/bin/env bash
# Turn Erick's raw WAVs into the shippable ogg set under public/audio/.
#
#   ./scripts/audio-encode.sh [SRC_DIR]      default SRC_DIR=~/Documents/sound
#
# The sources are 41 MB of 44.1 kHz PCM and live OUTSIDE the repo. Nothing at
# runtime reads them; this script is the only thing that ever does, and it
# exists so the committed oggs can be regenerated rather than being artefacts
# nobody can reproduce.
#
# ── what was measured, and why each choice ────────────────────────────────
#
# Spectrum, per source (share of energy by band):
#
#   city.wav          92.5% below 250 Hz   — close traffic rumble, the loudest bed
#   city2.wav         65.2% in 250–2k      — thinner, further off, and it DECAYS
#                                            across its 53 s (rms 0.007 → 0.005)
#   room.wav          79.7% below 250 Hz   — interior hum with occasional swells
#   construction.wav  81.6% in 250–2k      — quiet, distant site clatter
#   rain better.wav   the ONE bed with real top end: 45.9% in 2–8k and 9.1% in
#                     8–16k, centroid 5811 Hz. Replaced the original `rain.wav`
#                     on the user's *"replace the rain sound with rain better in
#                     sounds"*, and the numbers say why it is better: the old
#                     one had 6.3% in 2–8k and 1.1% above, centroid 3345 Hz —
#                     a wash where this is a patter. It is also the only source
#                     of the nine that arrived at a steady level (rms 0.0134 to
#                     0.0143 across its 48 s, against the old rain's audible
#                     fade-in), so the crossfade below has less to hide.
#
# So the four low beds are resampled to 22.05 kHz (Nyquist 11 kHz, above
# everything they contain) and rain to 32 kHz, which is where the audible saving
# comes from — far more than any bitrate knob. 32 kHz for rain is not a round
# number either: it keeps 99.55% of the new file's energy, because only 0.45%
# of it sits above 16 kHz.
#
# ── LOOP SEAMS ────────────────────────────────────────────────────────────
#
# None of the five beds loops cleanly as delivered: rain fades IN (head 50 ms
# rms 0.0033 against a tail of 0.0094), city2 decays across its length, and all
# of them simply stop mid-texture. Butt-joining any of them ticks.
#
# So every bed is rebuilt to loop seamlessly BY CONSTRUCTION. For source
# duration D and crossfade X, the output is
#
#     [ X … D-X ]  then  crossfade( [ D-X … D ] , [ 0 … X ] )
#
# which is D-X long and whose wrap point is the source's own sample at X on both
# sides — a join the material already contained, not one we invented. There is
# no seam left for the player to hear, and none for a future encoder change to
# expose. The alternative (halve-and-crossfade) moves the seam onto the source's
# original start/end junction, which is precisely the join we do not trust.
#
# Beds are peak-normalised to -3 dBFS because they arrive between -16.9 and
# -27.6 dBFS peak, i.e. up to 25 dB apart; balance belongs in ct/audio.ts where
# it can be heard against the world, not baked into files at random levels.
#
# ── ONE-SHOTS ─────────────────────────────────────────────────────────────
#
# stepoutside.wav is not one sound: it is 23 discrete footfalls at ~0.52 s
# spacing separated by true silence. stepinside.wav is 10 at ~0.41 s. birdfly is
# two separate wing flurries with 1.2 s of quiet between them. Playing any of
# them whole would give you a canned walk cycle you cannot stop mid-stride, so
# they are CUT at the measured onsets into individual samples the engine
# retriggers. The onset times below came out of an envelope pass over the
# sources; they are not guesses.
set -euo pipefail

SRC="${1:-$HOME/Documents/sound}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/audio"
mkdir -p "$OUT"
command -v ffmpeg >/dev/null || { echo "ffmpeg not found"; exit 1; }

# peak gain, in dB, that takes a file's loudest sample to -3 dBFS
peak_gain() {
  local max
  max=$(ffmpeg -hide_banner -i "$1" -af volumedetect -f null - 2>&1 \
        | grep -oP 'max_volume: \K-?[0-9.]+' | head -1)
  python3 -c "print(f'{-3 - ($max):.2f}')"
}

# ── WHEN PEAK NORMALISATION IS THE WRONG TREATMENT ─────────────────────────
#
# `rain better.wav` arrives at -3.9 dBFS peak and -30.7 LUFS. The other four
# beds land at -18.2 to -20.6 LUFS after peak normalisation, so peak-normalising
# this one put it TWELVE DECIBELS below the rest of the set — and no mix
# constant in ct/audio.ts can fix a file that arrives that far out, because
# taking it back would need a gain of 1.47 on a bed that has to sum with four
# others without clipping.
#
# The cause is in the material and is worth stating: measured in 20 ms frames,
# the body of this recording sits at 0.07–0.11, and only 28 frames out of 2274
# — 1.2% — exceed 0.30, with nine above 0.50. A handful of very close drops set
# the peak for the whole file. Peak normalisation asks "how loud is the loudest
# sample", which for rain is a question about nine frames, and the answer
# silences the other 2265.
#
# So this bed is normalised by LOUDNESS instead, K-weighted, with a limiter for
# those few outliers. Limiting 1.2% of frames is inaudible; leaving the bed 12 dB
# down is not. The gain is CONSTANT — computed once and applied flat, never
# ffmpeg's dynamic `loudnorm` — because the loop crossfade below joins the tail
# to the head, and a time-varying gain would give those two ends different
# levels and put back exactly the seam this script exists to remove.
loud_gain() {
  local i
  i=$(ffmpeg -hide_banner -i "$1" -af ebur128 -f null - 2>&1 \
      | grep -oP '^\s*I:\s*\K-?[0-9.]+' | tail -1)
  python3 -c "print(f'{$2 - ($i):.2f}')"
}

# bed NAME SRCFILE RATE CHANNELS XFADE [TARGET_LUFS]
# With TARGET_LUFS the bed is loudness-normalised and limited; without it, the
# peak goes to -3 dBFS. See the note above for which is right when.
bed() {
  local name=$1 src=$2 rate=$3 ch=$4 x=$5 lufs=${6:-}
  local d g tail=''
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC/$src")
  if [ -n "$lufs" ]; then
    g=$(loud_gain "$SRC/$src" "$lufs")
    tail=',alimiter=limit=0.7:level=disabled'      # headroom for codec overshoot
  else
    g=$(peak_gain "$SRC/$src")
  fi
  local e; e=$(python3 -c "print(f'{$d - $x:.4f}')")
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$src" -filter_complex "
    [0:a]asplit=3[a1][a2][a3];
    [a1]atrim=start=$x:end=$e,asetpts=N/SR/TB[mid];
    [a2]atrim=start=$e,asetpts=N/SR/TB[tail];
    [a3]atrim=end=$x,asetpts=N/SR/TB[head];
    [tail][head]acrossfade=d=$x:c1=tri:c2=tri[xf];
    [mid][xf]concat=n=2:v=0:a=1,volume=${g}dB${tail}[out]" \
    -map '[out]' -ac "$ch" -ar "$rate" -c:a libvorbis -q:a 1 "$OUT/$name.ogg"
  echo "  $name.ogg  <- $src  ${rate}Hz ${ch}ch  ${g}dB${lufs:+ (to ${lufs} LUFS, limited)}  loop=$(python3 -c "print(f'{$d-$x:.1f}')")s"
}

# one NAME SRCFILE START DUR FADEOUT_AT RATE GAINDB
one() {
  local name=$1 src=$2 st=$3 dur=$4 fo=$5 rate=$6 g=$7
  ffmpeg -hide_banner -loglevel error -y -ss "$st" -t "$dur" -i "$SRC/$src" \
    -af "afade=t=in:st=0:d=0.006,afade=t=out:st=$fo:d=0.05,volume=${g}dB" \
    -ac 1 -ar "$rate" -c:a libvorbis -q:a 2 "$OUT/$name.ogg"
}

echo "beds (seamless, peak -3 dBFS):"
bed street-a  city.wav          22050 2 1.5
bed street-b  city2.wav         22050 2 1.5
bed room      room.wav          22050 2 1.5
bed site      construction.wav  22050 1 1.5
bed rain      "rain better.wav" 32000 2 1.5 -19

# stepoutside: 23 footfalls, onsets 0.249 0.798 1.397 1.946 2.524 3.068 3.647
# 4.146 4.669 5.193 5.697 6.231 6.765 7.288 7.797 8.331 8.870 …  Eight taken
# from across the take so the walk cycle does not repeat audibly. Peak is
# -4.6 dBFS already, so no lift.
echo "footsteps, outdoors:"
i=0
for t in 0.798 1.946 2.524 3.647 4.669 5.697 7.288 8.870; do
  i=$((i+1)); s=$(python3 -c "print(f'{$t-0.03:.3f}')")
  one "step-out-$i" stepoutside.wav "$s" 0.45 0.40 32000 0
done

# stepinside: 10 footfalls at ~0.41 s, peak only -17.2 dBFS — lifted 12 dB so a
# floorboard is not a whisper next to the pavement.
echo "footsteps, indoors:"
i=0
for t in 0.444 0.858 1.272 1.676 2.878 3.273; do
  i=$((i+1)); s=$(python3 -c "print(f'{$t-0.02:.3f}')")
  one "step-in-$i" stepinside.wav "$s" 0.38 0.33 32000 12
done

# birdfly: two flurries, 0.68–2.9 s and 4.09–6.1 s, quiet either side.
echo "birds:"
one bird-1 birdfly.wav 0.60 2.70 2.50 44100 0
one bird-2 birdfly.wav 4.00 2.60 2.40 44100 0

echo
du -ch "$OUT"/*.ogg | tail -1

# ── the second delivery: 26 more files, named for their purpose ─────────────
#
#   sfx NAME SRCFILE START DUR RATE
#
# One event, one file, trimmed to its CONTENT and peak-normalised to -3 dBFS
# like the beds. Every start/dur below came from an envelope pass at 0.8% of
# peak, not from eyeballing a waveform — several of these carry half a second
# of room tone before the event and `mail open` carries 0.17 s of it.
#
# Peak normalisation IS right for these, and it is worth saying why after the
# rain bed proved it wrong there: a thud, a click and a latch ARE their peak.
# There is no sparse body for the loudest frame to misrepresent, because the
# whole file is the loudest frame. Nine of them arrive quiet enough to need
# 8-20 dB of lift — `light on` peaks at 0.083 — and normalising is the only
# thing that puts them in the same room as each other.
#
# SAMPLE RATE IS PER FILE, from what the file contains:
#   44100  click (54% of its energy above 8 kHz), sleep (38%)
#   32000  the bright latches and rattles: fence, keyboard, the registers,
#          the light switch, page turn, mail
#   22050  everything low: thuds, doors, the drawer, the cat, the alarm
sfx() {
  local name=$1 src=$2 st=$3 dur=$4 rate=$5
  local g fo
  g=$(peak_gain "$SRC/$src")
  fo=$(python3 -c "print(f'{max(0.0, $dur - 0.06):.3f}')")
  ffmpeg -hide_banner -loglevel error -y -ss "$st" -t "$dur" -i "$SRC/$src" \
    -af "afade=t=in:st=0:d=0.004,afade=t=out:st=$fo:d=0.055,volume=${g}dB" \
    -ac 1 -ar "$rate" -c:a libvorbis -q:a 2 "$OUT/$name.ogg"
  echo "  $name.ogg  <- $src  ${rate}Hz  ${g}dB  ${dur}s"
}

echo "the flat, and the things you touch in it:"
sfx light-on     "light on.wav"            0.00 0.24 32000
sfx light-off    "light off.wav"           0.00 0.24 32000
sfx drawer-open  "drawer open.wav"         0.04 1.02 22050
sfx mail-open    "mail open.wav"           0.15 1.40 32000
sfx mail-close   "mail close.wav"          0.04 0.64 32000
sfx page-turn    "page turn.wav"           0.00 0.56 32000
sfx sleep        "sleep time away.wav"     0.01 1.50 44100
sfx alarm        "digital alarm clock.wav" 0.00 2.01 22050

echo "doors:"
sfx door-open    "door open.wav"           0.11 1.12 22050
sfx door-close   "door close.wav"          0.02 1.42 22050
sfx door-knock   "door knock single.wav"   0.00 0.30 22050

echo "shops:"
sfx register-1   "Cash Register 1.wav"     0.00 1.55 32000
sfx register-2   "Cash Register 3.wav"     0.00 1.90 32000

echo "the body:"
sfx land-soft    "body land feet.wav"      0.00 0.58 22050
sfx land-hard    "body land.wav"           0.01 1.00 22050
sfx wall-hit     "body wall hit.wav"       0.08 0.34 22050

echo "the block, and the alley:"
sfx meow         "meow.wav"                0.11 1.14 22050
sfx fence        "fence.wav"               0.02 0.53 32000

# keyboard is THREE keystrokes at 0.02/0.17/0.30, and a terminal you type at
# wants them separately or every keypress is the same triplet.
echo "the terminal:"
i=0
for t in 0.01 0.16 0.29; do
  i=$((i+1)); sfx "key-$i" "keyboard.wav" "$t" 0.13 32000
done

# click is TWO clicks, 0.02 and 0.15. Two so a menu does not tick identically
# every row; short so it cannot become a texture.
echo "ui:"
sfx click-1      "click.wav"               0.01 0.12 44100
sfx click-2      "click.wav"               0.14 0.12 44100

# ── the street: cars, trucks, and the bus ───────────────────────────────────
#
# `bus.wav` is not one sound, it is a whole VISIT, and the half-second envelope
# says so: 2-10 s approaching (rms 0.003 climbing to 0.149), 11-24 s standing at
# the stop idling (steady 0.06), 24.5-28 s pulling away (surging to 0.242), then
# thirty seconds of receding into nothing. Played whole it would be a fifty
# second event that could not be aligned with anything. Cut at those boundaries
# it is three pieces a bus stop can actually use, and the middle one loops.
echo "the bus, cut at its own boundaries:"
# The ARRIVAL is the last four seconds of the approach, not all eight: it is
# fired when the bus starts braking, and a recording that took 8.6 s to reach
# its stop would land the hiss and settle long after the real bus had parked.
sfx bus-arrive "bus.wav"  6.80  4.00 22050
# The DEPARTURE is the surge, not the thirty seconds of receding behind it.
sfx bus-depart "bus.wav" 24.00  6.00 22050

# `bed` normalises a whole file, and the idle is a WINDOW of one — so it is cut
# first and looped second. Two steps, because a seamless loop needs the tail and
# the head of the SAME material and the crossfade cannot know which 13 seconds
# were meant.
ffmpeg -hide_banner -loglevel error -y -ss 11.0 -t 13.0 -i "$SRC/bus.wav" \
  -ac 1 -ar 44100 -c:a pcm_s16le "$OUT/.bus-idle-cut.wav"
SRC_SAVE=$SRC; SRC=$OUT
bed bus-idle ".bus-idle-cut.wav" 22050 1 1.2 -20
SRC=$SRC_SAVE
rm -f "$OUT/.bus-idle-cut.wav"

echo "cars and trucks:"
# CUT TO THE PASS ITSELF, not the whole recording. Both files are 8-10 s of
# approach, whoosh and recede, and their half-second envelopes peak at 4.0-4.75 s
# (rms 0.169) and 4.0-4.5 s (0.105). Played whole against a car that crosses the
# player in about two seconds, the recording's arc and the vehicle's would drift
# apart and the sound would arrive from nowhere. A 3.2 s window centred on the
# peak IS the pass, and it can be fired at closest approach and stay in step.
sfx truck-pass-1 "truck pass.wav"    3.00 3.20 22050
sfx truck-pass-2 "truck pass 2.wav"  2.90 3.20 22050
sfx car-start    "car start.wav"     0.00 3.00 22050
sfx car-door-open  "car door open.wav"  0.22 0.96 32000
sfx car-door-close "car door close.wav" 0.06 0.40 22050
# car idle is 3.7 s of steady four-stroke firing — the one vehicle file that is
# a texture rather than an event, so it is the one that loops.
bed car-idle "car idle.wav" 22050 1 0.4 -20
# `car start + idle.wav` is deliberately NOT used: it is `car start` followed by
# `car idle`, both of which are here separately and can be sequenced by the
# engine at whatever gap the world needs. One file cannot be.

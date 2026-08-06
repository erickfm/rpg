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
#   rain.wav          only bed with real 2–8k content (6.3%) and 8k+ (1.1%)
#
# So the four low beds are resampled to 22.05 kHz (Nyquist 11 kHz, above
# everything they contain) and rain to 32 kHz, which is where the audible saving
# comes from — far more than any bitrate knob.
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

# bed NAME SRCFILE RATE CHANNELS XFADE
bed() {
  local name=$1 src=$2 rate=$3 ch=$4 x=$5
  local d g
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC/$src")
  g=$(peak_gain "$SRC/$src")
  local e; e=$(python3 -c "print(f'{$d - $x:.4f}')")
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$src" -filter_complex "
    [0:a]asplit=3[a1][a2][a3];
    [a1]atrim=start=$x:end=$e,asetpts=N/SR/TB[mid];
    [a2]atrim=start=$e,asetpts=N/SR/TB[tail];
    [a3]atrim=end=$x,asetpts=N/SR/TB[head];
    [tail][head]acrossfade=d=$x:c1=tri:c2=tri[xf];
    [mid][xf]concat=n=2:v=0:a=1,volume=${g}dB[out]" \
    -map '[out]' -ac "$ch" -ar "$rate" -c:a libvorbis -q:a 1 "$OUT/$name.ogg"
  echo "  $name.ogg  <- $src  ${rate}Hz ${ch}ch  ${g}dB  loop=$(python3 -c "print(f'{$d-$x:.1f}')")s"
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
bed rain      rain.wav          32000 2 1.5

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

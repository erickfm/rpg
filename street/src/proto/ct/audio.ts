import type * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { BUILD, ORDER as HOOK } from './ctx';
// Read-only, and the same three constants `ct/tenancy.ts` already imports from
// there. Nothing in this module writes to `apartment.ts` or depends on its
// internals — only on where the building stands and how tall a storey is.
import { APT_X0, ST0 } from './apartment';
// Read-only, and no cycle: `hud.ts` does not import this module. `ct/osd.ts`
// DOES (for the menu's VOLUME row), which is why nothing here imports osd.
import { panelUp } from './hud';

// ════════════════════════════════════════════════════════════════════════════
// SOUND
//
// The user, 2026-08-05: *"i want to add sounds. i have a bunch here
// /home/erick/Documents/sound"* — eight WAVs, 41 MB of 44.1 kHz PCM.
//
// This is a LEAF MODULE. It exports `register` and `ORDER` and `ct/world.ts`
// globs it in; it edits nothing else and imports nothing but `ctx`. That is
// deliberate and it is achievable, because everything a soundtrack needs is
// already on the context:
//
//   f.px, f.pz     where he is        →  indoors, and how far from a source
//   f.dt           frame time         →  crossfades, and footstep cadence
//   f.hourF        time of day        →  a building site knocks off at six
//   ctx.player.yaw where he is LOOKING →  which ear a sound arrives in
//   ctx.scene      userData.rainLevel →  how hard it is raining right now
//
// ── WHAT THE FILES ACTUALLY ARE ─────────────────────────────────────────────
//
// Measured, not assumed — the brief called them "street ambience" and one of
// them is not:
//
//   city.wav   33.4 s  92.5% of its energy BELOW 250 Hz. Close traffic rumble
//              and the loudest of the set (-16.9 dBFS peak).
//   city2.wav  52.9 s  65% in 250 Hz–2 kHz, 8 dB quieter, and it DECAYS across
//              its length (rms 0.007 → 0.005). NOT a variant of city.wav — a
//              different, thinner, further-off recording. Two places, not two
//              takes, which is why both are used and neither replaces the other.
//   room.wav   52.2 s  interior hum, low, with slow swells every ~20 s.
//   rain.wav   50.4 s  the only file with real content above 2 kHz.
//   construction.wav  37.2 s  quiet, mid-heavy, distant site clatter.
//
// NONE of the five loops cleanly as delivered — rain fades in, city2 decays,
// and every one of them simply stops mid-texture. `scripts/audio-encode.sh`
// rebuilds each one so that it loops seamlessly by construction, and that
// script's header is where the arithmetic lives.
//
// The three short files are not single sounds at all. `stepoutside` is 23
// discrete footfalls at ~0.52 s spacing with true silence between them,
// `stepinside` is 10 at ~0.41 s, `birdfly` is two separate wing flurries either
// side of 1.2 s of quiet. They are cut at their measured onsets into samples
// this module retriggers, so a footstep follows HIS legs instead of playing a
// canned walk cycle you cannot stop mid-stride.
//
// ── THE GESTURE ─────────────────────────────────────────────────────────────
//
// No browser will start audio without one, so nothing here constructs an
// `AudioContext` until the player has touched something. The world takes
// pointer lock on a canvas click and that click is the gesture — but this does
// NOT reach into `fp.ts` to find it. It listens on `window` for the first
// trusted `pointerdown`, `keydown` or `pointerlockchange`, in the capture
// phase so that a gate swallowing the event for its own reasons cannot also
// swallow the boot. Whichever arrives first wins, all three then unregister,
// and clicking the canvas to play is therefore the same click that starts the
// sound. A player who opens the page and presses `W` boots it just as well.
//
// ── 41 MB IS NOT SHIPPABLE ──────────────────────────────────────────────────
//
// `public/audio/*.ogg`, 1.3 MB for all 21 of them, committed. Ogg Vorbis and
// not mp3 for one specific reason: an mp3 carries encoder delay and padding
// that `decodeAudioData` hands back as PCM, so a looped `AudioBufferSourceNode`
// ticks on every wrap no matter how clean the source was. Vorbis carries an
// exact sample count and loops gaplessly, and a bed with a click at the join is
// worse than no bed. Most of the saving is not bitrate but SAMPLE RATE: four of
// the five beds hold nothing above 2 kHz, so they are resampled to 22.05 kHz.
// ════════════════════════════════════════════════════════════════════════════

/** Nothing is drawn, so this could sit anywhere — but `rnd()` in `ct/rng.ts` is
 *  one seeded stream and three.js burns four `Math.random()` calls per object
 *  on `generateUUID`, so a module's position in the build order moves every
 *  tree in the world (GOTCHAS §2). This one creates no three.js object and
 *  takes no draw from the seeded stream, at build time or after it — see
 *  `roll()` below — so it is inert either way. PROPS because that is what it
 *  is: a fitting on the block. */
export const ORDER = BUILD.PROPS;

// ── THE MIXER, FOR ANYONE WHO WANTS TO DRIVE IT ─────────────────────────────
//
// A VCR-style options menu shipped in `7b728518` with handedness, invert look,
// look speed and field of view — and no sound, because this module exported
// `register` and `ORDER` and nothing else. Volume and mute existed, were
// remembered across reloads, and were unreachable.
//
// GETTERS, NOT A COPY. The menu asks what the volume IS every time it paints
// rather than keeping its own number in step with this one — the two-numbers-
// that-must-agree bug, which this project has now hit repeatedly. There is one
// number and it lives here.
//
// SETTERS GO THROUGH `commit()`, the same path `M`, `[` and `]` take, so a
// change from the menu writes localStorage and re-gains the master exactly as a
// keypress does. The menu and the keys cannot disagree, because there is
// nothing for them to disagree ABOUT.
//
// ── WHY THIS STATE IS AT MODULE SCOPE AND NOT INSIDE `register()` ───────────
//
// It was inside, and the exports delegated to a handle `register()` assigned.
// They shipped correct and DEAD, and cost another builder an afternoon: the
// menu called `setVolume` and nothing happened, so it fell back to writing this
// module's own localStorage key by hand, which only takes effect on reload.
//
// The cause was not in this file at all. `crosstown.ts` threw at `rig.look2`
// before it reached `buildWorld(ctx, BUILD.PROPS, 99)`, so `register()` never
// ran, so the handle stayed null — and `mixer?.setVolume(v)` on a null handle
// is SILENT. A setter that quietly does nothing is the worst possible shape for
// this: the caller has no way to tell "not wired yet" from "wired and ignored",
// and reasonably concluded the export was missing.
//
// So the volume and the mute flag live HERE, at module scope, loaded from
// storage the moment the module is imported. They have nothing to do with an
// `AudioContext` and never needed to wait for one. `register()` now only
// INSTALLS the side effect — re-gain the master — and adopts whatever the
// state already is. The exports work from the first tick of
// the first import, whether the world built, half-built or threw.
const PREF = 'ct.audio';
let vol = 0.75, muted = false;
try {
  const s = JSON.parse(localStorage.getItem(PREF) || '{}') as { v?: number; m?: boolean };
  if (typeof s.v === 'number' && s.v >= 0 && s.v <= 1) vol = s.v;
  if (typeof s.m === 'boolean') muted = s.m;
} catch { /* a corrupt pref is not worth a broken world */ }

/** What `register()` plugs in: push the state at the audio graph. Null before
 *  the world builds, and that is FINE — the state is still authoritative, still
 *  persisted, and still correct when this arrives. */
let apply: (() => void) | null = null;

/**
 * THE ONLY WAY THE MIXER EVER CHANGES — the keys and the options menu both
 * end here.
 *
 * `M`, `[`, `]` and `setVolume()` from the menu are four front doors onto two
 * variables, and the failure they invite is the one
 * this codebase keeps hitting: a caller that sets the value and forgets one of
 * the things that must follow it. Persisting and applying are not two
 * obligations on five callers, they are one function.
 */
function commit(): void {
  try { localStorage.setItem(PREF, JSON.stringify({ v: vol, m: muted })); } catch { /* private mode */ }
  apply?.();
}

/**
 * VOLUME IS CONTINUOUS, 0…1. Pass any float; it is clamped, never rejected.
 *
 * `[` and `]` move it in eighths, so a menu offering the same 1/8 stops lands
 * exactly where the keys do — but that is the KEYS' stride, not a constraint on
 * the value. A continuous slider is fine and will display fine.
 *
 * Not a decibel scale: the gain is `vol * vol`, which is where the perceptual
 * curve lives. 0…1 is what a slider should show.
 */
export const VOLUME_STEP = 1 / 8;
const STEP = VOLUME_STEP;

/** current volume, 0…1. Ask every paint; do not cache it. */
export const volume = (): number => vol;
/** set volume, 0…1, clamped. Raising it un-mutes, exactly as `]` does. */
export function setVolume(v: number): void {
  if (!Number.isFinite(v)) return;
  vol = Math.max(0, Math.min(1, v));
  // Raising the volume un-mutes, exactly as `]` does. Dragging a slider up and
  // hearing nothing is the same bug as pressing the key and hearing nothing,
  // and it must not have two different answers.
  if (vol > 0) muted = false;
  commit();
}
/** is sound muted right now */
export const isMuted = (): boolean => muted;
/** mute or un-mute. Leaves the volume where it was, exactly as `M` does. */
export function setMuted(b: boolean): void { muted = !!b; commit(); }
/** what `M` does */
export function toggleMute(): void { setMuted(!muted); }

// ── the asset roster ────────────────────────────────────────────────────────
const BEDS = ['street-a', 'street-b', 'room', 'site', 'rain'] as const;
type BedName = (typeof BEDS)[number];

/** The one-shots, cut from the three short sources. Eight outdoor footfalls and
 *  six indoor ones is enough that the cycle never lines up with a stride; two
 *  bird flurries is what `birdfly.wav` actually contained. */
const OUT_STEPS = ['step-out-1', 'step-out-2', 'step-out-3', 'step-out-4',
  'step-out-5', 'step-out-6', 'step-out-7', 'step-out-8'] as const;
const IN_STEPS = ['step-in-1', 'step-in-2', 'step-in-3',
  'step-in-4', 'step-in-5', 'step-in-6'] as const;
const BIRDS = ['bird-1', 'bird-2'] as const;

/** The second delivery — 26 more files, named for their purpose. These are
 *  EVENTS: one file, one thing happening, nothing looped. */
const EVENTS = [
  'land-soft', 'land-hard', 'wall-hit',
  'light-on', 'light-off', 'drawer-open', 'door-open', 'door-close',
  'register-1', 'register-2', 'mail-open', 'mail-close', 'sleep',
] as const;

const SHOTS = [...OUT_STEPS, ...IN_STEPS, ...BIRDS, ...EVENTS] as const;

/**
 * WHERE THE FILES ARE, resolved against the DOCUMENT rather than hardcoded.
 *
 * `/audio/x.ogg` would be correct on :5177 and wrong on Pages, which is served
 * from `/rpg/` with `--base=./`. `document.baseURI` is the page's own URL in
 * both, so this resolves to `/audio/…` in dev and `/rpg/audio/…` on Pages with
 * no build-time constant to keep in step. It also means `import.meta.env` is
 * not needed, which matters: `tsconfig.json` does not pull in `vite/client`.
 *
 * THE PACKED ARTIFACT IS THE EXCEPTION and the reason for the first line. It is
 * one HTML file opened from `file://`, where a relative fetch is a CORS failure
 * rather than a 404, so there is no path that could work — the bytes have to be
 * IN the page. `scripts/pack-artifact.mjs` reads `dist/audio/` and writes them
 * out as `window.__CT_AUDIO`, a name → `data:` URI table, in a script tag ahead
 * of the bundle. `fetch` takes a data URI exactly like any other URL, so that
 * is the whole of the special case: one lookup, and nothing downstream knows.
 *
 * If the table is absent the fetch is attempted anyway and fails quietly — see
 * `boot()`. An artifact packed by an older script is silent, not broken.
 */
const url = (n: string) => {
  const inlined = (window as unknown as { __CT_AUDIO?: Record<string, string> }).__CT_AUDIO;
  return inlined?.[n] ?? new URL(`audio/${n}.ogg`, document.baseURI).href;
};

// ── mix levels, all in one place so they can be argued about ────────────────
//
// The beds were peak-normalised to -3 dBFS by the encoder because they arrived
// up to 25 dB apart, so every balance decision is HERE, where it can be heard
// against the world, rather than baked into a file at a level nobody can see.
//
// **The user, on hearing the first cut: *"the ambiance sounds are too loud"*.**
// Every bed came down about 7 dB and the one-shots did not move — a bed is the
// room you are standing in and belongs UNDER everything, and the encoder hands
// them over peak-normalised to -3 dBFS, which is as hot as a file gets. The
// footsteps and the birds are events and stayed where they were, so the balance
// tipped the right way round in the same edit.
const LVL = {
  // 0.15 -> 0.17: the close traffic carries more of the mix now that the far
  // layer is only occasionally there. *"bank on a mix between the regular street
  // sounds mostly"* — this is the "mostly".
  streetA: 0.17,   // the base of the outdoor bed: close traffic rumble
  streetB: 0.13,   // the further-off layer with the sirens in it — see `sway`
  room: 0.13,
  // *"replace the rain sound with rain better in sounds"*. The FILE changed and
  // the in-world level deliberately did not: the old bed sat at -16.9 LUFS and
  // the new one at -19.4, so 0.30 became 0.40 purely to cancel that 2.5 dB. He
  // asked for a different recording, not a louder rainstorm.
  rain: 0.40,      // multiplied by rainLevel, so this is its DOWNPOUR level
  // …of the above, heard through a window. Raised from 0.20 when the wall
  // filter went in: rain is the ONE bed with real content above 2 kHz, so a
  // 520 Hz corner takes far more off it than off the traffic, and the level it
  // needed on the far side of the filter is not the level it needed before it.
  rainIndoors: 0.55,
  site: 0.20,      // multiplied by distance and by the working day
  // THESE WENT DOWN 8 dB AND CAME STRAIGHT BACK UP. *"step sounds are too
  // loud"*, then *"revert step vol sorry"* four minutes later. He is the check
  // and the second word wins, so this is the ORIGINAL level, restored exactly.
  //
  // Worth writing down rather than quietly reverting: the complaint arrived
  // right after the beds dropped 7 dB, and 0.22 was the answer to a mix that
  // had only just moved under it. Once he had walked around with it, the steps
  // at 0.55 over beds at 0.15 were what he wanted — the first reading was of
  // the CHANGE, not of the level. A one-shot heard against a bed that shifted a
  // moment ago is not yet a judgement about the one-shot.
  stepOut: 0.55,
  stepIn: 0.50,
  bird: 0.70,      // multiplied by distance
  land: 0.60,
  door: 0.55,      // multiplied by distance
  light: 0.60,
  drawer: 0.50,
  register: 0.45,
  mail: 0.55,
  sleep: 0.50,
};

/** METRES PER FOOTFALL, and the cadence is derived from it rather than timed.
 *
 *  A timer has to be told how fast he is going and gets it wrong on every
 *  slope, every doorway and every collision slide. Distance does not: the step
 *  falls when the leg has travelled far enough, so walking, sprinting and
 *  scraping along a wall are all correct without any of them being a case.
 *
 *  **The user, first thing he said on hearing it: *"steps are too quick btw
 *  must be slower"*.** It shipped at 0.78 m, which against `fp.ts`'s walk of
 *  3.2 m/s is 4.1 footfalls a second — a jog, and he was walking.
 *
 *  The right number was already in the recording and I had measured it and not
 *  used it: `stepoutside.wav` is 23 footfalls spaced 0.52 s apart, which at
 *  3.2 m/s is a 1.66 m stride. So walking now plays the take at the cadence it
 *  was WALKED at, which is why it stops sounding like a man in a hurry. */
const STRIDE = 1.66;
/** No two footfalls closer than this, whatever the distance says. `fp.ts` ships
 *  with the debug sprint at 42 m/s — 25 steps a second on stride alone, which
 *  is not a run, it is a buzzsaw. Three a second is already a hard run. */
const STEP_MIN = 0.30;
/** A frame that moves him further than this is a TELEPORT, not a stride: every
 *  door in this world is a `jumpTo` and `px` crosses 1000 in one frame. Without
 *  this, walking into a shop plays a footstep for a hundred metres of travel. */
const TELEPORT = 1.2;

// ── THE WALL ────────────────────────────────────────────────────────────────
//
// *"low pass when in my room pls"*.
//
// Fading the street to zero indoors is a CUT wearing a crossfade's clothes. A
// wall does not delete the city, it takes the top off it — and the reason the
// room felt sealed rather than quiet is that the first cut had no filter at
// all, only a gain. So one lowpass sits across every outdoor bed and its corner
// glides down as he steps in, while the beds themselves keep bleeding through
// at `MUFFLE` rather than going silent.
//
// 520 Hz is chosen against the MATERIAL and not off a chart. `city.wav` is 92%
// below 250 Hz, so the traffic rumble walks through the wall almost untouched —
// which is exactly what a rumble does. `city2.wav` is 65% in 250 Hz–2 kHz and
// loses most of itself, and `rain.wav` is the only file with real content above
// 2 kHz, so the patter goes soft and distant. One number, three different and
// correct outcomes, because the sources are three different things.
const WALL_IN = 520;
/** Outdoors the filter must be TRANSPARENT, not merely open. Above Nyquist for
 *  every bed here (the highest is rain at 32 kHz, so 16 kHz), which makes it
 *  arithmetically a no-op rather than a very gentle tilt nobody can hear but
 *  everybody has to reason about. */
const WALL_OUT = 20000;
/** How much of the outdoor mix still reaches him through the wall. */
const MUFFLE = 0.42;

// ── AND 301'S OWN FRONT DOOR ────────────────────────────────────────────────
//
// *"closing the door in the apt should make it a bit quieter"* — one more step
// of the same wall, and it needed no new mechanism, only the door's angle.
//
// NOTHING IS PUBLISHED FOR THIS AND NOTHING NEEDED TO BE. `apartment.ts` holds
// `doorShut` as a closure local, but it also names the leaf (`leaf301`) and
// publishes its two end poses on `scene.userData.doorTravel.leaf301` — put
// there so `scripts/swing.mjs` would stop guessing the arc. The leaf's live
// `rotation.y` between those two poses is a better fact than the boolean ever
// was: it is the ACTUAL angle, mid-swing included, so the sound follows the
// leaf through its 0.7 s travel instead of stepping when the flag flips. A
// door closing is a fade because the door is moving, not because a fade was
// applied to it.
//
// The two constants come from the same file's own exports, the way `tenancy.ts`
// already reads them.
//
/**
 * How shut a leaf is, 0…1, from its angle and its two published end poses.
 *
 * Handedness free: 301's shut pose is -pi/2 with one hand and +pi/2 with the
 * other, and a ratio of two differences does not care which.
 */
const shutFrac = (a: number, t: { shut: number; open: number }): number => {
  const span = t.shut - t.open;
  if (!span) return 0;
  return Math.max(0, Math.min(1, Math.abs(a - t.open) / Math.abs(span)));
};

/** Corner multiplier with the door shut: 520 Hz becomes 260, one octave down. */
const DOOR_HZ = 0.5;
/** Bleed multiplier with the door shut: 0.42 becomes ~0.26, about -4 dB.
 *  MODEST on purpose. A 1997 flat door is thin and you still hear the
 *  building; taking this to silence would read as broken, for exactly the
 *  reason the beds bleed through at all rather than muting indoors. */
const DOOR_BLEED = 0.62;

/** How long a crossfade takes, in seconds, as an exponential time constant.
 *  Stepping through a door is a TELEPORT — `px` jumps from ~5 to ~1000 in one
 *  frame — so this is the whole difference between the street handing over to
 *  the room and the street being cut off mid-rumble. */
const TAU = 0.55;

/** approach `cur` toward `want`, frame-rate independent */
const glide = (cur: number, want: number, dt: number, tau = TAU) =>
  cur + (want - cur) * (1 - Math.exp(-dt / tau));

/** equal-power crossfade: `a` and `b` sum to constant ENERGY, not constant
 *  amplitude, so the middle of a doorway does not sag. */
const power = (x: number) => [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)] as const;

/**
 * INDOORS.
 *
 * Every interior in this world is built out at |x| > 100 — `props.ts` skips the
 * night grade there, `interior.ts` excludes it from the sweep, `apartment.ts`
 * tests `ctx.player.x() > 100` in six places. It is the established fact and
 * this reads it rather than inventing a seventh convention.
 */
const inside = (px: number) => Math.abs(px) > 100;

/**
 * A private PRNG.
 *
 * Footsteps and birds need randomness at runtime and must take it from neither
 * of the world's two streams. `rnd()` in `ct/rng.ts` is the SEEDED one that
 * decides tree heights and pigeon placement, and pigeons keep drawing from it
 * all session as they resettle — a footstep stealing a draw would move birds.
 * `Math.random()` is what three.js's `generateUUID` uses. Eight bytes of state
 * here costs nothing and touches neither.
 */
let seed = 0x9e3779b9;
const roll = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ════════════════════════════════════════════════════════════════════════════

interface Rig {
  ac: AudioContext;
  master: GainNode;
  /** the lowpass every OUTDOOR bed runs through — see `WALL_IN` */
  wall: BiquadFilterNode;
  beds: Record<BedName, { g: GainNode; cur: number }>;
}

export function register(ctx: CtxBuild): void {
  // HMR AND THE DOUBLE WORLD. Saving this file with the dev server up tears the
  // page down and rebuilds it, but a stray `AudioContext` from a previous build
  // survives an HMR boundary that a `<canvas>` does not — and the symptom is
  // the street bed playing twice, slightly out of phase, getting worse with
  // every save. Anything left over is closed before a new one is opened.
  const W = window as unknown as { __ctAudio?: { close: () => void } };
  W.__ctAudio?.close();

  const scene = ctx.scene;

  // ── prefetch, before any gesture ──────────────────────────────────────────
  // Bytes need no permission; only PLAYING does. So the fetches go out at build
  // time and are already warm by the time he clicks, and `boot()` only has to
  // decode. `null` for anything that failed — the artifact case, below.
  const bytes = new Map<string, ArrayBuffer | null>();
  const fetching = [...BEDS, ...SHOTS].map((n) =>
    fetch(url(n))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((b) => { bytes.set(n, b); }));

  let rig: Rig | null = null;
  let live: AudioContext | null = null;
  let booted = false;
  const shots = new Map<string, AudioBuffer>();

  /**
   * Fire a one-shot: a source, a gain and a pan, built for this sound and
   * disconnected when it ends.
   *
   * An `AudioBufferSourceNode` is single-use by specification — it cannot be
   * restarted — so there is nothing to pool and nothing to reset. Building
   * three nodes per footstep sounds extravagant and is not: they are the
   * cheapest objects in the API, and the alternative (one shared chain) would
   * make two overlapping steps cut each other off, which on a staircase is
   * exactly when two overlap.
   */
  function fire(name: string, gain: number, rate: number, pan: number): void {
    if (!rig || muted) return;
    const buf = shots.get(name);
    if (!buf) return;
    const { ac } = rig;
    const s = ac.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = ac.createGain();
    g.gain.value = gain;
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(g).connect(p).connect(rig.master);
    s.onended = () => { s.disconnect(); g.disconnect(); p.disconnect(); };
    s.start();
  }

  // ── plug this world into the mixer ────────────────────────────────────────
  //
  // The state itself is at module scope and already loaded — see the note up
  // there. All `register()` does is say what a change should now DO, and then
  // do it once so a world that boots after a keypress catches up rather than
  // starting at a default nobody chose. Reassigned on every `register()`, so an
  // HMR rebuild points at the live graph and never at a dead page's closure.
  const applyMaster = () => { if (rig) rig.master.gain.value = muted ? 0 : vol * vol; };
  //                                                             ^^^^^^^ perceptual:
  // a linear slider on a linear gain spends its top half doing almost nothing.
  // With the corner widget gone this is the WHOLE of the apply step: push the
  // master gain. `commit()` is persist-then-apply, and the repaint half it used
  // to carry had exactly one subscriber — the widget. Checked: nothing else
  // called `paintWidget`, and the menu does not need telling, because it reads
  // `volume()` / `isMuted()` on every paint rather than being pushed at.
  apply = applyMaster;

  // ══ THE GESTURE ═══════════════════════════════════════════════════════════
  const AC: typeof AudioContext | undefined =
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ?? window.AudioContext;

  async function boot(): Promise<void> {
    if (booted || !AC) return;
    booted = true;
    await Promise.all(fetching);

    // EVERY bed missing means the audio directory is not reachable — the packed
    // artifact opened from `file://`, where a relative fetch is a CORS failure
    // rather than a 404. That is a known, accepted state and not an error: the
    // world plays exactly as it did before there was any sound. Saying so once
    // is worth it; throwing, or leaving a dead AudioContext open, is not.
    if ([...BEDS].every((n) => !bytes.get(n))) {
      console.info('[audio] no audio files reachable — running silent');
      return;
    }

    const ac = new AC();
    // A context constructed inside a gesture starts running; one constructed a
    // frame late does not, and the difference is invisible until it is silent.
    if (ac.state === 'suspended') void ac.resume();

    const master = ac.createGain();
    master.connect(ac.destination);

    // ── THE WALL ─────────────────────────────────────────────────────────────
    //
    // *"low pass when in my room pls"* — and it is the half of the transition
    // that was missing. Fading the street to zero indoors is a CUT dressed up as
    // a crossfade: a room does not delete the city, it takes the top off it. So
    // everything OUTDOORS runs through one lowpass whose corner glides down to
    // `WALL_IN` when he steps inside, and the outdoor beds keep bleeding through
    // at `MUFFLE` instead of going silent. The room bed does not pass through
    // it — he is standing in that one.
    const wall = ac.createBiquadFilter();
    wall.type = 'lowpass';
    wall.frequency.value = WALL_OUT;
    wall.connect(master);

    const beds = {} as Rig['beds'];
    for (const n of BEDS) {
      const raw = bytes.get(n);
      const g = ac.createGain();
      g.gain.value = 0;
      g.connect(n === 'room' ? master : wall);
      beds[n] = { g, cur: 0 };
      if (!raw) continue;
      // decodeAudioData DETACHES the ArrayBuffer it is given, so a retry would
      // be handed an empty one. It is called exactly once per buffer.
      ac.decodeAudioData(raw.slice(0)).then((buf) => {
        const s = ac.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        // Every bed runs for the whole session at whatever gain the frame hook
        // gives it. Starting and stopping them on transitions would mean each
        // one restarts from its first sample, so walking in and out of a
        // doorway would replay the same eight seconds of street forever.
        s.connect(g);
        s.start(ac.currentTime + 0.02);
      }).catch((e) => console.warn(`[audio] ${n} would not decode:`, e));
    }

    // One-shots decode into a plain table and are re-triggered from it. Unlike
    // the beds they get no node until they are actually heard.
    for (const n of SHOTS) {
      const raw = bytes.get(n);
      if (!raw) continue;
      ac.decodeAudioData(raw.slice(0))
        .then((buf) => { shots.set(n, buf); })
        .catch((e) => console.warn(`[audio] ${n} would not decode:`, e));
    }

    rig = { ac, master, wall, beds };
    live = ac;
    apply?.();   // the graph exists now: push the saved volume and mute at it
  }

  // Capture phase, so a gate that swallows the event for its own reasons cannot
  // also swallow the boot; `once` on each, and the first to fire cancels the
  // others. `isTrusted` because a synthetic event is not a gesture and would
  // burn the one chance at a running context.
  const armed: Array<[string, EventListener]> = [];
  const gesture = () => { for (const [t, f] of armed) window.removeEventListener(t, f, true); armed.length = 0; void boot(); };
  for (const t of ['pointerdown', 'keydown', 'touchstart', 'pointerlockchange']) {
    const f: EventListener = (e) => { if (e.isTrusted) gesture(); };
    armed.push([t, f]);
    window.addEventListener(t, f, true);
  }

  // ══ THE KEYS ══════════════════════════════════════════════════════════════
  //
  // *"can you get rid of this top right corner?"* — and it went. There WAS a
  // speaker glyph and eight volume blocks pinned top-right. It existed because
  // when the sound shipped there was nowhere else for mute to live, and it
  // stopped existing the moment the VCR menu grew VOLUME and MUTE rows reading
  // these same exports on every paint. A second readout of state the menu
  // already shows, painted over the world permanently, in a day he has spent
  // taking exactly that kind of thing off the screen.
  //
  // What remains is the keys, and they are registered in the BUBBLE phase on
  // purpose. `ct/hud.ts` swallows keydown in CAPTURE while a panel is open,
  // which makes these automatically inert at a slot machine, where `m` is
  // already MAX BET — the conflict is resolved by the gate that already exists
  // rather than by a second guess at what is open.
  //
  // NOTE, and it is the one thing lost with the widget: `[` and `]` now change
  // the volume with NO on-screen feedback unless the menu is open. You hear it,
  // which for a volume control is most of the answer, but a tap at the bottom
  // of the range is silent in both senses. Not replacing it with a flash
  // unasked — flagged rather than invented.
  W.__ctAudio = { close: () => { rig = null; void live?.close(); } };

  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    // THE KEYS CALL THE EXPORTS. Not a parallel implementation that happens to
    // agree — the same three functions the options menu calls, so "the keys and
    // the menu can never disagree" is a property of there being one code path
    // and not of two of them being written carefully.
    const k = e.key.toLowerCase();
    if (k === 'm') toggleMute();
    else if (k === '[') setVolume(Math.round(volume() / STEP - 1) * STEP);
    else if (k === ']') setVolume(Math.round(volume() / STEP + 1) * STEP);
  });

  // ══ AMBIENCE ══════════════════════════════════════════════════════════════
  //
  // THE BUILDING SITE. There is no construction site in this world — no
  // scaffold, no hoarding, no `ctx.site('construction')` on D's roster, which
  // holds only `park`, `lot` and `jail`. So the sound is what a real block
  // gives you: works you can hear and cannot see, anchored BEHIND the car lot
  // and audible as you walk that end of the street. It knocks off at six,
  // because a jackhammer at three in the morning is a bug report.
  const lot = ctx.site('lot');
  const siteAt = lot
    ? { x: (lot.minX + lot.maxX) / 2 + (lot.minX > 0 ? 16 : -16), z: (lot.minZ + lot.maxZ) / 2 }
    : { x: 18, z: -62 };
  const SITE_RANGE = 38;

  // The construction bed is a POINT in the world, so it gets a stereo image
  // that turns with him. This is the only thing in here that needs
  // `ctx.player.yaw()`, and it is the reason a bed can be a place rather than a
  // wash: walk past it and it crosses from one ear to the other.
  let sitePan: StereoPannerNode | null = null;

  /** where a world point sits across the stereo field, -1 left … +1 right */
  const bearing = (x: number, z: number, px: number, pz: number) => {
    const dx = x - px, dz = z - pz;
    const d = Math.hypot(dx, dz) || 1;
    const yaw = ctx.player.yaw();
    // the rig's convention: look is (sin yaw, -cos yaw), so right is (cos yaw, sin yaw)
    return Math.max(-1, Math.min(1, (Math.cos(yaw) * dx + Math.sin(yaw) * dz) / d));
  };

  let ins = 0;            // 0 out on the street … 1 indoors
  let wallHz = WALL_OUT;  // the lowpass corner, glided in LOG frequency
  let shutK = 0;          // 0 301's door is open (or he is not in 301) … 1 shut

  // ══ WATCHING THINGS THAT MOVE ═════════════════════════════════════════════
  //
  // The second delivery is mostly sounds for things the player DOES — a light
  // switch, a drawer, a door — and none of those publish an event. The obvious
  // move is to ask three owners for three callbacks; the cheaper one is to
  // notice that all three ALREADY move a named object, and that a thing which
  // moves can be watched without its owner knowing or caring:
  //
  //   switch-301-rocker        position.y tips +/-0.012 (apartment.ts:6571)
  //   dresser-drawer-lining    rides `drawerG`, which slides in z (…:4058)
  //   leaf301 / leaf302        rotation.y, with both end poses published on
  //                            scene.userData.doorTravel (…:1640, 1728)
  //
  // So this module subscribes to the WORLD rather than to its authors: zero
  // lines in anyone else's file, nothing to keep in step, and a door that
  // starts publishing travel tomorrow gets a sound with no code at all. What it
  // costs is that a state change is detected one frame late, which for a latch
  // is inaudible.
  //
  // The alternative was three publications in `apartment.ts`, which another
  // agent is editing. This needed none.

  /** Fire a one-shot AT A PLACE — distance falloff and a stereo image that
   *  turns with him, the same arithmetic the pigeons use. */
  const atPoint = (name: string, wx: number, wz: number, gain: number, range: number, rate = 1) => {
    const d = Math.hypot(wx - px, wz - pz);
    const near = Math.max(0, 1 - d / range) ** 1.5;
    if (near < 0.03) return;
    fire(name, gain * near, rate, bearing(wx, wz, px, pz) * 0.7);
  };

  const WP = { x: 0, y: 0, z: 0 };
  /** world position of an object, into the scratch above */
  const worldOf = (o: THREE.Object3D) => { o.updateWorldMatrix(true, false); const m = o.matrixWorld.elements; WP.x = m[12]; WP.y = m[13]; WP.z = m[14]; };

  // ── the light switch in 301 ───────────────────────────────────────────────
  // The rocker TIPS: `swRock.position.y = SW_Y + (on ? 0.012 : -0.012)`. Which
  // way it moved is which way the light went, so the direction of the change is
  // the whole read — no need to know SW_Y, and nothing to get out of step with
  // the light's actual state.
  let rocker: THREE.Object3D | null = null, rockY = NaN;
  // ── the dresser drawer ────────────────────────────────────────────────────
  // The lining is a child of the group that slides, so its WORLD z moves even
  // though the lining itself never does.
  let lining: THREE.Object3D | null = null, linZ = NaN;
  // ── every door that publishes its travel ──────────────────────────────────
  // Keyed off `doorTravel` itself rather than a list of names, so this covers
  // 301 and 302 today and anything that publishes tomorrow for free.
  const leaves = new Map<string, { o: THREE.Object3D; shut: number; open: number; prev: number }>();
  let leavesFound = false;

  // ── the till ──────────────────────────────────────────────────────────────
  //
  // ONE WATCHER COVERS EVERY SHOP. `ctx.purse` is on `CtxBuild`, so money
  // leaving his pocket is visible here without knowing a single shop exists —
  // and `ct/shop.ts`, the pawnbroker, the ATM, rent and the six new shopfronts
  // all go through it. A register that had to be wired per counter would have
  // been six edits and would have missed the seventh.
  //
  // GATED ON THE PANEL, because money also moves at a slot machine and on every
  // blackjack hand, and a ka-ching per spin is the difference between charming
  // and unbearable. `hud.ts` names the live panel, so the machines can be named
  // and excluded rather than guessed at by amount.
  const MACHINES = new Set(['ct-slots', 'ct-blackjack', 'ct-atm']);
  let lastCash = ctx.purse.cash;
  let tillAt = -99;

  // ── the mailbox ───────────────────────────────────────────────────────────
  // `tenancy.ts` raises and lowers a named sheet (`tenancy-letter-sheet`) as
  // the letter view opens and closes. There is no animated brass door in this
  // world — checked — so the sheet is the honest signal, and it means "a letter
  // came up", which is what the sound is for.
  let sheet: THREE.Object3D | null = null, sheetUp = false;

  // ── sleeping ──────────────────────────────────────────────────────────────
  // `ctx.clock` is on the context and the bed advances it with `overSeconds: 0`,
  // so a sleep is a jump no frame time can explain. Everything else moves the
  // clock smoothly.
  let lastMin = ctx.clock.now().totalMin;

  const watchScene = (t: number) => {
    // the till
    const cash = ctx.purse.cash;
    if (cash < lastCash - 0.001 && t - tillAt > 0.9 && !MACHINES.has(panelUp() ?? '')) {
      tillAt = t;
      fire(roll() < 0.5 ? 'register-1' : 'register-2', LVL.register * (0.9 + roll() * 0.2), 1, (roll() - 0.5) * 0.2);
    }
    lastCash = cash;

    // the mailbox
    if (!sheet) sheet = scene.getObjectByName('tenancy-letter-sheet') ?? null;
    if (sheet && sheet.visible !== sheetUp) {
      sheetUp = sheet.visible;
      worldOf(sheet);
      atPoint(sheetUp ? 'mail-open' : 'mail-close', WP.x, WP.z, LVL.mail, 10);
    }

    // sleeping. Anything above a couple of game-minutes in one frame is a cut,
    // not the clock running: at the world's own rate a frame is a fraction of a
    // minute, and `advance` lands the whole night inside one.
    const now = ctx.clock.now().totalMin;
    if (now - lastMin > 5) fire('sleep', LVL.sleep, 1, 0);
    lastMin = now;

    if (!rocker) { rocker = scene.getObjectByName('switch-301-rocker') ?? null; if (rocker) rockY = rocker.position.y; }
    else {
      const y = rocker.position.y;
      if (!Number.isNaN(rockY) && Math.abs(y - rockY) > 0.004) {
        worldOf(rocker);
        atPoint(y > rockY ? 'light-on' : 'light-off', WP.x, WP.z, LVL.light, 14);
      }
      rockY = y;
    }

    if (!lining) { lining = scene.getObjectByName('dresser-drawer-lining') ?? null; if (lining) { worldOf(lining); linZ = WP.z; } }
    else {
      worldOf(lining);
      const z = WP.z;
      // The slide is a SNAP between two poses, not an animation, so any real
      // movement is the whole travel. 0.02 m is far more than float noise and
      // far less than the drawer's own throw.
      if (!Number.isNaN(linZ) && Math.abs(z - linZ) > 0.02) {
        // One recording, both directions: a drawer sounds much the same going
        // in, and pitching the shut a little lower is enough to tell them apart
        // without a second file that does not exist.
        atPoint('drawer-open', WP.x, z, LVL.drawer, 12, z > linZ ? 1.0 : 0.92);
      }
      linZ = z;
    }

    if (!leavesFound) {
      const tr = scene.userData.doorTravel as Record<string, { shut: number; open: number }> | undefined;
      if (tr) {
        for (const [n, v] of Object.entries(tr)) {
          const o = scene.getObjectByName(n);
          if (o) leaves.set(n, { o, shut: v.shut, open: v.open, prev: shutFrac(o.rotation.y, v) });
        }
        if (leaves.size) leavesFound = true;
      }
    }
    for (const L of leaves.values()) {
      const s = shutFrac(L.o.rotation.y, L);
      // OPEN fires as the leaf LEAVES the shut pose; CLOSE fires as it ARRIVES.
      // That is where each sound actually lives — a door's noise on the way out
      // is the latch releasing, and on the way back it is the latch catching,
      // 0.7 s later at the far end of the swing. Firing both at the start would
      // put the catch before the door got there.
      if (L.prev > 0.985 && s <= 0.985) { worldOf(L.o); atPoint('door-open', WP.x, WP.z, LVL.door, 20); }
      else if (L.prev < 0.985 && s >= 0.985) { worldOf(L.o); atPoint('door-close', WP.x, WP.z, LVL.door, 20); }
      L.prev = s;
    }
    void t;
  };

  // ── 301's front door, read straight off the scene ─────────────────────────
  //
  // Looked up lazily and cached: `ct/apartment.ts` builds in the INTERIOR band
  // (BUILD.INTERIOR), which is after this module's PROPS band, so at register
  // time the leaf does not exist yet. Re-looked-up until it does, then never
  // again.
  let leaf: THREE.Object3D | null = null;
  let travel: { shut: number; open: number } | null = null;

  /**
   * How shut 301's door is, 0…1, and 0 whenever he is not standing in 301.
   *
   * ONLY THIS DOOR AND ONLY FROM INSIDE. The building's front door, 302's, and
   * the basement gate are all different leaves and none of them is named
   * `leaf301`. The room test is `apartment.ts`'s own: 301's doorway is cut in
   * the hall's WEST wall at `AX(0)` — i.e. `APT_X0` — so the flat is west of it
   * and the hall runs east from it, and the floor is pinned to storey 2. Stand
   * in the hall with the door shut and this is 0, which is the point: the hall
   * should sound like the hall.
   */
  const doorShutness = (px: number, gy: number): number => {
    if (!leaf) {
      leaf = scene.getObjectByName('leaf301') ?? null;
      travel = (scene.userData.doorTravel as Record<string, { shut: number; open: number }> | undefined)?.leaf301 ?? null;
    }
    if (!leaf || !travel) return 0;
    if (px >= APT_X0 || Math.abs(gy - 2 * ST0) > 0.5) return 0;   // hall, or another floor
    return shutFrac(leaf.rotation.y, travel);
  };
  let sway = 0;           // the second street layer, breathing
  let lastRain = 0;       // the last rain level seen OUTDOORS — see below

  // ══ FOOTSTEPS ═════════════════════════════════════════════════════════════
  //
  // Cadence comes from DISTANCE TRAVELLED, not from a timer and not from a
  // speed the rig would have to publish — see `STRIDE`. Which means the two
  // hard cases need no special handling at all:
  //
  //  · STANDING STILL is silent because he covers no ground.
  //  · SEATED, or reading, or in the mirror is silent for the same reason —
  //    `hud.ts` gates the input and the body does not move. Nothing here has to
  //    know that a drawer is open, which is the point: this module cannot see
  //    `hud.ts`, `bag.ts` or `mirror.ts` and does not need to.
  //
  // THE ONE THING IT COULD NOT SEE was whether he is in the AIR — *"make it so
  // no foot steps when im in air (jumping, etc.) please"*. `Frame` carries
  // `gy`, the GROUND height under him and never his own y, so a jump was
  // forward travel with nothing underneath it and laid its steps mid-flight.
  //
  // That is now `ctx.player.airborne()`: `fp.ts`'s own `airY > 0 || vy !== 0`,
  // the same flag it gates the mid-air tuck on, published as a getter and
  // reaching here through `PlayerRef`. A boolean and not a height, so nothing
  // out here invents a second opinion about what counts as off the ground. It
  // covers the rise, the apex and the fall alike, and a crouch jump reads
  // airborne because tucking your knees changes neither term.
  let lastX = NaN, lastZ = NaN;
  let wasAir = false;     // last frame's answer, so touchdown is an EDGE
  let airFrom = 0;        // when he left the ground — air time IS the fall
  let acc = 0;            // metres of stride banked since the last footfall
  let stepAt = 0;         // when the last one played, on the frame clock
  let stepPick = -1;      // which sample it was, so it is not picked twice
  let px = 0, pz = 0;     // last seen player position, for the bird callback

  /** pick a sample that is not the one before it — six or eight files stop
   *  sounding like six or eight files the moment a repeat lands */
  const pick = (n: number) => {
    let i = Math.floor(roll() * n);
    if (i === stepPick) i = (i + 1) % n;
    return (stepPick = i);
  };

  // ══ BIRDS ═════════════════════════════════════════════════════════════════
  //
  // `props.ts` owns the pigeons and publishes the takeoff — one call at the
  // moment a bird spooks, the same shape as the `rainLevel` and `addLamp`
  // publications already on `scene.userData`. This module supplies the ear; if
  // nothing supplies the call, nothing happens and neither file cares.
  let birdAt = -99;
  (scene.userData as { pigeonFlew?: (x: number, z: number) => void }).pigeonFlew = (bx, bz) => {
    // Pigeons spook in a group and this is one flurry, not five overlapping
    // copies of it — which is what a whole flock lifting off sounded like
    // before the gate. `birdfly.wav` is itself a flurry of wingbeats, so one
    // trigger already carries the flock.
    const now = performance.now() / 1000;
    if (now - birdAt < 0.45) return;
    birdAt = now;
    const d = Math.hypot(bx - px, bz - pz);
    const near = Math.max(0, 1 - d / 24) ** 1.6;
    if (near < 0.02) return;
    fire(BIRDS[Math.floor(roll() * BIRDS.length)],
      LVL.bird * near * (0.8 + roll() * 0.4),
      0.94 + roll() * 0.12,
      bearing(bx, bz, px, pz) * 0.8);
  };

  ctx.onFrame((f) => {
    if (!rig) return;
    const { ac, beds } = rig;

    // Insert the panner the first time the site bed has a graph to sit in.
    if (!sitePan) {
      sitePan = ac.createStereoPanner();
      beds.site.g.disconnect();
      beds.site.g.connect(sitePan);
      sitePan.connect(rig.wall);   // the site is outdoors: it goes through the wall
    }

    ins = glide(ins, inside(f.px) ? 1 : 0, f.dt);
    const [out, inn] = power(ins);

    // THE WALL'S CORNER, GLIDED IN LOG FREQUENCY and not in hertz. A linear
    // sweep from 20 kHz to 520 spends nine tenths of its half-second above
    // 2 kHz, where none of these beds has anything to lose, and then falls off a
    // cliff at the end — it sounds like a switch with a delay on it. Pitch is
    // logarithmic, so the interpolation has to be, and then the whole half
    // second is audibly one door closing.
    //
    // 301's door is one more step of the same wall. `shutK` is glided too, but
    // only lightly — the leaf already takes 0.7 s to swing and this FOLLOWS it,
    // so the smoothing here is for the moment he crosses the threshold and the
    // room test flips, not for the door itself.
    shutK = glide(shutK, doorShutness(f.px, f.gy), f.dt, 0.35);
    const indoorHz = WALL_IN * (1 - shutK * (1 - DOOR_HZ));
    wallHz = Math.exp(glide(Math.log(wallHz), Math.log(ins > 0.5 ? indoorHz : WALL_OUT), f.dt, 0.45));
    rig.wall.frequency.value = wallHz;

    // How much of the outside is still THERE, filtered. 1 on the street, MUFFLE
    // in a room — never 0, because a room with the city switched off is a
    // vacuum, and that is what the first cut sounded like.
    const bleed = out + inn * MUFFLE * (1 - shutK * (1 - DOOR_BLEED));

    // `props.ts` publishes the live rain on the scene and ZEROES it indoors
    // (`if (px > 100) rainLevel = 0` — it never rains in a room). That is right
    // for the drops and wrong for the sound: standing in 301 during a downpour
    // you would still hear it on the window. So the last OUTDOOR reading is
    // held, and indoors it plays at a fifth of its level.
    const now = (scene.userData.rainLevel as number | undefined) ?? 0;
    if (ins < 0.5) lastRain = now;
    const rain = out * now + inn * lastRain * LVL.rainIndoors;

    // THE STREET BREATHES. `street-a` is 30 s long and a 30 s loop announces
    // itself inside two minutes. `street-b` is a different recording of a
    // different place, 50 s long, and swinging it against `street-a` means the
    // two never line up and the street never arrives back where it started.
    // Two beds, no seam, no repeat you can hear.
    //
    // ── AND THE SIRENS ARE THE EXCEPTION, NOT THE WEATHER ─────────────────
    //
    // *"sirens are a little much i think in terms of the audio profile. maybe
    //  bank on a mix between the regular street sounds mostly with the siren
    //  sounds being used sparingly?"*   (2026-08-05)
    //
    // THE SIRENS ARE IN `street-b` — it is the "different place" recording, and
    // it was never quiet: the old curve was `0.25 + 0.75 * sway` on a plain
    // sine, so it sat at a QUARTER at its lowest and spent half of every 97 s
    // above the midpoint. That is a bed, and a siren bed is a siren every other
    // minute for ever.
    //
    // A SINE TO THE FOURTH sits near zero most of the way round and peaks
    // briefly — the same total shape, redistributed. Against the new floor it
    // is above a quarter for about 25% of the cycle and above half for 18%,
    // rather than 50% and 50%. And the cycle goes 97 s -> 149 s, so the peaks
    // are half as frequent AND still coprime with `street-a`'s 30 s loop, which
    // is the property the two-bed trick depends on.
    //
    // FLOOR 0.25 -> 0.06. The far layer never disappears — cutting it entirely
    // would leave a hole where the depth of the street is — it just stops being
    // something you notice until it comes up.
    sway = 0.5 + 0.5 * Math.sin(f.t * (Math.PI * 2 / 149));

    // The site: inverse-square-ish falloff, outdoors only, working hours only.
    const d = Math.hypot(siteAt.x - f.px, siteAt.z - f.pz);
    const near = Math.max(0, 1 - d / SITE_RANGE) ** 2;
    const shift = f.hourF > 7 && f.hourF < 18 ? 1 : 0;
    sitePan.pan.value = glide(sitePan.pan.value, bearing(siteAt.x, siteAt.z, f.px, f.pz), f.dt, 0.12);

    const want: Record<BedName, number> = {
      'street-a': bleed * LVL.streetA,
      'street-b': bleed * LVL.streetB * (0.06 + 0.94 * sway * sway * sway * sway),
      room: inn * LVL.room,
      rain: rain * LVL.rain,
      // the working day is glided like everything else, so six o'clock is a
      // shift ending rather than a switch being thrown
      site: bleed * LVL.site * near * shift,
    };
    for (const n of BEDS) {
      const b = beds[n];
      // The gain is smoothed HERE and written straight to `.value`. Web Audio
      // applies it at the next 128-sample block, which at these rates of change
      // is a ramp and not a step — and unlike `setTargetAtTime` it cannot leave
      // an automation curve running against the next frame's write.
      b.cur = glide(b.cur, want[n], f.dt, n === 'site' ? 1.2 : TAU);
      b.g.gain.value = b.cur;
    }

    // ── things in the world that moved since last frame ─────────────────────
    px = f.px; pz = f.pz;
    watchScene(f.t);

    // ── footsteps ───────────────────────────────────────────────────────────
    const moved = Number.isNaN(lastX) ? 0 : Math.hypot(f.px - lastX, f.pz - lastZ);
    lastX = f.px; lastZ = f.pz;

    const air = ctx.player.airborne();
    const indoors = inside(f.px);
    const pool = indoors ? IN_STEPS : OUT_STEPS;

    if (moved > TELEPORT) {
      // A door, a stairwell, a bed. Bank nothing and do not let the arrival
      // land a footstep — the transition already has a fade over it.
      acc = 0;
      stepAt = f.t;
    } else if (air) {
      // AIRBORNE: bank NOTHING. Not merely "do not play" — a jump covers real
      // ground, and holding the metres would pay them all out the instant he
      // landed, which is the same wrong sound arriving late.
      acc = 0;
    } else if (wasAir) {
      // TOUCHDOWN. This used to be a footstep played harder and pitched down,
      // because a footstep was all there was. `body land feet` and `body land`
      // are the real thing and they replace it.
      //
      // WHICH OF THE TWO IS CHOSEN BY HOW LONG HE WAS OFF THE GROUND, which is
      // the only severity measure available without the rig publishing a fall
      // speed — and it is a good one, because air time IS the fall. `fp.ts`
      // jumps at vy 4.0 against gravity 14, so a flat hop hangs for 4/14 up and
      // the same down: 0.57 s. Anything longer than that came off something.
      const airFor = f.t - airFrom;
      const hard = airFor > 0.72;
      acc = 0;
      stepAt = f.t;
      fire(hard ? 'land-hard' : 'land-soft',
        // Louder the further he fell, but flattening out — a 6 m drop and a
        // 12 m drop are both just "hard", and this world has no fall damage to
        // make the difference mean anything.
        LVL.land * Math.min(1.25, 0.72 + airFor * 0.55),
        0.95 + roll() * 0.1,
        (roll() - 0.5) * 0.16);
    } else {
      acc = Math.min(acc + moved, STRIDE);   // clamped, so a sprint cannot queue
      if (acc >= STRIDE && f.t - stepAt >= STEP_MIN) {
        acc = 0;
        stepAt = f.t;
        // `indoors` above is the same |x| > 100 fact the ambience crossfades
        // on, read RAW rather than through `ins`: the bed slews over half a
        // second and a footstep does not — the first step inside the door
        // should be a floorboard while the street is still fading out behind it.
        fire(pool[pick(pool.length)],
          (indoors ? LVL.stepIn : LVL.stepOut) * (0.78 + roll() * 0.44),
          // Detune per step. Eight files played flat is eight files; eight
          // files with ±7% on the rate is a walk.
          0.93 + roll() * 0.14,
          (roll() - 0.5) * 0.24);
      }
    }
    if (air && !wasAir) airFrom = f.t;
    wasAir = air;
  }, HOOK.LATE);
}

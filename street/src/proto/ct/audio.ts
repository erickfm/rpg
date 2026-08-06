import type { CtxBuild } from './ctx';
import { BUILD, ORDER as HOOK } from './ctx';

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
const SHOTS = [...OUT_STEPS, ...IN_STEPS, ...BIRDS] as const;

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
  streetA: 0.15,   // the base of the outdoor bed: close traffic rumble
  streetB: 0.13,   // the further-off layer, which breathes — see `sway`
  room: 0.13,
  rain: 0.30,      // multiplied by rainLevel, so this is its DOWNPOUR level
  rainIndoors: 0.20, // …of the above, heard through a window
  site: 0.20,      // multiplied by distance and by the working day
  // *"step sounds are too loud"*, immediately after the beds came down — and
  // holding the one-shots still through that edit is what exposed it. Down
  // ~8 dB. A footstep is your own shoe a metre and a half below your ears, not
  // an event in the world, and the encoder had already lifted `stepinside` by
  // 12 dB to bring it level with the pavement.
  stepOut: 0.22,
  stepIn: 0.20,
  bird: 0.45,      // multiplied by distance
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

  // ── the mixer's saved state ───────────────────────────────────────────────
  const PREF = 'ct.audio';
  let vol = 0.75, muted = false;
  try {
    const s = JSON.parse(localStorage.getItem(PREF) || '{}') as { v?: number; m?: boolean };
    if (typeof s.v === 'number' && s.v >= 0 && s.v <= 1) vol = s.v;
    if (typeof s.m === 'boolean') muted = s.m;
  } catch { /* a corrupt pref is not worth a broken world */ }
  const save = () => { try { localStorage.setItem(PREF, JSON.stringify({ v: vol, m: muted })); } catch { /* private mode */ } };

  const applyMaster = () => { if (rig) rig.master.gain.value = muted ? 0 : vol * vol; };
  //                                                             ^^^^^^^ perceptual:
  // a linear slider on a linear gain spends its top half doing almost nothing.

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

    const beds = {} as Rig['beds'];
    for (const n of BEDS) {
      const raw = bytes.get(n);
      const g = ac.createGain();
      g.gain.value = 0;
      g.connect(master);
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

    rig = { ac, master, beds };
    live = ac;
    applyMaster();
    paintWidget();
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

  // ══ THE MIXER, ON SCREEN ══════════════════════════════════════════════════
  //
  // *"Nothing worse than a game you cannot silence."* So there are two ways to
  // do it and they cover each other:
  //
  //  · `M`, and `[` / `]` for volume — registered in the BUBBLE phase, on
  //    purpose. `ct/hud.ts` swallows keydown in CAPTURE while a panel is open,
  //    which means these keys are automatically inert at a slot machine, where
  //    `m` is already MAX BET. The conflict is resolved by the gate that
  //    already exists rather than by a second guess at what is open.
  //  · The widget itself is clickable, which is the path that still works when
  //    a panel IS open and the pointer is free.
  //
  // Top right: `hud.ts` has the build stamp bottom-right, the watch and the
  // prompt bottom-centre, and the fps readout top-left. This corner is empty.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;right:8px;top:8px;z-index:13;'
    + 'font:11px ui-monospace,Menlo,monospace;color:#cfd6e4;letter-spacing:.5px;'
    + 'background:rgba(8,10,16,.55);border:1px solid rgba(180,200,230,.18);'
    + 'border-radius:3px;padding:3px 6px;cursor:pointer;user-select:none;'
    + 'display:flex;gap:5px;align-items:center;opacity:.28;transition:opacity .25s;';
  wrap.title = 'M mute · [ ] volume';
  const icon = document.createElement('span');
  const bar = document.createElement('span');
  bar.style.cssText = 'letter-spacing:1px;';
  wrap.append(icon, bar);
  wrap.addEventListener('pointerenter', () => { wrap.style.opacity = '1'; });
  wrap.addEventListener('pointerleave', () => { wrap.style.opacity = '.28'; });

  let peekUntil = 0;
  function paintWidget(): void {
    icon.textContent = muted || vol === 0 ? '\u{1F507}' : '\u{1F50A}';
    const n = Math.round(vol * 8);
    bar.textContent = (muted ? '·'.repeat(8) : '█'.repeat(n) + '·'.repeat(8 - n))
      + (rig ? '' : ' …');
  }
  paintWidget();
  // pointer-events stay on: this must be clickable even while a panel holds the
  // rest of the input. It is 90 px in a corner nothing else uses, and a click
  // that lands here deliberately does NOT take pointer lock.
  wrap.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    muted = !muted; save(); applyMaster(); paintWidget();
  });
  document.body.appendChild(wrap);
  // Registered NOW rather than at boot, so that a build which never got its
  // gesture still leaves nothing behind: the widget is the part that is always
  // there, and an orphaned one stacks up a corner full of speakers.
  W.__ctAudio = { close: () => { rig = null; wrap.remove(); void live?.close(); } };

  const peek =() => { peekUntil = performance.now() + 1400; wrap.style.opacity = '1'; };
  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (k === 'm') { muted = !muted; }
    else if (k === '[') { vol = Math.max(0, Math.round(vol * 8 - 1) / 8); muted = false; }
    else if (k === ']') { vol = Math.min(1, Math.round(vol * 8 + 1) / 8); muted = false; }
    else return;
    save(); applyMaster(); paintWidget(); peek();
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
  // THE ONE THING IT CANNOT SEE is whether he is in the AIR. `Frame` carries
  // `gy`, the GROUND height under him, not his own y, so a jump reads as
  // ordinary forward travel and lays down its steps mid-flight. Fixing it needs
  // one boolean off the rig — `fp.ts`'s own grounded flag — which is a trunk
  // file this module deliberately does not open.
  let lastX = NaN, lastZ = NaN;
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
      sitePan.connect(rig.master);
    }

    ins = glide(ins, inside(f.px) ? 1 : 0, f.dt);
    const [out, inn] = power(ins);

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
    // different place, 50 s long, and swinging it between a quarter and full
    // over a 97 s cycle means the two never line up and the street never
    // arrives back where it started. Two beds, no seam, no repeat you can hear.
    sway = 0.5 + 0.5 * Math.sin(f.t * (Math.PI * 2 / 97));

    // The site: inverse-square-ish falloff, outdoors only, working hours only.
    const d = Math.hypot(siteAt.x - f.px, siteAt.z - f.pz);
    const near = Math.max(0, 1 - d / SITE_RANGE) ** 2;
    const shift = f.hourF > 7 && f.hourF < 18 ? 1 : 0;
    sitePan.pan.value = glide(sitePan.pan.value, bearing(siteAt.x, siteAt.z, f.px, f.pz), f.dt, 0.12);

    const want: Record<BedName, number> = {
      'street-a': out * LVL.streetA,
      'street-b': out * LVL.streetB * (0.25 + 0.75 * sway),
      room: inn * LVL.room,
      rain: rain * LVL.rain,
      // the working day is glided like everything else, so six o'clock is a
      // shift ending rather than a switch being thrown
      site: out * LVL.site * near * shift,
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

    // ── footsteps ───────────────────────────────────────────────────────────
    px = f.px; pz = f.pz;
    const moved = Number.isNaN(lastX) ? 0 : Math.hypot(f.px - lastX, f.pz - lastZ);
    lastX = f.px; lastZ = f.pz;

    if (moved > TELEPORT) {
      // A door, a stairwell, a bed. Bank nothing and do not let the arrival
      // land a footstep — the transition already has a fade over it.
      acc = 0;
      stepAt = f.t;
    } else {
      acc = Math.min(acc + moved, STRIDE);   // clamped, so a sprint cannot queue
      if (acc >= STRIDE && f.t - stepAt >= STEP_MIN) {
        acc = 0;
        stepAt = f.t;
        // Indoors is the same |x| > 100 fact the ambience crossfades on, read
        // RAW here rather than through `ins`: the bed slews over half a second
        // and a footstep does not — the first step inside the door should be a
        // floorboard even while the street is still fading out behind it.
        const indoors = inside(f.px);
        const pool = indoors ? IN_STEPS : OUT_STEPS;
        fire(pool[pick(pool.length)],
          (indoors ? LVL.stepIn : LVL.stepOut) * (0.78 + roll() * 0.44),
          // Detune per step. Eight files played flat is eight files; eight
          // files with ±7% on the rate is a walk.
          0.93 + roll() * 0.14,
          (roll() - 0.5) * 0.24);
      }
    }

    if (peekUntil && performance.now() > peekUntil) { peekUntil = 0; wrap.style.opacity = '.28'; }
  }, HOOK.LATE);
}

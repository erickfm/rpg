import * as THREE from 'three';
import { SHA, DIRTY, AT } from 'virtual:build-stamp';
import { bindHud, closePockets, POCKETS, refreshPockets, slots } from './inventory';

// ── the sky the clock drags around, the watch, and the wallet ─────────────
//
// Everything the player sees that is NOT in the scene graph: the day/night
// colour curves, the fullscreen night wash, the wrist-and-watch close-up, the
// bifold wallet, and the [E] prompt. All DOM + 2D canvas.
//
// The HUD draws FROM game state but owns none of it — the sim loop in
// crosstown.ts keeps the clock, and the purse is handed in. The only state
// here is presentational: is the wallet out, which minute is on the LCD.

/** The player's pockets — the wallet is a view onto this, nothing more. */
export interface Purse { cash: number; inv: Record<string, number> }

export interface Hud {
  /** sky colour at hour h. A SHARED colour, rewritten in place every call. */
  skyAt: (h: number) => THREE.Color;
  /** how dark the night wash sits at hour h (0 by day … 0.34 deep night) */
  nightAt: (h: number) => number;
  /** drive the night wash */
  setNight: (v: number) => void;
  /** look down → the watch slides up. Only repaints when the minute turns. */
  watch: (want: boolean, mins: number) => void;
  /** right-click: flip the wallet out / away */
  toggleWallet: () => void;
  /** put the wallet away. `ct/inventory.ts` calls this when the POCKETS open:
   *  both are held objects centred at the bottom of the frame, so two out at
   *  once would be one drawn over the other. One thing in your hands at a time. */
  closeWallet: () => void;
  /** repaint the wallet if it happens to be open (after a buy, after feeding) */
  refreshWallet: () => void;
  /** the [E] hint under the crosshair; null hides it */
  prompt: (text: string | null) => void;
  /**
   * A line that says what just HAPPENED, and then goes away.
   *
   * Distinct from `prompt`, which says what you COULD do and is rewritten every
   * frame from whatever you are looking at — a result posted into it would be
   * gone on the next frame. Pocketing something, dropping it, and being refused
   * because your pockets are full all need to survive looking away.
   *
   * It sits above the prompt so the two never fight for the same line, and it
   * fades rather than cutting, because at the bottom of the screen a hard
   * disappearance reads as a glitch.
   */
  note: (text: string, ms?: number) => void;
  /**
   * FADE THE SCREEN TO BLACK, do something, and fade back.
   *
   * *"when the player goes to sleep i want the screen to fade to black"* — and
   * it is deliberately NOT a sleep verb. It is a screen fade with a callback in
   * the middle, because passing out, a cut to somewhere else and the bus all
   * want exactly this, and `ct/apartment.ts` owns the sleeping.
   *
   *     await ctx.hud.fade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) });
   *
   * `mid` runs WHILE THE SCREEN IS BLACK, never before the fade starts. That
   * ordering is the whole thing: advance the clock first and the fade-in shows
   * a room that has already changed, which reads as a loading screen rather
   * than as sleeping. And black is HELD for a beat between the two halves — a
   * fade straight from black back to bright is a blink, not a night.
   *
   * Nothing moves or interacts while it runs. Keys already HELD when it starts
   * are released as well as blocked, so walking into your own bed does not walk
   * you across the room in the dark.
   *
   * Resolves when the screen is back. A second call while one is running is
   * ignored and returns the one in flight — two overlapping fades would fight
   * over the same opacity.
   */
  fade: (o?: { mid?: () => void; outMs?: number; holdMs?: number; inMs?: number }) => Promise<void>;
  /** is a fade running right now? For anything that must not act mid-cut. */
  fading: () => boolean;
  /**
   * Outline whatever the `[E]` would act on, in screen space.
   *
   * *"i want to be able to interact with things a lot easier and for them to
   * have a little outline highlighted for the selection of it."*
   *
   * Takes a screen-space rectangle in CSS pixels, or null to clear. The caller
   * projects, because the camera is not the HUD's business — but the DRAWING is,
   * which is why this lives here and not in the world: an outline that is part
   * of the scene has to fight depth, night grading and the fog, and this world
   * is unlit MeshBasicMaterial where a world-space outline would either be
   * occluded by the thing it is outlining or float in front of everything.
   *
   * Deliberately a thin hard-edged box and not a glow: 8–32 px/m, no lighting,
   * no bloom anywhere in the world. Two nested 1 px strokes — dark outside,
   * pale inside — so it reads against both the brick and the sky, which is the
   * same trick the citizens' rim light uses.
   */
  highlight: (rect: { x: number; y: number; w: number; h: number } | null) => void;
}

/**
 * The live HUD, for the one thing a world module legitimately needs from the
 * screen layer: `screenFade`.
 *
 * `ct/ctx.ts` is DESK-OWNED and does not carry the HUD, and asking for a field
 * on it would block a user request on a coordination step. So the screen
 * publishes its own verb the same way `ct/inventory.ts` publishes `takeable` —
 * the kit does the work, the caller states intent, and nobody edits anybody
 * else's file:
 *
 *     import { screenFade } from './hud';
 *     act: () => screenFade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) }),
 */
let LIVE: Hud | null = null;
export function screenFade(o?: { mid?: () => void; outMs?: number; holdMs?: number; inMs?: number }): Promise<void> {
  // No HUD means no screen to fade, and the caller's `mid` must still happen —
  // a sleep that silently did not pass the night because a screen effect was
  // missing would be the effect breaking the gameplay it was added to dress.
  if (!LIVE) { o?.mid?.(); return Promise.resolve(); }
  return LIVE.fade(o);
}
/** is the screen mid-cut? Anything that must not fire during one asks here. */
export function screenFading(): boolean { return LIVE ? LIVE.fading() : false; }

export function makeHud(purse: Purse): Hud {
  let watchShown = -1;
  let walletOpen = false;
  const SKY_STOPS: [number, string][] = [
    [0, '#0d1018'], [5, '#0d1018'], [6.5, '#4a5464'], [8, '#7d8894'], [10, '#8a97a2'],
    [16.5, '#8a97a2'], [18.5, '#8f7f74'], [20, '#3a3f52'], [21.5, '#0d1018'], [24, '#0d1018'],
  ];
  // Night wash. Peak was 0.34, which read as a dim evening rather than night;
  // 0.58 lets the sodium streetlamps actually be the light source they were
  // built to be. Dusk ramps harder too, so the turn feels like nightfall.
  const NIGHT_STOPS: [number, number][] = [
    [0, 0.58], [5, 0.58], [7, 0.18], [8.5, 0], [17.5, 0], [19, 0.20], [20, 0.40], [21.5, 0.58], [24, 0.58],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color(), skyNow = new THREE.Color();
  const skyAt = (h: number): THREE.Color => {
    let i = 0;
    while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1][0] < h) i++;
    const [h0, s0] = SKY_STOPS[i], [h1, s1] = SKY_STOPS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    return skyNow.copy(cA.set(s0)).lerp(cB.set(s1), t);
  };
  const nightAt = (h: number): number => {
    let i = 0;
    while (i < NIGHT_STOPS.length - 2 && NIGHT_STOPS[i + 1][0] < h) i++;
    const [h0, v0] = NIGHT_STOPS[i], [h1, v1] = NIGHT_STOPS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    return v0 + (v1 - v0) * t;
  };
  let nightDiv = document.getElementById('ct-night') as HTMLDivElement | null;
  if (!nightDiv) {
    nightDiv = document.createElement('div');
    nightDiv.id = 'ct-night';
    nightDiv.style.cssText = 'position:fixed;inset:0;background:#0a1024;opacity:0;pointer-events:none;z-index:5;transition:opacity .5s linear;';
    document.body.appendChild(nightDiv);
  }
  // the player's own clothing — one place to swap later (a real wardrobe).
  // `sleeve` is the forearm covering (a sweater here); a tee would just leave
  // the forearm as `skin`. The first-person hands (watch + wallet) read from it.
  const player = { skin: '#c9946a', skinHi: '#d8a67d', skinLo: '#a87a54', sleeve: '#3f4a5c', cuff: '#333c4a' };
  /** canvas width. 176 rather than 120 since the fist arrived: the wrist ends at
   *  x 104 and the hand needs 72 px beyond it. Height is unchanged — the arm is
   *  cut by the bottom of the frame, which is what makes it read as YOUR arm. */
  const WATCH_W = 176;
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    // WIDER CANVAS, SAME WATCH POSITION. The canvas grew 120 -> 176 to make room
    // for the hand; the element is centred with translateX(-50%), so growing it
    // to the right would have slid the watch 77 px to the LEFT. `left` moves the
    // same 77 px the other way to cancel it exactly, so the watch face lands
    // where it has always landed and only the hand is new.
    watchWrap.style.cssText = 'position:fixed;left:calc(52% + 77px);bottom:-14px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(140%) rotate(-6deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = WATCH_W; watchCv.height = 72;
    watchCv.style.cssText = 'width:484px;height:198px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = WATCH_W; watchCv.height = 72;
  }
  // the wrist-and-watch close-up (the good one — arm version was reverted)
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    g.clearRect(0, 0, WATCH_W, 72);
    // STEP 1 of an incremental rebuild (an all-at-once redraw was rejected).
    // Only change so far: the forearm runs OFF THE LEFT EDGE instead of
    // floating with a gap either side. A limb cut by the frame reads as your
    // own arm; a band with air around it reads as a disembodied cuff.
    g.fillStyle = '#c9946a'; g.fillRect(0, 6, 104, 66);          // wrist, cut by the frame
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 6, 10, 66);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(94, 6, 10, 66);
    // ── THE FIST ──────────────────────────────────────────────────────────
    //
    // *"it actually should be really minimal considering it would be the top of
    // the fist. no fingers would actually show so i kinda expect a square larger
    // in width than the wrist attached to the right side of the wrist."*
    //
    // ONE BOX, and that is the whole design. He worked out the anatomy himself
    // and he is right: from this camera you are looking down at the BACK of a
    // closed fist, the fingers are curled underneath and out of sight, and the
    // back of a fist really is just a slab. Minimal is the CORRECT answer here,
    // not a cheap one — no fingers, no knuckles, no taper, no thumb.
    //
    // 72 px against the wrist's 66, so it is "larger in width than the wrist"
    // as asked, with the extra reading as the swell of the hand above the wrist.
    // Cut by the bottom of the frame like the wrist, for the same reason.
    //
    // Drawn BEFORE the strap and the case so it can never overlap them; it butts
    // at x 104 where the wrist ends, and the strap lives at 38…82.
    g.fillStyle = '#c9946a'; g.fillRect(104, 0, 72, 72);
    // …and the same two-tone shading the wrist carries, light coming from the
    // right, so it reads as one limb and not as a glove: the identical rgba
    // values, not a matched-by-eye pair.
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(166, 0, 10, 72);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(104, 0, 4, 72);   // the wrist's shadow on it
    g.fillStyle = '#26282e'; g.fillRect(38, 0, 44, 72);          // strap
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(38, 0, 4, 72);
    g.fillStyle = '#3a3d45'; g.fillRect(32, 14, 56, 42);         // case
    g.fillStyle = '#14161a'; g.fillRect(35, 17, 50, 36);
    g.fillStyle = '#9cab8b'; g.fillRect(38, 21, 44, 23);         // LCD
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m2 = String(mins % 60).padStart(2, '0');
    g.fillStyle = '#1c2a1c'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillText(`${hh}:${m2}`, 60, 38);
    g.fillStyle = '#8a8d95'; g.font = '5px monospace';
    g.fillText('CROSSTOWN QUARTZ', 60, 50);
  };
  const WALLET_W = 180, WALLET_H = 140;
  let walletWrap = document.getElementById('ct-wallet') as HTMLDivElement | null;
  let walletCv: HTMLCanvasElement;
  if (!walletWrap) {
    walletWrap = document.createElement('div');
    walletWrap.id = 'ct-wallet';
    walletWrap.style.cssText = 'position:fixed;left:50%;bottom:-8px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(150%) rotate(2deg);transition:transform .18s ease-out;';
    walletCv = document.createElement('canvas');
    walletCv.width = WALLET_W; walletCv.height = WALLET_H;
    walletCv.style.cssText = 'width:340px;height:264px;image-rendering:pixelated;display:block;';
    walletWrap.appendChild(walletCv);
    document.body.appendChild(walletWrap);
  } else {
    walletCv = walletWrap.firstChild as HTMLCanvasElement;
    walletCv.width = WALLET_W; walletCv.height = WALLET_H;
  }
  // first-person: an open bifold held in front of you in both hands — not a
  // corner menu. Thumbs grip the near edge; left leaf is your ID + pockets,
  // right leaf the cash. Slides up into view like the watch.
  const drawWallet = () => {
    const g = walletCv.getContext('2d')!;
    g.clearRect(0, 0, WALLET_W, WALLET_H);
    const { skin, skinHi, skinLo } = player;
    const wx = 20, wy = 16, ww = 140, wh = 104;
    g.fillStyle = '#2e2116'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);  // edge shadow
    g.fillStyle = '#4a3626'; g.fillRect(wx, wy, ww, wh);                  // leather
    g.fillStyle = '#5a4230'; g.fillRect(wx, wy, ww, 4);                   // top sheen
    g.fillStyle = '#2e2116'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);      // centre fold
    g.strokeStyle = 'rgba(222,210,180,0.22)'; g.setLineDash([3, 3]);
    g.strokeRect(wx + 4.5, wy + 4.5, ww - 9, wh - 9); g.setLineDash([]);
    // right leaf — bills + cash total
    const rx = wx + ww / 2 + 8;
    g.fillStyle = '#587a4a'; g.fillRect(rx + 2, wy + 8, 52, 8);
    g.fillStyle = '#6a8a5a'; g.fillRect(rx, wy + 12, 56, 34);
    g.fillStyle = '#7a9a68'; g.fillRect(rx, wy + 12, 56, 3);
    g.fillStyle = '#24301c'; g.font = 'bold 13px monospace'; g.textAlign = 'center';
    g.fillText(`$${purse.cash.toFixed(2)}`, rx + 28, wy + 34);
    // left leaf — ID card over your pockets (item list)
    const lx = wx + 9;
    g.fillStyle = '#c9b48a'; g.fillRect(lx, wy + 8, 54, 20);
    g.fillStyle = '#8a7a58'; g.fillRect(lx + 2, wy + 10, 18, 16);
    g.fillStyle = '#6a5a3c'; g.fillRect(lx + 23, wy + 12, 28, 2); g.fillRect(lx + 23, wy + 16, 24, 2); g.fillRect(lx + 23, wy + 20, 20, 2);
    // How full you are, ABOVE the list rather than under it. The pockets have
    // been finite since `ct/inventory.ts` landed, and a limit the player only
    // meets by being refused is a limit that reads as a bug — so it goes on the
    // face of the thing whose whole job is to list them. Above, because the list
    // grows downward and the bottom of the wallet is where the world's own
    // caption bar sits: a line under six items would be printed behind it.
    g.textAlign = 'left';
    g.fillStyle = '#9a927e'; g.font = '6px monospace';
    g.fillText(`${slots(purse).length}/${POCKETS} pockets`, lx, wy + 36);
    g.fillStyle = '#e8e2d0'; g.font = '7px monospace';
    let iy = wy + 47;
    for (const [k, n] of Object.entries(purse.inv)) { if (n > 0) { g.fillText(`${k} x${n}`, lx, iy); iy += 10; } }
    if (iy === wy + 47) { g.fillStyle = '#9a927e'; g.fillText('(empty pockets)', lx, iy); }
    // thumbs gripping the near corners
    const thumb = (tx: number) => {
      g.fillStyle = skin; g.fillRect(tx, wy + wh - 22, 26, 34);
      g.fillStyle = skinHi; g.fillRect(tx, wy + wh - 22, 26, 3);
      g.fillStyle = skinLo; g.fillRect(tx, wy + wh + 8, 26, 4);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(tx + 7, wy + wh - 14, 12, 14); // nail
    };
    thumb(wx - 8); thumb(wx + ww - 18);
  };
  let promptDiv = document.getElementById('ct-prompt') as HTMLDivElement | null;
  if (!promptDiv) {
    promptDiv = document.createElement('div');
    promptDiv.id = 'ct-prompt';
    promptDiv.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:10;'
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.5);'
      + 'padding:5px 12px;border-radius:5px;pointer-events:none;display:none;letter-spacing:.4px;';
    document.body.appendChild(promptDiv);
  }
  // the transient line — what just happened, above the [E] prompt
  let noteDiv = document.getElementById('ct-note') as HTMLDivElement | null;
  if (!noteDiv) {
    noteDiv = document.createElement('div');
    noteDiv.id = 'ct-note';
    noteDiv.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:10;'
      + 'font:13px/1.4 ui-monospace,Menlo,monospace;color:#e8e2d0;text-shadow:0 1px 3px rgba(0,0,0,.95);'
      + 'pointer-events:none;opacity:0;transition:opacity .35s linear;letter-spacing:.3px;'
      + 'max-width:70vw;text-align:center;';
    document.body.appendChild(noteDiv);
  }
  let noteTimer = 0;

  // ── the selection outline ───────────────────────────────────────────────
  //
  // One absolutely-positioned div with two borders rather than a canvas: a rect
  // is all this ever draws, the browser antialiases nothing on a 1 px border, and
  // it costs no per-frame paint — only a transform when the selection moves.
  let hiDiv = document.getElementById('ct-hi') as HTMLDivElement | null;
  if (!hiDiv) {
    hiDiv = document.createElement('div');
    hiDiv.id = 'ct-hi';
    // dark 1 px outside, pale 1 px inside — legible against brick AND sky, the
    // same two-tone trick the citizen sprites use for their rim light.
    hiDiv.style.cssText = 'position:fixed;z-index:9;pointer-events:none;display:none;'
      + 'border:1px solid rgba(255,255,255,.85);outline:1px solid rgba(0,0,0,.55);'
      + 'outline-offset:0;box-sizing:border-box;';
    document.body.appendChild(hiDiv);
  }

  // ── the fade ────────────────────────────────────────────────────────────
  //
  // Above EVERYTHING, including the HUD: z-index 20 against the night wash's 5,
  // the held objects' 11 and the build stamp's 12. You are asleep — a watch
  // floating over the black would say otherwise, and a screenshot taken mid-cut
  // should show nothing, which is also the honest thing for a screenshot to do.
  //
  // `pointer-events: none` so it cannot steal pointer lock on the way past.
  let fadeDiv = document.getElementById('ct-fade') as HTMLDivElement | null;
  if (!fadeDiv) {
    fadeDiv = document.createElement('div');
    fadeDiv.id = 'ct-fade';
    fadeDiv.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:20;';
    document.body.appendChild(fadeDiv);
  }
  let fading: Promise<void> | null = null;

  // ── holding the player still while it runs ──────────────────────────────
  //
  // `src/main.ts` owns the input Set and `src/proto/fp.ts` owns the rig, and
  // BOTH ARE DESK-OWNED. So this does not reach into either: it takes the
  // events before they get there.
  //
  //   · a CAPTURE listener on `window` runs before main.ts's own listeners,
  //     which are on `window` (keydown/keyup/mouseup) and `document`
  //     (mousemove) in the bubble phase. `stopImmediatePropagation()` there and
  //     the key never reaches the Set.
  //   · KEYUP AND MOUSEUP ARE DELIBERATELY LEFT ALONE. Swallowing a release
  //     while blocking the press is how you strand a key in the Set held-down
  //     forever — the player would wake up walking.
  //   · and a press already held when the fade starts is in the Set ALREADY, so
  //     blocking new ones does nothing for it. Those get a synthetic keyup,
  //     which is main.ts's own documented way of clearing one.
  const HELD = ['w', 'a', 's', 'd', 'c', 'e', 'shift', ' ',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const swallow = (e: Event) => { e.stopImmediatePropagation(); e.preventDefault(); };
  const lockInput = (): (() => void) => {
    for (const k of HELD) window.dispatchEvent(new KeyboardEvent('keyup', { key: k === ' ' ? ' ' : k }));
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));   // and the wallet's right button
    const kinds = ['keydown', 'mousedown', 'mousemove', 'wheel'];
    for (const k of kinds) window.addEventListener(k, swallow, true);
    return () => { for (const k of kinds) window.removeEventListener(k, swallow, true); };
  };

  // ── the build stamp ─────────────────────────────────────────────────────
  // Twice this project has lost work to feedback given against a stale build:
  // a bug is reported, it was fixed twenty minutes earlier, and somebody goes
  // hunting for it. This makes a screenshot self-dating — whoever reads it can
  // `git show` exactly what was on screen. A trailing `+` means the tree had
  // uncommitted edits when the bundle was served, so the sha alone will not
  // reproduce it.
  //
  // Set once and never touched again: it must survive a screenshot, so it does
  // not fade, move, or hide. Dim enough to ignore while playing, legible when
  // you go looking for it.
  let stampDiv = document.getElementById('ct-stamp') as HTMLDivElement | null;
  if (!stampDiv) {
    stampDiv = document.createElement('div');
    stampDiv.id = 'ct-stamp';
    stampDiv.style.cssText = 'position:fixed;right:6px;bottom:5px;z-index:12;pointer-events:none;'
      + 'font:10px/1 ui-monospace,Menlo,monospace;color:rgba(232,226,208,.5);'
      + 'text-shadow:0 1px 2px rgba(0,0,0,.9);letter-spacing:.5px;';
    document.body.appendChild(stampDiv);
  }
  {
    const t = new Date(AT), p2 = (n: number) => String(n).padStart(2, '0');
    stampDiv.textContent = `${SHA}${DIRTY ? '+' : ''} ${p2(t.getHours())}:${p2(t.getMinutes())}`;
  }

  const hud: Hud = {
    skyAt, nightAt,
    // The wash is now a THIN cool cast, not the darkness itself. It used to
    // carry the whole night at 0.58, which flattened contrast: every surface
    // lost the same light, so the gaps between lamps were as bright as the
    // pools under them. ct/props.ts darkens the actual materials instead, and
    // this just tints what is left. nightAt() is unchanged — it is still the
    // canonical "how night is it" curve that drives the lamps.
    setNight: (v) => { nightDiv!.style.opacity = String(v * 0.28); },
    watch: (want, mins) => {
      watchWrap!.style.transform = want
        ? 'translateX(-50%) translateY(0) rotate(-5deg)'
        : 'translateX(-50%) translateY(140%) rotate(-5deg)';
      if (want && mins !== watchShown) { drawWatch(mins); watchShown = mins; }
    },
    toggleWallet: () => {
      walletOpen = !walletOpen;
      if (walletOpen) { closePockets(); drawWallet(); }
      walletWrap!.style.transform = walletOpen
        ? 'translateX(-50%) translateY(0) rotate(2deg)'
        : 'translateX(-50%) translateY(150%) rotate(2deg)';
    },
    closeWallet: () => {
      if (!walletOpen) return;
      walletOpen = false;
      walletWrap!.style.transform = 'translateX(-50%) translateY(150%) rotate(2deg)';
    },
    // ONE SIGNAL, BOTH VIEWS. Everything in the world that changes the purse
    // already calls this — the bodega counter, the ATM, feeding the birds — so
    // the pockets panel refreshes off the same call rather than needing every
    // one of those callers to learn that a second view exists.
    refreshWallet: () => { if (walletOpen) drawWallet(); refreshPockets(); },
    prompt: (text) => {
      if (text === null) { promptDiv!.style.display = 'none'; return; }
      promptDiv!.textContent = text;
      promptDiv!.style.display = 'block';
    },
    fading: () => fading !== null,
    // WAIT FOR THE TRANSITION TO SAY IT IS DONE, not for a timer that thinks
    // it knows when. GOTCHAS §30 is about render-loop time, and a CSS
    // transition looks like the exception — it advances on the compositor's own
    // clock, so surely a matching `setTimeout` measures the same thing. It does
    // not, because the transition does not START until a frame is served: I set
    // the opacity in a `requestAnimationFrame` so that 0 lands before 1, and on
    // a loaded machine that frame is late. Timing the middle from t0 therefore
    // ran the world change at **opacity 0.842** — a caller's clock jumping in
    // full view of the player, which is the exact fault this whole feature is
    // dressing. Under the check's own load, 21 samples arrived where 120 were
    // due; the fade was fine and the schedule was fiction.
    //
    // `transitionend` is the event. The timeout beside it is a FALLBACK, not
    // the schedule: if the tab is hidden or the event is dropped, a fade that
    // never finishes would leave the screen black and the player locked out,
    // which is far worse than one that ends early.
    fade: (o = {}) => {
      if (fading) return fading;                 // two fades would fight one opacity
      const outMs = o.outMs ?? 850, holdMs = o.holdMs ?? 750, inMs = o.inMs ?? 1000;
      const unlock = lockInput();
      const settled = (ms: number, then: () => void) => {
        let called = false;
        const fin = () => {
          if (called) return;
          called = true;
          fadeDiv!.removeEventListener('transitionend', onEnd);
          clearTimeout(bail);
          then();
        };
        const onEnd = (e: TransitionEvent) => { if (e.propertyName === 'opacity') fin(); };
        fadeDiv!.addEventListener('transitionend', onEnd);
        const bail = setTimeout(fin, ms + 1500) as unknown as number;
      };
      fading = new Promise<void>((done) => {
        fadeDiv!.style.transition = `opacity ${outMs}ms ease-in`;
        // a frame's grace so the browser has the 0 before it is given the 1;
        // setting both in one tick is a cut, not a fade
        requestAnimationFrame(() => { fadeDiv!.style.opacity = '1'; });
        settled(outMs, () => {
          // BLACK. Everything that changes the world happens in here.
          try { o.mid?.(); } catch (e) { console.error('[hud.fade] mid threw:', e); }
          setTimeout(() => {
            fadeDiv!.style.transition = `opacity ${inMs}ms ease-out`;
            fadeDiv!.style.opacity = '0';
            settled(inMs, () => { unlock(); fading = null; done(); });
          }, holdMs);
        });
      });
      return fading;
    },
    note: (text, ms = 2400) => {
      noteDiv!.textContent = text;
      noteDiv!.style.opacity = '1';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { noteDiv!.style.opacity = '0'; }, ms) as unknown as number;
    },
    highlight: (rect) => {
      if (!rect) { hiDiv!.style.display = 'none'; return; }
      // Clamped to a sane on-screen size. An outline is a hint about WHICH thing
      // is selected, so at two metres it should frame the door and not the
      // viewport — without a ceiling a spot you are standing inside projects to
      // something larger than the screen and reads as a bug rather than a
      // selection.
      const w = Math.max(28, Math.min(rect.w, 520));
      const h = Math.max(28, Math.min(rect.h, 520));
      hiDiv!.style.left = `${Math.round(rect.x - w / 2)}px`;
      hiDiv!.style.top = `${Math.round(rect.y - h / 2)}px`;
      hiDiv!.style.width = `${Math.round(w)}px`;
      hiDiv!.style.height = `${Math.round(h)}px`;
      hiDiv!.style.display = 'block';
    },
  };
  // `ct/inventory.ts` posts its own lines — "pocketed the folded newspaper",
  // "pockets full" — from a `[E]` that was registered at build time by a module
  // that has no business holding the HUD. One binding here, rather than the
  // screen layer threaded through every takeable in the world.
  bindHud(hud);
  LIVE = hud;
  // Test affordance, same shape and same reason as `__ct` and `__inv`: a fade
  // is a promise over CSS time and there is no other way to start one, or to
  // ask whether one is running, from outside. `scripts/K-sleep-fade.mjs` reads
  // the OPACITY off the element rather than this flag — a boolean going true is
  // not the same claim as the screen actually being black.
  (window as unknown as { __hud: unknown }).__hud = {
    fade: (o?: Parameters<Hud['fade']>[0]) => hud.fade(o),
    fading: () => hud.fading(),
  };
  return hud;
}

import * as THREE from 'three';
import { SHA, DIRTY, AT } from 'virtual:build-stamp';

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
  /** repaint the wallet if it happens to be open (after a buy, after feeding) */
  refreshWallet: () => void;
  /** the [E] hint under the crosshair; null hides it */
  prompt: (text: string | null) => void;
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
  let watchWrap = document.getElementById('ct-watch') as HTMLDivElement | null;
  let watchCv: HTMLCanvasElement;
  if (!watchWrap) {
    watchWrap = document.createElement('div');
    watchWrap.id = 'ct-watch';
    watchWrap.style.cssText = 'position:fixed;left:52%;bottom:-14px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(140%) rotate(-6deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = 120; watchCv.height = 72;
    watchCv.style.cssText = 'width:330px;height:198px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = 120; watchCv.height = 72;
  }
  // the wrist-and-watch close-up (the good one — arm version was reverted)
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    g.clearRect(0, 0, 120, 72);
    // STEP 1 of an incremental rebuild (an all-at-once redraw was rejected).
    // Only change so far: the forearm runs OFF THE LEFT EDGE instead of
    // floating with a gap either side. A limb cut by the frame reads as your
    // own arm; a band with air around it reads as a disembodied cuff.
    g.fillStyle = '#c9946a'; g.fillRect(0, 6, 104, 66);          // wrist, cut by the frame
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 6, 10, 66);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(94, 6, 10, 66);
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
    g.fillStyle = '#e8e2d0'; g.font = '7px monospace'; g.textAlign = 'left';
    let iy = wy + 42;
    for (const [k, n] of Object.entries(purse.inv)) { if (n > 0) { g.fillText(`${k} x${n}`, lx, iy); iy += 10; } }
    if (iy === wy + 42) { g.fillStyle = '#9a927e'; g.fillText('(empty pockets)', lx, iy); }
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

  return {
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
      if (walletOpen) drawWallet();
      walletWrap!.style.transform = walletOpen
        ? 'translateX(-50%) translateY(0) rotate(2deg)'
        : 'translateX(-50%) translateY(150%) rotate(2deg)';
    },
    refreshWallet: () => { if (walletOpen) drawWallet(); },
    prompt: (text) => {
      if (text === null) { promptDiv!.style.display = 'none'; return; }
      promptDiv!.textContent = text;
      promptDiv!.style.display = 'block';
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
}

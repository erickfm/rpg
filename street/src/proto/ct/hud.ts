import * as THREE from 'three';

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
    watchWrap.style.cssText = 'position:fixed;left:50%;bottom:34px;z-index:11;pointer-events:none;transform:translateX(-50%) translateY(150%) rotate(-4deg);transition:transform .18s ease-out;';
    watchCv = document.createElement('canvas');
    watchCv.width = 172; watchCv.height = 78;
    watchCv.style.cssText = 'width:430px;height:195px;image-rendering:pixelated;display:block;';
    watchWrap.appendChild(watchCv);
    document.body.appendChild(watchWrap);
  } else {
    watchCv = watchWrap.firstChild as HTMLCanvasElement;
    watchCv.width = 172; watchCv.height = 78;
  }
  // the wrist-and-watch close-up (the good one — arm version was reverted)
  // Looking down at your own wrist.
  //
  // Three earlier attempts read as "an arm sticking out with a fist in front
  // of you". The reason was composition, not drawing: the forearm was a
  // floating band that stopped short of the frame with a gap either side, so
  // it read as a disembodied cuff rather than part of you. What makes it feel
  // like YOUR arm is that it is CUT OFF by the frame — the forearm runs off
  // the LEFT edge, and the HAND continues off to the RIGHT past the watch.
  // You are seeing a section of your own arm, not a limb posed in front of
  // your face. Nothing is foreshortened toward the camera.
  const drawWatch = (mins: number) => {
    const g = watchCv.getContext('2d')!;
    const W = 172, H = 78;
    g.clearRect(0, 0, W, H);
    const { skin, skinHi, skinLo } = player;

    // ── forearm: runs OFF the left edge, no gap, no rounded end ──────────
    g.fillStyle = skin;   g.fillRect(0, 20, 78, 40);
    g.fillStyle = skinHi; g.fillRect(0, 20, 78, 5);        // top of the arm catches light
    g.fillStyle = skinLo; g.fillRect(0, 53, 78, 7);        // underside in shadow
    // sleeve cuff biting the very edge — implies the rest of you off-frame
    g.fillStyle = player.sleeve;   g.fillRect(0, 17, 13, 46);
    g.fillStyle = player.cuff; g.fillRect(0, 17, 13, 4);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(13, 17, 3, 46);

    // ── the wrist narrows slightly where the watch sits ──────────────────
    g.fillStyle = skin; g.fillRect(78, 23, 26, 34);
    g.fillStyle = skinLo; g.fillRect(78, 51, 26, 6);

    // ── the hand, continuing RIGHT and off the frame ─────────────────────
    g.fillStyle = skin;   g.fillRect(104, 19, 44, 42);     // back of the hand
    g.fillStyle = skinHi; g.fillRect(104, 19, 44, 5);
    g.fillStyle = skinLo; g.fillRect(104, 54, 44, 7);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(104, 19, 3, 42);  // wrist crease
    // knuckles and fingers folding away from you — seen from above, so they
    // read as short segments, never as a fist pointed at the camera
    g.fillStyle = skin; g.fillRect(148, 19, 24, 42);       // fingers as ONE mass…
    g.fillStyle = skinHi; g.fillRect(148, 19, 24, 3);
    g.fillStyle = skinLo;                                   // …separated by creases,
    for (const fy of [28, 38, 48]) g.fillRect(148, fy, 24, 1);   // not gaps
    g.fillStyle = 'rgba(0,0,0,0.13)';
    for (const fy of [29, 39, 49]) g.fillRect(148, fy, 24, 1);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(147, 19, 2, 42);                            // knuckle line
    // thumb, tucked along the near edge and running off the bottom
    g.fillStyle = skinLo; g.fillRect(112, 58, 26, 20);
    g.fillStyle = skin;   g.fillRect(112, 58, 26, 15);

    // ── the watch itself ─────────────────────────────────────────────────
    // The case is WIDE along the forearm so the digits actually fit — a
    // narrow face meant '16:13' overflowed the LCD and clipped. Readability
    // beats strict anatomy on a HUD element you glance at.
    g.fillStyle = '#26282e'; g.fillRect(62, 14, 14, 52);   // strap, arm side
    g.fillRect(114, 14, 14, 52);                           // strap, hand side
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(62, 14, 3, 52);
    g.fillStyle = '#1a1c20'; g.fillRect(72, 16, 46, 48);   // keeper under the case
    g.fillStyle = '#3a3d45'; g.fillRect(74, 19, 42, 42);   // case
    g.fillStyle = '#4a4e58'; g.fillRect(74, 19, 42, 3);    // top bevel
    g.fillStyle = '#2b2e35'; g.fillRect(74, 58, 42, 3);    // bottom shadow
    g.fillStyle = '#14161a'; g.fillRect(77, 23, 36, 34);   // bezel well
    g.fillStyle = '#9cab8b'; g.fillRect(79, 26, 32, 21);   // LCD
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(79, 26, 32, 3);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m2 = String(mins % 60).padStart(2, '0');
    g.fillStyle = '#1c2a1c';
    g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${hh}:${m2}`, 95, 36);
    g.fillStyle = '#7f8590'; g.font = '5px monospace';
    g.fillText('QUARTZ', 95, 52);
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

  return {
    skyAt, nightAt,
    setNight: (v) => { nightDiv!.style.opacity = String(v); },
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
  };
}

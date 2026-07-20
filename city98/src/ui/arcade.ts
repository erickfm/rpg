import { LANES, ROAD_LEN, arcadePayout, newArcade, stepArcade, type ArcadeState, type Steer } from '../core/arcade';
import { mulberry32, type Rng } from '../core/rng';

/**
 * Renders Gutter Racer on a canvas inside a modal. Returns the cash payout
 * to the caller when the player finishes. Steering is one-lane-per-keypress.
 */
export function playArcade(onDone: (payout: number, score: number) => void): void {
  const overlay = document.createElement('div');
  overlay.id = 'arcade-overlay';
  overlay.innerHTML = `
    <div class="win arcade-win">
      <div class="win-title"><span class="win-title-text">GUTTER RACER</span><span></span></div>
      <div class="win-body arcade-body">
        <canvas id="arcade-canvas" width="240" height="360"></canvas>
        <div class="arcade-hud"><span id="arcade-score">0</span> &nbsp; <span id="arcade-msg">← / → to dodge</span></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('keydown', e => e.stopPropagation());

  const canvas = overlay.querySelector<HTMLCanvasElement>('#arcade-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const scoreEl = overlay.querySelector<HTMLElement>('#arcade-score')!;
  const msgEl = overlay.querySelector<HTMLElement>('#arcade-msg')!;
  const W = canvas.width;
  const H = canvas.height;
  const laneW = W / LANES;

  let state: ArcadeState = newArcade();
  const rng: Rng = mulberry32((Date.now() & 0xffff) ^ 0x9e37);
  let steer: Steer = 0;
  let done = false;
  let last = performance.now();
  let raf = 0;

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { steer = -1; e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { steer = 1; e.preventDefault(); }
    else if ((k === 'enter' || k === ' ') && done) finish();
    else if (k === 'escape') finish();
  };
  window.addEventListener('keydown', onKey, true);

  function draw(): void {
    // road
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, 0, W, H);
    // lane lines
    ctx.strokeStyle = '#3a4150';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneW, 0);
      ctx.lineTo(i * laneW, H);
      ctx.stroke();
    }
    // moving dashes for speed feel
    const dashOff = (state.dist * 12) % 40;
    ctx.strokeStyle = '#4a5568';
    ctx.setLineDash([16, 24]);
    ctx.lineWidth = 3;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneW, -40 + dashOff);
      ctx.lineTo(i * laneW, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // obstacles (map world y=ROAD_LEN..0 to top..bottom)
    for (const o of state.obstacles) {
      const px = o.lane * laneW + laneW / 2;
      const py = H - (o.y / ROAD_LEN) * H;
      drawCar(px, py, '#c8483c', 22);
    }
    // player near the bottom
    const plx = state.lane * laneW + laneW / 2;
    drawCar(plx, H - 44, state.alive ? '#3c9ce0' : '#7a7a82', 24);
  }

  function drawCar(cx: number, cy: number, color: string, h: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(cx - 14, cy - h / 2, 28, h);
    ctx.fillStyle = '#141820';
    ctx.fillRect(cx - 14, cy - h / 2 + 4, 28, 5);
    ctx.fillRect(cx - 14, cy + h / 2 - 9, 28, 5);
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(cx - 17, cy - h / 2 + 2, 3, h - 4);
    ctx.fillRect(cx + 14, cy - h / 2 + 2, 3, h - 4);
  }

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.alive) {
      state = stepArcade(state, dt, steer, rng);
      steer = 0;
      scoreEl.textContent = String(Math.floor(state.dist));
      if (!state.alive) {
        done = true;
        const payout = arcadePayout(state.dist);
        msgEl.textContent = `CRASH! +$${payout} — Enter to collect`;
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function finish(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    onDone(arcadePayout(state.dist), Math.floor(state.dist));
  }

  // expose for headless smoke: quick deterministic run
  (window as unknown as { __arcade?: unknown }).__arcade = {
    crash: () => { state = { ...state, alive: false }; done = true; },
    finish,
    score: () => Math.floor(state.dist),
  };
}

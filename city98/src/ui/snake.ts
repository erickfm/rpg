import {
  GRID_W, GRID_H, newSnake, stepSnake, turnSnake, snakePayout, type SnakeState, type Dir,
} from '../core/snake';
import { mulberry32, type Rng } from '../core/rng';

/**
 * Renders "Dragon's Tail" (Snake) on a canvas in a modal, mirroring the Gutter
 * Racer harness. The snake steps on a fixed tick that quickens as you score;
 * arrows/WASD turn. Returns the cash payout when the player collects.
 */
export function playSnake(onDone: (payout: number, score: number) => void): void {
  const overlay = document.createElement('div');
  overlay.id = 'arcade-overlay';
  overlay.innerHTML = `
    <div class="win arcade-win">
      <div class="win-title"><span class="win-title-text">DRAGON'S TAIL</span><span></span></div>
      <div class="win-body arcade-body">
        <canvas id="snake-canvas" width="320" height="320"></canvas>
        <div class="arcade-hud"><span id="arcade-score">0</span> &nbsp; <span id="arcade-msg">arrows to steer · eat the eggs</span></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('keydown', e => e.stopPropagation());

  const canvas = overlay.querySelector<HTMLCanvasElement>('#snake-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const scoreEl = overlay.querySelector<HTMLElement>('#arcade-score')!;
  const msgEl = overlay.querySelector<HTMLElement>('#arcade-msg')!;
  const W = canvas.width;
  const cell = W / GRID_W;

  const rng: Rng = mulberry32((Date.now() & 0xffff) ^ 0x5eed);
  let state: SnakeState = newSnake(rng);
  let done = false;
  let acc = 0;
  let last = performance.now();
  let raf = 0;

  const tick = () => Math.max(0.07, 0.16 - state.score * 0.006); // quickens as you grow

  const KEY: Record<string, Dir> = {
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
    arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (KEY[k]) { state = turnSnake(state, KEY[k]); e.preventDefault(); }
    else if ((k === 'enter' || k === ' ') && done) finish();
    else if (k === 'escape') finish();
  };
  window.addEventListener('keydown', onKey, true);

  function draw(): void {
    // board
    ctx.fillStyle = '#141a16';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#1e2a20';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_W; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell); ctx.stroke();
    }
    // food — a golden egg
    ctx.fillStyle = '#f2c84a';
    ctx.strokeStyle = '#7a5a12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(state.food.x * cell + cell / 2, state.food.y * cell + cell / 2, cell * 0.3, cell * 0.38, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // snake — brighter head, scaly body
    state.body.forEach((c, i) => {
      const head = i === 0;
      ctx.fillStyle = state.alive ? (head ? '#7ce8a0' : '#3fbf6a') : '#6a7a6e';
      const pad = head ? 1 : 2;
      ctx.fillRect(c.x * cell + pad, c.y * cell + pad, cell - pad * 2, cell - pad * 2);
      if (head && state.alive) {
        ctx.fillStyle = '#12201a';
        const ex = c.x * cell + cell / 2, ey = c.y * cell + cell / 2;
        ctx.fillRect(ex - 4, ey - 3, 2.5, 2.5);
        ctx.fillRect(ex + 2, ey - 3, 2.5, 2.5);
      }
    });
  }

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.alive) {
      acc += dt;
      while (acc >= tick()) {
        acc -= tick();
        state = stepSnake(state, rng);
        scoreEl.textContent = String(state.score);
        if (!state.alive) {
          done = true;
          msgEl.textContent = `DONE! +$${snakePayout(state.score)} — Enter to collect`;
          break;
        }
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
    onDone(snakePayout(state.score), state.score);
  }

  // headless smoke hook
  (window as unknown as { __snake?: unknown }).__snake = {
    die: () => { state = { ...state, alive: false }; done = true; },
    finish,
    score: () => state.score,
  };
}

// Does jump-walk.mjs's 1100 ms wait truncate the hop under load?
//
// One spot (the pavement), measured four ways: the OLD fixed-wall-clock window
// and a FRAMES/state-settled window, each at idle and at CPU throttle x8. If
// the fixed window is sound, all four agree; if it truncates, the throttled
// fixed-window reading comes back short of the peak the same hop reaches.
//
// The physics floor: dt is clamped at 0.05 s (src/main.ts:107) and the hop is
// vy0 = 4.0 with g = 14 (src/proto/fp.ts:488-492), so the coarsest possible
// integration still peaks at 0.475 m. Anything below that is the instrument.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();

async function measure({ throttle, mode }) {
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  const cdp = await p.context().newCDPSession(p);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

  await p.evaluate(() => window.__ct.warp(-6.0, -20.0, 0, 0.14, 0));
  const rest = await p.evaluate(() => new Promise((res, rej) => {
    let last = null, stable = 0, n = 0;
    const tick = () => {
      const y = window.__ct.camY();
      if (last !== null && Math.abs(y - last) < 1e-4) stable++; else stable = 0;
      last = y;
      if (stable >= 6) return res(y);
      if (++n > 300) return rej(new Error('never settled'));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));

  // start the in-page peak sampler
  await p.evaluate(() => {
    window.__pk = -Infinity; window.__on = true; window.__frames = 0;
    const f = () => {
      if (!window.__on) return;
      window.__frames++;
      window.__pk = Math.max(window.__pk, window.__ct.camY());
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });

  await p.keyboard.down(' ');
  if (mode === 'ms') await p.waitForTimeout(60);
  else await p.evaluate(() => new Promise((r) => {
    let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f);
  }));
  await p.keyboard.up(' ');

  if (mode === 'ms') {
    await p.waitForTimeout(1100);                 // the old instrument
  } else {
    // frames/state: wait until the camera is back at rest and holds there
    await p.evaluate((rest) => new Promise((res, rej) => {
      let rose = false, stable = 0, n = 0;
      const f = () => {
        const y = window.__ct.camY();
        if (y > rest + 0.02) { rose = true; stable = 0; }
        else if (rose && Math.abs(y - rest) < 1e-3) stable++;
        if (stable >= 6) return res();
        if (++n > 3000) return rej(new Error(rose ? 'never landed' : 'never left the ground'));
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }), rest);
  }

  const { pk, frames } = await p.evaluate(() => {
    window.__on = false; return { pk: window.__pk, frames: window.__frames };
  });
  await p.close();
  return { rise: pk - rest, frames };
}

const RATES = (process.env.RATES ?? '1,8').split(',').map(Number);
for (const mode of ['ms', 'frames']) {
  for (const throttle of RATES) {
    const { rise, frames } = await measure({ throttle, mode });
    const short = rise < 0.475 - 1e-3 ? '  <-- BELOW THE 0.475 m PHYSICS FLOOR (truncated)' : '';
    console.log(`${mode.padEnd(7)} throttle x${String(throttle).padEnd(2)}  apex +${rise.toFixed(4)} m  (${frames} sampled frames)${short}`);
  }
}
await b.close();

// A DEAD SERVER IS NOT A FAILED CHECK.
//
// Every check here opens with `page.goto(URL)`. When the preview is not up,
// Playwright throws ERR_CONNECTION_REFUSED, node prints a stack, and the
// process exits 1 — which is the code for "this check ran and the world is
// wrong". It is not. Nothing was measured.
//
// That cost me three separate wrong readings in one session: twice I read
// `exit 1` off a dead preview as a real regression and went looking for the
// fault, and once I re-read a STALE screenshot from a run that had died,
// concluding the camera was inside a wall when the position was fine. My
// preview dropped six times that session, so this is not a rare state.
//
// GOTCHAS 32 already says what the answer is: exit 3 means the check never
// ran. This makes goto obey it, with the fix printed rather than a stack.
export async function goto(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch (e) {
    if (!/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ECONNREFUSED/.test(String(e.message))) throw e;
    console.error(`\n  THE CHECK NEVER RAN — nothing is serving ${url}.`);
    console.error('  This is NOT a finding about the world; nothing was measured.');
    console.error('  Fix: start the preview, then re-run.');
    console.error('    cd street && npx vite preview --port 4279 --strictPort &\n');
    process.exit(3);   // GOTCHAS 32
  }
}

/**
 * AND NEITHER IS A FRAME THAT HAS NOT DRAWN YET.
 *
 * The FIRST screenshot after load comes back at mean luminance 0.00–0.02
 * whatever `__ct.clock` says — the world has not rendered. That has now cost
 * me three readings in two sessions: a joint probe that reported "no joints
 * anywhere" off a column of pure zeros, and two shot sheets whose opening
 * frame was a black rectangle I nearly filed as "the camera is inside a wall".
 *
 * A fixed sleep is the wrong instrument (GOTCHAS 30) and a brightness
 * threshold is wrong too, because a night frame is legitimately dark. So this
 * waits for the frame to STOP CHANGING, which a dead frame never does — it
 * stays at zero, and zero is reported rather than accepted.
 *
 * Returns the settled mean luminance. Call it after warp/clock, before you
 * read anything off the screen.
 */
export async function settle(page, { tries = 40, gap = 120, floor = 0.02 } = {}) {
  const meanOf = (b64) => page.evaluate(async (s) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + s; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let a = 0;
    for (let i = 0; i < d.length; i += 4) a += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    return a / (d.length / 4) / 255;
  }, b64);
  let mean = 0, prev = -1, still = 0;
  for (let i = 0; i < tries; i++) {
    mean = await meanOf((await page.screenshot()).toString('base64'));
    if (mean > floor && Math.abs(mean - prev) < 0.0015) { if (++still >= 2) return mean; } else still = 0;
    prev = mean;
    await page.waitForTimeout(gap);
  }
  return mean;
}

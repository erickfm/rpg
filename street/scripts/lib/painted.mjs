// WAIT FOR A FRAME THE RENDERER ACTUALLY DREW — not for rAF, and not for `__ct`.
//
// GOTCHAS 78 and 80. `lib/frames.mjs`'s `afterFrames` waits for animation-frame
// callbacks, and rAF fires whether or not `renderer.render()` was called at all.
// Worker sixtyone shot the built bundle after the prescribed wait and got EIGHT
// SOLID BLACK FRAMES while the same bundle's scene graph read perfectly; the
// first genuinely drawn frame did not arrive until 1136 ms.
//
// That is not a slow machine, it is the wrong signal:
//
//     window.__ct exists        <- crosstown.ts assigned it. Says nothing.
//     rAF fired twice           <- the browser ran two callbacks. Says nothing.
//     render.frame advanced     <- three called render(). THIS is the one.
//
//   import { waitPainted, blackFraction } from './lib/painted.mjs';
//   await waitPainted(page);
//   const shot = await page.screenshot({ path: '…' });
//   if (await blackFraction(page, shot) > 0.98) { /* you photographed the void */ }
//
// `afterFrames` is still the right tool for "let the sim advance one tick after
// a warp" — that is a SIMULATION wait and rAF is exactly what drives it. This is
// for the other question, "is there a picture yet", and the two are not the same
// wait however similar they look at the call site.

/**
 * Resolve once the renderer has drawn `frames` more frames than it had when
 * this was called, with geometry in them.
 *
 * `triangles` is checked as well as `frames` on purpose: a render call that
 * drew nothing advances the counter and still leaves a black screen, so
 * "frames advanced" alone is the same class of half-answer that made rAF
 * unsafe. Returns the reading; **throws** if it never arrives, because a helper
 * that silently degrades to no wait at all is worse than the sleep it replaced
 * — that is the whole lesson of the thing it is replacing.
 */
export async function waitPainted(page, { frames = 2, capMs = 20000, quiet = false } = {}) {
  const t0 = Date.now();
  const r = await page.evaluate(async ([want, cap]) => {
    const read = () => window.__ct?.painted?.() ?? null;
    const t0 = performance.now();
    let first = null;
    for (;;) {
      const p = read();
      if (p) {
        if (first === null) first = p.frames;
        if (p.frames - first >= want && p.triangles > 0) {
          return { ok: true, ...p, ms: +(performance.now() - t0).toFixed(1), first };
        }
      }
      if (performance.now() - t0 > cap) {
        return { ok: false, ...(p ?? { frames: -1, triangles: -1, calls: -1 }),
          ms: +(performance.now() - t0).toFixed(1), first, hasCt: !!window.__ct,
          hasPainted: typeof window.__ct?.painted === 'function' };
      }
      await new Promise((res) => requestAnimationFrame(res));
    }
  }, [frames, capMs]);
  if (!r.ok) {
    throw new Error(
      `[painted] the renderer never drew ${frames} frames in ${capMs} ms.\n`
      + `  __ct: ${r.hasCt}   __ct.painted: ${r.hasPainted}   `
      + `frames: ${r.frames}   triangles: ${r.triangles}\n`
      + '  __ct.painted is item 181 (crosstown.ts). On a build that predates it this\n'
      + '  helper cannot work and you should say so rather than shoot anyway.');
  }
  if (!quiet) {
    console.log(`[painted] ${r.frames - r.first} frames drawn in ${r.ms} ms `
      + `(${r.triangles} triangles, ${r.calls} draw calls, ${Date.now() - t0} ms wall)`);
  }
  return r;
}

/**
 * What fraction of a PNG buffer is (near-)black?
 *
 * Decoded through a canvas in the page rather than with an image library,
 * because this suite already has playwright and nothing else. A frame over ~0.98
 * is the void, not a dark room: even the night wash leaves the HUD, the prompt
 * and the build stamp lit.
 */
export async function blackFraction(page, pngBuffer, threshold = 12) {
  return page.evaluate(async ([b64, thr]) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let black = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] <= thr && d[i + 1] <= thr && d[i + 2] <= thr) black++;
    }
    return +(black / (d.length / 4)).toFixed(4);
  }, [pngBuffer.toString('base64'), threshold]);
}

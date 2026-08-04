// Blank-frame guard for everything in this repo that screenshots the world.
//
// WHY: this environment drops the WebGL context periodically — `CONTEXT_LOST_WEBGL`
// shows up in most sweeps — and a lost context screenshots as a WHITE PAGE with
// the DOM overlay still on it. Playwright reports success, the script prints
// "done", and the PNG is evidence of nothing. It has happened twice to me and
// both times the harness said it was fine. The risk is not a wasted run; it is
// handing a reviewer or the auditor a white frame as proof.
//
// Two uses:
//
//   import { ensureAlive } from './shotguard.mjs'
//   await ensureAlive(page)            // before every screenshot in a new script
//
//   node scripts/shotguard.mjs shots/  // audit PNGs already on disk
//
// The audit path deliberately does not need a dev server, so it can be run over
// somebody else's output after the fact without re-shooting anything.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Wait until the WebGL canvas is actually drawing, and say so if it is not.
 * Returns true when the frame is live. Call it immediately before a capture.
 */
export async function ensureAlive(page, tries = 6, waitMs = 400) {
  const probe = () => page.evaluate(() => {
    const cv = document.querySelector('canvas');
    if (!cv) return 'no canvas';
    const g = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!g) return 'no gl context';
    if (g.isContextLost()) return 'context lost';
    // sample a few points rather than one — a legitimately dark sky at the
    // centre is not the same thing as a dead framebuffer
    const pts = [[0.5, 0.5], [0.25, 0.6], [0.75, 0.4], [0.5, 0.8]];
    let sum = 0;
    for (const [fx, fy] of pts) {
      const px = new Uint8Array(4);
      g.readPixels(Math.round(cv.width * fx), Math.round(cv.height * fy), 1, 1,
                   g.RGBA, g.UNSIGNED_BYTE, px);
      sum += px[0] + px[1] + px[2];
    }
    return sum > 0 ? true : 'framebuffer empty';
  });
  let why = 'never probed';
  for (let i = 0; i < tries; i++) {
    why = await probe();
    if (why === true) return true;
    await page.waitForTimeout(waitMs);
  }
  console.error(`shotguard: canvas not drawing (${why}) — capture would be blank`);
  return false;
}

// ── audit mode ────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2] ?? 'shots');
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'))
    .map((f) => join(dir, f)).filter((f) => statSync(f).isFile());
  if (!files.length) { console.log(`no PNGs in ${dir}`); process.exit(0); }

  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const p = await b.newPage();
  const bad = [];
  for (const f of files) {
    // handed in as a data URL: chromium will not load file:// images into a
    // page whose own origin is about:blank, and this needs no browser flags
    const src = 'data:image/png;base64,' + readFileSync(f).toString('base64');
    const r = await p.evaluate(async (src) => {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      // Ignore the bottom strip: the title card and the build stamp are DOM,
      // so they render even when the 3D canvas is dead and would mask a blank.
      const h = Math.round(img.height * 0.82);
      const d = g.getImageData(0, 0, img.width, h).data;
      const hist = new Map();
      for (let i = 0; i < d.length; i += 4 * 7) {                 // every 7th pixel is plenty
        const k = (d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3);
        hist.set(k, (hist.get(k) ?? 0) + 1);
      }
      let top = 0, n = 0;
      for (const v of hist.values()) { n += v; if (v > top) top = v; }
      return { flat: top / n, colours: hist.size, w: img.width, h: img.height };
    }, src);
    // A real frame of this world is never one colour: even a night shot has
    // lamps, kerbs and sky gradient. >99% one bucket means the 3D never drew.
    if (r.flat > 0.99 || r.colours < 12) bad.push([f, r]);
  }
  await b.close();

  console.log(`shotguard: scanned ${files.length} PNGs in ${dir}`);
  if (!bad.length) { console.log('  no blank frames'); process.exit(0); }
  console.log(`  ${bad.length} BLANK OR NEAR-BLANK — these prove nothing:`);
  for (const [f, r] of bad) {
    console.log(`   ${f.replace(dir + '/', '')}  ${(100 * r.flat).toFixed(1)}% one colour, ${r.colours} colours`);
  }
  process.exit(1);
}

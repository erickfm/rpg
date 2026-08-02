// Dump a named shop's ground-floor band canvas, magnified with nearest
// neighbour, so a feature that stops mid-glyph is legible as PIXELS.
//
// This is a LOOKING tool, not a proving one. It exists because a screenshot of
// a shopfront is 8 px/m seen at an angle through fog and a citizen's head, and
// the thrift store's "50c" card being cut in half by the doorcase was invisible
// in every shot I took of it and obvious the moment the canvas was on screen at
// 6x. When the question is "does this painted feature terminate or is it cut",
// look at the canvas; when the question is "did the world move", use `fp`.
//
//   node scripts/bandcanvas.mjs THRIFT [outdir]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const URL = aim('http://localhost:4177/');
const NAME = process.argv[2] ?? 'THRIFT';
const out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const r = await p.evaluate((nm) => {
  const fr = (globalThis.__frontages ?? []).find((f) => f.name === nm);
  if (!fr) return { err: `no ${nm} frontage` };
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    const along = fr.axis === 'z' ? e[14] : e[12];
    const across = fr.axis === 'z' ? e[12] : e[14];
    // the band belongs to THIS frontage: inside its run AND on its side of
    // the street. Without the second test a same-width shop opposite wins.
    if (along < fr.loWorld - 0.6 || along > fr.hiWorld + 0.6) return;
    if (Math.abs(across - fr.facePos) > 14) return;
    if (e[13] < 1 || e[13] > 3.5) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const im = m?.map?.image;
      if (!im?.width || m.map.userData?.surface !== 'brick') continue;
      const px = im.width * im.height;
      // The recessed room plane behind the glass is the SAME canvas size and
      // also masonry-stamped, so neither size nor position separates them —
      // the shell is a box, the room is a plane. Take the box.
      if (o.geometry?.type !== 'BoxGeometry') continue;
      if (px < 4000) continue;
      if (!best || px > best.px) best = { px, im, w: im.width, h: im.height };
    }
  });
  if (!best) return { err: 'no band texture found' };
  const Z = 6;                       // nearest-neighbour, so a 1px feature reads
  const c = document.createElement('canvas');
  c.width = best.w * Z; c.height = best.h * Z;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(best.im, 0, 0, c.width, c.height);
  return { w: best.w, h: best.h, png: c.toDataURL('image/png') };
}, NAME);
await b.close();
if (r.err) { console.error(r.err); process.exit(1); }
writeFileSync(`${out}/band-${NAME.replace(/\W+/g, '-')}.png`,
  Buffer.from(r.png.split(',')[1], 'base64'));
console.log(`${NAME} band canvas ${r.w}x${r.h} -> ${out}/band-${NAME.replace(/\W+/g, '-')}.png`);

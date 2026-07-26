// crop + magnify a PNG using the page's own canvas
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out, x, y, w, h, scale] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('data:text/html,<body>');
const b64 = readFileSync(src).toString('base64');
const res = await p.evaluate(async ([s, X, Y, W, H, S]) => {
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + s; });
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(img, X, Y, W, H, 0, 0, W * S, H * S);
  return c.toDataURL('image/png').split(',')[1];
}, [b64, +x, +y, +w, +h, +scale]);
writeFileSync(out, Buffer.from(res, 'base64'));
console.log(out);
await b.close();

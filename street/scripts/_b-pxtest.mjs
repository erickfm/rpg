import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto('http://localhost:4279/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.evaluate(() => window.__ct.warp(-6, -40, 0, 0.14, -0.85));
await p.waitForTimeout(600);
const png = (await p.screenshot()).toString('base64');
console.log('png bytes(b64):', png.length);
console.log(await p.evaluate(async (b64) => {
  const img = new Image();
  try { await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('onerror')); img.src = 'data:image/png;base64,' + b64; }); }
  catch (e) { return 'load failed: ' + e.message; }
  const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
  const g = t.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
  return `img ${img.width}x${img.height}, mean R ${(s / (d.length / 4)).toFixed(1)}`;
}, png));
await b.close();

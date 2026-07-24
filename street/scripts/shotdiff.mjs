// Compare two directories of screenshots pixel-by-pixel.
// Usage: node scripts/shotdiff.mjs shots/base-a shots/after1
// Uses the chromium we already have (no new deps) to decode + diff PNGs.
import { chromium } from 'playwright';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const [dirA, dirB] = process.argv.slice(2);
if (!dirA || !dirB) { console.error('usage: shotdiff.mjs <dirA> <dirB>'); process.exit(2); }

const names = readdirSync(dirA).filter((f) => f.endsWith('.png')).sort();
const browser = await chromium.launch();
const page = await browser.newPage();

const diffOne = async (a, b) => page.evaluate(async ([da, db]) => {
  const load = (d) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = d;
  });
  const [ia, ib] = await Promise.all([load(da), load(db)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { size: true };
  const cv = document.createElement('canvas');
  cv.width = ia.width; cv.height = ia.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(ia, 0, 0); const pa = g.getImageData(0, 0, cv.width, cv.height).data;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(ib, 0, 0); const pb = g.getImageData(0, 0, cv.width, cv.height).data;
  let n = 0, worst = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i+1] - pb[i+1]) + Math.abs(pa[i+2] - pb[i+2]);
    if (d > 12) n++;                       // ignore 1-2 LSB dither/AA noise
    if (d > worst) worst = d;
  }
  return { pct: (100 * n) / (pa.length / 4), worst };
}, [a, b]);

const b64 = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');
const rows = [];
for (const nm of names) {
  const pb = `${dirB}/${nm}`;
  if (!existsSync(pb)) { rows.push({ nm, missing: true }); continue; }
  rows.push({ nm, ...(await diffOne(b64(`${dirA}/${nm}`), b64(pb))) });
}
await browser.close();

const bad = rows.filter((r) => r.missing || r.size || r.pct > 0);
rows.sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0));
for (const r of rows.slice(0, 12)) {
  if (r.missing) console.log(`MISSING  ${r.nm}`);
  else if (r.size) console.log(`SIZE     ${r.nm}`);
  else console.log(`${r.pct.toFixed(3).padStart(8)}%  worst=${String(r.worst).padStart(3)}  ${r.nm}`);
}
console.log(`\n${names.length} shots, ${bad.length} differ at all`);

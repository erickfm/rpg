// ITEM 272 — READ THE SEATED SHEET AS TEXELS, not as a picture I squint at.
//
// The question the picture kept refusing to answer: is there ANY leg pixel
// above the seat line, and how far out does it reach? A 32x64 frame printed as
// characters answers it exactly, and the seat row is marked so the answer is
// "which rows are above the line", not "which rows look above the line".
//
// VIEW=0..4 picks the column of the atlas, FRAME=0|1 the walk frame.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
const VIEW = Number(process.env.VIEW ?? 2);
const FRAME = Number(process.env.FRAME ?? 0);
const WHICH = Number(process.env.WHICH ?? 1);
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

const res = await p.evaluate(([cx, cz, w, d, view, frame, which]) => {
  const inR = (x, z) => x >= cx - w / 2 && x <= cx + w / 2 && z >= cz - d / 2 && z <= cz + d / 2;
  const found = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (inR(q.x, q.z)) found.push(o);
  });
  if (found.length <= which) return { error: `only ${found.length} seated sprites` };
  const o = found[which];
  const img = o.material.map.image;
  const FW = img.width / 5, FH = img.height / 2;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const g = o.geometry.boundingBox;
  const originRow = (g.max.y / (g.max.y - g.min.y)) * FH;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(view * FW, frame * FH, FW, FH).data;
  const rows = [];
  const seen = new Map();
  for (let r = 0; r < FH; r++) {
    let line = '';
    for (let q = 0; q < FW; q++) {
      const i = (r * FW + q) * 4;
      const a = px[i + 3];
      if (a < 128) { line += '.'; continue; }
      const key = `${px[i]},${px[i + 1]},${px[i + 2]}`;
      if (!seen.has(key)) seen.set(key, String.fromCharCode(97 + seen.size));
      line += seen.get(key);
    }
    rows.push(line);
  }
  return { FW, FH, originRow, rows, legend: [...seen.entries()] };
}, [room.cx, room.cz, room.w, room.d, VIEW, FRAME, WHICH]);

if (res.error) { console.log(`EXIT 3 — ${res.error}`); await b.close(); process.exit(3); }
console.log(`view ${VIEW} frame ${FRAME}   seat(origin) row ${res.originRow}   cx = col ${res.FW / 2}`);
for (let r = 24; r < res.FH; r++) {
  console.log(`${String(r).padStart(2)} ${r === res.originRow ? '>' : ' '}|${res.rows[r]}|`);
}
console.log('legend:');
for (const [rgb, ch] of res.legend) console.log(`  ${ch} = rgb(${rgb})`);
await b.close();

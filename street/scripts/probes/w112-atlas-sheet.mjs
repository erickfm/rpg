// ITEM 272 — LOOK AT THE PAINTED SHEET ITSELF, 8x, with the seat line on it.
//
// The world view cannot separate "badly drawn" from "hidden": the bench covers
// exactly the rows in question. So pull the seated customer's own atlas out of
// the running world and blow it up, with a marker on THE ROW THE SEAT TOP SITS
// AT (the geometry's origin row) — everything below that line is inside the
// furniture and can never be seen.
//
// The atlas comes from the live material, not from a re-run of citizenAtlas, so
// it is the sheet the world is actually sampling.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const TAG = process.env.TAG || 'now';
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

const sheets = await p.evaluate(([cx, cz, w, d]) => {
  const inR = (x, z) => x >= cx - w / 2 && x <= cx + w / 2 && z >= cz - d / 2 && z <= cz + d / 2;
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (!inR(q.x, q.z)) return;
    const img = o.material.map.image;
    // THE ORIGIN ROW, DERIVED. The geometry was translated so the origin sits
    // at the hip; the plane spans −H/2..+H/2 before that translate, so the row
    // is read back off the bounding box rather than retyped from citizens.ts.
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox;
    const H = g.max.y - g.min.y;
    const ROWS = img.height / 2;              // two walk frames stacked
    const originRow = (g.max.y / H) * ROWS;   // rows from the TOP of a frame
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    out.push({ png: c.toDataURL('image/png'), w: img.width, h: img.height, originRow, ROWS });
  });
  return out;
}, [room.cx, room.cz, room.w, room.d]);

if (sheets.length < 2) {
  console.log(`EXIT 3 — floor is 2 seated diner atlases, found ${sheets.length}.`);
  await b.close(); process.exit(3);
}

// blow it up 8x with nearest-neighbour and rule the seat line across it
for (let i = 0; i < sheets.length; i++) {
  const s = sheets[i];
  const big = await p.evaluate(async ([dataUrl, W, H, originRow, ROWS]) => {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = dataUrl; });
    const S = 8;
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, 0, 0, c.width, c.height);
    // the seat line, on BOTH stacked frames
    g.strokeStyle = '#ff2b2b'; g.lineWidth = 2;
    for (const f of [0, 1]) {
      const y = (f * ROWS + originRow) * S;
      g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke();
    }
    // frame gutters
    g.strokeStyle = 'rgba(0,255,255,0.5)'; g.lineWidth = 1;
    for (let v = 1; v < 5; v++) { g.beginPath(); g.moveTo(v * 32 * S, 0); g.lineTo(v * 32 * S, c.height); g.stroke(); }
    return c.toDataURL('image/png');
  }, [s.png, s.w, s.h, s.originRow, s.ROWS]);
  const path = `shots/w112-atlas-${i}-${TAG}.png`;
  writeFileSync(path, Buffer.from(big.split(',')[1], 'base64'));
  console.log(`${path}   ${s.w}x${s.h}   origin(seat) row ${s.originRow.toFixed(2)} of ${s.ROWS}`);
}
await b.close();

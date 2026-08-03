// ITEM 286 — a tight crop on the JAIL BUNK sitter, the one seat whose seatFwd
// survives the reconciliation (0.960 - 0.356 = 0.604 m).
//
// The cell is LOCKED, so the corridor is the only vantage there is and the
// figure sits ~2.4 m back behind bars — `w113-280-bunk-look.mjs` frames the
// whole cell and the man comes out about 40 px tall, which is not something a
// person can form an opinion about. This projects him through the live camera
// and crops at 4x, the way `w112-seated-zoom.mjs` does for the diner.
//
// Usage: SHOT_URL=http://localhost:4712/ node scripts/probes/w115-bunk-zoom.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const TAG = process.env.TAG || 'now';
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

// The seated citizen in the JAIL with the most negative z is the bunk man;
// the other jail sitter is the lobby bench at z = 10. Found by position rather
// than by index, because a census order is not a contract.
const s = await p.evaluate(() => {
  let best = null;
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (q.x > 980 && q.x < 1010 && (!best || q.z < best.z)) best = { x: q.x, y: q.y, z: q.z };
  });
  return best;
});
if (!s) { console.log('EXIT 3 — no jail sitter found; measured nothing.'); await b.close(); process.exit(3); }
console.log(`bunk sitter at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);

// Stand in the corridor, outside the bars, looking along -x at him.
// ZOFF slides the eye along the bars. Dead level with him (0) a bar sits
// exactly on the sightline and hides the man this probe exists to photograph —
// the corridor's own grille pitch, not a fact about his legs.
const camX = Number(process.env.CAMX ?? 997.8);
const ZOFF = Number(process.env.ZOFF ?? 0);
const camZ = s.z + ZOFF;
const yaw = Math.atan2(s.x - camX, -(s.z - camZ));
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.06), [camX, camZ, yaw]);
await waitPainted(p, { quiet: true });

const box = await p.evaluate(([x, y, z]) => {
  const cam = window.__ct.camera();
  const V = window.__ct.scene().position.constructor;
  const prj = (wx, wy, wz) => {
    const v = new V(wx, wy, wz).project(cam);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  };
  return { head: prj(x, y + 1.0, z), foot: prj(x, 0, z), W: window.innerWidth, H: window.innerHeight };
}, [s.x, s.y, s.z]);

const h = Math.max(90, (box.foot.y - box.head.y) * 1.5);
const cw = Math.round(h * 1.3), ch = Math.round(h);
const cx0 = Math.max(0, Math.min(box.W - cw, Math.round((box.head.x + box.foot.x) / 2 - cw / 2)));
const cy0 = Math.max(0, Math.min(box.H - ch, Math.round(box.head.y - h * 0.15)));
const buf = await p.screenshot({ clip: { x: cx0, y: cy0, width: cw, height: ch } });
const big = await p.evaluate(async ([b64, w, hh]) => {
  const im = new Image();
  await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
  const S = 4;
  const c = document.createElement('canvas');
  c.width = w * S; c.height = hh * S;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}, [buf.toString('base64'), cw, ch]);
const path = `shots/w115-bunk-${TAG}.png`;
writeFileSync(path, Buffer.from(big.split(',')[1], 'base64'));
console.log(`${path}  crop ${cw}x${ch} at 4x`);
await b.close();

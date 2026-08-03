// ITEM 272 — A TIGHT CROP ON ONE SITTER, so "is there a leg" is not a squint.
//
// Stands square out from each seated customer in the diner aisle (90 deg off
// his facing, which is the PROFILE column and the view the aisle gives you),
// projects him through the live camera, and crops a box around him at 4x.
//
// TAG=before / TAG=after names the files.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const TAG = process.env.TAG || 'now';
const BACK = Number(process.env.BACK ?? 2.0);      // metres out into the aisle
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });

const sitters = await p.evaluate(([cx, cz, w, d]) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (q.x >= cx - w / 2 && q.x <= cx + w / 2 && q.z >= cz - d / 2 && q.z <= cz + d / 2) out.push({ x: q.x, y: q.y, z: q.z });
  });
  return out;
}, [room.cx, room.cz, room.w, room.d]);
if (sitters.length < 2) { console.log(`EXIT 3 — floor 2, found ${sitters.length}`); await b.close(); process.exit(3); }

const dir = Math.sign(room.cz - sitters[0].z) || -1;
for (let i = 0; i < sitters.length; i++) {
  const s = sitters[i];
  const sx = s.x, sz = s.z + dir * BACK;
  const yaw = Math.atan2(s.x - sx, -(s.z - sz));   // rig yaw: 0 looks down −z
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.16), [sx, sz, yaw]);
  await waitPainted(p, { quiet: true });
  // project his hip and his feet through the LIVE camera — no screen maths typed
  const box = await p.evaluate(([x, y, z]) => {
    const cam = window.__ct.camera();
    const V = window.__ct.scene().position.constructor;   // THREE.Vector3
    const prj = (wx, wy, wz) => {
      const v = new V(wx, wy, wz).project(cam);
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
    };
    const head = prj(x, y + 1.25, z), foot = prj(x, 0, z);
    return { head, foot, W: window.innerWidth, H: window.innerHeight };
  }, [s.x, s.y, s.z]);
  const h = Math.max(80, (box.foot.y - box.head.y) * 1.25);
  const cw = Math.round(h * 1.1), ch = Math.round(h);
  const cx0 = Math.max(0, Math.min(box.W - cw, Math.round((box.head.x + box.foot.x) / 2 - cw / 2)));
  const cy0 = Math.max(0, Math.min(box.H - ch, Math.round(box.head.y - h * 0.08)));
  const buf = await p.screenshot({ clip: { x: cx0, y: cy0, width: cw, height: ch } });
  const big = await p.evaluate(async ([b64, w, hh]) => {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
    const S = 3;
    const c = document.createElement('canvas');
    c.width = w * S; c.height = hh * S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, [buf.toString('base64'), cw, ch]);
  const path = `shots/w112-zoom-${i}-${TAG}.png`;
  writeFileSync(path, Buffer.from(big.split(',')[1], 'base64'));
  console.log(`${path}   sitter (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  from ${BACK} m  crop ${cw}x${ch}`);
}
await b.close();

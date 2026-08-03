// The picture and the number disagree about jail (994.02, 10.00), so measure the
// thing between them: where does `w112-legs-below-the-seat.mjs` think the SEAT
// LINE is, and where do the sprite's pixels actually end?
//
// The check's verdict "NO LEG BELOW THE SEAT" is `d.below == 0`, and `below`
// counts differing pixels with screen row `r > seatRow`, where
// `seatRow = project(o.position).y` — the seated origin, which citizenPlane
// contracts to be the HIP. If the sprite's painted rows all land ABOVE that
// line, the fault is the line, not the legs.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-jail-seatrow.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.roomDims !== undefined, { timeout: 60000 });
await reportWorld(p, URL);
await waitPainted(p, { quiet: true });
await p.evaluate(() => window.__ct.clock(13, 0));

const sitters = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const out = [];
  window.__W117 = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    const r = rooms.find((m) => Math.abs(q.x - m.cx) <= m.w / 2 && Math.abs(q.z - m.cz) <= m.d / 2);
    window.__W117.push(o);
    out.push({ room: r ? r.id : 'OUTSIDE', x: q.x, y: q.y, z: q.z, cz: r ? r.cz : q.z - 2 });
  });
  return out;
});

console.log('\nroom       hip world y   seatRow px   spriteTop   spriteBot   lowest differing row   px/texel');
for (let i = 0; i < sitters.length; i++) {
  const s = sitters[i];
  if (s.room !== 'jail' && s.room !== 'diner') continue;   // one broken, one known-good
  const dir = Math.sign(s.cz - s.z) || -1;
  const sz = s.z + dir * 2.0;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.14), [s.x, sz, Math.atan2(0, -(s.z - sz))]);
  await waitPainted(p, { quiet: true });
  const geo = await p.evaluate(([idx]) => {
    const o = window.__W117[idx];
    const cam = window.__ct.camera();
    const V = window.__ct.scene().position.constructor;
    const prj = (wx, wy, wz) => {
      const v = new V(wx, wy, wz).project(cam);
      return (-v.y * 0.5 + 0.5) * window.innerHeight;
    };
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox;
    return {
      seatRow: prj(o.position.x, o.position.y, o.position.z),
      top: prj(o.position.x, o.position.y + g.max.y * o.scale.y, o.position.z),
      bot: prj(o.position.x, o.position.y + g.min.y * o.scale.y, o.position.z),
      posY: o.position.y, minY: g.min.y * o.scale.y, maxY: g.max.y * o.scale.y,
    };
  }, [i]);
  const a = await p.screenshot();
  await p.evaluate(([idx]) => { window.__W117[idx].visible = false; }, [i]);
  await waitPainted(p, { quiet: true });
  const c = await p.screenshot();
  await p.evaluate(([idx]) => { window.__W117[idx].visible = true; }, [i]);
  const px = await p.evaluate(async ([A, C, seatRow]) => {
    const load = async (b64) => {
      const im = new Image();
      await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      cv.getContext('2d').drawImage(im, 0, 0);
      return { d: cv.getContext('2d').getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height };
    };
    const x = await load(A), y = await load(C);
    let lowest = -1, highest = 1e9, n = 0, below = 0;
    for (let r = 0; r < x.h; r++) {
      for (let q = 0; q < x.w; q++) {
        const k = (r * x.w + q) * 4;
        if (Math.abs(x.d[k] - y.d[k]) > 8 || Math.abs(x.d[k + 1] - y.d[k + 1]) > 8
          || Math.abs(x.d[k + 2] - y.d[k + 2]) > 8) {
          n++; if (r > lowest) lowest = r; if (r < highest) highest = r;
          if (r > seatRow) below++;
        }
      }
    }
    return { n, lowest, highest, below };
  }, [a.toString('base64'), c.toString('base64'), geo.seatRow]);
  console.log(`${s.room.padEnd(10)} ${s.y.toFixed(3).padStart(9)}   ${geo.seatRow.toFixed(1).padStart(9)}`
    + `   ${geo.top.toFixed(1).padStart(9)}   ${geo.bot.toFixed(1).padStart(9)}`
    + `   rows ${px.highest}..${px.lowest} (${px.n} px, ${px.below} below)`);
  console.log(`           mesh.position.y ${geo.posY.toFixed(3)}  bbox ${geo.minY.toFixed(3)}..${geo.maxY.toFixed(3)}`);
}
await b.close();

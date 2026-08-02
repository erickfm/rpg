// H (verifier): C's TV row, at C's own published station.
// "stand in 301 at (198.30, -16.30), press E, and you are sitting on the bed
// facing the set."
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const S = [198.30, -16.30];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp && window.__ct.seated, null, { timeout: 60000 });
const prompt = () => p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || [''])[0]);
const st = () => p.evaluate(() => ({ seated: window.__ct.seated(), pos: window.__ct.pos(), yaw: window.__ct.yaw() }));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0), S);
await p.waitForTimeout(700);
console.log('standing at', S.join(', '));
console.log('  seated before:', JSON.stringify(await st()));
console.log('  prompt:', await prompt() || '(nothing)');
await p.screenshot({ path: 'shots/H-tv-standing.png' });
// CLICK FIRST. My first run pressed E with the page never clicked and nothing
// happened - and I nearly filed that as "sit does not work". packages.mjs
// clicks before its E press, which is what gives the canvas keyboard focus.
// This is E's trap on C's door row: the dispatch is fine, the harness was not.
await p.mouse.click(480, 300);
await p.waitForTimeout(250);
await p.keyboard.press('KeyE');
await p.waitForTimeout(900);
const after = await st();
console.log('  seated after E:', JSON.stringify(after));
console.log('  prompt now:', await prompt() || '(nothing)');
await p.screenshot({ path: 'shots/H-tv-seated.png' });
// and STAND again - the third of C's SIT / WATCH / STAND
await p.keyboard.press('KeyE');
await p.waitForTimeout(900);
const back = await st();
console.log('  after 2nd E:', JSON.stringify(back));
console.log('  prompt now:', await prompt() || '(nothing)');
// the seat's declared height against the real top beneath it
const seat = await p.evaluate(() => {
  const s = window.__ct.seats().find((q) => /tv|bed/i.test(q.label));
  if (!s) return null;
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  let top = null;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, e = o.matrixWorld.elements, pts = [];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z])
      pts.push([e[0]*X+e[4]*Y+e[8]*Z+e[12], e[1]*X+e[5]*Y+e[9]*Z+e[13], e[2]*X+e[6]*Y+e[10]*Z+e[14]]);
    const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]), zs=pts.map(q=>q[2]);
    if (s.pose.x < Math.min(...xs)-0.02 || s.pose.x > Math.max(...xs)+0.02) return;
    if (s.pose.z < Math.min(...zs)-0.02 || s.pose.z > Math.max(...zs)+0.02) return;
    const y1 = Math.max(...ys);
    if (y1 > s.pose.h + 0.35 || y1 < 0.15) return;
    if (top === null || y1 > top) top = y1;
  });
  return { label: s.label, x: s.pose.x, z: s.pose.z, h: s.pose.h, top };
});
console.log('  seat:', JSON.stringify(seat));
await b.close();

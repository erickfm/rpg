// VERIFYING L's SLOTS ROW — starting with the claim that collides with a bug I
// measured two rounds ago.
//
// L: "sit at any of the 96 stools in SEVENS and it opens because you SAT, not
// on a second [E]. ESC leaves and pays you out on the way."
//
// I measured that **69 of 225 seats have a rival spot at EXACTLY 0.00 m, every
// one sampled a casino slot stool**, and that a seated player at the bed in 301
// cannot stand up at all — the resolver offers the SIT spot, which is dead. If
// that reaches the stools, a player who sits down to play cannot get up, and a
// slots panel on top of it is a second door to be trapped behind.
//
// So: sit at a real stool, check the panel opens on the SIT, then check the way
// OUT — both of them, ESC and standing.
//
// And the headline number gets an independent arithmetic check: "RTP 92.834%,
// the EXACT enumeration of all 22^3 = 10,648 stop combinations". `__slots.rtp()`
// recomputes it; if it disagrees with the row, the row is stale.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const api = await p.evaluate(() => ({
  slots: typeof window.__slots?.open, rtp: typeof window.__slots?.rtp,
  cash: typeof window.__slots?.cash, panel: typeof window.__hud?.panel,
}));
console.log('\n── affordances ──\n  ' + JSON.stringify(api));

// ── the arithmetic, independently recomputed by the module itself ────────
const rtp = await p.evaluate(() => window.__slots.rtp());
console.log('\n── the headline number ──');
console.log(`  __slots.rtp() = ${JSON.stringify(rtp)}`);
console.log(`  the row claims RTP 92.834% over 22^3 = ${22 ** 3} combinations`);

// ── a REAL stool, found by the world rather than by a coordinate ─────────
const stool = await p.evaluate(() => {
  // FIND THE CASINO BY WHAT IT DECLARES, NOT BY A REMEMBERED x RANGE. My first
  // pass filtered seats to x 590-620 because that is where the casino used to
  // be; the interiors have shifted +80 m since (ct/int-bank.ts was inserted
  // ahead of them) and 598 is now the BURGER BARN. The probe warped into it,
  // got "[E] order a barn burger" and reported the slots panel as not opening.
  // That is my own documented trap, walked into by me.
  //
  // ct/int-casino.ts declares d: 36.0 — much the longest room in the world.
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    if (w.max.y > 0.35 || w.max.y - w.min.y > 0.35) return;
    m.push(w);
  });
  let floor = null;
  for (const q of m) {
    const d = q.max.z - q.min.z;
    if (d < 30) continue;
    if (!floor || Math.abs(d - 36) < Math.abs((floor.max.z - floor.min.z) - 36)) floor = q;
  }
  if (!floor) return null;
  const cx = (floor.min.x + floor.max.x) / 2;
  const seats = (window.__ct.seats() || []).filter((q) => Math.abs(q.pose.x - cx) < 10);
  return seats.length
    ? { n: seats.length, cx: +cx.toFixed(1), depth: +(floor.max.z - floor.min.z).toFixed(1),
        pose: seats[0].pose, at: seats[0].at, label: seats[0].label }
    : null;
});
console.log('\n── a slot stool, taken from the seat registry ──');
if (!stool) { console.log('  none found in the casino belt'); await b.close(); process.exit(1); }
console.log(`  ${stool.n} stools; first at ${JSON.stringify(stool.pose)}  approach ${JSON.stringify(stool.at)}`);
console.log(`  its label: ${JSON.stringify(stool.label)}`);

const st = () => p.evaluate(() => ({
  seated: typeof window.__ct.seated === 'function' ? !!window.__ct.seated() : null,
  panel: window.__hud?.panel ? window.__hud.panel() : undefined,
  pos: window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)),
  prompt: (() => {
    const e = [...document.querySelectorAll('*')]
      .find((q) => /\[E\]/.test(q.textContent || '') && q.children.length === 0);
    return e ? e.textContent.trim() : '';
  })(),
}));

await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [stool.at.x, stool.at.z]);
await settle(p);
console.log(`\n  standing at the stool   ${JSON.stringify(await st())}`);
await p.keyboard.press('e');
await p.waitForTimeout(1300);
const seated = await st();
console.log(`  after E                 ${JSON.stringify(seated)}`);
console.log(`  -> the panel opened ON THE SIT, no second key: ` +
  (seated.panel ? `YES (${seated.panel})` : 'NO'));
await p.screenshot({ path: 'shots/B-verify-L/slots-seated.png' });

// ── THE WAY OUT, which is where my seat finding bites ────────────────────
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
const afterEsc = await st();
console.log(`\n  after ESC               ${JSON.stringify(afterEsc)}`);
console.log(`  -> ESC closed the panel: ${afterEsc.panel ? 'NO — still ' + afterEsc.panel : 'YES'}`);
console.log(`  -> still seated afterwards: ${afterEsc.seated ? 'YES' : 'no'}`);

for (let i = 1; i <= 3; i++) {
  await p.keyboard.press('e');
  await p.waitForTimeout(1000);
  const q = await st();
  console.log(`  E to stand #${i}          ${JSON.stringify(q)}`);
  if (!q.seated) { console.log('  -> STOOD UP'); break; }
  if (i === 3) console.log('  -> STILL SEATED after three presses — the stuck seat reaches the stools');
}
await b.close();

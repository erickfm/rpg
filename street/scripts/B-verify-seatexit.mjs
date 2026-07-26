// VERIFYING C's SEAT-EXIT ROW — and trying to hand C the reproduction it says
// it could not get.
//
// C: "I could not reproduce the stuck state, and I tried on both my build and
// the live integration world he actually plays: 6 yaws x 5 pitches gave
// `[E] stand up` in 45 of 45 look directions, and E stood him up 6 of 6."
//
// I THINK I HAVE IT. Verifying the TV row earlier I pressed E a second time to
// stand and nothing happened — position unchanged, `__ct.seated()` still
// returning the seat pose, a full second after the press. I wrote it off as my
// keypress landing wrong and did not file it; the user reported it himself. So
// the first job here is to reproduce that deliberately.
//
// C's own analysis says what to look for: standing up is an ORDINARY spot that
// has to win the E resolver, and while seated on the bed `sleep until morning`
// is live at 0.55 m. If E fires sleep instead of stand, THE CLOCK JUMPS — that
// is a fingerprint, and it distinguishes "E did nothing" from "E did the wrong
// thing", which want different fixes.
//
// Then the census, independently: "of 225 seats, 149 have a non-stand spot
// inside the 0.5 m stand radius, and 12+ have one at EXACTLY 0.00 m."
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(23, 10));
await settle(p);

const state = () => p.evaluate(() => ({
  seated: typeof window.__ct.seated === 'function' ? !!window.__ct.seated() : null,
  pos: window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)),
  clock: window.__ct.clockNow().totalMin,
  prompt: (() => {
    const el = [...document.querySelectorAll('*')]
      .find((e) => /\[E\]/.test(e.textContent || '') && e.children.length === 0);
    return el ? el.textContent.trim() : '';
  })(),
}));

console.log('\n── trying to reproduce the stuck seat ──');
let s = await state();
console.log(`  standing   ${JSON.stringify(s)}`);
await p.keyboard.press('e');
await p.waitForTimeout(1200);
s = await state();
console.log(`  after E    ${JSON.stringify(s)}`);
const seatedAt = s;

// press E again, with a full second either side, and watch BOTH outcomes:
// did nothing happen, or did the wrong spot fire?
for (let i = 1; i <= 3; i++) {
  await p.keyboard.press('e');
  await p.waitForTimeout(1100);
  const q = await state();
  const stood = seatedAt.seated && !q.seated;
  const slept = q.clock - seatedAt.clock > 30;
  console.log(`  E #${i + 1}      ${JSON.stringify(q)}`);
  console.log(`      -> ${stood ? 'STOOD UP' : slept ? 'THE WRONG SPOT FIRED — the clock jumped'
    : 'NOTHING HAPPENED — still seated, clock unmoved'}`);
  if (stood) break;
}

// ── the census, independently ────────────────────────────────────────────
const cen = await p.evaluate(() => {
  const seats = window.__ct.seats ? window.__ct.seats() : [];
  const spots = window.__ct.spots ? window.__ct.spots() : [];
  let inside = 0, exact = 0;
  const zeros = [];
  for (const st of seats) {
    // the STAND spot is registered on the seat itself; every OTHER spot within
    // the stand radius is a rival for the same key press
    for (const sp of spots) {
      const d = Math.hypot(sp.x - st.pose.x, sp.z - st.pose.z);
      if (d > 0.5) continue;
      if (/stand/i.test(sp.label || '')) continue;
      inside++;
      if (d < 0.005) { exact++; zeros.push([+st.pose.x.toFixed(1), +st.pose.z.toFixed(1), sp.label]); }
      break;
    }
  }
  return { seats: seats.length, spots: spots.length, inside, exact, zeros: zeros.slice(0, 6) };
});
console.log('\n── C\'s census, re-counted ──');
console.log(`  ${cen.seats} seats, ${cen.spots} spots in the world`);
console.log(`  seats with a NON-STAND spot inside the 0.5 m stand radius: ${cen.inside}` +
  `   (C says 149 of 225)`);
console.log(`  seats with one at EXACTLY 0.00 m: ${cen.exact}   (C says 12+)`);
for (const z of cen.zeros) console.log(`      (${z[0]}, ${z[1]})  rival spot: ${z[2]}`);
await b.close();

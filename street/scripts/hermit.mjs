// THE NEIGHBOUR LEAVES LIKE A PERSON — the user: *"neighbor just disappears
// when he goes away why not make him go in his apt and then close the door"*.
//
// The thing that used to be wrong is not visible in a screenshot, because it
// was a TRANSITION: a man on a landing stopped existing between one frame and
// the next. So this samples the sequence continuously and asserts the
// invariant that the request really is — HE IS NEVER SEEN TO DISAPPEAR:
// `visible` may only go true->false while he is back behind his own doorway
// with the door shut.
//
// The world publishes `scene.userData.hermit` = {phase, x, door, visible};
// nothing here infers the state from a sprite position.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const X_IN = 2.52, X_OUT = 1.95, D_SHUT = Math.PI / 2, D_OPEN = Math.PI - 0.28;
const APT_X = 200, APT_Z = -20, ST = 2.7;
const AX = (v) => APT_X + v, AZI = (v) => APT_Z + v;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 900));

let fails = 0;
const rep = (n, ok, d) => { if (!ok) fails++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${d}`); };
const H = () => p.evaluate(() => window.__ct.scene().userData.hermit);
const force = (v) => p.evaluate((q) => window.__ct.hermit(q), v);
const stand = (x, z) => p.evaluate(([a, c]) => window.__ct.warp(a, c, Math.PI / 2, 2 * 2.7, 0), [x, z]);

if (!(await H())) {
  console.error('\nscene.userData.hermit is missing — nothing was watched. Not a pass.');
  await b.close(); process.exit(3);                       // GOTCHAS 32: 3, not 1
}

// ── 1. shut and empty on load ──────────────────────────────────────────────
await stand(AX(0.6), AZI(3.5));
await p.waitForTimeout(400);
let h = await H();
rep('shut and empty on load', h.phase === 'in' && !h.visible && Math.abs(h.door - D_SHUT) < 0.02,
  `phase ${h.phase}, visible ${h.visible}, door ${h.door.toFixed(3)} (shut is ${D_SHUT.toFixed(3)})`);

// ── 2. a whole cycle, sampled, watching for a vanish ───────────────────────
// Sample fast and keep every phase change AND every visibility change. A
// disappearance is a visible->invisible edge anywhere except back inside.
const trace = [];
let badVanish = null, prev = null;
const watch = async (ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const q = await H();
    if (prev && prev.visible && !q.visible) {
      const home = Math.abs(q.x - X_IN) < 0.03 && Math.abs(q.door - D_SHUT) < 0.05;
      if (!home) badVanish = { x: +q.x.toFixed(2), door: +q.door.toFixed(2), phase: q.phase };
    }
    if (!prev || prev.phase !== q.phase) trace.push({ ...q, t: (Date.now() - t0) / 1000 });
    prev = q;
    await p.waitForTimeout(60);
  }
};
await force(true);
await watch(7000);
const outAt = trace.find((q) => q.phase === 'out');
const loiterAt = trace.find((q) => q.phase === 'loiter');
rep('the door opens BEFORE he steps out', !!outAt && Math.abs(outAt.door - D_OPEN) < 0.05,
  outAt ? `door was ${outAt.door.toFixed(2)} when he started walking (open is ${D_OPEN.toFixed(2)})` : 'he never stepped out');
rep('he WALKS out, not teleports', !!loiterAt && !!outAt && loiterAt.t - outAt.t > 0.5,
  outAt && loiterAt ? `${(X_IN - X_OUT).toFixed(2)} m took ${(loiterAt.t - outAt.t).toFixed(2)} s` : 'no walk observed');

await force(false);
await watch(9000);
const backAt = trace.find((q) => q.phase === 'back');
const closeAt = trace.find((q) => q.phase === 'closing');
const inAt = trace.filter((q) => q.phase === 'in').pop();
rep('he WALKS back in', !!backAt && !!closeAt && closeAt.t - backAt.t > 0.5,
  backAt && closeAt ? `took ${(closeAt.t - backAt.t).toFixed(2)} s` : 'he never walked back');
rep('the door closes AFTER he is through', !!closeAt && Math.abs(closeAt.x - X_IN) < 0.03,
  closeAt ? `he was at x ${closeAt.x.toFixed(2)} when it started closing (inside is ${X_IN})` : 'never closed');
rep('and it ends shut and empty', !!inAt && Math.abs(inAt.door - D_SHUT) < 0.05,
  inAt ? `door ${inAt.door.toFixed(2)}` : 'never returned to in');
rep('HE IS NEVER SEEN TO DISAPPEAR', !badVanish,
  badVanish ? `went invisible at x ${badVanish.x}, door ${badVanish.door}, phase ${badVanish.phase}`
            : 'visible->invisible happens only behind a shut door, every time');

// ── 3. the schedule expiring mid-step does not delete him ──────────────────
await force(null); await p.waitForTimeout(300);
await force(true);
await p.waitForFunction(() => window.__ct.scene().userData.hermit.phase === 'out', { timeout: 8000 }).catch(() => {});
await force(false);                                        // yank it mid-stride
let survived = true, sawLoiter = false;
for (let i = 0; i < 90; i++) {
  const q = await H();
  if (q.phase === 'loiter') sawLoiter = true;
  if (q.phase === 'in' && !sawLoiter) survived = false;
  await p.waitForTimeout(70);
}
rep('pulling the schedule mid-step does not delete him', survived && sawLoiter,
  survived ? 'he finished the step out, stood, then went back in' : 'he snapped back to `in` mid-sequence');

// ── 4. he waits for you rather than walking through you ────────────────────
await force(null); await p.waitForTimeout(200);
await force(true);
await p.waitForFunction(() => window.__ct.scene().userData.hermit.phase === 'loiter', { timeout: 9000 }).catch(() => {});
await stand(AX(2.24), AZI(3.5));                            // stand IN his doorway
await p.waitForTimeout(300);
await force(false);
await p.waitForTimeout(4000);
h = await H();
const held = h.phase === 'back' && h.x < X_IN - 0.05;
rep('he waits rather than walking through you', held || h.phase === 'loiter',
  `phase ${h.phase}, x ${h.x.toFixed(2)} with the player standing at x 2.24 — he stops short of ${X_IN}`);
await p.screenshot({ path: 'shots/hermit-blocked.png' });
await stand(AX(0.6), AZI(3.5));                             // step aside
await p.waitForTimeout(3500);
h = await H();
rep('and resumes once you move aside', h.phase === 'in' || h.x > X_IN - 0.05,
  `phase ${h.phase}, x ${h.x.toFixed(2)}`);

// ── 5. still rare, and still not fired by the player ───────────────────────
// The frequency work this supersedes must survive it: he is on an HOUR
// schedule with a cooldown, and nothing the player does may summon him.
await force(null);
await p.waitForTimeout(300);
let fired = 0, prevPhase = (await H()).phase;
for (let i = 0; i < 12; i++) {
  await p.evaluate(([a, c]) => window.__ct.warp(a, c, Math.PI / 2, 2 * 2.7, 0), [AX(-1.4), AZI(3.7)]);
  await p.waitForTimeout(240);
  await stand(AX(0.9), AZI(3.5));
  await p.waitForTimeout(240);
  const now = (await H()).phase;
  if (now !== 'in' && prevPhase === 'in') fired++;
  prevPhase = now;
}
rep('walking in and out of 301 a dozen times does not summon him', fired === 0,
  `${fired} of 12 trips were followed by him coming out`);

// Ask the SCHEDULE, not the phase. Stepping the clock and reading `phase`
// counts him as out for as long as he is mid-walk, which reported 65% of
// hours for a schedule that fires in 4% of them.
const wants = await p.evaluate(async () => {
  const r = [];
  for (let h = 0; h < 168; h++) {
    window.__ct.clock(h % 24, 0);
    await new Promise((q) => requestAnimationFrame(q));
    await new Promise((q) => requestAnimationFrame(q));
    r.push(window.__ct.scene().userData.hermit.wants);
  }
  return r;
});
const outN = wants.filter(Boolean).length;
rep('and he is still rare', outN > 0 && outN / wants.length < 0.15,
  `out in ${outN} of ${wants.length} sampled hours — ${(100 * outN / wants.length).toFixed(0)}%`);

await force(null);
await b.close();
console.log(fails ? `\n  ${fails} failed\n` : '\n  he opens his door, steps out, goes back in and shuts it behind him.\n');
process.exit(fails ? 1 : 0);

// I's ROW SAYS A SLOT STOOL IS A SEAT TRAP. I VERIFIED L's ROW AND STOOD UP.
//
// One of us is wrong, or the world moved between us, and it matters: I's row
// puts the blast radius at 96 of 225 seats — 43% of every seat in the game.
//
// I's predicate, used verbatim rather than reinvented: warp to a stool's
// published `at`, press E to sit, press E, press Escape — `seated()` stays true
// through both, and `#ct-panelback` is in the document.
//
// My own earlier run at build bcff6ff8f reported: after E, panel ct-slots and
// prompt "[E] stand up"; after ESC, panel null, still seated; then E stood me
// up on the first press. If that no longer happens, either it regressed or MY
// TEST WAS WRONG — and if it was wrong I have to correct my confirmation of L's
// row, which rests on the same measurement.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto, settle } from '../lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const stool = await p.evaluate(() => {
  const s = (window.__ct.seats() || []).filter((q) => /sit at the slot/i.test(q.label || ''));
  return s.length ? { n: s.length, at: s[0].at, pose: s[0].pose } : null;
});
if (!stool) { console.log('no slot stools found'); await b.close(); process.exit(1); }
console.log(`\n  ${stool.n} stools labelled "sit at the slot"; using approach ${JSON.stringify(stool.at)}`);

const st = () => p.evaluate(() => ({
  seated: typeof window.__ct.seated === 'function' ? !!window.__ct.seated() : null,
  panelback: !!document.getElementById('ct-panelback'),
  panel: window.__hud?.panel ? window.__hud.panel() : undefined,
  pos: window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)),
}));

await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0), [stool.at.x, stool.at.z]);
await settle(p);
console.log(`  standing   ${JSON.stringify(await st())}`);
await p.keyboard.press('e');
await p.waitForTimeout(1300);
console.log(`  after E    ${JSON.stringify(await st())}`);
await p.keyboard.press('e');
await p.waitForTimeout(1100);
const afterE2 = await st();
console.log(`  after E#2  ${JSON.stringify(afterE2)}`);
await p.keyboard.press('Escape');
await p.waitForTimeout(1100);
const afterEsc = await st();
console.log(`  after ESC  ${JSON.stringify(afterEsc)}`);

console.log(`\n  I's predicate — seated stays true through both AND #ct-panelback present:`);
console.log(`     seated after E#2 and ESC: ${afterE2.seated} / ${afterEsc.seated}`);
console.log(`     #ct-panelback present:    ${afterE2.panelback} / ${afterEsc.panelback}`);
const trapped = afterE2.seated && afterEsc.seated;
console.log(`  -> ${trapped ? 'TRAPPED — I is right and my earlier run does not reproduce'
                            : 'NOT TRAPPED — you can get out'}`);

// IS THE KEY EVEN REACHING THE GAME? That is the mechanism I's row names —
// hud.ts:168 lists keydown in BLOCKED. Watch the listener rather than guess.
const reaches = await p.evaluate(async () => {
  let saw = false;
  const spy = () => { saw = true; };
  window.addEventListener('keydown', spy, false);           // NOT capture: same
  await new Promise((r) => setTimeout(r, 50));              // phase the game uses
  return new Promise((r) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    setTimeout(() => { window.removeEventListener('keydown', spy); r(saw); }, 120);
  });
});
console.log(`  a bubbling keydown still reaches window while the panel is up: ${reaches}`);
await b.close();

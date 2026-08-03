// ITEM 285 — the ATM prompts at yaw 0 and the press does nothing. WHICH IS IT:
// never opened, or opened and shut again?
//
// onehundredfifteen scoped this and left exactly one measurement undone
// (`notes/onehundredfifteen-item285-scoping.md` §6):
//
//   *"Sample the panel repeatedly across the press rather than once at the end —
//    a single late read cannot tell 'never opened' from 'opened and shut'."*
//
// That is this. Two other things it asked for are here too:
//
//   §4  THE OLD PROBE WARPED TO THE SPOT'S OWN CENTRE, which is `x = -FACE` —
//       inside the bank facade. Where the player then ends up is decided by the
//       rig's `unstick`, not by the probe, and `pickSpot`'s tier 1 is `d < RADIUS`
//       ("the spot's centre is inside your own body"), which wins REGARDLESS OF
//       YAW. So the old yaw sweep was partly measuring how far a wall shoved the
//       player. Every station here is checked against where the player actually
//       landed, and any station that moved more than 0.15 m is reported as such
//       instead of being quietly averaged in.
//   §3  AT (-7, 8.238) YAW 0 THE PROMPT IS THE BANK DOOR, not the ATM, so
//       `panel=null` there is CORRECT. This prints the prompt for every station so
//       that case can never be scored as a lie again.
//
// It PRINTS. The verdict is a sentence someone writes after reading it.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item285-atm-press.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4482/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);
await p.waitForTimeout(700);

const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  return el && getComputedStyle(el).display !== 'none' ? (el.textContent ?? '').trim() : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });

const atm = await p.evaluate(() => (window.__ct.spots?.() ?? [])
  .map((s) => ({ label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z, r: s.r }))
  .filter((s) => /use the machine/i.test(s.label) && Math.abs(s.x + 7) < 2));
if (!atm.length) { console.error('CANNOT ANSWER — no ATM spot registered.'); await b.close(); process.exit(3); }
console.log(`world  ${URL}`);
for (const s of atm) console.log(`ATM    "${s.label}" at (${s.x}, ${s.z}) r${s.r}`);

// WHICH SIDE IS THE STREET? Derived, not typed. The facade runs along x = -FACE
// and the building is behind it; the walkable side is whichever of x±d the
// player can stand on without being moved. Ask the world rather than reading
// `bank.ts` and hoping the sign is what I think it is.
const STANDOFF = [0.9, 1.2, 1.6];
const side = await (async () => {
  for (const sgn of [+1, -1]) {
    const x = atm[0].x + sgn * 1.2, z = atm[0].z;
    const gy = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
    await p.evaluate(([a, c, g]) => window.__ct.warp(a, c, 0, g, 0), [x, z, gy]);
    await p.waitForTimeout(500);
    const at = await pos();
    if (Math.hypot(at.x - x, at.z - z) < 0.15) return sgn;
  }
  return 0;
})();
if (side === 0) { console.error('CANNOT ANSWER — neither side of the ATM is standable at 1.2 m.'); await b.close(); process.exit(3); }
console.log(`approach side: x ${side > 0 ? '+' : '-'} (the standable one, measured)\n`);

/** Press [E] HELD and watch the panel across the whole press.
 *  A single late read cannot tell "never opened" from "opened and shut". */
async function pressAndWatch() {
  const seen = [];
  await p.keyboard.down('e');
  await p.waitForTimeout(120);
  await p.keyboard.up('e');
  for (let i = 0; i < 15; i++) {
    seen.push(await panel());
    await p.waitForTimeout(100);
  }
  return seen;
}
const collapse = (seq) => {
  const out = [];
  for (const v of seq) if (!out.length || out[out.length - 1][0] !== v) out.push([v, 1]); else out[out.length - 1][1]++;
  return out.map(([v, n]) => `${v ?? 'null'}${n > 1 ? `x${n}` : ''}`).join(' -> ');
};

const YAWS = [['0', 0], ['pi/2', Math.PI / 2], ['pi', Math.PI], ['-pi/2', -Math.PI / 2]];
console.log('station                       drift   prompt                                  panel across 1.5 s');
for (const s of atm) {
  for (const d of STANDOFF) {
    for (const [name, yaw] of YAWS) {
      await p.evaluate(() => window.__hud.closePanels());
      await p.waitForTimeout(400);
      const x = s.x + side * d, z = s.z;
      const gy = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
      await p.evaluate(([a, c, y, g]) => window.__ct.warp(a, c, y, g, 0), [x, z, yaw, gy]);
      await p.waitForTimeout(700);
      const at = await pos();
      const drift = Math.hypot(at.x - x, at.z - z);
      const pr = await prompt();
      const seq = await pressAndWatch();
      // WHAT A DOOR DOES IS MOVE YOU. `panel=null` after pressing a door is the
      // CORRECT result, and scoring it as "the press did nothing" is how half
      // this row's evidence came to be a door working properly. So the travel is
      // recorded next to the panel: a prompt that says "into FIRST FEDERAL" is
      // honest if and only if pressing it puts you somewhere else.
      const after = await pos();
      const moved = Math.hypot(after.x - at.x, after.z - at.z);
      console.log(`  z${s.z.toFixed(3)} d${d.toFixed(1)} yaw ${name.padEnd(6)}  `
        + `${drift.toFixed(2)}   ${String(pr ?? '(none)').padEnd(38)}  `
        + `${collapse(seq).padEnd(12)}  moved ${moved.toFixed(2)} m`);
    }
  }
}
console.log(`\nconsole errors: ${errs.length}`);
await b.close();

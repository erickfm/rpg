// Item 279 — is the bare `press('e')` really the fault, or was the first press
// after a warp simply eaten?
//
// A/B'd properly: N bare taps in a row from a fresh stand, then a held press
// from the same stand. If a repeated tap eventually opens it, the tap is not
// the cause and something else is. Read-only.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const up = () => p.evaluate(() => window.__hud?.panel() ?? null);
const stand = async () => {
  await p.evaluate(() => { window.__hud?.closePanels?.(); });
  await p.waitForTimeout(650);                       // clear makePanel's 500 ms lockout
  await p.evaluate(() => window.__ct.warp(-6.0, 7.29, -Math.PI / 2, 0, 0));
  await p.waitForTimeout(420);
};

// FIRST: reproduce what the other probe did — a bare press with NO warm-up
// beyond the 420 ms D-walk waits. If this one alone fails, the fault is the
// world still starting up, not the tap.
await p.evaluate(() => window.__ct.warp(-6.0, 7.29, -Math.PI / 2, 0, 0));
await p.waitForTimeout(420);
await p.keyboard.press('e');
await p.waitForTimeout(900);
console.log(`COLD bare press, 420 ms after load: ${JSON.stringify(await up())}`);

await stand();
console.log(`start: __hud.panel() = ${JSON.stringify(await up())}`);
for (let i = 1; i <= 5; i++) {
  await p.keyboard.press('e');
  await p.waitForTimeout(600);
  console.log(`  bare press #${i}: ${JSON.stringify(await up())}`);
}
await stand();
console.log(`re-stand: ${JSON.stringify(await up())}`);
for (const ms of [16, 40, 80, 120]) {
  await stand();
  await p.keyboard.down('e'); await p.waitForTimeout(ms); await p.keyboard.up('e');
  await p.waitForTimeout(600);
  console.log(`  held ${String(ms).padStart(3)} ms: ${JSON.stringify(await up())}`);
}
// …and with playwright's own delay option, which is the same thing spelt shorter
await stand();
await p.keyboard.press('e', { delay: 120 });
await p.waitForTimeout(600);
console.log(`  press({delay:120}): ${JSON.stringify(await up())}`);
await b.close();

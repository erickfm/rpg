// ITEM 143 — LOOK at the caption. `[E]` is now the advertised way out, so the
// strip that used to read ESC has to read E, and the ONE panel that still needs
// Escape has to still say ESC. A caption that lies about the key is worse than
// the old behaviour, because the player believes it.
//
//   SHOT_URL=http://localhost:4192/ node scripts/probes/w58-caption-shots.mjs
//
// Shots are for LOOKING, never for proving — no pixel comparison happens here.
// Every frame is taken from the player's own standing position at the machine,
// not from a flying camera, because the caption's legibility at that distance is
// the thing being judged.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4192/');
const OUT = 'shots/w58';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct && window.__hud, { timeout: 20000 });
// `__ct` EXISTING IS NOT THE WORLD BEING DRAWN. The bridge is published while
// geometry and textures are still being built, so a frame grabbed straight
// after it appears can be solid black — which reads exactly like a culled or
// broken world and cost a round of bisecting against mainline to disprove.
// Give the first paint room, then confirm the canvas is not still blank.
await p.waitForTimeout(2500);

const spots = await p.evaluate(() => window.__ct.spots());
const at = (re) => spots.find((s) => re.test(s.label));
const settle = (ms = 260) => p.waitForTimeout(ms);
const shot = async (name) => {
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const cap = await p.evaluate(() => {
    const el = document.getElementById('ct-panelcap') || document.querySelector('[id*="cap"]');
    return el?.textContent ?? null;
  });
  console.log(`${name.padEnd(28)} caption=${JSON.stringify(cap)}`);
};

/** Stand `back` m off a spot facing it — forward is (sin yaw, −cos yaw). */
async function standAt(spot, back = 0.6) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [spot.x, spot.z - back, Math.atan2(0, -back)]);
  await settle();
}
async function tap(key, ms = 90) {
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await settle();
}

// 1. the ATM — diegetic, so the caption rides at the bottom of the frame
const atm = at(/FIRST FEDERAL — use the machine/);
await standAt(atm, 0.6);
await shot('01-atm-before-open');
await tap('e');
await shot('02-atm-open-caption-should-say-E');

// 2. the library terminal: desktop takes [E], the catalogue must still say ESC
await p.evaluate(() => window.__hud.closePanels());
await p.waitForTimeout(560);
await p.evaluate(() => { window.__librarypc.open(); window.__librarypc.goto('desktop'); });
await settle(320);
await shot('03-library-desktop-should-say-E');
await p.evaluate(() => window.__librarypc.goto('catalog'));
await settle(320);
await shot('04-library-catalogue-should-say-ESC');
for (const c of ['e', 'm', 'm', 'a']) await tap(c, 70);
await shot('05-library-catalogue-typed-emma');

// 3. a seated cabinet, sat on for real
await p.evaluate(() => window.__hud.closePanels());
await p.waitForTimeout(560);
const stool = at(/^sit at the slot$/);
await p.evaluate(([x, z]) => window.__ct.warp(x, z), [stool.x, stool.z]);
await settle(320);
await tap('e');
await shot('06-slots-seated-caption');

await b.close();
console.log(`\nshots in ${OUT}/ — LOOK at them, they prove nothing on their own`);

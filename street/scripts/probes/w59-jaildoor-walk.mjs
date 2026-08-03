// WALK to the jail door and go in. The leaf moved 0.09 m toward the player, so
// "it still looks right" is not enough — BUILDER-BRIEF §10, anything touching
// movement or a doorway is walked, not warped.
//
// Walks the last stretch of pavement on W, checks the [E] prompt appears, holds
// E (BUILDER-BRIEF §5 — a tapped key can begin and end inside one frame and is
// never observed), and asserts the player ends up in the jail interior, which
// ct/int-jail.ts builds in its own coordinate space at x > 400.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const CZ = -103, EAST = Math.PI / 2;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

// start well back on the pavement and WALK in
await p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0.14, 0), [56.5, CZ, EAST]);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1200);
const start = await p.evaluate(() => window.__ct.pos());
console.log('start   ', start.map((v) => (+v).toFixed(2)).join(', '));

await p.keyboard.down('w');
await p.waitForTimeout(2600);
await p.keyboard.up('w');
await p.waitForTimeout(400);
const atDoor = await p.evaluate(() => window.__ct.pos());
console.log('walked  ', atDoor.map((v) => (+v).toFixed(2)).join(', '));

// did walking get us closer to the door, or did the leaf stop us short?
const advanced = atDoor[0] - start[0];
console.log(`advanced ${advanced.toFixed(2)} m toward the facade (x=61)`);

const prompt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const hasPrompt = /HOUSE OF DETENTION/i.test(prompt);
console.log(`[E] prompt visible: ${hasPrompt}   ("${prompt.slice(0, 90)}")`);

// HELD keypress — a press() can start and end inside one animation frame
await p.keyboard.down('e'); await p.waitForTimeout(140); await p.keyboard.up('e');
await p.waitForTimeout(2200);
const inside = await p.evaluate(() => window.__ct.pos());
console.log('after E ', inside.map((v) => (+v).toFixed(2)).join(', '));

// ct/int-jail.ts builds the room in its own space at x > 400
const entered = inside[0] > 400;
console.log(`entered the jail interior: ${entered}`);
console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none');
await b.close();

const ok = hasPrompt && entered && advanced > 2.0 && errs.length === 0;
console.log(`\n${ok ? 'PASS' : 'FAIL'}: walked in, prompted, and entered`);
process.exit(ok ? 0 : 1);
